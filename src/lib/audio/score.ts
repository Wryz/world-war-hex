// The authored-music format and the compiler that turns it into per-step events for the scheduler.
//
// Notation used by the track data:
//  - Notes: space-separated `pitch:beats` tokens, e.g. "D5:0.75 D5:0.25 A4:1". `r` is a rest,
//    `C4+E4+G4:2` plays a chord, a trailing `>` accents the note and beats may be fractions ("1/3").
//    `|` bar lines are optional and only checked to catch authoring mistakes.
//  - Chords: one bar per `|`, several chords in a bar split it evenly, e.g. "Dm | Bb | Gm C | A".
//  - Patterns are written on a 16th-note grid (one character per step, spaces ignored):
//    chord parts use X/x/o for loud/normal/soft hits, `-` to hold and `.` for silence;
//    pattern parts use digits for chord tones (0 = root, 1 = third, 2 = fifth, 3 = octave...);
//    drum parts use X/x/o hits, `r`/`R` for a two-stroke roll and `-` to hold (for swells).

import type { InstrumentName } from './instruments';

export type Layer = 0 | 1 | 2;

const STEPS_PER_BEAT = 4;
const EPSILON = 1e-6;

interface PartBase {
  instrument: InstrumentName;
  gain: number;
  layer?: Layer;    // Lowest battle intensity the part plays at (default 0)
  maxLayer?: Layer; // Highest battle intensity the part plays at (default 2)
  pan?: number;
  reverb?: number;  // Reverb send, 0..1
  echo?: number;    // Tempo-synced echo send, 0..1
}

// An authored line of notes, repeated to fill the section
export interface NotesPart extends PartBase {
  kind: 'notes';
  notes: string;
  octave?: number;  // Octaves to transpose by
  harmony?: boolean; // Plays the nearest chord tone at least a minor third below each note instead
  legato?: number;  // Fraction of each note's length that is held (default 0.95)
}

// Chords voiced around `centre`, hit on a rhythm or sustained from one chord change to the next
export interface ChordsPart extends PartBase {
  kind: 'chords';
  rhythm: string;   // A hit pattern, or 'sustain' to hold each chord until it changes
  centre: string;
  bass?: boolean;   // Adds the root an octave below the voicing
  legato?: number;
}

// Chord tones played on a rhythm (arpeggios, ostinatos and bass lines)
export interface PatternPart extends PartBase {
  kind: 'pattern';
  pattern: string;
  register: string; // Lowest note the root may sit on; it is placed within the octave above
  legato?: number;
}

export interface DrumPart extends PartBase {
  kind: 'drums';
  pattern: string;
  pitch?: string;   // For tuned drums such as timpani
}

export type PartDef = NotesPart | ChordsPart | PatternPart | DrumPart;

export interface SectionDef {
  bars: number;
  chords?: string;
  parts: PartDef[];
}

export interface TrackDef {
  bpm: number;
  beatsPerBar?: number;
  level: number;          // Overall level of the track in the mix
  sections: Record<string, SectionDef>;
  form: string[];         // Order the sections play in
  loopFrom?: number;      // Index in `form` to loop back to; one-shot stingers leave it out
  echoBeats?: number;     // Echo delay time (default a dotted eighth)
  respondsToIntensity?: boolean;
}

export interface ScoreEvent {
  part: PartDef;
  midis: number[];
  offset: number;   // Beats after the start of its step
  duration: number; // Beats
  velocity: number;
}

export interface CompiledTrack {
  def: TrackDef;
  secondsPerBeat: number;
  secondsPerStep: number;
  form: ScoreEvent[][][]; // [position in form][step] -> events starting in that step
  loopFrom: number | null;
  parts: PartDef[];
  duration: number;       // Seconds for one pass through the form
}

// ---- Parsing ----

const NOTE_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const warn = (message: string) => console.warn(`[music] ${message}`);

