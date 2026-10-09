// Tests for gathering materials on the battlefield and carrying them home. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, HexCoordinates } from '@/types/game';
import { DEFAULT_SETTINGS, addPendingMove, chooseCastle, createBattle, defaultRoster, executeMoves, updateHex } from './gameState';
import { MATERIALS, MATERIAL_IDS, SPOILS, landMaterials } from './materials';
import { CHRONICLE, STORY_SITES } from './lore';
import { REGIONS } from '../campaign/levels';
import { TROOPS, MOB_IDS } from './troops';
import { keptHaul } from '../meta/profile';
import { at, makeBattle, makeUnit, place, playTurn } from './testUtils';

const hexAt = (state: GameState, c: HexCoordinates) =>
  state.hexGrid.find(hex => hex.coordinates.q === c.q && hex.coordinates.r === c.r)!;

test('there are 80 materials, every enemy leaves something and every region has a story site', () => {
  assert.equal(MATERIAL_IDS.length, 80);
  for (const id of MOB_IDS) assert.ok(SPOILS[id], `${TROOPS[id].name} leaves spoils`);
  for (const region of REGIONS) {
    const site = STORY_SITES[region.theme];
    assert.ok(site, `${region.name} has a story site`);
    assert.equal(MATERIALS[site.relic].category, 'relic');
  }
  // Every relic and trophy opens a page of the Chronicle, and every page's material exists
  const pages = new Set(CHRONICLE.map(page => page.unlockedBy).filter(Boolean));
  for (const id of MATERIAL_IDS) {
    const { category } = MATERIALS[id];
    if (category === 'relic' || category === 'trophy') assert.ok(pages.has(id), `${id} opens a page`);
  }
});

test('a battle sets out things to gather, with springs and gold mines always giving something', () => {
  let state = createBattle({ ...DEFAULT_SETTINGS, gridSize: 6, seed: 11, themeName: 'Greenvale Meadows' }, { rosters: { player: defaultRoster(), ai: defaultRoster() }, levelId: 3, chooseCastle: true });
  if (state.castleChoices) state = chooseCastle(state, state.castleChoices[0]);
  const harvest = state.hexGrid.filter(hex => hex.harvest);
  assert.ok(harvest.length >= 5, 'several spots to gather');
  for (const hex of harvest) {
    assert.ok(!hex.isBase && !hex.isCamp, 'never on a castle or camp');
    if (hex.isResourceHex) assert.equal(hex.harvest, 'gold_nugget');
    else if (hex.terrain === 'spring') assert.equal(hex.harvest, 'spring_water');
    else if (hex.harvest !== 'charcoal') assert.ok(landMaterials(hex.terrain, 'Greenvale Meadows').includes(hex.harvest!), `${hex.harvest} on ${hex.terrain}`);
  }
  assert.equal(state.hexGrid.filter(hex => hex.storySite).length, 1, 'one story site');
});

test('a troop ending its turn on a glinting hex gathers it, once', () => {
  const { state, centre } = makeBattle('player');
  updateHex(state, centre, { harvest: 'timber' });
  const scout = makeUnit('player', at(centre, -1, 0));
  place(state, scout);
  const after = playTurn(state);
  // (moving the troop onto it)
  const moved = playTurn(addPendingMove(state, scout.id, state.players.player.id, centre));
  assert.equal(moved.haul?.timber, 1);
  assert.equal(hexAt(moved, centre).harvest, undefined, 'taken');
  assert.ok(moved.gathered?.some(item => item.material === 'timber'));
  assert.equal(after.haul?.timber, undefined, 'nothing without a troop there');
});

test('the story site gives up its relic once; the first to take a building takes its stores', () => {
  const { state, centre } = makeBattle('player', { mapName: 'Howling Hills' });
  updateHex(state, centre, { storySite: true });
  updateHex(state, at(centre, 2, 0), { terrain: 'blacksmith' });
  place(state, makeUnit('player', centre), makeUnit('player', at(centre, 1, 0)));
  const first = executeMoves(addPendingMove(state, state.players.player.units[1].id, state.players.player.id, at(centre, 2, 0)));
  assert.equal(first.haul?.dragonbone, 1, 'the relic of Howling Hills');
  assert.equal(first.haul?.steel_ingot, 1, 'the stores of the blacksmith');
  assert.ok(hexAt(first, centre).plundered);
});

test('a fallen enemy leaves its spoils, a boss its trophy', () => {
  const { state, centre } = makeBattle('player');
  const wolf = makeUnit('ai', at(centre, 1, 0), { type: 'grey_wolf', lifespan: 1 });
  const king = makeUnit('ai', at(centre, -1, 0), { type: 'bandit_king', lifespan: 1, isBoss: true });
  place(state, makeUnit('player', centre, { attackPower: 30 }), makeUnit('player', at(centre, -1, 1), { attackPower: 30 }), wolf, king);
  let next = addPendingMove(state, state.players.player.units[0].id, state.players.player.id, wolf.position);
  next = addPendingMove(next, state.players.player.units[1].id, state.players.player.id, king.position);
  const after = playTurn(next);
  assert.equal(after.haul?.beast_pelt, 1);
  assert.equal(after.haul?.bandit_signet, 1);
});

test('a win brings the whole haul home, a defeat half of each (a single relic is kept), resigning nothing', () => {
  const haul = { timber: 5, crown_shard: 1 };
  assert.deepEqual(keptHaul({ won: true, haul }), haul);
  assert.deepEqual(keptHaul({ won: false, reason: 'destroyed', haul }), { timber: 3, crown_shard: 1 });
  assert.deepEqual(keptHaul({ won: false, reason: 'resigned', haul }), {});
});
