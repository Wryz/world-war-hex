// Tests for the daily challenge. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentStreak, dailyDifficulty, dailyRegion, dailyReward, dailyRewardDue, dailySeed, emptyDaily, isDayKey, msUntilNextDay,
  recordDailyWin, shiftDay, todayKey
} from './daily';
import { buildBattle, dailyBattle } from './battleSetup';
import { battlePath, dailyPath, quickBattleFromParams, sameBattle } from '../../components/game/storage/GameStorage';
import { createProfile, sanitizeProfile } from '../meta/profile';

test('days are UTC dates, and only real ones count', () => {
  assert.equal(todayKey(new Date('2026-10-10T23:59:59Z')), '2026-10-10');
  assert.equal(todayKey(new Date('2026-10-11T00:00:00Z')), '2026-10-11');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(msUntilNextDay(new Date('2026-10-10T23:00:00Z')), 60 * 60 * 1000);
  assert.ok(isDayKey('2026-10-10'));
  for (const bad of ['2026-02-30', '2026-1-1', '10/10/2026', '', null, 20261010]) assert.equal(isDayKey(bad), false, String(bad));
});

test('every player gets the same battle on the same day, and a different one the next', () => {
  assert.equal(dailySeed('2026-10-10'), dailySeed('2026-10-10'));
  assert.notEqual(dailySeed('2026-10-10'), dailySeed('2026-10-11'));
  const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailySeed(shiftDay('2026-01-01', i))));
  assert.equal(seeds.size, 60);
  for (let i = 0; i < 7; i++) {
    const day = shiftDay('2026-10-05', i);
    assert.ok(dailySeed(day) >= 0 && dailySeed(day) < 2 ** 31);
    assert.ok(['easy', 'medium', 'hard'].includes(dailyDifficulty(day)));
  }
  // (a Monday is easy, a Saturday hard)
  assert.equal(dailyDifficulty('2026-10-05'), 'easy');
  assert.equal(dailyDifficulty('2026-10-10'), 'hard');

  const profile = createProfile();
  const a = buildBattle(dailyBattle('2026-10-10'), profile);
  const b = buildBattle(dailyBattle('2026-10-10'), profile);
  assert.deepEqual(a.hexGrid.map(hex => hex.terrain), b.hexGrid.map(hex => hex.terrain));
  assert.deepEqual(Object.keys(a.rosters!.ai), Object.keys(b.rosters!.ai));
  assert.equal(a.settings!.themeName, dailyRegion('2026-10-10').theme);
  assert.equal(a.settings!.weather, dailyRegion('2026-10-10').weather);
});

test('a daily challenge link round-trips, with or without a score to beat', () => {
  const plain = quickBattleFromParams(new URLSearchParams(dailyPath('2026-10-10').split('?')[1]));
  assert.deepEqual(plain, dailyBattle('2026-10-10'));
  const shared = quickBattleFromParams(new URLSearchParams(dailyPath('2026-10-10', { score: 120, won: true }).split('?')[1]));
  assert.deepEqual(shared.challenge, { score: 120, won: true });
  assert.ok(sameBattle(plain, shared));
  assert.ok(!sameBattle(plain, dailyBattle('2026-10-11')));
  assert.ok(battlePath(plain).includes('daily=2026-10-10'));
  // (a date that isn't one is an ordinary quick battle)
  assert.equal(quickBattleFromParams(new URLSearchParams('mode=quick&daily=2026-13-01')).daily, undefined);
});

test('the reward is paid once a day, and grows with the streak', () => {
  let record = emptyDaily();
  assert.ok(dailyRewardDue(record, '2026-10-10', '2026-10-10'));
  record = recordDailyWin(record, '2026-10-10');
  assert.equal(record.streak, 1);
  assert.equal(dailyRewardDue(record, '2026-10-10', '2026-10-10'), false, 'once a day');
  // (a battle begun before midnight still pays the next morning; older days don't)
  assert.ok(dailyRewardDue(record, '2026-10-11', '2026-10-12'));
  assert.equal(dailyRewardDue(record, '2026-10-11', '2026-10-13'), false);
  assert.equal(dailyRewardDue(record, '2026-10-12', '2026-10-11'), false, 'not ahead of the date');

  record = recordDailyWin(record, '2026-10-11');
  assert.equal(record.streak, 2);
  assert.equal(currentStreak(record, '2026-10-12'), 2, 'kept until the next day is over');
  assert.equal(currentStreak(record, '2026-10-13'), 0, 'broken after a day missed');
  record = recordDailyWin(record, '2026-10-13');
  assert.equal(record.streak, 1);
  assert.equal(record.bestStreak, 2);
  assert.equal(record.wins, 3);

  assert.ok(dailyReward(10, 3).coins > dailyReward(10, 1).coins);
  assert.equal(dailyReward(10, 30).coins, dailyReward(10, 7).coins, 'the streak bonus stops growing');
});

test('a save can\'t claim a daily streak it never made', () => {
  const clean = sanitizeProfile({ version: 1, daily: { lastWon: '2026-10-10', streak: 3, bestStreak: 5, wins: 9 } })!;
  assert.deepEqual(clean.daily, { lastWon: '2026-10-10', streak: 3, bestStreak: 5, wins: 9 });
  const forged = sanitizeProfile({ version: 1, daily: { lastWon: 'tomorrow', streak: 1e9, bestStreak: 1e9, wins: 2 } })!;
  assert.equal(forged.daily.lastWon, undefined);
  assert.equal(forged.daily.streak, 0);
  assert.ok(forged.daily.bestStreak <= 2);
  assert.deepEqual(sanitizeProfile({ version: 1 })!.daily, emptyDaily());
});

test('winning today\'s challenge pays its reward once and starts a streak; losing it pays only the skirmish', async () => {
  // (progress is saved to the browser's storage: a stand-in here)
  const stored = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) } });
  const { recordBattle, getProfile } = await import('../meta/profile');
  const { makeBattle } = await import('../game/testUtils');
  const playerStats = makeBattle('player').state.battleStats!.player;
  const outcome = { mode: 'quick' as const, stars: 0, rounds: 8, enemyCastleDamage: 1, playerStats, durationSeconds: 300, daily: todayKey() };

  const lost = recordBattle({ ...outcome, won: false });
  assert.equal(lost.dailyStreak, undefined);
  assert.ok(!lost.reward.breakdown.some(line => line.label === 'Daily challenge'));

  const won = recordBattle({ ...outcome, won: true });
  assert.equal(won.dailyStreak, 1);
  assert.ok(won.reward.breakdown.some(line => line.label === 'Daily challenge'));
  assert.equal(getProfile().daily.lastWon, todayKey());

  const again = recordBattle({ ...outcome, won: true });
  assert.equal(again.dailyStreak, undefined, 'paid once a day');
  assert.equal(getProfile().daily.wins, 1);
});
