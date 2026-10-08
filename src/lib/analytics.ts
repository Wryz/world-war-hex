// Anonymous gameplay analytics (PostHog), used to see where players get stuck in the campaign and
// which cards and cosmetics they pick. Only game events are sent - no session recordings, no
// autocaptured clicks and no personal details - and players can switch it off in Stats & Save.
// It stays off unless NEXT_PUBLIC_POSTHOG_KEY is set at build time. PostHog's browser library is loaded
// from its CDN only then, so the game has no analytics code to bundle or install otherwise.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const OPT_OUT_KEY = 'wwhAnalyticsOptOut';

export type AnalyticsEvent =
  | 'game_opened'
  | 'battle_started'
  | 'battle_ended'
  | 'battle_abandoned'
  | 'tutorial_completed'
  | 'card_bought'
  | 'card_upgraded'
  | 'loadout_auto_picked'
  | 'cosmetic_bought'
  | 'save_exported'
  | 'save_imported';

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

export const isAnalyticsAvailable = () => !!KEY;

export const isAnalyticsEnabled = (): boolean => {
  if (!KEY || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== '1';
  } catch {
    return true;
  }
};

const load = (): Promise<PostHogClient | null> => {
  if (!isAnalyticsEnabled()) return Promise.resolve(null);
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

// Start analytics once the game is open in the browser
export const initAnalytics = () => {
  void load();
};

export const trackEvent = (event: AnalyticsEvent, properties: Properties = {}) => {
  if (!isAnalyticsEnabled()) return;
  if (client) {
    client.capture(event, properties);
    return;
  }
  queue.push([event, properties]);
  void load();
};

// The player's choice in Stats & Save
export const setAnalyticsEnabled = (enabled: boolean) => {
  try {
    if (enabled) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, '1');
  } catch {
    // Storage blocked: the choice lasts for this visit only
  }
  if (enabled) {
    client?.opt_in_capturing();
    void load();
  } else {
    queue.length = 0;
    client?.opt_out_capturing();
  }
};
