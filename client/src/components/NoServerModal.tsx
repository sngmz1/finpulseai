import React from 'react';
import { Server, Radio, PlusCircle, X } from 'lucide-react';

interface NoServerModalProps {
  onClose: () => void;
  onOpenServerSettings: () => void;
  onCreateStandaloneRoom: () => void;
}

export const NoServerModal: React.FC<NoServerModalProps> = ({
  onClose,
  onOpenServerSettings,
  onCreateStandaloneRoom,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4 relative text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
          <Server className="w-7 h-7 animate-pulse" />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-white">Online Backend Not Connected</h3>
          <p className="text-xs text-slate-300 leading-relaxed px-2">
            Netlify hosts the static web application. To match with other live users across the internet, your Node.js backend must be connected.
          </p>
        </div>

        {/* Standalone features note */}
        <div className="bg-surface-200/80 p-3 rounded-2xl border border-white/5 text-left text-xs space-y-1 text-slate-300">
          <div className="font-semibold text-accent-cyan flex items-center gap-1.5">
            <Radio className="w-4 h-4" />
            <span>What you can do right now:</span>
          </div>
          <p className="text-[11px] text-slate-400">
            • <b>Instant Room:</b> Create an audio room immediately to test microphone, voice, and audio controls.
          </p>
          <p className="text-[11px] text-slate-400">
            • <b>Connect Backend:</b> Link a free Render.com or Railway backend to enable global internet matchmaking.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => {
              onClose();
              onCreateStandaloneRoom();
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent-cyan/20 active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>CREATE INSTANT ROOM & TEST MIC</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenServerSettings();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-surface-100 hover:bg-surface-50 text-white font-semibold text-xs border border-white/10 flex items-center justify-center gap-2 transition-colors"
          >
            <Server className="w-4 h-4 text-accent-purple" />
            <span>CONNECT BACKEND SERVER URL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
