import React, { useEffect, useState } from 'react';
import { MAX_CARD_LEVEL, TROOPS, TroopId, cardStats } from '@/lib/game/troops';
import { ELITE_UNLOCK_LEVEL, MAX_DECK_SIZE, SHOP_UNLOCK_LEVEL, cardPrice, upgradeCost } from '@/lib/meta/economy';
import {
  buyCard, deckFormOf, eliteUnlocked, evolveBlock, highestCleared, isCardAvailable, profilePower, toggleDeckCard, treeOf, upgradeCard,
  useHasHydrated, useProfile
} from '@/lib/meta/profile';
import {
  ATTRIBUTES, ATTRIBUTE_PICKS, BASE_CARD_IDS, applyTree, LINEAGES, LINEAGE_IDS, LineageId, PLAYER_SKILLS, canAfford, lineageCards, lineageOf
} from '@/lib/game/lineages';
import { SkillTreeSheet } from './SkillTreeSheet';
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

// The first visit after skill trees arrived points them out once
const TREE_SEEN_KEY = 'wwhSkillTreeSeen';
const readTreeSeen = () => {
  try {
    return localStorage.getItem(TREE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};
const markTreeSeen = () => {
  try {
    localStorage.setItem(TREE_SEEN_KEY, '1');
  } catch {
    // (storage unavailable: the pointer just shows again next time)
  }
};
import { useIsNarrow } from '../shared/useIsNarrow';

// Your cards: choose the four to bring into battle, buy new cards as the campaign unlocks them, and upgrade them with coins
export const ArmyScreen: React.FC = () => {
  const profile = useProfile();
  // Cards may train past level 10 once level 100 is won
  const eliteOpen = eliteUnlocked(profile);
  const hydrated = useHasHydrated();
  const [flash, setFlash] = useState<{ id: TroopId; text: string } | null>(null);
  // The card whose details are open, and the lineage whose skill tree is
  const [detail, setDetail] = useState<TroopId | null>(null);
  const [treeOpen, setTreeOpen] = useState<LineageId | null>(null);
  const [treeSeen, setTreeSeen] = useState(true);
  useEffect(() => setTreeSeen(readTreeSeen()), []);
  const openTree = (lineage: LineageId) => {
    setTreeOpen(lineage);
    if (!treeSeen) {
      markTreeSeen();
      setTreeSeen(true);
    }
  };
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
  // Your troops: one entry for each lineage, showing the form in the deck (or the base card)
  const lineages = LINEAGE_IDS.filter(lineage => profile.cards[LINEAGES[lineage].base] !== undefined);
  const forSale = BASE_CARD_IDS.filter(id => profile.cards[id] === undefined && isCardAvailable(profile, id));
  const locked = BASE_CARD_IDS.filter(id => profile.cards[id] === undefined && !isCardAvailable(profile, id))
    .sort((a, b) => (SHOP_UNLOCK_LEVEL[a] ?? 0) - (SHOP_UNLOCK_LEVEL[b] ?? 0));
  // A card's stats with what its lineage has learnt
  const trainedStats = (id: TroopId) => {
    const lineage = lineageOf(id);
    return applyTree(cardStats(id, profile.cards[id] ?? 1), lineage ? profile.trees[lineage] : undefined);
  };
  // Something on a lineage's tree it could get right now
  const treeReady = (lineage: LineageId) => {
    const tree = treeOf(profile, lineage);
    return LINEAGES[lineage].forms.some(form => evolveBlock(profile, form.id) === null) ||
      (tree.attributes.length < ATTRIBUTE_PICKS && LINEAGES[lineage].attributes.some(id => !tree.attributes.includes(id) && canAfford(profile.materials, ATTRIBUTES[id].cost))) ||
      (!tree.skill && tree.attributes.length > 0 && LINEAGES[lineage].skills.some(id => canAfford(profile.materials, PLAYER_SKILLS[id].cost)));
  };

  return (
    <MenuShell title="Army" icon={<CardsIcon />} wide>
      {/* Deck */}
      <section className={`${CARD_CLASS} p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">Battle cards <span className="text-base text-slate-400">{profile.deck.length}/{MAX_DECK_SIZE}</span></h2>
          <span className="font-display flex items-center gap-1 text-xl text-orange-300"><PowerIcon /> {profilePower(profile)} power</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">Tap a card to leave it behind. One form of each troop can come along. Counters are in the guide.</p>
        <div className="mt-4 grid max-w-3xl grid-cols-4 gap-3 pl-1.5 pt-1.5 sm:gap-5">
          {Array.from({ length: MAX_DECK_SIZE }, (_, i) => {
            const id = profile.deck[i];
            return id ? (
              <TroopCard key={id} type={id} level={profile.cards[id]} stats={trainedStats(id)} size={isNarrow ? 'xs' : 'md'} fill onClick={() => toggleDeckCard(id)} title="Leave this card behind" />
            ) : (
              <div key={`empty-${i}`} className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-sm font-bold text-slate-500" style={{ width: '100%', aspectRatio: '5 / 7' }}>
                Empty
              </div>
            );
          })}
        </div>
      </section>

      {/* Collection: one entry for each lineage */}
      <section className="mt-6">
        <h2 className="font-display mb-1 text-2xl text-slate-800">Your troops</h2>
        {!treeSeen && (
          <p className="mb-3 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-amber-100 shadow">
            Spend the materials you gather on your troops&apos; skill trees - and evolve them into new forms!
          </p>
        )}
        <p className="mb-6 text-sm font-semibold text-slate-700">Train a troop with coins. Its skill tree takes materials from the battlefield, and can evolve it into new forms.</p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {lineages.map((lineage, index) => {
            const def = LINEAGES[lineage];
            const id = deckFormOf(profile, lineage) ?? def.base;
            const level = profile.cards[id]!;
            const cost = upgradeCost(id, level, eliteOpen);
            const inDeck = profile.deck.includes(id);
            const forms = lineageCards(lineage).filter(card => profile.cards[card] !== undefined);
            const tree = treeOf(profile, lineage);
            const pointOut = !treeSeen && index === 0;
            return (
              <div key={lineage} className="relative flex flex-col items-center gap-2">
                <TroopCard
                  type={id}
                  level={level}
                  stats={trainedStats(id)}
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
                {/* The forms it has evolved into: tap one to bring it */}
                {forms.length > 1 && (
                  <div className="flex w-full flex-wrap justify-center gap-1">
                    {forms.map(form => {
                      const chosen = profile.deck.includes(form);
                      return (
                        <button
                          key={form}
                          onClick={() => {
                            // (the form in battle stays there; leaving the troop behind is done from the battle cards)
                            if (chosen) return;
                            if (!toggleDeckCard(form)) announce(id, 'Battle cards full');
                          }}
                          aria-pressed={chosen}
                          className={`rounded-lg px-2 py-0.5 text-xs font-bold ${chosen ? 'cursor-default bg-sky-500 text-slate-900' : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'}`}
                          title={chosen ? 'In battle' : 'Bring this form to battle'}
                        >
                          {TROOPS[form].name}
                        </button>
                      );
                    })}
                  </div>
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
                <div className="relative w-full">
                  <button
                    onClick={() => openTree(lineage)}
                    className={`font-display flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-2 py-2 text-base text-white shadow-[0_4px_0_#4c1d95] transition-transform hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-0.5 ${pointOut ? 'ring-4 ring-amber-300 animate-pulse' : ''}`}
                    title="Attributes, a skill and evolutions, paid with materials"
                  >
                    Skill tree
                    <span className="font-sans text-xs font-bold opacity-80">{tree.attributes.length}/{ATTRIBUTE_PICKS}{tree.skill ? ' · ✦' : ''}</span>
                    {treeReady(lineage) && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-slate-900" aria-label="Something to learn" />}
                  </button>
                </div>
                {devMode && <DevLevelControls level={level} max={MAX_CARD_LEVEL} onSet={next => devSetCardLevel(id, next)} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Shop */}
      {(forSale.length > 0 || locked.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display mb-1 text-2xl text-slate-800">Recruit new troops</h2>
          <p className="mb-3 text-sm font-semibold text-slate-700">More troops unlock as you advance; the rest evolve on their skill trees.</p>
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
              const unlockAt = SHOP_UNLOCK_LEVEL[id] ?? 0;
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

      {treeOpen && <SkillTreeSheet lineage={treeOpen} onClose={() => setTreeOpen(null)} />}

      {detail && (
        <CardDetailSheet
          id={detail}
          onClose={() => setDetail(null)}
          onUpgrade={handleUpgrade}
          onBuy={handleBuy}
          onOpenTree={() => {
            const lineage = lineageOf(detail);
            setDetail(null);
            if (lineage) openTree(lineage);
          }}
          flash={flash?.id === detail ? flash.text : null}
          devControls={devMode && profile.cards[detail] !== undefined && (
            <DevLevelControls level={profile.cards[detail]!} max={MAX_CARD_LEVEL} onSet={next => devSetCardLevel(detail, next)} />
          )}
        />
      )}
    </MenuShell>
  );
};
