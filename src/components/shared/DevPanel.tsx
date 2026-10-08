'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MAX_CARD_LEVEL } from '@/lib/game/troops';
import { resetProfile, useProfile } from '@/lib/meta/profile';
import {
  DEV_COINS, devLockAllLevels, devOwnEverything, devResetCards, devSetAllLevels, devSetCoins, devUnlockAllLevels,
  isInfiniteCoins, setInfiniteCoins, topUpCoins, useDevMode
} from '@/lib/meta/devTools';

const BUTTON = 'rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-100 hover:bg-slate-600 active:translate-y-px';
const DANGER = 'rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-600 active:translate-y-px';

// Developer tools on a local copy of the game (see lib/meta/devTools): a small DEV button that opens
// shortcuts for coins, levels and cards. Hidden during battles and on the live site.
export const DevPanel: React.FC = () => {
  const devMode = useDevMode();
  const pathname = usePathname();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [infinite, setInfinite] = useState(false);
  const [allLevel, setAllLevel] = useState(10);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (devMode) setInfinite(isInfiniteCoins());
  }, [devMode]);

  // Infinite coins: top the purse back up after every purchase
  useEffect(() => {
    if (devMode) topUpCoins(profile);
  }, [devMode, profile]);

  if (!devMode || pathname?.startsWith('/play') || pathname?.startsWith('/dev')) return null;

  const run = (label: string, action: () => void) => () => {
    action();
    setDone(label);
    setTimeout(() => setDone(current => (current === label ? null : current)), 1500);
  };

  return (
    <div className="fixed bottom-20 left-3 z-[60] flex flex-col items-start gap-2">
      {open && (
        <div className="w-72 rounded-xl bg-slate-900/95 p-3 text-slate-100 shadow-2xl ring-1 ring-fuchsia-400/60">
          <div className="mb-2 flex items-center justify-between">
            <b className="font-display text-fuchsia-300">Dev tools</b>
            <span className="text-[0.625rem] text-slate-400">local only</span>
          </div>

          <div className="mb-1 text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Coins · {profile.coins.toLocaleString()}</div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button className={BUTTON} onClick={run('+10,000 coins', () => devSetCoins(profile.coins + 10_000))}>+10,000</button>
            <button className={BUTTON} onClick={run('Coins maxed', () => devSetCoins(DEV_COINS))}>Max</button>
            <button className={BUTTON} onClick={run('Coins zeroed', () => devSetCoins(0))}>Zero</button>
            <label className="flex items-center gap-1.5 text-xs font-bold">
              <input
                type="checkbox"
                className="accent-fuchsia-400"
                checked={infinite}
                onChange={event => {
                  setInfiniteCoins(event.target.checked);
                  setInfinite(event.target.checked);
                }}
              />
              Infinite
            </label>
          </div>

          <div className="mb-1 text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Campaign</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button className={BUTTON} onClick={run('All levels open', devUnlockAllLevels)}>Unlock all levels</button>
            <button className={BUTTON} onClick={run('Campaign reset', devLockAllLevels)}>Lock all</button>
          </div>

          <div className="mb-1 text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Cards</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button className={BUTTON} onClick={run('Everything owned', devOwnEverything)}>Own all</button>
            <button className={BUTTON} onClick={run('Cards reset', devResetCards)}>Reset cards</button>
          </div>
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-xs font-bold">Set all to level</span>
            <select
              value={allLevel}
              onChange={event => setAllLevel(Number(event.target.value))}
              className="rounded-md bg-slate-800 px-1.5 py-1 text-xs font-bold"
            >
              {Array.from({ length: MAX_CARD_LEVEL }, (_, i) => i + 1).map(level => <option key={level} value={level}>{level}</option>)}
            </select>
            <button className={BUTTON} onClick={run(`All at level ${allLevel}`, () => devSetAllLevels(allLevel))}>Apply</button>
          </div>

          <button
            className={DANGER}
            onClick={() => {
              if (window.confirm('Reset all progress? Coins, cards, levels and stats go back to a new game.')) run('Progress reset', resetProfile)();
            }}
          >
            Reset all progress
          </button>
          <p className="mt-2 text-[0.625rem] leading-snug text-slate-400">
            Each card in the Army also gets − and + buttons to set its level directly.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen(value => !value)}
        className="font-display rounded-full bg-fuchsia-600 px-3 py-1 text-xs text-white shadow-lg ring-2 ring-white/70 hover:bg-fuchsia-500"
        title="Developer tools (only on your local copy)"
      >
        {done ?? 'DEV'}
      </button>
    </div>
  );
};
