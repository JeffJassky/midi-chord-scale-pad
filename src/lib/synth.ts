import * as Tone from 'tone';
type OscType = Tone.ToneOscillatorType;

export type PatchId =
  | 'warm-saw'
  | 'bright-square'
  | 'soft-sine'
  | 'airy-triangle'
  | 'piano'
  | 'silky-pad'
  | 'glass-bell'
  | 'plucked-mallet'
  | 'analog-brass'
  | 'lofi-keys';

interface SynthPatch {
  oscType: OscType;
  filterFreq: number;
  filterQ: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
}

const PATCHES: Record<PatchId, SynthPatch> = {
  'warm-saw': {
    oscType: 'sawtooth',
    filterFreq: 1800,
    filterQ: 0.7,
    attack: 0.01,
    decay: 0.18,
    sustain: 0.55,
    release: 0.35,
    volume: -8
  },
  'bright-square': {
    oscType: 'square',
    filterFreq: 2400,
    filterQ: 0.6,
    attack: 0.005,
    decay: 0.16,
    sustain: 0.6,
    release: 0.28,
    volume: -10
  },
  'soft-sine': {
    oscType: 'sine',
    filterFreq: 1400,
    filterQ: 0.9,
    attack: 0.02,
    decay: 0.22,
    sustain: 0.7,
    release: 0.35,
    volume: -6
  },
  'airy-triangle': {
    oscType: 'triangle',
    filterFreq: 2000,
    filterQ: 1.1,
    attack: 0.012,
    decay: 0.2,
    sustain: 0.58,
    release: 0.32,
    volume: -9
  },
  piano: {
    oscType: 'triangle',
    filterFreq: 2400,
    filterQ: 0.3,
    attack: 0.002,
    decay: 0.28,
    sustain: 0.08,
    release: 0.6,
    volume: -8
  },
  'silky-pad': {
    oscType: 'sawtooth',
    filterFreq: 1400,
    filterQ: 1.4,
    attack: 0.18,
    decay: 0.42,
    sustain: 0.7,
    release: 0.9,
    volume: -12
  },
  'glass-bell': {
    oscType: 'sine',
    filterFreq: 3200,
    filterQ: 0.2,
    attack: 0.01,
    decay: 0.5,
    sustain: 0.4,
    release: 0.7,
    volume: -8
  },
  'plucked-mallet': {
    oscType: 'triangle',
    filterFreq: 2600,
    filterQ: 0.5,
    attack: 0.002,
    decay: 0.24,
    sustain: 0.1,
    release: 0.35,
    volume: -6
  },
  'analog-brass': {
    oscType: 'sawtooth',
    filterFreq: 1800,
    filterQ: 1.2,
    attack: 0.04,
    decay: 0.2,
    sustain: 0.65,
    release: 0.4,
    volume: -9
  },
  'lofi-keys': {
    oscType: 'square',
    filterFreq: 1100,
    filterQ: 0.9,
    attack: 0.03,
    decay: 0.18,
    sustain: 0.6,
    release: 0.5,
    volume: -11
  }
};

export class Synth {
  private synth: Tone.PolySynth | null = null;
  private filter: Tone.Filter | null = null;
  private volume: Tone.Volume | null = null;
  private currentPatch: SynthPatch = PATCHES['warm-saw'];

  playChord(notes: number[], velocity = 0.9) {
    this.ensureSynth();
    if (!this.synth) return;
    const noteNames = this.toNoteNames(notes);
    this.synth.triggerAttack(noteNames, undefined, velocity);
  }

  stopChord(notes?: number[]) {
    if (!this.synth) return;
    if (notes && notes.length) {
      this.synth.triggerRelease(this.toNoteNames(notes));
    } else {
      this.synth.releaseAll();
    }
  }

  setPatch(id: PatchId) {
    this.currentPatch = PATCHES[id] ?? PATCHES['warm-saw'];
    this.rebuildSynth();
  }

  private ensureSynth() {
    if (!this.synth) {
      this.buildSynth();
    }
    void Tone.start();
  }

  private rebuildSynth() {
    this.disposeSynth();
    this.buildSynth();
  }

  private buildSynth() {
    const patch = this.currentPatch;
    this.volume = new Tone.Volume(patch.volume).toDestination();
    this.filter = new Tone.Filter(patch.filterFreq, 'lowpass');
    this.filter.Q.value = patch.filterQ;
    this.filter.connect(this.volume);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: patch.oscType } as Tone.SynthOptions['oscillator'],
      envelope: {
        attack: patch.attack,
        decay: patch.decay,
        sustain: patch.sustain,
        release: patch.release
      }
    });
    this.synth.connect(this.filter);
  }

  private disposeSynth() {
    this.synth?.disconnect();
    this.synth?.dispose();
    this.filter?.dispose();
    this.volume?.dispose();
    this.synth = null;
    this.filter = null;
    this.volume = null;
  }

  private toNoteNames(notes: number[]) {
    return notes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
  }
}
