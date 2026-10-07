import { TerrainType } from '@/types/game';

// One-line summary of what each terrain does
export const TERRAIN_SHORT_EFFECTS: Record<TerrainType, string> = {
  plain: 'No effect',
  forest: '-40% damage taken',
  desert: 'Costs 2 movement',
  resource: 'Gold every turn',
  mountain: 'Impassable',
  water: 'Impassable',
  hills: '+25% attack, 2 move',
  swamp: '+25% dmg taken, 2 move',
  snow: 'Costs 3 movement',
  spring: 'Heals 2 per turn'
};

// Order terrain types are listed in the terrain guide
export const TERRAIN_ORDER: TerrainType[] = [
  'plain', 'forest', 'hills', 'desert', 'swamp', 'snow', 'spring', 'resource', 'mountain', 'water'
];
