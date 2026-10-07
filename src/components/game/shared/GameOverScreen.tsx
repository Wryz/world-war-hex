import React from 'react';
import { PANEL_CLASS } from '../hud/styles';

interface GameOverScreenProps {
  winner: 'player' | 'ai';
  onRestart: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, onRestart }) => (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60">
    <div className={`${PANEL_CLASS} max-w-md p-8 text-center`}>
      <div className="text-6xl">{winner === 'player' ? '👑' : '🏚️'}</div>
      <h1 className={`mt-2 text-4xl font-black ${winner === 'player' ? 'text-amber-300' : 'text-red-400'}`}>
        {winner === 'player' ? 'Victory!' : 'Defeat!'}
      </h1>
      <p className="mt-3 text-lg text-slate-300">
        {winner === 'player'
          ? 'You have conquered the enemy and claimed their lands!'
          : 'Your castle has fallen. Your kingdom is lost!'}
      </p>
      <button
        onClick={onRestart}
        className="mt-6 rounded-lg bg-amber-500 hover:bg-amber-400 px-8 py-3 text-lg font-bold text-slate-900 shadow"
      >
        Begin New Campaign
      </button>
    </div>
  </div>
);
