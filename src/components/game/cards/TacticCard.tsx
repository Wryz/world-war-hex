import React from 'react';
import { TACTICS, TacticId } from '@/lib/game/tactics';
import { LockIcon, TACTIC_COLORS, TacticIcon } from '../icons';

// A tactic card: picture, name and level, and (on bigger cards) what it does. Used in the battle
// hand, the pre-battle picker and the Army.

export type TacticCardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<TacticCardSize, { width: number; icon: string; name: string; text: string; badge: string }> = {
  xs: { width: 48, icon: 'text-xl', name: 'text-[0.5rem]', text: 'hidden', badge: 'h-4 min-w-4 text-[0.5rem]' },
  sm: { width: 64, icon: 'text-2xl', name: 'text-[0.5625rem]', text: 'hidden', badge: 'h-4 min-w-4 text-[0.5625rem]' },
  md: { width: 112, icon: 'text-4xl', name: 'text-xs', text: 'text-[0.625rem]', badge: 'h-5 min-w-5 text-[0.6875rem]' },
  lg: { width: 200, icon: 'text-6xl', name: 'text-base', text: 'text-xs', badge: 'h-7 min-w-7 text-sm' }
};

interface TacticCardProps {
  id: TacticId;
  level?: number;
  size?: TacticCardSize;
  selected?: boolean;
  disabled?: boolean;
  locked?: boolean;
  // Stretch to the width of its grid cell
  fill?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

export const TacticCard: React.FC<TacticCardProps> = ({
  id, level = 1, size = 'md', selected = false, disabled = false, locked = false, fill = false, onClick, title, className = ''
}) => {
  const tactic = TACTICS[id];
  const color = TACTIC_COLORS[id];
  const dims = SIZES[size];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-pressed={onClick ? selected : undefined}
      title={title ?? `${tactic.name}: ${tactic.describe(level)}`}
      className={`group relative block shrink-0 select-none rounded-xl text-left transition-transform duration-150 ${
        onClick && !disabled ? 'cursor-pointer hover:-translate-y-2 focus:outline-none focus-visible:-translate-y-2' : ''
      } ${selected ? '-translate-y-3' : ''} ${className}`}
      style={{
        width: fill ? '100%' : `${dims.width / 16}rem`,
        aspectRatio: '5 / 7',
        background: color,
        padding: size === 'sm' || size === 'xs' ? 2 : 3,
        boxShadow: selected
          ? '0 0 0 3px #fde047, 0 12px 24px rgba(0,0,0,0.45)'
          : '0 5px 0 rgba(15, 23, 42, 0.55), 0 8px 18px rgba(0,0,0,0.3)',
        filter: disabled ? 'grayscale(0.85) brightness(0.7)' : undefined
      }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[9px] bg-slate-900 p-1">
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md"
          style={{ background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${color} 70%, #fff) 0%, color-mix(in srgb, ${color} 55%, #0f172a) 70%)` }}
        >
          <TacticIcon id={id} color="#fff" className={`${dims.icon} drop-shadow-[0_3px_0_rgba(15,23,42,0.6)] transition-transform group-hover:scale-110`} />
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
              <LockIcon className={size === 'lg' ? 'text-4xl' : 'text-2xl'} color="#e2e8f0" />
            </div>
          )}
        </div>
        <div className={`font-display mt-1 text-center leading-tight text-slate-100 ${size === 'sm' || size === 'xs' ? 'truncate' : 'line-clamp-2'} ${dims.name}`}>
          {tactic.name}
        </div>
        {(size === 'md' || size === 'lg') && (
          <p className={`mt-0.5 text-center leading-snug text-slate-300 ${dims.text} ${size === 'md' ? 'line-clamp-3' : ''}`}>
            {tactic.describe(level)}
          </p>
        )}
      </div>
      {!locked && (
        <span
          className={`font-display absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-slate-900 px-1.5 text-white shadow ring-2 ring-white/70 ${dims.badge}`}
          title={`Level ${level}`}
        >
          {size === 'sm' || size === 'xs' ? level : `Lv${level}`}
        </span>
      )}
    </Tag>
  );
};
