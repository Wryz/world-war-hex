import { useState, useEffect, useCallback } from 'react';
import { 
  GameState, 
  Hex, 
  HexCoordinates, 
  Unit, 
  UnitType
} from '@/types/game';
import { 
  getHexDistance, 
  getHexesInRange, 
  findHexByCoordinates 
} from '@/lib/game/hexUtils';
import { 
  initializeGameState, 
  UNITS, 
  setBaseLocation, 
  addPendingMove, 
  addPendingPurchase, 
  executeMoves,
  resolveCombat,
  DEFAULT_SETTINGS
} from '@/lib/game/gameState';
import { 
  getAIMoves, 
  decideAICombatStrategy 
} from '@/lib/ai/aiPlayer';
import { 
  loadGameFromLocalStorage,
  clearSavedGame 
} from '../storage/GameStorage';

export const useGameHandlers = () => {
  // State variables
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [gameState, setGameState] = useState<GameState>(() => 
    initializeGameState({ ...DEFAULT_SETTINGS, aiDifficulty: difficulty })
  );
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  const [isAITurn, setIsAITurn] = useState(false);
  const [timer, setTimer] = useState(DEFAULT_SETTINGS.planningPhaseTime);

  // Check for saved game on mount
  useEffect(() => {
    const savedGame = loadGameFromLocalStorage();
    setHasSavedGame(!!savedGame);
  }, []);

  // Clear selection when game phase changes
  useEffect(() => {
    setSelectedHex(null);
    setSelectedUnit(null);
    setValidMoves([]);
  }, [gameState.currentPhase]);

  // Timer management for planning phase
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    
    if (gameState.currentPhase === 'planning' && !isAITurn) {
      setTimer(gameState.planningTimeRemaining);
      
      timerInterval = setInterval(() => {
        setTimer(prevTime => {
          if (prevTime <= 1) {
            // Time's up, execute moves
            clearInterval(timerInterval!);
            executeAllMoves();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [gameState.currentPhase, isAITurn]);

  // Execute all pending moves
  const executeAllMoves = () => {
    // Execute all player and AI moves
    let updatedState = executeMoves(gameState);
    
    // Now check for combats
    if (updatedState.combats.length > 0) {
      updatedState = {
        ...updatedState,
        currentPhase: 'combat'
      };
    } else {
      // No combats, advance to next round
      updatedState = {
        ...updatedState,
        turnNumber: updatedState.turnNumber + 1,
        planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime,
        currentPhase: 'planning'
      };
      
      // Toggle player turn
      setIsAITurn(!isAITurn);
    }
    
    setGameState(updatedState);
  };

  // AI turn management
  useEffect(() => {
    if (gameState.currentPhase === 'planning' && isAITurn) {
      // Small delay to make AI seem like it's "thinking"
      const aiThinkingDelay = setTimeout(() => {
        handleAITurn();
      }, 1500);
      
      return () => clearTimeout(aiThinkingDelay);
    }
  }, [gameState.currentPhase, isAITurn]);

  // Combat resolution for AI
  useEffect(() => {
    if (gameState.currentPhase === 'combat' && gameState.combats.length > 0) {
      const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
      
      if (unresolvedCombatIndex !== -1) {
        const combat = gameState.combats[unresolvedCombatIndex];
        const defenders = combat.defenders;
        
        // AI is defending, decide to retreat or fight
        if (defenders.some(unit => unit.owner === 'ai')) {
          const aiDelay = setTimeout(() => {
            const shouldRetreat = decideAICombatStrategy(gameState, unresolvedCombatIndex);
            handleCombatResolve(unresolvedCombatIndex, shouldRetreat);
          }, 1000);
          
          return () => clearTimeout(aiDelay);
        }
      }
    }
  }, [gameState.currentPhase, gameState.combats]);

  // Continue saved game
  const handleContinueGame = () => {
    const savedData = loadGameFromLocalStorage();
    if (savedData) {
      setGameState(savedData.gameState);
      setIsAITurn(savedData.additionalData.isAITurn);
      setTimer(savedData.additionalData.timer);
      setDifficulty(savedData.additionalData.difficulty || 'medium');
      setGameStarted(true);
    }
  };
  
  // Handle game start
  const handleStartGame = (selectedDifficulty: 'easy' | 'medium' | 'hard') => {
    setDifficulty(selectedDifficulty);
    setGameState(initializeGameState({ 
      ...DEFAULT_SETTINGS, 
      aiDifficulty: selectedDifficulty 
    }));
    // Clear any existing saved game
    clearSavedGame();
    setGameStarted(true);
  };
  
  // Force return to intro screen
  const handleReturnToIntro = () => {
    setGameStarted(false);
  };
  
  // Restart game
  const handleRestart = () => {
    clearSavedGame();
    setGameState(initializeGameState({ 
      ...DEFAULT_SETTINGS, 
      aiDifficulty: difficulty 
    }));
    setSelectedHex(null);
    setSelectedUnit(null);
    setValidMoves([]);
    setIsAITurn(false);
    setTimer(DEFAULT_SETTINGS.planningPhaseTime);
    setGameStarted(false);
    setHasSavedGame(false);
  };

  // Handle base selection during setup phase
  const handleBaseSelection = (hex: Hex) => {
    // Cannot place base when already placed
    if (gameState.hexGrid.some(h => h.isBase && h.owner === 'player')) return;
    
    // Cannot place base on water, resource hexes, or non-edge hexes
    if (hex.isResourceHex || hex.terrain === 'water') return;
    
    // Check if this is an edge hex - edge hexes have the maximum coordinate value
    // in at least one of their coordinates (q or r) for our hexagonal grid
    const gridSize = DEFAULT_SETTINGS.gridSize;
    const isEdgeHex = Math.abs(hex.coordinates.q) === gridSize || 
                      Math.abs(hex.coordinates.r) === gridSize ||
                      Math.abs(hex.coordinates.q + hex.coordinates.r) === gridSize;
    
    if (!isEdgeHex) {
      // Not an edge hex, so we don't allow base placement here
      return;
    }
    
    // Update game state with player base location
    const updatedState = setBaseLocation(gameState, 'player', hex.coordinates);
    
    // If player base is set, AI will automatically place base on opposite side
    if (updatedState.hexGrid.some(h => h.isBase && h.owner === 'player')) {
      // Place AI base on a different side of the map
      const playerBase = updatedState.hexGrid.find(h => h.isBase && h.owner === 'player')!;
      let maxDistance = 0;
      let furthestHex: Hex | null = null;
      
      // Find the hex furthest from player base that's not a resource or water
      for (const h of updatedState.hexGrid) {
        if (h.isResourceHex || h.terrain === 'water') continue;
        
        // Check if this is an edge hex
        const isHexEdge = Math.abs(h.coordinates.q) === gridSize || 
                          Math.abs(h.coordinates.r) === gridSize ||
                          Math.abs(h.coordinates.q + h.coordinates.r) === gridSize;
        
        if (!isHexEdge) continue;
        
        const distance = getHexDistance(h.coordinates, playerBase.coordinates);
        if (distance > maxDistance) {
          maxDistance = distance;
          furthestHex = h;
        }
      }
      
      if (furthestHex) {
        const finalState = setBaseLocation(updatedState, 'ai', furthestHex.coordinates);
        setGameState({
          ...finalState,
          currentPhase: 'planning'
        });
      }
    } else {
      setGameState(updatedState);
    }
  };

  // Handle unit purchase during planning phase
  const handleUnitPurchase = (unitType: UnitType) => {
    if (!selectedHex || gameState.currentPhase !== 'planning' || isAITurn) return;
    
    // Check if player can afford this unit
    const unitInfo = UNITS[unitType];
    if (!unitInfo || gameState.players.player.points < unitInfo.cost) return;
    
    // Ensure this is a valid placement (close to base)
    const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
    if (!playerBase) return;
    
    const isNearBase = getHexDistance(selectedHex.coordinates, playerBase.coordinates) === 1;
    if (!isNearBase || selectedHex.unit) return;
    
    // Add this unit purchase to pending purchases
    const newGameState = addPendingPurchase(
      gameState, 
      gameState.players.player.id,
      unitType, 
      selectedHex.coordinates
    );
    
    setGameState(newGameState);
    setSelectedHex(null);
  };

  // Handle move unit during planning phase
  const handleUnitMove = (unit: Unit, targetHex: Hex) => {
    // Check if the move is valid
    const isValidMove = validMoves.some(coords => 
      coords.q === targetHex.coordinates.q && 
      coords.r === targetHex.coordinates.r
    );
    
    if (!isValidMove) return;
    
    const unitHex = findHexByCoordinates(gameState.hexGrid, unit.position);
    if (!unitHex) return;
    
    // Add this move to the pending moves
    const newGameState = addPendingMove(
      gameState,
      unit.id,
      gameState.players.player.id,
      targetHex.coordinates
    );
    
    // Create a visually updated state to immediately show the unit movement
    // This doesn't affect the actual game logic, which happens during executeAllMoves
    const visuallyUpdatedHexGrid = [...newGameState.hexGrid];
    
    // Find the indices of the source and target hexes
    const sourceHexIndex = visuallyUpdatedHexGrid.findIndex(
      h => h.coordinates.q === unit.position.q && h.coordinates.r === unit.position.r
    );
    
    const targetHexIndex = visuallyUpdatedHexGrid.findIndex(
      h => h.coordinates.q === targetHex.coordinates.q && h.coordinates.r === targetHex.coordinates.r
    );
    
    if (sourceHexIndex !== -1 && targetHexIndex !== -1) {
      // Create updated unit with new position
      const updatedUnit = {
        ...unit,
        position: targetHex.coordinates
      };
      
      // Update the player's units array with the new position
      const updatedPlayerUnits = newGameState.players.player.units.map(u => 
        u.id === unit.id ? updatedUnit : u
      );
      
      // Update the grid to move the unit visually
      visuallyUpdatedHexGrid[sourceHexIndex] = {
        ...visuallyUpdatedHexGrid[sourceHexIndex],
        unit: undefined
      };
      
      visuallyUpdatedHexGrid[targetHexIndex] = {
        ...visuallyUpdatedHexGrid[targetHexIndex],
        unit: updatedUnit
      };
      
      // Set the visually updated state
      setGameState({
        ...newGameState,
        hexGrid: visuallyUpdatedHexGrid,
        players: {
          ...newGameState.players,
          player: {
            ...newGameState.players.player,
            units: updatedPlayerUnits
          }
        }
      });
    } else {
      // If we couldn't find the hexes, just use the original state update
      setGameState(newGameState);
    }
    
    // Clear selection
    setSelectedUnit(null);
    setValidMoves([]);
  };

  // Handle end turn button click
  const handleEndTurn = () => {
    executeAllMoves();
  };

  // Handle combat resolution
  const handleCombatResolve = (combatIndex: number, retreat: boolean) => {
    const updatedState = resolveCombat(gameState, combatIndex, retreat);
    
    // Check if all combats are resolved
    const allResolved = updatedState.combats.every(c => c.resolved);
    
    if (allResolved) {
      // Check win conditions
      const playerBaseDestroyed = !updatedState.hexGrid.some(
        h => h.isBase && h.owner === 'player'
      );
      
      const aiBaseDestroyed = !updatedState.hexGrid.some(
        h => h.isBase && h.owner === 'ai'
      );
      
      if (playerBaseDestroyed || aiBaseDestroyed) {
        setGameState({
          ...updatedState,
          currentPhase: 'gameOver',
          winner: playerBaseDestroyed ? 'ai' : 'player'
        });
      } else {
        // No win yet, advance to next round
        setGameState({
          ...updatedState,
          turnNumber: updatedState.turnNumber + 1,
          planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime,
          currentPhase: 'planning',
          combats: []
        });
        
        // Toggle player turn
        setIsAITurn(!isAITurn);
      }
    } else {
      // Still have more combats to resolve
      setGameState(updatedState);
    }
  };

  // Handle AI turn
  const handleAITurn = () => {
    // AI makes decisions for all units and purchases
    const aiDecisions = getAIMoves(gameState);
    let updatedState = gameState;
    
    // Apply AI moves
    aiDecisions.moves.forEach(move => {
      updatedState = addPendingMove(
        updatedState, 
        move.unitId, 
        move.playerId, 
        move.to
      );
    });
    
    // Apply AI purchases
    aiDecisions.purchases.forEach(purchase => {
      updatedState = addPendingPurchase(
        updatedState,
        purchase.playerId,
        purchase.unitType,
        purchase.position
      );
    });
    
    setGameState(updatedState);
    
    // AI ends turn after short delay
    setTimeout(() => {
      executeAllMoves();
    }, 1000);
  };

  // Handle unit selection from dashboard
  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    // Find the hex containing the unit
    const unitHex = gameState.hexGrid.find(
      hex => hex.unit && hex.unit.id === unit.id
    );
    if (unitHex) {
      setSelectedHex(unitHex);
      // TODO: Pan camera to the hex (would require ref to camera controls)
    }
  };

  // Handle hex click based on game phase
  const handleHexClick = useCallback((hex: Hex) => {
    switch (gameState.currentPhase) {
      case 'setup':
        handleBaseSelection(hex);
        break;
      
      case 'planning':
        // If we have a selected unit, try to move it
        if (selectedUnit && !isAITurn) {
          handleUnitMove(selectedUnit, hex);
        } else if (hex.isResourceHex) {
          // Show info about resource hex
          setSelectedHex(hex);
        } else if (hex.isBase) {
          // Show base info
          setSelectedHex(hex);
        } else if (!hex.unit) {
          // Select hex for unit placement
          setSelectedHex(hex);
          setSelectedUnit(null);
          
          // Check if it's a valid placement position (near base)
          const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
          if (playerBase) {
            const isNearBase = getHexDistance(hex.coordinates, playerBase.coordinates) === 1;
            if (!isNearBase) {
              setValidMoves([]);
            }
          }
        }
        break;
        
      case 'combat':
        // Select the hex to view combat details
        setSelectedHex(hex);
        break;
        
      default:
        setSelectedHex(hex);
        break;
    }
  }, [gameState, selectedUnit, isAITurn]);

  // Handle unit click  
  const handleUnitClick = useCallback((unit: Unit) => {
    if (gameState.currentPhase !== 'planning' || isAITurn) return;
    
    // Can only select player's units
    if (unit.owner !== 'player') {
      setSelectedUnit(null);
      return;
    }
    
    setSelectedUnit(unit);
    
    // Calculate valid moves for this unit
    const unitHex = findHexByCoordinates(gameState.hexGrid, unit.position);
    if (!unitHex) return;
    
    // Show movement range
    const hexesInRange = getHexesInRange(gameState.hexGrid, unit.position, unit.movementRange);
    const validMoveCoords = hexesInRange
      .filter(hex => {
        // Filter to empty hexes or enemy base
        if (hex.unit && !(hex.isBase && hex.owner !== unit.owner)) return false;
        return true;
      })
      .map(hex => hex.coordinates);
    
    setValidMoves(validMoveCoords);
  }, [gameState, isAITurn]);

  return {
    // State
    gameState,
    selectedHex,
    selectedUnit,
    validMoves,
    isAITurn,
    timer,
    gameStarted,
    hasSavedGame,
    difficulty,
    
    // Handlers
    handleHexClick,
    handleUnitClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleEndTurn,
    handleCombatResolve,
    handleStartGame,
    handleContinueGame,
    handleRestart,
    handleReturnToIntro
  };
}; 