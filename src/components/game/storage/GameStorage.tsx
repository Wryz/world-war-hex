import { GameState } from '@/types/game';
import type { BattleConfig } from '@/lib/campaign/battleSetup';

export type { BattleConfig, Difficulty } from '@/lib/campaign/battleSetup';

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

// Address of a battle's page; `resume` continues the saved battle
export const battlePath = (battle: BattleConfig, resume = false) =>
  (battle.mode === 'campaign' ? `/play?level=${battle.levelId}` : `/play?mode=quick&difficulty=${battle.difficulty}`) +
  (resume ? '&resume=1' : '');

const battleKey = (battle: BattleConfig) =>
  battle.mode === 'campaign' ? `level-${battle.levelId}` : `quick-${battle.difficulty}`;

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
