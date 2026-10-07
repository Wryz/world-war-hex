import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useLoadingManager } from './LoadingManager';
import { PANEL_CLASS } from '../hud/styles';

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
}

const LOADING_TIPS = [
  'Units standing in a forest take 40% less damage.',
  'Pikemen attack 50% harder when fighting from a forest.',
  'Desert costs 2 movement to cross - plan your routes around it.',
  'Hold gold mines with a unit to earn extra gold every turn.',
  'Water and mountains are impassable - look for the passes.',
  'Units within 3 hexes of the enemy castle damage it every turn.',
  'At half health a castle\'s walls break - then a single unit can storm it.',
  'Archers hit from 2 hexes away, where melee units can\'t strike back.',
  'Destroying an enemy unit pays a bounty of half its cost.',
  'Rogues strike from the shadows: enemies can\'t hit back at them.',
  'Keep Mages next to your front line - they heal adjacent allies every turn.',
  'You bring four cards into each battle. Pick ones that counter the enemy before you fight.',
  'A battle ends after its last round: the castle in better shape wins.',
  'Lost a battle? You still earn coins - spend them on upgrades in the Army.',
  'Check the recommended power before a battle. Below it? Upgrade your cards.',
  'Lava burns and cursed ground drains your troops - but the undead love it.'
];

const TIP_INTERVAL = 5000;
// Brief pause on "Ready" before the screen fades away
const READY_HOLD = 400;
const FADE_DURATION = 500;

// Covers the board while the models and sounds download
const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  const { progress, isComplete } = useLoadingManager();
  const [tip, setTip] = useState(() => Math.floor(Math.random() * LOADING_TIPS.length));
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTip(current => (current + 1) % LOADING_TIPS.length), TIP_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isComplete) return;
    const fade = setTimeout(() => setIsFading(true), READY_HOLD);
    const done = setTimeout(() => onLoadingComplete?.(), READY_HOLD + FADE_DURATION);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [isComplete, onLoadingComplete]);

  const percent = Math.round((isComplete ? 1 : progress) * 100);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md transition-opacity ease-out"
      style={{ opacity: isFading ? 0 : 1, transitionDuration: `${FADE_DURATION}ms` }}
      role="status"
      aria-live="polite"
    >
      <div className={`${PANEL_CLASS} w-full max-w-sm p-6 text-center`}>
        <div className="relative mx-auto mb-3 h-20 w-40">
          <Image src="/world-war-hex-logo.png" alt="World War Hex" fill sizes="160px" style={{ objectFit: 'contain' }} priority />
        </div>
        <div className="font-display text-lg text-slate-200">{isComplete ? 'Ready!' : 'Preparing the battlefield'}</div>

        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-700"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${isComplete ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1 text-right text-xs font-bold tabular-nums text-slate-400">{percent}%</div>

        <p className="mt-4 min-h-[2.5rem] text-sm text-slate-300">
          <span className="font-bold text-amber-300">Tip:</span> {LOADING_TIPS[tip]}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
