/**
 * Web Audio API procedural synthesizer for mechanical switch sounds.
 * Delivers zero-latency, realistic mechanical keyboard switch acoustics
 * (AULA Greywood V3 thock, Reaper switch clack, Clicky, and Silent switches)
 * without any external audio asset dependencies.
 */

import { SwitchSoundType } from '../types/device';

class SwitchSoundEngine {
  private ctx: AudioContext | null = null;
  private volume: number = 0.6;
  private currentSwitch: SwitchSoundType = 'greywood';

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSwitch(switchType: SwitchSoundType) {
    this.currentSwitch = switchType;
  }

  public getSwitch(): SwitchSoundType {
    return this.currentSwitch;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  public playKeySound(isRelease: boolean = false) {
    if (this.currentSwitch === 'off') return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(this.ctx.destination);

    // Randomize pitch slightly for organic typing realism (+/- 5%)
    const pitchVariation = 0.95 + Math.random() * 0.1;

    switch (this.currentSwitch) {
      case 'greywood':
        // AULA Greywood V3: Deep, satisfying "thock", low resonant body, bottom-out thud
        this.playThock(now, masterGain, isRelease, pitchVariation);
        break;
      case 'reaper':
        // AULA Reaper: Creamy, medium-high pitched clack with crisp POM stem hit
        this.playClack(now, masterGain, isRelease, pitchVariation);
        break;
      case 'clicky':
        // Tactile Clicky: Sharp click bar / leaf snap followed by body resonance
        this.playClicky(now, masterGain, isRelease, pitchVariation);
        break;
      case 'silent':
        // Silent Peach: Dampened silicone pad bump, muffled air release
        this.playSilent(now, masterGain, isRelease, pitchVariation);
        break;
    }
  }

  public playMouseClick() {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(this.volume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  private playThock(now: number, dest: GainNode, isRelease: boolean, variation: number) {
    if (!this.ctx) return;
    const dur = isRelease ? 0.04 : 0.07;
    const baseFreq = (isRelease ? 220 : 130) * variation;

    // Body resonance (thud)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + dur);

    oscGain.gain.setValueAtTime(isRelease ? 0.3 : 0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(oscGain);
    oscGain.connect(dest);

    // Stem friction / housing pop noise
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800 * variation, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(isRelease ? 0.15 : 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);

    osc.start(now);
    osc.stop(now + dur);
    whiteNoise.start(now);
    whiteNoise.stop(now + dur);
  }

  private playClack(now: number, dest: GainNode, isRelease: boolean, variation: number) {
    if (!this.ctx) return;
    const dur = isRelease ? 0.035 : 0.055;
    const baseFreq = (isRelease ? 480 : 360) * variation;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 2.2, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + dur);

    oscGain.gain.setValueAtTime(isRelease ? 0.25 : 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(oscGain);
    oscGain.connect(dest);

    // Crisp high-frequency snap
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2200 * variation, now);
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(isRelease ? 0.15 : 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);

    osc.start(now);
    osc.stop(now + dur);
    whiteNoise.start(now);
    whiteNoise.stop(now + dur);
  }

  private playClicky(now: number, dest: GainNode, isRelease: boolean, variation: number) {
    if (!this.ctx) return;
    const dur = 0.03;

    // Click-leaf sharp transient
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(3200 * variation, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + dur);

    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(oscGain);
    oscGain.connect(dest);

    osc.start(now);
    osc.stop(now + dur);
  }

  private playSilent(now: number, dest: GainNode, isRelease: boolean, variation: number) {
    if (!this.ctx) return;
    const dur = 0.03;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 * variation, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + dur);

    oscGain.gain.setValueAtTime(0.18, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(dest);

    osc.start(now);
    osc.stop(now + dur);
  }
}

export const soundEngine = new SwitchSoundEngine();
