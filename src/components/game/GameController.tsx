import React, { useEffect } from 'react';
import { GameBoard } from './GameBoard';
import { GameDashboard } from './dashboard/GameDashboard';
import { PlanningPhase } from './phases/PlanningPhase';
import { SetupPhase } from './phases/SetupPhase';
import { CombatResolver } from './combat/CombatResolver';
import { GameOverScreen } from './shared/GameOverScreen';
import { SaveGameButton } from './shared/SaveGameButton';
import { useGameHandlers } from './handlers/GameEventHandlers';

interface GameControllerProps {
  initialDifficulty?: 'easy' | 'medium' | 'hard';
  shouldContinueGame?: boolean;
  onReturnToHome?: () => void;
}

export const GameController: React.FC<GameControllerProps> = ({ 
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
    handleUnitClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleEndTurn,
    handleCombatResolve,
    handleStartGame,
    handleContinueGame,
    handleRestart
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
        return <SetupPhase />;
        
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
            <PlanningPhase
              gameState={gameState}
              selectedHex={selectedHex}
              selectedUnit={selectedUnit}
              isAITurn={isAITurn}
              timer={timer}
              onUnitPurchase={handleUnitPurchase}
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
        onUnitClick={handleUnitClick}
        gameStarted={gameStarted}
      />
      {renderGameUI()}
      
    </div>
  );
}; 