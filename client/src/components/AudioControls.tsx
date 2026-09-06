import React, { useState } from 'react';
import { Mic, MicOff, Volume2, PhoneOff } from 'lucide-react';

interface AudioControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
  onSelectOutput?: () => void;
  audioOutputLabel?: string;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isMuted,
  onToggleMute,
  onLeave,
  onSelectOutput,
  audioOutputLabel = 'Speaker',
}) => {
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  return (
    <>
      <div className="w-full max-w-md mx-auto px-4 py-3 glass-panel rounded-2xl flex items-center justify-between shadow-2xl border border-white/10">
        {/* MUTE / UNMUTE BUTTON */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/10'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
            }`}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          <span className="text-[11px] font-medium text-slate-300">
            {isMuted ? 'Muted' : 'Mic On'}
          </span>
        </div>

        {/* AUDIO OUTPUT SELECTOR */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onSelectOutput}
            className="w-14 h-14 rounded-full bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 border border-white/10 flex items-center justify-center transition-all duration-200 active:scale-95 shadow-md"
            aria-label="Toggle audio output destination"
          >
            <Volume2 className="w-6 h-6 text-accent-cyan" />
          </button>
          <span className="text-[11px] font-medium text-slate-300">
            {audioOutputLabel}
          </span>
        </div>

        {/* LEAVE / CALL CUT BUTTON */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowConfirmLeave(true)}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all duration-200 active:scale-95 shadow-lg shadow-red-600/30"
            aria-label="Leave call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <span className="text-[11px] font-medium text-red-400">
            Leave
          </span>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <PhoneOff className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white">Leave this conversation?</h3>
              <p className="text-xs text-slate-400 mt-1">
                You will disconnect from all voice participants and exit this room.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowConfirmLeave(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors"
              >
                STAY
              </button>
              <button
                onClick={() => {
                  setShowConfirmLeave(false);
                  onLeave();
                }}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors shadow-lg shadow-red-600/20"
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
