import type { Hex, HexCoordinates, TerrainType } from '@/types/game';
import { getNeighbors } from './hexUtils';

// Objects on the battlefield that either side can use, the way armies have always turned the ground
// against each other:
//
// - Great trees: a few giant trees stand in the forests. Nothing can walk through one, and they block
//   arrows. A troop next to one can chop it down (order it onto the tree): it falls away from the
//   troop, crushing whatever stands on the far hex, and its trunk lies there as a barrier - an abatis
//   to close a road. Felled across water it makes a bridge.
// - Wildfire: lava sets the dry ground around it alight now and then. Embers smoulder for a turn (a
//   warning), then the hex burns: nothing can enter it, its smoke blocks arrows, and troops caught in
//   it are burned. Fire spreads through forest and grass and burns out, leaving open ground behind -
//   a forest's cover can go up in smoke.

// Damage a falling tree does to the troop it lands on
export const FELL_DAMAGE = 10;
// Damage a burning hex does to a troop on it at the end of each of its turns
export const FIRE_DAMAGE = 4;
// Turns (each side's turn counts) a hex burns before it burns out
export const BURN_TURNS = 3;
// Chance, at the end of each round, that a lava field sets a neighbouring hex smouldering
export const LAVA_FLARE_CHANCE = 0.3;
// Chance, at the end of each turn, that a burning hex sets a neighbour smouldering
export const SPREAD_CHANCE: Partial<Record<TerrainType, number>> = { forest: 0.4, plain: 0.12 };
// No new fires start once this many hexes are alight
export const MAX_FIRES = 8;
// Great trees per battle, at most, and the share of forest hexes that can hold one
export const MAX_GREAT_TREES = 3;
const GREAT_TREE_FOREST_SHARE = 0.2;

export const coordKey = (c: HexCoordinates) => `${c.q},${c.r}`;

// Whether nothing on foot can stand on or walk through a hex because of what is on it: a great tree,
// a fallen trunk, or flames
export const isBlockedByFeature = (hex: Hex): boolean =>
  hex.feature === 'greatTree' || hex.feature === 'log' || hex.fire?.stage === 'burning';

// Movement cost the hex's objects set instead of its terrain's (a log bridge over water), if any
export const featureMoveCost = (hex: Hex): number | undefined => (hex.feature === 'logBridge' ? 1 : undefined);

// How high a hex blocks line of sight because of what is on it (a great tree towers, smoke billows)
export const featureSightHeight = (hex: Hex): number =>
  hex.feature === 'greatTree' ? 3 : hex.fire?.stage === 'burning' ? 2 : 0;

// Ground that can catch fire
export const isFlammable = (hex: Hex): boolean =>
  !hex.isBase && !hex.isCamp && !hex.isResourceHex && !hex.fire && hex.feature !== 'logBridge' &&
  (hex.terrain === 'forest' || hex.terrain === 'plain');

// Where a tree felled from `from` lands: the next hex on, straight away from the troop chopping it
export const fallLanding = (from: HexCoordinates, tree: HexCoordinates): HexCoordinates => ({
  q: 2 * tree.q - from.q,
  r: 2 * tree.r - from.r
});

// The hex a tree felled from `from` would land on, if it can be felled that way: there is a hex
// there, and it isn't a castle or a camp
export const fellLandingHex = (hexByKey: Map<string, Hex>, from: HexCoordinates, tree: HexCoordinates): Hex | null => {
  const landing = hexByKey.get(coordKey(fallLanding(from, tree)));
  return landing && !landing.isBase && !landing.isCamp ? landing : null;
};

// Pick the forest hexes to grow great trees on: away from the map's edge and with open ground around
// them, so a tree never cuts the map in two, spread out, in an order set by `random`
export const pickGreatTrees = (hexGrid: Hex[], gridSize: number, random: () => number): HexCoordinates[] => {
  const hexByKey = new Map(hexGrid.map(hex => [coordKey(hex.coordinates), hex]));
  const isOpen = (c: HexCoordinates) => {
    const hex = hexByKey.get(coordKey(c));
    return !!hex && !hex.isBase && !hex.isCamp && hex.terrain !== 'mountain' && hex.terrain !== 'water';
  };
  const forests = hexGrid.filter(hex => hex.terrain === 'forest');
  const count = Math.min(MAX_GREAT_TREES, Math.floor(forests.length * GREAT_TREE_FOREST_SHARE));
  const candidates = forests
    .filter(hex => {
      const { q, r } = hex.coordinates;
      const fromCentre = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      return fromCentre < gridSize && getNeighbors(hex.coordinates).filter(isOpen).length >= 5;
    })
    .map(hex => ({ hex, order: random() }))
    .sort((a, b) => a.order - b.order)
    .map(entry => entry.hex.coordinates);
  const chosen: HexCoordinates[] = [];
  for (const c of candidates) {
    if (chosen.length >= count) break;
    if (chosen.every(other => Math.max(Math.abs(other.q - c.q), Math.abs(other.r - c.r), Math.abs(other.q + other.r - c.q - c.r)) >= 3)) {
      chosen.push(c);
    }
  }
  return chosen;
};
