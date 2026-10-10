// Anonymous gameplay analytics (PostHog and/or Google Analytics), used to see where players get stuck
// in the campaign and which cards and cosmetics they pick. Only game events and page views are sent -
// no session recordings, no autocaptured clicks and no personal details - and players can switch it
// off in Settings. Each service stays off unless its key is set at build time
// (NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_GA_MEASUREMENT_ID); its browser library is loaded from its CDN
// only then, so the game has no analytics code to bundle or install otherwise.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const OPT_OUT_KEY = 'wwhAnalyticsOptOut';

export type AnalyticsEvent =
  | 'game_opened'
  | 'battle_started'
  | 'battle_ended'
  | 'battle_abandoned'
  | 'tutorial_completed'
  | 'card_bought'
  | 'card_upgraded'
  | 'card_evolved'
  | 'attribute_learnt'
  | 'skill_learnt'
  | 'tree_respec'
  | 'loadout_auto_picked'
  | 'cosmetic_bought'
  | 'save_exported'
  | 'save_imported'
  | 'app_installed'
  | 'castle_chosen'
  | 'ad_reward_offered'
  | 'ad_reward_watched'
  | 'ad_interstitial_shown'
  | 'cloud_save_enabled'
  | 'cloud_email_requested'
  | 'cloud_email_linked'
  | 'cloud_signed_in'
  | 'cloud_conflict_resolved';

type Properties = Record<string, string | number | boolean | null | undefined | string[]>;

// The parts of PostHog's browser library the game uses
interface PostHogClient {
  init: (key: string, config: Record<string, unknown>) => void;
  capture: (event: string, properties?: Properties) => void;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
}

// PostHog serves its browser library from the assets host next to the ingestion host
const libraryUrl = () => `${HOST.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`;

let client: PostHogClient | null = null;
let loading: Promise<PostHogClient | null> | null = null;
// Events sent before the library has loaded
const queue: [AnalyticsEvent, Properties][] = [];

export const isAnalyticsAvailable = () => !!KEY || !!GA_ID;

export const isAnalyticsEnabled = (): boolean => {
  if (!isAnalyticsAvailable() || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== '1';
  } catch {
    return true;
  }
};

// --- Google Analytics (GA4) ----------------------------------------------------------------

interface GtagWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

let gaStarted = false;

// GA's own switch: while it is set, gtag.js sends nothing
const setGaDisabled = (disabled: boolean) => {
  if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = disabled;
};

// Load gtag.js once. Calls made before it arrives wait in the dataLayer. Page views follow the
// game's client-side navigation through GA's enhanced measurement (browser history changes).
const startGoogleAnalytics = () => {
  if (!GA_ID || gaStarted || !isAnalyticsEnabled()) return;
  gaStarted = true;
  setGaDisabled(false);
  const w = window as unknown as GtagWindow;
  w.dataLayer = w.dataLayer || [];
  // gtag.js reads the arguments object itself, so it is pushed as is
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  script.async = true;
  document.head.appendChild(script);
};

// GA event parameters are strings and numbers: lists are joined and empty values dropped
const toGaParams = (properties: Properties) => {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue;
    params[name] = Array.isArray(value) ? value.join(',') : typeof value === 'boolean' ? String(value) : value;
  }
  return params;
};

const sendToGoogleAnalytics = (event: AnalyticsEvent, properties: Properties) => {
  if (!GA_ID) return;
  startGoogleAnalytics();
  (window as unknown as GtagWindow).gtag?.('event', event, toGaParams(properties));
};

// --- PostHog -------------------------------------------------------------------------------

const load = (): Promise<PostHogClient | null> => {
  if (!KEY || !isAnalyticsEnabled()) return Promise.resolve(null);
  loading ??= new Promise<PostHogClient | null>(resolve => {
    const script = document.createElement('script');
    script.src = libraryUrl();
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve((window as unknown as { posthog?: PostHogClient }).posthog ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  })
    .then(posthog => {
      if (!posthog) return null;
      posthog.init(KEY!, {
        api_host: HOST,
        person_profiles: 'identified_only',
        autocapture: false,
        capture_pageview: 'history_change',
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        respect_dnt: true,
        persistence: 'localStorage'
      });
      client = posthog;
      for (const [event, properties] of queue.splice(0)) posthog.capture(event, properties);
      return posthog;
    })
    .catch(() => null);
  return loading;
};

// --- Both ----------------------------------------------------------------------------------

// Start analytics once the game is open in the browser
export const initAnalytics = () => {
  startGoogleAnalytics();
  void load();
};

export const trackEvent = (event: AnalyticsEvent, properties: Properties = {}) => {
  if (!isAnalyticsEnabled()) return;
  sendToGoogleAnalytics(event, properties);
  if (!KEY) return;
  if (client) {
    client.capture(event, properties);
    return;
  }
  queue.push([event, properties]);
  void load();
};

// The player's choice in Settings
export const setAnalyticsEnabled = (enabled: boolean) => {
  try {
    if (enabled) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, '1');
  } catch {
    // Storage blocked: the choice lasts for this visit only
  }
  if (enabled) {
    setGaDisabled(false);
    startGoogleAnalytics();
    client?.opt_in_capturing();
    void load();
  } else {
    setGaDisabled(true);
    queue.length = 0;
    client?.opt_out_capturing();
  }
};
