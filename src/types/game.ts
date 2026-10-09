import type { TroopId } from '@/lib/game/troops';
import type { BossPowerId } from '@/lib/game/bosses';
import type { WeatherId } from '@/lib/game/regionRules';

export type TerrainType =
  | 'plain'
  | 'mountain'
  | 'forest'
  | 'water'
  | 'desert'
  | 'resource'
  | 'hills'
  | 'swamp'
  | 'snow'
  | 'spring'
  | 'lava'
  | 'ice'
  | 'ruins'
  | 'cursed'
  // Houses, mills and wells: cover, and buildings that block arrows
  | 'village'
  // Buildings with a job of their own (see lib/game/structures)
  | 'watchtower'
  | 'house'
  | 'catapult'
  | 'blacksmith'
  | 'barracks'
  | 'tavern'
  | 'lumbermill'
  // Fortifications and crossings
  | 'wall'
  | 'gate'
  | 'bridge';

export type PlayerType = 'player' | 'ai';

export interface HexCoordinates {
  q: number; // Axial coordinates
  r: number;
}

export interface Hex {
  id: string;
  coordinates: HexCoordinates;
  terrain: TerrainType;
  isBase?: boolean;
  isResourceHex?: boolean;
  resourceValue?: number; // Points generated per turn if controlled
  // Neutral camp: whoever holds it can deploy recruits around it
  isCamp?: boolean;
  // Side owning this castle or camp (camps start without an owner)
  owner?: PlayerType;
  unit?: Unit;
  baseHealth?: number; // Health of base if this is a base hex
  // How far the ground here has been raised (positive) or dug out (negative) during the battle,
  // on top of its natural height (see lib/game/hexHeight)
  heightOffset?: number;
  // Something standing or lying on the hex (see lib/game/battlefield): a great tree that can be
  // felled, the log one left when it fell, or that log lying across water as a bridge
  feature?: HexFeature;
  // Where the tree that left this log (or bridge) stood, so it lies the way it fell
  fellFrom?: HexCoordinates;
  // Fire: smouldering embers (it catches next turn) or burning, with the turns it has left
  fire?: { stage: 'smoulder' | 'burning'; turnsLeft: number };
  // Burnt out by a fire (the ground is blackened)
  scorched?: boolean;
}

export type HexFeature = 'greatTree' | 'log' | 'logBridge' | 'stakes';

export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerType;
  position: HexCoordinates;
  movementRange: number;
  attackPower: number;
  lifespan: number; // Current health
  maxLifespan: number; // Max health
  cost: number;
  abilities: Ability[];
  hasMoved: boolean;
  isEngagedInCombat: boolean;
  // Card level the unit was recruited at (player cards) or the level's enemy tier
  level?: number;
  // A boss guarding the enemy castle
  isBoss?: boolean;
  // Seen by the enemy through the fog after attacking, besieging or springing an ambush, until its
  // side's next turn
  revealed?: boolean;
  // Stopped short this turn by a hidden enemy it ran into (an ambush)
  ambushed?: boolean;
  // Hexes it walked (or flew) this turn
  movedHexes?: number;
  // A boss: turns until its power is ready, and the hexes it has marked to strike at the end of its
  // next turn
  powerCooldown?: number;
  threat?: HexCoordinates[];
  // A minion a boss called: the boss it serves (it scatters when the boss falls)
  summonedBy?: string;
  // Frozen in place (the Frost Giant's Ice Stomp): it can't move this turn
  frozen?: boolean;
  // A champion guarding the enemy castle (its fall shakes its army)
  isChampion?: boolean;
  // Undying: it has already risen once
  risen?: boolean;
  // Shaken (morale): its side's turns left until it steadies; it hits softer meanwhile
  shaken?: number;
}

// Every troop - the player's cards and the campaign's monsters - is identified by its troop id
export type UnitType = TroopId;

export type Ability =
  | 'rangedAttack' // strikes from 2 hexes (3 from hills)
  | 'longRange'    // ranged units with this reach one hex further
  | 'healing'      // heals adjacent allies at the end of its side's turn
  | 'terrainBonus' // attacks 50% harder from a forest
  | 'rapidMovement'
  | 'stealth'      // the units it attacks can't strike back
  | 'flying'       // every passable hex costs 1 to enter, and it flies over water and mountains
  | 'regenerate'   // heals 2 at the end of its side's turn
  | 'armored'      // takes 2 less damage in every fight
  | 'siege'        // deals double damage to castles
  | 'berserk'      // attacks 50% harder at half health or less
  | 'undead'       // healed rather than hurt by cursed ground
  | 'pathfinder'   // rough ground (desert, swamp, snow, ice) costs 1 to enter
  | 'fireborn'     // unharmed by lava
  | 'magic'        // spells ignore line of sight and cover
  | 'demolition'   // tears down walls, gates, bridges, trunks and stakes next to it
  | 'firebrand'    // sets dry ground next to it alight
  | 'engineering'; // builds bridges over water and stakes against cavalry next to it

// The stats a side recruits a troop type with this battle (cards are levelled, monsters scaled)
export interface TroopStats {
  cost: number;
  attackPower: number;
  maxLifespan: number;
  movementRange: number;
  abilities: Ability[];
  level: number;
}

