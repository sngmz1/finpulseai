import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { generateRoomCode, generateInviteToken } from './identityService.js';
export class RoomService {
    database;
    static MAX_RANDOM_ROOM_USERS = 3;
    static MAX_INVITE_ROOM_USERS = 20;
    constructor(database = db) {
        this.database = database;
    }
    createRoom(type = 'invite', options = {}) {
        const id = uuidv4();
        let code;
        // Ensure room code uniqueness
        let attempts = 0;
        do {
            code = generateRoomCode();
            attempts++;
            if (attempts > 50) {
                code = `${generateRoomCode()}-${Math.floor(Math.random() * 90 + 10)}`;
                break;
            }
        } while (this.database.getRoomByCode(code));
        // Strict limits: random rooms are capped at exactly 3 users
        const maxUsers = type === 'random'
            ? RoomService.MAX_RANDOM_ROOM_USERS
            : Math.min(options.maxUsers || RoomService.MAX_INVITE_ROOM_USERS, 50);
        const room = {
            id,
            code,
            type,
            maxUsers,
            status: 'WAITING',
            interests: options.interests?.map(i => i.toLowerCase()) || [],
            members: [],
            createdAt: Date.now(),
            inviteToken: type === 'invite' ? generateInviteToken() : undefined,
        };
        return this.database.createRoom(room);
    }
    async joinRoom(roomIdOrCode, user, inviteToken) {
        // Check if user is banned
        if (user.isBanned) {
            throw new Error('This anonymous account is currently suspended.');
        }
        // Try finding by ID first, then code, then token
        let room = this.database.getRoom(roomIdOrCode) ||
            this.database.getRoomByCode(roomIdOrCode) ||
            (inviteToken ? this.database.getRoomByToken(inviteToken) : undefined);
        if (!room) {
            throw new Error('Room not found or room code is invalid.');
        }
        // If invite room has token, validate token if provided
        if (room.type === 'invite' && inviteToken && room.inviteToken && room.inviteToken !== inviteToken) {
            throw new Error('Invalid or expired invite token.');
        }
        // Check if any existing member has blocked this user or vice versa
        for (const member of room.members) {
            if (this.database.isBlocked(user.publicId, member.publicId)) {
                throw new Error('Cannot join room due to privacy / safety preferences.');
            }
        }
        const member = {
            userId: user.internalId,
            publicId: user.publicId,
            characterName: user.characterName,
            avatarStyle: user.avatarStyle,
            joinedAt: Date.now(),
            isHost: room.members.length === 0,
            isMuted: false,
            voiceState: 'listening',
            connectionQuality: 'good',
        };
        // ATOMIC CAPACITY VERIFICATION (Prevents race condition)
        const result = await this.database.joinRoomAtomic(room.id, member);
        return {
            success: true,
            room: result.room,
            selfMember: member,
        };
    }
    async leaveRoom(roomId, userId) {
        return this.database.leaveRoomAtomic(roomId, userId);
    }
    getRoom(roomIdOrCode) {
        return this.database.getRoom(roomIdOrCode) || this.database.getRoomByCode(roomIdOrCode);
    }
}
export const roomService = new RoomService();
