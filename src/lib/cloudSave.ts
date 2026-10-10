import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Profile, adoptProfile, getProfile, hasProgress, highestCleared, replaceProfile, sanitizeProfile, subscribeProfile, totalStars
} from './meta/profile';
import { trackEvent } from './analytics';

// Cloud save: a copy of the player's progress in the game's Supabase project (the cloud_saves table,
// supabase/migrations), kept up to date as it changes. The account is the anonymous one online rooms
// use (lib/pvp/supabase); linking an email address to it lets the same save be loaded on another
// device, by a sign-in link or code sent to that address.
//
// Each device remembers the moment it last agreed with the cloud. When both have changed since - two
// devices played apart, or a device with progress of its own signs in - the player picks which to
// keep (CloudConflictDialog); otherwise the newer copy wins on its own.
//
// It is off until the player turns it on (Stats & Save), or opens a sign-in link sent to their email.

const ENABLED_KEY = 'wwhCloudSave';
// The account and the save's time this device last agreed with the cloud on
const SYNCED_KEY = 'wwhCloudSynced';
// Changes are gathered for a few seconds before they are sent
const PUSH_DELAY_MS = 4000;
// After a failure, try again this long after
const RETRY_DELAY_MS = 60_000;

export type CloudStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';

// What a save holds, to choose between two
export interface SaveSummary {
  cleared: number;
  stars: number;
  coins: number;
  battles: number;
  changedAt: string;
}

export interface CloudState {
  enabled: boolean;
  status: CloudStatus;
  error?: string;
  // When this device last agreed with the cloud
  syncedAt?: string;
  // The email address linked to the account, and one waiting for its link to be opened
  email?: string;
  pendingEmail?: string;
  // Both copies changed since they last agreed: the cloud's, waiting for the player to choose
  conflict?: { cloud: Profile; device: SaveSummary; remote: SaveSummary };
}

interface CloudRow {
  profile: unknown;
  saved_at: string;
}

// --- State ------------------------------------------------------------------------------------

const OFF: CloudState = { enabled: false, status: 'off' };
let state: CloudState = OFF;
const listeners = new Set<() => void>();

const update = (changes: Partial<CloudState>) => {
  state = { ...state, ...changes };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getCloudState = () => state;
export const useCloudSave = (): CloudState => useSyncExternalStore(subscribe, getCloudState, () => OFF);

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeFlag = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the cloud save still runs for this visit
  }
};

// The account and save time this device last agreed with the cloud on (none for another account)
const readSynced = (userId: string): number | null => {
  try {
    const stored = JSON.parse(readFlag(SYNCED_KEY) ?? 'null') as { user?: string; at?: string } | null;
    if (stored?.user !== userId || typeof stored.at !== 'string') return null;
    const at = Date.parse(stored.at);
    return Number.isNaN(at) ? null : at;
  } catch {
    return null;
  }
};
const markSynced = (userId: string, savedAt: string) => {
  writeFlag(SYNCED_KEY, JSON.stringify({ user: userId, at: savedAt }));
  update({ status: 'synced', syncedAt: new Date().toISOString(), error: undefined, conflict: undefined });
};

export const summarise = (profile: Profile): SaveSummary => ({
  cleared: highestCleared(profile),
  stars: totalStars(profile),
  coins: profile.coins,
  battles: profile.stats.battles,
  changedAt: profile.updatedAt
});

// --- Supabase (loaded only once the cloud save is used) ---------------------------------------

const client = async (): Promise<SupabaseClient> => (await import('./pvp/supabase')).getSupabase();
const signedInUser = async () => (await import('./pvp/supabase')).ensureSignedIn();

const describe = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  return /fetch|network|offline/i.test(message) ? 'offline' : message;
};

const fail = (error: unknown) => {
  const reason = describe(error);
  const offline = reason === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine);
  update({ status: offline ? 'offline' : 'error', error: offline ? undefined : reason });
  scheduleRetry();
};

// The linked email address (or the one waiting to be confirmed) of the signed-in account
const refreshEmail = async () => {
  const { data } = await (await client()).auth.getSession();
  const user = data.session?.user;
  update({ email: user?.email || undefined, pendingEmail: user?.new_email || undefined });
};

// --- Syncing ------------------------------------------------------------------------------------

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let stopListening: (() => void) | null = null;

const scheduleRetry = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; void sync(); }, RETRY_DELAY_MS);
};

// Send this device's save; `force` replaces the cloud's even when it was changed later
const push = async (userId: string, force = false): Promise<void> => {
  const profile = getProfile();
  const { data, error } = await (await client()).rpc('put_cloud_save', {
    p_profile: profile, p_saved_at: profile.updatedAt, p_force: force
  });
  if (error) throw error;
  const row = data as CloudRow;
  // Another device saved a later copy first: work out which to keep
  if (!force && Date.parse(row.saved_at) > Date.parse(profile.updatedAt)) return reconcile(userId, row);
  markSynced(userId, row.saved_at);
};

