import { Hex, HexCoordinates } from '@/types/game';

// Axial coordinate system directions for hex grid
export const DIRECTIONS = [
  { q: 1, r: 0 },  // East
  { q: 1, r: -1 }, // Northeast 
  { q: 0, r: -1 }, // Northwest
  { q: -1, r: 0 }, // West
  { q: -1, r: 1 }, // Southwest
  { q: 0, r: 1 }   // Southeast
];

// Calculate the cubic coordinates from axial
export const axialToCube = (hex: HexCoordinates) => {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
};

// Calculate the distance between two hexes in the grid
export const getHexDistance = (a: HexCoordinates, b: HexCoordinates): number => {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
};

// Get all neighboring hex coordinates
export const getNeighbors = (hex: HexCoordinates): HexCoordinates[] => {
  return DIRECTIONS.map(dir => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r
  }));
};

// Find a hex in the grid by coordinates
export const findHexByCoordinates = (
  hexGrid: Hex[],
  coordinates: HexCoordinates
): Hex | undefined => {
  return hexGrid.find(
    hex => hex.coordinates.q === coordinates.q && hex.coordinates.r === coordinates.r
  );
};

// Get hexes within a certain range
export const getHexesInRange = (
  hexGrid: Hex[],
  center: HexCoordinates,
  range: number
): Hex[] => {
  return hexGrid.filter(hex => getHexDistance(center, hex.coordinates) <= range);
};

// Calculate the coordinates for a ring of hexes at a specific distance
export const getRing = (center: HexCoordinates, radius: number): HexCoordinates[] => {
  if (radius === 0) return [center];
  
  const results: HexCoordinates[] = [];
  
  // Start at the hex radius away in a specific direction
  let hex = {
    q: center.q + DIRECTIONS[4].q * radius,
    r: center.r + DIRECTIONS[4].r * radius
  };
  
  // Move in each of the 6 directions, radius times per direction
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(hex);
      hex = {
        q: hex.q + DIRECTIONS[i].q,
        r: hex.r + DIRECTIONS[i].r
      };
    }
  }
  
  return results;
};

// Get all hexes in a spiral pattern from the center out to a range
export const getSpiral = (center: HexCoordinates, radius: number): HexCoordinates[] => {
  const results: HexCoordinates[] = [];
  
  results.push(center);
  
  for (let r = 1; r <= radius; r++) {
    const ringHexes = getRing(center, r);
    results.push(...ringHexes);
  }
  
  return results;
};
