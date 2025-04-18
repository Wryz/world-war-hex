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

// Define base health constant
const BASE_MAX_HEALTH = 50;

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
    turnNumber: 0,
    planningTimeRemaining: settings.planningPhaseTime,
    pendingMoves: [],
    pendingPurchases: [],
    combats: []
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

// Set up base locations
export const setBaseLocation = (
  state: GameState, 
  playerType: PlayerType, 
  coordinates: HexCoordinates
): GameState => {
  // Copy the state
  const newState = { ...state };
  
  // Find the hex
  const hexIndex = newState.hexGrid.findIndex(
    hex => hex.coordinates.q === coordinates.q && hex.coordinates.r === coordinates.r
  );
  
  if (hexIndex === -1) {
    console.error('Invalid base coordinates');
    return state;
  }
  
  // Update the hex
  newState.hexGrid[hexIndex] = {
    ...newState.hexGrid[hexIndex],
    isBase: true,
    owner: playerType,
    baseHealth: BASE_MAX_HEALTH
  };
  
  // Update the player
  newState.players[playerType] = {
    ...newState.players[playerType],
    baseLocation: coordinates,
    baseHealth: BASE_MAX_HEALTH,
    maxBaseHealth: BASE_MAX_HEALTH
  };
  
  // Check if both players have set their base locations
  if (
    newState.players.player.baseLocation &&
    newState.players.ai.baseLocation
  ) {
    // Start the first planning phase
    newState.currentPhase = 'planning';
    newState.turnNumber = 1;
    newState.planningTimeRemaining = state.planningTimeRemaining;
  }
  
  return newState;
};

// Add a move to the pending moves
export const addPendingMove = (
  state: GameState,
  unitId: string,
  playerId: string,
  to: HexCoordinates
): GameState => {
  // Find the unit
  const player = Object.values(state.players).find(p => p.id === playerId);
  if (!player) return state;
  
  const unit = player.units.find(u => u.id === unitId);
  if (!unit) return state;
  
  // Add the move to pending moves
  const move: Move = {
    unitId,
    playerId,
    from: unit.position,
    to
  };
  
  return {
    ...state,
    pendingMoves: [...state.pendingMoves, move]
  };
};

// Add a pending purchase
export const addPendingPurchase = (
  state: GameState,
  playerId: string,
  unitType: UnitType,
  position: HexCoordinates
): GameState => {
  // Add the purchase to pending purchases
  const purchase: Purchase = {
    playerId,
    unitType,
    position
  };
  
  return {
    ...state,
    pendingPurchases: [...state.pendingPurchases, purchase]
  };
};

