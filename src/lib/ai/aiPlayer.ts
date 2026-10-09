import { getBossPower } from '@/lib/game/bosses';
import { getHexHeightOf } from '../game/hexHeight';
import {
  GameState,
  Player,
  PlayerType,
  Unit,
  UnitType,
  Hex,
  HexCoordinates,
  TerrainType,
  TroopStats
} from '@/types/game';
import {
  getHexDistance,
  getHexesInRange
} from '../game/hexUtils';
import {
  TERRAIN_EFFECTS,
  CAMP_INCOME,
  FREE_UPKEEP_UNITS,
  UPKEEP_PER_UNIT,
  HEALER_HEAL_AMOUNT,
  FLANK_BONUS,
  MAX_FLANKERS,
  addPendingMove,
  addPendingPurchase,
  getAttackRange,
  getDeploymentHexes,
  getValidMoveTargets,
  getTerrainDistanceMap,
  getCounterMultiplier,
  getStrikePowerOnTerrain,
  getIncome,
  getKillBounty,
  hasLineOfSight,
  getHand,
  getMaxRounds,
  getRosterStats,
  getRosterTypes,
  findBaseHex,
  getSideView,
  getSiegeDamage,
  getTimeScore,
  getSituationalMultiplier,
  getFormationMultiplier,
  getDamageTakenMultiplier,
  getFellLanding,
  getFellTargets,
  getActionTargets,
  isImpassable
} from '../game/gameState';
import { FELL_DAMAGE, FIRE_DAMAGE } from '../game/battlefield';
import { CATAPULT_DAMAGE, TAVERN_INCOME } from '../game/structures';
import { TroopClass, getTroopClass } from '../game/troops';

/**
 * AI difficulty settings affecting various strategic parameters
 */
interface AIDifficultySettings {
  attackAggressiveness: number; // 0-1, how readily units take risky fights
  defensePreference: number;   // 0-1, how much to prioritize defending base
  resourceFocus: number;       // 0-1, how much to focus on capturing resources
  unitDiversityDesire: number; // 0-1, how closely recruiting follows counters to the enemy army
  retreatThreshold: number;    // 0-1, health % at which to retreat
  // Chance that a unit settles for a decent move instead of the best one
  sloppiness: number;
}

const DIFFICULTY_SETTINGS: Record<'easy' | 'medium' | 'hard', AIDifficultySettings> = {
  easy: {
    attackAggressiveness: 0.3,
    defensePreference: 0.7,
    resourceFocus: 0.4,
    unitDiversityDesire: 0.3,
    retreatThreshold: 0.7,
    sloppiness: 0.35
  },
  medium: {
    attackAggressiveness: 0.5,
    defensePreference: 0.5,
    resourceFocus: 0.6,
    unitDiversityDesire: 0.6,
    retreatThreshold: 0.5,
    sloppiness: 0.1
  },
  hard: {
    attackAggressiveness: 0.8,
    defensePreference: 0.4,
    resourceFocus: 0.7,
    unitDiversityDesire: 0.8,
    retreatThreshold: 0.3,
    sloppiness: 0
  }
};

/**
 * Doctrines: the overall strategy an AI army follows. The game always plays 'balanced'; the
 * others exist so AI-vs-AI simulations can check that no single strategy beats all the rest.
 */
export type AIDoctrine = 'balanced' | 'archerHill' | 'knightRush' | 'pikeWall' | 'rogueRaid' | 'mageSupport';

export const AI_DOCTRINES: AIDoctrine[] = ['balanced', 'archerHill', 'knightRush', 'pikeWall', 'rogueRaid', 'mageSupport'];

interface DoctrineProfile {
  // Relative share of each class of troop in the army (classes left out get a small share, so
  // a roster without the doctrine's favourites still fields an army)
  mix: Partial<Record<TroopClass, number>>;
  // How strongly recruiting shifts towards counters of the enemy army (0 keeps to the mix)
  counterBias: number;
  // What units do when nothing more urgent is going on:
  // advance on the enemy, hold strong ground on their own half, or raid the enemy's soft targets
  posture: 'advance' | 'hold' | 'raid';
  // Which ground 'hold' armies dig in on
  anchor?: 'highGround' | 'choke';
  // How much a unit cares about the damage it could take next turn, relative to damage it deals
  caution: number;
  // All-out attack on the enemy castle from this round, or with this many more units than the enemy
  pushAfterRound: number;
  pushUnitAdvantage: number;
  // Stop recruiting once upkeep would cut net income below this (unless losing)
  minNetIncome: number;
}

const DOCTRINES: Record<AIDoctrine, DoctrineProfile> = {
  balanced: {
    mix: { infantry: 2, spear: 2, ranged: 2, cavalry: 1.5, skirmisher: 1, magic: 1, brute: 1.5 },
    counterBias: 1,
    posture: 'advance',
    caution: 0.8,
    pushAfterRound: 25,
    pushUnitAdvantage: 2,
    minNetIncome: 3
  },
  archerHill: {
    mix: { ranged: 4, spear: 1.5, infantry: 1.5, cavalry: 0.5, skirmisher: 0.5, magic: 0.5, brute: 1 },
    counterBias: 0.8,
    posture: 'hold',
    anchor: 'highGround',
    caution: 1,
    pushAfterRound: 30,
    pushUnitAdvantage: 3,
    minNetIncome: 2
  },
  knightRush: {
    mix: { cavalry: 4, infantry: 1.5, spear: 0.5, ranged: 0.5, skirmisher: 0.5, magic: 0.5, brute: 0.5 },
    counterBias: 0.8,
    posture: 'raid',
    caution: 0.5,
    pushAfterRound: 15,
    pushUnitAdvantage: 1,
    minNetIncome: 1
  },
  pikeWall: {
    mix: { spear: 3, infantry: 2.5, ranged: 1, cavalry: 0.5, skirmisher: 0.5, magic: 0.5, brute: 1.5 },
    counterBias: 0.8,
    posture: 'hold',
    anchor: 'choke',
    caution: 0.9,
    pushAfterRound: 25,
    pushUnitAdvantage: 2,
    minNetIncome: 2
  },
  rogueRaid: {
    mix: { skirmisher: 4, cavalry: 1.5, infantry: 1, spear: 0.5, ranged: 0.5, magic: 0.5, brute: 0.5 },
    counterBias: 0.8,
    posture: 'raid',
    caution: 0.6,
    pushAfterRound: 20,
    pushUnitAdvantage: 2,
    minNetIncome: 2
  },
  mageSupport: {
    mix: { magic: 3, infantry: 3, spear: 0.5, ranged: 0.5, cavalry: 0.5, skirmisher: 0.5, brute: 0.5 },
    counterBias: 0.8,
    posture: 'advance',
    caution: 0.8,
    pushAfterRound: 18,
    pushUnitAdvantage: 2,
    minNetIncome: 2
  }
};

export interface AIPlanOptions {
  // Which side to plan for (the game only ever plans for 'ai'; simulations may use either)
  side?: PlayerType;
  doctrine?: AIDoctrine;
  // Skill to play at instead of the battle's own setting (simulations play the player's side with it)
  difficulty?: 'easy' | 'medium' | 'hard';
  // How much more (or less) than its doctrine's usual the side fears losing troops
  caution?: number;
  // Filled in with what each unit set out to do this turn
  intents?: Map<string, GoalKind>;
}

