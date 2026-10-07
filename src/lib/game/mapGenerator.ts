import { GameSettings, Hex, HexCoordinates, TerrainType } from '@/types/game';
import { getHexDistance, getNeighbors, getSpiral } from './hexUtils';

// Procedural battlefield generation.
// Terrain comes from smooth, multi-octave noise so it forms natural clusters (lakes, mountain
// ranges, forests) instead of stripes, then gets cleaned up and made fully traversable.

const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

const isPassableTerrain = (terrain: TerrainType) => terrain !== 'water' && terrain !== 'mountain';

// Small, fast seeded random number generator
const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 2D value noise: random values on a lattice, smoothly interpolated between lattice points
const createValueNoise = (random: () => number) => {
  const size = 256;
  const values = Array.from({ length: size }, () => random());
  const permutation = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }

  const lattice = (x: number, y: number) =>
    values[permutation[(permutation[((x % size) + size) % size] + y) & (size - 1)]];
  const smooth = (t: number) => t * t * (3 - 2 * t);

  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const top = lattice(x0, y0) * (1 - tx) + lattice(x0 + 1, y0) * tx;
    const bottom = lattice(x0, y0 + 1) * (1 - tx) + lattice(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
};

// Layer a few octaves of noise for large shapes with some finer detail
const fractalNoise = (noise: (x: number, y: number) => number, x: number, y: number) => {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;
  for (let octave = 0; octave < 3; octave++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / max;
};

// Hex centre in world-like units so noise isn't skewed by the axial coordinate system
const toPlane = (c: HexCoordinates) => [Math.sqrt(3) * (c.q + c.r / 2), 1.5 * c.r];

// Assign terrain types by rank so the map matches the requested terrain mix exactly
const assignTerrain = (
  coordinates: HexCoordinates[],
  settings: GameSettings,
  random: () => number
): Map<string, TerrainType> => {
  const elevationNoise = createValueNoise(random);
  const moistureNoise = createValueNoise(random);
  const offset = random() * 1000;

  const cells = coordinates.map(c => {
    const [x, y] = toPlane(c);
    return {
      key: coordKey(c),
      elevation: fractalNoise(elevationNoise, x * 0.16 + offset, y * 0.16 + offset),
      moisture: fractalNoise(moistureNoise, x * 0.2 - offset, y * 0.2 - offset)
    };
  });

  const total = cells.length;
  const distribution = settings.terrainDistribution;
  const terrain = new Map<string, TerrainType>();

  // Lowest ground floods, highest ground becomes mountains
  const byElevation = [...cells].sort((a, b) => a.elevation - b.elevation);
  const waterCount = Math.round(total * distribution.water);
  const mountainCount = Math.round(total * distribution.mountain);
  byElevation.slice(0, waterCount).forEach(cell => terrain.set(cell.key, 'water'));
  byElevation.slice(total - mountainCount).forEach(cell => terrain.set(cell.key, 'mountain'));

  // Remaining land: wettest areas grow forests, driest become desert
  const land = byElevation.slice(waterCount, total - mountainCount).sort((a, b) => b.moisture - a.moisture);
  const forestCount = Math.round(total * distribution.forest);
  const desertCount = Math.round(total * distribution.desert);
  land.forEach((cell, index) => {
    if (index < forestCount) terrain.set(cell.key, 'forest');
    else if (index >= land.length - desertCount) terrain.set(cell.key, 'desert');
    else terrain.set(cell.key, 'plain');
  });

  return terrain;
};

// Replace lone hexes that match none of their neighbours with the most common neighbouring terrain
const removeSpeckles = (coordinates: HexCoordinates[], terrain: Map<string, TerrainType>) => {
  for (let pass = 0; pass < 2; pass++) {
    const updates: [string, TerrainType][] = [];

    for (const c of coordinates) {
      const key = coordKey(c);
      const own = terrain.get(key)!;
      const neighbors = getNeighbors(c)
        .map(n => terrain.get(coordKey(n)))
        .filter((t): t is TerrainType => !!t);
      if (neighbors.includes(own)) continue;

      const counts = new Map<TerrainType, number>();
      neighbors.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
      const [mostCommon] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['plain'];
      updates.push([key, mostCommon]);
    }

    updates.forEach(([key, t]) => terrain.set(key, t));
  }
};

// Make sure every walkable hex can reach every other one by carving passes through
// the narrowest stretch of water or mountains separating isolated pockets
const connectRegions = (coordinates: HexCoordinates[], terrain: Map<string, TerrainType>) => {
  const inGrid = new Set(coordinates.map(coordKey));
  const fromKey = (key: string): HexCoordinates => {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  };

  const findRegions = () => {
    const seen = new Set<string>();
    const regions: Set<string>[] = [];
    for (const c of coordinates) {
      const start = coordKey(c);
      if (seen.has(start) || !isPassableTerrain(terrain.get(start)!)) continue;

      const region = new Set<string>([start]);
      const queue = [start];
      seen.add(start);
      while (queue.length > 0) {
        const current = queue.pop()!;
        for (const n of getNeighbors(fromKey(current))) {
          const key = coordKey(n);
          if (!inGrid.has(key) || seen.has(key) || !isPassableTerrain(terrain.get(key)!)) continue;
          seen.add(key);
          region.add(key);
          queue.push(key);
        }
      }
      regions.push(region);
    }
    return regions.sort((a, b) => b.size - a.size);
  };

  for (let attempt = 0; attempt < 50; attempt++) {
    const regions = findRegions();
    if (regions.length <= 1) return;

    const main = regions[0];
    const isolated = regions[1];

    // Cheapest route (fewest blocked hexes) from the isolated pocket to the main region
    const cost = new Map<string, number>();
    const previous = new Map<string, string>();
    const queue: string[] = [];
    isolated.forEach(key => { cost.set(key, 0); queue.push(key); });

    let reached: string | null = null;
    while (queue.length > 0) {
      queue.sort((a, b) => cost.get(a)! - cost.get(b)!);
      const current = queue.shift()!;
      if (main.has(current)) {
        reached = current;
        break;
      }
      for (const n of getNeighbors(fromKey(current))) {
        const key = coordKey(n);
        if (!inGrid.has(key)) continue;
        const step = isPassableTerrain(terrain.get(key)!) ? 0 : 1;
        const nextCost = cost.get(current)! + step;
        if (nextCost < (cost.get(key) ?? Infinity)) {
          cost.set(key, nextCost);
          previous.set(key, current);
          queue.push(key);
        }
      }
    }

    if (!reached) return;
    for (let key: string | undefined = reached; key; key = previous.get(key)) {
      if (isPassableTerrain(terrain.get(key)!)) continue;
      terrain.set(key, 'plain');
      // Widen the pass so a single unit can't block it
      const neighbor = getNeighbors(fromKey(key))
        .map(coordKey)
        .find(k => inGrid.has(k) && !isPassableTerrain(terrain.get(k)!));
      if (neighbor) terrain.set(neighbor, 'plain');
    }
  }
};

// Spread gold mines out across the middle of the map
const chooseResourceHexes = (
  coordinates: HexCoordinates[],
  terrain: Map<string, TerrainType>,
  gridSize: number,
  count: number,
  random: () => number
): HexCoordinates[] => {
  const center = { q: 0, r: 0 };
  const candidates = coordinates
    .filter(c => {
      const distance = getHexDistance(c, center);
      return distance >= 2 && distance <= gridSize - 2 && isPassableTerrain(terrain.get(coordKey(c))!);
    })
    .sort(() => random() - 0.5);

  const chosen: HexCoordinates[] = [];
  for (const minimumSpacing of [4, 3, 2]) {
    for (const c of candidates) {
      if (chosen.length >= count) break;
      if (chosen.some(other => getHexDistance(other, c) < minimumSpacing)) continue;
      chosen.push(c);
    }
  }
  return chosen;
};

// Create a hexagonal battlefield with the configured radius and terrain mix
export const createHexagonalGrid = (settings: GameSettings, seed = Math.floor(Math.random() * 2 ** 31)): Hex[] => {
  const random = createRandom(seed);
  const coordinates = getSpiral({ q: 0, r: 0 }, settings.gridSize);

  const terrain = assignTerrain(coordinates, settings, random);
  removeSpeckles(coordinates, terrain);
  connectRegions(coordinates, terrain);

  const resources = new Set(
    chooseResourceHexes(coordinates, terrain, settings.gridSize, settings.resourceHexCount, random).map(coordKey)
  );

  return coordinates.map(coordinates => {
    const key = coordKey(coordinates);
    const hex: Hex = {
      id: `hex-${coordinates.q}-${coordinates.r}`,
      coordinates,
      terrain: terrain.get(key)!
    };

    if (resources.has(key)) {
      hex.terrain = 'resource';
      hex.isResourceHex = true;
      hex.resourceValue = 2 + Math.floor(random() * 3); // 2-4 gold per round
    }

    return hex;
  });
};
