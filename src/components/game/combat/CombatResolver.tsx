import React from 'react';
import { GameState } from '@/types/game';
import { getUnitTypeName } from '../utils/UnitHelpers';

interface CombatResolverProps {
  gameState: GameState;
  onResolveCombat: (combatIndex: number, retreat: boolean) => void;
}

export const CombatResolver: React.FC<CombatResolverProps> = ({ 
  gameState, onResolveCombat 
}) => {
  const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
  if (unresolvedCombatIndex === -1) return null;
  
  const combat = gameState.combats[unresolvedCombatIndex];
  const attackerStrength = combat.attackers.reduce((sum, unit) => sum + unit.attackPower, 0);
  const defenderStrength = combat.defenders.reduce((sum, unit) => sum + unit.attackPower, 0);
  const isPlayerDefending = combat.defenders.some(unit => unit.owner === 'player');
  
  // Calculate winning probability based on attack power
  const totalStrength = attackerStrength + defenderStrength;
  const attackerWinChance = totalStrength > 0 ? Math.round((attackerStrength / totalStrength) * 100) : 50;
  
  return (
    <div className="fixed top-16 right-4 p-4 bg-[var(--background)] bg-opacity-90 text-[var(--parchment)] rounded-lg w-80 z-10">
      <h2 className="text-xl font-bold mb-2">Combat Phase</h2>
      <p className="mb-3">Battle {unresolvedCombatIndex + 1} of {gameState.combats.length}</p>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex-1 text-center">
            <h3 className={`font-semibold ${isPlayerDefending ? 'text-red-400' : 'text-blue-400'}`}>
              Attackers
            </h3>
            <p className="text-2xl font-bold">{attackerStrength}</p>
          </div>
          <div className="text-center px-2">
            <span className="text-lg">vs</span>
          </div>
          <div className="flex-1 text-center">
            <h3 className={`font-semibold ${isPlayerDefending ? 'text-blue-400' : 'text-red-400'}`}>
              Defenders
            </h3>
            <p className="text-2xl font-bold">{defenderStrength}</p>
          </div>
        </div>
        
        <div className="relative h-4 bg-[var(--secondary)] bg-opacity-40 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-yellow-500"
            style={{ width: `${attackerWinChance}%` }}
          ></div>
          <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center text-xs font-bold">
            {attackerWinChance}% / {100 - attackerWinChance}%
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--secondary)] p-2 rounded">
          <h3 className={`font-semibold ${isPlayerDefending ? 'text-red-400' : 'text-blue-400'}`}>
            Attacking Units ({combat.attackers.length})
          </h3>
          <ul className="text-sm">
            {combat.attackers.map((unit, index) => (
              <li key={index} className="mb-1">
                {getUnitTypeName(unit.type)} - HP: {unit.lifespan}/{unit.maxLifespan}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[var(--secondary)] p-2 rounded">
          <h3 className={`font-semibold ${isPlayerDefending ? 'text-blue-400' : 'text-red-400'}`}>
            Defending Units ({combat.defenders.length})
          </h3>
          <ul className="text-sm">
            {combat.defenders.map((unit, index) => (
              <li key={index} className="mb-1">
                {getUnitTypeName(unit.type)} - HP: {unit.lifespan}/{unit.maxLifespan}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {isPlayerDefending && (
        <div className="flex space-x-2 mt-4">
          <button 
            onClick={() => onResolveCombat(unresolvedCombatIndex, false)}
            className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-[var(--parchment)] font-bold py-2 px-4 rounded border border-[var(--secondary)]"
          >
            Stand & Fight
          </button>
          <button 
            onClick={() => onResolveCombat(unresolvedCombatIndex, true)}
            className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-light)] text-[var(--parchment)] font-bold py-2 px-4 rounded border border-[var(--secondary)]"
          >
            Retreat
          </button>
        </div>
      )}
      
      {!isPlayerDefending && (
        <div className="mt-4">
          <p className="mb-2 text-center italic">AI is deciding whether to retreat...</p>
          <button 
            className="w-full bg-[var(--secondary)] text-[var(--parchment)] font-bold py-2 px-4 rounded opacity-50 cursor-wait"
            disabled
          >
            Waiting for AI decision
          </button>
        </div>
      )}
    </div>
  );
}; 