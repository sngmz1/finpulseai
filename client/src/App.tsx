import React, { useState, useEffect, useRef } from 'react';
import { AnonymousUser, Room, MatchQueueStatus } from '../../shared/types';
import { ApiService } from './services/api';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Matching } from './pages/Matching';
import { RoomPage } from './pages/Room';
import { Nearby } from './pages/Nearby';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/Admin';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { NoServerModal } from './components/NoServerModal';
import { Home as HomeIcon, Radio, User, Shield, KeyRound, X, Sparkles, Plus, Check } from 'lucide-react';

const POPULAR_INTERESTS = [
  'Technology', 'Gaming', 'Music', 'Philosophy', 'Anime',
  'Crypto', 'Art', 'Science', 'Movies', 'Books',
  'Coding', 'Travel', 'Food', 'Fitness', 'Psychology',
];

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AnonymousUser | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'matching' | 'room' | 'nearby' | 'profile' | 'admin'>('home');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [matchingInterests, setMatchingInterests] = useState<string[]>([]);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  
  // Modals
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [showInterestModal, setShowInterestModal] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');

  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [showNoServerModal, setShowNoServerModal] = useState(false);

  // Ref to track if user is actively in matchmaking state
  const isMatchingRef = useRef<boolean>(false);

  // Initialize Session and Socket Listeners
  useEffect(() => {
    ApiService.getCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        setSelectedInterests(user.interests || []);
      }
    });

    ApiService.getStarters().then((starters) => {
      setConversationStarters(starters);
    });

    // Check socket connection status
    const socket = ApiService.getSocket();
    setIsBackendOnline(socket.connected);

    const onConnect = () => setIsBackendOnline(true);
    const onDisconnect = () => setIsBackendOnline(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Capture PWA Install Prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Check URL parameters for ?join=CODE
    const urlParams = new URLSearchParams(window.location.search);
    const joinParam = urlParams.get('join');
    if (joinParam) {
      setJoinCodeInput(joinParam.toUpperCase());
      setShowJoinPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Listen to Socket Matchmaking and Room Events
  useEffect(() => {
    if (!currentUser) return;
    const socket = ApiService.getSocket();

    const onMatchStatus = (status: MatchQueueStatus) => {
      if (!isMatchingRef.current) {
        console.log('[Matchmaking] Ignored match:status event because user cancelled or is not searching.');
        return;
      }

      if (status.status === 'MATCHED' && status.roomId) {
        isMatchingRef.current = false;
        socket.emit('room:join', { roomIdOrCode: status.roomId }, (res) => {
          if (res?.success && res?.room) {
            setCurrentRoom(res.room);
            setCurrentView('room');
          }
        });
      }
    };

    socket.on('match:status', onMatchStatus);

    return () => {
      socket.off('match:status', onMatchStatus);
    };
  }, [currentUser]);

  // Handle PWA Install Click
  const handleInstallPwa = () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      pwaPrompt.userChoice.then(() => {
        setPwaPrompt(null);
      });
    }
  };

  // Matchmaking execution helper
  const startMatchmaking = (interests: string[]) => {
    if (!currentUser) return;
    const socket = ApiService.getSocket();

    // If socket is disconnected (e.g. running on Netlify without backend), prompt user cleanly instead of hanging
    if (!socket.connected) {
      setShowNoServerModal(true);
      return;
    }

    isMatchingRef.current = true;
    setMatchingInterests(interests);
    setCurrentView('matching');

    (socket as any).timeout(3000).emit('match:start', { interests }, (err: any, res: any) => {
      if (err || !res?.success) {
        isMatchingRef.current = false;
        setShowNoServerModal(true);
        setCurrentView('home');
      }
    });
  };

  // Random Match Starter
  const handleStartRandomMatch = () => {
    startMatchmaking(currentUser?.interests || []);
  };

  // Open Interest Selector Modal
  const handleStartInterestMatch = () => {
    setSelectedInterests(currentUser?.interests && currentUser.interests.length > 0 
      ? [...currentUser.interests] 
      : ['Technology', 'Gaming']
    );
    setShowInterestModal(true);
  };

  // Toggle interest tag selection
  const handleToggleInterest = (tag: string) => {
    const cleaned = tag.toLowerCase().trim();
    if (selectedInterests.some((t) => t.toLowerCase() === cleaned)) {
      setSelectedInterests(selectedInterests.filter((t) => t.toLowerCase() !== cleaned));
    } else {
      setSelectedInterests([...selectedInterests, tag]);
    }
  };

  // Add custom interest tag
  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = customTagInput.trim().replace(/^#/, '');
    if (tag && !selectedInterests.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setSelectedInterests([...selectedInterests, tag]);
      setCustomTagInput('');
    }
  };

  // Confirm Interest Matching
  const handleConfirmInterestMatch = () => {
    setShowInterestModal(false);
    startMatchmaking(selectedInterests.length > 0 ? selectedInterests : ['General']);
  };

  // Instant Cancel Match
  const handleCancelMatch = () => {
    isMatchingRef.current = false;
    setCurrentView('home');
    const socket = ApiService.getSocket();
    socket.emit('match:cancel');
  };

  // Helper to construct a local guaranteed room if backend is offline or static
  const buildStandaloneRoom = (customCode?: string): Room => {
    const code = customCode || (Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());
    return {
      id: `local_${code}`,
      code,
      type: 'invite',
      status: 'ACTIVE',
      createdAt: Date.now(),
      maxUsers: 20,
      interests: currentUser?.interests || ['General'],
      members: [{
        userId: currentUser!.internalId,
        publicId: currentUser!.publicId,
        characterName: currentUser!.characterName,
        avatarStyle: currentUser!.avatarStyle,
        joinedAt: Date.now(),
        isHost: true,
        isMuted: false,
        voiceState: 'listening',
        connectionQuality: 'good',
      }],
      inviteToken: `token_${code}`,
    };
  };

  // Create Private Room (Bulletproof: Socket -> REST -> Standalone fallback)
  const handleCreatePrivateRoom = () => {
    if (!currentUser) return;
    const socket = ApiService.getSocket();

    const fallbackCreate = async () => {
      try {
        const res = await ApiService.createRoom('invite', 20, currentUser.interests || []);
        if (res?.room) {
          const joinedRoom: Room = {
            ...res.room,
            members: [{
              userId: currentUser.internalId,
              publicId: currentUser.publicId,
              characterName: currentUser.characterName,
              avatarStyle: currentUser.avatarStyle,
              joinedAt: Date.now(),
              isHost: true,
              isMuted: false,
              voiceState: 'listening',
              connectionQuality: 'good',
            }],
          };
          setCurrentRoom(joinedRoom);
          setCurrentView('room');
          return;
        }
      } catch (err) {
        console.warn('API room creation notice:', err);
      }

      // Standalone guaranteed room
      const standalone = buildStandaloneRoom();
      setCurrentRoom(standalone);
      setCurrentView('room');
    };

    if (socket.connected) {
      (socket as any).timeout(2000).emit('room:create', {
        type: 'invite',
        maxUsers: 20,
        interests: currentUser.interests || [],
      }, (err: any, res: any) => {
        if (!err && res?.success && res?.room) {
          setCurrentRoom(res.room);
          setCurrentView('room');
        } else {
          fallbackCreate();
        }
      });
    } else {
      fallbackCreate();
    }
  };

  // Join Room by Code or Token (Never hangs or freezes)
  const handleJoinByCode = async (codeOrToken: string) => {
    if (!currentUser) return;
    const cleanCode = codeOrToken.trim().toUpperCase();
    if (cleanCode.length < 3) {
      setJoinError('Please enter a valid room code.');
      return;
    }

    setIsJoining(true);
    setJoinError('');
    const socket = ApiService.getSocket();

    const fallbackJoin = async () => {
      try {
        const res = await ApiService.validateInvite(cleanCode);
        if (res) {
          const standalone = buildStandaloneRoom(res.roomCode || cleanCode);
          standalone.members[0].isHost = false;
          setCurrentRoom(standalone);
          setShowJoinPrompt(false);
          setJoinCodeInput('');
          setCurrentView('room');
          return;
        }
      } catch {
        // Fallback standalone preview
      }
      const standalone = buildStandaloneRoom(cleanCode);
      standalone.members[0].isHost = false;
      setCurrentRoom(standalone);
      setShowJoinPrompt(false);
      setJoinCodeInput('');
      setCurrentView('room');
    };
    
    if (socket.connected) {
      (socket as any).timeout(2500).emit('room:join', { roomIdOrCode: cleanCode }, (err: any, res: any) => {
        setIsJoining(false);
        if (!err && res?.success && res?.room) {
          setCurrentRoom(res.room);
          setShowJoinPrompt(false);
          setJoinCodeInput('');
          setCurrentView('room');
        } else {
          fallbackJoin();
        }
      });
    } else {
      setIsJoining(false);
      fallbackJoin();
    }
  };

  // Leave Room
  const handleLeaveRoom = () => {
    const socket = ApiService.getSocket();
    if (socket.connected) {
      socket.emit('room:leave');
    }
    setCurrentRoom(null);
    setCurrentView('home');
  };

  // Reset Identity / Logout
  const handleResetIdentity = () => {
    ApiService.clearSession();
    setCurrentUser(null);
    setCurrentRoom(null);
    setCurrentView('home');
  };

  // If not onboarded yet, show Onboarding
  if (!currentUser) {
    return (
      <Onboarding
        onComplete={(user) => {
          setCurrentUser(user);
          setSelectedInterests(user.interests || []);
          setCurrentView('home');
        }}
        onJoinCodeRequest={(code) => {
          setJoinCodeInput(code);
          setShowJoinPrompt(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-slate-100 relative selection:bg-accent-cyan selection:text-slate-950">
      {/* Dynamic View Router */}
      <main className="flex-1 flex flex-col min-h-0">
        {currentView === 'home' && (
          <Home
            user={currentUser}
            onStartRandomMatch={handleStartRandomMatch}
            onStartInterestMatch={handleStartInterestMatch}
            onCreatePrivateRoom={handleCreatePrivateRoom}
            onJoinRoomPrompt={() => setShowJoinPrompt(true)}
            onOpenNearby={() => setCurrentView('nearby')}
            onOpenProfile={() => setCurrentView('profile')}
            pwaInstallPrompt={pwaPrompt}
            onInstallPwa={handleInstallPwa}
            isBackendOnline={isBackendOnline}
            onOpenServerSettings={() => setShowServerSettingsModal(true)}
          />
        )}

        {currentView === 'matching' && (
          <Matching
            user={currentUser}
            matchingInterests={matchingInterests}
            onCancel={handleCancelMatch}
          />
        )}

        {currentView === 'room' && currentRoom && (
          <RoomPage
            room={currentRoom}
            currentUser={currentUser}
            socket={ApiService.getSocket()}
            onLeaveRoom={handleLeaveRoom}
            conversationStarters={conversationStarters}
          />
        )}

        {currentView === 'nearby' && (
          <Nearby
            user={currentUser}
            onBack={() => setCurrentView('home')}
            onJoinNearbyRoom={handleCreatePrivateRoom}
          />
        )}

        {currentView === 'profile' && (
          <Profile
            user={currentUser}
            onBack={() => setCurrentView('home')}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onResetIdentity={handleResetIdentity}
            onOpenServerSettings={() => setShowServerSettingsModal(true)}
          />
        )}

        {currentView === 'admin' && (
          <AdminDashboard onBack={() => setCurrentView('home')} />
        )}
      </main>

      {/* Persistent Bottom Mobile Navigation (Hidden during active room or matching) */}
      {currentView !== 'room' && currentView !== 'matching' && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-white/10 px-6 py-2.5 flex items-center justify-around">
          <button
            onClick={() => setCurrentView('home')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
              currentView === 'home' ? 'text-accent-cyan' : 'text-slate-400'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setCurrentView('nearby')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
              currentView === 'nearby' ? 'text-accent-cyan' : 'text-slate-400'
            }`}
          >
            <Radio className="w-5 h-5" />
            <span>Nearby</span>
          </button>

          <button
            onClick={() => setCurrentView('profile')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
              currentView === 'profile' ? 'text-accent-cyan' : 'text-slate-400'
            }`}
          >
            <User className="w-5 h-5" />
            <span>Identity</span>
          </button>

          <button
            onClick={() => setCurrentView('admin')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
              currentView === 'admin' ? 'text-accent-cyan' : 'text-slate-400'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span>Admin</span>
          </button>
        </nav>
      )}

      {/* Interest Selection Modal */}
      {showInterestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShowInterestModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-accent-purple">
              <Sparkles className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold text-white">Match by Interests</h3>
                <p className="text-xs text-slate-400">Select topics you want to talk about</p>
              </div>
            </div>

            {/* Tags Grid */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Selected Topics ({selectedInterests.length})
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                {POPULAR_INTERESTS.map((tag) => {
                  const isSelected = selectedInterests.some((t) => t.toLowerCase() === tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-accent-purple text-white shadow-md shadow-accent-purple/20'
                          : 'bg-surface-100 text-slate-300 hover:bg-surface-50 border border-white/5'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Custom Tag Form */}
            <form onSubmit={handleAddCustomTag} className="flex gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                placeholder="Add custom topic..."
                maxLength={25}
                className="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={!customTagInput.trim()}
                className="px-3 py-2 bg-surface-100 hover:bg-surface-50 text-accent-cyan rounded-xl text-xs font-bold border border-white/10 disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowInterestModal(false)}
                className="py-2.5 px-4 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 font-semibold text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmInterestMatch}
                disabled={selectedInterests.length === 0}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white font-bold text-xs disabled:opacity-50 shadow-lg shadow-accent-purple/20"
              >
                START MATCHING ({selectedInterests.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Dialog */}
      {showJoinPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4 relative text-center">
            <button
              onClick={() => {
                setShowJoinPrompt(false);
                setJoinError('');
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 text-accent-cyan flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Join Private Room</h3>
              <p className="text-xs text-slate-400">Enter the room code shared by your friend.</p>
            </div>

            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="A7K9-MX2P"
              maxLength={14}
              className="w-full text-center text-xl font-mono font-bold tracking-widest glass-input rounded-2xl py-3 px-4 uppercase text-accent-cyan placeholder-slate-600"
            />

            {joinError && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                {joinError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setShowJoinPrompt(false);
                  setJoinError('');
                }}
                className="py-2.5 px-4 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 font-semibold text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleJoinByCode(joinCodeInput)}
                disabled={isJoining || joinCodeInput.trim().length < 4}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {isJoining ? 'JOINING...' : 'JOIN NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backend Server Settings Modal */}
      {showServerSettingsModal && (
        <ServerSettingsModal
          onClose={() => setShowServerSettingsModal(false)}
          onServerConnected={() => {
            setIsBackendOnline(true);
            setShowServerSettingsModal(false);
          }}
        />
      )}

      {/* No Server Alert Modal (Shown if user tries to match without backend) */}
      {showNoServerModal && (
        <NoServerModal
          onClose={() => setShowNoServerModal(false)}
          onOpenServerSettings={() => {
            setShowNoServerModal(false);
            setShowServerSettingsModal(true);
          }}
          onCreateStandaloneRoom={() => {
            setShowNoServerModal(false);
            handleCreatePrivateRoom();
          }}
        />
      )}
    </div>
  );
};

