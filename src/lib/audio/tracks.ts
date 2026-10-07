// The music itself: tempo, key, chords, melodies, accompaniment and drum patterns for each track
// and stinger. See score.ts for the notation.

import type { ChordsPart, DrumPart, NotesPart, PatternPart, TrackDef } from './score';

export type MusicTrack = 'menu' | 'map' | 'battle' | 'boss';
export type Stinger = 'victory' | 'defeat' | 'star' | 'unlock' | 'levelUp' | 'bossAppears';

// A single hit on the first step of a section, e.g. a crash on the downbeat
const downbeat = (bars: number, hit = 'X') => hit + '.'.repeat(bars * 16 - 1);

// One bar repeated, with a different last bar (a fill into the next section)
const withFill = (bars: number, bar: string, fill: string) => bar.repeat(bars - 1) + fill;

// ---- Menu: a heroic, welcoming march in D major ----

const MENU_THEME = `
  D5:0.75 D5:0.25 A4:1 D5:1 F#5:1 | G5:1.5 F#5:0.5 E5:1 D5:1 |
  F#5:1.5 E5:0.5 D5:1 B4:1 | C#5:1 D5:0.5 E5:0.5 A4:2 |
  D5:0.75 D5:0.25 A4:1 D5:1 F#5:1 | G5:1 A5:0.5 B5:0.5 A5:1 G5:1 |
  G5:1.5 F#5:0.5 E5:1 C#5:1 | D5:2.5 r:0.5 A4:0.5 C#5:0.5`;

const MENU_BRIDGE = `
  D5:2 B4:1 D5:1 | E5:2 C#5:1 E5:1 | F#5:1.5 E5:0.5 C#5:1 A4:1 | B4:2 D5:1 F#5:1 |
  G5:2 D5:1 B4:1 | E5:1.5 D5:0.5 C#5:1 E5:1 | G5:1.5 F#5:0.5 E5:1 B4:1 | A4:1 C#5:1 E5:1 G5:1`;

const menuPad: ChordsPart = { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'F#4', bass: true, gain: 0.8, reverb: 0.4 };
const menuBass: PatternPart = { kind: 'pattern', instrument: 'lowStrings', pattern: '0...2...0...2...', register: 'A1', legato: 0.75, gain: 0.8, reverb: 0.15 };
const menuBridgeBass: PatternPart = { ...menuBass, pattern: '0.......2.......', legato: 0.95 };
const menuOstinato: PatternPart = { kind: 'pattern', instrument: 'spiccato', pattern: '0.2.3.2.1.2.3.2.', register: 'A2', gain: 0.8, pan: -0.25, reverb: 0.25 };
const menuHarp: PatternPart = { kind: 'pattern', instrument: 'harp', pattern: '0.2.3.4.5.4.3.2.', register: 'A2', gain: 0.7, pan: 0.3, reverb: 0.4 };
const menuHorn: NotesPart = { kind: 'notes', instrument: 'horn', notes: MENU_THEME, gain: 1, reverb: 0.3, echo: 0.1 };
const menuTrumpets: NotesPart = { ...menuHorn, instrument: 'brass', gain: 0.9 };
const menuHornHarmony: NotesPart = { ...menuHorn, harmony: true, gain: 0.65, pan: 0.25, echo: 0 };
const menuBridgeStrings: NotesPart = { kind: 'notes', instrument: 'strings', notes: MENU_BRIDGE, legato: 1, gain: 1.5, reverb: 0.4 };
const menuBridgeFlute: NotesPart = { kind: 'notes', instrument: 'flute', notes: MENU_BRIDGE, gain: 0.6, pan: -0.2, reverb: 0.4, echo: 0.15 };
const menuSnare: DrumPart = { kind: 'drums', instrument: 'snare', pattern: 'x..o x.oo x..o X... x..o x.oo x..o XrX.', gain: 0.9, reverb: 0.2 };
const menuBridgeSnare: DrumPart = { ...menuSnare, pattern: withFill(8, '....o.......o...', 'x.x.x.x.rrrrRRRR') };
const menuBassDrum: DrumPart = { kind: 'drums', instrument: 'bassDrum', pattern: 'X... .... x... ....', gain: 0.6, reverb: 0.2 };
const menuTimpani: PatternPart = { kind: 'pattern', instrument: 'timpani', pattern: '0............... 0.......0...0.0.', register: 'D2', gain: 0.55, reverb: 0.35 };
const menuCrash: DrumPart = { kind: 'drums', instrument: 'crash', pattern: downbeat(8), gain: 0.8, reverb: 0.3 };

