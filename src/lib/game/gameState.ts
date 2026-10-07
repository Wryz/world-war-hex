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
  gridSize: 6, // Hexes from the centre to the edge: 13 hexes across, 127 in total
  planningPhaseTime: 60, // 60 seconds planning phase
  aiDifficulty: 'medium',
  resourceHexCount: 5
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
// Gold each side receives at the end of each of its turns (once per round)
export const TURN_INCOME = 5;
// Units within this many hexes of the enemy base damage it at the end of their side's turn
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
  // Multiplier applied to damage dealt by a unit standing on this terrain
  damageDealtMultiplier?: number;
  // Extra reach for ranged units standing on this terrain
  rangedRangeBonus?: number;
  // Health restored to a unit standing here at the end of its side's turn
  healPerTurn?: number;
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
    description: 'Hold it with a unit to earn its gold at the end of each of your turns.'
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
  },
  hills: {
    name: 'Hills',
    moveCost: 2,
    damageTakenMultiplier: 1,
    damageDealtMultiplier: 1.25,
    rangedRangeBonus: 1,
    description: 'High ground: units here deal 25% more damage and Archers reach 3 hexes. Costs 2 movement to enter.'
  },
  swamp: {
    name: 'Swamp',
    moveCost: 2,
    damageTakenMultiplier: 1.25,
    description: 'Bogged down: units here take 25% more damage. Costs 2 movement to enter.'
  },
  snow: {
    name: 'Snow',
    moveCost: 3,
    damageTakenMultiplier: 1,
    description: 'Deep snow: costs 3 movement to enter.'
  },
  spring: {
    name: 'Spring',
    moveCost: 1,
    damageTakenMultiplier: 1,
    healPerTurn: 2,
    description: 'Healing waters: a unit here recovers 2 health at the end of each of its turns.'
  }
};

// Attack multiplier for units with the terrainBonus ability fighting from a forest
export const TERRAIN_BONUS_ATTACK_MULTIPLIER = 1.5;

// How many hexes away archers (rangedAttack) can strike from
export const RANGED_ATTACK_RANGE = 2;
// Fraction of a destroyed unit's cost paid to the side that destroyed it
export const KILL_BOUNTY_FRACTION = 0.5;
// Gold plundered per point of siege damage dealt to an enemy castle
export const SIEGE_PLUNDER_PER_DAMAGE = 0.5;

