import {
  GameState,
  Player,
  Unit,
  UnitType,
  Hex,
  HexCoordinates,
  TerrainType
} from '@/types/game';
import {
  getHexDistance,
  findHexByCoordinates,
  getHexesInRange
} from '../game/hexUtils';
import {
  UNITS,
  BASE_ATTACK_RANGE,
  TERRAIN_EFFECTS,
  addPendingMove,
  addPendingPurchase,
  getAttackRange,
  getUnitAttackRange,
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

// Enemy units this close to the AI castle make it recruit at home when the castle is unguarded
const CASTLE_WATCH_RANGE = 5;

// Wounded units detour to a healing spring at most this many turns of walking away
const MAX_SPRING_DETOUR_TURNS = 2;
// While pushing, only badly wounded units (below this share of their health) stop to heal
const PUSH_HEAL_THRESHOLD = 0.5;

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
  const campAssignments = assignCampCapturers(state);
  // Camps nobody is on the way to yet: worth recruiting a fast unit for
  const campsWithoutCapturer = { count: findCampTargets(state).length - campAssignments.size };

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
      resourceOpportunities,
      campAssignments.get(unit.id)
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
      resourceOpportunities,
      campsWithoutCapturer
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
  // Enemy units that could walk onto the castle (and win) on their next turn,
  // or are already close enough to lay siege to it
  castleRaiders: Unit[];
}