export type Roster = Partial<Record<UnitType, TroopStats>>;

export interface Player {
  id: string;
  type: PlayerType;
  points: number;
  baseLocation?: HexCoordinates;
  baseHealth?: number; // Current health of player's base
  maxBaseHealth?: number; // Maximum health of player's base
  units: Unit[];
}

// Running tally of what each side has done in this battle, for callouts and rewards
export interface SideStats {
  recruited: number;
  kills: number;
  lost: number;
  siegeDamage: number;
  goldEarned: number;
  campsCaptured: number;
  bossesSlain: number;
  // Gold value of the enemy troops this side has destroyed
  slainValue?: number;
  // Times this side's troops walked into a hidden enemy
  ambushed?: number;
  // Enemy troop types this side has met on the battlefield
  seen: UnitType[];
  // Enemy troop types this side has destroyed, with counts
  slain: Partial<Record<UnitType, number>>;
  // Recruits by troop type
  played: Partial<Record<UnitType, number>>;
}

export type WinReason = 'destroyed' | 'timeout';

export interface GameState {
  hexGrid: Hex[];
  players: Record<PlayerType, Player>;
  currentPhase: GamePhase;
  // Which side is currently planning/executing its turn
  activePlayer?: PlayerType;
  turnNumber: number;
  planningTimeRemaining: number;
  winner?: PlayerType;
  winReason?: WinReason;
  pendingMoves: Move[];
  pendingPurchases: Purchase[];
  combats: Combat[];
  settings?: GameSettings;
  selectedUnitTypeForPurchase?: UnitType | null;
  // Recent game events shown to the player (newest last)
  log?: GameLogEntry[];
  // Name of the map's theme, e.g. "Frozen Pass"
  mapName?: string;
  // Troop types each side can recruit and the stats they arrive with
  rosters?: Record<PlayerType, Roster>;
  // The player's cards in draw order: the first few are the hand
  deck?: UnitType[];
  // Troops attacking the enemy castle this turn (they strike it when the turn ends)
  siege?: { side: PlayerType; attackerIds: string[] };
  // In the fog of war: the enemy troops each side has seen, as last seen, and the round it saw them
  sightings?: Record<PlayerType, Sighting[]>;
  battleStats?: Record<PlayerType, SideStats>;
  // Campaign level being played, if any
  levelId?: number;
  // Before the first turn: the sites the player may build their castle on, and the enemy's starting
  // guards, posted once the castles stand
  castleChoices?: HexCoordinates[];
  pendingGuards?: { type: UnitType; stats: TroopStats; isBoss?: boolean; isChampion?: boolean }[];
  // Seeds the battle's chance events (fires flaring up around lava)
  battleSeed?: number;
  // The catapult's most recent stone, for the board to show it flying (serial counts stones)
  lastBombard?: { side: PlayerType; from: HexCoordinates; to: HexCoordinates; serial: number };
  // The tree felled most recently, for the board to show it falling (serial counts fellings)
  lastFell?: { side: PlayerType; from: HexCoordinates; to: HexCoordinates; serial: number };
  // A boss's power used most recently, for the board to play it out: the boss, the hexes it struck
  // (or where its minions appeared) and a serial counting powers used
  lastBossPower?: { power: BossPowerId; from: HexCoordinates; hexes: HexCoordinates[]; serial: number };
}

export interface Sighting {
  unit: Unit;
  turn: number;
}

export interface GameLogEntry {
  id: number;
  turn: number;
  side: PlayerType | 'neutral';
  text: string;
}

export type GamePhase =
  | 'setup'
  | 'planning'
  | 'execution'
  | 'combat'
  | 'gameOver';

export interface Move {
  unitId: string;
  playerId: string;
  from: HexCoordinates;
  to: HexCoordinates;
  // Work done on the hex `to` instead of moving onto it (see lib/game/battlefield): the troop stays
  // where it is. (Felling a great tree is an order onto the tree, without an action.)
  action?: UnitAction;
}

export type UnitAction = 'demolish' | 'ignite' | 'bridge' | 'stakes';

export interface Purchase {
  playerId: string;
  unitType: UnitType;
  position: HexCoordinates;
}

export interface Combat {
  hexCoordinates: HexCoordinates;
  attackers: Unit[];
  defenders: Unit[];
  resolved: boolean;
  retreating?: Unit[];
  // Troops of the side not moving striking an enemy that is attacking within their reach (a troop or
  // their castle): it is busy with its own attack, so it doesn't strike back
  intercept?: boolean;
}

export interface GameSettings {
  gridSize: number;
  planningPhaseTime: number;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  resourceHexCount: number;
  // Castle health for both sides
  castleHealth?: number;
  // Gold each side starts with
  startingGold?: number;
  // Extra gold the enemy earns every turn
  aiIncomeBonus?: number;
  // The battle ends after this many rounds, decided on points (kills, gold earned, camps held)
  maxRounds?: number;
  // Each side only sees enemy troops its own troops can see
  fogOfWar?: boolean;
  // Map theme to use instead of a random one, and a fixed seed for the map
  themeName?: string;
  seed?: number;
  // The region's weather (regionRules.ts)
  weather?: WeatherId;
}
