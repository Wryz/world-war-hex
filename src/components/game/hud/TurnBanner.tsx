import React, { useEffect, useState } from 'react';
import { GamePhase, PlayerType } from '@/types/game';
import { SIDE_COLORS } from './styles';

interface TurnBannerProps {
  phase: GamePhase;
  activePlayer: PlayerType;
  turnNumber: number;
}

const BANNER_DURATION = 1800;

// Big announcement whenever the turn changes or a battle starts
export const TurnBanner: React.FC<TurnBannerProps> = ({ phase, activePlayer, turnNumber }) => {
  const [banner, setBanner] = useState<{ key: string; title: string; subtitle: string; color: string } | null>(null);

  useEffect(() => {
    let next: typeof banner = null;

    if (phase === 'planning') {
      next = activePlayer === 'player'
        ? { key: `p-${turnNumber}`, title: 'Your Turn', subtitle: `Round ${turnNumber}`, color: SIDE_COLORS.player }
        : { key: `a-${turnNumber}`, title: 'Enemy Turn', subtitle: `Round ${turnNumber}`, color: SIDE_COLORS.ai };
    } else if (phase === 'combat') {
      next = {
        key: `c-${turnNumber}-${activePlayer}`,
        title: '⚔️ Battle!',
        subtitle: activePlayer === 'player' ? 'Your troops attack' : 'You are under attack',
        color: '#f59e0b'
      };
    }

    if (!next) return;
    setBanner(next);
    const timeout = setTimeout(() => setBanner(null), BANNER_DURATION);
    return () => clearTimeout(timeout);
  }, [phase, activePlayer, turnNumber]);

  if (!banner) return null;

  return (
    <div className="fixed inset-x-0 top-1/3 z-30 flex justify-center pointer-events-none">
      <div key={banner.key} className="animate-banner flex flex-col items-center rounded-2xl bg-slate-900/75 px-8 py-3 shadow-2xl">
        <div className="font-display text-3xl tracking-wide" style={{ color: banner.color }}>{banner.title}</div>
        <div className="text-sm font-semibold text-slate-300">{banner.subtitle}</div>
      </div>
    </div>
  );
};
