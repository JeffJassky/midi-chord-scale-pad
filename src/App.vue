<template>
  <main class="page">
    <header class="hero">
      <p class="eyebrow">No Wrong Notes</p>
      <h1>Explore scale-locked chords</h1>
      <p class="lede">
        Select your key, scale, chord quality and extensions, Hover the wheel to
        choose a quality. Everything stays diatonic.
      </p>
    </header>

    <section class="control-card selectors-card">
      <div class="selectors">
        <label>
          <span>Key</span>
          <select v-model="scaleRoot">
            <option v-for="note in NOTE_NAMES" :key="note" :value="note">
              {{ note }}
            </option>
          </select>
        </label>
        <label>
          <span>Mode</span>
          <select v-model="scaleType">
            <option v-for="mode in scaleTypes" :key="mode" :value="mode">
              {{ mode }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <section class="status">
      <p class="label">Now playing</p>
      <p class="value">{{ lastChordName }}</p>
      <p class="meta">
        {{ scaleRoot }} · {{ scaleType }} · {{ currentQuality.label }} ·
        {{ extensionName(extensionLevel) }}
      </p>
      <div class="patch-picker">
        <label>
          <span>Sound</span>
          <select v-model="selectedPatch">
            <option
              v-for="option in patchOptions"
              :key="option.id"
              :value="option.id"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
      <div class="mini-piano" aria-label="virtual keyboard (one octave)">
        <div class="white-keys">
          <div
            v-for="note in WHITE_KEYS"
            :key="note"
            class="white-key"
            :class="{ active: activeMidiNotes.has(note) }"
            @pointerdown="pressPianoNote(note)"
            @pointerup="releasePianoNote(note)"
            @pointerleave="releasePianoNote(note)"
          >
            <span>{{ note }}</span>
          </div>
        </div>
        <div class="black-keys">
          <div
            v-for="(note, idx) in BLACK_KEYS"
            :key="note"
            class="black-key"
            :class="{ active: activeMidiNotes.has(note) }"
            :style="{ left: blackKeyLeft(idx) }"
            @pointerdown.stop="pressPianoNote(note)"
            @pointerup.stop="releasePianoNote(note)"
            @pointerleave.stop="releasePianoNote(note)"
          >
            <span>{{ note }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="wheel-card">
      <div
        class="wheel"
        ref="wheelRef"
        :style="wheelStyle"
        @pointermove="onWheelMove"
        @pointerenter="onWheelMove"
        @pointerleave="onWheelLeave"
        @pointerdown="lockQuality"
      >
        <div class="wheel-overlay"></div>
        <div
          v-for="(qualityId, idx) in CHORD_WHEEL_ORDER"
          :key="qualityId"
          class="slice"
          :style="sliceStyle(idx)"
          :class="{
            active: currentQuality.id === qualityId,
            locked: lockedQualityId === qualityId
          }"
        >
          <span>{{ qualityLabel(qualityId) }}</span>
        </div>
        <div class="wheel-center">
          <p class="muted">Chord quality</p>
          <p class="big">{{ currentQuality.label }}</p>
          <button
            v-if="lockedQualityId"
            class="ghost"
            @click.stop="unlockQuality"
          >
            Unlock
          </button>
          <button v-else class="ghost" @click.stop="lockQuality">Lock</button>
        </div>
      </div>
      <div class="wheel-help">
        <p class="muted">
          Hover to select · Click to lock · Esc to reset · Mouse position maps
          to the 8 chord qualities.
        </p>
      </div>
    </section>

    <section class="keyboard-card">
      <p class="label">Play Full Chords</p>
      <div class="keyboard">
        <button
          v-for="(label, idx) in degreeLabels"
          :key="label + idx"
          class="key"
          :class="{ active: activeDegree === idx }"
          @pointerdown.prevent="triggerChord(idx)"
          @pointerup="releaseChord(idx)"
          @pointerleave="releaseChord(idx)"
          @pointercancel="releaseChord(idx)"
        >
          <span class="note">{{ label }} {{ currentQuality.label }}</span>
          <span class="degree">
            {{ idx === 0 ? 'root' : idx === degreeLabels.length - 1 ? 'octave' : idx + 1 }}
          </span>
        </button>
      </div>
      <div class="info">
        <div>
          <p class="muted">Keyboard map</p>
          <p class="plain">
            Use keys A–K to play chords (K for octave), number keys 1–5 for
            color, Esc to clear.
          </p>
        </div>
        <div>
          <p class="muted">Sound + MIDI</p>
          <p class="plain">
            Web Audio polysynth, optional Web MIDI out when available.
          </p>
        </div>
      </div>
    </section>

    <section class="control-card extensions-card">
      <p class="muted label">Extensions (num #1–5)</p>
      <div class="extensions">
        <div class="chips">
          <button
            v-for="level in [1, 2, 3, 4, 5]"
            :key="level"
            class="chip"
            :class="{ active: extensionLevel === level }"
            @click="setExtension(level)"
          >
            <span class="chip-label">{{ extensionName(level) }}</span>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  buildChord,
  buildScale,
  CHORD_QUALITIES,
  CHORD_WHEEL_ORDER,
  DEGREE_KEYS,
  NOTE_NAMES,
  noteNameToMidi,
  type ChordQualityId,
  type NoteName,
  type ScaleType
} from './lib/music';
import { Synth, type PatchId } from './lib/synth';
import { MidiManager } from './lib/midi';

const scaleTypes: ScaleType[] = [
  'Major',
  'Natural Minor',
  'Dorian',
  'Mixolydian',
  'Lydian',
  'Phrygian',
  'Aeolian',
  'Locrian'
];

const scaleRoot = ref<NoteName>('C');
const scaleType = ref<ScaleType>('Major');
const extensionLevel = ref<number>(1);
const hoverQualityId = ref<ChordQualityId>('major');
const lockedQualityId = ref<ChordQualityId | null>(null);
const activeDegree = ref<number | null>(null);
const heldMidi = ref<number[]>([]);
const manualNotes = ref<Set<number>>(new Set());
const lastChordName = ref<string>('Ready');
const patchOptions: { id: PatchId; label: string }[] = [
  { id: 'warm-saw', label: 'Warm Saw' },
  { id: 'bright-square', label: 'Bright Square' },
  { id: 'soft-sine', label: 'Soft Sine' },
  { id: 'airy-triangle', label: 'Airy Triangle' },
  { id: 'piano', label: 'Piano' },
  { id: 'silky-pad', label: 'Silky Pad' },
  { id: 'glass-bell', label: 'Glass Bell' },
  { id: 'plucked-mallet', label: 'Plucked Mallet' },
  { id: 'analog-brass', label: 'Analog Brass' },
  { id: 'lofi-keys', label: 'Lo-Fi Keys' }
];
const selectedPatch = ref<PatchId>('warm-saw');

const synth = new Synth();
const midi = new MidiManager();
const wheelRef = ref<HTMLElement | null>(null);

const scale = computed(() => buildScale(scaleRoot.value, scaleType.value));
const degreeLabels = computed<string[]>(() => {
  const labels: string[] = scale.value.notes.map((n) => n.name);
  const root = scale.value.notes[0]?.name ?? 'Root';
  return [...labels, `${root} (octave)`];
});
const currentQualityId = computed<ChordQualityId>(() => lockedQualityId.value ?? hoverQualityId.value);
const currentQuality = computed(() => CHORD_QUALITIES.find((q) => q.id === currentQualityId.value)!);

const WHITE_KEYS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS: NoteName[] = ['C#', 'D#', 'F#', 'G#', 'A#'];
const blackOffsets = [0.67, 1.67, 3.67, 4.67, 5.67]; // relative to white key index spacing

const activeMidiNotes = computed(() => {
  const set = new Set<NoteName>();
  const pushNote = (midi: number) => {
    const note = NOTE_NAMES[midi % 12];
    set.add(note);
  };
  heldMidi.value.forEach(pushNote);
  manualNotes.value.forEach(pushNote);
  return set;
});

const slicePalette = [
  'hsla(20, 85%, 70%, 0.22)',
  'hsla(55, 80%, 72%, 0.22)',
  'hsla(95, 75%, 66%, 0.22)',
  'hsla(140, 68%, 62%, 0.22)',
  'hsla(185, 68%, 62%, 0.22)',
  'hsla(230, 70%, 68%, 0.22)',
  'hsla(275, 72%, 72%, 0.22)',
  'hsla(320, 75%, 70%, 0.22)'
];

const wheelStyle = computed(() => {
  const stops = slicePalette
    .map((color, idx) => `${color} ${idx * 45}deg ${(idx + 1) * 45}deg`)
    .join(', ');
  return {
    '--wheel-bg': `conic-gradient(from -90deg, ${stops}), radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), transparent 45%), var(--panel-strong)`
  };
});

const currentChord = computed(() => {
  if (activeDegree.value === null) return null;
  return buildChord(scale.value, activeDegree.value, currentQualityId.value, extensionLevel.value);
});

function qualityLabel(id: ChordQualityId) {
  return CHORD_QUALITIES.find((q) => q.id === id)?.label ?? id;
}

function sliceStyle(idx: number) {
  const angle = idx * 45 + 22.5; // center label within each 45deg slice
  return {
    '--angle': `${angle}deg`,
    '--slice-color': slicePalette[idx]
  };
}

function onWheelMove(event: PointerEvent) {
  if (!wheelRef.value) return;
  const rect = wheelRef.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalized = (angle + 450) % 360; // 0 at top, clockwise
  const segment = Math.floor(normalized / 45);
  hoverQualityId.value = CHORD_WHEEL_ORDER[segment];
}

function lockQuality() {
  lockedQualityId.value = hoverQualityId.value;
}

function unlockQuality() {
  lockedQualityId.value = null;
}

function onWheelLeave() {
  hoverQualityId.value = lockedQualityId.value ?? 'major';
}

function setExtension(level: number) {
  extensionLevel.value = level;
}

function extensionName(level: number) {
  const names = ['Triad', '7th', 'Add 9', '9 + 11', '9 + 11 + 13'];
  return names[level - 1] ?? `Level ${level}`;
}

function blackKeyLeft(idx: number) {
  const base = 100 / WHITE_KEYS.length;
  return `${blackOffsets[idx] * base}%`;
}

function triggerChord(degreeIndex: number) {
  if (heldMidi.value.length) {
    synth.stopChord(heldMidi.value);
    midi.stopChord(heldMidi.value);
  }
  const chord = buildChord(scale.value, degreeIndex, currentQualityId.value, extensionLevel.value);
  heldMidi.value = chord.midi;
  activeDegree.value = degreeIndex;
  lastChordName.value = chord.name;
  synth.playChord(chord.midi, 0.95);
  midi.sendChord(chord.midi, 0.95);
}

function releaseChord(degreeIndex: number) {
  if (activeDegree.value !== degreeIndex) return;
  synth.stopChord(heldMidi.value);
  midi.stopChord(heldMidi.value);
  activeDegree.value = null;
  heldMidi.value = [];
}

function pressPianoNote(note: NoteName) {
  const midiNote = noteNameToMidi(note, 4);
  if (!manualNotes.value.has(midiNote)) {
    const next = new Set(manualNotes.value);
    next.add(midiNote);
    manualNotes.value = next;
  }
  synth.playChord([midiNote], 0.9);
  midi.sendChord([midiNote], 0.9);
}

function releasePianoNote(note: NoteName) {
  const midiNote = noteNameToMidi(note, 4);
  if (manualNotes.value.has(midiNote)) {
    const next = new Set(manualNotes.value);
    next.delete(midiNote);
    manualNotes.value = next;
  }
  synth.stopChord([midiNote]);
  midi.stopChord([midiNote]);
}

function handleKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (event.repeat) return;
  const degreeIndex = DEGREE_KEYS.indexOf(key);
  if (degreeIndex !== -1) {
    event.preventDefault();
    triggerChord(degreeIndex);
    return;
  }
  if (key >= '1' && key <= '5') {
    setExtension(Number(key));
    return;
  }
  if (key === 'escape') {
    unlockQuality();
    synth.stopChord();
    midi.stopChord(heldMidi.value);
    activeDegree.value = null;
    heldMidi.value = [];
    manualNotes.value = new Set();
  }
}

