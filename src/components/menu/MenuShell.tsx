import React from 'react';
import Link from 'next/link';
import { profilePower, totalStars, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { BackIcon, CoinIcon, PowerIcon, SatchelIcon, StarIcon } from '../game/icons';
import { haulSize } from '@/lib/game/materials';

// Chunky dark panel with a solid drop shadow, like a game card
export const CARD_CLASS = 'rounded-2xl bg-slate-900/90 text-slate-100 ring-1 ring-white/10 shadow-[0_6px_0_rgba(15,23,42,0.45)] backdrop-blur-sm';

export const PRIMARY_BUTTON =
  'font-display rounded-xl bg-amber-500 px-6 py-3 text-xl text-slate-900 shadow-[0_5px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-1 active:shadow-[0_1px_0_#b45309] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

export const SECONDARY_BUTTON =
  'font-display rounded-xl bg-slate-700 px-4 py-2 text-slate-100 shadow-[0_4px_0_#020617] transition-transform hover:-translate-y-0.5 hover:bg-slate-600 active:translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

// The sky behind every screen: one flat colour
export const SKY_COLOR = '#b3e1ff';
export const SKY_BACKGROUND = SKY_COLOR;

// The player's coins, army power and stars, shown in every menu
export const ResourceBadges: React.FC<{ className?: string }> = ({ className = '' }) => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  if (!hydrated) return <div className={className} />;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span id="hud-coins" className={`${CARD_CLASS} font-display flex items-center gap-1.5 px-3 py-1.5 text-lg text-yellow-300 sm:px-4 sm:py-2 sm:text-2xl`} title="Coins: spend them on cards and upgrades">
        <CoinIcon /> {profile.coins}
      </span>
      <span className={`${CARD_CLASS} font-display flex items-center gap-1.5 px-3 py-1.5 text-lg text-orange-300 sm:px-4 sm:py-2 sm:text-2xl`} title="Army power: the strength of your deck">
        <PowerIcon /> {profilePower(profile)}
      </span>
      <span className={`${CARD_CLASS} font-display hidden items-center gap-1.5 px-3 py-1.5 text-lg text-amber-200 sm:flex sm:px-4 sm:py-2 sm:text-2xl`} title="Campaign stars">
        <StarIcon /> {totalStars(profile)}
      </span>
      <Link href="/satchel" className={`${CARD_CLASS} font-display flex items-center gap-1.5 px-3 py-1.5 text-lg text-orange-200 transition-transform hover:-translate-y-0.5 sm:px-4 sm:py-2 sm:text-2xl`} title="Satchel: the materials you have gathered, and the Chronicle">
        <SatchelIcon /> {haulSize(profile.materials)}
      </Link>
    </div>
  );
};

interface MenuShellProps {
  title: string;
  icon?: React.ReactNode;
  // Where the back button goes
  backHref?: string;
  children: React.ReactNode;
  // Extra controls in the header
  actions?: React.ReactNode;
  wide?: boolean;
}

// Layout shared by the menu screens: sky background, a header with a back button, and the resources
export const MenuShell: React.FC<MenuShellProps> = ({ title, icon, backHref = '/', children, actions, wide = false }) => (
  <div className="min-h-screen w-full overflow-x-hidden" style={{ background: SKY_BACKGROUND }}>
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-sky-200/95 pb-4 pl-[calc(0.75rem+var(--safe-l))] pr-[calc(0.75rem+var(--safe-r))] pt-[calc(0.75rem+var(--safe-t))] backdrop-blur-[2px] sm:pl-[calc(1.5rem+var(--safe-l))] sm:pr-[calc(1.5rem+var(--safe-r))]">
      <Link
        href={backHref}
        className={`${SECONDARY_BUTTON} flex items-center gap-1 px-3 py-2 text-base`}
        aria-label="Back"
      >
        <BackIcon /> Back
      </Link>
      <h1
        className="font-display flex items-center gap-2 text-3xl text-amber-400 sm:text-4xl"
        style={{ WebkitTextStroke: '2px #0f172a', paintOrder: 'stroke fill', textShadow: '0 4px 0 #0f172a' }}
      >
        {icon}{title}
      </h1>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <ResourceBadges />
      </div>
    </header>
    <main className={`mx-auto pb-[calc(4rem+var(--safe-b))] pl-[calc(0.75rem+var(--safe-l))] pr-[calc(0.75rem+var(--safe-r))] sm:pl-[calc(1.5rem+var(--safe-l))] sm:pr-[calc(1.5rem+var(--safe-r))] ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>{children}</main>
  </div>
);
