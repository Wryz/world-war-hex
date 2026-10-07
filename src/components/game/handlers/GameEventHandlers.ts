import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  Hex,
  HexCoordinates,
  Unit,
  UnitType
} from '@/types/game';
import {
  initializeGameState,
  UNITS,
  addPendingMove,
  addPendingPurchase,
  cancelPendingMove,
  cancelPendingPurchase,
  coordsEqual,
  executeMoves,
  getDeploymentHexes,
  getValidBaseLocations,
  getValidMoveTargets,
  placeBases,
  resolveCombat,
  DEFAULT_SETTINGS
} from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import {
  loadGameFromLocalStorage,
  clearSavedGame
} from '../storage/GameStorage';

type Difficulty = 'easy' | 'medium' | 'hard';

// Delays that make the AI look like it's "thinking"
const AI_PLANNING_DELAY = 1500;
const AI_EXECUTION_DELAY = 1000;
// How long each battle plays out on the board before its result is applied
const BATTLE_DURATION = 2600;

const createNewGame = (difficulty: Difficulty) =>
  initializeGameState({ ...DEFAULT_SETTINGS, aiDifficulty: difficulty });

export const useGameHandlers = () => {
  // State variables
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameState, setGameState] = useState<GameState>(() => createNewGame('medium'));
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedUnitTypeForPurchase, setSelectedUnitTypeForPurchase] = useState<UnitType | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  const [timer, setTimer] = useState(DEFAULT_SETTINGS.planningPhaseTime);

  // Always points at the latest game state so timers and async callbacks never act on stale state
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const commitState = useCallback((newState: GameState) => {
    stateRef.current = newState;
    setGameState(newState);
  }, []);

  const isAITurn = (gameState.activePlayer ?? 'player') === 'ai';
  const { currentPhase, turnNumber } = gameState;

  const clearSelection = useCallback(() => {
    setSelectedHex(null);
    setSelectedUnit(null);
    setSelectedUnitTypeForPurchase(null);
    setValidMoves([]);
  }, []);

  // Check for saved game on mount
  useEffect(() => {
    setHasSavedGame(!!loadGameFromLocalStorage());
  }, []);

  // Clear selection whenever the phase or the active side changes
  useEffect(() => {
    clearSelection();
  }, [currentPhase, isAITurn, clearSelection]);

  // Execute all pending moves for the side whose turn it is
  const executeAllMoves = useCallback(() => {
    const current = stateRef.current;
    if (current.currentPhase !== 'planning') return;

    clearSelection();
    commitState(executeMoves(current));
  }, [clearSelection, commitState]);

  // Planning timer for the player's turn - when it runs out the turn ends automatically
  useEffect(() => {
    if (currentPhase !== 'planning' || isAITurn) return;

    let remaining = stateRef.current.planningTimeRemaining;
    setTimer(remaining);

    const timerInterval = setInterval(() => {
      remaining -= 1;
      setTimer(Math.max(0, remaining));

      if (remaining <= 0) {
        clearInterval(timerInterval);
        executeAllMoves();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [currentPhase, isAITurn, turnNumber, executeAllMoves]);

  // AI turn: plan purchases and moves, then execute them
  useEffect(() => {
    if (currentPhase !== 'planning' || !isAITurn) return;

    let executionTimeout: ReturnType<typeof setTimeout> | undefined;

    const planningTimeout = setTimeout(() => {
      commitState(planAITurn(stateRef.current));

      executionTimeout = setTimeout(() => {
        commitState(executeMoves(stateRef.current));
      }, AI_EXECUTION_DELAY);
    }, AI_PLANNING_DELAY);

    return () => {
      clearTimeout(planningTimeout);
      if (executionTimeout) clearTimeout(executionTimeout);
    };
  }, [currentPhase, isAITurn, turnNumber, commitState]);

  // Battles fight themselves out one at a time - units in range always fight
  useEffect(() => {
    if (currentPhase !== 'combat') return;

    const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
    if (unresolvedCombatIndex === -1) return;

    const battleDelay = setTimeout(() => {
      commitState(resolveCombat(stateRef.current, unresolvedCombatIndex));
    }, BATTLE_DURATION);

    return () => clearTimeout(battleDelay);
  }, [currentPhase, gameState.combats, commitState]);

  // Continue saved game. Returns false if there is no saved game to continue.
  const handleContinueGame = (): boolean => {
    const savedData = loadGameFromLocalStorage();
    if (!savedData?.gameState) return false;

    const savedDifficulty = savedData.additionalData?.difficulty || 'medium';
    const savedState = savedData.gameState;
    const settings = savedState.settings ?? { ...DEFAULT_SETTINGS, aiDifficulty: savedDifficulty };

    commitState({
      ...savedState,
      settings,
      activePlayer: savedState.activePlayer ?? (savedData.additionalData?.isAITurn ? 'ai' : 'player'),
      planningTimeRemaining: savedData.additionalData?.timer || settings.planningPhaseTime,
      selectedUnitTypeForPurchase: null
    });
    setDifficulty(savedDifficulty);
    clearSelection();
    setGameStarted(true);
    return true;
  };

  // Handle game start
  const handleStartGame = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    commitState(createNewGame(selectedDifficulty));
    clearSelection();
    // Clear any existing saved game
    clearSavedGame();
    setHasSavedGame(false);
    setGameStarted(true);
  };

  // Force return to intro screen
  const handleReturnToIntro = () => {
    setGameStarted(false);
  };

  // Restart game with the same difficulty
  const handleRestart = () => {
    handleStartGame(difficulty);
  };

  // Handle selection of unit type from barracks
  const handleUnitTypeSelect = (unitType: UnitType) => {
    const current = stateRef.current;
    if (current.currentPhase !== 'planning' || isAITurn) return;

    // Clicking the selected unit type again cancels placement mode
    if (selectedUnitTypeForPurchase === unitType) {
      clearSelection();
      return;
    }

    // Check if player can afford this unit
    const unitInfo = UNITS[unitType];
    if (!unitInfo || current.players.player.points < unitInfo.cost) return;

    const deploymentHexes = getDeploymentHexes(current, 'player');

    setSelectedUnitTypeForPurchase(unitType);
    setSelectedUnit(null);
    setValidMoves(deploymentHexes.map(hex => ({ ...hex.coordinates })));

    // Select the base hex to make it visually clear where units will be deployed
    const playerBase = current.hexGrid.find(h => h.isBase && h.owner === 'player');
    setSelectedHex(playerBase ?? null);
  };

  // Purchase the selected unit type and deploy it on the given hex
  const handleUnitPurchase = (unitType: UnitType, hex: Hex): boolean => {
    const current = stateRef.current;
    if (current.currentPhase !== 'planning' || isAITurn) return false;

    const newState = addPendingPurchase(current, current.players.player.id, unitType, hex.coordinates);
    if (newState === current) return false;

    commitState(newState);
    clearSelection();
    return true;
  };

  // Handle hex click
  const handleHexClick = (hex: Hex) => {
    const current = stateRef.current;

    switch (current.currentPhase) {
      case 'setup': {
        // Two-step base placement: first click selects, clicking the same hex again confirms
        if (selectedHex && coordsEqual(selectedHex.coordinates, hex.coordinates)) {
          const newState = placeBases(current, hex.coordinates);
          if (newState !== current) {
            commitState(newState);
            clearSelection();
          }
        } else {
          setSelectedHex(hex);
          setValidMoves(getValidBaseLocations(current).map(h => h.coordinates));
        }
        break;
      }

      case 'planning': {
        setSelectedHex(hex);

        if (isAITurn) {
          // Don't allow player actions during AI turn
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        const playerId = current.players.player.id;

        // Placing a unit from the barracks: the board shows a preview and asks for a
        // second click to confirm, so here we only keep or cancel placement mode
        if (selectedUnitTypeForPurchase) {
          const isDeployable = validMoves.some(c => coordsEqual(c, hex.coordinates));
          if (!isDeployable) {
            setSelectedUnitTypeForPurchase(null);
            setValidMoves([]);
          }
          return;
        }

        // Move the selected unit to a valid destination
        if (selectedUnit && validMoves.some(c => coordsEqual(c, hex.coordinates))) {
          commitState(addPendingMove(current, selectedUnit.id, playerId, hex.coordinates));
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        // Clicking a queued purchase cancels it and refunds the gold
        const pendingPurchaseHere = current.pendingPurchases.find(
          p => p.playerId === playerId && coordsEqual(p.position, hex.coordinates)
        );
        if (pendingPurchaseHere) {
          commitState(cancelPendingPurchase(current, playerId, hex.coordinates));
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        // Clicking the destination of a queued move cancels that move
        const pendingMoveToThisHex = current.pendingMoves.find(
          move => move.playerId === playerId && coordsEqual(move.to, hex.coordinates)
        );
        if (pendingMoveToThisHex) {
          commitState(cancelPendingMove(current, pendingMoveToThisHex.unitId));
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        // Select one of the player's units and show where it can move
        if (hex.unit && hex.unit.owner === 'player') {
          if (selectedUnit?.id === hex.unit.id) {
            // Clicking the selected unit again deselects it
            setSelectedUnit(null);
            setValidMoves([]);
            return;
          }

          setSelectedUnit(hex.unit);
          setValidMoves(getValidMoveTargets(current, hex.unit));
          return;
        }

        // Anything else just shows hex info
        setSelectedUnit(null);
        setValidMoves([]);
        break;
      }

      default:
        // Select the hex to view details
        setSelectedHex(hex);
        break;
    }
  };

  // Handle unit selection from dashboard or by clicking a unit on the board
  const handleUnitSelect = (unit: Unit) => {
    const unitHex = stateRef.current.hexGrid.find(
      hex => hex.unit && hex.unit.id === unit.id
    );

    if (unitHex) {
      handleHexClick(unitHex);
    }
  };

  // Handle end turn button click
  const handleEndTurn = () => {
    if (isAITurn) return;
    executeAllMoves();
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
    handleStartGame,
    handleContinueGame,
    handleRestart,
    handleReturnToIntro,
    handleCancelSelection: clearSelection
  };
};
