import {
  GameState,
  Player,
  Unit,
  UnitType,
  Hex,
  HexCoordinates
} from '@/types/game';
import {
  getHexDistance,
  findHexByCoordinates,
  getNeighbors,
  getHexesInRange
} from '../game/hexUtils';
import {
  UNITS,
  addPendingMove,
  addPendingPurchase,
  getDeploymentHexes,
  getValidMoveTargets,
  getTerrainDistanceMap,
  findBaseHex
} from '../game/gameState';

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

const DIFFICULTY_SETTINGS: Record<'easy' | 'medium' | 'hard', AIDifficultySettings> = {
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

// Unit types the AI recruits (the same ones offered to the player in the barracks)
const RECRUITABLE_TYPES: UnitType[] = ['infantry', 'artillery', 'helicopter', 'tank'];

// The AI goes on the offensive once it has this many more units than the player...
const PUSH_UNIT_ADVANTAGE = 3;
// ...or once the game reaches this round
const PUSH_AFTER_ROUND = 25;

// Most units the AI recruits in a single turn
const MAX_PURCHASES_PER_TURN = 3;

const getDifficultySettings = (state: GameState): AIDifficultySettings =>
  DIFFICULTY_SETTINGS[state.settings?.aiDifficulty ?? 'medium'] ?? DIFFICULTY_SETTINGS.medium;

/**
 * Plan the AI's turn: queue a purchase and moves for its units.
 * Returns the game state with the AI's pending purchases and moves added.
 */
export const planAITurn = (state: GameState): GameState => {
  const settings = getDifficultySettings(state);
  const playerBase = findBaseHex(state, 'player');
  const aiBase = findBaseHex(state, 'ai');

  if (!aiBase || !playerBase) return state;

  // Analyze the current game state
  const threatAssessment = assessThreats(state, state.players.ai);
  const resourceOpportunities = findResourceOpportunities(state);

  // Move existing units first so newly deployed units don't block them
  let updatedState = state;
  for (const unit of state.players.ai.units) {
    if (unit.hasMoved || unit.isEngagedInCombat) continue;

    const target = decideUnitMove(
      updatedState,
      unit,
      settings,
      playerBase,
      aiBase,
      threatAssessment,
      resourceOpportunities
    );

    if (target) {
      updatedState = addPendingMove(updatedState, unit.id, state.players.ai.id, target);
    }
  }

  // Then spend gold on reinforcements - several per turn when the treasury allows
  for (let i = 0; i < MAX_PURCHASES_PER_TURN; i++) {
    const purchase = decidePurchase(
      updatedState, 
      updatedState.players.ai, 
      settings, 
      threatAssessment,
      resourceOpportunities
    );
    if (!purchase) break;
    
    const afterPurchase = addPendingPurchase(
      updatedState,
      state.players.ai.id,
      purchase.unitType,
      purchase.position
    );
    if (afterPurchase === updatedState) break;
    updatedState = afterPurchase;
  }
  
  return updatedState;
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
  const aiBase = findBaseHex(state, 'ai');
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
  let strongestEnemyUnit: Unit | undefined;
  let maxAttackPower = 0;

  for (const unit of state.players.player.units) {
    if (unit.attackPower > maxAttackPower) {
      maxAttackPower = unit.attackPower;
      strongestEnemyUnit = unit;
    }
  }

  // Check for AI units under immediate threat
  const threatenedUnits: Array<{unit: Unit, threatLevel: number}> = [];

  for (const aiUnit of aiPlayer.units) {
    const adjacentEnemies = getNeighbors(aiUnit.position)
      .map(coord => findHexByCoordinates(state.hexGrid, coord)?.unit)
      .filter((unit): unit is Unit => !!unit && unit.owner === 'player');

    if (adjacentEnemies.length > 0) {
      const enemyStrength = adjacentEnemies.reduce((sum, unit) => sum + unit.attackPower, 0);

      // Calculate threat level as a ratio of enemy strength to unit health
      threatenedUnits.push({
        unit: aiUnit,
        threatLevel: enemyStrength / aiUnit.lifespan
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
const findResourceOpportunities = (state: GameState): Hex[] =>
  state.hexGrid.filter(hex => hex.isResourceHex && !hex.unit);

/**
 * Decide which unit to purchase based on the current game state
 */
const decidePurchase = (
  state: GameState,
  aiPlayer: Player,
  settings: AIDifficultySettings,
  threatAssessment: ThreatAssessment,
  resourceOpportunities: Hex[]
): { unitType: UnitType, position: HexCoordinates } | null => {
  const affordableTypes = RECRUITABLE_TYPES.filter(type => UNITS[type].cost <= aiPlayer.points);
  if (affordableTypes.length === 0) return null;

  const canAfford = (type: UnitType) => affordableTypes.includes(type);
  const cheapest = affordableTypes.reduce((a, b) => UNITS[a].cost <= UNITS[b].cost ? a : b);

  // Decide what unit type to purchase based on the situation
  let desiredUnitType: UnitType;

  if (threatAssessment.baseUnderThreat) {
    // Under threat, prefer defensive units
    desiredUnitType = canAfford('tank') ? 'tank' : cheapest;
  } else if (resourceOpportunities.length > 0 && Math.random() < settings.resourceFocus) {
    // Focus on capturing resources with fast units
    desiredUnitType = canAfford('helicopter') ? 'helicopter' : cheapest;
  } else if (Math.random() < settings.attackAggressiveness) {
    // Aggressive attack mode - buy the hardest hitter available
    desiredUnitType = affordableTypes.reduce((a, b) =>
      UNITS[a].attackPower >= UNITS[b].attackPower ? a : b
    );
  } else {
    // Balance the army composition - pick the least common unit type the AI can afford
    const unitCounts = aiPlayer.units.reduce((counts, unit) => {
      counts[unit.type] = (counts[unit.type] || 0) + 1;
      return counts;
    }, {} as Partial<Record<UnitType, number>>);

    const sortedTypes = [...affordableTypes].sort(
      (a, b) => (unitCounts[a] || 0) - (unitCounts[b] || 0)
    );

    desiredUnitType = Math.random() < settings.unitDiversityDesire
      ? sortedTypes[0]
      : affordableTypes[Math.floor(Math.random() * affordableTypes.length)];
  }

  // Find a valid position next to the base to deploy the new unit
  const validPositions = getDeploymentHexes(state, 'ai');
  if (validPositions.length === 0) return null;

  // Prefer the deployment hex closest to the enemy base
  const playerBase = findBaseHex(state, 'player');
  const position = playerBase
    ? closestTo(validPositions.map(h => h.coordinates), playerBase.coordinates)
    : validPositions[Math.floor(Math.random() * validPositions.length)].coordinates;

  return position ? { unitType: desiredUnitType, position } : null;
};

const closestTo = (candidates: HexCoordinates[], goal: HexCoordinates): HexCoordinates | null => {
  let best: HexCoordinates | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const distance = getHexDistance(candidate, goal);
    // Break ties randomly so units don't always take the same route
    if (distance < bestDistance || (distance === bestDistance && Math.random() < 0.5)) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
};

// Walking distances to goals, cached per map so each goal is only searched once
const distanceMapCache = new WeakMap<GameState['hexGrid'], Map<string, Map<string, number>>>();

const walkingDistance = (state: GameState, from: HexCoordinates, goal: HexCoordinates): number => {
  let cache = distanceMapCache.get(state.hexGrid);
  if (!cache) {
    cache = new Map();
    distanceMapCache.set(state.hexGrid, cache);
  }
  const goalKey = `${goal.q},${goal.r}`;
  let distances = cache.get(goalKey);
  if (!distances) {
    distances = getTerrainDistanceMap(state.hexGrid, goal);
    cache.set(goalKey, distances);
  }
  // Fall back to straight-line distance for hexes the goal can't be walked to from
  return distances.get(`${from.q},${from.r}`) ?? getHexDistance(from, goal) + 100;
};

/**
 * Pick the reachable hex that gets the unit closest to a goal by walking distance,
 * so units go around lakes and mountain ranges instead of getting stuck behind them.
 * Returns null if no reachable hex is closer to the goal than the unit already is.
 */
const moveToward = (state: GameState, unit: Unit, goal: HexCoordinates): HexCoordinates | null => {
  let best: HexCoordinates | null = null;
  let bestDistance = walkingDistance(state, unit.position, goal);
  
  for (const target of getValidMoveTargets(state, unit)) {
    const distance = walkingDistance(state, target, goal);
    // Break ties randomly so units don't always take the same route
    if (distance < bestDistance || (best && distance === bestDistance && Math.random() < 0.5)) {
      bestDistance = distance;
      best = target;
    }
  }
  
  return best;
};

/**
 * Pick the reachable hex furthest from all enemy units
 */
const moveAwayFromEnemies = (state: GameState, unit: Unit): HexCoordinates | null => {
  const enemies = state.players.player.units;
  const targets = getValidMoveTargets(state, unit);

  const nearestEnemyDistance = (coord: HexCoordinates) => enemies.reduce(
    (min, enemy) => Math.min(min, getHexDistance(coord, enemy.position)),
    Infinity
  );

  let best: HexCoordinates | null = null;
  let bestScore = nearestEnemyDistance(unit.position);

  for (const target of targets) {
    const score = nearestEnemyDistance(target);
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }

  return best;
};

/**
 * Decide where a single unit should move this turn (or null to hold position)
 */
const decideUnitMove = (
  state: GameState,
  unit: Unit,
  settings: AIDifficultySettings,
  playerBase: Hex,
  aiBase: Hex,
  threatAssessment: ThreatAssessment,
  resourceOpportunities: Hex[]
): HexCoordinates | null => {
  // Retreat badly threatened or badly wounded units towards the base
  const unitThreat = threatAssessment.threatenedUnits.find(t => t.unit.id === unit.id);
  const healthRatio = unit.lifespan / unit.maxLifespan;

  if (unitThreat && (unitThreat.threatLevel > 1 || healthRatio < settings.retreatThreshold)) {
    const retreat = moveToward(state, unit, aiBase.coordinates) ?? moveAwayFromEnemies(state, unit);
    if (retreat) return retreat;
  }

  // If base is under threat and this unit is nearby, defend the base
  if (
    threatAssessment.baseUnderThreat &&
    getHexDistance(unit.position, aiBase.coordinates) < 5 &&
    Math.random() < settings.defensePreference
  ) {
    const nearestThreat = state.players.player.units
      .filter(enemy => getHexDistance(enemy.position, aiBase.coordinates) <= 3)
      .sort((a, b) =>
        getHexDistance(unit.position, a.position) - getHexDistance(unit.position, b.position)
      )[0];

    const defenseMove = nearestThreat
      ? moveToward(state, unit, nearestThreat.position)
      : moveToward(state, unit, aiBase.coordinates);
    if (defenseMove) return defenseMove;
  }

  // Press the attack when the AI clearly outnumbers the player, or once the game drags on,
  // so armies don't trade units in the middle of the map forever
  const isPushing =
    state.players.ai.units.length >= state.players.player.units.length + PUSH_UNIT_ADVANTAGE ||
    state.turnNumber >= PUSH_AFTER_ROUND;
  if (isPushing) {
    const pushMove = moveToward(state, unit, playerBase.coordinates);
    if (pushMove) return pushMove;
  }
  
  // Fast units grab unclaimed resource hexes
  if (
    resourceOpportunities.length > 0 &&
    Math.random() < settings.resourceFocus &&
    (unit.type === 'infantry' || unit.type === 'helicopter')
  ) {
    const reservedTargets = state.pendingMoves.map(m => m.to);
    const nearestResource = resourceOpportunities
      .filter(hex => !reservedTargets.some(t => t.q === hex.coordinates.q && t.r === hex.coordinates.r))
      .sort((a, b) =>
        getHexDistance(unit.position, a.coordinates) - getHexDistance(unit.position, b.coordinates)
      )[0];

    if (nearestResource) {
      const resourceMove = moveToward(state, unit, nearestResource.coordinates);
      if (resourceMove) return resourceMove;
    }
  }

  // Aggressive units hunt nearby enemy units or march on the enemy base
  if (Math.random() < settings.attackAggressiveness) {
    const nearbyEnemy = state.players.player.units
      .filter(enemy => getHexDistance(unit.position, enemy.position) <= unit.movementRange + 1)
      .sort((a, b) => a.lifespan - b.lifespan)[0];

    if (nearbyEnemy && healthRatio >= settings.retreatThreshold) {
      const huntMove = moveToward(state, unit, nearbyEnemy.position);
      if (huntMove) return huntMove;
    }

    const attackMove = moveToward(state, unit, playerBase.coordinates);
    if (attackMove) return attackMove;
  }

  // Otherwise make a random move for variety
  const targets = getValidMoveTargets(state, unit);
  if (targets.length === 0 || Math.random() < 0.3) return null;

  return targets[Math.floor(Math.random() * targets.length)];
};
