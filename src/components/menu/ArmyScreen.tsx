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
import { AttackIcon, CardsIcon, CoinIcon, HealthIcon, LockIcon, PowerIcon, UpgradeIcon } from '../game/icons';

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
        <p className="text-xs text-slate-400">
          You bring four cards into each battle - change them here or before any fight. Tap a card below to bring it or leave it
          behind. Mix your troops: spears beat cavalry,
          cavalry beats ranged and casters, ranged beats spears and brutes, infantry beats spears and skirmishers, skirmishers hunt
          the back line, and brutes smash infantry.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {Array.from({ length: MAX_DECK_SIZE }, (_, i) => {
            const id = profile.deck[i];
            return id ? (
              <TroopCard key={id} type={id} level={profile.cards[id]} size="sm" onClick={() => toggleDeckCard(id)} title="Leave this card behind" />
            ) : (
              <div key={`empty-${i}`} className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-xs font-bold text-slate-500" style={{ width: 88, aspectRatio: '5 / 7' }}>
                Empty
              </div>
            );
          })}
        </div>
      </section>

      {/* Collection */}
      <section className="mt-6">
        <h2 className="font-display mb-3 text-2xl text-slate-800">Your cards</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
                  size="md"
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
                    className="flex w-[128px] flex-col items-center rounded-xl bg-emerald-600 px-2 py-1.5 text-white shadow-[0_4px_0_#065f46] transition-transform hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0.5 disabled:bg-slate-600 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
                    title={`Upgrade to level ${level + 1}`}
                  >
                    <span className="font-display flex items-center gap-1 text-sm"><UpgradeIcon color="currentColor" /> Lv{level + 1} · <CoinIcon />{cost}</span>
                    <span className="flex gap-2 text-[10px] font-bold opacity-90">
                      {gains.attack > 0 && <span className="flex items-center gap-0.5"><AttackIcon />+{gains.attack}</span>}
                      {gains.health > 0 && <span className="flex items-center gap-0.5"><HealthIcon />+{gains.health}</span>}
                      <span className="flex items-center gap-0.5"><PowerIcon />+{gains.power}</span>
                    </span>
                  </button>
                ) : (
                  <span className="font-display rounded-xl bg-amber-500 px-3 py-1.5 text-sm text-slate-900">Max level</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Shop */}
      {(forSale.length > 0 || locked.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display mb-1 text-2xl text-slate-800">Recruit new cards</h2>
          <p className="mb-3 text-sm font-semibold text-slate-700">New cards join the shop as you push through the campaign.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {forSale.map(id => {
              const price = cardPrice(id);
              return (
                <div key={id} className="flex flex-col items-center gap-2">
                  <TroopCard type={id} size="md" />
                  <button
                    onClick={() => handleBuy(id)}
                    disabled={profile.coins < price}
                    className="font-display flex w-[128px] items-center justify-center gap-1 rounded-xl bg-amber-500 px-2 py-2 text-slate-900 shadow-[0_4px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
                  >
                    Buy <CoinIcon color={profile.coins < price ? '#cbd5e1' : '#0f172a'} />{price}
                  </button>
                  <span className="text-[11px] font-bold" style={{ color: RARITY_STYLES[TROOPS[id].rarity].text }}>{RARITY_STYLES[TROOPS[id].rarity].label}</span>
                </div>
              );
            })}
            {locked.map(id => {
              const unlockAt = CARD_UNLOCK_LEVEL[id] ?? 0;
              return (
                <div key={id} className="flex flex-col items-center gap-2">
                  <TroopCard type={id} size="md" locked />
                  <span className="flex w-[128px] items-center justify-center gap-1 rounded-xl bg-slate-800/80 px-2 py-2 text-center text-[11px] font-bold text-slate-300">
                    <LockIcon /> Beat level {unlockAt}
                  </span>
                  <span className="text-[10px] text-slate-700">{getLevel(unlockAt).name} ({unlockAt - cleared > 0 ? `${unlockAt - cleared} to go` : 'ready'})</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </MenuShell>
  );
};
