// Tests for battle addresses: a friend's challenge link must bring back the same quick battle.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battlePath, challengePath, quickBattleFromParams, sameBattle } from './GameStorage';

const paramsOf = (path: string) => new URL(path, 'https://example.com').searchParams;

test('a challenge link round-trips: difficulty, map, rival and the score to beat', () => {
  const path = challengePath('hard', 987654, 6, { score: 142, won: true });
  assert.deepEqual(quickBattleFromParams(paramsOf(path)), {
    mode: 'quick', difficulty: 'hard', seed: 987654, rivalLevel: 6, challenge: { score: 142, won: true }
  });
  const lost = quickBattleFromParams(paramsOf(challengePath('easy', 1, 1, { score: 0, won: false })));
  assert.deepEqual(lost.challenge, { score: 0, won: false });
});

test('a plain quick battle link is unchanged', () => {
  assert.equal(battlePath({ mode: 'quick', difficulty: 'medium' }), '/play?mode=quick&difficulty=medium');
  assert.deepEqual(quickBattleFromParams(paramsOf('/play?mode=quick&difficulty=medium')), { mode: 'quick', difficulty: 'medium' });
});

test('a mangled link falls back to sensible values', () => {
  const config = quickBattleFromParams(paramsOf('/play?mode=quick&difficulty=impossible&seed=-5&rival=abc&score=1e9'));
  assert.deepEqual(config, { mode: 'quick', difficulty: 'medium' });
  // (a score without a map to fight it on means nothing)
  assert.equal(quickBattleFromParams(paramsOf('/play?mode=quick&difficulty=easy&score=50')).challenge, undefined);
  assert.equal(quickBattleFromParams(paramsOf('/play?mode=quick&difficulty=easy&seed=3&rival=40')).rivalLevel, 15);
});

test('a saved battle resumes only for the same map', () => {
  assert.ok(sameBattle({ mode: 'quick', difficulty: 'hard', seed: 5 }, { mode: 'quick', difficulty: 'hard', seed: 5, challenge: { score: 3, won: true } }));
  assert.ok(!sameBattle({ mode: 'quick', difficulty: 'hard', seed: 5 }, { mode: 'quick', difficulty: 'hard', seed: 6 }));
  assert.ok(sameBattle({ mode: 'quick', difficulty: 'hard' }, { mode: 'quick', difficulty: 'hard' }), 'saves from before seeds still resume');
});
