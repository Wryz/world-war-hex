import React from 'react';
import { UnitType } from '@/types/game';
import { UNITS } from '@/lib/game/gameState';
import { getUnitTypeEmoji, getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS } from './styles';

// Unit types offered in the barracks
const RECRUITABLE: UnitType[] = ['infantry', 'artillery', 'helicopter', 'tank'];

const UNIT_ROLES: Record<UnitType, string> = {
  infantry: 'Cheap all-rounder',
  artillery: 'Hits hard, fragile',
  helicopter: 'Fast cavalry',
  tank: 'Tough, strong in forest',
  medic: 'Support'
};

interface ActionBarProps {
  gold: number;
  isAITurn: boolean;
  selectedUnitType: UnitType | null;
  hint: string;
  onUnitTypeSelect: (unitType: UnitType) => void;
  onEndTurn: () => void;
}

const Stat: React.FC<{ icon: string; value: number; label: string }> = ({ icon, value, label }) => (
  <span className="flex items-center gap-0.5" title={label}>
    <span>{icon}</span>
    <span className="font-bold">{value}</span>
  </span>
);

// Bottom bar during planning: recruit units and end the turn
export const ActionBar: React.FC<ActionBarProps> = ({
  gold,
  isAITurn,
  selectedUnitType,
  hint,
  onUnitTypeSelect,
  onEndTurn
}) => {
  if (isAITurn) {
    return (
      <div className="fixed bottom-4 inset-x-0 z-20 flex justify-center pointer-events-none">
        <div className={`${PANEL_CLASS} px-6 py-3 flex items-center gap-3`}>
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold">The enemy is planning their moves…</span>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* What to do next - shown at the top so it never covers the castle */}
    <div className="fixed top-24 inset-x-0 z-20 flex justify-center pointer-events-none px-4 lg:px-80">
      <div className="rounded-full bg-slate-900/80 px-4 py-1.5 text-center text-sm text-slate-100 shadow">
        {hint}
      </div>
    </div>
    <div className="fixed bottom-3 inset-x-3 z-20 flex flex-col items-center gap-2 pointer-events-none">

      <div className={`${PANEL_CLASS} pointer-events-auto flex items-stretch gap-2 p-2 max-w-full overflow-x-auto`}>
        <div className="hidden sm:flex flex-col justify-center px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Recruit
        </div>
        {RECRUITABLE.map(type => {
          const info = UNITS[type];
          const canAfford = gold >= info.cost;
          const isSelected = selectedUnitType === type;

          return (
            <button
              key={type}
              onClick={() => onUnitTypeSelect(type)}
              disabled={!canAfford && !isSelected}
              aria-pressed={isSelected}
              title={`${getUnitTypeName(type)}: ${UNIT_ROLES[type]}`}
              className={`flex flex-col items-start gap-0.5 rounded-lg px-3 py-1.5 text-left text-xs w-32 shrink-0 transition-colors
                ${isSelected
                  ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-200'
                  : canAfford
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                    : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'}`}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-sm font-bold">{getUnitTypeEmoji(type)} {getUnitTypeName(type)}</span>
              </span>
              <span className={`font-bold ${isSelected ? 'text-slate-900' : canAfford ? 'text-amber-300' : ''}`}>
                💰 {info.cost}
              </span>
              <span className="flex gap-2">
                <Stat icon="⚔️" value={info.attackPower} label="Attack" />
                <Stat icon="❤️" value={info.maxLifespan} label="Health" />
                <Stat icon="👣" value={info.movementRange} label="Movement" />
              </span>
            </button>
          );
        })}

        <button
          onClick={onEndTurn}
          className="ml-1 shrink-0 rounded-lg bg-amber-500 hover:bg-amber-400 px-5 text-base font-bold text-slate-900 shadow"
        >
          End Turn ➜
        </button>
      </div>
    </div>
    </>
  );
};
