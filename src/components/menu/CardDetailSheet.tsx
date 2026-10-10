import React, { useEffect } from 'react';
import { ABILITIES, FACTIONS, MAX_CARD_LEVEL, TROOPS, TROOP_CLASSES, TroopId, cardPower, cardStats } from '@/lib/game/troops';
import { CARD_UNLOCK_LEVEL, ELITE_UNLOCK_LEVEL, cardPrice, upgradeCost } from '@/lib/meta/economy';
import { eliteUnlocked, isCardAvailable, toggleDeckCard, useProfile } from '@/lib/meta/profile';
import { MAX_SIGNATURE_RANK, ROMAN, SIGNATURE_UNLOCK_LEVEL, getSignature, signatureRank } from '@/lib/game/signatures';
import { TroopCard, RARITY_STYLES } from '../game/cards/TroopCard';
import { CounterLine } from '../game/hud/SelectionCard';
import { CARD_CLASS } from './MenuShell';
import { AbilityIcon, AttackIcon, CoinIcon, HealthIcon, LockIcon, MoveIcon, PowerIcon, SignatureIcon, UpgradeIcon } from '../game/icons';

// Everything about one card, opened by tapping it in the Army: what it does, its signature ability
// rank by rank, and buying, upgrading and bringing it. The cards themselves
// stay short (picture, cost, stats and SIG badge) so the screen isn't a wall of text.

// Stat gains from the next upgrade
const upgradeGains = (id: TroopId, level: number) => {
  const now = cardStats(id, level);
  const next = cardStats(id, level + 1);
  return {
    attack: Math.round((next.attackPower - now.attackPower) * 10) / 10,
    health: next.maxLifespan - now.maxLifespan,
    power: cardPower(id, level + 1) - cardPower(id, level)
  };
};

const BUTTON = 'font-display flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-base transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0';

interface CardDetailSheetProps {
  id: TroopId;
  onClose: () => void;
  onUpgrade: (id: TroopId) => void;
  onBuy: (id: TroopId) => void;
  // Shown over the card when it levels up or is bought
  flash?: string | null;
  // Dev tools, under the actions
  devControls?: React.ReactNode;
}

