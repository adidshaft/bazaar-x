"use client";

type SoundCue =
  | "footstep"
  | "ui-confirm"
  | "coin-transfer"
  | "tax-collect"
  | "governance-vote"
  | "rule-update"
  | "door-open"
  | "success-chime"
  | "ambient";

class BazaarAudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientInterval: number | null = null;
  private muted = false;
  private lastFootstepAt = 0;
  private economyTone = {
    gdpScore: 0,
    worldTier: 0,
  };

  private ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }

      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.12;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    return this.context;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.12, this.context?.currentTime ?? 0);
    }
  }

  unlock() {
    this.ensureContext();
  }

  setEconomyTone(gdpScore: number, worldTier: number) {
    this.economyTone = {
      gdpScore,
      worldTier,
    };
  }

  private playTone({
    frequency,
    duration,
    type = "square",
    volume = 0.12,
    attack = 0.01,
    release = 0.08,
    detune = 0,
  }: {
    frequency: number;
    duration: number;
    type?: OscillatorType;
    volume?: number;
    attack?: number;
    release?: number;
    detune?: number;
  }) {
    const context = this.ensureContext();
    if (!context || !this.masterGain || this.muted) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.detune.setValueAtTime(detune, context.currentTime);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration + release);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration + release + 0.02);
  }

  private playNoise({
    duration,
    volume,
    highpass = 280,
  }: {
    duration: number;
    volume: number;
    highpass?: number;
  }) {
    const context = this.ensureContext();
    if (!context || !this.masterGain || this.muted) {
      return;
    }

    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;

    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(context.currentTime);
    source.stop(context.currentTime + duration + 0.02);
  }

  private scheduleAmbientPulse() {
    const context = this.ensureContext();
    if (!context || this.muted) {
      return;
    }

    const now = context.currentTime;
    const tones = [
      { frequency: 196, duration: 0.72, type: "triangle" as OscillatorType, volume: 0.025 },
      { frequency: 293.66, duration: 0.48, type: "sine" as OscillatorType, volume: 0.018, detune: 7 },
      { frequency: 392, duration: 0.28, type: "triangle" as OscillatorType, volume: 0.015 },
    ];

    tones.forEach((tone, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, now + index * 0.12);
      if (tone.detune) {
        oscillator.detune.setValueAtTime(tone.detune, now + index * 0.12);
      }
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(tone.volume, now + index * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + tone.duration);
      oscillator.connect(gain);
      gain.connect(this.masterGain!);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + tone.duration + 0.05);
    });
  }

  startAmbient() {
    this.ensureContext();
    if (typeof window === "undefined" || this.ambientInterval !== null) {
      return;
    }

    this.scheduleAmbientPulse();
    this.ambientInterval = window.setInterval(() => {
      this.scheduleAmbientPulse();
    }, 5200);
  }

  stopAmbient() {
    if (this.ambientInterval !== null && typeof window !== "undefined") {
      window.clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }

  play(cue: SoundCue) {
    this.ensureContext();
    if (this.muted) {
      return;
    }

    switch (cue) {
      case "footstep": {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - this.lastFootstepAt < 165) {
          return;
        }
        this.lastFootstepAt = now;
        const wealthLift = Math.min(0.05, this.economyTone.gdpScore / 600);
        const footstepPitch = 110 + this.economyTone.worldTier * 20 + this.economyTone.gdpScore * 0.6;
        this.playNoise({ duration: 0.06, volume: 0.018 + wealthLift * 0.15, highpass: 380 });
        this.playTone({ frequency: footstepPitch, duration: 0.03, type: "triangle", volume: 0.03 + wealthLift });
        if (this.economyTone.worldTier >= 1) {
          this.playTone({
            frequency: 620 + this.economyTone.worldTier * 80,
            duration: 0.018,
            type: "sine",
            volume: 0.012 + wealthLift * 0.5,
          });
        }
        break;
      }
      case "ui-confirm":
        this.playTone({ frequency: 523.25, duration: 0.06, type: "square", volume: 0.07 });
        this.playTone({ frequency: 783.99, duration: 0.08, type: "triangle", volume: 0.05 });
        break;
      case "coin-transfer":
        this.playTone({ frequency: 659.25, duration: 0.06, type: "square", volume: 0.08 });
        this.playTone({ frequency: 987.77, duration: 0.08, type: "triangle", volume: 0.06 });
        this.playTone({ frequency: 1318.51, duration: 0.1, type: "sine", volume: 0.045 });
        break;
      case "tax-collect":
        this.playTone({ frequency: 329.63, duration: 0.08, type: "triangle", volume: 0.06 });
        this.playTone({ frequency: 493.88, duration: 0.12, type: "square", volume: 0.045 });
        break;
      case "governance-vote":
        this.playTone({ frequency: 261.63, duration: 0.08, type: "triangle", volume: 0.05 });
        this.playTone({ frequency: 392, duration: 0.12, type: "triangle", volume: 0.045 });
        break;
      case "rule-update":
        this.playTone({ frequency: 440, duration: 0.1, type: "triangle", volume: 0.06 });
        this.playTone({ frequency: 659.25, duration: 0.18, type: "sawtooth", volume: 0.035 });
        break;
      case "door-open":
        this.playTone({ frequency: 196, duration: 0.08, type: "square", volume: 0.06 });
        this.playNoise({ duration: 0.05, volume: 0.015, highpass: 520 });
        break;
      case "success-chime":
        this.playTone({ frequency: 523.25, duration: 0.08, type: "triangle", volume: 0.06 });
        this.playTone({ frequency: 783.99, duration: 0.12, type: "triangle", volume: 0.05 });
        this.playTone({ frequency: 1046.5, duration: 0.16, type: "sine", volume: 0.045 });
        break;
      case "ambient":
        this.scheduleAmbientPulse();
        break;
      default:
        break;
    }
  }
}

export const bazaarAudioSystem = new BazaarAudioSystem();
