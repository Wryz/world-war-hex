import { TerrainType } from '@/types/game';

// One-line summary of what each terrain does
export const TERRAIN_SHORT_EFFECTS: Record<TerrainType, string> = {
  plain: 'No effect',
  forest: '-40% damage taken',
  desert: 'Costs 2 movement',
  resource: 'Gold every round',
  mountain: 'Impassable',
  water: 'Impassable'
};

// Order terrain types are listed in the terrain guide
export const TERRAIN_ORDER: TerrainType[] = ['plain', 'forest', 'desert', 'resource', 'mountain', 'water'];