// Share of the army given to a class of troop the doctrine doesn't mention
const UNLISTED_CLASS_SHARE = 0.75;
// Order units move in: ranged troops and skirmishers pick their shots first, healers last so they
// know where their friends will be
const MOVE_ORDER: TroopClass[] = ['ranged', 'skirmisher', 'cavalry', 'spear', 'brute', 'infantry', 'magic'];
// Bosses guard the castle and only join the final push from this round on, relative to the round limit
const PUSH_ROUND_SHARE = 0.45;

// Most units the AI recruits in a single turn
const MAX_PURCHASES_PER_TURN = 3;

// Enemy units this close to the AI castle make it recruit at home when the castle is unguarded
const CASTLE_WATCH_RANGE = 5;

// Wounded units detour to a healing spring at most this many turns of walking away
const MAX_SPRING_DETOUR_TURNS = 2;
// While pushing, only badly wounded units (below this share of their health) stop to heal
const PUSH_HEAL_THRESHOLD = 0.5;

// Armies that dig in hold ground (and go for mines and camps) up to this many hexes of walking
// past the middle of the map, ideally around this share of the way from the enemy castle to theirs
const HOLD_REACH = 3;
const HOLD_LINE = 0.5;

// How much (in gold) a turn of progress towards a unit's goal is worth, by kind of goal
const GOAL_WEIGHT = { urgent: 6, objective: 4, march: 3, station: 2.5 } as const;
// Value of each point of damage a unit could deal the enemy castle from where it ends its move
const SIEGE_VALUE = { normal: 2, pushing: 3 } as const;

const getDifficultySettings = (state: GameState, difficulty = state.settings?.aiDifficulty): AIDifficultySettings =>
  DIFFICULTY_SETTINGS[difficulty ?? 'medium'] ?? DIFFICULTY_SETTINGS.medium;

const key = (c: HexCoordinates) => `${c.q},${c.r}`;
const coordsMatch = (a: HexCoordinates, b: HexCoordinates) => a.q === b.q && a.r === b.r;

// ---------------------------------------------------------------------------
// Planning for either side
// ---------------------------------------------------------------------------

const flipSide = <T extends PlayerType | undefined>(side: T): T =>
  (side === 'player' ? 'ai' : side === 'ai' ? 'player' : side) as T;

// The same game seen from the other side: players, unit owners, castles and camps swap sides,
// so the planner (which always plays 'ai') can plan for the player's side in simulations
const mirrorSides = (state: GameState): GameState => {
  const flipUnit = (unit: Unit): Unit => ({ ...unit, owner: flipSide(unit.owner) });
  const flipPlayer = (player: Player): Player => ({
    ...player,
    type: flipSide(player.type),
    units: player.units.map(flipUnit)
  });
  const players = { player: flipPlayer(state.players.ai), ai: flipPlayer(state.players.player) };
  const unitsById = new Map([...players.player.units, ...players.ai.units].map(unit => [unit.id, unit]));

  return {
    ...state,
    players,
    activePlayer: flipSide(state.activePlayer),
    winner: flipSide(state.winner),
    rosters: state.rosters && { player: state.rosters.ai, ai: state.rosters.player },
    battleStats: state.battleStats && { player: state.battleStats.ai, ai: state.battleStats.player },
    // The deck only limits the real player's recruits; the planner is told which cards it holds instead
    deck: undefined,
    // A campaign enemy's income bonus doesn't belong to the side being planned for
    settings: state.settings && { ...state.settings, aiIncomeBonus: 0 },
    hexGrid: state.hexGrid.map(hex => ({
      ...hex,
      owner: flipSide(hex.owner),
      unit: hex.unit && unitsById.get(hex.unit.id)
    }))
  };
};

/**
 * Plan the AI's turn: queue moves for its units, then purchases.
 * Returns the game state with the side's pending purchases and moves added.
 * The game calls this with no options (the 'ai' side, balanced doctrine).
 */
export const planAITurn = (initial: GameState, options: AIPlanOptions = {}): GameState => {
  const doctrine = options.doctrine ?? 'balanced';
  const side = options.side ?? 'ai';
  const state = initial;
  // In the fog of war the planner only knows about the enemy troops its side can see, and remembers
  // where it last saw the others
  const view = getSideView(state, side, true);
  if (side === 'ai') {
    const planned = planTurn(view, doctrine, getRosterTypes(state, 'ai'), options.difficulty, options);
    if (view === state) return planned;
    // Carry the orders (and the gold they cost) back onto the real board
    return {
      ...state,
      pendingMoves: planned.pendingMoves,
      pendingPurchases: planned.pendingPurchases,
      players: { ...state.players, ai: { ...state.players.ai, points: planned.players.ai.points } }
    };
  }

  // Plan the player's side by swapping sides (a player with a deck may only play the cards in hand),
  // then give the same orders on the real board so gold, the deck and every rule apply as normal
  const planned = planTurn(mirrorSides(view), doctrine, getHand(state), options.difficulty, options);
  let result = state;
  for (const move of planned.pendingMoves) {
    result = addPendingMove(result, move.unitId, state.players.player.id, move.to);
  }
  for (const purchase of planned.pendingPurchases) {
    result = addPendingPurchase(result, state.players.player.id, purchase.unitType, purchase.position);
  }
  return result;
};

// ---------------------------------------------------------------------------
// The planner (always plays the 'ai' side)
// ---------------------------------------------------------------------------

interface Planner {
  // The state with this turn's orders queued so far
  state: GameState;
  // Troop types this side may recruit this turn
  recruitTypes: UnitType[];
  doctrine: AIDoctrine;
  profile: DoctrineProfile;
  settings: AIDifficultySettings;
  hexes: Map<string, Hex>;
  myBase: Hex;
  enemyBase: Hex;
  enemies: Unit[];
  threat: ThreatAssessment;
  isPushing: boolean;
  // Expected damage on enemy units from the orders given so far this turn
  plannedDamage: Map<string, number>;
  // How many of the AI's units are set to attack each enemy (joining them flanks it)
  plannedAttackers: Map<string, number>;
  // Where each of the AI's units will stand once its orders are carried out
  destinations: Map<string, HexCoordinates>;
  // Camps and gold mines units have been sent to take
  objectives: Map<string, Hex>;
  anchors: Map<string, HexCoordinates>;
  // Units sent to stop enemies raiding the castle, and the raider each one is after
  interceptors: Map<string, Unit>;
  // In the last rounds: whether the AI is behind or ahead on the points that decide the battle if
  // time runs out (null before then, or level)
  endgame: 'behind' | 'ahead' | null;
  // What each unit set out to do this turn (filled in as their moves are decided)
  intents: Map<string, GoalKind>;
}

