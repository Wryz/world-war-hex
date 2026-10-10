import React, { useEffect, useState } from 'react';
import { GamePhase, PlayerType } from '@/types/game';
import { sideColor } from '../sideColors';
import { AttackIcon } from '../icons';

interface TurnBannerProps {
  phase: GamePhase;
  activePlayer: PlayerType;
  turnNumber: number;
  maxRounds: number;
  // The side the battle is seen from, and in a battle between more sides the name of the side whose
  // turn it is (and whether it fights on yours)
  viewer?: PlayerType;
  activeName?: string;
  activeIsAlly?: boolean;
  // Everyone plans each round at once (and whether the round is being planned now, rather than the
  // sides' orders carried out one after another)
  simultaneous?: boolean;
  planningRound?: boolean;
}

const BANNER_DURATION = 1800;

// Big announcement whenever the turn changes or a battle starts
export const TurnBanner: React.FC<TurnBannerProps> = ({
  phase, activePlayer, turnNumber, maxRounds, viewer = 'player', activeName, activeIsAlly = false, simultaneous = false, planningRound = false
}) => {
  const [banner, setBanner] = useState<{ key: string; title: string; subtitle: string; color: string; isBattle?: boolean } | null>(null);

  useEffect(() => {
    let next: typeof banner = null;

    if (phase === 'planning' && simultaneous) {
      const round = turnNumber >= maxRounds ? 'Final round!' : `Round ${turnNumber} of ${maxRounds}`;
      next = planningRound
        ? { key: `r-${turnNumber}`, title: 'Plan Your Moves', subtitle: `${round} · everyone plans at once`, color: sideColor(viewer) }
        : {
          key: `o-${turnNumber}-${activePlayer}`,
          title: activePlayer === viewer ? 'Your Orders' : `${activeName ?? 'Enemy'}'s Orders`,
          subtitle: round,
          color: sideColor(activePlayer)
        };
    } else if (phase === 'planning') {
      const round = turnNumber >= maxRounds ? 'Final round!' : `Round ${turnNumber} of ${maxRounds}`;
      next = activePlayer === viewer
        ? { key: `p-${turnNumber}-${activePlayer}`, title: 'Your Turn', subtitle: round, color: sideColor(activePlayer) }
        : { key: `a-${turnNumber}-${activePlayer}`, title: activeName ? `${activeName}'s Turn` : 'Enemy Turn', subtitle: round, color: sideColor(activePlayer) };
    } else if (phase === 'combat') {
      next = {
        key: `c-${turnNumber}-${activePlayer}`,
        title: 'Battle!',
        subtitle: activePlayer === viewer ? 'Your troops attack'
          : activeName ? `${activeName}${activeIsAlly ? ' (your ally)' : ''} attacks` : 'You are under attack',
        color: '#f59e0b',
        isBattle: true
      };
    }

    if (!next) return;
    setBanner(next);
    const timeout = setTimeout(() => setBanner(null), BANNER_DURATION);
    return () => clearTimeout(timeout);
  }, [phase, activePlayer, turnNumber, maxRounds, viewer, activeName, activeIsAlly, simultaneous, planningRound]);

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
