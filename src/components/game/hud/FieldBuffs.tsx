import React, { useEffect, useMemo, useState } from 'react';
import type { GameState, HexCoordinates } from '@/types/game';
import { FieldBuff, getFieldBuffs } from '@/lib/game/fieldBuffs';
import { CollapsiblePanel } from './CollapsiblePanel';
import { AttackIcon, BondIcon, CampIcon, ChevronIcon, CrownIcon, TerrainIcon, UnitIcon } from '../icons';
import type { UnitType } from '@/types/game';

const BuffIcon: React.FC<{ buff: FieldBuff }> = ({ buff }) => {
  if (buff.bondCards) {
    return (
      <span className="flex items-center">
        <UnitIcon type={buff.bondCards[0] as UnitType} /><BondIcon className="text-[10px]" /><UnitIcon type={buff.bondCards[1] as UnitType} />
      </span>
    );
  }
  if (buff.terrain) return <TerrainIcon terrain={buff.terrain} />;
  if (buff.id === 'camps') return <CampIcon />;
  if (buff.id === 'breach') return <CrownIcon />;
  return <AttackIcon />;
};

// The advantages on the field, down the left of the battle: tap one to see how to use it and where
// it is on the board
export const FieldBuffs: React.FC<{
  gameState: GameState;
  onShowHexes: (hexes: HexCoordinates[] | null) => void;
  defaultOpen?: boolean;
}> = ({ gameState, onShowHexes, defaultOpen = true }) => {
  const buffs = useMemo(
    () => getFieldBuffs(gameState, 'player'),
    // Only changes when troops move, camps change hands or castles are hit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.players, gameState.hexGrid, gameState.bonds]
  );
  return (
    <CollapsiblePanel
      id="field-buffs"
      title="Field buffs"
      defaultOpen={defaultOpen}
      className="w-56"
      collapsedPreview={
        <div className="flex flex-wrap gap-1.5 text-sm">
          {buffs.map(buff => <span key={buff.id} title={buff.name}><BuffIcon buff={buff} /></span>)}
        </div>
      }
    >
      <BuffList buffs={buffs} onShowHexes={onShowHexes} />
    </CollapsiblePanel>
  );
};

// The buffs, each opening to show how to use it (and outlining where it is while open)
const BuffList: React.FC<{ buffs: FieldBuff[]; onShowHexes: (hexes: HexCoordinates[] | null) => void }> = ({ buffs, onShowHexes }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = buffs.find(buff => buff.id === openId) ?? null;
  // Stop outlining when the panel is collapsed
  useEffect(() => () => onShowHexes(null), [onShowHexes]);

  const toggle = (buff: FieldBuff) => {
    const next = openId === buff.id ? null : buff;
    setOpenId(next?.id ?? null);
    onShowHexes(next && next.hexes.length > 0 ? next.hexes : null);
  };

  return (
    <ul className="flex flex-col gap-1">
      {buffs.map(buff => {
        const isOpen = open?.id === buff.id;
        return (
          <li key={buff.id} className={`rounded-lg ${isOpen ? 'bg-slate-800 ring-1 ring-amber-300/60' : buff.id === 'breach' ? 'bg-amber-400/15' : 'bg-slate-800/60'}`}>
            <button
              onClick={() => toggle(buff)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-slate-700/50 rounded-lg"
            >
              <span className="shrink-0 text-sm"><BuffIcon buff={buff} /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-slate-100">{buff.name}</b>
                <span className="block truncate text-[10px] text-slate-400">{buff.short}</span>
              </span>
              {buff.using > 0 && (
                <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300" title="Yours using it now">
                  {buff.using}
                </span>
              )}
              <ChevronIcon className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="px-2 pb-2 text-[11px] leading-snug text-slate-300">
                  <p className="font-semibold text-amber-200">{buff.short}</p>
                  <p className="mt-1">{buff.howTo}</p>
                  {buff.hexes.length > 0 && <p className="mt-1 text-[10px] text-amber-300/80">Outlined in gold on the board</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
  );
};