const planTurn = (
  state: GameState, doctrine: AIDoctrine, recruitTypes: UnitType[], difficulty?: AIPlanOptions['difficulty'],
  options: Pick<AIPlanOptions, 'caution' | 'intents'> = {}
): GameState => {
  const enemyBase = findBaseHex(state, 'player');
  const myBase = findBaseHex(state, 'ai');
  if (!myBase || !enemyBase) return state;

  const profile = { ...DOCTRINES[doctrine], caution: DOCTRINES[doctrine].caution * (options.caution ?? 1) };
  const planner: Planner = {
    state,
    recruitTypes,
    doctrine,
    profile,
    settings: getDifficultySettings(state, difficulty),
    hexes: new Map(state.hexGrid.map(hex => [key(hex.coordinates), hex])),
    myBase,
    enemyBase,
    enemies: state.players.player.units,
    threat: assessThreats(state),
    isPushing: false,
    plannedDamage: new Map(),
    plannedAttackers: new Map(),
    destinations: new Map(state.players.ai.units.map(unit => [unit.id, unit.position])),
    objectives: new Map(),
    anchors: new Map(),
    interceptors: new Map(),
    endgame: endgameStanding(state),
    intents: options.intents ?? new Map()
  };
  planner.isPushing = isPushing(planner);
  planner.interceptors = assignInterceptors(planner);
  planner.objectives = assignObjectives(planner);
  if (profile.posture === 'hold' && !planner.isPushing) planner.anchors = assignAnchors(planner);

  // Camps nobody is on the way to yet: worth recruiting a fast unit for
  const takenCamps = [...planner.objectives.values()].filter(hex => hex.isCamp).length;
  const campsWithoutCapturer = { count: findCampTargets(state).length - takenCamps };

  // Troops next to a great tree that would fall on an enemy chop it down (they stay put, and still
  // strike whatever is in reach)
  planFelling(planner);
  const felling = new Set(planner.state.pendingMoves.map(move => move.unitId));

  // Move existing units first (hexes next to the castle they leave can then take recruits)
  const units = [...state.players.ai.units]
    .filter(unit => !unit.hasMoved && !felling.has(unit.id))
    .sort((a, b) => MOVE_ORDER.indexOf(getTroopClass(a.type)) - MOVE_ORDER.indexOf(getTroopClass(b.type)));

  // Fresh recruits can't move but still strike whatever is in reach
  for (const unit of state.players.ai.units) {
    if (unit.hasMoved) recordPlannedAttack(planner, unit, unit.position);
  }
  for (const unit of units) {
    const target = decideUnitMove(planner, unit);
    const next = target ? addPendingMove(planner.state, unit.id, state.players.ai.id, target) : planner.state;
    if (target && next !== planner.state) {
      planner.state = next;
      planner.destinations.set(unit.id, target);
    }
    recordPlannedAttack(planner, unit, planner.destinations.get(unit.id)!);
  }

  // Troops left without orders put their tools to work
  planWork(planner);

  // Then spend gold on reinforcements - several per turn when the treasury and upkeep allow
  for (let i = 0; i < MAX_PURCHASES_PER_TURN; i++) {
    const purchase = decidePurchase(planner, campsWithoutCapturer);
    if (!purchase) break;

    const afterPurchase = addPendingPurchase(planner.state, state.players.ai.id, purchase.unitType, purchase.position);
    if (afterPurchase === planner.state) break;
    planner.state = afterPurchase;
  }

  return planner.state;
};

// Great trees: a troop chops down a tree next to it when the tree would fall on an enemy it can see
// (and not on one of its own), the bigger the blow the better
const planFelling = (planner: Planner): void => {
  const side = planner.state.players.ai;
  const ordered = new Set(planner.state.pendingMoves.map(move => move.unitId));
  const taken = new Set<string>();
  const ownAt = new Set([...planner.destinations.values()].map(key));
  for (const unit of side.units) {
    if (ordered.has(unit.id) || unit.hasMoved) continue;
    let best: { tree: HexCoordinates; value: number } | null = null;
    for (const tree of getFellTargets(planner.state, unit)) {
      if (taken.has(key(tree))) continue;
      const landing = getFellLanding(planner.state, unit.position, tree);
      if (!landing || ownAt.has(key(landing))) continue;
      const victim = planner.enemies.find(enemy => coordsMatch(enemy.position, landing));
      if (!victim) continue;
      const value = healthValue(victim, FELL_DAMAGE);
      if (!best || value > best.value) best = { tree, value };
    }
    if (!best) continue;
    const next = addPendingMove(planner.state, unit.id, side.id, best.tree);
    if (next === planner.state) continue;
    planner.state = next;
    taken.add(key(best.tree));
  }
};

// Work for troops with nothing else to do this turn: Sappers tear down a gate the enemy holds, and
// Rogues set alight the dry ground an enemy stands on (when none of the AI's own troops are near it)
const planWork = (planner: Planner): void => {
  const side = planner.state.players.ai;
  const ordered = new Set(planner.state.pendingMoves.map(move => move.unitId));
  const ownNear = (at: HexCoordinates) => [...planner.destinations.values()].some(position => getHexDistance(position, at) <= 1);
  for (const unit of side.units) {
    if (ordered.has(unit.id) || unit.hasMoved) continue;
    const pick = getActionTargets(planner.state, unit).find(({ at, action }) => {
      const hex = planner.hexes.get(key(at));
      if (action === 'demolish') return hex?.terrain === 'gate' && hex.owner === 'player';
      if (action === 'ignite') return planner.enemies.some(enemy => coordsMatch(enemy.position, at)) && !ownNear(at);
      return false;
    });
    if (!pick) continue;
    const next = addPendingMove(planner.state, unit.id, side.id, pick.at, pick.action);
    if (next !== planner.state) planner.state = next;
  }
};

// In the last rounds, how the AI stands on the points that decide the battle when time runs out
const ENDGAME_ROUNDS = 3;
const endgameStanding = (state: GameState): Planner['endgame'] => {
  if (state.turnNumber <= getMaxRounds(state) - ENDGAME_ROUNDS) return null;
  const lead = getTimeScore(state, 'ai').total - getTimeScore(state, 'player').total;
  return lead > 0 ? 'ahead' : lead < 0 ? 'behind' : null;
};
// Behind on points: fight harder for kills. Ahead: keep troops safe to hold the lead.
const ENDGAME_ATTACK_BOOST = 1.4;
const ENDGAME_CAUTION_BOOST = 1.6;

// The AI goes all in on the enemy castle once the battle nears its round limit (or the doctrine's
// own push round), or when it clearly has the bigger army - unless it is ahead on points near the
// end, when it holds what it has
const isPushing = (planner: Planner): boolean => {
  const { state, profile } = planner;
  if (planner.endgame === 'ahead') return false;
  const mine = state.players.ai.units;
  const theirs = state.players.player.units;
  const pushRound = Math.min(profile.pushAfterRound, Math.ceil(getMaxRounds(state) * PUSH_ROUND_SHARE));
  return state.turnNumber >= pushRound ||
    (mine.length >= theirs.length + profile.pushUnitAdvantage && armyValue(mine) >= armyValue(theirs) * 1.3);
};

// Gold value of an army, counting wounded units at their remaining health
const armyValue = (units: Unit[]) =>
  units.reduce((sum, unit) => sum + unit.cost * unit.lifespan / unit.maxLifespan, 0);

// ---------------------------------------------------------------------------
// Threats
// ---------------------------------------------------------------------------

/**
 * Threats to the AI's base
 */
interface ThreatAssessment {
  baseUnderThreat: boolean;
  enemyStrengthNearBase: number;
  // Enemy units close enough to lay siege to the castle on their next turn
  castleRaiders: Unit[];
}

