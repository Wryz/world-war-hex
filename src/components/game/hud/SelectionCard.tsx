import React from 'react';
import { GameState, Hex, Unit } from '@/types/game';
import { BASE_MAX_HEALTH, TERRAIN_BONUS_ATTACK_MULTIPLIER, TERRAIN_EFFECTS } from '@/lib/game/gameState';
import { getUnitTypeEmoji, getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS, SIDE_COLORS } from './styles';
import { TERRAIN_ICONS, TERRAIN_SHORT_EFFECTS } from './terrainInfo';

interface SelectionCardProps {
  gameState: GameState;
  selectedHex: Hex | null;
  selectedUnit: Unit | null;
}

const HealthBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const ratio = max > 0 ? Math.max(0, value) / max : 0;
  const color = ratio > 0.6 ? '#22c55e' : ratio > 0.3 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
        <div className="h-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="font-bold tabular-nums">{value}/{max}</span>
    </div>
  );
};

// Compact details for the selected unit or castle
export const SelectionCard: React.FC<SelectionCardProps> = ({ gameState, selectedHex, selectedUnit }) => {
  if (!selectedHex) return null;

  // Always show the latest version of what's on the hex
  const hex = gameState.hexGrid.find(
    h => h.coordinates.q === selectedHex.coordinates.q && h.coordinates.r === selectedHex.coordinates.r
  ) ?? selectedHex;
  const unit = hex.unit ?? selectedUnit ?? null;

  // Plain hexes are described by the hover tooltip; the card is only for units and castles
  if (!unit && !hex.isBase) return null;

  const effect = TERRAIN_EFFECTS[hex.terrain];
  const terrainBonuses: string[] = [];
  if (unit && effect.damageTakenMultiplier < 1) {
    terrainBonuses.push(`-${Math.round((1 - effect.damageTakenMultiplier) * 100)}% dmg`);
  }
  if (unit && hex.terrain === 'forest' && unit.abilities.includes('terrainBonus')) {
    terrainBonuses.push(`+${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% atk`);
  }
  if (hex.isResourceHex) terrainBonuses.push(`+${hex.resourceValue ?? 0} gold`);

  return (
    <div className={`${PANEL_CLASS} pointer-events-auto w-56 p-3 text-xs`}>
      {unit ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{getUnitTypeEmoji(unit.type)} {getUnitTypeName(unit.type)}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: SIDE_COLORS[unit.owner] }}
            >
              {unit.owner === 'player' ? 'You' : 'Enemy'}
            </span>
          </div>
          <div className="mt-2"><HealthBar value={unit.lifespan} max={unit.maxLifespan} /></div>
          <div className="mt-2 flex gap-3 text-slate-200">
            <span title="Attack">⚔️ <b>{unit.attackPower}</b></span>
            <span title="Movement">👣 <b>{unit.movementRange}</b></span>
            <span className="ml-auto text-slate-400" title={effect.description}>
              {TERRAIN_ICONS[hex.terrain]} {terrainBonuses.length > 0 ? terrainBonuses.join(' · ') : effect.name}
            </span>
          </div>
          {unit.owner === 'player' && unit.hasMoved && gameState.currentPhase === 'planning' && (
            <div className="mt-2 text-slate-400">Just deployed · moves next turn</div>
          )}
        </>
      ) : (
        <>
          <div className="text-sm font-bold">👑 {hex.owner === 'player' ? 'Your castle' : 'Enemy castle'}</div>
          <div className="mt-2">
            <HealthBar value={hex.baseHealth ?? BASE_MAX_HEALTH} max={BASE_MAX_HEALTH} />
          </div>
          <div className="mt-2 text-slate-400">
            {hex.owner === 'player' ? 'Recruits deploy next to it' : 'Move a unit onto it to win'}
          </div>
        </>
      )}
      {!unit && hex.terrain !== 'plain' && (
        <div className="mt-1 text-slate-400">{TERRAIN_ICONS[hex.terrain]} {TERRAIN_SHORT_EFFECTS[hex.terrain]}</div>
      )}
    </div>
  );
};
