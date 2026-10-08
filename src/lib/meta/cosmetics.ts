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
  // The KayKit building your castle is drawn as, and its scale (a fraction of the hex-to-KayKit scale)
  model: string;
  scale: number;
  // The model pack it comes from: the standard castle is in the medieval pack every battle loads
  pack: 'medieval' | 'castles';
  // Colours for the Style screen's swatch: roof, then walls
  swatch: [string, string];
}

export const CARD_SKINS: CardSkin[] = [
  {
    id: 'classic', name: 'Classic', description: 'The standard royal issue.', price: 0,
    face: '#0f172a', pattern: 'repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 9px)', patternOpacity: 0.15, trim: 'transparent'
  },
  {
    id: 'parchment', name: 'Old Map', description: 'Inked on weathered parchment from the royal archives.', price: 300,
    face: '#3a2d1a',
    pattern: 'radial-gradient(#f5deb3 1px, transparent 1.6px) 0 0 / 7px 7px', patternOpacity: 0.3, trim: '#d6b77a'
  },
  {
    id: 'frost', name: 'Frostbound', description: 'Cards that never thaw, rimed with Frostpeak ice.', price: 600,
    face: '#0b3d5c',
    pattern: 'radial-gradient(#e0f2fe 1px, transparent 1.6px) 0 0 / 9px 9px', patternOpacity: 0.45, trim: '#7dd3fc'
  },
  {
    id: 'ember', name: 'Emberforged', description: 'Hammered in the fires of the Emberforge.', price: 600,
    face: '#5a210d',
    pattern: 'repeating-linear-gradient(-60deg, #fb923c 0 1px, transparent 1px 7px)', patternOpacity: 0.4, trim: '#fb923c'
  },
  {
    id: 'obsidian', name: 'Obsidian', description: 'Black glass that hums with a violet glow.', price: 900,
    face: '#1a1528',
    pattern: 'repeating-linear-gradient(90deg, #a855f7 0 1px, transparent 1px 10px)', patternOpacity: 0.35, trim: '#a855f7'
  },
  {
    id: 'royal', name: 'Royal Seal', description: 'Deep blue and gold, fit for the throne room.', price: 1200,
    face: '#16296a',
    pattern: 'radial-gradient(#fcd34d 1.2px, transparent 1.8px) 0 0 / 10px 10px', patternOpacity: 0.5, trim: '#fcd34d'
  },
  {
    id: 'holo', name: 'Prismatic', description: 'A shimmering foil that catches every colour of the rainbow.', price: 2000,
    face: '#25226a',
    pattern: 'repeating-linear-gradient(115deg, #f472b6 0 6px, #60a5fa 6px 12px, #34d399 12px 18px, #facc15 18px 24px)', patternOpacity: 0.35,
    trim: '#f0abfc', animated: true
  }
];

// Each style is a real KayKit building (Medieval Hexagon Pack and Halloween Bits, CC0)
export const CASTLE_STYLES: CastleStyle[] = [
  {
    id: 'keep', name: 'Stone Keep', description: 'Grey stone, blue banners and a stubborn garrison.', price: 0,
    model: 'building_castle_blue', scale: 0.58, pack: 'medieval', swatch: ['#3b82f6', '#cfc6b8']
  },
  {
    id: 'sandstone', name: 'Desert Fort', description: 'The same stout walls under sun-gold roofs.', price: 300,
    model: 'building_castle_yellow', scale: 0.58, pack: 'castles', swatch: ['#facc15', '#cfc6b8']
  },
  {
    id: 'ice', name: 'Watchtower', description: 'One tall tower that sees the whole battlefield.', price: 700,
    model: 'building_tower_B_blue', scale: 0.92, pack: 'castles', swatch: ['#3b82f6', '#a8a29e']
  },
  {
    id: 'elven', name: 'Forest Keep', description: 'A castle roofed in forest green.', price: 700,
    model: 'building_castle_green', scale: 0.58, pack: 'castles', swatch: ['#22c55e', '#cfc6b8']
  },
  {
    id: 'shadow', name: 'Haunted Crypt', description: 'Rule from a mausoleum - the enemy will think twice.', price: 1000,
    model: 'crypt', scale: 0.19, pack: 'castles', swatch: ['#6d28d9', '#57534e']
  },
  {
    id: 'golden', name: 'Golden Cathedral', description: 'A great cathedral with a golden spire.', price: 1500,
    model: 'building_church_yellow', scale: 1.25, pack: 'castles', swatch: ['#facc15', '#f8f4ea']
  }
];

export const DEFAULT_CARD_SKIN: CardSkinId = 'classic';
export const DEFAULT_CASTLE_STYLE: CastleStyleId = 'keep';

export const getCardSkin = (id: CardSkinId | undefined) => CARD_SKINS.find(skin => skin.id === id) ?? CARD_SKINS[0];
export const getCastleStyle = (id: CastleStyleId | undefined) => CASTLE_STYLES.find(style => style.id === id) ?? CASTLE_STYLES[0];

export const isCardSkinId = (id: unknown): id is CardSkinId => CARD_SKINS.some(skin => skin.id === id);
export const isCastleStyleId = (id: unknown): id is CastleStyleId => CASTLE_STYLES.some(style => style.id === id);
