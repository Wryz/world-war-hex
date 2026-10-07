import { TerrainType } from '@/types/game';

// Icons used for each terrain type throughout the HUD
export const TERRAIN_ICONS: Record<TerrainType, string> = {
  plain: '🌾',
  forest: '🌲',
  desert: '🏜️',
  resource: '💰',
  mountain: '⛰️',
  water: '🌊'
};

// Order terrain types are listed in the terrain guide
export const TERRAIN_ORDER: TerrainType[] = ['plain', 'forest', 'desert', 'resource', 'mountain', 'water'];
