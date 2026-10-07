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
  getSpiral,
  getHexDistance,
  findHexByCoordinates,
  getNeighbors
} from './hexUtils';

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
  resourceHexCount: 10
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

// Create a hexagonal grid with the specified radius
const createHexagonalGrid = (settings: GameSettings): Hex[] => {
  const hexes: Hex[] = [];
  const center: HexCoordinates = { q: 0, r: 0 };
  
  // Generate all coordinates for the grid
  const coordinates = getSpiral(center, settings.gridSize);
  
  // Initialize biome noise map for terrain clustering
  const terrainTypes = Object.keys(settings.terrainDistribution) as TerrainType[];
  
  // Create noise seeds for terrain clustering
  const noiseSeed1 = Math.random() * 100;
  const noiseSeed2 = Math.random() * 100;
  const noiseSeed3 = Math.random() * 100;
  
  // First, generate a height/moisture map for each hex to determine terrain clusters
  const noiseMap: Record<string, { height: number; moisture: number; temperature: number }> = {};
  
  for (const coord of coordinates) {
    // Use coordinate values to generate a consistent noise value
    // Scale coordinates to create a more interesting noise pattern
    const scale = 0.12; // Adjust this to control cluster size
    
    // Generate multiple noise values for different terrain features
    // Simple noise function using sin (this could be replaced with a better noise function)
    const height = Math.sin(noiseSeed1 + scale * (coord.q * 1.7 + coord.r * 2.3)) * 0.5 + 0.5;
    const moisture = Math.sin(noiseSeed2 + scale * (coord.q * 2.5 - coord.r * 1.8)) * 0.5 + 0.5;
    const temperature = Math.sin(noiseSeed3 + scale * (coord.q * 1.2 + coord.r * 2.7)) * 0.5 + 0.5;
    
    noiseMap[`${coord.q},${coord.r}`] = { height, moisture, temperature };
  }
  
  // Generate terrain based on noise map while respecting distribution
  const terrainCounts: Record<TerrainType, number> = {
    plain: 0,
    mountain: 0,
    forest: 0,
    water: 0,
    desert: 0,
    resource: 0
  };
  
  const targetDistribution = { ...settings.terrainDistribution };
  
  // First pass: assign terrain based on noise values
  for (const coord of coordinates) {
    const id = `hex-${coord.q}-${coord.r}`;
    const noise = noiseMap[`${coord.q},${coord.r}`];
    
    // Determine terrain based on noise values
    let terrain: TerrainType;
    
    if (noise.height > 0.75) {
      // High elevation = mountains
      terrain = 'mountain';
    } else if (noise.height > 0.6 && noise.moisture > 0.5) {
      // Medium-high elevation with moisture = forest
      terrain = 'forest';
    } else if (noise.height < 0.3) {
      // Low elevation = water
      terrain = 'water';
    } else if (noise.moisture < 0.3 && noise.temperature > 0.6) {
      // Dry and hot = desert
      terrain = 'desert';
    } else {
      // Default to plains
      terrain = 'plain';
    }
    
    hexes.push({
      id,
      coordinates: coord,
      terrain
    });
    
    // Track terrain counts
    terrainCounts[terrain]++;
  }
  
  // Calculate actual distribution
  const totalHexes = coordinates.length;
  const actualDistribution: Record<TerrainType, number> = {
    plain: 0,
    mountain: 0,
    forest: 0,
    water: 0,
    desert: 0,
    resource: 0
  };
  for (const type of terrainTypes) {
    actualDistribution[type] = terrainCounts[type] / totalHexes;
  }
  
  // Second pass: adjust some hexes to match the target distribution
  // We'll prioritize keeping clusters intact by only changing hexes at the edges of clusters
  for (let i = 0; i < hexes.length; i++) {
    const hex = hexes[i];
    const currentType = hex.terrain;
    
    // Calculate if this type is over-represented
    if (actualDistribution[currentType] > targetDistribution[currentType]) {
      // Find a type that's under-represented
      const underRepresentedTypes = terrainTypes.filter(
        type => actualDistribution[type] < targetDistribution[type]
      );
      
      if (underRepresentedTypes.length > 0) {
        // Get neighboring hexes to check if this is an edge hex
        const neighborCoords = getNeighbors(hex.coordinates);
        const neighborTerrains = neighborCoords
          .map(coord => {
            const neighborHex = hexes.find(h => 
              h.coordinates.q === coord.q && h.coordinates.r === coord.r
            );
            return neighborHex?.terrain;
          })
          .filter(Boolean) as TerrainType[];
        
        // Check if this hex is at an edge of a cluster
        const uniqueNeighborTerrains = Array.from(new Set(neighborTerrains));
        const isEdgeHex = uniqueNeighborTerrains.some(t => t !== currentType);
        
        // Only change edge hexes to maintain cluster integrity
        if (isEdgeHex || Math.random() < 0.2) { // 20% chance to change non-edge hexes
          // Choose an under-represented terrain type based on noise values
          const noise = noiseMap[`${hex.coordinates.q},${hex.coordinates.r}`];
          let newType = underRepresentedTypes[0];
          
          // Try to assign a terrain that makes sense based on noise values
          if (underRepresentedTypes.includes('mountain') && noise.height > 0.6) {
            newType = 'mountain';
          } else if (underRepresentedTypes.includes('forest') && noise.moisture > 0.5) {
            newType = 'forest';
          } else if (underRepresentedTypes.includes('water') && noise.height < 0.35) {
            newType = 'water';
          } else if (underRepresentedTypes.includes('desert') && noise.moisture < 0.4) {
            newType = 'desert';
          } else if (underRepresentedTypes.includes('plain')) {
            newType = 'plain';
          }
          
          // Update hex terrain
          hexes[i] = { ...hex, terrain: newType };
          
          // Update terrain counts
          terrainCounts[currentType]--;
          terrainCounts[newType]++;
          
          // Update actual distribution
          actualDistribution[currentType] = terrainCounts[currentType] / totalHexes;
          actualDistribution[newType] = terrainCounts[newType] / totalHexes;
        }
      }
    }
  }
  
  // Place resource hexes
  placeResourceHexes(hexes, settings.resourceHexCount);
  
  return hexes;
};

