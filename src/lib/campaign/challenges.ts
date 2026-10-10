import type { GameState } from '@/types/game';
import { DEFAULT_SETTINGS, castleHealthRatio } from '../game/gameState';
import { baseLevelReward } from '../meta/economy';
import { getLevel, LevelDef } from './levels';

// Optional challenges: every campaign level past the tutorial has one, a harder way to win it for a
// bonus of coins, paid the first time it is done. Boss battles ask for the boss's head; champion
// battles for the castle itself; the rest take turns.

export type ChallengeId = 'swift' | 'noLosses' | 'unbroken' | 'thrifty' | 'twoCamps' | 'topple' | 'slayBoss';

export interface Challenge {
  id: ChallengeId;
  // A few words, for a badge
  label: string;
  // The full wording
  description: string;
  // Whether a won battle met it
  met: (state: GameState) => boolean;
}

// The bonus, as a share of the level's base reward
export const CHALLENGE_BONUS = 0.6;
// Levels without a challenge (the first two, gentle battles)
const FIRST_CHALLENGE_LEVEL = 3;
// Win within this share of the level's rounds
const SWIFT_SHARE = 0.6;
// (the armies meet at once on the small field, so a castle seldom comes through untouched)
const UNBROKEN_HEALTH = 0.75;
const THRIFTY_TROOPS = 5;

const swiftRounds = (level: LevelDef) => Math.ceil((level.settings.maxRounds ?? DEFAULT_SETTINGS.maxRounds!) * SWIFT_SHARE);

const build = (id: ChallengeId, level: LevelDef): Challenge => {
  switch (id) {
    case 'swift': {
      const rounds = swiftRounds(level);
      return { id, label: `Win by round ${rounds}`, description: `Win before the end of round ${rounds}.`, met: state => state.turnNumber <= rounds };
    }
    case 'noLosses':
      return { id, label: 'Lose no troops', description: 'Win without losing a single troop.', met: state => (state.battleStats?.player.lost ?? 0) === 0 };
    case 'unbroken':
      return {
        id, label: `Castle ${Math.round(UNBROKEN_HEALTH * 100)}%+`, description: `Win with your castle at ${Math.round(UNBROKEN_HEALTH * 100)}% health or more.`,
        met: state => castleHealthRatio(state, 'player') >= UNBROKEN_HEALTH
      };
    case 'thrifty':
      return {
        id, label: `${THRIFTY_TROOPS} troops or fewer`, description: `Win deploying no more than ${THRIFTY_TROOPS} troops.`,
        met: state => (state.battleStats?.player.recruited ?? 0) <= THRIFTY_TROOPS
      };
    case 'twoCamps':
      return { id, label: 'Take 2 camps', description: 'Capture two camps on the way to victory.', met: state => (state.battleStats?.player.campsCaptured ?? 0) >= 2 };
    case 'topple':
      return { id, label: 'Topple the castle', description: 'Win by destroying the enemy castle, not on points.', met: state => state.winReason === 'destroyed' };
    case 'slayBoss':
      return { id, label: 'Slay the boss', description: 'Win with the boss slain.', met: state => (state.battleStats?.player.bossesSlain ?? 0) > 0 };
  }
};

// The challenges regular levels take turns at
const ROTATION: ChallengeId[] = ['swift', 'noLosses', 'unbroken', 'twoCamps', 'thrifty', 'topple'];

export const levelChallenge = (levelOrId: LevelDef | number): Challenge | undefined => {
  const level = typeof levelOrId === 'number' ? getLevel(levelOrId) : levelOrId;
  if (level.id < FIRST_CHALLENGE_LEVEL) return undefined;
  if (level.isBoss) return build('slayBoss', level);
  if (level.isElite) return build('topple', level);
  return build(ROTATION[(level.id + level.region.id) % ROTATION.length], level);
};

export const challengeBonus = (levelId: number) => Math.round(baseLevelReward(levelId) * CHALLENGE_BONUS);

// Whether a finished battle met its level's challenge (it has to be won)
export const challengeMet = (state: GameState): boolean => {
  if (state.winner !== 'player' || !state.levelId) return false;
  const challenge = levelChallenge(state.levelId);
  return !!challenge && challenge.met(state);
};
