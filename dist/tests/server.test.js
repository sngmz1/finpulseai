import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../server/src/db/database.js';
import { RoomService } from '../server/src/services/roomService.js';
import { MatchmakingService } from '../server/src/services/matchmakingService.js';
import { generateCharacterName, generatePublicId } from '../server/src/services/identityService.js';
describe('ANONYMOUS SOCIAL PLATFORM - CRITICAL VERIFICATIONS', () => {
    let db;
    let roomService;
    let matchmaking;
    beforeEach(() => {
        db = new Database();
        db.clear();
        roomService = new RoomService(db);
        matchmaking = new MatchmakingService(db, roomService);
    });
    // SECTION 73: DUPLICATE ID TEST (1,000+ IDs test)
    describe('Identity Generation & Collision Resistance', () => {
        it('generates 1,000 anonymous identities without a single collision', () => {
            const generatedIds = new Set();
            const names = new Set();
            for (let i = 0; i < 1000; i++) {
                const name = generateCharacterName(['anime', 'gaming']);
                names.add(name);
                const publicId = generatePublicId(name);
                expect(generatedIds.has(publicId)).toBe(false);
                generatedIds.add(publicId);
                // Format check: e.g. "SHD-7X92-K4"
                expect(publicId).toMatch(/^[A-Z]{2,3}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);
            }
            expect(generatedIds.size).toBe(1000);
            // Names should have great variety
            expect(names.size).toBeGreaterThan(50);
        });
        it('enforces database uniqueness constraint on public IDs', () => {
            const user1 = {
                internalId: 'uuid-1',
                publicId: 'VR-TEST-01',
                characterName: 'ShadowRen',
                avatarStyle: 'shadow',
                interests: ['anime'],
                bio: '',
                voicePreference: 'voice_and_text',
                presence: 'online',
                createdAt: Date.now(),
            };
            db.createUser(user1);
            // Attempt to register another user with duplicate publicId
            const user2 = {
                ...user1,
                internalId: 'uuid-2',
            };
            expect(() => db.createUser(user2)).toThrow(/Collision/);
        });
    });
    // SECTION 72: CRITICAL 3-USER ROOM CAPACITY AND RACE CONDITION TEST
    describe('Room Capacity Enforcement (Strict 3-User Limit on Random Rooms)', () => {
        it('allows User 1, User 2, and User 3 to join a random room, but strictly REJECTS User 4 with "This room is full."', async () => {
            const room = roomService.createRoom('random', { interests: ['anime'] });
            expect(room.maxUsers).toBe(3);
            const createUser = (id, name) => ({
                internalId: `user-id-${id}`,
                publicId: `VR-${id}00-XX`,
                characterName: name,
                avatarStyle: 'cyber',
                interests: ['anime'],
                bio: '',
                voicePreference: 'voice_and_text',
                presence: 'online',
                createdAt: Date.now(),
            });
            const user1 = createUser('1', 'VoidRen');
            const user2 = createUser('2', 'KairoX');
            const user3 = createUser('3', 'MoonByte');
            const user4 = createUser('4', 'SpecterNox');
            // User 1 joins
            const res1 = await roomService.joinRoom(room.id, user1);
            expect(res1.success).toBe(true);
            expect(res1.room.members.length).toBe(1);
            // User 2 joins
            const res2 = await roomService.joinRoom(room.id, user2);
            expect(res2.success).toBe(true);
            expect(res2.room.members.length).toBe(2);
            // User 3 joins
            const res3 = await roomService.joinRoom(room.id, user3);
            expect(res3.success).toBe(true);
            expect(res3.room.members.length).toBe(3);
            // User 4 attempts to join -> MUST BE REJECTED
            await expect(roomService.joinRoom(room.id, user4)).rejects.toThrow('This room is full.');
            // Verify room member count did not exceed 3
            const roomAfter = db.getRoom(room.id);
            expect(roomAfter?.members.length).toBe(3);
        });
        it('prevents race conditions when 10 users concurrently attempt to join a 3-user room', async () => {
            const room = roomService.createRoom('random', { interests: ['gaming'] });
            const users = Array.from({ length: 10 }, (_, i) => ({
                internalId: `concurrent-user-${i}`,
                publicId: `CON-${i}00-AA`,
                characterName: `Player${i}`,
                avatarStyle: 'neon',
                interests: ['gaming'],
                bio: '',
                voicePreference: 'voice_and_text',
                presence: 'online',
                createdAt: Date.now(),
            }));
            // Launch 10 simultaneous join requests
            const results = await Promise.allSettled(users.map(u => roomService.joinRoom(room.id, u)));
            const successfulJoins = results.filter(r => r.status === 'fulfilled');
            const rejectedJoins = results.filter(r => r.status === 'rejected');
            // Exactly 3 must succeed
            expect(successfulJoins.length).toBe(3);
            // Exactly 7 must fail with "This room is full."
            expect(rejectedJoins.length).toBe(7);
            rejectedJoins.forEach(res => {
                if (res.status === 'rejected') {
                    expect(res.reason.message).toBe('This room is full.');
                }
            });
            const finalRoom = db.getRoom(room.id);
            expect(finalRoom?.members.length).toBe(3);
        });
    });
    // MATCHMAKING ALGORITHM & SAFETY BLOCKS
    describe('Matchmaking & Safety Blocking', () => {
        it('accurately calculates interest overlap score', () => {
            const score1 = matchmaking.calculateMatchScore(['anime', 'gaming'], ['gaming', 'music']);
            expect(score1).toBeGreaterThan(0); // 1 intersection / 3 union = 0.333
            const score2 = matchmaking.calculateMatchScore(['anime', 'gaming'], ['anime', 'gaming']);
            expect(score2).toBe(1.0); // 2 intersection / 2 union = 1.0
            const score3 = matchmaking.calculateMatchScore(['coding'], ['cooking']);
            expect(score3).toBe(0.0);
        });
        it('strictly isolates blocked users from entering the same room', async () => {
            const userA = {
                internalId: 'user-a',
                publicId: 'USA-1234-AA',
                characterName: 'Alpha',
                avatarStyle: 'shadow',
                interests: ['anime'],
                bio: '',
                voicePreference: 'voice_and_text',
                presence: 'online',
                createdAt: Date.now(),
            };
            const userB = {
                internalId: 'user-b',
                publicId: 'USB-5678-BB',
                characterName: 'Beta',
                avatarStyle: 'cyber',
                interests: ['anime'],
                bio: '',
                voicePreference: 'voice_and_text',
                presence: 'online',
                createdAt: Date.now(),
            };
            db.createUser(userA);
            db.createUser(userB);
            // User A blocks User B
            db.addBlock(userA.publicId, userB.publicId);
            expect(db.isBlocked(userA.publicId, userB.publicId)).toBe(true);
            // Create a room and add User A
            const room = roomService.createRoom('invite', { maxUsers: 10 });
            await roomService.joinRoom(room.id, userA);
            // User B attempts to join same room -> Blocked!
            await expect(roomService.joinRoom(room.id, userB)).rejects.toThrow(/Cannot join room due to privacy \/ safety preferences/);
        });
    });
    // PRIVATE INVITE ROOMS
    describe('Private Invite Rooms', () => {
        it('supports scalable room capacity (>6 users e.g. 15)', async () => {
            const inviteRoom = roomService.createRoom('invite', { maxUsers: 15 });
            expect(inviteRoom.maxUsers).toBe(15);
            expect(inviteRoom.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
            expect(inviteRoom.inviteToken).toBeDefined();
            // Join 8 users
            for (let i = 0; i < 8; i++) {
                const u = {
                    internalId: `invite-user-${i}`,
                    publicId: `INV-${i}00-XX`,
                    characterName: `Member${i}`,
                    avatarStyle: 'toon',
                    interests: ['art'],
                    bio: '',
                    voicePreference: 'voice_and_text',
                    presence: 'online',
                    createdAt: Date.now(),
                };
                const res = await roomService.joinRoom(inviteRoom.code, u, inviteRoom.inviteToken);
                expect(res.success).toBe(true);
            }
            const roomNow = db.getRoom(inviteRoom.id);
            expect(roomNow?.members.length).toBe(8);
        });
    });
});
