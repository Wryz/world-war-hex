import React, { useMemo } from 'react';
import type { GameState } from '@/types/game';
import { getMaxRounds } from '@/lib/game/gameState';
import { GameBoard } from '../GameBoard';
import { WeatherVeil } from '../WeatherEffects';
import { CombatResolver } from '../combat/CombatResolver';
import { BossBar } from '../hud/BossBar';
import { EventFeed } from '../hud/EventFeed';
import { TurnBanner } from '../hud/TurnBanner';
import { useBattleMoments } from '../effects/useBattleMoments';
import { ReplayBar } from './ReplayBar';
import { ReplayFrame, useReplayPlayer } from './replay';

// Nothing on the board can be ordered about while it's being watched
const ignore = () => undefined;
const ignorePurchase = () => false;

// One showing of the replay: a board of its own, so its animations, timelines and callouts start
// afresh each time it's watched
const ReplayScene: React.FC<{ state: GameState }> = ({ state }) => {
  useBattleMoments(state, true);
  const unitIds = useMemo(
    () => new Set([...state.players.player.units, ...state.players.ai.units].map(unit => unit.id)),
    [state.players]
  );
  const { currentPhase } = state;
  return (
    <>
      <WeatherVeil gameState={state} />
      <GameBoard gameState={state} unitIds={unitIds} onHexClick={ignore} onUnitClick={ignore} onUnitPurchase={ignorePurchase} />
      <BossBar gameState={state} />
      <div className="fixed right-[calc(0.75rem+var(--safe-r))] top-[calc(4rem+var(--safe-t))] z-20 hidden max-h-[calc(100vh-6rem-var(--safe-t)-var(--safe-b))] w-64 flex-col gap-2 overflow-y-auto pointer-events-none sm:flex">
        <EventFeed log={state.log ?? []} />
      </div>
      <TurnBanner phase={currentPhase} activePlayer={state.activePlayer ?? 'player'} turnNumber={state.turnNumber} maxRounds={getMaxRounds(state)} />
      {currentPhase === 'combat' && <CombatResolver gameState={state} />}
    </>
  );
};

// Watch the battle just fought again, fog lifted, at the pace it was fought (see replay.ts)
export const BattleReplay: React.FC<{ frames: ReplayFrame[]; onClose: () => void }> = ({ frames, onClose }) => {
  const replay = useReplayPlayer(frames);
  return (
    <div className="relative h-full w-full">
      <ReplayScene key={replay.showing} state={replay.state} />
      <ReplayBar replay={replay} onClose={onClose} />
    </div>
  );
};
