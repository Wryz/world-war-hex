import React from 'react';
import { PANEL_CLASS } from '../hud/styles';
import { CastleIcon, CrownIcon } from '../icons';

interface GameOverScreenProps {
  winner: 'player' | 'ai';
  onRestart: () => void;
  onMainMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, onRestart, onMainMenu }) => (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60">
    <div className={`${PANEL_CLASS} max-w-md p-8 text-center`}>
      <div className="flex justify-center text-7xl">
        {winner === 'player' ? <CrownIcon /> : <CastleIcon color="#94a3b8" />}
      </div>
      <h1 className={`font-display mt-2 text-4xl ${winner === 'player' ? 'text-amber-300' : 'text-red-400'}`}>
        {winner === 'player' ? 'Victory!' : 'Defeat!'}
      </h1>
      <p className="mt-3 text-lg text-slate-300">
        {winner === 'player'
          ? 'You have conquered the enemy and claimed their lands!'
          : 'Your castle has fallen. Your kingdom is lost!'}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          onClick={onRestart}
          className="font-display rounded-lg bg-amber-500 hover:bg-amber-400 px-6 py-3 text-lg text-slate-900 shadow"
        >
          Begin New Campaign
        </button>
        <button
          onClick={onMainMenu}
          className="font-display rounded-lg bg-slate-700 hover:bg-slate-600 px-6 py-3 text-lg text-slate-100 shadow"
        >
          Main Menu
        </button>
      </div>
    </div>
  </div>
);
