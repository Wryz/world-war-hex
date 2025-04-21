import { 
  GameState, 
  Player, 
  Unit, 
  UnitType, 
  Hex,
  Move,
  Purchase
} from '@/types/game';
import { 
  getHexDistance, 
  findHexByCoordinates, 
  getNeighbors,
  getHexesInRange,
  findPath 
} from '../game/hexUtils';
import { UNITS } from '../game/gameState';

/**
 * AI difficulty settings affecting various strategic parameters
 */
interface AIDifficultySettings {
  attackAggressiveness: number; // 0-1, how aggressively to pursue attacks
  defensePreference: number;   // 0-1, how much to prioritize defending base
  resourceFocus: number;       // 0-1, how much to focus on capturing resources
  unitDiversityDesire: number; // 0-1, how much to diversify unit types
  retreatThreshold: number;    // 0-1, health % at which to retreat
}

const DIFFICULTY_SETTINGS = {
  easy: {
    attackAggressiveness: 0.3,
    defensePreference: 0.7, 
    resourceFocus: 0.4,
    unitDiversityDesire: 0.3,
    retreatThreshold: 0.7
  },
  medium: {
    attackAggressiveness: 0.5,
    defensePreference: 0.5,
    resourceFocus: 0.6,
    unitDiversityDesire: 0.6,
    retreatThreshold: 0.5
  },
  hard: {
    attackAggressiveness: 0.8,
    defensePreference: 0.4,
    resourceFocus: 0.7,
    unitDiversityDesire: 0.8,
    retreatThreshold: 0.3
  }
};

/**
 * Get the AI's moves for the current planning phase
 */
export const getAIMoves = (
  state: GameState
): { moves: Move[], purchases: Purchase[] } => {
  const aiDifficulty = state.settings?.aiDifficulty || 'medium';
  const settings = DIFFICULTY_SETTINGS[aiDifficulty as keyof typeof DIFFICULTY_SETTINGS];
  
  const aiPlayer = state.players.ai;
  const playerBase = findPlayerBase(state, 'player');
  const aiBase = findPlayerBase(state, 'ai');
  
  if (!aiBase || !playerBase) {
    return { moves: [], purchases: [] };
  }
  
  // Analyze the current game state
  const threatAssessment = assessThreats(state, aiPlayer);
  const resourceOpportunities = findResourceOpportunities(state);
  
  // Decide what unit to purchase
  const purchase = decidePurchase(
    state, 
    aiPlayer, 
    settings, 
    threatAssessment,
    resourceOpportunities
  );
  
  // Decide how to move existing units
  const moves = decideMoves(
    state, 
    aiPlayer, 
    settings, 
    playerBase,
    aiBase,
    threatAssessment,
    resourceOpportunities
  );
  
  return {
    moves,
    purchases: purchase ? [purchase] : []
  };
};

/**
 * Assess threats to the AI's units and base
 */
interface ThreatAssessment {
  baseUnderThreat: boolean;
  threatenedUnits: Array<{unit: Unit, threatLevel: number}>;
  enemyStrengthNearBase: number;
  strongestEnemyUnit?: Unit;
}

