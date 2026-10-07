import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Hex,
  HexCoordinates,
  Player,
  PlayerType,
  TerrainType,
  Unit,
  UnitType,
  Move,
  Purchase,
  Combat,
  GameSettings
} from '@/types/game';
import {
  getHexDistance,
  findHexByCoordinates,
  getNeighbors
} from './hexUtils';
import { createHexagonalGrid } from './mapGenerator';

// Default game settings
export const DEFAULT_SETTINGS: GameSettings = {
  gridSize: 8, // Reduced grid size (8 gives approximately a 12x12 grid)
  planningPhaseTime: 60, // 60 seconds planning phase
  aiDifficulty: 'medium',
  terrainDistribution: {
    plain: 0.45,
    mountain: 0.15,
    forest: 0.20,
    water: 0.10,
    desert: 0.10,
    resource: 0.0, // Resource hexes are placed separately
  },
  resourceHexCount: 8
};

// Unit definitions
export const UNITS: Record<UnitType, Omit<Unit, 'id' | 'owner' | 'position' | 'hasMoved' | 'isEngagedInCombat'>> = {
  infantry: {
    type: 'infantry',
    movementRange: 2,
    attackPower: 2,
    lifespan: 5,
    maxLifespan: 5,
    cost: 5,
    abilities: []
  },
  tank: {
    type: 'tank',
    movementRange: 3,
    attackPower: 4,
    lifespan: 8,
    maxLifespan: 8,
    cost: 12,
    abilities: ['terrainBonus']
  },
  artillery: {
    type: 'artillery',
    movementRange: 1,
    attackPower: 5,
    lifespan: 3,
    maxLifespan: 3,
    cost: 10,
    abilities: ['rangedAttack']
  },
  helicopter: {
    type: 'helicopter',
    movementRange: 5,
    attackPower: 3,
    lifespan: 4,
    maxLifespan: 4,
    cost: 15,
    abilities: ['rapidMovement']
  },
  medic: {
    type: 'medic',
    movementRange: 2,
    attackPower: 1,
    lifespan: 4,
    maxLifespan: 4,
    cost: 8,
    abilities: ['healing']
  }
};

// Base health and economy constants
export const BASE_MAX_HEALTH = 50;
// Gold each player receives at the end of every round
export const TURN_INCOME = 5;
// Enemy units within this many hexes of a base damage it at the end of every round
export const BASE_ATTACK_RANGE = 3;

// Display names for each unit type
export const UNIT_NAMES: Record<UnitType, string> = {
  infantry: 'Swordsmen',
  tank: 'Pikemen',
  artillery: 'Archers',
  helicopter: 'Knights',
  medic: 'Siege Engineers'
};

export interface TerrainEffect {
  name: string;
  // Movement points needed to enter the hex, or null if units can't enter it
  moveCost: number | null;
  // Multiplier applied to damage taken by a unit standing on this terrain
  damageTakenMultiplier: number;
  description: string;
}

// How each terrain type affects the units on it
export const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  plain: {
    name: 'Plains',
    moveCost: 1,
    damageTakenMultiplier: 1,
    description: 'Open ground. No bonuses or penalties.'
  },
  forest: {
    name: 'Forest',
    moveCost: 1,
    damageTakenMultiplier: 0.6,
    description: 'Cover: units here take 40% less damage. Pikemen also attack 50% harder.'
  },
  desert: {
    name: 'Desert',
    moveCost: 2,
    damageTakenMultiplier: 1,
    description: 'Deep sand: costs 2 movement to enter.'
  },
  resource: {
    name: 'Gold Mine',
    moveCost: 1,
    damageTakenMultiplier: 1,
    description: 'Hold it with a unit to earn its gold every round.'
  },
  mountain: {
    name: 'Mountains',
    moveCost: null,
    damageTakenMultiplier: 1,
    description: 'Impassable.'
  },
  water: {
    name: 'Water',
    moveCost: null,
    damageTakenMultiplier: 1,
    description: 'Impassable.'
  }
};

// Attack multiplier for units with the terrainBonus ability fighting from a forest
export const TERRAIN_BONUS_ATTACK_MULTIPLIER = 1.5;

