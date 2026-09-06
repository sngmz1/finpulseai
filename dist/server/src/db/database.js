import fs from 'fs';
import path from 'path';
// Simple in-process Mutex for atomic operations per room/queue
class AsyncLock {
    locks = new Map();
    async acquire(key) {
        while (this.locks.has(key)) {
            await this.locks.get(key);
        }
        let release;
        const promise = new Promise(resolve => {
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
    dataDir;
    usersFile;
    roomsFile;
    reportsFile;
    blocksFile;
    messagesFile;
    users = new Map(); // internalId -> User
    usersByPublicId = new Map(); // publicId -> internalId
    rooms = new Map(); // roomId -> Room
    roomsByCode = new Map(); // code (uppercase) -> roomId
    roomsByToken = new Map(); // inviteToken -> roomId
    messages = new Map(); // roomId -> ChatMessage[]
    reports = [];
    blocks = [];
    roomLocks = new AsyncLock();
    persistTimeout = null;
    constructor(dataDir) {
        this.dataDir = dataDir || path.join(process.cwd(), 'data');
        if (!fs.existsSync(this.dataDir)) {
            try {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }
            catch (err) {
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
    loadFromDisk() {
        try {
            if (fs.existsSync(this.usersFile)) {
                const data = JSON.parse(fs.readFileSync(this.usersFile, 'utf-8'));
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
                const data = JSON.parse(fs.readFileSync(this.messagesFile, 'utf-8'));
                Object.entries(data).forEach(([roomId, msgs]) => {
                    this.messages.set(roomId, msgs);
                });
            }
        }
        catch (err) {
            console.warn('Error loading stored data from disk:', err);
        }
    }
    schedulePersist() {
        if (this.persistTimeout)
            return;
        this.persistTimeout = setTimeout(() => {
            this.persistTimeout = null;
            this.flushToDisk();
        }, 1000);
    }
    flushToDisk() {
        try {
            if (!fs.existsSync(this.dataDir))
                return;
            fs.writeFileSync(this.usersFile, JSON.stringify(Array.from(this.users.values()), null, 2));
            fs.writeFileSync(this.reportsFile, JSON.stringify(this.reports, null, 2));
            fs.writeFileSync(this.blocksFile, JSON.stringify(this.blocks, null, 2));
            const msgsObj = {};
            this.messages.forEach((v, k) => { msgsObj[k] = v; });
            fs.writeFileSync(this.messagesFile, JSON.stringify(msgsObj, null, 2));
        }
        catch (err) {
            console.warn('Error persisting data to disk:', err);
        }
    }
    // --- USER OPERATIONS ---
    createUser(user) {
        if (this.usersByPublicId.has(user.publicId)) {
            throw new Error(`Collision: Public ID ${user.publicId} is already taken.`);
        }
        this.users.set(user.internalId, user);
        this.usersByPublicId.set(user.publicId, user.internalId);
        this.schedulePersist();
        return user;
    }
    getUser(internalId) {
        return this.users.get(internalId);
    }
    getUserByPublicId(publicId) {
        const internalId = this.usersByPublicId.get(publicId);
        if (!internalId)
            return undefined;
        return this.users.get(internalId);
    }
    updateUser(internalId, updates) {
        const existing = this.users.get(internalId);
        if (!existing) {
            throw new Error('User not found');
        }
        const updated = { ...existing, ...updates };
        this.users.set(internalId, updated);
        this.schedulePersist();
        return updated;
    }
    isPublicIdTaken(publicId) {
        return this.usersByPublicId.has(publicId);
    }
    // --- ROOM OPERATIONS (ATOMIC & CONCURRENCY SAFE) ---
    createRoom(room) {
        this.rooms.set(room.id, room);
        this.roomsByCode.set(room.code.toUpperCase(), room.id);
        if (room.inviteToken) {
            this.roomsByToken.set(room.inviteToken, room.id);
        }
        return room;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    getRoomByCode(code) {
        const roomId = this.roomsByCode.get(code.trim().toUpperCase());
        if (!roomId)
            return undefined;
        return this.rooms.get(roomId);
    }
    getRoomByToken(token) {
        const roomId = this.roomsByToken.get(token.trim());
        if (!roomId)
            return undefined;
        return this.rooms.get(roomId);
    }
    /**
     * ATOMIC JOIN ROOM:
     * Acquires room-level lock to strictly verify capacity and prevent race conditions.
     * Throws "This room is full." if member count >= maxUsers.
     */
    async joinRoomAtomic(roomId, member) {
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
            const existingMember = room.members.find((m) => m.userId === member.userId || m.publicId === member.publicId);
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
        }
        finally {
            release();
        }
    }
    /**
     * ATOMIC LEAVE ROOM:
     * Removes member and updates room status if empty
     */
    async leaveRoomAtomic(roomId, userId) {
        const release = await this.roomLocks.acquire(roomId);
        try {
            const room = this.rooms.get(roomId);
            if (!room)
                return undefined;
            room.members = room.members.filter((m) => m.userId !== userId);
            if (room.members.length === 0) {
                room.status = 'ENDED';
            }
            else if (room.members.length === 1 && room.type === 'random') {
                room.status = 'WAITING';
            }
            return room;
        }
        finally {
            release();
        }
    }
    updateMemberVoice(roomId, publicId, updates) {
        const room = this.rooms.get(roomId);
        if (!room)
            return undefined;
        const member = room.members.find((m) => m.publicId === publicId);
        if (!member)
            return undefined;
        if (updates.voiceState !== undefined)
            member.voiceState = updates.voiceState;
        if (updates.isMuted !== undefined)
            member.isMuted = updates.isMuted;
        return member;
    }
    // --- CHAT MESSAGES ---
    addMessage(message) {
        const roomMsgs = this.messages.get(message.roomId) || [];
        roomMsgs.push(message);
        this.messages.set(message.roomId, roomMsgs);
        this.schedulePersist();
        return message;
    }
    getMessages(roomId) {
        return (this.messages.get(roomId) || []).filter(m => !m.isDeleted);
    }
    deleteMessage(roomId, messageId, userPublicId) {
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
    addReport(report) {
        this.reports.push(report);
        this.schedulePersist();
        return report;
    }
    addBlock(blockerPublicId, blockedPublicId) {
        if (blockerPublicId === blockedPublicId)
            return;
        const exists = this.blocks.some(b => b.blockerPublicId === blockerPublicId && b.blockedPublicId === blockedPublicId);
        if (!exists) {
            this.blocks.push({ blockerPublicId, blockedPublicId, createdAt: Date.now() });
            this.schedulePersist();
        }
    }
    isBlocked(user1PublicId, user2PublicId) {
        return this.blocks.some(b => (b.blockerPublicId === user1PublicId && b.blockedPublicId === user2PublicId) ||
            (b.blockerPublicId === user2PublicId && b.blockedPublicId === user1PublicId));
    }
    getAllReports() {
        return [...this.reports];
    }
    banUser(publicId) {
        const user = this.getUserByPublicId(publicId);
        if (!user)
            return false;
        user.isBanned = true;
        this.schedulePersist();
        return true;
    }
    // Clear memory (used in testing)
    clear() {
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