const assessThreats = (state: GameState, aiPlayer: Player): ThreatAssessment => {
  const aiBase = findPlayerBase(state, 'ai');
  if (!aiBase) {
    return {
      baseUnderThreat: false,
      threatenedUnits: [],
      enemyStrengthNearBase: 0
    };
  }
  
  // Check for enemies near the base
  const baseProximityRange = 3; // Consider threats within 3 hexes of base
  const hexesNearBase = getHexesInRange(state.hexGrid, aiBase.coordinates, baseProximityRange);
  
  const enemyUnitsNearBase = hexesNearBase
    .filter(hex => hex.unit && hex.unit.owner === 'player')
    .map(hex => hex.unit as Unit);
  
  const enemyStrengthNearBase = enemyUnitsNearBase.reduce(
    (sum, unit) => sum + unit.attackPower, 
    0
  );
  
  // Find the strongest enemy unit
  const playerUnits = state.players.player.units;
  let strongestEnemyUnit: Unit | undefined;
  let maxAttackPower = 0;
  
  for (const unit of playerUnits) {
    if (unit.attackPower > maxAttackPower) {
      maxAttackPower = unit.attackPower;
      strongestEnemyUnit = unit;
    }
  }
  
  // Check for AI units under immediate threat
  const threatenedUnits: Array<{unit: Unit, threatLevel: number}> = [];
  
  for (const aiUnit of aiPlayer.units) {
    const adjacentHexes = getNeighbors(aiUnit.position)
      .map(coord => findHexByCoordinates(state.hexGrid, coord))
      .filter(Boolean) as Hex[];
    
    const adjacentEnemies = adjacentHexes
      .filter(hex => hex.unit && hex.unit.owner === 'player')
      .map(hex => hex.unit as Unit);
    
    if (adjacentEnemies.length > 0) {
      const enemyStrength = adjacentEnemies.reduce(
        (sum, unit) => sum + unit.attackPower, 
        0
      );
      
      // Calculate threat level as a ratio of enemy strength to unit health
      const threatLevel = enemyStrength / aiUnit.lifespan;
      
      threatenedUnits.push({
        unit: aiUnit,
        threatLevel
      });
    }
  }
  
  // Base is under threat if strong enemy units are nearby
  const baseUnderThreat = 
    enemyStrengthNearBase > 5 || // Arbitrary threshold
    enemyUnitsNearBase.length >= 2;
  
  return {
    baseUnderThreat,
    threatenedUnits,
    enemyStrengthNearBase,
    strongestEnemyUnit
  };
};

/**
 * Find resource hexes that the AI could capture
 */
const findResourceOpportunities = (
  state: GameState
): Hex[] => {
  const resourceHexes = state.hexGrid.filter(hex => 
    hex.isResourceHex && 
    (!hex.unit || hex.unit.owner !== 'ai')
  );
  
  return resourceHexes;
};

/**
 * Find a player's base hex
 */
const findPlayerBase = (
  state: GameState, 
  playerType: 'player' | 'ai'
): Hex | undefined => {
  return state.hexGrid.find(hex => 
    hex.isBase && hex.owner === playerType
  );
};

/**
 * Decide which unit to purchase based on the current game state
 */
const decidePurchase = (
  state: GameState,
  aiPlayer: Player,
  settings: AIDifficultySettings,
  threatAssessment: ThreatAssessment,
  resourceOpportunities: Hex[]
): Purchase | null => {
  // Check if AI has enough points to purchase any unit
  const cheapestUnit = Object.values(UNITS).reduce(
    (cheapest, unit) => unit.cost < cheapest.cost ? unit : cheapest,
    { cost: Infinity } as typeof UNITS[UnitType]
  );
  
  if (aiPlayer.points < cheapestUnit.cost) {
    return null;
  }
  
  // Decide what unit type to purchase based on the situation
  let desiredUnitType: UnitType;
  
  if (threatAssessment.baseUnderThreat) {
    // Under threat, prefer defensive units
    desiredUnitType = aiPlayer.points >= UNITS.tank.cost ? 'tank' : 'infantry';
  } else if (resourceOpportunities.length > 0 && Math.random() < settings.resourceFocus) {
    // Focus on capturing resources with fast units
    desiredUnitType = aiPlayer.points >= UNITS.helicopter.cost ? 'helicopter' : 'infantry';
  } else if (Math.random() < settings.attackAggressiveness) {
    // Aggressive attack mode
    if (aiPlayer.points >= UNITS.artillery.cost) {
      desiredUnitType = 'artillery';
    } else if (aiPlayer.points >= UNITS.tank.cost) {
      desiredUnitType = 'tank';
    } else {
      desiredUnitType = 'infantry';
    }
  } else {
    // Balance the army composition
    const unitCounts = aiPlayer.units.reduce((counts, unit) => {
      counts[unit.type] = (counts[unit.type] || 0) + 1;
      return counts;
    }, {} as Record<UnitType, number>);
    
    // Find the least common unit type the AI can afford
    const affordableTypes = Object.keys(UNITS) as UnitType[];
    const sortedTypes = affordableTypes
      .filter(type => UNITS[type].cost <= aiPlayer.points)
      .sort((a, b) => (unitCounts[a] || 0) - (unitCounts[b] || 0));
    
    desiredUnitType = sortedTypes[0] || 'infantry';
  }
  
  // Find a valid position to place the new unit
  const aiBase = findPlayerBase(state, 'ai');
  if (!aiBase || !aiBase.coordinates) {
    return null;
  }
  
  // Get adjacent positions to the base
  const adjacentPositions = getNeighbors(aiBase.coordinates);
  const validPositions = adjacentPositions.filter(pos => {
    const hex = findHexByCoordinates(state.hexGrid, pos);
    return hex && !hex.unit && hex.terrain !== 'water' && hex.terrain !== 'mountain';
  });
  
  if (validPositions.length === 0) {
    return null;
  }
  
  // Choose a random valid position
  const position = validPositions[Math.floor(Math.random() * validPositions.length)];
  
  return {
    playerId: aiPlayer.id,
    unitType: desiredUnitType,
    position
  };
};

