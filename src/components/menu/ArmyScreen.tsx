import React, { useState } from 'react';
import { PLAYER_CARD_IDS, TROOPS, TroopId, cardPower, cardStats } from '@/lib/game/troops';
import { CARD_UNLOCK_LEVEL, MAX_DECK_SIZE, cardPrice, upgradeCost } from '@/lib/meta/economy';
import {
  buyCard, highestCleared, isCardAvailable, profilePower, toggleDeckCard, upgradeCard, useHasHydrated, useProfile
} from '@/lib/meta/profile';
import { playStinger, useMusic } from '@/lib/audio/music';
import { getLevel } from '@/lib/campaign/levels';
import { TroopCard, RARITY_STYLES } from '../game/cards/TroopCard';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { AttackIcon, BondIcon, CardsIcon, CoinIcon, HealthIcon, LockIcon, PowerIcon, UnitIcon, UpgradeIcon } from '../game/icons';
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
  const hydrated = useHasHydrated();
  const [flash, setFlash] = useState<{ id: TroopId; text: string } | null>(null);
  const isNarrow = useIsNarrow();
  useMusic('menu');

  const announce = (id: TroopId, text: string) => {
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
    if (upgradeCard(id)) {
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
            const cost = upgradeCost(id, level);
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
                  </button>
                ) : (
                  <span className="font-display w-full rounded-xl bg-amber-500 px-3 py-2 text-center text-base text-slate-900">Max level</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

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
                  {active && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900">Active</span>}
                  {!ready && <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 text-[10px] font-bold text-slate-300">Need both cards</span>}
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