// Generate random terrain based on distribution - kept for reference or fallback
export const generateRandomTerrain = (distribution: Record<TerrainType, number>): TerrainType => {
  const terrainTypes = Object.keys(distribution) as TerrainType[];
  const weights = terrainTypes.map(type => distribution[type]);
  
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (let i = 0; i < terrainTypes.length; i++) {
    cumulativeWeight += weights[i];
    if (random < cumulativeWeight) {
      return terrainTypes[i];
    }
  }
  
  return 'plain'; // Default
};

// Place resource hexes in a somewhat balanced manner
const placeResourceHexes = (hexes: Hex[], count: number): void => {
  // Try to place resources evenly across the map
  const center: HexCoordinates = { q: 0, r: 0 };
  const potentialResourceHexes = hexes.filter(hex => 
    // Not in the center or edges
    getHexDistance(hex.coordinates, center) > 3 && 
    getHexDistance(hex.coordinates, center) < 8 &&
    // Not water or mountain
    hex.terrain !== 'water' && hex.terrain !== 'mountain'
  );
  
  // Shuffle array
  for (let i = potentialResourceHexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [potentialResourceHexes[i], potentialResourceHexes[j]] = 
    [potentialResourceHexes[j], potentialResourceHexes[i]];
  }
  
  // Take the first 'count' hexes
  const resourceHexes = potentialResourceHexes.slice(0, count);
  
  for (const hex of resourceHexes) {
    const hexIndex = hexes.findIndex(h => h.id === hex.id);
    hexes[hexIndex] = {
      ...hexes[hexIndex],
      terrain: 'resource',
      isResourceHex: true,
      resourceValue: 2 + Math.floor(Math.random() * 3) // 2-4 points
    };
  }
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
export const isImpassable = (hex: Hex) => hex.terrain === 'water' || hex.terrain === 'mountain';

const findPlayerById = (state: GameState, playerId: string): Player | undefined =>
  Object.values(state.players).find(p => p.id === playerId);

export const findBaseHex = (state: GameState, playerType: PlayerType): Hex | undefined =>
  state.hexGrid.find(hex => hex.isBase && hex.owner === playerType);

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

  return {
    ...newState,
    currentPhase: 'planning',
    activePlayer: 'player',
    turnNumber: 1,
    planningTimeRemaining: getSettings(state).planningPhaseTime
  };
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

// All hexes a unit can legally be ordered to move to this turn.
// Units walk hex by hex: they can't cross water or mountains, can pass through friendly
// units but not enemy units, and can't end on an occupied or already reserved hex.
export const getValidMoveTargets = (state: GameState, unit: Unit): HexCoordinates[] => {
  if (unit.hasMoved) return [];

  const hexByKey = new Map(state.hexGrid.map(hex => [coordKey(hex.coordinates), hex]));
  const reserved = new Set([
    ...state.pendingPurchases.map(p => coordKey(p.position)),
    ...state.pendingMoves.filter(m => m.unitId !== unit.id).map(m => coordKey(m.to))
  ]);

  const startKey = coordKey(unit.position);
  const visited = new Set<string>([startKey]);
  let frontier: HexCoordinates[] = [unit.position];
  const targets: HexCoordinates[] = [];

  for (let step = 0; step < unit.movementRange; step++) {
    const nextFrontier: HexCoordinates[] = [];

    for (const current of frontier) {
      for (const neighbor of getNeighbors(current)) {
        const key = coordKey(neighbor);
        if (visited.has(key)) continue;

        const hex = hexByKey.get(key);
        if (!hex || isImpassable(hex)) continue;
        if (hex.unit && hex.unit.owner !== unit.owner) continue;

        visited.add(key);
        nextFrontier.push(hex.coordinates);

        const isOwnBase = hex.isBase && hex.owner === unit.owner;
        if (!hex.unit && !isOwnBase && !reserved.has(key)) {
          targets.push(hex.coordinates);
        }
      }
    }

    frontier = nextFrontier;
  }

  return targets;
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
  const occupied = new Set(
    [...newState.players.player.units, ...newState.players.ai.units].map(u => coordKey(u.position))
  );

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
  }

  // Then execute all moves
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
  }

  newState.pendingMoves = [];
  newState.pendingPurchases = [];
  syncHexUnits(newState);

  // A unit standing on the enemy base captures it
  const winner = checkBaseCapture(newState);
  if (winner) {
    return { ...newState, winner, currentPhase: 'gameOver' };
  }

  // The side that just moved attacks every enemy unit it is adjacent to
  const combats = detectCombat(newState, getActivePlayer(newState));
  if (combats.length > 0) {
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
    newState = collectResources(newState);
    for (const side of ['player', 'ai'] as const) {
      newState.players[side].points += TURN_INCOME;
    }
    turnNumber += 1;
  }

  const winner = checkBaseDestroyed(newState);
  if (winner) {
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
  }

  return state;
};

