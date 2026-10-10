// Tests for building battles: a quick battle shared with a friend must be the same battle for them.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState } from '@/types/game';
import { createProfile } from '../meta/profile';
import { cardStats } from '../game/troops';
import { buildBattle, rivalCards } from './battleSetup';

// What a friend has to see the same: the ground, everything standing on it, the castle sites offered
// and the rival army's troops
const battlefield = (state: GameState) => JSON.stringify({
  map: state.mapName,
  hexes: state.hexGrid.map(hex => [hex.coordinates, hex.terrain, hex.feature ?? null, hex.resourceValue ?? null, hex.unit?.type ?? null]),
  castles: state.castleChoices,
  rival: state.rosters?.ai,
  settings: state.settings
});

test('a quick battle with a seed and rival level is the same battle every time', () => {
  // (the friend has a different army of their own: the battlefield and the enemy don't depend on it)
  const veteran = { ...createProfile(), cards: { ...createProfile().cards, infantry: 9, artillery: 9 } };
  const config = { mode: 'quick' as const, difficulty: 'hard' as const, seed: 123456, rivalLevel: 4 };
  const first = buildBattle(config, createProfile());
  const second = buildBattle(config, veteran);
  assert.equal(battlefield(first), battlefield(second));
  assert.equal(first.rivalLevel, 4);
  assert.equal(first.settings?.seed, 123456);
  assert.equal(first.battleSeed, second.battleSeed, 'the great trees and fires come from the seed too');
  assert.deepEqual(first.rosters!.ai.infantry, cardStats('infantry', 4));
});

test('different seeds make different battlefields', () => {
  const maps = new Set([1, 2, 3, 4, 5].map(seed => battlefield(buildBattle({ mode: 'quick', difficulty: 'medium', seed, rivalLevel: 1 }, createProfile()))));
  assert.equal(maps.size, 5);
});

test('a quick battle without a seed picks one, and keeps it so it can be shared', () => {
  const state = buildBattle({ mode: 'quick', difficulty: 'easy' }, createProfile());
  assert.equal(typeof state.settings?.seed, 'number');
  assert.equal(state.rivalLevel, 1, 'a new player\'s rival matches their level 1 cards');
  const again = buildBattle({ mode: 'quick', difficulty: 'easy', seed: state.settings!.seed, rivalLevel: state.rivalLevel }, createProfile());
  assert.equal(battlefield(again), battlefield(state));
});

test('a rival level from a link is kept to the card levels there are', () => {
  assert.equal(buildBattle({ mode: 'quick', difficulty: 'easy', seed: 7, rivalLevel: 99 }, createProfile()).rivalLevel, 15);
  assert.equal(buildBattle({ mode: 'quick', difficulty: 'easy', seed: 7, rivalLevel: 0 }, createProfile()).rivalLevel, 1);
});

test('a seasoned rival kingdom brings evolved forms, the same ones for the same map', () => {
  assert.deepEqual(rivalCards(1, 42), ['infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic']);
  const veteran = rivalCards(12, 42);
  assert.equal(veteran.length, 6);
  assert.deepEqual(rivalCards(12, 42), veteran);
  const seen = new Set(Array.from({ length: 40 }, (_, seed) => rivalCards(12, seed)).flat());
  for (const form of ['warden', 'warlord', 'crossbow', 'halberdier', 'wolf_rider', 'archmage', 'pegasus']) assert.ok(seen.has(form as never), form);
  // Without a seed, every troop it might field (for loading their models)
  for (const id of veteran) assert.ok(rivalCards(12).includes(id));
});
