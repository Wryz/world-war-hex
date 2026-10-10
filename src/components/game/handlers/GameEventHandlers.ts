import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  Hex,
  HexCoordinates,
  Move,
  PlayerType,
  Purchase,
  Unit,
  UnitType,
  UnitAction
} from '@/types/game';
import {
  addPendingMove,
  addPendingPurchase,
  cancelPendingMove,
  cancelPendingPurchase,
  chooseCastle,
  coordsEqual,
  executeMoves,
  endTurn,
  resign,
  getDeploymentHexes,
  getHand,
  getRosterStats,
  getTroopName,
  getValidMoveTargets,
  getFellTargets,
  getActionTargets,
  isImpassable,
  TERRAIN_EFFECTS,
  resolveAllCombats,
  getMovementRange
} from '@/lib/game/gameState';
import { getHexDistance } from '@/lib/game/hexUtils';
import { isAiSide, isMultiSide } from '@/lib/game/sides';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { trackEvent } from '@/lib/analytics';
import { buildBattle } from '@/lib/campaign/battleSetup';
import { getProfile } from '@/lib/meta/profile';
import { playBattleSound } from '../utils/battleSounds';
import { getGameSpeed } from '../effects/effects';
import { pendingHealthWait } from '../effects/healthTimeline';
import { BATTLE_DURATION_MS, getArrivalTime, getBattleStartDelay, setBattleStartDelay } from '../utils/battleTiming';
import { createReplayLog, recordFrame } from '../replay/replay';
import {
  BattleConfig,
  loadGameFromLocalStorage,
  saveGameToLocalStorage,
  clearSavedGame,
  sameBattle
} from '../storage/GameStorage';

// Why a selected unit can't move to a hex, in words the player can act on
const describeInvalidMove = (state: GameState, unit: Unit, hex: Hex, viewer: PlayerType): string => {
  const name = getTroopName(unit.type);
  if (unit.hasMoved) return `${name} just arrived and can't move until next turn`;
  if (coordsEqual(unit.position, hex.coordinates)) return `${name} is already here`;
  if (hex.feature === 'greatTree') {
    return unit.abilities.includes('flying')
      ? `${name} can't swing an axe - send a troop on foot next to the tree`
      : getHexDistance(unit.position, hex.coordinates) === 1
        ? "The tree can't fall that way - chop it from another side"
        : `Move ${name} next to the great tree to chop it down`;
  }
  if (hex.feature === 'log') return 'A fallen trunk blocks that hex';
  if (hex.terrain === 'gate' && hex.owner && hex.owner !== unit.owner) return 'The enemy holds that gate - Siege Sappers can tear it down';
  if (hex.terrain === 'wall') return 'A stone wall - go round it, through a gate, or bring Siege Sappers';
  if (hex.feature === 'stakes' && !unit.abilities.includes('flying')) return 'Cavalry can\'t cross stakes - send troops on foot';
  if (hex.fire?.stage === 'burning') return "That hex is on fire - wait for it to burn out";
  if (isImpassable(hex)) {
    return `${name} can't stop on ${TERRAIN_EFFECTS[hex.terrain].name.toLowerCase()} - pick another hex`;
  }
  if (hex.unit) return 'An enemy holds that hex - move next to it to attack';
  if (hex.isBase && hex.owner === viewer) return "Units can't stand on your own castle";
  if (hex.isBase) return "Units can't stand on a castle - attack it from next to it";
  const isClaimed =
    state.pendingMoves.some(m => m.unitId !== unit.id && coordsEqual(m.to, hex.coordinates)) ||
    state.pendingPurchases.some(p => coordsEqual(p.position, hex.coordinates));
  if (isClaimed) return 'Another unit is already heading there';
  return `Out of reach - ${name} can move ${getMovementRange(state, unit)} this turn`;
};

