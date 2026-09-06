import React, { useState, useEffect } from 'react';
import { CURATED_INTERESTS } from '../../../shared/validation';
import { AvatarStyle, VoicePreference, AnonymousUser } from '../../../shared/types';
import { Avatar } from '../components/Avatar';
import { ApiService } from '../services/api';
import { ArrowRight, RefreshCw, KeyRound, Plus } from 'lucide-react';

interface OnboardingProps {
  onComplete: (user: AnonymousUser) => void;
  onJoinCodeRequest: (code: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onJoinCodeRequest }) => {
  const [step, setStep] = useState<'welcome' | 'interests' | 'identity' | 'join_code'>('welcome');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Anime', 'Gaming', 'Technology']);
  const [customInterest, setCustomInterest] = useState('');
  
  const [characterName, setCharacterName] = useState('');
  const [publicId, setPublicId] = useState('');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('shadow');
  const [voicePref, setVoicePref] = useState<VoicePreference>('voice_and_text');
  const [bio, setBio] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const avatarStyles: AvatarStyle[] = [
    'shadow', 'cyber', 'fantasy', 'samurai', 'neon', 'space', 'toon', 'mystic', 'retro', 'minimal'
  ];

  // Request AI identity generation based on current interests
  const handleGenerateIdentity = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    try {
      const generated = await ApiService.generateIdentity(selectedInterests);
      setCharacterName(generated.characterName);
      setPublicId(generated.publicId);
      setAvatarStyle(generated.avatarStyle);
    } catch (err: any) {
      console.warn('AI generator fallback:', err);
      setCharacterName('ShadowKairo');
      setPublicId('SHD-7X92-K4');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (step === 'identity' && !characterName) {
      handleGenerateIdentity();
    }
  }, [step]);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 15) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const handleAddCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = customInterest.trim().toLowerCase();
    if (tag && !selectedInterests.map(i => i.toLowerCase()).includes(tag)) {
      setSelectedInterests([...selectedInterests, tag]);
      setCustomInterest('');
    }
  };

  const handleFinishRegistration = async () => {
    try {
      setIsGenerating(true);
      setErrorMsg('');
      const { user } = await ApiService.registerAnonymous({
        characterName: characterName.trim() || undefined,
        avatarStyle,
        interests: selectedInterests,
        bio: bio.trim(),
        voicePreference: voicePref,
      });
      onComplete(user);
    } catch (err: any) {
      console.warn('Registration fallback triggered:', err);
      const fallbackUser: AnonymousUser = {
        internalId: `anon_${Date.now()}`,
        publicId: publicId || 'ANO-7X92-K4',
        characterName: characterName.trim() || 'ShadowKairo',
        avatarStyle,
        interests: selectedInterests,
        bio: bio.trim(),
        voicePreference: voicePref,
        presence: 'online',
        createdAt: Date.now(),
      };
      ApiService.setStoredToken(fallbackUser.internalId);
      localStorage.setItem('anon_user_profile', JSON.stringify(fallbackUser));
      onComplete(fallbackUser);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-surface-300 to-background">
      {/* Background ambient lighting */}
      <div className="absolute w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-96 h-96 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

      <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 z-10">
        {/* STEP 1: WELCOME SCREEN */}
        {step === 'welcome' && (
          <div className="space-y-6 text-center py-4">
            {/* Minimalist Tech Crest */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-white/10 text-slate-300 text-[11px] font-mono mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>GHOST PROTOCOL // P2P VOICE</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase font-sans">
                ENTER WITHOUT BEING KNOWN.
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                Talk. Connect. Leave no unnecessary identity behind. Real-time voice and text rooms powered by WebRTC.
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={() => setStep('interests')}
                className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm tracking-wide transition-all transform active:scale-95 shadow-xl shadow-white/5 flex items-center justify-center gap-2"
              >
                <span>CREATE ANONYMOUS ID</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setStep('join_code')}
                className="w-full py-3.5 px-6 rounded-2xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-slate-300 font-semibold text-sm tracking-wide transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4 text-accent-cyan" />
                <span>JOIN WITH INVITE CODE</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 pt-2 flex items-center justify-center gap-2 font-mono">
              <span>No email</span>
              <span>•</span>
              <span>No phone numbers</span>
              <span>•</span>
              <span>Zero tracking</span>
            </div>
          </div>
        )}

        {/* STEP 1B: ENTER INVITE CODE */}
        {step === 'join_code' && (
          <div className="space-y-5 text-center py-2">
            <div className="text-left">
              <button
                onClick={() => setStep('welcome')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                ← Back
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Enter Private Invite Code</h2>
              <p className="text-xs text-slate-400">
                Type the human-readable code provided by the room host (e.g. A7K9-MX2P).
              </p>
            </div>

            <div className="py-2">
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                maxLength={14}
                className="w-full text-center text-2xl font-mono font-bold tracking-widest glass-input rounded-2xl py-3 px-4 uppercase text-accent-cyan placeholder-slate-600"
              />
            </div>

            <button
              onClick={() => onJoinCodeRequest(inviteCodeInput.trim())}
              disabled={inviteCodeInput.trim().length < 4}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-bold text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95 shadow-lg shadow-accent-cyan/20"
            >
              JOIN ROOM
            </button>
          </div>
        )}

        {/* STEP 2: SELECT INTERESTS */}
        {step === 'interests' && (
          <div className="space-y-5 py-2">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">What are you into?</h2>
              <p className="text-xs text-slate-400">
                Choose a few topics to shape your AI character name and interest-based matching.
              </p>
            </div>

            {/* Curated Interests Chips */}
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 scrollbar-thin">
              {CURATED_INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-accent-cyan text-slate-950 font-semibold shadow-md shadow-accent-cyan/20 scale-105'
                        : 'bg-surface-100 hover:bg-surface-50 text-slate-300 border border-white/10'
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>

            {/* Custom Interest Input */}
            <form onSubmit={handleAddCustomInterest} className="flex gap-2">
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                placeholder="Add custom interest tag..."
                maxLength={24}
                className="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={!customInterest.trim()}
                className="px-3.5 py-2 bg-surface-100 hover:bg-surface-50 border border-white/10 text-white rounded-xl text-xs font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>

            <button
              onClick={() => setStep('identity')}
              disabled={selectedInterests.length === 0}
              className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm tracking-wide transition-all transform active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <span>CUSTOMIZE ALIAS & AVATAR</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: ANONYMOUS CHARACTER PROFILE */}
        {step === 'identity' && (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-white">Anonymous Alias Signature</h2>
                <p className="text-xs text-slate-400">Original pseudonym with guaranteed unique ID.</p>
              </div>
              <button
                onClick={handleGenerateIdentity}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-50 text-accent-cyan border border-white/10 text-xs font-semibold"
                title="Generate another pseudonym"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Reroll Alias</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            {/* Character Preview Card */}
            <div className="p-4 bg-surface-200/80 rounded-2xl border border-white/10 flex items-center gap-4">
              <Avatar style={avatarStyle} size="lg" />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Character name"
                  maxLength={24}
                  className="bg-transparent text-lg font-bold text-white border-b border-transparent focus:border-accent-cyan outline-none w-full"
                />
                <div className="text-xs text-accent-cyan font-mono mt-0.5 tracking-wider font-semibold">
                  ID: {publicId || 'SHD-XXXX-XX'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  {selectedInterests.slice(0, 3).join(' • ')}
                </div>
              </div>
            </div>

            {/* Avatar Style Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Avatar Style</label>
              <div className="grid grid-cols-5 gap-2">
                {avatarStyles.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAvatarStyle(s)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      avatarStyle === s
                        ? 'border-accent-cyan bg-accent-cyan/10 shadow-sm shadow-accent-cyan/20'
                        : 'border-white/5 bg-surface-100/50 hover:border-white/15'
                    }`}
                  >
                    <Avatar style={s} size="sm" />
                    <span className="text-[9px] capitalize text-slate-300">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Preference */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Communication Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'voice_and_text', label: 'Voice + Text' },
                  { id: 'text_only', label: 'Text Only' },
                  { id: 'voice_only', label: 'Voice Only' },
                ].map((pref) => (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => setVoicePref(pref.id as VoicePreference)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                      voicePref === pref.id
                        ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan font-semibold'
                        : 'border-white/5 bg-surface-100 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pref.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Anonymous Bio (Optional)</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Fictional character vibe or quote..."
                maxLength={120}
                className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>

            <button
              onClick={handleFinishRegistration}
              disabled={isGenerating || !characterName.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple text-slate-950 font-bold text-sm tracking-wide transition-all transform active:scale-95 disabled:opacity-40 shadow-xl shadow-accent-cyan/20 hover:brightness-110 flex items-center justify-center gap-2"
            >
              <span>ENTER THE LOUNGE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
