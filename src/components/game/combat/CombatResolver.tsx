import React from 'react';
import { GameState } from '@/types/game';
import { CombatantPreview, getCombatPreview } from '@/lib/game/gameState';
import { getUnitTypeEmoji, getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS, SIDE_COLORS } from '../hud/styles';
import { TERRAIN_ICONS } from '../hud/terrainInfo';

interface CombatResolverProps {
  gameState: GameState;
  onResolveCombat: (combatIndex: number, retreat: boolean) => void;
}

const Combatant: React.FC<{ entry: CombatantPreview }> = ({ entry }) => {
  const { unit } = entry;
  const color = SIDE_COLORS[unit.owner];

  return (
    <li className="rounded-lg bg-slate-800 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold" style={{ color }}>
          {getUnitTypeEmoji(unit.type)} {unit.owner === 'player' ? 'Your' : 'Enemy'} {getUnitTypeName(unit.type)}
        </span>
        <span className="text-xs tabular-nums">❤️ {unit.lifespan}/{unit.maxLifespan}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span>⚔️ {Number.isInteger(entry.power) ? entry.power : entry.power.toFixed(1)} · {TERRAIN_ICONS[entry.terrain]}</span>
        <span className={`font-bold ${entry.destroyed ? 'text-red-400' : 'text-amber-300'}`}>
          {entry.destroyed ? '☠ would be destroyed' : `takes -${entry.damageTaken}`}
        </span>
      </div>
      {entry.modifiers.length > 0 && (
        <div className="mt-1 text-[11px] font-semibold text-emerald-300">{entry.modifiers.join(' · ')}</div>
      )}
    </li>
  );
};

// Explains the current battle - who is fighting, terrain modifiers and the expected outcome
export const CombatResolver: React.FC<CombatResolverProps> = ({ gameState, onResolveCombat }) => {
  const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
  if (unresolvedCombatIndex === -1) return null;

  const combat = gameState.combats[unresolvedCombatIndex];
  const preview = getCombatPreview(gameState, combat);
  const isPlayerDefending = combat.defenders.some(unit => unit.owner === 'player');

  return (
    <div className={`${PANEL_CLASS} fixed right-3 bottom-4 z-30 w-80 p-4 text-sm`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">⚔️ Battle</h2>
        <span className="text-xs text-slate-400">{unresolvedCombatIndex + 1} of {gameState.combats.length}</span>
      </div>
      <p className="mt-1 text-xs text-slate-300">
        {isPlayerDefending
          ? 'Your unit is under attack. Fight back, or retreat to a safe hex (no damage).'
          : 'Your troops attack. Damage is split between the units on each side.'}
      </p>

      <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        Attackers · total ⚔️ {preview.attackerPower}
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {preview.attackers.map(entry => <Combatant key={entry.unit.id} entry={entry} />)}
      </ul>

      <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        Defender · total ⚔️ {preview.defenderPower}
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {preview.defenders.map(entry => <Combatant key={entry.unit.id} entry={entry} />)}
      </ul>

      {isPlayerDefending ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onResolveCombat(unresolvedCombatIndex, false)}
            className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 py-2 font-bold text-slate-900"
          >
            Stand &amp; Fight
          </button>
          <button
            onClick={() => onResolveCombat(unresolvedCombatIndex, true)}
            className="flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 py-2 font-bold"
          >
            Retreat
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs italic text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          The enemy is deciding whether to retreat…
        </div>
      )}
    </div>
  );
};
