import { io, Socket } from 'socket.io-client';
import { 
  AnonymousUser, 
  Room, 
  AvatarStyle, 
  VoicePreference,
  ClientToServerEvents, 
  ServerToClientEvents 
} from '../../../shared/types';
import { 
  CURATED_INTERESTS, 
  CONVERSATION_STARTERS 
} from '../../../shared/validation';
import {
  generateCharacterName,
  generatePublicId,
  generateRoomCode,
  generateInviteToken,
  selectAvatarStyle
} from '../../../shared/identityGenerator';

// Dynamic backend URL configuration (supports deployed Render/Railway backend or localhost:3001)
export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('anon_backend_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
  }
  const envUrl = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3001';
  }
  return '';
}

export function getApiBase(): string {
  const backend = getBackendUrl();
  return backend ? `${backend}/api` : '/api';
}

/**
 * Safe JSON fetch helper that verifies Content-Type to prevent:
 * "Unexpected token '<', '<!DOCTYPE '... is not valid JSON"
 * when hitting static hosts (like Netlify) where unmatched /api calls return index.html.
 */
async function safeFetchJson<T>(
  url: string, 
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    // If the server returns HTML (e.g., Netlify SPA index.html fallback), it's not a JSON API response
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: 'Backend API server unreachable (received HTML fallback).',
      };
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text) as T;
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? ((data as any)?.error || `Request failed with status ${res.status}`) : undefined,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: 'Received non-JSON response from server.',
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || 'Network connection failed.',
    };
  }
}

export class ApiService {
  private static socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  public static getStoredToken(): string | null {
    return localStorage.getItem('anon_session_token');
  }

  public static setStoredToken(token: string): void {
    localStorage.setItem('anon_session_token', token);
  }

  public static clearSession(): void {
    localStorage.removeItem('anon_session_token');
    localStorage.removeItem('anon_user_profile');
    if (this.socketInstance) {
      this.socketInstance.disconnect();
      this.socketInstance = null;
    }
  }

  public static setBackendUrl(url: string): void {
    if (!url.trim()) {
      localStorage.removeItem('anon_backend_url');
    } else {
      localStorage.setItem('anon_backend_url', url.trim().replace(/\/$/, ''));
    }
    if (this.socketInstance) {
      this.socketInstance.disconnect();
      this.socketInstance = null;
    }
  }

  public static isSocketConnected(): boolean {
    return this.socketInstance ? this.socketInstance.connected : false;
  }

  public static async getInterests(): Promise<string[]> {
    const res = await safeFetchJson<{ interests: string[] }>(`${getApiBase()}/interests`);
    if (res.ok && res.data?.interests?.length) {
      return res.data.interests;
    }
    // Reliable static / offline fallback
    return [...CURATED_INTERESTS];
  }

  public static async getStarters(): Promise<string[]> {
    const res = await safeFetchJson<{ starters: string[] }>(`${getApiBase()}/starters`);
    if (res.ok && res.data?.starters?.length) {
      return res.data.starters;
    }
    // Reliable static / offline fallback
    return [...CONVERSATION_STARTERS];
  }