/**
 * Decide how to move existing units
 */
const decideMoves = (
  state: GameState,
  aiPlayer: Player,
  settings: AIDifficultySettings,
  playerBase: Hex,
  aiBase: Hex,
  threatAssessment: ThreatAssessment,
  resourceOpportunities: Hex[]
): Move[] => {
  const moves: Move[] = [];
  
  // Handle each unit separately
  for (const unit of aiPlayer.units) {
    if (unit.hasMoved || unit.isEngagedInCombat) continue;
    
    // Check if this unit is under threat
    const unitThreat = threatAssessment.threatenedUnits.find(t => t.unit.id === unit.id);
    
    if (unitThreat && unitThreat.threatLevel > settings.retreatThreshold) {
      // Unit should retreat
      const retreatMove = decideRetreatMove(state, unit, aiBase);
      if (retreatMove) {
        moves.push(retreatMove);
        continue;
      }
    }
    
    // If base is under threat and this unit is nearby, defend the base
    if (
      threatAssessment.baseUnderThreat && 
      getHexDistance(unit.position, aiBase.coordinates) < 5 &&
      Math.random() < settings.defensePreference
    ) {
      const defenseMove = decideDefensiveMove(state, unit, aiBase);
      if (defenseMove) {
        moves.push(defenseMove);
        continue;
      }
    }
    
    // If resources are available and unit is suitable for capturing
    if (
      resourceOpportunities.length > 0 && 
      Math.random() < settings.resourceFocus &&
      (unit.type === 'infantry' || unit.type === 'helicopter')
    ) {
      const resourceMove = decideResourceCaptureMove(state, unit, resourceOpportunities);
      if (resourceMove) {
        moves.push(resourceMove);
        continue;
      }
    }
    
    // Otherwise, move towards the enemy base with some randomness
    if (Math.random() < settings.attackAggressiveness) {
      const attackMove = decideAttackMove(state, unit, playerBase);
      if (attackMove) {
        moves.push(attackMove);
        continue;
      }
    } else {
      // Make a random move for variety
      const randomMove = decideRandomMove(state, unit);
      if (randomMove) {
        moves.push(randomMove);
      }
    }
  }
  
  return moves;
};

/**
 * Decide how a unit should retreat
 */
const decideRetreatMove = (
  state: GameState,
  unit: Unit,
  aiBase: Hex
): Move | null => {
  // Try to move towards the base
  const path = findPath(
    unit.position,
    aiBase.coordinates,
    state.hexGrid,
    unit.movementRange
  );
  
  if (path && path.length > 1) {
    // Move as far along the path as possible
    const targetPos = path[Math.min(path.length - 1, unit.movementRange)];
    const targetHex = findHexByCoordinates(state.hexGrid, targetPos);
    
    if (targetHex && !targetHex.unit) {
      return {
        unitId: unit.id,
        playerId: state.players.ai.id,
        from: unit.position,
        to: targetPos
      };
    }
  }
  
  // If no path to base, just move away from enemies
  const neighbors = getNeighbors(unit.position);
  
  // Filter to valid moves (no units, passable terrain)
  const validMoves = neighbors.filter(pos => {
    const hex = findHexByCoordinates(state.hexGrid, pos);
    if (!hex || hex.unit) return false;
    if (unit.type !== 'helicopter' && hex.terrain === 'water') return false;
    return true;
  });
  
  if (validMoves.length === 0) return null;
  
  // Find enemy units
  const enemyUnits = state.players.player.units;
  
  // Score each move by how far it gets from enemies
  const scoredMoves = validMoves.map(move => {
    let score = 0;
    
    for (const enemy of enemyUnits) {
      const currentDistance = getHexDistance(unit.position, enemy.position);
      const newDistance = getHexDistance(move, enemy.position);
      
      // Reward moving away from enemies
      score += newDistance - currentDistance;
    }
    
    return { move, score };
  });
  
  // Sort by score (higher is better)
  scoredMoves.sort((a, b) => b.score - a.score);
  
  if (scoredMoves.length === 0) return null;
  
  // Choose the best retreat
  const bestMove = scoredMoves[0].move;
  
  return {
    unitId: unit.id,
    playerId: state.players.ai.id,
    from: unit.position,
    to: bestMove
  };
};

