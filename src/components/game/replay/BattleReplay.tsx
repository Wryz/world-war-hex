import React, { useEffect, useMemo } from 'react';
import type { GameState, PlayerType } from '@/types/game';
import { getMaxRounds } from '@/lib/game/gameState';
import { areAllies, getAllUnits } from '@/lib/game/sides';
import { GameBoard } from '../GameBoard';
import { WeatherVeil } from '../WeatherEffects';
import { CombatResolver } from '../combat/CombatResolver';
import { BossBar } from '../hud/BossBar';
import { EventFeed } from '../hud/EventFeed';
import { TurnBanner } from '../hud/TurnBanner';
import { useBattleMoments } from '../effects/useBattleMoments';
import { ReplayBar } from './ReplayBar';
import { ReplayFrame, useReplayPlayer } from './replay';
import { holdVibration } from '@/lib/haptics';

// Nothing on the board can be ordered about while it's being watched
const ignore = () => undefined;
const ignorePurchase = () => false;

// One showing of the replay: a board of its own, so its animations, timelines and callouts start
// afresh each time it's watched
const ReplayScene: React.FC<{ state: GameState; viewer: PlayerType }> = ({ state, viewer }) => {
  useBattleMoments(state, true, viewer);
  const unitIds = useMemo(() => new Set(getAllUnits(state).map(unit => unit.id)), [state]);
  const active = state.activePlayer ?? 'player';
  const { currentPhase } = state;
  return (
    <>
      <WeatherVeil gameState={state} />
      <GameBoard gameState={state} unitIds={unitIds} onHexClick={ignore} onUnitClick={ignore} onUnitPurchase={ignorePurchase} viewer={viewer} />
      <BossBar gameState={state} />
      <div className="fixed right-[calc(0.75rem+var(--safe-r))] top-[calc(4rem+var(--safe-t))] z-20 hidden max-h-[calc(100vh-6rem-var(--safe-t)-var(--safe-b))] w-64 flex-col gap-2 overflow-y-auto pointer-events-none sm:flex">
        <EventFeed log={state.log ?? []} />
      </div>
      <TurnBanner
        phase={currentPhase} activePlayer={active} turnNumber={state.turnNumber} maxRounds={getMaxRounds(state)}
        viewer={viewer} activeName={state.sides ? state.players[active]?.name : undefined} activeIsAlly={areAllies(state, active, viewer)}
      />
      {currentPhase === 'combat' && <CombatResolver gameState={state} viewer={viewer} />}
    </>
  );
};

// Watch the battle just fought again, fog lifted, at the pace it was fought (see replay.ts)
export const BattleReplay: React.FC<{ frames: ReplayFrame[]; onClose: () => void; viewer?: PlayerType }> = ({ frames, onClose, viewer = 'player' }) => {
  const replay = useReplayPlayer(frames);
  useEffect(() => holdVibration(), []);
  return (
    <div className="relative h-full w-full">
      <ReplayScene key={replay.showing} state={replay.state} viewer={viewer} />
      <ReplayBar replay={replay} onClose={onClose} />
    </div>
  );
};
