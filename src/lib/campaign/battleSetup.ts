import type { GameState, Roster, TacticCard } from '@/types/game';
import { DEFAULT_SETTINGS, createBattle } from '../game/gameState';
import { PLAYER_CARD_IDS, TroopId, cardStats } from '../game/troops';
import { activeBonds, applyBonds } from '../game/bonds';
import type { Profile } from '../meta/profile';
import { enemyRosterStats, getLevel, levelEnemies } from './levels';
import { FACTION_TACTICS, MAX_TACTIC_LEVEL, enemyTacticLevel } from '../game/tactics';

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

// The player's deck as a roster, at the levels of their cards, with the bonds it completes
export const deckRoster = (deck: readonly TroopId[], cardLevels: Partial<Record<TroopId, number>>): Roster =>
  applyBonds(Object.fromEntries(deck.map(id => [id, cardStats(id, cardLevels[id] ?? 1)])), activeBonds(deck));

const playerRoster = (profile: Profile): Roster => deckRoster(profile.deck, profile.cards);
const playerTactics = (profile: Profile): TacticCard[] =>
  profile.tacticLoadout.map(id => ({ id, level: profile.tactics[id] ?? 1 }));

// The first battle teaches the basics, so it has no tactic cards and the castle is placed for you
const TUTORIAL_LEVEL = 1;
const playerBonds = (profile: Profile) => activeBonds(profile.deck).map(bond => bond.id);

// Quick battles are against a rival kingdom whose troops match the player's average card level
const QUICK_RIVAL_CARDS: TroopId[] = ['infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic'];

export const buildBattle = (config: BattleConfig, profile: Profile): GameState => {
  const deck = shuffle(profile.deck);
  if (config.mode === 'campaign') {
    const level = getLevel(config.levelId);
    const isTutorial = level.id === TUTORIAL_LEVEL;
    const enemyTactics = FACTION_TACTICS[level.region.faction].map(id => ({ id, level: enemyTacticLevel(level.id) }));
    return createBattle(level.settings, {
      rosters: { player: playerRoster(profile), ai: enemyRosterStats(level) },
      deck,
      bonds: playerBonds(profile),
      levelId: level.id,
      guards: level.guards,
      tactics: isTutorial ? undefined : { player: playerTactics(profile), ai: enemyTactics },
      chooseCastle: !isTutorial
    });
  }

  const owned = PLAYER_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  const averageLevel = Math.max(1, Math.round(owned.reduce((sum, id) => sum + (profile.cards[id] ?? 1), 0) / Math.max(1, owned.length)));
  const tacticLevels = Object.values(profile.tactics);
  const rivalTacticLevel = Math.min(MAX_TACTIC_LEVEL, Math.max(1, Math.round(tacticLevels.reduce((sum, l) => sum + (l ?? 1), 0) / Math.max(1, tacticLevels.length))));
  return createBattle({ ...DEFAULT_SETTINGS, aiDifficulty: config.difficulty, fogOfWar: config.difficulty !== 'easy' }, {
    rosters: {
      player: playerRoster(profile),
      ai: Object.fromEntries(QUICK_RIVAL_CARDS.map(id => [id, cardStats(id, averageLevel)]))
    },
    deck,
    bonds: playerBonds(profile),
    tactics: { player: playerTactics(profile), ai: FACTION_TACTICS.kingdom.map(id => ({ id, level: rivalTacticLevel })) },
    chooseCastle: true
  });
};

// Every troop type that can appear in a battle, so its models can be downloaded up front
export const battleTroopTypes = (config: BattleConfig, profile: Profile): TroopId[] => {
  const enemies = config.mode === 'campaign' ? levelEnemies(getLevel(config.levelId)) : QUICK_RIVAL_CARDS;
  return [...new Set([...profile.deck, ...enemies])];
};
