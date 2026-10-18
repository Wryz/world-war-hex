import beatsJson from "./beats.json";
import { ACCENT, HOT } from "./reel/Caption";
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

/** The boss going down (or, if it never fell, the castle). The blow lands ~1 s into the cut. */
const bossCut = (take: string, beats: number, extra: Partial<Segment> = {}, lead = 1.1): Segment => ({
  clip: take,
  from: Math.max(0.5, mark(take, "boss", ko(take)) - lead),
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
    koCut("b100_elder_dragon", 6, { text: "DRAGONSPIRE", sub: "THE LAST ONE", accent: HOT, push: 1.25, focus: [25, 32] }, 0.6),
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
  endBeats: 6,
  title: "HEX *HORDES*",
  cta: "LINK IN BIO",
  segments: [
    { clip: "b30_alpha_direwolf", from: mark("b30_alpha_direwolf", "moment", ko("b30_alpha_direwolf") - 3, 0, /Walls Cracking|Crushing/) - 0.8, beats: 4 },
    koCut("b10_bandit_king", 4, { text: "*1*", sub: "BANDIT FORT" }),
    koCut("b20_goblin_warchief", 4, { text: "*2*", sub: "GOBLIN KEEP" }),
    koCut("b30_alpha_direwolf", 4, { text: "*3*", sub: "WOLF DEN" }),
    koCut("b40_bog_hydra", 4, { text: "*4*", sub: "SWAMP TOWER" }),
    koCut("b50_pharaoh", 4, { text: "*5*", sub: "DESERT PALACE" }),
    koCut("b60_frost_giant_e1", 4, { text: "*6*", sub: "ICE HOLD" }),
    koCut("b70_lich_king_e1", 4, { text: "*7*", sub: "THE CRYPT", accent: HOT }),
    koCut("b100_elder_dragon", 12, { text: "*8*", sub: "DRAGON'S LAIR", accent: HOT, rate: 0.6, push: 1.35, focus: [25, 32] }),
  ],
};

export const REELS: Record<string, ReelProps> = {
  Reel1Bosses: bosses,
  Reel2Worlds: tour,
  Reel3Castles: castles,
};

export const COVERS: Record<string, CoverProps> = {
  Cover1Bosses: { still: "stills/bosses.jpg", text: "THE BOSSES KEEP GETTING *BIGGER*", sub: "HOW FAR CAN YOU GET?", accent: ACCENT },
  Cover2Worlds: { still: "stills/worlds.jpg", text: "EVERY MAP IS A NEW *WAR*", sub: "15 REGIONS · 150 BATTLES", accent: ACCENT },
  Cover3Castles: { still: "stills/castles.jpg", text: "WATCH IT *CRUMBLE*", sub: "8 CASTLES · 20 SECONDS", accent: HOT },
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
