import { useSyncExternalStore } from 'react';

// A few copies of each sound so quick repeats (e.g. sweeping over tiles) can overlap
const POOL_SIZE = 4;
const MUTE_STORAGE_KEY = 'wwhMuted';

interface SoundPool {
  instances: HTMLAudioElement[];
  next: number;
}

const soundPools = new Map<string, SoundPool>();

// Global mute shared by file-based sounds and the synthesised battle sounds
let muted = false;
const muteListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  try {
    muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    // Storage can be unavailable (e.g. private mode); sound simply starts unmuted
  }
}

// Silenced while an ad plays, without touching the player's own mute setting
let pausedForAd = false;

export const isMuted = () => muted || pausedForAd;

export const setMuted = (value: boolean) => {
  muted = value;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  } catch {
    // Not remembered across visits, but still applies now
  }
  muteListeners.forEach(listener => listener());
};

export const setPausedForAd = (value: boolean) => {
  if (pausedForAd === value) return;
  pausedForAd = value;
  muteListeners.forEach(listener => listener());
};

export const subscribeToMute = (listener: () => void) => {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
};

// Current mute state for React components
export const useMuted = () => useSyncExternalStore(subscribeToMute, () => muted, () => false);

// Volume of the sound effects (clicks, swords, arrows...), 0 to 1, shared with the battle sounds
const SFX_VOLUME_STORAGE_KEY = 'wwhSfxVolume';
let sfxVolume = 1;
const sfxListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(SFX_VOLUME_STORAGE_KEY);
    if (stored !== null && Number.isFinite(Number(stored))) sfxVolume = Math.min(1, Math.max(0, Number(stored)));
  } catch {
    // Storage unavailable: full volume
  }
}

export const getSfxVolume = () => sfxVolume;

export const setSfxVolume = (value: number) => {
  sfxVolume = Math.min(1, Math.max(0, value));
  try {
    localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(sfxVolume));
  } catch {
    // Not remembered across visits, but still applies now
  }
  sfxListeners.forEach(listener => listener());
};

const subscribeToSfx = (listener: () => void) => {
  sfxListeners.add(listener);
  return () => sfxListeners.delete(listener);
};

export const useSfxVolume = () => useSyncExternalStore(subscribeToSfx, getSfxVolume, () => 1);

/**
 * Preloads an audio file so it can be played instantly by id
 */
export const preloadSound = (url: string, id: string): void => {
  if (soundPools.has(id)) return;

  const instances = Array.from({ length: POOL_SIZE }, () => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    return audio;
  });
  soundPools.set(id, { instances, next: 0 });
};

/**
 * Plays a preloaded sound
 */
export const playSound = (id: string, volume = 0.5): void => {
  if (isMuted() || sfxVolume <= 0) return;

  const pool = soundPools.get(id);
  if (!pool) return;

  const audio = pool.instances[pool.next];
  pool.next = (pool.next + 1) % pool.instances.length;

  audio.volume = Math.min(1, volume * sfxVolume);
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Browsers block audio until the player has interacted with the page
  });
};