function handleKeyup(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const degreeIndex = DEGREE_KEYS.indexOf(key);
  if (degreeIndex !== -1) {
    releaseChord(degreeIndex);
  }
}

watch([currentQualityId, extensionLevel, scaleRoot, scaleType], () => {
  if (activeDegree.value === null) return;
  triggerChord(activeDegree.value);
});

watch(
  selectedPatch,
  (id) => {
    synth.setPatch(id);
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
  midi.init();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keyup', handleKeyup);
  synth.stopChord();
});
</script>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 22px 64px;
  color: #fff;
  display: grid;
  gap: 24px;
  grid-template-columns: 1.6fr 1fr;
  grid-template-areas:
    'hero status'
    'selectors status'
    'wheel wheel'
    'extensions extensions'
    'keyboard keyboard';
}

.hero {
  grid-area: hero;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selectors-card {
  grid-area: selectors;
}

.eyebrow {
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 13px;
  color: var(--accent-2);
  margin: 0 0 8px;
}

button {
  cursor: pointer;
  user-select: none;
}

h1 {
  margin: 0 0 8px;
  font-size: clamp(28px, 3vw, 38px);
}

.lede {
  margin: 0;
  color: var(--muted);
}

.status {
  grid-area: status;
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 16px;
  border-radius: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status .label,
.keyboard-card .label,
.extensions-card .label {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-size: 12px;
}

.status .value {
  margin: 4px 0;
  font-size: 24px;
  font-weight: 600;
}

.status .meta {
  margin: 0;
  color: var(--muted);
}

.patch-picker {
  margin-top: 6px;
}

.mini-piano {
  position: relative;
  width: 100%;
  --white-height: clamp(72px, 20vw, 120px);
  --black-height: calc(var(--white-height) * 0.68);
  height: var(--white-height);
  margin-top: 10px;
}

.white-keys {
  display: flex;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.2);
}

.white-key {
  flex: 1;
  position: relative;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(220, 225, 240, 0.85));
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-right: 1px solid rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: clamp(4px, 1.4vw, 8px);
  color: #111;
  font-size: clamp(11px, 2vw, 13px);
  font-weight: 700;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: background 0.15s ease, transform 0.08s ease;
  touch-action: none;
  user-select: none;
  cursor: pointer;
}

