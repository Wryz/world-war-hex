'use client';

import { useEffect } from 'react';
import { initAnalytics, trackEvent } from '@/lib/analytics';
import { registerServiceWorker } from '@/lib/offline';
import { getProfile, highestCleared, profilePower } from '@/lib/meta/profile';

// Starts the background services once the game has loaded in the browser
export const AppBoot: React.FC = () => {
  useEffect(() => {
    registerServiceWorker();
    initAnalytics();
    const profile = getProfile();
    trackEvent('game_opened', {
      highest_cleared: highestCleared(profile),
      power: profilePower(profile),
      battles: profile.stats.battles,
      cards_owned: Object.keys(profile.cards).length,
      online: navigator.onLine
    });
  }, []);
  return null;
};
