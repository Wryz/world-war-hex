// Tests for the monsters' own skills. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UnitType } from '@/types/game';
import { getFormationMultiplier, getMovementRange } from './gameState';
import { MOB_SKILLS, getMobSkill } from './mobSkills';
import { TROOPS, TroopId } from './troops';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

const troop = (owner: 'player' | 'ai', type: string, position: { q: number; r: number }, extra = {}) =>
  makeUnit(owner, position, { type: type as UnitType, ...extra });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

test('every regular monster has a skill of its own, and bosses have their powers instead', () => {
  for (const [id, def] of Object.entries(TROOPS) as [TroopId, (typeof TROOPS)[TroopId]][]) {
    if (def.faction === 'kingdom') assert.equal(MOB_SKILLS[id], undefined, id);
    else if (def.isBoss) assert.equal(getMobSkill({ type: id, isBoss: true }), undefined, id);
    else assert.ok(MOB_SKILLS[id]?.description, `${id} has a skill`);
  }
});

test('Gang Up: a bandit thug hits harder with another bandit beside its target', () => {
  const { state, centre } = makeBattle('ai');
  const prey = troop('player', 'infantry', centre);
  // (a friend of the prey beside it, so the thug's side isn't picking off a straggler)
  const friend = troop('player', 'infantry', at(centre, 0, -1));
  const thug = troop('ai', 'bandit_thug', at(centre, 1, 0));
  place(state, prey, friend, thug);
  const alone = getFormationMultiplier(state, thug, prey);
  place(state, troop('ai', 'bandit_thug', at(centre, -1, 0)));
  close(getFormationMultiplier(state, thug, prey) / alone, 1 + MOB_SKILLS.bandit_thug!.share!);
});

test('Thick Fur: a cave bear shrugs off arrows but not blades', () => {
  const { state, centre } = makeBattle('player');
  const bear = troop('ai', 'cave_bear', centre);
  const archer = troop('player', 'artillery', at(centre, 2, 0), { abilities: ['rangedAttack'] });
  const sword = troop('player', 'infantry', at(centre, -1, 0));
  place(state, bear, archer, sword);
  // (against a troop of the same build without the skill, everything else being equal)
  const plain = { ...bear, type: 'infantry' as UnitType };
  close(getFormationMultiplier(state, archer, bear) / getFormationMultiplier(state, archer, plain), 1 - MOB_SKILLS.cave_bear!.share!);
  close(getFormationMultiplier(state, sword, bear) / getFormationMultiplier(state, sword, plain), 1);
});

test('Toxic Spit: a toad\'s target loses health to venom at the end of its next turn', () => {
  const { state, centre } = makeBattle('ai');
  const toad = troop('ai', 'toxic_toad', centre, { abilities: ['rangedAttack'] });
  const prey = troop('player', 'infantry', at(centre, 2, 0));
  place(state, toad, prey);
  const bitten = playTurn(state);
  assert.equal(find(bitten, prey)?.poisoned, MOB_SKILLS.toxic_toad!.amount);
  const before = health(bitten, prey);
  const after = playTurn(bitten);
  assert.equal(health(after, prey), before - MOB_SKILLS.toxic_toad!.amount!);
  assert.equal(find(after, prey)?.poisoned, undefined);
});

test('Web: a giant spider\'s bite slows its prey on its next turn', () => {
  const { state, centre } = makeBattle('ai');
  const spider = troop('ai', 'giant_spider', centre);
  const prey = troop('player', 'infantry', at(centre, 1, 0), { movementRange: 3 });
  place(state, spider, prey);
  const bitten = playTurn(state);
  const caught = find(bitten, prey)!;
  assert.equal(getMovementRange(bitten, caught), 2);
  // (it shakes the web off at the end of that turn, once the spider has gone)
  bitten.players.ai.units = [];
  for (const hex of bitten.hexGrid) if (hex.unit?.owner === 'ai') hex.unit = undefined;
  const free = playTurn(bitten);
  assert.equal(getMovementRange(free, find(free, prey)!), 3);
});

test('Stand and Deliver: a highwayman\'s blows steal gold', () => {
  const { state, centre } = makeBattle('ai');
  state.players.player.points = 10;
  state.players.ai.points = 0;
  const robber = troop('ai', 'highwayman', centre, { abilities: ['stealth'] });
  const prey = troop('player', 'infantry', at(centre, 1, 0));
  place(state, robber, prey);
  const after = playTurn(state);
  assert.equal(after.players.player.points, 10 - MOB_SKILLS.highwayman!.amount!);
  assert.ok(after.log?.some(entry => entry.text.includes('Stand and Deliver')));
});

test('Kaboom: a goblin sapper bursts over the troops beside it as it falls', () => {
  const { state, centre } = makeBattle('ai');
  const sapper = troop('ai', 'goblin_sapper', centre, { lifespan: 1, maxLifespan: 6, attackPower: 1 });
  const prey = troop('player', 'infantry', at(centre, 1, 0), { attackPower: 10 });
  const bystander = troop('player', 'infantry', at(centre, -1, 0), { attackPower: 0 });
  place(state, sapper, prey, bystander);
  const after = playTurn(state);
  assert.equal(find(after, sapper), undefined);
  assert.ok(after.log?.some(entry => entry.text.includes('Kaboom')));
  assert.ok(health(after, bystander) <= 20 - MOB_SKILLS.goblin_sapper!.amount!, `bystander at ${health(after, bystander)}`);
});
