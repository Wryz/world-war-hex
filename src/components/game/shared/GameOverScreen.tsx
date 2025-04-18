import React from 'react';

interface GameOverScreenProps {
  winner: 'player' | 'ai';
  onRestart: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, onRestart }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)] bg-opacity-80 z-10">
    <div className="p-8 rounded-lg text-center border-4 shadow-2xl max-w-md"
         style={{
           backgroundColor: 'var(--parchment)',
           borderColor: 'var(--accent)',
           boxShadow: `0 4px 30px var(--primary)`
         }}>
      <h1 className="text-4xl font-bold mb-6"
          style={{ color: winner === 'player' ? 'var(--accent)' : 'var(--primary)' }}>
        {winner === 'player' ? 'Victory!' : 'Defeat!'}
      </h1>
      <p className="text-xl mb-8" style={{ color: 'var(--secondary)' }}>
        {winner === 'player' 
          ? 'You have conquered the enemy and claimed their lands!' 
          : 'Your castle has fallen. Your kingdom is lost!'}
      </p>
      <button 
        onClick={onRestart}
        className="font-bold py-3 px-8 rounded-md border-2 transition duration-200 shadow-md text-lg"
        style={{ 
          backgroundColor: 'var(--accent)',
          color: 'var(--parchment)',
          borderColor: 'var(--secondary)',
          boxShadow: `0 4px 8px var(--primary-light)`
        }}
      >
        Begin New Campaign
      </button>
    </div>
  </div>
); 