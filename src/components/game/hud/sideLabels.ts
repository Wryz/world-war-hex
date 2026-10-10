import type { GameState, PlayerType } from '@/types/game';
import { areAllies, isMultiSide } from '@/lib/game/sides';

// How the HUD names a side, seen from the viewer's: "You", "Enemy" against the AI, or the side's name
// in a battle between more sides
export const sideLabel = (state: Pick<GameState, 'players' | 'sides'>, side: PlayerType | undefined, viewer: PlayerType): string =>
  side === viewer ? 'You' : side && isMultiSide(state) ? state.players[side]?.name ?? 'Enemy' : 'Enemy';

// "Your" / "Enemy" / "Ada's"
export const sideOwnerLabel = (state: Pick<GameState, 'players' | 'sides'>, side: PlayerType | undefined, viewer: PlayerType, enemyWord = 'Enemy'): string =>
  side === viewer ? 'Your' : side && isMultiSide(state) ? `${state.players[side]?.name ?? enemyWord}'s` : enemyWord;

// Whether a side fights on the viewer's side (the viewer's own included)
export const isFriendly = (state: Pick<GameState, 'players'>, side: PlayerType | undefined, viewer: PlayerType): boolean =>
  areAllies(state, side, viewer);
