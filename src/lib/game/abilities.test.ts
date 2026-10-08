// Tests for signature abilities and choosing the castle's site. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState } from '@/types/game';
import {
  DEFAULT_SETTINGS, addPendingMove, chooseCastle, createBattle, executeMoves, findBaseHex, getCombatPreview, getHeightOfHex
} from './gameState';
import { getHexDistance } from './hexUtils';
import { MAX_SIGNATURE_RANK, signatureRank, strafeDamage } from './signatures';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

// Damage the first defender would take if the attackers struck it now
const damageTo = (state: GameState, attackers: ReturnType<typeof makeUnit>[], defender: ReturnType<typeof makeUnit>) =>
  getCombatPreview(state, { hexCoordinates: defender.position, attackers, defenders: [defender], resolved: false }).defenders[0].damageTaken;

test('signatures wake at level 2 and gain a rank every two levels', () => {
  assert.equal(signatureRank(1), 0);
  assert.equal(signatureRank(2), 1);
  assert.equal(signatureRank(3), 1);
  assert.equal(signatureRank(10), 5);
  assert.equal(signatureRank(15), MAX_SIGNATURE_RANK);
});

test('Swordsmen hit harder with friends beside them', () => {
  const { state, centre } = makeBattle();
  const sword = makeUnit('ai', centre, { type: 'infantry', level: 10 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, sword, enemy);
  const alone = damageTo(state, [sword], enemy);
  place(state, makeUnit('ai', at(centre, -1, 0)), makeUnit('ai', at(centre, 0, -1)));
  assert.ok(damageTo(state, [sword], enemy) > alone);
});

test('a level 1 card has no signature yet', () => {
  const { state, centre } = makeBattle();
  const sword = makeUnit('ai', centre, { type: 'infantry', level: 1 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, sword, enemy);
  const alone = damageTo(state, [sword], enemy);
  place(state, makeUnit('ai', at(centre, -1, 0)), makeUnit('ai', at(centre, 0, -1)));
  assert.equal(damageTo(state, [sword], enemy), alone);
});

test('Archers aim better when they stand still', () => {
  const { state, centre } = makeBattle();
  const archer = makeUnit('ai', centre, { type: 'artillery', level: 10, abilities: ['rangedAttack'] });
  const enemy = makeUnit('player', at(centre, 2, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, archer, enemy);
  const still = damageTo(state, [archer], enemy);
  archer.movedHexes = 1;
  assert.ok(damageTo(state, [archer], enemy) < still);
});

test('Pikemen brace on the enemy turn', () => {
  const { state, centre } = makeBattle('player');
  const pike = makeUnit('ai', centre, { type: 'tank', level: 10 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, pike, enemy);
  const braced = damageTo(state, [pike], enemy);
  state.activePlayer = 'ai';
  assert.ok(damageTo(state, [pike], enemy) < braced);
});

test('Rogues fight best alone', () => {
  const { state, centre } = makeBattle();
  const rogue = makeUnit('ai', centre, { type: 'rogue', level: 10 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, rogue, enemy);
  const alone = damageTo(state, [rogue], enemy);
  place(state, makeUnit('ai', at(centre, -2, 0)));
  assert.ok(damageTo(state, [rogue], enemy) < alone);
});

test('Mages ward the troops beside them', () => {
  const { state, centre } = makeBattle();
  const attacker = makeUnit('ai', centre, { attackPower: 10 });
  const target = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, attacker, target);
  const unwarded = damageTo(state, [attacker], target);
  place(state, makeUnit('player', at(centre, 2, 0), { type: 'medic', level: 10 }));
  assert.ok(damageTo(state, [attacker], target) < unwarded);
});

test('Shieldbearers pull the nearest enemy one hex closer at the end of their turn', () => {
  const { state, centre } = makeBattle('player');
  const bearer = makeUnit('player', centre, { type: 'shieldbearer', level: 2 });
  const enemy = makeUnit('ai', at(centre, 2, 0));
  place(state, bearer, enemy);
  const after = playTurn(state);
  assert.equal(getHexDistance(find(after, enemy)!.position, centre), 1);
});

test('Siege Sappers that stand still dig out the ground around them', () => {
  const { state, centre } = makeBattle('player');
  place(state, makeUnit('player', centre, { type: 'sapper', level: 10 }));
  const before = getHeightOfHex(state, at(centre, 1, 0));
  const after = playTurn(state);
  assert.ok(getHeightOfHex(after, at(centre, 1, 0)) < before);
  assert.equal(getHeightOfHex(after, centre), getHeightOfHex(state, centre), 'its own hex stays put');
});

test('Pegasus Knights strafe the enemies they fly past', () => {
  const { state, centre } = makeBattle('player');
  const pegasus = makeUnit('player', centre, { type: 'pegasus', level: 4, abilities: ['flying'], movementRange: 5 });
  const passed = makeUnit('ai', at(centre, 2, -1));
  place(state, pegasus, passed);
  const moved = addPendingMove(state, pegasus.id, state.players.player.id, at(centre, 4, 0));
  assert.notEqual(moved, state, 'the move is allowed');
  const after = executeMoves(moved);
  assert.equal(health(after, passed), 20 - strafeDamage(signatureRank(4)));
});

test('Berserkers heal when they destroy an enemy', () => {
  const { state, centre } = makeBattle();
  const berserker = makeUnit('ai', centre, { type: 'berserker', level: 10, attackPower: 20, lifespan: 5 });
  const victim = makeUnit('player', at(centre, 1, 0), { lifespan: 3, maxLifespan: 3, attackPower: 1 });
  place(state, berserker, victim);
  const after = playTurn(state);
  assert.equal(find(after, victim), undefined);
  assert.ok(health(after, berserker) > 5);
});

// --- Choosing the castle --------------------------------------------------------------------

test('the player can choose between castle sites before the first turn', () => {
  const state = createBattle({ ...DEFAULT_SETTINGS, seed: 11 }, {
    rosters: { player: {}, ai: {} },
    chooseCastle: true
  });
  assert.equal(state.currentPhase, 'setup');
  const choices = state.castleChoices!;
  assert.ok(choices.length >= 2);
  const picked = chooseCastle(state, choices[choices.length - 1]);
  assert.equal(picked.currentPhase, 'planning');
  assert.deepEqual(findBaseHex(picked, 'player')!.coordinates, choices[choices.length - 1]);
  assert.ok(findBaseHex(picked, 'ai'));
  assert.equal(chooseCastle(state, { q: 99, r: 99 }), state, 'only an offered site');
});