const assessThreats = (state: GameState): ThreatAssessment => {
  const aiBase = findBaseHex(state, 'ai');
  if (!aiBase) return { baseUnderThreat: false, enemyStrengthNearBase: 0, castleRaiders: [] };

  // Check for enemies near the base
  const baseProximityRange = 3; // Consider threats within 3 hexes of base
  const enemyUnitsNearBase = getHexesInRange(state.hexGrid, aiBase.coordinates, baseProximityRange)
    .filter(hex => hex.unit && hex.unit.owner === 'player')
    .map(hex => hex.unit as Unit);
  const enemyStrengthNearBase = enemyUnitsNearBase.reduce((sum, unit) => sum + unit.attackPower, 0);

  // Enemies that could reach a hex they could attack the castle from next turn
  const castleRaiders = state.players.player.units.filter(enemy =>
    getHexDistance(enemy.position, aiBase.coordinates) <= getAttackRange(enemy) + 1
  );

  // Base is under threat if strong enemy units are nearby or one could besiege it
  const baseUnderThreat =
    enemyStrengthNearBase > 10 || // Arbitrary threshold
    enemyUnitsNearBase.length >= 2 ||
    castleRaiders.length > 0;

  return { baseUnderThreat, enemyStrengthNearBase, castleRaiders };
};

const terrainAt = (planner: Planner, position: HexCoordinates): TerrainType =>
  planner.hexes.get(key(position))?.terrain ?? 'plain';

const isRanged = (unit: Unit) => getAttackRange(unit) > 1;

// Whether `attacker` standing at `from` could strike a target standing at `at`
const canStrikeFrom = (planner: Planner, attacker: Unit, from: HexCoordinates, at: HexCoordinates): boolean => {
  const distance = getHexDistance(from, at);
  if (distance > getAttackRange(attacker, terrainAt(planner, from))) return false;
  if (distance <= 1) return true;
  return attacker.abilities.includes('magic') || hasLineOfSight(planner.state.hexGrid, from, at);
};

const heightAt = (planner: Planner, position: HexCoordinates) =>
  getHexHeightOf(planner.hexes.get(key(position)) ?? { coordinates: position, terrain: 'plain' });

// A strike from one hex on a target at another, with the attacker's signature bonuses as they would
// be there (having walked from where it stands) and whatever shields the target
const strikeFrom = (planner: Planner, attacker: Unit, from: HexCoordinates, target: Unit, at: HexCoordinates) =>
  getStrikePowerOnTerrain(attacker, terrainAt(planner, from), target, terrainAt(planner, at), getHexDistance(from, at),
    heightAt(planner, from) - heightAt(planner, at)) *
  getSituationalMultiplier(planner.state, attacker, from, getHexDistance(attacker.position, from)) *
  getDamageTakenMultiplier(planner.state, target, at) *
  getFormationMultiplier(planner.state, attacker, target, from, at);

const remainingHealth = (planner: Planner, enemy: Unit) =>
  enemy.lifespan - (planner.plannedDamage.get(enemy.id) ?? 0);

// Enemy units still standing once this turn's planned attacks land
const liveEnemies = (planner: Planner) => planner.enemies.filter(enemy => remainingHealth(planner, enemy) > 0);

/**
 * Damage a unit standing at `position` could take on the enemy's next turn: from enemies that can
 * already strike that hex, and (a little less surely) from enemies that could walk into reach,
 * who would then usually be fighting from ordinary ground
 */
const dangerAt = (planner: Planner, unit: Unit, position: HexCoordinates): number => {
  const target = { ...unit, position };
  let danger = 0;
  for (const enemy of liveEnemies(planner)) {
    const distance = getHexDistance(enemy.position, position);
    if (canStrikeFrom(planner, enemy, enemy.position, position)) {
      danger += strikeFrom(planner, enemy, enemy.position, target, position);
    } else if (distance <= enemy.movementRange + getAttackRange(enemy)) {
      danger += 0.75 * getStrikePowerOnTerrain(enemy, 'plain', target, terrainAt(planner, position), getAttackRange(enemy));
    }
  }
  return danger;
};

// Gold value of `damage` points of health of a unit, counting the bounty when it dies
const healthValue = (unit: Unit, damage: number, health = unit.lifespan) => {
  const lost = Math.min(damage, health);
  return lost / unit.maxLifespan * unit.cost + (damage >= health ? getKillBounty(unit) : 0);
};

// Whether any enemy unit could walk onto a hex on its next turn
const enemyCanReach = (planner: Planner, position: HexCoordinates): boolean =>
  planner.enemies.some(enemy =>
    getHexDistance(enemy.position, position) === 1 ||
    walkingDistance(planner.state, enemy.position, position) <= enemy.movementRange
  );

// ---------------------------------------------------------------------------
// Objectives: camps, mines, springs, strong ground, raid targets
// ---------------------------------------------------------------------------

/**
 * Meet each enemy that could besiege the castle with the nearest units that can strike it,
 * enough of them to take it down, while the rest of the army keeps to its own tasks
 */
const assignInterceptors = (planner: Planner): Map<string, Unit> => {
  const { state, myBase, threat } = planner;
  const interceptors = new Map<string, Unit>();
  const raiders = [...threat.castleRaiders].sort((a, b) =>
    getHexDistance(a.position, myBase.coordinates) - getHexDistance(b.position, myBase.coordinates));

  for (const raider of raiders) {
    const responders = state.players.ai.units
      .filter(unit => !unit.hasMoved && !interceptors.has(unit.id) &&
        getHexDistance(unit.position, raider.position) <= unit.movementRange + getAttackRange(unit) + 1)
      .sort((a, b) => getHexDistance(a.position, raider.position) - getHexDistance(b.position, raider.position));
    let expected = 0;
    for (const unit of responders) {
      if (expected >= raider.lifespan * 1.5) break;
      interceptors.set(unit.id, raider);
      expected += getStrikePowerOnTerrain(unit, 'plain', raider, terrainAt(planner, raider.position), getAttackRange(unit));
    }
  }
  return interceptors;
};

/**
 * Camps the AI doesn't hold: neutral ones, and its own camps the player has seized
 */
// What taking each building is worth to the AI, in the same rough gold terms as a camp
const BUILDING_VALUE: Partial<Record<TerrainType, number>> = {
  catapult: 12, tavern: TAVERN_INCOME * 3 + 3, blacksmith: 9, barracks: 6, watchtower: 5, lumbermill: 4, gate: 6
};

const findCampTargets = (state: GameState): Hex[] =>
  state.hexGrid.filter(hex => hex.isCamp && hex.owner !== 'ai');

/**
 * Send units to take camps the AI doesn't hold and gold mines it doesn't hold (free ones, or ones
 * an enemy unit stands on, which then has to be beaten off). Each objective gets the unit that can
 * reach it soonest; armies that dig in only go after the ones on their side of the middle.
 * Units already guarding a mine or camp, and Mages, stay where they are needed.
 */