const menu: TrackDef = {
  bpm: 100,
  level: 1,
  sections: {
    intro: {
      bars: 2,
      chords: 'D | A',
      parts: [
        menuPad,
        { kind: 'notes', instrument: 'horn', notes: 'r:1 A4:0.5 A4:0.5 D5:2 | r:1 A4:0.5 A4:0.5 E5:1 C#5:1', gain: 1, reverb: 0.35 },
        { kind: 'drums', instrument: 'timpani', pitch: 'D2', pattern: 'X............... rrrrrrrrRRRRRRRR', gain: 0.5, reverb: 0.35 },
        { kind: 'drums', instrument: 'swell', pattern: '................ X---------------', gain: 0.8 }
      ]
    },
    A: {
      bars: 8,
      chords: 'D | G | Bm | A | D | G | Em A | D',
      parts: [menuPad, menuBass, menuOstinato, menuHorn, menuSnare, menuBassDrum, menuCrash]
    },
    A2: {
      bars: 8,
      chords: 'D | G | Bm | A | D | G | Em A | D',
      parts: [menuPad, menuBass, menuOstinato, menuHarp, menuTrumpets, menuHornHarmony, menuSnare, menuBassDrum, menuTimpani, menuCrash]
    },
    B: {
      bars: 8,
      chords: 'G | A | F#m | Bm | G | A | Em | A',
      parts: [menuPad, menuBridgeBass, menuHarp, menuBridgeStrings, menuBridgeFlute, menuBridgeSnare, menuBassDrum]
    }
  },
  form: ['intro', 'A', 'A2', 'B', 'A2'],
  loopFrom: 1
};

// ---- Campaign map: light and adventurous, F lydian with flute and harp ----

const MAP_THEME = `
  A5:0.5 G5:0.5 F5:0.5 G5:0.5 A5:1 C6:1 | B5:1.5 A5:0.5 G5:1 D5:1 |
  E5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 E5:1 | A5:2 r:0.5 E5:0.5 A5:0.5 B5:0.5 |
  C6:1.5 B5:0.5 A5:1 F5:1 | G5:0.5 A5:0.5 B5:0.5 D6:0.5 B5:1 G5:1 |
  A5:1 F5:0.5 A5:0.5 D6:1 C6:0.5 A5:0.5 | B5:2 G5:1 r:1`;

const MAP_BRIDGE = `
  F5:1.5 E5:0.5 D5:1 A5:1 | G5:1.5 A5:0.5 B5:1 E5:1 | A5:1 C6:1 A5:0.5 G5:0.5 F5:1 | G5:1 B5:1 D6:2 |
  F5:1.5 E5:0.5 D5:1 A5:1 | G5:1.5 A5:0.5 B5:1 E6:1 | C6:1.5 B5:0.5 A5:1 C6:1 | D6:2 B5:1 r:1`;

