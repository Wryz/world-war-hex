import { useEffect, useRef, useState } from 'react';
import { setPausedForAd } from '@/components/game/utils/SoundPlayer';
import { trackEvent } from './analytics';

// Ads through Google's H5 Games Ads (the AdSense Ad Placement API): an optional rewarded ad on the
// results screen that adds a coin bonus, and an ad at a natural break when the player leaves the
// results screen (never during a battle). Off unless NEXT_PUBLIC_ADSENSE_CLIENT (ca-pub-...) is set
// at build time, so builds without it (e.g. a paid desktop version) have no ads at all.
// NEXT_PUBLIC_ADS_TEST=1 asks Google for test ads, for trying it out locally.

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const TEST = process.env.NEXT_PUBLIC_ADS_TEST === '1';

// No break ads in a player's first few battles, while they are still learning the game
export const FREE_BATTLES = 3;
// A break ad isn't shown this soon after another ad
const AD_GAP_MS = 90_000;
// How long a break waits for an ad to start before carrying on without one
const BREAK_START_TIMEOUT_MS = 2000;

interface PlacementInfo {
  breakStatus: string;
}

interface AdBreakOptions {
  type: 'reward' | 'next';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: PlacementInfo) => void;
}

type AdsWindow = { adsbygoogle?: object[] };

let started = false;
// Whether Google's library arrived (an ad blocker stops it, and then no callback ever comes)
let libraryLoaded = false;
let lastAdAt = -Infinity;

// adConfig and adBreak both hand their options to the library's queue
const push = (options: object) => {
  const w = window as unknown as AdsWindow;
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.push(options);
};

export const areAdsAvailable = () => !!CLIENT;

// Load Google's library once the game is open in the browser
export const initAds = () => {
  if (!CLIENT || started || typeof window === 'undefined') return;
  started = true;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
  script.dataset.adClient = CLIENT;
  if (TEST) script.dataset.adbreakTest = 'on';
  script.onload = () => {
    libraryLoaded = true;
  };
  document.head.appendChild(script);
  push({ preloadAdBreaks: 'on', sound: 'on' });
};

// The game goes quiet while an ad plays
const adStarted = () => {
  lastAdAt = Date.now();
  setPausedForAd(true);
};
const adEnded = () => setPausedForAd(false);

// Show an ad at a natural break, then carry on. Without an ad (none ready, blocked, too soon after
// the last one, or one of the player's first battles) it carries on at once.
export const showBreakAd = (name: string, battlesPlayed: number, then: () => void) => {
  if (!CLIENT || !libraryLoaded || battlesPlayed <= FREE_BATTLES || Date.now() - lastAdAt < AD_GAP_MS) {
    then();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    adEnded();
    then();
  };
  const timeout = setTimeout(finish, BREAK_START_TIMEOUT_MS);
  push({
    type: 'next',
    name,
    beforeAd: () => {
      clearTimeout(timeout);
      adStarted();
      trackEvent('ad_interstitial_shown', { placement: name });
    },
    afterAd: adEnded,
    adBreakDone: finish
  } satisfies AdBreakOptions);
};

// Offer a rewarded ad. `ready` turns true once Google has one to show; `show` plays it, and
// onReward runs when the player has watched it through (skipping it early gives nothing).
export const useRewardedAd = (name: string, onReward: () => void) => {
  const [showAd, setShowAd] = useState<(() => void) | null>(null);
  const rewardRef = useRef(onReward);
  rewardRef.current = onReward;

  useEffect(() => {
    if (!CLIENT) return;
    initAds();
    let active = true;
    push({
      type: 'reward',
      name,
      beforeAd: adStarted,
      afterAd: adEnded,
      beforeReward: showAdFn => {
        if (!active) return;
        setShowAd(() => showAdFn);
        trackEvent('ad_reward_offered', { placement: name });
      },
      adViewed: () => {
        trackEvent('ad_reward_watched', { placement: name });
        rewardRef.current();
      },
      adBreakDone: () => {
        adEnded();
        if (active) setShowAd(null);
      }
    } satisfies AdBreakOptions);
    return () => {
      active = false;
    };
  }, [name]);

  return { ready: showAd !== null, show: () => showAd?.() };
};
