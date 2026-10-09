// Tests for the player profile. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retiredTacticRefund } from './profile';

test('coins spent on the retired tactic cards come back', () => {
  // Rally was a free starter upgraded twice (25 + 35); Bulwark was bought (160) and upgraded once (25)
  assert.equal(retiredTacticRefund({ rally: 3, bulwark: 2 }), 25 + 35 + 160 + 25);
  assert.equal(retiredTacticRefund({ mend: 1, pitTrap: 1 }), 0, 'untouched starters cost nothing');
  assert.equal(retiredTacticRefund(undefined), 0, 'nothing to refund on newer profiles');
});
