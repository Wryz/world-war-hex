import { useSyncExternalStore } from 'react';

// Vibration on phones: a short buzz when the battle shakes the screen (castle hits, kills, a boss's
// strike, a tree crashing down) and a pattern when it's won or lost. Android browsers support it;
// iPhones don't, so the setting is only offered where it works. On by default, kept per browser.

const STORAGE_KEY = 'wwhVibration';
const listeners = new Set<() => void>();

export const isVibrationSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled: boolean | null = null;

export const isVibrationEnabled = (): boolean => {
  if (enabled === null) {
    try {
      enabled = typeof window === 'undefined' ? true : localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      enabled = true;
    }
  }
  return enabled;
};

export const setVibrationEnabled = (on: boolean) => {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: still applies for this visit
  }
  if (!on) vibrate(0);
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useVibrationEnabled = () => useSyncExternalStore(subscribe, isVibrationEnabled, () => true);

// (a pattern is buzz, pause, buzz... in ms; the browser ignores it until the player has tapped the page)
const vibrate = (pattern: number | number[]) => {
  if (!isVibrationSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Blocked (e.g. in a cross-origin frame): no buzz
  }
};

// A buzz as strong as a screen shake (0-1): from a tap for a small bump to a thud for a big one
export const buzz = (strength: number) => {
  if (!isVibrationEnabled() || strength <= 0) return;
  vibrate(Math.round(15 + Math.min(1, strength) * 85));
};

export const VICTORY_PATTERN = [60, 60, 60, 60, 180];
export const DEFEAT_PATTERN = [250, 100, 400];

export const buzzPattern = (pattern: number[]) => {
  if (isVibrationEnabled()) vibrate(pattern);
};
