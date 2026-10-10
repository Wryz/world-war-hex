import type { GameState, Roster } from '@/types/game';
import { DEFAULT_SETTINGS, createBattle } from '../game/gameState';
import { MAX_CARD_LEVEL, TroopId, cardStats } from '../game/troops';
import { BASE_CARD_IDS, Trees, applyTree, lineageOf } from '../game/lineages';
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

// The player's deck as a roster, at the levels of their cards, with what each lineage has learnt on
// its skill tree
export const deckRoster = (deck: readonly TroopId[], cardLevels: Partial<Record<TroopId, number>>, trees: Trees = {}): Roster =>
  Object.fromEntries(deck.map(id => {
    const lineage = lineageOf(id);
    return [id, applyTree(cardStats(id, cardLevels[id] ?? 1), lineage ? trees[lineage] : undefined)];
  }));

// The cards brought into a battle: the deck, with any slots it leaves empty (when more cards are
// owned) filled with the best of the rest against the enemies - there's no screen before a battle
// to pick them on
export const battleDeck = (profile: Profile, enemies: TroopId[]): TroopId[] => {
  if (profile.deck.length >= MAX_DECK_SIZE) return profile.deck;
  const extra = suggestLoadout(profile.cards, enemies)
    .filter(id => !profile.deck.some(card => lineageOf(card) === lineageOf(id)));
  return [...profile.deck, ...extra].slice(0, MAX_DECK_SIZE);
};
export const levelDeck = (level: LevelDef, profile: Profile): TroopId[] => battleDeck(profile, levelEnemies(level));

// The first battle teaches the basics, so the castle is placed for you
const TUTORIAL_LEVEL = 1;

// Quick battles are against a rival kingdom whose troops match the player's average card level. A
// seasoned rival brings evolved forms in place of some of its base troops: which ones is picked from
// the map's seed, so a challenge link always fields the same army.
const QUICK_RIVAL_CARDS: TroopId[] = ['infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic'];
const RIVAL_FORMS: Partial<Record<TroopId, { level: number; forms: TroopId[] }[]>> = {
  infantry: [{ level: 5, forms: ['shieldbearer', 'berserker'] }, { level: 9, forms: ['warden', 'warlord'] }],
  artillery: [{ level: 6, forms: ['longbow', 'crossbow'] }],
  tank: [{ level: 6, forms: ['halberdier'] }],
  rogue: [{ level: 6, forms: ['wolf_rider', 'sapper'] }],
  helicopter: [{ level: 9, forms: ['pegasus'] }],
  medic: [{ level: 6, forms: ['cleric'] }, { level: 10, forms: ['archmage'] }]
};

// The rival's troops at a level, for a map seed (every troop it might field when no seed is given)
export const rivalCards = (rivalLevel: number, seed?: number): TroopId[] => {
  const cards: TroopId[] = [];
  QUICK_RIVAL_CARDS.forEach((id, index) => {
    const tiers = (RIVAL_FORMS[id] ?? []).filter(tier => tier.level <= rivalLevel);
    const tier = tiers[tiers.length - 1];
    if (!tier) {
      cards.push(id);
    } else if (seed === undefined) {
      cards.push(id, ...tier.forms);
    } else {
      // About half the time it keeps the base troop (each troop's pick mixed from the seed on its own)
      let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      const roll = ((h ^ (h >>> 16)) >>> 0) % (tier.forms.length * 2);
      cards.push(roll < tier.forms.length ? tier.forms[roll] : id);
    }
  });
  return [...new Set(cards)];
};


// The level of the player's cards on average (a quick battle's rival fields its cards at it): every
// form of a lineage shares its base card's level, so the base cards count
export const averageCardLevel = (profile: Profile): number => {
  const owned = BASE_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  return Math.max(1, Math.round(owned.reduce((sum, id) => sum + (profile.cards[id] ?? 1), 0) / Math.max(1, owned.length)));
};

export const buildBattle = (config: BattleConfig, profile: Profile): GameState => {
  if (config.mode === 'campaign') {
    const level = getLevel(config.levelId);
    const isTutorial = level.id === TUTORIAL_LEVEL;
    const cards = levelDeck(level, profile);
    return createBattle(level.settings, {
      rosters: { player: deckRoster(cards, profile.cards, profile.trees), ai: enemyRosterStats(level) },
      deck: shuffle(cards),
      levelId: level.id,
      guards: level.guards,
      chooseCastle: !isTutorial
    });
  }

  const ownCardLevel = averageCardLevel(profile);
  const rivalLevel = clampRivalLevel(config.rivalLevel ?? ownCardLevel);
  const seed = config.seed ?? randomSeed();
  const rivals = rivalCards(rivalLevel, seed);
  const cards = battleDeck(profile, rivals);
  const state = createBattle({ ...DEFAULT_SETTINGS, aiDifficulty: config.difficulty, fogOfWar: config.difficulty !== 'easy', seed }, {
    rosters: {
      player: deckRoster(cards, profile.cards, profile.trees),
      ai: Object.fromEntries(rivals.map(id => [id, cardStats(id, rivalLevel)]))
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
  const enemies = config.mode === 'campaign'
    ? levelEnemies(getLevel(config.levelId))
    : rivalCards(clampRivalLevel(config.rivalLevel ?? averageCardLevel(profile)), config.seed);
  // A quick battle's map (and so its rivals, and the cards picked against them to fill the deck) may
  // not be chosen yet: then any card the deck might be filled with
  const own = config.mode === 'quick' && config.seed === undefined && profile.deck.length < MAX_DECK_SIZE
    ? (Object.keys(profile.cards) as TroopId[])
    : battleDeck(profile, enemies);
  return [...new Set([...own, ...enemies])];
};
