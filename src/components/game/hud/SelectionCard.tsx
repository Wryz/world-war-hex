import React from 'react';
import { GameState, Hex, Unit, UnitType } from '@/types/game';
import { ABILITIES, TROOP_CLASSES, getTroopClass, strongAgainst, weakAgainst } from '@/lib/game/troops';
import {
  BASE_MAX_HEALTH, HIGH_GROUND_ELEVATION, TERRAIN_BONUS_ATTACK_MULTIPLIER, TERRAIN_EFFECTS, canStormCastle,
  getSightRange, isFogOfWar,
  getCastleMaxHealth
} from '@/lib/game/gameState';
import { getUnitTypeName } from '../utils/UnitHelpers';
import { describeBonus, getBond } from '@/lib/game/bonds';
import { PANEL_CLASS, SIDE_COLORS } from './styles';
import { TERRAIN_SHORT_EFFECTS } from './terrainInfo';
import { AbilityIcon, AttackIcon, CampIcon, CrownIcon, MoveIcon, TerrainIcon, UnitIcon, BondIcon, FogIcon } from '../icons';

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

// Which classes of troop a unit type is strong and weak against
export const CounterLine: React.FC<{ type: UnitType }> = ({ type }) => {
  const troopClass = getTroopClass(type);
  const strong = strongAgainst(troopClass);
  const weak = weakAgainst(troopClass);
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      <span className="font-bold text-slate-300">{TROOP_CLASSES[troopClass].name}</span>
      {strong.length > 0 && (
        <span className="text-emerald-300">Strong vs {strong.map(c => TROOP_CLASSES[c].plural).join(', ')}</span>
      )}
      {weak.length > 0 && (
        <span className="text-rose-300">Weak vs {weak.map(c => TROOP_CLASSES[c].plural).join(', ')}</span>
      )}
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

  // Plain hexes are described by the hover tooltip; the card is only for units, castles and camps
  if (!unit && !hex.isBase && !hex.isCamp) return null;

  const effect = TERRAIN_EFFECTS[hex.terrain];
  const terrainBonuses: string[] = [];
  if (unit && effect.damageTakenMultiplier < 1) {
    terrainBonuses.push(`-${Math.round((1 - effect.damageTakenMultiplier) * 100)}% dmg`);
  }
  if (unit && hex.terrain === 'forest' && unit.abilities.includes('terrainBonus')) {
    terrainBonuses.push(`+${Math.round((TERRAIN_BONUS_ATTACK_MULTIPLIER - 1) * 100)}% atk`);
  }
  if (unit && effect.elevation >= HIGH_GROUND_ELEVATION) terrainBonuses.push('high ground');
  if (unit && effect.elevation < 1) terrainBonuses.push('low ground');
  if (unit && effect.healPerTurn) terrainBonuses.push(`+${effect.healPerTurn} HP/turn`);
  if (hex.isResourceHex) terrainBonuses.push(`+${hex.resourceValue ?? 0} gold`);

  return (
    <div className={`${PANEL_CLASS} pointer-events-auto w-56 p-3 text-xs`}>
      {unit ? (
        <>
          <div className="flex items-center justify-between">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
              {unit.isBoss && <CrownIcon />}<UnitIcon type={unit.type} className="text-base" />
              <span className="truncate">{getUnitTypeName(unit.type)}</span>
              {unit.level && unit.level > 1 && <span className="text-[10px] text-slate-400">Lv{unit.level}</span>}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: SIDE_COLORS[unit.owner] }}
            >
              {unit.owner === 'player' ? 'You' : 'Enemy'}
            </span>
          </div>
          <div className="mt-2"><HealthBar value={unit.lifespan} max={unit.maxLifespan} /></div>
          <div className="mt-2 flex gap-3 text-slate-200">
            <span title="Attack" className="flex items-center gap-1"><AttackIcon /> <b>{unit.attackPower}</b></span>
            <span title="Movement" className="flex items-center gap-1"><MoveIcon /> <b>{unit.movementRange}</b></span>
            <span className="ml-auto text-slate-400" title={effect.description}>
              <TerrainIcon terrain={hex.terrain} /> {terrainBonuses.length > 0 ? terrainBonuses.join(' · ') : effect.name}
            </span>
          </div>
          <CounterLine type={unit.type} />
          {unit.abilities.filter(ability => ability !== 'rapidMovement').length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-[11px] text-slate-300">
              {unit.abilities.filter(ability => ability !== 'rapidMovement').map(ability => (
                <li key={ability} className="flex gap-1"><AbilityIcon ability={ability} className="mt-0.5" /><span><b>{ABILITIES[ability].name}:</b> {ABILITIES[ability].description}</span></li>
              ))}
            </ul>
          )}
          {isFogOfWar(gameState) && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
              <FogIcon />
              {unit.owner === 'player'
                ? <>Sees {getSightRange(gameState, unit)} hexes{TERRAIN_EFFECTS[hex.terrain].conceals && !unit.revealed ? ' · hidden in the trees' : unit.revealed ? ' · spotted by the enemy' : ''}</>
                : unit.revealed ? 'Gave its position away' : 'In sight of your troops'}
            </div>
          )}
          {unit.owner === 'player' && (gameState.bonds ?? []).map(getBond).filter(bond => bond.bonuses[unit.type]).map(bond => (
            <div key={bond.id} className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-200">
              <BondIcon /> <b>{bond.name}:</b> {describeBonus(unit.type, bond.bonuses[unit.type]!)}
            </div>
          ))}
          {unit.owner === 'player' && unit.hasMoved && gameState.currentPhase === 'planning' && (
            <div className="mt-2 text-slate-400">Just deployed · moves next turn</div>
          )}
        </>
      ) : hex.isCamp ? (
        <>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <CampIcon color={hex.owner ? SIDE_COLORS[hex.owner] : SIDE_COLORS.neutral} />
            {hex.owner === 'player' ? 'Your camp' : hex.owner === 'ai' ? 'Enemy camp' : 'Neutral camp'}
          </div>
          <div className="mt-2 text-slate-400">
            {hex.owner === 'player'
              ? 'Recruits can deploy on and around it'
              : 'Move a unit onto it to capture it and deploy recruits there'}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm font-bold"><CrownIcon /> {hex.owner === 'player' ? 'Your castle' : 'Enemy castle'}</div>
          <div className="mt-2">
            <HealthBar value={hex.baseHealth ?? BASE_MAX_HEALTH} max={getCastleMaxHealth(gameState, hex.owner ?? 'player')} />
          </div>
          <div className="mt-2 text-slate-400">
            {hex.owner === 'player'
              ? canStormCastle(gameState, 'ai') ? 'Walls breached - guard it or the enemy can storm it!' : 'Recruits deploy next to it'
              : canStormCastle(gameState, 'player')
                ? 'Walls breached - move a unit onto it to win!'
                : 'Attack it: troops next to it, or archers and mages in range, wear it down. At half health its walls break and you can storm it'}
          </div>
        </>
      )}
      {!unit && hex.terrain !== 'plain' && (
        <div className="mt-1 text-slate-400"><TerrainIcon terrain={hex.terrain} /> {TERRAIN_SHORT_EFFECTS[hex.terrain]}</div>
      )}
    </div>
  );
};