// What to do about two copies of the save, from when each was last changed and when this device last
// agreed with the cloud (null: never, as this account): nothing, take the cloud's, send this device's
// (over a later-dated cloud copy too: 'sendOver'), or ask the player
export type SyncAction = 'inSync' | 'adopt' | 'send' | 'sendOver' | 'ask';
export const syncAction = (copies: {
  localAt: number;
  cloudAt: number;
  synced: number | null;
  localHasProgress: boolean;
  cloudHasProgress: boolean;
}): SyncAction => {
  const { localAt, cloudAt, synced, localHasProgress, cloudHasProgress } = copies;
  if (cloudAt === localAt) return 'inSync';
  const localChanged = synced === null || localAt > synced;
  const cloudChanged = synced === null || cloudAt > synced;
  // (a new player's empty save, or one unchanged since the cloud's moved on, gives way)
  if (!localHasProgress || (!localChanged && cloudChanged)) return 'adopt';
  if (!cloudHasProgress || !cloudChanged) return cloudAt > localAt ? 'sendOver' : 'send';
  return 'ask';
};

// Compare this device's save with the cloud's and bring them together
const reconcile = async (userId: string, row: CloudRow | null): Promise<void> => {
  const local = getProfile();
  const cloud = row ? sanitizeProfile(row.profile) : null;
  // (nothing there yet, or nothing readable: this device's save becomes the cloud's)
  if (!row || !cloud) return push(userId, !!row);
  const action = syncAction({
    localAt: Date.parse(local.updatedAt),
    cloudAt: Date.parse(row.saved_at),
    synced: readSynced(userId),
    localHasProgress: hasProgress(local),
    cloudHasProgress: hasProgress(cloud)
  });
  if (action === 'inSync') return markSynced(userId, row.saved_at);
  if (action === 'adopt') {
    adoptProfile({ ...cloud, updatedAt: row.saved_at });
    return markSynced(userId, row.saved_at);
  }
  if (action === 'send' || action === 'sendOver') return push(userId, action === 'sendOver');
  update({ status: 'conflict', conflict: { cloud: { ...cloud, updatedAt: row.saved_at }, device: summarise(local), remote: summarise(cloud) } });
};

// Fetch the cloud's save and bring this device and it together (one sync at a time)
export const sync = (): Promise<void> => {
  if (!state.enabled || state.conflict) return Promise.resolve();
  running ??= (async () => {
    update({ status: 'syncing' });
    try {
      const userId = await signedInUser();
      await refreshEmail();
      const { data, error } = await (await client())
        .from('cloud_saves').select('profile, saved_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      await reconcile(userId, data as CloudRow | null);
    } catch (error) {
      fail(error);
    }
  })().finally(() => { running = null; });
  return running;
};

// Send the latest changes now, rather than after the usual pause (on leaving the page)
const flush = () => {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  void sendChanges();
};

const sendChanges = async () => {
  // (after any sync under way, which may have brought the cloud's copy)
  if (running) await running;
  if (!state.enabled || state.conflict) return;
  update({ status: 'syncing' });
  try {
    const userId = await signedInUser();
    const synced = readSynced(userId);
    // (a change that is only the cloud's own copy arriving needs no sending back)
    if (synced !== null && Date.parse(getProfile().updatedAt) <= synced) {
      update({ status: 'synced' });
      return;
    }
    await push(userId);
  } catch (error) {
    fail(error);
  }
};

const startListening = () => {
  if (stopListening) return;
  const unsubscribe = subscribeProfile(() => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; void sendChanges(); }, PUSH_DELAY_MS);
  });
  const onOnline = () => void sync();
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  stopListening = () => {
    unsubscribe();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    stopListening = null;
  };
};

// --- What the player does -----------------------------------------------------------------------

export const enableCloudSave = async () => {
  writeFlag(ENABLED_KEY, 'on');
  update({ enabled: true });
  startListening();
  trackEvent('cloud_save_enabled');
  await sync();
};

