// Shared TypeScript Definitions for Anonymous Random Chat Voice & Text Platform

export type AvatarStyle = 
  | 'shadow'
  | 'cyber'
  | 'fantasy'
  | 'minimal'
  | 'toon'
  | 'mystic'
  | 'space'
  | 'samurai'
  | 'retro'
  | 'neon';

export type VoicePreference = 'voice_and_text' | 'text_only' | 'voice_only';

export type UserPresence = 'online' | 'matching' | 'in_room' | 'away' | 'offline';

export type RoomType = 'random' | 'invite' | 'nearby';

export type RoomStatus = 'WAITING' | 'MATCHING' | 'ACTIVE' | 'RECONNECTING' | 'ENDED' | 'EXPIRED';

export type VoiceState = 'speaking' | 'listening' | 'muted' | 'connecting' | 'reconnecting' | 'disconnected';

export interface AnonymousUser {
  internalId: string;        // Secure internal UUID, never exposed to other clients
  publicId: string;          // Human readable collision-resistant ID e.g. "SHD-7X92-K4"
  characterName: string;     // Procedural or AI-assisted fictional character name e.g. "ShadowKairo"
  avatarStyle: AvatarStyle;  // Abstract SVG avatar style
  interests: string[];       // Normalized lower-case interest tags
  bio: string;               // Short anonymous bio
  voicePreference: VoicePreference;
  presence: UserPresence;
  createdAt: number;
  isBanned?: boolean;
}

export interface RoomMember {
  userId: string;            // Internal ID used internally on server
  publicId: string;          // Human readable ID visible to peers
  characterName: string;
  avatarStyle: AvatarStyle;
  joinedAt: number;
  isHost: boolean;
  isMuted: boolean;
  voiceState: VoiceState;
  connectionQuality: 'good' | 'fair' | 'poor';
}

export interface Room {
  id: string;                // Server internal room ID
  code: string;              // Human readable room code e.g. "A7K9-MX2P"
  type: RoomType;
  maxUsers: number;          // Strictly 3 for 'random', configurable for 'invite' (e.g. 20)
  status: RoomStatus;
  interests: string[];       // Target interests for matching
  members: RoomMember[];
  createdAt: number;
  expiresAt?: number;
  inviteToken?: string;      // Cryptographic secure token for invite rooms
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderPublicId: string;
  senderCharacterName: string;
  senderAvatarStyle: AvatarStyle;
  content: string;
  replyTo?: {
    id: string;
    senderCharacterName: string;
    contentSnippet: string;
  };
  isDeleted?: boolean;
  createdAt: number;
}

export interface MatchQueueRequest {
  userId: string;
  interests: string[];
  language?: string;
}

export interface MatchQueueStatus {
  status: 'QUEUED' | 'MATCHED' | 'TIMEOUT' | 'CANCELLED';
  roomId?: string;
  roomCode?: string;
  matchedInterests?: string[];
  estimatedWaitSeconds?: number;
}

export interface AbuseReport {
  id: string;
  reporterPublicId: string;
  reportedPublicId: string;
  reason: 'harassment' | 'spam' | 'threats' | 'sexual_content' | 'hate_abuse' | 'impersonation' | 'other';
  details?: string;
  roomId?: string;
  messageId?: string;
  createdAt: number;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
}

export interface UserBlock {
  blockerPublicId: string;
  blockedPublicId: string;
  createdAt: number;
}

// WebRTC Signaling Payload Types
export interface SignalOfferPayload {
  fromUserId: string;
  toUserId: string;
  offer: RTCSessionDescriptionInit;
}

export interface SignalAnswerPayload {
  fromUserId: string;
  toUserId: string;
  answer: RTCSessionDescriptionInit;
}

export interface SignalIceCandidatePayload {
  fromUserId: string;
  toUserId: string;
  candidate: RTCIceCandidateInit;
}

// Socket.io Real-time Events Contract
export interface ServerToClientEvents {
  // Room events
  'room:joined': (data: { room: Room; selfMember: RoomMember }) => void;
  'room:user_joined': (data: { member: RoomMember }) => void;
  'room:user_left': (data: { publicId: string; characterName: string; reason?: string }) => void;
  'room:updated': (data: { room: Room }) => void;
  'room:error': (data: { code: string; message: string }) => void;
  'room:ended': (data: { reason: string }) => void;

  // Voice state
  'voice:state_changed': (data: { publicId: string; voiceState: VoiceState; isMuted: boolean }) => void;

  // WebRTC signaling
  'webrtc:offer': (data: SignalOfferPayload) => void;
  'webrtc:answer': (data: SignalAnswerPayload) => void;
  'webrtc:ice_candidate': (data: SignalIceCandidatePayload) => void;

  // Chat events
  'chat:message': (message: ChatMessage) => void;
  'chat:message_deleted': (data: { messageId: string }) => void;

  // Matchmaking
  'match:status': (status: MatchQueueStatus) => void;

  // Moderation / Security
  'safety:user_blocked': (data: { blockedPublicId: string }) => void;
  'safety:kicked': (data: { reason: string }) => void;
}

export interface ClientToServerEvents {
  // Room actions
  'room:create': (data: { type?: 'random' | 'invite' | 'nearby'; maxUsers?: number; interests?: string[] }, callback: (res: { success: boolean; error?: string; room?: Room; code?: string; inviteToken?: string }) => void) => void;
  'room:join': (data: { roomIdOrCode: string; inviteToken?: string }, callback: (res: { success: boolean; error?: string; room?: Room }) => void) => void;
  'room:leave': (callback?: () => void) => void;

  // Voice actions
  'voice:set_mute': (isMuted: boolean) => void;
  'voice:set_state': (voiceState: VoiceState) => void;

  // WebRTC signaling
  'webrtc:send_offer': (data: SignalOfferPayload) => void;
  'webrtc:send_answer': (data: SignalAnswerPayload) => void;
  'webrtc:send_ice_candidate': (data: SignalIceCandidatePayload) => void;

  // Chat actions
  'chat:send_message': (data: { content: string; replyToId?: string }, callback: (res: { success: boolean; error?: string; message?: ChatMessage }) => void) => void;
  'chat:delete_message': (messageId: string, callback: (res: { success: boolean; error?: string }) => void) => void;

  // Matchmaking
  'match:start': (data: { interests: string[]; language?: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'match:cancel': (callback?: (res: { success: boolean }) => void) => void;

  // Moderation
  'safety:report': (data: { reportedPublicId: string; reason: string; details?: string; messageId?: string }, callback: (res: { success: boolean; error?: string }) => void) => void;
  'safety:block': (data: { targetPublicId: string }, callback: (res: { success: boolean }) => void) => void;
}