const assignObjectives = (planner: Planner): Map<string, Hex> => {
  const { state, profile, settings, myBase, enemyBase } = planner;
  const onOurSide = (hex: Hex) =>
    walkingDistance(state, hex.coordinates, myBase.coordinates) <= walkingDistance(state, hex.coordinates, enemyBase.coordinates) + HOLD_REACH;

  const objectives: { hex: Hex; value: number }[] = [];
  for (const hex of state.hexGrid) {
    let value: number;
    if (hex.isCamp && hex.owner !== 'ai') value = CAMP_INCOME * 3 + 4;
    else if (hex.isResourceHex && hex.unit?.owner !== 'ai') value = (hex.resourceValue ?? 0) * 3 * (0.5 + settings.resourceFocus);
    else if (BUILDING_VALUE[hex.terrain] !== undefined && hex.owner !== 'ai') value = BUILDING_VALUE[hex.terrain]!;
    // A catapult tower only bombards with a troop in it
    else if (hex.terrain === 'catapult' && hex.unit?.owner !== 'ai') value = BUILDING_VALUE.catapult!;
    else continue;
    if (profile.posture === 'hold' && !onOurSide(hex)) continue;
    if (hex.unit?.owner === 'player') value *= 0.7;
    objectives.push({ hex, value });
  }

  const units = state.players.ai.units.filter(unit => {
    const hex = planner.hexes.get(key(unit.position));
    return !unit.hasMoved && !unit.abilities.includes('healing') && !planner.interceptors.has(unit.id) &&
      !(hex?.isResourceHex) && !(hex?.isCamp && hex.owner === 'ai') && hex?.terrain !== 'catapult';
  });

  const pairs = objectives.flatMap(({ hex, value }) => units.map(unit => ({
    hex,
    unit,
    score: value - 2 * walkingDistance(state, unit.position, hex.coordinates) / unit.movementRange
  }))).filter(pair => pair.score > 0).sort((a, b) => b.score - a.score);

  const assignments = new Map<string, Hex>();
  const taken = new Set<string>();
  for (const { hex, unit } of pairs) {
    if (assignments.has(unit.id) || taken.has(key(hex.coordinates))) continue;
    assignments.set(unit.id, hex);
    taken.add(key(hex.coordinates));
  }
  return assignments;
};

/**
 * A free healing spring within a short walk of the unit where it wouldn't be cut down, if any
 */
const findNearbySpring = (planner: Planner, unit: Unit): Hex | undefined => {
  const reserved = planner.state.pendingMoves.map(m => m.to);
  let best: Hex | undefined;
  let bestTurns = MAX_SPRING_DETOUR_TURNS;

  for (const hex of planner.state.hexGrid) {
    if (!TERRAIN_EFFECTS[hex.terrain].healPerTurn) continue;
    if (hex.unit && hex.unit.id !== unit.id) continue;
    if (reserved.some(c => coordsMatch(c, hex.coordinates))) continue;
    if (dangerAt(planner, unit, hex.coordinates) >= unit.lifespan) continue;

    const turns = walkingDistance(planner.state, unit.position, hex.coordinates) / unit.movementRange;
    if (turns <= bestTurns) {
      bestTurns = turns;
      best = hex;
    }
  }

  return best;
};

/**
 * Strong ground for armies that dig in around the middle of the map: high ground for archers, or
 * forests and narrow passes on the road between the castles for pike walls, preferably next to the
 * gold mines and camps it protects. Each unit gets its own spot, the best ones going to the units
 * that use them best.
 */
const assignAnchors = (planner: Planner): Map<string, HexCoordinates> => {
  const { state, profile, myBase, enemyBase } = planner;
  const castleDistance = walkingDistance(state, myBase.coordinates, enemyBase.coordinates);
  const onOurSide = (hex: Hex) =>
    walkingDistance(state, hex.coordinates, myBase.coordinates) <= walkingDistance(state, hex.coordinates, enemyBase.coordinates) + HOLD_REACH;
  // Gold mines and camps on our side: strong ground next to them protects the economy
  const holdings = state.hexGrid.filter(hex => (hex.isResourceHex || hex.isCamp) && onOurSide(hex));

  const scored = state.hexGrid
    .filter(hex => !isImpassable(hex) && !hex.isBase && !hex.isResourceHex)
    .map(hex => {
      const toMine = walkingDistance(state, hex.coordinates, myBase.coordinates);
      const toTheirs = walkingDistance(state, hex.coordinates, enemyBase.coordinates);
      const elevation = TERRAIN_EFFECTS[hex.terrain].elevation;
      const isForest = hex.terrain === 'forest';
      const guards = holdings.filter(other => getHexDistance(other.coordinates, hex.coordinates) <= 2).length * 2.5;
      let score: number;
      if (profile.anchor === 'highGround') {
        // High ground around the middle of the map
        if (!onOurSide(hex) || toMine < 2) return null;
        score = (elevation >= 2 ? 4 : 0) + (isForest ? 2 : 0) + (elevation < 1 ? -4 : 0) + guards -
          0.6 * Math.abs(toTheirs - castleDistance * HOLD_LINE);
      } else {
        // On or near the road between the castles around the middle, in woods, on hills or
        // where the way narrows
        const offRoad = toMine + toTheirs - castleDistance;
        if (offRoad > 3 || !onOurSide(hex) || toMine < 2) return null;
        const openNeighbors = getHexesInRange(state.hexGrid, hex.coordinates, 1)
          .filter(other => other !== hex && !isImpassable(other)).length;
        score = (isForest ? 4 : 0) + (elevation >= 2 ? 3 : 0) + (elevation < 1 ? -4 : 0) + guards +
          (6 - openNeighbors) * 0.6 - offRoad * 0.8 - 0.4 * Math.abs(toTheirs - castleDistance * HOLD_LINE);
      }
      return { hex, score };
    })
    .filter((entry): entry is { hex: Hex; score: number } => !!entry)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  // Archers get first pick of the high ground, then everyone else
  const units = [...state.players.ai.units]
    .filter(unit => !unit.hasMoved && !planner.objectives.has(unit.id))
    .sort((a, b) => Number(isRanged(b)) - Number(isRanged(a)));

  const taken = new Set<string>();
  const anchors = new Map<string, HexCoordinates>();
  for (const unit of units) {
    let best: Hex | undefined;
    let bestValue = -Infinity;
    for (const { hex, score } of scored) {
      if (taken.has(key(hex.coordinates))) continue;
      const fit = isRanged(unit) || profile.anchor === 'choke' ? score : score * 0.5;
      const value = fit - walkingDistance(state, unit.position, hex.coordinates) / unit.movementRange;
      if (value > bestValue) {
        bestValue = value;
        best = hex;
      }
    }
    if (best) {
      taken.add(key(best.coordinates));
      anchors.set(unit.id, best.coordinates);
    }
  }
  return anchors;
};

/**
 * Where a raider should strike next: soft enemy units it is strong against (Archers, Mages,
 * anyone holding a gold mine) away from their escorts, or gold mines it can take from the enemy
 */
const chooseRaidTarget = (planner: Planner, unit: Unit): HexCoordinates | null => {
  const { state } = planner;
  let best: HexCoordinates | null = null;
  let bestValue = 0;

  const turnsTo = (position: HexCoordinates) => walkingDistance(state, unit.position, position) / unit.movementRange;

  for (const enemy of liveEnemies(planner)) {
    const counter = getCounterMultiplier(unit.type, enemy.type);
    const onMine = !!planner.hexes.get(key(enemy.position))?.isResourceHex;
    // Escorts that hit this unit hard make the raid costly
    const escort = planner.enemies
      .filter(other => other.id !== enemy.id && getHexDistance(other.position, enemy.position) <= 2)
      .reduce((sum, other) => sum + other.attackPower * getCounterMultiplier(other.type, unit.type), 0);
    const value = enemy.cost * counter * (onMine ? 1.5 : 1) / (1 + escort / 4) - turnsTo(enemy.position) * 2;
    if (value > bestValue) {
      bestValue = value;
      best = enemy.position;
    }
  }

  for (const hex of state.hexGrid) {
    if (!hex.isResourceHex || (hex.unit && hex.unit.owner === 'ai')) continue;
    const value = (hex.resourceValue ?? 0) * 3 - turnsTo(hex.coordinates) * 2;
    if (value > bestValue) {
      bestValue = value;
      best = hex.coordinates;
    }
  }

  return best;
};

