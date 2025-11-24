export class MidiManager {
  private access: WebMidi.MIDIAccess | null = null;
  private output: WebMidi.MIDIOutput | null = null;

  async init() {
    if (!('requestMIDIAccess' in navigator)) return;
    try {
      this.access = await navigator.requestMIDIAccess();
      this.output = Array.from(this.access.outputs.values())[0] ?? null;
    } catch (err) {
      console.warn('MIDI unavailable', err);
    }
  }

  sendChord(notes: number[], velocity = 0.8) {
    if (!this.output) return;
    const vel = Math.floor(velocity * 127);
    notes.forEach((note) => {
      this.output?.send([0x90, note, vel]);
    });
  }

  stopChord(notes: number[]) {
    if (!this.output) return;
    notes.forEach((note) => this.output?.send([0x80, note, 0]));
  }
}

declare global {
  interface Navigator {
    requestMIDIAccess?: () => Promise<WebMidi.MIDIAccess>;
  }
}

// Minimal Web MIDI type surface to avoid pulling extra deps.
declare namespace WebMidi {
  interface MIDIInputMap extends Map<string, MIDIInput> {}
  interface MIDIOutputMap extends Map<string, MIDIOutput> {}

  interface MIDIAccess {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
  }

  interface MIDIOutput {
    send(data: number[]): void;
  }

  interface MIDIInput {
    onmidimessage: ((message: unknown) => void) | null;
  }
}