// Execute all pending moves and purchases
export const executeMoves = (state: GameState): GameState => {
  let newState = { ...state };
  
  // Execute all purchases first
  for (const purchase of state.pendingPurchases) {
    const player = Object.values(newState.players).find(p => p.id === purchase.playerId);
    if (!player) continue;
    
    // Check if player has enough points
    const unitCost = UNITS[purchase.unitType].cost;
    if (player.points < unitCost) continue;
    
    // Check if the position is valid (near base and empty)
    const hex = findHexByCoordinates(newState.hexGrid, purchase.position);
    if (!hex || hex.unit) continue;
    
    const baseHex = findHexByCoordinates(
      newState.hexGrid,
      player.baseLocation || { q: 0, r: 0 }
    );
    
    if (!baseHex || !baseHex.isBase) continue;
    
    // Create the new unit
    const newUnit: Unit = {
      id: `unit-${uuidv4()}`,
      type: purchase.unitType,
      owner: player.type,
      position: purchase.position,
      movementRange: UNITS[purchase.unitType].movementRange,
      attackPower: UNITS[purchase.unitType].attackPower,
      lifespan: UNITS[purchase.unitType].lifespan,
      maxLifespan: UNITS[purchase.unitType].maxLifespan,
      cost: UNITS[purchase.unitType].cost,
      abilities: [...UNITS[purchase.unitType].abilities],
      hasMoved: false,
      isEngagedInCombat: false
    };
    
    // Add the unit to the player's units
    newState.players[player.type] = {
      ...newState.players[player.type],
      units: [...newState.players[player.type].units, newUnit],
      points: newState.players[player.type].points - unitCost
    };
    
    // Update the hex to have this unit
    const hexIndex = newState.hexGrid.findIndex(h => 
      h.coordinates.q === purchase.position.q && h.coordinates.r === purchase.position.r
    );
    
    if (hexIndex !== -1) {
      newState.hexGrid[hexIndex] = {
        ...newState.hexGrid[hexIndex],
        unit: newUnit
      };
    }
  }
  
  // Then execute all moves
  for (const move of state.pendingMoves) {
    // Find the player and unit
    const player = Object.values(newState.players).find(p => p.id === move.playerId);
    if (!player) continue;
    
    const unitIndex = player.units.findIndex(u => u.id === move.unitId);
    if (unitIndex === -1) continue;
    
    const unit = player.units[unitIndex];
    
    // Find the source and destination hexes
    const fromHex = findHexByCoordinates(newState.hexGrid, move.from);
    const toHex = findHexByCoordinates(newState.hexGrid, move.to);
    
    if (!fromHex || !toHex) continue;
    
    // Ensure the destination hex is empty or it's the enemy base
    if (toHex.unit && !toHex.isBase) continue;
    
    // Move the unit
    const updatedUnit: Unit = {
      ...unit,
      position: move.to,
      hasMoved: true
    };
    
    // Update the player's units
    newState.players[player.type].units[unitIndex] = updatedUnit;
    
    // Update the hexes
    const fromHexIndex = newState.hexGrid.findIndex(h => 
      h.coordinates.q === move.from.q && h.coordinates.r === move.from.r
    );
    
    const toHexIndex = newState.hexGrid.findIndex(h => 
      h.coordinates.q === move.to.q && h.coordinates.r === move.to.r
    );
    
    if (fromHexIndex !== -1) {
      newState.hexGrid[fromHexIndex] = {
        ...newState.hexGrid[fromHexIndex],
        unit: undefined
      };
    }
    
    if (toHexIndex !== -1) {
      newState.hexGrid[toHexIndex] = {
        ...newState.hexGrid[toHexIndex],
        unit: updatedUnit
      };
    }
  }
  
  // Clear pending moves and purchases
  newState = {
    ...newState,
    pendingMoves: [],
    pendingPurchases: [],
    currentPhase: 'execution'
  };
  
  // Check for combat
  newState = detectCombat(newState);
  
  // Check victory condition (unit on enemy base)
  newState = checkVictory(newState);
  
  return newState;
};

// Detect combat situations
const detectCombat = (state: GameState): GameState => {
  const combats: Combat[] = [];
  
  // Check each hex for adjacent enemy units
  for (const hex of state.hexGrid) {
    if (!hex.unit) continue;
    
    const neighborCoords = getNeighbors(hex.coordinates);
    const neighborHexes = neighborCoords
      .map(coord => findHexByCoordinates(state.hexGrid, coord))
      .filter(Boolean) as Hex[];
    
    const enemyUnits = neighborHexes
      .filter(h => h.unit && h.unit.owner !== hex.unit?.owner)
      .map(h => h.unit!);
    
    if (enemyUnits.length > 0) {
      // Create a combat
      combats.push({
        hexCoordinates: hex.coordinates,
        attackers: enemyUnits,
        defenders: [hex.unit],
        resolved: false
      });
      
      // Mark units as engaged in combat
      const unitOwner = hex.unit.owner;
      const unitId = hex.unit.id;
      
      const unitIndex = state.players[unitOwner].units.findIndex(u => u.id === unitId);
      
      if (unitIndex !== -1) {
        state.players[unitOwner].units[unitIndex] = {
          ...state.players[unitOwner].units[unitIndex],
          isEngagedInCombat: true
        };
      }
      
      for (const enemyUnit of enemyUnits) {
        const enemyIndex = state.players[enemyUnit.owner].units.findIndex(u => u.id === enemyUnit.id);
        
        if (enemyIndex !== -1) {
          state.players[enemyUnit.owner].units[enemyIndex] = {
            ...state.players[enemyUnit.owner].units[enemyIndex],
            isEngagedInCombat: true
          };
        }
      }
    }
  }
  
  if (combats.length > 0) {
    return {
      ...state,
      combats,
      currentPhase: 'combat'
    };
  }
  
  // No combat, move to next planning phase
  return startNextPlanningPhase(state);
};

