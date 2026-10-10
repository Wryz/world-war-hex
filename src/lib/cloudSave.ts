import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Profile, adoptProfile, getProfile, hasProgress, highestCleared, isNewerProfile, sanitizeProfile, subscribeProfile, totalStars
} from './meta/profile';
import { trackEvent } from './analytics';
import { emailLinkExpected, forgetEmailLink, noteEmailLinkAsked } from './emailLink';

// Cloud save: a copy of the player's progress in the game's Supabase project (the cloud_saves table,
// supabase/migrations), kept up to date as it changes. The account is the anonymous one online rooms
// use (lib/pvp/supabase); linking an email address to it lets the same save be loaded on another
// device, by a sign-in link or code sent to that address.
//
// Every copy sent to the cloud gets a revision id of its own (random, made by the device). Each device
// remembers the revision it last agreed with the cloud on, and the profile's updatedAt at that moment;
// the server only takes a save made over that revision (put_cloud_save). When both have changed
// since - two devices (or tabs) played apart, or a device with progress of its own signs in - the
// player picks which to keep (CloudConflictDialog); when only one has, it wins on its own. Nothing
// depends on which clock is ahead.
//
// It is off until the player turns it on (Stats & Save), or opens a sign-in link sent to their email.

const ENABLED_KEY = 'wwhCloudSave';
// The account, revision and profile time this device last agreed with the cloud on (and a save on its
// way, in case its answer is lost)
const SYNCED_KEY = 'wwhCloudSynced';
// Changes are gathered for a few seconds before they are sent
const PUSH_DELAY_MS = 4000;
// After a failure, try again this long after
const RETRY_DELAY_MS = 60_000;
// Coming back to the game after this long checks the cloud for another device's progress
const REFRESH_AFTER_MS = 30_000;

// ('blocked': the cloud's save is from a newer version of the game, and is left alone)
export type CloudStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict' | 'blocked';

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
  // Both copies changed since they last agreed: the cloud's and its revision, waiting for the player
  // to choose
  conflict?: { cloud: Profile; rev: string; device: SaveSummary; remote: SaveSummary };
  // Something to tell the player that isn't a sync's state (an email link that didn't work)
  notice?: string;
}

interface CloudRow {
  profile: unknown;
  saved_at: string;
  rev: string;
}

// What this device last agreed with the cloud on: the revision there, and its own profile's updatedAt
// then (a change since makes it differ)
interface SyncMark {
  user: string;
  rev: string;
  at: string;
  // A save sent whose answer hasn't come back (if it did arrive, the cloud holds this revision)
  pending?: { rev: string; at: string };
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

// (kept in memory too, for a browser that won't store it)
let memoryMark: SyncMark | null = null;

const readMark = (userId: string): SyncMark | null => {
  let mark = memoryMark;
  try {
    const stored = readFlag(SYNCED_KEY);
    if (stored !== null) mark = JSON.parse(stored) as SyncMark;
  } catch {
    // Unreadable: the copy in memory
  }
  return mark && mark.user === userId && typeof mark.rev === 'string' && typeof mark.at === 'string' ? mark : null;
};
const writeMark = (mark: SyncMark | null) => {
  memoryMark = mark;
  writeFlag(SYNCED_KEY, mark ? JSON.stringify(mark) : null);
};
const markSynced = (userId: string, rev: string, at: string) => {
  writeMark({ user: userId, rev, at });
  update({ status: 'synced', syncedAt: new Date().toISOString(), error: undefined, conflict: undefined });
};

const newRevision = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

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
const showAccount = (user: { email?: string; new_email?: string } | null | undefined) =>
  update({ email: user?.email || undefined, pendingEmail: user?.new_email || undefined });
const refreshEmail = async () => {
  const { data } = await (await client()).auth.getSession();
  showAccount(data.session?.user);
};

// --- Syncing ------------------------------------------------------------------------------------

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let stopListening: (() => void) | null = null;
let lastSync = 0;

const scheduleRetry = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; void sync(); }, RETRY_DELAY_MS);
};

// Send this device's save over the cloud revision `base` (the one it last agreed with; null for none).
// If the cloud holds another revision by now, nothing is written and the two are compared instead.
const push = async (userId: string, base: string | null): Promise<void> => {
  const profile = getProfile();
  const rev = newRevision();
  const mark = readMark(userId);
  // (noted first: if the answer is lost, the next sync still knows this revision is this device's own)
  writeMark(mark ? { ...mark, pending: { rev, at: profile.updatedAt } } : { user: userId, rev: '', at: '', pending: { rev, at: profile.updatedAt } });
  const { data, error } = await (await client()).rpc('put_cloud_save', {
    p_profile: profile, p_saved_at: profile.updatedAt, p_rev: rev, p_base: base
  });
  if (error) throw error;
  const row = data as CloudRow;
  if (row.rev === rev) return markSynced(userId, rev, profile.updatedAt);
  return reconcile(userId, row);
};