// Collect resources from controlled resource hexes
const collectResources = (state: GameState): GameState => {
  for (const hex of state.hexGrid) {
    if (hex.isResourceHex && hex.unit) {
      state.players[hex.unit.owner].points += hex.resourceValue || 0;
    }
  }

  return state;
};

// ---------------------------------------------------------------------------
// Combat phase
// ---------------------------------------------------------------------------

// Resolve a combat - the defenders either stand and fight or retreat
export const resolveCombat = (
  state: GameState,
  combatIndex: number,
  retreat: boolean
): GameState => {
  const combat = state.combats[combatIndex];
  if (state.currentPhase !== 'combat' || !combat || combat.resolved) return state;

  const newState = cloneState(state);

  // Use the units' current stats - earlier combats this turn may have damaged or destroyed them
  const getLiveUnit = (unit: Unit) =>
    newState.players[unit.owner].units.find(u => u.id === unit.id);
  const attackers = combat.attackers.map(getLiveUnit).filter((u): u is Unit => !!u);
  const defenders = combat.defenders.map(getLiveUnit).filter((u): u is Unit => !!u);
  const retreatingUnits: Unit[] = [];

  if (retreat) {
    for (const defender of defenders) {
      const retreatTo = chooseRetreatPosition(newState, defender);

      if (retreatTo) {
        defender.position = retreatTo;
        defender.isEngagedInCombat = false;
        retreatingUnits.push({ ...defender });
        syncHexUnits(newState);
      } else {
        // Nowhere to run - the unit is destroyed
        removeUnit(newState, defender);
      }
    }
  } else if (attackers.length > 0 && defenders.length > 0) {
    const totalAttackerPower = attackers.reduce((sum, unit) => sum + unit.attackPower, 0);
    let totalDefenderPower = defenders.reduce((sum, unit) => sum + unit.attackPower, 0);

    // Defender gets terrain bonus on mountains and forests
    const combatHex = findHexByCoordinates(newState.hexGrid, combat.hexCoordinates);
    if (
      combatHex &&
      (combatHex.terrain === 'mountain' || combatHex.terrain === 'forest') &&
      defenders.some(unit => unit.abilities.includes('terrainBonus'))
    ) {
      totalDefenderPower *= 1.5;
    }

    // Damage is dealt simultaneously and split evenly between the units on each side
    const damageToAttackers = Math.max(1, Math.floor(totalDefenderPower / attackers.length));
    const damageToDefenders = Math.max(1, Math.floor(totalAttackerPower / defenders.length));

    for (const [units, damage] of [[attackers, damageToAttackers], [defenders, damageToDefenders]] as const) {
      for (const unit of units) {
        unit.lifespan = Math.max(0, unit.lifespan - damage);
        if (unit.lifespan <= 0) {
          removeUnit(newState, unit);
        }
      }
    }

    syncHexUnits(newState);
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