// Where a Mage should stand: just behind the friendly fighter closest to the enemy
const chooseSupportPosition = (planner: Planner, mage: Unit): HexCoordinates | null => {
  const front = planner.state.players.ai.units
    .filter(unit => unit.id !== mage.id && !unit.abilities.includes('healing'))
    .map(unit => ({ unit, position: planner.destinations.get(unit.id) ?? unit.position }))
    .sort((a, b) => walkingDistance(planner.state, a.position, planner.enemyBase.coordinates) -
      walkingDistance(planner.state, b.position, planner.enemyBase.coordinates))[0];
  return front?.position ?? null;
};

// ---------------------------------------------------------------------------
// Moving a unit
// ---------------------------------------------------------------------------

// What a unit is trying to do this turn (chooseGoal), for anyone asking why it moved (the tutorial)
export type GoalKind =
  | 'intercept' | 'guard' | 'retreat' | 'heal' | 'objective' | 'holdCamp' | 'holdMine' | 'support' | 'push' | 'anchor' | 'raid' | 'march';

interface UnitGoal {
  kind: GoalKind;
  position: HexCoordinates | null;
  // Gold value of each turn of progress towards it
  weight: number;
  // Extra value for staying where the unit is (holding a mine, a camp, a spring)
  holdValue: number;
  // Multiplier on how much the unit fears damage this move
  caution: number;
}

/**
 * What a unit is trying to do this turn, most urgent first: stop a raid on the castle, fall back
 * when it can't survive, heal, take camps, hold mines, then its doctrine's posture.
 */
const chooseGoal = (planner: Planner, unit: Unit): UnitGoal => {
  const { profile, settings, myBase, enemyBase } = planner;
  const healthRatio = unit.lifespan / unit.maxLifespan;
  const standingOn = planner.hexes.get(key(unit.position));
  const cautionScale = planner.endgame === 'ahead' ? ENDGAME_CAUTION_BOOST : 1;
  const goal = (kind: GoalKind, position: HexCoordinates | null, weight: number, holdValue = 0, caution = profile.caution): UnitGoal =>
    ({ kind, position, weight, holdValue, caution: caution * cautionScale });

  // An enemy that could besiege the castle is met by enough units to stop it
  const raider = planner.interceptors.get(unit.id);
  if (raider) return goal('intercept', raider.position, GOAL_WEIGHT.urgent, 0, profile.caution * 0.5);

  // Bosses guard the castle (fighting whatever comes close) until the final push
  if (unit.isBoss && !planner.isPushing) return goal('guard', unit.position, GOAL_WEIGHT.station, 2, profile.caution * 0.5);

  // Wounded units under threat fall back
  if (!planner.isPushing && healthRatio < settings.retreatThreshold && dangerAt(planner, unit, unit.position) > 0) {
    const spring = findNearbySpring(planner, unit);
    return goal('retreat', spring?.coordinates ?? myBase.coordinates, GOAL_WEIGHT.objective, 0, profile.caution * 2);
  }

  // Wounded units rest on a healing spring until they're back to full health,
  // and detour to one if it's close by
  const wantsToHeal = planner.isPushing ? healthRatio < PUSH_HEAL_THRESHOLD : unit.lifespan < unit.maxLifespan;
  if (wantsToHeal && standingOn && TERRAIN_EFFECTS[standingOn.terrain].healPerTurn) {
    return goal('heal', unit.position, GOAL_WEIGHT.objective, healthValue(unit, HEALER_HEAL_AMOUNT) * 2);
  }
  if (wantsToHeal && unit.maxLifespan - unit.lifespan >= (planner.isPushing ? 1 : 2)) {
    const spring = findNearbySpring(planner, unit);
    if (spring) return goal('heal', spring.coordinates, GOAL_WEIGHT.objective);
  }

  // Take (or retake) the camp or gold mine this unit was sent to
  const objective = planner.objectives.get(unit.id);
  if (objective) return goal('objective', objective.coordinates, GOAL_WEIGHT.objective);

  // Hold a camp while the enemy could otherwise walk in and take it next turn
  if (standingOn?.isCamp && standingOn.owner === 'ai' && enemyCanReach(planner, unit.position)) {
    return goal('holdCamp', unit.position, GOAL_WEIGHT.objective, CAMP_INCOME * 3);
  }

  // Hold gold mines until the all-out push
  if (standingOn?.isResourceHex && !planner.isPushing) {
    return goal('holdMine', unit.position, GOAL_WEIGHT.objective, (standingOn.resourceValue ?? 0) * 3);
  }

  // Mages keep close behind the front line so they can heal it
  if (unit.abilities.includes('healing')) {
    const support = chooseSupportPosition(planner, unit);
    if (support) return goal('support', support, GOAL_WEIGHT.station);
  }

  if (planner.isPushing) return goal('push', enemyBase.coordinates, GOAL_WEIGHT.urgent, 0, profile.caution * 0.3);

  if (profile.posture === 'hold') {
    const anchor = planner.anchors.get(unit.id);
    if (anchor) return goal('anchor', anchor, GOAL_WEIGHT.station, 1);
  }

  if (profile.posture === 'raid') {
    const target = chooseRaidTarget(planner, unit);
    if (target) return goal('raid', target, GOAL_WEIGHT.march);
  }

  return goal('march', enemyBase.coordinates, GOAL_WEIGHT.march);
};

// Whether a unit standing at `position` could attack the enemy castle (as canStrikeCastle)
const canStrikeCastleFrom = (planner: Planner, unit: Unit, position: HexCoordinates, terrain: TerrainType): boolean => {
  const castle = planner.enemyBase.coordinates;
  const distance = getHexDistance(position, castle);
  if (distance > getAttackRange(unit, terrain)) return false;
  return distance <= 1 || unit.abilities.includes('magic') || hasLineOfSight(planner.state.hexGrid, position, castle);
};

/**
 * Value of striking from a hex: the damage the unit's attack would do to the best target in reach
 * (in gold, with a bonus for finishing a unit off), less what the target would strike back with.
 * Returns the target too so the planner can count the damage as dealt.
 */
const attackValueFrom = (planner: Planner, unit: Unit, position: HexCoordinates): { value: number; target?: Unit; damage: number } => {
  let best: { value: number; target?: Unit; damage: number } = { value: 0, damage: 0 };
  const self = { ...unit, position };

  for (const enemy of planner.enemies) {
    const health = remainingHealth(planner, enemy);
    if (health <= 0 || !canStrikeFrom(planner, unit, position, enemy.position)) continue;

    // Ganging up flanks: joining the troops already set on this enemy adds to this strike and to theirs
    const joining = planner.plannedAttackers.get(enemy.id) ?? 0;
    const allyBoost = joining > 0 && joining <= MAX_FLANKERS ? (planner.plannedDamage.get(enemy.id) ?? 0) * FLANK_BONUS / (1 + FLANK_BONUS * (joining - 1)) : 0;
    const damage = strikeFrom(planner, unit, position, enemy, enemy.position) * (1 + FLANK_BONUS * Math.min(MAX_FLANKERS, joining)) + allyBoost;
    let value = healthValue(enemy, damage, health);
    // Removing a unit also removes the damage it would have done next turn
    if (damage >= health) value += enemy.attackPower;

    const isSneakAttack = unit.abilities.includes('stealth') && !enemy.abilities.includes('stealth');
    const strikesBack = !isSneakAttack && canStrikeFrom(planner, enemy, enemy.position, position);
    if (strikesBack) value -= healthValue(unit, strikeFrom(planner, enemy, enemy.position, self, position) * 0.7);

    if (value > best.value) best = { value, target: enemy, damage };
  }

  // Every other enemy troop in reach strikes back at an attacker, which can't hit them back
  if (best.target) best.value -= healthValue(unit, strikeBackDamage(planner, unit, position, best.target.id));
  return best;
};