.white-key.active {
  background: #ff7a59;
  color: #0c0e16;
  transform: translateY(-2px);
}

.black-keys {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.black-key {
  position: absolute;
  top: 0;
  width: calc(100% / 7 * 0.68);
  height: var(--black-height);
  background: linear-gradient(180deg, #111, #2d2d2d);
  border-radius: 0 0 6px 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: clamp(4px, 1.2vw, 8px);
  color: #e0e4ed;
  font-weight: 700;
  font-size: clamp(11px, 1.8vw, 12px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.45);
  transition: background 0.15s ease, transform 0.08s ease, color 0.1s ease;
  touch-action: none;
  pointer-events: auto;
  user-select: none;
  cursor: pointer;
}

.black-key.active {
  background: #ff7a59;
  color: #0c0e16;
  transform: translate(-50%, -2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
}

.control-card,
.wheel-card,
.keyboard-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: var(--shadow);
}

.selectors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
  font-size: 14px;
}

select {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
}

.extensions {
  margin-top: 10px;
}

.chips {
  display: flex;
  gap: 8px;
}

.chip {
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chip.active {
  background: var(--accent);
  color: #0c0e16;
  border-color: var(--accent);
}

.chip-key {
  font-weight: 700;
  opacity: 0.9;
}

.chip-label {
  color: #fff;
  opacity: 0.92;
}

.muted {
  color: var(--muted);
  margin: 6px 0 0;
}

.extensions-card {
  grid-area: extensions;
}

.wheel-card {
  grid-area: wheel;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.wheel {
  position: relative;
  --wheel-size: min(520px, 80vw);
  width: var(--wheel-size);
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--wheel-bg);
  overflow: hidden;
  border: 1px solid var(--border);
  z-index: 0;
  cursor: pointer;
}

.wheel-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 40px 70px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 2;
}

.wheel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(
    from -90deg,
    rgba(255, 255, 255, 0.22) 0deg 0.6deg,
    transparent 0.6deg 45deg
  );
  opacity: 0.4;
  pointer-events: none;
  z-index: 1;
}

