import type { GameState, Roster } from '@/types/game';
import { DEFAULT_SETTINGS, createBattle } from '../game/gameState';
import { PLAYER_CARD_IDS, TroopId, cardStats } from '../game/troops';
import type { Profile } from '../meta/profile';
import { MAX_DECK_SIZE } from '../meta/economy';
import { suggestLoadout } from '../meta/loadout';
import { LevelDef, enemyRosterStats, getLevel, levelEnemies } from './levels';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Which battle is being fought: a campaign level, or a quick skirmish
export type BattleConfig =
  | { mode: 'campaign'; levelId: number }
  | { mode: 'quick'; difficulty: Difficulty };

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

  const owned = PLAYER_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  const averageLevel = Math.max(1, Math.round(owned.reduce((sum, id) => sum + (profile.cards[id] ?? 1), 0) / Math.max(1, owned.length)));
  const cards = battleDeck(profile, QUICK_RIVAL_CARDS);
  return createBattle({ ...DEFAULT_SETTINGS, aiDifficulty: config.difficulty, fogOfWar: config.difficulty !== 'easy' }, {
    rosters: {
      player: deckRoster(cards, profile.cards),
      ai: Object.fromEntries(QUICK_RIVAL_CARDS.map(id => [id, cardStats(id, averageLevel)]))
    },
    deck: shuffle(cards),
    chooseCastle: true
  });
};

// Every troop type that can appear in a battle, so its models can be downloaded up front
export const battleTroopTypes = (config: BattleConfig, profile: Profile): TroopId[] => {
  const enemies = config.mode === 'campaign' ? levelEnemies(getLevel(config.levelId)) : QUICK_RIVAL_CARDS;
  return [...new Set([...battleDeck(profile, enemies), ...enemies])];
};
