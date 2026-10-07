import { GameState } from '@/types/game';

const SAVE_KEY = 'hexStrategyGameSave';
// Bump when the saved state's shape changes so old saves are ignored instead of breaking the game
const SAVE_VERSION = 3;

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SavedGameData {
  timer: number;
  difficulty: Difficulty;
}

interface SaveFile {
  version: number;
  gameState: GameState;
  additionalData: SavedGameData;
  timestamp: string;
}

// Utility function to save game state to localStorage
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
  data.gameState.currentPhase !== 'gameOver';

// Utility function to load game state from localStorage
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

// Utility function to clear saved game from localStorage
export const clearSavedGame = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear saved game:', error);
    return false;
  }
};
