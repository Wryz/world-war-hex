import { Hex, HexCoordinates, TerrainType } from '@/types/game';

// Shared board geometry so tiles, units and markers all agree on positions and heights

export const HEX_SIZE = 1.0;
export const BEVEL_THICKNESS = 0.05;

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
  spring: 1.0
};

// Random per-hex height variation on top of the terrain height
const HEIGHT_VARIATION = 0.6;

// Extrusion depth of a hex tile: terrain height plus a deterministic per-hex variation
export const getHexHeight = (hex: Hex): number => {
  const terrainHeight = TERRAIN_HEIGHTS[hex.terrain] ?? BASE_HEIGHT;
  // Add some randomness for natural look (but keep a seed based on coordinates for consistency)
  const randomSeed = hex.coordinates.q * 1000 + hex.coordinates.r;
  const heightNoise = ((Math.sin(randomSeed) + 1) / 2) * HEIGHT_VARIATION;
  return terrainHeight + heightNoise;
};

// Y coordinate of the top surface of a tile (the extrusion is bevelled on both faces)
export const getHexSurfaceHeight = (hex: Hex): number => getHexHeight(hex) + BEVEL_THICKNESS * 2;

// Coordinate converter for pointy-top hexagons - y is up in Three.js
export const axialToWorld = (coordinates: HexCoordinates): [number, number, number] => {
  const x = HEX_SIZE * Math.sqrt(3) * (coordinates.q + coordinates.r / 2);
  const z = HEX_SIZE * 3 / 2 * coordinates.r;
  // Always return y=0 to ensure all hexes sit on the same plane
  return [x, 0, z];
};
