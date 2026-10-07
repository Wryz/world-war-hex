import React from 'react';
import { GameState, Hex, Unit } from '@/types/game';
import { TERRAIN_BONUS_ATTACK_MULTIPLIER, TERRAIN_EFFECTS } from '@/lib/game/gameState';
import { getUnitTypeEmoji, getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS, SIDE_COLORS } from './styles';
import { TERRAIN_ICONS } from './terrainInfo';

interface SelectionCardProps {
  gameState: GameState;
  selectedHex: Hex | null;
  selectedUnit: Unit | null;
}

// Details about the selected hex and the unit standing on it, including terrain effects
export const SelectionCard: React.FC<SelectionCardProps> = ({ gameState, selectedHex, selectedUnit }) => {
  if (!selectedHex) return null;

  // Always show the latest version of the unit on the hex
  const hex = gameState.hexGrid.find(
    h => h.coordinates.q === selectedHex.coordinates.q && h.coordinates.r === selectedHex.coordinates.r
  ) ?? selectedHex;
  const unit = hex.unit ?? selectedUnit ?? null;
  const effect = TERRAIN_EFFECTS[hex.terrain];
  const plannedMove = unit && gameState.pendingMoves.find(m => m.unitId === unit.id);

  const healthRatio = unit ? unit.lifespan / unit.maxLifespan : 0;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';
  const forestAttackBonus = unit && hex.terrain === 'forest' && unit.abilities.includes('terrainBonus');

  return (
    <div className={`${PANEL_CLASS} fixed left-3 top-24 z-20 w-64 p-3 text-sm`}>
      {unit && (
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold">
              {getUnitTypeEmoji(unit.type)} {getUnitTypeName(unit.type)}
            </div>
            <div
              className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ background: SIDE_COLORS[unit.owner] }}
            >
              {unit.owner === 'player' ? 'Yours' : 'Enemy'}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span>❤️</span>
            <div className="flex-1 h-2.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full" style={{ width: `${healthRatio * 100}%`, background: healthColor }} />
            </div>
            <span className="font-bold tabular-nums">{unit.lifespan}/{unit.maxLifespan}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <div className="rounded bg-slate-800 px-2 py-1">⚔️ Attack <b>{unit.attackPower}</b></div>
            <div className="rounded bg-slate-800 px-2 py-1">👣 Move <b>{unit.movementRange}</b></div>
          </div>

          {unit.owner === 'player' && gameState.currentPhase === 'planning' && (
            <div className="mt-2 text-xs text-slate-300">
              {unit.hasMoved
                ? 'Just deployed - can move next turn.'
                : plannedMove
                  ? '➜ Move planned. Click its destination to cancel.'
                  : 'Click a highlighted hex to plan a move.'}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg bg-slate-800/80 p-2">
        <div className="font-bold">
          {TERRAIN_ICONS[hex.terrain]} {effect.name}
          {hex.isResourceHex && <span className="text-amber-300"> · +{hex.resourceValue ?? 0} gold/round</span>}
        </div>
        <div className="text-xs text-slate-300 leading-snug">{effect.description}</div>
        {unit && (effect.damageTakenMultiplier < 1 || forestAttackBonus) && (
          <div className="mt-1 text-xs font-semibold text-emerald-300">
            {effect.damageTakenMultiplier < 1 && `Takes ${Math.round((1 - effect.damageTakenMultiplier) * 100)}% less damage here. `}
            {forestAttackBonus && `Attacks +${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% here.`}
          </div>
        )}
        {hex.isBase && (
          <div className="mt-1 text-xs font-semibold">
            👑 {hex.owner === 'player' ? 'Your castle - recruits deploy next to it.' : 'Enemy castle - move a unit onto it to win!'}
          </div>
        )}
      </div>
    </div>
  );
};