const mapFlute: NotesPart = { kind: 'notes', instrument: 'flute', notes: MAP_THEME, gain: 1, reverb: 0.35, echo: 0.2 };
const mapBell: NotesPart = { kind: 'notes', instrument: 'bell', notes: MAP_THEME, gain: 0.9, pan: 0.25, reverb: 0.4 };
const mapLute: NotesPart = { kind: 'notes', instrument: 'lute', notes: MAP_BRIDGE, octave: -1, gain: 1.4, pan: -0.1, reverb: 0.3, echo: 0.1 };
const mapBridgeFlute: NotesPart = { ...mapFlute, notes: MAP_BRIDGE, gain: 0.5 };
const mapHarp: PatternPart = { kind: 'pattern', instrument: 'harp', pattern: '0.2.3.4.5.4.3.2.', register: 'C3', gain: 0.75, pan: -0.25, reverb: 0.4 };
const mapPizzicato: PatternPart = { kind: 'pattern', instrument: 'pizzicato', pattern: '0.......2...0...', register: 'C2', gain: 0.6, reverb: 0.2 };
const mapPad: ChordsPart = { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'A4', gain: 0.5, reverb: 0.5 };
const mapShaker: DrumPart = { kind: 'drums', instrument: 'shaker', pattern: 'o.x.o.x.o.x.o.x.', gain: 0.8, pan: 0.3 };
const mapTom: DrumPart = { kind: 'drums', instrument: 'tom', pattern: 'x.....x...x.....', gain: 0.6, reverb: 0.25 };

const map: TrackDef = {
  bpm: 110,
  level: 1,
  sections: {
    intro: { bars: 2, chords: 'F | G', parts: [mapHarp, mapPizzicato, mapShaker] },
    A: {
      bars: 8,
      chords: 'F | G | Em | Am | F | G | Dm | G',
      parts: [mapFlute, mapHarp, mapPizzicato, mapShaker, mapTom]
    },
    A2: {
      bars: 8,
      chords: 'F | G | Em | Am | F | G | Dm | G',
      parts: [mapFlute, mapBell, mapHarp, mapPizzicato, mapPad, mapShaker, mapTom]
    },
    B: {
      bars: 8,
      chords: 'Dm | Em | F | G | Dm | Em | F | G',
      parts: [mapLute, mapBridgeFlute, mapHarp, mapPizzicato, mapPad, mapShaker, mapTom]
    }
  },
  form: ['intro', 'A', 'B', 'A2', 'B'],
  loopFrom: 1
};

// ---- Battle: driving D minor with taiko and string ostinatos, layered by intensity ----

const BATTLE_THEME = `
  G4:0.75 A4:0.25 Bb4:1 D5:2 | C5:0.75 Bb4:0.25 A4:1 F4:1 D4:1 |
  F4:0.75 G4:0.25 Bb4:1 D5:1 F5:1 | E5:3 C#5:1 |
  G5:1.5 F5:0.5 D5:1 Bb4:1 | A4:1.5 D5:0.5 F5:2 |
  G5:1.5 F5:0.5 Eb5:1 Bb4:1 | A4:2 C#5:1 E5:1`;

const BATTLE_CLIMAX = `
  F5:1.5 D5:0.5 Bb4:1 D5:1 | G5:1.5 E5:0.5 C5:1 E5:1 | F5:3 E5:0.5 F5:0.5 | A5:2 F5:1 D5:1 |
  Bb5:1.5 A5:0.5 F5:1 D5:1 | G5:1.5 F5:0.5 E5:1 C5:1 | C#5:1 E5:1 A5:2 | G5:0.75 F5:0.25 E5:1 C#5:1 A4:1`;

