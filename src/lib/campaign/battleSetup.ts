import type { GameState, Roster } from '@/types/game';
import { DEFAULT_SETTINGS, createBattle } from '../game/gameState';
import { PLAYER_CARD_IDS, TroopId, cardStats } from '../game/troops';
import type { Profile } from '../meta/profile';
import { enemyRosterStats, getLevel, levelEnemies } from './levels';

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
const playerRoster = (profile: Profile): Roster =>
  Object.fromEntries(profile.deck.map(id => [id, cardStats(id, profile.cards[id] ?? 1)]));

// Quick battles are against a rival kingdom whose troops match the player's average card level
const QUICK_RIVAL_CARDS: TroopId[] = ['infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic'];

export const buildBattle = (config: BattleConfig, profile: Profile): GameState => {
  const deck = shuffle(profile.deck);
  if (config.mode === 'campaign') {
    const level = getLevel(config.levelId);
    return createBattle(level.settings, {
      rosters: { player: playerRoster(profile), ai: enemyRosterStats(level) },
      deck,
      levelId: level.id,
      guards: level.guards
    });
  }

  const owned = PLAYER_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  const averageLevel = Math.max(1, Math.round(owned.reduce((sum, id) => sum + (profile.cards[id] ?? 1), 0) / Math.max(1, owned.length)));
  return createBattle({ ...DEFAULT_SETTINGS, aiDifficulty: config.difficulty }, {
    rosters: {
      player: playerRoster(profile),
      ai: Object.fromEntries(QUICK_RIVAL_CARDS.map(id => [id, cardStats(id, averageLevel)]))
    },
    deck
  });
};

// Every troop type that can appear in a battle, so its models can be downloaded up front
export const battleTroopTypes = (config: BattleConfig, profile: Profile): TroopId[] => {
  const enemies = config.mode === 'campaign' ? levelEnemies(getLevel(config.levelId)) : QUICK_RIVAL_CARDS;
  return [...new Set([...profile.deck, ...enemies])];
};