// Short pauses that make the enemy's turn readable (scaled by the game speed)
// Executes a side's orders, noting how long its troops take to walk into any battles that follow
// (a turn without a fight pauses after its moves, so the end of the turn - healing at springs,
// burning, the catapult - comes once the troops have arrived; see endTurn)
const executeTurn = (state: GameState): GameState => {
  const next = executeMoves(state, { holdTurnEnd: true });
  setBattleStartDelay(next.currentPhase === 'combat' || next.currentPhase === 'execution' ? getArrivalTime(state, next) : 0);
  return next;
};

// How long until the board has shown everything still to land (a tree, a stone, a boss's strike)
// in a state
const timelineWait = (state: GameState) => pendingHealthWait(state);
// A short beat once the troops have arrived, before the end of the turn
const TURN_END_PAUSE_MS = 250;

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

// A side's orders for its turn, as sent between the players of an online battle
export interface TurnOrders {
  turn: number;
  side: PlayerType;
  moves: Move[];
  purchases: Purchase[];
}

// How an online battle is driven (see lib/pvp/room): the host's game runs the battle - the AI's
// sides included - and passes every state on to the others; a guest plans its own turns on its copy
// and sends its orders to the host
export interface BattleLink {
  role: 'host' | 'guest';
  // (host) each state the battle moves to
  onState?: (state: GameState) => void;
  // (host) sides played by someone elsewhere: their turns wait for their orders
  isRemoteSide?: (side: PlayerType) => boolean;
  // (guest) the viewer's orders, once their turn is over
  sendOrders?: (orders: TurnOrders) => void;
}

// A remote side gets this long beyond the turn's time for its orders to arrive before its turn
// ends without them
const REMOTE_GRACE_SECONDS = 6;

interface GameHandlerOptions {
  battle: BattleConfig;
  // Continue the saved battle instead of starting a new one (falls back to a new one if there is none)
  resume: boolean;
  // False while the loading screen still covers the board: turn timers and the AI wait until then
  isReady: boolean;
  // No turn timer (the first battle's tutorial: a new player takes their time)
  untimed?: boolean;
  // A battle between more sides: the side the viewer plays, and the battle (built elsewhere)
  viewer?: PlayerType;
  initialState?: GameState;
  // An online battle's link to the other players
  link?: BattleLink;
}

