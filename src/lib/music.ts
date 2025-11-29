export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type ScaleType =
  | 'Major'
  | 'Natural Minor'
  | 'Dorian'
  | 'Mixolydian'
  | 'Lydian'
  | 'Phrygian'
  | 'Aeolian'
  | 'Locrian';

export interface NoteDetail {
  name: NoteName;
  midi: number;
  degree: number; // 1-7
}

export interface Scale {
  root: NoteName;
  type: ScaleType;
  notes: NoteDetail[]; // length 7
}

export type ChordQualityId =
  | 'major'
  | 'minor'
  | 'maj7'
  | 'min7'
  | 'dom7'
  | 'dim'
  | 'sus2'
  | 'sus4';

export interface ChordQuality {
  id: ChordQualityId;
  label: string;
  steps: number[]; // diatonic offsets from degree root
  seventhOffset?: number; // preferred seventh when extensions add it
}

export interface BuiltChord {
  name: string;
  notes: NoteDetail[];
  midi: number[];
}

export const DEGREE_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

export const NOTE_NAMES: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  Major: [2, 2, 1, 2, 2, 2, 1],
  'Natural Minor': [2, 1, 2, 2, 1, 2, 2],
  Dorian: [2, 1, 2, 2, 2, 1, 2],
  Mixolydian: [2, 2, 1, 2, 2, 1, 2],
  Lydian: [2, 2, 2, 1, 2, 2, 1],
  Phrygian: [1, 2, 2, 2, 1, 2, 2],
  Aeolian: [2, 1, 2, 2, 1, 2, 2],
  Locrian: [1, 2, 2, 1, 2, 2, 2]
};

export const CHORD_QUALITIES: ChordQuality[] = [
  { id: 'maj7', label: 'Maj7', steps: [0, 2, 4, 6], seventhOffset: 6 },
  { id: 'major', label: 'Major', steps: [0, 2, 4], seventhOffset: 6 },
  { id: 'dom7', label: 'Dom7', steps: [0, 2, 4, 5], seventhOffset: 5 },
  { id: 'sus4', label: 'Sus4', steps: [0, 3, 4], seventhOffset: 5 },
  { id: 'min7', label: 'Min7', steps: [0, 1, 4, 5], seventhOffset: 5 },
  { id: 'minor', label: 'Minor', steps: [0, 1, 4], seventhOffset: 5 },
  { id: 'dim', label: 'Dim', steps: [0, 1, 3], seventhOffset: 5 },
  { id: 'sus2', label: 'Sus2', steps: [0, 1, 4], seventhOffset: 5 }
];

export const CHORD_WHEEL_ORDER: ChordQualityId[] = [
  'maj7',
  'major',
  'dom7',
  'sus4',
  'min7',
  'minor',
  'dim',
  'sus2'
];

const QUALITY_LOOKUP = new Map<ChordQualityId, ChordQuality>(
  CHORD_QUALITIES.map((q) => [q.id, q])
);

const BASE_OCTAVE = 4; // middle C octave anchor for scale root

export function buildScale(root: NoteName, type: ScaleType): Scale {
  const intervals = SCALE_INTERVALS[type];
  const rootIndex = NOTE_NAMES.indexOf(root);
  const rootMidi = noteNameToMidi(root, BASE_OCTAVE);
  const notes: NoteDetail[] = [
    { name: root, midi: rootMidi, degree: 1 }
  ];

  let semitoneTotal = 0;
  for (let i = 0; i < intervals.length - 1; i++) {
    semitoneTotal += intervals[i];
    const midi = rootMidi + semitoneTotal;
    const name = NOTE_NAMES[(rootIndex + semitoneTotal) % 12];
    notes.push({ name, midi, degree: i + 2 });
  }

  return { root, type, notes };
}

export function buildChord(
  scale: Scale,
  degreeIndex: number,
  qualityId: ChordQualityId,
  extensionLevel: number
): BuiltChord {
  const quality = QUALITY_LOOKUP.get(qualityId);
  if (!quality) throw new Error('Unknown quality');

  const offsets = new Set<number>(quality.steps);

  if (extensionLevel >= 2 && !quality.steps.some((s) => s >= 5)) {
    const seventh = quality.seventhOffset ?? 5;
    offsets.add(seventh);
  }
  if (extensionLevel >= 3) offsets.add(8);
  if (extensionLevel >= 4) offsets.add(10);
  if (extensionLevel >= 5) offsets.add(12);

  const ordered = Array.from(offsets).sort((a, b) => a - b);
  const notes = ordered.map((offset) => getScaleNoteAt(scale, degreeIndex, offset));
  const midi = notes.map((n) => n.midi);
  const name = formatChordName(scale.notes[degreeIndex % 7].name, quality.label, extensionLevel);

  return { name, notes, midi };
}

export function noteNameToMidi(name: NoteName, octave: number): number {
  const semitone = NOTE_NAMES.indexOf(name);
  return semitone + 12 * (octave + 1);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getScaleNoteAt(scale: Scale, degreeIndex: number, offset: number): NoteDetail {
  const idx = (degreeIndex + offset) % scale.notes.length;
  const octaveLift = Math.floor((degreeIndex + offset) / scale.notes.length);
  const base = scale.notes[idx];
  return {
    name: base.name,
    degree: ((base.degree - 1 + offset) % 7) + 1,
    midi: base.midi + 12 * octaveLift
  };
}

function formatChordName(root: NoteName, qualityLabel: string, level: number): string {
  const extSuffix = (() => {
    if (level === 3) return ' add9';
    if (level === 4) return ' add9/11';
    if (level === 5) return ' add9/11/13';
    return '';
  })();
  const hasSeventhInLabel = qualityLabel.includes('7');
  const seventhText = level === 2 && !hasSeventhInLabel ? '7' : '';
  return `${root} ${qualityLabel}${seventhText}${extSuffix}`.trim();
}
