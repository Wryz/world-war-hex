import { TerrainType } from '@/types/game';
import { CATAPULT_RANGE } from '@/lib/game/structures';
import { SANDSTORM_REACH } from '@/lib/game/regionRules';

// One-line summary of what each terrain does
export const TERRAIN_SHORT_EFFECTS: Record<TerrainType, string> = {
  plain: 'No effect',
  forest: '-40% dmg, blocks arrows, hides troops',
  desert: 'Costs 2 movement',
  resource: 'Gold every turn',
  mountain: 'Impassable, blocks sight',
  water: 'Impassable',
  hills: 'High ground, 2 move',
  swamp: 'Low ground, 2 move',
  snow: 'High ground, 3 move',
  spring: 'Heals 4 per turn',
  lava: 'Low, -4 HP per turn',
  ice: 'Low ground, 2 move',
  ruins: '-25% dmg, blocks arrows',
  village: '-20% dmg, blocks arrows',
  watchtower: 'High ground, +2 sight, -20% dmg',
  house: '-40% dmg, no flanking, hides troops, burns',
  catapult: `Bombards within ${CATAPULT_RANGE} hexes each turn (${CATAPULT_RANGE - SANDSTORM_REACH} in a sandstorm)`,
  blacksmith: 'Held: +10% attack for all',
  barracks: 'Held: deploy here, +20% health',
  tavern: 'Held: +3 gold per turn',
  lumbermill: 'Held: fell trees from 2 hexes',
  wall: 'Impassable, blocks sight',
  gate: 'Held: only your troops pass',
  bridge: 'Crosses the water',
  cursed: '-2 HP per turn (undead heal)'
};

// Order terrain types are listed in the terrain guide
export const TERRAIN_ORDER: TerrainType[] = [
  'plain', 'forest', 'hills', 'village', 'ruins', 'watchtower', 'house', 'catapult', 'blacksmith', 'barracks', 'tavern', 'lumbermill', 'wall', 'gate', 'bridge', 'desert', 'swamp', 'snow', 'ice', 'spring', 'cursed', 'lava', 'resource', 'mountain', 'water'
];
