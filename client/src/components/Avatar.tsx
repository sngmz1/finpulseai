import React from 'react';
import { AvatarStyle } from '../../../shared/types';
import { MicOff } from 'lucide-react';

interface AvatarProps {
  style: AvatarStyle;
  seedName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  isMuted?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  style,
  size = 'md',
  isSpeaking = false,
  isMuted = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  };

  const getStyleColors = (styleType: AvatarStyle) => {
    switch (styleType) {
      case 'cyber':
        return { primary: '#00f2fe', secondary: '#4facfe', bg: '#081726' };
      case 'shadow':
        return { primary: '#a855f7', secondary: '#6366f1', bg: '#100c1e' };
      case 'fantasy':
        return { primary: '#ec4899', secondary: '#8b5cf6', bg: '#1b0d26' };
      case 'samurai':
        return { primary: '#ef4444', secondary: '#f97316', bg: '#210c0e' };
      case 'neon':
        return { primary: '#10b981', secondary: '#06b6d4', bg: '#061c16' };
      case 'space':
        return { primary: '#38bdf8', secondary: '#818cf8', bg: '#0b1329' };
      case 'retro':
        return { primary: '#f43f5e', secondary: '#fbbf24', bg: '#240f1a' };
      case 'toon':
        return { primary: '#f59e0b', secondary: '#10b981', bg: '#1c170a' };
      case 'mystic':
        return { primary: '#d946ef', secondary: '#06b6d4', bg: '#1f0d2b' };
      case 'minimal':
      default:
        return { primary: '#e2e8f0', secondary: '#64748b', bg: '#111520' };
    }
  };

  const colors = getStyleColors(style);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeMap[size]} ${className}`}>
      {/* Speaking Active Glow Pulse */}
      {isSpeaking && (
        <div 
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: '#10b981' }}
        />
      )}

      {/* Main Avatar Container */}
      <div 
        className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 ${
          isSpeaking 
            ? 'speaker-ring-active scale-105' 
            : 'border border-white/10 hover:border-white/20'
        }`}
        style={{ backgroundColor: colors.bg }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none">
          <defs>
            <linearGradient id={`grad-${style}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} />
              <stop offset="100%" stopColor={colors.secondary} />
            </linearGradient>
            <filter id={`glow-${style}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background circle / crest */}
          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeDasharray="6 4" />

          {/* Style specific stylized masks */}
          {style === 'cyber' && (
            <g filter={`url(#glow-${style})`}>
              <path d="M26 42 L74 42 L66 60 L34 60 Z" fill={`url(#grad-${style})`} opacity="0.9" />
              <circle cx="50" cy="51" r="3" fill="#fff" />
              <line x1="18" y1="50" x2="26" y2="46" stroke={colors.primary} strokeWidth="2" />
              <line x1="82" y1="50" x2="74" y2="46" stroke={colors.primary} strokeWidth="2" />
              <line x1="50" y1="24" x2="50" y2="34" stroke={colors.primary} strokeWidth="2" />
            </g>
          )}

          {style === 'shadow' && (
            <g filter={`url(#glow-${style})`}>
              <path d="M30 48 Q50 36 70 48 Q50 64 30 48 Z" fill={`url(#grad-${style})`} opacity="0.8" />
              <circle cx="42" cy="48" r="2.5" fill="#fff" />
              <circle cx="58" cy="48" r="2.5" fill="#fff" />
              <path d="M50 20 L50 32" stroke={colors.primary} strokeWidth="1.5" strokeDasharray="2 2" />
            </g>
          )}

          {style === 'samurai' && (
            <g filter={`url(#glow-${style})`}>
              {/* Kabuto crescent */}
              <path d="M22 34 Q50 18 78 34 Q50 26 22 34 Z" fill={`url(#grad-${style})`} />
              {/* Visor */}
              <rect x="28" y="44" width="44" height="12" rx="3" fill={`url(#grad-${style})`} opacity="0.85" />
              <line x1="34" y1="50" x2="66" y2="50" stroke="#fff" strokeWidth="1.5" />
            </g>
          )}

          {style === 'neon' && (
            <g filter={`url(#glow-${style})`}>
              <polygon points="50,22 76,46 50,78 24,46" stroke={`url(#grad-${style})`} strokeWidth="3" fill="none" />
              <circle cx="50" cy="48" r="5" fill={`url(#grad-${style})`} />
            </g>
          )}

          {style === 'space' && (
            <g filter={`url(#glow-${style})`}>
              <ellipse cx="50" cy="50" rx="26" ry="20" stroke={`url(#grad-${style})`} strokeWidth="3" fill="rgba(56,189,248,0.15)" />
              <path d="M34 44 Q50 40 66 44" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            </g>
          )}

          {style === 'fantasy' && (
            <g filter={`url(#glow-${style})`}>
              <path d="M26 30 Q50 48 50 68 Q50 48 74 30" stroke={`url(#grad-${style})`} strokeWidth="3" fill="none" />
              <circle cx="50" cy="42" r="4" fill={`url(#grad-${style})`} />
              <circle cx="50" cy="58" r="2.5" fill="#fff" />
            </g>
          )}

          {style === 'toon' && (
            <g filter={`url(#glow-${style})`}>
              <circle cx="38" cy="46" r="6" fill={`url(#grad-${style})`} />
              <circle cx="62" cy="46" r="6" fill={`url(#grad-${style})`} />
              <circle cx="40" cy="44" r="2" fill="#fff" />
              <circle cx="64" cy="44" r="2" fill="#fff" />
              <path d="M42 60 Q50 66 58 60" stroke={`url(#grad-${style})`} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}

          {style === 'mystic' && (
            <g filter={`url(#glow-${style})`}>
              <circle cx="50" cy="50" r="14" stroke={`url(#grad-${style})`} strokeWidth="2" />
              <circle cx="50" cy="50" r="6" fill={`url(#grad-${style})`} />
              <line x1="50" y1="20" x2="50" y2="80" stroke={colors.primary} strokeWidth="1" strokeDasharray="4 3" />
              <line x1="20" y1="50" x2="80" y2="50" stroke={colors.primary} strokeWidth="1" strokeDasharray="4 3" />
            </g>
          )}

          {style === 'retro' && (
            <g filter={`url(#glow-${style})`}>
              <rect x="25" y="40" width="50" height="18" rx="2" fill={`url(#grad-${style})`} opacity="0.85" />
              <line x1="25" y1="46" x2="75" y2="46" stroke="#fff" strokeWidth="1" />
              <line x1="25" y1="52" x2="75" y2="52" stroke="#fff" strokeWidth="1" />
            </g>
          )}

          {style === 'minimal' && (
            <g filter={`url(#glow-${style})`}>
              <circle cx="50" cy="50" r="18" stroke={`url(#grad-${style})`} strokeWidth="3" />
              <circle cx="50" cy="50" r="4" fill="#fff" />
            </g>
          )}
        </svg>
      </div>

      {/* Speaking Voice Equalizer Wave Indicator */}
      {isSpeaking && !isMuted && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-slate-900/90 border border-emerald-500/50 flex items-center gap-0.5 shadow-lg shadow-emerald-500/20 z-10">
          <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
        </div>
      )}

      {/* Muted Indicator Badge */}
      {isMuted && (
        <div className="absolute -bottom-1 -right-1 bg-red-500/90 text-white rounded-full p-1 border border-background shadow-md">
          <MicOff className="w-3 h-3" />
        </div>
      )}
    </div>
  );
};
