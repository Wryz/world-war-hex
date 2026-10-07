import React, { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { UNITS } from '@/lib/game/gameState';
import { getUnitTypeName } from '../utils/UnitHelpers';
import { RECRUITABLE, UNIT_ROLES } from '../hud/unitInfo';
import {
  AttackIcon, CampIcon, CrownIcon, GoldIcon, HealthIcon, MoveIcon, ResumeIcon, ShieldIcon, SkullIcon, TerrainIcon, UnitIcon
} from '../icons';
import { Difficulty } from '../storage/GameStorage';

// The 3D island needs WebGL, so it only renders in the browser
const IslandDiorama = dynamic(() => import('./IslandDiorama'), { ssr: false });

export interface IntroScreenProps {
  onStartGame: (difficulty: Difficulty) => void;
  onContinueGame?: () => void;
  hasSavedGame?: boolean;
}

const DIFFICULTY_OPTIONS: { level: Difficulty; label: string; description: string; Icon: typeof ShieldIcon }[] = [
  { level: 'easy', label: 'Easy', description: 'A cautious foe', Icon: ShieldIcon },
  { level: 'medium', label: 'Medium', description: 'A fair fight', Icon: AttackIcon },
  { level: 'hard', label: 'Hard', description: 'A ruthless warlord', Icon: SkullIcon }
];

// The game in four beats, shown under the menu
const HOW_TO_WIN: { icon: React.ReactNode; text: string }[] = [
  { icon: <GoldIcon />, text: 'Recruit troops' },
  { icon: <TerrainIcon terrain="hills" />, text: 'Use the terrain' },
  { icon: <CampIcon />, text: 'Capture camps' },
  { icon: <CrownIcon />, text: 'Storm the castle' }
];

// Chunky dark panel with a solid drop shadow, like a game card
const CARD_CLASS = 'rounded-2xl bg-slate-900/90 text-slate-100 ring-1 ring-white/10 shadow-[0_6px_0_rgba(15,23,42,0.45)] backdrop-blur-sm';

const Cloud: React.FC<{ className: string; delay: string; duration: string }> = ({ className, delay, duration }) => (
  <div
    className={`animate-drift pointer-events-none absolute ${className}`}
    style={{ animationDelay: delay, animationDuration: duration }}
    aria-hidden
  >
    <div className="relative h-10 w-36 rounded-full bg-white/80">
      <div className="absolute -top-6 left-6 h-14 w-14 rounded-full bg-white/80" />
      <div className="absolute -top-9 left-16 h-16 w-16 rounded-full bg-white/80" />
    </div>
  </div>
);

const IntroScreen: React.FC<IntroScreenProps> = ({
  onStartGame,
  onContinueGame,
  hasSavedGame = false
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');
  const [themeName, setThemeName] = useState<string | null>(null);

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-x-hidden lg:block"
      style={{ background: 'radial-gradient(ellipse at 65% 45%, #e0f4ff 0%, #b3e1ff 55%, #8ccfff 100%)' }}
    >
      <Cloud className="top-[8%]" delay="-8s" duration="70s" />
      <Cloud className="top-[22%] scale-75 opacity-80" delay="-40s" duration="90s" />
      <Cloud className="top-[70%] scale-90 opacity-70" delay="-22s" duration="80s" />

      {/* A living battlefield made of the game's own pieces */}
      <div className="relative order-2 h-[44vh] min-h-[280px] lg:absolute lg:inset-y-0 lg:left-[32%] lg:right-0 lg:h-auto">
        <IslandDiorama onThemeChange={setThemeName} />
        {themeName && (
          <div className="pointer-events-none absolute bottom-4 right-4 lg:bottom-8 lg:right-8">
            <div key={themeName} className={`${CARD_CLASS} animate-fadeIn px-4 py-2 text-right`}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Every map is different</div>
              <div className="font-display text-lg text-amber-300">{themeName}</div>
            </div>
          </div>
        )}
      </div>

      <main className="relative z-10 order-1 flex flex-col justify-center px-4 pt-8 pb-4 sm:px-8 lg:min-h-screen lg:max-w-[42rem] lg:px-14 lg:py-10 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Wordmark */}
          <div className="flex items-center gap-4">
            <Image
              src="/world-war-hex-logo.png"
              alt=""
              width={112}
              height={112}
              className="animate-bob h-20 w-20 drop-shadow-[0_6px_0_rgba(15,23,42,0.35)] sm:h-28 sm:w-28"
              priority
            />
            <h1 className="font-display leading-[0.85]">
              <span className="block text-2xl text-slate-800 sm:text-3xl">World War</span>
              <span
                className="block text-6xl text-amber-400 sm:text-8xl"
                style={{ WebkitTextStroke: '3px #0f172a', paintOrder: 'stroke fill', textShadow: '0 6px 0 #0f172a' }}
              >
                HEX
              </span>
            </h1>
          </div>
          <p className="mt-4 max-w-lg text-lg font-semibold text-slate-700">
            Raise an army, read the land and seize the enemy crown.
          </p>

          {/* Menu */}
          <div className={`${CARD_CLASS} mt-6 max-w-lg p-4 sm:p-5`}>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Choose your challenge</div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Difficulty">
              {DIFFICULTY_OPTIONS.map(({ level, label, description, Icon }) => {
                const isSelected = selectedDifficulty === level;
                return (
                  <button
                    key={level}
                    onClick={() => setSelectedDifficulty(level)}
                    aria-pressed={isSelected}
                    className={`flex flex-col items-center rounded-xl px-2 py-2.5 transition-transform active:translate-y-0.5 ${
                      isSelected
                        ? 'bg-amber-400 text-slate-900 shadow-[0_4px_0_#b45309]'
                        : 'bg-slate-800 text-slate-100 shadow-[0_4px_0_#020617] hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-display flex items-center gap-1.5 text-lg"><Icon color="currentColor" /> {label}</span>
                    <span className={`text-[11px] leading-tight ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>{description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => onStartGame(selectedDifficulty)}
                className="font-display flex-1 rounded-xl bg-amber-500 px-6 py-3 text-xl text-slate-900 shadow-[0_5px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-1 active:shadow-[0_1px_0_#b45309] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                <span className="inline-flex items-center gap-2"><AttackIcon color="currentColor" /> Begin Conquest</span>
              </button>
              {hasSavedGame && onContinueGame && (
                <button
                  onClick={onContinueGame}
                  className="font-display rounded-xl bg-slate-700 px-5 py-3 text-lg text-slate-100 shadow-[0_5px_0_#020617] transition-transform hover:-translate-y-0.5 hover:bg-slate-600 active:translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  <span className="inline-flex items-center gap-2"><ResumeIcon /> Continue</span>
                </button>
              )}
            </div>
          </div>

          {/* The army you command */}
          <div className="mt-5 max-w-lg">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-600">Your army</div>
            <div className="grid grid-cols-4 gap-2">
              {RECRUITABLE.map(type => {
                const info = UNITS[type];
                return (
                  <div key={type} className={`${CARD_CLASS} group flex flex-col items-center px-1 py-2 text-center transition-transform hover:-translate-y-1`}>
                    <UnitIcon type={type} className="text-2xl transition-transform group-hover:scale-110" />
                    <div className="mt-1 text-[11px] font-bold leading-tight">{getUnitTypeName(type)}</div>
                    <div className="text-[10px] leading-tight text-slate-400">{UNIT_ROLES[type]}</div>
                    <div className="mt-1 flex gap-1.5 text-[10px] font-bold tabular-nums text-slate-300">
                      <span className="flex items-center gap-0.5" title="Attack"><AttackIcon />{info.attackPower}</span>
                      <span className="flex items-center gap-0.5" title="Health"><HealthIcon />{info.maxLifespan}</span>
                      <span className="flex items-center gap-0.5" title="Movement"><MoveIcon />{info.movementRange}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-0.5 text-[11px] font-bold text-amber-300"><GoldIcon />{info.cost}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* How to win */}
          <ol className="mt-4 flex max-w-lg flex-wrap gap-2">
            {HOW_TO_WIN.map(({ icon, text }, index) => (
              <li key={text} className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm">
                <span className="text-slate-400">{index + 1}</span> {icon} {text}
              </li>
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
};

export default IntroScreen;
