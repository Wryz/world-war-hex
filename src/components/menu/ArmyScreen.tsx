import React, { useState } from 'react';
import { MAX_CARD_LEVEL, PLAYER_CARD_IDS, TROOPS, TroopId, cardPower, cardStats } from '@/lib/game/troops';
import {
  CARD_UNLOCK_LEVEL, ELITE_UNLOCK_LEVEL, MAX_DECK_SIZE, TACTIC_UNLOCK_LEVEL, cardPrice, tacticPrice, tacticUpgradeCost, upgradeCost
} from '@/lib/meta/economy';
import {
  buyCard, buyTactic, eliteUnlocked, highestCleared, isCardAvailable, isTacticAvailable, ownedTactics, profilePower, toggleDeckCard,
  toggleTacticLoadout, upgradeCard, upgradeTactic, useHasHydrated, useProfile
} from '@/lib/meta/profile';
import { ROMAN, getSignature, signatureRank } from '@/lib/game/signatures';
import { MAX_TACTIC_LEVEL, TACTICS, TACTIC_IDS, TACTIC_LOADOUT_SIZE, TacticId } from '@/lib/game/tactics';
import { TacticCard } from '../game/cards/TacticCard';
import { devSetCardLevel, devSetTacticLevel, useDevMode } from '@/lib/meta/devTools';

// Dev tools only: step a card's level down or up for free
const DevLevelControls: React.FC<{ level: number; max: number; onSet: (level: number) => void }> = ({ level, max, onSet }) => (
  <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-fuchsia-900/70 px-2 py-1 text-xs font-bold text-fuchsia-100" title="Dev tools: set the level for free">
    <button onClick={() => onSet(level - 1)} disabled={level <= 1} className="rounded bg-fuchsia-700 px-2 disabled:opacity-40">−</button>
    <span>DEV Lv{level}</span>
    <button onClick={() => onSet(level + 1)} disabled={level >= max} className="rounded bg-fuchsia-700 px-2 disabled:opacity-40">+</button>
  </div>
);
import { playStinger, useMusic } from '@/lib/audio/music';
import { getLevel } from '@/lib/campaign/levels';
import { TroopCard, RARITY_STYLES } from '../game/cards/TroopCard';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { AttackIcon, BondIcon, CardsIcon, CoinIcon, HealthIcon, LockIcon, PowerIcon, SignatureIcon, TacticBackIcon, UnitIcon, UpgradeIcon } from '../game/icons';
import { BondList } from '../game/cards/BondList';
import { useIsNarrow } from '../shared/useIsNarrow';
import { BONDS, describeBond } from '@/lib/game/bonds';

// Stat gains from the next upgrade, e.g. "+0.2 atk +1 hp"
const upgradeGains = (id: TroopId, level: number) => {
  const now = cardStats(id, level);
  const next = cardStats(id, level + 1);
  const attack = Math.round((next.attackPower - now.attackPower) * 10) / 10;
  const health = next.maxLifespan - now.maxLifespan;
  return { attack, health, power: cardPower(id, level + 1) - cardPower(id, level) };
};

