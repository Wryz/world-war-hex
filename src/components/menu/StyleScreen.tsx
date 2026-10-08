import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { CARD_SKINS, CASTLE_STYLES, CastleStyleId, getCastleStyle } from '@/lib/meta/cosmetics';
import { CosmeticKind, buyCosmetic, equipCosmetic, ownsCosmetic, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { playStinger, useMusic } from '@/lib/audio/music';
import { trackEvent } from '@/lib/analytics';
import { TroopCard } from '../game/cards/TroopCard';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { CoinIcon, CrownIcon, StyleIcon } from '../game/icons';

// The 3D preview needs WebGL, so it only renders in the browser
const CastlePreview = dynamic(() => import('./CastlePreview'), { ssr: false });

// Buy, or put on, a cosmetic: shows its price, "Equip" or "Equipped"
const CosmeticButton: React.FC<{ kind: CosmeticKind; id: string; price: number; equipped: boolean; onBought: () => void }> = ({
  kind, id, price, equipped, onBought
}) => {
  const profile = useProfile();
  const owned = ownsCosmetic(profile, kind, id);
  if (equipped) {
    return <span className="font-display rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-white">Equipped</span>;
  }
  if (owned) {
    return (
      <button
        onClick={() => equipCosmetic(kind, id)}
        className="font-display rounded-xl bg-sky-600 px-3 py-1.5 text-sm text-white shadow-[0_4px_0_#075985] transition-transform hover:-translate-y-0.5 hover:bg-sky-500 active:translate-y-0.5"
      >
        Equip
      </button>
    );
  }
  const canAfford = profile.coins >= price;
  return (
    <button
      onClick={() => {
        if (buyCosmetic(kind, id)) {
          playStinger('unlock');
          trackEvent('cosmetic_bought', { kind, id, price });
          onBought();
        }
      }}
      disabled={!canAfford}
      className="font-display flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-sm text-slate-900 shadow-[0_4px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-0.5 disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-[0_4px_0_#1e293b] disabled:hover:translate-y-0"
      title={canAfford ? `Buy for ${price} coins` : `Needs ${price} coins`}
    >
      Buy <CoinIcon color={canAfford ? '#0f172a' : '#cbd5e1'} />{price}
    </button>
  );
};

// Cosmetics: card frames for your troop cards and styles for your castle. Looks only - they never
// change how your army fights.
export const StyleScreen: React.FC = () => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const [previewCastle, setPreviewCastle] = useState<CastleStyleId | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useMusic('menu');

  if (!hydrated) return <MenuShell title="Style" icon={<StyleIcon />}><div /></MenuShell>;

  const announce = (id: string) => {
    setFlash(id);
    setTimeout(() => setFlash(current => (current === id ? null : current)), 1400);
  };
  const shownCastle = getCastleStyle(previewCastle ?? profile.cosmetics.castleStyle);
  const previewCard = profile.deck[0] ?? 'infantry';

  return (
    <MenuShell title="Style" icon={<StyleIcon />} wide>
      <p className={`${CARD_CLASS} p-4 text-sm text-slate-300`}>
        Styles change how your army looks, never how it fights.
      </p>

      {/* Card frames */}
      <section className="mt-6">
        <h2 className="font-display mb-3 text-2xl text-slate-800">Card frames</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {CARD_SKINS.map(skin => {
            const equipped = profile.cosmetics.cardSkin === skin.id;
            return (
              <div key={skin.id} className="relative flex flex-col items-center gap-2">
                <TroopCard type={previewCard} level={profile.cards[previewCard]} size="sm" skin={skin.id} selected={equipped} />
                {flash === skin.id && (
                  <span className="moment-pop font-display pointer-events-none absolute top-1/4 text-xl text-amber-300" style={{ WebkitTextStroke: '1.5px #0f172a', paintOrder: 'stroke fill' }}>
                    New look!
                  </span>
                )}
                <span className="font-display text-center text-sm text-slate-800">{skin.name}</span>
                <span className="min-h-[2.5em] text-center text-[0.6875rem] font-semibold text-slate-700">{skin.description}</span>
                <CosmeticButton kind="cardSkin" id={skin.id} price={skin.price} equipped={equipped} onBought={() => announce(skin.id)} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Castle styles */}
      <section className="mt-8">
        <h2 className="font-display mb-3 flex items-center gap-2 text-2xl text-slate-800"><CrownIcon /> Castle styles</h2>
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className={`${CARD_CLASS} p-3`}>
            <CastlePreview look={shownCastle} />
            <div className="mt-2 text-center">
              <div className="font-display text-xl">{shownCastle.name}</div>
              <div className="text-xs text-slate-400">{shownCastle.description}</div>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CASTLE_STYLES.map(style => {
              const equipped = profile.cosmetics.castleStyle === style.id;
              return (
                <li
                  key={style.id}
                  className={`${CARD_CLASS} relative flex cursor-pointer items-center gap-3 p-3 ${equipped ? 'ring-2 ring-emerald-400' : ''} ${shownCastle.id === style.id ? 'ring-2 ring-amber-300' : ''}`}
                  onMouseEnter={() => setPreviewCastle(style.id)}
                  onClick={() => setPreviewCastle(style.id)}
                >
                  <span className="flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-lg ring-2 ring-slate-900" aria-hidden>
                    <span className="flex-[45]" style={{ background: style.roof ?? '#3b82f6' }} />
                    <span className="flex-[55]" style={{ background: style.stone }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-display block">{style.name}</span>
                    <span className="block text-[0.6875rem] text-slate-400">{style.description}</span>
                  </span>
                  {flash === style.id && (
                    <span className="moment-pop font-display pointer-events-none absolute right-3 top-0 text-lg text-amber-300" style={{ WebkitTextStroke: '1.5px #0f172a', paintOrder: 'stroke fill' }}>
                      New look!
                    </span>
                  )}
                  <CosmeticButton kind="castleStyle" id={style.id} price={style.price} equipped={equipped} onBought={() => announce(style.id)} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </MenuShell>
  );
};
