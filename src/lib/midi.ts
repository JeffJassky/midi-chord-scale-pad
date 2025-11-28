export class MidiManager {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;

  async init() {
    const requestMIDIAccess = navigator.requestMIDIAccess?.bind(navigator);
    if (!requestMIDIAccess) return;

    try {
      const access = await requestMIDIAccess();
      this.access = access;
      this.output = Array.from(access.outputs.values())[0] ?? null;
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