// Check for victory conditions
const checkVictory = (state: GameState): GameState => {
  // Find base hexes
  const playerBaseHex = state.hexGrid.find(hex => hex.isBase && hex.owner === 'player');
  const aiBaseHex = state.hexGrid.find(hex => hex.isBase && hex.owner === 'ai');
  
  if (!playerBaseHex || !aiBaseHex) return state;
  
  // Check if player unit is on AI base
  if (playerBaseHex.unit && playerBaseHex.unit.owner === 'ai') {
    return {
      ...state,
      winner: 'ai',
      currentPhase: 'gameOver'
    };
  }
  
  // Check if AI unit is on player base
  if (aiBaseHex.unit && aiBaseHex.unit.owner === 'player') {
    return {
      ...state,
      winner: 'player',
      currentPhase: 'gameOver'
    };
  }
  
  return state;
};

// Start the next planning phase
const startNextPlanningPhase = (state: GameState): GameState => {
  // Process base damage from nearby units
  let newState = processDamageToBase(state);
  
  // Collect resources from resource hexes
  newState = collectResources(newState);
  
  // Reset unit movement flags
  for (const playerType in newState.players) {
    const player = newState.players[playerType as PlayerType];
    
    player.units = player.units.map(unit => ({
      ...unit,
      hasMoved: false,
      isEngagedInCombat: false
    }));
  }
  
  // Increment turn number
  newState = {
    ...newState,
    turnNumber: newState.turnNumber + 1,
    currentPhase: 'planning',
    planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime
  };
  
  return newState;
};

// Process damage to bases from nearby enemy units
const processDamageToBase = (state: GameState): GameState => {
  const newState = { ...state };
  
  // Calculate damage to player base from nearby AI units
  const playerBaseHex = newState.hexGrid.find(hex => hex.isBase && hex.owner === 'player');
  const aiBaseHex = newState.hexGrid.find(hex => hex.isBase && hex.owner === 'ai');
  
  if (playerBaseHex && playerBaseHex.baseHealth && newState.players.player.baseHealth) {
    // Find AI units in attack range (3 hexes)
    const nearbyEnemyUnits = newState.players.ai.units.filter(unit => 
      getHexDistance(unit.position, playerBaseHex.coordinates) <= 3
    );
    
    // Calculate total damage (1 damage per unit attack power)
    const totalDamage = nearbyEnemyUnits.reduce((sum, unit) => sum + unit.attackPower, 0);
    
    if (totalDamage > 0) {
      // Apply damage to player base
      const newHealth = Math.max(0, newState.players.player.baseHealth - totalDamage);
      newState.players.player.baseHealth = newHealth;
      
      // Update base hex
      const hexIndex = newState.hexGrid.indexOf(playerBaseHex);
      if (hexIndex !== -1) {
        newState.hexGrid[hexIndex] = {
          ...newState.hexGrid[hexIndex],
          baseHealth: newHealth
        };
      }
      
      // Check for defeat (base health reached zero)
      if (newHealth <= 0) {
        newState.winner = 'ai';
        newState.currentPhase = 'gameOver';
      }
    }
  }
  
  if (aiBaseHex && aiBaseHex.baseHealth && newState.players.ai.baseHealth) {
    // Find player units in attack range (3 hexes)
    const nearbyEnemyUnits = newState.players.player.units.filter(unit => 
      getHexDistance(unit.position, aiBaseHex.coordinates) <= 3
    );
    
    // Calculate total damage (1 damage per unit attack power)
    const totalDamage = nearbyEnemyUnits.reduce((sum, unit) => sum + unit.attackPower, 0);
    
    if (totalDamage > 0) {
      // Apply damage to AI base
      const newHealth = Math.max(0, newState.players.ai.baseHealth - totalDamage);
      newState.players.ai.baseHealth = newHealth;
      
      // Update base hex
      const hexIndex = newState.hexGrid.indexOf(aiBaseHex);
      if (hexIndex !== -1) {
        newState.hexGrid[hexIndex] = {
          ...newState.hexGrid[hexIndex],
          baseHealth: newHealth
        };
      }
      
      // Check for defeat (base health reached zero)
      if (newHealth <= 0) {
        newState.winner = 'player';
        newState.currentPhase = 'gameOver';
      }
    }
  }
  
  return newState;
};

