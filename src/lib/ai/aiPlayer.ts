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
  getHexesInRange,
  getNeighbors
} from '../game/hexUtils';
import {
  UNITS,
  BASE_ATTACK_RANGE,
  TERRAIN_EFFECTS,
  addPendingMove,
  addPendingPurchase,
  getAttackRange,
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

// Most units of a type the AI keeps if that type can't walk to the enemy castle on this map
// (archers can't cross deep sand); a couple still help defend the castle
const MAX_STRANDED_UNITS_PER_TYPE = 2;

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

  // Move existing units first: hexes next to the castle that they leave can then take recruits
  let updatedState = state;
  for (const unit of state.players.ai.units) {
    if (unit.hasMoved) continue;

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

  // Check for AI units under immediate threat: enemies that can already strike them,
  // including archers shooting from a distance
  const threatenedUnits: Array<{unit: Unit, threatLevel: number}> = [];

  for (const aiUnit of aiPlayer.units) {
    const enemyStrength = enemyStrengthAt(state, aiUnit.position);
    if (enemyStrength > 0) {
      // Threat level is the damage the unit could take (after cover) relative to its health
      threatenedUnits.push({
        unit: aiUnit,
        threatLevel: enemyStrength * coverMultiplier(state, aiUnit.position) / aiUnit.lifespan
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
    enemyStrengthNearBase
  };
};

// Player units that could strike a hex without moving, given their attack range
const enemiesInReachOf = (state: GameState, position: HexCoordinates): Unit[] =>
  state.players.player.units.filter(enemy => getHexDistance(enemy.position, position) <= getAttackRange(enemy));

const enemyStrengthAt = (state: GameState, position: HexCoordinates): number =>
  enemiesInReachOf(state, position).reduce((sum, enemy) => sum + enemy.attackPower, 0);

// Damage multiplier for a unit standing on a hex (forest cover reduces damage)
const coverMultiplier = (state: GameState, position: HexCoordinates): number => {
  const hex = findHexByCoordinates(state.hexGrid, position);
  return hex ? TERRAIN_EFFECTS[hex.terrain].damageTakenMultiplier : 1;
};

const isRanged = (unit: Unit) => getAttackRange(unit) > 1;

// Whether a hex is next to an enemy unit, where archers would be caught in melee
const isAdjacentToEnemy = (state: GameState, position: HexCoordinates): boolean =>
  state.players.player.units.some(enemy => getHexDistance(enemy.position, position) === 1);

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
  const affordableTypes = RECRUITABLE_TYPES.filter(type =>
    UNITS[type].cost <= aiPlayer.points &&
    (canMarchOnEnemyCastle(state, UNITS[type].movementRange) ||
      aiPlayer.units.filter(unit => unit.type === type).length < MAX_STRANDED_UNITS_PER_TYPE)
  );
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

/**
 * Whether units with this movement range can walk from the AI castle to within siege range of the
 * player's castle. A unit can never enter a hex that costs more than its whole movement, so on
 * some maps slow units are stuck behind deep sand.
 */
const canMarchOnEnemyCastle = (state: GameState, movementRange: number): boolean => {
  const aiBase = findBaseHex(state, 'ai');
  const playerBase = findBaseHex(state, 'player');
  if (!aiBase || !playerBase) return false;

  const hexByKey = new Map(state.hexGrid.map(hex => [`${hex.coordinates.q},${hex.coordinates.r}`, hex]));
  const seen = new Set<string>([`${aiBase.coordinates.q},${aiBase.coordinates.r}`]);
  const queue: HexCoordinates[] = [aiBase.coordinates];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (getHexDistance(current, playerBase.coordinates) <= BASE_ATTACK_RANGE) return true;

    for (const neighbor of getNeighbors(current)) {
      const key = `${neighbor.q},${neighbor.r}`;
      const hex = hexByKey.get(key);
      const moveCost = hex && TERRAIN_EFFECTS[hex.terrain].moveCost;
      if (seen.has(key) || moveCost === undefined || moveCost === null || moveCost > movementRange) continue;
      seen.add(key);
      queue.push(neighbor);
    }
  }
  return false;
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

// Walking distances to goals, cached per map so each goal is only searched once per game.
// Terrain never changes during a game but the hexGrid array is replaced every turn, so the
// cache is keyed by the map's terrain layout. Only the most recently used maps are kept.
const MAX_CACHED_MAPS = 4;
const distanceMapCache = new Map<string, Map<string, Map<string, number>>>();
const terrainSignatures = new WeakMap<Hex[], string>();

const getTerrainSignature = (hexGrid: Hex[]): string => {
  let signature = terrainSignatures.get(hexGrid);
  if (!signature) {
    signature = hexGrid.map(hex => `${hex.coordinates.q},${hex.coordinates.r}${hex.terrain[0]}`).join(';');
    terrainSignatures.set(hexGrid, signature);
  }
  return signature;
};

const getDistanceCache = (hexGrid: Hex[]): Map<string, Map<string, number>> => {
  const signature = getTerrainSignature(hexGrid);
  let cache = distanceMapCache.get(signature);
  if (cache) {
    // Re-insert so the map counts as most recently used
    distanceMapCache.delete(signature);
  } else {
    cache = new Map();
    if (distanceMapCache.size >= MAX_CACHED_MAPS) {
      distanceMapCache.delete(distanceMapCache.keys().next().value!);
    }
  }
  distanceMapCache.set(signature, cache);
  return cache;
};

const walkingDistance = (state: GameState, from: HexCoordinates, goal: HexCoordinates): number => {
  const cache = getDistanceCache(state.hexGrid);
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
 * Archers avoid ending their move next to an enemy, where they would be caught in melee,
 * and `avoid` can rule out further hexes.
 * Returns null if no reachable hex is closer to the goal than the unit already is.
 */
const moveToward = (
  state: GameState,
  unit: Unit,
  goal: HexCoordinates,
  avoid?: (position: HexCoordinates) => boolean
): HexCoordinates | null => {
  let best: HexCoordinates | null = null;
  let bestDistance = walkingDistance(state, unit.position, goal);
  
  for (const target of getValidMoveTargets(state, unit)) {
    if (avoid?.(target)) continue;
    if (isRanged(unit) && !coordsMatch(target, goal) && isAdjacentToEnemy(state, target)) continue;
    const distance = walkingDistance(state, target, goal);
    // Break ties randomly so units don't always take the same route
    if (distance < bestDistance || (best && distance === bestDistance && Math.random() < 0.5)) {
      bestDistance = distance;
      best = target;
    }
  }
  
  return best;
};

const coordsMatch = (a: HexCoordinates, b: HexCoordinates) => a.q === b.q && a.r === b.r;

/**
 * Move into position to strike an enemy unit. Melee units close in; archers aim for a hex at
 * exactly their attack range, where melee units can't hit back, and prefer hexes few enemies reach.
 * Returns null if the unit is already as well placed as it can get this turn.
 */
const moveToEngage = (state: GameState, unit: Unit, enemy: Unit): HexCoordinates | null => {
  if (!isRanged(unit)) return moveToward(state, unit, enemy.position);

  const range = getAttackRange(unit);
  // Lower is better: distance from the ideal range first (too close is worse than too far),
  // then how many enemies could strike the hex
  const score = (position: HexCoordinates) => {
    const distance = getHexDistance(position, enemy.position);
    const offRange = distance > range ? distance - range : (range - distance) * 1.5;
    return offRange * 10 + enemiesInReachOf(state, position).length;
  };

  let best: HexCoordinates | null = null;
  let bestScore = score(unit.position);
  for (const target of getValidMoveTargets(state, unit)) {
    const targetScore = score(target);
    if (targetScore < bestScore) {
      bestScore = targetScore;
      best = target;
    }
  }

  // Nothing better within reach (e.g. terrain in the way): walk around towards the enemy instead
  if (!best && getHexDistance(unit.position, enemy.position) > range) {
    return moveToward(state, unit, enemy.position);
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
  // Press the attack when the AI clearly outnumbers the player, or once the game drags on,
  // so armies don't trade units in the middle of the map forever
  const isPushing =
    state.players.ai.units.length >= state.players.player.units.length + PUSH_UNIT_ADVANTAGE ||
    state.turnNumber >= PUSH_AFTER_ROUND;

  // Hexes next to the castle are where recruits are deployed, so units shouldn't park there
  const isNextToCastle = (position: HexCoordinates) => getHexDistance(position, aiBase.coordinates) === 1;

  // Retreat badly threatened or badly wounded units towards the base (not while going all-in)
  const unitThreat = threatAssessment.threatenedUnits.find(t => t.unit.id === unit.id);
  const healthRatio = unit.lifespan / unit.maxLifespan;

  if (!isPushing && unitThreat && (unitThreat.threatLevel > 1 || healthRatio < settings.retreatThreshold)) {
    const retreat = moveToward(state, unit, aiBase.coordinates, isNextToCastle) ??
      (getHexDistance(unit.position, aiBase.coordinates) > 2 ? moveAwayFromEnemies(state, unit) : null);
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
      ? moveToEngage(state, unit, nearestThreat)
      : moveToward(state, unit, aiBase.coordinates);
    if (defenseMove) return defenseMove;
  }

  // Hold gold mines: a unit standing on one stays put (it still fights any enemy in its reach)
  // unless it has to retreat or defend the castle, or the AI is making its late-game all-out push
  const isOnMine = !!findHexByCoordinates(state.hexGrid, unit.position)?.isResourceHex;
  if (isOnMine && state.turnNumber < PUSH_AFTER_ROUND) return null;

  if (isPushing) {
    const pushMove = moveToward(state, unit, playerBase.coordinates);
    if (pushMove) return pushMove;

    // The way forward is blocked: fight through whatever stands closest
    const blocker = nearestEnemy(state, unit);
    if (blocker) {
      const engageMove = moveToEngage(state, unit, blocker);
      if (engageMove) return engageMove;
    }
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
      const huntMove = moveToEngage(state, unit, nearbyEnemy);
      if (huntMove) return huntMove;
    }

    const attackMove = moveToward(state, unit, playerBase.coordinates);
    if (attackMove) return attackMove;
  }

  // Otherwise make a random move for variety, keeping clear of the deployment hexes
  const targets = getValidMoveTargets(state, unit).filter(target => !isNextToCastle(target));
  if (targets.length > 0 && (isNextToCastle(unit.position) || Math.random() >= 0.3)) {
    return targets[Math.floor(Math.random() * targets.length)];
  }
  return null;
};

const nearestEnemy = (state: GameState, unit: Unit): Unit | undefined =>
  state.players.player.units.reduce<Unit | undefined>((nearest, enemy) =>
    !nearest || getHexDistance(unit.position, enemy.position) < getHexDistance(unit.position, nearest.position)
      ? enemy
      : nearest,
  undefined);
