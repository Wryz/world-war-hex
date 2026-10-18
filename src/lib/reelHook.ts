import type { Camera, Vector3 } from 'three';
import type { GameState, TroopStats } from '@/types/game';

// Hooks for filming promo reels of real battles (reels/capture in this repo). The capture script
// defines window.__reelHook before the game loads; nobody else does, so for players every call
// here is a no-op.
export interface ReelHook {
  // The game's AI plays the player's side too (castle site included)
  autoplay?: boolean;
  // The enemy's troops fight at this share of their attack and health (so a filmed battle is won)
  enemyStrength?: number;
  // Every change of the battle's state
  onState?: (state: GameState) => void;
  // After the camera rig has placed the camera for this frame: may move it (to frame the shot)
  onCamera?: (camera: Camera, lookAt: Vector3, delta: number) => void;
  // A callout the battle shows (first blood, boss down, castle falls...)
  onMoment?: (moment: { title: string; subtitle?: string; tone?: string }) => void;
}

export const reelHook = (): ReelHook | undefined =>
  typeof window === 'undefined' ? undefined : (window as { __reelHook?: ReelHook }).__reelHook;

// A new battle with the enemy's troops weakened as the reel hook asks (unchanged without it)
export const withReelEdge = (state: GameState): GameState => {
  const strength = reelHook()?.enemyStrength;
  if (!strength || strength === 1 || !state.rosters?.ai) return state;
  const weaken = (stats: TroopStats): TroopStats => ({
    ...stats,
    attackPower: Math.max(1, Math.round(stats.attackPower * strength)),
    maxLifespan: Math.max(1, Math.round(stats.maxLifespan * strength))
  });
  return {
    ...state,
    rosters: { ...state.rosters, ai: Object.fromEntries(Object.entries(state.rosters.ai).map(([type, stats]) => [type, stats && weaken(stats)])) },
    pendingGuards: state.pendingGuards?.map(guard => ({ ...guard, stats: weaken(guard.stats) }))
  };
};
