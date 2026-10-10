import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  currentStreak, dailyDifficulty, dailyRegion, dailyReward, msUntilNextDay, todayKey, wonToday
} from '@/lib/campaign/daily';
import { WEATHER } from '@/lib/game/regionRules';
import { highestCleared, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { dailyPath } from '../game/storage/GameStorage';
import { CARD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from './MenuShell';
import { CalendarIcon, CheckIcon, CoinIcon, FireIcon, LockIcon } from '../game/icons';

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

const formatWait = (ms: number) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};

// Today's daily challenge on the main menu: where it's fought, the reward or that it's won, and the
// streak of days won in a row
export const DailyChallengeCard: React.FC = () => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  // The clock, read in the browser only (so the server render matches) and every minute after, so
  // the card turns over at midnight UTC
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  if (!hydrated || !now) return <div className={`${CARD_CLASS} mt-4 h-[7.5rem] max-w-2xl opacity-60`} aria-hidden />;

  const today = todayKey(now);
  const region = dailyRegion(today);
  const weather = region.weather ? WEATHER[region.weather].name : 'Clear skies';
  const done = wonToday(profile.daily, today);
  const streak = currentStreak(profile.daily, today);
  // (winning today makes the streak one longer, and the reward with it)
  const reward = dailyReward(highestCleared(profile), streak + 1).coins;
  const locked = !profile.tutorialDone;

  return (
    <div className={`${CARD_CLASS} mt-4 max-w-2xl p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-4xl"><CalendarIcon /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold uppercase tracking-widest text-slate-300">Daily Challenge</div>
          <div className="font-display text-2xl leading-tight">{region.name}</div>
          <div className="text-sm text-slate-300">
            {weather} · {DIFFICULTY_LABEL[dailyDifficulty(today)]} · the same battlefield for everyone today
          </div>
        </div>
        <div
          className={`font-display flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xl ${streak > 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-800 text-slate-400'}`}
          title={`Days won in a row (best ${profile.daily.bestStreak})`}
        >
          <FireIcon /> {streak}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {locked ? (
          <span className="flex items-center gap-1.5 text-sm text-slate-300"><LockIcon /> Win your first battle to unlock the daily challenge.</span>
        ) : (
          <>
            <Link href={dailyPath(today)} className={`${done ? SECONDARY_BUTTON : PRIMARY_BUTTON} px-5 py-2 text-center text-lg`}>
              {done ? 'Play again' : 'Play today’s battle'}
            </Link>
            <span className="text-sm text-slate-300">
              {done
                ? <span className="flex items-center gap-1 text-emerald-300"><CheckIcon /> Won today · next in {formatWait(msUntilNextDay(now))}</span>
                : <span className="flex items-center gap-1">Win for <CoinIcon /> <b className="text-yellow-300">{reward}</b>{streak > 0 && ` · keep your ${streak}-day streak`}</span>}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
