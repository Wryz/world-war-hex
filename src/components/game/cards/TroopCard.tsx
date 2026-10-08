import React, { useState } from 'react';
import { TroopStats, UnitType } from '@/types/game';
import { ABILITIES, FACTIONS, Rarity, TROOPS, TROOP_CLASSES, cardStats } from '@/lib/game/troops';
import { AbilityIcon, AttackIcon, GoldIcon, HealthIcon, LockIcon, MoveIcon, SignatureIcon, UnitIcon } from '../icons';
import { ROMAN, SIGNATURE_UNLOCK_LEVEL, getSignature, signatureRank } from '@/lib/game/signatures';
import { cardArtUrl } from './cardArt';
import { CardSkinId, getCardSkin } from '@/lib/meta/cosmetics';
import { useProfile } from '@/lib/meta/profile';

// A troop as a playing card: cost gem, level badge, a picture of the troop over its faction's colour
// and the card frame's pattern, its signature (SIG) badge, name banner, stats and ability icons. Kept
// short on purpose: the words (role, signature, abilities) are in the Army's card details and tooltips.
// Used for the hand in battle, the army and shop, and the bestiary.

export type CardSize = 'xs' | 'xm' | 'sm' | 'md' | 'lg';

export const RARITY_STYLES: Record<Rarity, { frame: string; label: string; text: string }> = {
  common: { frame: '#94a3b8', label: 'Common', text: '#cbd5e1' },
  rare: { frame: '#3b82f6', label: 'Rare', text: '#7dd3fc' },
  epic: { frame: '#a855f7', label: 'Epic', text: '#d8b4fe' },
  legendary: { frame: '#f59e0b', label: 'Legendary', text: '#fcd34d' },
  boss: { frame: '#b91c1c', label: 'Boss', text: '#fca5a5' }
};

const SIZES: Record<CardSize, { width: number; icon: string; name: string; stats: string; gem: string; pad: string }> = {
  xs: { width: 64, icon: 'text-2xl', name: 'text-[0.5rem]', stats: 'text-[0.5625rem]', gem: 'h-4 min-w-4 text-[0.5625rem]', pad: 'p-[3px]' },
  // Between xs and sm: a phone's battle hand
  xm: { width: 70, icon: 'text-3xl', name: 'text-[0.5625rem]', stats: 'text-[0.625rem]', gem: 'h-[1.125rem] min-w-[1.125rem] text-[0.625rem]', pad: 'p-[3px]' },
  sm: { width: 88, icon: 'text-4xl', name: 'text-[0.625rem]', stats: 'text-[0.625rem]', gem: 'h-5 min-w-5 text-[0.6875rem]', pad: 'p-1' },
  md: { width: 128, icon: 'text-5xl', name: 'text-xs', stats: 'text-xs', gem: 'h-6 min-w-6 text-xs', pad: 'p-1.5' },
  lg: { width: 200, icon: 'text-7xl', name: 'text-base', stats: 'text-sm', gem: 'h-8 min-w-8 text-base', pad: 'p-2' }
};

interface TroopCardProps {
  type: UnitType;
  // Card level (player cards) or tier (monsters); defaults to 1
  level?: number;
  // Stats to show; defaults to the troop's stats at `level`
  stats?: TroopStats;
  size?: CardSize;
  selected?: boolean;
  // Greyed out (e.g. can't afford it)
  disabled?: boolean;
  // Not owned yet: shown with a padlock
  locked?: boolean;
  // Never seen: a silhouette with question marks
  hidden?: boolean;
  // Hide the level badge
  hideLevel?: boolean;
  // Card frame to show; your cards default to the one you have equipped
  skin?: CardSkinId;
  // Stretch to the width of its grid cell (text and icons keep the size's scale)
  fill?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  title?: string;
}

const formatStat = (value: number) => (Number.isInteger(value) ? value : value.toFixed(1));

