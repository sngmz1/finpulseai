import React, { useEffect, useState } from 'react';
import { AnonymousUser } from '../../../shared/types';
import { Avatar } from '../components/Avatar';
import { X, Sparkles, Radio } from 'lucide-react';

interface MatchingProps {
  user: AnonymousUser;
  matchingInterests: string[];
  onCancel: () => void;
}

export const Matching: React.FC<MatchingProps> = ({
  user,
  matchingInterests,
  onCancel,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative max-w-md mx-auto w-full">
      {/* Radar rings animation */}
      <div className="relative w-64 h-64 flex items-center justify-center mb-8">
        <div className="absolute inset-0 rounded-full border border-accent-cyan/20 animate-ping opacity-25" />
        <div className="absolute w-48 h-48 rounded-full border border-accent-purple/30 animate-pulse-subtle" />
        <div className="absolute w-32 h-32 rounded-full border border-white/10" />

        {/* User avatar centered in radar */}
        <div className="relative z-10 shadow-2xl">
          <Avatar style={user.avatarStyle} size="xl" isSpeaking={true} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-mono font-semibold">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>MATCHING... {elapsedSeconds}s</span>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight">
          Finding someone compatible...
        </h2>

        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Searching for up to 2 other peers with shared vibes for a 3-person room.
        </p>
      </div>

      {/* Target interests being matched */}
      <div className="my-6 w-full glass-panel rounded-2xl p-4 border border-white/10">
        <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-center gap-1.5 font-mono uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
          Matching Tags
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {matchingInterests.slice(0, 6).map((tag, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg bg-surface-100 text-slate-300 text-xs font-medium border border-white/5"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onCancel}
        className="w-full py-3.5 px-6 rounded-2xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-slate-300 hover:text-white text-xs font-bold tracking-wider transition-colors flex items-center justify-center gap-2 active:scale-95"
      >
        <X className="w-4 h-4" />
        CANCEL MATCHING
      </button>
    </div>
  );
};
