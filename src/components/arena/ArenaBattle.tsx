'use client';

import React, { MutableRefObject, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, PlayerType, UnitType } from '@/types/game';
import { ACTION_NAMES, getMaxRounds, getSideView, getStandings } from '@/lib/game/gameState';
import { areAllies, getAllUnits } from '@/lib/game/sides';
import { useMusic, setMusicIntensity } from '@/lib/audio/music';
import { GameBoard } from '../game/GameBoard';
import { CombatResolver } from '../game/combat/CombatResolver';
import { WeatherVeil } from '../game/WeatherEffects';
import { TopBar } from '../game/hud/TopBar';
import { CardHand } from '../game/hud/CardHand';
import { SelectionCard } from '../game/hud/SelectionCard';
import { EventFeed } from '../game/hud/EventFeed';
import { TurnBanner } from '../game/hud/TurnBanner';
import { PANEL_CLASS } from '../game/hud/styles';
import { EffectsLayer } from '../game/effects/EffectsLayer';
import { resetEffects } from '../game/effects/effects';
import { useBattleMoments } from '../game/effects/useBattleMoments';
import { BattleReplay } from '../game/replay/BattleReplay';
import { canReplay, ReplayFrame } from '../game/replay/replay';
import { BattleLink, TurnOrders, useGameHandlers } from '../game/handlers/GameEventHandlers';
import { LoadingManagerProvider } from '../game/utils/LoadingManager';
import LoadingScreen from '../game/utils/LoadingScreen';
import { setMuted, useMuted } from '../game/utils/SoundPlayer';
import { getUnitTypeName } from '../game/utils/UnitHelpers';
import { ActionIcon, ArrowIcon, CrownIcon, WarningIcon } from '../game/icons';
import { registerSides, sideColor } from '../game/sideColors';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../menu/MenuShell';

// What an online battle's page needs from the battle running inside it
export interface ArenaBattleControls {
  applyRemoteOrders: (orders: TurnOrders) => void;
  receiveState: (state: GameState) => void;
  resignSide: (side: PlayerType) => void;
  getState: () => GameState;
}

interface ArenaBattleProps {
  // The battle as it begins (or, for a guest joining late, as it stands)
  state: GameState;
  // The side the viewer plays
  viewer: PlayerType;
  // An online battle's link to the other players
  link?: BattleLink;
  controlsRef?: MutableRefObject<ArenaBattleControls | null>;
  onLeave: () => void;
  // Offline: fight the same battle again
  onPlayAgain?: () => void;
  // A guest giving up: the host is told
  onGuestResign?: () => void;
  // A line about the connection, shown under the top bar online
  status?: ReactNode;
}

// The troops anyone in the battle can field, so their models load before it starts
const troopTypes = (state: GameState): UnitType[] =>
  [...new Set(Object.values(state.rosters ?? {}).flatMap(roster => Object.keys(roster) as UnitType[]))];

// A battle between more sides: a free-for-all or teams, against the AI or online
export const ArenaBattle: React.FC<ArenaBattleProps> = props => {
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = useCallback(() => setLoaded(true), []);
  const [types] = useState(() => troopTypes(props.state));
  return (
    <LoadingManagerProvider types={types}>
      <div className="relative h-full w-full">
        <ArenaBattleInner {...props} isReady={loaded} />
        {!loaded && <LoadingScreen onLoadingComplete={handleLoaded} />}
      </div>
    </LoadingManagerProvider>
  );
};

