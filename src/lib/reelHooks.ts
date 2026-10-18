import { isDevMode } from './meta/devTools';

// Hooks for filming the game's promo reels (reels/capture): on a local copy of the game only, the
// capture script sets window.__wwhReel = { autoplay: true } before the page loads, and the AI then
// plays the player's side too (castle site included). On the live site it does nothing.

interface ReelHooks {
  autoplay?: boolean;
  // Filled in by the battle: the state as it stands, and a way to replace it
  battle?: { get: () => unknown; set: (state: never) => void };
}

export const getReelHooks = (): ReelHooks | null => {
  if (typeof window === 'undefined' || !isDevMode()) return null;
  return (window as unknown as { __wwhReel?: ReelHooks }).__wwhReel ?? null;
};

export const isReelAutoplay = () => !!getReelHooks()?.autoplay;
