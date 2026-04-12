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

type FootstepSurface = "grass" | "stone" | "plaza" | "wood";

type SpatialMix = {
  surface?: FootstepSurface;
  laborRoutingCount?: number;
  crowdChatter?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveFootstepSurfaceProfile(surface: FootstepSurface, economyTone: { gdpScore: number; worldTier: number }) {
  switch (surface) {
    case "stone":
      return {
        pitchOffset: 20 + economyTone.worldTier * 4,
        noiseHighpass: 560,
        clinkVolume: 0.018,
      };
    case "plaza":
      return {
        pitchOffset: 11 + economyTone.worldTier * 3,
        noiseHighpass: 470,
        clinkVolume: 0.012,
      };
    case "wood":
      return {
        pitchOffset: 6,
        noiseHighpass: 330,
        clinkVolume: 0.008,
      };
    case "grass":
    default:
      return {
        pitchOffset: -8,
        noiseHighpass: 290,
        clinkVolume: 0,
      };
  }
}

class BazaarAudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientInterval: number | null = null;
  private ambientRequested = false;
  private gestureUnlocked = false;
  private muted = false;
  private lastFootstepAt = 0;
  private surfaceProfile: FootstepSurface = "grass";
  private laborRoutingCount = 0;
  private crowdChatter = 0;
  private economyTone = {
    gdpScore: 0,
    worldTier: 0,
  };

  private resetContext() {
    this.context = null;
    this.masterGain = null;
  }

  private ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.context?.state === "closed") {
      this.resetContext();
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
      void this.context.resume().catch(() => {
        if (this.context?.state === "closed") {
          this.resetContext();
        }
      });
    }

    return this.context;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context?.state === "closed") {
      this.resetContext();
      return;
    }

    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.12, this.context?.currentTime ?? 0);
    }
  }

  unlock() {
    this.gestureUnlocked = true;
    this.ensureContext();
    if (this.ambientRequested) {
      this.startAmbient();
    }
  }

  setEconomyTone(gdpScore: number, worldTier: number) {
    this.economyTone = {
      gdpScore,
      worldTier,
    };
  }

  setSpatialMix(mix: SpatialMix) {
    if (mix.surface) {
      this.surfaceProfile = mix.surface;
    }

    if (typeof mix.laborRoutingCount === "number") {
      this.laborRoutingCount = Math.max(0, mix.laborRoutingCount);
    }

    if (typeof mix.crowdChatter === "number") {
      this.crowdChatter = clamp(mix.crowdChatter, 0, 1);
    }
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
    const routingLift = clamp(this.laborRoutingCount / 12, 0, 1);
    const chatterLift = clamp(this.crowdChatter + routingLift * 0.65, 0, 1);
    const tones = [
      {
        frequency: 196,
        duration: 0.72,
        type: "triangle" as OscillatorType,
        volume: 0.025 + routingLift * 0.01,
      },
      {
        frequency: 293.66,
        duration: 0.48,
        type: "sine" as OscillatorType,
        volume: 0.018 + chatterLift * 0.015,
        detune: 7,
      },
      {
        frequency: 392,
        duration: 0.28,
        type: "triangle" as OscillatorType,
        volume: 0.015 + routingLift * 0.006,
      },
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

    if (chatterLift > 0.05) {
      this.playNoise({
        duration: 0.14,
        volume: 0.006 + chatterLift * 0.02,
        highpass: 720 - Math.floor(chatterLift * 220),
      });
    }
  }

  startAmbient() {
    this.ambientRequested = true;
    if (!this.gestureUnlocked) {
      return;
    }

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
    this.ambientRequested = false;
    if (this.ambientInterval !== null && typeof window !== "undefined") {
      window.clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }

  teardown() {
    this.stopAmbient();
    if (!this.context) {
      this.resetContext();
      return;
    }

    if (this.context.state === "closed") {
      this.resetContext();
      return;
    }

    void this.context.close().catch(() => {
      // Ignore teardown races during fast refresh or Strict Mode remounts.
    }).finally(() => {
      this.resetContext();
    });
  }

  play(cue: SoundCue, mix?: SpatialMix) {
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
        const resolvedSurface = mix?.surface ?? this.surfaceProfile;
        const profile = resolveFootstepSurfaceProfile(resolvedSurface, this.economyTone);
        const wealthLift = clamp(this.economyTone.gdpScore / 60000, 0, 0.12);
        const footstepPitch = 110 + this.economyTone.worldTier * 18 + this.economyTone.gdpScore * 0.0009 + profile.pitchOffset;
        this.playNoise({ duration: 0.06, volume: 0.016 + wealthLift * 0.12, highpass: profile.noiseHighpass });
        this.playTone({
          frequency: footstepPitch,
          duration: 0.03,
          type: "triangle",
          volume: 0.028 + wealthLift * 0.55,
        });
        if (profile.clinkVolume > 0 || this.economyTone.worldTier >= 1) {
          this.playTone({
            frequency: 620 + this.economyTone.worldTier * 80 + profile.pitchOffset * 2,
            duration: 0.018,
            type: "sine",
            volume: profile.clinkVolume + wealthLift * 0.34,
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