export const TroopCard: React.FC<TroopCardProps> = ({
  type,
  level = 1,
  stats,
  size = 'md',
  selected = false,
  disabled = false,
  locked = false,
  hidden = false,
  hideLevel = false,
  skin,
  fill = false,
  onClick,
  className = '',
  children,
  title
}) => {
  const troop = TROOPS[type];
  const equipped = useProfile().cosmetics.cardSkin;
  // Card frames dress your own cards; monsters keep the classic look
  const face = getCardSkin(skin ?? (troop.faction === 'kingdom' ? equipped : undefined));
  const shown = stats ?? cardStats(type, level);
  const faction = FACTIONS[troop.faction];
  const rarity = RARITY_STYLES[troop.rarity];
  const dims = SIZES[size];
  const isInteractive = !!onClick && !disabled;
  const Tag = onClick ? 'button' : 'div';
  // The portrait (public/cards); the troop's icon stands in if it can't be loaded
  const [artFailed, setArtFailed] = useState(false);
  const isSmall = size === 'xs' || size === 'xm';
  // The card's signature ability (Kingdom cards), awake from level 2
  const signature = getSignature(type);
  const rank = signatureRank(level);
  const signatureText = signature && (rank > 0
    ? `${signature.name} ${ROMAN[rank]}: ${signature.describe(rank)}`
    : `${signature.name} (wakes at level ${SIGNATURE_UNLOCK_LEVEL}): ${signature.describe(1)}`);

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      title={title ?? (hidden ? 'Undiscovered' : `${troop.name} (${TROOP_CLASSES[troop.troopClass].name}) - ${troop.role}`)}
      aria-pressed={onClick ? selected : undefined}
      className={`group relative block shrink-0 select-none rounded-xl text-left transition-transform duration-150 ${
        isInteractive ? 'cursor-pointer hover:-translate-y-2 focus:outline-none focus-visible:-translate-y-2' : ''
      } ${selected ? '-translate-y-3' : ''} ${className}`}
      style={{
        // (in rem, so cards grow with the UI size setting)
        width: fill ? '100%' : `${dims.width / 16}rem`,
        aspectRatio: '5 / 7',
        background: hidden ? '#475569' : rarity.frame,
        padding: size === 'xs' || size === 'xm' ? 2 : 3,
        boxShadow: selected
          ? '0 0 0 3px #fde047, 0 12px 24px rgba(0,0,0,0.45)'
          : '0 5px 0 rgba(15, 23, 42, 0.55), 0 8px 18px rgba(0,0,0,0.3)',
        filter: disabled ? 'grayscale(0.85) brightness(0.7)' : undefined
      }}
    >
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-[9px] ${dims.pad} ${troop.rarity === 'legendary' && !hidden ? 'card-shine' : ''}`}
        style={{ background: hidden ? '#0f172a' : face.face, boxShadow: hidden ? undefined : `inset 0 0 0 1px ${face.trim}` }}
      >
        {/* Art: the troop's picture over its faction's colour and the frame's pattern */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md"
          style={{ background: hidden ? '#1e293b' : `color-mix(in srgb, ${faction.color} 62%, #0f172a)` }}
        >
          <div
            className={`absolute inset-0 ${face.animated && !hidden ? 'card-holo' : ''}`}
            style={{
              background: hidden ? getCardSkin('classic').pattern : face.pattern,
              opacity: hidden ? 0.15 : Math.max(0.2, face.patternOpacity)
            }}
          />
          {/* A soft light behind the troop */}
          {!hidden && <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 55%, rgba(255,255,255,0.22), transparent 70%)' }} />}
          {hidden ? (
            <span className={`font-display ${dims.icon} text-slate-500`}>?</span>
          ) : artFailed ? (
            <UnitIcon type={type} color="#fff" className={`${dims.icon} drop-shadow-[0_3px_0_rgba(15,23,42,0.6)] transition-transform group-hover:scale-110`} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardArtUrl(type)}
              alt=""
              loading="lazy"
              draggable={false}
              onError={() => setArtFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {/* Signature (SIG) badge */}
          {signature && !hidden && !locked && (
            <span
              className={`absolute bottom-0.5 left-0.5 flex items-center gap-0.5 rounded-full px-1 font-bold leading-none shadow ${
                rank > 0 ? 'bg-fuchsia-600/95 text-white ring-1 ring-fuchsia-200/80' : 'bg-slate-900/80 text-slate-400'
              } ${isSmall ? 'py-px text-[0.5rem]' : size === 'lg' ? 'py-1 text-xs' : 'py-0.5 text-[0.5625rem]'}`}
              title={signatureText}
            >
              <SignatureIcon color={rank > 0 ? '#fff' : '#94a3b8'} />
              {isSmall ? (rank > 0 ? ROMAN[rank] : '') : `SIG${rank > 0 ? ` ${ROMAN[rank]}` : ''}`}
            </span>
          )}
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
              <LockIcon className={size === 'lg' ? 'text-4xl' : 'text-2xl'} color="#e2e8f0" />
            </div>
          )}
        </div>

        {/* Name banner */}
        <div
          className={`font-display mt-1 text-center leading-tight text-slate-100 ${size === 'xs' || size === 'xm' ? 'truncate' : 'line-clamp-2'} ${dims.name}`}
          style={{ textShadow: '0 1px 0 #0f172a' }}
        >
          {hidden ? '???' : troop.name}
        </div>

        {/* Stats */}
        {!hidden && (
          <div className={`mt-0.5 flex items-center justify-around font-bold tabular-nums text-slate-100 ${dims.stats}`}>
            <span className="flex items-center gap-0.5" title="Attack"><AttackIcon />{formatStat(shown.attackPower)}</span>
            <span className="flex items-center gap-0.5" title="Health"><HealthIcon />{shown.maxLifespan}</span>
            {size !== 'xs' && <span className="flex items-center gap-0.5" title="Movement"><MoveIcon />{shown.movementRange}</span>}
          </div>
        )}

        {/* Abilities (the row keeps its height when empty so every card lines up) */}
        {!hidden && size !== 'xs' && (
          <div className={`mt-0.5 flex justify-center gap-1 text-slate-300 ${size === 'lg' ? 'min-h-4' : 'min-h-[0.6875rem]'}`}>
            {shown.abilities.filter(ability => ability !== 'rapidMovement').slice(0, 4).map(ability => (
              <span key={ability} title={`${ABILITIES[ability].name}: ${ABILITIES[ability].description}`}>
                <AbilityIcon ability={ability} className={size === 'lg' ? 'text-base' : 'text-[0.6875rem]'} />
              </span>
            ))}
          </div>
        )}
        {children}
      </div>

      {/* Cost gem */}
      {!hidden && (
        <span
          className={`font-display absolute -left-1.5 -top-1.5 flex items-center justify-center gap-0.5 rounded-full bg-amber-400 px-1 text-slate-900 shadow ring-2 ring-slate-900 ${dims.gem}`}
          title={`Costs ${shown.cost} gold to deploy`}
        >
          {size === 'lg' && <GoldIcon color="#0f172a" />}{shown.cost}
        </span>
      )}

      {/* Level badge */}
      {!hidden && !hideLevel && !locked && (
        <span
          className={`font-display absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-slate-900 px-1.5 text-white shadow ring-2 ${dims.gem}`}
          style={{ ['--tw-ring-color' as string]: rarity.text }}
          title={`Level ${level}`}
        >
          {size === 'xs' || size === 'xm' ? level : `Lv${level}`}
        </span>
      )}
    </Tag>
  );
};
