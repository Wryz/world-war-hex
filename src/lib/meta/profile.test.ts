// Tests for the player profile. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
});
