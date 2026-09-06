import { describe, it, expect } from 'vitest';
import { io as ClientSocket } from 'socket.io-client';

const API_HOST = 'http://localhost:3001';

describe('END-TO-END SYSTEM INTEGRATION (SOCKET & REST)', () => {
  it('registers anonymous users, joins rooms, verifies 3-user limits, and exchanges chat', async () => {
    // 1. Health Check
    const healthRes = await fetch(`${API_HOST}/health`);
    expect(healthRes.ok).toBe(true);
    const health = await healthRes.json();
    expect(health.status).toBe('healthy');

    // 2. Register Anonymous Users via REST API
    const regA = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: 'ShadowRen',
        avatarStyle: 'shadow',
        interests: ['anime', 'gaming'],
        bio: 'Ghost in the shell',
      }),
    });
    expect(regA.status).toBe(201);
    const userA = await regA.json();

    const regB = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: 'KairoVex',
        avatarStyle: 'cyber',
        interests: ['gaming', 'music'],
      }),
    });
    const userB = await regB.json();

    const regC = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: 'NovaByte',
        avatarStyle: 'neon',
        interests: ['anime', 'coding'],
      }),
    });
    const userC = await regC.json();

    const regD = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterName: 'SpecterNox',
        avatarStyle: 'samurai',
        interests: ['anime'],
      }),
    });
    const userD = await regD.json();

    // 3. Connect via WebSockets
    const socketA = ClientSocket(API_HOST, { auth: { userId: userA.token } });
    const socketB = ClientSocket(API_HOST, { auth: { userId: userB.token } });
    const socketC = ClientSocket(API_HOST, { auth: { userId: userC.token } });
    const socketD = ClientSocket(API_HOST, { auth: { userId: userD.token } });

    await new Promise((resolve) => socketA.on('connect', () => resolve(true)));
    await new Promise((resolve) => socketB.on('connect', () => resolve(true)));
    await new Promise((resolve) => socketC.on('connect', () => resolve(true)));
    await new Promise((resolve) => socketD.on('connect', () => resolve(true)));

    // 4. Create a Random Room via REST
    const roomRes = await fetch(`${API_HOST}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'random', maxUsers: 3 }),
    });
    const { room } = await roomRes.json();
    expect(room.maxUsers).toBe(3);

    // 5. User A joins
    const joinA = await new Promise<any>((resolve) => {
      socketA.emit('room:join', { roomIdOrCode: room.id }, resolve);
    });
    expect(joinA.success).toBe(true);

    // 6. User B joins
    const joinB = await new Promise<any>((resolve) => {
      socketB.emit('room:join', { roomIdOrCode: room.id }, resolve);
    });
    expect(joinB.success).toBe(true);

    // 7. User C joins -> Room reaches exact 3-user capacity
    const joinC = await new Promise<any>((resolve) => {
      socketC.emit('room:join', { roomIdOrCode: room.id }, resolve);
    });
    expect(joinC.success).toBe(true);

    // 8. User D attempts to join 3-user room -> Must be rejected with "This room is full."
    const joinD = await new Promise<any>((resolve) => {
      socketD.emit('room:join', { roomIdOrCode: room.id }, resolve);
    });
    expect(joinD.success).toBe(false);
    expect(joinD.error).toBe('This room is full.');

    // 9. Send Chat message from User A and verify User B receives it
    const msgPromise = new Promise<any>((resolve) => {
      socketB.on('chat:message', resolve);
    });

    socketA.emit('chat:send_message', { content: 'Anyone into manhwa?' }, (res: any) => {
      expect(res.success).toBe(true);
    });

    const receivedMsg = await msgPromise;
    expect(receivedMsg.content).toBe('Anyone into manhwa?');
    expect(receivedMsg.senderCharacterName).toBe('ShadowRen');

    // 10. Clean Disconnect
    socketA.disconnect();
    socketB.disconnect();
    socketC.disconnect();
    socketD.disconnect();
  });

  it('performs live matchmaking between two users and notifies both sockets', async () => {
    // Register User 1 and User 2
    const reg1 = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName: 'MatchSeeker1', avatarStyle: 'neon', interests: ['anime', 'tech'] }),
    });
    const u1 = await reg1.json();

    const reg2 = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName: 'MatchSeeker2', avatarStyle: 'cyber', interests: ['anime', 'music'] }),
    });
    const u2 = await reg2.json();

    const s1 = ClientSocket(API_HOST, { auth: { userId: u1.token } });
    const s2 = ClientSocket(API_HOST, { auth: { userId: u2.token } });

    await new Promise((resolve) => s1.on('connect', () => resolve(true)));
    await new Promise((resolve) => s2.on('connect', () => resolve(true)));

    // Both listen for match:status
    const matchPromise1 = new Promise<any>((resolve) => {
      s1.on('match:status', (status) => {
        if (status.status === 'MATCHED') resolve(status);
      });
    });

    const matchPromise2 = new Promise<any>((resolve) => {
      s2.on('match:status', (status) => {
        if (status.status === 'MATCHED') resolve(status);
      });
    });

    // User 1 queues first
    await new Promise<any>((resolve) => {
      s1.emit('match:start', { interests: ['anime', 'tech'] }, resolve);
    });

    // User 2 queues second
    await new Promise<any>((resolve) => {
      s2.emit('match:start', { interests: ['anime', 'music'] }, resolve);
    });

    // Both should receive matched notification with the same roomId
    const [result1, result2] = await Promise.all([matchPromise1, matchPromise2]);
    expect(result1.status).toBe('MATCHED');
    expect(result2.status).toBe('MATCHED');
    expect(result1.roomId).toBe(result2.roomId);
    expect(result1.matchedInterests).toContain('anime');

    s1.disconnect();
    s2.disconnect();
  });

  it('handles matchmaking cancellation cleanly', async () => {
    const reg = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName: 'CancelUser', avatarStyle: 'samurai', interests: ['philosophy'] }),
    });
    const u = await reg.json();

    const s = ClientSocket(API_HOST, { auth: { userId: u.token } });
    await new Promise((resolve) => s.on('connect', () => resolve(true)));

    // Start matching
    await new Promise<any>((resolve) => {
      s.emit('match:start', { interests: ['philosophy'] }, resolve);
    });

    // Cancel matching
    const cancelRes = await new Promise<any>((resolve) => {
      s.emit('match:cancel', resolve);
    });
    expect(cancelRes.success).toBe(true);

    s.disconnect();
  });

  it('creates private room via socket room:create event and relays WebRTC signaling', async () => {
    const regHost = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName: 'HostPeer', avatarStyle: 'toon', interests: ['gaming'] }),
    });
    const hostUser = await regHost.json();

    const regGuest = await fetch(`${API_HOST}/api/users/register-anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterName: 'GuestPeer', avatarStyle: 'shadow', interests: ['gaming'] }),
    });
    const guestUser = await regGuest.json();

    const hostSocket = ClientSocket(API_HOST, { auth: { userId: hostUser.token } });
    const guestSocket = ClientSocket(API_HOST, { auth: { userId: guestUser.token } });

    await new Promise((resolve) => hostSocket.on('connect', () => resolve(true)));
    await new Promise((resolve) => guestSocket.on('connect', () => resolve(true)));

    // Host creates room via socket event
    const createRes = await new Promise<any>((resolve) => {
      hostSocket.emit('room:create', { type: 'invite', maxUsers: 10, interests: ['gaming'] }, resolve);
    });
    expect(createRes.success).toBe(true);
    expect(createRes.room.members.length).toBe(1);
    const room = createRes.room;

    // Guest joins room
    const guestJoinRes = await new Promise<any>((resolve) => {
      guestSocket.emit('room:join', { roomIdOrCode: room.code }, resolve);
    });
    expect(guestJoinRes.success).toBe(true);

    // Test WebRTC Offer Relay from Host to Guest
    const offerPromise = new Promise<any>((resolve) => {
      guestSocket.on('webrtc:offer', resolve);
    });

    const mockOffer = { type: 'offer' as const, sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
    hostSocket.emit('webrtc:send_offer', {
      fromUserId: hostUser.user.internalId,
      toUserId: guestUser.user.internalId,
      offer: mockOffer,
    });

    const receivedOffer = await offerPromise;
    expect(receivedOffer.offer.sdp).toBe(mockOffer.sdp);
    expect(receivedOffer.fromUserId).toBe(hostUser.user.internalId);

    // Test WebRTC Answer Relay from Guest to Host
    const answerPromise = new Promise<any>((resolve) => {
      hostSocket.on('webrtc:answer', resolve);
    });

    const mockAnswer = { type: 'answer' as const, sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
    guestSocket.emit('webrtc:send_answer', {
      fromUserId: guestUser.user.internalId,
      toUserId: hostUser.user.internalId,
      answer: mockAnswer,
    });

    const receivedAnswer = await answerPromise;
    expect(receivedAnswer.answer.sdp).toBe(mockAnswer.sdp);
    expect(receivedAnswer.fromUserId).toBe(guestUser.user.internalId);

    // Test WebRTC ICE Candidate Relay
    const icePromise = new Promise<any>((resolve) => {
      guestSocket.on('webrtc:ice_candidate', resolve);
    });

    const mockCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    hostSocket.emit('webrtc:send_ice_candidate', {
      fromUserId: hostUser.user.internalId,
      toUserId: guestUser.user.internalId,
      candidate: mockCandidate,
    });

    const receivedIce = await icePromise;
    expect(receivedIce.candidate.candidate).toBe(mockCandidate.candidate);
    expect(receivedIce.fromUserId).toBe(hostUser.user.internalId);

    hostSocket.disconnect();
    guestSocket.disconnect();
  });
});

