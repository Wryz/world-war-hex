import React from 'react';
import { GameState, Hex, Unit, UnitType } from '@/types/game';
import { getUnitTypeName } from '../utils/UnitHelpers';

interface PlanningPhaseProps {
  gameState: GameState;
  selectedHex: Hex | null;
  selectedUnit: Unit | null;
  isAITurn: boolean;
  timer: number;
  onUnitPurchase: (unitType: UnitType) => void;
  onEndTurn: () => void;
}

export const PlanningPhase: React.FC<PlanningPhaseProps> = ({
  gameState,
  selectedHex,
  selectedUnit,
  isAITurn,
  timer,
  onUnitPurchase,
  onEndTurn
}) => (
  <div className="absolute inset-x-0 bottom-0 p-4">
    <div className="bg-[var(--parchment)] border-2 border-[var(--foreground)] rounded-md p-4 shadow-lg max-w-4xl mx-auto z-10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[var(--secondary)] font-bold text-lg">Planning Phase</h3>
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
      ) : (
        <>
          <div className="mb-4">
            <h4 className="text-[var(--primary)] font-semibold mb-2">Recruit Troops</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <button
                onClick={() => onUnitPurchase('infantry')}
                disabled={gameState.players.player.points < 10}
                className={`flex flex-col items-center p-2 rounded-md border border-[var(--foreground)] ${
                  gameState.players.player.points >= 10 
                    ? 'bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer' 
                    : 'bg-[var(--background)] bg-opacity-10 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl mb-1">🗡️</span>
                <span className="font-semibold text-sm">Swordsmen</span>
                <span className="text-xs mt-1">10 gold</span>
              </button>
              
              <button
                onClick={() => onUnitPurchase('artillery')}
                disabled={gameState.players.player.points < 15}
                className={`flex flex-col items-center p-2 rounded-md border border-[var(--foreground)] ${
                  gameState.players.player.points >= 15 
                    ? 'bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer' 
                    : 'bg-[var(--background)] bg-opacity-10 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl mb-1">🏹</span>
                <span className="font-semibold text-sm">Archers</span>
                <span className="text-xs mt-1">15 gold</span>
              </button>
              
              <button
                onClick={() => onUnitPurchase('helicopter')}
                disabled={gameState.players.player.points < 20}
                className={`flex flex-col items-center p-2 rounded-md border border-[var(--foreground)] ${
                  gameState.players.player.points >= 20 
                    ? 'bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer' 
                    : 'bg-[var(--background)] bg-opacity-10 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl mb-1">🐎</span>
                <span className="font-semibold text-sm">Knights</span>
                <span className="text-xs mt-1">20 gold</span>
              </button>
              
              <button
                onClick={() => onUnitPurchase('tank')}
                disabled={gameState.players.player.points < 20}
                className={`flex flex-col items-center p-2 rounded-md border border-[var(--foreground)] ${
                  gameState.players.player.points >= 20 
                    ? 'bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer' 
                    : 'bg-[var(--background)] bg-opacity-10 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl mb-1">🛡️</span>
                <span className="font-semibold text-sm">Pikemen</span>
                <span className="text-xs mt-1">20 gold</span>
              </button>
              
              <button
                onClick={() => onUnitPurchase('medic')}
                disabled={gameState.players.player.points < 15}
                className={`flex flex-col items-center p-2 rounded-md border border-[var(--foreground)] ${
                  gameState.players.player.points >= 15 
                    ? 'bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer' 
                    : 'bg-[var(--background)] bg-opacity-10 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl mb-1">⚒️</span>
                <span className="font-semibold text-sm">Siege</span>
                <span className="text-xs mt-1">15 gold</span>
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <h4 className="text-[var(--primary)] font-semibold mb-2">Selection Info</h4>
            <div className="bg-[var(--background)] bg-opacity-10 p-3 rounded-md">
              {selectedHex ? (
                <div>
                  <p className="text-[var(--secondary)]">
                    <span className="font-semibold">Location:</span> Selected
                  </p>
                  <p className="text-[var(--secondary)]">
                    <span className="font-semibold">Terrain:</span> {selectedHex.terrain || "Plain"}
                  </p>
                  {selectedUnit && (
                    <div className="mt-2 p-2 bg-[var(--background)] bg-opacity-20 rounded-md">
                      <p className="text-[var(--secondary)]">
                        <span className="font-semibold">Unit:</span> {getUnitTypeName(selectedUnit.type)}
                      </p>
                      <p className="text-[var(--secondary)]">
                        <span className="font-semibold">Health:</span> {selectedUnit.lifespan}/{selectedUnit.maxLifespan}
                      </p>
                      <p className="text-[var(--secondary)]">
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
          
          <div className="text-center">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-[var(--secondary)]">
                  <span className="font-semibold">Treasury:</span> {gameState.players.player.points} gold
                </p>
              </div>
              <button 
                onClick={onEndTurn}
                className="bg-[var(--accent)] hover:bg-[var(--accent-light)] text-[var(--parchment)] font-bold py-2 px-6 rounded-md border-2 border-[var(--secondary)] transition duration-200 shadow-md"
              >
                End Turn
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
); 