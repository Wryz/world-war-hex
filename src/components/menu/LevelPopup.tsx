import React, { useEffect, useRef } from 'react';
import { LevelDef, levelEnemies } from '@/lib/campaign/levels';
import { challengeBonus, levelChallenge } from '@/lib/campaign/challenges';
import { levelDeck } from '@/lib/campaign/battleSetup';
import { WEATHER } from '@/lib/game/regionRules';
import { FACTIONS, TROOPS } from '@/lib/game/troops';
import { deckPower, levelWinReward } from '@/lib/meta/economy';
import { useProfile } from '@/lib/meta/profile';
import { CARD_CLASS, PRIMARY_BUTTON } from './MenuShell';
import { AttackIcon, BossIcon, CoinIcon, FogIcon, MedalIcon, PowerIcon, ShieldIcon, UnitIcon, WeatherIcon } from '../game/icons';

// How the power of the cards you'd bring compares with what the level recommends
const verdictFor = (ratio: number) =>
  ratio >= 1.15 ? { label: 'Favourable', color: '#4ade80' }
    : ratio >= 0.97 ? { label: 'Even fight', color: '#facc15' }
      : ratio >= 0.85 ? { label: 'Tough fight', color: '#fb923c' }
        : { label: 'Very dangerous', color: '#f87171' };

// What to know about a level, in a callout from its spot on the map: the enemy, your power against
// the recommended, the weather, the optional challenge and the reward - and the button to fight it.
// Tapping anywhere else closes it.
export const LevelPopup: React.FC<{ level: LevelDef; onFight: () => void; onClose: () => void }> = ({ level, onFight, onClose }) => {
  const profile = useProfile();
  const ref = useRef<HTMLDivElement>(null);
  const power = deckPower(levelDeck(level, profile), profile.cards, profile.trees);
  const verdict = verdictFor(power / level.recommendedPower);
  const record = profile.levels[level.id];
  const challenge = levelChallenge(level);
  const reward = levelWinReward(level.id, 3, record?.stars ?? 0).coins;
  const weather = level.settings.weather;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      // (another level's spot picks that level instead)
      if (ref.current?.contains(target) || target?.closest?.('[data-level]')) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={`${CARD_CLASS} animate-fadeIn p-3 text-left`} role="dialog" aria-label={`Level ${level.id}: ${level.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">
          Level {level.id} · {level.settings.maxRounds} rounds
        </div>
        {/* What winning pays (up to) */}
        <span className="flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-widest text-slate-400" title={record?.stars ? 'Replay reward, up to' : 'Reward, up to'}>
          Win <span className="font-display flex items-center gap-0.5 text-base normal-case tracking-normal text-yellow-300"><CoinIcon />{reward}</span>
        </span>
      </div>
      <div className="font-display flex items-center gap-1.5 text-xl leading-tight text-slate-50">
        {level.isBoss && <BossIcon />}{level.isElite && <ShieldIcon color="#a78bfa" />}{level.name}
      </div>

      {/* The enemy (troops not met yet stay a mystery) */}
      <div className="mt-1.5 text-xs font-bold" style={{ color: FACTIONS[level.region.faction].color }}>{FACTIONS[level.region.faction].title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5" aria-label="Enemies">
        {levelEnemies(level).map(id => {
          const known = (profile.bestiary[id]?.seen ?? 0) > 0 || level.guards.some(guard => guard.type === id) || TROOPS[id].isBoss;
          return (
            <span key={id} title={known ? TROOPS[id].name : 'Not yet seen'}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-lg ring-1 ring-white/10">
              {known ? <UnitIcon type={id} /> : <span className="font-display text-slate-500">?</span>}
            </span>
          );
        })}
        {weather && <span className="ml-auto flex items-center gap-1 text-xs font-bold text-slate-200" title={WEATHER[weather].description}><WeatherIcon weather={weather} /> {WEATHER[weather].name}</span>}
        {level.settings.fogOfWar && <span className={`${weather ? '' : 'ml-auto'} flex items-center gap-1 text-xs font-bold text-slate-200`} title="You only see what your troops can see"><FogIcon /> Fog</span>}
      </div>

      {/* Your power against the recommended */}
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs">
        <span className="flex items-center gap-1 font-bold" title="The power of the four cards you bring"><PowerIcon /> {power} <span className="font-normal text-slate-400">/ {level.recommendedPower}</span></span>
        <span className="font-display text-sm" style={{ color: verdict.color }}>{verdict.label}</span>
      </div>

      {challenge && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-300" title="An optional harder way to win, for a bonus the first time">
          <MedalIcon className={record?.challenge ? '' : 'opacity-50 grayscale'} />
          <span className="flex-1">{challenge.description}</span>
          {record?.challenge
            ? <span className="font-bold text-emerald-300">Done</span>
            : <span className="flex items-center gap-0.5 font-bold text-yellow-300">+<CoinIcon />{challengeBonus(level.id)}</span>}
        </div>
      )}

      <button onClick={onFight} className={`${PRIMARY_BUTTON} mt-3 flex w-full items-center justify-center gap-2 py-2 text-lg`} autoFocus>
        <AttackIcon color="currentColor" /> Fight!
      </button>
    </div>
  );
};
