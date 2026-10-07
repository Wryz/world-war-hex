import React, { useState } from 'react';
import { GameState } from '@/types/game';
import { CombatantPreview, getCombatPreview } from '@/lib/game/gameState';
import { getUnitTypeEmoji, getUnitTypeName } from '../utils/UnitHelpers';
import { PANEL_CLASS, SIDE_COLORS } from '../hud/styles';
import { TERRAIN_ICONS } from '../hud/terrainInfo';

interface CombatResolverProps {
  gameState: GameState;
  onResolveCombat: (combatIndex: number, retreat: boolean) => void;
}

// One unit in the battle: health now and the damage it is expected to take
const Combatant: React.FC<{ entry: CombatantPreview }> = ({ entry }) => (
  <div className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1" title={getUnitTypeName(entry.unit.type)}>
    <span>{getUnitTypeEmoji(entry.unit.type)}</span>
    <span className="tabular-nums">❤️{entry.unit.lifespan}</span>
    {entry.modifiers.length > 0 && <span>{TERRAIN_ICONS[entry.terrain]}</span>}
    <span className={`ml-auto font-bold tabular-nums ${entry.destroyed ? 'text-red-400' : 'text-amber-300'}`}>
      {entry.destroyed ? '☠' : `-${entry.damageTaken}`}
    </span>
  </div>
);

const Side: React.FC<{ label: string; color: string; power: number; entries: CombatantPreview[] }> = ({
  label, color, power, entries
}) => (
  <div className="flex-1 min-w-0">
    <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
      <span style={{ color }}>{label}</span>
      <span className="text-slate-400">⚔️ {Number.isInteger(power) ? power : power.toFixed(1)}</span>
    </div>
    <div className="flex flex-col gap-1">
      {entries.map(entry => <Combatant key={entry.unit.id} entry={entry} />)}
    </div>
  </div>
);

// The current battle: who is fighting and the expected outcome
export const CombatResolver: React.FC<CombatResolverProps> = ({ gameState, onResolveCombat }) => {
  const [showDetails, setShowDetails] = useState(false);

  const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
  if (unresolvedCombatIndex === -1) return null;

  const combat = gameState.combats[unresolvedCombatIndex];
  const preview = getCombatPreview(gameState, combat);
  const isPlayerDefending = combat.defenders.some(unit => unit.owner === 'player');
  const attackerSide = isPlayerDefending ? 'ai' : 'player';
  const defenderSide = isPlayerDefending ? 'player' : 'ai';
  const modifiers = [...preview.attackers, ...preview.defenders].flatMap(entry =>
    entry.modifiers.map(modifier => `${getUnitTypeName(entry.unit.type)}: ${modifier}`)
  );

  return (
    <div className={`${PANEL_CLASS} fixed right-3 bottom-3 z-30 w-72 p-3 text-xs`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-base">⚔️ Battle</span>
        <span className="text-slate-400">{unresolvedCombatIndex + 1} / {gameState.combats.length}</span>
      </div>

      <div className="flex gap-2">
        <Side
          label={isPlayerDefending ? 'Enemy' : 'You'}
          color={SIDE_COLORS[attackerSide]}
          power={preview.attackerPower}
          entries={preview.attackers}
        />
        <div className="self-center text-slate-500 font-bold">vs</div>
        <Side
          label={isPlayerDefending ? 'You' : 'Enemy'}
          color={SIDE_COLORS[defenderSide]}
          power={preview.defenderPower}
          entries={preview.defenders}
        />
      </div>

      {modifiers.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowDetails(!showDetails)} className="text-slate-400 hover:text-slate-200">
            {showDetails ? '▾' : '▸'} Terrain effects
          </button>
          {showDetails && (
            <ul className="mt-1 list-disc pl-4 text-emerald-300">
              {modifiers.map(text => <li key={text}>{text}</li>)}
            </ul>
          )}
        </div>
      )}

      {isPlayerDefending ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onResolveCombat(unresolvedCombatIndex, false)}
            className="font-display flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 py-2 text-sm text-slate-900"
          >
            Fight
          </button>
          <button
            onClick={() => onResolveCombat(unresolvedCombatIndex, true)}
            title="Move to a safe hex without taking damage"
            className="font-display flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 py-2 text-sm"
          >
            Retreat
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-1.5 text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Enemy is deciding…
        </div>
      )}
    </div>
  );
};
