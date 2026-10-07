// Battle sound effects synthesised with ZzFX (https://github.com/KilledByAPixel/ZzFX, MIT).
// ZzFX generates each sound from a list of parameters, so no audio files are needed.

import { isMuted } from './SoundPlayer';

export type BattleSound = 'swordClash' | 'swordHit' | 'bowShot' | 'arrowHit' | 'spellCast' | 'spellHit' | 'unitFalls' | 'bounty' | 'blocked';

// ZzFX parameters: volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
// slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
// sustainVolume, decay, tremolo, filter
const PRESETS: Record<BattleSound, (number | undefined)[]> = {
  // Bright metallic ring of blades meeting
  swordClash: [0.55, 0.1, 1650, 0, 0.01, 0.22, 3, 2.5, 0, 0, 0, 0, 0, 0.6, 37, 0, 0, 0.8, 0.04],
  // Dull thud of a blow landing
  swordHit: [0.45, 0.1, 140, 0, 0.02, 0.12, 4, 1.5, -6, 0, 0, 0, 0, 1.5, 0, 0, 0, 0.6, 0.03],
  // Bow string twang with a falling pitch
  bowShot: [0.4, 0.05, 420, 0, 0.01, 0.16, 2, 1.5, -12, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.02],
  // Arrow thunking into its target
  arrowHit: [0.4, 0.1, 220, 0, 0, 0.08, 4, 1, -20, 0, 0, 0, 0, 3],
  // Rising shimmer as a Mage releases a spell
  spellCast: [0.35, 0.05, 520, 0.02, 0.08, 0.2, 0, 1.8, 12, 0, 0, 0, 0.05, 0, 5, 0, 0, 0.7, 0.04],
  // Sparkling burst where the spell lands
  spellHit: [0.35, 0.1, 900, 0, 0.03, 0.25, 1, 1.5, -4, 0, 300, 0.04, 0, 0.3, 0, 0, 0, 0.6, 0.05],
  // Low falling groan when a unit is destroyed
  unitFalls: [0.45, 0.05, 180, 0, 0.05, 0.4, 2, 1, -10, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.5, 0.1],
  // Coin chime for a bounty
  bounty: [0.35, 0.05, 1200, 0, 0.03, 0.15, 1, 1.5, 0, 0, 600, 0.05],
  // Short low buzz when an action isn't allowed
  blocked: [0.3, 0.02, 150, 0, 0.02, 0.08, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5]
};

// Don't play the same sound more often than this, so big battles don't turn into noise
const MIN_REPEAT_MS = 70;

type ZzfxModule = typeof import('zzfx');

let zzfxModule: Promise<ZzfxModule | null> | null = null;
const lastPlayed: Partial<Record<BattleSound, number>> = {};

// ZzFX creates its AudioContext when imported, so load it lazily in the browser only
const loadZzfx = () => {
  if (!zzfxModule) {
    zzfxModule = typeof window === 'undefined'
      ? Promise.resolve(null)
      : import('zzfx').catch(error => {
          console.warn('Battle sounds unavailable:', error);
          return null;
        });
  }
  return zzfxModule;
};

export const playBattleSound = (sound: BattleSound, volume = 1) => {
  if (isMuted()) return;

  const now = performance.now();
  if (now - (lastPlayed[sound] ?? -Infinity) < MIN_REPEAT_MS) return;
  lastPlayed[sound] = now;

  loadZzfx().then(module => {
    if (!module) return;
    try {
      const context = module.ZZFX.audioContext;
      // Browsers start audio suspended until the player interacts with the page
      if (context.state === 'suspended') context.resume().catch(() => {});

      const preset = [...PRESETS[sound]];
      preset[0] = (preset[0] ?? 1) * volume;
      module.zzfx(...preset);
    } catch (error) {
      console.warn('Could not play battle sound:', error);
    }
  });
};
