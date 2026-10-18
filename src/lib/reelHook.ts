import type { Camera, Vector3 } from 'three';
import type { GameState } from '@/types/game';

// Hooks for filming promo reels of real battles (reels/capture in this repo). The capture script
// defines window.__reelHook before the game loads; nobody else does, so for players every call
// here is a no-op.
export interface ReelHook {
  // The game's AI plays the player's side too (castle site included)
  autoplay?: boolean;
  // Every change of the battle's state
  onState?: (state: GameState) => void;
  // After the camera rig has placed the camera for this frame: may move it (to frame the shot)
  onCamera?: (camera: Camera, lookAt: Vector3, delta: number) => void;
  // A callout the battle shows (first blood, boss down, castle falls...)
  onMoment?: (moment: { title: string; subtitle?: string; tone?: string }) => void;
}

export const reelHook = (): ReelHook | undefined =>
  typeof window === 'undefined' ? undefined : (window as { __reelHook?: ReelHook }).__reelHook;