// Layer 0: drums and low strings
const battleGallop: PatternPart = { kind: 'pattern', instrument: 'spiccato', pattern: '0.000.002.220.00', register: 'A2', gain: 1.6, reverb: 0.2 };
const battleBass: PatternPart = { kind: 'pattern', instrument: 'lowStrings', pattern: '0---------------', register: 'A1', legato: 1, gain: 0.8, reverb: 0.15 };
const battleTaiko: DrumPart = { kind: 'drums', instrument: 'taikoLow', pattern: 'X..xX...X..xX... X..xX...X.x.XxXx', gain: 0.6, reverb: 0.25 };
// Layer 1: the full band
const battleTaikoHigh: DrumPart = { kind: 'drums', instrument: 'taikoHigh', pattern: '..x...x...x...xx', layer: 1, gain: 0.6, pan: 0.2, reverb: 0.25 };
const battleSnare: DrumPart = { kind: 'drums', instrument: 'snare', pattern: '....X.......X..o', layer: 1, gain: 0.9, reverb: 0.2 };
const battleShaker: DrumPart = { kind: 'drums', instrument: 'shaker', pattern: 'xoxoxoxoxoxoxoxo', layer: 1, gain: 0.9, pan: -0.3 };
const battleHighStrings: PatternPart = { kind: 'pattern', instrument: 'spiccato', pattern: '3.4.5.4.3.4.5.4.', register: 'A2', layer: 1, gain: 0.9, pan: 0.3, reverb: 0.3 };
const battleStabs: ChordsPart = { kind: 'chords', instrument: 'brass', rhythm: 'X-.X-.X---......', centre: 'F4', legato: 0.8, layer: 1, gain: 0.9, reverb: 0.3 };
const battleHorn: NotesPart = { kind: 'notes', instrument: 'horn', notes: BATTLE_THEME, layer: 1, gain: 1.1, reverb: 0.3, echo: 0.08 };
const battleClimaxHorn: NotesPart = { ...battleHorn, notes: BATTLE_CLIMAX };
const battleClimaxLowBrass: NotesPart = { ...battleClimaxHorn, instrument: 'lowBrass', octave: -1, gain: 0.6, echo: 0 };
const battleCounterLine: NotesPart = {
  kind: 'notes',
  instrument: 'strings',
  notes: 'D5:4 | F5:4 | D5:4 | E5:4 | A5:4 | F5:4 | D5:2 F5:2 | E5:4',
  layer: 1,
  legato: 1,
  gain: 1.3,
  reverb: 0.4
};
const battleSectionCrash: DrumPart = { kind: 'drums', instrument: 'crash', pattern: downbeat(8), layer: 1, maxLayer: 1, gain: 0.7, reverb: 0.3 };
// Layer 2: the climax adds choir, high strings and more percussion
const battleChoir: ChordsPart = { kind: 'chords', instrument: 'choir', rhythm: 'sustain', centre: 'A4', layer: 2, gain: 0.6, reverb: 0.5 };
const battleStringPad: ChordsPart = { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'D5', layer: 2, gain: 0.6, reverb: 0.4 };
const battleTrumpets: NotesPart = { ...battleClimaxHorn, instrument: 'brass', layer: 2, gain: 0.7, echo: 0 };
const battleToms: DrumPart = { kind: 'drums', instrument: 'tom', pattern: '................ ............xxXX', layer: 2, gain: 0.6, pan: -0.2, reverb: 0.25 };
const battleCrash: DrumPart = { kind: 'drums', instrument: 'crash', pattern: downbeat(4), layer: 2, gain: 0.7, reverb: 0.3 };

const battleRhythm = [battleGallop, battleBass, battleTaiko, battleTaikoHigh, battleSnare, battleShaker, battleToms, battleCrash, battleSectionCrash];

const battle: TrackDef = {
  bpm: 132,
  level: 1.1,
  respondsToIntensity: true,
  sections: {
    intro: {
      bars: 2,
      chords: 'Dm | A',
      parts: [
        battleBass,
        { kind: 'drums', instrument: 'taikoLow', pattern: 'X...X...X...X... X...X...X.X.XXXX', gain: 0.6, reverb: 0.25 },
        { kind: 'drums', instrument: 'swell', pattern: '................ X---------------', layer: 1, gain: 0.8 }
      ]
    },
    A: {
      bars: 8,
      chords: 'Dm | Dm | Bb | C | Dm | Dm | Bb | A',
      parts: [...battleRhythm, battleHighStrings, battleStabs, battleChoir, battleStringPad]
    },
    B: {
      bars: 8,
      chords: 'Gm | Dm | Bb | A | Gm | Dm | Eb | A',
      parts: [...battleRhythm, battleHighStrings, battleHorn, battleChoir]
    },
    A2: {
      bars: 8,
      chords: 'Dm | Dm | Bb | C | Dm | Dm | Bb | A',
      parts: [...battleRhythm, battleHighStrings, battleStabs, battleCounterLine, battleChoir, battleStringPad]
    },
    C: {
      bars: 8,
      chords: 'Bb | C | Dm | Dm | Bb | C | A | A',
      parts: [...battleRhythm, battleStabs, battleClimaxHorn, battleClimaxLowBrass, battleTrumpets, battleChoir, battleStringPad]
    }
  },
  form: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1
};

