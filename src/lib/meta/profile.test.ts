// Tests for the player profile. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelLossReward } from './economy';
import { retiredTacticRefund, sanitizeProfile } from './profile';

test('coins spent on the retired tactic cards come back', () => {
  // Rally was a free starter upgraded twice (25 + 35); Bulwark was bought (160) and upgraded once (25)
  assert.equal(retiredTacticRefund({ rally: 3, bulwark: 2 }), 25 + 35 + 160 + 25);
  assert.equal(retiredTacticRefund({ mend: 1, pitTrap: 1 }), 0, 'untouched starters cost nothing');
  assert.equal(retiredTacticRefund(undefined), 0, 'nothing to refund on newer profiles');
});

test('a save can\'t sneak in free coins or lose its fastest win', () => {
  // (keys every object inherits are not retired tactic cards)
  const hostile = sanitizeProfile({ version: 1, coins: 0, tactics: { constructor: 1, toString: 3 } })!;
  assert.ok(Number.isFinite(hostile.coins));
  assert.equal(sanitizeProfile({ version: 1, stats: { fastestWinRounds: 5 } })!.stats.fastestWinRounds, 5);
  assert.ok(sanitizeProfile({ version: 1, coins: 2 ** 60 })!.coins <= 1e9);
  // (only the tactics there were are refunded, and never past the cap)
  assert.equal(retiredTacticRefund({ notATactic: 10, x: 10 }), 0);
  assert.ok(sanitizeProfile({ version: 1, coins: 1e9, tactics: { bulwark: 10 } })!.coins <= 1e9);
  // (a best that isn't a number is no best, rather than a best of 0 rounds)
  assert.equal(sanitizeProfile({ version: 1, levels: { 3: { stars: 2, wins: 1, losses: 0, bestRounds: null } } })!.levels[3].bestRounds, undefined);
  assert.equal(sanitizeProfile({ version: 1, levels: { 3: { stars: 2, wins: 1, losses: 0, bestRounds: 7 } } })!.levels[3].bestRounds, 7);
});

test('a damaged battle save can\'t turn a loss\'s spoils into nonsense', () => {
  assert.equal(levelLossReward(5, NaN).coins, levelLossReward(5, 0).coins);
  assert.equal(levelLossReward(5, Infinity).coins, levelLossReward(5, 0).coins);
  assert.equal(levelLossReward(5, 7).coins, levelLossReward(5, 1).coins);
});