const ArenaBattleInner: React.FC<ArenaBattleProps & { isReady: boolean }> = ({
  state, viewer, link, controlsRef, onLeave, onPlayAgain, onGuestResign, status, isReady
}) => {
  const isMuted = useMuted();
  const {
    gameState, selectedHex, selectedUnit, validMoves, selectedUnitTypeForPurchase, isAITurn, ordersSent, timer, planningRound, waitingOn,
    handleHexClick, handleUnitSelect, handleUnitPurchase, handleEndTurn, handleUnitTypeSelect,
    handleCancelSelection, handleUndo, handleResign, canUndo, notice, actionChoice, handleActionChoice,
    applyRemoteOrders, receiveState, resignSide, getBattleState, getReplayFrames
  } = useGameHandlers({ battle: { mode: 'quick', difficulty: 'medium' }, resume: false, isReady, viewer, initialState: state, link });

  // The board's pieces wear each side's colour
  registerSides(gameState);
  useMusic('battle');
  useEffect(() => {
    setMusicIntensity(1);
    return () => resetEffects();
  }, []);
  useBattleMoments(gameState, isReady, viewer);

  const battleStateRef = useRef(getBattleState);
  battleStateRef.current = getBattleState;
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = { applyRemoteOrders, receiveState, resignSide, getState: () => battleStateRef.current() };
    return () => { controlsRef.current = null; };
  }, [controlsRef, applyRemoteOrders, receiveState, resignSide]);

  // Stable handlers so the memoised 3D board doesn't re-render on every timer tick
  const hexClickRef = useRef(handleHexClick);
  hexClickRef.current = handleHexClick;
  const unitClickRef = useRef(handleUnitSelect);
  unitClickRef.current = handleUnitSelect;
  const purchaseRef = useRef(handleUnitPurchase);
  purchaseRef.current = handleUnitPurchase;
  const onBoardHexClick = useCallback((...args: Parameters<typeof handleHexClick>) => hexClickRef.current(...args), []);
  const onBoardUnitClick = useCallback((...args: Parameters<typeof handleUnitSelect>) => unitClickRef.current(...args), []);
  const onBoardUnitPurchase = useCallback((...args: Parameters<typeof handleUnitPurchase>) => purchaseRef.current(...args), []);

  // Escape cancels, Ctrl/Cmd+Z takes back the last order
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'Escape') handleCancelSelection();
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancelSelection, handleUndo]);

  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (notice) setToast({ id: notice.id, text: notice.text });
  }, [notice]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timeout);
  }, [toast]);

  const { currentPhase } = gameState;
  const active = gameState.activePlayer ?? viewer;
  const me = gameState.players[viewer];
  const out = !!me?.eliminated;
  // (when everyone plans at once, the turns after the round's planning only carry out what was planned)
  const carryingOut = !!gameState.settings?.simultaneous && !planningRound;
  const isPlanning = currentPhase === 'planning' && !isAITurn && !out && !ordersSent && !carryingOut;
  // What the viewer knows: the fog hides what their side can't see (lifted once they're out)
  const viewState = useMemo(() => (out ? gameState : getSideView(gameState, viewer)), [gameState, viewer, out]);
  // (online in the fog, a guest's copy leaves out what it can't see, but lists every troop there is)
  const unitIds = useMemo(() => new Set(gameState.knownUnitIds ?? getAllUnits(gameState).map(unit => unit.id)), [gameState]);

  // The standings, once the battle is over or the viewer is out of it
  const [showStandings, setShowStandings] = useState(false);
  const [dismissedStandings, setDismissedStandings] = useState(false);
  useEffect(() => {
    if ((currentPhase === 'gameOver' || out) && !dismissedStandings) {
      const timeout = setTimeout(() => setShowStandings(true), currentPhase === 'gameOver' ? 2600 : 1800);
      return () => clearTimeout(timeout);
    }
  }, [currentPhase, out, dismissedStandings]);
  useEffect(() => {
    // (the battle ending brings them back even if they were put away to keep watching)
    if (currentPhase === 'gameOver') setDismissedStandings(false);
  }, [currentPhase]);
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[] | null>(null);

  const hint = selectedUnitTypeForPurchase
    ? `Tap a glowing hex to deploy ${getUnitTypeName(selectedUnitTypeForPurchase)} · Esc to cancel`
    : selectedUnit?.owner === viewer && isPlanning
      ? validMoves.length > 0 ? 'Tap a highlighted hex to move there · Esc to cancel' : "This unit can't move this turn"
      : null;
  const activeName = gameState.players[active]?.name;
  const waitingFor = ordersSent ? 'The host' : active === viewer ? undefined : activeName;
  // Everyone plans the round at once: who it still waits on, once the viewer's orders are in (and
  // while they are carried out, whose they are)
  const names = (sides: PlayerType[]) => sides.map(side => gameState.players[side]?.name ?? side).join(', ');
  const others = waitingOn.filter(side => side !== viewer);
  const waitingLine = planningRound
    ? others.length > 0 ? `Waiting for ${names(others)}…` : 'Everyone is ready…'
    : gameState.settings?.simultaneous
      ? active === viewer ? 'Your orders are carried out…' : `${activeName ?? 'Their'}'s orders are carried out…`
      : undefined;

  return (
    <div className="relative h-full w-full">
      {replayFrames && <BattleReplay frames={replayFrames} viewer={viewer} onClose={() => { resetEffects(); setReplayFrames(null); }} />}
      {!replayFrames && <WeatherVeil gameState={gameState} />}
      {!replayFrames && (
        <GameBoard
          gameState={viewState}
          viewer={viewer}
          unitIds={unitIds}
          selectedHex={selectedHex ?? undefined}
          selectedUnit={selectedUnit}
          validMoves={validMoves}
          selectedUnitTypeForPurchase={selectedUnitTypeForPurchase}
          onHexClick={onBoardHexClick}
          onUnitClick={onBoardUnitClick}
          onUnitPurchase={onBoardUnitPurchase}
        />
      )}

      {!replayFrames && currentPhase !== 'gameOver' && currentPhase !== 'setup' && (
        <>
          <TopBar
            gameState={viewState}
            viewer={viewer}
            isAITurn={isAITurn}
            timer={timer}
            showTimer={isPlanning}
            isMuted={isMuted}
            onToggleMute={() => setMuted(!isMuted)}
            onQuit={onLeave}
            onResign={!out ? () => handleResign(onGuestResign) : undefined}
            resignNote={link ? 'You leave the battle; the others fight on.' : 'Your side is out; the others fight on.'}
          />
          {status && (
            <div className="pointer-events-none fixed inset-x-0 top-[calc(3.75rem+var(--safe-t))] z-20 flex justify-center px-3">
              <span className={`${PANEL_CLASS} px-3 py-1 text-xs font-bold text-slate-200`}>{status}</span>
            </div>
          )}
          <div className="fixed bottom-[calc(10.75rem+var(--safe-b))] left-[calc(0.5rem+var(--safe-l))] z-20 pointer-events-none sm:bottom-auto sm:left-[calc(0.75rem+var(--safe-l))] sm:top-[calc(4rem+var(--safe-t))]">
            <SelectionCard gameState={viewState} selectedHex={selectedHex} selectedUnit={selectedUnit} viewer={viewer} />
          </div>
          <div className="fixed right-[calc(0.75rem+var(--safe-r))] top-[calc(4rem+var(--safe-t))] z-20 hidden max-h-[calc(100vh-17rem-var(--safe-t)-var(--safe-b))] w-64 flex-col gap-2 overflow-y-auto pointer-events-none sm:flex">
            <EventFeed log={gameState.log ?? []} />
          </div>
          <TurnBanner
            phase={currentPhase} activePlayer={active} turnNumber={gameState.turnNumber} maxRounds={getMaxRounds(gameState)}
            viewer={viewer} activeName={activeName} activeIsAlly={areAllies(gameState, active, viewer)}
            simultaneous={!!gameState.settings?.simultaneous} planningRound={planningRound}
          />
        </>
      )}

      {!replayFrames && currentPhase === 'planning' && !out && (
        <CardHand
          gameState={gameState}
          viewer={viewer}
          isAITurn={isAITurn || ordersSent || carryingOut}
          waitingFor={waitingFor}
          waitingLine={waitingLine}
          selectedUnitType={selectedUnitTypeForPurchase}
          hint={hint}
          onCardSelect={handleUnitTypeSelect}
          onEndTurn={handleEndTurn}
          canUndo={canUndo}
          onUndo={handleUndo}
        />
      )}

      {actionChoice && isPlanning && (
        <div className="fixed inset-x-0 bottom-[calc(12rem+var(--safe-b))] z-40 flex justify-center px-3">
          <div className="animate-fadeIn flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-900/95 p-2 shadow-2xl ring-1 ring-white/10" role="group" aria-label="Choose an order">
            {actionChoice.canMove && (
              <button onClick={() => handleActionChoice(null)} className="font-display flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-900 hover:bg-white">
                <ArrowIcon /> Move here
              </button>
            )}
            {actionChoice.actions.map(action => (
              <button key={action} onClick={() => handleActionChoice(action)} className="font-display flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-sm text-slate-900 hover:bg-amber-300">
                <ActionIcon action={action} /> {ACTION_NAMES[action]}
              </button>
            ))}
            <button onClick={handleCancelSelection} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800" aria-label="Cancel">✕</button>
          </div>
        </div>
      )}

      {!replayFrames && currentPhase === 'combat' && <CombatResolver gameState={viewState} viewer={viewer} />}
      <EffectsLayer />

      {showStandings && !replayFrames && (
        <Standings
          gameState={gameState}
          viewer={viewer}
          over={currentPhase === 'gameOver'}
          onKeepWatching={currentPhase === 'gameOver' ? undefined : () => { setShowStandings(false); setDismissedStandings(true); }}
          onLeave={onLeave}
          onPlayAgain={onPlayAgain ? () => { resetEffects(); onPlayAgain(); } : undefined}
          onWatchReplay={currentPhase === 'gameOver' && canReplay(getReplayFrames()) ? () => { resetEffects(); setReplayFrames([...getReplayFrames()]); } : undefined}
        />
      )}

      {toast && (
        <div className="fixed top-[calc(5rem+var(--safe-t))] inset-x-0 z-40 flex justify-center pointer-events-none" role="status" aria-live="polite">
          <div key={toast.id} className="animate-fadeIn flex items-center gap-2 rounded-full bg-amber-500/95 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg">
            <WarningIcon />{toast.text}
          </div>
        </div>
      )}
    </div>
  );
};

