// Tests for the cloud save's choice between two copies. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncAction } from './cloudSave';
import { createProfile, hasProgress } from './meta/profile';

const copies = (localAt: number, cloudAt: number, synced: number | null, localHasProgress = true, cloudHasProgress = true) =>
  syncAction({ localAt, cloudAt, synced, localHasProgress, cloudHasProgress });

test('the copy that changed since the last sync wins on its own', () => {
  assert.equal(copies(100, 100, 100), 'inSync');
  assert.equal(copies(200, 100, 100), 'send', 'played on this device');
  assert.equal(copies(100, 200, 100), 'adopt', 'played on another device');
});

test('both changed since they last agreed: the player chooses', () => {
  assert.equal(copies(200, 300, 100), 'ask');
  assert.equal(copies(300, 200, 100), 'ask');
  // (a device that never synced with this account - a new device signing in - asks too)
  assert.equal(copies(200, 300, null), 'ask');
});

test('an empty save gives way to one with progress', () => {
  assert.equal(copies(500, 300, null, false, true), 'adopt', 'a new device takes the cloud save');
  assert.equal(copies(200, 300, null, true, false), 'send', 'an empty cloud save is replaced even when dated later');
  assert.equal(copies(300, 200, null, true, false), 'send');
  assert.ok(!hasProgress(createProfile()));
  assert.ok(hasProgress({ ...createProfile(), coins: 5 }));
});

test('a device clock set wrong can\'t hide a change', () => {
  // (this device's clock is behind: its change is dated before the copy it last agreed on)
  assert.equal(copies(90, 100, 100), 'send');
  // (another device's clock is behind: its newer copy is dated earlier)
  assert.equal(copies(100, 50, 100), 'adopt');
  assert.equal(copies(90, 50, 100), 'ask');
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
