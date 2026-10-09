// Tests for the bosses' powers: strikes marked a turn ahead, minions bound to their boss, the
// Hydra's bites and the rage at half health. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UnitType } from '@/types/game';
import { addPendingMove, inflictDamage } from './gameState';
import { BOSS_POWERS, aimStrike } from './bosses';
import { getHexDistance } from './hexUtils';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

const boss = (type: string, position: { q: number; r: number }, extra = {}) =>
  makeUnit('ai', position, { type: type as UnitType, isBoss: true, attackPower: 10, lifespan: 100, maxLifespan: 100, ...extra });

test('every boss has a power', () => {
  for (const type of ['bandit_king', 'goblin_warchief', 'alpha_direwolf', 'bog_hydra', 'pharaoh', 'frost_giant', 'lich_king', 'orc_warlord', 'demon_lord', 'elder_dragon']) {
    assert.ok(BOSS_POWERS[type as keyof typeof BOSS_POWERS], type);
  }
});

test('a strike is marked a turn ahead, then lands on whoever is still there', () => {
  const { state, centre } = makeBattle('ai');
  const giant = boss('frost_giant', centre);
  const troop = makeUnit('player', at(centre, 2, 0));
  place(state, giant, troop);

  // The giant marks the ground around the troop, and nothing is hit yet
  const marked = playTurn(state);
  const threat = find(marked, giant)!.threat!;
  assert.ok(threat.some(c => c.q === troop.position.q && c.r === troop.position.r), 'the troop is in the marked ground');
  assert.equal(health(marked, troop), 20);

  // The troop stays put through its turn, and the stomp lands at the end of the giant's next one
  const struck = playTurn(playTurn(marked));
  assert.equal(health(struck, troop), 20 - 6, 'Ice Stomp: 60% of the giant\'s attack');
  assert.equal(find(struck, troop)!.frozen, true, 'frozen');
  assert.equal(find(struck, troop)!.hasMoved, true, 'it can\'t move this turn');
  assert.equal(find(struck, giant)!.threat, undefined);
  assert.equal(struck.lastBossPower?.power, 'iceStomp');

  // The freeze wears off after the frozen side's turn
  const thawed = playTurn(struck);
  assert.equal(find(thawed, troop)!.frozen, undefined);
});

test('a troop that steps out of the marked ground escapes the strike', () => {
  const { state, centre } = makeBattle('ai');
  const pharaoh = boss('pharaoh', centre);
  const troop = makeUnit('player', at(centre, 2, 0), { movementRange: 3 });
  place(state, pharaoh, troop);
  const marked = playTurn(state);
  const threat = find(marked, pharaoh)!.threat!;
  const away = at(centre, 2, 0);
  const safe = { q: away.q + 2, r: away.r - 1 };
  assert.ok(threat.every(c => getHexDistance(c, safe) > 0), 'the safe hex is outside the marked ground');
  const moved = playTurn(addPendingMove(marked, troop.id, marked.players.player.id, safe));
  const after = playTurn(moved);
  assert.equal(health(after, troop), 20, 'dodged');
});

test('summoners call minions bound to them, who flee when the boss falls', () => {
  const { state, centre } = makeBattle('ai');
  const king = boss('bandit_king', centre);
  const troop = makeUnit('player', at(centre, 4, 0));
  place(state, king, troop);
  const called = playTurn(state);
  const minions = called.players.ai.units.filter(unit => unit.summonedBy === king.id);
  assert.equal(minions.length, 1);
  assert.ok(minions.every(unit => unit.type === 'bandit_thug' && getHexDistance(unit.position, centre) <= 2));

  // Nobody near: no call
  const quiet = makeBattle('ai');
  const lonely = boss('bandit_king', quiet.centre);
  place(quiet.state, lonely);
  assert.equal(playTurn(quiet.state).players.ai.units.length, 1);

  inflictDamage(called, find(called, king)!, 1000, 'player');
  assert.equal(called.players.ai.units.length, 0, 'the gang scatters');
});

test('the Bog Hydra bites every enemy next to it at the end of each of its turns', () => {
  const { state, centre } = makeBattle('ai');
  const hydra = boss('bog_hydra', centre);
  const left = makeUnit('player', at(centre, 1, 0));
  const right = makeUnit('player', at(centre, -1, 0));
  const far = makeUnit('player', at(centre, 3, 0));
  place(state, hydra, left, right, far);
  const bitten = playTurn(state);
  // (they also fight it, being next to it)
  const struck = bitten.lastBossPower!;
  assert.equal(struck.power, 'manyHeads');
  assert.equal(struck.hexes.length, 2, 'both neighbours bitten');
  assert.ok(bitten.log!.some(entry => entry.text.includes('Many Heads')));
  assert.equal(health(bitten, far), 20, 'not the troop further off');
});

test('an enraged boss uses its power sooner', () => {
  const run = (lifespan: number) => {
    const { state, centre } = makeBattle('ai');
    const wolf = boss('alpha_direwolf', centre, { lifespan });
    place(state, wolf, makeUnit('player', at(centre, 4, 0), { lifespan: 999, maxLifespan: 999 }));
    let current = playTurn(state);
    const counts: number[] = [];
    for (let turn = 0; turn < 4; turn++) {
      current = playTurn(playTurn(current));
      counts.push(current.players.ai.units.length - 1);
    }
    return counts;
  };
  // Calm: a wolf, then another three turns later. Enraged: one every other turn
  assert.deepEqual(run(100), [1, 1, 2, 2]);
  assert.deepEqual(run(40), [1, 2, 2, 3]);
});

test('strikes aim where they catch the most troops', () => {
  const board = new Set<string>();
  for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) board.add(`${q},${r}`);
  const from = { q: 0, r: 0 };
  const troops = [{ position: { q: 2, r: 0 }, lifespan: 9 }, { position: { q: 3, r: 0 }, lifespan: 5 }, { position: { q: 0, r: -3 }, lifespan: 1 }];
  const line = aimStrike({ shape: 'line', range: 4, damage: 1 }, from, troops, board);
  assert.deepEqual(line, [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }]);
  const scatter = aimStrike({ shape: 'scatter', range: 4, damage: 1 }, from, troops, board);
  assert.deepEqual(scatter[0], { q: 0, r: -3 }, 'weakest first');
  const blast = aimStrike({ shape: 'blast', range: 4, damage: 1 }, from, troops, board);
  assert.equal(blast.length, 7);
  assert.ok(blast.some(c => c.q === 2 && c.r === 0) && blast.some(c => c.q === 3 && c.r === 0), 'both close troops caught');
  assert.deepEqual(aimStrike({ shape: 'blast', range: 1, damage: 1 }, from, troops, board), [], 'nothing in reach');
});