// Initialize a new game state
export const initializeGameState = (settings: GameSettings = DEFAULT_SETTINGS): GameState => {
  // Create the hexagonal grid with a randomly themed terrain mix
  const { hexGrid, theme } = createHexagonalGrid(settings);

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
    settings,
    mapName: theme.name
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

// A base needs at least this many open neighbours so it always has room to deploy recruits
const MIN_OPEN_BASE_NEIGHBORS = 2;

// Neighbours of a hex where recruits could be deployed: walkable, not a gold mine and not a castle
const countOpenNeighbors = (hexGrid: Hex[], coordinates: HexCoordinates): number =>
  getNeighbors(coordinates).filter(coord => {
    const neighbor = findHexByCoordinates(hexGrid, coord);
    return neighbor && !isImpassable(neighbor) && !neighbor.isResourceHex && !neighbor.isBase;
  }).length;

// A base must sit on the edge of the map, on open ground, with room to deploy units next to it
export const isValidBaseLocation = (hexGrid: Hex[], hex: Hex, gridSize: number): boolean => {
  if (!isEdgeHex(hex.coordinates, gridSize)) return false;
  if (hex.isResourceHex || isImpassable(hex) || hex.isBase) return false;

  return countOpenNeighbors(hexGrid, hex.coordinates) >= MIN_OPEN_BASE_NEIGHBORS;
};

export const getValidBaseLocations = (state: GameState): Hex[] => {
  const { gridSize } = getSettings(state);
  return state.hexGrid.filter(hex => isValidBaseLocation(state.hexGrid, hex, gridSize));
};

// Place the player's base and an AI base as far away as possible, then start the first turn
// Neutral camps placed between the castles, and how close to a castle they may be
const CAMP_COUNT = 2;
const MIN_CAMP_CASTLE_DISTANCE = 3;

// Put the neutral camps where both sides have an equally long march to them, one on each flank:
// hexes the same distance from both castles, as far apart from each other as possible.
// The camp hex becomes open ground with room around it to deploy recruits.
const placeCamps = (state: GameState, playerBase: HexCoordinates, aiBase: HexCoordinates): void => {
  const gridSize = getSettings(state).gridSize;
  const center = { q: 0, r: 0 };

  const candidatesWithin = (tolerance: number) => state.hexGrid.filter(hex => {
    if (hex.isBase || hex.isResourceHex || isImpassable(hex)) return false;
    const toPlayer = getHexDistance(hex.coordinates, playerBase);
    const toAi = getHexDistance(hex.coordinates, aiBase);
    return Math.abs(toPlayer - toAi) <= tolerance &&
      Math.min(toPlayer, toAi) >= MIN_CAMP_CASTLE_DISTANCE &&
      // Off the outer ring so camps can be approached from every side
      getHexDistance(hex.coordinates, center) < gridSize;
  });

  let candidates = candidatesWithin(0);
  if (candidates.length < CAMP_COUNT) candidates = candidatesWithin(1);
  if (candidates.length < CAMP_COUNT) return;

  // The pair furthest apart (one per flank); more open ground breaks ties
  let best: [Hex, Hex] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const score = getHexDistance(a.coordinates, b.coordinates) * 10 +
        countOpenNeighbors(state.hexGrid, a.coordinates) + countOpenNeighbors(state.hexGrid, b.coordinates);
      if (score > bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
  }
  if (!best) return;

  for (const camp of best) {
    updateHex(state, camp.coordinates, { isCamp: true, terrain: 'plain', owner: undefined });
    // Clear blocked neighbours until there is room to deploy around the camp
    for (const neighbor of getNeighbors(camp.coordinates)) {
      if (countOpenNeighbors(state.hexGrid, camp.coordinates) >= MIN_OPEN_BASE_NEIGHBORS) break;
      const hex = findHexByCoordinates(state.hexGrid, neighbor);
      if (hex && isImpassable(hex)) updateHex(state, neighbor, { terrain: 'plain' });
    }
  }
};

export const placeBases = (state: GameState, coordinates: HexCoordinates): GameState => {
  if (state.currentPhase !== 'setup') return state;

  const validLocations = getValidBaseLocations(state);
  const playerHex = validLocations.find(h => coordsEqual(h.coordinates, coordinates));
  if (!playerHex) return state;

  // The AI castle goes (nearly) as far away as possible; among the farthest spots it takes the one
  // with the most room around it so it can deploy recruits freely
  const maxDistance = Math.max(-1, ...validLocations.map(hex => getHexDistance(hex.coordinates, coordinates)));
  if (maxDistance <= 0) return state;

  let aiHex: Hex | undefined;
  let bestScore = -Infinity;
  for (const hex of validLocations) {
    const distance = getHexDistance(hex.coordinates, coordinates);
    if (distance < maxDistance - 1) continue;
    // Openness decides between near-equal distances; distance breaks ties in openness
    const score = countOpenNeighbors(state.hexGrid, hex.coordinates) * 10 + distance;
    if (score > bestScore) {
      bestScore = score;
      aiHex = hex;
    }
  }
  if (!aiHex) return state;

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
  placeCamps(newState, playerHex.coordinates, aiHex.coordinates);

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

// ---------------------------------------------------------------------------
// Planning phase - purchases
// ---------------------------------------------------------------------------

// Only the side whose turn it is may queue orders, and only while planning
const canGiveOrders = (state: GameState, player: Player) =>
  state.currentPhase === 'planning' && player.type === getActivePlayer(state);

// Camps currently held by a side
export const getOwnedCamps = (state: GameState, playerType: PlayerType): Hex[] =>
  state.hexGrid.filter(hex => hex.isCamp && hex.owner === playerType);

// Where a side's recruits may appear: next to its castle, and on or next to any camp it holds
const getDeploymentSpots = (state: GameState, playerType: PlayerType): HexCoordinates[] => {
  const baseHex = findBaseHex(state, playerType);
  const spots = baseHex ? getNeighbors(baseHex.coordinates) : [];
  for (const camp of getOwnedCamps(state, playerType)) {
    spots.push(camp.coordinates, ...getNeighbors(camp.coordinates));
  }
  return [...new Map(spots.map(c => [coordKey(c), c])).values()];
};

const isDeploymentSpot = (state: GameState, playerType: PlayerType, coordinates: HexCoordinates) =>
  getDeploymentSpots(state, playerType).some(c => coordsEqual(c, coordinates));

// Hexes where a side's newly purchased units can be deployed this turn.
// A hex whose unit has a queued move away counts as free: moves are carried out before recruits arrive.
export const getDeploymentHexes = (state: GameState, playerType: PlayerType): Hex[] => {
  const reserved = new Set([
    ...state.pendingPurchases.map(p => coordKey(p.position)),
    ...state.pendingMoves.map(m => coordKey(m.to))
  ]);
  const leaving = new Set(state.pendingMoves.map(m => m.unitId));

  return getDeploymentSpots(state, playerType)
    .map(coord => findHexByCoordinates(state.hexGrid, coord))
    .filter((hex): hex is Hex =>
      !!hex &&
      (!hex.unit || leaving.has(hex.unit.id)) &&
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
  if (!player || !canGiveOrders(state, player) || !unitInfo || player.points < unitInfo.cost) return state;

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

// Movement points needed to step from one hex into a neighbouring one
type StepCost = (from: Hex, to: Hex) => number;
const enterCost: StepCost = (_from, to) => TERRAIN_EFFECTS[to.terrain].moveCost ?? Infinity;

// Cheapest-path search over the board. By default entering a hex costs its terrain's movement cost.
// `canEnter` decides which hexes may be walked through at all.
const searchPaths = (
  hexGrid: Hex[],
  start: HexCoordinates,
  maxCost: number,
  canEnter: (hex: Hex) => boolean,
  stepCost: StepCost = enterCost
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
    const currentHex = hexByKey.get(currentKey);

    for (const neighbor of getNeighbors(current.coordinates)) {
      const key = coordKey(neighbor);
      const hex = hexByKey.get(key);
      if (!hex || !currentHex || !canEnter(hex)) continue;

      const cost = current.cost + stepCost(currentHex, hex);
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
// friendly units but not enemy units, and rough terrain costs extra movement.
// A unit can always take a single step onto a neighbouring hex, however rough, using all its movement.
const getReachableHexes = (state: GameState, unit: Unit) =>
  searchPaths(
    state.hexGrid,
    unit.position,
    unit.movementRange,
    hex => !isImpassable(hex) && !(hex.unit && hex.unit.owner !== unit.owner),
    (from, to) => {
      const cost = enterCost(from, to);
      return coordsEqual(from.coordinates, unit.position) ? Math.min(cost, unit.movementRange) : cost;
    }
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

// Walking cost from every hex to a goal across passable terrain, ignoring units: the cost of
// every hex entered on the way, including the goal itself. Used to steer around lakes and
// mountain ranges rather than into them.
export const getTerrainDistanceMap = (hexGrid: Hex[], goal: HexCoordinates): Map<string, number> => {
  // Searching outwards from the goal, a step from `from` to `to` stands for walking from `to`
  // into `from`, so it costs `from`'s terrain
  const reached = searchPaths(
    hexGrid,
    goal,
    Infinity,
    hex => !isImpassable(hex),
    from => TERRAIN_EFFECTS[from.terrain].moveCost ?? Infinity
  );
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
  if (!player || !canGiveOrders(state, player)) return state;

  const unit = player.units.find(u => u.id === unitId);
  if (!unit) return state;

  // Ordering a unit back onto its own hex just cancels its move
  if (coordsEqual(unit.position, to)) return cancelPendingMove(state, unitId);

  const withoutMove: GameState = {
    ...state,
    pendingMoves: state.pendingMoves.filter(m => m.unitId !== unitId)
  };

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

// Cancel a unit's queued move. The unit now stays put, so a recruit queued on its hex
// (allowed because the unit was leaving) is cancelled and refunded as well.
export const cancelPendingMove = (state: GameState, unitId: string): GameState => {
  const move = state.pendingMoves.find(m => m.unitId === unitId);
  if (!move) return state;

  const withoutMove: GameState = {
    ...state,
    pendingMoves: state.pendingMoves.filter(m => m !== move)
  };
  return cancelPendingPurchase(withoutMove, move.playerId, move.from);
};

// ---------------------------------------------------------------------------
// Execution phase
// ---------------------------------------------------------------------------

// Execute all pending moves and then purchases, then either start combat or end the turn
export const executeMoves = (state: GameState): GameState => {
  if (state.currentPhase !== 'planning') return state;

  const newState = cloneState(state);
  const activePlayer = getActivePlayer(newState);
  const occupied = new Set(
    [...newState.players.player.units, ...newState.players.ai.units].map(u => coordKey(u.position))
  );
  const recruited: Unit[] = [];

  // Move units first, so recruits can be deployed on the hexes they leave
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

  // Units ending their move on a camp claim it
  for (const side of ['player', 'ai'] as const) {
    for (const unit of newState.players[side].units) {
      const hex = findHexByCoordinates(newState.hexGrid, unit.position);
      if (!hex?.isCamp || hex.owner === side) continue;
      addLog(newState, side, hex.owner
        ? `${unitLabel(unit)} seized ${side === 'player' ? 'an enemy camp' : 'your camp'}!`
        : `${unitLabel(unit)} captured a camp. Recruits can now deploy there.`);
      updateHex(newState, unit.position, { owner: side });
    }
  }

  // Then spawn purchased units
  for (const purchase of state.pendingPurchases) {
    const player = findPlayerById(newState, purchase.playerId);
    if (!player) continue;

    const unitInfo = UNITS[purchase.unitType];
    const hex = findHexByCoordinates(newState.hexGrid, purchase.position);

    const isValidPlacement =
      hex &&
      !hex.isBase &&
      !isImpassable(hex) &&
      !occupied.has(coordKey(purchase.position)) &&
      isDeploymentSpot(newState, player.type, hex.coordinates);

    if (!isValidPlacement) {
      // Refund purchases that can no longer be placed, e.g. the hex is still occupied
      // (gold was deducted when queued)
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

  // Every unit of the side that just moved attacks one enemy unit within its reach
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

// How far a unit can strike from the terrain it stands on: archers (ranged attack) reach 2 hexes,
// or 3 from high ground; everyone else 1
export const getAttackRange = (unit: Unit, terrain: TerrainType = 'plain'): number =>
  unit.abilities.includes('rangedAttack')
    ? RANGED_ATTACK_RANGE + (TERRAIN_EFFECTS[terrain].rangedRangeBonus ?? 0)
    : 1;

const terrainUnder = (state: GameState, unit: Unit): TerrainType =>
  findHexByCoordinates(state.hexGrid, unit.position)?.terrain ?? 'plain';

// A unit's reach where it stands right now
export const getUnitAttackRange = (state: GameState, unit: Unit): number =>
  getAttackRange(unit, terrainUnder(state, unit));

const isInAttackRange = (state: GameState, attacker: Unit, target: Unit) =>
  getHexDistance(attacker.position, target.position) <= getUnitAttackRange(state, attacker);

// Attack power after terrain bonuses: pikemen (terrainBonus) strike harder from a forest,
// and everyone hits harder from high ground
const getEffectivePower = (unit: Unit, terrain: TerrainType): number => {
  const forestBonus = unit.abilities.includes('terrainBonus') && terrain === 'forest' ? TERRAIN_BONUS_ATTACK_MULTIPLIER : 1;
  return unit.attackPower * forestBonus * (TERRAIN_EFFECTS[terrain].damageDealtMultiplier ?? 1);
};

// Damage that `power` worth of attacks deals to one unit standing on `terrain`.
// Cover reduces it, but an attack that connects always deals at least 1.
const getStrikeDamage = (power: number, terrain: TerrainType): number =>
  power > 0 ? Math.max(1, Math.round(power * TERRAIN_EFFECTS[terrain].damageTakenMultiplier)) : 0;

// Split one side's attack power evenly between the enemy units it can reach, reduce each share
// by that unit's cover, then round the total and hand it out so the shares add up to it
// (leftover points go to the largest fractions, earliest unit first). Units out of reach take 0.
const distributeDamage = (power: number, targets: { multiplier: number; reachable: boolean }[]): number[] => {
  const reachable = targets.map((target, index) => target.reachable ? index : -1).filter(index => index !== -1);
  if (power <= 0 || reachable.length === 0) return targets.map(() => 0);

  const shares = targets.map(target => target.reachable ? power / reachable.length * target.multiplier : 0);
  const total = Math.max(1, Math.round(shares.reduce((sum, share) => sum + share, 0)));
  const damage = shares.map(share => Math.floor(share));

  const order = [...reachable].sort((a, b) => (shares[b] - damage[b]) - (shares[a] - damage[a]) || a - b);
  let remainder = total - damage.reduce((sum, d) => sum + d, 0);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    damage[order[k]]++;
  }
  return damage;
};

const compareIds = (a: Unit, b: Unit) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Every unit of the attacking side strikes exactly one enemy within its reach: one it can finish off
// (together with the attackers that already picked it) if there is one, otherwise the weakest, then
// the nearest. Each defender then fights one combat against the attackers that picked it, so no unit
// fights twice in a turn and the order the battles are fought in doesn't matter.
const detectCombat = (state: GameState, attackerSide: PlayerType): Combat[] => {
  const defenderSide = getOpponent(attackerSide);
  const enemies = state.players[defenderSide].units;
  const attackerUnits = state.players[attackerSide].units;

  const choices = attackerUnits
    .map(unit => ({ unit, targets: enemies.filter(enemy => isInAttackRange(state, unit, enemy)) }))
    .filter(choice => choice.targets.length > 0)
    // Units with fewer options pick first, leaving the flexible ones to cover the rest
    .sort((a, b) => a.targets.length - b.targets.length || compareIds(a.unit, b.unit));

  const assignedPower = new Map<string, number>();
  const targetOf = new Map<string, string>();

  for (const { unit, targets } of choices) {
    const power = getEffectivePower(unit, terrainUnder(state, unit));
    const options = targets.map(target => {
      const terrain = terrainUnder(state, target);
      const assigned = assignedPower.get(target.id) ?? 0;
      const healthLeft = target.lifespan - getStrikeDamage(assigned, terrain);
      return {
        target,
        healthLeft,
        kills: healthLeft > 0 && target.lifespan - getStrikeDamage(assigned + power, terrain) <= 0,
        distance: getHexDistance(unit.position, target.position)
      };
    });

    options.sort((a, b) =>
      Number(b.kills) - Number(a.kills) ||
      // Don't waste attacks on units that are already going down
      Number(b.healthLeft > 0) - Number(a.healthLeft > 0) ||
      a.healthLeft - b.healthLeft ||
      a.distance - b.distance ||
      compareIds(a.target, b.target)
    );

    const { target } = options[0];
    targetOf.set(unit.id, target.id);
    assignedPower.set(target.id, (assignedPower.get(target.id) ?? 0) + power);
  }

  const combats: Combat[] = [];
  for (const defender of enemies) {
    const attackers = attackerUnits.filter(unit => targetOf.get(unit.id) === defender.id);
    if (attackers.length === 0) continue;

    combats.push({
      hexCoordinates: defender.position,
      attackers,
      defenders: [defender],
      resolved: false
    });
  }

  if (combats.length > 0) {
    const engaged = new Set(combats.flatMap(c => [...c.attackers, ...c.defenders].map(u => u.id)));
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
  if ((state.players.ai.baseHealth ?? BASE_MAX_HEALTH) <= 0) return 'player';
  if ((state.players.player.baseHealth ?? BASE_MAX_HEALTH) <= 0) return 'ai';

  return undefined;
};

// Wrap up the active side's turn and hand control to the other side.
// The side that just played lays siege to the enemy castle with its units in range, collects gold
// from the mines its units hold and receives its turn income. After the AI's turn the round ends.
const finishTurn = (state: GameState): GameState => {
  const activePlayer = getActivePlayer(state);
  const newState: GameState = {
    ...state,
    combats: [],
    pendingMoves: [],
    pendingPurchases: []
  };

  // The side that just played recovers health at healing springs
  let healed = 0;
  for (const side of ['player', 'ai'] as const) {
    newState.players[side].units = newState.players[side].units.map(unit => {
      const heal = side === activePlayer ? TERRAIN_EFFECTS[terrainUnder(newState, unit)].healPerTurn ?? 0 : 0;
      const lifespan = Math.min(unit.maxLifespan, unit.lifespan + heal);
      healed += lifespan - unit.lifespan;
      return { ...unit, lifespan, hasMoved: false, isEngagedInCombat: false };
    });
  }
  syncHexUnits(newState);
  if (healed > 0) {
    addLog(newState, activePlayer, `${activePlayer === 'player' ? 'Your' : 'Enemy'} troops recover ${healed} health at the springs.`);
  }

  processDamageToBase(newState, activePlayer);
  const mineIncome = collectResources(newState, activePlayer);
  newState.players[activePlayer].points += TURN_INCOME;
  if (activePlayer === 'player') {
    addLog(
      newState,
      'player',
      `You earn ${TURN_INCOME + mineIncome} gold` + (mineIncome > 0 ? ` (${mineIncome} from gold mines).` : '.')
    );
  } else if (mineIncome > 0) {
    addLog(newState, 'ai', `The enemy earns ${mineIncome} gold from gold mines.`);
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
    turnNumber: activePlayer === 'ai' ? newState.turnNumber + 1 : newState.turnNumber,
    planningTimeRemaining: getSettings(state).planningPhaseTime
  };
};

// The besieging side's units near the enemy base damage it, plundering gold as they do
const processDamageToBase = (state: GameState, besieger: PlayerType): void => {
  const side = getOpponent(besieger);
  const baseHex = findBaseHex(state, side);
  if (!baseHex) return;

  const besiegers = state.players[besieger].units.filter(unit =>
    getHexDistance(unit.position, baseHex.coordinates) <= BASE_ATTACK_RANGE
  );

  // Each unit in range deals damage equal to its attack power
  const totalDamage = besiegers.reduce((sum, unit) => sum + unit.attackPower, 0);
  if (totalDamage === 0) return;

  const currentHealth = state.players[side].baseHealth ?? BASE_MAX_HEALTH;
  const newHealth = Math.max(0, currentHealth - totalDamage);

  state.players[side].baseHealth = newHealth;
  updateHex(state, baseHex.coordinates, { baseHealth: newHealth });

  const plunder = Math.floor((currentHealth - newHealth) * SIEGE_PLUNDER_PER_DAMAGE);
  state.players[besieger].points += plunder;
  addLog(
    state,
    besieger,
    `${side === 'player' ? 'Your' : 'The enemy'} castle takes ${totalDamage} siege damage (${newHealth}/${BASE_MAX_HEALTH})` +
      (plunder > 0 ? ` - ${besieger === 'player' ? 'you plunder' : 'the enemy plunders'} ${plunder} gold.` : '.')
  );
};

// Pay out gold from the resource hexes held by one side's units. Returns the amount earned.
const collectResources = (state: GameState, side: PlayerType): number => {
  let earned = 0;

  for (const hex of state.hexGrid) {
    if (hex.isResourceHex && hex.unit?.owner === side) {
      earned += hex.resourceValue || 0;
    }
  }

  state.players[side].points += earned;
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
  // Damage this unit takes in the fight
  damageTaken: number;
  destroyed: boolean;
  // False for attackers out of the defender's reach (e.g. archers shooting from 2 hexes)
  canBeHitBack: boolean;
  // Human readable modifiers that apply to this unit
  modifiers: string[];
}

export interface CombatPreview {
  attackers: CombatantPreview[];
  defenders: CombatantPreview[];
  attackerPower: number;
  defenderPower: number;
}

// Gold awarded for destroying an enemy unit
export const getKillBounty = (unit: Unit) => Math.max(2, Math.round(unit.cost * KILL_BOUNTY_FRACTION));

// Work out what a combat will do, using the units' current stats, terrain and reach.
// Each side's total attack power (after bonuses) is split between the enemy units it can reach,
// reduced by their cover and rounded so the whole side deals at least 1 damage.
export const getCombatPreview = (state: GameState, combat: Combat): CombatPreview => {
  const getLiveUnit = (unit: Unit) =>
    state.players[unit.owner].units.find(u => u.id === unit.id);

  const describe = (units: Unit[]) => units.map(unit => {
    const terrain = terrainUnder(state, unit);
    const modifiers: string[] = [];
    const power = getEffectivePower(unit, terrain);

    const effect = TERRAIN_EFFECTS[terrain];
    if (unit.abilities.includes('terrainBonus') && terrain === 'forest') {
      modifiers.push(`+${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% attack (fighting from forest)`);
    }
    if ((effect.damageDealtMultiplier ?? 1) > 1) {
      modifiers.push(`+${Math.round(((effect.damageDealtMultiplier ?? 1) - 1) * 100)}% attack (high ground)`);
    }

    const damageMultiplier = effect.damageTakenMultiplier;
    if (damageMultiplier < 1) {
      modifiers.push(`${Math.round((1 - damageMultiplier) * 100)}% less damage (${effect.name.toLowerCase()} cover)`);
    } else if (damageMultiplier > 1) {
      modifiers.push(`${Math.round((damageMultiplier - 1) * 100)}% more damage (bogged down in ${effect.name.toLowerCase()})`);
    }

    return { unit, terrain, power, damageMultiplier, modifiers };
  });

  const defenders = describe(combat.defenders.map(getLiveUnit).filter((u): u is Unit => !!u));
  const attackers = describe(combat.attackers.map(getLiveUnit).filter((u): u is Unit => !!u)).map(entry => {
    // Defenders can only strike back at attackers within their own reach
    const canBeHitBack = defenders.some(d => isInAttackRange(state, d.unit, entry.unit));
    if (!canBeHitBack) entry.modifiers.push('out of reach - takes no damage');
    return { ...entry, canBeHitBack };
  });
  const attackerPower = attackers.reduce((sum, a) => sum + a.power, 0);
  const defenderPower = defenders.reduce((sum, d) => sum + d.power, 0);

  const attackerDamage = distributeDamage(
    defenderPower,
    attackers.map(a => ({ multiplier: a.damageMultiplier, reachable: a.canBeHitBack }))
  );
  const defenderDamage = distributeDamage(
    attackerPower,
    defenders.map(d => ({ multiplier: d.damageMultiplier, reachable: true }))
  );

  const withDamage = (
    { unit, terrain, power, modifiers }: (typeof defenders)[number],
    damageTaken: number,
    canBeHitBack: boolean
  ): CombatantPreview => ({
    unit,
    terrain,
    power,
    modifiers,
    canBeHitBack,
    damageTaken,
    destroyed: damageTaken >= unit.lifespan
  });

  return {
    attackers: attackers.map((a, index) => withDamage(a, attackerDamage[index], a.canBeHitBack)),
    defenders: defenders.map((d, index) => withDamage(d, defenderDamage[index], true)),
    attackerPower,
    defenderPower
  };
};

// Fight out a combat. Damage is dealt simultaneously; destroying a unit earns its killer a bounty.
export const resolveCombat = (state: GameState, combatIndex: number): GameState => {
  const combat = state.combats[combatIndex];
  if (state.currentPhase !== 'combat' || !combat || combat.resolved) return state;

  const newState = cloneState(state);
  const preview = getCombatPreview(newState, combat);
  const getLiveUnit = (unit: Unit) =>
    newState.players[unit.owner].units.find(u => u.id === unit.id);

  if (preview.attackers.length > 0 && preview.defenders.length > 0) {
    const bounties: Record<PlayerType, number> = { player: 0, ai: 0 };

    for (const entry of [...preview.attackers, ...preview.defenders]) {
      const unit = getLiveUnit(entry.unit);
      if (!unit) continue;

      unit.lifespan = Math.max(0, unit.lifespan - entry.damageTaken);
      if (unit.lifespan <= 0) {
        removeUnit(newState, unit);
        bounties[getOpponent(unit.owner)] += getKillBounty(unit);
      }
    }
    syncHexUnits(newState);

    const defender = preview.defenders[0];
    const outcome = (entry: CombatantPreview) =>
      entry.destroyed ? 'destroyed' : entry.damageTaken > 0 ? `-${entry.damageTaken} HP` : 'unharmed';
    addLog(
      newState,
      getActivePlayer(newState),
      `${preview.attackers.map(a => unitLabel(a.unit)).join(' & ')} attacked ${unitLabel(defender.unit)}: ` +
        `defender ${outcome(defender)}, attackers ${preview.attackers.map(outcome).join(', ')}.`
    );

    for (const side of ['player', 'ai'] as const) {
      if (bounties[side] === 0) continue;
      newState.players[side].points += bounties[side];
      addLog(
        newState,
        side,
        `${side === 'player' ? 'You earn' : 'The enemy earns'} ${bounties[side]} gold in bounty.`
      );
    }
  }

  newState.combats[combatIndex] = { ...combat, resolved: true };

  if (newState.combats.every(c => c.resolved)) {
    return finishTurn(newState);
  }

  return newState;
};

// Remove a unit from the game
const removeUnit = (state: GameState, unit: Unit): void => {
  state.players[unit.owner].units = state.players[unit.owner].units.filter(u => u.id !== unit.id);
  syncHexUnits(state);
};
