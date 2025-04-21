import React, { useEffect, useState } from 'react';
import { GameBoard } from './GameBoard';
import { GameDashboard } from './dashboard/GameDashboard';
import { PlanningPhase } from './phases/PlanningPhase';
import { SetupPhase } from './phases/SetupPhase';
import { CombatResolver } from './combat/CombatResolver';
import { GameOverScreen } from './shared/GameOverScreen';
import { SaveGameButton } from './shared/SaveGameButton';
import { useGameHandlers } from './handlers/GameEventHandlers';
import { LoadingManagerProvider } from './utils/LoadingManager';
import GameAssetPreloader from './utils/GameAssetPreloader';
import LoadingScreen from './utils/LoadingScreen';
import Barracks from './Barracks';

interface GameControllerProps {
  initialDifficulty?: 'easy' | 'medium' | 'hard';
  shouldContinueGame?: boolean;
  onReturnToHome?: () => void;
}

// The inner game component that uses the preloaded assets
const GameControllerInner: React.FC<GameControllerProps> = ({ 
  initialDifficulty = 'medium',
  shouldContinueGame = false,
}) => {
  // Use our custom hook to handle all game logic
  const {
    // State
    gameState,
    selectedHex, 
    selectedUnit,
    validMoves,
    isAITurn, 
    timer,
    gameStarted,
    difficulty,
    
    // Event handlers
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleEndTurn,
    handleCombatResolve,
    handleStartGame,
    handleContinueGame,
    handleRestart,
    handleUnitTypeSelect
  } = useGameHandlers();

  // Start or continue game when the component mounts
  useEffect(() => {
    if (shouldContinueGame) {
      handleContinueGame();
    } else {
      handleStartGame(initialDifficulty);
    }
    // This effect should only run once when component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Function to render the game UI based on current phase
  const renderGameUI = () => {
    // Show dashboard during all phases except setup and gameOver
    const showDashboard = gameState.currentPhase !== 'setup' && gameState.currentPhase !== 'gameOver';
    
    switch (gameState.currentPhase) {
      case 'setup':
        // Check if a hex is selected and it's a valid base location
        const baseSelectionConfirmMode = selectedHex !== null && selectedHex !== undefined;
        const isValidBaseLocation = selectedHex && validMoves.some(
          coords => coords.q === selectedHex.coordinates.q && coords.r === selectedHex.coordinates.r
        );

        return (
          <SetupPhase 
            isConfirmMode={baseSelectionConfirmMode}
            selectedHexValid={!!isValidBaseLocation}
          />
        );
        
      case 'planning':
        return (
          <>
            {showDashboard && (
              <GameDashboard 
                gameState={gameState}
                turnNumber={gameState.turnNumber}
                isAITurn={isAITurn}
                onUnitSelect={handleUnitSelect}
              />
            )}
            {!isAITurn && (
              <SaveGameButton 
                gameState={gameState}
                selectedHex={selectedHex}
                isAITurn={isAITurn}
                timer={timer}
                difficulty={difficulty}
              />
            )}
            {/* Barracks component for troop recruitment */}
            <Barracks
              availableGold={gameState.players.player.points}
              onUnitTypeSelect={handleUnitTypeSelect}
              isAITurn={isAITurn}
            />
            <PlanningPhase
              gameState={gameState}
              selectedHex={selectedHex}
              selectedUnit={selectedUnit}
              isAITurn={isAITurn}
              timer={timer}
              onEndTurn={handleEndTurn}
            />
          </>
        );
        
      case 'combat':
        return (
          <>
            {showDashboard && (
              <GameDashboard 
                gameState={gameState}
                turnNumber={gameState.turnNumber}
                isAITurn={isAITurn}
                onUnitSelect={handleUnitSelect}
              />
            )}
            <CombatResolver 
              gameState={gameState}
              onResolveCombat={handleCombatResolve}
            />
          </>
        );
        
      case 'gameOver':
        return (
          <GameOverScreen 
            winner={gameState.winner as 'player' | 'ai'} 
            onRestart={handleRestart}
          />
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="relative w-full h-full">
      <GameBoard 
        gameState={gameState}
        selectedHex={selectedHex ?? undefined}
        validMoves={validMoves}
        onHexClick={handleHexClick}
        onUnitClick={handleUnitSelect}
        gameStarted={gameStarted}
        onUnitPurchase={handleUnitPurchase}
        isAITurn={isAITurn}
      />
      {renderGameUI()}
    </div>
  );
};

// The main controller that provides the loading manager
export const GameController: React.FC<GameControllerProps> = (props) => {
  // Always render the game, but loading screen will be on top initially
  const [loadingComplete, setLoadingComplete] = useState(false);

  // This function will be called when loading is complete and animation is finished
  const handleLoadingComplete = () => {
    // Loading screen has faded out completely
    setLoadingComplete(true);
  };

  return (
    <LoadingManagerProvider>
      <GameAssetPreloader>
        <div className="relative w-full h-full">
          {/* Always render the game component */}
          <GameControllerInner {...props} />
          
          {/* Loading screen will fade itself out when complete */}
          {!loadingComplete && (
            <LoadingScreen 
              onLoadingComplete={handleLoadingComplete} 
              className="pointer-events-auto" 
            />
          )}
        </div>
      </GameAssetPreloader>
    </LoadingManagerProvider>
  );
}; 