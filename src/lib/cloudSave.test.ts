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
  assert.equal(copies(200, 300, null, true, false), 'sendOver', 'an empty cloud save is replaced even when dated later');
  assert.equal(copies(300, 200, null, true, false), 'send');
  assert.ok(!hasProgress(createProfile()));
  assert.ok(hasProgress({ ...createProfile(), coins: 5 }));
});
