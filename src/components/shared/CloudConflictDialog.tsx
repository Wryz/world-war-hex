'use client';

import React from 'react';
import { SaveSummary, resolveConflict, useCloudSave } from '@/lib/cloudSave';
import { CARD_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../menu/MenuShell';
import { CloudIcon, CoinIcon, StarIcon } from '../game/icons';

const SaveColumn: React.FC<{ title: string; save: SaveSummary }> = ({ title, save }) => (
  <div className="rounded-xl bg-slate-800 p-3 text-sm">
    <div className="font-display text-lg text-slate-100">{title}</div>
    <div className="mt-1 text-slate-300">Level {save.cleared} cleared</div>
    <div className="flex items-center gap-1 text-slate-300"><StarIcon /> {save.stars} stars</div>
    <div className="flex items-center gap-1 text-slate-300"><CoinIcon /> {save.coins} coins</div>
    <div className="text-slate-300">{save.battles} battles</div>
    <div className="mt-1 text-xs text-slate-400">Changed {new Date(save.changedAt).toLocaleString()}</div>
  </div>
);

// When this device and the cloud have both made progress since they last agreed, the player picks
// which save to keep (shown over any screen)
export const CloudConflictDialog: React.FC = () => {
  const { conflict } = useCloudSave();
  if (!conflict) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal aria-labelledby="cloud-conflict-title">
      <div className={`${CARD_CLASS} w-full max-w-md p-5`}>
        <h2 id="cloud-conflict-title" className="font-display flex items-center gap-2 text-2xl text-amber-300"><CloudIcon /> Which save?</h2>
        <p className="mt-1 text-sm text-slate-300">
          This device and your cloud save have both changed. Choose the one to keep - the other is replaced.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SaveColumn title="This device" save={conflict.device} />
          <SaveColumn title="Cloud" save={conflict.remote} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => { void resolveConflict('device'); }} className={`${SECONDARY_BUTTON} text-base`}>Keep this device&apos;s</button>
          <button onClick={() => { void resolveConflict('cloud'); }} className={`${PRIMARY_BUTTON} px-3 py-2 text-base`}>Use the cloud&apos;s</button>
        </div>
      </div>
    </div>
  );
};