const parsePitchClass = (letter: string, accidental: string | undefined) =>
  (NOTE_CLASSES[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + 12) % 12;

export const parsePitch = (name: string): number => {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Unknown pitch "${name}"`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return NOTE_CLASSES[match[1]] + accidental + (Number(match[3]) + 1) * 12;
};

const parseBeats = (text: string): number => {
  const [numerator, denominator] = text.split('/').map(Number);
  const beats = denominator ? numerator / denominator : numerator;
  if (!(beats > 0)) throw new Error(`Bad duration "${text}"`);
  return beats;
};

interface Chord {
  root: number; // Pitch class
  intervals: number[];
}

const CHORD_QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14]
};

const sameChord = (a: Chord | null, b: Chord | null) =>
  !!a && !!b && a.root === b.root && a.intervals === b.intervals;

const parseChord = (symbol: string): Chord => {
  const match = /^([A-G])(#|b)?(.*)$/.exec(symbol);
  const intervals = match ? CHORD_QUALITIES[match[3]] : undefined;
  if (!match || !intervals) throw new Error(`Unknown chord "${symbol}"`);
  return { root: parsePitchClass(match[1], match[2]), intervals };
};

interface PhraseNote {
  start: number;
  duration: number;
  midis: number[];
  accent: boolean;
}

const parsePhrase = (text: string, beatsPerBar: number, label: string) => {
  const notes: PhraseNote[] = [];
  let beat = 0;
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token === '|') {
      if (Math.abs(beat / beatsPerBar - Math.round(beat / beatsPerBar)) > EPSILON) {
        warn(`${label}: bar line falls on beat ${beat}`);
      }
      continue;
    }
    const match = /^([^:]+):([\d./]+)(>?)$/.exec(token);
    if (!match) throw new Error(`${label}: cannot read "${token}"`);
    const duration = parseBeats(match[2]);
    if (match[1] !== 'r') {
      notes.push({ start: beat, duration, midis: match[1].split('+').map(parsePitch), accent: match[3] === '>' });
    }
    beat += duration;
  }
  return { notes, length: beat };
};

const cleanPattern = (pattern: string) => pattern.replace(/[\s|]/g, '');

// The chord sounding at each step of a section
const chordTimeline = (text: string | undefined, bars: number, stepsPerBar: number): (Chord | null)[] => {
  const steps: (Chord | null)[] = [];
  const barSymbols = text ? text.split('|').map(bar => bar.trim().split(/\s+/).filter(Boolean)) : [];
  for (let bar = 0; bar < bars; bar++) {
    const symbols = barSymbols.length ? barSymbols[bar % barSymbols.length] : [];
    const chords = symbols.map(parseChord);
    for (let step = 0; step < stepsPerBar; step++) {
      steps.push(chords.length ? chords[Math.floor((step * chords.length) / stepsPerBar)] : null);
    }
  }
  return steps;
};

// Close voicing with every chord tone within half an octave of the centre
const voiceChord = (chord: Chord, centre: number, bass: boolean): number[] => {
  const notes = chord.intervals.map(interval => {
    const pitchClass = (chord.root + interval) % 12;
    return centre - 6 + ((pitchClass - (centre - 6)) % 12 + 12) % 12;
  });
  notes.sort((a, b) => a - b);
  if (bass) notes.unshift(centre - 18 + ((chord.root - (centre - 18)) % 12 + 12) % 12);
  return notes;
};

// Chord tone `index` counted upwards from the root placed just above `register`
const chordTone = (chord: Chord, register: number, index: number): number => {
  const root = register + ((chord.root - register) % 12 + 12) % 12;
  const count = chord.intervals.length;
  return root + chord.intervals[index % count] + 12 * Math.floor(index / count);
};

// A harmony voice under a melody note: the nearest chord tone at least a minor third below
const harmonise = (midi: number, chord: Chord | null): number => {
  if (!chord) return midi - 12;
  const pitchClasses = chord.intervals.map(interval => (chord.root + interval) % 12);
  for (let candidate = midi - 3; candidate > midi - 12; candidate--) {
    if (pitchClasses.includes(candidate % 12)) return candidate;
  }
  return midi - 12;
};

const HIT_VELOCITY: Record<string, number> = { o: 0.4, x: 0.7, X: 1, r: 0.45, R: 0.8 };

// Downbeats lean harder than off-beats so patterns groove rather than drone
const grooveVelocity = (step: number) => (step % 4 === 0 ? 0.9 : step % 2 === 0 ? 0.74 : 0.62);

// Number of steps a hit lasts: itself plus any `-` holds after it
const holdLength = (pattern: string, step: number, totalSteps: number) => {
  let end = step + 1;
  while (end < totalSteps && pattern[end % pattern.length] === '-') end++;
  return end - step;
};

// ---- Compiling ----

const compileSection = (track: TrackDef, section: SectionDef, name: string): ScoreEvent[][] => {
  const beatsPerBar = track.beatsPerBar ?? 4;
  const stepsPerBar = beatsPerBar * STEPS_PER_BEAT;
  const totalSteps = section.bars * stepsPerBar;
  const totalBeats = section.bars * beatsPerBar;
  const steps: ScoreEvent[][] = Array.from({ length: totalSteps }, () => []);
  const chords = chordTimeline(section.chords, section.bars, stepsPerBar);

  const add = (part: PartDef, beat: number, duration: number, midis: number[], velocity: number) => {
    const step = Math.floor(beat * STEPS_PER_BEAT + EPSILON);
    if (step >= totalSteps) return;
    steps[step].push({ part, midis, offset: beat - step / STEPS_PER_BEAT, duration, velocity });
  };

  section.parts.forEach((part, index) => {
    const label = `${name} part ${index} (${part.instrument})`;

    if (part.kind === 'notes') {
      const phrase = parsePhrase(part.notes, beatsPerBar, label);
      if (Math.abs(totalBeats / phrase.length - Math.round(totalBeats / phrase.length)) > EPSILON) {
        warn(`${label}: phrase of ${phrase.length} beats does not fit a ${totalBeats}-beat section`);
      }
      const transpose = (part.octave ?? 0) * 12;
      for (let start = 0; start < totalBeats - EPSILON; start += phrase.length) {
        for (const note of phrase.notes) {
          const beat = start + note.start;
          const chord = chords[Math.floor(beat * STEPS_PER_BEAT + EPSILON)] ?? null;
          const midis = note.midis.map(midi => (part.harmony ? harmonise(midi + transpose, chord) : midi + transpose));
          add(part, beat, note.duration * (part.legato ?? 0.95), midis, note.accent ? 1 : 0.8);
        }
      }
      return;
    }

    if (part.kind === 'chords' && part.rhythm === 'sustain') {
      const centre = parsePitch(part.centre);
      for (let step = 0; step < totalSteps; step++) {
        const chord = chords[step];
        if (!chord || (step > 0 && sameChord(chords[step - 1], chord))) continue;
        let end = step + 1;
        while (end < totalSteps && sameChord(chords[end], chord)) end++;
        add(part, step / STEPS_PER_BEAT, (end - step) / STEPS_PER_BEAT, voiceChord(chord, centre, !!part.bass), 0.8);
      }
      return;
    }

    const pattern = cleanPattern(part.kind === 'chords' ? part.rhythm : part.pattern);
    if (totalSteps % pattern.length !== 0) warn(`${label}: pattern of ${pattern.length} steps does not fit the section`);

    for (let step = 0; step < totalSteps; step++) {
      const symbol = pattern[step % pattern.length];
      const beat = step / STEPS_PER_BEAT;
      const length = holdLength(pattern, step, totalSteps) / STEPS_PER_BEAT;
      const chord = chords[step];

      if (part.kind === 'drums') {
        const velocity = HIT_VELOCITY[symbol];
        if (velocity === undefined) continue;
        const midis = [part.pitch ? parsePitch(part.pitch) : 60];
        add(part, beat, length, midis, velocity);
        if (symbol === 'r' || symbol === 'R') add(part, beat + 1 / 8, 1 / 8, midis, velocity * 0.85);
      } else if (part.kind === 'chords') {
        const velocity = HIT_VELOCITY[symbol];
        if (velocity === undefined || !chord) continue;
        add(part, beat, length * (part.legato ?? 0.9), voiceChord(chord, parsePitch(part.centre), !!part.bass), velocity);
      } else if (/\d/.test(symbol) && chord) {
        const midi = chordTone(chord, parsePitch(part.register), Number(symbol));
        add(part, beat, length * (part.legato ?? 0.9), [midi], grooveVelocity(step));
      }
    }
  });

  return steps;
};

export const compileTrack = (def: TrackDef, name: string): CompiledTrack => {
  const compiled = new Map<string, ScoreEvent[][]>();
  const parts = new Set<PartDef>();
  const secondsPerBeat = 60 / def.bpm;
  let beats = 0;

  const form = def.form.map(sectionName => {
    const section = def.sections[sectionName];
    if (!section) throw new Error(`${name}: unknown section "${sectionName}"`);
    section.parts.forEach(part => parts.add(part));
    beats += section.bars * (def.beatsPerBar ?? 4);
    let steps = compiled.get(sectionName);
    if (!steps) {
      steps = compileSection(def, section, `${name}.${sectionName}`);
      compiled.set(sectionName, steps);
    }
    return steps;
  });

  return {
    def,
    secondsPerBeat,
    secondsPerStep: secondsPerBeat / STEPS_PER_BEAT,
    form,
    loopFrom: def.loopFrom ?? null,
    parts: [...parts],
    duration: beats * secondsPerBeat
  };
};
