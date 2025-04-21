import React from 'react';
import { GameState, Hex, Unit } from '@/types/game';
import { getUnitTypeName } from '../utils/UnitHelpers';

interface PlanningPhaseProps {
  gameState: GameState;
  selectedHex: Hex | null;
  selectedUnit: Unit | null;
  isAITurn: boolean;
  timer: number;
  onEndTurn: () => void;
}

export const PlanningPhase: React.FC<PlanningPhaseProps> = ({
  selectedHex,
  selectedUnit,
  isAITurn,
  timer,
  onEndTurn
}) => (
  <div className="absolute inset-x-0 bottom-0 p-4">
    <div className="bg-[var(--background)] border-2 border-[var(--foreground)] rounded-md p-4 shadow-lg max-w-4xl mx-auto z-10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[var(--primary)] font-bold text-lg">Planning Phase</h3>
        <div className="flex items-center">
          <p className="text-[var(--primary)] mr-2">Time remaining:</p>
          <span className="bg-[var(--background)] text-[var(--parchment)] px-3 py-1 rounded-md font-mono">{timer}s</span>
        </div>
      </div>
      
      {isAITurn ? (
        <div className="text-center py-4">
          <p className="text-[var(--secondary)] mb-3 italic">Enemy is planning their moves...</p>
          <div className="w-full bg-[var(--background)] bg-opacity-20 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--accent)]" 
              style={{ width: `${(1 - timer/30) * 100}%`, transition: 'width 1s linear' }}
            ></div>
          </div>
        </div>
      ) :
        <>
          <div className="mb-4">
            <h4 className="text-[var(--primary)] font-semibold mb-2">Selection Info</h4>
            <div className="bg-[var(--background)] bg-opacity-10 p-3 rounded-md">
              {selectedHex ? (
                <div>
                  <p className="text-[var(--primary)]">
                    <span className="font-semibold">Location:</span> Selected
                  </p>
                  <p className="text-[var(--primary)]">
                    <span className="font-semibold">Terrain:</span> {selectedHex.terrain || "Plain"}
                  </p>
                  {selectedUnit && (
                    <div className="mt-2 p-2 bg-[var(--background)] bg-opacity-20 rounded-md">
                      <p className="text-[var(--primary)]">
                        <span className="font-semibold">Unit:</span> {getUnitTypeName(selectedUnit.type)}
                      </p>
                      <p className="text-[var(--primary)]">
                        <span className="font-semibold">Health:</span> {selectedUnit.lifespan}/{selectedUnit.maxLifespan}
                      </p>
                      <p className="text-[var(--primary)]">
                        <span className="font-semibold">Owner:</span> {selectedUnit.owner === 'player' ? 'You' : 'Enemy'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[var(--primary)] italic">Select a hex on the board to see info</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={onEndTurn}
              className="bg-[var(--accent)] text-[var(--primary)] font-bold py-2 px-8 rounded-md hover:bg-[var(--accent-light)] transition-colors"
            >
              End Turn
            </button>
          </div>
        </>
      }
    </div>
  </div>
); 