// ---- Boss: heavier C minor with low brass, choir and pounding drums ----

const BOSS_RIFF = `
  C3:0.5 C3:0.25 C3:0.25 Eb3:0.5 C3:0.5 Db3:1 C3:1 | C3:0.5 C3:0.25 C3:0.25 G3:0.5 C3:0.5 Eb3:1 D3:1 |
  Db3:0.5 Db3:0.25 Db3:0.25 F3:0.5 Db3:0.5 Ab3:1 Db3:1 | C3:0.5 C3:0.25 C3:0.25 Eb3:0.5 C3:0.5 Db3:1 C3:1 |
  C3:0.5 C3:0.25 C3:0.25 Eb3:0.5 C3:0.5 Db3:1 C3:1 | C3:0.5 C3:0.25 C3:0.25 Eb3:0.5 C3:0.5 Bb2:1 G2:1 |
  Ab2:0.5 Ab2:0.25 Ab2:0.25 C3:0.5 Ab2:0.5 Eb3:1 Ab2:1 | G2:0.5 G2:0.25 G2:0.25 B2:0.5 G2:0.5 D3:1 B2:1`;

const BOSS_THEME = `
  C5:2 Eb5:1 C5:1 | Ab4:1.5 G4:0.5 F4:2 | Ab4:1 Db5:1 F5:1.5 Eb5:0.5 | D5:3 B4:1 |
  C5:1 Eb5:1 Ab5:2 | F5:1.5 Eb5:0.5 C5:1 Ab4:1 | Db5:1.5 C5:0.5 Ab4:1 F4:1 | G4:2 B4:1 D5:1`;

const BOSS_CLIMAX = `
  F5:2 C5:1 Ab4:1 | Eb5:1.5 D5:0.5 C5:1 G4:1 | Ab4:1 Db5:1 F5:2 | G5:2 F5:1 D5:1 |
  Ab5:2 F5:1 C5:1 | G5:1.5 Eb5:0.5 C5:1 Eb5:1 | C5:1 Eb5:1 Db5:1 F5:1 | D5:2 B4:1 G4:1`;

