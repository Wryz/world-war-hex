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
      {/* Sidebar Dashboard (left side) */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--background)] bg-opacity-80 border-r-2 border-[var(--secondary)] shadow-md pointer-events-auto z-10 flex flex-col overflow-hidden">
        {/* Game info at the top of sidebar */}
        <div className="p-4 border-b border-[var(--secondary)]">
          <h2 className="text-[var(--parchment)] text-lg font-bold">Turn {turnNumber}</h2>
          <p className="text-[var(--parchment)]">{isAITurn ? "Enemy's Turn" : "Your Turn"}</p>
          <p className="text-[var(--parchment)]">
            <span className="font-bold">Treasury:</span> {gameState.players.player.points} gold
          </p>
        </div>
        
        {/* Player forces */}
        <div className="p-4 border-b border-[var(--secondary)] flex-shrink-0">
          <h3 className="text-[var(--parchment)] font-bold mb-2">Your Forces</h3>
          <div className="max-h-40 overflow-y-auto pr-1">
            {playerUnits.map(unit => (
              <div
                key={unit.id}
                className="mb-1 last:mb-0 cursor-pointer bg-[var(--accent)] bg-opacity-40 hover:bg-opacity-60 p-1 rounded-md transition-colors"
                onClick={() => onUnitSelect(unit)}
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-2 flex items-center justify-center bg-[var(--foreground)] rounded-full text-xs text-[var(--parchment)]">
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
        
        {/* Enemy forces */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-[var(--parchment)] font-bold mb-2">Enemy Forces</h3>
          <div className="max-h-40 overflow-y-auto pr-1">
            {enemyUnits.map(unit => (
              <div
                key={unit.id}
                className="mb-1 last:mb-0 cursor-pointer bg-[var(--accent)] bg-opacity-40 hover:bg-opacity-60 p-1 rounded-md transition-colors"
                onClick={() => onUnitSelect(unit)}
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-2 flex items-center justify-center bg-[var(--foreground)] rounded-full text-xs text-[var(--parchment)]">
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

      {/* Player base health (top left) - transparent */}
      <div className="fixed top-4 left-[calc(16rem+12px)] bg-transparent p-3 pointer-events-auto z-10 max-w-[240px]">
        <h3 className="text-[var(--parchment)] font-bold text-shadow-md">Your Castle</h3>
        <div className="relative h-6 w-36 mt-1">
          {/* Player castle health bar with point on right side */}
          <div className="absolute inset-0 clip-path-player-castle bg-[var(--background)] bg-opacity-40"></div>
          {/* Health fill */}
          <div
            className={`absolute inset-0 clip-path-player-castle ${
              playerBaseHealth / BASE_MAX_HEALTH > 0.6
                ? 'bg-green-500'
                : playerBaseHealth / BASE_MAX_HEALTH > 0.3
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${(playerBaseHealth / BASE_MAX_HEALTH) * 100}%` }}
          ></div>
          {/* Health text overlay */}
          <p className="absolute inset-0 flex items-center justify-center text-white text-shadow-sm text-xs font-bold">
            {playerBaseHealth}/{BASE_MAX_HEALTH}
          </p>
        </div>
      </div>

      {/* AI base health (top right) - transparent */}
      <div className="fixed top-4 right-4 bg-transparent p-3 pointer-events-auto z-10 max-w-[240px] text-right">
        <h3 className="text-[var(--parchment)] font-bold text-shadow-md">Enemy Castle</h3>
        <div className="relative h-6 w-36 mt-1 ml-auto">
          {/* Enemy castle health bar with point on left side */}
          <div className="absolute inset-0 clip-path-enemy-castle bg-[var(--background)] bg-opacity-40"></div>
          {/* Health fill - this time right-aligned */}
          <div
            className={`absolute top-0 bottom-0 right-0 clip-path-enemy-castle ${
              aiBaseHealth / BASE_MAX_HEALTH > 0.6
                ? 'bg-green-500'
                : aiBaseHealth / BASE_MAX_HEALTH > 0.3
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${(aiBaseHealth / BASE_MAX_HEALTH) * 100}%` }}
          ></div>
          {/* Health text overlay */}
          <p className="absolute inset-0 flex items-center justify-center text-white text-shadow-sm text-xs font-bold">
            {aiBaseHealth}/{BASE_MAX_HEALTH}
          </p>
        </div>
      </div>
    </>
  );
}; 