// Tests for level challenges. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_COUNT, getLevel } from './levels';
import { challengeMet, levelChallenge } from './challenges';
import { makeBattle } from '../game/testUtils';

test('every level past the tutorial has a challenge; bosses ask for the boss', () => {
  assert.equal(levelChallenge(1), undefined);
  assert.equal(levelChallenge(2), undefined);
  for (let id = 3; id <= LEVEL_COUNT; id++) assert.ok(levelChallenge(id), `level ${id}`);
  assert.equal(levelChallenge(10)!.id, 'slayBoss');
  assert.equal(levelChallenge(getLevel(15))!.id, 'topple');
});

test('a challenge counts only for a win', () => {
  const { state } = makeBattle('player');
  const level = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).find(id => levelChallenge(id)?.id === 'noLosses')!;
  state.levelId = level;
  state.battleStats!.player.lost = 0;
  state.winner = 'ai';
  assert.equal(challengeMet(state), false);
  state.winner = 'player';
  assert.equal(challengeMet(state), true);
  state.battleStats!.player.lost = 1;
  assert.equal(challengeMet(state), false);
});
