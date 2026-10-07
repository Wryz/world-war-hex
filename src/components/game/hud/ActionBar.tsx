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
  // Short instruction for the current action, if any
  hint: string | null;
  onUnitTypeSelect: (unitType: UnitType) => void;
  onEndTurn: () => void;
}

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
        <div className={`${PANEL_CLASS} px-5 py-2.5 flex items-center gap-3 text-sm`}>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold">Enemy is planning…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 inset-x-3 z-20 flex flex-col items-center gap-2 pointer-events-none">
      {hint && (
        <div className="rounded-full bg-slate-900/85 px-4 py-1.5 text-center text-xs font-semibold text-slate-100 shadow">
          {hint}
        </div>
      )}

      <div className={`${PANEL_CLASS} pointer-events-auto flex items-stretch gap-1.5 p-1.5`}>
        {RECRUITABLE.map(type => {
          const info = UNITS[type];
          const canAfford = gold >= info.cost;
          const isSelected = selectedUnitType === type;

          return (
            <div key={type} className="group relative">
              <button
                onClick={() => onUnitTypeSelect(type)}
                disabled={!canAfford && !isSelected}
                aria-pressed={isSelected}
                aria-label={`Recruit ${getUnitTypeName(type)} for ${info.cost} gold`}
                className={`flex h-full w-16 flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors
                  ${isSelected
                    ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-200'
                    : canAfford
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                      : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'}`}
              >
                <span className={`text-xl leading-none ${canAfford || isSelected ? '' : 'opacity-40'}`}>{getUnitTypeEmoji(type)}</span>
                <span className={`mt-1 text-xs font-bold ${isSelected ? '' : canAfford ? 'text-amber-300' : ''}`}>{info.cost}</span>
              </button>

              {/* Stats on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-40 -translate-x-1/2 rounded-lg bg-slate-900/95 p-2 text-xs text-slate-100 shadow-xl group-hover:block">
                <div className="font-bold">{getUnitTypeName(type)}</div>
                <div className="text-slate-400">{UNIT_ROLES[type]}</div>
                <div className="mt-1 flex justify-between">
                  <span>⚔️ {info.attackPower}</span>
                  <span>❤️ {info.maxLifespan}</span>
                  <span>👣 {info.movementRange}</span>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={onEndTurn}
          className="ml-1 shrink-0 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 text-sm font-bold text-slate-900 shadow"
        >
          End Turn ➜
        </button>
      </div>
    </div>
  );
};
