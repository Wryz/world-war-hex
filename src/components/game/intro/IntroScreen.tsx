import React, { useState } from 'react';
import Image from 'next/image';
import HexBackground from './HexBackground';
import { AttackIcon, ResumeIcon, ShieldIcon, SkullIcon } from '../icons';
import { PANEL_CLASS } from '../hud/styles';
import { Difficulty } from '../storage/GameStorage';

export interface IntroScreenProps {
  onStartGame: (difficulty: Difficulty) => void;
  onContinueGame?: () => void;
  hasSavedGame?: boolean;
}

const DIFFICULTY_OPTIONS: { level: Difficulty; label: string; description: string; Icon: typeof ShieldIcon }[] = [
  { level: 'easy', label: 'Easy', description: 'A cautious enemy', Icon: ShieldIcon },
  { level: 'medium', label: 'Medium', description: 'A fair fight', Icon: AttackIcon },
  { level: 'hard', label: 'Hard', description: 'A ruthless warlord', Icon: SkullIcon }
];

const IntroScreen: React.FC<IntroScreenProps> = ({
  onStartGame,
  onContinueGame,
  hasSavedGame = false
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <HexBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className={`${PANEL_CLASS} w-full max-w-2xl p-6 md:p-8`}>
          <div className="mb-4 flex justify-center">
            <Image
              src="/world-war-hex-logo.png"
              alt="World War Hex"
              width={200}
              height={200}
              className="h-auto max-w-[160px] md:max-w-[200px]"
              priority
            />
          </div>

          <p className="mb-8 text-center text-lg text-slate-300 md:text-xl">
            Conquer the hexagonal battlefield and claim victory!
          </p>

          <h2 className="font-display mb-4 text-center text-2xl text-amber-300">Choose your challenge</h2>

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Difficulty">
            {DIFFICULTY_OPTIONS.map(({ level, label, description, Icon }) => {
              const isSelected = selectedDifficulty === level;
              return (
                <button
                  key={level}
                  onClick={() => setSelectedDifficulty(level)}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center rounded-xl px-4 py-4 transition-colors ${
                    isSelected
                      ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-200'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  <span className="font-display flex items-center gap-2 text-xl">
                    <Icon color="currentColor" /> {label}
                  </span>
                  <span className={`mt-1 text-sm ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>{description}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => onStartGame(selectedDifficulty)}
              className="font-display rounded-xl bg-amber-500 px-8 py-3 text-xl text-slate-900 shadow transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              <span className="inline-flex items-center gap-2"><AttackIcon color="currentColor" /> Begin Conquest</span>
            </button>

            {hasSavedGame && onContinueGame && (
              <button
                onClick={onContinueGame}
                className="font-display rounded-xl bg-slate-700 px-8 py-3 text-xl text-slate-100 shadow transition-colors hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <span className="inline-flex items-center gap-2"><ResumeIcon /> Continue Battle</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;
