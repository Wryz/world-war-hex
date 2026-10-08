import React from 'react';
import { GameState } from '@/types/game';
import { CombatantPreview, getCombatPreview, getKillBounty, getSiegeDamage } from '@/lib/game/gameState';
import { getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS, SIDE_COLORS } from '../hud/styles';
import { AttackIcon, CrownIcon, GoldIcon, HealthIcon, SkullIcon, TerrainIcon, UnitIcon } from '../icons';

interface CombatResolverProps {
  gameState: GameState;
}

// Bonuses read green and penalties red, so it's clear why a fight went the way it did
const modifierTone = (modifier: string) =>
  /^-|uphill/.test(modifier) ? 'text-rose-300' : /^\+|^x|less damage|ignore|no damage|armored/.test(modifier) ? 'text-emerald-300' : 'text-slate-400';

// One unit in the battle: health now, the damage it is about to take, and what is helping or hurting it
const Combatant: React.FC<{ entry: CombatantPreview }> = ({ entry }) => (
  <div className="rounded-md bg-slate-800 px-2 py-1" title={[getUnitTypeName(entry.unit.type), ...entry.modifiers].join(' · ')}>
    <div className="flex items-center gap-1.5">
      <UnitIcon type={entry.unit.type} className="text-base" color={SIDE_COLORS[entry.unit.owner]} />
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
      <div className="mt-0.5 flex flex-col text-[10px] leading-tight">
        {entry.modifiers.map(modifier => <span key={modifier} className={modifierTone(modifier)}>{modifier}</span>)}
      </div>
    )}
  </div>
);

const Side: React.FC<{ label: string; color: string; power: number; entries: CombatantPreview[] }> = ({
  label, color, power, entries
}) => (
  <div className="flex-1 min-w-0">
    <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
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
export const CombatResolver: React.FC<CombatResolverProps> = ({ gameState }) => {
  const combats = gameState.combats.filter(c => !c.resolved);
  const siege = gameState.siege;
  const siegeAttackers = siege
    ? gameState.players[siege.side].units.filter(unit => siege.attackerIds.includes(unit.id))
    : [];
  const siegeDamage = Math.round(siegeAttackers.reduce((sum, unit) => sum + getSiegeDamage(unit), 0));
  if (combats.length === 0 && siegeAttackers.length === 0) return null;

  return (
    <div className={`${PANEL_CLASS} fixed right-3 bottom-3 z-30 hidden max-h-[50vh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto p-3 text-xs sm:block`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display flex items-center gap-1.5 text-base">
          <AttackIcon /> {combats.length === 0 ? 'Castle attack' : combats.length === 1 ? 'Battle' : `${combats.length} Battles`}
        </span>
      </div>

      {/* Troops attacking the enemy castle this turn */}
      {siegeAttackers.length > 0 && siege && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-800/80 px-2.5 py-2">
          <CrownIcon color={SIDE_COLORS[siege.side === 'player' ? 'ai' : 'player']} />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {siegeAttackers.map(unit => <UnitIcon key={unit.id} type={unit.type} />)}
            <span className="text-slate-300">{siege.side === 'player' ? 'strike the enemy castle' : 'strike your castle'}</span>
          </span>
          <span className="font-display text-sm text-rose-300">-{siegeDamage}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {combats.map(combat => {
          const preview = getCombatPreview(gameState, combat);
          const isPlayerDefending = combat.defenders.some(unit => unit.owner === 'player');
          return (
            <div key={`${combat.hexCoordinates.q},${combat.hexCoordinates.r}`} className="flex gap-2 border-t border-white/5 pt-2 first:border-0 first:pt-0">
              <Side
                label={isPlayerDefending ? 'Enemy' : 'You'}
                color={SIDE_COLORS[isPlayerDefending ? 'ai' : 'player']}
                power={preview.attackerPower}
                entries={preview.attackers}
              />
              <div className="self-center font-bold text-slate-500">vs</div>
              <Side
                label={isPlayerDefending ? 'You' : 'Enemy'}
                color={SIDE_COLORS[isPlayerDefending ? 'player' : 'ai']}
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