export const CardDetailSheet: React.FC<CardDetailSheetProps> = ({ id, onClose, onUpgrade, onBuy, flash, devControls }) => {
  const profile = useProfile();
  const troop = TROOPS[id];
  const level = profile.cards[id];
  const owned = level !== undefined;
  const shownLevel = level ?? 1;
  const stats = cardStats(id, shownLevel);
  const rarity = RARITY_STYLES[troop.rarity];
  const signature = getSignature(id);
  const rank = signatureRank(shownLevel);
  const inDeck = profile.deck.includes(id);
  const cost = owned ? upgradeCost(id, shownLevel, eliteUnlocked(profile)) : null;
  const gains = cost !== null ? upgradeGains(id, shownLevel) : null;
  const nextRank = owned && rank < MAX_SIGNATURE_RANK ? rank + 1 : null;
  const abilities = stats.abilities.filter(ability => ability !== 'rapidMovement');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 pl-[var(--safe-l)] pr-[var(--safe-r)] pt-[var(--safe-t)] backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={troop.name}
        onClick={event => event.stopPropagation()}
        className={`${CARD_CLASS} animate-fadeIn relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-4 pb-[calc(1rem+var(--safe-b))] sm:rounded-b-2xl sm:p-5`}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-300 hover:bg-slate-700" aria-label="Close">✕</button>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* The card, and what to do with it */}
          <div className="relative mx-auto flex w-36 shrink-0 flex-col items-center gap-2 pl-1.5 pt-1.5 sm:mx-0 sm:w-48">
            <TroopCard type={id} level={shownLevel} size="lg" fill locked={!owned && !isCardAvailable(profile, id)} hideLevel={!owned} />
            {flash && (
              <span className="moment-pop font-display pointer-events-none absolute top-1/3 text-2xl text-amber-300" style={{ WebkitTextStroke: '1.5px #0f172a', paintOrder: 'stroke fill' }}>
                {flash}
              </span>
            )}
            {owned ? (
              <>
                {cost !== null && gains ? (
                  <button onClick={() => onUpgrade(id)} disabled={profile.coins < cost} className={`${BUTTON} flex-col bg-emerald-600 text-white shadow-[0_4px_0_#065f46] hover:bg-emerald-500`}>
                    <span className="flex items-center gap-1"><UpgradeIcon color="currentColor" /> Lv{shownLevel + 1} · <CoinIcon />{cost}</span>
                    <span className="flex gap-2 font-sans text-xs font-bold opacity-90">
                      {gains.attack > 0 && <span className="flex items-center gap-0.5"><AttackIcon />+{gains.attack}</span>}
                      {gains.health > 0 && <span className="flex items-center gap-0.5"><HealthIcon />+{gains.health}</span>}
                      <span className="flex items-center gap-0.5"><PowerIcon />+{gains.power}</span>
                    </span>
                  </button>
                ) : shownLevel < MAX_CARD_LEVEL ? (
                  <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 py-2 text-center text-xs font-bold text-slate-300">
                    <LockIcon /> Elite levels: beat level {ELITE_UNLOCK_LEVEL}
                  </span>
                ) : (
                  <span className="font-display w-full rounded-xl bg-amber-500 px-3 py-2 text-center text-base text-slate-900">Max level</span>
                )}
                <button
                  onClick={() => toggleDeckCard(id)}
                  className={`${BUTTON} ${inDeck ? 'bg-slate-700 text-slate-100 shadow-[0_4px_0_#1e293b] hover:bg-slate-600' : 'bg-sky-500 text-slate-900 shadow-[0_4px_0_#0369a1] hover:bg-sky-400'}`}
                >
                  {inDeck ? 'Leave behind' : 'Bring to battle'}
                </button>
              </>
            ) : isCardAvailable(profile, id) ? (
              <button onClick={() => onBuy(id)} disabled={profile.coins < cardPrice(id)} className={`${BUTTON} bg-amber-500 text-slate-900 shadow-[0_4px_0_#b45309] hover:bg-amber-400`}>
                Buy <CoinIcon color={profile.coins < cardPrice(id) ? '#cbd5e1' : '#0f172a'} />{cardPrice(id)}
              </button>
            ) : (
              <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 py-2.5 text-sm font-bold text-slate-300">
                <LockIcon /> Beat level {CARD_UNLOCK_LEVEL[id] ?? 0}
              </span>
            )}
            {devControls}
          </div>

          {/* What it does */}
          <div className="min-w-0 flex-1 text-sm">
            <h2 className="font-display pr-10 text-2xl leading-tight">{troop.name}</h2>
            <div className="mt-0.5 text-xs font-bold">
              <span style={{ color: rarity.text }}>{rarity.label}</span>
              <span className="text-slate-400"> · {TROOP_CLASSES[troop.troopClass].name} · {FACTIONS[troop.faction].name}</span>
            </div>
            <p className="mt-2 text-slate-200">{troop.role}</p>
            <div className="mt-2 flex gap-4 font-bold tabular-nums text-slate-100">
              <span className="flex items-center gap-1" title="Attack"><AttackIcon />{Number.isInteger(stats.attackPower) ? stats.attackPower : stats.attackPower.toFixed(1)}</span>
              <span className="flex items-center gap-1" title="Health"><HealthIcon />{stats.maxLifespan}</span>
              <span className="flex items-center gap-1" title="Movement"><MoveIcon />{stats.movementRange}</span>
              <span className="flex items-center gap-1 text-amber-300" title="Gold to deploy"><CoinIcon />{stats.cost}</span>
            </div>
            <CounterLine type={id} />

            {abilities.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-xs">
                {abilities.map(ability => (
                  <li key={ability} className="flex items-start gap-1.5">
                    <AbilityIcon ability={ability} className="mt-0.5 shrink-0" />
                    <span><b className="text-slate-100">{ABILITIES[ability].name}</b> <span className="text-slate-400">{ABILITIES[ability].description}</span></span>
                  </li>
                ))}
              </ul>
            )}

            {/* Its signature ability, rank by rank */}
            {signature && (
              <div className="mt-3 rounded-xl bg-fuchsia-500/10 p-3 ring-1 ring-fuchsia-400/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-bold text-fuchsia-100">
                    <SignatureIcon /> {signature.name} {rank > 0 && ROMAN[rank]}
                  </span>
                  {/* One pip per rank */}
                  <span className="flex gap-0.5" aria-label={`Rank ${rank} of ${MAX_SIGNATURE_RANK}`}>
                    {Array.from({ length: MAX_SIGNATURE_RANK }, (_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full ${i < rank ? 'bg-fuchsia-400 shadow-[0_0_4px_#e879f9]' : 'bg-slate-700'}`} />
                    ))}
                  </span>
                </div>
                <div className="mt-1 text-xs text-fuchsia-200/80">When: {signature.condition}</div>
                <p className="mt-1 text-slate-100">
                  {rank > 0 ? signature.describe(rank) : `Wakes at level ${SIGNATURE_UNLOCK_LEVEL}: ${signature.describe(1)}`}
                </p>
                {nextRank && rank > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Rank {ROMAN[nextRank]} at level {nextRank * 2}: {signature.short(nextRank)}
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs italic text-slate-400">{troop.lore}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
