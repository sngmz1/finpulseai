import { Server, Socket } from 'socket.io';
import { Database, db } from '../db/database.js';
import { RoomService, roomService } from '../services/roomService.js';
import { MatchmakingService, matchmakingService } from '../services/matchmakingService.js';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  ChatMessage,
  VoiceState 
} from '../../../shared/types.js';
import { SendMessageSchema, ReportUserSchema, BlockUserSchema } from '../../../shared/validation.js';
import { v4 as uuidv4 } from 'uuid';

// Map socketId -> internalUserId
const socketToUser = new Map<string, string>();
// Map internalUserId -> Set<socketId>
const userToSockets = new Map<string, Set<string>>();
// Map socketId -> currentRoomId
const socketToRoom = new Map<string, string>();

export function setupSocketHandler(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  database: Database = db,
  rooms: RoomService = roomService,
  matchmaking: MatchmakingService = matchmakingService
) {
  io.on('connection', (socket: any) => {
    const internalUserId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

    if (!internalUserId || typeof internalUserId !== 'string') {
      // Disconnect unauthenticated sockets
      socket.disconnect(true);
      return;
    }

    const user = database.getUser(internalUserId);
    if (!user || user.isBanned) {
      socket.emit('room:error', {
        code: 'AUTH_FAILED',
        message: 'Invalid session or account is suspended.',
      });
      socket.disconnect(true);
      return;
    }

    // Register socket
    socketToUser.set(socket.id, internalUserId);
    if (!userToSockets.has(internalUserId)) {
      userToSockets.set(internalUserId, new Set());
    }
    userToSockets.get(internalUserId)!.add(socket.id);

    // --- ROOM ACTIONS ---
    socket.on('room:create', async ({ type, maxUsers, interests }: { type?: 'random' | 'invite' | 'nearby'; maxUsers?: number; interests?: string[] }, callback: (res: any) => void) => {
      try {
        const currentUser = database.getUser(internalUserId);
        if (!currentUser) {
          if (typeof callback === 'function') callback({ success: false, error: 'User session not found' });
          return;
        }

        const room = rooms.createRoom(type || 'invite', {
          maxUsers: maxUsers || 20,
          interests: interests || currentUser.interests,
        });

        // Host automatically joins the room
        const joinResult = await rooms.joinRoom(room.id, currentUser, room.inviteToken);
        socket.join(room.id);
        socketToRoom.set(socket.id, room.id);

        if (typeof callback === 'function') {
          callback({
            success: true,
            room: joinResult.room,
            code: room.code,
            inviteToken: room.inviteToken,
          });
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({
            success: false,
            error: err.message || 'Failed to create room',
          });
        }
      }
    });

    socket.on('room:join', async ({ roomIdOrCode, inviteToken }: { roomIdOrCode: string; inviteToken?: string }, callback: (res: any) => void) => {
      try {
        const currentUser = database.getUser(internalUserId);
        if (!currentUser) {
          return callback({ success: false, error: 'User session not found' });
        }

        const joinResult = await rooms.joinRoom(roomIdOrCode, currentUser, inviteToken);
        const room = joinResult.room;

        // Leave any previous socket rooms
        const prevRoomId = socketToRoom.get(socket.id);
        if (prevRoomId && prevRoomId !== room.id) {
          socket.leave(prevRoomId);
          await rooms.leaveRoom(prevRoomId, internalUserId);
          io.to(prevRoomId).emit('room:user_left', {
            publicId: currentUser.publicId,
            characterName: currentUser.characterName,
            reason: 'joined another room'
          });
        }

        socket.join(room.id);
        socketToRoom.set(socket.id, room.id);

        // Notify others in room
        socket.to(room.id).emit('room:user_joined', {
          member: joinResult.selfMember,
        });

        // Send confirmation to joining user
        callback({
          success: true,
          room,
        });
      } catch (err: any) {
        callback({
          success: false,
          error: err.message || 'Failed to join room',
        });
      }
    });

    socket.on('room:leave', async (callback?: () => void) => {
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        socket.leave(roomId);
        socketToRoom.delete(socket.id);
        const updatedRoom = await rooms.leaveRoom(roomId, internalUserId);
        
        socket.to(roomId).emit('room:user_left', {
          publicId: user.publicId,
          characterName: user.characterName,
          reason: 'left room'
        });

        if (updatedRoom) {
          io.to(roomId).emit('room:updated', { room: updatedRoom });
        }
      }
      if (callback) callback();
    });

    // --- VOICE CONTROLS & STATE ---
    socket.on('voice:set_mute', (isMuted: boolean) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      database.updateMemberVoice(roomId, user.publicId, { isMuted });
      io.to(roomId).emit('voice:state_changed', {
        publicId: user.publicId,
        voiceState: isMuted ? 'muted' : 'listening',
        isMuted,
      });
    });

    socket.on('voice:set_state', (voiceState: VoiceState) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      database.updateMemberVoice(roomId, user.publicId, { voiceState });
      io.to(roomId).emit('voice:state_changed', {
        publicId: user.publicId,
        voiceState,
        isMuted: voiceState === 'muted',
      });
    });

    // --- WEBRTC SIGNALING ROUTING ---
    socket.on('webrtc:send_offer', (data: any) => {
      const targetSockets = userToSockets.get(data.toUserId);
      if (targetSockets) {
        targetSockets.forEach(targetId => {
          io.to(targetId).emit('webrtc:offer', data);
        });
      }
    });

    socket.on('webrtc:send_answer', (data: any) => {
      const targetSockets = userToSockets.get(data.toUserId);
      if (targetSockets) {
        targetSockets.forEach(targetId => {
          io.to(targetId).emit('webrtc:answer', data);
        });
      }
    });

    socket.on('webrtc:send_ice_candidate', (data: any) => {
      const targetSockets = userToSockets.get(data.toUserId);
      if (targetSockets) {
        targetSockets.forEach(targetId => {
          io.to(targetId).emit('webrtc:ice_candidate', data);
        });
      }
    });

    // --- CHAT MESSAGING ---
    socket.on('chat:send_message', (data: any, callback: (res: any) => void) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        return callback({ success: false, error: 'You are not in a room.' });
      }

      const validation = SendMessageSchema.safeParse(data);
      if (!validation.success) {
        return callback({ success: false, error: validation.error.issues[0]?.message || 'Invalid message' });
      }

      const room = database.getRoom(roomId);
      if (!room) {
        return callback({ success: false, error: 'Room does not exist.' });
      }

      let replyToData;
      if (data.replyToId) {
        const existingMessages = database.getMessages(roomId);
        const targetMsg = existingMessages.find(m => m.id === data.replyToId);
        if (targetMsg) {
          replyToData = {
            id: targetMsg.id,
            senderCharacterName: targetMsg.senderCharacterName,
            contentSnippet: targetMsg.content.slice(0, 60),
          };
        }
      }

      const message: ChatMessage = {
        id: uuidv4(),
        roomId,
        senderPublicId: user.publicId,
        senderCharacterName: user.characterName,
        senderAvatarStyle: user.avatarStyle,
        content: validation.data.content,
        replyTo: replyToData,
        createdAt: Date.now(),
      };

      database.addMessage(message);

      // Broadcast to all members in room
      io.to(roomId).emit('chat:message', message);
      callback({ success: true, message });
    });

    socket.on('chat:delete_message', (messageId: string, callback: (res: any) => void) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        return callback({ success: false, error: 'Not in a room' });
      }

      const deleted = database.deleteMessage(roomId, messageId, user.publicId);
      if (deleted) {
        io.to(roomId).emit('chat:message_deleted', { messageId });
        callback({ success: true });
      } else {
        callback({ success: false, error: 'Unable to delete message' });
      }
    });

    // --- MATCHMAKING ACTIONS ---
    socket.on('match:start', async ({ interests, language }: { interests: string[]; language?: string }, callback?: (res: any) => void) => {
      try {
        matchmaking.addToQueue(user, interests, socket.id, language);
        if (typeof callback === 'function') callback({ success: true, status: 'WAITING' });

        // Attempt instant match
        const result = await matchmaking.findMatch(user.internalId);
        if (result.matched && result.room && result.matchedUserIds) {
          // Broadcast match confirmation to ALL participants in the matched room
          for (const uid of result.matchedUserIds) {
            const userSocketSet = userToSockets.get(uid);
            if (userSocketSet) {
              userSocketSet.forEach(sId => {
                io.to(sId).emit('match:status', {
                  status: 'MATCHED',
                  roomId: result.room!.id,
                  roomCode: result.room!.code,
                  matchedInterests: result.matchedInterests,
                });
              });
            }
          }
        } else {
          socket.emit('match:status', {
            status: 'WAITING',
            message: 'Looking for someone compatible...',
          });
        }
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err.message || 'Failed to enter matching queue' });
      }
    });

    socket.on('match:cancel', (callback?: (res: any) => void) => {
      matchmaking.removeFromQueue(user.internalId);
      socket.emit('match:status', { status: 'CANCELLED' });
      if (typeof callback === 'function') callback({ success: true });
    });

    // --- SAFETY ACTIONS ---
    socket.on('safety:report', ({ reportedPublicId, reason, details, messageId }: any, callback: (res: any) => void) => {
      const validation = ReportUserSchema.safeParse({ reportedPublicId, reason, details, messageId });
      if (!validation.success) {
        return callback({ success: false, error: 'Invalid report data' });
      }

      const roomId = socketToRoom.get(socket.id);
      database.addReport({
        id: uuidv4(),
        reporterPublicId: user.publicId,
        reportedPublicId,
        reason: validation.data.reason,
        details: validation.data.details,
        roomId,
        messageId,
        createdAt: Date.now(),
        status: 'PENDING',
      });

      callback({ success: true });
    });

    socket.on('safety:block', ({ targetPublicId }: any, callback: (res: any) => void) => {
      const validation = BlockUserSchema.safeParse({ targetPublicId });
      if (!validation.success) {
        return callback({ success: false });
      }

      database.addBlock(user.publicId, targetPublicId);
      socket.emit('safety:user_blocked', { blockedPublicId: targetPublicId });
      callback({ success: true });
    });

    // --- DISCONNECTION CLEANUP ---
    socket.on('disconnect', async () => {
      // Clean socket maps
      socketToUser.delete(socket.id);
      const userSockets = userToSockets.get(internalUserId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userToSockets.delete(internalUserId);
          matchmaking.removeFromQueue(internalUserId);
        }
      }

      // Leave current room
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        socketToRoom.delete(socket.id);
        const updatedRoom = await rooms.leaveRoom(roomId, internalUserId);
        socket.to(roomId).emit('room:user_left', {
          publicId: user.publicId,
          characterName: user.characterName,
          reason: 'disconnected'
        });
        if (updatedRoom) {
          io.to(roomId).emit('room:updated', { room: updatedRoom });
        }
      }
    });
  });

  // Periodic background queue matching ticker
  const matchmakingInterval = setInterval(async () => {
    try {
      const matches = await matchmaking.findMatchesForQueue();
      for (const m of matches) {
        for (const uid of m.matchedUserIds) {
          const userSocketSet = userToSockets.get(uid);
          if (userSocketSet) {
            userSocketSet.forEach(sId => {
              io.to(sId).emit('match:status', {
                status: 'MATCHED',
                roomId: m.room.id,
                roomCode: m.room.code,
                matchedInterests: m.matchedInterests,
              });
            });
          }
        }
      }
    } catch (e) {
      // queue cycle error suppression
    }
  }, 2500);

  io.engine.on('close', () => {
    clearInterval(matchmakingInterval);
  });
}