// Collect resources from controlled resource hexes
const collectResources = (state: GameState): GameState => {
  const newState = { ...state };
  const resourceHexes = state.hexGrid.filter(hex => hex.isResourceHex);
  
  for (const hex of resourceHexes) {
    if (hex.unit) {
      const owner = hex.unit.owner;
      const resourceValue = hex.resourceValue || 0;
      
      newState.players[owner] = {
        ...newState.players[owner],
        points: newState.players[owner].points + resourceValue
      };
    }
  }
  
  return newState;
};

// Resolve a combat (player decides to fight)
export const resolveCombat = (
  state: GameState,
  combatIndex: number,
  retreat: boolean
): GameState => {
  const newState = { ...state };
  const combat = newState.combats[combatIndex];
  
  if (!combat || combat.resolved) return state;
  
  if (retreat) {
    // Handle retreat logic
    const defenders = [...combat.defenders];
    const retreatingUnits: Unit[] = [];
    
    for (const defender of defenders) {
      // Find valid retreat positions
      const validRetreats = getValidRetreatPositions(newState, defender);
      
      if (validRetreats.length > 0) {
        // Choose first retreat position (this could be more strategic)
        const retreatTo = validRetreats[0];
        
        // Move the unit
        const unit = retreatUnit(newState, defender, retreatTo);
        if (unit) {
          retreatingUnits.push(unit);
        }
      } else {
        // No valid retreat - unit is destroyed
        removeUnit(newState, defender);
      }
    }
    
    // Mark combat as resolved
    newState.combats[combatIndex] = {
      ...combat,
      resolved: true,
      retreating: retreatingUnits
    };
  } else {
    // Resolve combat
    const attackers = [...combat.attackers];
    const defenders = [...combat.defenders];
    
    // Simple combat resolution - total attack power vs. lifespan
    const totalAttackerPower = attackers.reduce((sum, unit) => sum + unit.attackPower, 0);
    let totalDefenderPower = defenders.reduce((sum, unit) => sum + unit.attackPower, 0);
    
    // Apply terrain bonuses
    const combatHex = findHexByCoordinates(newState.hexGrid, combat.hexCoordinates);
    if (combatHex) {
      // Defender gets terrain bonus on mountains and forests
      if ((combatHex.terrain === 'mountain' || combatHex.terrain === 'forest') && 
          defenders.some(unit => unit.abilities.includes('terrainBonus'))) {
        totalDefenderPower *= 1.5;
      }
    }
    
    // Reduce lifespan based on enemy attack power
    for (const attacker of attackers) {
      const damagePerUnit = Math.max(1, Math.floor(totalDefenderPower / attackers.length));
      const unitIndex = newState.players[attacker.owner].units.findIndex(u => u.id === attacker.id);
      
      if (unitIndex !== -1) {
        const newLifespan = Math.max(0, attacker.lifespan - damagePerUnit);
        
        if (newLifespan <= 0) {
          // Unit is destroyed
          removeUnit(newState, attacker);
        } else {
          // Unit is damaged
          newState.players[attacker.owner].units[unitIndex] = {
            ...newState.players[attacker.owner].units[unitIndex],
            lifespan: newLifespan
          };
        }
      }
    }
    
    for (const defender of defenders) {
      const damagePerUnit = Math.max(1, Math.floor(totalAttackerPower / defenders.length));
      const unitIndex = newState.players[defender.owner].units.findIndex(u => u.id === defender.id);
      
      if (unitIndex !== -1) {
        const newLifespan = Math.max(0, defender.lifespan - damagePerUnit);
        
        if (newLifespan <= 0) {
          // Unit is destroyed
          removeUnit(newState, defender);
        } else {
          // Unit is damaged
          newState.players[defender.owner].units[unitIndex] = {
            ...newState.players[defender.owner].units[unitIndex],
            lifespan: newLifespan
          };
        }
      }
    }
    
    // Mark combat as resolved
    newState.combats[combatIndex] = {
      ...combat,
      resolved: true
    };
  }
  
  // Check if all combats are resolved
  const allResolved = newState.combats.every(c => c.resolved);
  
  if (allResolved) {
    // Move to next planning phase
    return startNextPlanningPhase(newState);
  }
  
  return newState;
};

