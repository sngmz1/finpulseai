import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomMember, ChatMessage, AnonymousUser, VoiceState } from '../../../shared/types';
import { Avatar } from '../components/Avatar';
import { AudioControls } from '../components/AudioControls';
import { ChatSheet } from '../components/ChatSheet';
import { InviteModal } from '../components/InviteModal';
import { SafetyModal } from '../components/SafetyModal';
import { WebRTCService } from '../services/webrtc';
import { sounds } from '../services/soundEffects';
import { Socket } from 'socket.io-client';
import { 
  MessageSquare, 
  Share2, 
  AlertCircle, 
  ShieldAlert, 
  ChevronDown,
  Copy,
  QrCode,
  LogOut,
  Volume2,
  Check
} from 'lucide-react';

interface RoomPageProps {
  room: Room;
  currentUser: AnonymousUser;
  socket: Socket;
  onLeaveRoom: () => void;
  conversationStarters: string[];
}

export const RoomPage: React.FC<RoomPageProps> = ({
  room: initialRoom,
  currentUser,
  socket,
  onLeaveRoom,
  conversationStarters,
}) => {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [members, setMembers] = useState<RoomMember[]>(initialRoom.members);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isTextOnlyMode, setIsTextOnlyMode] = useState(false);
  
  // Voice states mapped by publicId
  const [voiceStates, setVoiceStates] = useState<Record<string, { state: VoiceState; isMuted: boolean; isSpeaking: boolean }>>({
    [currentUser.publicId]: { state: 'listening', isMuted: false, isSpeaking: false },
  });

  // UI Modals & Drawers
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [safetyTarget, setSafetyTarget] = useState<{ publicId: string; name: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Audio Output Management
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>('default');
  const [showOutputModal, setShowOutputModal] = useState(false);

  const webrtcRef = useRef<WebRTCService | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Enumerate audio output devices if supported
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        setAudioOutputs(outputs);
      }).catch((err) => console.warn('Could not enumerate audio devices:', err));
    }
  }, []);

  // Initialize WebRTC and Microphone
  useEffect(() => {
    const webrtc = new WebRTCService({
      onVoiceActivity: (isSpeaking) => {
        setVoiceStates((prev) => ({
          ...prev,
          [currentUser.publicId]: {
            ...prev[currentUser.publicId],
            isSpeaking,
            state: isSpeaking ? 'speaking' : isMuted ? 'muted' : 'listening',
          },
        }));

        // Broadcast to room
        socket.emit('voice:set_state', isSpeaking ? 'speaking' : isMuted ? 'muted' : 'listening');
      },
      onRemoteTrack: (peerId, stream) => {
        let audioEl = audioElementsRef.current.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          if (selectedOutputId !== 'default' && (audioEl as any).setSinkId) {
            (audioEl as any).setSinkId(selectedOutputId).catch(() => {});
          }
          audioElementsRef.current.set(peerId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch((e) => {
          console.log('Audio autoplay interaction required:', e);
          const resumeAudio = () => {
            audioEl?.play().catch(() => {});
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
          };
          window.addEventListener('click', resumeAudio, { once: true });
          window.addEventListener('touchstart', resumeAudio, { once: true });
        });
      },
      onConnectionState: (peerId, state) => {
        console.log(`[WebRTC Peer ${peerId} state]: ${state}`);
      },
    }, currentUser.internalId);

    // Attach signaling handlers to socket
    webrtc.sendOffer = (data) => socket.emit('webrtc:send_offer', { ...data, fromUserId: currentUser.internalId });
    webrtc.sendAnswer = (data) => socket.emit('webrtc:send_answer', { ...data, fromUserId: currentUser.internalId });
    webrtc.sendIceCandidate = (data) => socket.emit('webrtc:send_ice_candidate', { ...data, fromUserId: currentUser.internalId });

    webrtcRef.current = webrtc;

    // Start mic unless user selected text only
    if (currentUser.voicePreference !== 'text_only') {
      webrtc.initMicrophone().then((res) => {
        if (!res.success) {
          setMicError(res.error || 'Microphone access failed');
        }
      });
    }

    // Call existing members in room (deterministic initiator rule: larger internalId calls smaller)
    initialRoom.members.forEach((member) => {
      if (member.userId !== currentUser.internalId && currentUser.internalId > member.userId) {
        console.log(`[WebRTC] Deterministic call to existing member ${member.userId}`);
        webrtc.callPeer(member.userId);
      }
    });

    return () => {
      webrtc.close();
      audioElementsRef.current.forEach((el) => {
        el.srcObject = null;
        el.remove();
      });
      audioElementsRef.current.clear();
    };
  }, [currentUser, socket]);

  // Handle Socket Events for Room
  useEffect(() => {
    // Room updates
    const onRoomUpdated = (data: { room: Room }) => {
      setRoom(data.room);
      setMembers(data.room.members);
    };

    const onUserJoined = (data: { member: RoomMember }) => {
      setMembers((prev) => {
        if (prev.some((m) => m.userId === data.member.userId)) return prev;
        return [...prev, data.member];
      });
      sounds.playJoin();
      showToast(`${data.member.characterName} connected.`);
      
      // Deterministic initiator rule: larger internalId calls smaller
      if (currentUser.internalId > data.member.userId && webrtcRef.current) {
        console.log(`[WebRTC] Deterministic call to new joined member ${data.member.userId}`);
        webrtcRef.current.callPeer(data.member.userId);
      }
    };

    const onUserLeft = (data: { publicId: string; characterName: string }) => {
      setMembers((prev) => prev.filter((m) => m.publicId !== data.publicId));
      sounds.playLeave();
      showToast(`${data.characterName} left.`);
    };

    // WebRTC Signaling
    const onOffer = async (data: any) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleOffer(data.fromUserId, data.offer);
      }
    };

    const onAnswer = async (data: any) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleAnswer(data.fromUserId, data.answer);
      }
    };

    const onIceCandidate = async (data: any) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleIceCandidate(data.fromUserId, data.candidate);
      }
    };

    // Voice state changes from peers
    const onVoiceStateChanged = (data: { publicId: string; voiceState: VoiceState; isMuted: boolean }) => {
      setVoiceStates((prev) => ({
        ...prev,
        [data.publicId]: {
          state: data.voiceState,
          isMuted: data.isMuted,
          isSpeaking: data.voiceState === 'speaking',
        },
      }));
    };

    // Chat messages
    const onChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderPublicId !== currentUser.publicId) {
        sounds.playMessage();
      }
    };

    const onMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    socket.on('room:updated', onRoomUpdated);
    socket.on('room:user_joined', onUserJoined);
    socket.on('room:user_left', onUserLeft);
    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice_candidate', onIceCandidate);
    socket.on('voice:state_changed', onVoiceStateChanged);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:message_deleted', onMessageDeleted);

    return () => {
      socket.off('room:updated', onRoomUpdated);
      socket.off('room:user_joined', onUserJoined);
      socket.off('room:user_left', onUserLeft);
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice_candidate', onIceCandidate);
      socket.off('voice:state_changed', onVoiceStateChanged);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:message_deleted', onMessageDeleted);
    };
  }, [socket, currentUser]);

  // Audio Controls Handlers
  const handleToggleMute = () => {
    if (!webrtcRef.current || !webrtcRef.current.hasLocalStream()) {
      handleRetryMic();
      return;
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    webrtcRef.current.setMute(nextMuted);
    socket.emit('voice:set_mute', nextMuted);
    if (nextMuted) {
      sounds.playMute();
    } else {
      sounds.playUnmute();
    }
    showToast(nextMuted ? 'You are muted.' : 'Microphone unmuted.');
  };

  // Automatic listener for microphone permission changes
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
        permissionStatus.onchange = () => {
          if (permissionStatus.state === 'granted') {
            handleRetryMic();
          }
        };
      }).catch(() => {});
    }
  }, []);

  const handleRetryMic = async () => {
    setMicError(null);
    if (!webrtcRef.current) {
      return;
    }
    const res = await webrtcRef.current.initMicrophone();
    if (!res.success) {
      setMicError(res.error || 'Microphone access failed');
    } else {
      setMicError(null);
      setIsMuted(false);
      webrtcRef.current.setMute(false);
      socket.emit('voice:set_mute', false);
      socket.emit('voice:set_state', 'listening');
      setVoiceStates((prev) => ({
        ...prev,
        [currentUser.publicId]: {
          state: 'listening',
          isMuted: false,
          isSpeaking: false,
        },
      }));
      showToast('Microphone connected successfully!');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCodeCopied(true);
      showToast(`Room code ${room.code} copied to clipboard!`);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      showToast(`Room code: ${room.code}`);
    }
  };

  const handleSelectAudioDevice = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    setShowOutputModal(false);
    audioElementsRef.current.forEach((el) => {
      if ((el as any).setSinkId) {
        (el as any).setSinkId(deviceId).catch((err: any) => console.warn('setSinkId failed:', err));
      }
    });
    showToast('Audio destination updated.');
  };

  const handleSendMessage = (content: string, replyToId?: string) => {
    socket.emit('chat:send_message', { content, replyToId }, (res: any) => {
      if (!res.success) {
        showToast(res.error || 'Failed to send message');
      }
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    socket.emit('chat:delete_message', messageId, (res: any) => {
      if (!res.success) {
        showToast(res.error || 'Failed to delete message');
      }
    });
  };

  const handleReportUser = (targetPublicId: string, reason: string, details?: string) => {
    socket.emit('safety:report', { reportedPublicId: targetPublicId, reason, details }, (res: any) => {
      if (res.success) {
        showToast('Report submitted. Thank you for keeping the room safe.');
      }
    });
  };

  const handleBlockUser = (targetPublicId: string) => {
    socket.emit('safety:block', { targetPublicId }, () => {
      showToast('User blocked.');
    });
  };

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full h-full relative overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-2 rounded-2xl border border-accent-cyan/40 text-xs font-semibold text-white shadow-2xl animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-cyan" />
          {toastMessage}
        </div>
      )}

      {/* Dedicated Room Header with full controls: Code, Copy, Share, QR, Leave */}
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-surface-300/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-mono font-extrabold tracking-wider text-accent-cyan">
                ROOM {room.code}
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-slate-300 flex items-center gap-1 transition-colors"
                title="Copy Room Code"
              >
                {codeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span className="hidden sm:inline">{codeCopied ? 'COPIED' : 'COPY'}</span>
              </button>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-slate-300 uppercase">
                {room.type === 'random' ? 'Random (Max 3)' : `Invite (${members.length}/${room.maxUsers})`}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {room.status === 'ACTIVE' ? 'Voice Active • WebRTC Mesh' : 'Waiting for peers...'}
            </span>
          </div>
        </div>

        {/* Real P2P Network Telemetry Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-200/80 border border-white/5 text-[10px] font-mono text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>WebRTC Mesh • Opus 48kHz • Direct P2P</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* QR Code button */}
          <button
            onClick={() => setShowInviteModal(true)}
            className="p-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="View QR Code"
          >
            <QrCode className="w-4 h-4 text-accent-cyan" />
            <span className="hidden sm:inline">QR</span>
          </button>

          {/* Share/Invite button */}
          <button
            onClick={() => setShowInviteModal(true)}
            className="p-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Invite peers"
          >
            <Share2 className="w-4 h-4 text-accent-purple" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Toggle Chat button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="relative p-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Toggle text chat"
          >
            <MessageSquare className="w-4 h-4 text-accent-blue" />
            <span className="hidden sm:inline">Chat</span>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent-cyan text-slate-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>

          {/* Quick Leave Room Button in Header */}
          <button
            onClick={onLeaveRoom}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Leave room"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* Microphone Permission Denial Warning (Non-crashing, User-friendly Guidance) */}
      {micError && !isTextOnlyMode && (
        <div className="mx-4 mt-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col gap-2.5 text-xs text-red-300 animate-fade-in shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex flex-col">
                <span className="font-bold text-red-200">Microphone Access Needed for Voice</span>
                <span className="text-[11px] text-red-300/90">{micError}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={handleRetryMic}
                className="px-3.5 py-1.5 bg-red-500/30 hover:bg-red-500/40 text-white rounded-xl text-xs font-bold border border-red-500/50 transition-all shadow-md active:scale-95"
              >
                TRY AGAIN
              </button>
              <button
                onClick={() => setIsTextOnlyMode(true)}
                className="px-3 py-1.5 bg-surface-100 hover:bg-surface-50 text-slate-300 rounded-xl text-xs transition-colors"
              >
                CONTINUE WITH TEXT
              </button>
            </div>
          </div>

          {/* Quick Troubleshooting Steps */}
          <div className="pt-2 border-t border-red-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
            <div className="bg-surface-300/60 p-2 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-accent-cyan/20 text-accent-cyan font-bold text-[9px] flex items-center justify-center shrink-0">1</span>
              <span>Click the <b>Lock or Tune icon (🎛️)</b> left of the URL.</span>
            </div>
            <div className="bg-surface-300/60 p-2 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-accent-cyan/20 text-accent-cyan font-bold text-[9px] flex items-center justify-center shrink-0">2</span>
              <span>Set <b>Microphone</b> permission to <b>Allow</b>.</span>
            </div>
            <div className="bg-surface-300/60 p-2 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-accent-cyan/20 text-accent-cyan font-bold text-[9px] flex items-center justify-center shrink-0">3</span>
              <span>Click <b>TRY AGAIN</b> or refresh the page.</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Room Body: Responsive Grid */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* Participants Stage */}
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
          {/* Participants Display Area */}
          <div className="my-auto flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-6">
            {members.map((member) => {
              const isSelf = member.publicId === currentUser.publicId;
              const voiceData = voiceStates[member.publicId] || {
                state: member.voiceState || 'listening',
                isMuted: member.isMuted,
                isSpeaking: member.voiceState === 'speaking',
              };

              const stateColor = {
                speaking: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                listening: 'text-slate-300 bg-white/5 border-white/10',
                muted: 'text-red-400 bg-red-500/10 border-red-500/30',
                connecting: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                reconnecting: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                disconnected: 'text-slate-500 bg-white/5 border-white/5',
              }[voiceData.state] || 'text-slate-300 bg-white/5 border-white/10';

              return (
                <div
                  key={member.publicId}
                  className="flex flex-col items-center text-center group relative min-w-[120px]"
                >
                  {/* Avatar with dynamic voice animation */}
                  <div className="relative mb-2">
                    <Avatar
                      style={member.avatarStyle}
                      size="xl"
                      isSpeaking={voiceData.isSpeaking}
                      isMuted={voiceData.isMuted}
                    />
                    {isSelf && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-accent-cyan text-slate-950 font-bold text-[9px]">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Character Name */}
                  <div className="font-bold text-sm text-white max-w-[140px] truncate">
                    {member.characterName}
                  </div>

                  {/* Anonymous ID */}
                  <div className="text-[10px] text-accent-cyan font-mono font-medium tracking-wide">
                    {member.publicId}
                  </div>

                  {/* Voice State Pill */}
                  <div className={`mt-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold capitalize flex items-center gap-1.5 ${stateColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      voiceData.state === 'speaking' ? 'bg-emerald-400 animate-ping' :
                      voiceData.state === 'muted' ? 'bg-red-400' : 'bg-slate-400'
                    }`} />
                    {voiceData.state}
                  </div>

                  {/* Direct Tap-to-Enable Microphone action for Self */}
                  {isSelf && (!webrtcRef.current?.hasLocalStream() || micError) && (
                    <button
                      onClick={handleRetryMic}
                      className="mt-2 px-3 py-1 bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 rounded-xl text-[10px] font-extrabold shadow-md shadow-accent-cyan/25 active:scale-95 transition-all flex items-center gap-1 animate-pulse"
                      title="Click to grant/enable microphone"
                    >
                      <span>🎙 Tap to Enable Mic</span>
                    </button>
                  )}

                  {/* Safety Menu Trigger for remote participants */}
                  {!isSelf && (
                    <button
                      onClick={() => setSafetyTarget({ publicId: member.publicId, name: member.characterName })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Report / Block
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Fixed Audio Controls */}
          <div className="pt-4 pb-2 shrink-0">
            <AudioControls
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              onLeave={onLeaveRoom}
              onSelectOutput={() => setShowOutputModal(true)}
              audioOutputLabel={
                selectedOutputId === 'default'
                  ? 'Default Speaker'
                  : audioOutputs.find((o) => o.deviceId === selectedOutputId)?.label || 'Speaker'
              }
            />
          </div>
        </div>

        {/* Text Chat Drawer */}
        <div
          className={`lg:w-96 lg:border-l border-white/10 flex flex-col transition-all duration-300 absolute lg:relative inset-0 z-30 ${
            isChatOpen ? 'translate-y-0 opacity-100' : 'translate-y-full lg:translate-y-0 lg:flex opacity-0 lg:opacity-100 pointer-events-none lg:pointer-events-auto'
          }`}
        >
          {/* Mobile Close Handle */}
          <div className="lg:hidden p-2 bg-surface-300 flex justify-center border-b border-white/10">
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1 rounded-full text-slate-400 hover:text-white flex items-center gap-1 text-xs"
            >
              <ChevronDown className="w-4 h-4" />
              <span>Minimize Chat</span>
            </button>
          </div>

          <ChatSheet
            messages={messages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteMessage}
            onReportMessage={(msg) => setSafetyTarget({ publicId: msg.senderPublicId, name: msg.senderCharacterName })}
            onBlockUser={handleBlockUser}
            conversationStarters={conversationStarters}
          />
        </div>
      </div>

      {/* Audio Output Destination Selection Modal */}
      {showOutputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-accent-cyan">
              <Volume2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Audio Output Destination</h3>
            </div>
            <p className="text-xs text-slate-400">
              Select speaker, headphones, or Bluetooth audio output device.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pt-2">
              <button
                onClick={() => handleSelectAudioDevice('default')}
                className={`w-full p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                  selectedOutputId === 'default'
                    ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan'
                    : 'bg-surface-100 border-white/5 text-slate-300 hover:bg-surface-50'
                }`}
              >
                <span>Default System Speaker / Output</span>
                {selectedOutputId === 'default' && <Check className="w-4 h-4" />}
              </button>

              {audioOutputs.map((dev) => (
                <button
                  key={dev.deviceId}
                  onClick={() => handleSelectAudioDevice(dev.deviceId)}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                    selectedOutputId === dev.deviceId
                      ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan'
                      : 'bg-surface-100 border-white/5 text-slate-300 hover:bg-surface-50'
                  }`}
                >
                  <span className="truncate pr-2">{dev.label || `Audio Output (${dev.deviceId.slice(0, 6)})`}</span>
                  {selectedOutputId === dev.deviceId && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowOutputModal(false)}
                className="w-full py-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 text-xs font-semibold"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          roomCode={room.code}
          inviteToken={room.inviteToken}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Safety & Moderation Modal */}
      {safetyTarget && (
        <SafetyModal
          targetPublicId={safetyTarget.publicId}
          targetCharacterName={safetyTarget.name}
          onClose={() => setSafetyTarget(null)}
          onReport={(reason, details) => handleReportUser(safetyTarget.publicId, reason, details)}
          onBlock={() => handleBlockUser(safetyTarget.publicId)}
        />
      )}
    </div>
  );
};

