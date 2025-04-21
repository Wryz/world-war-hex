import { useCallback, useEffect, useState } from 'react';

// Cache for audio elements to prevent reloading
const audioCache = new Map<string, HTMLAudioElement>();

// Sound volume settings
const DEFAULT_VOLUME = 0.5;

/**
 * Preloads an audio file and adds it to the cache
 */
export const preloadSound = (url: string, id: string): void => {
  if (audioCache.has(id)) return;
  
  const audio = new Audio(url);
  audio.volume = DEFAULT_VOLUME;
  audio.load();
  audioCache.set(id, audio);
};

/**
 * Plays a sound from the cache
 */
export const playSound = (id: string, volume = DEFAULT_VOLUME): void => {
  const audio = audioCache.get(id);
  if (!audio) {
    console.warn(`Sound with id "${id}" not found in cache`);
    return;
  }
  
  // Create a clone to allow for overlapping sounds
  const soundInstance = audio.cloneNode() as HTMLAudioElement;
  soundInstance.volume = volume;
  
  // Play the sound
  soundInstance.play().catch(error => {
    // Often happens due to user interaction requirements in browsers
    console.warn(`Failed to play sound: ${error.message}`);
  });
};

/**
 * Sets the volume for a specific sound
 */
export const setSoundVolume = (id: string, volume: number): void => {
  const audio = audioCache.get(id);
  if (audio) {
    audio.volume = Math.max(0, Math.min(1, volume));
  }
};

/**
 * Hook for using sounds in React components
 */
export const useSound = (soundId: string) => {
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  
  useEffect(() => {
    // Update volume if the sound exists
    const audio = audioCache.get(soundId);
    if (audio) {
      audio.volume = volume;
    }
  }, [soundId, volume]);
  
  const play = useCallback(() => {
    playSound(soundId, volume);
  }, [soundId, volume]);
  
  return {
    play,
    setVolume,
    volume
  };
}; 