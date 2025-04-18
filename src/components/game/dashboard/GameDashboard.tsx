import React from 'react';
import { GameState, Unit } from '@/types/game';
import { getUnitTypeEmoji, getUnitTypeName } from '../utils/UnitHelpers';

// Base max health constant (should match the one in gameState.ts)
const BASE_MAX_HEALTH = 50;

interface GameDashboardProps {
  gameState: GameState;
  turnNumber: number;
  isAITurn: boolean;
  onUnitSelect: (unit: Unit) => void;
}

export const GameDashboard: React.FC<GameDashboardProps> = ({
  gameState,
  turnNumber,
  isAITurn,
  onUnitSelect
}) => {
  const playerUnits = gameState.players.player.units;
  const enemyUnits = gameState.players.ai.units;
  const playerBaseHealth = gameState.players.player.baseHealth || BASE_MAX_HEALTH;
  const aiBaseHealth = gameState.players.ai.baseHealth || BASE_MAX_HEALTH;

  return (
    <>
      {/* Player base health (top left) */}
      <div className="fixed top-4 left-4 bg-[var(--primary)] bg-opacity-80 p-3 rounded-md border-2 border-[var(--secondary)] shadow-md pointer-events-auto z-10 max-w-[240px]">
        <h3 className="text-[var(--parchment)] font-bold">Your Castle</h3>
        <div className="w-full h-4 bg-[var(--background)] bg-opacity-40 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full ${
              playerBaseHealth / BASE_MAX_HEALTH > 0.6
                ? 'bg-green-500'
                : playerBaseHealth / BASE_MAX_HEALTH > 0.3
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${(playerBaseHealth / BASE_MAX_HEALTH) * 100}%` }}
          ></div>
        </div>
        <p className="text-[var(--parchment)] text-sm mt-1 mb-2">
          {playerBaseHealth}/{BASE_MAX_HEALTH} Strength
        </p>

        {/* Player unit health bars */}
        <div className="border-t border-[var(--secondary)] pt-2 mt-1">
          <h4 className="text-[var(--parchment)] text-sm font-bold mb-1">Your Forces</h4>
          <div className="max-h-40 overflow-y-auto pr-1">
            {playerUnits.map(unit => (
              <div
                key={unit.id}
                className="mb-1 last:mb-0 cursor-pointer bg-[var(--accent)] bg-opacity-40 hover:bg-opacity-60 p-1 rounded-md transition-colors"
                onClick={() => onUnitSelect(unit)}
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-2 flex items-center justify-center bg-[var(--primary)] rounded-full text-xs text-[var(--parchment)]">
                    {getUnitTypeEmoji(unit.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[var(--parchment)] text-xs">{getUnitTypeName(unit.type)}</p>
                    <div className="w-full h-2 bg-[var(--background)] bg-opacity-40 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${
                          unit.lifespan / unit.maxLifespan > 0.6
                            ? 'bg-green-500'
                            : unit.lifespan / unit.maxLifespan > 0.3
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${(unit.lifespan / unit.maxLifespan) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-[var(--parchment)] text-xs ml-1">{unit.lifespan}</span>
                </div>
              </div>
            ))}
            {playerUnits.length === 0 && (
              <p className="text-[var(--parchment)] text-xs italic">No units deployed</p>
            )}
          </div>
        </div>
      </div>

      {/* AI base health (top right) */}
      <div className="fixed top-4 right-4 bg-[var(--primary)] bg-opacity-80 p-3 rounded-md border-2 border-[var(--secondary)] shadow-md pointer-events-auto z-10 max-w-[240px]">
        <h3 className="text-[var(--parchment)] font-bold">Enemy Castle</h3>
        <div className="w-full h-4 bg-[var(--background)] bg-opacity-40 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full ${
              aiBaseHealth / BASE_MAX_HEALTH > 0.6
                ? 'bg-green-500'
                : aiBaseHealth / BASE_MAX_HEALTH > 0.3
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${(aiBaseHealth / BASE_MAX_HEALTH) * 100}%` }}
          ></div>
        </div>
        <p className="text-[var(--parchment)] text-sm mt-1 mb-2">
          {aiBaseHealth}/{BASE_MAX_HEALTH} Strength
        </p>

        {/* Enemy unit health bars */}
        <div className="border-t border-[var(--secondary)] pt-2 mt-1">
          <h4 className="text-[var(--parchment)] text-sm font-bold mb-1">Enemy Forces</h4>
          <div className="max-h-40 overflow-y-auto pr-1">
            {enemyUnits.map(unit => (
              <div
                key={unit.id}
                className="mb-1 last:mb-0 cursor-pointer bg-[var(--accent)] bg-opacity-40 hover:bg-opacity-60 p-1 rounded-md transition-colors"
                onClick={() => onUnitSelect(unit)}
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-2 flex items-center justify-center bg-[var(--primary)] rounded-full text-xs text-[var(--parchment)]">
                    {getUnitTypeEmoji(unit.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[var(--parchment)] text-xs">{getUnitTypeName(unit.type)}</p>
                    <div className="w-full h-2 bg-[var(--background)] bg-opacity-40 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${
                          unit.lifespan / unit.maxLifespan > 0.6
                            ? 'bg-green-500'
                            : unit.lifespan / unit.maxLifespan > 0.3
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${(unit.lifespan / unit.maxLifespan) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-[var(--parchment)] text-xs ml-1">{unit.lifespan}</span>
                </div>
              </div>
            ))}
            {enemyUnits.length === 0 && (
              <p className="text-[var(--parchment)] text-xs italic">No units deployed</p>
            )}
          </div>
        </div>
      </div>

      {/* Game info (center bottom) */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[var(--accent)] bg-opacity-80 p-3 rounded-md border-2 border-[var(--secondary)] shadow-md z-10">
        <h2 className="text-[var(--parchment)] text-lg font-bold text-center">Turn {turnNumber}</h2>
        <p className="text-[var(--parchment)] text-center">{isAITurn ? "Enemy's Turn" : "Your Turn"}</p>
        <p className="text-[var(--parchment)] text-center">
          <span className="font-bold">Treasury:</span> {gameState.players.player.points} gold
        </p>
      </div>
    </>
  );
}; 