// What to do about the two copies: nothing, take the cloud's, send this device's, or ask the player
export type SyncAction = 'inSync' | 'adopt' | 'send' | 'ask';
export const syncAction = (copies: {
  // Never agreed with the cloud on anything, as this account
  firstSync: boolean;
  localChanged: boolean;
  cloudChanged: boolean;
  localHasProgress: boolean;
  cloudHasProgress: boolean;
}): SyncAction => {
  const { firstSync, localChanged, cloudChanged, localHasProgress, cloudHasProgress } = copies;
  if (!firstSync && !localChanged && !cloudChanged) return 'inSync';
  // (a new device's empty save, or one unchanged since the cloud's moved on, gives way; an empty save
  // that was synced before has been erased on purpose, and is sent)
  if ((firstSync && !localHasProgress) || (!localChanged && cloudChanged)) return 'adopt';
  if (!cloudHasProgress || !cloudChanged) return 'send';
  return 'ask';
};

// Compare this device's save with the cloud's and bring them together
const reconcile = async (userId: string, row: CloudRow | null): Promise<void> => {
  let mark = readMark(userId);
  if (!row) return push(userId, null);
  // (a save whose answer was lost did arrive: it's the copy this device agreed with)
  if (mark?.pending && row.rev === mark.pending.rev) {
    mark = { user: userId, rev: row.rev, at: mark.pending.at };
    writeMark(mark);
  }
  const local = getProfile();
  const cloud = sanitizeProfile(row.profile);
  if (!cloud) {
    // A save from a newer version of the game is left alone until this one updates; anything else
    // unreadable is replaced
    if (isNewerProfile(row.profile)) {
      update({ status: 'blocked', error: undefined });
      return;
    }
    return push(userId, row.rev);
  }
  const firstSync = !mark || mark.rev === '';
  const action = syncAction({
    firstSync,
    localChanged: firstSync || local.updatedAt !== mark!.at,
    cloudChanged: firstSync || row.rev !== mark!.rev,
    localHasProgress: hasProgress(local),
    cloudHasProgress: hasProgress(cloud)
  });
  if (action === 'inSync') return markSynced(userId, row.rev, local.updatedAt);
  if (action === 'adopt') {
    const adopted = { ...cloud, updatedAt: row.saved_at };
    adoptProfile(adopted);
    return markSynced(userId, row.rev, getProfile().updatedAt);
  }
  if (action === 'send') return push(userId, row.rev);
  update({ status: 'conflict', conflict: { cloud: { ...cloud, updatedAt: row.saved_at }, rev: row.rev, device: summarise(local), remote: summarise(cloud) } });
};

// Fetch the cloud's save and bring this device and it together (one sync at a time)
export const sync = (): Promise<void> => {
  if (!state.enabled || state.conflict) return Promise.resolve();
  running ??= (async () => {
    lastSync = Date.now();
    update({ status: 'syncing' });
    try {
      const userId = await signedInUser();
      await refreshEmail();
      const { data, error } = await (await client())
        .from('cloud_saves').select('profile, saved_at, rev').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      await reconcile(userId, data as CloudRow | null);
    } catch (error) {
      fail(error);
    }
  })().finally(() => { running = null; });
  return running;
};

// Send what's waiting and wait for any sync or send under way (before switching accounts or deleting
// the save)
const settle = async () => {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    void sendChanges();
  }
  while (running) await running;
};

// Send the latest changes now, rather than after the usual pause (on leaving the page)
const flush = () => {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  void sendChanges();
};

// Send this device's changes, over the cloud copy it last agreed with (if another device has saved
// since, the two are compared instead, and the player asked if both changed)
const sendChanges = (): Promise<void> => {
  if (!state.enabled || state.conflict) return Promise.resolve();
  // (one at a time, and after any sync under way, which may have brought the cloud's copy)
  if (running) return running.then(sendChanges);
  running = (async () => {
    update({ status: 'syncing' });
    try {
      const userId = await signedInUser();
      const mark = readMark(userId);
      // (a change that is only the cloud's own copy arriving - or another tab's, already sent - needs
      // no sending)
      if (mark && mark.rev && getProfile().updatedAt === mark.at) {
        update({ status: 'synced' });
        return;
      }
      // (never synced as this account: compared with the cloud's first)
      if (!mark || !mark.rev) {
        const { data, error } = await (await client())
          .from('cloud_saves').select('profile, saved_at, rev').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        await reconcile(userId, data as CloudRow | null);
        return;
      }
      await push(userId, mark.rev);
    } catch (error) {
      fail(error);
    }
  })().finally(() => { running = null; });
  return running;
};

const startListening = () => {
  if (stopListening) return;
  const unsubscribe = subscribeProfile(() => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; void sendChanges(); }, PUSH_DELAY_MS);
  });
  const onOnline = () => void sync();
  // (leaving the page sends what's waiting; coming back checks for another device's progress)
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
    else if (Date.now() - lastSync > REFRESH_AFTER_MS) void sync();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flush);
  stopListening = () => {
    unsubscribe();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flush);
    stopListening = null;
  };
};