// Initialize a new game state
export const initializeGameState = (settings: GameSettings = DEFAULT_SETTINGS): GameState => {
  // Create the hexagonal grid
  const hexGrid = createHexagonalGrid(settings);

  // Initialize players
  const players: Record<PlayerType, Player> = {
    player: {
      id: 'player-' + uuidv4(),
      type: 'player',
      points: 20, // Starting points
      units: []
    },
    ai: {
      id: 'ai-' + uuidv4(),
      type: 'ai',
      points: 20, // Starting points
      units: []
    }
  };

  return {
    hexGrid,
    players,
    currentPhase: 'setup',
    activePlayer: 'player',
    turnNumber: 0,
    planningTimeRemaining: settings.planningPhaseTime,
    pendingMoves: [],
    pendingPurchases: [],
    combats: [],
    settings
  };
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

export const coordsEqual = (a: HexCoordinates, b: HexCoordinates) => a.q === b.q && a.r === b.r;

export const getOpponent = (playerType: PlayerType): PlayerType =>
  playerType === 'player' ? 'ai' : 'player';

export const getActivePlayer = (state: GameState): PlayerType => state.activePlayer ?? 'player';

const getSettings = (state: GameState): GameSettings => state.settings ?? DEFAULT_SETTINGS;

// Water and mountains can't be entered by units
export const isImpassable = (hex: Hex) => TERRAIN_EFFECTS[hex.terrain].moveCost === null;

const findPlayerById = (state: GameState, playerId: string): Player | undefined =>
  Object.values(state.players).find(p => p.id === playerId);

export const findBaseHex = (state: GameState, playerType: PlayerType): Hex | undefined =>
  state.hexGrid.find(hex => hex.isBase && hex.owner === playerType);

const sideLabel = (side: PlayerType) => side === 'player' ? 'Your' : 'Enemy';
const unitLabel = (unit: Unit) => `${sideLabel(unit.owner)} ${UNIT_NAMES[unit.type]}`;

// Copy the parts of the state that the game logic mutates so React state is never mutated in place
const cloneState = (state: GameState): GameState => ({
  ...state,
  hexGrid: [...state.hexGrid],
  players: {
    player: { ...state.players.player, units: state.players.player.units.map(u => ({ ...u })) },
    ai: { ...state.players.ai, units: state.players.ai.units.map(u => ({ ...u })) }
  },
  pendingMoves: [...state.pendingMoves],
  pendingPurchases: [...state.pendingPurchases],
  combats: state.combats.map(c => ({ ...c }))
});

// The players' unit lists are the source of truth; hex.unit is derived from them
const syncHexUnits = (state: GameState): void => {
  const unitsByKey = new Map<string, Unit>();
  for (const unit of [...state.players.player.units, ...state.players.ai.units]) {
    unitsByKey.set(coordKey(unit.position), unit);
  }

  state.hexGrid = state.hexGrid.map(hex => {
    const unit = unitsByKey.get(coordKey(hex.coordinates));
    return hex.unit === unit ? hex : { ...hex, unit };
  });
};

const updateHex = (state: GameState, coordinates: HexCoordinates, patch: Partial<Hex>): void => {
  const index = state.hexGrid.findIndex(h => coordsEqual(h.coordinates, coordinates));
  if (index !== -1) {
    state.hexGrid[index] = { ...state.hexGrid[index], ...patch };
  }
};

const MAX_LOG_ENTRIES = 40;

// Record an event for the player to read in the battle log
const addLog = (state: GameState, side: PlayerType | 'neutral', text: string): void => {
  const log = state.log ?? [];
  const id = (log[log.length - 1]?.id ?? 0) + 1;
  state.log = [...log, { id, turn: state.turnNumber, side, text }].slice(-MAX_LOG_ENTRIES);
};

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------

export const isEdgeHex = (coordinates: HexCoordinates, gridSize: number) =>
  Math.abs(coordinates.q) === gridSize ||
  Math.abs(coordinates.r) === gridSize ||
  Math.abs(coordinates.q + coordinates.r) === gridSize;

// A base must sit on the edge of the map, on open ground, with room to deploy units next to it
export const isValidBaseLocation = (hexGrid: Hex[], hex: Hex, gridSize: number): boolean => {
  if (!isEdgeHex(hex.coordinates, gridSize)) return false;
  if (hex.isResourceHex || isImpassable(hex) || hex.isBase) return false;

  return getNeighbors(hex.coordinates).some(coord => {
    const neighbor = findHexByCoordinates(hexGrid, coord);
    return neighbor && !isImpassable(neighbor);
  });
};

export const getValidBaseLocations = (state: GameState): Hex[] => {
  const { gridSize } = getSettings(state);
  return state.hexGrid.filter(hex => isValidBaseLocation(state.hexGrid, hex, gridSize));
};

// Place the player's base and an AI base as far away as possible, then start the first turn
export const placeBases = (state: GameState, coordinates: HexCoordinates): GameState => {
  if (state.currentPhase !== 'setup') return state;

  const validLocations = getValidBaseLocations(state);
  const playerHex = validLocations.find(h => coordsEqual(h.coordinates, coordinates));
  if (!playerHex) return state;

  let aiHex: Hex | undefined;
  let maxDistance = -1;
  for (const hex of validLocations) {
    const distance = getHexDistance(hex.coordinates, coordinates);
    if (distance > maxDistance) {
      maxDistance = distance;
      aiHex = hex;
    }
  }
  if (!aiHex || maxDistance <= 0) return state;

  const newState = cloneState(state);

  for (const [hex, owner] of [[playerHex, 'player'], [aiHex, 'ai']] as const) {
    updateHex(newState, hex.coordinates, { isBase: true, owner, baseHealth: BASE_MAX_HEALTH });
    newState.players[owner] = {
      ...newState.players[owner],
      baseLocation: hex.coordinates,
      baseHealth: BASE_MAX_HEALTH,
      maxBaseHealth: BASE_MAX_HEALTH
    };
  }

  const startedState: GameState = {
    ...newState,
    currentPhase: 'planning',
    activePlayer: 'player',
    turnNumber: 1,
    planningTimeRemaining: getSettings(state).planningPhaseTime
  };
  addLog(startedState, 'neutral', 'The battle begins! Recruit troops and march on the enemy castle.');

  return startedState;
};

// Kept for backwards compatibility - places a single base
export const setBaseLocation = (
  state: GameState,
  playerType: PlayerType,
  coordinates: HexCoordinates
): GameState => {
  const newState = cloneState(state);

  if (!findHexByCoordinates(newState.hexGrid, coordinates)) {
    console.error('Invalid base coordinates');
    return state;
  }

  updateHex(newState, coordinates, { isBase: true, owner: playerType, baseHealth: BASE_MAX_HEALTH });
  newState.players[playerType] = {
    ...newState.players[playerType],
    baseLocation: coordinates,
    baseHealth: BASE_MAX_HEALTH,
    maxBaseHealth: BASE_MAX_HEALTH
  };

  if (newState.players.player.baseLocation && newState.players.ai.baseLocation) {
    newState.currentPhase = 'planning';
    newState.activePlayer = 'player';
    newState.turnNumber = 1;
    newState.planningTimeRemaining = getSettings(state).planningPhaseTime;
  }

  return newState;
};

// ---------------------------------------------------------------------------
// Planning phase - purchases
// ---------------------------------------------------------------------------

// Hexes next to a player's base where newly purchased units can be deployed this turn
export const getDeploymentHexes = (state: GameState, playerType: PlayerType): Hex[] => {
  const baseHex = findBaseHex(state, playerType);
  if (!baseHex) return [];

  const reserved = new Set([
    ...state.pendingPurchases.map(p => coordKey(p.position)),
    ...state.pendingMoves.map(m => coordKey(m.to))
  ]);

  return getNeighbors(baseHex.coordinates)
    .map(coord => findHexByCoordinates(state.hexGrid, coord))
    .filter((hex): hex is Hex =>
      !!hex &&
      !hex.unit &&
      !hex.isBase &&
      !isImpassable(hex) &&
      !reserved.has(coordKey(hex.coordinates))
    );
};

// Queue a unit purchase. Gold is deducted immediately and refunded if the purchase is cancelled.
export const addPendingPurchase = (
  state: GameState,
  playerId: string,
  unitType: UnitType,
  position: HexCoordinates
): GameState => {
  const player = findPlayerById(state, playerId);
  const unitInfo = UNITS[unitType];
  if (!player || !unitInfo || player.points < unitInfo.cost) return state;

  const isDeployable = getDeploymentHexes(state, player.type)
    .some(hex => coordsEqual(hex.coordinates, position));
  if (!isDeployable) return state;

  const purchase: Purchase = {
    playerId,
    unitType,
    position
  };

  return {
    ...state,
    pendingPurchases: [...state.pendingPurchases, purchase],
    players: {
      ...state.players,
      [player.type]: { ...player, points: player.points - unitInfo.cost }
    }
  };
};

// Cancel a queued purchase and refund its cost
export const cancelPendingPurchase = (
  state: GameState,
  playerId: string,
  position: HexCoordinates
): GameState => {
  const purchase = state.pendingPurchases.find(
    p => p.playerId === playerId && coordsEqual(p.position, position)
  );
  const player = findPlayerById(state, playerId);
  if (!purchase || !player) return state;

  return {
    ...state,
    pendingPurchases: state.pendingPurchases.filter(p => p !== purchase),
    players: {
      ...state.players,
      [player.type]: { ...player, points: player.points + UNITS[purchase.unitType].cost }
    }
  };
};

// ---------------------------------------------------------------------------
// Planning phase - movement
// ---------------------------------------------------------------------------

interface ReachableHex {
  coordinates: HexCoordinates;
  // Movement points spent to get here
  cost: number;
  previous: string | null;
}

// Cheapest-path search over the board. Entering a hex costs its terrain's movement cost.
// `canEnter` decides which hexes may be walked through at all.
const searchPaths = (
  hexGrid: Hex[],
  start: HexCoordinates,
  maxCost: number,
  canEnter: (hex: Hex) => boolean
): Map<string, ReachableHex> => {
  const hexByKey = new Map(hexGrid.map(hex => [coordKey(hex.coordinates), hex]));
  const reached = new Map<string, ReachableHex>([
    [coordKey(start), { coordinates: start, cost: 0, previous: null }]
  ]);
  const queue: ReachableHex[] = [reached.get(coordKey(start))!];

  while (queue.length > 0) {
    // The board is small, so a simple "pick the cheapest" queue is fast enough
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentKey = coordKey(current.coordinates);
    if (current.cost > (reached.get(currentKey)?.cost ?? Infinity)) continue;

    for (const neighbor of getNeighbors(current.coordinates)) {
      const key = coordKey(neighbor);
      const hex = hexByKey.get(key);
      if (!hex || !canEnter(hex)) continue;

      const cost = current.cost + (TERRAIN_EFFECTS[hex.terrain].moveCost ?? Infinity);
      if (cost > maxCost || cost >= (reached.get(key)?.cost ?? Infinity)) continue;

      const entry = { coordinates: hex.coordinates, cost, previous: currentKey };
      reached.set(key, entry);
      queue.push(entry);
    }
  }

  return reached;
};

const buildPath = (reached: Map<string, ReachableHex>, to: HexCoordinates): HexCoordinates[] | null => {
  let entry = reached.get(coordKey(to));
  if (!entry) return null;

  const path: HexCoordinates[] = [];
  while (entry) {
    path.unshift(entry.coordinates);
    entry = entry.previous ? reached.get(entry.previous) : undefined;
  }
  return path;
};

// Where a unit can walk this turn: it can't cross water or mountains, can pass through
// friendly units but not enemy units, and desert costs extra movement.
const getReachableHexes = (state: GameState, unit: Unit) =>
  searchPaths(state.hexGrid, unit.position, unit.movementRange, hex =>
    !isImpassable(hex) && !(hex.unit && hex.unit.owner !== unit.owner)
  );

// All hexes a unit can legally be ordered to move to this turn.
// Units can't end on an occupied hex, their own base, or a hex another order already reserved.
export const getValidMoveTargets = (state: GameState, unit: Unit): HexCoordinates[] => {
  if (unit.hasMoved) return [];

  const reserved = new Set([
    ...state.pendingPurchases.map(p => coordKey(p.position)),
    ...state.pendingMoves.filter(m => m.unitId !== unit.id).map(m => coordKey(m.to))
  ]);
  const hexByKey = new Map(state.hexGrid.map(hex => [coordKey(hex.coordinates), hex]));

  const targets: HexCoordinates[] = [];
  for (const [key, entry] of getReachableHexes(state, unit)) {
    const hex = hexByKey.get(key);
    if (!hex || entry.cost === 0) continue;

    const isOwnBase = hex.isBase && hex.owner === unit.owner;
    if (!hex.unit && !isOwnBase && !reserved.has(key)) {
      targets.push(hex.coordinates);
    }
  }

  return targets;
};

// The route a unit would walk to reach a hex this turn (including its start), or null
export const getMovePath = (state: GameState, unit: Unit, to: HexCoordinates): HexCoordinates[] | null =>
  buildPath(getReachableHexes(state, unit), to);

// Route across passable terrain between two hexes, ignoring units (used to animate movement)
export const findTerrainPath = (hexGrid: Hex[], from: HexCoordinates, to: HexCoordinates): HexCoordinates[] => {
  const reached = searchPaths(hexGrid, from, Infinity, hex => !isImpassable(hex));
  return buildPath(reached, to) ?? [from, to];
};

// Walking cost from every hex to a goal across passable terrain, ignoring units.
// Used to steer around lakes and mountain ranges rather than into them.
export const getTerrainDistanceMap = (hexGrid: Hex[], goal: HexCoordinates): Map<string, number> => {
  const reached = searchPaths(hexGrid, goal, Infinity, hex => !isImpassable(hex));
  return new Map([...reached].map(([key, entry]) => [key, entry.cost]));
};

// Queue a move for a unit, replacing any move it already had queued.
// Moving a unit back to where it currently stands just cancels its move.
export const addPendingMove = (
  state: GameState,
  unitId: string,
  playerId: string,
  to: HexCoordinates
): GameState => {
  const player = findPlayerById(state, playerId);
  if (!player) return state;

  const unit = player.units.find(u => u.id === unitId);
  if (!unit) return state;

  const withoutMove: GameState = {
    ...state,
    pendingMoves: state.pendingMoves.filter(m => m.unitId !== unitId)
  };

  if (coordsEqual(unit.position, to)) return withoutMove;

  const isValid = getValidMoveTargets(withoutMove, unit).some(c => coordsEqual(c, to));
  if (!isValid) return state;

  const move: Move = {
    unitId,
    playerId,
    from: unit.position,
    to
  };

  return {
    ...withoutMove,
    pendingMoves: [...withoutMove.pendingMoves, move]
  };
};

export const cancelPendingMove = (state: GameState, unitId: string): GameState => ({
  ...state,
  pendingMoves: state.pendingMoves.filter(m => m.unitId !== unitId)
});

// ---------------------------------------------------------------------------
// Execution phase
// ---------------------------------------------------------------------------

// Execute all pending purchases and moves, then either start combat or end the turn
export const executeMoves = (state: GameState): GameState => {
  if (state.currentPhase !== 'planning') return state;

  const newState = cloneState(state);
  const activePlayer = getActivePlayer(newState);
  const occupied = new Set(
    [...newState.players.player.units, ...newState.players.ai.units].map(u => coordKey(u.position))
  );
  const recruited: Unit[] = [];

  // Spawn purchased units first
  for (const purchase of state.pendingPurchases) {
    const player = findPlayerById(newState, purchase.playerId);
    if (!player) continue;

    const unitInfo = UNITS[purchase.unitType];
    const hex = findHexByCoordinates(newState.hexGrid, purchase.position);
    const baseHex = findBaseHex(newState, player.type);

    const isValidPlacement =
      hex &&
      baseHex &&
      !hex.isBase &&
      !isImpassable(hex) &&
      !occupied.has(coordKey(purchase.position)) &&
      getHexDistance(hex.coordinates, baseHex.coordinates) === 1;

    if (!isValidPlacement) {
      // Refund purchases that can no longer be placed (gold was deducted when queued)
      newState.players[player.type].points += unitInfo.cost;
      continue;
    }

    const newUnit: Unit = {
      id: `unit-${uuidv4()}`,
      type: purchase.unitType,
      owner: player.type,
      position: purchase.position,
      movementRange: unitInfo.movementRange,
      attackPower: unitInfo.attackPower,
      lifespan: unitInfo.lifespan,
      maxLifespan: unitInfo.maxLifespan,
      cost: unitInfo.cost,
      abilities: [...unitInfo.abilities],
      // Freshly deployed units can't move until their next turn
      hasMoved: true,
      isEngagedInCombat: false
    };

    newState.players[player.type].units.push(newUnit);
    occupied.add(coordKey(newUnit.position));
    recruited.push(newUnit);
  }

  // Then execute all moves
  let movedCount = 0;
  for (const move of state.pendingMoves) {
    const player = findPlayerById(newState, move.playerId);
    if (!player) continue;

    const unit = newState.players[player.type].units.find(u => u.id === move.unitId);
    if (!unit || unit.hasMoved) continue;

    const toHex = findHexByCoordinates(newState.hexGrid, move.to);
    if (!toHex || isImpassable(toHex) || occupied.has(coordKey(move.to))) continue;

    occupied.delete(coordKey(unit.position));
    occupied.add(coordKey(move.to));
    unit.position = move.to;
    unit.hasMoved = true;
    movedCount++;
  }

  newState.pendingMoves = [];
  newState.pendingPurchases = [];
  syncHexUnits(newState);

  if (recruited.length > 0) {
    const names = recruited.map(u => UNIT_NAMES[u.type]).join(', ');
    addLog(newState, activePlayer, `${activePlayer === 'player' ? 'You' : 'The enemy'} recruited ${names}.`);
  }
  if (movedCount > 0) {
    addLog(
      newState,
      activePlayer,
      `${activePlayer === 'player' ? 'You' : 'The enemy'} moved ${movedCount} ${movedCount === 1 ? 'unit' : 'units'}.`
    );
  }

  // A unit standing on the enemy base captures it
  const winner = checkBaseCapture(newState);
  if (winner) {
    addLog(newState, winner, winner === 'player' ? 'You stormed the enemy castle!' : 'The enemy stormed your castle!');
    return { ...newState, winner, currentPhase: 'gameOver' };
  }

  // The side that just moved attacks every enemy unit it is adjacent to
  const combats = detectCombat(newState, activePlayer);
  if (combats.length > 0) {
    addLog(
      newState,
      activePlayer,
      `${combats.length} ${combats.length === 1 ? 'battle breaks' : 'battles break'} out!`
    );
    return { ...newState, combats, currentPhase: 'combat' };
  }

  return finishTurn(newState);
};

// Create one combat per defending unit that has attackers adjacent to it
const detectCombat = (state: GameState, attackerSide: PlayerType): Combat[] => {
  const defenderSide = getOpponent(attackerSide);
  const hexByKey = new Map(state.hexGrid.map(hex => [coordKey(hex.coordinates), hex]));
  const combats: Combat[] = [];
  const engaged = new Set<string>();

  for (const defender of state.players[defenderSide].units) {
    const attackers = getNeighbors(defender.position)
      .map(coord => hexByKey.get(coordKey(coord))?.unit)
      .filter((unit): unit is Unit => !!unit && unit.owner === attackerSide);

    if (attackers.length === 0) continue;

    combats.push({
      hexCoordinates: defender.position,
      attackers,
      defenders: [defender],
      resolved: false
    });

    engaged.add(defender.id);
    attackers.forEach(a => engaged.add(a.id));
  }

  if (engaged.size > 0) {
    for (const side of ['player', 'ai'] as const) {
      for (const unit of state.players[side].units) {
        if (engaged.has(unit.id)) unit.isEngagedInCombat = true;
      }
    }
    syncHexUnits(state);
  }

  return combats;
};

// A unit standing on the enemy base wins the game
const checkBaseCapture = (state: GameState): PlayerType | undefined => {
  const playerBaseHex = findBaseHex(state, 'player');
  const aiBaseHex = findBaseHex(state, 'ai');

  if (aiBaseHex?.unit?.owner === 'player') return 'player';
  if (playerBaseHex?.unit?.owner === 'ai') return 'ai';

  return undefined;
};

// A base reduced to zero health loses the game
const checkBaseDestroyed = (state: GameState): PlayerType | undefined => {
  const playerDestroyed = (state.players.player.baseHealth ?? BASE_MAX_HEALTH) <= 0;
  const aiDestroyed = (state.players.ai.baseHealth ?? BASE_MAX_HEALTH) <= 0;

  // If both bases fall in the same round the player wins the tie
  if (aiDestroyed) return 'player';
  if (playerDestroyed) return 'ai';

  return undefined;
};

// Wrap up the active side's turn and hand control to the other side.
// After the AI's turn the round ends: bases take siege damage, resources and income are paid out.
const finishTurn = (state: GameState): GameState => {
  const activePlayer = getActivePlayer(state);
  let newState: GameState = {
    ...state,
    combats: [],
    pendingMoves: [],
    pendingPurchases: []
  };

  for (const side of ['player', 'ai'] as const) {
    newState.players[side].units = newState.players[side].units.map(unit => ({
      ...unit,
      hasMoved: false,
      isEngagedInCombat: false
    }));
  }
  syncHexUnits(newState);

  let turnNumber = newState.turnNumber;

  if (activePlayer === 'ai') {
    newState = processDamageToBase(newState);
    const mineIncome = collectResources(newState);
    for (const side of ['player', 'ai'] as const) {
      newState.players[side].points += TURN_INCOME;
    }
    addLog(
      newState,
      'player',
      `Round ${turnNumber} ends: you earn ${TURN_INCOME + mineIncome.player} gold` +
        (mineIncome.player > 0 ? ` (${mineIncome.player} from gold mines).` : '.')
    );
    turnNumber += 1;
  }

  const winner = checkBaseDestroyed(newState);
  if (winner) {
    addLog(newState, winner, winner === 'player' ? 'The enemy castle has fallen!' : 'Your castle has fallen!');
    return { ...newState, winner, currentPhase: 'gameOver' };
  }

  return {
    ...newState,
    activePlayer: getOpponent(activePlayer),
    currentPhase: 'planning',
    turnNumber,
    planningTimeRemaining: getSettings(state).planningPhaseTime
  };
};

// Process damage to bases from nearby enemy units
const processDamageToBase = (state: GameState): GameState => {
  for (const side of ['player', 'ai'] as const) {
    const baseHex = findBaseHex(state, side);
    if (!baseHex) continue;

    const enemyUnits = state.players[getOpponent(side)].units.filter(unit =>
      getHexDistance(unit.position, baseHex.coordinates) <= BASE_ATTACK_RANGE
    );

    // Each unit in range deals damage equal to its attack power
    const totalDamage = enemyUnits.reduce((sum, unit) => sum + unit.attackPower, 0);
    if (totalDamage === 0) continue;

    const currentHealth = state.players[side].baseHealth ?? BASE_MAX_HEALTH;
    const newHealth = Math.max(0, currentHealth - totalDamage);

    state.players[side].baseHealth = newHealth;
    updateHex(state, baseHex.coordinates, { baseHealth: newHealth });
    addLog(
      state,
      getOpponent(side),
      `${side === 'player' ? 'Your' : 'The enemy'} castle takes ${totalDamage} siege damage (${newHealth}/${BASE_MAX_HEALTH}).`
    );
  }

  return state;
};

// Pay out gold from resource hexes held by units. Returns the amount each side earned.
const collectResources = (state: GameState): Record<PlayerType, number> => {
  const earned: Record<PlayerType, number> = { player: 0, ai: 0 };

  for (const hex of state.hexGrid) {
    if (hex.isResourceHex && hex.unit) {
      const value = hex.resourceValue || 0;
      state.players[hex.unit.owner].points += value;
      earned[hex.unit.owner] += value;
    }
  }

  return earned;
};

// ---------------------------------------------------------------------------
// Combat phase
// ---------------------------------------------------------------------------

export interface CombatantPreview {
  unit: Unit;
  terrain: TerrainType;
  // Attack power after terrain bonuses
  power: number;
  // Damage this unit takes if both sides fight
  damageTaken: number;
  destroyed: boolean;
  // Human readable terrain modifiers that apply to this unit
  modifiers: string[];
}

export interface CombatPreview {
  attackers: CombatantPreview[];
  defenders: CombatantPreview[];
  attackerPower: number;
  defenderPower: number;
}

// Work out what will happen if a combat is fought, using the units' current stats and terrain
export const getCombatPreview = (state: GameState, combat: Combat): CombatPreview => {
  const getLiveUnit = (unit: Unit) =>
    state.players[unit.owner].units.find(u => u.id === unit.id);
  const terrainOf = (unit: Unit): TerrainType =>
    findHexByCoordinates(state.hexGrid, unit.position)?.terrain ?? 'plain';

  const describe = (units: Unit[]) => units.map(unit => {
    const terrain = terrainOf(unit);
    const modifiers: string[] = [];
    let power = unit.attackPower;

    if (unit.abilities.includes('terrainBonus') && terrain === 'forest') {
      power *= TERRAIN_BONUS_ATTACK_MULTIPLIER;
      modifiers.push(`+${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% attack (fighting from forest)`);
    }

    const damageMultiplier = TERRAIN_EFFECTS[terrain].damageTakenMultiplier;
    if (damageMultiplier < 1) {
      modifiers.push(`${Math.round((1 - damageMultiplier) * 100)}% less damage (${TERRAIN_EFFECTS[terrain].name.toLowerCase()} cover)`);
    }

    return { unit, terrain, power, damageMultiplier, modifiers };
  });

  const attackers = describe(combat.attackers.map(getLiveUnit).filter((u): u is Unit => !!u));
  const defenders = describe(combat.defenders.map(getLiveUnit).filter((u): u is Unit => !!u));
  const attackerPower = attackers.reduce((sum, a) => sum + a.power, 0);
  const defenderPower = defenders.reduce((sum, d) => sum + d.power, 0);

  // Each side's damage is split evenly between the enemy units, then reduced by their cover
  const withDamage = (side: typeof attackers, enemyPower: number): CombatantPreview[] =>
    side.map(({ damageMultiplier, ...entry }) => {
      const damageTaken = enemyPower > 0
        ? Math.max(1, Math.round(enemyPower / side.length * damageMultiplier))
        : 0;
      return { ...entry, damageTaken, destroyed: damageTaken >= entry.unit.lifespan };
    });

  return {
    attackers: withDamage(attackers, defenderPower),
    defenders: withDamage(defenders, attackerPower),
    attackerPower,
    defenderPower
  };
};

// Resolve a combat - the defenders either stand and fight or retreat
export const resolveCombat = (
  state: GameState,
  combatIndex: number,
  retreat: boolean
): GameState => {
  const combat = state.combats[combatIndex];
  if (state.currentPhase !== 'combat' || !combat || combat.resolved) return state;

  const newState = cloneState(state);
  const retreatingUnits: Unit[] = [];
  const preview = getCombatPreview(newState, combat);
  const getLiveUnit = (unit: Unit) =>
    newState.players[unit.owner].units.find(u => u.id === unit.id);

  if (retreat) {
    for (const { unit } of preview.defenders) {
      const defender = getLiveUnit(unit);
      if (!defender) continue;

      const retreatTo = chooseRetreatPosition(newState, defender);

      if (retreatTo) {
        defender.position = retreatTo;
        defender.isEngagedInCombat = false;
        retreatingUnits.push({ ...defender });
        syncHexUnits(newState);
        addLog(newState, defender.owner, `${unitLabel(defender)} retreated.`);
      } else {
        // Nowhere to run - the unit is destroyed
        removeUnit(newState, defender);
        addLog(newState, defender.owner, `${unitLabel(defender)} was cut off and destroyed!`);
      }
    }
  } else if (preview.attackers.length > 0 && preview.defenders.length > 0) {
    // Damage is dealt simultaneously
    for (const entry of [...preview.attackers, ...preview.defenders]) {
      const unit = getLiveUnit(entry.unit);
      if (!unit) continue;

      unit.lifespan = Math.max(0, unit.lifespan - entry.damageTaken);
      if (unit.lifespan <= 0) {
        removeUnit(newState, unit);
      }
    }
    syncHexUnits(newState);

    const defender = preview.defenders[0];
    const outcome = (entry: CombatantPreview) => entry.destroyed ? 'destroyed' : `-${entry.damageTaken} HP`;
    addLog(
      newState,
      getActivePlayer(newState),
      `${preview.attackers.map(a => unitLabel(a.unit)).join(' & ')} attacked ${unitLabel(defender.unit)}: ` +
        `defender ${outcome(defender)}, attackers ${preview.attackers.map(outcome).join(', ')}.`
    );
  }

  newState.combats[combatIndex] = {
    ...combat,
    resolved: true,
    retreating: retreatingUnits
  };

  if (newState.combats.every(c => c.resolved)) {
    return finishTurn(newState);
  }

  return newState;
};

// Pick the free neighbouring hex that gets a retreating unit furthest from enemy units
const chooseRetreatPosition = (state: GameState, unit: Unit): HexCoordinates | null => {
  const enemies = state.players[getOpponent(unit.owner)].units;

  const candidates = getNeighbors(unit.position).filter(coord => {
    const hex = findHexByCoordinates(state.hexGrid, coord);
    return hex && !hex.unit && !hex.isBase && !isImpassable(hex);
  });

  let best: HexCoordinates | null = null;
  let bestScore = -Infinity;

  for (const coord of candidates) {
    const nearestEnemy = enemies.reduce(
      (min, enemy) => Math.min(min, getHexDistance(coord, enemy.position)),
      Infinity
    );
    if (nearestEnemy > bestScore) {
      bestScore = nearestEnemy;
      best = coord;
    }
  }

  return best;
};

// Remove a unit from the game
const removeUnit = (state: GameState, unit: Unit): void => {
  state.players[unit.owner].units = state.players[unit.owner].units.filter(u => u.id !== unit.id);
  syncHexUnits(state);
};
