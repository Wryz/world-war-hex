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
  TERRAIN_EFFECTS,
  resolveCombat,
  DEFAULT_SETTINGS
} from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { playBattleSound } from '../utils/battleSounds';
import { getUnitTypeName } from '../utils/UnitHelpers';
import {
  loadGameFromLocalStorage,
  saveGameToLocalStorage,
  clearSavedGame,
  Difficulty
} from '../storage/GameStorage';

// Why a selected unit can't move to a hex, in words the player can act on
const describeInvalidMove = (state: GameState, unit: Unit, hex: Hex): string => {
  const name = getUnitTypeName(unit.type);
  if (unit.hasMoved) return `${name} just arrived and can't move until next turn`;
  if (coordsEqual(unit.position, hex.coordinates)) return `${name} is already here`;
  if (TERRAIN_EFFECTS[hex.terrain].moveCost === null) {
    return `${name} can't cross ${TERRAIN_EFFECTS[hex.terrain].name.toLowerCase()} - pick another hex`;
  }
  if (hex.unit) return 'An enemy holds that hex - move next to it to attack';
  if (hex.isBase && hex.owner === 'player') return "Units can't stand on your own castle";
  const isClaimed =
    state.pendingMoves.some(m => m.unitId !== unit.id && coordsEqual(m.to, hex.coordinates)) ||
    state.pendingPurchases.some(p => coordsEqual(p.position, hex.coordinates));
  if (isClaimed) return 'Another unit is already heading there';
  return `Out of reach - ${name} can move ${unit.movementRange} this turn`;
};

// Delays that make the AI look like it's "thinking"
const AI_PLANNING_DELAY = 1500;
const AI_EXECUTION_DELAY = 1000;
// How long each battle plays out on the board before its result is applied
const BATTLE_DURATION = 2600;

const createNewGame = (difficulty: Difficulty) =>
  initializeGameState({ ...DEFAULT_SETTINGS, aiDifficulty: difficulty });

// Resume the saved game if asked to and one exists, otherwise start a new one
const createInitialGame = (difficulty: Difficulty, resume: boolean) => {
  const saved = resume ? loadGameFromLocalStorage() : null;
  if (!saved) {
    return { gameState: createNewGame(difficulty), difficulty, isResumed: false };
  }

  const savedState = saved.gameState;
  const gameState: GameState = {
    ...savedState,
    activePlayer: savedState.activePlayer ?? 'player',
    planningTimeRemaining: saved.additionalData.timer || savedState.settings!.planningPhaseTime,
    selectedUnitTypeForPurchase: null
  };
  return { gameState, difficulty: saved.additionalData.difficulty ?? difficulty, isResumed: true };
};

interface GameHandlerOptions {
  initialDifficulty: Difficulty;
  // Continue the saved game instead of starting a new one (falls back to a new game if there is none)
  resume: boolean;
  // False while the loading screen still covers the board: turn timers and the AI wait until then
  isReady: boolean;
}

