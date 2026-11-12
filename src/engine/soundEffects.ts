// Synthesized cosy tactile Web Audio effects (zero external MP3 dependencies)

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0,
    freqEnd?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  cardSlide() {
    this.playTone(260, 0.07, 'triangle', 0.08, 0, 420);
  }

  cardFlip() {
    this.playTone(340, 0.06, 'sine', 0.07, 0, 560);
  }

  categoryOpen() {
    this.playTone(523.25, 0.12, 'triangle', 0.11, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.11, 0.07);
  }

  match() {
    this.playTone(587.33, 0.11, 'sine', 0.11, 0);
    this.playTone(880, 0.16, 'sine', 0.09, 0.06);
  }

  categoryComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', 0.12, idx * 0.065);
    });
  }

  unlock() {
    this.playTone(440, 0.08, 'square', 0.06, 0, 660);
    this.playTone(880, 0.18, 'triangle', 0.11, 0.07, 1174);
  }

  mistake() {
    this.playTone(210, 0.14, 'sawtooth', 0.06, 0, 145);
  }

  win() {
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((n, idx) => {
      this.playTone(n, 0.35, 'triangle', 0.13, idx * 0.08);
    });
  }
}

export const soundFx = new SoundEngine();
