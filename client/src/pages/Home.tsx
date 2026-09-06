import React, { useState } from 'react';
import { AnonymousUser } from '../../../shared/types';
import { Avatar } from '../components/Avatar';
import { 
  Radio, 
  Globe, 
  Wifi, 
  Link2, 
  PlusCircle, 
  LogIn, 
  SlidersHorizontal, 
  Download, 
  Sparkles
} from 'lucide-react';

interface HomeProps {
  user: AnonymousUser;
  onStartRandomMatch: () => void;
  onStartInterestMatch: () => void;
  onCreatePrivateRoom: () => void;
  onJoinRoomPrompt: () => void;
  onOpenNearby: () => void;
  onOpenProfile: () => void;
  pwaInstallPrompt?: any;
  onInstallPwa?: () => void;
  isBackendOnline?: boolean;
  onOpenServerSettings?: () => void;
}

export const Home: React.FC<HomeProps> = ({
  user,
  onStartRandomMatch,
  onStartInterestMatch,
  onCreatePrivateRoom,
  onJoinRoomPrompt,
  onOpenNearby,
  onOpenProfile,
  pwaInstallPrompt,
  onInstallPwa,
  isBackendOnline = false,
  onOpenServerSettings,
}) => {
  const [connectionMode, setConnectionMode] = useState<'internet' | 'nearby' | 'invite'>('internet');

  return (
    <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 pt-4 pb-24 sm:pb-8 relative">
      {/* Top Header */}
      <header className="flex items-center justify-between py-2 border-b border-white/10 shrink-0">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/5 transition-colors text-left group"
        >
          <Avatar style={user.avatarStyle} size="md" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white group-hover:text-accent-cyan transition-colors">
                {user.characterName}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-[11px] text-accent-cyan font-mono tracking-wider font-semibold">
              {user.publicId}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {onOpenServerSettings && (
            <button
              onClick={onOpenServerSettings}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all ${
                isBackendOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title="Click to view or change backend server"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{isBackendOnline ? 'Online Server' : 'Standalone'}</span>
            </button>
          )}

          <button
            onClick={onOpenProfile}
            className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-slate-300 hover:text-white transition-colors"
            aria-label="Profile and Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* PWA Install Banner (Subtle, non-intrusive) */}
      {pwaInstallPrompt && (
        <div className="mt-3 px-4 py-2.5 glass-panel rounded-2xl border border-accent-cyan/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-accent-cyan shrink-0" />
            <span className="text-slate-200">
              Make this your private communication space.
            </span>
          </div>
          <button
            onClick={onInstallPwa}
            className="px-3 py-1 bg-accent-cyan hover:bg-accent-blue text-slate-950 font-bold rounded-xl text-[11px] shrink-0 shadow-sm"
          >
            INSTALL APP
          </button>
        </div>
      )}

      {/* Connection Mode Selector */}
      <section className="mt-5">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2 font-mono">
          How do you want to connect?
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setConnectionMode('internet')}
            className={`p-3 rounded-2xl border flex flex-col items-center gap-1 text-center transition-all ${
              connectionMode === 'internet'
                ? 'bg-accent-cyan/10 border-accent-cyan shadow-sm shadow-accent-cyan/10'
                : 'bg-surface-200/50 border-white/5 hover:border-white/15'
            }`}
          >
            <Globe className={`w-5 h-5 ${connectionMode === 'internet' ? 'text-accent-cyan' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold text-white">Internet</span>
            <span className="text-[10px] text-slate-400">Long distance</span>
          </button>

          <button
            onClick={() => {
              setConnectionMode('nearby');
              onOpenNearby();
            }}
            className={`p-3 rounded-2xl border flex flex-col items-center gap-1 text-center transition-all ${
              connectionMode === 'nearby'
                ? 'bg-accent-purple/10 border-accent-purple shadow-sm shadow-accent-purple/10'
                : 'bg-surface-200/50 border-white/5 hover:border-white/15'
            }`}
          >
            <Radio className={`w-5 h-5 ${connectionMode === 'nearby' ? 'text-accent-purple' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold text-white">Nearby</span>
            <span className="text-[10px] text-slate-400">Bluetooth/Local</span>
          </button>

          <button
            onClick={() => {
              setConnectionMode('invite');
              onCreatePrivateRoom();
            }}
            className={`p-3 rounded-2xl border flex flex-col items-center gap-1 text-center transition-all ${
              connectionMode === 'invite'
                ? 'bg-accent-blue/10 border-accent-blue shadow-sm shadow-accent-blue/10'
                : 'bg-surface-200/50 border-white/5 hover:border-white/15'
            }`}
          >
            <Link2 className={`w-5 h-5 ${connectionMode === 'invite' ? 'text-accent-blue' : 'text-slate-400'}`} />
            <span className="text-xs font-semibold text-white">Invite</span>
            <span className="text-[10px] text-slate-400">Private room</span>
          </button>
        </div>
      </section>

      {/* Main Center Area: Animated Matching Orb */}
      <section className="my-auto py-6 flex flex-col items-center text-center">
        <div className="relative group cursor-pointer" onClick={onStartRandomMatch}>
          {/* Outer glowing pulsing aura */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-purple via-accent-cyan to-accent-emerald blur-2xl opacity-40 group-hover:opacity-70 transition-opacity animate-orb-glow" />
          
          {/* Main animated orb */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full glass-panel border border-accent-cyan/30 flex flex-col items-center justify-center p-6 shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="w-14 h-14 rounded-full bg-accent-cyan/10 flex items-center justify-center mb-2">
              <Radio className="w-7 h-7 text-accent-cyan animate-pulse" />
            </div>
            <span className="text-base sm:text-lg font-extrabold tracking-wide text-white font-sans">
              FIND SOMEONE
            </span>
            <span className="text-[11px] text-accent-cyan/90 font-medium mt-1">
              Tap to Random Match
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-xs mt-4">
          Pairs you into a 3-person room with real-time voice and text based on common vibes.
        </p>
      </section>

      {/* Secondary Actions Grid */}
      <section className="grid grid-cols-2 gap-3 mt-auto pt-2">
        <button
          onClick={onStartInterestMatch}
          className="p-3.5 glass-card rounded-2xl flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-accent-purple transition-colors">
              BY INTEREST
            </div>
            <div className="text-[10px] text-slate-400">
              {user.interests.slice(0, 2).join(', ') || 'Custom topics'}
            </div>
          </div>
        </button>

        <button
          onClick={onJoinRoomPrompt}
          className="p-3.5 glass-card rounded-2xl flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-accent-cyan/20 text-accent-cyan flex items-center justify-center shrink-0">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-accent-cyan transition-colors">
              JOIN ROOM
            </div>
            <div className="text-[10px] text-slate-400">
              Enter room code
            </div>
          </div>
        </button>

        <button
          onClick={onCreatePrivateRoom}
          className="p-3.5 glass-card rounded-2xl flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-accent-blue/20 text-accent-blue flex items-center justify-center shrink-0">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-accent-blue transition-colors">
              CREATE ROOM
            </div>
            <div className="text-[10px] text-slate-400">
              Up to 20 users
            </div>
          </div>
        </button>

        <button
          onClick={onOpenNearby}
          className="p-3.5 glass-card rounded-2xl flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-accent-emerald/20 text-accent-emerald flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-accent-emerald transition-colors">
              NEARBY RADAR
            </div>
            <div className="text-[10px] text-slate-400">
              Local devices
            </div>
          </div>
        </button>
      </section>
    </div>
  );
};
