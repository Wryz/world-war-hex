import React from 'react';
import { TroopStats, UnitType } from '@/types/game';
import { ABILITIES, FACTIONS, Rarity, TROOPS, TROOP_CLASSES, cardStats } from '@/lib/game/troops';
import { AbilityIcon, AttackIcon, GoldIcon, HealthIcon, LockIcon, MoveIcon, UnitIcon } from '../icons';
import { CardSkinId, getCardSkin } from '@/lib/meta/cosmetics';
import { useProfile } from '@/lib/meta/profile';

// A troop as a playing card: cost gem, level badge, art, name banner, stats and abilities.
// Used for the hand in battle, the army and shop, and the bestiary.

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

export const RARITY_STYLES: Record<Rarity, { frame: string; label: string; text: string }> = {
  common: { frame: 'linear-gradient(160deg, #e2e8f0, #64748b)', label: 'Common', text: '#cbd5e1' },
  rare: { frame: 'linear-gradient(160deg, #7dd3fc, #1d4ed8)', label: 'Rare', text: '#7dd3fc' },
  epic: { frame: 'linear-gradient(160deg, #e9d5ff, #7e22ce)', label: 'Epic', text: '#d8b4fe' },
  legendary: { frame: 'linear-gradient(160deg, #fef08a, #d97706 55%, #fde68a)', label: 'Legendary', text: '#fcd34d' },
  boss: { frame: 'linear-gradient(160deg, #fca5a5, #991b1b 55%, #450a0a)', label: 'Boss', text: '#fca5a5' }
};

const SIZES: Record<CardSize, { width: number; icon: string; name: string; stats: string; gem: string; pad: string }> = {
  xs: { width: 64, icon: 'text-2xl', name: 'text-[8px]', stats: 'text-[9px]', gem: 'h-4 min-w-4 text-[9px]', pad: 'p-[3px]' },
  sm: { width: 88, icon: 'text-4xl', name: 'text-[10px]', stats: 'text-[10px]', gem: 'h-5 min-w-5 text-[11px]', pad: 'p-1' },
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

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      title={title ?? (hidden ? 'Undiscovered' : `${troop.name} (${TROOP_CLASSES[troop.troopClass].name}) - ${troop.role}`)}
      aria-pressed={onClick ? selected : undefined}
      className={`group relative block shrink-0 select-none rounded-xl text-left transition-transform duration-150 ${
        isInteractive ? 'cursor-pointer hover:-translate-y-2 focus:outline-none focus-visible:-translate-y-2' : ''
      } ${selected ? '-translate-y-3' : ''} ${troop.rarity === 'legendary' && !hidden ? 'card-shine overflow-hidden' : ''} ${className}`}
      style={{
        width: dims.width,
        aspectRatio: '5 / 7',
        background: hidden ? 'linear-gradient(160deg, #475569, #1e293b)' : rarity.frame,
        padding: size === 'xs' ? 2 : 3,
        boxShadow: selected
          ? '0 0 0 3px #fde047, 0 12px 24px rgba(0,0,0,0.45)'
          : '0 5px 0 rgba(15, 23, 42, 0.55), 0 8px 18px rgba(0,0,0,0.3)',
        filter: disabled ? 'grayscale(0.85) brightness(0.7)' : undefined
      }}
    >
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-[9px] ${dims.pad}`}
        style={{ background: hidden ? '#0f172a' : face.face, boxShadow: hidden ? undefined : `inset 0 0 0 1px ${face.trim}` }}
      >
        {/* Art */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md"
          style={{
            background: hidden
              ? 'radial-gradient(circle at 50% 40%, #334155, #0f172a)'
              : `radial-gradient(circle at 50% 38%, ${faction.color}cc, ${faction.color}33 60%, #0f172a 100%)`
          }}
        >
          {/* Faint diagonal pattern so the art area reads as a printed card */}
          <div
            className={`absolute inset-0 ${face.animated && !hidden ? 'card-holo' : ''}`}
            style={{ background: hidden ? getCardSkin('classic').pattern : face.pattern, opacity: hidden ? 0.15 : face.patternOpacity }}
          />
          {hidden ? (
            <span className={`font-display ${dims.icon} text-slate-500`}>?</span>
          ) : (
            <UnitIcon type={type} color="#fff" className={`${dims.icon} drop-shadow-[0_3px_0_rgba(15,23,42,0.6)] transition-transform group-hover:scale-110`} />
          )}
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
              <LockIcon className={size === 'lg' ? 'text-4xl' : 'text-2xl'} color="#e2e8f0" />
            </div>
          )}
        </div>

        {/* Name banner */}
        <div
          className={`font-display mt-1 truncate text-center leading-tight text-slate-100 ${dims.name}`}
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
          <div className={`mt-0.5 flex justify-center gap-1 text-slate-300 ${size === 'lg' ? 'min-h-4' : 'min-h-[11px]'}`}>
            {shown.abilities.filter(ability => ability !== 'rapidMovement').slice(0, 4).map(ability => (
              <span key={ability} title={`${ABILITIES[ability].name}: ${ABILITIES[ability].description}`}>
                <AbilityIcon ability={ability} className={size === 'lg' ? 'text-base' : 'text-[11px]'} />
              </span>
            ))}
          </div>
        )}
        {size === 'lg' && !hidden && (
          <div className="mt-1 text-center text-[11px] leading-tight text-slate-400">
            <span className="font-bold text-slate-300">{TROOP_CLASSES[troop.troopClass].name}</span> · {troop.role}
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
          {size === 'xs' ? level : `Lv${level}`}
        </span>
      )}
    </Tag>
  );
};