// Your cards: choose the four to bring into battle, buy new cards as the campaign unlocks them, and upgrade them with coins
export const ArmyScreen: React.FC = () => {
  const profile = useProfile();
  // Cards may train past level 10 once level 100 is won
  const eliteOpen = eliteUnlocked(profile);
  const hydrated = useHasHydrated();
  const [flash, setFlash] = useState<{ id: TroopId | TacticId; text: string } | null>(null);
  const isNarrow = useIsNarrow();
  const devMode = useDevMode();
  useMusic('menu');

  const announce = (id: TroopId | TacticId, text: string) => {
    setFlash({ id, text });
    setTimeout(() => setFlash(current => (current?.id === id ? null : current)), 1400);
  };

  const handleBuy = (id: TroopId) => {
    if (buyCard(id)) {
      playStinger('unlock');
      announce(id, 'New card!');
    }
  };

  const handleUpgrade = (id: TroopId) => {
    const before = signatureRank(profile.cards[id]);
    if (upgradeCard(id)) {
      playStinger('levelUp');
      const signature = getSignature(id);
      const after = signatureRank((profile.cards[id] ?? 1) + 1);
      announce(id, signature && after > before ? `${signature.name} ${ROMAN[after]}!` : 'Level up!');
    }
  };

  const handleBuyTactic = (id: TacticId) => {
    if (buyTactic(id)) {
      playStinger('unlock');
      announce(id, 'New tactic!');
    }
  };

  const handleUpgradeTactic = (id: TacticId) => {
    if (upgradeTactic(id)) {
      playStinger('levelUp');
      announce(id, 'Level up!');
    }
  };

  if (!hydrated) return <MenuShell title="Army" icon={<CardsIcon />}><div /></MenuShell>;

  const cleared = highestCleared(profile);
  const owned = PLAYER_CARD_IDS.filter(id => profile.cards[id] !== undefined);
  const forSale = PLAYER_CARD_IDS.filter(id => profile.cards[id] === undefined && isCardAvailable(profile, id));
  const locked = PLAYER_CARD_IDS.filter(id => profile.cards[id] === undefined && !isCardAvailable(profile, id));

  return (
    <MenuShell title="Army" icon={<CardsIcon />} wide>
      {/* Deck */}
      <section className={`${CARD_CLASS} p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">Battle cards <span className="text-base text-slate-400">{profile.deck.length}/{MAX_DECK_SIZE}</span></h2>
          <span className="font-display flex items-center gap-1 text-xl text-orange-300"><PowerIcon /> {profilePower(profile)} power</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">Tap a card to bring it or leave it behind. Counters are in the guide.</p>
        <div className="mt-4 grid max-w-3xl grid-cols-4 gap-3 pl-1.5 pt-1.5 sm:gap-5">
          {Array.from({ length: MAX_DECK_SIZE }, (_, i) => {
            const id = profile.deck[i];
            return id ? (
              <TroopCard key={id} type={id} level={profile.cards[id]} size={isNarrow ? 'xs' : 'md'} fill onClick={() => toggleDeckCard(id)} title="Leave this card behind" />
            ) : (
              <div key={`empty-${i}`} className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-sm font-bold text-slate-500" style={{ width: '100%', aspectRatio: '5 / 7' }}>
                Empty
              </div>
            );
          })}
        </div>
        <div className="mt-5">
          <BondList deck={profile.deck} owned={owned} />
        </div>
      </section>

      {/* Collection */}
      <section className="mt-6">
        <h2 className="font-display mb-3 text-2xl text-slate-800">Your cards</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {owned.map(id => {
            const level = profile.cards[id]!;
            const cost = upgradeCost(id, level, eliteOpen);
            const inDeck = profile.deck.includes(id);
            const gains = cost !== null ? upgradeGains(id, level) : null;
            return (
              <div key={id} className="relative flex flex-col items-center gap-2">
                <TroopCard
                  type={id}
                  level={level}
                  size="lg"
                  fill
                  selected={inDeck}
                  onClick={() => toggleDeckCard(id)}
                  title={inDeck ? 'In your battle cards - tap to leave it behind' : 'Tap to bring it into battle'}
                />
                {flash?.id === id && (
                  <span className="moment-pop font-display pointer-events-none absolute top-1/3 text-2xl text-amber-300" style={{ WebkitTextStroke: '1.5px #0f172a', paintOrder: 'stroke fill' }}>
                    {flash.text}
                  </span>
                )}
                {cost !== null && gains ? (
                  <button
                    onClick={() => handleUpgrade(id)}
                    disabled={profile.coins < cost}
                    className="flex w-full flex-col items-center rounded-xl bg-emerald-600 px-2 py-2 text-white shadow-[0_4px_0_#065f46] transition-transform hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0.5 disabled:bg-slate-600 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
                    title={`Upgrade to level ${level + 1}`}
                  >
                    <span className="font-display flex items-center gap-1 text-base"><UpgradeIcon color="currentColor" /> Lv{level + 1} · <CoinIcon />{cost}</span>
                    <span className="flex gap-2 text-sm font-bold opacity-90">
                      {gains.attack > 0 && <span className="flex items-center gap-0.5"><AttackIcon />+{gains.attack}</span>}
                      {gains.health > 0 && <span className="flex items-center gap-0.5"><HealthIcon />+{gains.health}</span>}
                      <span className="flex items-center gap-0.5"><PowerIcon />+{gains.power}</span>
                    </span>
                    {signatureRank(level + 1) > signatureRank(level) && getSignature(id) && (
                      <span className="flex items-center gap-1 text-xs font-bold text-fuchsia-100">
                        <SignatureIcon /> {getSignature(id)!.name} {ROMAN[signatureRank(level + 1)]}
                      </span>
                    )}
                  </button>
                ) : (
                  level < MAX_CARD_LEVEL ? (
                    <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800/80 px-2 py-2 text-center text-sm font-bold text-slate-300" title="Elite levels 11-15 open once you win level 100">
                      <LockIcon /> Elite levels: beat level {ELITE_UNLOCK_LEVEL}
                    </span>
                  ) : (
                    <span className="font-display w-full rounded-xl bg-amber-500 px-3 py-2 text-center text-base text-slate-900">Max level</span>
                  )
                )}
                {devMode && <DevLevelControls level={level} max={MAX_CARD_LEVEL} onSet={next => devSetCardLevel(id, next)} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Tactic cards */}
      <TacticSection flash={flash} onBuy={handleBuyTactic} onUpgrade={handleUpgradeTactic} />

      {/* Every bond, so players know what to work towards */}
      <section className="mt-8">
        <h2 className="font-display mb-1 flex items-center gap-2 text-2xl text-slate-800"><BondIcon /> Bonds</h2>
        <p className="mb-3 text-sm font-semibold text-slate-700">Bring both cards to fight better together.</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BONDS.map(bond => {
            const ready = bond.cards.every(card => profile.cards[card] !== undefined);
            const active = bond.cards.every(card => profile.deck.includes(card));
            return (
              <li key={bond.id} className={`${CARD_CLASS} flex items-start gap-2 p-3 text-xs ${active ? 'ring-2 ring-amber-300' : ''}`} title={bond.flavor}>
                <span className={`mt-0.5 flex shrink-0 items-center gap-0.5 text-base ${ready ? '' : 'opacity-50'}`}>
                  <UnitIcon type={bond.cards[0]} /><BondIcon /><UnitIcon type={bond.cards[1]} />
                </span>
                <span className="min-w-0">
                  <b className={active ? 'text-amber-200' : 'text-slate-100'}>{bond.name}</b>
                  {active && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[0.625rem] font-bold text-slate-900">Active</span>}
                  {!ready && <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 text-[0.625rem] font-bold text-slate-300">Need both cards</span>}
                  <span className="block text-slate-300">{bond.cards.map(card => TROOPS[card].name).join(' + ')}: {describeBond(bond)}</span>
                  <span className="mt-0.5 block italic text-slate-400">{bond.flavor}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Shop */}
      {(forSale.length > 0 || locked.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display mb-1 text-2xl text-slate-800">Recruit new cards</h2>
          <p className="mb-3 text-sm font-semibold text-slate-700">More cards unlock as you advance.</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {forSale.map(id => {
              const price = cardPrice(id);
              return (
                <div key={id} className="flex flex-col items-center gap-2">
                  <TroopCard type={id} size="lg" fill />
                  <button
                    onClick={() => handleBuy(id)}
                    disabled={profile.coins < price}
                    className="font-display flex w-full items-center justify-center gap-1 rounded-xl bg-amber-500 px-2 py-2.5 text-lg text-slate-900 shadow-[0_4px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
                  >
                    Buy <CoinIcon color={profile.coins < price ? '#cbd5e1' : '#0f172a'} />{price}
                  </button>
                  <span className="text-sm font-bold" style={{ color: RARITY_STYLES[TROOPS[id].rarity].text }}>{RARITY_STYLES[TROOPS[id].rarity].label}</span>
                </div>
              );
            })}
            {locked.map(id => {
              const unlockAt = CARD_UNLOCK_LEVEL[id] ?? 0;
              return (
                <div key={id} className="flex flex-col items-center gap-2">
                  <TroopCard type={id} size="lg" fill locked />
                  <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800/80 px-2 py-2.5 text-center text-sm font-bold text-slate-300">
                    <LockIcon /> Beat level {unlockAt}
                  </span>
                  <span className="text-center text-xs font-semibold text-slate-700">{getLevel(unlockAt).name} ({unlockAt - cleared > 0 ? `${unlockAt - cleared} to go` : 'ready'})</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </MenuShell>
  );
};

// Tactic cards: the three brought into battle, upgrades for the ones owned, and the ones to buy
const TacticSection: React.FC<{
  flash: { id: TroopId | TacticId; text: string } | null;
  onBuy: (id: TacticId) => void;
  onUpgrade: (id: TacticId) => void;
}> = ({ flash, onBuy, onUpgrade }) => {
  const profile = useProfile();
  const devMode = useDevMode();
  const owned = ownedTactics(profile);
  const forSale = TACTIC_IDS.filter(id => profile.tactics[id] === undefined && isTacticAvailable(profile, id));
  const locked = TACTIC_IDS.filter(id => profile.tactics[id] === undefined && !isTacticAvailable(profile, id));
  return (
    <section className="mt-8">
      <h2 className="font-display mb-1 flex items-center gap-2 text-2xl text-slate-800"><TacticBackIcon color="#334155" /> Tactic cards</h2>
      <p className="mb-3 text-sm font-semibold text-slate-700">
        Bring {TACTIC_LOADOUT_SIZE}. From round 2, every second round you draw one of them at random (hold up to 3) and play it on your turn. So does the enemy.
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
        {owned.map(id => {
          const level = profile.tactics[id]!;
          const cost = tacticUpgradeCost(level);
          const inLoadout = profile.tacticLoadout.includes(id);
          return (
            <div key={id} className="relative flex flex-col items-center gap-2">
              <TacticCard
                id={id}
                level={level}
                size="lg"
                fill
                selected={inLoadout}
                onClick={() => toggleTacticLoadout(id)}
                title={inLoadout ? 'In your battle tactics - tap to leave it behind' : 'Tap to bring it into battle'}
              />
              {flash?.id === id && (
                <span className="moment-pop font-display pointer-events-none absolute top-1/3 text-2xl text-amber-300" style={{ WebkitTextStroke: '1.5px #0f172a', paintOrder: 'stroke fill' }}>
                  {flash.text}
                </span>
              )}
              {cost !== null ? (
                <button
                  onClick={() => onUpgrade(id)}
                  disabled={profile.coins < cost}
                  title={`Level ${level + 1}: ${TACTICS[id].describe(level + 1)}`}
                  className="flex w-full flex-col items-center rounded-xl bg-emerald-600 px-2 py-2 text-white shadow-[0_4px_0_#065f46] transition-transform hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0.5 disabled:bg-slate-600 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
                >
                  <span className="font-display flex items-center gap-1 text-base"><UpgradeIcon color="currentColor" /> Lv{level + 1} · <CoinIcon />{cost}</span>
                </button>
              ) : (
                <span className="font-display w-full rounded-xl bg-amber-500 px-3 py-2 text-center text-base text-slate-900">Max level</span>
              )}
              {devMode && <DevLevelControls level={level} max={MAX_TACTIC_LEVEL} onSet={next => devSetTacticLevel(id, next)} />}
            </div>
          );
        })}
        {forSale.map(id => {
          const price = tacticPrice(id);
          return (
            <div key={id} className="flex flex-col items-center gap-2">
              <TacticCard id={id} size="lg" fill />
              <button
                onClick={() => onBuy(id)}
                disabled={profile.coins < price}
                className="font-display flex w-full items-center justify-center gap-1 rounded-xl bg-amber-500 px-2 py-2.5 text-lg text-slate-900 shadow-[0_4px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
              >
                Buy <CoinIcon color={profile.coins < price ? '#cbd5e1' : '#0f172a'} />{price}
              </button>
            </div>
          );
        })}
        {locked.map(id => (
          <div key={id} className="flex flex-col items-center gap-2">
            <TacticCard id={id} size="lg" fill locked />
            <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800/80 px-2 py-2.5 text-center text-sm font-bold text-slate-300">
              <LockIcon /> Beat level {TACTIC_UNLOCK_LEVEL[id]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
