import type { WeatherId } from '../game/regionRules';
import { baseLevelReward, type BattleReward } from '../meta/economy';
import { REGIONS, LEVEL_COUNT, type Region } from './levels';
import type { Difficulty } from './battleSetup';

// The daily challenge: one quick battle a day on the same battlefield for everyone - the same map,
// region, weather and difficulty, picked from the date - against a rival kingdom at each player's own
// card level (like any quick battle, so it is fair at every stage; a link can't pick a weaker one).
// Winning it the first time that day pays a reward that grows with the days won in a row.
//
// Days are UTC dates ('2026-10-10'), so every player gets the same battle at the same moment.

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
export const todayKey = (now = new Date()) => dayKey(now);

export const isDayKey = (value: unknown): value is string =>
  typeof value === 'string' && DAY_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  dayKey(new Date(`${value}T00:00:00Z`)) === value;

// The day before (or after, for a negative count) a day
export const shiftDay = (key: string, days: number) => dayKey(new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS));

// Milliseconds until the next day's challenge
export const msUntilNextDay = (now = new Date()) => Date.parse(`${shiftDay(dayKey(now), 1)}T00:00:00Z`) - now.getTime();

// A whole number from the date that fits a battle's seed (below 2^31), well mixed so one day's map
// looks nothing like the next
const hashDay = (key: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) % 2147483647;
};

export const dailySeed = (key: string) => hashDay(key, 0);

// Easier on Mondays, hardest at the weekend (easy battles have no fog of war)
const WEEK: Difficulty[] = ['hard', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard'];
export const dailyDifficulty = (key: string): Difficulty => WEEK[new Date(`${key}T00:00:00Z`).getUTCDay()];

// The region the day's battle is fought in: its ground and its weather
export const dailyRegion = (key: string): Region => REGIONS[hashDay(key, 1) % REGIONS.length];
export const dailyWeather = (key: string): WeatherId | undefined => dailyRegion(key).weather;

// --- Reward and streak -----------------------------------------------------------------------

// Each day won in a row adds a tenth to the reward, up to this many days
export const MAX_STREAK_BONUS_DAYS = 7;
const STREAK_BONUS = 0.1;

// The first win of a day pays as much as clearing the next campaign level, more for a streak
export const dailyReward = (highestCleared: number, streak: number): BattleReward => {
  const base = baseLevelReward(Math.min(LEVEL_COUNT, highestCleared + 1));
  const breakdown = [{ label: 'Daily challenge', coins: base }];
  const bonusDays = Math.min(MAX_STREAK_BONUS_DAYS, streak) - 1;
  if (bonusDays > 0) breakdown.push({ label: `${streak}-day streak`, coins: Math.round(base * STREAK_BONUS * bonusDays) });
  return { coins: breakdown.reduce((sum, line) => sum + line.coins, 0), breakdown };
};

export interface DailyRecord {
  // The last day whose challenge was won (its reward paid)
  lastWon?: string;
  // Days won in a row, up to lastWon
  streak: number;
  bestStreak: number;
  // Daily challenges won in all
  wins: number;
}

export const emptyDaily = (): DailyRecord => ({ streak: 0, bestStreak: 0, wins: 0 });

// The streak as it stands today: kept while yesterday's (or today's) challenge was won
export const currentStreak = (record: DailyRecord, today = todayKey()) =>
  record.lastWon && (record.lastWon === today || record.lastWon === shiftDay(today, -1)) ? record.streak : 0;

export const wonToday = (record: DailyRecord, today = todayKey()) => record.lastWon === today;

// Whether a win of `day`'s challenge pays: it hasn't been won yet, and it is today's - or yesterday's
// for a battle begun yesterday, before midnight (`startedOn`), not one begun since
export const dailyRewardDue = (record: DailyRecord, day: string, today = todayKey(), startedOn?: string) =>
  (startedOn === day || (startedOn === undefined && day === today)) &&
  (day === today || day === shiftDay(today, -1)) && (!record.lastWon || record.lastWon < day);

// The record after winning `day`'s challenge
export const recordDailyWin = (record: DailyRecord, day: string): DailyRecord => {
  const streak = record.lastWon === shiftDay(day, -1) ? record.streak + 1 : 1;
  return { lastWon: day, streak, bestStreak: Math.max(record.bestStreak, streak), wins: record.wins + 1 };
};