// --- What the player does -----------------------------------------------------------------------

export const enableCloudSave = async () => {
  writeFlag(ENABLED_KEY, 'on');
  update({ enabled: true, notice: undefined });
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

// Remove the copy in the cloud, and stop saving there (another device still saving to this account
// puts its own copy back)
export const deleteCloudSave = async (): Promise<boolean> => {
  try {
    await settle();
    disableCloudSave();
    const userId = await signedInUser();
    const { error } = await (await client()).from('cloud_saves').delete().eq('user_id', userId);
    if (error) throw error;
    writeMark(null);
    return true;
  } catch (error) {
    update({ notice: `Couldn't delete the cloud save (${describe(error)}).` });
    return false;
  }
};

// Settle a conflict: keep the cloud's save (replacing this device's) or this device's (replacing the
// cloud's - as long as no other device has saved again meanwhile, or the player is asked again)
export const resolveConflict = async (keep: 'cloud' | 'device') => {
  const conflict = state.conflict;
  if (!conflict) return;
  trackEvent('cloud_conflict_resolved', { kept: keep });
  update({ conflict: undefined, status: 'syncing' });
  try {
    const userId = await signedInUser();
    if (keep === 'cloud') {
      adoptProfile(conflict.cloud);
      markSynced(userId, conflict.rev, getProfile().updatedAt);
    } else {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = null;
      // (over the cloud copy the player saw: if another device has saved since, they're asked again)
      await push(userId, conflict.rev);
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
  if (/expired|invalid/i.test(message)) return 'That email link or code has expired or was already used - send a new one.';
  return message || 'Something went wrong - try again.';
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Link an email address to this account, so the save can be restored after clearing the browser or
// loaded on another device. A link (and code) to confirm it is sent there.
export const linkEmail = async (email: string): Promise<string | null> => {
  const address = email.trim();
  if (!EMAIL.test(address)) return 'Enter an email address.';
  try {
    await signedInUser();
    noteEmailLinkAsked();
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
    noteEmailLinkAsked();
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
    // (nothing is sent as one account while the device becomes another)
    await settle();
    const { error } = await (await client()).auth.verifyOtp({ email: email.trim(), token, type: purpose === 'link' ? 'email_change' : 'email' });
    if (error) return friendlyAuthError(error);
    trackEvent(purpose === 'link' ? 'cloud_email_linked' : 'cloud_signed_in');
    forgetEmailLink();
    update({ pendingEmail: undefined });
    await enableCloudSave();
    return null;
  } catch (error) {
    return describe(error) === 'offline' ? 'You are offline.' : describe(error);
  }
};

// Sign this device out of the account (its progress stays here; cloud saving stops). Only this
// device: the account's other devices stay signed in.
export const signOutCloud = async () => {
  await settle();
  disableCloudSave();
  writeMark(null);
  try {
    await (await client()).auth.signOut({ scope: 'local' });
  } catch {
    // Offline: the session is cleared on this device anyway
  }
  update({ email: undefined, pendingEmail: undefined });
};

export const dismissCloudNotice = () => update({ notice: undefined });

// --- Start-up -------------------------------------------------------------------------------------

let started = false;

// On loading the game: carry on saving to the cloud if it's on, and finish a sign-in or email link
// opened from an email (it lands on /stats?cloud=..., with the session - or what went wrong - after
// the #)
export const initCloudSave = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  const params = new URLSearchParams(window.location.search);
  const link = new URLSearchParams(window.location.hash.slice(1));
  const linkError = params.has('cloud') ? link.get('error_description') ?? link.get('error') : null;
  // (only a link that really carries a session, opened on the browser that asked for it, turns the
  // cloud save on - the client ignores any other)
  const carriesSession = params.has('cloud') && link.has('access_token');
  const fromEmail = carriesSession && emailLinkExpected() ? params.get('cloud') : null;
  if (params.has('cloud')) {
    params.delete('cloud');
    const query = params.toString();
    const hash = linkError || (carriesSession && !fromEmail) ? '' : window.location.hash;
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${hash}`);
  }
  if (linkError) update({ notice: friendlyAuthError({ message: linkError }) });
  else if (carriesSession && !fromEmail) {
    update({ notice: 'That sign-in link was opened on a different device or browser from the one it was sent from. Type the code from the email there instead.' });
  }
  const enabled = readFlag(ENABLED_KEY) === 'on';
  if (!enabled && !fromEmail) return;
  void (async () => {
    // (the client picks the session out of the link's address as it starts)
    const supabase = await client();
    // (the session comes with the event: calling the client from inside its listener can stall it)
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') showAccount(session?.user);
    });
    if (fromEmail) {
      forgetEmailLink();
      trackEvent(fromEmail === 'linked' ? 'cloud_email_linked' : 'cloud_signed_in');
      await enableCloudSave();
      return;
    }
    update({ enabled: true });
    startListening();
    await sync();
  })().catch(fail);
};
