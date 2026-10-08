import { useSyncExternalStore } from 'react';

// How big the interface is drawn: everything (text, buttons, cards) is sized in rem, so this scales
// the page's root font size (see globals.css). Kept in localStorage per browser.

export type UiSize = 'normal' | 'large' | 'xl';
export const UI_SIZES: { id: UiSize; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'xl', label: 'Extra large' }
];

const STORAGE_KEY = 'wwhUiSize';
const listeners = new Set<() => void>();

const readStored = (): UiSize => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'large' || stored === 'xl' ? stored : 'normal';
  } catch {
    return 'normal';
  }
};

let current: UiSize | null = null;

export const getUiSize = (): UiSize => {
  if (current === null) current = typeof window === 'undefined' ? 'normal' : readStored();
  return current;
};

// Apply the stored size to the page (on start-up)
export const applyUiSize = () => {
  document.documentElement.dataset.uiSize = getUiSize();
};

export const setUiSize = (size: UiSize) => {
  current = size;
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Storage blocked: still applies for this visit
  }
  applyUiSize();
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useUiSize = (): UiSize => useSyncExternalStore(subscribe, getUiSize, () => 'normal');