export const useGameHandlers = ({ battle, resume, isReady, untimed = false, viewer = 'player', initialState, link }: GameHandlerOptions) => {
  // Created once: either the saved battle or a fresh one (or the battle given)
  const [initialGame] = useState(() => initialState
    ? { gameState: initialState, elapsedSeconds: 0, isResumed: true }
    : createInitialGame(battle, resume));
  const [gameState, setGameState] = useState<GameState>(initialGame.gameState);
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedUnitTypeForPurchase, setSelectedUnitTypeForPurchase] = useState<UnitType | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  // A hex where the selected troop could either move or do some work: the player picks which
  const [actionChoice, setActionChoice] = useState<{ unitId: string; at: HexCoordinates; actions: UnitAction[]; canMove: boolean } | null>(null);
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

  // The battle as the board showed it, to watch again once it's over (the player's orders are kept as
  // they stand when the turn ends, not one by one)
  const replayRef = useRef(createReplayLog(initialGame.gameState));

  const linkRef = useRef(link);
  linkRef.current = link;
  const commitState = useCallback((newState: GameState, record = true) => {
    stateRef.current = newState;
    setGameState(newState);
    if (record) recordFrame(replayRef.current, newState);
    // (the host passes every step of the battle on - but not the orders it is still giving)
    if (record && linkRef.current?.role === 'host') linkRef.current.onState?.(newState);
  }, []);

  // The player's orders this turn, so the last one can be taken back: the state before each
  const orderHistoryRef = useRef<GameState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const commitOrder = useCallback((newState: GameState) => {
    if (newState === stateRef.current) return;
    orderHistoryRef.current.push(stateRef.current);
    setCanUndo(true);
    commitState(newState, false);
  }, [commitState]);
  // A new turn (or a new battle) starts with nothing to undo
  useEffect(() => {
    orderHistoryRef.current = [];
    setCanUndo(false);
  }, [gameState.turnNumber, gameState.activePlayer, gameState.currentPhase]);

  const activeSide = gameState.activePlayer ?? 'player';
  // Another side's turn (the AI's, or someone else's online): the viewer waits
  const isAITurn = activeSide !== viewer;
  // The AI plays this turn (on the game that runs the battle: never a guest's)
  const isAiPlaying = isAiSide(gameState, activeSide) && link?.role !== 'guest' && !gameState.players[activeSide]?.eliminated;
  // Someone elsewhere plays this turn (the host waits for their orders)
  const isRemoteTurn = link?.role === 'host' && !!link.isRemoteSide?.(activeSide);
  const isGuest = link?.role === 'guest';
  const multi = isMultiSide(gameState);
  const { currentPhase, turnNumber } = gameState;
  // Whether the player may act right now (read from the ref so it's correct even before a re-render)
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const isPlayerPlanning = () =>
    stateRef.current.currentPhase === 'planning' && (stateRef.current.activePlayer ?? 'player') === viewerRef.current &&
    !stateRef.current.players[viewerRef.current]?.eliminated && !ordersSentRef.current;
  // (a guest has sent this turn's orders and waits for the host to carry them out)
  const ordersSentRef = useRef<string | null>(null);
  const turnKey = (state: GameState) => `${state.turnNumber}-${state.activePlayer}`;
  if (ordersSentRef.current && ordersSentRef.current !== turnKey(gameState)) ordersSentRef.current = null;

  const clearSelection = useCallback(() => {
    setSelectedHex(null);
    setSelectedUnit(null);
    setSelectedUnitTypeForPurchase(null);
    setValidMoves([]);
    setActionChoice(null);
  }, []);

  // A brand new battle replaces any older save
  useEffect(() => {
    if (!initialGame.isResumed && !initialState) clearSavedGame();
  }, [initialGame, initialState]);

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
    // (a battle between more sides isn't saved: an online one lives with its players)
    if (current.currentPhase === 'setup' || current.currentPhase === 'gameOver' || isMultiSide(current)) return false;
    return saveGameToLocalStorage(current, { timer: timeLeft, battle, elapsedSeconds: elapsedRef.current });
  }, [battle]);

  // Autosave at the start of each of the player's turns, and forget the save once the battle is over
  useEffect(() => {
    if (multi) return;
    if (currentPhase === 'planning' && !isAITurn) saveGame(stateRef.current.planningTimeRemaining);
    if (currentPhase === 'gameOver') clearSavedGame();
  }, [currentPhase, isAITurn, turnNumber, saveGame, multi]);

  // Clear selection whenever the phase or the active side changes
  useEffect(() => {
    clearSelection();
  }, [currentPhase, isAITurn, clearSelection]);

  // End the player's turn: execute their pending moves and purchases
  const executeAllMoves = useCallback(() => {
    const current = stateRef.current;
    // The turn may already have ended (e.g. the timer ran out just before Confirm was clicked)
    if (current.currentPhase !== 'planning' || (current.activePlayer ?? 'player') !== viewer || ordersSentRef.current) return;

    clearSelection();
    // (a guest hands its orders to the host, which carries them out for everyone)
    if (linkRef.current?.role === 'guest') {
      const playerId = current.players[viewer]?.id;
      ordersSentRef.current = turnKey(current);
      linkRef.current.sendOrders?.({
        turn: current.turnNumber,
        side: viewer,
        moves: current.pendingMoves.filter(move => move.playerId === playerId),
        purchases: current.pendingPurchases.filter(purchase => purchase.playerId === playerId)
      });
      setGameState({ ...current });
      return;
    }
    recordFrame(replayRef.current, current);
    commitState(executeTurn(current));
  }, [clearSelection, commitState, viewer]);

  // Planning timer for the player's turn - when it runs out the turn ends automatically.
  // It doesn't start until the board is visible, and pauses while the tab is in the background.
  useEffect(() => {
    if (!isReady || currentPhase !== 'planning' || isAITurn || untimed || gameState.players[viewer]?.eliminated) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, currentPhase, isAITurn, turnNumber, executeAllMoves, untimed]);

  // Another side's turn online: the host waits for its orders, a little longer than the turn lasts
  // (they arrive through applyRemoteOrders), then ends the turn without them
  useEffect(() => {
    if (!isReady || currentPhase !== 'planning' || !isRemoteTurn) return;
    const key = turnKey(stateRef.current);
    const timeout = setTimeout(() => {
      const current = stateRef.current;
      if (current.currentPhase !== 'planning' || turnKey(current) !== key) return;
      commitState(executeTurn({ ...current, pendingMoves: [], pendingPurchases: [] }));
    }, (stateRef.current.planningTimeRemaining + REMOTE_GRACE_SECONDS) * 1000);
    return () => clearTimeout(timeout);
  }, [isReady, currentPhase, isRemoteTurn, turnNumber, activeSide, commitState]);

  // (host) A remote side's orders for its turn: given on the board as that side, then carried out
  const applyRemoteOrders = useCallback((orders: TurnOrders) => {
    const current = stateRef.current;
    if (current.currentPhase !== 'planning' || current.activePlayer !== orders.side || current.turnNumber !== orders.turn) return;
    if (!linkRef.current?.isRemoteSide?.(orders.side)) return;
    const playerId = current.players[orders.side]?.id;
    if (!playerId) return;
    let planned: GameState = { ...current, pendingMoves: [], pendingPurchases: [] };
    for (const purchase of orders.purchases) planned = addPendingPurchase(planned, playerId, purchase.unitType, purchase.position);
    for (const move of orders.moves) planned = addPendingMove(planned, move.unitId, playerId, move.to, move.action);
    commitState(executeTurn(planned));
  }, [commitState]);

  // (guest) The battle as the host has it now
  const receiveState = useCallback((next: GameState) => {
    const current = stateRef.current;
    // (still giving this turn's orders: the host's copy of the same moment would wipe them)
    if (isPlayerPlanning() && turnKey(next) === turnKey(current) && next.currentPhase === current.currentPhase) return;
    // Troops walk into their battles before they fight, as on the host's board
    if ((next.currentPhase === 'combat' || next.currentPhase === 'execution') && current.currentPhase === 'planning') {
      setBattleStartDelay(getArrivalTime(current, next));
    }
    commitState(next);
  }, [commitState]);

  // AI turn: plan purchases and moves, then execute them
  useEffect(() => {
    if (!isReady || currentPhase !== 'planning' || !isAiPlaying) return;

    let executionTimeout: ReturnType<typeof setTimeout> | undefined;
    const speed = getGameSpeed();

    // (once the board has shown everything from the turn before)
    const planningTimeout = setTimeout(() => {
      commitState(planAITurn(stateRef.current));

      executionTimeout = setTimeout(() => {
        commitState(executeTurn(stateRef.current));
      }, AI_EXECUTION_DELAY / speed);
    }, Math.max(AI_PLANNING_DELAY / speed, timelineWait(stateRef.current)));

    return () => {
      clearTimeout(planningTimeout);
      if (executionTimeout) clearTimeout(executionTimeout);
    };
  }, [isReady, currentPhase, isAiPlaying, turnNumber, activeSide, commitState]);

  // A turn without a fight ends once its troops have arrived and the board has shown its moves
  // (a guest's board waits for the host to say so)
  useEffect(() => {
    if (!isReady || currentPhase !== 'execution' || isGuest) return;
    const timeout = setTimeout(() => {
      commitState(endTurn(stateRef.current));
    }, Math.max((getBattleStartDelay() * 1000 + TURN_END_PAUSE_MS) / getGameSpeed(), timelineWait(stateRef.current)));
    return () => clearTimeout(timeout);
  }, [isReady, currentPhase, turnNumber, commitState, isGuest]);

  // All of the turn's battles play out together, then resolve at once
  useEffect(() => {
    if (!isReady || currentPhase !== 'combat' || isGuest) return;
    if (!gameState.combats.some(c => !c.resolved) && !gameState.siege) return;

    // Troops walk to the fight first, then it plays out
    const battleDelay = setTimeout(() => {
      commitState(resolveAllCombats(stateRef.current));
    }, (getBattleStartDelay() * 1000 + BATTLE_DURATION_MS) / getGameSpeed());

    return () => clearTimeout(battleDelay);
  }, [isReady, currentPhase, gameState.combats, gameState.siege, commitState, isGuest]);

  // Fight the same battle again from the start
  const handleRestart = () => {
    clearSavedGame();
    elapsedRef.current = 0;
    const fresh = initialState ?? buildBattle(battle, getProfile());
    replayRef.current = createReplayLog(fresh);
    commitState(fresh, false);
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

    const stats = getRosterStats(current, viewer, unitType);
    if (!stats || !getHand(current, viewer).includes(unitType)) return;
    if (current.players[viewer].points < stats.cost) {
      showNotice(`Not enough gold - ${getTroopName(unitType)} costs ${stats.cost}`);
      return;
    }

    const deploymentHexes = getDeploymentHexes(current, viewer);
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

    const newState = addPendingPurchase(current, current.players[viewer].id, unitType, hex.coordinates);
    if (newState === current) return false;

    commitOrder(newState);
    clearSelection();
    return true;
  };

  // The player's pick for a hex where the troop could move or work: an action, or null to move there
  const handleActionChoice = (action: UnitAction | null) => {
    const current = stateRef.current;
    if (!actionChoice || !isPlayerPlanning()) return;
    commitOrder(addPendingMove(current, actionChoice.unitId, current.players[viewer].id, actionChoice.at, action ?? undefined));
    clearSelection();
  };

  // Handle hex click
  // Pick one of the player's troops and show everything it can be ordered to (or, picked already,
  // put it down again)
  const toggleOwnUnit = (current: GameState, unit: Unit) => {
    if (selectedUnit?.id === unit.id) {
      setSelectedUnit(null);
      setValidMoves([]);
      return;
    }
    setSelectedUnit(unit);
    setValidMoves([...getValidMoveTargets(current, unit), ...getFellTargets(current, unit), ...getActionTargets(current, unit).map(target => target.at)]);
  };

  const handleHexClick = (hex: Hex) => {
    const current = stateRef.current;
    // Before the first turn: build the castle on one of the offered sites
    if (current.currentPhase === 'setup') {
      const placed = chooseCastle(current, hex.coordinates);
      if (placed === current) {
        if (current.castleChoices) showNotice('Pick one of the glowing sites on your edge of the map');
        return;
      }
      trackEvent('castle_chosen', { option: current.castleChoices!.findIndex(c => coordsEqual(c, hex.coordinates)), level: current.levelId });
      commitState(placed);
      return;
    }
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

    const playerId = current.players[viewer].id;

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

    // Work the selected troop can do on this hex (demolish, set alight, build): done at once when it
    // is the only thing to do there, otherwise the player chooses between moving and the work
    if (selectedUnit && validMoves.some(c => coordsEqual(c, hex.coordinates))) {
      const unit = current.players[viewer].units.find(u => u.id === selectedUnit.id) ?? selectedUnit;
      const actions = getActionTargets(current, unit).filter(target => coordsEqual(target.at, hex.coordinates)).map(target => target.action);
      if (actions.length > 0) {
        const withoutOrder = { ...current, pendingMoves: current.pendingMoves.filter(m => m.unitId !== unit.id) };
        const canMove = [...getValidMoveTargets(withoutOrder, unit), ...getFellTargets(withoutOrder, unit)].some(c => coordsEqual(c, hex.coordinates));
        if (!canMove && actions.length === 1) {
          commitOrder(addPendingMove(current, unit.id, playerId, hex.coordinates, actions[0]));
          clearSelection();
        } else {
          setActionChoice({ unitId: unit.id, at: hex.coordinates, actions, canMove });
        }
        return;
      }
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
    const occupantMove = hex.unit && hex.unit.owner === viewer && hex.unit.id !== selectedUnit?.id
      ? current.pendingMoves.find(move => move.unitId === hex.unit!.id)
      : undefined;
    if (selectedUnit && occupantMove && coordsEqual(occupantMove.to, selectedUnit.position)) {
      showNotice("Two troops can't swap places - send one somewhere else first");
      return;
    }

    // A unit is selected but this isn't somewhere it can go: explain why and keep it selected
    // so the player can pick another hex (clicking another of their units still switches to it)
    if (selectedUnit && !(hex.unit && hex.unit.owner === viewer)) {
      showNotice(describeInvalidMove(current, selectedUnit, hex, viewer));
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
    if (hex.unit && hex.unit.owner === viewer) {
      toggleOwnUnit(current, hex.unit);
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
    commitState({ ...previous, planningTimeRemaining: stateRef.current.planningTimeRemaining }, false);
  }, [clearSelection, commitState]);

  // Handle unit selection by clicking a unit on the board. A tap on one of your own troops always
  // picks it (or puts it down again) - never sends the selected troop to its hex, even when it is
  // about to move away; other troops are handled as a tap on their hex.
  const handleUnitSelect = (unit: Unit) => {
    const current = stateRef.current;
    const unitHex = current.hexGrid.find(hex => hex.unit && hex.unit.id === unit.id);
    if (!unitHex) return;
    const live = current.players[viewer]?.units.find(other => other.id === unit.id);
    // (a troop already picked can be ordered onto a friend's hex - to work on it, or swap places:
    // that's the hex's to decide)
    const orderedOnto = !!selectedUnit && selectedUnit.id !== unit.id && validMoves.some(c => coordsEqual(c, unitHex.coordinates));
    if (live && isPlayerPlanning() && !selectedUnitTypeForPurchase && !orderedOnto) {
      setSelectedHex(unitHex);
      toggleOwnUnit(current, live);
      return;
    }
    handleHexClick(unitHex);
  };

  // Give up the battle (on your own turn): it counts as lost
  // (in a battle between more sides, only the viewer's side is out: a guest asks the host to do it)
  const handleResign = (onGuestResign?: () => void) => {
    clearSelection();
    if (linkRef.current?.role === 'guest') {
      onGuestResign?.();
      return;
    }
    commitState(resign(stateRef.current, viewer));
  };

  // (host) A side gives up (a guest who resigned or left for good)
  const resignSide = useCallback((side: PlayerType) => {
    const current = stateRef.current;
    if (current.currentPhase === 'gameOver' || current.players[side]?.eliminated) return;
    commitState(resign(current, side));
  }, [commitState]);

  return {
    // State
    gameState,
    selectedHex,
    selectedUnit,
    selectedUnitTypeForPurchase,
    validMoves,
    isAITurn,
    isRemoteTurn,
    ordersSent: !!ordersSentRef.current,
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
    handleResign,
    canUndo,
    notice,
    actionChoice,
    handleActionChoice,
    // Online battles
    applyRemoteOrders,
    receiveState,
    resignSide,
    // The frames of the battle so far (see replay/replay.ts)
    getReplayFrames: () => replayRef.current.frames,
  };
};
