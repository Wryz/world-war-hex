'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { notePageSeen } from '@/lib/navigation';
import { initAnalytics, trackEvent } from '@/lib/analytics';
import { initAds } from '@/lib/ads';
import { registerServiceWorker } from '@/lib/offline';
import { isStandalone, listenForInstallPrompt } from '@/lib/install';
import { applyUiSize } from '@/lib/uiSize';
import { getProfile, highestCleared, profilePower } from '@/lib/meta/profile';

// Starts the background services once the game has loaded in the browser
export const AppBoot: React.FC = () => {
  // Each page of the game visited (for a page deciding whether "back" stays in the game)
  const pathname = usePathname();
  useEffect(() => notePageSeen(), [pathname]);

  useEffect(() => {
    applyUiSize();
    listenForInstallPrompt();
    registerServiceWorker();
    initAnalytics();
    initAds();
    const profile = getProfile();
    trackEvent('game_opened', {
      highest_cleared: highestCleared(profile),
      power: profilePower(profile),
      battles: profile.stats.battles,
      cards_owned: Object.keys(profile.cards).length,
      online: navigator.onLine,
      installed: isStandalone()
    });
  }, []);
  return null;
};
