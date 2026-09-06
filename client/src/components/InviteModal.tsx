import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Share2, QrCode } from 'lucide-react';

interface InviteModalProps {
  roomCode: string;
  inviteToken?: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  roomCode,
  inviteToken,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  // Safe join link (uses token if present, otherwise room code)
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?join=${encodeURIComponent(inviteToken || roomCode)}`
    : '';

  useEffect(() => {
    if (canvasRef.current && joinUrl) {
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#00f2fe',
          light: '#0c0e14',
        },
      }, (error) => {
        if (error) console.error('QR code generation error:', error);
      });
    }
  }, [joinUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Anonymous Room',
          text: `Join my private anonymous room: ${roomCode}`,
          url: joinUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 text-accent-cyan">
          <QrCode className="w-5 h-5" />
          <span className="text-xs font-semibold tracking-wider uppercase">Private Room Invite</span>
        </div>

        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest font-mono">Room Code</div>
          <div className="text-3xl font-extrabold tracking-wider text-white font-mono mt-1 select-all">
            {roomCode}
          </div>
        </div>

        {/* QR Code Canvas */}
        <div className="flex justify-center my-2">
          <div className="p-3 bg-surface-300 rounded-2xl border border-accent-cyan/30 shadow-lg shadow-accent-cyan/10">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
        </div>

        <p className="text-xs text-slate-400 px-2">
          Share this code or scan the QR code. Identity and real credentials remain 100% private.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors border border-white/10"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
          
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-semibold text-xs transition-transform active:scale-95 shadow-md shadow-accent-cyan/20"
          >
            <Share2 className="w-4 h-4" />
            Share Room
          </button>
        </div>
      </div>
    </div>
  );
};
