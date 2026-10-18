import beatsJson from "./beats.json";
import { HOT, TONES } from "./reel/Caption";
import type { CoverProps } from "./reel/Cover";
import type { ReelProps, Segment } from "./reel/types";
import takesJson from "./takes.json";

// Written by the music step (reels/beats.py, bed.py) and by reels/stage.sh.
type Mark = { t: number; kind: string; label: string };
const BEATS: Record<string, { beats: number[] }> = beatsJson;
const TAKES: Record<string, { ko: number; seconds: number; marks: Mark[] }> = takesJson;

/** The measured beats of a track from `start` (s) on: the reel's grid. */
const grid = (track: string, start = 0) => (BEATS[track]?.beats ?? [0, 0.5]).filter((b) => b >= start - 0.02);

/** Second of a take at which the battle is won (the enemy castle starts to fall). */
const ko = (take: string) => {
  const t = TAKES[take]?.ko ?? -1;
  // (Missing a take: the other reels still build.)
  if (t < 0) console.warn(`${take}: no KO in the takes`);
  return Math.max(0, t);
};

/** Time of the n-th moment of a kind ('boss', 'kill', 'moment', 'castle') whose label matches, or `fallback`. */
const mark = (take: string, kind: string, fallback: number, n = 0, label?: RegExp) =>
  (TAKES[take]?.marks ?? []).filter((m) => m.kind === kind && (!label || label.test(m.label)))[n]?.t ?? fallback;

/** A cut that opens `lead` seconds before the castle starts to fall, so it crumbles just after the beat. */
const koCut = (take: string, beats: number, extra: Partial<Segment> = {}, lead = 0.3): Segment => ({ clip: take, from: ko(take) - lead, beats, ...extra });

/** The boss going down: the blow lands ~1 s into the cut. (A boss that never fell: it raging in the fight.) */
const bossCut = (take: string, beats: number, extra: Partial<Segment> = {}, lead = 1.1): Segment => ({
  clip: take,
  from: Math.max(0.5, mark(take, "boss", mark(take, "moment", ko(take), 0, /Enraged/) + lead - 0.4) - lead),
  beats,
  ...extra,
});

/** A fight in full swing: just before the n-th kill. */
const fightCut = (take: string, beats: number, extra: Partial<Segment> = {}, n = 0, lead = 1.6): Segment => ({
  clip: take,
  from: Math.max(0.5, mark(take, "kill", ko(take) / 2, n, /^(?!unit-)/) - lead),
  beats,
  ...extra,
});

/** Troops battering a castle: just before its walls crack (or a crushing blow lands). */
const siegeCut = (take: string, beats: number, extra: Partial<Segment> = {}): Segment => ({
  clip: take,
  from: Math.max(0.5, mark(take, "moment", ko(take) - 4, 0, /Walls Cracking|Crushing Blow/) - 0.8),
  beats,
  ...extra,
});

// ---------------------------------------------------------------------------- 1. The bosses
// "The bosses keep getting bigger": one region's boss per cut, level 10 to 100, each going down.
const bosses: ReelProps = {
  music: "music/dubstep_epic.mp3",
  grid: grid("dubstep_epic", 132.2),
  musicVolume: 0.7,
  gameVolume: 0.9,
  hook: "THE BOSSES KEEP GETTING *BIGGER*",
  hookBeats: 8,
  endBeats: 6,
  title: "HEX *HORDES*",
  cta: "LINK IN BIO",
  segments: [
    bossCut("b10_bandit_king", 4, { text: "LVL 10", sub: "BANDIT KING" }),
    bossCut("b20_goblin_warchief", 4, { text: "LVL 20", sub: "GOBLIN WARCHIEF" }),
    bossCut("b30_alpha_direwolf", 4, { text: "LVL 30", sub: "ALPHA DIREWOLF" }),
    bossCut("b40_bog_hydra", 4, { text: "LVL 40", sub: "BOG HYDRA" }),
    bossCut("b50_pharaoh", 4, { text: "LVL 50", sub: "THE PHARAOH" }),
    bossCut("b60_frost_giant_e1", 4, { text: "LVL 60", sub: "FROST GIANT" }),
    bossCut("b70_lich_king_r1", 4, { text: "LVL 70", sub: "LICH KING", accent: HOT }),
    bossCut("b90_demon_lord", 4, { text: "LVL 90", sub: "DEMON LORD", accent: HOT }),
    bossCut("b100_elder_dragon", 8, { text: "LVL *100*", sub: "ELDER DRAGON", accent: HOT, push: 1.12 }),
    koCut("b100_elder_dragon", 8, { push: 1.3, focus: [25, 32] }),
  ],
};

