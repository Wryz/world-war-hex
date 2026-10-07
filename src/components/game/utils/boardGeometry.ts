import { Hex, HexCoordinates, TerrainType } from '@/types/game';

// Shared board geometry so tiles, units and markers all agree on positions and heights

export const HEX_SIZE = 1.0;
export const BEVEL_THICKNESS = 0.05;

const BASE_HEIGHT = 0.5;

// Terrain heights - scale these to make more dramatic landscape
export const TERRAIN_HEIGHTS: Record<TerrainType, number> = {
  mountain: 1.2,
  forest: 0.7,
  plain: 0.5,
  desert: 0.3,
  resource: 0.6,
  water: 0.1
};

// Extrusion depth of a hex tile: terrain height plus a deterministic per-hex variation
export const getHexHeight = (hex: Hex): number => {
  const terrainHeight = TERRAIN_HEIGHTS[hex.terrain] ?? BASE_HEIGHT;
  // Add some randomness for natural look (but keep a seed based on coordinates for consistency)
  const randomSeed = hex.coordinates.q * 1000 + hex.coordinates.r;
  const heightNoise = ((Math.sin(randomSeed) + 1) / 2) * 0.3; // 0-0.3 variation
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
