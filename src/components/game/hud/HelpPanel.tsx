import React, { useMemo } from 'react';
import { Hex } from '@/types/game';
import { CollapsiblePanel } from './CollapsiblePanel';
import { TERRAIN_ORDER, TERRAIN_SHORT_EFFECTS } from './terrainInfo';
import { FREE_UPKEEP_UNITS, TERRAIN_EFFECTS, UPKEEP_PER_UNIT } from '@/lib/game/gameState';
import { AttackIcon, CampIcon, CrownIcon, FogIcon, GoldIcon, HelpIcon, TerrainIcon, ThreatIcon } from '../icons';

interface HelpPanelProps {
  hexGrid: Hex[];
  // Whether this battle is fought in the fog of war
  fog?: boolean;
  mapName?: string;
}

// Short guide to the rules and this map's terrain, open on the first visit and collapsible after that
export const HelpPanel: React.FC<HelpPanelProps> = ({ hexGrid, mapName, fog = false }) => {
  // Only explain the terrain this map actually has
  const terrainKey = hexGrid.map(hex => hex.terrain).join();
  const terrains = useMemo(() => {
    const present = new Set(terrainKey.split(','));
    return TERRAIN_ORDER.filter(terrain => present.has(terrain));
  }, [terrainKey]);

  return (
    <CollapsiblePanel
      id="guide"
      title={<span className="flex items-center gap-1.5"><HelpIcon className="text-sm" /> Guide{mapName ? ` · ${mapName}` : ''}</span>}
      defaultOpen
    >
      <div className="flex flex-col gap-1">
        {terrains.map(terrain => (
          <div key={terrain} className="flex items-center gap-2">
            <TerrainIcon terrain={terrain} className="text-sm" />
            <span className="font-semibold">{TERRAIN_EFFECTS[terrain].name}</span>
            <span className="ml-auto text-slate-400">{TERRAIN_SHORT_EFFECTS[terrain]}</span>
          </div>
        ))}
      </div>
      <ul className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2 leading-snug text-slate-300">
        <li>Units in range fight automatically when a turn ends. Archers and Mages reach 2 hexes (3 from high ground).</li>
        <li className="flex gap-1"><TerrainIcon terrain="hills" className="mt-0.5" /> Height matters: attacking downhill hits 25% harder per level, uphill 25% weaker. Ridges and forests block arrows from below.</li>
        <li className="flex gap-1"><AttackIcon className="mt-0.5" /> Every troop counters another - check Strong vs / Weak vs on each unit.</li>
        <li>Stepping next to an enemy ends a move (fliers pass over). Each extra ally next to a target adds +25% damage, up to +50%.</li>
        <li className="flex gap-1"><ThreatIcon className="mt-0.5" /> Press T (or the crosshair) to see where enemies can strike next turn.</li>
        {fog && <li className="flex gap-1"><FogIcon className="mt-0.5" /> Fog of war: you only see enemies your troops can see - further from hills, and only from the next hex in a forest. Troops that attack give themselves away.</li>}
        <li>Drag to rotate the view around the map, scroll to zoom.</li>
        <li className="flex gap-1"><GoldIcon className="mt-0.5" /> Earn gold from income, mines, camps, bounties and sieging. Armies over {FREE_UPKEEP_UNITS} units cost {UPKEEP_PER_UNIT} gold each per turn.</li>
        <li className="flex gap-1"><CampIcon className="mt-0.5" /> Capture a camp by moving onto it, then recruit troops there too.</li>
        <li className="flex gap-1"><CrownIcon className="mt-0.5" /> Wear the enemy castle down from 3 hexes away; once its walls are breached (half health), storm it.</li>
      </ul>
    </CollapsiblePanel>
  );
};
