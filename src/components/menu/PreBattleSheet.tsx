import React from 'react';
import Link from 'next/link';
import { LevelDef, levelEnemies, starGoals, enemyRosterStats } from '@/lib/campaign/levels';
import { ALL_THEMES } from '@/lib/game/mapGenerator';
import { FACTIONS, TROOPS, scaleTroop } from '@/lib/game/troops';
import { TERRAIN_EFFECTS } from '@/lib/game/gameState';
import { MAX_DECK_SIZE, levelWinReward } from '@/lib/meta/economy';
import { profilePower, setDeck, toggleDeckCard, useProfile } from '@/lib/meta/profile';
import { matchupScore, suggestLoadout } from '@/lib/meta/loadout';
import { trackEvent } from '@/lib/analytics';
import { PLAYER_CARD_IDS, TroopId } from '@/lib/game/troops';
import { TroopCard } from '../game/cards/TroopCard';
import { BondList } from '../game/cards/BondList';
import { activeBonds } from '@/lib/game/bonds';
import { CARD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from './MenuShell';
import {
  AttackIcon, BossIcon, CardsIcon, CloseIcon, CoinIcon, PowerIcon, ShieldIcon, StarIcon, TerrainIcon, BondIcon
} from '../game/icons';
import { TerrainType } from '@/types/game';

interface PreBattleSheetProps {
  level: LevelDef;
  onFight: () => void;
  onClose: () => void;
}

// How the player's power compares with what the level recommends
const verdictFor = (ratio: number) =>
  ratio >= 1.15 ? { label: 'Favourable', color: '#4ade80' }
    : ratio >= 0.97 ? { label: 'Even fight', color: '#facc15' }
      : ratio >= 0.85 ? { label: 'Tough fight', color: '#fb923c' }
        : { label: 'Very dangerous', color: '#f87171' };

// Terrain that appears on a map theme
const themeTerrain = (themeName: string): TerrainType[] => {
  const theme = ALL_THEMES.find(t => t.name === themeName);
  if (!theme) return [];
  const bands = [...theme.lowlands, ...theme.highlands, ...theme.wet, ...theme.dry].map(([terrain]) => terrain);
  return [...new Set<TerrainType>(['plain', ...bands, ...(theme.springs > 0 ? ['spring' as const] : []), 'resource'])];
};

// Pick the four cards to bring: tap a card to bring it or leave it behind. Cards that counter this
// level's enemies are marked, and Auto-pick chooses a strong set against them.
const LoadoutPicker: React.FC<{ enemies: TroopId[] }> = ({ enemies }) => {
  const profile = useProfile();
  const owned = PLAYER_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  const isFull = profile.deck.length >= MAX_DECK_SIZE;
  const bonds = activeBonds(profile.deck);

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
          <CardsIcon /> Your cards {profile.deck.length}/{MAX_DECK_SIZE}
        </span>
        <button
          onClick={() => {
            const deck = suggestLoadout(profile.cards, enemies);
            setDeck(deck);
            trackEvent('loadout_auto_picked', { deck });
          }}
          className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-sky-500"
        >
          Auto-pick
        </button>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">
        {isFull ? 'Tap a card to leave it behind, then pick another.' : 'Tap cards to bring them into battle.'}
        {' '}<span className="font-bold text-emerald-300">Good pick</span> cards counter this enemy, and
        {' '}<span className="font-bold text-amber-300">bonded</span> cards fight better together.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {owned.map(id => {
          const inDeck = profile.deck.includes(id);
          const matchup = matchupScore(id, enemies);
          const bonded = inDeck && bonds.some(bond => bond.cards.includes(id));
          return (
            <div key={id} className="relative">
              <TroopCard
                type={id}
                level={profile.cards[id]}
                size="xs"
                selected={inDeck}
                disabled={!inDeck && isFull}
                onClick={() => toggleDeckCard(id)}
                title={inDeck ? 'Bringing this card - tap to leave it behind' : isFull ? 'Your hand is full - leave a card behind first' : 'Tap to bring this card'}
              />
              {bonded && (
                <span className="pointer-events-none absolute -left-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 shadow ring-1 ring-amber-300" title="Part of a bond">
                  <BondIcon className="text-sm" />
                </span>
              )}
              {matchup > 0.05 && (
                <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-1.5 text-[9px] font-bold text-slate-900 shadow">
                  Good pick
                </span>
              )}
              {matchup < -0.05 && (
                <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white shadow">
                  Weak here
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <BondList deck={profile.deck} owned={owned} />
      </div>
    </div>
  );
};

// Everything to know before a campaign battle: the enemy, the map, the recommended power and the rewards
export const PreBattleSheet: React.FC<PreBattleSheetProps> = ({ level, onFight, onClose }) => {
  const profile = useProfile();
  const power = profilePower(profile);
  const ratio = power / level.recommendedPower;
  const verdict = verdictFor(ratio);
  const faction = FACTIONS[level.region.faction];
  const record = profile.levels[level.id];
  const stars = record?.stars ?? 0;
  const reward = levelWinReward(level.id, 3, stars).coins;
  const roster = enemyRosterStats(level);
  const enemies = levelEnemies(level);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className={`${CARD_CLASS} animate-fadeIn relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl`}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-label={`Level ${level.id}: ${level.name}`}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Close">
          <CloseIcon className="text-lg" />
        </button>

        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: level.region.colors[0] }}>
          {level.region.name} · Level {level.id}
        </div>
        <h2 className="font-display mt-0.5 flex items-center gap-2 text-3xl text-slate-50">
          {level.isBoss && <BossIcon />}{level.isElite && <ShieldIcon color="#a78bfa" />}{level.name}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {level.isBoss ? `Boss battle: ${TROOPS[level.region.boss].name} guards the castle.`
            : level.isElite ? 'Elite battle: a champion guards the enemy castle.'
              : `Defeat ${faction.title.toLowerCase()}.`}
        </p>

        {/* Power check */}
        <div className="mt-4 rounded-xl bg-slate-800 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-bold"><PowerIcon /> Your power <span className="font-display text-lg">{power}</span></span>
            <span className="font-bold text-slate-400">Recommended <span className="font-display text-lg text-slate-100">{level.recommendedPower}</span></span>
          </div>
          <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ratio * 70)}%`, background: verdict.color }} />
            {/* Recommended mark */}
            <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: '70%' }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="font-display text-base" style={{ color: verdict.color }}>{verdict.label}</span>
            {ratio < 0.97 && <Link href="/army" className="font-bold text-sky-300 hover:underline">Upgrade your cards →</Link>}
          </div>
        </div>

        {/* The enemy */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <AttackIcon /> {faction.title}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {enemies.map(id => {
              const guard = level.guards.find(g => g.type === id);
              const seen = (profile.bestiary[id]?.seen ?? 0) > 0;
              return (
                <TroopCard
                  key={id}
                  type={id}
                  size="xs"
                  level={level.enemyTier}
                  stats={guard?.stats ?? roster[id] ?? scaleTroop(TROOPS[id], level.enemyScale)}
                  hidden={!seen && !guard}
                  title={seen || guard ? `${TROOPS[id].name}: ${TROOPS[id].role}` : 'Not yet seen - meet it in battle to add it to your Bestiary'}
                />
              );
            })}
          </div>
        </div>

        {/* Cards to bring */}
        <LoadoutPicker enemies={enemies} />

        {/* The map */}
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">Battlefield</div>
          <div className="flex flex-wrap gap-1.5">
            {themeTerrain(level.region.theme).map(terrain => (
              <span key={terrain} className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs" title={TERRAIN_EFFECTS[terrain].description}>
                <TerrainIcon terrain={terrain} /> {TERRAIN_EFFECTS[terrain].name}
              </span>
            ))}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">{level.settings.maxRounds} rounds · {level.settings.planningPhaseTime}s per turn</div>
        </div>

        {/* Stars and reward */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ul className="flex flex-col gap-1 text-xs">
            {starGoals(level).map((goal, i) => (
              <li key={goal} className={`flex items-center gap-1.5 ${i < stars ? 'text-slate-100' : 'text-slate-400'}`}>
                <StarIcon color={i < stars ? '#facc15' : '#475569'} /> {goal}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-start justify-center rounded-xl bg-slate-800 px-3 py-2 sm:items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stars === 0 ? 'Reward up to' : 'Replay reward up to'}</span>
            <span className="font-display flex items-center gap-1 text-2xl text-yellow-300"><CoinIcon /> {reward}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onFight} disabled={profile.deck.length === 0} className={`${PRIMARY_BUTTON} flex-1`} autoFocus>
            <span className="inline-flex items-center gap-2"><AttackIcon color="currentColor" /> Fight!</span>
          </button>
          <Link href="/army" className={`${SECONDARY_BUTTON} flex items-center gap-1.5`}>
            <CardsIcon /> Army
          </Link>
        </div>
      </div>
    </div>
  );
};
