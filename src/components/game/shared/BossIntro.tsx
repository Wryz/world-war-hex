import React, { useEffect, useRef } from 'react';
import { TROOPS, TroopId } from '@/lib/game/troops';
import { playStinger } from '@/lib/audio/music';
import { TroopCard } from '../cards/TroopCard';
import { getBossPower } from '@/lib/game/bosses';
import { BossIcon, BossPowerIcon } from '../icons';

interface BossIntroProps {
  boss: TroopId;
  level: number;
  onDone: () => void;
}

const INTRO_DURATION = 3200;

// Dramatic card announcing the boss before a boss battle
export const BossIntro: React.FC<BossIntroProps> = ({ boss, level, onDone }) => {
  const troop = TROOPS[boss];
  const power = getBossPower(boss);
  // The parent re-renders every second (turn timer), so hold on to the latest callback
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    playStinger('bossAppears');
    const timeout = setTimeout(() => onDoneRef.current(), INTRO_DURATION);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <button
      type="button"
      onClick={onDone}
      className="animate-fadeIn fixed inset-0 z-[50] flex cursor-pointer items-center justify-center bg-red-950/90 px-4"
      aria-label="Continue"
    >
      <div className="moment-pop moment-big flex max-w-md flex-col items-center text-center" style={{ animationDuration: `${INTRO_DURATION}ms` }}>
        <div className="font-display flex items-center gap-2 text-xl tracking-widest text-red-400">
          <BossIcon /> BOSS BATTLE <BossIcon />
        </div>
        <TroopCard type={boss} level={level} size="lg" className="mt-4 rotate-[-3deg]" />
        <h2
          className="font-display mt-4 text-3xl text-amber-300 sm:text-4xl"
          style={{ WebkitTextStroke: '2px #0f172a', paintOrder: 'stroke fill', textShadow: '0 4px 0 #0f172a' }}
        >
          {troop.name}
        </h2>
        <p className="mt-2 text-sm italic text-slate-300">{troop.lore}</p>
        {power && (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-sm font-bold text-white ring-2 ring-red-200 shadow-[0_0_14px_#ef4444]">
            <BossPowerIcon power={power.id} color="#fff" className="text-lg" />{power.name}
          </span>
        )}
        <p className="mt-3 text-xs text-slate-500">It guards the enemy castle. Tap to begin.</p>
      </div>
    </button>
  );
};
