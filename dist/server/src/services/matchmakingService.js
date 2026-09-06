import { db } from '../db/database.js';
import { RoomService, roomService } from './roomService.js';
export class MatchmakingService {
    database;
    rooms;
    queue = new Map(); // userId -> QueuedUser
    cleanupInterval = null;
    static QUEUE_TIMEOUT_MS = 45000; // 45 seconds
    constructor(database = db, rooms = roomService) {
        this.database = database;
        this.rooms = rooms;
        this.startCleanupLoop();
    }
    startCleanupLoop() {
        if (this.cleanupInterval)
            return;
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [userId, queued] of this.queue.entries()) {
                if (now - queued.queuedAt > MatchmakingService.QUEUE_TIMEOUT_MS) {
                    this.queue.delete(userId);
                }
            }
        }, 5000);
    }
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    addToQueue(user, interests, socketId, language = 'en') {
        // Check if banned
        if (user.isBanned) {
            throw new Error('This anonymous account is currently suspended.');
        }
        const normalizedInterests = interests.map(i => i.toLowerCase());
        const queued = {
            user,
            interests: normalizedInterests,
            language,
            queuedAt: Date.now(),
            socketId,
        };
        this.queue.set(user.internalId, queued);
        return queued;
    }
    removeFromQueue(userId) {
        return this.queue.delete(userId);
    }
    isQueued(userId) {
        return this.queue.has(userId);
    }
    getQueuedUser(userId) {
        return this.queue.get(userId);
    }
    /**
     * Computes interest overlap score between 0 and 1
     */
    calculateMatchScore(interestsA, interestsB) {
        if (interestsA.length === 0 && interestsB.length === 0)
            return 0.5; // generic match
        const setA = new Set(interestsA.map(i => i.toLowerCase()));
        const setB = new Set(interestsB.map(i => i.toLowerCase()));
        let intersectionCount = 0;
        for (const item of setA) {
            if (setB.has(item))
                intersectionCount++;
        }
        const unionSize = new Set([...setA, ...setB]).size;
        return unionSize > 0 ? intersectionCount / unionSize : 0;
    }
    /**
     * Try to match a user with existing random rooms or other queued candidates.
     * STRICT CONSTRAINT: Random room NEVER exceeds 3 users.
     */
    /**
     * Try to match a user with existing random rooms or other queued candidates.
     * STRICT CONSTRAINT: Random room NEVER exceeds 3 users.
     */
    async findMatch(userId) {
        const candidate = this.queue.get(userId);
        if (!candidate)
            return { matched: false };
        // 1. First, search for existing ACTIVE or WAITING random rooms that have < 3 members
        const openRooms = [];
        for (const room of this.database.rooms.values()) {
            if (room.type === 'random' &&
                (room.status === 'WAITING' || room.status === 'ACTIVE') &&
                room.members.length < RoomService.MAX_RANDOM_ROOM_USERS) {
                // Verify no blocks between candidate and existing members
                const hasBlockConflict = room.members.some((member) => this.database.isBlocked(candidate.user.publicId, member.publicId));
                if (!hasBlockConflict) {
                    openRooms.push(room);
                }
            }
        }
        // Score open rooms based on interest overlap
        let bestRoom = null;
        let highestScore = -1;
        let bestMatchedInterests = [];
        for (const room of openRooms) {
            const score = this.calculateMatchScore(candidate.interests, room.interests);
            if (score > highestScore) {
                highestScore = score;
                bestRoom = room;
                // Find common interests
                const candidateSet = new Set(candidate.interests);
                bestMatchedInterests = room.interests.filter((i) => candidateSet.has(i));
            }
        }
        // If an open room with compatibility exists, join it
        if (bestRoom) {
            try {
                const existingMemberIds = bestRoom.members.map((m) => m.userId);
                const joinResult = await this.rooms.joinRoom(bestRoom.id, candidate.user);
                this.queue.delete(userId);
                return {
                    matched: true,
                    room: joinResult.room,
                    matchedInterests: bestMatchedInterests,
                    matchedUserIds: [userId, ...existingMemberIds],
                };
            }
            catch (err) {
                // If room became full right as we joined (atomic lock handled it!), continue to next option
            }
        }
        // 2. Second, search for other queued users to form a new random room
        const queuedCandidates = [];
        for (const [otherId, otherQueued] of this.queue.entries()) {
            if (otherId !== userId) {
                // Verify no blocks
                if (!this.database.isBlocked(candidate.user.publicId, otherQueued.user.publicId)) {
                    queuedCandidates.push(otherQueued);
                }
            }
        }
        if (queuedCandidates.length >= 1) {
            // Pick best matching candidate (or up to 2 other candidates to form 3 users max)
            queuedCandidates.sort((a, b) => {
                return this.calculateMatchScore(candidate.interests, b.interests) -
                    this.calculateMatchScore(candidate.interests, a.interests);
            });
            // Group up to 2 other peers (total 3 users max in room)
            const peersToJoin = queuedCandidates.slice(0, 2);
            const allInterests = Array.from(new Set([
                ...candidate.interests,
                ...peersToJoin.flatMap(p => p.interests)
            ]));
            // Create new random room (strictly max 3)
            const newRoom = this.rooms.createRoom('random', {
                interests: allInterests,
            });
            // Join candidate
            await this.rooms.joinRoom(newRoom.id, candidate.user);
            this.queue.delete(userId);
            // Join peers
            const matchedUserIds = [userId];
            for (const peer of peersToJoin) {
                try {
                    await this.rooms.joinRoom(newRoom.id, peer.user);
                    this.queue.delete(peer.user.internalId);
                    matchedUserIds.push(peer.user.internalId);
                }
                catch (e) {
                    // If error, continue
                }
            }
            return {
                matched: true,
                room: this.database.getRoom(newRoom.id),
                matchedInterests: candidate.interests.filter(i => peersToJoin[0]?.interests.includes(i)),
                matchedUserIds,
            };
        }
        // 3. If nobody is available right now, keep candidate in the queue to wait for incoming peers.
        // Do NOT create an empty room or falsely show "matched".
        return {
            matched: false,
        };
    }
    /**
     * Evaluates the waiting queue and forms matches for any waiting pairs
     */
    async findMatchesForQueue() {
        const matches = [];
        const userIds = Array.from(this.queue.keys());
        for (const uid of userIds) {
            if (this.queue.has(uid)) {
                const result = await this.findMatch(uid);
                if (result.matched && result.room && result.matchedUserIds) {
                    matches.push({
                        room: result.room,
                        matchedInterests: result.matchedInterests || [],
                        matchedUserIds: result.matchedUserIds,
                    });
                }
            }
        }
        return matches;
    }
}
export const matchmakingService = new MatchmakingService();