const bossRiff: NotesPart = { kind: 'notes', instrument: 'lowBrass', notes: BOSS_RIFF, legato: 0.85, gain: 0.8, reverb: 0.2 };
const bossRiffBass: NotesPart = { ...bossRiff, instrument: 'lowStrings', octave: -1, gain: 0.6, reverb: 0.1 };
const bossChoir: ChordsPart = { kind: 'chords', instrument: 'choir', rhythm: 'sustain', centre: 'G4', gain: 1.1, reverb: 0.5 };
const bossStrings: PatternPart = { kind: 'pattern', instrument: 'spiccato', pattern: '3435343534353435', register: 'G2', gain: 0.8, pan: 0.25, reverb: 0.3 };
const bossGallop: PatternPart = { kind: 'pattern', instrument: 'spiccato', pattern: '0.000.000.000.00', register: 'G2', gain: 0.9, pan: -0.15, reverb: 0.2 };
const bossBass: PatternPart = { kind: 'pattern', instrument: 'lowStrings', pattern: '0---------------', register: 'A1', legato: 1, gain: 0.8, reverb: 0.15 };
const bossHorn: NotesPart = { kind: 'notes', instrument: 'horn', notes: BOSS_THEME, gain: 1.1, reverb: 0.35, echo: 0.08 };
const bossHornLow: NotesPart = { ...bossHorn, instrument: 'lowBrass', octave: -1, gain: 0.55, echo: 0 };
const bossTrumpets: NotesPart = { kind: 'notes', instrument: 'brass', notes: BOSS_CLIMAX, gain: 0.9, reverb: 0.35, echo: 0.08 };
const bossTrumpetHarmony: NotesPart = { ...bossTrumpets, instrument: 'horn', harmony: true, gain: 0.7, pan: 0.2, echo: 0 };
const bossClimaxLow: NotesPart = { ...bossTrumpets, instrument: 'lowBrass', octave: -1, gain: 0.55, echo: 0 };
const bossStabs: ChordsPart = { kind: 'chords', instrument: 'brass', rhythm: '..X-..X-..X-.X--', centre: 'G4', legato: 0.8, gain: 0.7, reverb: 0.3 };
const bossTaiko: DrumPart = { kind: 'drums', instrument: 'taikoLow', pattern: 'X.x.X..xX.x.X.xx', gain: 0.6, reverb: 0.25 };
const bossTaikoHigh: DrumPart = { kind: 'drums', instrument: 'taikoHigh', pattern: '..x..x....x..x.x', gain: 0.7, pan: 0.25, reverb: 0.25 };
const bossSnare: DrumPart = { kind: 'drums', instrument: 'snare', pattern: '....X.......X...', gain: 0.9, reverb: 0.25 };
const bossTimpani: PatternPart = { kind: 'pattern', instrument: 'timpani', pattern: '0.......0.......', register: 'A1', gain: 0.5, reverb: 0.3 };
const bossToms: DrumPart = { kind: 'drums', instrument: 'tom', pattern: withFill(4, '................', '........xxXXxXXX'), gain: 0.6, pan: -0.2, reverb: 0.25 };
const bossCrash: DrumPart = { kind: 'drums', instrument: 'crash', pattern: downbeat(4), gain: 0.75, reverb: 0.3 };

const bossDrums = [bossTaiko, bossTaikoHigh, bossSnare, bossTimpani, bossToms, bossCrash];

const boss: TrackDef = {
  bpm: 140,
  level: 1,
  sections: {
    intro: {
      bars: 2,
      chords: 'Cm | G',
      parts: [
        bossChoir,
        { kind: 'notes', instrument: 'lowBrass', notes: 'C2+C3:4 | G2+G3:4', gain: 0.9, reverb: 0.3 },
        { kind: 'drums', instrument: 'taikoLow', pattern: 'X...............X...X...X.X.XXXX', gain: 0.6, reverb: 0.3 },
        { kind: 'drums', instrument: 'timpani', pitch: 'C2', pattern: 'X............... ........rrrrRRRR', gain: 0.6, reverb: 0.3 },
        { kind: 'drums', instrument: 'swell', pattern: '................ X---------------', gain: 0.8 }
      ]
    },
    A: {
      bars: 8,
      chords: 'Cm | Cm | Db | Cm | Cm | Cm | Ab | G',
      parts: [...bossDrums, bossRiff, bossRiffBass, bossChoir, bossStrings]
    },
    B: {
      bars: 8,
      chords: 'Ab | Fm | Db | G | Ab | Fm | Db | G',
      parts: [...bossDrums, bossGallop, bossBass, bossHorn, bossHornLow, bossChoir]
    },
    A2: {
      bars: 8,
      chords: 'Cm | Cm | Db | Cm | Cm | Cm | Ab | G',
      parts: [...bossDrums, bossRiff, bossRiffBass, bossChoir, bossStrings, bossStabs]
    },
    C: {
      bars: 8,
      chords: 'Fm | Cm | Db | G | Fm | Cm | Ab Db | G',
      parts: [...bossDrums, bossGallop, bossBass, bossTrumpets, bossTrumpetHarmony, bossClimaxLow, bossChoir, bossStrings]
    }
  },
  form: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1
};

