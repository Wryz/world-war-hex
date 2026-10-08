import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  Hex,
  HexCoordinates,
  Unit,
  UnitType
} from '@/types/game';
import {
  addPendingMove,
  addPendingPurchase,
  cancelPendingMove,
  cancelPendingPurchase,
  coordsEqual,
  executeMoves,
  getDeploymentHexes,
  getHand,
  getRosterStats,
  getTroopName,
  getValidMoveTargets,
  TERRAIN_EFFECTS,
  resolveAllCombats
} from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { buildBattle } from '@/lib/campaign/battleSetup';
import { getProfile } from '@/lib/meta/profile';
import { playBattleSound } from '../utils/battleSounds';
import { getGameSpeed } from '../effects/effects';
import { BATTLE_DURATION_MS, getArrivalTime, getBattleStartDelay, setBattleStartDelay } from '../utils/battleTiming';
import {
  BattleConfig,
  loadGameFromLocalStorage,
  saveGameToLocalStorage,
  clearSavedGame,
  sameBattle
} from '../storage/GameStorage';

// Why a selected unit can't move to a hex, in words the player can act on
const describeInvalidMove = (state: GameState, unit: Unit, hex: Hex): string => {
  const name = getTroopName(unit.type);
  if (unit.hasMoved) return `${name} just arrived and can't move until next turn`;
  if (coordsEqual(unit.position, hex.coordinates)) return `${name} is already here`;
  if (TERRAIN_EFFECTS[hex.terrain].moveCost === null) {
    return `${name} can't stop on ${TERRAIN_EFFECTS[hex.terrain].name.toLowerCase()} - pick another hex`;
  }
  if (hex.unit) return 'An enemy holds that hex - move next to it to attack';
  if (hex.isBase && hex.owner === 'player') return "Units can't stand on your own castle";
  const isClaimed =
    state.pendingMoves.some(m => m.unitId !== unit.id && coordsEqual(m.to, hex.coordinates)) ||
    state.pendingPurchases.some(p => coordsEqual(p.position, hex.coordinates));
  if (isClaimed) return 'Another unit is already heading there';
  return `Out of reach - ${name} can move ${unit.movementRange} this turn`;
};

// Short pauses that make the enemy's turn readable (scaled by the game speed)
// Executes a side's orders, noting how long its troops take to walk into any battles that follow
const executeTurn = (state: GameState): GameState => {
  const next = executeMoves(state);
  setBattleStartDelay(next.currentPhase === 'combat' ? getArrivalTime(state, next) : 0);
  return next;
};

const AI_PLANNING_DELAY = 700;
const AI_EXECUTION_DELAY = 450;

// Resume the saved battle if asked to and it is the same battle, otherwise start a new one
const createInitialGame = (battle: BattleConfig, resume: boolean) => {
  const saved = resume ? loadGameFromLocalStorage() : null;
  if (!saved || !sameBattle(saved.additionalData.battle, battle)) {
    return { gameState: buildBattle(battle, getProfile()), elapsedSeconds: 0, isResumed: false };
  }

  const savedState = saved.gameState;
  const gameState: GameState = {
    ...savedState,
    activePlayer: savedState.activePlayer ?? 'player',
    planningTimeRemaining: saved.additionalData.timer || savedState.settings!.planningPhaseTime,
    selectedUnitTypeForPurchase: null
  };
  return { gameState, elapsedSeconds: saved.additionalData.elapsedSeconds ?? 0, isResumed: true };
};

interface GameHandlerOptions {
  battle: BattleConfig;
  // Continue the saved battle instead of starting a new one (falls back to a new one if there is none)
  resume: boolean;
  // False while the loading screen still covers the board: turn timers and the AI wait until then
  isReady: boolean;
}