/**
 * Decide how a unit should defend the base
 */
const decideDefensiveMove = (
  state: GameState,
  unit: Unit,
  aiBase: Hex
): Move | null => {
  // Look for enemy units near the base
  const baseNeighbors = getNeighbors(aiBase.coordinates);
  const threateningPositions = baseNeighbors.filter(pos => {
    const hex = findHexByCoordinates(state.hexGrid, pos);
    return hex && hex.unit && hex.unit.owner === 'player';
  });
  
  // If there are threatening units, move to intercept
  if (threateningPositions.length > 0) {
    // Sort by distance to the unit
    threateningPositions.sort((a, b) => 
      getHexDistance(unit.position, a) - getHexDistance(unit.position, b)
    );
    
    // Try to move toward the closest threat
    const target = threateningPositions[0];
    const path = findPath(
      unit.position,
      target,
      state.hexGrid,
      unit.movementRange
    );
    
    if (path && path.length > 1) {
      const moveTarget = path[Math.min(path.length - 1, unit.movementRange)];
      const targetHex = findHexByCoordinates(state.hexGrid, moveTarget);
      
      if (targetHex && !targetHex.unit) {
        return {
          unitId: unit.id,
          playerId: state.players.ai.id,
          from: unit.position,
          to: moveTarget
        };
      }
    }
  }
  
  // If no direct threats or can't path to them, position defensively around base
  const defensivePositions = getNeighbors(aiBase.coordinates);
  
  // Filter to valid positions
  const validPositions = defensivePositions.filter(pos => {
    const hex = findHexByCoordinates(state.hexGrid, pos);
    if (!hex || hex.unit) return false;
    if (unit.type !== 'helicopter' && hex.terrain === 'water') return false;
    return true;
  });
  
  if (validPositions.length === 0) return null;
  
  // Sort by distance to the unit
  validPositions.sort((a, b) => 
    getHexDistance(unit.position, a) - getHexDistance(unit.position, b)
  );
  
  // Move to the closest defensive position
  const bestPosition = validPositions[0];
  
  // Check if we can get there
  const path = findPath(
    unit.position,
    bestPosition,
    state.hexGrid,
    unit.movementRange
  );
  
  if (path && path.length > 1) {
    const moveTarget = path[Math.min(path.length - 1, unit.movementRange)];
    
    return {
      unitId: unit.id,
      playerId: state.players.ai.id,
      from: unit.position,
      to: moveTarget
    };
  }
  
  return null;
};

/**
 * Decide how a unit should capture resources
 */
const decideResourceCaptureMove = (
  state: GameState,
  unit: Unit,
  resourceOpportunities: Hex[]
): Move | null => {
  if (resourceOpportunities.length === 0) return null;
  
  // Sort resource hexes by distance to the unit
  resourceOpportunities.sort((a, b) => 
    getHexDistance(unit.position, a.coordinates) - 
    getHexDistance(unit.position, b.coordinates)
  );
  
  // Try to move toward the closest resource
  for (const resource of resourceOpportunities) {
    const path = findPath(
      unit.position,
      resource.coordinates,
      state.hexGrid,
      unit.movementRange
    );
    
    if (path && path.length > 1) {
      const moveTarget = path[Math.min(path.length - 1, unit.movementRange)];
      const targetHex = findHexByCoordinates(state.hexGrid, moveTarget);
      
      if (targetHex && !targetHex.unit) {
        return {
          unitId: unit.id,
          playerId: state.players.ai.id,
          from: unit.position,
          to: moveTarget
        };
      }
    }
  }
  
  return null;
};