// ---------------------------------------------------------------------------- 2. The world tour
// "Every map is a new war": a fight in each region, its ground and weather.
const tour: ReelProps = {
  music: "music/war_drums.mp3",
  grid: grid("war_drums", 113.2),
  musicVolume: 0.75,
  gameVolume: 0.85,
  hook: "EVERY MAP IS A NEW *WAR*",
  hookBeats: 8,
  endBeats: 4,
  title: "HEX *HORDES*",
  cta: "LINK IN BIO",
  segments: [
    fightCut("b10_bandit_king", 4, { text: "MEADOWS", sub: "BANDITS" }),
    fightCut("b20_goblin_warchief", 4, { text: "DEEP WOODS", sub: "GOBLINS" }),
    fightCut("b30_alpha_direwolf", 4, { text: "HOWLING HILLS", sub: "WOLF PACKS" }),
    fightCut("b40_bog_hydra", 4, { text: "THE MARSH", sub: "FOG HIDES THEM" }),
    fightCut("b50_pharaoh", 4, { text: "THE DESERT", sub: "THE SAND COURT" }),
    fightCut("b60_frost_giant_e1", 4, { text: "FROSTPEAK", sub: "BLIZZARDS" }),
    fightCut("b70_lich_king_r1", 4, { text: "GRAVEMOOR", sub: "THE DEAD RISE", accent: HOT }),
    fightCut("b90_demon_lord", 4, { text: "EMBERFORGE", sub: "LAVA & FIRE", accent: HOT }),
    koCut("b100_elder_dragon", 8, { text: "DRAGONSPIRE", sub: "THE LAST ONE", accent: HOT, push: 1.25, focus: [25, 32] }, 0.6),
  ],
};

// ---------------------------------------------------------------------------- 3. The castles
// "Watch their castle crumble": the siege, then castle after castle coming down on the beat.
const castles: ReelProps = {
  music: "music/hybrid_drop.mp3",
  grid: grid("hybrid_drop", 9.3),
  musicVolume: 0.7,
  gameVolume: 0.95,
  hook: "WATCH THEIR CASTLE *CRUMBLE*",
  hookBeats: 8,
  // (the castle falls in the upper middle of the frame: count them below it)
  captionTop: 1180,
  endBeats: 6,
  title: "HEX *HORDES*",
  cta: "LINK IN BIO",
  segments: [
    siegeCut("b30_alpha_direwolf", 4),
    koCut("b10_bandit_king", 4, { text: "*1*", sub: "BANDIT FORT" }),
    koCut("b20_goblin_warchief", 4, { text: "*2*", sub: "GOBLIN KEEP" }),
    siegeCut("b40_bog_hydra", 4),
    koCut("b30_alpha_direwolf", 4, { text: "*3*", sub: "WOLF DEN" }),
    koCut("b40_bog_hydra", 4, { text: "*4*", sub: "SWAMP TOWER" }),
    koCut("b50_pharaoh", 4, { text: "*5*", sub: "DESERT PALACE" }),
    siegeCut("b50_pharaoh", 4),
    koCut("b100_elder_dragon", 12, { text: "*6*", sub: "DRAGON'S LAIR", accent: HOT, rate: 0.6, push: 1.35, focus: [25, 32] }),
  ],
};

// The first batch (rendered to media/reels in the old caption style), kept for reference.
export const BATCH1: Record<string, ReelProps> = { Reel1Bosses: bosses, Reel2Worlds: tour, Reel3Castles: castles };

/** A cut that opens `lead` s before the n-th callout whose label matches (kind: 'kill', 'boss', 'moment'...). */
const atCut = (take: string, kind: string, label: RegExp, beats: number, extra: Partial<Segment> = {}, lead = 0.6, n = 0): Segment => ({
  clip: take,
  from: Math.max(0.5, mark(take, kind, ko(take) / 2, n, label) - lead),
  beats,
  ...extra,
});

const { gold, red, purple, green, blue } = TONES;

