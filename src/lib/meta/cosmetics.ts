// Cosmetics bought with coins: card frames for your troop cards and styles for your castle.
// They only change how things look, never how they fight.

export type CardSkinId = 'classic' | 'parchment' | 'frost' | 'ember' | 'obsidian' | 'royal' | 'holo';
export type CastleStyleId = 'keep' | 'sandstone' | 'ice' | 'elven' | 'shadow' | 'golden';

export interface CardSkin {
  id: CardSkinId;
  name: string;
  description: string;
  price: number;
  // Card face behind the art, name and stats
  face: string;
  // Pattern laid over the art, and how strongly
  pattern: string;
  patternOpacity: number;
  // Thin inner border around the face
  trim: string;
  // The pattern drifts across the card
  animated?: boolean;
}

export interface CastleStyle {
  id: CastleStyleId;
  name: string;
  description: string;
  price: number;
  stone: string;
  stoneDark: string;
  // Roof colour; your castle's flag always flies your blue
  roof?: string;
  crown: string;
  crownGlow: string;
  // Extra decoration on the walls
  decor?: 'pennants' | 'crystals' | 'vines' | 'runes' | 'gilded';
}

export const CARD_SKINS: CardSkin[] = [
  {
    id: 'classic', name: 'Classic', description: 'The standard royal issue.', price: 0,
    face: '#0f172a', pattern: 'repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 9px)', patternOpacity: 0.15, trim: 'transparent'
  },
  {
    id: 'parchment', name: 'Old Map', description: 'Inked on weathered parchment from the royal archives.', price: 300,
    face: 'linear-gradient(170deg, #4a3b24, #1f160b)',
    pattern: 'radial-gradient(#f5deb3 1px, transparent 1.6px) 0 0 / 7px 7px', patternOpacity: 0.3, trim: '#d6b77a'
  },
  {
    id: 'frost', name: 'Frostbound', description: 'Cards that never thaw, rimed with Frostpeak ice.', price: 600,
    face: 'linear-gradient(170deg, #0c4a6e, #082f49)',
    pattern: 'radial-gradient(#e0f2fe 1px, transparent 1.6px) 0 0 / 9px 9px', patternOpacity: 0.45, trim: '#7dd3fc'
  },
  {
    id: 'ember', name: 'Emberforged', description: 'Hammered in the fires of the Emberforge.', price: 600,
    face: 'linear-gradient(170deg, #7c2d12, #1c0a05)',
    pattern: 'repeating-linear-gradient(-60deg, #fb923c 0 1px, transparent 1px 7px)', patternOpacity: 0.4, trim: '#fb923c'
  },
  {
    id: 'obsidian', name: 'Obsidian', description: 'Black glass that hums with a violet glow.', price: 900,
    face: 'linear-gradient(170deg, #241d38, #09070f)',
    pattern: 'repeating-linear-gradient(90deg, #a855f7 0 1px, transparent 1px 10px)', patternOpacity: 0.35, trim: '#a855f7'
  },
  {
    id: 'royal', name: 'Royal Seal', description: 'Deep blue and gold, fit for the throne room.', price: 1200,
    face: 'linear-gradient(170deg, #1e3a8a, #0b1440)',
    pattern: 'radial-gradient(#fcd34d 1.2px, transparent 1.8px) 0 0 / 10px 10px', patternOpacity: 0.5, trim: '#fcd34d'
  },
  {
    id: 'holo', name: 'Prismatic', description: 'A shimmering foil that catches every colour of the rainbow.', price: 2000,
    face: 'linear-gradient(135deg, #312e81, #0f172a)',
    pattern: 'linear-gradient(115deg, #f472b6, #60a5fa, #34d399, #facc15, #f472b6) 0 0 / 300% 300%', patternOpacity: 0.35,
    trim: '#f0abfc', animated: true
  }
];

export const CASTLE_STYLES: CastleStyle[] = [
  {
    id: 'keep', name: 'Stone Keep', description: 'Grey stone and a stubborn garrison.', price: 0,
    stone: '#cfc6b8', stoneDark: '#a39a8c', crown: '#ffcc33', crownGlow: '#b8860b'
  },
  {
    id: 'sandstone', name: 'Desert Fort', description: 'Sun-baked walls flying bright pennants.', price: 300,
    stone: '#e3c995', stoneDark: '#c2a36b', crown: '#ffcc33', crownGlow: '#b8860b', decor: 'pennants'
  },
  {
    id: 'ice', name: 'Ice Citadel', description: 'Carved from a glacier and crowned with crystal.', price: 700,
    stone: '#dbeafe', stoneDark: '#93c5fd', roof: '#38bdf8', crown: '#e0f2fe', crownGlow: '#38bdf8', decor: 'crystals'
  },
  {
    id: 'elven', name: 'Elven Spire', description: 'Living stone wrapped in ivy and blossom.', price: 700,
    stone: '#c7d4b6', stoneDark: '#8aa278', roof: '#2563eb', crown: '#d9f99d', crownGlow: '#65a30d', decor: 'vines'
  },
  {
    id: 'shadow', name: 'Shadow Keep', description: 'Dark basalt etched with glowing runes.', price: 1000,
    stone: '#4a4458', stoneDark: '#2a2535', roof: '#4338ca', crown: '#c084fc', crownGlow: '#7e22ce', decor: 'runes'
  },
  {
    id: 'golden', name: 'Golden Palace', description: 'White marble, gold trim and a king\'s ransom in banners.', price: 1500,
    stone: '#f8f4ea', stoneDark: '#e5d3a1', crown: '#ffd700', crownGlow: '#daa520', decor: 'gilded'
  }
];

export const DEFAULT_CARD_SKIN: CardSkinId = 'classic';
export const DEFAULT_CASTLE_STYLE: CastleStyleId = 'keep';

export const getCardSkin = (id: CardSkinId | undefined) => CARD_SKINS.find(skin => skin.id === id) ?? CARD_SKINS[0];
export const getCastleStyle = (id: CastleStyleId | undefined) => CASTLE_STYLES.find(style => style.id === id) ?? CASTLE_STYLES[0];

export const isCardSkinId = (id: unknown): id is CardSkinId => CARD_SKINS.some(skin => skin.id === id);
export const isCastleStyleId = (id: unknown): id is CastleStyleId => CASTLE_STYLES.some(style => style.id === id);
