import type { GameState, PlayerType, Roster, UnitType } from '@/types/game';
import { DEFAULT_SETTINGS, SideSetup, createBattle } from '../game/gameState';
import { MAX_SIDES } from '../game/sides';
import { TroopId, cardStats } from '../game/troops';
import { Trees } from '../game/lineages';
import { WEATHER, WeatherId } from '../game/regionRules';
import { Difficulty, deckRoster, rivalCards } from '../campaign/battleSetup';

// Battles between more than two sides - a free-for-all or teams - fought online between players
// (lib/pvp/room) or offline against the AI. Everyone's castle stands on the edge of a map that grows
// with the number of sides, spread evenly around it.

export const MIN_SIDES = 2;
export { MAX_SIDES };

// The map's radius in hexes: the usual 4 for up to four sides, one more for each side beyond that
export const arenaGridSize = (sides: number): number => Math.max(4, Math.min(MAX_SIDES, sides));

export type WeatherChoice = 'none' | 'random' | WeatherId;
export const WEATHER_CHOICES: WeatherChoice[] = ['none', 'random', ...(Object.keys(WEATHER) as WeatherId[])];
export const weatherChoiceName = (choice: WeatherChoice): string =>
  choice === 'none' ? 'Clear skies' : choice === 'random' ? 'Random' : WEATHER[choice].name;

// How the map is seeded: freely, or mirrored so every side starts from the same ground
export type MapStyle = 'random' | 'mirrored';

// How many equal parts a mirrored map for this many sides turns through: a hex board can be turned a
// half, a third or a sixth of the way round onto itself, so 2, 3 and 6 sides each get a part of their
// own, 4 and 8 share each part between two (the sides across the map from each other start alike, and
// so do two teams), and 5 or 7 can't be mirrored at all (1)
export const mirrorSymmetry = (sides: number): number =>
  [6, 3, 2].find(parts => sides % parts === 0) ?? 1;

// Fair mode: every card fights at this level (and without its skill tree), whatever its owner has
export const DEFAULT_FAIR_LEVEL = 5;
export const MAX_FAIR_LEVEL = 10;

export const DEFAULT_TURN_SECONDS = 30;
export const TURN_SECONDS_CHOICES = [20, 30, 45, 60];
export const DEFAULT_MAX_ROUNDS = 14;

export interface ArenaSideSpec {
  id: PlayerType;
  name: string;
  // Sides with the same team fight together; without one a side fights alone
  team?: number;
  color: number;
  // Played by the AI (it recruits from its whole roster rather than a hand)
  ai?: boolean;
  // The cards the side brings, at its own levels (unless the battle is fair)
  deck: TroopId[];
  cards: Partial<Record<TroopId, number>>;
  trees?: Trees;
}

export interface ArenaSpec {
  // The map's seed (the map itself, its weather when random, and everything placed on it)
  seed: number;
  sides: ArenaSideSpec[];
  weather: WeatherChoice;
  mapStyle: MapStyle;
  // Fair mode: the level every card fights at
  fairLevel?: number;
  fog: boolean;
  // How well the AI's sides play
  difficulty: Difficulty;
  turnSeconds: number;
  maxRounds: number;
}

// A small seeded generator, so everything picked for a battle comes from its seed
const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = <T,>(items: readonly T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// A side's troops as it fields them: its cards at their levels with what their skill trees taught
// them, or in a fair battle every card at the fair level
const sideRoster = (side: ArenaSideSpec, fairLevel?: number): Roster =>
  fairLevel !== undefined
    ? Object.fromEntries(side.deck.map(id => [id, cardStats(id, fairLevel)]))
    : deckRoster(side.deck, side.cards, side.trees);

// The weather a battle is fought in
export const resolveWeather = (choice: WeatherChoice, seed: number): WeatherId | undefined => {
  if (choice === 'none') return undefined;
  if (choice !== 'random') return choice;
  const options = [undefined, ...(Object.keys(WEATHER) as WeatherId[])];
  return options[Math.floor(seeded(seed ^ 0x5eed)() * options.length)];
};

// Build the battle: its map, every side's castle and troops, and the first side's turn begun
export const buildArenaBattle = (spec: ArenaSpec): GameState => {
  const count = spec.sides.length;
  const symmetry = spec.mapStyle === 'mirrored' ? mirrorSymmetry(count) : 1;
  const random = seeded(spec.seed);
  const settings = {
    ...DEFAULT_SETTINGS,
    gridSize: arenaGridSize(count),
    // (more sides, more gold mines - shared out between a mirrored map's parts)
    resourceHexCount: Math.max(DEFAULT_SETTINGS.resourceHexCount, count + 1),
    planningPhaseTime: spec.turnSeconds,
    maxRounds: spec.maxRounds,
    aiDifficulty: spec.difficulty,
    fogOfWar: spec.fog,
    seed: spec.seed,
    weather: resolveWeather(spec.weather, spec.seed),
    ...(symmetry > 1 ? { symmetry } : {})
  };
  const sides: SideSetup[] = spec.sides.map(side => ({ id: side.id, name: side.name, team: side.team, color: side.color, ai: side.ai }));
  const rosters = Object.fromEntries(spec.sides.map(side => [side.id, sideRoster(side, spec.fairLevel)]));
  // (the AI recruits from its whole roster; everyone else draws their hand from a shuffled deck)
  const decks: Record<PlayerType, UnitType[]> = Object.fromEntries(spec.sides.filter(side => !side.ai).map(side => [side.id, shuffled(side.deck, random)]));
  return createBattle(settings, { sides, rosters, decks, battleSeed: Math.floor(random() * 2 ** 31) });
};

// The cards an AI side brings to a battle: a rival kingdom's troops at a level (the fair level, or
// about the level of the player's own cards)
export const aiSideSpec = (id: PlayerType, name: string, color: number, level: number, seed: number, team?: number): ArenaSideSpec => {
  const deck = rivalCards(level, seed);
  return { id, name, color, team, ai: true, deck, cards: Object.fromEntries(deck.map(card => [card, level])) };
};

// Names for the AI's kingdoms
export const AI_NAMES = [
  'Baron Grimsby', 'Lady Morwen', 'Duke Aldric', 'Queen Ysolde', 'Lord Thorne', 'Countess Vey', 'Sir Bramwell', 'Margrave Ulric'
];

// The side id of the n-th side (counting from 0)
export const sideId = (index: number): PlayerType => `s${index + 1}`;
