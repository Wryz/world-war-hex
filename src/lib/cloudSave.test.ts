// Tests for the cloud save's choice between two copies. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncAction } from './cloudSave';
import { createProfile, hasProgress } from './meta/profile';

const copies = (firstSync: boolean, localChanged: boolean, cloudChanged: boolean, localHasProgress = true, cloudHasProgress = true) =>
  syncAction({ firstSync, localChanged, cloudChanged, localHasProgress, cloudHasProgress });

test('the copy that changed since the last sync wins on its own', () => {
  assert.equal(copies(false, false, false), 'inSync');
  assert.equal(copies(false, true, false), 'send', 'played on this device');
  assert.equal(copies(false, false, true), 'adopt', 'played on another device (or tab)');
});

test('both changed since they last agreed: the player chooses', () => {
  assert.equal(copies(false, true, true), 'ask');
  // (a device that never synced with this account - a new device signing in - asks too)
  assert.equal(copies(true, true, true), 'ask');
});

test('an empty save gives way to one with progress - unless it was erased on purpose', () => {
  assert.equal(copies(true, true, true, false, true), 'adopt', 'a new device takes the cloud save');
  assert.equal(copies(true, true, true, true, false), 'send', 'an empty cloud save is replaced');
  // (progress erased on a synced device, its send interrupted: the erasing is sent, not undone)
  assert.equal(copies(false, true, false, false, true), 'send');
  assert.ok(!hasProgress(createProfile()));
  assert.ok(hasProgress({ ...createProfile(), coins: 5 }));
});

test('a change to the profile always moves its time on', async () => {
  const stored = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) } });
  const { adoptProfile, getProfile, grantBonusCoins } = await import('./meta/profile');
  // (a copy made on a device whose clock is an hour ahead)
  const ahead = new Date(Date.now() + 3600_000).toISOString();
  adoptProfile({ ...createProfile(), updatedAt: ahead });
  grantBonusCoins(5);
  assert.ok(Date.parse(getProfile().updatedAt) > Date.parse(ahead));
});