.slice {
  position: absolute;
  inset: 0;
  --radius: calc(var(--wheel-size) / 2 - 36px);
  pointer-events: none;
  z-index: 3;
}

.slice span {
  display: inline-block;
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center;
  transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(-1 * var(--radius))) rotate(calc(-1 * var(--angle)));
  color: rgba(255, 255, 255, 0.88);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 13px;
  font-weight: 700;
  transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  z-index: 3;
}

.slice.active span {
  color: #0c0e16;
  background: rgba(255, 255, 255, 0.96);
  padding: 4px 10px;
  border-radius: 12px;
}

.slice.locked span {
  box-shadow: 0 0 0 1px var(--accent);
}

.wheel-center {
  position: absolute;
  inset: 24%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.5));
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  z-index: 4;
}

.big {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.ghost {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 8px 12px;
  border-radius: 10px;
}

.wheel-help {
  color: var(--muted);
  text-align: center;
}

.keyboard-card {
  grid-area: keyboard;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.keyboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.key {
  border: 1px solid var(--border);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  border-radius: 14px;
  padding: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-direction: column;
  justify-content: space-between;
  color: #fff;
  cursor: pointer;
  transition: transform 0.08s ease, border 0.15s ease, background 0.15s ease;
  touch-action: none;
  user-select: none;
}

.key:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.2);
}

.key.active {
  border-color: var(--accent);
  background: rgba(255, 122, 89, 0.18);
}

.key-label {
  font-weight: 700;
  font-size: 18px;
}

.note {
  color: #fff;
  font-size: 14px;
}

.degree {
  color: var(--muted);
}

.info {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  color: #fff;
}

.plain {
  margin: 0;
}

@media (max-width: 900px) {
  .page {
    grid-template-columns: 1fr;
    grid-template-areas:
      'hero'
      'selectors'
      'wheel'
      'extensions'
      'keyboard'
      'status';
  }

  .wheel {
    width: min(290px, 92vw);
  }
}
</style>
