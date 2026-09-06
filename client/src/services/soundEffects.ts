// Tactile Web Audio Sound Synthesizer for High-End Native App Feel
// Generates subtle acoustic micro-tones without any heavy external MP3/WAV assets

class SoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(freq: number, type: OscillatorType = 'sine', duration = 0.08, gainVal = 0.06): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy handled silently
    }
  }

  public playJoin(): void {
    this.playTone(440, 'sine', 0.06, 0.04);
    setTimeout(() => this.playTone(660, 'sine', 0.09, 0.05), 60);
  }

  public playLeave(): void {
    this.playTone(550, 'sine', 0.06, 0.04);
    setTimeout(() => this.playTone(330, 'sine', 0.09, 0.05), 60);
  }

  public playMute(): void {
    this.playTone(280, 'triangle', 0.04, 0.03);
  }

  public playUnmute(): void {
    this.playTone(720, 'sine', 0.05, 0.04);
  }

  public playMessage(): void {
    this.playTone(880, 'sine', 0.04, 0.02);
  }
}

export const sounds = new SoundEffects();
