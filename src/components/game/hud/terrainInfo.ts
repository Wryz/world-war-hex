import { TerrainType } from '@/types/game';

// One-line summary of what each terrain does
export const TERRAIN_SHORT_EFFECTS: Record<TerrainType, string> = {
  plain: 'No effect',
  forest: '-40% dmg, blocks arrows',
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
  cursed: '-2 HP per turn (undead heal)'
};

// Order terrain types are listed in the terrain guide
export const TERRAIN_ORDER: TerrainType[] = [
  'plain', 'forest', 'hills', 'ruins', 'desert', 'swamp', 'snow', 'ice', 'spring', 'cursed', 'lava', 'resource', 'mountain', 'water'
];
