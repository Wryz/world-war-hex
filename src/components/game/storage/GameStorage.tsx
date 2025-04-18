import { GameState, Hex } from '@/types/game';

// Define a proper type for saved game data
export interface SavedGameData {
  selectedHex: Hex | null;
  isAITurn: boolean;
  timer: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Utility function to save game state to localStorage
export const saveGameToLocalStorage = (gameState: GameState, additionalData: SavedGameData) => {
  try {
    const saveData = {
      gameState,
      additionalData,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('hexStrategyGameSave', JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error('Failed to save game:', error);
    return false;
  }
};

// Utility function to load game state from localStorage
export const loadGameFromLocalStorage = (): { gameState: GameState, additionalData: SavedGameData } | null => {
  try {
    const saveData = localStorage.getItem('hexStrategyGameSave');
    if (!saveData) return null;
    
    return JSON.parse(saveData);
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
};

// Utility function to clear saved game from localStorage
export const clearSavedGame = () => {
  try {
    localStorage.removeItem('hexStrategyGameSave');
    return true;
  } catch (error) {
    console.error('Failed to clear saved game:', error);
    return false;
  }
}; 