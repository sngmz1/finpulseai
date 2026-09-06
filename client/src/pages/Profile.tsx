import React, { useState } from 'react';
import { AnonymousUser, AvatarStyle, VoicePreference } from '../../../shared/types';
import { Avatar } from '../components/Avatar';
import { ArrowLeft, Lock, LogOut, Check, Mic, Server } from 'lucide-react';

interface ProfileProps {
  user: AnonymousUser;
  onBack: () => void;
  onUpdateUser: (user: AnonymousUser) => void;
  onResetIdentity: () => void;
  onOpenServerSettings?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({
  user,
  onBack,
  onUpdateUser,
  onResetIdentity,
  onOpenServerSettings,
}) => {
  const [characterName, setCharacterName] = useState(user.characterName);
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(user.avatarStyle);
  const [bio, setBio] = useState(user.bio);
  const [voicePref, setVoicePref] = useState<VoicePreference>(user.voicePreference);
  const [isSaved, setIsSaved] = useState(false);

  // Privacy toggles
  const [allowMatching, setAllowMatching] = useState(true);
  const [allowNearby, setAllowNearby] = useState(true);

  const avatarStyles: AvatarStyle[] = [
    'shadow', 'cyber', 'fantasy', 'samurai', 'neon', 'space', 'toon', 'mystic', 'retro', 'minimal'
  ];

  const handleSave = () => {
    const updated: AnonymousUser = {
      ...user,
      characterName: characterName.trim() || user.characterName,
      avatarStyle,
      bio: bio.trim(),
      voicePreference: voicePref,
    };
    onUpdateUser(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6 relative overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-bold text-white tracking-tight">Identity & Settings</h2>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-accent-cyan/20"
        >
          {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Identity Card */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <Avatar style={avatarStyle} size="xl" />
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="text-lg font-bold text-white bg-transparent border-b border-transparent focus:border-accent-cyan outline-none w-full"
            />
            <div className="text-xs text-accent-cyan font-mono font-semibold tracking-wider mt-0.5">
              ID: {user.publicId}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Anonymous character identity
            </div>
          </div>
        </div>

        {/* Avatar Style Quick Select */}
        <div className="pt-2">
          <label className="text-xs font-semibold text-slate-300 block mb-2">Avatar Style</label>
          <div className="grid grid-cols-5 gap-2">
            {avatarStyles.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAvatarStyle(s)}
                className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  avatarStyle === s
                    ? 'border-accent-cyan bg-accent-cyan/10'
                    : 'border-white/5 bg-surface-100/50'
                }`}
              >
                <Avatar style={s} size="sm" />
                <span className="text-[9px] capitalize text-slate-400">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Communication Preference */}
        <div className="pt-2">
          <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Voice & Audio Mode</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'voice_and_text', label: 'Voice + Text' },
              { id: 'text_only', label: 'Text Only' },
              { id: 'voice_only', label: 'Voice Only' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setVoicePref(p.id as VoicePreference)}
                className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                  voicePref === p.id
                    ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan font-semibold'
                    : 'border-white/5 bg-surface-100/60 text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div className="pt-2">
          <label className="text-xs font-semibold text-slate-300 block mb-1">Bio</label>
          <input
            type="text"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="No personal data. Keep it anonymous..."
            maxLength={120}
            className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500"
          />
        </div>
      </div>

      {/* Privacy & Safety Settings */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl space-y-4 mb-6">
        <div className="flex items-center gap-2 text-accent-cyan text-xs font-bold uppercase font-mono tracking-wider">
          <Lock className="w-4 h-4" />
          <span>Privacy Protections</span>
        </div>

        <div className="space-y-3 divide-y divide-white/5">
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-xs font-bold text-white">Random Matching</div>
              <div className="text-[11px] text-slate-400">Allow incoming match pairing with peers</div>
            </div>
            <input
              type="checkbox"
              checked={allowMatching}
              onChange={(e) => setAllowMatching(e.target.checked)}
              className="w-4 h-4 accent-accent-cyan"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-bold text-white">Nearby Radar Discovery</div>
              <div className="text-[11px] text-slate-400">Allow local peers to find this anonymous node</div>
            </div>
            <input
              type="checkbox"
              checked={allowNearby}
              onChange={(e) => setAllowNearby(e.target.checked)}
              className="w-4 h-4 accent-accent-cyan"
            />
          </div>
        </div>
      </div>

      {/* Backend Server Connection */}
      {onOpenServerSettings && (
        <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent-cyan text-xs font-bold uppercase font-mono tracking-wider">
              <Server className="w-4 h-4" />
              <span>Backend Server Connection</span>
            </div>
            <button
              onClick={onOpenServerSettings}
              className="px-3 py-1 bg-surface-100 hover:bg-surface-50 text-accent-cyan hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
            >
              Configure
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Netlify serves the static frontend. Connect your deployed backend (e.g. Render, Railway, Fly.io, or VPS) to unlock real-time internet matchmaking.
          </p>
        </div>
      )}

      {/* Reset Identity / Exit */}
      <div className="pt-2">
        <button
          onClick={onResetIdentity}
          className="w-full py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>LEAVE IDENTITY & START NEW SESSION</span>
        </button>
      </div>
    </div>
  );
};
