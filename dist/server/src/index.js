import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { db } from './db/database.js';
import { roomService } from './services/roomService.js';
import { matchmakingService } from './services/matchmakingService.js';
import { createApiRouter } from './routes/api.js';
import { setupSocketHandler } from './websocket/socketHandler.js';
dotenv.config();
const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);
// CORS configuration for cross-device, local network, and Netlify production origins
app.use(cors({
    origin: (_origin, callback) => {
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));
// Rate limiting: general API protection
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', generalLimiter);
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        activeRooms: db.rooms.size,
        totalUsers: db.users.size,
    });
});
// API Routes
const apiRouter = createApiRouter(db, roomService, matchmakingService);
app.use('/api', apiRouter);
// Setup Socket.IO
const io = new Server(server, {
    cors: {
        origin: (_origin, callback) => callback(null, true),
        credentials: true,
        methods: ['GET', 'POST'],
    },
    pingTimeout: 25000,
    pingInterval: 10000,
});
setupSocketHandler(io, db, roomService, matchmakingService);
// Serve static frontend files in production if client/dist exists
const clientDistPath = path.join(process.cwd(), 'client', 'dist');
app.use(express.static(clientDistPath));
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
    }
    const indexHtml = path.join(clientDistPath, 'index.html');
    res.sendFile(indexHtml, (err) => {
        if (err) {
            next();
        }
    });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[Server Error]:', err);
    res.status(500).json({ error: 'Internal server error occurred.' });
});
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`[ANONYMOUS SERVER] Real-time Social Voice & Text server listening on port ${PORT}`);
        console.log(`[WEBRTC SIGNALING] Ready for peer-to-peer audio mesh`);
    });
}
export { app, server, io };
