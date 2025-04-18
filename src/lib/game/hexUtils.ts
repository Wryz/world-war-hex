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

// Calculate the axial coordinates from cubic
export const cubeToAxial = (cube: { x: number, y: number, z: number }): HexCoordinates => {
  return { q: cube.x, r: cube.z };
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

// Calculate the pixel position of a hex for rendering
export const hexToPixel = (hex: HexCoordinates, size: number): { x: number, y: number } => {
  const x = size * (3/2 * hex.q);
  const y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
};

// Calculate the hex coordinates from a pixel position (for mouse interaction)
export const pixelToHex = (point: { x: number, y: number }, size: number): HexCoordinates => {
  const q = (2/3 * point.x) / size;
  const r = (-1/3 * point.x + Math.sqrt(3)/3 * point.y) / size;
  
  return roundHex({ q, r });
};

// Round floating point hex coordinates to the nearest hex
export const roundHex = (hex: HexCoordinates): HexCoordinates => {
  const cube = axialToCube(hex);
  
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);
  
  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);
  
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  
  return cubeToAxial({ x: rx, y: ry, z: rz });
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

// Get a path between two hexes (simple A* implementation)
export const findPath = (
  start: HexCoordinates,
  goal: HexCoordinates, 
  hexGrid: Hex[],
  maxDistance: number
): HexCoordinates[] | null => {
  const openSet = new Set<string>();
  const cameFrom = new Map<string, HexCoordinates>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  const hexKey = (hex: HexCoordinates) => `${hex.q},${hex.r}`;
  
  openSet.add(hexKey(start));
  gScore.set(hexKey(start), 0);
  fScore.set(hexKey(start), getHexDistance(start, goal));
  
  while (openSet.size > 0) {
    // Find the hex with the lowest fScore
    let currentKey = '';
    let lowestScore = Infinity;
    
    for (const key of openSet) {
      const score = fScore.get(key) || Infinity;
      if (score < lowestScore) {
        lowestScore = score;
        currentKey = key;
      }
    }
    
    if (!currentKey) break;
    
    const [q, r] = currentKey.split(',').map(Number);
    const current = { q, r };
    
    if (current.q === goal.q && current.r === goal.r) {
      // Reconstruct path
      const path: HexCoordinates[] = [current];
      let curr = current;
      
      while (hexKey(curr) !== hexKey(start)) {
        curr = cameFrom.get(hexKey(curr))!;
        path.unshift(curr);
      }
      
      return path;
    }
    
    openSet.delete(currentKey);
    
    // Check each neighbor
    const neighbors = getNeighbors(current);
    
    for (const neighbor of neighbors) {
      const neighborHex = findHexByCoordinates(hexGrid, neighbor);
      
      // Skip if not a valid hex or impassable terrain
      if (!neighborHex || neighborHex.terrain === 'water') continue;
      
      // Get movement cost (can be adjusted based on terrain)
      let movementCost = 1;
      if (neighborHex.terrain === 'mountain') movementCost = 2;
      if (neighborHex.terrain === 'forest') movementCost = 1.5;
      
      const tentativeGScore = (gScore.get(currentKey) || 0) + movementCost;
      
      if (tentativeGScore <= maxDistance) {
        const neighborKey = hexKey(neighbor);
        
        if (!gScore.has(neighborKey) || tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);
          fScore.set(neighborKey, tentativeGScore + getHexDistance(neighbor, goal));
          
          if (!openSet.has(neighborKey)) {
            openSet.add(neighborKey);
          }
        }
      }
    }
  }
  
  return null; // No path found
};

// Check if a hex is in range and line of sight for abilities like ranged attacks
export const isInLineOfSight = (
  from: HexCoordinates,
  to: HexCoordinates,
  hexGrid: Hex[],
  range: number
): boolean => {
  if (getHexDistance(from, to) > range) return false;
  
  // Very basic line of sight check that can be enhanced
  const line = getLine(from, to);
  
  // Check each hex in the line except the start and end
  for (let i = 1; i < line.length - 1; i++) {
    const hex = findHexByCoordinates(hexGrid, line[i]);
    if (hex && (hex.terrain === 'mountain' || hex.terrain === 'forest')) {
      return false;
    }
  }
  
  return true;
};

// Get a line of hexes between two points
export const getLine = (from: HexCoordinates, to: HexCoordinates): HexCoordinates[] => {
  const distance = getHexDistance(from, to);
  if (distance === 0) return [from];
  
  const results: HexCoordinates[] = [];
  
  for (let i = 0; i <= distance; i++) {
    const t = i / distance;
    const fromCube = axialToCube(from);
    const toCube = axialToCube(to);
    
    const x = fromCube.x * (1 - t) + toCube.x * t;
    const y = fromCube.y * (1 - t) + toCube.y * t;
    const z = fromCube.z * (1 - t) + toCube.z * t;
    
    results.push(cubeToAxial({ x, y, z }));
  }
  
  return results;
}; 