export const useGameHandlers = ({ battle, resume, isReady }: GameHandlerOptions) => {
  // Created once: either the saved battle or a fresh one
  const [initialGame] = useState(() => createInitialGame(battle, resume));
  const [gameState, setGameState] = useState<GameState>(initialGame.gameState);
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedUnitTypeForPurchase, setSelectedUnitTypeForPurchase] = useState<UnitType | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  const [timer, setTimer] = useState(initialGame.gameState.planningTimeRemaining);
  // Short warning shown to the player, e.g. when they pick a hex a unit can't move to
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  // Wall-clock seconds spent in this battle (for stats)
  const elapsedRef = useRef(initialGame.elapsedSeconds);

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

  // The player's orders this turn, so the last one can be taken back: the state before each
  const orderHistoryRef = useRef<GameState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const commitOrder = useCallback((newState: GameState) => {
    if (newState === stateRef.current) return;
    orderHistoryRef.current.push(stateRef.current);
    setCanUndo(true);
    commitState(newState);
  }, [commitState]);
  // A new turn (or a new battle) starts with nothing to undo
  useEffect(() => {
    orderHistoryRef.current = [];
    setCanUndo(false);
  }, [gameState.turnNumber, gameState.activePlayer, gameState.currentPhase]);

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

  // A brand new battle replaces any older save
  useEffect(() => {
    if (!initialGame.isResumed) clearSavedGame();
  }, [initialGame]);

  // Count time spent in the battle while the tab is visible
  useEffect(() => {
    if (!isReady || currentPhase === 'gameOver') return;
    const interval = setInterval(() => {
      if (!document.hidden) elapsedRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, [isReady, currentPhase]);

  // Save the battle (anything after it starts and before it ends), with the planning time left on the clock
  const saveGame = useCallback((timeLeft = timerRef.current) => {
    const current = stateRef.current;
    if (current.currentPhase === 'setup' || current.currentPhase === 'gameOver') return false;
    return saveGameToLocalStorage(current, { timer: timeLeft, battle, elapsedSeconds: elapsedRef.current });
  }, [battle]);

  // Autosave at the start of each of the player's turns, and forget the save once the battle is over
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
    commitState(executeTurn(current));
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
    const speed = getGameSpeed();

    const planningTimeout = setTimeout(() => {
      commitState(planAITurn(stateRef.current));

      executionTimeout = setTimeout(() => {
        commitState(executeTurn(stateRef.current));
      }, AI_EXECUTION_DELAY / speed);
    }, AI_PLANNING_DELAY / speed);

    return () => {
      clearTimeout(planningTimeout);
      if (executionTimeout) clearTimeout(executionTimeout);
    };
  }, [isReady, currentPhase, isAITurn, turnNumber, commitState]);

  // All of the turn's battles play out together, then resolve at once
  useEffect(() => {
    if (!isReady || currentPhase !== 'combat') return;
    if (!gameState.combats.some(c => !c.resolved) && !gameState.siege) return;

    // Troops walk to the fight first, then it plays out
    const battleDelay = setTimeout(() => {
      commitState(resolveAllCombats(stateRef.current));
    }, (getBattleStartDelay() * 1000 + BATTLE_DURATION_MS) / getGameSpeed());

    return () => clearTimeout(battleDelay);
  }, [isReady, currentPhase, gameState.combats, gameState.siege, commitState]);

  // Fight the same battle again from the start
  const handleRestart = () => {
    clearSavedGame();
    elapsedRef.current = 0;
    commitState(buildBattle(battle, getProfile()));
    clearSelection();
  };

  // Pick a card from the hand: show where it can be deployed. Picking it again puts it back.
  const handleUnitTypeSelect = (unitType: UnitType) => {
    const current = stateRef.current;
    if (!isPlayerPlanning()) return;

    if (selectedUnitTypeForPurchase === unitType) {
      clearSelection();
      return;
    }

    const stats = getRosterStats(current, 'player', unitType);
    if (!stats || !getHand(current).includes(unitType)) return;
    if (current.players.player.points < stats.cost) {
      showNotice(`Not enough gold - ${getTroopName(unitType)} costs ${stats.cost}`);
      return;
    }

    const deploymentHexes = getDeploymentHexes(current, 'player');
    if (deploymentHexes.length === 0) {
      showNotice('No free hex to deploy on - move a unit away from your castle or take a camp');
      return;
    }

    setSelectedUnitTypeForPurchase(unitType);
    setSelectedUnit(null);
    // The glowing deployment hexes show where it can go; nothing is selected, so the camera stays
    // on whichever of your castle or camps it is looking at
    setValidMoves(deploymentHexes.map(hex => ({ ...hex.coordinates })));
    setSelectedHex(null);
  };

  // Play the selected card onto a hex
  const handleUnitPurchase = (unitType: UnitType, hex: Hex): boolean => {
    const current = stateRef.current;
    if (!isPlayerPlanning()) return false;

    const newState = addPendingPurchase(current, current.players.player.id, unitType, hex.coordinates);
    if (newState === current) return false;

    commitOrder(newState);
    clearSelection();
    return true;
  };

  // Handle hex click
  const handleHexClick = (hex: Hex) => {
    const current = stateRef.current;
    if (current.currentPhase !== 'planning') {
      setSelectedHex(hex);
      return;
    }

    if (!isPlayerPlanning()) {
      setSelectedHex(hex);
      // Don't allow player actions during AI turn
      setSelectedUnit(null);
      setValidMoves([]);
      return;
    }

    const playerId = current.players.player.id;

    // Playing a card: a highlighted hex deploys it; anything else puts the card back
    if (selectedUnitTypeForPurchase) {
      const isDeployable = validMoves.some(c => coordsEqual(c, hex.coordinates));
      if (isDeployable) {
        handleUnitPurchase(selectedUnitTypeForPurchase, hex);
      } else {
        clearSelection();
        setSelectedHex(hex);
      }
      return;
    }

    // Move the selected unit to a valid destination
    if (selectedUnit && validMoves.some(c => coordsEqual(c, hex.coordinates))) {
      commitOrder(addPendingMove(current, selectedUnit.id, playerId, hex.coordinates));
      setSelectedHex(hex);
      setSelectedUnit(null);
      setValidMoves([]);
      return;
    }

    // Sending a troop onto the hex of one heading to this troop's hex: they would swap places
    const occupantMove = hex.unit && hex.unit.owner === 'player' && hex.unit.id !== selectedUnit?.id
      ? current.pendingMoves.find(move => move.unitId === hex.unit!.id)
      : undefined;
    if (selectedUnit && occupantMove && coordsEqual(occupantMove.to, selectedUnit.position)) {
      showNotice("Two troops can't swap places - send one somewhere else first");
      return;
    }

    // A unit is selected but this isn't somewhere it can go: explain why and keep it selected
    // so the player can pick another hex (clicking another of their units still switches to it)
    if (selectedUnit && !(hex.unit && hex.unit.owner === 'player')) {
      showNotice(describeInvalidMove(current, selectedUnit, hex));
      return;
    }

    setSelectedHex(hex);

    // Clicking a queued card cancels it, refunds the gold and returns the card to the hand
    const pendingPurchaseHere = current.pendingPurchases.find(
      p => p.playerId === playerId && coordsEqual(p.position, hex.coordinates)
    );
    if (pendingPurchaseHere) {
      commitOrder(cancelPendingPurchase(current, playerId, hex.coordinates));
      setSelectedUnit(null);
      setValidMoves([]);
      return;
    }

    // Clicking the destination of a queued move cancels that move
    const pendingMoveToThisHex = current.pendingMoves.find(
      move => move.playerId === playerId && coordsEqual(move.to, hex.coordinates)
    );
    if (pendingMoveToThisHex) {
      commitOrder(cancelPendingMove(current, pendingMoveToThisHex.unitId));
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
  };

  // Take back the last order given this turn (a move, a card played, or a cancel)
  const handleUndo = useCallback(() => {
    if (!isPlayerPlanning()) return;
    const previous = orderHistoryRef.current.pop();
    setCanUndo(orderHistoryRef.current.length > 0);
    if (!previous) return;
    clearSelection();
    // Keep the clock running from where it is now
    commitState({ ...previous, planningTimeRemaining: stateRef.current.planningTimeRemaining });
  }, [clearSelection, commitState]);

  // Handle unit selection by clicking a unit on the board
  const handleUnitSelect = (unit: Unit) => {
    const unitHex = stateRef.current.hexGrid.find(
      hex => hex.unit && hex.unit.id === unit.id
    );

    if (unitHex) {
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
    elapsedRef,

    // Handlers
    handleHexClick,
    handleUnitSelect,
    handleUnitPurchase,
    handleUnitTypeSelect,
    handleEndTurn: executeAllMoves,
    handleRestart,
    saveGame,
    handleCancelSelection: clearSelection,
    handleUndo,
    canUndo,
    notice
  };
};