export const TRACKS: Record<MusicTrack, TrackDef> = { menu, map, battle, boss };

// ---- Stingers: one-shot jingles ----

const victory: TrackDef = {
  bpm: 132,
  level: 1,
  sections: {
    main: {
      bars: 2,
      chords: 'D D G A | D',
      parts: [
        { kind: 'notes', instrument: 'brass', notes: 'A4:1/3 A4:1/3 A4:1/3 D5:1 B4:0.5 D5:0.5 E5:1 | F#5:4>', gain: 1.1, reverb: 0.35 },
        { kind: 'notes', instrument: 'horn', notes: 'A4:1/3 A4:1/3 A4:1/3 D5:1 B4:0.5 D5:0.5 E5:1 | F#5:4', harmony: true, gain: 0.7, reverb: 0.35 },
        { kind: 'chords', instrument: 'brass', rhythm: '................ X---------------', centre: 'A4', bass: true, gain: 0.8, reverb: 0.4 },
        { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'F#4', bass: true, gain: 1, reverb: 0.4 },
        { kind: 'pattern', instrument: 'lowStrings', pattern: '0...0...0...0... 0---------------', register: 'A1', gain: 0.9 },
        { kind: 'drums', instrument: 'timpani', pitch: 'A2', pattern: '....x...x...rrRR ................', gain: 0.7, reverb: 0.3 },
        { kind: 'drums', instrument: 'timpani', pitch: 'D2', pattern: '................ X...............', gain: 0.9, reverb: 0.3 },
        { kind: 'drums', instrument: 'snare', pattern: 'X..xX..xX..xrrRR ................', gain: 0.7, reverb: 0.2 },
        { kind: 'drums', instrument: 'bassDrum', pattern: '................ X...............', gain: 0.9, reverb: 0.3 },
        { kind: 'drums', instrument: 'crash', pattern: '................ X...............', gain: 1, reverb: 0.3 }
      ]
    }
  },
  form: ['main']
};

const defeat: TrackDef = {
  bpm: 92,
  beatsPerBar: 6,
  level: 1,
  sections: {
    main: {
      bars: 1,
      chords: 'Dm Bb Gm Dm Dm Dm',
      parts: [
        { kind: 'notes', instrument: 'horn', notes: 'A4:1 G4:0.5 F4:0.5 E4:1 D4:3', gain: 1.1, reverb: 0.45 },
        { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'F4', bass: true, gain: 1, reverb: 0.5 },
        { kind: 'pattern', instrument: 'lowStrings', pattern: '0---0---0---0-----------', register: 'A1', legato: 1, gain: 0.8 },
        { kind: 'drums', instrument: 'timpani', pitch: 'D2', pattern: 'x...........o...........', gain: 0.8, reverb: 0.4 }
      ]
    }
  },
  form: ['main']
};

const star: TrackDef = {
  bpm: 150,
  level: 1,
  sections: {
    main: {
      bars: 1,
      chords: 'C',
      parts: [
        { kind: 'notes', instrument: 'bell', notes: 'G5:0.25 C6:0.25 E6:0.25 G6:0.25 C7:3', gain: 1.4, reverb: 0.5, echo: 0.25 },
        { kind: 'notes', instrument: 'harp', notes: 'C5:0.25 E5:0.25 G5:0.25 C6:0.25 E6+G6:3', gain: 1, reverb: 0.5 },
        { kind: 'chords', instrument: 'strings', rhythm: '....X-----------', centre: 'G5', gain: 0.6, reverb: 0.6 },
        { kind: 'drums', instrument: 'shaker', pattern: 'xxxx............', gain: 0.6 }
      ]
    }
  },
  form: ['main']
};

