import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameBoard } from './GameBoard';
import { SetupPhase } from './phases/SetupPhase';
import { CombatResolver } from './combat/CombatResolver';
import { GameOverScreen } from './shared/GameOverScreen';
import { useGameHandlers } from './handlers/GameEventHandlers';
import { LoadingManagerProvider } from './utils/LoadingManager';
import GameAssetPreloader from './utils/GameAssetPreloader';
import LoadingScreen from './utils/LoadingScreen';
import { saveGameToLocalStorage } from './storage/GameStorage';
import { TopBar } from './hud/TopBar';
import { ActionBar } from './hud/ActionBar';
import { SelectionCard } from './hud/SelectionCard';
import { EventFeed } from './hud/EventFeed';
import { TerrainLegend } from './hud/TerrainLegend';
import { TurnBanner } from './hud/TurnBanner';
import { getUnitTypeName } from './utils/UnitHelpers';

interface GameControllerProps {
  initialDifficulty?: 'easy' | 'medium' | 'hard';
  shouldContinueGame?: boolean;
  onReturnToHome?: () => void;
}

// Returns a function with a stable identity that always calls the latest version of `fn`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStableCallback = <T extends (...args: any[]) => any>(fn: T): T => {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
};

// The inner game component that uses the preloaded assets
const GameControllerInner: React.FC<GameControllerProps> = ({
  initialDifficulty = 'medium',
  shouldContinueGame = false,
}) => {
  // Use our custom hook to handle all game logic
  const {
    gameState,
    selectedHex,
    selectedUnit,
    validMoves,
    selectedUnitTypeForPurchase,
    isAITurn,
    timer,
    gameStarted,
    difficulty,
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleEndTurn,
    handleCombatResolve,
    handleStartGame,
    handleContinueGame,
    handleRestart,
    handleUnitTypeSelect,
    handleCancelSelection
  } = useGameHandlers();

  const [toast, setToast] = useState<string | null>(null);

  // Stable handlers so the memoised 3D board doesn't re-render on every timer tick
  const onBoardHexClick = useStableCallback(handleHexClick);
  const onBoardUnitClick = useStableCallback(handleUnitSelect);
  const onBoardUnitPurchase = useStableCallback(handleUnitPurchase);

  // Start or continue game when the component mounts
  useEffect(() => {
    // Fall back to a new game if there is no saved game to continue
    if (!shouldContinueGame || !handleContinueGame()) {
      handleStartGame(initialDifficulty);
    }
    // This effect should only run once when component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cancels the current selection
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCancelSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancelSelection]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const handleSave = () => {
    const saved = saveGameToLocalStorage(gameState, { selectedHex, isAITurn, timer, difficulty });
    setToast(saved ? '💾 Game saved' : 'Could not save the game');
  };

  const { currentPhase } = gameState;
  const activePlayer = gameState.activePlayer ?? 'player';
  const isPlayerPlanning = currentPhase === 'planning' && !isAITurn;

  // Tell the player what they can do right now
  const hint = selectedUnitTypeForPurchase
    ? validMoves.length > 0
      ? `Click a blue-outlined hex next to your castle, then click it again to deploy ${getUnitTypeName(selectedUnitTypeForPurchase)}. Esc to cancel.`
      : 'No free hex next to your castle to deploy on. Esc to cancel.'
    : selectedUnit?.owner === 'player'
      ? validMoves.length > 0
        ? 'Click a highlighted hex to plan a move - the route is drawn as you hover. Esc to cancel.'
        : 'This unit can\'t move this turn.'
      : 'Select one of your units to plan a move, or recruit troops. Moves happen when you end your turn.';

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
        gameStarted={gameStarted}
        onUnitPurchase={onBoardUnitPurchase}
        isAITurn={isAITurn}
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
          />
          <SelectionCard gameState={gameState} selectedHex={selectedHex} selectedUnit={selectedUnit} />
          <EventFeed log={gameState.log ?? []} />
          <TerrainLegend />
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
        <CombatResolver gameState={gameState} onResolveCombat={handleCombatResolve} />
      )}

      {currentPhase === 'gameOver' && (
        <GameOverScreen winner={gameState.winner as 'player' | 'ai'} onRestart={handleRestart} />
      )}

      {toast && (
        <div className="fixed top-20 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
};

// The main controller that provides the loading manager
export const GameController: React.FC<GameControllerProps> = (props) => {
  // Always render the game, but loading screen will be on top initially
  const [loadingComplete, setLoadingComplete] = useState(false);

  return (
    <LoadingManagerProvider>
      <GameAssetPreloader>
        <div className="relative w-full h-full">
          {/* Always render the game component */}
          <GameControllerInner {...props} />

          {/* Loading screen will fade itself out when complete */}
          {!loadingComplete && (
            <LoadingScreen
              onLoadingComplete={() => setLoadingComplete(true)}
              className="pointer-events-auto"
            />
          )}
        </div>
      </GameAssetPreloader>
    </LoadingManagerProvider>
  );
};
