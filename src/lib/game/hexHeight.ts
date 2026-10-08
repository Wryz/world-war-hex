import type { Hex, HexCoordinates, TerrainType } from '@/types/game';

// How tall each hex stands: its terrain's height plus a small, fixed per-hex variation, and any
// ground dug out during the battle (Siege Sappers' Undermine). The board draws hexes this tall and shows the number,
// and the height advantage in a fight comes from it.

const BASE_HEIGHT = 1.0;

// Height of each terrain's tile - mountains tower, water sits low
const TERRAIN_HEIGHTS: Record<TerrainType, number> = {
  mountain: 2.4,
  forest: 1.4,
  plain: 1.0,
  desert: 0.6,
  resource: 1.2,
  water: 0.2,
  hills: 1.8,
  swamp: 0.45,
  snow: 2.0,
  spring: 1.0,
  lava: 0.35,
  ice: 0.3,
  ruins: 1.1,
  village: 1.1,
  // A watchtower stands on a rise as high as a hill; the other buildings on open ground
  watchtower: 1.8,
  house: 1.1,
  catapult: 1.2,
  blacksmith: 1.1,
  barracks: 1.1,
  tavern: 1.1,
  lumbermill: 1.1,
  cursed: 0.8
};

// Random per-hex height variation on top of the terrain height
const HEIGHT_VARIATION = 0.6;

// A hex's height: terrain height plus a deterministic per-hex variation (seeded by its coordinates)
export const getHeightAt = (coordinates: HexCoordinates, terrain: TerrainType): number => {
  const terrainHeight = TERRAIN_HEIGHTS[terrain] ?? BASE_HEIGHT;
  const randomSeed = coordinates.q * 1000 + coordinates.r;
  const heightNoise = ((Math.sin(randomSeed) + 1) / 2) * HEIGHT_VARIATION;
  return terrainHeight + heightNoise;
};

// A terrain's typical height, for when the exact hex isn't known
export const getTerrainHeight = (terrain: TerrainType): number => (TERRAIN_HEIGHTS[terrain] ?? BASE_HEIGHT) + HEIGHT_VARIATION / 2;

// Ground raised or dug out during a battle stays within this much of its natural height, and never
// sinks below the lowest ground
export const MAX_HEIGHT_OFFSET = 1.2;
const MIN_HEIGHT = 0.1;

// A hex's height as it stands now, digging included
export const getHexHeightOf = (hex: Pick<Hex, 'coordinates' | 'terrain' | 'heightOffset'>): number =>
  Math.max(MIN_HEIGHT, getHeightAt(hex.coordinates, hex.terrain) + (hex.heightOffset ?? 0));

// The height offset after raising (or, negative, lowering) a hex's ground by `change`
export const shiftHeightOffset = (offset: number | undefined, change: number): number =>
  Math.round(Math.max(-MAX_HEIGHT_OFFSET, Math.min(MAX_HEIGHT_OFFSET, (offset ?? 0) + change)) * 100) / 100;
