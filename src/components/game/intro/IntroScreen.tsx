import React, { useState } from 'react';
import Image from 'next/image';
import HexBackground from './HexBackground';

export interface IntroScreenProps {
  onStartGame: (difficulty: 'easy' | 'medium' | 'hard') => void;
  onContinueGame?: () => void;
  hasSavedGame?: boolean;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ 
  onStartGame, 
  onContinueGame, 
  hasSavedGame = false 
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  const handleDifficultySelect = (level: 'easy' | 'medium' | 'hard') => {
    setSelectedDifficulty(level);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <HexBackground />
      
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen z-10 relative">
        <div className="backdrop-blur-md bg-opacity-70 bg-[var(--background)] rounded-lg shadow-2xl p-6 md:p-8 max-w-4xl w-full border-2 border-[var(--primary)]">
          <div className="flex justify-center mb-6">
            <Image 
              src="/world-war-hex-logo.png" 
              alt="World War Hex Logo" 
              width={200} 
              height={200} 
              className="max-w-full h-auto"
              priority
            />
          </div>
          
          <p className="text-xl md:text-2xl text-[var(--foreground)] mb-10 text-center italic">
            Conquer the hexagonal battlefield and claim victory!
          </p>
          
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-[var(--primary)] mb-6 text-center">
              Choose Your Challenge
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleDifficultySelect(level)}
                  className={`
                    p-5 rounded-lg text-xl font-bold transition-all duration-300
                    ${selectedDifficulty === level 
                      ? 'bg-[var(--primary)] text-[var(--background)] transform scale-110 shadow-lg border-2 border-white' 
                      : 'bg-[var(--background)] bg-opacity-80 text-[var(--primary)] border-2 border-[var(--primary)] hover:bg-[var(--primary-light)] hover:text-[var(--background)]'
                    }
                  `}
                >
                  {level === 'easy' && '🛡️ '}
                  {level === 'medium' && '⚔️ '}
                  {level === 'hard' && '💀 '}
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-6">
            <button
              onClick={() => onStartGame(selectedDifficulty)}
              className="bg-[var(--primary)] text-[var(--background)] py-4 px-10 rounded-lg text-2xl font-bold transition-all duration-300 
                hover:bg-[var(--primary-light)] hover:shadow-lg hover:scale-105 
                active:transform active:scale-95
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
            >
              ⚔️ Begin Conquest
            </button>
            
            {hasSavedGame && onContinueGame && (
              <button
                onClick={onContinueGame}
                className="bg-[var(--secondary)] text-[var(--background)] py-4 px-10 rounded-lg text-2xl font-bold transition-all duration-300 
                  hover:bg-[var(--secondary-light)] hover:shadow-lg hover:scale-105 
                  active:transform active:scale-95
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--secondary)]"
              >
                🔄 Continue Battle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen; 