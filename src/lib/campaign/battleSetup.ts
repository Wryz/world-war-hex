import type { GameState, Roster } from '@/types/game';
import { DEFAULT_SETTINGS, createBattle } from '../game/gameState';
import { MAX_CARD_LEVEL, PLAYER_CARD_IDS, TroopId, cardStats } from '../game/troops';
import type { Profile } from '../meta/profile';
import { MAX_DECK_SIZE } from '../meta/economy';
import { suggestLoadout } from '../meta/loadout';
import { LevelDef, enemyRosterStats, getLevel, levelEnemies } from './levels';

export type Difficulty = 'easy' | 'medium' | 'hard';

// A friend's result on a quick battle they shared (see challengePath), to beat
export interface ChallengeTarget {
  score: number;
  won: boolean;
}

// Which battle is being fought: a campaign level, or a quick skirmish. A quick battle's map seed and
// rival level are picked when it's built unless given (a challenge from a friend gives both).
export type BattleConfig =
  | { mode: 'campaign'; levelId: number }
  | { mode: 'quick'; difficulty: Difficulty; seed?: number; rivalLevel?: number; challenge?: ChallengeTarget };

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// The player's deck as a roster, at the levels of their cards
export const deckRoster = (deck: readonly TroopId[], cardLevels: Partial<Record<TroopId, number>>): Roster =>
  Object.fromEntries(deck.map(id => [id, cardStats(id, cardLevels[id] ?? 1)]));

// The cards brought into a battle: the deck, with any slots it leaves empty (when more cards are
// owned) filled with the best of the rest against the enemies - there's no screen before a battle
// to pick them on
export const battleDeck = (profile: Profile, enemies: TroopId[]): TroopId[] => {
  if (profile.deck.length >= MAX_DECK_SIZE) return profile.deck;
  const extra = suggestLoadout(profile.cards, enemies).filter(id => !profile.deck.includes(id));
  return [...profile.deck, ...extra].slice(0, MAX_DECK_SIZE);
};
export const levelDeck = (level: LevelDef, profile: Profile): TroopId[] => battleDeck(profile, levelEnemies(level));

// The first battle teaches the basics, so the castle is placed for you
const TUTORIAL_LEVEL = 1;

// Quick battles are against a rival kingdom whose troops match the player's average card level
const QUICK_RIVAL_CARDS: TroopId[] = ['infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic'];


// The level of the player's cards on average (a quick battle's rival fields its cards at it)
export const averageCardLevel = (profile: Profile): number => {
  const owned = PLAYER_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  return Math.max(1, Math.round(owned.reduce((sum, id) => sum + (profile.cards[id] ?? 1), 0) / Math.max(1, owned.length)));
};

export const buildBattle = (config: BattleConfig, profile: Profile): GameState => {
  if (config.mode === 'campaign') {
    const level = getLevel(config.levelId);
    const isTutorial = level.id === TUTORIAL_LEVEL;
    const cards = levelDeck(level, profile);
    return createBattle(level.settings, {
      rosters: { player: deckRoster(cards, profile.cards), ai: enemyRosterStats(level) },
      deck: shuffle(cards),
      levelId: level.id,
      guards: level.guards,
      chooseCastle: !isTutorial
    });
  }

  const ownCardLevel = averageCardLevel(profile);
  const rivalLevel = clampRivalLevel(config.rivalLevel ?? ownCardLevel);
  const seed = config.seed ?? randomSeed();
  const cards = battleDeck(profile, QUICK_RIVAL_CARDS);
  const state = createBattle({ ...DEFAULT_SETTINGS, aiDifficulty: config.difficulty, fogOfWar: config.difficulty !== 'easy', seed }, {
    rosters: {
      player: deckRoster(cards, profile.cards),
      ai: Object.fromEntries(QUICK_RIVAL_CARDS.map(id => [id, cardStats(id, rivalLevel)]))
    },
    deck: shuffle(cards),
    chooseCastle: true,
    battleSeed: quickBattleSeed(seed)
  });
  return { ...state, rivalLevel, ownCardLevel };
};

// Seeds are whole numbers that fit a link
export const MAX_SEED = 2 ** 31 - 1;
const randomSeed = () => Math.floor(Math.random() * MAX_SEED);
export const clampRivalLevel = (level: number) => Math.min(MAX_CARD_LEVEL, Math.max(1, Math.round(level)));
// (the great trees and fires come from a seed of their own, made from the map's)
const quickBattleSeed = (seed: number) => (Math.imul(seed, 2654435761) >>> 1) % MAX_SEED;

// Every troop type that can appear in a battle, so its models can be downloaded up front
export const battleTroopTypes = (config: BattleConfig, profile: Profile): TroopId[] => {
  const enemies = config.mode === 'campaign' ? levelEnemies(getLevel(config.levelId)) : QUICK_RIVAL_CARDS;
  return [...new Set([...battleDeck(profile, enemies), ...enemies])];
};