// Damage the enemy troops able to reach a hex would deal a unit attacking from it (they strike
// back at any attacker in their reach), leaving out its own target
const strikeBackDamage = (planner: Planner, unit: Unit, position: HexCoordinates, targetId?: string): number => {
  const self = { ...unit, position };
  return planner.enemies
    .filter(enemy => enemy.id !== targetId && remainingHealth(planner, enemy) > 0 && canStrikeFrom(planner, enemy, enemy.position, position))
    .reduce((sum, enemy) => sum + strikeFrom(planner, enemy, enemy.position, self, position), 0) * STRIKE_BACK_WEIGHT;
};
// Not every enemy that could strike back will (some will be busy with fights of their own)
const STRIKE_BACK_WEIGHT = 0.7;

// Count this unit's expected strike against the enemy it will most likely hit, so other units
// pick other targets (or help finish this one) and don't fear an enemy that is about to fall
const recordPlannedAttack = (planner: Planner, unit: Unit, position: HexCoordinates) => {
  const { target, damage } = attackValueFrom(planner, unit, position);
  if (!target) return;
  planner.plannedDamage.set(target.id, (planner.plannedDamage.get(target.id) ?? 0) + Math.max(1, Math.round(damage)));
  planner.plannedAttackers.set(target.id, (planner.plannedAttackers.get(target.id) ?? 0) + 1);
};

/**
 * Decide where a single unit should move this turn (or null to hold position). Every reachable hex
 * is scored on the fight it offers, the damage the unit could take there next turn, the ground
 * (height, cover, line of sight are part of both), progress towards the unit's goal, and extras such
 * as Mages' healing.
 */
const decideUnitMove = (planner: Planner, unit: Unit): HexCoordinates | null => {
  const { state, settings, myBase } = planner;
  const goal = chooseGoal(planner, unit);
  planner.intents.set(unit.id, goal.kind);
  const enemiesNear = planner.enemies.some(enemy => getHexDistance(enemy.position, unit.position) <= 8);
  const startDistance = goal.position ? walkingDistance(state, unit.position, goal.position) : 0;

  const score = (position: HexCoordinates): number => {
    const isStay = coordsMatch(position, unit.position);
    const hex = planner.hexes.get(key(position));
    let value = 0;

    if (enemiesNear) {
      value += attackValueFrom(planner, unit, position).value * (0.6 + settings.attackAggressiveness * 0.8) *
        (planner.endgame === 'behind' ? ENDGAME_ATTACK_BOOST : 1);
      const danger = dangerAt(planner, unit, position);
      value -= healthValue(unit, danger) * goal.caution;
    }

    if (goal.position) {
      const progress = (startDistance - walkingDistance(state, position, goal.position)) / unit.movementRange;
      value += progress * goal.weight;
      if (coordsMatch(position, goal.position)) value += goal.weight * 0.5;
    }
    if (isStay) value += goal.holdValue;
    // Crewing a catapult tower: a stone at the enemy every turn
    if (isStay && hex?.terrain === 'catapult') value += CATAPULT_DAMAGE * 1.5;
    // Ground an enemy boss has marked for its power: it lands before this troop moves again
    for (const boss of planner.enemies) {
      const strike = boss.threat && getBossPower(boss.type)?.strike;
      if (strike && boss.threat!.some(at => coordsMatch(at, position))) value -= healthValue(unit, boss.attackPower * strike.damage * 1.5);
    }
    // Embers: the hex will be on fire next turn
    if (hex?.fire?.stage === 'smoulder' && !unit.abilities.includes('fireborn')) value -= healthValue(unit, FIRE_DAMAGE * 2);
    // Already on fire (a troop caught in it): get out
    if (isStay && hex?.fire?.stage === 'burning' && !unit.abilities.includes('fireborn')) value -= healthValue(unit, FIRE_DAMAGE * 2);

    // Mages heal the wounded friends they end up next to
    if (unit.abilities.includes('healing')) {
      for (const friend of state.players.ai.units) {
        if (friend.id === unit.id) continue;
        const at = planner.destinations.get(friend.id) ?? friend.position;
        if (getHexDistance(at, position) !== 1) continue;
        value += healthValue(friend, Math.min(HEALER_HEAL_AMOUNT, friend.maxLifespan - friend.lifespan)) + 0.3;
      }
    }

    // Standing where it can attack the castle wears it down
    if (canStrikeCastleFrom(planner, unit, position, hex?.terrain ?? 'plain')) {
      value += getSiegeDamage(unit) * (planner.isPushing ? SIEGE_VALUE.pushing : SIEGE_VALUE.normal);
      // Enemy troops in reach strike back at a castle attacker
      value -= healthValue(unit, strikeBackDamage(planner, unit, position));
    }

    // Recruits appear next to the castle, so don't park there unless defending it
    if (getHexDistance(position, myBase.coordinates) === 1 && !planner.threat.baseUnderThreat) value -= 1.5;
    // Gold mines pay whoever stands on them
    if (hex?.isResourceHex && !planner.isPushing) value += (hex.resourceValue ?? 0);

    return value + Math.random() * 0.05;
  };

  const options = [unit.position, ...getValidMoveTargets(state, unit)]
    .map(position => ({ position, value: score(position) }))
    .sort((a, b) => b.value - a.value);

  // Easier AIs sometimes settle for a decent move rather than the best one
  const pick = Math.random() < settings.sloppiness
    ? options[Math.floor(Math.random() * Math.min(3, options.length))]
    : options[0];

  return coordsMatch(pick.position, unit.position) ? null : pick.position;
};

// ---------------------------------------------------------------------------
// Recruiting
// ---------------------------------------------------------------------------

/**
 * How well a unit type would do against the enemy's army: the damage bonus it gets against them,
 * less the bonus they get against it (weighted by what each enemy unit is worth)
 */
const counterScore = (type: UnitType, enemies: Unit[]): number => {
  const total = enemies.reduce((sum, enemy) => sum + enemy.cost, 0);
  if (total === 0) return 0;
  return enemies.reduce((sum, enemy) =>
    sum + enemy.cost * ((getCounterMultiplier(type, enemy.type) - 1) - (getCounterMultiplier(enemy.type, type) - 1)), 0) / total;
};

/**
 * Pick the type of the next recruit. The doctrine's mix, shifted towards counters of the enemy army
 * (or of the units raiding the castle), sets the army the AI wants; it then recruits whichever type
 * it is furthest short of. Returns a type even if the AI can't afford it yet, so it saves up rather
 * than filling the army with whatever is cheapest.
 */
