import { useSyncExternalStore } from 'react';
import { trackEvent } from './analytics';

// Installing the game as an app (see app/manifest.ts). Chrome, Edge and Android browsers fire
// beforeinstallprompt once the game can be installed; it's held on to so Settings can offer an
// Install button. Safari on iPhone and iPad has no prompt: there it's Share, then Add to Home Screen.

export type InstallState = 'installed' | 'available' | 'ios' | 'unavailable';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

// Opened from the home screen or app list rather than a browser tab
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS reports itself as a Mac, so also look for touch
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const listenForInstallPrompt = () => {
  if (typeof window === 'undefined') return;
  installed = isStandalone();
  window.addEventListener('beforeinstallprompt', event => {
    // Keep the browser's own mini-bar out of the way; Settings offers the button instead
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    trackEvent('app_installed');
    installed = true;
    deferredPrompt = null;
    notify();
  });
};

const getInstallState = (): InstallState => {
  if (installed) return 'installed';
  if (deferredPrompt) return 'available';
  if (isIos()) return 'ios';
  return 'unavailable';
};

// Shows the browser's install dialog; true if the player went ahead
export const promptInstall = async (): Promise<boolean> => {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  // A prompt can only be shown once
  deferredPrompt = null;
  notify();
  try {
    await prompt.prompt();
    return (await prompt.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useInstallState = (): InstallState => useSyncExternalStore(subscribe, getInstallState, () => 'unavailable');
