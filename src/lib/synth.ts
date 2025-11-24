import { midiToFreq } from './music';

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  releaseTimer?: number;
}

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<number, Voice>();

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  playChord(notes: number[], velocity = 0.9) {
    this.ensureCtx();
    notes.forEach((midi) => this.triggerVoice(midi, velocity));
  }

  stopChord(notes?: number[]) {
    if (!this.ctx) return;
    if (notes && notes.length) {
      notes.forEach((midi) => this.releaseVoice(midi));
    } else {
      Array.from(this.voices.keys()).forEach((midi) => this.releaseVoice(midi));
    }
  }

  private triggerVoice(midi: number, velocity: number) {
    if (!this.ctx || !this.master) return;
    this.releaseVoice(midi);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.detune.value = -10;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8 * velocity, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.55 * velocity, this.ctx.currentTime + 0.2);

    osc.frequency.value = midiToFreq(midi);
    sub.frequency.value = midiToFreq(midi) / 2;

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start();
    sub.start();

    this.voices.set(midi, { osc, gain, filter });
  }

  private releaseVoice(midi: number) {
    if (!this.ctx) return;
    const voice = this.voices.get(midi);
    if (!voice) return;

    if (voice.releaseTimer) {
      window.clearTimeout(voice.releaseTimer);
    }

    const { gain, osc, filter } = voice;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    voice.releaseTimer = window.setTimeout(() => {
      osc.stop();
      gain.disconnect();
      filter.disconnect();
      if (this.voices.get(midi) === voice) {
        this.voices.delete(midi);
      }
    }, 400);
  }
}
