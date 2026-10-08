import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ABILITIES, FACTIONS, Faction, MOB_IDS, TROOPS, TroopId } from '@/lib/game/troops';
import { REGIONS } from '@/lib/campaign/levels';
import { useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { TroopCard } from '../game/cards/TroopCard';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { AbilityIcon, BookIcon, CloseIcon, SkullIcon } from '../game/icons';
import { CounterLine } from '../game/hud/SelectionCard';

// The 3D viewer needs WebGL, so it only renders in the browser
const TroopModelViewer = dynamic(() => import('./TroopModelViewer'), { ssr: false });

const ENEMY_FACTIONS = Object.keys(FACTIONS).filter(f => f !== 'kingdom') as Faction[];

// Region where a faction is first met
const regionOf = (faction: Faction) => REGIONS.find(region => region.faction === faction);

const MobDetail: React.FC<{ id: TroopId; onClose: () => void }> = ({ id, onClose }) => {
  const profile = useProfile();
  const troop = TROOPS[id];
  const entry = profile.bestiary[id];
  const region = regionOf(troop.faction);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className={`${CARD_CLASS} animate-fadeIn relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl`}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-label={troop.name}
      >
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Close">
          <CloseIcon className="text-lg" />
        </button>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex justify-center sm:block">
            <TroopCard type={id} size="lg" hideLevel />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: FACTIONS[troop.faction].color }}>
              {FACTIONS[troop.faction].name}{troop.isBoss ? ' · Boss' : ''}
            </div>
            <h2 className="font-display text-3xl">{troop.name}</h2>
            <p className="mt-2 text-sm italic leading-relaxed text-slate-300">{troop.lore}</p>
            <CounterLine type={id} />
            <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-snug text-slate-300">
              {troop.abilities.map(ability => (
                <li key={ability} className="flex gap-1.5"><AbilityIcon ability={ability} className="mt-0.5" /><span><b>{ABILITIES[ability].name}:</b> {ABILITIES[ability].description}</span></li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-800 px-2 py-1">Met {entry?.seen ?? 0} times</span>
              <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1"><SkullIcon /> {entry?.slain ?? 0} slain</span>
              {region && <span className="rounded-full bg-slate-800 px-2 py-1">Found in {region.name}</span>}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <TroopModelViewer type={id} owner="ai" />
        </div>
      </div>
    </div>
  );
};

// Every monster in the realm: the ones you have met are revealed, the rest wait in the dark
export const BestiaryScreen: React.FC = () => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const [faction, setFaction] = useState<Faction | 'all'>('all');
  const [selected, setSelected] = useState<TroopId | null>(null);
  useMusic('menu');

  const discovered = MOB_IDS.filter(id => (profile.bestiary[id]?.seen ?? 0) > 0);
  const shown = MOB_IDS.filter(id => faction === 'all' || TROOPS[id].faction === faction);

  return (
    <MenuShell title="Bestiary" icon={<BookIcon />} wide>
      <div className={`${CARD_CLASS} flex flex-wrap items-center gap-3 p-4`}>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl">{hydrated ? discovered.length : 0} / {MOB_IDS.length} discovered</div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400" style={{ width: `${(hydrated ? discovered.length : 0) / MOB_IDS.length * 100}%` }} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Meet a monster on the battlefield to add it here. Tap a card to see it up close.</p>
        </div>
      </div>

      {/* Faction filter */}
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Faction">
        {(['all', ...ENEMY_FACTIONS] as const).map(option => (
          <button
            key={option}
            role="tab"
            aria-selected={faction === option}
            onClick={() => setFaction(option)}
            className={`rounded-full px-3 py-1 text-sm font-bold shadow transition-colors ${
              faction === option ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {option === 'all' ? 'All' : FACTIONS[option].name}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shown.map(id => {
          const seen = hydrated && (profile.bestiary[id]?.seen ?? 0) > 0;
          return (
            <div key={id} className="flex flex-col items-center gap-2">
              <TroopCard
                type={id}
                size="md"
                hidden={!seen}
                hideLevel
                onClick={seen ? () => setSelected(id) : undefined}
                title={seen ? TROOPS[id].name : `Undiscovered - roams ${regionOf(TROOPS[id].faction)?.name ?? 'somewhere'}`}
              />
              <span className="rounded-full bg-slate-900/75 px-2.5 py-0.5 text-center text-xs font-semibold text-slate-200">
                {seen ? `${profile.bestiary[id]?.slain ?? 0} slain` : regionOf(TROOPS[id].faction)?.name}
              </span>
            </div>
          );
        })}
      </div>

      {selected && <MobDetail id={selected} onClose={() => setSelected(null)} />}
    </MenuShell>
  );
};
