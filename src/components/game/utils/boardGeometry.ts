import { Hex, HexCoordinates } from '@/types/game';
import { TERRAIN_EFFECTS } from '@/lib/game/gameState';

// Shared board geometry so tiles, units and markers all agree on positions and heights

export const HEX_SIZE = 1.0;
export const BEVEL_THICKNESS = 0.05;

// Height of a tile at each elevation the rules use (0 low ground, 1 level, 2 high ground, 3 peaks),
// so every tile with the same height number stands at exactly the same height
const ELEVATION_HEIGHTS = [0.45, 1.0, 1.65, 2.4];

// Extrusion depth of a hex tile, from its terrain's elevation
export const getHexHeight = (hex: Hex): number =>
  ELEVATION_HEIGHTS[TERRAIN_EFFECTS[hex.terrain]?.elevation ?? 1] ?? ELEVATION_HEIGHTS[1];

// Y coordinate of the top surface of a tile (the extrusion is bevelled on both faces)
export const getHexSurfaceHeight = (hex: Hex): number => getHexHeight(hex) + BEVEL_THICKNESS * 2;

// Coordinate converter for pointy-top hexagons - y is up in Three.js
export const axialToWorld = (coordinates: HexCoordinates): [number, number, number] => {
  const x = HEX_SIZE * Math.sqrt(3) * (coordinates.q + coordinates.r / 2);
  const z = HEX_SIZE * 3 / 2 * coordinates.r;
  // Always return y=0 to ensure all hexes sit on the same plane
  return [x, 0, z];
};
