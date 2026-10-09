import React, { useRef } from 'react';
import { GameState } from '@/types/game';
import { getTroopName } from '@/lib/game/gameState';
import { getBossPower, isBossEnraged } from '@/lib/game/bosses';
import { PANEL_CLASS } from './styles';
import { useShownHealth, useShownHealthOf } from '../effects/healthTimeline';
import { BossIcon, BossPowerIcon, FireIcon } from '../icons';

// The boss's own health bar, under the castles while it lives: its health, whether it is enraged
// (the bar burns), and its power - lit when it is ready or has marked the ground, with a pip for each
// turn it still needs otherwise
export const BossBar: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const live = gameState.players.ai.units.find(unit => unit.isBoss);
  // (a boss just destroyed outside a fight stays until the board shows its fatal blow land)
  const lastRef = useRef(live);
  if (live) lastRef.current = live;
  const lastShown = useShownHealthOf(lastRef.current?.id);
  const boss = live ?? (lastShown !== undefined ? lastRef.current : undefined);
  // (its health as the board shows it: a blow counts once it has landed)
  const health = useShownHealth(boss) ?? 0;
  if (!boss) return null;
  const power = getBossPower(boss.type);
  const ratio = Math.max(0, health) / Math.max(1, boss.maxLifespan);
  const enraged = isBossEnraged({ ...boss, lifespan: health });
  const waiting = boss.threat ? 0 : boss.powerCooldown ?? 0;
  const name = getTroopName(boss.type).split(/,| the /)[0];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.6rem] z-20 flex justify-center px-3">
      <div
        className={`${PANEL_CLASS} pointer-events-auto flex w-[min(22rem,62vw)] items-center gap-2 px-2.5 py-1.5 ${enraged ? 'ring-2 ring-red-500/80 shadow-[0_0_16px_#ef4444]' : ''}`}
        title={`${getTroopName(boss.type)}: ${Math.max(0, health)}/${boss.maxLifespan}${power ? ` · ${power.name}` : ''}${enraged ? ' · enraged' : ''}`}
      >
        <BossIcon className="shrink-0 text-lg" color="#f87171" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[0.6875rem] font-bold leading-none">
            <span className="truncate text-rose-100">{name}</span>
            <span className="flex items-center gap-1 tabular-nums text-rose-200">
              {enraged && <FireIcon className="animate-pulse" />}
              {Math.max(0, health)}
            </span>
          </div>
          <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-slate-700">
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-700 ${enraged ? 'animate-pulse' : ''}`}
              style={{ width: `${ratio * 100}%`, background: enraged ? 'linear-gradient(90deg,#f97316,#dc2626)' : '#dc2626' }}
            />
          </div>
        </div>
        {power && (
          <div className="flex shrink-0 flex-col items-center gap-0.5" aria-label={power.name}>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-base ${waiting === 0 ? 'bg-red-600 ring-2 ring-red-200 shadow-[0_0_10px_#ef4444]' : 'bg-slate-700 opacity-70'}`}
            >
              <BossPowerIcon power={power.id} color={waiting === 0 ? '#fff' : undefined} />
            </span>
            {waiting > 0 && (
              <span className="flex gap-0.5">
                {Array.from({ length: waiting }, (_, i) => <span key={i} className="h-1 w-1 rounded-full bg-slate-400" />)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
