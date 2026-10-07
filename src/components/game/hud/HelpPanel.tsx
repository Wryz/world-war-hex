import React from 'react';
import { CollapsiblePanel } from './CollapsiblePanel';
import { TERRAIN_ICONS, TERRAIN_ORDER, TERRAIN_SHORT_EFFECTS } from './terrainInfo';
import { TERRAIN_EFFECTS } from '@/lib/game/gameState';

// Short guide to the rules and terrain, open on the first visit and collapsible after that
export const HelpPanel: React.FC = () => (
  <CollapsiblePanel id="guide" title="❓ Guide" defaultOpen>
    <div className="flex flex-col gap-1">
      {TERRAIN_ORDER.map(terrain => (
        <div key={terrain} className="flex items-center gap-2">
          <span className="w-5 text-center text-sm">{TERRAIN_ICONS[terrain]}</span>
          <span className="font-semibold">{TERRAIN_EFFECTS[terrain].name}</span>
          <span className="ml-auto text-slate-400">{TERRAIN_SHORT_EFFECTS[terrain]}</span>
        </div>
      ))}
    </div>
    <div className="mt-2 border-t border-white/10 pt-2 leading-snug text-slate-300">
      Units next to enemies fight when a turn ends. Take the enemy 👑 castle, or besiege it from 3 hexes away.
    </div>
  </CollapsiblePanel>
);