const chooseRecruitType = (planner: Planner, campsWithoutCapturer: { count: number }): UnitType | null => {
  const { state, profile, settings, threat, enemies, recruitTypes } = planner;
  if (recruitTypes.length === 0) return null;
  const canAfford = (type: UnitType) => recruitStats(planner, type).cost <= state.players.ai.points;

  // A camp nobody is heading for: the fastest troop on hand gets there first
  if (campsWithoutCapturer.count > 0 && !threat.baseUnderThreat) {
    const fast = [...recruitTypes].sort((a, b) => recruitStats(planner, b).movementRange - recruitStats(planner, a).movementRange)[0];
    if (recruitStats(planner, fast).movementRange >= 4 && canAfford(fast)) {
      campsWithoutCapturer.count--;
      return fast;
    }
  }

  // Each class's share of the army is split between the types of that class on hand
  const perClass = new Map<TroopClass, number>();
  for (const type of recruitTypes) perClass.set(getTroopClass(type), (perClass.get(getTroopClass(type)) ?? 0) + 1);

  const against = threat.baseUnderThreat && threat.castleRaiders.length > 0 ? threat.castleRaiders : enemies;
  const bias = profile.counterBias * (0.5 + settings.unitDiversityDesire) * (threat.baseUnderThreat ? 2 : 1);
  const weights = recruitTypes.map(type => {
    const troopClass = getTroopClass(type);
    const share = (profile.mix[troopClass] ?? UNLISTED_CLASS_SHARE) / perClass.get(troopClass)!;
    const base = share + (threat.baseUnderThreat ? 0.5 : 0);
    return { type, weight: base * Math.exp(bias * counterScore(type, against)) };
  });
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  // How far short of its share of the army each type is, counting recruits already queued
  const counts = new Map<UnitType, number>();
  for (const unit of state.players.ai.units) counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
  for (const purchase of state.pendingPurchases) counts.set(purchase.unitType, (counts.get(purchase.unitType) ?? 0) + 1);
  const armySize = [...counts.values()].reduce((sum, n) => sum + n, 0) + 1;

  // Under attack there is no time to save up: only what can be bought now counts
  const pool = threat.baseUnderThreat ? weights.filter(w => canAfford(w.type)) : weights;
  let best: UnitType | null = pool[0]?.type ?? null;
  let bestShortfall = -Infinity;
  for (const { type, weight } of pool) {
    if (weight <= 0) continue;
    const shortfall = weight / totalWeight * armySize - (counts.get(type) ?? 0) + Math.random() * 0.5;
    if (shortfall > bestShortfall) {
      bestShortfall = shortfall;
      best = type;
    }
  }
  return best;
};

// The stats this side recruits a troop type with
const recruitStats = (planner: Planner, type: UnitType): TroopStats =>
  getRosterStats(planner.state, 'ai', type)!;

/**
 * Decide what to recruit and where, or nothing: when the AI is saving up for the unit it wants,
 * or when another unit's upkeep would eat too much of its income (unless it is losing the fight)
 */
const decidePurchase = (
  planner: Planner,
  campsWithoutCapturer: { count: number }
): { unitType: UnitType, position: HexCoordinates } | null => {
  const { state, profile, threat } = planner;
  const me = state.players.ai;

  const armySize = me.units.length + state.pendingPurchases.filter(p => p.playerId === me.id).length;
  const income = getIncome(state, 'ai');
  const upkeepAfter = Math.max(0, armySize + 1 - FREE_UPKEEP_UNITS) * UPKEEP_PER_UNIT;
  const netAfter = income.base + income.mines + income.camps + income.taverns - upkeepAfter;
  const isLosing = armyValue(planner.enemies) > armyValue(me.units) * 1.15;
  if (netAfter < profile.minNetIncome && !isLosing && !threat.baseUnderThreat) return null;

  const unitType = chooseRecruitType(planner, campsWithoutCapturer);
  if (!unitType || recruitStats(planner, unitType).cost > me.points) return null;

  const position = chooseDeploymentHex(planner, unitType);
  return position ? { unitType, position } : null;
};

/**
 * Where to deploy a recruit: next to the castle or at a camp the AI holds, whichever is closer
 * to where the army is headed. When the castle is threatened and unguarded, recruits appear at home.
 * Archers aren't dropped next to enemies, nobody is dropped on low ground under fire, and a
 * recruit on the camp hex itself keeps the enemy from walking in to take it.
 */
const chooseDeploymentHex = (planner: Planner, unitType: UnitType): HexCoordinates | null => {
  const { state, threat, myBase, enemyBase } = planner;
  const hexes = getDeploymentHexes(state, 'ai');
  if (hexes.length === 0) return null;

  const isCastleSpot = (hex: Hex) => getHexDistance(hex.coordinates, myBase.coordinates) === 1;
  const nearestThreat = nearestTo(threat.castleRaiders, myBase.coordinates) ?? planner.enemies
    .filter(enemy => getHexDistance(enemy.position, myBase.coordinates) <= CASTLE_WATCH_RANGE)
    .sort((a, b) => getHexDistance(a.position, myBase.coordinates) - getHexDistance(b.position, myBase.coordinates))[0];
  const isGuarded = state.players.ai.units.some(unit => getHexDistance(unit.position, myBase.coordinates) <= 2);
  const defendHome = (threat.baseUnderThreat || (nearestThreat && !isGuarded)) && hexes.some(isCastleSpot);

  // Armies that dig in send recruits towards their strong ground rather than the enemy castle
  const rally = planner.profile.posture === 'hold' && !planner.isPushing ? [...planner.anchors.values()][0] : undefined;
  const candidates = defendHome ? hexes.filter(isCastleSpot) : hexes;
  const goal = defendHome && nearestThreat ? nearestThreat.position : rally ?? enemyBase.coordinates;
  const stats = recruitStats(planner, unitType);
  const recruit: Unit = {
    id: 'recruit', type: unitType, owner: 'ai', position: myBase.coordinates, movementRange: stats.movementRange,
    attackPower: stats.attackPower, lifespan: stats.maxLifespan, maxLifespan: stats.maxLifespan, cost: stats.cost,
    abilities: stats.abilities, hasMoved: true, isEngagedInCombat: false
  };

  const score = (hex: Hex) =>
    walkingDistance(state, hex.coordinates, goal) +
    (isRanged(recruit) && planner.enemies.some(enemy => getHexDistance(enemy.position, hex.coordinates) === 1) ? 6 : 0) +
    healthValue(recruit, dangerAt(planner, recruit, hex.coordinates)) * 0.5 +
    (hex.isCamp && enemyCanReach(planner, hex.coordinates) ? -2 : 0);

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

// ---------------------------------------------------------------------------
// Walking distances
// ---------------------------------------------------------------------------

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
  const goalKey = key(goal);
  let distances = cache.get(goalKey);
  if (!distances) {
    distances = getTerrainDistanceMap(state.hexGrid, goal);
    cache.set(goalKey, distances);
  }
  // Fall back to straight-line distance for hexes the goal can't be walked to from
  return distances.get(key(from)) ?? getHexDistance(from, goal) + 100;
};

const nearestTo = (units: Unit[], position: HexCoordinates): Unit | undefined =>
  units.reduce<Unit | undefined>((nearest, other) =>
    !nearest || getHexDistance(position, other.position) < getHexDistance(position, nearest.position)
      ? other
      : nearest,
  undefined);
