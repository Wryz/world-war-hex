import React from 'react';
import { CollapsiblePanel } from './CollapsiblePanel';
import { TERRAIN_ORDER, TERRAIN_SHORT_EFFECTS } from './terrainInfo';
import { TERRAIN_EFFECTS } from '@/lib/game/gameState';
import { CrownIcon, GoldIcon, HelpIcon, TerrainIcon } from '../icons';

// Short guide to the rules and terrain, open on the first visit and collapsible after that
export const HelpPanel: React.FC = () => (
  <CollapsiblePanel
    id="guide"
    title={<span className="flex items-center gap-1.5"><HelpIcon className="text-sm" /> Guide</span>}
    defaultOpen
  >
    <div className="flex flex-col gap-1">
      {TERRAIN_ORDER.map(terrain => (
        <div key={terrain} className="flex items-center gap-2">
          <TerrainIcon terrain={terrain} className="text-sm" />
          <span className="font-semibold">{TERRAIN_EFFECTS[terrain].name}</span>
          <span className="ml-auto text-slate-400">{TERRAIN_SHORT_EFFECTS[terrain]}</span>
        </div>
      ))}
    </div>
    <ul className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2 leading-snug text-slate-300">
      <li>Units in range fight automatically when a turn ends. Archers reach 2 hexes.</li>
      <li>Drag to rotate the view around the map, scroll to zoom.</li>
      <li className="flex gap-1"><GoldIcon className="mt-0.5" /> Earn gold from income, mines, destroying enemies and sieging.</li>
      <li className="flex gap-1"><CrownIcon className="mt-0.5" /> Take the enemy castle, or wear it down from 3 hexes away.</li>
    </ul>
  </CollapsiblePanel>
);
