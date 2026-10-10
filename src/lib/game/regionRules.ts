import type { GameState, HexCoordinates, TerrainType, Unit, UnitType } from '@/types/game';
import { Faction, TROOPS, TroopId } from './troops';
import { DIRECTIONS, getHexDistance, getNeighbors } from './hexUtils';

// What makes each enemy and each region fight differently: every faction's troops have a trait of
// their own, some regions have weather, and any army can lose its nerve (morale).
//
// Faction traits (regular troops only; bosses have their powers instead):
// - Goblins swarm: cheap, so they come in numbers, but packed together a blow on one hurts the
//   goblins beside it too (so strikes on a crowd pay).
// - Beasts hunt in packs: harder for every other beast beside their prey.
// - Swamp folk, the Sand Court and the Frostborn cross their own ground (swamp, desert, snow and
//   ice) as if it were open; the Sand Court shoots through sandstorms, the Frostborn walk through
//   blizzards.
// - The undead rise again once when slain, unless a War Cleric or fire finishes them; and they
//   are fearless.
// - Orcs hit harder the more they are hurt.
// - Demons are born of fire: flames and lava can't hurt them.
// - Dragonkin take wing: drakes fly, and their flyers soar over walls and gatehouses.
//
// Weather (by region): drifting fog banks in the marsh hide the troops inside them; sandstorms in
// the desert cut every shot's reach; blizzards in the frozen north slow everyone; and ash on the
// Emberforge wind spreads fire faster. Storms come and go: two calm rounds, then two stormy ones.
//
// Morale: when a boss or a champion falls, its army is shaken; and a badly hurt troop surrounded by
// enemies with no friend beside it wavers. A shaken troop hits much softer until its side's next
// turn is over. Bosses and the undead are fearless.

export type FactionTraitId = 'swarm' | 'pack' | 'bogborn' | 'sandborn' | 'frostborn' | 'undying' | 'fury' | 'fireborn' | 'skyborne';

export interface FactionTrait {
  id: FactionTraitId;
  name: string;
  description: string;
}

export const FACTION_TRAITS: Partial<Record<Faction, FactionTrait>> = {
  goblins: { id: 'swarm', name: 'Swarm', description: 'Cheap, so they come in numbers. Packed together, a blow on one hurts the goblins beside it too.' },
  beasts: { id: 'pack', name: 'Pack Hunters', description: '+15% attack for each other beast beside their prey.' },
  swamp: { id: 'bogborn', name: 'Bog-born', description: 'Wade through swamp as if it were open ground.' },
  desert: { id: 'sandborn', name: 'Sand-born', description: 'Cross desert as if it were open ground; sandstorms don\'t shorten their shots.' },
  frost: { id: 'frostborn', name: 'Frostborn', description: 'Snow, ice and blizzards don\'t slow them.' },
  undead: { id: 'undying', name: 'Undying', description: 'Rise again once when slain, unless a War Cleric or fire finishes them. Fearless.' },
  orcs: { id: 'fury', name: 'Fury', description: 'Hit harder the more they are hurt: up to +40%.' },
  infernal: { id: 'fireborn', name: 'Fireborn', description: 'Flames and lava can\'t hurt them.' },
  dragons: { id: 'skyborne', name: 'Skyborne', description: 'Drakes take wing, and dragonkin flyers soar over walls and gatehouses.' }
};

// Goblins cost this share of their usual price
export const SWARM_COST = 0.7;
// Share of a blow on a goblin that the goblins beside it take too
export const SWARM_SPLASH = 0.25;
export const PACK_BONUS = 0.15;
export const MAX_PACK = 2;
// Orcs' extra attack at the brink of death (in proportion to the health lost)
export const FURY_MAX = 0.4;
// Share of its health an undead troop rises with
export const RISE_HEALTH = 1 / 3;

const factionOf = (type: UnitType): Faction => TROOPS[type as TroopId]?.faction ?? 'kingdom';

export const getFactionTrait = (type: UnitType): FactionTrait | undefined => FACTION_TRAITS[factionOf(type)];

// A troop's trait, if it has one (bosses don't: they have their powers)
export const traitOf = (unit: { type: UnitType; isBoss?: boolean }): FactionTraitId | undefined =>
  unit.isBoss ? undefined : getFactionTrait(unit.type)?.id;