/**
 * Decide how a unit should attack the enemy base
 */
const decideAttackMove = (
  state: GameState,
  unit: Unit,
  playerBase: Hex
): Move | null => {
  // Try to move toward the enemy base
  const path = findPath(
    unit.position,
    playerBase.coordinates,
    state.hexGrid,
    unit.movementRange
  );
  
  if (path && path.length > 1) {
    const moveTarget = path[Math.min(path.length - 1, unit.movementRange)];
    const targetHex = findHexByCoordinates(state.hexGrid, moveTarget);
    
    if (targetHex && (!targetHex.unit || targetHex.isBase)) {
      return {
        unitId: unit.id,
        playerId: state.players.ai.id,
        from: unit.position,
        to: moveTarget
      };
    }
  }
  
  return null;
};

/**
 * Make a random move for variety
 */
const decideRandomMove = (
  state: GameState,
  unit: Unit
): Move | null => {
  const possibleMoves = [];
  const coordsInRange = [];
  
  // Get all hexes within movement range
  for (let q = -unit.movementRange; q <= unit.movementRange; q++) {
    for (let r = Math.max(-unit.movementRange, -q-unit.movementRange); 
         r <= Math.min(unit.movementRange, -q+unit.movementRange); 
         r++) {
      coordsInRange.push({
        q: unit.position.q + q,
        r: unit.position.r + r
      });
    }
  }
  
  // Filter to valid moves
  for (const coord of coordsInRange) {
    const hex = findHexByCoordinates(state.hexGrid, coord);
    if (!hex) continue;
    
    // Skip if occupied or impassable
    if (hex.unit) continue;
    if (unit.type !== 'helicopter' && hex.terrain === 'water') continue;
    
    // Check if there's a path to this hex
    const path = findPath(
      unit.position,
      coord,
      state.hexGrid,
      unit.movementRange
    );
    
    if (path && path.length <= unit.movementRange + 1) {
      possibleMoves.push(coord);
    }
  }
  
  if (possibleMoves.length === 0) return null;
  
  // Pick a random move
  const randomIndex = Math.floor(Math.random() * possibleMoves.length);
  const randomMove = possibleMoves[randomIndex];
  
  return {
    unitId: unit.id,
    playerId: state.players.ai.id,
    from: unit.position,
    to: randomMove
  };
};

/**
 * Decide whether to fight or retreat during combat
 */
export const decideAICombatStrategy = (
  state: GameState,
  combatIndex: number
): boolean => {
  const aiDifficulty = state.settings?.aiDifficulty || 'medium';
  const settings = DIFFICULTY_SETTINGS[aiDifficulty as keyof typeof DIFFICULTY_SETTINGS];
  
  const combat = state.combats[combatIndex];
  if (!combat) return false; // Fight by default
  
  // Only consider retreating if AI is the defender
  const aiDefenders = combat.defenders.filter(unit => unit.owner === 'ai');
  if (aiDefenders.length === 0) return false; // Fight if AI is attacking
  
  // Calculate total combat strengths
  const attackerStrength = combat.attackers.reduce(
    (sum, unit) => sum + unit.attackPower, 
    0
  );
  
  const defenderStrength = combat.defenders.reduce(
    (sum, unit) => sum + unit.attackPower, 
    0
  );
  
  // Consider unit health
  const defenderHealth = combat.defenders.reduce(
    (sum, unit) => sum + unit.lifespan / unit.maxLifespan, 
    0
  ) / combat.defenders.length;
  
  // Retreat conditions:
  // 1. Overwhelmed by attacker strength
  // 2. Health too low
  // 3. Near retreat threshold based on difficulty
  const shouldRetreat = 
    attackerStrength > defenderStrength * 1.5 ||
    defenderHealth < settings.retreatThreshold ||
    Math.random() < (1 - settings.attackAggressiveness) * 0.3; // Occasional random retreat
  
  return shouldRetreat;
}; 