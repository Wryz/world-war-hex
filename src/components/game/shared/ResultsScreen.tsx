import React, { useEffect, useRef, useState } from 'react';
import { SideStats, WinReason } from '@/types/game';
import type { LevelDef } from '@/lib/campaign/levels';
import { starThresholds } from '@/lib/campaign/levels';
import { getProfile, grantBonusCoins, type BattleRecordResult } from '@/lib/meta/profile';
import { challengeBonus, levelChallenge } from '@/lib/campaign/challenges';
import { adBonusCoins } from '@/lib/meta/economy';
import { useRewardedAd } from '@/lib/ads';
import { TROOPS } from '@/lib/game/troops';
import { playStinger } from '@/lib/audio/music';
import { SPEED_POINTS_PER_ROUND, StarScore, TIME_SCORE_WEIGHTS } from '@/lib/game/gameState';
import { TroopCard } from '../cards/TroopCard';
import { emitCoins } from '../effects/effects';
import {
  ArrowIcon, CardsIcon, CoinIcon, FilledStarIcon, LaurelIcon, MapIcon, MedalIcon, PlayIcon, PowerIcon, ResumeIcon, ShareIcon, SkullIcon, StarIcon
} from '../icons';

interface ResultsScreenProps {
  won: boolean;
  reason?: WinReason;
  level?: LevelDef;
  stars: number;
  record: BattleRecordResult;
  rounds: number;
  stats: SideStats;
  durationSeconds: number;
  // Coins after this battle's reward
  coinsTotal: number;
  power: number;
  onNext?: () => void;
  onRetry: () => void;
  onMap: () => void;
  onArmy: () => void;
  // Each side's points: kills, gold and camps (which decide a battle when time runs out) and the
  // speed bonus (which counts towards stars)
  points?: { you: StarScore; enemy: StarScore };
  // The level's optional challenge was met this battle
  challengeMet?: boolean;
}

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;

// Count a number up from zero
const useCountUp = (target: number, durationMs: number, delayMs: number) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delayMs;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, delayMs]);
  return value;
};

const STAR_DELAY = 450;

