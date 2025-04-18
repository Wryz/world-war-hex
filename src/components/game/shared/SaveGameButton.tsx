import React from 'react';
import { GameState, Hex } from '@/types/game';
import { saveGameToLocalStorage } from '../storage/GameStorage';

// Removing the COLOR_SCHEME object as we'll use CSS variables instead

interface SaveGameButtonProps {
  gameState: GameState;
  selectedHex: Hex | null;
  isAITurn: boolean;
  timer: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const SaveGameButton: React.FC<SaveGameButtonProps> = ({ 
  gameState, 
  selectedHex, 
  isAITurn, 
  timer, 
  difficulty 
}) => {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-10">
      <button 
        onClick={() => {
          const saved = saveGameToLocalStorage(gameState, { 
            selectedHex, isAITurn, timer, difficulty 
          });
          alert(saved ? 'Game saved successfully!' : 'Failed to save game.');
        }}
        className="py-2 px-4 rounded-lg flex items-center border-2 transition-all duration-200 
          bg-[var(--background)] text-[var(--parchment)] border-[var(--secondary)] 
          shadow-md hover:shadow-lg hover:brightness-110 hover:-translate-y-0.5"
      >
        <span className="mr-2">💾</span> Save Game
      </button>
    </div>
  );
}; 