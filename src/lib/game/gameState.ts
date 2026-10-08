import { v4 as uuidv4 } from 'uuid';
import {
  Ability,
  BattleEffect,
  BattleEffectKind,
  GameState,
  Hex,
  HexCoordinates,
  Player,
  PlayerType,
  Roster,
  SideStats,
  TerrainType,
  TroopStats,
  Unit,
  UnitType,
  Move,
  Purchase,
  Sighting,
  Combat,
  GameSettings,
  TacticCard,
  WinReason
} from '@/types/game';
import type { BondId } from './bonds';
import {
  getHexDistance,
  findHexByCoordinates,
  getNeighbors
} from './hexUtils';
import { createHexagonalGrid } from './mapGenerator';
import { getHexHeightOf, getTerrainHeight, shiftHeightOffset } from './hexHeight';
import { cardStats, getClassCounter, getTroop, getTroopClass } from './troops';
import {
  CHARGE_DISTANCE, EYE_OF_STORM_RADIUS, LONE_BLADE_RADIUS, SHOULDER_MAX_ALLIES, bloodlustHeal, braceBonus,
  challengePulls, challengeRange, chargeBonus, eyeOfStormBonus, holySmiteBonus, isSmitable, loneBladeBonus,
  piercingShare, rankOf, shoulderBonusPerAlly, steadyAimBonus, strafeDamage, undermineDepth, wardReduction
} from './signatures';
import { TACTIC_HAND_LIMIT, isTacticDrawRound } from './tactics';

// Default game settings: a small board and short turns so a battle takes a few minutes
export const DEFAULT_SETTINGS: GameSettings = {
  gridSize: 4, // Hexes from the centre to the edge: 9 hexes across, 61 in total
  planningPhaseTime: 30,
  aiDifficulty: 'medium',
  resourceHexCount: 3,
  castleHealth: 26,
  startingGold: 30,
  aiIncomeBonus: 0,
  maxRounds: 14
};

// Default castle health (each battle's settings may change it)
export const BASE_MAX_HEALTH = 26;
// Gold each side receives at the end of each of its turns (once per round)
export const TURN_INCOME = 5;
// Units within this many hexes of the enemy base damage it at the end of their side's turn
// Cards in the player's hand; playing one moves it to the bottom of the deck
export const HAND_SIZE = 4;

// Display name of a troop type
export const getTroopName = (type: UnitType): string => getTroop(type).name;

export interface TerrainEffect {
  name: string;
  // Movement points needed to enter the hex, or null if units can't enter it
  moveCost: number | null;
  // Height level: water, swamps, ice and lava are low (0), most ground is 1, hills and snowfields are
  // high (2), mountains tower (3). Attacking down onto lower ground hits harder; attacking uphill is weaker.
  elevation: number;
  // How high the hex blocks line of sight, if more than its elevation (forest canopies and ruined walls)
  sightHeight?: number;
  // Multiplier applied to damage taken by a unit standing on this terrain
  damageTakenMultiplier: number;
  // Health restored to a unit standing here at the end of its side's turn
  healPerTurn?: number;
  // Health lost by a unit standing here at the end of its side's turn
  damagePerTurn?: number;
  // Pathfinders cross this rough ground for 1 movement
  isRough?: boolean;
  // Troops here can only be seen from the next hex (in the fog of war)
  conceals?: boolean;
  description: string;
}

// How each terrain type affects the units on it
export const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  plain: {
    name: 'Plains',
    moveCost: 1,
    elevation: 1,
    damageTakenMultiplier: 1,
    description: 'Open ground. No bonuses or penalties.'
  },
  forest: {
    name: 'Forest',
    moveCost: 1,
    elevation: 1,
    sightHeight: 2,
    damageTakenMultiplier: 0.6,
    conceals: true,
    description: 'Cover: units here take 40% less damage, and the trees block arrows unless shot from higher ground. In the fog of war, troops here can only be spotted from the next hex. Pikemen attack 50% harder from here.'
  },
  desert: {
    name: 'Desert',
    moveCost: 2,
    elevation: 1,
    damageTakenMultiplier: 1,
    isRough: true,
    description: 'Deep sand: costs 2 movement to enter.'
  },
  resource: {
    name: 'Gold Mine',
    moveCost: 1,
    elevation: 1,
    damageTakenMultiplier: 1,
    description: 'Hold it with a unit to earn its gold at the end of each of your turns.'
  },
  mountain: {
    name: 'Mountains',
    moveCost: null,
    elevation: 3,
    damageTakenMultiplier: 1,
    description: 'Impassable (flyers pass over), and blocks line of sight.'
  },
  water: {
    name: 'Water',
    moveCost: null,
    elevation: 0,
    damageTakenMultiplier: 1,
    description: 'Impassable, except to flyers passing over.'
  },
  hills: {
    name: 'Hills',
    moveCost: 2,
    elevation: 2,
    damageTakenMultiplier: 1,
    description: 'High ground: hit harder against lower ground (+30% per 1.0 of height), ranged troops reach 1 hex further, and ridges block shots from below. Costs 2 movement to enter.'
  },
  swamp: {
    name: 'Swamp',
    moveCost: 2,
    elevation: 0,
    damageTakenMultiplier: 1,
    isRough: true,
    description: 'Low, boggy ground: attackers on higher ground hit harder (+30% per 1.0 of height), and it costs 2 movement to enter.'
  },
  snow: {
    name: 'Snow',
    moveCost: 3,
    elevation: 2,
    damageTakenMultiplier: 1,
    isRough: true,
    description: 'High, deep snow: high ground like hills, but costs 3 movement to enter.'
  },
  spring: {
    name: 'Spring',
    moveCost: 1,
    elevation: 1,
    damageTakenMultiplier: 1,
    healPerTurn: 4,
    description: 'Healing waters: a unit here recovers 4 health at the end of each of its turns.'
  },
  lava: {
    name: 'Lava Field',
    moveCost: 2,
    elevation: 0,
    damageTakenMultiplier: 1,
    damagePerTurn: 4,
    description: 'Low, scorching ground: units here lose 4 health at the end of each of their turns (Fireborn troops are unharmed). Costs 2 movement.'
  },
  ice: {
    name: 'Ice',
    moveCost: 2,
    elevation: 0,
    damageTakenMultiplier: 1,
    isRough: true,
    description: 'A frozen lake: low, slippery ground that costs 2 movement to cross.'
  },
  ruins: {
    name: 'Ruins',
    moveCost: 1,
    elevation: 1,
    sightHeight: 2,
    damageTakenMultiplier: 0.75,
    description: 'Crumbling walls: units here take 25% less damage, and the walls block arrows unless shot from higher ground.'
  },
  cursed: {
    name: 'Cursed Ground',
    moveCost: 1,
    elevation: 1,
    damageTakenMultiplier: 1,
    damagePerTurn: 2,
    description: 'Units here lose 2 health at the end of each of their turns. The undead are healed instead.'
  },
  village: {
    name: 'Village',
    moveCost: 1,
    elevation: 1,
    sightHeight: 2,
    damageTakenMultiplier: 0.8,
    description: 'Houses and walls: units here take 20% less damage, and the buildings block arrows unless shot from higher ground.'
  }
};

// Attack multiplier for units with the terrainBonus ability fighting from a forest
export const TERRAIN_BONUS_ATTACK_MULTIPLIER = 1.5;
// Attack multiplier for berserk units at half health or less
export const BERSERK_ATTACK_MULTIPLIER = 1.5;
// Damage multiplier against castles for units with the siege ability
export const SIEGE_MULTIPLIER = 2;

// How many hexes away ranged units (rangedAttack) can strike from
export const RANGED_ATTACK_RANGE = 2;
// Ranged units caught in close combat (striking or struck back at from the next hex) fight at this
// fraction of their power, so cavalry and skirmishers that reach the back line can actually win there
export const RANGED_POINT_BLANK_MULTIPLIER = 0.5;
// Fraction of a destroyed unit's cost paid to the side that destroyed it
export const KILL_BOUNTY_FRACTION = 0.5;
// Gold plundered per point of siege damage dealt to an enemy castle
export const SIEGE_PLUNDER_PER_DAMAGE = 0.25;
// Health a unit with the healing ability (Mages) restores to each adjacent ally at the end of its side's turn
export const HEALER_HEAL_AMOUNT = 4;
// Health regenerating troops recover at the end of their side's turn
export const REGENERATE_AMOUNT = 2;
// Damage armored troops shrug off in every fight
export const ARMOR_REDUCTION = 2;

// Height: every 1.0 of height an attacker's hex stands above its target's (the number shown on each
// hex, decimals and all) adds this much damage, and every 1.0 below takes it away. The bonus is
// rounded to a whole percent and capped at MAX_HEIGHT_BONUS either way.
export const HEIGHT_DAMAGE_PER_UNIT = 0.3;
export const MAX_HEIGHT_BONUS = 0.5;
// Ranged units standing at least this high (hills, snow) reach one hex further
export const HIGH_GROUND_ELEVATION = 2;

// Zones of control: stepping next to an enemy ends a troop's move, unless it flies. Flanking: when
// several troops attack the same enemy together, every other attacker adds this much damage to each
// one's strike, counting at most MAX_FLANKERS of them. A lone attacker gets no flanking bonus.
export const FLANK_BONUS = 0.25;
export const MAX_FLANKERS = 2;

// Fog of war: how far troops see, more from high ground and for scouts (skirmishers and flyers);
// castles and camps watch the hexes around them
export const SIGHT_RANGE = 2;
export const SCOUT_SIGHT_BONUS = 1;
export const HIGH_GROUND_SIGHT_BONUS = 1;
const CASTLE_SIGHT = 2;
const CAMP_SIGHT = 1;
// Enemies that slip out of sight are remembered where they were last seen for this many rounds
export const SIGHTING_MEMORY_ROUNDS = 2;

// Economy: every side earns TURN_INCOME each turn, plus its gold mines and camps, but armies larger
// than FREE_UPKEEP_UNITS cost upkeep - a bigger army isn't automatically a better one
export const CAMP_INCOME = 2;
export const FREE_UPKEEP_UNITS = 4;
export const UPKEEP_PER_UNIT = 2;

// ---------------------------------------------------------------------------
// Creating a battle
// ---------------------------------------------------------------------------

// A unit that starts the battle on the board (a boss guarding the enemy castle)
export interface GuardSpec {
  type: UnitType;
  stats: TroopStats;
  isBoss?: boolean;
}

export interface BattleSetup {
  // Troop types each side may recruit and their stats this battle
  rosters: Record<PlayerType, Roster>;
  // The player's cards in draw order
  deck?: UnitType[];
  // Bonds active for the player (their bonuses are already in the roster)
  bonds?: BondId[];
  levelId?: number;
  // Units the enemy starts with next to its castle
  guards?: GuardSpec[];
  // The tactic cards each side brings (none: no tactic cards this battle)
  tactics?: Record<PlayerType, TacticCard[]>;
  // Let the player pick their castle's site before the first turn (otherwise it is placed for them)
  chooseCastle?: boolean;
}

const emptySideStats = (): SideStats => ({
  recruited: 0, kills: 0, lost: 0, siegeDamage: 0, goldEarned: 0, campsCaptured: 0, bossesSlain: 0,
  seen: [], slain: {}, played: {}
});

// The six Kingdom troops at level 1, for battles without a configured roster
export const defaultRoster = (): Roster =>
  Object.fromEntries((['infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic'] as UnitType[])
    .map(type => [type, cardStats(type, 1)]));