// Stop saving to the cloud on this device (the copy there stays)
export const disableCloudSave = () => {
  writeFlag(ENABLED_KEY, null);
  stopListening?.();
  if (pushTimer) clearTimeout(pushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pushTimer = retryTimer = null;
  update({ enabled: false, status: 'off', error: undefined, conflict: undefined });
};

// Remove the copy in the cloud, and stop saving there
export const deleteCloudSave = async (): Promise<boolean> => {
  try {
    const userId = await signedInUser();
    const { error } = await (await client()).from('cloud_saves').delete().eq('user_id', userId);
    if (error) throw error;
    writeFlag(SYNCED_KEY, null);
    disableCloudSave();
    return true;
  } catch (error) {
    update({ error: describe(error) });
    return false;
  }
};

// Settle a conflict: keep the cloud's save (replacing this device's) or this device's (replacing the
// cloud's)
export const resolveConflict = async (keep: 'cloud' | 'device') => {
  const conflict = state.conflict;
  if (!conflict) return;
  trackEvent('cloud_conflict_resolved', { kept: keep });
  update({ conflict: undefined, status: 'syncing' });
  try {
    const userId = await signedInUser();
    if (keep === 'cloud') {
      adoptProfile(conflict.cloud);
      markSynced(userId, conflict.cloud.updatedAt);
    } else {
      // (marked as changed now, so it is the newest copy everywhere)
      replaceProfile(getProfile());
      await push(userId, true);
    }
  } catch (error) {
    fail(error);
  }
};

const returnAddress = (purpose: 'linked' | 'signin') => `${window.location.origin}/stats?cloud=${purpose}`;

const friendlyAuthError = (error: { message?: string; code?: string }) => {
  const message = error.message ?? '';
  if (/already|exists|registered/i.test(message) || error.code === 'email_exists') {
    return 'That email already has a save. Use "Load my save on this device" instead.';
  }
  if (/rate|limit|seconds/i.test(message)) return 'Too many emails just now - wait a minute and try again.';
  if (/signups not allowed|not found|user not found/i.test(message)) return 'No save is linked to that email yet.';
  return message || 'Something went wrong - try again.';
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Link an email address to this account, so the save can be loaded on another device. A link (and
// code) to confirm it is sent there.
export const linkEmail = async (email: string): Promise<string | null> => {
  const address = email.trim();
  if (!EMAIL.test(address)) return 'Enter an email address.';
  try {
    await signedInUser();
    const { error } = await (await client()).auth.updateUser({ email: address }, { emailRedirectTo: returnAddress('linked') });
    if (error) return friendlyAuthError(error);
    update({ pendingEmail: address });
    trackEvent('cloud_email_requested', { purpose: 'link' });
    if (!state.enabled) void enableCloudSave();
    return null;
  } catch (error) {
    return describe(error) === 'offline' ? 'You are offline.' : describe(error);
  }
};

// Send a sign-in link (and code) to the email address linked to a save, to load it on this device
export const sendSignInEmail = async (email: string): Promise<string | null> => {
  const address = email.trim();
  if (!EMAIL.test(address)) return 'Enter an email address.';
  try {
    const { error } = await (await client()).auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false, emailRedirectTo: returnAddress('signin') }
    });
    if (error) return friendlyAuthError(error);
    trackEvent('cloud_email_requested', { purpose: 'signin' });
    return null;
  } catch (error) {
    return describe(error) === 'offline' ? 'You are offline.' : describe(error);
  }
};

// Enter the code from the email instead of opening its link (handy in the installed app, where the
// link opens in the browser)
export const verifyEmailCode = async (email: string, code: string, purpose: 'link' | 'signin'): Promise<string | null> => {
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) return 'Enter the code from the email.';
  try {
    const { error } = await (await client()).auth.verifyOtp({ email: email.trim(), token, type: purpose === 'link' ? 'email_change' : 'email' });
    if (error) return /expired|invalid/i.test(error.message) ? 'That code is wrong or has expired.' : friendlyAuthError(error);
    trackEvent(purpose === 'link' ? 'cloud_email_linked' : 'cloud_signed_in');
    update({ pendingEmail: undefined });
    await enableCloudSave();
    return null;
  } catch (error) {
    return describe(error) === 'offline' ? 'You are offline.' : describe(error);
  }
};

// Sign this device out of the account (its progress stays here; cloud saving stops)
export const signOutCloud = async () => {
  disableCloudSave();
  writeFlag(SYNCED_KEY, null);
  try {
    await (await client()).auth.signOut();
  } catch {
    // Offline: the session is cleared on this device anyway
  }
  update({ email: undefined, pendingEmail: undefined });
};

// --- Start-up -------------------------------------------------------------------------------------

let started = false;

// On loading the game: carry on saving to the cloud if it's on, and finish a sign-in or email link
// opened from an email (it lands on /stats?cloud=...)
export const initCloudSave = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  const params = new URLSearchParams(window.location.search);
  const fromEmail = params.get('cloud');
  const enabled = readFlag(ENABLED_KEY) === 'on';
  if (!enabled && !fromEmail) return;
  void (async () => {
    // (the client picks the session out of the link's address as it starts)
    const supabase = await client();
    supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') void refreshEmail();
    });
    if (fromEmail) {
      params.delete('cloud');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
      trackEvent(fromEmail === 'linked' ? 'cloud_email_linked' : 'cloud_signed_in');
      await enableCloudSave();
      return;
    }
    update({ enabled: true });
    startListening();
    await sync();
  })().catch(fail);
};
