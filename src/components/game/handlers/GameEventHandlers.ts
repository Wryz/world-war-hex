import { useState, useEffect, useCallback } from 'react';
import { 
  GameState, 
  Hex, 
  HexCoordinates, 
  Unit, 
  UnitType,
  GamePhase
} from '@/types/game';
import { 
  getHexDistance, 
  getHexesInRange
} from '@/lib/game/hexUtils';
import { 
  initializeGameState, 
  UNITS, 
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

// Define a type to track original unit positions
interface OriginalUnitPosition {
  unitId: string;
  position: HexCoordinates;
}

// Base max health constant (same value as in gameState.ts)
const BASE_MAX_HEALTH = 50;

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
  const [selectedUnitTypeForPurchase, setSelectedUnitTypeForPurchase] = useState<UnitType | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  const [isAITurn, setIsAITurn] = useState(false);
  const [timer, setTimer] = useState(DEFAULT_SETTINGS.planningPhaseTime);
  // Track original positions of units at the start of each planning phase
  const [originalUnitPositions, setOriginalUnitPositions] = useState<OriginalUnitPosition[]>([]);

  // Check for saved game on mount
  useEffect(() => {
    const savedGame = loadGameFromLocalStorage();
    setHasSavedGame(!!savedGame);
  }, []);

  // Clear selection when game phase changes
  useEffect(() => {
    setSelectedHex(null);
    setSelectedUnit(null);
    setSelectedUnitTypeForPurchase(null);
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

  // Effect to track original positions when planning phase starts
  useEffect(() => {
    if (gameState.currentPhase === 'planning') {
      // Store the original positions of all player units at the start of planning phase
      const playerUnits = gameState.players.player.units;
      const positions: OriginalUnitPosition[] = playerUnits.map(unit => ({
        unitId: unit.id,
        position: { ...unit.position }
      }));
      setOriginalUnitPositions(positions);
    }
  }, [gameState.currentPhase, gameState.turnNumber]);

  // Execute all pending moves
  const executeAllMoves = () => {
    // Execute all player and AI moves
    let updatedState = executeMoves(gameState);
    
    // Now check for combats
    if (updatedState.combats.length > 0) {
      updatedState = {
        ...updatedState,
        currentPhase: 'combat' as GamePhase
      };
    } else {
      // No combats, advance to next round
      updatedState = {
        ...updatedState,
        turnNumber: updatedState.turnNumber + 1,
        planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime,
        currentPhase: 'planning' as GamePhase,
        // Add 5 gold to both players at the start of each new turn
        players: {
          ...updatedState.players,
          player: {
            ...updatedState.players.player,
            points: updatedState.players.player.points + 5
          },
          ai: {
            ...updatedState.players.ai,
            points: updatedState.players.ai.points + 5
          }
        }
      };
      
      // Toggle player turn
      setIsAITurn(!isAITurn);
      
      // Also record the original positions of all units for the new planning phase
      const playerUnits = updatedState.players.player.units;
      const positions: OriginalUnitPosition[] = playerUnits.map(unit => ({
        unitId: unit.id,
        position: { ...unit.position }
      }));
      setOriginalUnitPositions(positions);
    }
    
    // Clear any selections regardless of phase transition
    setSelectedHex(null);
    setSelectedUnit(null);
    setValidMoves([]);
    setSelectedUnitTypeForPurchase(null);
    
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
    
    // Cannot place base on water, resource hexes, mountain hexes, or non-edge hexes
    if (hex.isResourceHex || hex.terrain === 'water' || hex.terrain === 'mountain') return;
    
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
    
    // Create a copy of the original state to work with
    const newState = { ...gameState };
    const newHexGrid = [...newState.hexGrid];
    
    // Find and update the player base hex directly
    const playerHexIndex = newHexGrid.findIndex(
      h => h.coordinates.q === hex.coordinates.q && h.coordinates.r === hex.coordinates.r
    );
    
    if (playerHexIndex === -1) return;
    
    // Update the hex for player base
    newHexGrid[playerHexIndex] = {
      ...newHexGrid[playerHexIndex],
      isBase: true,
      owner: 'player',
      baseHealth: BASE_MAX_HEALTH
    };
    
    // Update player information
    const updatedPlayers = {
      ...newState.players,
      player: {
        ...newState.players.player,
        baseLocation: hex.coordinates,
        baseHealth: BASE_MAX_HEALTH,
        maxBaseHealth: BASE_MAX_HEALTH
      }
    };
    
    // Now find the best location for AI base
    let maxDistance = 0;
    let furthestHexIndex = -1;
    
    // Find the hex furthest from player base
    for (let i = 0; i < newHexGrid.length; i++) {
      const h = newHexGrid[i];
      
      // Skip invalid hexes
      if (h.isResourceHex || h.terrain === 'water' || h.terrain === 'mountain') continue;
      
      // Check if it's an edge hex
      const isHexEdge = Math.abs(h.coordinates.q) === gridSize || 
                        Math.abs(h.coordinates.r) === gridSize ||
                        Math.abs(h.coordinates.q + h.coordinates.r) === gridSize;
      
      if (!isHexEdge) continue;
      
      const distance = getHexDistance(h.coordinates, hex.coordinates);
      if (distance > maxDistance) {
        maxDistance = distance;
        furthestHexIndex = i;
      }
    }
    
    // If we found a valid hex for AI base, update it
    if (furthestHexIndex !== -1) {
      // Update the hex for AI base
      const aiCoordinates = newHexGrid[furthestHexIndex].coordinates;
      
      newHexGrid[furthestHexIndex] = {
        ...newHexGrid[furthestHexIndex],
        isBase: true,
        owner: 'ai',
        baseHealth: BASE_MAX_HEALTH
      };
      
      // Update AI information
      updatedPlayers.ai = {
        ...updatedPlayers.ai,
        baseLocation: aiCoordinates,
        baseHealth: BASE_MAX_HEALTH,
        maxBaseHealth: BASE_MAX_HEALTH
      };
      
      // Create the final state with both bases and move to planning phase
      const finalState: GameState = {
        ...newState,
        hexGrid: newHexGrid,
        players: updatedPlayers,
        currentPhase: 'planning' as GamePhase,
        turnNumber: 1,
        planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime
      };
      
      // Apply the complete state update in a single operation
      setGameState(finalState);
      
      // Also record the original positions of all units for the new planning phase
      // For the first planning phase, there might not be any units yet, but set it up anyway
      const playerUnits = finalState.players.player.units;
      const positions: OriginalUnitPosition[] = playerUnits.map(unit => ({
        unitId: unit.id,
        position: { ...unit.position }
      }));
      setOriginalUnitPositions(positions);
    } else {
      // Just update player base if no AI base location found (shouldn't happen)
      const partialState: GameState = {
        ...newState,
        hexGrid: newHexGrid,
        players: updatedPlayers
      };
      
      setGameState(partialState);
    }
  };

  // Handle unit purchase during planning phase
  const handleUnitPurchase = (unitType: UnitType): boolean => {
    if (!selectedHex || gameState.currentPhase !== 'planning' || isAITurn) return false;
    
    // Check if player can afford this unit
    const unitInfo = UNITS[unitType];
    if (!unitInfo || gameState.players.player.points < unitInfo.cost) return false;
    
    // Ensure this is a valid placement (close to base and not on mountain or water)
    const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
    if (!playerBase) return false;
    
    const isNearBase = getHexDistance(selectedHex.coordinates, playerBase.coordinates) === 1;
    if (!isNearBase || selectedHex.unit || selectedHex.terrain === 'mountain' || selectedHex.terrain === 'water') return false;
    
    // Add this unit purchase to pending purchases
    const newGameState = addPendingPurchase(
      gameState, 
      gameState.players.player.id,
      unitType, 
      selectedHex.coordinates
    );

    console.log('newGameState', newGameState)
    
    // Create a temporary unit object for visual preview
    const previewUnit: Unit = {
      id: `temp-${unitType}-${Date.now()}`,
      type: unitType,
      owner: 'player',
      position: selectedHex.coordinates,
      movementRange: UNITS[unitType].movementRange,
      attackPower: UNITS[unitType].attackPower,
      lifespan: UNITS[unitType].lifespan,
      maxLifespan: UNITS[unitType].maxLifespan,
      cost: UNITS[unitType].cost,
      abilities: [...UNITS[unitType].abilities],
      hasMoved: false,
      isEngagedInCombat: false
    };

    console.log('previewUnit', previewUnit)
    
    // Create a visually updated hex grid to show the unit
    const visuallyUpdatedHexGrid = [...newGameState.hexGrid];
    const hexIndex = visuallyUpdatedHexGrid.findIndex(
      h => h.coordinates.q === selectedHex.coordinates.q && h.coordinates.r === selectedHex.coordinates.r
    );
    
    if (hexIndex !== -1) {
      visuallyUpdatedHexGrid[hexIndex] = {
        ...visuallyUpdatedHexGrid[hexIndex],
        unit: previewUnit
      };
    }
    
    // Update the points to show immediate visual feedback of cost
    const updatedPoints = newGameState.players.player.points - unitInfo.cost;
    
    // Clear the selection and update game state
    setGameState({
      ...newGameState,
      selectedUnitTypeForPurchase: null,
      hexGrid: visuallyUpdatedHexGrid,
      players: {
        ...newGameState.players,
        player: {
          ...newGameState.players.player,
          points: updatedPoints
        }
      }
    });
    
    // Clear the selection state variables
    setSelectedHex(null);
    setSelectedUnitTypeForPurchase(null);
    
    // Return true to indicate successful purchase
    return true;
  };

  // Handle selection of unit type from barracks
  const handleUnitTypeSelect = (unitType: UnitType) => {
    if (gameState.currentPhase !== 'planning' || isAITurn) return;
    
    // Check if player can afford this unit
    const unitInfo = UNITS[unitType];
    if (!unitInfo || gameState.players.player.points < unitInfo.cost) return;
    
    // Set the selected unit type
    setSelectedUnitTypeForPurchase(unitType);
    
    // Clear any selected unit (as we're now placing a new unit)
    setSelectedUnit(null);
    
    // Find the player's base
    const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
    if (!playerBase) return;
    
    // Get all hexes within 1 tile of the base
    const hexesNearBase = getHexesInRange(gameState.hexGrid, playerBase.coordinates, 1);
    
    // Filter to only empty hexes (no units or other structures)
    const validPlacementHexes = hexesNearBase.filter(hex => 
      // Must be empty (no existing unit)
      !hex.unit && 
      // Cannot place on the base itself
      !hex.isBase &&
      // Cannot place on water or mountain tiles
      hex.terrain !== 'water' &&
      hex.terrain !== 'mountain'
    );
    
    // Set valid moves to the coordinates of these hexes
    const validMoveCoordinates = validPlacementHexes.map(hex => ({ ...hex.coordinates }));
    setValidMoves(validMoveCoordinates);
    
    // Update game state with the selected unit type
    setGameState({
      ...gameState,
      selectedUnitTypeForPurchase: unitType
    });
    
    // Select the base hex to make it visually clear what's happening
    setSelectedHex(playerBase);
  };

  // Handle move unit during planning phase
  const handleUnitMove = (unit: Unit, targetHex: Hex) => {
    // Check if the move is valid
    const isValidMove = validMoves.some(coords => 
      coords.q === targetHex.coordinates.q && 
      coords.r === targetHex.coordinates.r
    );
    
    if (!isValidMove) return;
    
    // Find the original position from the start of the planning phase
    let originalPosition = unit.position;
    const originalPositionData = originalUnitPositions.find(pos => pos.unitId === unit.id);
    if (originalPositionData) {
      originalPosition = originalPositionData.position;
    }
    
    // Get the player's base
    const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
    
    // Check if unit is a newly purchased unit (from this turn)
    const isNewlyPurchasedUnit = gameState.pendingPurchases.some(
      purchase => 
        purchase.playerId === gameState.players.player.id && 
        purchase.position.q === unit.position.q && 
        purchase.position.r === unit.position.r
    );
    
    // For newly purchased units, check if target is still around the base
    if (isNewlyPurchasedUnit && playerBase) {
      const distanceFromBase = getHexDistance(targetHex.coordinates, playerBase.coordinates);
      if (distanceFromBase > 1) {
        // Not within range of base, don't allow the move
        return;
      }
    } else {
      // Regular unit - verify it's within range of original position
      // Verify that the target hex is actually within the unit's movement range from its original position
      const distanceFromOriginal = getHexDistance(originalPosition, targetHex.coordinates);
      if (distanceFromOriginal > unit.movementRange) {
        console.warn('Target is outside unit\'s movement range from original position');
        return;
      }
    }
    
    // First, check if unit already has a pending move
    const hasPendingMove = gameState.pendingMoves.some(move => move.unitId === unit.id);
    let updatedGameState = gameState;
    
    // If there's a pending move, cancel it first so we don't stack moves
    if (hasPendingMove) {
      // Find and remove the existing pending move
      updatedGameState = {
        ...gameState,
        pendingMoves: gameState.pendingMoves.filter(move => move.unitId !== unit.id)
      };
    }
    
    // Special case: If we're moving to the original position, just cancel the pending move
    if (targetHex.coordinates.q === originalPosition.q && 
        targetHex.coordinates.r === originalPosition.r) {
      setGameState(updatedGameState);
      
      // Clear selection
      setSelectedUnit(null);
      setValidMoves([]);
      return;
    }
    
    // Add this move to the pending moves - using the original position as the "from" position
    // This ensures that the move is registered correctly when executed
    const newGameState = addPendingMove(
      updatedGameState,
      unit.id,
      updatedGameState.players.player.id,
      targetHex.coordinates
    );
    
    // Update the game state with the new pending move
    setGameState(newGameState);
    
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
          currentPhase: 'gameOver' as GamePhase,
          winner: playerBaseDestroyed ? 'ai' : 'player'
        });
      } else {
        // No win yet, advance to next round
        const nextTurnState = {
          ...updatedState,
          turnNumber: updatedState.turnNumber + 1,
          planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime,
          currentPhase: 'planning' as GamePhase,
          combats: [],
          // Add 5 gold to both players at the start of each new turn
          players: {
            ...updatedState.players,
            player: {
              ...updatedState.players.player,
              points: updatedState.players.player.points + 5
            },
            ai: {
              ...updatedState.players.ai,
              points: updatedState.players.ai.points + 5
            }
          }
        };
        
        setGameState(nextTurnState);
        
        // Also record the original positions of all units for the new planning phase
        const playerUnits = nextTurnState.players.player.units;
        const positions: OriginalUnitPosition[] = playerUnits.map(unit => ({
          unitId: unit.id,
          position: { ...unit.position }
        }));
        setOriginalUnitPositions(positions);
        
        // Clear any selections when transitioning to planning phase
        setSelectedHex(null);
        setSelectedUnit(null);
        setValidMoves([]);
        setSelectedUnitTypeForPurchase(null);
        
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

  // Handle hex click - extended to track placed unit hex
  const handleHexClick = useCallback((hex: Hex) => {
    switch (gameState.currentPhase) {
      case 'setup':
        // During setup, we need to implement a two-step selection process:
        // 1. First click selects the hex (handled in GameBoard component)
        // 2. Second click on the same hex confirms the selection
        
        // If we're clicking the same hex as what's already selected, this is a confirmation
        if (selectedHex && 
            selectedHex.coordinates.q === hex.coordinates.q && 
            selectedHex.coordinates.r === hex.coordinates.r) {
          // This is a confirmation click - place the base
          handleBaseSelection(hex);
        } else {
          // This is the first click - just select the hex to show green/red ring
          setSelectedHex(hex);
          
          // Calculate valid moves to help GameController determine if the selected hex is valid
          const gridSize = DEFAULT_SETTINGS.gridSize;
          
          // Add validMoves for eligible base placement hexes
          const validBasePlacementHexes = gameState.hexGrid.filter(h => {
            // Check if it's an edge hex
            const isEdgeHex = Math.abs(h.coordinates.q) === gridSize || 
                              Math.abs(h.coordinates.r) === gridSize ||
                              Math.abs(h.coordinates.q + h.coordinates.r) === gridSize;
                              
            // Check if it's a valid terrain type (not water, not resource, not mountain)
            const isValidTerrain = h.terrain !== 'water' && 
                                   !h.isResourceHex && 
                                   h.terrain !== 'mountain';
            
            return isEdgeHex && isValidTerrain;
          });
          
          setValidMoves(validBasePlacementHexes.map(h => h.coordinates));
        }
        break;
      
      case 'planning':
        if (isAITurn) {
          // Don't allow player actions during AI turn
          setSelectedHex(hex);
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        // Check if this hex is the destination of a pending move (for cancellation)
        const pendingMoveToThisHex = gameState.pendingMoves.find(move => 
          move.to.q === hex.coordinates.q && move.to.r === hex.coordinates.r
        );
        
        if (pendingMoveToThisHex) {
          // We're clicking on a hex that has a pending move destination - cancel the move
          const updatedState = {
            ...gameState,
            pendingMoves: gameState.pendingMoves.filter(move => move.unitId !== pendingMoveToThisHex.unitId)
          };
          
          setGameState(updatedState);
          setSelectedHex(hex);
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }
        
        // If we have a selected unit, try to move it
        if (selectedUnit && !isAITurn) {
          handleUnitMove(selectedUnit, hex);
        } else if (selectedUnitTypeForPurchase && !isAITurn) {
          // If we have a unit type selected for purchase, first check if the hex is valid
          setSelectedHex(hex);
          
          // Check if it's a valid placement position (near base)
          const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
          if (playerBase) {
            const isNearBase = getHexDistance(hex.coordinates, playerBase.coordinates) === 1;
            
            // Ensure we're not placing on water, mountains, an existing unit, or the base itself
            const isValidPlacement = isNearBase && 
                                    !hex.unit && 
                                    !hex.isBase && 
                                    hex.terrain !== 'water' &&
                                    hex.terrain !== 'mountain';
            
            if (isValidPlacement) {
              // Valid location, try to purchase the unit
              handleUnitPurchase(selectedUnitTypeForPurchase);
            } else {
              // Not a valid placement - clear selected unit type
              setSelectedUnitTypeForPurchase(null);
              // Also clear it from the game state
              setGameState({
                ...gameState,
                selectedUnitTypeForPurchase: null
              });
              setValidMoves([]);
            }
          }
        } else if (hex.unit) {
          // If clicking on a unit, select it and set as the selected unit
          setSelectedHex(hex);
          
          // Check if unit is player's unit
          if (hex.unit.owner === 'player' && !isAITurn) {
            // Check if this unit was bought in the current planning phase
            const isNewlyPurchasedUnit = gameState.pendingPurchases.some(
              purchase => 
                purchase.playerId === gameState.players.player.id && 
                purchase.position.q === hex.unit!.position.q && 
                purchase.position.r === hex.unit!.position.r
            );
            
            // Don't let the player move newly purchased units outside the base area
            if (isNewlyPurchasedUnit) {
              setSelectedUnit(hex.unit);
              
              // Get the player's base for range calculations
              const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
              
              if (playerBase) {
                // For newly purchased units, restrict movement to hexes around the base
                const hexesAroundBase = getHexesInRange(gameState.hexGrid, playerBase.coordinates, 1);
                const validHexesAroundBase = hexesAroundBase.filter(h => 
                  !h.unit && !h.isBase && h.terrain !== 'water' && h.terrain !== 'mountain'
                );
                
                setValidMoves(validHexesAroundBase.map(h => h.coordinates));
              }
            } else {
              // This is an existing unit (not newly purchased)
              
              // Find the unit's original position from the start of planning phase
              let originalPosition = hex.unit.position;
              const originalPositionData = originalUnitPositions.find(pos => pos.unitId === hex.unit!.id);
              if (originalPositionData) {
                originalPosition = originalPositionData.position;
              }
              
              // Select the unit
              setSelectedUnit(hex.unit);
              
              // Calculate valid moves from the ORIGINAL position, not current position
              const hexesInRange = getHexesInRange(gameState.hexGrid, originalPosition, hex.unit.movementRange);
              
              // Filter valid movement targets - exclude tiles with other units, water, mountains, etc.
              const validMoveCoords = hexesInRange
                .filter(h => {
                  // Skip if hex has a unit (unless it's our currently selected unit)
                  if (h.unit && h.unit.id !== hex.unit!.id) return false;
                  
                  // Skip terrain obstacles
                  if (h.terrain === 'water' || h.terrain === 'mountain') return false;
                  
                  // Allow moving to the original position (effectively canceling a move)
                  return true;
                })
                .map(h => h.coordinates);
              
              // Set valid move destinations
              setValidMoves(validMoveCoords);
            }
          } else {
            // Not a player unit or AI turn
            setSelectedUnit(null);
            setValidMoves([]);
          }
        } else if (hex.isResourceHex) {
          // Show info about resource hex
          setSelectedHex(hex);
          setSelectedUnit(null);
          setValidMoves([]);
        } else if (hex.isBase) {
          // Show base info
          setSelectedHex(hex);
          setSelectedUnit(null);
          setValidMoves([]);
        } else {
          // Select empty hex
          setSelectedHex(hex);
          setSelectedUnit(null);
          
          // If we have a unit type selected for purchase, we'll check if this is a valid placement
          if (selectedUnitTypeForPurchase && !isAITurn) {
            // Check if it's a valid placement position (near base)
            const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
            if (playerBase) {
              const isNearBase = getHexDistance(hex.coordinates, playerBase.coordinates) === 1;
              if (!isNearBase) {
                // Invalid placement location - clear selected unit type
                setSelectedUnitTypeForPurchase(null);
                setValidMoves([]);
              }
            }
          } else {
            // No unit type selected, clear valid moves
            setValidMoves([]);
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
  }, [gameState, selectedUnit, isAITurn, selectedHex, selectedUnitTypeForPurchase, originalUnitPositions]);

  // Handle unit selection from dashboard
  const handleUnitSelect = (unit: Unit) => {
    // Find the hex containing the unit
    const unitHex = gameState.hexGrid.find(
      hex => hex.unit && hex.unit.id === unit.id
    );
    
    if (unitHex) {
      // Simulate clicking the hex with the unit
      handleHexClick(unitHex);
    }
  };

  return {
    // State
    gameState,
    selectedHex,
    selectedUnit,
    selectedUnitTypeForPurchase,
    validMoves,
    isAITurn,
    timer,
    gameStarted,
    hasSavedGame,
    difficulty,
    
    // Handlers
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleUnitTypeSelect,
    handleEndTurn,
    handleCombatResolve,
    handleStartGame,
    handleContinueGame,
    handleRestart,
    handleReturnToIntro
  };
}; 