const unlock: TrackDef = {
  bpm: 120,
  beatsPerBar: 6,
  level: 1,
  sections: {
    main: {
      bars: 1,
      chords: 'Cmaj7',
      parts: [
        {
          kind: 'notes',
          instrument: 'harp',
          notes: 'C5:1/8 D5:1/8 E5:1/8 G5:1/8 B5:1/8 C6:1/8 D6:1/8 E6:1/8 G6:1/8 B6:1/8 C7:1/8 D7:1/8 r:4.5',
          gain: 0.9,
          reverb: 0.5,
          echo: 0.2
        },
        { kind: 'notes', instrument: 'bell', notes: 'r:1.5 G6:0.5 B6:0.5 D7:3.5', gain: 0.9, reverb: 0.55, echo: 0.3 },
        { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'E5', gain: 0.8, reverb: 0.6 },
        { kind: 'chords', instrument: 'choir', rhythm: '......X-----------------', centre: 'G4', gain: 0.6, reverb: 0.6 },
        { kind: 'drums', instrument: 'swell', pattern: 'X-----..................', gain: 0.6 },
        { kind: 'drums', instrument: 'crash', pattern: '......o.................', gain: 0.6, reverb: 0.4 }
      ]
    }
  },
  form: ['main']
};

const levelUp: TrackDef = {
  bpm: 132,
  level: 1,
  sections: {
    main: {
      bars: 1,
      chords: 'D',
      parts: [
        { kind: 'notes', instrument: 'brass', notes: 'A4:1/3 D5:1/3 F#5:1/3 A5:0.5 F#5:0.5 D6:2>', gain: 1, reverb: 0.4 },
        { kind: 'notes', instrument: 'horn', notes: 'A4:1/3 D5:1/3 F#5:1/3 A5:0.5 F#5:0.5 D6:2', octave: -1, gain: 0.6, reverb: 0.4 },
        { kind: 'chords', instrument: 'brass', rhythm: '........X-------', centre: 'A4', bass: true, gain: 0.7, reverb: 0.4 },
        { kind: 'chords', instrument: 'strings', rhythm: 'sustain', centre: 'F#4', gain: 0.8, reverb: 0.4 },
        { kind: 'drums', instrument: 'snare', pattern: '....rrRR........', gain: 0.6, reverb: 0.2 },
        { kind: 'drums', instrument: 'timpani', pitch: 'D2', pattern: 'X.......X.......', gain: 0.8, reverb: 0.3 },
        { kind: 'drums', instrument: 'crash', pattern: '........X.......', gain: 0.8, reverb: 0.3 }
      ]
    }
  },
  form: ['main']
};

const bossAppears: TrackDef = {
  bpm: 90,
  beatsPerBar: 5,
  level: 1,
  sections: {
    main: {
      bars: 1,
      chords: 'Cm',
      parts: [
        { kind: 'drums', instrument: 'taikoLow', pattern: 'X...............X...', gain: 0.8, reverb: 0.4 },
        { kind: 'drums', instrument: 'timpani', pitch: 'C2', pattern: 'X...........rrRRX...', gain: 0.8, reverb: 0.4 },
        { kind: 'drums', instrument: 'crash', pattern: 'X...............X...', gain: 0.6, reverb: 0.4 },
        { kind: 'drums', instrument: 'swell', pattern: '....X-----------....', gain: 0.7 },
        // A tritone-and-semitone cluster that swells and cuts off on the final hit
        { kind: 'notes', instrument: 'brassSwell', notes: 'r:0.25 C2+C3+Gb3+Db4:3.75 r:1', legato: 1, gain: 1.5, reverb: 0.4 },
        { kind: 'chords', instrument: 'choir', rhythm: 'X-------------------', centre: 'G3', gain: 0.8, reverb: 0.5 }
      ]
    }
  },
  form: ['main']
};

export const STINGERS: Record<Stinger, TrackDef> = { victory, defeat, star, unlock, levelUp, bossAppears };