export const hasTrait = (unit: { type: UnitType; isBoss?: boolean }, trait: FactionTraitId) => traitOf(unit) === trait;

// Ground a troop's faction crosses as if it were open
const NATIVE_GROUND: Partial<Record<FactionTraitId, TerrainType[]>> = {
  bogborn: ['swamp'], sandborn: ['desert'], frostborn: ['snow', 'ice']
};
export const isNativeGround = (unit: { type: UnitType; isBoss?: boolean }, terrain: TerrainType) =>
  !!NATIVE_GROUND[traitOf(unit) as FactionTraitId]?.includes(terrain);

// Fury: the orc's attack multiplier at its present health
export const furyMultiplier = (unit: Pick<Unit, 'type' | 'isBoss' | 'lifespan' | 'maxLifespan'>): number =>
  hasTrait(unit, 'fury') ? 1 + FURY_MAX * Math.max(0, 1 - unit.lifespan / Math.max(1, unit.maxLifespan)) : 1;

// Undying: whether a slain troop rises again (once), given who finished it
export const canRise = (unit: Pick<Unit, 'type' | 'isBoss' | 'risen'>) => hasTrait(unit, 'undying') && !unit.risen;
export const riseHealth = (unit: Pick<Unit, 'maxLifespan'>) => Math.max(1, Math.round(unit.maxLifespan * RISE_HEALTH));

// --- Weather -------------------------------------------------------------------------------------

export type WeatherId = 'fogBanks' | 'sandstorm' | 'blizzard' | 'ashfall';

export interface WeatherInfo {
  name: string;
  // While it rages (storms) or always
  description: string;
  // Comes and goes (otherwise it is there all battle)
  storm: boolean;
}

export const WEATHER: Record<WeatherId, WeatherInfo> = {
  fogBanks: { name: 'Fog banks', description: 'Troops inside a drifting fog bank can\'t be seen from more than a hex away.', storm: false },
  sandstorm: { name: 'Sandstorm', description: 'Every shot reaches one hex less (not the Sand Court\'s).', storm: true },
  blizzard: { name: 'Blizzard', description: 'Every troop moves one hex less (not the Frostborn).', storm: true },
  ashfall: { name: 'Ashfall', description: 'Ash on the wind: fires spread much faster, and the lava flares up more often.', storm: false }
};

export const SANDSTORM_REACH = 1;
export const BLIZZARD_SLOW = 1;
export const ASH_SPREAD = 1.75;
export const ASH_FLARE = 1.5;
// Storms: calm for this many rounds, then raging for as many
const STORM_SPELL = 2;

export const getWeather = (state: Pick<GameState, 'settings'>): WeatherId | undefined => state.settings?.weather;

// Whether the battle's storm (if it has one) rages in a round
const ragesIn = (round: number) => Math.floor((Math.max(1, round) - 1) / STORM_SPELL) % 2 === 1;

// The weather at work this round: a storm only while it rages
export const activeWeather = (state: Pick<GameState, 'settings' | 'turnNumber'>): WeatherId | undefined => {
  const weather = getWeather(state);
  if (!weather) return undefined;
  return !WEATHER[weather].storm || ragesIn(state.turnNumber) ? weather : undefined;
};

// A storm that will rage next round, or blow over then, for the forecast
export const stormForecast = (state: Pick<GameState, 'settings' | 'turnNumber'>): 'coming' | 'ending' | undefined => {
  const weather = getWeather(state);
  if (!weather || !WEATHER[weather].storm) return undefined;
  const now = ragesIn(state.turnNumber);
  const next = ragesIn(state.turnNumber + 1);
  return now === next ? undefined : next ? 'coming' : 'ending';
};

// How much shorter a unit's shots fall in this round's weather
export const weatherReachPenalty = (state: Pick<GameState, 'settings' | 'turnNumber'>, unit: { type: UnitType; isBoss?: boolean }) =>
  activeWeather(state) === 'sandstorm' && !hasTrait(unit, 'sandborn') ? SANDSTORM_REACH : 0;

// How much less a unit can walk in this round's weather
export const weatherMovePenalty = (state: Pick<GameState, 'settings' | 'turnNumber'>, unit: { type: UnitType; isBoss?: boolean }) =>
  activeWeather(state) === 'blizzard' && !hasTrait(unit, 'frostborn') ? BLIZZARD_SLOW : 0;

