// The campaign map's art: each region is an island built from Kenney's Map Pack tiles (CC0,
// kenney.nl) - land auto-tiled from a mask, a raised plateau of a second terrain, the yellow road
// between the ten levels, and scenery that fits the region.

export const MAP_SHEET_URL = '/map/kenney-map-pack.webp';
// The sea, as a tile that repeats seamlessly behind the islands
export const MAP_SEA_URL = '/map/water.webp';
// The sheet is a 17 x 12 grid of 128px tiles
export const SHEET_TILE = 128;

// Islands are drawn on a grid of this many cells, with a ring of sea around the land
export const MAP_COLS = 9;
export const MAP_ROWS = 13;

// A tile on the sheet, as [row, column]
export type Tile = readonly [number, number];

type Terrain = 'sand' | 'grass' | 'stone' | 'snow' | 'dirt' | 'autumn';

// Top-left tile of each terrain's block: three columns of edges (top, middle, cliff and low-cliff
// rows) and a 2 x 2 set of inner corners beside them
const TERRAIN_BLOCK: Record<Terrain, Tile> = {
  sand: [0, 0], grass: [0, 5], stone: [0, 10], snow: [4, 0], dirt: [4, 5], autumn: [4, 10]
};

const SCENERY = {
  dryBush: [2, 3], cactus: [2, 4], sandRock: [3, 3], tent: [3, 4],
  rock: [2, 8], pine: [2, 9], bush: [3, 8], tree: [3, 9],
  pinkCrystal: [2, 13], purpleCrystal: [2, 14], portal: [3, 13], sprout: [3, 14],
  snowman: [6, 3], igloo: [6, 4], snowyTree: [7, 3], snowyPine: [7, 4],
  tower: [6, 8], castle: [6, 9], sign: [7, 8], bigTree: [7, 9],
  redMushroom: [6, 13], mushroom: [6, 14], mushrooms: [7, 13], deadTree: [7, 14]
} as const satisfies Record<string, Tile>;
type Scenery = keyof typeof SCENERY;

// Road pieces by the sides they join, as N, E, S and W bits
const N = 1, E = 2, S = 4, W = 8;
const ROAD: Record<number, Tile> = {
  [E | W]: [8, 6], [N | S]: [8, 5], [N | E | S | W]: [8, 7],
  [S | E]: [8, 0], [S | W]: [8, 1], [N | E]: [9, 0], [N | W]: [9, 1],
  [E | W | S]: [8, 4], [E | W | N]: [9, 4], [N | S | E]: [9, 5], [N | S | W]: [9, 6],
  [S]: [8, 8], [N]: [9, 8], [W]: [8, 9], [E]: [9, 9]
};

// Road layouts: digits are the region's levels in order (0 is the tenth, its boss), other marks
// are road. Rows and columns match the island grid.
const ROUTES = [
  [
    '.........',
    '.........',
    '..1-2-3..',
    '......|..',
    '..5-4-+..',
    '..|......',
    '..6-7-8..',
    '......|..',
    '......9..',
    '......|..',
    '..0---+..',
    '.........',
    '.........'
  ],
  [
    '.........',
    '.........',
    '....1....',
    '....|....',
    '..3-2....',
    '..|......',
    '..4-5-6..',
    '......|..',
    '..9-8-7..',
    '..|......',
    '..0......',
    '.........',
    '.........'
  ]
];

interface Rect { col: number; row: number; cols: number; rows: number }

interface RegionArt {
  route: number;
  mirror: boolean;
  land: Terrain;
  plateau: Terrain;
  plateauAt: Rect;
  // Bites taken out of the island's edge
  cutouts: Rect[];
  scenery: Scenery[];
  // A wash of colour over the land, for regions the tiles don't quite cover
  tint?: string;
}

// The island is land from column 1 to 7 and row 1 to 11 before cutouts
const ISLAND: Rect = { col: 1, row: 1, cols: 7, rows: 11 };

