import React from 'react';
import { GameState, PlayerType } from '@/types/game';
import {
  CombatEffect, CombatantPreview, describeEffect, getBesiegedCastles, getCombatPreview, getKillBounty, getSiegeDamage, strongestEffects
} from '@/lib/game/gameState';
import { sideColor } from '../sideColors';
import { sideLabel, sideOwnerLabel } from '../hud/sideLabels';
import { getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS } from '../hud/styles';
import { AttackIcon, CrownIcon, GoldIcon, HealthIcon, SkullIcon, TerrainIcon, UnitIcon } from '../icons';

interface CombatResolverProps {
  gameState: GameState;
  // The side the battle is seen from
  viewer?: PlayerType;
}

// Modifier chips shown per unit at most (the biggest); the rest are counted, and all are in its tooltip
const MAX_CHIPS = 3;

// Bonuses read green and penalties red, so it's clear why a fight went the way it did
const TONE_CLASS: Record<CombatEffect['tone'], string> = {
  good: 'bg-emerald-500/15 text-emerald-300',
  bad: 'bg-rose-500/15 text-rose-300',
  neutral: 'bg-slate-700 text-slate-300'
};

// One unit in the battle: health now, the damage it is about to take, and what is helping or hurting it
const Combatant: React.FC<{ entry: CombatantPreview }> = ({ entry }) => (
  <div className="rounded-md bg-slate-800 px-2 py-1" title={[getUnitTypeName(entry.unit.type), ...entry.modifiers.map(describeEffect)].join(' · ')}>
    <div className="flex items-center gap-1.5">
      <UnitIcon type={entry.unit.type} className="text-base" color={sideColor(entry.unit.owner)} />
      <span className="flex items-center gap-0.5 tabular-nums"><HealthIcon />{entry.unit.lifespan}</span>
      {entry.modifiers.length > 0 && <TerrainIcon terrain={entry.terrain} />}
      <span className={`ml-auto flex items-center gap-1 font-bold tabular-nums ${entry.destroyed ? 'text-red-400' : 'text-amber-300'}`}>
        {entry.destroyed ? (
          <>
            <SkullIcon />
            <span className="text-amber-300">+{getKillBounty(entry.unit)}</span>
            <GoldIcon />
          </>
        ) : entry.damageTaken > 0 ? `-${entry.damageTaken}` : <span className="text-slate-400">safe</span>}
      </span>
    </div>
    {entry.modifiers.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-0.5 text-[0.5625rem] font-bold leading-none">
        {strongestEffects(entry.modifiers, MAX_CHIPS).map(modifier => (
          <span key={modifier.label} className={`whitespace-nowrap rounded px-1 py-0.5 ${TONE_CLASS[modifier.tone]}`}>
            {modifier.value ? <><span className="tabular-nums">{modifier.value}</span> {modifier.label}</> : modifier.label}
          </span>
        ))}
        {entry.modifiers.length > MAX_CHIPS && (
          <span className="rounded px-1 py-0.5 text-slate-400">+{entry.modifiers.length - MAX_CHIPS}</span>
        )}
      </div>
    )}
  </div>
);

const Side: React.FC<{ label: string; color: string; power: number; entries: CombatantPreview[] }> = ({
  label, color, power, entries
}) => (
  <div className="flex-1 min-w-0">
    <div className="mb-1 flex items-center justify-between text-[0.6875rem] font-bold">
      <span style={{ color }}>{label}</span>
      <span className="flex items-center gap-1 text-slate-300">
        <AttackIcon />{Number.isInteger(power) ? power : power.toFixed(1)}
      </span>
    </div>
    <div className="flex flex-col gap-1">
      {entries.map(entry => <Combatant key={entry.unit.id} entry={entry} />)}
    </div>
  </div>
);

// The turn's battles, all fought at once: who is fighting and what each unit will take.
// Battles resolve automatically - this card just shows what is happening.
export const CombatResolver: React.FC<CombatResolverProps> = ({ gameState, viewer = 'player' }) => {
  const combats = gameState.combats.filter(c => !c.resolved);
  const siege = gameState.siege;
  // The castles under attack, each with the troops attacking it
  const sieges = siege ? getBesiegedCastles(gameState).map(({ side, attackerIds }) => {
    const attackers = gameState.players[siege.side].units.filter(unit => attackerIds.includes(unit.id));
    return { side, attackers, damage: Math.round(attackers.reduce((sum, unit) => sum + getSiegeDamage(unit), 0)) };
  }).filter(entry => entry.attackers.length > 0) : [];
  if (combats.length === 0 && sieges.length === 0) return null;

  return (
    <div className={`${PANEL_CLASS} fixed right-[calc(0.75rem+var(--safe-r))] bottom-[calc(0.75rem+var(--safe-b))] z-30 hidden max-h-[50vh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto p-3 text-xs sm:block`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display flex items-center gap-1.5 text-base">
          <AttackIcon /> {combats.length === 0 ? 'Castle attack' : combats.length === 1 ? 'Battle' : `${combats.length} Battles`}
        </span>
      </div>

      {/* Troops attacking the enemy castle this turn */}
      {sieges.map(({ side, attackers, damage }) => (
        <div key={side} className="mb-2 flex items-center gap-2 rounded-lg bg-slate-800/80 px-2.5 py-2">
          <CrownIcon color={sideColor(side)} />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {attackers.map(unit => <UnitIcon key={unit.id} type={unit.type} />)}
            <span className="text-slate-300">strike {side === viewer ? 'your' : sideOwnerLabel(gameState, side, viewer, 'the enemy').replace(/^Enemy$/, 'the enemy')} castle</span>
          </span>
          <span className="font-display text-sm text-rose-300">-{damage}</span>
        </div>
      ))}

      <div className="flex flex-col gap-2">
        {combats.map(combat => {
          const preview = getCombatPreview(gameState, combat);
          const attackerSide = combat.attackers[0]?.owner;
          const defenderSide = combat.defenders[0]?.owner;
          return (
            <div key={`${combat.hexCoordinates.q},${combat.hexCoordinates.r}`} className="flex gap-2 border-t border-white/5 pt-2 first:border-0 first:pt-0">
              <Side
                label={sideLabel(gameState, attackerSide, viewer)}
                color={sideColor(attackerSide)}
                power={preview.attackerPower}
                entries={preview.attackers}
              />
              <div className="self-center font-bold text-slate-500">vs</div>
              <Side
                label={sideLabel(gameState, defenderSide, viewer)}
                color={sideColor(defenderSide)}
                power={preview.defenderPower}
                entries={preview.defenders}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
