import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { roomService } from '../services/roomService.js';
import { matchmakingService } from '../services/matchmakingService.js';
import { generateCharacterName, generatePublicId, selectAvatarStyle } from '../services/identityService.js';
import { RegisterAnonymousUserSchema, CreateRoomSchema, CURATED_INTERESTS, CONVERSATION_STARTERS } from '../../../shared/validation.js';
export function createApiRouter(database = db, rooms = roomService, matchmaking = matchmakingService) {
    const router = Router();
    // --- IDENTITY & REGISTRATION ---
    router.get('/interests', (_req, res) => {
        res.json({ interests: CURATED_INTERESTS });
    });
    router.get('/starters', (_req, res) => {
        res.json({ starters: CONVERSATION_STARTERS });
    });
    /**
     * AI-assisted Character Identity Generator
     * Generates original non-copyrighted anime/manhwa/cyber/shadow names and unique IDs
     */
    router.post('/identity/generate', (req, res) => {
        const interests = Array.isArray(req.body.interests) ? req.body.interests : [];
        // Generate name and ensure uniqueness in database
        let characterName = '';
        let publicId = '';
        let attempts = 0;
        do {
            characterName = generateCharacterName(interests);
            publicId = generatePublicId(characterName);
            attempts++;
            if (attempts > 50)
                break;
        } while (database.isPublicIdTaken(publicId));
        const avatarStyle = selectAvatarStyle(interests);
        // AI suggestions for related interest tags
        const lowerInterests = interests.map(i => i.toLowerCase());
        const recommendations = CURATED_INTERESTS.filter((i) => !lowerInterests.includes(i.toLowerCase())).slice(0, 4);
        res.json({
            characterName,
            publicId,
            avatarStyle,
            suggestedInterests: recommendations,
        });
    });
    /**
     * Register or restore an Anonymous User session
     */
    router.post('/users/register-anonymous', (req, res) => {
        const validation = RegisterAnonymousUserSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.issues[0]?.message || 'Invalid input' });
        }
        const { avatarStyle, interests, bio, voicePreference } = validation.data;
        let characterName = validation.data.characterName || generateCharacterName(interests);
        // Generate unique public ID
        let publicId = generatePublicId(characterName);
        let attempts = 0;
        while (database.isPublicIdTaken(publicId) && attempts < 50) {
            publicId = generatePublicId(characterName);
            attempts++;
        }
        const internalId = uuidv4();
        const newUser = {
            internalId,
            publicId,
            characterName,
            avatarStyle,
            interests,
            bio,
            voicePreference,
            presence: 'online',
            createdAt: Date.now(),
        };
        database.createUser(newUser);
        // Return user object (with internalId for client session storage)
        res.status(201).json({
            token: internalId,
            user: newUser,
        });
    });
    /**
     * Fetch current user profile by internal token
     */
    router.get('/users/me', (req, res) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.query.token;
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: missing session token' });
        }
        const user = database.getUser(token);
        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }
        res.json({ user });
    });
    // --- ROOMS & INVITES ---
    router.post('/rooms', (req, res) => {
        const validation = CreateRoomSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.issues[0]?.message || 'Invalid room configuration' });
        }
        const { type, maxUsers, interests } = validation.data;
        const room = rooms.createRoom(type, { maxUsers, interests });
        res.status(201).json({
            room,
            code: room.code,
            inviteToken: room.inviteToken,
        });
    });
    router.get('/rooms/:codeOrId', (req, res) => {
        const codeOrId = Array.isArray(req.params.codeOrId) ? req.params.codeOrId[0] : req.params.codeOrId;
        const room = rooms.getRoom(codeOrId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json({
            room: {
                id: room.id,
                code: room.code,
                type: room.type,
                maxUsers: room.maxUsers,
                currentMembers: room.members.length,
                status: room.status,
                interests: room.interests,
                createdAt: room.createdAt,
            }
        });
    });
    router.get('/invites/:token', (req, res) => {
        const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
        const room = database.getRoomByToken(token);
        if (!room) {
            return res.status(404).json({ error: 'Invite link is invalid or has expired' });
        }
        res.json({
            roomCode: room.code,
            type: room.type,
            maxUsers: room.maxUsers,
            currentMembers: room.members.length,
        });
    });
    // --- PROTECTED ADMIN DASHBOARD ---
    router.get('/admin/metrics', (req, res) => {
        const adminKey = req.headers['x-admin-key'];
        const expectedKey = process.env.ADMIN_KEY || 'anonymous_admin_secret_key_2026';
        if (adminKey !== expectedKey) {
            return res.status(403).json({ error: 'Forbidden: invalid admin credentials' });
        }
        let activeVoiceRooms = 0;
        let totalMembersInRooms = 0;
        for (const room of database.rooms.values()) {
            if (room.status === 'ACTIVE') {
                activeVoiceRooms++;
                totalMembersInRooms += room.members.length;
            }
        }
        res.json({
            activeRooms: activeVoiceRooms,
            totalRooms: database.rooms.size,
            totalUsers: database.users.size,
            membersInRooms: totalMembersInRooms,
            pendingReports: database.reports.filter(r => r.status === 'PENDING').length,
            blockedRelationships: database.blocks.length,
        });
    });
    router.get('/admin/reports', (req, res) => {
        const adminKey = req.headers['x-admin-key'];
        const expectedKey = process.env.ADMIN_KEY || 'anonymous_admin_secret_key_2026';
        if (adminKey !== expectedKey) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json({ reports: database.getAllReports() });
    });
    router.post('/admin/ban', (req, res) => {
        const adminKey = req.headers['x-admin-key'];
        const expectedKey = process.env.ADMIN_KEY || 'anonymous_admin_secret_key_2026';
        if (adminKey !== expectedKey) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { publicId } = req.body;
        if (!publicId)
            return res.status(400).json({ error: 'Missing publicId' });
        const success = database.banUser(publicId);
        res.json({ success, message: success ? `User ${publicId} banned` : 'User not found' });
    });
    return router;
}
