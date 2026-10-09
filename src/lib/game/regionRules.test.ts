// Tests for faction traits, weather and morale. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UnitType } from '@/types/game';
import { getAttackRange, getFormationMultiplier, getMovementRange, getValidMoveTargets, getVisibleEnemies } from './gameState';
import {
  FURY_MAX, PACK_BONUS, SHAKEN_ATTACK, activeWeather, furyMultiplier, getFogBankCentres, getFogBankKeys, stormForecast
} from './regionRules';
import { getLevel, enemyRosterStats } from '../campaign/levels';
import { scaleTroop, TROOPS } from './troops';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

const troop = (owner: 'player' | 'ai', type: string, position: { q: number; r: number }, extra = {}) =>
  makeUnit(owner, position, { type: type as UnitType, ...extra });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

test('undead rise again once, unless a War Cleric finishes them', () => {
  const { state, centre } = makeBattle('player');
  const skeleton = troop('ai', 'skeleton_minion', centre, { lifespan: 3, maxLifespan: 12 });
  const sword = troop('player', 'infantry', at(centre, 1, 0), { attackPower: 10 });
  place(state, skeleton, sword);
  const after = playTurn(state);
  const risen = find(after, skeleton);
  assert.ok(risen, 'it rose');
  assert.equal(risen!.risen, true);
  assert.equal(risen!.lifespan, 4, 'a third of its health');

  // Slain a second time, it stays down
  risen!.lifespan = 1;
  after.activePlayer = 'player';
  after.currentPhase = 'planning';
  assert.equal(find(playTurn(after), skeleton), undefined);

  // A War Cleric's smite puts it down for good the first time
  const holy = makeBattle('player');
  const bones = troop('ai', 'skeleton_minion', holy.centre, { lifespan: 3, maxLifespan: 12 });
  const cleric = troop('player', 'cleric', at(holy.centre, 1, 0), { attackPower: 10, level: 3 });
  place(holy.state, bones, cleric);
  assert.equal(find(playTurn(holy.state), bones), undefined);
});

test('orcs hit harder the more they are hurt', () => {
  close(furyMultiplier({ type: 'orc_grunt', lifespan: 20, maxLifespan: 20 }), 1);
  close(furyMultiplier({ type: 'orc_grunt', lifespan: 10, maxLifespan: 20 }), 1 + FURY_MAX / 2);
  close(furyMultiplier({ type: 'orc_warlord', isBoss: true, lifespan: 1, maxLifespan: 20 }), 1);
  close(furyMultiplier({ type: 'infantry', lifespan: 1, maxLifespan: 20 }), 1);
});

test('beasts hunt in packs', () => {
  const { state, centre } = makeBattle('ai');
  const prey = troop('player', 'infantry', centre);
  const wolf = troop('ai', 'grey_wolf', at(centre, 1, 0));
  const second = troop('ai', 'grey_wolf', at(centre, -1, 0));
  const third = troop('ai', 'grey_wolf', at(centre, 0, 1));
  place(state, prey, wolf, second, third);
  close(getFormationMultiplier(state, wolf, prey), 1 + PACK_BONUS * 2);
});

test('goblins come cheap and packed together share their blows', () => {
  const level = getLevel(12);
  const roster = enemyRosterStats(level);
  const scrapper = roster.goblin_scrapper!;
  assert.ok(scrapper.cost < scaleTroop(TROOPS.goblin_scrapper, level.enemyScale, level.enemyTier).cost, 'cheaper');

  const { state, centre } = makeBattle('player');
  const hit = troop('ai', 'goblin_scrapper', centre, { lifespan: 20, maxLifespan: 20 });
  const beside = troop('ai', 'goblin_scrapper', at(centre, 0, -1), { lifespan: 20, maxLifespan: 20 });
  const sword = troop('player', 'infantry', at(centre, 1, 0), { attackPower: 8 });
  place(state, hit, beside, sword);
  const after = playTurn(state);
  assert.ok(health(after, hit) < 20);
  assert.ok(health(after, beside) < 20, 'the goblin beside it is hurt too');
});

test('drakes fly and dragonkin flyers pass over enemy gates', () => {
  const { state, centre } = makeBattle('ai');
  const gate = at(centre, 1, 0);
  const hex = state.hexGrid.find(h => h.coordinates.q === gate.q && h.coordinates.r === gate.r)!;
  hex.terrain = 'gate';
  hex.owner = 'player';
  const wyvern = troop('ai', 'wyvern', centre, { abilities: ['flying'], movementRange: 3 });
  const wolf = troop('ai', 'grey_wolf', at(centre, 0, 1), { movementRange: 3 });
  place(state, wyvern, wolf);
  const lands = (unit: typeof wyvern) => getValidMoveTargets(state, unit).some(c => c.q === gate.q && c.r === gate.r);
  assert.ok(lands(wyvern), 'the wyvern can fly over the gatehouse');
  assert.ok(!lands(wolf), 'a wolf can\'t pass');
});