// ---------------------------------------------------------------------------- 4. The undead story
// "The undead won't stay dead": the Lich King's skeletons keep getting back up and our castle falls
// (a real defeat), then the rematch with War Clerics, who finish the undead for good (a real win).
const undead: ReelProps = {
  music: "music/spooky_bounce.mp3",
  grid: grid("spooky_bounce", 62.0),
  musicVolume: 0.7,
  gameVolume: 0.9,
  hook: "The undead won't *stay dead*",
  hookAccent: TONES.purple.text,
  hookBeats: 8,
  endBeats: 4,
  title: "Hex *Hordes*",
  cta: "LINK IN BIO",
  segments: [
    { clip: "b70_lich_king", from: 19.8, beats: 4, accent: purple.text },
    atCut("b70_lich_king", "moment", /They Rise Again/, 6, { text: "They got *back up*", accent: purple.text }, 1.8, 3),
    atCut("b70_lich_king", "moment", /They Rise Again/, 6, { text: "*Again.*", accent: purple.text }, 1.8, 4),
    koCut("b70_lich_king", 10, { text: "*Defeat*", sub: "Level 70 · the Lich King", accent: red.text, push: 1.15 }, 0.4),
    atCut("b70_lich_king_r1", "boss", /Boss Defeated/, 8, { text: "Rematch: *War Clerics*", sub: "they finish the undead", accent: gold.text, push: 1.1 }, 2.4),
    atCut("b70_lich_king_r1", "boss", /Boss Defeated/, 8, { text: "Gone *for good.*", accent: green.text, push: 1.12 }, -1.0),
  ],
};

// ---------------------------------------------------------------------------- 5. The kill streak
// The game's own callouts, one per beat-cut, climbing: First Blood to Victory.
const streak: ReelProps = {
  music: "music/phonk_streak.mp3",
  grid: grid("phonk_streak", 36.0),
  musicVolume: 0.7,
  gameVolume: 0.95,
  hook: "Can you *chain it?*",
  hookBeats: 4,
  endBeats: 3,
  title: "Hex *Hordes*",
  cta: "LINK IN BIO",
  segments: [
    atCut("b10_bandit_king", "kill", /First Blood/, 3, { text: "First *Blood!*", accent: red.text }),
    atCut("b90_demon_lord", "kill", /Double Kill/, 3, { text: "Double *Kill!*", accent: gold.text }),
    atCut("b20_goblin_warchief", "kill", /Double Kill/, 3, { text: "Double *Kill!*", sub: "again", accent: gold.text }),
    atCut("b90_demon_lord", "kill", /Triple Kill/, 3, { text: "Triple *Kill!*", accent: purple.text }),
    atCut("b20_goblin_warchief", "boss", /Boss Defeated/, 4, { text: "*Boss* Defeated!", accent: red.text, push: 1.1 }),
    atCut("b30_alpha_direwolf", "moment", /Crushing Blow/, 3, { text: "Crushing *Blow!*", accent: blue.text }),
    koCut("b100_elder_dragon", 7, { text: "*Victory!*", accent: green.text, rate: 0.7, push: 1.3, focus: [25, 32] }),
  ],
};

export const REELS: Record<string, ReelProps> = {
  Reel4Undead: undead,
  Reel5Streak: streak,
};

export const COVERS: Record<string, CoverProps> = {
  Cover4Undead: { still: "stills/undead.jpg", text: "The undead won't *stay dead*", sub: "so I brought clerics", accent: purple.text },
  Cover5Streak: { still: "stills/streak.jpg", text: "Can you *chain it?*", sub: "First Blood → Victory", accent: gold.text },
};

// Every cut has to stay inside its take (a cut running off the end of the footage freezes).
for (const [id, r] of Object.entries(REELS)) {
  let at = 0;
  for (const s of r.segments) {
    const g = r.grid;
    const span = (n: number) => {
      const i = Math.min(Math.floor(n), g.length - 2);
      return g[i] + (g[i + 1] - g[i]) * (n - i);
    };
    const secs = (span(at + s.beats) - span(at)) * (s.rate ?? 1);
    const len = TAKES[s.clip]?.seconds ?? 0;
    if (s.from + secs > len + 0.01) console.warn(`${id}: ${s.clip} cut runs ${(s.from + secs - len).toFixed(2)}s past the take`);
    at += s.beats;
  }
}