const PLACES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

// Where everyone finished: the winners first, then the others by points, and those knocked out last
const Standings: React.FC<{
  gameState: GameState;
  viewer: PlayerType;
  over: boolean;
  onKeepWatching?: () => void;
  onLeave: () => void;
  onPlayAgain?: () => void;
  onWatchReplay?: () => void;
}> = ({ gameState, viewer, over, onKeepWatching, onLeave, onPlayAgain, onWatchReplay }) => {
  const standings = getStandings(gameState);
  const mine = standings.find(standing => standing.sides.includes(viewer));
  const won = over && mine?.place === 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className={`${PANEL_CLASS} w-full max-w-md p-5`} role="dialog" aria-label="Standings">
        <div className={`font-display text-center text-3xl ${won ? 'text-amber-300' : 'text-slate-100'}`}>
          {!over ? 'You are out' : won ? 'Victory!' : `You placed ${PLACES[(mine?.place ?? 1) - 1] ?? ''}`}
        </div>
        <p className="mt-1 text-center text-sm text-slate-400">
          {over
            ? gameState.winReason === 'timeout' ? 'Time ran out: decided on points' : 'The last team standing wins'
            : 'Your castle has fallen - you can watch the rest of the battle'}
        </p>
        <ol className="mt-4 flex flex-col gap-1.5">
          {standings.map(standing => (
            <li key={standing.sides.join(',')} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${standing.sides.includes(viewer) ? 'bg-slate-700/80' : 'bg-slate-800/70'}`}>
              <span className="font-display w-9 text-lg text-slate-300">{over || standing.eliminatedOnTurn !== undefined ? PLACES[standing.place - 1] : '-'}</span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
                {standing.sides.map(side => (
                  <span key={side} className="flex items-center gap-1 font-bold" style={{ color: sideColor(side) }}>
                    <CrownIcon color={sideColor(side)} />
                    <span className="truncate">{gameState.players[side]?.name ?? side}{side === viewer ? ' (you)' : ''}</span>
                  </span>
                ))}
              </span>
              <span className="text-xs font-bold tabular-nums text-slate-300">
                {standing.eliminatedOnTurn !== undefined ? `out in round ${standing.eliminatedOnTurn}` : `${standing.score} pts`}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-center text-xs text-slate-500">No coins are won or lost in these battles.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {onKeepWatching && <button className={SECONDARY_BUTTON} onClick={onKeepWatching}>Keep watching</button>}
          {onWatchReplay && <button className={SECONDARY_BUTTON} onClick={onWatchReplay}>Watch the replay</button>}
          {onPlayAgain && over && <button className={PRIMARY_BUTTON} onClick={onPlayAgain}>Play again</button>}
          <button className={over && !onPlayAgain ? PRIMARY_BUTTON : SECONDARY_BUTTON} onClick={onLeave}>Leave</button>
        </div>
      </div>
    </div>
  );
};
