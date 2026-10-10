import type { GameState, PlayerType } from '@/types/game';

// The colours the sides of a battle wear: blue for you and red for the enemy against the AI, and in a
// battle between more sides one of these for each (`Player.color` picks it). The board's 3D pieces
// read them from here, so the battle on screen registers its sides as it starts (registerSides).

export const PLAYER_BLUE = '#3b82f6';
export const ENEMY_RED = '#ef4444';
export const NEUTRAL_YELLOW = '#facc15';

export const SIDE_PALETTE = [
  { name: 'Blue', color: PLAYER_BLUE, castle: 'building_castle_blue', flag: 'flag_blue' },
  { name: 'Red', color: ENEMY_RED, castle: 'building_castle_red', flag: 'flag_red' },
  { name: 'Green', color: '#22c55e', castle: 'building_castle_green' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'White', color: '#f1f5f9' }
] as const;

type SideLook = { color: string; castle?: string; flag?: string };

let looks: Record<string, SideLook> = {
  player: { color: PLAYER_BLUE, castle: 'building_castle_blue', flag: 'flag_blue' },
  ai: { color: ENEMY_RED, castle: 'building_castle_red', flag: 'flag_red' }
};

// The palette entry a side of a battle between more sides wears
export const paletteOf = (index: number | undefined) => SIDE_PALETTE[((index ?? 0) % SIDE_PALETTE.length + SIDE_PALETTE.length) % SIDE_PALETTE.length];

// Note the colours of the battle being shown
export const registerSides = (state: Pick<GameState, 'players' | 'sides'>): void => {
  if (!state.sides) {
    looks = {
      player: { color: PLAYER_BLUE, castle: 'building_castle_blue', flag: 'flag_blue' },
      ai: { color: ENEMY_RED, castle: 'building_castle_red', flag: 'flag_red' }
    };
    return;
  }
  looks = Object.fromEntries(state.sides.map(side => {
    const entry: { color: string; castle?: string; flag?: string } = paletteOf(state.players[side]?.color);
    return [side, { color: entry.color, castle: entry.castle, flag: entry.flag }];
  }));
};

// A side's colour (neutral yellow for nobody)
export const sideColor = (side: PlayerType | null | undefined): string =>
  side ? looks[side]?.color ?? ENEMY_RED : NEUTRAL_YELLOW;

// The KayKit castle a side's castle is built as (a castle of its colour where there is one)
export const sideCastleModel = (side: PlayerType): string => looks[side]?.castle ?? 'building_castle_red';

// The KayKit flag a camp held by a side flies, if there is one of its colour
export const sideFlagModel = (side: PlayerType | null): string | undefined =>
  side ? looks[side]?.flag : 'flag_yellow';
