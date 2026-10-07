import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from './GameBoard';
import { SetupPhase } from './phases/SetupPhase';
import { CombatResolver } from './combat/CombatResolver';
import { GameOverScreen } from './shared/GameOverScreen';
import { useGameHandlers } from './handlers/GameEventHandlers';
import { LoadingManagerProvider } from './utils/LoadingManager';
import LoadingScreen from './utils/LoadingScreen';
import { setMuted, useMuted } from './utils/SoundPlayer';
import { Difficulty } from './storage/GameStorage';
import { TopBar } from './hud/TopBar';
import { ActionBar } from './hud/ActionBar';
import { SelectionCard } from './hud/SelectionCard';
import { EventFeed } from './hud/EventFeed';
import { HelpPanel } from './hud/HelpPanel';
import { TurnBanner } from './hud/TurnBanner';
import { getUnitTypeName } from './utils/UnitHelpers';
import { WarningIcon } from './icons';

interface GameControllerProps {
  initialDifficulty?: Difficulty;
  // Continue the saved game if there is one
  shouldContinueGame?: boolean;
}

// Returns a function with a stable identity that always calls the latest version of `fn`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStableCallback = <T extends (...args: any[]) => any>(fn: T): T => {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
};

// The inner game component that uses the preloaded assets
const GameControllerInner: React.FC<GameControllerProps & { isReady: boolean }> = ({
  initialDifficulty = 'medium',
  shouldContinueGame = false,
  isReady
}) => {
  const router = useRouter();
  const isMuted = useMuted();

  // Use our custom hook to handle all game logic
  const {
    gameState,
    selectedHex,
    selectedUnit,
    validMoves,
    selectedUnitTypeForPurchase,
    isAITurn,
    timer,
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleEndTurn,
    handleRestart,
    saveGame,
    handleUnitTypeSelect,
    handleCancelSelection,
    notice
  } = useGameHandlers({ initialDifficulty, resume: shouldContinueGame, isReady });

  const [toast, setToast] = useState<{ id: number; text: string; isWarning?: boolean } | null>(null);

  // Stable handlers so the memoised 3D board doesn't re-render on every timer tick
  const onBoardHexClick = useStableCallback(handleHexClick);
  const onBoardUnitClick = useStableCallback(handleUnitSelect);
  const onBoardUnitPurchase = useStableCallback(handleUnitPurchase);

  // Escape cancels the current selection
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCancelSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancelSelection]);

  // Warnings from the game (e.g. picking a hex a unit can't reach) appear as a brief toast
  useEffect(() => {
    if (notice) setToast({ id: notice.id, text: notice.text, isWarning: true });
  }, [notice]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.isWarning ? 1800 : 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const handleSave = () => {
    const saved = saveGame();
    setToast({ id: Date.now(), text: saved ? 'Game saved' : 'Could not save the game' });
  };

  // Leave for the main menu; the game is saved so it can be continued from there
  const handleQuit = () => {
    saveGame();
    router.push('/');
  };

  const { currentPhase } = gameState;
  const activePlayer = gameState.activePlayer ?? 'player';
  const isPlayerPlanning = currentPhase === 'planning' && !isAITurn;

  // Short instruction while the player is in the middle of an action
  const hint = selectedUnitTypeForPurchase
    ? validMoves.length > 0
      ? `Click a blue hex twice to deploy ${getUnitTypeName(selectedUnitTypeForPurchase)} · Esc to cancel`
      : 'No free hex next to your castle · Esc to cancel'
    : selectedUnit?.owner === 'player' && isPlayerPlanning
      ? validMoves.length > 0
        ? 'Click a highlighted hex to move there · Esc to cancel'
        : "This unit can't move this turn"
      : null;

  return (
    <div className="relative w-full h-full">
      <GameBoard
        gameState={gameState}
        selectedHex={selectedHex ?? undefined}
        selectedUnit={selectedUnit}
        validMoves={validMoves}
        selectedUnitTypeForPurchase={selectedUnitTypeForPurchase}
        onHexClick={onBoardHexClick}
        onUnitClick={onBoardUnitClick}
        onUnitPurchase={onBoardUnitPurchase}
      />

      {currentPhase === 'setup' && (
        <SetupPhase
          isConfirmMode={!!selectedHex}
          selectedHexValid={!!selectedHex && validMoves.some(
            coords => coords.q === selectedHex.coordinates.q && coords.r === selectedHex.coordinates.r
          )}
        />
      )}

      {(currentPhase === 'planning' || currentPhase === 'combat') && (
        <>
          <TopBar
            gameState={gameState}
            isAITurn={isAITurn}
            timer={timer}
            showTimer={isPlayerPlanning}
            onSave={isPlayerPlanning ? handleSave : undefined}
            isMuted={isMuted}
            onToggleMute={() => setMuted(!isMuted)}
            onQuit={handleQuit}
          />
          <div className="fixed left-3 top-16 z-20 pointer-events-none">
            <SelectionCard gameState={gameState} selectedHex={selectedHex} selectedUnit={selectedUnit} />
          </div>
          {/* Capped above the battle card and action bar so panels never run under them */}
          <div className="fixed right-3 top-16 z-20 hidden max-h-[calc(100vh-15rem)] w-64 flex-col gap-2 overflow-y-auto pointer-events-none sm:flex">
            <EventFeed log={gameState.log ?? []} />
            <HelpPanel />
          </div>
          <TurnBanner phase={currentPhase} activePlayer={activePlayer} turnNumber={gameState.turnNumber} />
        </>
      )}

      {currentPhase === 'planning' && (
        <ActionBar
          gold={gameState.players.player.points}
          isAITurn={isAITurn}
          selectedUnitType={selectedUnitTypeForPurchase}
          hint={hint}
          onUnitTypeSelect={handleUnitTypeSelect}
          onEndTurn={handleEndTurn}
        />
      )}

      {currentPhase === 'combat' && (
        <CombatResolver gameState={gameState} />
      )}

      {currentPhase === 'gameOver' && (
        <GameOverScreen winner={gameState.winner as 'player' | 'ai'} onRestart={handleRestart} onMainMenu={() => router.push('/')} />
      )}

      {toast && (
        <div className="fixed top-20 inset-x-0 z-40 flex justify-center pointer-events-none" role="status" aria-live="polite">
          <div
            key={toast.id}
            className={`animate-fadeIn flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
              toast.isWarning ? 'bg-amber-500/95 text-slate-900' : 'bg-slate-900/90 text-slate-100'
            }`}
          >
            {toast.isWarning && <WarningIcon />}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
};

// The main controller that provides the loading manager
export const GameController: React.FC<GameControllerProps> = (props) => {
  // The board renders behind the loading screen; turns don't start until it has faded away
  const [loadingComplete, setLoadingComplete] = useState(false);
  const handleLoadingComplete = useCallback(() => setLoadingComplete(true), []);

  return (
    <LoadingManagerProvider>
      <div className="relative w-full h-full">
        <GameControllerInner {...props} isReady={loadingComplete} />
        {!loadingComplete && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
      </div>
    </LoadingManagerProvider>
  );
};