// Get valid retreat positions for a unit
const getValidRetreatPositions = (state: GameState, unit: Unit): HexCoordinates[] => {
  const neighbors = getNeighbors(unit.position);
  
  return neighbors.filter(coord => {
    const hex = findHexByCoordinates(state.hexGrid, coord);
    
    // Valid if hex exists, is not water (unless helicopter), and has no unit
    return hex && 
           (hex.terrain !== 'water' || unit.type === 'helicopter') &&
           !hex.unit;
  });
};

// Retreat a unit to a new position
const retreatUnit = (state: GameState, unit: Unit, to: HexCoordinates): Unit | null => {
  // Find the unit in the player's units
  const unitIndex = state.players[unit.owner].units.findIndex(u => u.id === unit.id);
  
  if (unitIndex === -1) return null;
  
  // Update the unit's position
  const updatedUnit: Unit = {
    ...state.players[unit.owner].units[unitIndex],
    position: to,
    isEngagedInCombat: false
  };
  
  state.players[unit.owner].units[unitIndex] = updatedUnit;
  
  // Update hexes
  const fromHexIndex = state.hexGrid.findIndex(h => 
    h.coordinates.q === unit.position.q && h.coordinates.r === unit.position.r
  );
  
  const toHexIndex = state.hexGrid.findIndex(h => 
    h.coordinates.q === to.q && h.coordinates.r === to.r
  );
  
  if (fromHexIndex !== -1) {
    state.hexGrid[fromHexIndex] = {
      ...state.hexGrid[fromHexIndex],
      unit: undefined
    };
  }
  
  if (toHexIndex !== -1) {
    state.hexGrid[toHexIndex] = {
      ...state.hexGrid[toHexIndex],
      unit: updatedUnit
    };
  }
  
  return updatedUnit;
};

// Remove a unit from the game
const removeUnit = (state: GameState, unit: Unit): void => {
  // Remove from player's units
  state.players[unit.owner].units = state.players[unit.owner].units.filter(u => u.id !== unit.id);
  
  // Remove from hex
  const hexIndex = state.hexGrid.findIndex(h => 
    h.coordinates.q === unit.position.q && h.coordinates.r === unit.position.r
  );
  
  if (hexIndex !== -1) {
    state.hexGrid[hexIndex] = {
      ...state.hexGrid[hexIndex],
      unit: undefined
    };
  }
}; 