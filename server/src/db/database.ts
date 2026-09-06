import fs from 'fs';
import path from 'path';
import { 
  AnonymousUser, 
  Room, 
  RoomMember, 
  ChatMessage, 
  AbuseReport, 
  UserBlock,
  RoomType,
  RoomStatus 
} from '../../../shared/types.js';

// Simple in-process Mutex for atomic operations per room/queue
class AsyncLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    let release: () => void;
    const promise = new Promise<void>(resolve => {
      release = resolve;
    });

    this.locks.set(key, promise);

    return () => {
      this.locks.delete(key);
      release();
    };
  }
}

export class Database {
  private dataDir: string;
  private usersFile: string;
  private roomsFile: string;
  private reportsFile: string;
  private blocksFile: string;
  private messagesFile: string;

  public users = new Map<string, AnonymousUser>();       // internalId -> User
  public usersByPublicId = new Map<string, string>();    // publicId -> internalId
  public rooms = new Map<string, Room>();                // roomId -> Room
  public roomsByCode = new Map<string, string>();        // code (uppercase) -> roomId
  public roomsByToken = new Map<string, string>();       // inviteToken -> roomId
  public messages = new Map<string, ChatMessage[]>();    // roomId -> ChatMessage[]
  public reports: AbuseReport[] = [];
  public blocks: UserBlock[] = [];

