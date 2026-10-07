import React from 'react';
import { GameState } from '@/types/game';
import { CombatantPreview, getCombatPreview, getKillBounty } from '@/lib/game/gameState';
import { getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS, SIDE_COLORS } from '../hud/styles';
import { AttackIcon, GoldIcon, HealthIcon, SkullIcon, TerrainIcon, UnitIcon } from '../icons';

interface CombatResolverProps {
  gameState: GameState;
}

// One unit in the battle: health now and the damage it is about to take
const Combatant: React.FC<{ entry: CombatantPreview }> = ({ entry }) => (
  <div
    className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1"
    title={[getUnitTypeName(entry.unit.type), ...entry.modifiers].join(' · ')}
  >
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

// The battle being fought right now: who is fighting and what each unit will take.
// Battles resolve automatically - this card just shows what is happening.
export const CombatResolver: React.FC<CombatResolverProps> = ({ gameState }) => {
  const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
  if (unresolvedCombatIndex === -1) return null;

  const combat = gameState.combats[unresolvedCombatIndex];
  const preview = getCombatPreview(gameState, combat);
  const isPlayerDefending = combat.defenders.some(unit => unit.owner === 'player');

  return (
    <div className={`${PANEL_CLASS} fixed right-3 bottom-3 z-30 w-72 p-3 text-xs`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display flex items-center gap-1.5 text-base"><AttackIcon /> Battle</span>
        <span className="text-slate-400">{unresolvedCombatIndex + 1} / {gameState.combats.length}</span>
      </div>

      <div className="flex gap-2">
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
    </div>
  );
};
