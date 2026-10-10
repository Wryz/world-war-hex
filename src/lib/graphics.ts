import { useSyncExternalStore } from 'react';

// Graphics quality for the 3D scenes. 'auto' picks low on devices that report little memory or few
// cores (low-end Android phones), high everywhere else. Low turns off shadows, draws at the screen's
// own pixel size without smoothing and thins out the weather. Kept in localStorage per browser.

export type GraphicsSetting = 'auto' | 'high' | 'low';
export type GraphicsQuality = 'high' | 'low';

export const GRAPHICS_OPTIONS: { id: GraphicsSetting; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'low', label: 'Low' }
];

const STORAGE_KEY = 'wwhGraphics';
const listeners = new Set<() => void>();

let setting: GraphicsSetting | null = null;

const readStored = (): GraphicsSetting => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'high' || stored === 'low' ? stored : 'auto';
  } catch {
    return 'auto';
  }
};

export const getGraphicsSetting = (): GraphicsSetting => {
  if (setting === null) setting = typeof window === 'undefined' ? 'auto' : readStored();
  return setting;
};

// A device that struggles: little memory (Chrome on Android reports it; iPhones don't) or few cores
const isLowEndDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 3) return true;
  return navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2;
};

export const getGraphicsQuality = (): GraphicsQuality => {
  const chosen = getGraphicsSetting();
  if (chosen !== 'auto') return chosen;
  return isLowEndDevice() ? 'low' : 'high';
};

export const setGraphicsSetting = (value: GraphicsSetting) => {
  setting = value;
  try {
    if (value === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: still applies for this visit
  }
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useGraphicsSetting = (): GraphicsSetting => useSyncExternalStore(subscribe, getGraphicsSetting, () => 'auto');
export const useGraphicsQuality = (): GraphicsQuality => useSyncExternalStore(subscribe, getGraphicsQuality, () => 'high');

// What a scene's <Canvas> needs for the quality: shadows, its pixel ratio (as given for high quality,
// 1 for low) and the WebGL context's options (smoothing is fixed when the canvas is made, so give the
// canvas key={quality} to remake it when the quality changes)
export const canvasQuality = (quality: GraphicsQuality, highDpr: number | [number, number] = [1, 1.5]) => ({
  shadows: quality === 'high',
  dpr: quality === 'high' ? highDpr : 1,
  gl: { antialias: quality === 'high', powerPreference: quality === 'high' ? 'high-performance' as const : 'low-power' as const }
});

// Share of weather particles drawn at the quality
export const particleShare = (quality: GraphicsQuality) => (quality === 'high' ? 1 : 0.35);