  public static async generateIdentity(interests: string[] = []): Promise<{
    characterName: string;
    publicId: string;
    avatarStyle: AvatarStyle;
    suggestedInterests: string[];
  }> {
    const res = await safeFetchJson<{
      characterName: string;
      publicId: string;
      avatarStyle: AvatarStyle;
      suggestedInterests: string[];
    }>(`${getApiBase()}/identity/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interests }),
    });

    if (res.ok && res.data) {
      return res.data;
    }

    // High-quality client-side generation fallback (never crashes on static host)
    const characterName = generateCharacterName(interests);
    const publicId = generatePublicId(characterName);
    const avatarStyle = selectAvatarStyle(interests);

    return {
      characterName,
      publicId,
      avatarStyle,
      suggestedInterests: interests.length > 0 ? interests : ['Anime', 'Gaming', 'Technology'],
    };
  }

  public static async registerAnonymous(profile: {
    characterName?: string;
    avatarStyle: AvatarStyle;
    interests: string[];
    bio?: string;
    voicePreference?: VoicePreference;
  }): Promise<{ token: string; user: AnonymousUser }> {
    const res = await safeFetchJson<{ token: string; user: AnonymousUser }>(
      `${getApiBase()}/users/register-anonymous`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      }
    );

    if (res.ok && res.data) {
      this.setStoredToken(res.data.token);
      localStorage.setItem('anon_user_profile', JSON.stringify(res.data.user));
      return res.data;
    }

    // IMPORTANT: Do NOT create a fake local token here.
    // A fake token (not known to the backend) will cause the socket to be
    // immediately disconnected on the server, silently breaking all real-time
    // features (messaging, room joining, WebRTC signaling).
    // Instead, surface the error so the user can retry.
    throw new Error(
      res.error ||
        'Could not connect to the backend server. Please check your internet connection and try again.'
    );
  }

  public static async getCurrentUser(): Promise<AnonymousUser | null> {
    const token = this.getStoredToken();
    if (!token) return null;

    // Check stored profile first
    const stored = localStorage.getItem('anon_user_profile');
    let localUser: AnonymousUser | null = null;
    if (stored) {
      try {
        localUser = JSON.parse(stored);
      } catch {
        // ignore parse error
      }
    }

    const res = await safeFetchJson<{ user: AnonymousUser }>(`${getApiBase()}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok && res.data?.user) {
      localStorage.setItem('anon_user_profile', JSON.stringify(res.data.user));
      return res.data.user;
    }

    // Return locally stored user if available
    return localUser;
  }

  public static async createRoom(
    type: 'random' | 'invite' | 'nearby', 
    maxUsers = 20, 
    interests: string[] = []
  ): Promise<{
    room: Room;
    code: string;
    inviteToken?: string;
  }> {
    const res = await safeFetchJson<{
      room: Room;
      code: string;
      inviteToken?: string;
    }>(`${getApiBase()}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, maxUsers, interests }),
    });

    if (res.ok && res.data) {
      return res.data;
    }

    // Client-side fallback room creation
    const code = generateRoomCode();
    const inviteToken = type === 'invite' ? generateInviteToken() : undefined;
    const fallbackRoom: Room = {
      id: `room_${code}`,
      code,
      type,
      maxUsers,
      status: 'ACTIVE',
      members: [],
      interests,
      createdAt: Date.now(),
      inviteToken,
    };

    return {
      room: fallbackRoom,
      code,
      inviteToken,
    };
  }

  public static async validateInvite(token: string): Promise<{ 
    roomCode: string; 
    type: string; 
    maxUsers: number; 
    currentMembers: number 
  }> {
    const res = await safeFetchJson<{ 
      roomCode: string; 
      type: string; 
      maxUsers: number; 
      currentMembers: number 
    }>(`${getApiBase()}/invites/${token}`);

    if (res.ok && res.data) {
      return res.data;
    }

    // Fallback resolution for invite token
    return {
      roomCode: token.slice(0, 8).toUpperCase(),
      type: 'invite',
      maxUsers: 20,
      currentMembers: 1,
    };
  }

  // Socket Connection singleton
  public static getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socketInstance) {
      const token = this.getStoredToken();
      const backendUrl = getBackendUrl();
      const socketTarget = backendUrl || (typeof window !== 'undefined' ? window.location.origin : '');

      // In production, match the server's WebSocket-only transport setting to
      // avoid long-polling issues on Render's proxy layer.
      const isProduction =
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:';

      this.socketInstance = io(socketTarget, {
        auth: { userId: token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1500,
        timeout: 8000,
        transports: isProduction ? ['websocket'] : ['polling', 'websocket'],
      });

      this.socketInstance.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
      });
    }
    return this.socketInstance;
  }

  /**
   * Force-reconnect the socket with the current stored token.
   * Must be called after a new user is registered so the socket auth
   * reflects the real internalId (not a stale null or fake token).
   */
  public static reconnectSocket(): void {
    if (this.socketInstance) {
      this.socketInstance.disconnect();
      this.socketInstance = null;
    }
    // getSocket() will now create a fresh connection with the current token
    this.getSocket();
  }
}
