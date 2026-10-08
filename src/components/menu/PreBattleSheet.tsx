import React, { useState } from 'react';
import Link from 'next/link';
import { LevelDef, levelEnemies, starGoalLabels, enemyRosterStats } from '@/lib/campaign/levels';
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
  AttackIcon, BossIcon, CardsIcon, CloseIcon, CoinIcon, PowerIcon, ShieldIcon, StarIcon, TerrainIcon, BondIcon, FogIcon
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
      <div className="grid grid-cols-4 gap-x-3 gap-y-6 pl-1.5 pt-3 sm:gap-x-4">
        {owned.map(id => {
          const inDeck = profile.deck.includes(id);
          const matchup = matchupScore(id, enemies);
          const bonded = inDeck && bonds.some(bond => bond.cards.includes(id));
          return (
            <div key={id} className="relative">
              <TroopCard
                type={id}
                level={profile.cards[id]}
                size="md"
                fill
                selected={inDeck}
                disabled={!inDeck && isFull}
                onClick={() => toggleDeckCard(id)}
                title={`${inDeck ? 'Tap to leave behind' : isFull ? 'Hand full - leave a card behind first' : 'Tap to bring'}${matchup > 0.05 ? ' · counters this enemy' : matchup < -0.05 ? ' · weak against this enemy' : ''}`}
              />
              {bonded && (
                <span className="pointer-events-none absolute -left-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 shadow ring-1 ring-amber-300" title="Part of a bond">
                  <BondIcon className="text-sm" />
                </span>
              )}
              {matchup > 0.05 && (
                <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-1.5 text-[0.5625rem] font-bold text-slate-900 shadow">
                  Good pick
                </span>
              )}
              {matchup < -0.05 && (
                <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-1.5 text-[0.5625rem] font-bold text-white shadow">
                  Weak here
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <BondList deck={profile.deck} owned={owned} brief />
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
  const terrains = themeTerrain(level.region.theme);
  const [openTerrain, setOpenTerrain] = useState<TerrainType | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className={`${CARD_CLASS} animate-fadeIn relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl`}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-label={`Level ${level.id}: ${level.name}`}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Close">
          <CloseIcon className="text-lg" />
        </button>

        {/* Title, with the battlefield's terrain opposite */}
        <div className="flex items-start gap-3 pr-8">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: level.region.colors[0] }}>
              {level.region.name} · Level {level.id} <span className="text-slate-400">· {level.settings.maxRounds} rounds</span>
            </div>
            <h2 className="font-display mt-0.5 flex items-center gap-2 text-3xl text-slate-50">
              {level.isBoss && <BossIcon />}{level.isElite && <ShieldIcon color="#a78bfa" />}{level.name}
            </h2>
            {(level.isBoss || level.isElite) && (
              <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${level.isBoss ? 'bg-rose-500/20 text-rose-200' : 'bg-violet-500/20 text-violet-200'}`}>
                {level.isBoss ? `Boss: ${TROOPS[level.region.boss].name}` : 'Elite: a champion guards the castle'}
              </span>
            )}
          </div>
          <div className="flex max-w-[45%] flex-col items-end gap-1.5 pt-0.5">
            <div className="flex flex-wrap justify-end gap-1" aria-label="Battlefield terrain">
              {terrains.map(terrain => (
                <button
                  key={terrain}
                  type="button"
                  onClick={() => setOpenTerrain(current => (current === terrain ? null : terrain))}
                  aria-expanded={openTerrain === terrain}
                  title={TERRAIN_EFFECTS[terrain].name}
                  className={`p-0.5 text-base transition-transform hover:scale-125 ${openTerrain === terrain ? 'scale-125 drop-shadow-[0_0_4px_rgba(252,211,77,0.9)]' : ''}`}
                >
                  <TerrainIcon terrain={terrain} />
                </button>
              ))}
            </div>
            {level.settings.fogOfWar && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-200" title="You only see enemies your troops can see">
                <FogIcon /> Fog of war
              </span>
            )}
          </div>
        </div>
        {openTerrain && (
          <div className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs leading-snug text-slate-300">
            <b className="text-amber-200"><TerrainIcon terrain={openTerrain} /> {TERRAIN_EFFECTS[openTerrain].name}:</b> {TERRAIN_EFFECTS[openTerrain].description}
          </div>
        )}

        {/* Power check */}
        <div className="mt-4 rounded-xl bg-slate-800 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-bold" title="Your power: the four cards you bring"><PowerIcon /> <span className="font-display text-lg">{power}</span></span>
            <span className="font-bold text-slate-400">Recommended <span className="font-display text-lg text-slate-100">{level.recommendedPower}</span></span>
          </div>
          <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ratio * 70)}%`, background: verdict.color }} />
            {/* Recommended mark */}
            <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: '70%' }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="font-display text-base" style={{ color: verdict.color }}>{verdict.label}</span>
            {ratio < 0.97 && <Link href="/army" className="font-bold text-sky-300 hover:underline">Upgrade →</Link>}
          </div>
        </div>

        {/* The enemy */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <AttackIcon /> {faction.title}
          </div>
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {enemies.map(id => {
              const guard = level.guards.find(g => g.type === id);
              const seen = (profile.bestiary[id]?.seen ?? 0) > 0;
              return (
                <TroopCard
                  key={id}
                  type={id}
                  size="md"
                  fill
                  level={level.enemyTier}
                  stats={guard?.stats ?? roster[id] ?? scaleTroop(TROOPS[id], level.enemyScale)}
                  hidden={!seen && !guard}
                  title={seen || guard ? `${TROOPS[id].name}: ${TROOPS[id].role}` : 'Not yet seen'}
                />
              );
            })}
          </div>
        </div>

        {/* Cards to bring */}
        <LoadoutPicker enemies={enemies} />

        {/* Stars and the reward */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {starGoalLabels(level).map(({ short, full }, i) => (
            <span key={short} title={full} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${i < stars ? 'bg-amber-400/20 text-amber-100' : 'bg-slate-800 text-slate-400'}`}>
              <StarIcon color={i < stars ? '#facc15' : '#475569'} /> {short}
            </span>
          ))}
          <span className="font-display ml-auto flex items-center gap-1 text-xl text-yellow-300" title={stars === 0 ? 'Reward up to' : 'Replay reward up to'}>
            <CoinIcon /> {reward}
          </span>
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