// Fog banks: a few patches of fog, each a hex and the ring around it, drifting a hex every round and
// turning back at the edge of the field. Where they start and which way they drift comes from the
// battle's seed, so both sides (and a reloaded battle) see the same fog.
const FOG_BANKS = 3;
const hash = (seed: number): number => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const getFogBankCentres = (state: Pick<GameState, 'settings' | 'turnNumber' | 'hexGrid' | 'battleSeed'>): HexCoordinates[] => {
  if (getWeather(state) !== 'fogBanks') return [];
  const board = new Set(state.hexGrid.map(hex => `${hex.coordinates.q},${hex.coordinates.r}`));
  const onBoard = (c: HexCoordinates) => board.has(`${c.q},${c.r}`);
  // Start away from the castles' rows: in the middle band of the field
  const middle = state.hexGrid.filter(hex => !hex.isBase && Math.abs(hex.coordinates.r) <= 2).map(hex => hex.coordinates);
  const pool = middle.length > 0 ? middle : state.hexGrid.map(hex => hex.coordinates);
  const seed = state.battleSeed ?? state.settings?.seed ?? 0;
  const centres: HexCoordinates[] = [];
  for (let bank = 0; bank < FOG_BANKS && pool.length > 0; bank++) {
    let at = pool[Math.floor(hash(seed + bank * 101) * pool.length)];
    let direction = DIRECTIONS[Math.floor(hash(seed + bank * 211 + 7) * DIRECTIONS.length)];
    for (let round = 1; round < state.turnNumber; round++) {
      let next = { q: at.q + direction.q, r: at.r + direction.r };
      if (!onBoard(next)) {
        direction = { q: -direction.q, r: -direction.r };
        next = { q: at.q + direction.q, r: at.r + direction.r };
      }
      if (onBoard(next)) at = next;
    }
    centres.push(at);
  }
  return centres;
};

// (visibility asks for these constantly, so they're kept for each board and round: the banks only
// move each round, and a board whose castles move is a new board)
const fogCache = new WeakMap<GameState['hexGrid'], { turn: number; keys: Set<string> }>();
const NO_FOG = new Set<string>();
export const getFogBankKeys = (state: Pick<GameState, 'settings' | 'turnNumber' | 'hexGrid' | 'battleSeed'>): Set<string> => {
  if (getWeather(state) !== 'fogBanks') return NO_FOG;
  const cached = fogCache.get(state.hexGrid);
  if (cached?.turn === state.turnNumber) return cached.keys;
  const keys = new Set<string>();
  for (const centre of getFogBankCentres(state)) {
    for (const c of [centre, ...getNeighbors(centre)]) keys.add(`${c.q},${c.r}`);
  }
  fogCache.set(state.hexGrid, { turn: state.turnNumber, keys });
  return keys;
};

export const isInFogBank = (fog: Set<string>, c: HexCoordinates) => fog.has(`${c.q},${c.r}`);

// --- Morale --------------------------------------------------------------------------------------

// A shaken troop's attack
export const SHAKEN_ATTACK = 0.7;
// Turns of its own side a boss's fall shakes its army for (a champion's, one)
export const BOSS_FALL_SHAKE = 2;
export const CHAMPION_FALL_SHAKE = 1;
// A troop at or below this share of its health wavers when surrounded
export const WAVER_HEALTH = 1 / 3;
// Enemies beside it it takes to surround it
export const SURROUNDED_BY = 2;

export const isFearless = (unit: Pick<Unit, 'type' | 'isBoss' | 'abilities'>) =>
  !!unit.isBoss || unit.abilities.includes('undead') || unit.abilities.includes('fearless') || factionOf(unit.type) === 'undead';

export const isShaken = (unit: Pick<Unit, 'shaken'>) => (unit.shaken ?? 0) > 0;

export const moraleMultiplier = (unit: Pick<Unit, 'shaken'>) => isShaken(unit) ? SHAKEN_ATTACK : 1;

// Whether a troop is badly hurt, has `foes` around it and no friend beside it
export const isSurrounded = (unit: Unit, foes: Unit[], friends: Unit[]) =>
  !isFearless(unit) && unit.lifespan <= unit.maxLifespan * WAVER_HEALTH &&
  foes.filter(foe => getHexDistance(foe.position, unit.position) === 1).length >= SURROUNDED_BY &&
  !friends.some(friend => friend.id !== unit.id && getHexDistance(friend.position, unit.position) === 1);
