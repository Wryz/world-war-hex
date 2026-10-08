import type { TroopId } from '@/lib/game/troops';

// Card art: a picture of each troop on a transparent background - the card draws its own background
// (its faction's colour and its frame's pattern) behind it, in public/cards/: for now each troop's own
// 3D model, rendered by scripts/render-card-art.mjs from the dev page /dev/card-art.

export const cardArtUrl = (type: TroopId) => `/cards/${type}.webp`;

// Portraits are drawn at this size (5:4, the shape of a card's picture), at this many pixels per point
export const CARD_ART_WIDTH = 400;
export const CARD_ART_HEIGHT = 320;
export const CARD_ART_SCALE = 1.5;
