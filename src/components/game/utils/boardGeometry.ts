import { Hex, HexCoordinates } from '@/types/game';
import { getHexHeightOf } from '@/lib/game/hexHeight';

// Shared board geometry so tiles, units and markers all agree on positions and heights

export const HEX_SIZE = 1.0;
export const BEVEL_THICKNESS = 0.05;

// Extrusion depth of a hex tile: how tall the hex stands (see lib/game/hexHeight)
export const getHexHeight = (hex: Hex): number => getHexHeightOf(hex);

export const getHexSurfaceHeight = (hex: Hex): number => getHexHeight(hex) + BEVEL_THICKNESS * 2;

// Coordinate converter for pointy-top hexagons - y is up in Three.js
export const axialToWorld = (coordinates: HexCoordinates): [number, number, number] => {
  const x = HEX_SIZE * Math.sqrt(3) * (coordinates.q + coordinates.r / 2);
  const z = HEX_SIZE * 3 / 2 * coordinates.r;
  // Always return y=0 to ensure all hexes sit on the same plane
  return [x, 0, z];
};
