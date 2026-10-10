import { GameState } from '@/types/game';
import type { BattleConfig, ChallengeTarget, Difficulty } from '@/lib/campaign/battleSetup';
import { MAX_SEED, clampRivalLevel, dailyBattle } from '@/lib/campaign/battleSetup';
import { isDayKey } from '@/lib/campaign/daily';

export type { BattleConfig, ChallengeTarget, Difficulty } from '@/lib/campaign/battleSetup';

const SAVE_KEY = 'hexStrategyGameSave';
// Bump when the saved state's shape changes so old saves are ignored instead of breaking the game
const SAVE_VERSION = 4;

export interface SavedGameData {
  timer: number;
  battle: BattleConfig;
  // Seconds spent in the battle so far
  elapsedSeconds: number;
}

interface SaveFile {
  version: number;
  gameState: GameState;
  additionalData: SavedGameData;
  timestamp: string;
}

// A quick battle's address: its difficulty, and when fixed its map, rival and a friend's score to beat
// (a daily challenge's map and difficulty come from its date)
const quickQuery = (battle: Extract<BattleConfig, { mode: 'quick' }>) => {
  const params = new URLSearchParams(battle.daily ? { mode: 'quick', daily: battle.daily } : { mode: 'quick', difficulty: battle.difficulty });
  if (battle.seed !== undefined && !battle.daily) params.set('seed', String(battle.seed));
  if (battle.rivalLevel !== undefined) params.set('rival', String(battle.rivalLevel));
  if (battle.challenge) {
    params.set('score', String(battle.challenge.score));
    params.set('won', battle.challenge.won ? '1' : '0');
  }
  return params.toString();
};

// Address of a battle's page; `resume` continues the saved battle
export const battlePath = (battle: BattleConfig, resume = false) =>
  (battle.mode === 'campaign' ? `/play?level=${battle.levelId}` : `/play?${quickQuery(battle)}`) +
  (resume ? '&resume=1' : '');

// The link that challenges a friend to the quick battle just fought: same map, same rival, and the
// points to beat
export const challengePath = (difficulty: Difficulty, seed: number, rivalLevel: number, target: ChallengeTarget) =>
  battlePath({ mode: 'quick', difficulty, seed, rivalLevel, challenge: target });

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const wholeNumber = (value: string | null, min: number, max: number) => {
  if (value === null || !/^\d{1,10}$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? number : undefined;
};

// The link to a day's daily challenge, with a score to beat when it's shared
export const dailyPath = (day: string, target?: ChallengeTarget) => battlePath(dailyBattle(day, target));

// The quick battle a page's address asks for (a challenge link's map, rival and score included)
export const quickBattleFromParams = (params: URLSearchParams): Extract<BattleConfig, { mode: 'quick' }> => {
  const day = params.get('daily');
  // (a daily challenge's rival always matches the player's own cards: a link can't choose a weaker one)
  if (isDayKey(day)) {
    const score = wholeNumber(params.get('score'), 0, 100000);
    return dailyBattle(day, score !== undefined ? { score, won: params.get('won') === '1' } : undefined);
  }
  const requested = params.get('difficulty') as Difficulty | null;
  const difficulty = requested && DIFFICULTIES.includes(requested) ? requested : 'medium';
  const seed = wholeNumber(params.get('seed'), 0, MAX_SEED);
  const rival = wholeNumber(params.get('rival'), 1, 99);
  const score = wholeNumber(params.get('score'), 0, 100000);
  return {
    mode: 'quick',
    difficulty,
    ...(seed !== undefined ? { seed } : {}),
    ...(rival !== undefined ? { rivalLevel: clampRivalLevel(rival) } : {}),
    // (a score only means something on a known map)
    ...(score !== undefined && seed !== undefined ? { challenge: { score, won: params.get('won') === '1' } } : {})
  };
};

const battleKey = (battle: BattleConfig) =>
  battle.mode === 'campaign' ? `level-${battle.levelId}`
    : battle.daily ? `daily-${battle.daily}`
    : `quick-${battle.difficulty}${battle.seed !== undefined ? `-${battle.seed}` : ''}`;

export const sameBattle = (a: BattleConfig, b: BattleConfig) =>
  battleKey(a) === battleKey(b);

// Save the battle in progress to localStorage
export const saveGameToLocalStorage = (gameState: GameState, additionalData: SavedGameData) => {
  try {
    const saveData: SaveFile = {
      version: SAVE_VERSION,
      gameState,
      additionalData,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error('Failed to save game:', error);
    return false;
  }
};

// A save we can actually resume: right version, and a game that is still being played
const isResumable = (data: Partial<SaveFile> | null): data is SaveFile =>
  !!data &&
  data.version === SAVE_VERSION &&
  Array.isArray(data.gameState?.hexGrid) &&
  !!data.gameState?.players?.player &&
  !!data.gameState?.players?.ai &&
  !!data.gameState.settings &&
  !!data.additionalData?.battle &&
  data.gameState.currentPhase !== 'gameOver';

// Load the battle in progress, if there is one
export const loadGameFromLocalStorage = (): { gameState: GameState; additionalData: SavedGameData } | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<SaveFile>;
    return isResumable(data) ? data : null;
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
};

// The raw save, for exporting progress to a file
export const readRawSave = (): unknown => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Restore a save imported from a file (ignored unless it is resumable)
export const writeRawSave = (save: unknown) => {
  if (!isResumable(save as Partial<SaveFile>)) return clearSavedGame();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    console.error('Failed to restore saved battle:', error);
  }
};

// Forget the battle in progress
export const clearSavedGame = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear saved game:', error);
    return false;
  }
};