const assessThreats = (state: GameState, aiPlayer: Player): ThreatAssessment => {
  const aiBase = findBaseHex(state, 'ai');
  if (!aiBase) {
    return {
      baseUnderThreat: false,
      threatenedUnits: [],
      enemyStrengthNearBase: 0,
      castleRaiders: []
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

  const castleRaiders = state.players.player.units.filter(enemy =>
    walkingDistance(state, enemy.position, aiBase.coordinates) <= enemy.movementRange ||
    getHexDistance(enemy.position, aiBase.coordinates) <= BASE_ATTACK_RANGE
  );

  // Base is under threat if strong enemy units are nearby or one could storm or besiege it
  const baseUnderThreat =
    enemyStrengthNearBase > 5 || // Arbitrary threshold
    enemyUnitsNearBase.length >= 2 ||
    castleRaiders.length > 0;

  return {
    baseUnderThreat,
    threatenedUnits,
    enemyStrengthNearBase,
    castleRaiders
  };
};

// Player units that could strike a hex without moving, given their reach where they stand
// (archers on hills reach further)
const enemiesInReachOf = (state: GameState, position: HexCoordinates): Unit[] =>
  state.players.player.units.filter(enemy =>
    getHexDistance(enemy.position, position) <= getUnitAttackRange(state, enemy)
  );

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

const terrainAt = (state: GameState, position: HexCoordinates): TerrainType =>
  findHexByCoordinates(state.hexGrid, position)?.terrain ?? 'plain';

// A swamp hex the enemy can already strike: units there take extra damage
const isExposedSwamp = (state: GameState, position: HexCoordinates): boolean =>
  TERRAIN_EFFECTS[terrainAt(state, position)].damageTakenMultiplier > 1 &&
  enemiesInReachOf(state, position).length > 0;

// How good a hex is to fight from for a unit (lower is better): high ground and forest cover
// help (Pikemen doubly so in forest), being bogged down in a swamp within enemy reach hurts
const terrainPenalty = (state: GameState, unit: Unit, position: HexCoordinates): number => {
  const terrain = terrainAt(state, position);
  const effect = TERRAIN_EFFECTS[terrain];
  let penalty = ((effect.damageTakenMultiplier - 1) - ((effect.damageDealtMultiplier ?? 1) - 1)) * 4;
  if (unit.abilities.includes('terrainBonus') && terrain === 'forest') penalty -= 1;
  if (isExposedSwamp(state, position)) penalty += 3;
  return penalty;
};

// Whether any player unit could walk onto a hex on its next turn
const enemyCanReach = (state: GameState, position: HexCoordinates): boolean =>
  state.players.player.units.some(enemy =>
    getHexDistance(enemy.position, position) === 1 ||
    walkingDistance(state, enemy.position, position) <= enemy.movementRange
  );

/**
 * Camps the AI doesn't hold: neutral ones, and its own camps the player has seized
 */
const findCampTargets = (state: GameState): Hex[] =>
  state.hexGrid.filter(hex => hex.isCamp && hex.owner !== 'ai');

/**
 * Send the nearest free unit (in turns of walking) to each camp the AI doesn't hold.
 * Units guarding gold mines or camps stay where they are.
 */
const assignCampCapturers = (state: GameState): Map<string, Hex> => {
  const assignments = new Map<string, Hex>();

  for (const camp of findCampTargets(state)) {
    let best: Unit | undefined;
    let bestTurns = Infinity;
    for (const unit of state.players.ai.units) {
      if (unit.hasMoved || assignments.has(unit.id)) continue;
      const hex = findHexByCoordinates(state.hexGrid, unit.position);
      if (hex?.isResourceHex || hex?.isCamp) continue;

      const turns = walkingDistance(state, unit.position, camp.coordinates) / unit.movementRange;
      if (turns < bestTurns) {
        bestTurns = turns;
        best = unit;
      }
    }
    if (best) assignments.set(best.id, camp);
  }

  return assignments;
};

/**
 * A free healing spring within a short walk of the unit where it wouldn't be cut down, if any
 */
const findNearbySpring = (state: GameState, unit: Unit): Hex | undefined => {
  const reserved = state.pendingMoves.map(m => m.to);
  let best: Hex | undefined;
  let bestTurns = MAX_SPRING_DETOUR_TURNS;

  for (const hex of state.hexGrid) {
    if (!TERRAIN_EFFECTS[hex.terrain].healPerTurn || hex.unit) continue;
    if (reserved.some(c => coordsMatch(c, hex.coordinates))) continue;
    if (enemyStrengthAt(state, hex.coordinates) * coverMultiplier(state, hex.coordinates) >= unit.lifespan) continue;

    const turns = walkingDistance(state, unit.position, hex.coordinates) / unit.movementRange;
    if (turns <= bestTurns) {
      bestTurns = turns;
      best = hex;
    }
  }

  return best;
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
  resourceOpportunities: Hex[],
  campsWithoutCapturer: { count: number }
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
  } else if (campsWithoutCapturer.count > 0 && canAfford('helicopter')) {
    // A camp nobody is heading for: Knights get there first
    desiredUnitType = 'helicopter';
    campsWithoutCapturer.count--;
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

  const position = chooseDeploymentHex(state, desiredUnitType, threatAssessment);
  return position ? { unitType: desiredUnitType, position } : null;
};

/**
 * Where to deploy a recruit: next to the castle or at a camp the AI holds, whichever is closer
 * to the enemy castle. When the castle is threatened and unguarded, recruits appear at home.
 * Archers aren't dropped next to enemies, nobody is dropped into a swamp under fire, and a
 * recruit on the camp hex itself keeps the enemy from walking in to take it.
 */
const chooseDeploymentHex = (
  state: GameState,
  unitType: UnitType,
  threatAssessment: ThreatAssessment
): HexCoordinates | null => {
  const aiBase = findBaseHex(state, 'ai');
  const playerBase = findBaseHex(state, 'player');
  const hexes = getDeploymentHexes(state, 'ai');
  if (!aiBase || !playerBase || hexes.length === 0) return null;

  const isCastleSpot = (hex: Hex) => getHexDistance(hex.coordinates, aiBase.coordinates) === 1;
  const nearestThreat = nearestTo(threatAssessment.castleRaiders, aiBase.coordinates) ?? state.players.player.units
    .filter(enemy => getHexDistance(enemy.position, aiBase.coordinates) <= CASTLE_WATCH_RANGE)
    .sort((a, b) => getHexDistance(a.position, aiBase.coordinates) - getHexDistance(b.position, aiBase.coordinates))[0];
  const isGuarded = state.players.ai.units.some(unit => getHexDistance(unit.position, aiBase.coordinates) <= 2);
  const defendHome = (threatAssessment.baseUnderThreat || (nearestThreat && !isGuarded)) && hexes.some(isCastleSpot);

  const candidates = defendHome ? hexes.filter(isCastleSpot) : hexes;
  const goal = defendHome && nearestThreat ? nearestThreat.position : playerBase.coordinates;
  const isArcher = UNITS[unitType].abilities.includes('rangedAttack');

  const score = (hex: Hex) =>
    walkingDistance(state, hex.coordinates, goal) +
    (isArcher && isAdjacentToEnemy(state, hex.coordinates) ? 6 : 0) +
    (isExposedSwamp(state, hex.coordinates) ? 4 : 0) +
    (hex.isCamp && enemyCanReach(state, hex.coordinates) ? -2 : 0);

  let best: Hex | null = null;
  let bestScore = Infinity;
  for (const hex of candidates) {
    const hexScore = score(hex);
    // Break ties randomly so recruits don't always appear in the same spot
    if (hexScore < bestScore || (hexScore === bestScore && Math.random() < 0.5)) {
      bestScore = hexScore;
      best = hex;
    }
  }

  return best?.coordinates ?? null;
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
 * nobody stops in a swamp the enemy can strike, and `avoid` can rule out further hexes.
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
    if (!coordsMatch(target, goal)) {
      if (isRanged(unit) && isAdjacentToEnemy(state, target)) continue;
      if (isExposedSwamp(state, target)) continue;
    }
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
 * Move into position to strike an enemy unit. Melee units close in; archers aim for a hex within
 * their reach (3 from hills) but outside the target's, so it can't hit back. Among such hexes the
 * unit prefers ones few enemies can reach and good ground: hills and forest, never a swamp under fire.
 * Returns null if the unit is already as well placed as it can get this turn.
 */
const moveToEngage = (state: GameState, unit: Unit, enemy: Unit): HexCoordinates | null => {
  const enemyReach = getUnitAttackRange(state, enemy);
  // Lower is better: being in reach comes first, then not being hit back, exposure and terrain
  const score = (position: HexCoordinates) => {
    const distance = getHexDistance(position, enemy.position);
    const reach = getAttackRange(unit, terrainAt(state, position));
    const outOfReach = Math.max(0, distance - reach);
    const hitBack = isRanged(unit) && distance <= enemyReach ? 1 : 0;
    return outOfReach * 10 + hitBack * 5 + enemiesInReachOf(state, position).length +
      terrainPenalty(state, unit, position);
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
  if (!best && getHexDistance(unit.position, enemy.position) > getUnitAttackRange(state, unit)) {
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
  resourceOpportunities: Hex[],
  campGoal?: Hex
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

  const standingOn = findHexByCoordinates(state.hexGrid, unit.position);
  const isWounded = unit.lifespan < unit.maxLifespan;
  const wantsToHeal = isPushing ? healthRatio < PUSH_HEAL_THRESHOLD : isWounded;

  if (!isPushing && unitThreat && (unitThreat.threatLevel > 1 || healthRatio < settings.retreatThreshold)) {
    // Fall back to a nearby healing spring if there is a safe one, otherwise towards the castle
    const spring = findNearbySpring(state, unit);
    const retreat = (spring ? moveToward(state, unit, spring.coordinates) : null) ??
      moveToward(state, unit, aiBase.coordinates, isNextToCastle) ??
      (getHexDistance(unit.position, aiBase.coordinates) > 2 ? moveAwayFromEnemies(state, unit) : null);
    if (retreat) return retreat;
  }

  // If base is under threat and this unit is nearby, defend the base. An enemy that could storm
  // or besiege the castle is always met by every unit close enough to strike it.
  const raider = nearestTo(threatAssessment.castleRaiders, unit.position);
  if (raider && getHexDistance(unit.position, raider.position) <= unit.movementRange + getAttackRange(unit)) {
    const interceptMove = moveToEngage(state, unit, raider);
    if (interceptMove) return interceptMove;
    if (getHexDistance(unit.position, raider.position) <= getUnitAttackRange(state, unit)) return null;
  }

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

  // Wounded units rest on a healing spring until they're back to full health,
  // and detour to one if it's close by
  if (wantsToHeal && standingOn && TERRAIN_EFFECTS[standingOn.terrain].healPerTurn) return null;
  if (wantsToHeal && unit.maxLifespan - unit.lifespan >= (isPushing ? 1 : 2)) {
    const spring = findNearbySpring(state, unit);
    const springMove = spring && moveToward(state, unit, spring.coordinates);
    if (springMove) return springMove;
  }

  // Take (or retake) the camp this unit was sent to: walk onto it, or attack whoever holds it
  if (campGoal) {
    const occupant = findHexByCoordinates(state.hexGrid, campGoal.coordinates)?.unit;
    const campMove = occupant && occupant.owner === 'player'
      ? moveToEngage(state, unit, occupant)
      : moveToward(state, unit, campGoal.coordinates);
    if (campMove) return campMove;
  }

  // Hold a camp while the enemy could otherwise walk in and take it next turn
  if (standingOn?.isCamp && standingOn.owner === 'ai' && enemyCanReach(state, unit.position)) return null;

  // Hold gold mines: a unit standing on one stays put (it still fights any enemy in its reach)
  // unless it has to retreat or defend the castle, or the AI is making its late-game all-out push
  const isOnMine = !!standingOn?.isResourceHex;
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
      .filter(enemy => getHexDistance(unit.position, enemy.position) <= unit.movementRange + getAttackRange(unit))
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

const nearestTo = (units: Unit[], position: HexCoordinates): Unit | undefined =>
  units.reduce<Unit | undefined>((nearest, other) =>
    !nearest || getHexDistance(position, other.position) < getHexDistance(position, nearest.position)
      ? other
      : nearest,
  undefined);

const nearestEnemy = (state: GameState, unit: Unit): Unit | undefined =>
  nearestTo(state.players.player.units, unit.position);