  private roomLocks = new AsyncLock();
  private persistTimeout: NodeJS.Timeout | null = null;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create data directory, running in memory-only mode:', err);
      }
    }

    this.usersFile = path.join(this.dataDir, 'users.json');
    this.roomsFile = path.join(this.dataDir, 'rooms.json');
    this.reportsFile = path.join(this.dataDir, 'reports.json');
    this.blocksFile = path.join(this.dataDir, 'blocks.json');
    this.messagesFile = path.join(this.dataDir, 'messages.json');

    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.usersFile)) {
        const data: AnonymousUser[] = JSON.parse(fs.readFileSync(this.usersFile, 'utf-8'));
        data.forEach(user => {
          this.users.set(user.internalId, user);
          this.usersByPublicId.set(user.publicId, user.internalId);
        });
      }
      if (fs.existsSync(this.reportsFile)) {
        this.reports = JSON.parse(fs.readFileSync(this.reportsFile, 'utf-8'));
      }
      if (fs.existsSync(this.blocksFile)) {
        this.blocks = JSON.parse(fs.readFileSync(this.blocksFile, 'utf-8'));
      }
      if (fs.existsSync(this.messagesFile)) {
        const data: Record<string, ChatMessage[]> = JSON.parse(fs.readFileSync(this.messagesFile, 'utf-8'));
        Object.entries(data).forEach(([roomId, msgs]) => {
          this.messages.set(roomId, msgs);
        });
      }
    } catch (err) {
      console.warn('Error loading stored data from disk:', err);
    }
  }

  public schedulePersist(): void {
    if (this.persistTimeout) return;
    this.persistTimeout = setTimeout(() => {
      this.persistTimeout = null;
      this.flushToDisk();
    }, 1000);
  }

  public flushToDisk(): void {
    try {
      if (!fs.existsSync(this.dataDir)) return;
      fs.writeFileSync(this.usersFile, JSON.stringify(Array.from(this.users.values()), null, 2));
      fs.writeFileSync(this.reportsFile, JSON.stringify(this.reports, null, 2));
      fs.writeFileSync(this.blocksFile, JSON.stringify(this.blocks, null, 2));
      
      const msgsObj: Record<string, ChatMessage[]> = {};
      this.messages.forEach((v, k) => { msgsObj[k] = v; });
      fs.writeFileSync(this.messagesFile, JSON.stringify(msgsObj, null, 2));
    } catch (err) {
      console.warn('Error persisting data to disk:', err);
    }
  }

  // --- USER OPERATIONS ---
  public createUser(user: AnonymousUser): AnonymousUser {
    if (this.usersByPublicId.has(user.publicId)) {
      throw new Error(`Collision: Public ID ${user.publicId} is already taken.`);
    }
    this.users.set(user.internalId, user);
    this.usersByPublicId.set(user.publicId, user.internalId);
    this.schedulePersist();
    return user;
  }

  public getUser(internalId: string): AnonymousUser | undefined {
    return this.users.get(internalId);
  }

  public getUserByPublicId(publicId: string): AnonymousUser | undefined {
    const internalId = this.usersByPublicId.get(publicId);
    if (!internalId) return undefined;
    return this.users.get(internalId);
  }

  public updateUser(internalId: string, updates: Partial<AnonymousUser>): AnonymousUser {
    const existing = this.users.get(internalId);
    if (!existing) {
      throw new Error('User not found');
    }
    const updated = { ...existing, ...updates };
    this.users.set(internalId, updated);
    this.schedulePersist();
    return updated;
  }

  public isPublicIdTaken(publicId: string): boolean {
    return this.usersByPublicId.has(publicId);
  }

  // --- ROOM OPERATIONS (ATOMIC & CONCURRENCY SAFE) ---
  public createRoom(room: Room): Room {
    this.rooms.set(room.id, room);
    this.roomsByCode.set(room.code.toUpperCase(), room.id);
    if (room.inviteToken) {
      this.roomsByToken.set(room.inviteToken, room.id);
    }
    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public getRoomByCode(code: string): Room | undefined {
    const roomId = this.roomsByCode.get(code.trim().toUpperCase());
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  public getRoomByToken(token: string): Room | undefined {
    const roomId = this.roomsByToken.get(token.trim());
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /**
   * ATOMIC JOIN ROOM:
   * Acquires room-level lock to strictly verify capacity and prevent race conditions.
   * Throws "This room is full." if member count >= maxUsers.
   */
  public async joinRoomAtomic(
    roomId: string, 
    member: RoomMember
  ): Promise<{ success: boolean; room: Room }> {
    const release = await this.roomLocks.acquire(roomId);
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      if (room.status === 'ENDED' || room.status === 'EXPIRED') {
        throw new Error('This room has ended.');
      }

      // Check if user is already in room
      const existingMember = room.members.find((m: RoomMember) => m.userId === member.userId || m.publicId === member.publicId);
      if (existingMember) {
        return { success: true, room };
      }

      // STRICT CAPACITY CHECK
      if (room.members.length >= room.maxUsers) {
        throw new Error('This room is full.');
      }

      // Add member safely
      room.members.push(member);
      if (room.members.length >= 2 && room.status === 'WAITING') {
        room.status = 'ACTIVE';
      }

      return { success: true, room };
    } finally {
      release();
    }
  }

  /**
   * ATOMIC LEAVE ROOM:
   * Removes member and updates room status if empty
   */
  public async leaveRoomAtomic(roomId: string, userId: string): Promise<Room | undefined> {
    const release = await this.roomLocks.acquire(roomId);
    try {
      const room = this.rooms.get(roomId);
      if (!room) return undefined;

      room.members = room.members.filter((m: RoomMember) => m.userId !== userId);
      if (room.members.length === 0) {
        room.status = 'ENDED';
      } else if (room.members.length === 1 && room.type === 'random') {
        room.status = 'WAITING';
      }

      return room;
    } finally {
      release();
    }
  }

  public updateMemberVoice(
    roomId: string, 
    publicId: string, 
    updates: { voiceState?: RoomMember['voiceState']; isMuted?: boolean }
  ): RoomMember | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const member = room.members.find((m: RoomMember) => m.publicId === publicId);
    if (!member) return undefined;
    if (updates.voiceState !== undefined) member.voiceState = updates.voiceState;
    if (updates.isMuted !== undefined) member.isMuted = updates.isMuted;
    return member;
  }

  // --- CHAT MESSAGES ---
  public addMessage(message: ChatMessage): ChatMessage {
    const roomMsgs = this.messages.get(message.roomId) || [];
    roomMsgs.push(message);
    this.messages.set(message.roomId, roomMsgs);
    this.schedulePersist();
    return message;
  }

  public getMessages(roomId: string): ChatMessage[] {
    return (this.messages.get(roomId) || []).filter(m => !m.isDeleted);
  }

  public deleteMessage(roomId: string, messageId: string, userPublicId: string): boolean {
    const roomMsgs = this.messages.get(roomId) || [];
    const msg = roomMsgs.find(m => m.id === messageId);
    if (!msg || msg.senderPublicId !== userPublicId) {
      return false;
    }
    msg.isDeleted = true;
    this.schedulePersist();
    return true;
  }

  // --- MODERATION: REPORTS & BLOCKS ---
  public addReport(report: AbuseReport): AbuseReport {
    this.reports.push(report);
    this.schedulePersist();
    return report;
  }

  public addBlock(blockerPublicId: string, blockedPublicId: string): void {
    if (blockerPublicId === blockedPublicId) return;
    const exists = this.blocks.some(
      b => b.blockerPublicId === blockerPublicId && b.blockedPublicId === blockedPublicId
    );
    if (!exists) {
      this.blocks.push({ blockerPublicId, blockedPublicId, createdAt: Date.now() });
      this.schedulePersist();
    }
  }

  public isBlocked(user1PublicId: string, user2PublicId: string): boolean {
    return this.blocks.some(
      b => (b.blockerPublicId === user1PublicId && b.blockedPublicId === user2PublicId) ||
           (b.blockerPublicId === user2PublicId && b.blockedPublicId === user1PublicId)
    );
  }

  public getAllReports(): AbuseReport[] {
    return [...this.reports];
  }

  public banUser(publicId: string): boolean {
    const user = this.getUserByPublicId(publicId);
    if (!user) return false;
    user.isBanned = true;
    this.schedulePersist();
    return true;
  }

  // Clear memory (used in testing)
  public clear(): void {
    this.users.clear();
    this.usersByPublicId.clear();
    this.rooms.clear();
    this.roomsByCode.clear();
    this.roomsByToken.clear();
    this.messages.clear();
    this.reports = [];
    this.blocks = [];
  }
}

export const db = new Database();