const REGION_ART: RegionArt[] = [
  // Greenvale Meadows
  { route: 0, mirror: false, land: 'grass', plateau: 'dirt', plateauAt: { col: 4, row: 6, cols: 3, rows: 3 },
    cutouts: [{ col: 6, row: 1, cols: 2, rows: 1 }, { col: 1, row: 8, cols: 1, rows: 4 }],
    scenery: ['tree', 'tree', 'bush', 'bush', 'redMushroom', 'pine', 'rock', 'tree'] },
  // Goblin Woods
  { route: 1, mirror: true, land: 'grass', plateau: 'grass', plateauAt: { col: 2, row: 2, cols: 3, rows: 3 },
    cutouts: [{ col: 1, row: 1, cols: 2, rows: 1 }, { col: 7, row: 9, cols: 1, rows: 3 }],
    scenery: ['pine', 'pine', 'pine', 'tree', 'bush', 'mushrooms', 'pine'] },
  // Howling Hills
  { route: 0, mirror: true, land: 'dirt', plateau: 'grass', plateauAt: { col: 2, row: 5, cols: 4, rows: 3 },
    cutouts: [{ col: 1, row: 1, cols: 1, rows: 3 }, { col: 6, row: 11, cols: 2, rows: 1 }],
    scenery: ['rock', 'rock', 'bigTree', 'bush', 'deadTree', 'sandRock'] },
  // Mirefen Marsh
  { route: 1, mirror: false, land: 'grass', plateau: 'stone', plateauAt: { col: 5, row: 2, cols: 3, rows: 2 },
    cutouts: [{ col: 6, row: 10, cols: 2, rows: 2 }, { col: 1, row: 1, cols: 2, rows: 1 }],
    scenery: ['mushrooms', 'deadTree', 'bush', 'mushroom', 'deadTree', 'tree'], tint: 'rgba(17, 94, 89, 0.42)' },
  // Sunscorch Desert
  { route: 0, mirror: false, land: 'sand', plateau: 'autumn', plateauAt: { col: 2, row: 6, cols: 3, rows: 2 },
    cutouts: [{ col: 7, row: 5, cols: 1, rows: 3 }, { col: 1, row: 1, cols: 2, rows: 1 }],
    scenery: ['cactus', 'cactus', 'tent', 'sandRock', 'dryBush', 'dryBush'] },
  // Frostpeak Pass
  { route: 1, mirror: true, land: 'snow', plateau: 'stone', plateauAt: { col: 4, row: 2, cols: 3, rows: 3 },
    cutouts: [{ col: 6, row: 10, cols: 2, rows: 2 }, { col: 7, row: 1, cols: 1, rows: 2 }],
    scenery: ['snowyPine', 'snowyPine', 'snowyTree', 'snowman', 'igloo', 'rock'] },
  // Gravemoor
  { route: 0, mirror: true, land: 'stone', plateau: 'dirt', plateauAt: { col: 2, row: 7, cols: 3, rows: 3 },
    cutouts: [{ col: 1, row: 4, cols: 1, rows: 3 }, { col: 6, row: 1, cols: 2, rows: 1 }],
    scenery: ['deadTree', 'deadTree', 'purpleCrystal', 'rock', 'rock', 'sprout'], tint: 'rgba(109, 40, 217, 0.22)' },
  // Ironfang Badlands
  { route: 1, mirror: false, land: 'autumn', plateau: 'dirt', plateauAt: { col: 4, row: 3, cols: 3, rows: 2 },
    cutouts: [{ col: 7, row: 7, cols: 1, rows: 5 }, { col: 1, row: 1, cols: 1, rows: 2 }],
    scenery: ['deadTree', 'sandRock', 'rock', 'tower', 'deadTree', 'dryBush'] },
  // Emberforge Wastes
  { route: 0, mirror: false, land: 'autumn', plateau: 'stone', plateauAt: { col: 2, row: 7, cols: 3, rows: 2 },
    cutouts: [{ col: 1, row: 1, cols: 2, rows: 1 }, { col: 7, row: 9, cols: 1, rows: 3 }],
    scenery: ['deadTree', 'deadTree', 'sandRock', 'pinkCrystal', 'rock'], tint: 'rgba(185, 28, 28, 0.32)' },
  // Dragonspire Peaks
  { route: 1, mirror: true, land: 'stone', plateau: 'snow', plateauAt: { col: 4, row: 5, cols: 3, rows: 3 },
    cutouts: [{ col: 1, row: 1, cols: 1, rows: 2 }, { col: 6, row: 11, cols: 2, rows: 1 }],
    scenery: ['snowyPine', 'pinkCrystal', 'rock', 'snowyTree', 'pinkCrystal'], tint: 'rgba(159, 18, 57, 0.18)' }
];

export interface Sprite {
  tile: Tile;
  col: number;
  row: number;
  // Size and nudge, in cells
  scale: number;
  dx: number;
  dy: number;
}

export interface RegionMap {
  // Drawn in order over the sea: land, plateau, road, scenery
  layers: { sprites: Sprite[]; tint?: string }[];
  // Cell of each of the region's ten levels, in order
  nodes: { col: number; row: number }[];
}

const cellKey = (col: number, row: number) => `${col},${row}`;

const inRect = (rect: Rect, col: number, row: number) =>
  col >= rect.col && col < rect.col + rect.cols && row >= rect.row && row < rect.row + rect.rows;

