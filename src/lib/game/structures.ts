import type { TerrainType } from '@/types/game';

// Buildings on the battlefield, each with a job - the places armies have always fought over:
//
// - Watchtowers stand on a rise: a troop up there is on high ground (ranged troops reach a hex
//   further, every blow lands harder downhill), sees further, and the side holding the tower keeps
//   watch from it even when it stands empty.
// - Houses are cover: a troop garrisoned inside takes much less damage, can't be flanked and is
//   hidden from anyone not right next to it - but houses burn, and fire smokes defenders out.
// - A catapult tower bombards: a troop in it hurls a stone at the weakest enemy within reach at the
//   end of each of its turns, or at the enemy castle when no troop is in reach.
// - Workshops are prizes, held like camps (step on one to take it) for as long as nobody takes them
//   back: a blacksmith sharpens every blade, barracks drill the recruits who march out of them, a
//   tavern pays, and a lumber mill teaches your troops to fell great trees from 2 hexes away.
//
// - Walls with a gatehouse close part of the field: whoever holds the gate decides who passes.
// - Bridges cross the water, and make chokepoints.
//
// Each building is a terrain of its own, so cover, height, line of sight and the fog work on it as
// they do on any ground. A building that can be held keeps its owner in `hex.owner`, like a camp.

export type StructureTerrain = 'watchtower' | 'house' | 'catapult' | 'blacksmith' | 'barracks' | 'tavern' | 'lumbermill' | 'wall' | 'gate' | 'bridge';
export type Workshop = 'blacksmith' | 'barracks' | 'tavern' | 'lumbermill';

export const STRUCTURE_TERRAINS: StructureTerrain[] = ['watchtower', 'house', 'catapult', 'blacksmith', 'barracks', 'tavern', 'lumbermill', 'wall', 'gate', 'bridge'];
export const WORKSHOPS: Workshop[] = ['blacksmith', 'barracks', 'tavern', 'lumbermill'];

export const isStructure = (terrain: TerrainType): terrain is StructureTerrain =>
  (STRUCTURE_TERRAINS as TerrainType[]).includes(terrain);

// Buildings a side takes by stepping onto them, and keeps until the enemy does
export const isCapturable = (terrain: TerrainType): boolean =>
  isStructure(terrain) && terrain !== 'house' && terrain !== 'wall' && terrain !== 'bridge';

// Extra sight for a troop up a watchtower (on top of the high ground's), and how far a side sees from
// a tower it holds while nobody is in it
export const WATCHTOWER_SIGHT_BONUS = 1;
export const HELD_TOWER_SIGHT = 3;

// Catapult tower: reach, and the damage a stone does to a troop or to a castle
export const CATAPULT_RANGE = 4;
export const CATAPULT_DAMAGE = 5;
export const CATAPULT_CASTLE_DAMAGE = 2;

// Workshops
export const BLACKSMITH_ATTACK_BONUS = 0.1;
export const BARRACKS_HEALTH_BONUS = 0.2;
export const TAVERN_INCOME = 3;
export const LUMBERMILL_FELL_REACH = 2;

// A wall's stretch on each side of its gate, at most, and the share of battles that have one
export const WALL_ARM = 2;
export const WALL_CHANCE = 0.5;
// Bridges over the water, at most
export const BRIDGE_COUNT = 2;

// How many of each go on a battlefield (houses come as one hamlet)
export const WATCHTOWER_COUNT = 2;
export const WORKSHOP_COUNT = 2;
export const HAMLET_SIZE = 3;