// Your points on a bar, with the second and third stars marked where they are earned
const StarProgress: React.FC<{ level: LevelDef; points: number; won: boolean }> = ({ level, points, won }) => {
  const [two, three] = starThresholds(level);
  const top = Math.round(three * 1.25);
  const at = (value: number) => `${Math.min(100, (value / top) * 100)}%`;
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => setFilled(points), 300);
    return () => clearTimeout(timeout);
  }, [points]);
  return (
    <div className="mx-auto mt-4 max-w-md">
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-bold text-slate-300">Points</span>
        <span className="font-display text-xl text-amber-300">{points}</span>
      </div>
      <div className="relative h-4 rounded-full bg-slate-700">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: at(filled), background: won ? '#f59e0b' : '#64748b' }}
        />
        {[{ value: two, stars: 2 }, { value: three, stars: 3 }].map(mark => {
          const reached = won && points >= mark.value;
          return (
            <div key={mark.stars} className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center" style={{ left: at(mark.value) }}>
              <span className="h-7 w-1 rounded-full bg-slate-900/80" />
              <span className={`mt-1 flex items-center gap-0.5 whitespace-nowrap text-sm font-bold ${reached ? 'text-amber-300' : 'text-slate-400'}`}>
                {Array.from({ length: mark.stars }, (_, i) => reached ? <FilledStarIcon key={i} /> : <StarIcon key={i} color="#64748b" />)}
                <span className="ml-0.5 tabular-nums">{mark.value}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-9 text-center text-sm text-slate-400">
        {won ? 'Kills, gold, camps and a bonus for every round left.' : 'Win the battle to earn stars.'}
      </p>
    </div>
  );
};

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  won, reason, level, stars, record, rounds, stats, durationSeconds, coinsTotal, power, onNext, onRetry, onMap, onArmy, points, challengeMet
}) => {
  const rewardDelay = won ? 600 + stars * STAR_DELAY : 600;
  const coins = useCountUp(record.reward.coins, 900, rewardDelay);
  const [copied, setCopied] = useState(false);
  const rewardRef = useRef<HTMLDivElement>(null);

  // An optional ad adds a coin bonus (only offered when an ad is ready, and once per battle)
  const bonus = adBonusCoins(record.reward);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const rewardedAd = useRewardedAd('battle_bonus', () => {
    grantBonusCoins(bonus);
    setBonusClaimed(true);
    const rect = rewardRef.current?.getBoundingClientRect();
    if (rect) emitCoins({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, Math.min(14, 4 + Math.round(bonus / 20)), 'coins');
  });
  // The purse as the screen opened (the profile already has this battle's reward, but not a bonus yet)
  const [startTotal] = useState(coinsTotal);
  const shownTotal = startTotal - record.reward.coins + coins + (bonusClaimed ? bonus : 0);

  // Stars stamp in one by one, then the coins fly into the purse
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    if (won) {
      for (let i = 0; i < stars; i++) timeouts.push(setTimeout(() => playStinger('star'), 600 + i * STAR_DELAY));
    }
    timeouts.push(setTimeout(() => {
      const rect = rewardRef.current?.getBoundingClientRect();
      if (rect) emitCoins({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, Math.min(14, 4 + Math.round(record.reward.coins / 20)), 'coins');
    }, rewardDelay));
    if (record.newCards.length > 0) timeouts.push(setTimeout(() => playStinger('unlock'), rewardDelay + 900));
    return () => timeouts.forEach(clearTimeout);
  }, [won, stars, record, rewardDelay]);

  const share = async () => {
    const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const text = level
      ? `⚔️ Hex Hordes - Level ${level.id}: ${level.name}\n${won ? `Victory ${starText} in ${rounds} rounds` : `Defeated after ${rounds} rounds`} · ${stats.kills} foes slain\nCan you beat it?`
      : `⚔️ Hex Hordes - Skirmish ${won ? 'won' : 'lost'} in ${rounds} rounds · ${stats.kills} foes slain`;
    try {
      if (navigator.share) await navigator.share({ title: 'Hex Hordes', text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
        setCopied(true);
      }
    } catch {
      // Sharing was cancelled
    }
  };

  const title = won ? 'Victory!' : 'Defeat';
  const subtitle = won
    ? reason === 'timeout' ? 'Time ran out - you win on points.' : 'The enemy castle has fallen!'
    : reason === 'timeout' ? 'Time ran out - the enemy wins on points.' : 'Your castle has fallen.';

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/65 px-3 py-6 backdrop-blur-[2px] sm:items-center">
      <div className="animate-fadeIn w-full max-w-xl rounded-2xl bg-slate-900/95 p-5 text-slate-100 shadow-2xl ring-1 ring-white/10 sm:p-6">
        {/* Header */}
        <div className="text-center">
          {level && (
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Level {level.id} · {level.name}
            </div>
          )}
          <h1
            className={`font-display mt-1 flex items-center justify-center gap-2 text-5xl ${won ? 'text-amber-300' : 'text-red-400'}`}
            style={{ WebkitTextStroke: '2px #0f172a', paintOrder: 'stroke fill', textShadow: '0 4px 0 #0f172a' }}
          >
            {won ? <LaurelIcon /> : <SkullIcon color="#f87171" />} {title}
          </h1>
          <p className="mt-1 text-base text-slate-200">{subtitle}</p>
        </div>

        {/* Stars */}
        {level && (
          <div className="mt-4 flex items-end justify-center gap-3">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className={`${i < stars && won ? 'star-stamp' : 'opacity-25'} ${i === 1 ? 'text-6xl' : 'text-5xl'}`}
                style={i < stars && won ? { animationDelay: `${600 + i * STAR_DELAY}ms` } : undefined}
              >
                {i < stars && won
                  ? <FilledStarIcon className="drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]" />
                  : <StarIcon color="#475569" />}
              </span>
            ))}
          </div>
        )}
        {/* Points towards the stars: a bar with the second and third stars marked on it */}
        {level && points && <StarProgress level={level} points={points.you.total} won={won} />}

        {/* When time ran out, the points that decided it */}
        {reason === 'timeout' && points && (
          <div className="mt-4 rounded-xl bg-slate-800 p-3 text-base">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-1">
              <span />
              <span className="text-right text-sm font-bold uppercase tracking-widest text-sky-300">You</span>
              <span className="text-right text-sm font-bold uppercase tracking-widest text-rose-300">Enemy</span>
              {([
                ['Kills', 'kills', `Gold value of enemy troops destroyed (x${TIME_SCORE_WEIGHTS.kills})`],
                ['Gold', 'gold', `Gold earned in the battle (x${TIME_SCORE_WEIGHTS.gold})`],
                ['Camps', 'camps', `${TIME_SCORE_WEIGHTS.camps} per camp held at the end`],
                ['Speed', 'speed', `${SPEED_POINTS_PER_ROUND} for every round left (counts for stars, not when time runs out)`]
              ] as const).map(([label, field, detail]) => (
                <React.Fragment key={field}>
                  <span className="text-slate-300" title={detail}>{label}</span>
                  <span className="text-right tabular-nums">{points.you[field]}</span>
                  <span className="text-right tabular-nums">{points.enemy[field]}</span>
                </React.Fragment>
              ))}
              <span className="font-display border-t border-white/10 pt-1">Points</span>
              <span className={`font-display border-t border-white/10 pt-1 text-right tabular-nums ${points.you.total >= points.enemy.total ? 'text-amber-300' : ''}`}>{points.you.total}</span>
              <span className={`font-display border-t border-white/10 pt-1 text-right tabular-nums ${points.enemy.total > points.you.total ? 'text-amber-300' : ''}`}>{points.enemy.total}</span>
            </div>
          </div>
        )}

        {/* The level's optional challenge */}
        {level && levelChallenge(level) && (() => {
          const challenge = levelChallenge(level)!;
          const doneBefore = !record.challengeCompleted && !!getProfile().levels[level.id]?.challenge && !challengeMet;
          return (
            <div
              className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${record.challengeCompleted ? 'challenge-complete bg-amber-500/20 ring-2 ring-amber-400' : 'bg-slate-800'}`}
              title={challenge.description}
            >
              <MedalIcon className={`text-2xl ${record.challengeCompleted || challengeMet ? '' : 'opacity-40 grayscale'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Challenge</div>
                <div className="font-bold text-slate-100">{challenge.description}</div>
              </div>
              <span className={`font-display shrink-0 text-base ${record.challengeCompleted ? 'text-amber-300' : challengeMet || doneBefore ? 'text-emerald-300' : 'text-slate-400'}`}>
                {record.challengeCompleted ? <span className="flex items-center gap-1"><CoinIcon />+{challengeBonus(level.id)}</span>
                  : challengeMet ? 'Done again!' : doneBefore ? 'Done before' : 'Missed'}
              </span>
            </div>
          );
        })()}

        {/* Reward */}
        <div ref={rewardRef} className="mt-4 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Reward</div>
            <div className="font-display flex items-center gap-1.5 text-3xl text-yellow-300"><CoinIcon />+{coins + (bonusClaimed ? bonus : 0)}</div>
            <div className="text-sm text-slate-300">
              {[...record.reward.breakdown, ...(bonusClaimed ? [{ label: 'Ad bonus', coins: bonus }] : [])]
                .map(item => `${item.label} ${item.coins}`).join(' · ')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Your coins</div>
            <div id="hud-coins" className="font-display flex items-center justify-end gap-1 text-xl text-yellow-200"><CoinIcon />{shownTotal}</div>
          </div>
        </div>

        {rewardedAd.ready && !bonusClaimed && (
          <button
            onClick={rewardedAd.show}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold shadow-[0_4px_0_#047857] transition-transform hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-1"
          >
            <PlayIcon /> Watch an ad for +{bonus} <CoinIcon />
          </button>
        )}

        {/* Battle stats */}
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ['Slain', stats.kills],
            ['Lost', stats.lost],
            ['Rounds', rounds],
            ['Time', formatDuration(durationSeconds)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-800/70 py-1.5">
              <div className="font-display text-xl">{value}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        {/* Discoveries and unlocks */}
        {record.discovered.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300">New in the Bestiary!</div>
            <div className="flex flex-wrap gap-2.5">
              {record.discovered.slice(0, 4).map(id => <TroopCard key={id} type={id} size="md" hideLevel />)}
            </div>
          </div>
        )}
        {record.newCards.length > 0 && (
          <div className="mt-3 rounded-xl bg-purple-900/80 px-3 py-2 text-sm font-bold">
            New card in the shop: {record.newCards.map(id => TROOPS[id].name).join(', ')}!
          </div>
        )}
        {!won && level && power < level.recommendedPower && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300">
            <PowerIcon className="text-base" />
            Your army&apos;s power is {power}; this level recommends {level.recommendedPower}. Upgrade your cards in the Army.
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2">
          {won && onNext ? (
            <button
              onClick={onNext}
              className="font-display rounded-xl bg-amber-500 px-6 py-3 text-xl text-slate-900 shadow-[0_5px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-1"
            >
              <span className="inline-flex items-center gap-2">Next Level <ArrowIcon /></span>
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="font-display rounded-xl bg-amber-500 px-6 py-3 text-xl text-slate-900 shadow-[0_5px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-1"
            >
              <span className="inline-flex items-center gap-2"><ResumeIcon /> {won ? 'Play Again' : 'Try Again'}</span>
            </button>
          )}
          <div className={`grid gap-2 ${won && onNext ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {won && onNext && (
              <button onClick={onRetry} className="rounded-xl bg-slate-700 px-2 py-2 text-sm font-bold hover:bg-slate-600">
                <span className="inline-flex items-center gap-1"><ResumeIcon /> Replay</span>
              </button>
            )}
            <button onClick={onArmy} className="rounded-xl bg-slate-700 px-2 py-2 text-sm font-bold hover:bg-slate-600">
              <span className="inline-flex items-center gap-1"><CardsIcon /> Army</span>
            </button>
            <button onClick={onMap} className="rounded-xl bg-slate-700 px-2 py-2 text-sm font-bold hover:bg-slate-600">
              <span className="inline-flex items-center gap-1"><MapIcon /> {level ? 'Map' : 'Menu'}</span>
            </button>
            <button onClick={share} className="rounded-xl bg-slate-700 px-2 py-2 text-sm font-bold hover:bg-slate-600">
              <span className="inline-flex items-center gap-1"><ShareIcon /> {copied ? 'Copied!' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