// Initialize a new game state (castles not yet placed)
export const initializeGameState = (settings: GameSettings = DEFAULT_SETTINGS, setup?: BattleSetup): GameState => {
  // Create the hexagonal grid with a themed terrain mix
  const { hexGrid, theme } = createHexagonalGrid(settings, settings.seed, settings.themeName);
  const startingGold = settings.startingGold ?? DEFAULT_SETTINGS.startingGold!;

  // Initialize players
  const players: Record<PlayerType, Player> = {
    player: {
      id: 'player-' + uuidv4(),
      type: 'player',
      points: startingGold,
      units: []
    },
    ai: {
      id: 'ai-' + uuidv4(),
      type: 'ai',
      points: startingGold,
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
    mapName: theme.name,
    rosters: setup?.rosters ?? { player: defaultRoster(), ai: defaultRoster() },
    deck: setup?.deck,
    bonds: setup?.bonds,
    levelId: setup?.levelId,
    battleStats: { player: emptySideStats(), ai: emptySideStats() },
    tactics: setup?.tactics && {
      player: { loadout: setup.tactics.player, hand: [], drawn: 0 },
      ai: { loadout: setup.tactics.ai, hand: [], drawn: 0 }
    },
    tacticSeed: Math.floor(Math.random() * 2 ** 31)
  };
};

// Create a battle: castles placed automatically, guards posted and the first turn begun - or, when
// the player picks their castle's site, waiting in setup with the sites to choose from
export const createBattle = (settings: GameSettings, setup?: BattleSetup): GameState => {
  const state = initializeGameState(settings, setup);
  if (setup?.chooseCastle) {
    const castleChoices = getCastleChoices(state);
    if (castleChoices.length > 1) return { ...state, castleChoices, pendingGuards: setup.guards ?? [] };
  }
  const placed = autoPlaceBases(state);
  return placeGuards(placed, setup?.guards ?? []);
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

export const getMaxRounds = (state: GameState): number => getSettings(state).maxRounds ?? DEFAULT_SETTINGS.maxRounds!;

export const getCastleMaxHealth = (state: GameState, side: PlayerType): number =>
  state.players[side].maxBaseHealth ?? getSettings(state).castleHealth ?? BASE_MAX_HEALTH;

// Water and mountains can't be entered by units
export const isImpassable = (hex: Hex) => TERRAIN_EFFECTS[hex.terrain].moveCost === null;

const findPlayerById = (state: GameState, playerId: string): Player | undefined =>
  Object.values(state.players).find(p => p.id === playerId);

export const findBaseHex = (state: GameState, playerType: PlayerType): Hex | undefined =>
  state.hexGrid.find(hex => hex.isBase && hex.owner === playerType);

const sideLabel = (side: PlayerType) => side === 'player' ? 'Your' : 'Enemy';
export const unitLabel = (unit: Unit) => `${sideLabel(unit.owner)} ${getTroopName(unit.type)}`;

export const hasAbility = (unit: { abilities: Ability[] }, ability: Ability) => unit.abilities.includes(ability);

// The stats a side recruits a troop type with, or undefined if it can't recruit it
export const getRosterStats = (state: GameState, side: PlayerType, type: UnitType): TroopStats | undefined =>
  state.rosters ? state.rosters[side][type] : cardStats(type, 1);

// Troop types a side may recruit
export const getRosterTypes = (state: GameState, side: PlayerType): UnitType[] =>
  Object.keys(state.rosters?.[side] ?? defaultRoster()) as UnitType[];

// The player's hand: the top cards of their deck. Without a deck every roster card is in hand.
export const getHand = (state: GameState): UnitType[] =>
  state.deck ? state.deck.slice(0, HAND_SIZE) : getRosterTypes(state, 'player');

// The card that will be drawn next
export const getNextCard = (state: GameState): UnitType | undefined => state.deck?.[HAND_SIZE];

// Copy the parts of the state that the game logic mutates so React state is never mutated in place
export const cloneState = (state: GameState): GameState => ({
  ...state,
  hexGrid: [...state.hexGrid],
  players: {
    player: { ...state.players.player, units: state.players.player.units.map(u => ({ ...u })) },
    ai: { ...state.players.ai, units: state.players.ai.units.map(u => ({ ...u })) }
  },
  pendingMoves: [...state.pendingMoves],
  pendingPurchases: [...state.pendingPurchases],
  combats: state.combats.map(c => ({ ...c })),
  battleStats: state.battleStats && {
    player: cloneSideStats(state.battleStats.player),
    ai: cloneSideStats(state.battleStats.ai)
  },
  tactics: state.tactics && {
    player: { ...state.tactics.player, hand: [...state.tactics.player.hand] },
    ai: { ...state.tactics.ai, hand: [...state.tactics.ai.hand] }
  },
  effects: state.effects && [...state.effects]
});

const cloneSideStats = (stats: SideStats): SideStats => ({
  ...stats, seen: [...stats.seen], slain: { ...stats.slain }, played: { ...stats.played }
});

export const sideStats = (state: GameState, side: PlayerType): SideStats => {
  state.battleStats ??= { player: emptySideStats(), ai: emptySideStats() };
  return state.battleStats[side];
};

// The players' unit lists are the source of truth; hex.unit is derived from them
export const syncHexUnits = (state: GameState): void => {
  const unitsByKey = new Map<string, Unit>();
  for (const unit of [...state.players.player.units, ...state.players.ai.units]) {
    unitsByKey.set(coordKey(unit.position), unit);
  }

  state.hexGrid = state.hexGrid.map(hex => {
    const unit = unitsByKey.get(coordKey(hex.coordinates));
    return hex.unit === unit ? hex : { ...hex, unit };
  });
};

// Remember which enemy troop types each side has now met on the battlefield, and (in the fog) where
// each side last saw each enemy troop
const noteSightings = (state: GameState): void => {
  const fog = isFogOfWar(state);
  const sightings = { player: [...(state.sightings?.player ?? [])], ai: [...(state.sightings?.ai ?? [])] };
  for (const side of ['player', 'ai'] as const) {
    const stats = sideStats(state, side);
    const visible = getVisibleEnemies(state, side);
    for (const enemy of visible) {
      if (!stats.seen.includes(enemy.type)) stats.seen.push(enemy.type);
    }
    if (!fog) continue;
    const alive = new Set(state.players[getOpponent(side)].units.map(unit => unit.id));
    const seenNow = new Set(visible.map(unit => unit.id));
    sightings[side] = [
      ...visible.map(unit => ({ unit: { ...unit }, turn: state.turnNumber })),
      ...sightings[side].filter(sighting =>
        !seenNow.has(sighting.unit.id) && alive.has(sighting.unit.id) && state.turnNumber - sighting.turn <= SIGHTING_MEMORY_ROUNDS)
    ];
  }
  if (fog) state.sightings = sightings;
};

// Enemy troops a side remembers but can't see right now, where it last saw them
export const getRememberedEnemies = (state: GameState, side: PlayerType): Sighting[] => {
  if (!isFogOfWar(state)) return [];
  const visible = new Set(getVisibleEnemies(state, side).map(unit => unit.id));
  return (state.sightings?.[side] ?? []).filter(sighting => !visible.has(sighting.unit.id));
};

export const updateHex = (state: GameState, coordinates: HexCoordinates, patch: Partial<Hex>): void => {
  const index = state.hexGrid.findIndex(h => coordsEqual(h.coordinates, coordinates));
  if (index !== -1) {
    state.hexGrid[index] = { ...state.hexGrid[index], ...patch };
  }
};

const MAX_LOG_ENTRIES = 40;

// Record an event for the player to read in the battle log
export const addLog = (state: GameState, side: PlayerType | 'neutral', text: string): void => {
  const log = state.log ?? [];
  const id = (log[log.length - 1]?.id ?? 0) + 1;
  state.log = [...log, { id, turn: state.turnNumber, side, text }].slice(-MAX_LOG_ENTRIES);
};

const earnGold = (state: GameState, side: PlayerType, amount: number): void => {
  if (amount <= 0) return;
  state.players[side].points += amount;
  sideStats(state, side).goldEarned += amount;
};

export const createUnit = (type: UnitType, owner: PlayerType, position: HexCoordinates, stats: TroopStats, isBoss = false): Unit => ({
  id: `unit-${uuidv4()}`,
  type,
  owner,
  position,
  movementRange: stats.movementRange,
  attackPower: stats.attackPower,
  lifespan: stats.maxLifespan,
  maxLifespan: stats.maxLifespan,
  cost: stats.cost,
  abilities: [...stats.abilities],
  level: stats.level,
  isBoss: isBoss || undefined,
  // Freshly deployed units can't move until their next turn
  hasMoved: true,
  isEngagedInCombat: false
});

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
  // Castles aren't built on lava or cursed ground
  if (TERRAIN_EFFECTS[hex.terrain].damagePerTurn) return false;

  return countOpenNeighbors(hexGrid, hex.coordinates) >= MIN_OPEN_BASE_NEIGHBORS;
};

export const getValidBaseLocations = (state: GameState): Hex[] => {
  const { gridSize } = getSettings(state);
  return state.hexGrid.filter(hex => isValidBaseLocation(state.hexGrid, hex, gridSize));
};

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
    // Camps don't replace gold mines or healing springs
    if (hex.isBase || hex.isResourceHex || isImpassable(hex) || TERRAIN_EFFECTS[hex.terrain].healPerTurn) return false;
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

// Place the player's base and an AI base as far away as possible, add the neutral camps,
// then start the first turn
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
  const castleHealth = getSettings(state).castleHealth ?? BASE_MAX_HEALTH;

  for (const [hex, owner] of [[playerHex, 'player'], [aiHex, 'ai']] as const) {
    updateHex(newState, hex.coordinates, { isBase: true, owner, baseHealth: castleHealth });
    newState.players[owner] = {
      ...newState.players[owner],
      baseLocation: hex.coordinates,
      baseHealth: castleHealth,
      maxBaseHealth: castleHealth
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
  addLog(startedState, 'neutral', 'The battle begins! Play your cards and march on the enemy castle.');

  return startedState;
};

// Pick the player's castle spot automatically: the valid edge hex nearest the bottom middle of the map,
// so every battle starts straight away
export const autoPlaceBases = (state: GameState): GameState => {
  const { gridSize } = getSettings(state);
  const target = { q: -Math.floor(gridSize / 2), r: gridSize };
  const choices = getValidBaseLocations(state)
    .sort((a, b) => getHexDistance(a.coordinates, target) - getHexDistance(b.coordinates, target) ||
      countOpenNeighbors(state.hexGrid, b.coordinates) - countOpenNeighbors(state.hexGrid, a.coordinates));
  for (const hex of choices) {
    const placed = placeBases(state, hex.coordinates);
    if (placed !== state) return placed;
  }
  return state;
};

// How many castle sites the player chooses between, and how far apart they must be
const CASTLE_CHOICE_COUNT = 3;
const MIN_CASTLE_CHOICE_SPACING = 2;

// The sites the player may build their castle on: valid spots along their own (southern) edge, spread
// out so each makes for a different battle - the usual spot near the middle first, then the ones
// furthest from the sites already picked. Each leaves room for the enemy castle across the map.
export const getCastleChoices = (state: GameState): HexCoordinates[] => {
  const { gridSize } = getSettings(state);
  const target = { q: -Math.floor(gridSize / 2), r: gridSize };
  const usable = getValidBaseLocations(state).filter(hex => hex.coordinates.r > 0 && placeBases(state, hex.coordinates) !== state);
  // The southern stretch of the edge, so every site is clearly on the player's side (and on screen)
  const southern = usable.filter(hex => hex.coordinates.r >= Math.ceil(gridSize / 2));
  const candidates = (southern.length >= 2 ? southern : usable)
    .sort((a, b) => getHexDistance(a.coordinates, target) - getHexDistance(b.coordinates, target) ||
      countOpenNeighbors(state.hexGrid, b.coordinates) - countOpenNeighbors(state.hexGrid, a.coordinates))
    .map(hex => hex.coordinates);
  const chosen: HexCoordinates[] = candidates.slice(0, 1);
  while (chosen.length < CASTLE_CHOICE_COUNT) {
    let best: HexCoordinates | undefined;
    let bestSpacing = MIN_CASTLE_CHOICE_SPACING - 1;
    for (const candidate of candidates) {
      const spacing = Math.min(...chosen.map(c => getHexDistance(c, candidate)));
      if (spacing > bestSpacing) {
        bestSpacing = spacing;
        best = candidate;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen;
};

// Build the player's castle on one of the offered sites: the enemy castle goes up across the map,
// its guards take their posts and the first turn begins
export const chooseCastle = (state: GameState, coordinates: HexCoordinates): GameState => {
  if (state.currentPhase !== 'setup' || !state.castleChoices?.some(c => coordsEqual(c, coordinates))) return state;
  const cleared: GameState = { ...state, castleChoices: undefined, pendingGuards: undefined };
  const placed = placeBases(cleared, coordinates);
  if (placed === cleared) return state;
  return placeGuards(placed, state.pendingGuards ?? []);
};

// Post the enemy's starting guards (bosses) on open hexes in front of its castle
export const placeGuards = (state: GameState, guards: GuardSpec[]): GameState => {
  if (guards.length === 0) return state;
  const aiBase = findBaseHex(state, 'ai');
  const playerBase = findBaseHex(state, 'player');
  if (!aiBase || !playerBase) return state;

  const newState = cloneState(state);
  const occupied = new Set(newState.players.ai.units.map(u => coordKey(u.position)));
  // Close to the castle and facing the player, but leaving room next to the castle for recruits
  const spots = newState.hexGrid
    .filter(hex => !hex.isBase && !hex.isCamp && !hex.isResourceHex && !isImpassable(hex) &&
      !TERRAIN_EFFECTS[hex.terrain].damagePerTurn &&
      getHexDistance(hex.coordinates, aiBase.coordinates) <= 2)
    .sort((a, b) =>
      Math.abs(getHexDistance(a.coordinates, aiBase.coordinates) - 2) - Math.abs(getHexDistance(b.coordinates, aiBase.coordinates) - 2) ||
      getHexDistance(a.coordinates, playerBase.coordinates) - getHexDistance(b.coordinates, playerBase.coordinates));

  for (const guard of guards) {
    const spot = spots.find(hex => !occupied.has(coordKey(hex.coordinates)));
    if (!spot) break;
    occupied.add(coordKey(spot.coordinates));
    const unit = createUnit(guard.type, 'ai', spot.coordinates, guard.stats, guard.isBoss);
    unit.hasMoved = false;
    newState.players.ai.units.push(unit);
    if (guard.isBoss) addLog(newState, 'ai', `${getTroopName(guard.type)} guards the enemy castle!`);
  }
  syncHexUnits(newState);
  noteSightings(newState);
  return newState;
};

// ---------------------------------------------------------------------------
// Planning phase - purchases
// ---------------------------------------------------------------------------

// Only the side whose turn it is may queue orders, and only while planning
export const canGiveOrders = (state: GameState, player: Player) =>
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

// Move a played card to the bottom of the deck (a deck no bigger than the hand stays as it is)
const cycleCard = (deck: UnitType[], type: UnitType): UnitType[] => {
  const index = deck.indexOf(type);
  if (index === -1 || deck.length <= HAND_SIZE) return deck;
  return [...deck.slice(0, index), ...deck.slice(index + 1), type];
};

// Put a cancelled card back on top of the deck, into the hand
const returnCard = (deck: UnitType[], type: UnitType): UnitType[] => {
  const index = deck.lastIndexOf(type);
  if (index === -1 || deck.length <= HAND_SIZE) return deck;
  return [type, ...deck.slice(0, index), ...deck.slice(index + 1)];
};

// Queue a unit purchase. Gold is deducted immediately and refunded if the purchase is cancelled.
// The player can only play cards in their hand; a played card goes to the bottom of the deck.
export const addPendingPurchase = (
  state: GameState,
  playerId: string,
  unitType: UnitType,
  position: HexCoordinates
): GameState => {
  const player = findPlayerById(state, playerId);
  if (!player || !canGiveOrders(state, player)) return state;
  const stats = getRosterStats(state, player.type, unitType);
  if (!stats || player.points < stats.cost) return state;

  const usesDeck = player.type === 'player' && !!state.deck;
  if (usesDeck && !getHand(state).includes(unitType)) return state;

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
    deck: usesDeck ? cycleCard(state.deck!, unitType) : state.deck,
    players: {
      ...state.players,
      [player.type]: { ...player, points: player.points - stats.cost }
    }
  };
};

// Cancel a queued purchase and refund its cost; the card goes back into the hand
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
  const cost = getRosterStats(state, player.type, purchase.unitType)?.cost ?? 0;

  return {
    ...state,
    pendingPurchases: state.pendingPurchases.filter(p => p !== purchase),
    deck: player.type === 'player' && state.deck ? returnCard(state.deck, purchase.unitType) : state.deck,
    players: {
      ...state.players,
      [player.type]: { ...player, points: player.points + cost }
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

// What it costs a particular unit to enter a hex: flyers pay 1 for anything (even water and
// mountains, which they can cross but not stop on), pathfinders pay 1 for rough ground
export const unitEnterCost = (unit: { abilities: Ability[] }, hex: Hex): number => {
  if (hasAbility(unit, 'flying')) return 1;
  const effect = TERRAIN_EFFECTS[hex.terrain];
  if (effect.moveCost === null) return Infinity;
  if (effect.isRough && hasAbility(unit, 'pathfinder')) return 1;
  return effect.moveCost;
};

// Cheapest-path search over the board. By default entering a hex costs its terrain's movement cost.
// `canEnter` decides which hexes may be walked through at all.
const searchPaths = (
  hexGrid: Hex[],
  start: HexCoordinates,
  maxCost: number,
  canEnter: (hex: Hex) => boolean,
  stepCost: StepCost = enterCost,
  // Whether a unit may carry on from a hex it reached (zones of control stop it)
  canLeave: (hex: Hex) => boolean = () => true
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
    if (current.previous !== null && currentHex && !canLeave(currentHex)) continue;

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

// Flyers pass over enemy lines; everyone else stops when they step next to an enemy
export const ignoresZoneOfControl = (unit: { abilities: Ability[] }) => hasAbility(unit, 'flying');

// Hexes next to any of these units
const zoneOfControl = (units: Unit[]): Set<string> =>
  new Set(units.flatMap(unit => getNeighbors(unit.position).map(coordKey)));

// Where a unit can walk this turn, as far as its side can tell: it can't cross water or mountains
// (unless it flies), can pass through friendly units but not the enemy units it can see, stops when
// it steps next to one of them, and rough terrain costs extra movement. A unit can always take a
// single step onto a neighbouring hex, however rough, using all its movement.
const getReachableHexes = (state: GameState, unit: Unit) => {
  const enemies = getVisibleEnemies(state, unit.owner);
  const enemyHexes = new Set(enemies.map(enemy => coordKey(enemy.position)));
  const zone = ignoresZoneOfControl(unit) ? new Set<string>() : zoneOfControl(enemies);
  return searchPaths(
    state.hexGrid,
    unit.position,
    unit.movementRange,
    hex => (hasAbility(unit, 'flying') || !isImpassable(hex)) && !enemyHexes.has(coordKey(hex.coordinates)),
    (from, to) => {
      const cost = unitEnterCost(unit, to);
      return coordsEqual(from.coordinates, unit.position) ? Math.min(cost, unit.movementRange) : cost;
    },
    hex => !zone.has(coordKey(hex.coordinates))
  );
};

// Whether a hex is next to one of the enemy units this side can see (a troop stepping there stops)
export const isInEnemyZone = (state: GameState, side: PlayerType, coordinates: HexCoordinates): boolean =>
  getVisibleEnemies(state, side).some(enemy => getHexDistance(enemy.position, coordinates) === 1);

// All hexes a unit can legally be ordered to move to this turn.
// Units can't end on an occupied hex, impassable ground, either castle, or a hex another order
// already reserved. A hex one of its own side's troops has been
// ordered to leave counts as free: that troop moves out first.
export const getValidMoveTargets = (state: GameState, unit: Unit): HexCoordinates[] => {
  if (unit.hasMoved) return [];

  const reserved = new Set([
    ...state.pendingPurchases.map(p => coordKey(p.position)),
    ...state.pendingMoves.filter(m => m.unitId !== unit.id).map(m => coordKey(m.to))
  ]);
  // Troops of its side ordered away, unless following their moves leads back to this unit's hex (two
  // troops can't swap places: neither could go first)
  const moveOf = new Map(state.pendingMoves.filter(m => m.unitId !== unit.id).map(m => [m.unitId, m]));
  const ownAt = new Map(state.players[unit.owner].units.map(u => [coordKey(u.position), u]));
  const leadsBack = (leaverId: string): boolean => {
    const seen = new Set<string>();
    for (let id: string | undefined = leaverId; id && !seen.has(id);) {
      seen.add(id);
      const move = moveOf.get(id);
      if (!move) return false;
      if (coordsEqual(move.to, unit.position)) return true;
      id = ownAt.get(coordKey(move.to))?.id;
    }
    return false;
  };
  const leaving = new Set([...moveOf.keys()].filter(id => !leadsBack(id)));
  const hexByKey = new Map(state.hexGrid.map(hex => [coordKey(hex.coordinates), hex]));

  const targets: HexCoordinates[] = [];
  for (const [key, entry] of getReachableHexes(state, unit)) {
    const hex = hexByKey.get(key);
    if (!hex || entry.cost === 0 || isImpassable(hex)) continue;

    const occupant = hex.unit && !(hex.unit.owner === unit.owner && leaving.has(hex.unit.id)) ? hex.unit : undefined;
    if (occupant && occupant.owner === unit.owner) continue;
    if (!(occupant && isUnitVisibleTo(state, unit.owner, occupant)) && !hex.isBase && !reserved.has(key)) {
      targets.push(hex.coordinates);
    }
  }

  return targets;
};

// The route a unit would walk to reach a hex this turn (including its start), or null
export const getMovePath = (state: GameState, unit: Unit, to: HexCoordinates): HexCoordinates[] | null =>
  buildPath(getReachableHexes(state, unit), to);

// Route between two hexes, ignoring units (used to animate movement). Flyers go straight over obstacles.
export const findTerrainPath = (hexGrid: Hex[], from: HexCoordinates, to: HexCoordinates, flying = false): HexCoordinates[] => {
  const reached = searchPaths(hexGrid, from, Infinity, hex => flying || !isImpassable(hex), flying ? () => 1 : enterCost);
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

// Cancel a unit's queued move. The unit now stays put, so a recruit queued on its hex, or another
// troop ordered onto it (allowed because the unit was leaving), is cancelled as well.
export const cancelPendingMove = (state: GameState, unitId: string): GameState => {
  const move = state.pendingMoves.find(m => m.unitId === unitId);
  if (!move) return state;

  const withoutMove: GameState = {
    ...state,
    pendingMoves: state.pendingMoves.filter(m => m !== move)
  };
  const following = withoutMove.pendingMoves.find(m => coordsEqual(m.to, move.from));
  const settled = following ? cancelPendingMove(withoutMove, following.unitId) : withoutMove;
  return cancelPendingPurchase(settled, move.playerId, move.from);
};

// ---------------------------------------------------------------------------
// Execution phase
// ---------------------------------------------------------------------------

const endGame = (state: GameState, winner: PlayerType, reason: WinReason): GameState =>
  ({ ...state, winner, winReason: reason, currentPhase: 'gameOver', combats: [], siege: undefined });

// Execute all pending moves and then purchases, then either start combat or end the turn
export const executeMoves = (state: GameState): GameState => {
  if (state.currentPhase !== 'planning') return state;

  const newState = cloneState(state);
  const activePlayer = getActivePlayer(newState);
  const occupied = new Set(
    [...newState.players.player.units, ...newState.players.ai.units].map(u => coordKey(u.position))
  );
  const recruited: Unit[] = [];
  for (const unit of [...newState.players.player.units, ...newState.players.ai.units]) unit.ambushed = false;
  // Pegasus Knights and the hexes they flew over on the way (Strafe)
  const strafes: { unit: Unit; path: HexCoordinates[] }[] = [];

  // Move units first, so recruits can be deployed on the hexes they leave. Each walks the route its
  // side planned; in the fog it may run into enemies it couldn't see, which stops it short (an ambush).
  let movedCount = 0;
  // A troop moving onto a hex another is leaving goes after it: moves run in passes, each taking the
  // moves whose destination is free by then (if the troop ahead is stopped short, it backs off)
  const ordered: Move[] = [];
  let remaining = [...state.pendingMoves];
  const plannedAt = new Map([...newState.players.player.units, ...newState.players.ai.units].map(u => [u.id, coordKey(u.position)]));
  while (remaining.length > 0) {
    const stillThere = new Set(remaining.map(m => plannedAt.get(m.unitId)));
    const ready = remaining.filter(m => !stillThere.has(coordKey(m.to)) || plannedAt.get(m.unitId) === coordKey(m.to));
    const batch = ready.length > 0 ? ready : remaining;
    ordered.push(...batch);
    remaining = remaining.filter(m => !batch.includes(m));
  }
  for (const move of ordered) {
    const player = findPlayerById(newState, move.playerId);
    if (!player) continue;

    const unit = newState.players[player.type].units.find(u => u.id === move.unitId);
    if (!unit || unit.hasMoved) continue;

    const planned = state.players[player.type].units.find(u => u.id === unit.id);
    const route = (planned && getMovePath(state, planned, move.to)) ?? [unit.position, move.to];
    const enemies = newState.players[getOpponent(player.type)].units;
    const enemyAt = new Map(enemies.map(enemy => [coordKey(enemy.position), enemy]));
    const zone = ignoresZoneOfControl(unit) ? new Set<string>() : zoneOfControl(enemies);

    let stop = route.length - 1;
    let ambusher: Unit | undefined;
    for (let step = 1; step < route.length; step++) {
      const key = coordKey(route[step]);
      if (enemyAt.has(key)) {
        stop = step - 1;
        ambusher = enemyAt.get(key);
        break;
      }
      if (zone.has(key) && step < route.length - 1) {
        stop = step;
        ambusher = enemies.find(enemy => getHexDistance(enemy.position, route[step]) === 1);
        break;
      }
    }
    // Back off along the route to a hex the unit can stand on (never a castle)
    const canEndAt = (index: number) => {
      const hex = findHexByCoordinates(newState.hexGrid, route[index]);
      if (!hex || isImpassable(hex) || occupied.has(coordKey(route[index]))) return false;
      return !hex.isBase;
    };
    while (stop > 0 && !canEndAt(stop)) stop--;
    if (ambusher) {
      ambusher.revealed = true;
      unit.ambushed = true;
      sideStats(newState, player.type).ambushed = (sideStats(newState, player.type).ambushed ?? 0) + 1;
      addLog(newState, getOpponent(player.type), player.type === 'player'
        ? `Ambush! Your ${getTroopName(unit.type)} ran into a hidden ${getTroopName(ambusher.type)}.`
        : `The enemy ${getTroopName(unit.type)} stumbled onto your hidden ${getTroopName(ambusher.type)}.`);
    }
    const destination = route[stop];
    if (stop === 0 || coordsEqual(destination, unit.position)) continue;

    occupied.delete(coordKey(unit.position));
    occupied.add(coordKey(destination));
    unit.position = destination;
    unit.hasMoved = true;
    unit.movedHexes = stop;
    movedCount++;
    if (rankOf(unit, 'strafe') > 0 && stop > 1) strafes.push({ unit, path: route.slice(1, stop) });
  }

  // Strafe: every enemy a Pegasus Knight flew past takes damage
  for (const { unit, path } of strafes) {
    const rank = rankOf(unit, 'strafe');
    const enemySide = getOpponent(unit.owner);
    const passed = newState.players[enemySide].units.filter(enemy =>
      path.some(step => getHexDistance(step, enemy.position) <= 1));
    if (passed.length === 0) continue;
    let destroyed = 0;
    for (const enemy of passed) {
      const result = inflictDamage(newState, enemy, strafeDamage(rank), unit.owner);
      if (result.destroyed) {
        destroyed++;
        occupied.delete(coordKey(enemy.position));
      }
    }
    addLog(newState, unit.owner, `${unitLabel(unit)} strafed ${passed.length} ${passed.length === 1 ? 'enemy' : 'enemies'} on the way` +
      ` (${strafeDamage(rank)} damage each${destroyed > 0 ? `, ${destroyed} destroyed` : ''}).`);
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
      sideStats(newState, side).campsCaptured++;
    }
  }

  // Then spawn purchased units
  for (const purchase of state.pendingPurchases) {
    const player = findPlayerById(newState, purchase.playerId);
    if (!player) continue;

    const stats = getRosterStats(newState, player.type, purchase.unitType);
    const hex = findHexByCoordinates(newState.hexGrid, purchase.position);
    if (!stats) continue;

    const isValidPlacement =
      hex &&
      !hex.isBase &&
      !isImpassable(hex) &&
      !occupied.has(coordKey(purchase.position)) &&
      isDeploymentSpot(newState, player.type, hex.coordinates);

    if (!isValidPlacement) {
      // Refund purchases that can no longer be placed, e.g. the hex is still occupied
      // (gold was deducted when queued)
      newState.players[player.type].points += stats.cost;
      continue;
    }

    const newUnit = createUnit(purchase.unitType, player.type, purchase.position, stats);
    newState.players[player.type].units.push(newUnit);
    occupied.add(coordKey(newUnit.position));
    recruited.push(newUnit);

    const stats_ = sideStats(newState, player.type);
    stats_.recruited++;
    stats_.played[newUnit.type] = (stats_.played[newUnit.type] ?? 0) + 1;
  }

  newState.pendingMoves = [];
  newState.pendingPurchases = [];
  syncHexUnits(newState);
  noteSightings(newState);

  if (recruited.length > 0) {
    const names = recruited.map(u => getTroopName(u.type)).join(', ');
    addLog(newState, activePlayer, `${activePlayer === 'player' ? 'You' : 'The enemy'} deployed ${names}.`);
  }
  if (movedCount > 0) {
    addLog(
      newState,
      activePlayer,
      `${activePlayer === 'player' ? 'You' : 'The enemy'} moved ${movedCount} ${movedCount === 1 ? 'unit' : 'units'}.`
    );
  }

  // Every unit of the side that just moved attacks one enemy unit within its reach; the rest attack
  // the enemy castle if they can reach it
  const combats = detectCombat(newState, activePlayer);
  const siege = detectSiege(newState, activePlayer, combats);
  // Troops in reach of an attacker strike back at it; fought after the turn's other battles
  combats.push(...detectIntercepts(newState, activePlayer, siege, combats));
  if (combats.length > 0) {
    addLog(
      newState,
      activePlayer,
      `${combats.length} ${combats.length === 1 ? 'battle breaks' : 'battles break'} out!`
    );
  }
  if (combats.length > 0 || siege) {
    syncHexUnits(newState);
    return { ...newState, combats, siege, currentPhase: 'combat' };
  }

  return finishTurn(newState);
};

const terrainUnder = (state: GameState, unit: Unit): TerrainType =>
  findHexByCoordinates(state.hexGrid, unit.position)?.terrain ?? 'plain';

export const getElevation = (terrain: TerrainType) => TERRAIN_EFFECTS[terrain].elevation;

// How far a unit can strike from the terrain it stands on: ranged units reach 2 hexes (3 with long
// range), one more from high ground; everyone else 1
export const getAttackRange = (unit: { abilities: Ability[] }, terrain: TerrainType = 'plain'): number =>
  hasAbility(unit, 'rangedAttack')
    ? RANGED_ATTACK_RANGE + (hasAbility(unit, 'longRange') ? 1 : 0) + (getElevation(terrain) >= HIGH_GROUND_ELEVATION ? 1 : 0)
    : 1;

// A unit's reach where it stands right now
export const getUnitAttackRange = (state: GameState, unit: Unit): number =>
  getAttackRange(unit, terrainUnder(state, unit));

// Hexes a straight line between two hexes passes through, excluding both ends. The line is nudged
// slightly to one side; checking both nudges lets a shot squeeze between two hexes it grazes.
// The nudge differs on all three cube axes so it never lands exactly on a hex edge (no rounding ties).
const hexesBetween = (from: HexCoordinates, to: HexCoordinates, nudge: number): HexCoordinates[] => {
  const distance = getHexDistance(from, to);
  const a = { x: from.q + nudge, y: -from.q - from.r + 2 * nudge, z: from.r - 3 * nudge };
  const b = { x: to.q + nudge, y: -to.q - to.r + 2 * nudge, z: to.r - 3 * nudge };
  const hexes: HexCoordinates[] = [];
  for (let step = 1; step < distance; step++) {
    const t = step / distance;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;
    let rx = Math.round(x);
    const ry = Math.round(y);
    let rz = Math.round(z);
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    const dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dz > dy) rz = -rx - ry;
    hexes.push({ q: rx, r: rz });
  }
  return hexes;
};

// Whether a ranged unit can see its target: a hex in between blocks the shot if it stands higher than
// both ends (forest canopies and ruined walls count one level higher). So ridges and forests hide units
// from archers on lower ground, mountains block every shot, and archers on high ground shoot over the trees.
export const hasLineOfSight = (hexGrid: Hex[], from: HexCoordinates, to: HexCoordinates): boolean => {
  const heightAt = (c: HexCoordinates) => {
    const hex = findHexByCoordinates(hexGrid, c);
    if (!hex) return 0;
    const effect = TERRAIN_EFFECTS[hex.terrain];
    return effect.sightHeight ?? effect.elevation;
  };
  const endHeight = (c: HexCoordinates) => {
    const hex = findHexByCoordinates(hexGrid, c);
    return hex ? getElevation(hex.terrain) : 0;
  };
  const eyeLevel = Math.max(endHeight(from), endHeight(to));
  const isClear = (line: HexCoordinates[]) => line.every(c => heightAt(c) <= eyeLevel);
  return isClear(hexesBetween(from, to, 1e-6)) || isClear(hexesBetween(from, to, -1e-6));
};

// Whether an attacker can strike a target from where both stand: within reach and, for shots beyond
// the next hex, with a clear line of sight (spells arc over anything)
export const canStrike = (state: GameState, attacker: Unit, target: Unit): boolean => {
  const distance = getHexDistance(attacker.position, target.position);
  if (distance > getUnitAttackRange(state, attacker)) return false;
  if (distance <= 1) return true;
  // Smoke hides its hexes from anything further away
  if (isSmoked(state, target.position)) return false;
  if (hasAbility(attacker, 'magic')) return true;
  return hasLineOfSight(state.hexGrid, attacker.position, target.position);
};

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

export const isFogOfWar = (state: GameState) => !!getSettings(state).fogOfWar;

// How far a unit sees: scouts (skirmishers and flyers) and anything on high ground see further
export const getSightRange = (state: GameState, unit: Unit): number =>
  SIGHT_RANGE +
  (getTroopClass(unit.type) === 'skirmisher' || hasAbility(unit, 'flying') ? SCOUT_SIGHT_BONUS : 0) +
  (getElevation(terrainUnder(state, unit)) >= HIGH_GROUND_ELEVATION ? HIGH_GROUND_SIGHT_BONUS : 0);

// Everything that keeps watch for a side: its troops, its castle and the camps it holds
const lookoutsOf = (state: GameState, side: PlayerType): { position: HexCoordinates; range: number }[] => {
  const castle = findBaseHex(state, side);
  return [
    ...state.players[side].units.map(unit => ({ position: unit.position, range: getSightRange(state, unit) })),
    ...(castle ? [{ position: castle.coordinates, range: CASTLE_SIGHT }] : []),
    ...getOwnedCamps(state, side).map(camp => ({ position: camp.coordinates, range: CAMP_SIGHT }))
  ];
};

// Whether a lookout can see a troop standing on a hex: within its sight and line of sight, and
// right next to it if the hex hides troops (forest)
const canSpot = (state: GameState, from: HexCoordinates, range: number, target: HexCoordinates): boolean => {
  const distance = getHexDistance(from, target);
  if (distance <= 1) return true;
  if (distance > range) return false;
  const hex = findHexByCoordinates(state.hexGrid, target);
  if (hex && TERRAIN_EFFECTS[hex.terrain].conceals) return false;
  return hasLineOfSight(state.hexGrid, from, target);
};

// Whether a side can see a unit: always its own, and enemies its lookouts spot (or that gave
// themselves away this turn)
export const isUnitVisibleTo = (state: GameState, side: PlayerType, unit: Unit): boolean =>
  unit.owner === side || !isFogOfWar(state) || !!unit.revealed ||
  lookoutsOf(state, side).some(lookout => canSpot(state, lookout.position, lookout.range, unit.position));

export const getVisibleEnemies = (state: GameState, side: PlayerType): Unit[] => {
  const enemies = state.players[getOpponent(side)].units;
  if (!isFogOfWar(state)) return enemies;
  const lookouts = lookoutsOf(state, side);
  return enemies.filter(unit =>
    unit.revealed || lookouts.some(lookout => canSpot(state, lookout.position, lookout.range, unit.position)));
};

// The hexes where a side would spot an enemy troop (everything, without fog)
export const getVisibleHexKeys = (state: GameState, side: PlayerType): Set<string> => {
  if (!isFogOfWar(state)) return new Set(state.hexGrid.map(hex => coordKey(hex.coordinates)));
  const lookouts = lookoutsOf(state, side);
  return new Set(state.hexGrid
    .filter(hex => lookouts.some(lookout => canSpot(state, lookout.position, lookout.range, hex.coordinates)))
    .map(hex => coordKey(hex.coordinates)));
};

// The board as one side knows it: enemy troops it can't see are left out, or - with `remember` - shown
// where it last saw them. The AI plans on this (remembering), so it plays by the same fog as the player.
export const getSideView = (state: GameState, side: PlayerType, remember = false): GameState => {
  if (!isFogOfWar(state)) return state;
  const opponent = getOpponent(side);
  const visible = getVisibleEnemies(state, side);
  const occupied = new Set([...state.players[side].units, ...visible].map(unit => coordKey(unit.position)));
  const remembered = remember
    ? getRememberedEnemies(state, side).map(sighting => sighting.unit).filter(unit => {
      const free = !occupied.has(coordKey(unit.position));
      occupied.add(coordKey(unit.position));
      return free;
    })
    : [];
  if (visible.length === state.players[opponent].units.length && remembered.length === 0) return state;
  const units = [...visible, ...remembered];
  const at = new Map(units.map(unit => [coordKey(unit.position), unit]));
  return {
    ...state,
    players: { ...state.players, [opponent]: { ...state.players[opponent], units } },
    hexGrid: state.hexGrid.map(hex => {
      const key = coordKey(hex.coordinates);
      if (hex.unit && hex.unit.owner === side) return hex;
      const unit = at.get(key);
      return hex.unit === unit ? hex : { ...hex, unit };
    })
  };
};

// The other troops attacking the same enemy alongside an attacker, up to MAX_FLANKERS: flanking
// needs at least two attackers on one target
export const getFlankers = (attackersOnTarget: number): number =>
  Math.min(MAX_FLANKERS, Math.max(0, attackersOnTarget - 1));

const isEnraged = (unit: Unit) => hasAbility(unit, 'berserk') && unit.lifespan * 2 <= unit.maxLifespan;

// Attack power before the matchup: Pikemen (terrainBonus) strike harder from a forest, berserkers
// when badly hurt
const getBasePower = (unit: Unit, terrain: TerrainType): number =>
  unit.attackPower *
  (hasAbility(unit, 'terrainBonus') && terrain === 'forest' ? TERRAIN_BONUS_ATTACK_MULTIPLIER : 1) *
  (isEnraged(unit) ? BERSERK_ATTACK_MULTIPLIER : 1);

// Damage multiplier from standing higher (or lower) than the target, by how much taller the
// attacker's hex is (negative when it stands lower), to the nearest whole percent
export const getHeightMultiplier = (heightDifference: number): number => {
  const percent = Math.round(heightDifference * HEIGHT_DAMAGE_PER_UNIT * 100);
  const capped = Math.max(-MAX_HEIGHT_BONUS * 100, Math.min(MAX_HEIGHT_BONUS * 100, percent));
  return 1 + capped / 100;
};

// How tall the hex at a position stands right now, earthworks and digging included
export const getHeightOfHex = (state: GameState, at: HexCoordinates): number =>
  getHexHeightOf(findHexByCoordinates(state.hexGrid, at) ?? { coordinates: at, terrain: 'plain' });

// How much taller the hex at `from` stands than the hex at `to`
export const getHeightDifference = (state: GameState, from: HexCoordinates, to: HexCoordinates): number =>
  getHeightOfHex(state, from) - getHeightOfHex(state, to);

// Counters: each troop class hits some others extra hard (see COUNTERS in troops.ts)
export const getCounterMultiplier = (attacker: UnitType, target: UnitType): number =>
  getClassCounter(getTroopClass(attacker), getTroopClass(target));

// Cover protects against everything except spells; Longbowmen's piercing arrows ignore part of it
const getCoverMultiplier = (attacker: Unit, targetTerrain: TerrainType): number => {
  if (hasAbility(attacker, 'magic')) return 1;
  const cover = TERRAIN_EFFECTS[targetTerrain].damageTakenMultiplier;
  return 1 - (1 - cover) * (1 - piercingShare(rankOf(attacker, 'piercingShot')));
};

// War Clerics smite the undead and demons
const getSmiteMultiplier = (attacker: Unit, target: Unit): number => {
  const rank = rankOf(attacker, 'holySmite');
  return rank > 0 && isSmitable(target.type) ? 1 + holySmiteBonus(rank) : 1;
};

// Ranged units fight poorly at arm's length
export const getPointBlankMultiplier = (attacker: Unit, distance: number): number =>
  hasAbility(attacker, 'rangedAttack') && distance <= 1 ? RANGED_POINT_BLANK_MULTIPLIER : 1;

// Damage one unit's attacks would deal to a particular target when the two stand on the given
// terrain, before rounding: base power, height difference, counters, the target's cover and
// point-blank range. Exported so the AI can weigh up fights from hexes the units haven't moved to yet.
// `heightDifference` is how much taller the attacker's hex is; when the hexes aren't known it is
// taken from the two terrains' typical heights.
export const getStrikePowerOnTerrain = (
  attacker: Unit,
  attackerTerrain: TerrainType,
  target: Unit,
  targetTerrain: TerrainType,
  distance: number,
  heightDifference = getTerrainHeight(attackerTerrain) - getTerrainHeight(targetTerrain)
): number =>
  getBasePower(attacker, attackerTerrain) *
  getHeightMultiplier(heightDifference) *
  getCounterMultiplier(attacker.type, target.type) *
  getCoverMultiplier(attacker, targetTerrain) *
  getPointBlankMultiplier(attacker, distance) *
  getSmiteMultiplier(attacker, target);

// --- Signature abilities and tactic cards in a fight ---------------------------------------

export const getEffects = (state: GameState, kind: BattleEffectKind): BattleEffect[] =>
  (state.effects ?? []).filter(effect => effect.kind === kind);

const unitEffect = (state: GameState, kind: BattleEffectKind, unitId: string): BattleEffect | undefined =>
  state.effects?.find(effect => effect.kind === kind && effect.unitId === unitId);

// Whether smoke hangs over a hex (nothing in it can be shot at from 2 or more hexes away)
export const isSmoked = (state: GameState, at: HexCoordinates): boolean =>
  getEffects(state, 'smoke').some(effect => effect.hexes?.includes(coordKey(at)));

// Whether a unit strikes from the shadows this turn (Shadowstep): its target can't strike back
export const isShadowstepping = (state: GameState, unit: Unit): boolean => !!unitEffect(state, 'shadowstep', unit.id);

export interface SituationalBonus {
  label: string;
  multiplier: number;
}

// The attack bonuses a unit gets from where it stands and what it has done this turn: its signature
// ability (beside friends, alone, standing still, after a charge, on the enemy's turn, far from the
// enemy) and tactic cards (Rally, Shadowstep). `at` is where it strikes from and `movedHexes` how far
// it walked to get there, so the AI can ask about hexes a unit hasn't moved to yet.
export const getSituationalBonuses = (
  state: GameState,
  attacker: Unit,
  at: HexCoordinates = attacker.position,
  movedHexes = attacker.movedHexes ?? 0
): SituationalBonus[] => {
  const bonuses: SituationalBonus[] = [];
  const ownTurn = getActivePlayer(state) === attacker.owner;
  const allies = state.players[attacker.owner].units.filter(unit => unit.id !== attacker.id);
  const enemies = state.players[getOpponent(attacker.owner)].units;
  const add = (label: string, bonus: number) => {
    if (bonus > 0) bonuses.push({ label, multiplier: 1 + bonus });
  };

  let rank = rankOf(attacker, 'shoulderToShoulder');
  if (rank > 0) {
    const beside = Math.min(SHOULDER_MAX_ALLIES, allies.filter(ally => getHexDistance(ally.position, at) === 1).length);
    add('Shoulder to Shoulder', shoulderBonusPerAlly(rank) * beside);
  }
  rank = rankOf(attacker, 'steadyAim');
  if (rank > 0 && movedHexes === 0) add('Steady Aim', steadyAimBonus(rank));
  rank = rankOf(attacker, 'brace');
  if (rank > 0 && !ownTurn) add('Brace', braceBonus(rank));
  rank = rankOf(attacker, 'loneBlade');
  if (rank > 0 && !allies.some(ally => getHexDistance(ally.position, at) <= LONE_BLADE_RADIUS)) add('Lone Blade', loneBladeBonus(rank));
  rank = rankOf(attacker, 'charge');
  if (rank > 0 && ownTurn && movedHexes >= CHARGE_DISTANCE) add('Charge', chargeBonus(rank));
  rank = rankOf(attacker, 'eyeOfTheStorm');
  if (rank > 0 && !enemies.some(enemy => getHexDistance(enemy.position, at) <= EYE_OF_STORM_RADIUS)) add('Eye of the Storm', eyeOfStormBonus(rank));

  if (ownTurn) {
    // Rallies played this turn add up
    add('Rally', getEffects(state, 'rally').filter(effect => effect.side === attacker.owner).reduce((sum, effect) => sum + effect.value, 0));
    const shadow = unitEffect(state, 'shadowstep', attacker.id);
    if (shadow) add('Shadowstep', shadow.value);
  }
  return bonuses;
};

export const getSituationalMultiplier = (state: GameState, attacker: Unit, at?: HexCoordinates, movedHexes?: number): number =>
  getSituationalBonuses(state, attacker, at, movedHexes).reduce((product, bonus) => product * bonus.multiplier, 1);

export interface Protection {
  label: string;
  // Share of the damage it stops
  reduction: number;
}

// What shields a unit standing at `at` from damage: a friendly Mage's Ward beside it, and Bulwark
export const getProtections = (state: GameState, unit: Unit, at: HexCoordinates = unit.position): Protection[] => {
  const protections: Protection[] = [];
  const ward = Math.max(0, ...state.players[unit.owner].units
    .filter(ally => ally.id !== unit.id && getHexDistance(ally.position, at) === 1)
    .map(ally => wardReduction(rankOf(ally, 'ward'))));
  if (ward > 0) protections.push({ label: 'Ward', reduction: ward });
  const bulwark = unitEffect(state, 'bulwark', unit.id);
  if (bulwark) protections.push({ label: 'Bulwark', reduction: bulwark.value });
  return protections;
};

export const getDamageTakenMultiplier = (state: GameState, unit: Unit, at?: HexCoordinates): number =>
  getProtections(state, unit, at).reduce((product, protection) => product * (1 - protection.reduction), 1);

// A strike where the two units actually stand, including flanking when `attackersOnTarget` troops
// (this one included) attack the target together, the attacker's situational bonuses and whatever
// shields the target
const getStrikePower = (state: GameState, attacker: Unit, target: Unit, attackersOnTarget = 1): number =>
  getStrikePowerOnTerrain(
    attacker, terrainUnder(state, attacker), target, terrainUnder(state, target),
    getHexDistance(attacker.position, target.position), getHeightDifference(state, attacker.position, target.position)
  ) * (1 + FLANK_BONUS * getFlankers(attackersOnTarget)) *
  getSituationalMultiplier(state, attacker) *
  getDamageTakenMultiplier(state, target);

// Split one unit's attack between the enemy units it can reach (each share already scaled for that
// enemy's height, counters and cover), then round the total and hand it out so the shares add up to it
// (leftover points go to the largest fractions, earliest unit first). Units out of reach take 0.
// An attack that connects always deals at least 1 in total.
const distributeDamage = (shares: (number | null)[]): number[] => {
  const reachable = shares.map((share, index) => share !== null ? index : -1).filter(index => index !== -1);
  if (reachable.length === 0) return shares.map(() => 0);

  const split = shares.map(share => share !== null ? share / reachable.length : 0);
  const total = Math.max(1, Math.round(split.reduce((sum, share) => sum + share, 0)));
  const damage = split.map(share => Math.floor(share));

  const order = [...reachable].sort((a, b) => (split[b] - damage[b]) - (split[a] - damage[a]) || a - b);
  let remainder = total - damage.reduce((sum, d) => sum + d, 0);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    damage[order[k]]++;
  }
  return damage;
};

// Armour soaks 1 damage from every fight, but a blow that lands always does at least 1
const applyArmor = (unit: Unit, damage: number) =>
  damage > 0 && hasAbility(unit, 'armored') ? Math.max(1, damage - ARMOR_REDUCTION) : damage;

const compareIds = (a: Unit, b: Unit) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Every unit of the attacking side strikes exactly one enemy within its reach: one it can finish off
// (together with the attackers that already picked it) if there is one, otherwise the weakest, then
// the nearest. Troops that can reach the enemy castle attack it instead unless they can finish an
// enemy off (see detectSiege). Each defender then fights one combat against the attackers that picked it, so no unit
// fights twice in a turn and the order the battles are fought in doesn't matter.
const detectCombat = (state: GameState, attackerSide: PlayerType): Combat[] => {
  const defenderSide = getOpponent(attackerSide);
  const enemies = state.players[defenderSide].units;
  const attackerUnits = state.players[attackerSide].units;

  const choices = attackerUnits
    .map(unit => ({ unit, targets: enemies.filter(enemy => canStrike(state, unit, enemy) && isUnitVisibleTo(state, attackerSide, enemy)) }))
    .filter(choice => choice.targets.length > 0)
    // Units with fewer options pick first, leaving the flexible ones to cover the rest
    .sort((a, b) => a.targets.length - b.targets.length || compareIds(a.unit, b.unit));

  // Damage already heading for each enemy from the attackers that picked it
  const assignedDamage = new Map<string, number>();
  const targetOf = new Map<string, string>();
  // How many attackers already picked each enemy (joining them flanks it)
  const attackersOn = new Map<string, number>();
  const dealt = (target: Unit, damage: number) => applyArmor(target, damage > 0 ? Math.max(1, Math.round(damage)) : 0);

  for (const { unit, targets } of choices) {
    const options = targets.map(target => {
      const assigned = assignedDamage.get(target.id) ?? 0;
      const strike = getStrikePower(state, unit, target, (attackersOn.get(target.id) ?? 0) + 1);
      const healthLeft = target.lifespan - dealt(target, assigned);
      return {
        target,
        strike,
        healthLeft,
        kills: healthLeft > 0 && target.lifespan - dealt(target, assigned + strike) <= 0,
        distance: getHexDistance(unit.position, target.position)
      };
    });

    options.sort((a, b) =>
      Number(b.kills) - Number(a.kills) ||
      // Don't waste attacks on units that are already going down
      Number(b.healthLeft > 0) - Number(a.healthLeft > 0) ||
      // Prefer targets this unit is strong against (counters, height, no cover)
      b.strike - a.strike ||
      a.healthLeft - b.healthLeft ||
      a.distance - b.distance ||
      compareIds(a.target, b.target)
    );

    // A troop that can strike the enemy castle attacks it instead, unless it can finish off an enemy
    // troop. Siege troops always go for the walls.
    if (canStrikeCastle(state, unit) && (hasAbility(unit, 'siege') || !options[0].kills)) continue;

    const { target, strike } = options[0];
    targetOf.set(unit.id, target.id);
    attackersOn.set(target.id, (attackersOn.get(target.id) ?? 0) + 1);
    assignedDamage.set(target.id, (assignedDamage.get(target.id) ?? 0) + strike);
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
    // Everyone in a fight gives away their position
    const engaged = new Set(combats.flatMap(c => [...c.attackers, ...c.defenders].map(u => u.id)));
    for (const side of ['player', 'ai'] as const) {
      for (const unit of state.players[side].units) {
        if (engaged.has(unit.id)) {
          unit.isEngagedInCombat = true;
          unit.revealed = true;
        }
      }
    }
    syncHexUnits(state);
  }

  return combats;
};

// Whether a troop can attack the enemy castle from where it stands: the castle is within its attack
// reach and, for shots beyond the next hex, in its line of sight (spells arc over anything)
export const canStrikeCastle = (state: GameState, unit: Unit): boolean => {
  const castle = findBaseHex(state, getOpponent(unit.owner));
  if (!castle) return false;
  const distance = getHexDistance(unit.position, castle.coordinates);
  if (distance > getUnitAttackRange(state, unit)) return false;
  if (distance <= 1) return true;
  if (isSmoked(state, castle.coordinates)) return false;
  return hasAbility(unit, 'magic') || hasLineOfSight(state.hexGrid, unit.position, castle.coordinates);
};

// The troops of the side that just moved that attack the enemy castle: those that can reach it and
// didn't pick an enemy troop to fight
const detectSiege = (state: GameState, side: PlayerType, combats: Combat[]): GameState['siege'] => {
  const fighting = new Set(combats.flatMap(combat => combat.attackers.map(unit => unit.id)));
  const attackers = state.players[side].units.filter(unit => !fighting.has(unit.id) && canStrikeCastle(state, unit));
  for (const unit of attackers) unit.revealed = true;
  return attackers.length > 0 ? { side, attackerIds: attackers.map(unit => unit.id) } : undefined;
};

// Troops of the side not moving strike back at the enemies attacking within their reach - whether
// those enemies attack a troop or the castle. Each troop not already in a fight strikes one attacker
// it can reach: one it can finish off (with the others striking it) if it can, otherwise the
// hardest-hitting. The attacker is busy with its own target, so it can't hit back; a castle attacker
// that falls does no damage to the castle.
const detectIntercepts = (state: GameState, attackerSide: PlayerType, siege: GameState['siege'], combats: Combat[]): Combat[] => {
  const guardSide = getOpponent(attackerSide);
  const busy = new Set(combats.flatMap(combat => [...combat.attackers, ...combat.defenders].map(unit => unit.id)));
  const attackerIds = new Set([...combats.flatMap(combat => combat.attackers.map(unit => unit.id)), ...(siege?.attackerIds ?? [])]);
  const attackers = state.players[attackerSide].units.filter(unit => attackerIds.has(unit.id));
  if (attackers.length === 0) return [];

  const assigned = new Map<string, Unit[]>();
  const damageOn = new Map<string, number>();
  const guards = state.players[guardSide].units
    .filter(guard => !busy.has(guard.id))
    .map(guard => ({ guard, targets: attackers.filter(enemy => canStrike(state, guard, enemy) && isUnitVisibleTo(state, guardSide, enemy)) }))
    .filter(choice => choice.targets.length > 0)
    // Guards with fewer options pick first
    .sort((a, b) => a.targets.length - b.targets.length || compareIds(a.guard, b.guard));
  for (const { guard, targets } of guards) {
    const options = targets.map(target => {
      const strike = getStrikePower(state, guard, target, (assigned.get(target.id)?.length ?? 0) + 1);
      const before = damageOn.get(target.id) ?? 0;
      const kills = applyArmor(target, Math.max(1, Math.round(before))) < target.lifespan &&
        applyArmor(target, Math.max(1, Math.round(before + strike))) >= target.lifespan;
      return { target, strike, kills };
    }).sort((a, b) => Number(b.kills) - Number(a.kills) || b.target.attackPower - a.target.attackPower || compareIds(a.target, b.target));
    const { target, strike } = options[0];
    damageOn.set(target.id, (damageOn.get(target.id) ?? 0) + strike);
    assigned.set(target.id, [...(assigned.get(target.id) ?? []), guard]);
    guard.isEngagedInCombat = true;
    guard.revealed = true;
  }

  return attackers.flatMap(target => {
    const strikers = assigned.get(target.id);
    if (!strikers) return [];
    target.isEngagedInCombat = true;
    return [{ hexCoordinates: target.position, attackers: strikers, defenders: [target], resolved: false, intercept: true }];
  });
};

// A base reduced to zero health loses the game
const checkBaseDestroyed = (state: GameState): PlayerType | undefined => {
  if ((state.players.ai.baseHealth ?? BASE_MAX_HEALTH) <= 0) return 'player';
  if ((state.players.player.baseHealth ?? BASE_MAX_HEALTH) <= 0) return 'ai';

  return undefined;
};

// Share of its health a side's castle has left
export const castleHealthRatio = (state: GameState, side: PlayerType): number =>
  Math.max(0, state.players[side].baseHealth ?? BASE_MAX_HEALTH) / getCastleMaxHealth(state, side);

// Gold value of a side's army, counting wounded troops at their remaining health
const armyValue = (state: GameState, side: PlayerType) =>
  state.players[side].units.reduce((sum, unit) => sum + unit.cost * unit.lifespan / unit.maxLifespan, 0);

// When time runs out the battle is decided on points: the enemy troops each side destroyed (by
// their gold value), the gold it earned and the camps it holds, each weighted differently
export const TIME_SCORE_WEIGHTS = { kills: 1, gold: 0.5, camps: 15 } as const;

export interface TimeScore {
  kills: number;
  gold: number;
  camps: number;
  total: number;
}

export const getTimeScore = (state: GameState, side: PlayerType): TimeScore => {
  const stats = state.battleStats?.[side];
  const kills = Math.round((stats?.slainValue ?? 0) * TIME_SCORE_WEIGHTS.kills);
  const gold = Math.round((stats?.goldEarned ?? 0) * TIME_SCORE_WEIGHTS.gold);
  const camps = state.hexGrid.filter(hex => hex.isCamp && hex.owner === side).length * TIME_SCORE_WEIGHTS.camps;
  return { kills, gold, camps, total: kills + gold + camps };
};

// Points for stars: the same as above, plus a bonus for every round left when the battle is won
export const SPEED_POINTS_PER_ROUND = 10;
export interface StarScore extends TimeScore {
  speed: number;
}
export const getStarScore = (state: GameState, side: PlayerType): StarScore => {
  const score = getTimeScore(state, side);
  // Only a win earns the speed bonus
  const lost = state.winner !== undefined && state.winner !== side;
  const speed = lost ? 0 : Math.max(0, getMaxRounds(state) - state.turnNumber) * SPEED_POINTS_PER_ROUND;
  return { ...score, speed, total: score.total + speed };
};

// The higher score wins; a dead heat goes to the stronger army left standing, then to the defender
const decideOnTime = (state: GameState): PlayerType => {
  const points = getTimeScore(state, 'player').total - getTimeScore(state, 'ai').total;
  if (points !== 0) return points > 0 ? 'player' : 'ai';
  return armyValue(state, 'player') > armyValue(state, 'ai') ? 'player' : 'ai';
};

// Health a unit gains (positive) or loses (negative) from where it stands and who is beside it,
// at the end of its own side's turn
const turnEndHealthChange = (state: GameState, unit: Unit, healers: Unit[]): { spring: number; mages: number; terrain: number } => {
  const effect = TERRAIN_EFFECTS[terrainUnder(state, unit)];
  const spring = effect.healPerTurn ?? 0;
  const mages = HEALER_HEAL_AMOUNT * healers.filter(healer =>
    healer.id !== unit.id && getHexDistance(healer.position, unit.position) === 1
  ).length;
  let terrain = hasAbility(unit, 'regenerate') ? REGENERATE_AMOUNT : 0;
  const scorch = effect.damagePerTurn ?? 0;
  if (scorch > 0) {
    const isCursed = terrainUnder(state, unit) === 'cursed';
    if (isCursed && hasAbility(unit, 'undead')) terrain += scorch;
    else if (!(terrainUnder(state, unit) === 'lava' && hasAbility(unit, 'fireborn'))) terrain -= scorch;
  }
  return { spring, mages, terrain };
};

// Wrap up the active side's turn and hand control to the other side.
// The side that just played heals (springs, Mages, regeneration) or burns (lava, cursed ground),
// lays siege to the enemy castle with its units in range, collects gold from the mines its units
// hold and receives its turn income. After the AI's turn the round ends; after the last round
// the battle is decided by castle health.
const finishTurn = (state: GameState): GameState => {
  const activePlayer = getActivePlayer(state);
  const newState: GameState = {
    ...state,
    combats: [],
    pendingMoves: [],
    pendingPurchases: []
  };

  const healers = newState.players[activePlayer].units.filter(unit => hasAbility(unit, 'healing'));
  // Siege Sappers that stood still this turn dig out the ground around them (Undermine)
  const diggers = newState.players[activePlayer].units.filter(unit => rankOf(unit, 'undermine') > 0 && !unit.movedHexes);
  // Forced March wears off at the end of the turn
  const marchBonus = new Map(getEffects(state, 'march').filter(effect => effect.side === activePlayer).map(effect => [effect.unitId, effect.value]));
  let healedAtSprings = 0;
  let healedByMages = 0;
  const burned: Unit[] = [];
  for (const side of ['player', 'ai'] as const) {
    newState.players[side].units = newState.players[side].units.map(unit => {
      let lifespan = unit.lifespan;
      if (side === activePlayer) {
        const change = turnEndHealthChange(newState, unit, healers);
        const springed = Math.min(unit.maxLifespan, lifespan + change.spring);
        healedAtSprings += springed - lifespan;
        const mended = Math.min(unit.maxLifespan, springed + change.mages);
        healedByMages += mended - springed;
        lifespan = Math.max(0, Math.min(unit.maxLifespan, mended + change.terrain));
      }
      // A side's troops slip back into the fog when its own turn comes round again
      const updated = {
        ...unit, lifespan, hasMoved: false, isEngagedInCombat: false, movedHexes: 0,
        movementRange: unit.movementRange - (marchBonus.get(unit.id) ?? 0),
        revealed: side === activePlayer ? unit.revealed : false
      };
      if (lifespan <= 0) burned.push(updated);
      return updated;
    });
  }
  // Units worn down by lava or cursed ground fall
  for (const unit of burned) {
    newState.players[unit.owner].units = newState.players[unit.owner].units.filter(u => u.id !== unit.id);
    sideStats(newState, unit.owner).lost++;
    addLog(newState, unit.owner, `${unitLabel(unit)} perished on the ${TERRAIN_EFFECTS[terrainUnder(newState, unit)].name.toLowerCase()}.`);
  }
  syncHexUnits(newState);
  const sideTroops = activePlayer === 'player' ? 'Your' : 'Enemy';
  if (healedAtSprings > 0) {
    addLog(newState, activePlayer, `${sideTroops} troops recover ${healedAtSprings} health at the springs.`);
  }
  if (healedByMages > 0) {
    addLog(newState, activePlayer, `${sideTroops} healers mend ${healedByMages} health.`);
  }
  applyChallenges(newState, activePlayer);
  undermine(newState, diggers.filter(digger => newState.players[activePlayer].units.some(unit => unit.id === digger.id)));
  // Tactic cards that last the turn wear off now, and the other side's until-your-next-turn ones too
  newState.effects = (newState.effects ?? []).filter(effect =>
    !(effect.lasts === 'turn' && effect.side === activePlayer) && !(effect.lasts === 'nextTurn' && effect.side !== activePlayer));

  processDamageToBase(newState, activePlayer);
  const income = getIncome(newState, activePlayer);
  if (income.total >= 0) earnGold(newState, activePlayer, income.total);
  else newState.players[activePlayer].points = Math.max(0, newState.players[activePlayer].points + income.total);
  if (activePlayer === 'player') {
    const parts = [
      income.mines > 0 && `+${income.mines} mines`,
      income.camps > 0 && `+${income.camps} camps`,
      income.upkeep > 0 && `-${income.upkeep} upkeep`
    ].filter(Boolean);
    addLog(newState, 'player', `You earn ${income.total} gold` + (parts.length > 0 ? ` (${parts.join(', ')}).` : '.'));
  } else if (income.mines + income.camps > 0) {
    addLog(newState, 'ai', `The enemy earns ${income.mines + income.camps} gold from mines and camps.`);
  }

  const winner = checkBaseDestroyed(newState);
  if (winner) {
    addLog(newState, winner, winner === 'player' ? 'The enemy castle has fallen!' : 'Your castle has fallen!');
    return endGame(newState, winner, 'destroyed');
  }

  // The last round is over: it is decided on points
  if (activePlayer === 'ai' && newState.turnNumber >= getMaxRounds(newState)) {
    const timeWinner = decideOnTime(newState);
    const yours = getTimeScore(newState, 'player');
    const theirs = getTimeScore(newState, 'ai');
    addLog(newState, timeWinner, `Time is up - ${timeWinner === 'player' ? 'you win' : 'the enemy wins'} on points, ${yours.total} to ${theirs.total} ` +
      `(kills ${yours.kills}-${theirs.kills}, gold ${yours.gold}-${theirs.gold}, camps ${yours.camps}-${theirs.camps}).`);
    return endGame(newState, timeWinner, 'timeout');
  }

  noteSightings(newState);
  const next: GameState = {
    ...newState,
    siege: undefined,
    activePlayer: getOpponent(activePlayer),
    currentPhase: 'planning',
    turnNumber: activePlayer === 'ai' ? newState.turnNumber + 1 : newState.turnNumber,
    planningTimeRemaining: getSettings(state).planningPhaseTime
  };
  return isTacticDrawRound(next.turnNumber) ? drawTactic(next, next.activePlayer!) : next;
};

// Challenge: each of the side's Shieldbearers pulls the nearest enemies it can see within its reach one
// hex closer, onto open ground (not onto a castle or a camp). Bosses hold their ground.
const applyChallenges = (state: GameState, side: PlayerType): void => {
  const enemySide = getOpponent(side);
  for (const bearer of state.players[side].units) {
    const rank = rankOf(bearer, 'challenge');
    if (rank === 0) continue;
    const targets = getVisibleEnemies(state, side)
      .filter(enemy => !enemy.isBoss && getHexDistance(enemy.position, bearer.position) > 1 &&
        getHexDistance(enemy.position, bearer.position) <= challengeRange(rank))
      .sort((a, b) => getHexDistance(a.position, bearer.position) - getHexDistance(b.position, bearer.position) || compareIds(a, b))
      .slice(0, challengePulls(rank));
    const pulled: Unit[] = [];
    for (const target of targets) {
      const enemy = state.players[enemySide].units.find(unit => unit.id === target.id);
      if (!enemy) continue;
      const occupied = new Set([...state.players.player.units, ...state.players.ai.units].map(unit => coordKey(unit.position)));
      const distance = getHexDistance(enemy.position, bearer.position);
      const step = getNeighbors(enemy.position)
        .map(coordinates => findHexByCoordinates(state.hexGrid, coordinates))
        .filter((hex): hex is Hex => !!hex && !isImpassable(hex) && !hex.isBase && !hex.isCamp &&
          !occupied.has(coordKey(hex.coordinates)) && getHexDistance(hex.coordinates, bearer.position) < distance)
        .sort((a, b) => getHexDistance(a.coordinates, bearer.position) - getHexDistance(b.coordinates, bearer.position) ||
          coordKey(a.coordinates).localeCompare(coordKey(b.coordinates)))[0];
      if (!step) continue;
      enemy.position = step.coordinates;
      enemy.revealed = true;
      pulled.push(enemy);
      syncHexUnits(state);
    }
    if (pulled.length > 0) {
      addLog(state, side, `Challenge! ${unitLabel(bearer)} pulls ${pulled.map(unit => unitLabel(unit)).join(' and ')} closer.`);
    }
  }
};

// Undermine: the ground around each digging Siege Sapper sinks (castles stay put)
const undermine = (state: GameState, diggers: Unit[]): void => {
  for (const digger of diggers) {
    const depth = undermineDepth(rankOf(digger, 'undermine'));
    for (const coordinates of getNeighbors(digger.position)) {
      const hex = findHexByCoordinates(state.hexGrid, coordinates);
      if (!hex || hex.isBase) continue;
      updateHex(state, coordinates, { heightOffset: shiftHeightOffset(hex.heightOffset, -depth) });
    }
    addLog(state, digger.owner, `${unitLabel(digger)} undermine the ground around them (-${depth.toFixed(2)} height).`);
  }
};

// --- Tactic card draws -----------------------------------------------------------------------

// A small seeded random number generator, so draws don't depend on when the page happens to run them
const seededRandom = (seed: number): number => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// At the start of a side's turn in a draw round it draws one of the tactic cards it brought, at
// random - unless its hand of tactic cards is already full
export const drawTactic = (state: GameState, side: PlayerType): GameState => {
  const tactics = state.tactics?.[side];
  if (!tactics || tactics.loadout.length === 0) return state;
  if (tactics.hand.length >= TACTIC_HAND_LIMIT) {
    if (side === 'player') addLog(state, 'player', 'Your tactic cards are full - play one to make room for the next.');
    return state;
  }
  const roll = seededRandom((state.tacticSeed ?? 0) + state.turnNumber * 7919 + (side === 'ai' ? 104729 : 0) + tactics.drawn * 31);
  const card = tactics.loadout[Math.floor(roll * tactics.loadout.length)];
  const drawn = { ...card, uid: `${side}-tactic-${tactics.drawn + 1}` };
  return {
    ...state,
    tactics: { ...state.tactics!, [side]: { ...tactics, hand: [...tactics.hand, drawn], drawn: tactics.drawn + 1 } }
  };
};

// Siege damage one unit deals to a castle in its range
export const getSiegeDamage = (unit: Unit): number =>
  unit.attackPower * (hasAbility(unit, 'siege') ? SIEGE_MULTIPLIER : 1);

// The besieging side's units near the enemy base damage it, plundering gold as they do
const processDamageToBase = (state: GameState, besieger: PlayerType): void => {
  const side = getOpponent(besieger);
  const baseHex = findBaseHex(state, side);
  if (!baseHex) return;

  // The troops that attacked the castle this turn (and still stand)
  const attackerIds = new Set(state.siege?.side === besieger ? state.siege.attackerIds : []);
  const besiegers = state.players[besieger].units.filter(unit => attackerIds.has(unit.id));

  // Each unit in range deals damage equal to its attack power (double for siege troops), and is seen doing it
  const totalDamage = Math.round(besiegers.reduce((sum, unit) => sum + getSiegeDamage(unit), 0));
  if (totalDamage === 0) return;
  for (const unit of besiegers) unit.revealed = true;

  const currentHealth = state.players[side].baseHealth ?? BASE_MAX_HEALTH;
  const newHealth = Math.max(0, currentHealth - totalDamage);

  state.players[side].baseHealth = newHealth;
  updateHex(state, baseHex.coordinates, { baseHealth: newHealth });
  sideStats(state, besieger).siegeDamage += currentHealth - newHealth;

  const plunder = Math.floor((currentHealth - newHealth) * SIEGE_PLUNDER_PER_DAMAGE);
  earnGold(state, besieger, plunder);
  addLog(
    state,
    besieger,
    `${side === 'player' ? 'Your' : 'The enemy'} castle takes ${totalDamage} siege damage (${newHealth}/${getCastleMaxHealth(state, side)})` +
      (plunder > 0 ? ` - ${besieger === 'player' ? 'you plunder' : 'the enemy plunders'} ${plunder} gold.` : '.')
  );
};

export interface IncomeBreakdown {
  base: number;
  // Gold mines held by this side's units
  mines: number;
  // Camps this side holds
  camps: number;
  // Cost of keeping an army larger than FREE_UPKEEP_UNITS
  upkeep: number;
  total: number;
}

// What a side earns at the end of each of its turns (campaign enemies may get a bonus)
export const getIncome = (state: GameState, side: PlayerType): IncomeBreakdown => {
  const mines = state.hexGrid
    .filter(hex => hex.isResourceHex && hex.unit?.owner === side)
    .reduce((sum, hex) => sum + (hex.resourceValue ?? 0), 0);
  const camps = getOwnedCamps(state, side).length * CAMP_INCOME;
  const upkeep = Math.max(0, state.players[side].units.length - FREE_UPKEEP_UNITS) * UPKEEP_PER_UNIT;
  const base = TURN_INCOME + (side === 'ai' ? getSettings(state).aiIncomeBonus ?? 0 : 0);
  return { base, mines, camps, upkeep, total: base + mines + camps - upkeep };
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
// Every attacker strikes the defender; the defender strikes back, splitting its attack between the
// attackers it can reach. Each strike is scaled by height, counters and the target's cover, and
// armour soaks a point of what lands.
export const getCombatPreview = (state: GameState, combat: Combat): CombatPreview => {
  const getLiveUnit = (unit: Unit) =>
    state.players[unit.owner].units.find(u => u.id === unit.id);
  const percent = (multiplier: number) => `${multiplier > 1 ? '+' : '-'}${Math.round(Math.abs(multiplier - 1) * 100)}%`;

  // Modifiers that apply when `unit` strikes `target`, in words
  const describeStrike = (unit: Unit, target: Unit, attackersOnTarget = 1): string[] => {
    const terrain = terrainUnder(state, unit);
    const targetTerrain = terrainUnder(state, target);
    const modifiers: string[] = [];
    if (hasAbility(unit, 'terrainBonus') && terrain === 'forest') {
      modifiers.push(`+${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% attack (fighting from forest)`);
    }
    if (isEnraged(unit)) modifiers.push(`+${Math.round((BERSERK_ATTACK_MULTIPLIER - 1) * 100)}% attack (berserk)`);
    const height = getHeightMultiplier(getHeightDifference(state, unit.position, target.position));
    if (height !== 1) modifiers.push(`${percent(height)} attack (${height > 1 ? 'high ground' : 'attacking uphill'})`);
    const counter = getCounterMultiplier(unit.type, target.type);
    if (counter !== 1) modifiers.push(`x${counter} vs ${getTroopName(target.type)}`);
    if (getPointBlankMultiplier(unit, getHexDistance(unit.position, target.position)) < 1) {
      modifiers.push(`${percent(RANGED_POINT_BLANK_MULTIPLIER)} attack (caught in close combat)`);
    }
    if (hasAbility(unit, 'magic') && TERRAIN_EFFECTS[targetTerrain].damageTakenMultiplier < 1) {
      modifiers.push('spells ignore cover');
    }
    const flankers = getFlankers(attackersOnTarget);
    if (flankers > 0) modifiers.push(`+${Math.round(FLANK_BONUS * flankers * 100)}% attack (flanking)`);
    for (const bonus of getSituationalBonuses(state, unit)) modifiers.push(`${percent(bonus.multiplier)} attack (${bonus.label})`);
    const smite = getSmiteMultiplier(unit, target);
    if (smite > 1) modifiers.push(`${percent(smite)} attack (Holy Smite)`);
    const pierce = piercingShare(rankOf(unit, 'piercingShot'));
    if (pierce > 0 && TERRAIN_EFFECTS[targetTerrain].damageTakenMultiplier < 1) modifiers.push(`ignores ${Math.round(pierce * 100)}% of cover (Piercing Shot)`);
    return modifiers;
  };
  const describeDefence = (unit: Unit): string[] => {
    const cover = TERRAIN_EFFECTS[terrainUnder(state, unit)];
    const modifiers: string[] = [];
    if (cover.damageTakenMultiplier < 1) {
      modifiers.push(`${Math.round((1 - cover.damageTakenMultiplier) * 100)}% less damage (${cover.name.toLowerCase()} cover)`);
    }
    if (hasAbility(unit, 'armored')) modifiers.push(`armored: takes ${ARMOR_REDUCTION} less damage`);
    for (const protection of getProtections(state, unit)) {
      modifiers.push(`${Math.round(protection.reduction * 100)}% less damage (${protection.label})`);
    }
    return modifiers;
  };

  const defenderUnits = combat.defenders.map(getLiveUnit).filter((u): u is Unit => !!u);
  const attackerUnits = combat.attackers.map(getLiveUnit).filter((u): u is Unit => !!u);

  const attackers = attackerUnits.map(unit => {
    // Defenders can only strike back at attackers within their own reach, and never at a sneak attack
    // Sneak attackers can't catch each other unawares
    const isSneakAttack = isShadowstepping(state, unit) ||
      (hasAbility(unit, 'stealth') && !defenderUnits.some(defender => hasAbility(defender, 'stealth')));
    const canBeHitBack = !combat.intercept && !isSneakAttack && defenderUnits.some(defender => canStrike(state, defender, unit));
    const modifiers = defenderUnits[0] ? describeStrike(unit, defenderUnits[0], attackerUnits.length) : [];
    if (canBeHitBack) modifiers.push(...describeDefence(unit));
    if (combat.intercept) modifiers.push('its target is busy with its own attack - takes no damage');
    else if (isSneakAttack) modifiers.push('sneak attack - takes no damage');
    else if (!canBeHitBack) modifiers.push('out of reach - takes no damage');
    const terrain = terrainUnder(state, unit);
    return { unit, terrain, power: getBasePower(unit, terrain), canBeHitBack, modifiers };
  });

  const defenders = defenderUnits.map(unit => {
    const terrain = terrainUnder(state, unit);
    const modifiers = describeDefence(unit);
    // How this defender fares striking back at the first attacker it can reach
    const firstTarget = attackers.find(a => a.canBeHitBack)?.unit;
    if (firstTarget) modifiers.push(...describeStrike(unit, firstTarget));
    return { unit, terrain, power: getBasePower(unit, terrain), modifiers };
  });

  // Each defender takes the attackers' combined strikes (one defender per combat)
  const defenderDamage = defenders.map(defender =>
    distributeDamage([attackers.reduce((sum, a) => sum + getStrikePower(state, a.unit, defender.unit, attackers.length), 0)])[0]
  );
  // The defender's strike-back is split between the attackers it can reach
  const attackerDamage = defenders.length > 0
    ? distributeDamage(attackers.map(a => a.canBeHitBack ? getStrikePower(state, defenders[0].unit, a.unit) : null))
    : attackers.map(() => 0);

  const withDamage = (
    entry: { unit: Unit; terrain: TerrainType; power: number; modifiers: string[] },
    rawDamage: number,
    canBeHitBack: boolean
  ): CombatantPreview => {
    const damageTaken = applyArmor(entry.unit, rawDamage);
    return { ...entry, canBeHitBack, damageTaken, destroyed: damageTaken >= entry.unit.lifespan };
  };

  return {
    attackers: attackers.map((a, index) => withDamage(a, attackerDamage[index], a.canBeHitBack)),
    defenders: defenders.map((d, index) => withDamage(d, defenderDamage[index], true)),
    attackerPower: attackers.reduce((sum, a) => sum + a.power, 0),
    defenderPower: defenders.reduce((sum, d) => sum + d.power, 0)
  };
};

// Fight out a combat. Damage is dealt simultaneously; destroying a unit earns its killer a bounty.
// The special effects at work in a fight, in a few words each, for the battle's callout and the
// log: sneak attacks, strike-backs, ambushes, flanking, height, counters, cover, armour and more
export interface CombatEffect {
  label: string;
  // How much it changes the fight (+25%, x1.5, -2), if it is a number
  value?: string;
  // Helps the side attacking (good), hinders it (bad), or neither
  tone: 'good' | 'bad' | 'neutral';
}

export const describeEffect = (effect: CombatEffect) => (effect.value ? `${effect.label} ${effect.value}` : effect.label);

export const getCombatEffects = (state: GameState, combat: Combat): CombatEffect[] => {
  const live = (unit: Unit) => state.players[unit.owner].units.find(candidate => candidate.id === unit.id);
  const attackers = combat.attackers.map(live).filter((unit): unit is Unit => !!unit);
  const target = combat.defenders.map(live).find((unit): unit is Unit => !!unit);
  if (!target || attackers.length === 0) return [];
  const effects: CombatEffect[] = [];
  const add = (label: string, tone: CombatEffect['tone'], value?: string) => {
    if (!effects.some(effect => effect.label === label)) effects.push({ label, tone, value });
  };
  const pct = (multiplier: number) => `${Math.round(Math.abs(multiplier - 1) * 100)}%`;
  const targetTerrain = terrainUnder(state, target);

  if (attackers.some(unit => unit.ambushed) || target.ambushed) add('Ambush!', 'neutral');
  for (const unit of attackers) {
    const terrain = terrainUnder(state, unit);
    if (!combat.intercept && isShadowstepping(state, unit)) add('Shadowstep!', 'good');
    else if (!combat.intercept && hasAbility(unit, 'stealth')) {
      add(hasAbility(target, 'stealth') ? 'Sneak attack spotted' : 'Sneak attack!', hasAbility(target, 'stealth') ? 'neutral' : 'good');
    }
    for (const bonus of getSituationalBonuses(state, unit)) {
      if (bonus.label !== 'Shadowstep') add(bonus.label, 'good', `+${pct(bonus.multiplier)}`);
    }
    const smite = getSmiteMultiplier(unit, target);
    if (smite > 1) add('Holy Smite', 'good', `+${pct(smite)}`);
    const flankers = getFlankers(attackers.length);
    if (flankers > 0) add('Flanked', 'good', `+${Math.round(FLANK_BONUS * flankers * 100)}%`);
    const height = getHeightMultiplier(getHeightDifference(state, unit.position, target.position));
    if (height > 1) add('High ground', 'good', `+${pct(height)}`);
    if (height < 1) add('Uphill', 'bad', `-${pct(height)}`);
    const counter = getCounterMultiplier(unit.type, target.type);
    if (counter > 1) add('Counter', 'good', `x${counter}`);
    if (counter < 1) add('Bad matchup', 'bad', `x${counter}`);
    if (hasAbility(unit, 'terrainBonus') && terrain === 'forest') add('Forest pikes', 'good', `+${pct(TERRAIN_BONUS_ATTACK_MULTIPLIER)}`);
    if (isEnraged(unit)) add('Berserk', 'good', `+${pct(BERSERK_ATTACK_MULTIPLIER)}`);
    if (getPointBlankMultiplier(unit, getHexDistance(unit.position, target.position)) < 1) add('Point blank', 'bad', `-${pct(RANGED_POINT_BLANK_MULTIPLIER)}`);
    const cover = TERRAIN_EFFECTS[targetTerrain].damageTakenMultiplier;
    if (cover < 1) {
      if (hasAbility(unit, 'magic')) add('Spells pierce cover', 'good');
      else add('Cover', 'bad', `-${pct(cover)}`);
    }
  }
  if (hasAbility(target, 'armored')) add('Armored', 'bad', `-${ARMOR_REDUCTION}`);
  for (const protection of getProtections(state, target)) add(protection.label, 'bad', `-${Math.round(protection.reduction * 100)}%`);
  return effects;
};

export const resolveCombat = (state: GameState, combatIndex: number): GameState => {
  const combat = state.combats[combatIndex];
  if (state.currentPhase !== 'combat' || !combat || combat.resolved) return state;

  const newState = cloneState(state);
  const preview = getCombatPreview(newState, combat);
  const effects = getCombatEffects(newState, combat);
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
        const killer = getOpponent(unit.owner);
        bounties[killer] += getKillBounty(unit);
        creditKill(newState, unit, killer);
      }
    }

    // Bloodlust: Berserkers heal for every enemy they help destroy
    const attackerKills = preview.defenders.filter(entry => entry.destroyed).length;
    const defenderKills = preview.attackers.filter(entry => entry.destroyed && entry.canBeHitBack).length;
    for (const [entries, kills] of [[preview.attackers, attackerKills], [preview.defenders, defenderKills]] as const) {
      for (const entry of entries) {
        const unit = getLiveUnit(entry.unit);
        const rank = unit ? rankOf(unit, 'bloodlust') : 0;
        if (!unit || rank === 0 || kills === 0 || unit.lifespan >= unit.maxLifespan) continue;
        const healed = Math.min(unit.maxLifespan - unit.lifespan, bloodlustHeal(rank) * kills);
        unit.lifespan += healed;
        addLog(newState, unit.owner, `Bloodlust! ${unitLabel(unit)} recovers ${healed} health.`);
      }
    }
    syncHexUnits(newState);

    const defender = preview.defenders[0];
    const outcome = (entry: CombatantPreview) =>
      entry.destroyed ? 'destroyed' : entry.damageTaken > 0 ? `-${entry.damageTaken} HP` : 'unharmed';
    addLog(
      newState,
      getActivePlayer(newState),
      (combat.intercept
        ? `${preview.attackers.map(a => unitLabel(a.unit)).join(' & ')} struck back at ${unitLabel(defender.unit)} as it attacked: ${outcome(defender)}.`
        : `${preview.attackers.map(a => unitLabel(a.unit)).join(' & ')} attacked ${unitLabel(defender.unit)}: ` +
          `defender ${outcome(defender)}, attackers ${preview.attackers.map(outcome).join(', ')}.`) +
        (effects.length > 0
          ? ` (${effects.map(describeEffect).join(', ')})`
          : '')
    );

    for (const side of ['player', 'ai'] as const) {
      if (bounties[side] === 0) continue;
      earnGold(newState, side, bounties[side]);
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

// Fight every battle of the turn at once. No troop attacks twice; troops striking back at an attacker
// come last, so the attacker still lands its own attack first
export const resolveAllCombats = (state: GameState): GameState => {
  // Only the castle is under attack: the turn simply ends, and the castle takes the blows
  if (state.currentPhase === 'combat' && state.combats.every(combat => combat.resolved)) return finishTurn(state);
  let current = state;
  for (let index = 0; index < state.combats.length; index++) {
    if (current.currentPhase !== 'combat') break;
    current = resolveCombat(current, index);
  }
  return current;
};

// Remove a unit from the game
const removeUnit = (state: GameState, unit: Unit): void => {
  state.players[unit.owner].units = state.players[unit.owner].units.filter(u => u.id !== unit.id);
  syncHexUnits(state);
};

// Count a destroyed unit for the side that destroyed it (and against the side that lost it)
const creditKill = (state: GameState, unit: Unit, killer: PlayerType): void => {
  const killerStats = sideStats(state, killer);
  killerStats.kills++;
  killerStats.slainValue = (killerStats.slainValue ?? 0) + unit.cost;
  killerStats.slain[unit.type] = (killerStats.slain[unit.type] ?? 0) + 1;
  if (unit.isBoss) {
    killerStats.bossesSlain++;
    addLog(state, killer, `${getTroopName(unit.type)} has been slain!`);
  }
  sideStats(state, unit.owner).lost++;
};

// Damage dealt outside a fight (Strafe, Volley), softened by armour and Ward or Bulwark as in a fight.
// A unit it destroys is removed and pays its bounty to `by`. Works on a state the caller has cloned.
export const inflictDamage = (state: GameState, unit: Unit, amount: number, by: PlayerType): { damage: number; destroyed: boolean } => {
  const live = state.players[unit.owner].units.find(u => u.id === unit.id);
  if (!live || amount <= 0) return { damage: 0, destroyed: false };
  const damage = applyArmor(live, Math.max(1, Math.round(amount * getDamageTakenMultiplier(state, live))));
  live.lifespan = Math.max(0, live.lifespan - damage);
  live.revealed = true;
  if (live.lifespan > 0) {
    syncHexUnits(state);
    return { damage, destroyed: false };
  }
  removeUnit(state, live);
  creditKill(state, live, by);
  earnGold(state, by, getKillBounty(live));
  return { damage, destroyed: true };
};
