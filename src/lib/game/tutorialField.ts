import type { HexCoordinates, TerrainType } from '@/types/game';

// The first battle's field, laid out by hand so every lesson comes up: a small board (radius 3) with
// the castles four hexes apart, a camp on each side a short march from its castle, a belt of woods
// across the middle to hide in, and a spring beside your castle to fall back to and heal.

export const TUTORIAL_LEVEL_ID = 1;

export const TUTORIAL_CASTLES: { player: HexCoordinates; ai: HexCoordinates } = {
  player: { q: 0, r: 2 },
  ai: { q: 0, r: -2 }
};

export const TUTORIAL_CAMPS: HexCoordinates[] = [{ q: 2, r: 0 }, { q: -2, r: 0 }];

// Everything else is open grassland
export const TUTORIAL_TERRAIN: Record<string, TerrainType> = {
  // The woods across the middle
  '0,0': 'forest', '1,0': 'forest', '-1,1': 'forest', '-1,0': 'forest',
  // A spring by your castle
  '-1,2': 'spring',
  // A hill each side, behind the camps
  '2,1': 'hills', '-2,-1': 'hills'
};
