import React, { useEffect, useState } from 'react';
import { GamePhase, PlayerType } from '@/types/game';
import { SIDE_COLORS } from './styles';
import { AttackIcon } from '../icons';

interface TurnBannerProps {
  phase: GamePhase;
  activePlayer: PlayerType;
  turnNumber: number;
  maxRounds: number;
}

const BANNER_DURATION = 1800;

// Big announcement whenever the turn changes or a battle starts
export const TurnBanner: React.FC<TurnBannerProps> = ({ phase, activePlayer, turnNumber, maxRounds }) => {
  const [banner, setBanner] = useState<{ key: string; title: string; subtitle: string; color: string; isBattle?: boolean } | null>(null);

  useEffect(() => {
    let next: typeof banner = null;

    if (phase === 'planning') {
      const round = turnNumber >= maxRounds ? 'Final round!' : `Round ${turnNumber} of ${maxRounds}`;
      next = activePlayer === 'player'
        ? { key: `p-${turnNumber}`, title: 'Your Turn', subtitle: round, color: SIDE_COLORS.player }
        : { key: `a-${turnNumber}`, title: 'Enemy Turn', subtitle: round, color: SIDE_COLORS.ai };
    } else if (phase === 'combat') {
      next = {
        key: `c-${turnNumber}-${activePlayer}`,
        title: 'Battle!',
        subtitle: activePlayer === 'player' ? 'Your troops attack' : 'You are under attack',
        color: '#f59e0b',
        isBattle: true
      };
    }

    if (!next) return;
    setBanner(next);
    const timeout = setTimeout(() => setBanner(null), BANNER_DURATION);
    return () => clearTimeout(timeout);
  }, [phase, activePlayer, turnNumber, maxRounds]);

  return (
    <div className="fixed inset-x-0 top-1/3 z-30 flex justify-center pointer-events-none" role="status" aria-live="polite">
      {banner && (
        <div key={banner.key} className="animate-banner flex flex-col items-center rounded-2xl bg-slate-900/75 px-8 py-3 shadow-2xl">
          <div className="font-display flex items-center gap-2 text-3xl tracking-wide" style={{ color: banner.color }}>
            {banner.isBattle && <AttackIcon color={banner.color} />}
            {banner.title}
          </div>
          <div className="text-sm font-semibold text-slate-300">{banner.subtitle}</div>
        </div>
      )}
    </div>
  );
};