test('storms come and go; sandstorms cut reach, blizzards slow', () => {
  const { state, centre } = makeBattle('player');
  state.settings = { ...state.settings!, weather: 'sandstorm' };
  const archer = troop('player', 'artillery', centre, { abilities: ['rangedAttack'] });
  const mummy = troop('ai', 'mummy', at(centre, 3, 0), { abilities: ['rangedAttack'] });
  const raging = (round: number) => activeWeather({ ...state, turnNumber: round }) === 'sandstorm';
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(raging), [false, false, true, true, false, false, true]);
  assert.equal(stormForecast({ ...state, turnNumber: 2 }), 'coming');
  assert.equal(stormForecast({ ...state, turnNumber: 4 }), 'ending');
  state.turnNumber = 3;
  assert.equal(getAttackRange(archer, 'plain', state), 1);
  assert.equal(getAttackRange({ ...mummy, type: 'mummy' as UnitType }, 'plain', state), 2, 'the Sand Court shoots through it');
  state.turnNumber = 1;
  assert.equal(getAttackRange(archer, 'plain', state), 2);

  state.settings = { ...state.settings!, weather: 'blizzard' };
  state.turnNumber = 3;
  const sword = troop('player', 'infantry', centre, { movementRange: 3 });
  const yeti = troop('ai', 'yeti', centre, { movementRange: 3 });
  assert.equal(getMovementRange(state, sword), 2);
  assert.equal(getMovementRange(state, yeti), 3, 'the Frostborn walk through blizzards');
});

test('fog banks drift and hide the troops inside them', () => {
  const { state, centre } = makeBattle('player');
  state.settings = { ...state.settings!, weather: 'fogBanks', fogOfWar: true };
  state.turnNumber = 1;
  const first = getFogBankCentres(state);
  assert.equal(first.length, 3);
  state.turnNumber = 2;
  assert.notDeepEqual(getFogBankCentres(state), first, 'the banks drift');

  const fog = [...getFogBankKeys(state)][0].split(',').map(Number);
  const hidden = troop('ai', 'infantry', { q: fog[0], r: fog[1] });
  // A lookout two hexes off, outside the fog
  const spot = state.hexGrid.map(hex => hex.coordinates).find(c =>
    Math.max(Math.abs(c.q - fog[0]), Math.abs(c.r - fog[1]), Math.abs(c.q + c.r - fog[0] - fog[1])) === 2 &&
    !getFogBankKeys(state).has(`${c.q},${c.r}`));
  assert.ok(spot && centre);
  place(state, hidden, troop('player', 'infantry', spot!));
  assert.equal(getVisibleEnemies(state, 'player').length, 0, 'hidden in the fog');
});

test('a boss falling shakes its army; a hurt troop surrounded wavers', () => {
  const { state, centre } = makeBattle('player');
  const king = troop('ai', 'bandit_king', centre, { isBoss: true, lifespan: 1, maxLifespan: 50 });
  const thug = troop('ai', 'bandit_thug', at(centre, 3, -1));
  const bones = troop('ai', 'skeleton_minion', at(centre, -3, 1));
  const sword = troop('player', 'infantry', at(centre, 1, 0), { attackPower: 10 });
  place(state, king, thug, bones, sword);
  const after = playTurn(state);
  assert.equal(find(after, king), undefined);
  assert.ok((find(after, thug)!.shaken ?? 0) > 0, 'the bandit is shaken');
  assert.equal(find(after, bones)!.shaken, undefined, 'the undead are fearless');
  // It steadies after its side's turns
  const later = playTurn(playTurn(after));
  assert.ok((find(later, thug)!.shaken ?? 0) < (find(after, thug)!.shaken ?? 0));

  // Surrounded and alone at low health
  const ring = makeBattle('player');
  const lone = troop('ai', 'bandit_thug', ring.centre, { lifespan: 3, maxLifespan: 20 });
  const a = troop('player', 'artillery', at(ring.centre, 1, 0), { attackPower: 0, abilities: ['rangedAttack'] });
  const b = troop('player', 'artillery', at(ring.centre, -1, 0), { attackPower: 0, abilities: ['rangedAttack'] });
  place(ring.state, lone, a, b);
  const wavering = playTurn(ring.state);
  assert.equal(find(wavering, lone)?.shaken, 1);
  assert.ok(SHAKEN_ATTACK < 1);
});

test('a boss burned to death shakes its army too', () => {
  const { state, centre } = makeBattle('ai');
  const hex = state.hexGrid.find(h => h.coordinates.q === centre.q && h.coordinates.r === centre.r)!;
  hex.fire = { stage: 'burning', turnsLeft: 2 };
  const king = troop('ai', 'bandit_king', centre, { isBoss: true, lifespan: 1, maxLifespan: 50 });
  const thug = troop('ai', 'bandit_thug', at(centre, 3, -1));
  place(state, king, thug);
  const after = playTurn(state);
  assert.equal(find(after, king), undefined);
  assert.ok((find(after, thug)!.shaken ?? 0) > 0);
});
