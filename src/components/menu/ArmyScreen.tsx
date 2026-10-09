import React, { useState } from 'react';
import { MAX_CARD_LEVEL, PLAYER_CARD_IDS, TROOPS, TroopId } from '@/lib/game/troops';
import { CARD_UNLOCK_LEVEL, ELITE_UNLOCK_LEVEL, MAX_DECK_SIZE, cardPrice, upgradeCost } from '@/lib/meta/economy';
import {
  buyCard, eliteUnlocked, highestCleared, isCardAvailable, profilePower, toggleDeckCard, upgradeCard, useHasHydrated, useProfile
} from '@/lib/meta/profile';
import { ROMAN, getSignature, signatureRank } from '@/lib/game/signatures';
import { CardDetailSheet } from './CardDetailSheet';
import { devSetCardLevel, useDevMode } from '@/lib/meta/devTools';

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
import { CardsIcon, CoinIcon, LockIcon, PowerIcon, SignatureIcon, UpgradeIcon } from '../game/icons';
import { useIsNarrow } from '../shared/useIsNarrow';

// Your cards: choose the four to bring into battle, buy new cards as the campaign unlocks them, and upgrade them with coins
export const ArmyScreen: React.FC = () => {
  const profile = useProfile();
  // Cards may train past level 10 once level 100 is won
  const eliteOpen = eliteUnlocked(profile);
  const hydrated = useHasHydrated();
  const [flash, setFlash] = useState<{ id: TroopId; text: string } | null>(null);
  // The card whose details are open
  const [detail, setDetail] = useState<TroopId | null>(null);
  const isNarrow = useIsNarrow();
  const devMode = useDevMode();
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
    const before = signatureRank(profile.cards[id]);
    if (upgradeCard(id)) {
      playStinger('levelUp');
      const signature = getSignature(id);
      const after = signatureRank((profile.cards[id] ?? 1) + 1);
      announce(id, signature && after > before ? `${signature.name} ${ROMAN[after]}!` : 'Level up!');
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
      </section>

      {/* Collection */}
      <section className="mt-6">
        <h2 className="font-display mb-3 text-2xl text-slate-800">Your cards</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {owned.map(id => {
            const level = profile.cards[id]!;
            const cost = upgradeCost(id, level, eliteOpen);
            const inDeck = profile.deck.includes(id);
            return (
              <div key={id} className="relative flex flex-col items-center gap-2">
                <TroopCard
                  type={id}
                  level={level}
                  size="lg"
                  fill
                  selected={inDeck}
                  onClick={() => setDetail(id)}
                  title="Tap for details"
                />
                {flash?.id === id && (
                  <span className="moment-pop font-display pointer-events-none absolute top-1/3 text-2xl text-amber-300" style={{ WebkitTextStroke: '1.5px #0f172a', paintOrder: 'stroke fill' }}>
                    {flash.text}
                  </span>
                )}
                {cost !== null ? (
                  <button
                    onClick={() => handleUpgrade(id)}
                    disabled={profile.coins < cost}
                    className="font-display flex w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 py-2 text-base text-white shadow-[0_4px_0_#065f46] transition-transform hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0.5 disabled:bg-slate-600 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
                    title={`Upgrade to level ${level + 1} (tap the card for what it gains)`}
                  >
                    <UpgradeIcon color="currentColor" /> Lv{level + 1} · <CoinIcon />{cost}
                    {signatureRank(level + 1) > signatureRank(level) && getSignature(id) && <SignatureIcon />}
                  </button>
                ) : (
                  level < MAX_CARD_LEVEL ? (
                    <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800/80 px-2 py-2 text-center text-sm font-bold text-slate-300" title="Elite levels 11-15 open once you win level 100">
                      <LockIcon /> Elite: beat {ELITE_UNLOCK_LEVEL}
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
                  <TroopCard type={id} size="lg" fill onClick={() => setDetail(id)} title="Tap for details" />
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
                  <TroopCard type={id} size="lg" fill locked onClick={() => setDetail(id)} title="Tap for details" />
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

      {detail && (
        <CardDetailSheet
          id={detail}
          onClose={() => setDetail(null)}
          onUpgrade={handleUpgrade}
          onBuy={handleBuy}
          flash={flash?.id === detail ? flash.text : null}
          devControls={devMode && profile.cards[detail] !== undefined && (
            <DevLevelControls level={profile.cards[detail]!} max={MAX_CARD_LEVEL} onSet={next => devSetCardLevel(detail, next)} />
          )}
        />
      )}
    </MenuShell>
  );
};
