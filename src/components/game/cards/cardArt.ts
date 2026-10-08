import type { TerrainType } from '@/types/game';
import type { Faction, TroopId } from '@/lib/game/troops';

// Card art: a portrait of each troop's own 3D model standing on its home ground, in front of a
// backdrop in its faction's colours. The portraits are rendered once by scripts/render-card-art.mjs
// (from the dev page /dev/card-art) into public/cards/, and cards show them over the same backdrop.

export const cardArtUrl = (type: TroopId) => `/cards/${type}.jpg`;

// Portraits are rendered at this size (5:4, the shape of a card's picture)
export const CARD_ART_WIDTH = 400;
export const CARD_ART_HEIGHT = 320;

interface Backdrop {
  // Sky, top to horizon
  sky: [string, string];
  // Sun or moon glow
  glow: string;
  // Far and near hills
  hills: [string, string];
  // The hex the troop stands on
  terrain: TerrainType;
}

export const FACTION_BACKDROPS: Record<Faction, Backdrop> = {
  kingdom: { sky: ['#60a5fa', '#dbeafe'], glow: '#fef9c3', hills: ['#86c46a', '#4d8f3a'], terrain: 'plain' },
  bandits: { sky: ['#f59e0b', '#fde68a'], glow: '#fff7d6', hills: ['#b8a05a', '#7c6a33'], terrain: 'plain' },
  goblins: { sky: ['#166534', '#86efac'], glow: '#ecfccb', hills: ['#2f6b3a', '#1c4a26'], terrain: 'forest' },
  beasts: { sky: ['#64748b', '#e2c8a8'], glow: '#fde68a', hills: ['#8a7f6c', '#5c5346'], terrain: 'hills' },
  swamp: { sky: ['#134e4a', '#99c9a4'], glow: '#d9f99d', hills: ['#3f6b55', '#294a3b'], terrain: 'swamp' },
  desert: { sky: ['#ea580c', '#fed7aa'], glow: '#fff1c2', hills: ['#e0a85a', '#b8783a'], terrain: 'desert' },
  frost: { sky: ['#0ea5e9', '#e0f2fe'], glow: '#ffffff', hills: ['#cbe3f2', '#93b9d4'], terrain: 'snow' },
  undead: { sky: ['#1e1b4b', '#7c6aa8'], glow: '#e9d5ff', hills: ['#3b3256', '#241e38'], terrain: 'cursed' },
  orcs: { sky: ['#7c2d12', '#e8a87c'], glow: '#fed7aa', hills: ['#8a5a3a', '#5a3a26'], terrain: 'ruins' },
  infernal: { sky: ['#450a0a', '#f97316'], glow: '#fde047', hills: ['#5a1a0e', '#2a0a06'], terrain: 'lava' },
  dragons: { sky: ['#881337', '#fda4af'], glow: '#ffe4e6', hills: ['#6b4250', '#43262f'], terrain: 'hills' }
};

// The backdrop as CSS: a glowing sky over two rolling lines of hills
export const backdropCss = (faction: Faction): string => {
  const { sky, glow, hills } = FACTION_BACKDROPS[faction];
  return [
    `radial-gradient(circle at 74% 26%, ${glow} 0 6%, transparent 22%)`,
    `radial-gradient(ellipse 75% 34% at 18% 100%, ${hills[1]} 0 70%, transparent 71%)`,
    `radial-gradient(ellipse 85% 42% at 82% 100%, ${hills[0]} 0 70%, transparent 71%)`,
    `linear-gradient(to bottom, ${sky[0]} 0%, ${sky[1]} 78%)`
  ].join(', ');
};
