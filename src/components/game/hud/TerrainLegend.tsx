import React, { useState } from 'react';
import { TERRAIN_EFFECTS } from '@/lib/game/gameState';
import { PANEL_CLASS } from './styles';
import { TERRAIN_ICONS, TERRAIN_ORDER } from './terrainInfo';

// Collapsible guide explaining how each terrain type affects units
export const TerrainLegend: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed left-3 bottom-4 z-20 hidden lg:block">
      {open ? (
        <div className={`${PANEL_CLASS} w-64 p-3 text-xs`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Terrain guide</div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200" title="Hide">✕</button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {TERRAIN_ORDER.map(terrain => {
              const effect = TERRAIN_EFFECTS[terrain];
              return (
                <li key={terrain} className="flex gap-2 leading-snug">
                  <span className="text-base leading-none">{TERRAIN_ICONS[terrain]}</span>
                  <span>
                    <b>{effect.name}</b>
                    <span className="text-slate-300"> - {effect.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className={`${PANEL_CLASS} px-3 py-2 text-xs font-bold`}>
          🗺️ Terrain guide
        </button>
      )}
    </div>
  );
};
