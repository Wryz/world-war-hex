import { GameSettings, Hex, HexCoordinates, TerrainType } from '@/types/game';
import { canonicalHex, getHexDistance, getNeighbors, getSpiral, hexOrbit } from './hexUtils';

// Procedural battlefield generation.
// Terrain comes from smooth, multi-octave noise so it forms natural clusters (lakes, mountain
// ranges, forests) instead of stripes, then gets cleaned up and made fully traversable.

const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

const isPassableTerrain = (terrain: TerrainType) => terrain !== 'water' && terrain !== 'mountain';
// Lava and cursed ground hurt units, so passes and feature hexes are never carved through them
const isHarmfulTerrain = (terrain: TerrainType) => terrain === 'lava' || terrain === 'cursed';

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

// Unbiased in-place Fisher-Yates shuffle driven by the seeded generator
const shuffle = <T>(items: T[], random: () => number): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

// 2D value noise: random values on a lattice, smoothly interpolated between lattice points
const createValueNoise = (random: () => number) => {
  const size = 256;
  const values = Array.from({ length: size }, () => random());
  const permutation = shuffle(Array.from({ length: size }, (_, i) => i), random);

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

// A map theme: which terrain types appear and roughly how much of each. Every map rolls one
// theme, so no map has every terrain and each plays differently.
// Fractions are of the whole board; whatever isn't listed becomes plains.
export interface MapTheme {
  name: string;
  // Filled from the lowest ground upwards (first entry lowest)
  lowlands: [TerrainType, number][];
  // Filled from the highest ground downwards (first entry highest)
  highlands: [TerrainType, number][];
  // Remaining land: wettest areas
  wet: [TerrainType, number][];
  // Remaining land: driest areas
  dry: [TerrainType, number][];
  // Healing springs scattered across the middle of the map
  springs: number;
  // Region-specific scenery swapped in for some terrain
  decor?: MapDecor;
}

export type MapDecor = 'dungeon' | 'haunted';

export const MAP_THEMES: MapTheme[] = [
  {
    name: 'Green Valley',
    lowlands: [['water', 0.1]],
    highlands: [['mountain', 0.12], ['hills', 0.1]],
    wet: [['forest', 0.22]],
    dry: [],
    springs: 1
  },
  {
    name: 'Frozen Pass',
    lowlands: [['water', 0.08]],
    highlands: [['mountain', 0.14], ['snow', 0.22]],
    wet: [['forest', 0.14]],
    dry: [],
    springs: 0
  },
  {
    name: 'Marshlands',
    lowlands: [['water', 0.12], ['swamp', 0.18]],
    highlands: [['hills', 0.07]],
    wet: [['forest', 0.18]],
    dry: [],
    springs: 1
  },
  {
    name: 'Desert Frontier',
    lowlands: [['water', 0.04]],
    highlands: [['mountain', 0.12], ['hills', 0.1]],
    wet: [],
    dry: [['desert', 0.28]],
    springs: 3
  },
  {
    name: 'Highlands',
    lowlands: [['water', 0.06]],
    highlands: [['mountain', 0.1], ['snow', 0.06], ['hills', 0.18]],
    wet: [['forest', 0.15]],
    dry: [],
    springs: 1
  },
  {
    name: 'Riverlands',
    lowlands: [['water', 0.14], ['swamp', 0.06]],
    highlands: [],
    wet: [['forest', 0.16]],
    dry: [['desert', 0.08]],
    springs: 2
  },
  {
    name: 'Farmlands',
    lowlands: [['water', 0.08]],
    highlands: [['hills', 0.1]],
    wet: [['forest', 0.14]],
    dry: [['village', 0.1]],
    springs: 1
  }
];

// Themes used by the campaign's regions, including the terrain only found there
export const REGION_THEMES: MapTheme[] = [
  {
    name: 'Greenvale Meadows',
    lowlands: [['water', 0.08]],
    highlands: [['hills', 0.06]],
    wet: [['forest', 0.18]],
    dry: [],
    springs: 1
  },
  {
    name: 'Goblin Woods',
    lowlands: [['water', 0.06]],
    highlands: [['mountain', 0.06], ['hills', 0.1]],
    wet: [['forest', 0.32]],
    dry: [],
    springs: 1
  },
  {
    name: 'Howling Hills',
    lowlands: [['water', 0.06]],
    highlands: [['mountain', 0.1], ['hills', 0.24]],
    wet: [['forest', 0.12]],
    dry: [],
    springs: 2
  },
  {
    name: 'Mirefen Marsh',
    lowlands: [['water', 0.1], ['swamp', 0.24]],
    highlands: [['hills', 0.05]],
    wet: [['forest', 0.14]],
    dry: [],
    springs: 1
  },
  {
    name: 'Sunscorch Desert',
    lowlands: [['water', 0.03]],
    highlands: [['mountain', 0.08], ['hills', 0.06]],
    wet: [['ruins', 0.08]],
    dry: [['desert', 0.32]],
    springs: 2
  },
  {
    name: 'Frostpeak Pass',
    lowlands: [['ice', 0.12]],
    highlands: [['mountain', 0.12], ['snow', 0.2]],
    wet: [['forest', 0.1]],
    dry: [],
    springs: 0
  },
  {
    name: 'Gravemoor',
    lowlands: [['water', 0.05], ['swamp', 0.08]],
    highlands: [['hills', 0.06]],
    wet: [['cursed', 0.16], ['forest', 0.08]],
    dry: [['ruins', 0.1]],
    springs: 1
  },
  {
    name: 'Ironfang Badlands',
    lowlands: [['water', 0.03]],
    highlands: [['mountain', 0.12], ['hills', 0.18]],
    wet: [['ruins', 0.08]],
    dry: [['desert', 0.16]],
    springs: 1
  },
  {
    name: 'Emberforge Wastes',
    lowlands: [['lava', 0.14]],
    highlands: [['mountain', 0.14], ['hills', 0.08]],
    wet: [['ruins', 0.1]],
    dry: [['desert', 0.1]],
    springs: 1
  },
  {
    name: 'Dragonspire Peaks',
    lowlands: [['lava', 0.08], ['ice', 0.06]],
    highlands: [['mountain', 0.12], ['snow', 0.1], ['hills', 0.1]],
    wet: [['forest', 0.08], ['cursed', 0.05]],
    dry: [['ruins', 0.08]],
    springs: 1
  },
  {
    name: 'The King\'s Road',
    lowlands: [['water', 0.06]],
    highlands: [['hills', 0.1]],
    wet: [['forest', 0.14]],
    dry: [['village', 0.12]],
    springs: 1
  },
  {
    name: 'Hallowmere',
    lowlands: [['water', 0.05], ['swamp', 0.12]],
    highlands: [['hills', 0.06]],
    wet: [['cursed', 0.14], ['forest', 0.14]],
    dry: [['village', 0.05]],
    springs: 1,
    decor: 'haunted'
  },
  {
    name: 'The Underkeep',
    lowlands: [['lava', 0.1]],
    highlands: [['mountain', 0.16], ['hills', 0.06]],
    wet: [['ruins', 0.16]],
    dry: [],
    springs: 1,
    decor: 'dungeon'
  },
  {
    name: 'Rimeholt',
    lowlands: [['ice', 0.14], ['water', 0.04]],
    highlands: [['mountain', 0.14], ['snow', 0.22]],
    wet: [['forest', 0.1]],
    dry: [['village', 0.05], ['ruins', 0.04]],
    springs: 0
  },
  {
    name: 'The Last Bastion',
    lowlands: [['water', 0.05], ['lava', 0.05]],
    highlands: [['mountain', 0.1], ['hills', 0.1]],
    wet: [['forest', 0.1], ['cursed', 0.05]],
    dry: [['village', 0.08], ['ruins', 0.06]],
    springs: 1
  }
];

export const ALL_THEMES = [...MAP_THEMES, ...REGION_THEMES];

// Assign terrain types by rank so the map starts out with the theme's terrain mix.
// Speckle removal and pass carving change a few hexes afterwards, so the final mix is close but not exact.
const assignTerrain = (
  coordinates: HexCoordinates[],
  theme: MapTheme,
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
  const terrain = new Map<string, TerrainType>();
  type Cell = (typeof cells)[number];

  // Hand out terrain bands from the front of an ordered list of cells
  const takeBands = (ordered: Cell[], bands: [TerrainType, number][]) => {
    let index = 0;
    for (const [type, fraction] of bands) {
      const count = Math.round(total * fraction);
      for (const cell of ordered.slice(index, index + count)) terrain.set(cell.key, type);
      index += count;
    }
    return ordered.slice(index);
  };

  // Lowest ground floods (water, then marsh), highest ground rises (peaks, then snow and hills)
  const byElevation = [...cells].sort((a, b) => a.elevation - b.elevation);
  const aboveLowlands = takeBands(byElevation, theme.lowlands);
  const land = takeBands(aboveLowlands.reverse(), theme.highlands);

  // Remaining land: wettest areas grow forests, driest become desert
  const byMoisture = [...land].sort((a, b) => b.moisture - a.moisture);
  const notWet = takeBands(byMoisture, theme.wet);
  const middle = takeBands(notWet.reverse(), theme.dry);
  middle.forEach(cell => terrain.set(cell.key, 'plain'));

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

// Spread special hexes (gold mines, springs) out across the middle of the map,
// keeping them apart from each other and from any already chosen. On a mirrored map (`symmetry`
// equal parts) each one chosen comes with its copies in the other parts.
const chooseFeatureHexes = (
  coordinates: HexCoordinates[],
  terrain: Map<string, TerrainType>,
  gridSize: number,
  count: number,
  random: () => number,
  taken: HexCoordinates[] = [],
  symmetry = 1
): HexCoordinates[] => {
  const center = { q: 0, r: 0 };
  const candidates = shuffle(
    coordinates.filter(c => {
      const distance = getHexDistance(c, center);
      const type = terrain.get(coordKey(c))!;
      return distance >= 2 && distance <= gridSize - 2 && isPassableTerrain(type) && !isHarmfulTerrain(type) &&
        !taken.some(other => getHexDistance(other, c) < 2) &&
        (symmetry === 1 || coordKey(canonicalHex(c, symmetry)) === coordKey(c));
    }),
    random
  );

  const chosen: HexCoordinates[] = [];
  // (`count` is per part on a mirrored map: each pick brings its copies in the other parts with it)
  let picks = 0;
  for (const minimumSpacing of [4, 3, 2]) {
    for (const c of candidates) {
      if (picks >= count) break;
      const orbit = symmetry === 1 ? [c] : hexOrbit(c, symmetry);
      if (chosen.some(other => orbit.some(copy => getHexDistance(other, copy) < minimumSpacing))) continue;
      // (a mirrored copy too close to its own original isn't worth the extra mine)
      if (orbit.some((copy, i) => orbit.slice(i + 1).some(next => getHexDistance(copy, next) < 2))) continue;
      chosen.push(...orbit);
      picks++;
    }
  }
  return chosen;
};

// Make the terrain the same on every part of a mirrored map: each hex takes its orbit's lead hex's
// ground - or, where `passable` is asked for, open ground wherever any of its orbit has it (so passes
// carved through to join the map up stay open in every part)
const mirrorTerrain = (coordinates: HexCoordinates[], terrain: Map<string, TerrainType>, symmetry: number, passable = false) => {
  for (const c of coordinates) {
    const orbit = hexOrbit(c, symmetry);
    if (passable) {
      const open = orbit.map(copy => terrain.get(coordKey(copy))!).find(isPassableTerrain);
      if (open && !isPassableTerrain(terrain.get(coordKey(c))!)) terrain.set(coordKey(c), open);
      continue;
    }
    terrain.set(coordKey(c), terrain.get(coordKey(canonicalHex(c, symmetry)))!);
  }
};

// Create a hexagonal battlefield with the configured radius, using the named theme's terrain
// (or a random classic theme). The same seed always builds the same map.
export const createHexagonalGrid = (
  settings: GameSettings,
  seed = Math.floor(Math.random() * 2 ** 31),
  themeName?: string
): { hexGrid: Hex[]; theme: MapTheme } => {
  const random = createRandom(seed);
  const coordinates = getSpiral({ q: 0, r: 0 }, settings.gridSize);
  const randomTheme = MAP_THEMES[Math.floor(random() * MAP_THEMES.length)];
  const theme = ALL_THEMES.find(t => t.name === themeName) ?? randomTheme;

  // (a mirrored map: the same ground turned through each of its equal parts)
  const symmetry = settings.symmetry && [2, 3, 6].includes(settings.symmetry) ? settings.symmetry : 1;
  const terrain = assignTerrain(coordinates, theme, random);
  if (symmetry > 1) mirrorTerrain(coordinates, terrain, symmetry);
  removeSpeckles(coordinates, terrain);
  if (symmetry > 1) mirrorTerrain(coordinates, terrain, symmetry);
  connectRegions(coordinates, terrain);
  if (symmetry > 1) mirrorTerrain(coordinates, terrain, symmetry, true);

  // (on a mirrored map, the mines and springs are shared out between its parts)
  const perPart = (count: number) => (symmetry > 1 ? Math.max(1, Math.round(count / symmetry)) : count);
  const resourceCoordinates = chooseFeatureHexes(coordinates, terrain, settings.gridSize, perPart(settings.resourceHexCount), random, [], symmetry);
  const resources = new Set(resourceCoordinates.map(coordKey));
  const mineValues = new Map<string, number>();
  chooseFeatureHexes(coordinates, terrain, settings.gridSize, perPart(theme.springs), random, resourceCoordinates, symmetry)
    .forEach(c => terrain.set(coordKey(c), 'spring'));

  const hexGrid = coordinates.map(coordinates => {
    const key = coordKey(coordinates);
    const hex: Hex = {
      id: `hex-${coordinates.q}-${coordinates.r}`,
      coordinates,
      terrain: terrain.get(key)!
    };

    if (resources.has(key)) {
      hex.terrain = 'resource';
      hex.isResourceHex = true;
      // 2-4 gold per round (the same for a mine's mirrored copies)
      const lead = coordKey(symmetry > 1 ? canonicalHex(coordinates, symmetry) : coordinates);
      if (!mineValues.has(lead)) mineValues.set(lead, 2 + Math.floor(random() * 3));
      hex.resourceValue = mineValues.get(lead);
    }

    return hex;
  });

  return { hexGrid, theme };
};