// Small seeded random numbers, so each region's scenery is the same every visit
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The tile for a land cell, from which of its neighbours are land too
const landTile = (terrain: Terrain, isLand: (col: number, row: number) => boolean, col: number, row: number, lowCliff: boolean): Tile => {
  const [r0, c0] = TERRAIN_BLOCK[terrain];
  const at = (r: number, c: number): Tile => [r0 + r, c0 + c];
  const n = isLand(col, row - 1), s = isLand(col, row + 1), e = isLand(col + 1, row), w = isLand(col - 1, row);
  const side = !w ? 0 : !e ? 2 : 1;
  if (!n) return at(0, side);
  if (!s) return at(lowCliff ? 3 : 2, side);
  if (side !== 1) return at(1, side);
  if (!isLand(col + 1, row + 1)) return at(0, 3);
  if (!isLand(col - 1, row + 1)) return at(0, 4);
  if (!isLand(col + 1, row - 1)) return at(1, 3);
  if (!isLand(col - 1, row - 1)) return at(1, 4);
  return at(1, 1);
};

export const buildRegionMap = (regionId: number): RegionMap => {
  const art = REGION_ART[regionId % REGION_ART.length];
  const flip = (col: number) => (art.mirror ? MAP_COLS - 1 - col : col);
  const flipRect = (rect: Rect): Rect => (art.mirror ? { ...rect, col: MAP_COLS - rect.col - rect.cols } : rect);
  const cutouts = art.cutouts.map(flipRect);
  const plateauAt = flipRect(art.plateauAt);

  const isLand = (col: number, row: number) => inRect(ISLAND, col, row) && !cutouts.some(rect => inRect(rect, col, row));
  const isPlateau = (col: number, row: number) => isLand(col, row) && inRect(plateauAt, col, row);

  // The road and the levels on it
  const route = ROUTES[art.route];
  const road = new Set<string>();
  const nodes: { col: number; row: number }[] = [];
  route.forEach((line, row) => [...line].forEach((mark, c) => {
    if (mark === '.') return;
    const col = flip(c);
    road.add(cellKey(col, row));
    if (mark >= '0' && mark <= '9') nodes[mark === '0' ? 9 : Number(mark) - 1] = { col, row };
  }));
  const isRoad = (col: number, row: number) => road.has(cellKey(col, row));

  const land: Sprite[] = [];
  const plateau: Sprite[] = [];
  const roads: Sprite[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const sprite = (tile: Tile): Sprite => ({ tile, col, row, scale: 1, dx: 0, dy: 0 });
      if (isLand(col, row)) land.push(sprite(landTile(art.land, isLand, col, row, false)));
      if (isPlateau(col, row)) plateau.push(sprite(landTile(art.plateau, isPlateau, col, row, true)));
      if (isRoad(col, row)) {
        const joins = (isRoad(col, row - 1) ? N : 0) | (isRoad(col + 1, row) ? E : 0) | (isRoad(col, row + 1) ? S : 0) | (isRoad(col - 1, row) ? W : 0);
        const tile = ROAD[joins];
        if (tile) roads.push(sprite(tile));
      }
    }
  }

  // Scenery on the open land: not on the road, not under a level's stars, and not on the cliffs
  const random = seededRandom(regionId * 7919 + 17);
  const scenery: Sprite[] = [];
  const boss = nodes[9];
  const nearBoss = [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]]
    .map(([dc, dr]) => ({ col: boss.col + dc, row: boss.row + dr }))
    .find(({ col, row }) => isLand(col, row) && isLand(col, row + 1) && !isRoad(col, row));
  if (nearBoss) scenery.push({ tile: SCENERY.castle, ...nearBoss, scale: 1.15, dx: 0, dy: -0.08 });
  const taken = new Set([nearBoss && cellKey(nearBoss.col, nearBoss.row), ...nodes.map(node => cellKey(node.col, node.row + 1))]);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (!isLand(col, row) || !isLand(col, row + 1) || isRoad(col, row) || taken.has(cellKey(col, row))) continue;
      if (random() > 0.6) continue;
      const kind = art.scenery[Math.floor(random() * art.scenery.length)];
      scenery.push({
        tile: SCENERY[kind],
        col,
        row,
        scale: 0.75 + random() * 0.25,
        dx: (random() - 0.5) * 0.3,
        dy: (random() - 0.5) * 0.3
      });
    }
  }
  // Draw from the back (top) of the island forward so nearer scenery overlaps
  scenery.sort((a, b) => a.row + a.dy - (b.row + b.dy));

  return {
    layers: [{ sprites: land, tint: art.tint }, { sprites: plateau, tint: art.tint }, { sprites: roads }, { sprites: scenery }],
    nodes
  };
};