export const useGameHandlers = ({ initialDifficulty, resume, isReady }: GameHandlerOptions) => {
  // Created once: either the saved game or a fresh one
  const [initialGame] = useState(() => createInitialGame(initialDifficulty, resume));
  const difficulty = initialGame.difficulty;
  const [gameState, setGameState] = useState<GameState>(initialGame.gameState);
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedUnitTypeForPurchase, setSelectedUnitTypeForPurchase] = useState<UnitType | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  const [timer, setTimer] = useState(initialGame.gameState.planningTimeRemaining);
  // Short warning shown to the player, e.g. when they pick a hex a unit can't move to
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const showNotice = useCallback((text: string) => {
    setNotice(current => ({ id: (current?.id ?? 0) + 1, text }));
    playBattleSound('blocked', 0.6);
  }, []);

  // Always points at the latest game state so timers and async callbacks never act on stale state
  const stateRef = useRef(gameState);
  stateRef.current = gameState;
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const commitState = useCallback((newState: GameState) => {
    stateRef.current = newState;
    setGameState(newState);
  }, []);

  const isAITurn = (gameState.activePlayer ?? 'player') === 'ai';
  const { currentPhase, turnNumber } = gameState;
  // Whether the player may act right now (read from the ref so it's correct even before a re-render)
  const isPlayerPlanning = () =>
    stateRef.current.currentPhase === 'planning' && (stateRef.current.activePlayer ?? 'player') === 'player';

  const clearSelection = useCallback(() => {
    setSelectedHex(null);
    setSelectedUnit(null);
    setSelectedUnitTypeForPurchase(null);
    setValidMoves([]);
  }, []);

  // A brand new game replaces any older save
  useEffect(() => {
    if (!initialGame.isResumed) clearSavedGame();
  }, [initialGame]);

  // Save the current game (anything after castle placement and before the end), with the
  // planning time left on the clock
  const saveGame = useCallback((timeLeft = timerRef.current) => {
    const current = stateRef.current;
    if (current.currentPhase === 'setup' || current.currentPhase === 'gameOver') return false;
    return saveGameToLocalStorage(current, { timer: timeLeft, difficulty });
  }, [difficulty]);

  // Autosave at the start of each of the player's turns, and forget the save once the game is over
  useEffect(() => {
    if (currentPhase === 'planning' && !isAITurn) saveGame(stateRef.current.planningTimeRemaining);
    if (currentPhase === 'gameOver') clearSavedGame();
  }, [currentPhase, isAITurn, turnNumber, saveGame]);

  // Clear selection whenever the phase or the active side changes
  useEffect(() => {
    clearSelection();
  }, [currentPhase, isAITurn, clearSelection]);

  // End the player's turn: execute their pending moves and purchases
  const executeAllMoves = useCallback(() => {
    const current = stateRef.current;
    // The turn may already have ended (e.g. the timer ran out just before End Turn was clicked)
    if (current.currentPhase !== 'planning' || (current.activePlayer ?? 'player') !== 'player') return;

    clearSelection();
    commitState(executeMoves(current));
  }, [clearSelection, commitState]);

  // Planning timer for the player's turn - when it runs out the turn ends automatically.
  // It doesn't start until the board is visible, and pauses while the tab is in the background.
  useEffect(() => {
    if (!isReady || currentPhase !== 'planning' || isAITurn) return;

    let remaining = stateRef.current.planningTimeRemaining;
    setTimer(remaining);

    const timerInterval = setInterval(() => {
      if (document.hidden) return;
      remaining -= 1;
      setTimer(Math.max(0, remaining));

      if (remaining <= 0) {
        clearInterval(timerInterval);
        executeAllMoves();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isReady, currentPhase, isAITurn, turnNumber, executeAllMoves]);

  // AI turn: plan purchases and moves, then execute them
  useEffect(() => {
    if (!isReady || currentPhase !== 'planning' || !isAITurn) return;

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
  }, [isReady, currentPhase, isAITurn, turnNumber, commitState]);

  // Battles fight themselves out one at a time - units in range always fight
  useEffect(() => {
    if (!isReady || currentPhase !== 'combat') return;

    const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
    if (unresolvedCombatIndex === -1) return;

    const battleDelay = setTimeout(() => {
      commitState(resolveCombat(stateRef.current, unresolvedCombatIndex));
    }, BATTLE_DURATION);

    return () => clearTimeout(battleDelay);
  }, [isReady, currentPhase, gameState.combats, commitState]);

  // Start a new game with the same difficulty
  const handleRestart = () => {
    clearSavedGame();
    commitState(createNewGame(difficulty));
    clearSelection();
  };

  // Handle selection of unit type from barracks
  const handleUnitTypeSelect = (unitType: UnitType) => {
    const current = stateRef.current;
    if (!isPlayerPlanning()) return;

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
    if (!isPlayerPlanning()) return false;

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
        if (!isPlayerPlanning()) {
          setSelectedHex(hex);
          // Don't allow player actions during AI turn
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        const playerId = current.players.player.id;

        // Placing a unit from the barracks: the board shows a preview and asks for a
        // second click to confirm, so here we only keep or cancel placement mode
        if (selectedUnitTypeForPurchase) {
          setSelectedHex(hex);
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
          setSelectedHex(hex);
          setSelectedUnit(null);
          setValidMoves([]);
          return;
        }

        // A unit is selected but this isn't somewhere it can go: explain why and keep it selected
        // so the player can pick another hex (clicking another of their units still switches to it)
        if (selectedUnit && !(hex.unit && hex.unit.owner === 'player')) {
          showNotice(describeInvalidMove(current, selectedUnit, hex));
          return;
        }

        setSelectedHex(hex);

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

    // Handlers
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleUnitTypeSelect,
    handleEndTurn,
    handleRestart,
    saveGame,
    handleCancelSelection: clearSelection,
    notice
  };
};
