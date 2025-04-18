import { useState, useEffect, useCallback } from 'react';
import { 
  GameState, 
  Hex, 
  HexCoordinates, 
  Unit, 
  UnitType
} from '@/types/game';
import { GameBoard } from './GameBoard';
import { getHexDistance, getHexesInRange, findHexByCoordinates } from '@/lib/game/hexUtils';
import { 
  initializeGameState, 
  UNITS, 
  setBaseLocation, 
  addPendingMove, 
  addPendingPurchase, 
  executeMoves,
  resolveCombat,
  DEFAULT_SETTINGS
} from '@/lib/game/gameState';
import { getAIMoves, decideAICombatStrategy } from '@/lib/ai/aiPlayer';

// Temporary placeholder components until we implement them fully
interface PlanningPhaseProps {
  gameState: GameState;
  selectedHex: Hex | null;
  selectedUnit: Unit | null;
  isAITurn: boolean;
  timer: number;
  onUnitPurchase: (unitType: UnitType) => void;
  onEndTurn: () => void;
}

const PlanningPhase: React.FC<PlanningPhaseProps> = ({ 
  gameState,
  selectedHex,
  selectedUnit,
  isAITurn, 
  timer, 
  onUnitPurchase,
  onEndTurn 
}) => (
  <div className="absolute top-0 right-0 p-4 bg-gray-800 bg-opacity-80 text-white rounded-lg m-4 w-64">
    <h2 className="text-xl font-bold mb-2">
      {isAITurn ? "AI Planning" : "Planning Phase"}
    </h2>
    <p className="mb-2">Time remaining: {timer}s</p>
    <p className="mb-3">Resources: {gameState.players.player.points}</p>
    
    {!isAITurn && (
      <>
        <div className="mb-3">
          <h3 className="text-lg font-semibold mb-1">Purchase Units:</h3>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onUnitPurchase('infantry')}
              disabled={gameState.players.player.points < UNITS.infantry.cost || !selectedHex}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm py-1 px-2 rounded"
            >
              Infantry ({UNITS.infantry.cost})
            </button>
            <button 
              onClick={() => onUnitPurchase('tank')}
              disabled={gameState.players.player.points < UNITS.tank.cost || !selectedHex}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm py-1 px-2 rounded"
            >
              Tank ({UNITS.tank.cost})
            </button>
            <button 
              onClick={() => onUnitPurchase('artillery')}
              disabled={gameState.players.player.points < UNITS.artillery.cost || !selectedHex}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm py-1 px-2 rounded"
            >
              Artillery ({UNITS.artillery.cost})
            </button>
            <button 
              onClick={() => onUnitPurchase('helicopter')}
              disabled={gameState.players.player.points < UNITS.helicopter.cost || !selectedHex}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm py-1 px-2 rounded"
            >
              Helicopter ({UNITS.helicopter.cost})
            </button>
            <button 
              onClick={() => onUnitPurchase('medic')}
              disabled={gameState.players.player.points < UNITS.medic.cost || !selectedHex}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm py-1 px-2 rounded"
            >
              Medic ({UNITS.medic.cost})
            </button>
          </div>
        </div>
        
        {selectedHex && (
          <div className="mb-3 p-2 bg-gray-700 rounded">
            <h3 className="text-md font-semibold">Selected Hex:</h3>
            <p className="text-sm">Terrain: {selectedHex.terrain}</p>
            {selectedHex.isResourceHex && (
              <p className="text-sm">Resource value: {selectedHex.resourceValue}</p>
            )}
            {selectedHex.isBase && (
              <p className="text-sm">Base owner: {selectedHex.owner}</p>
            )}
          </div>
        )}
        
        {selectedUnit && (
          <div className="mb-3 p-2 bg-gray-700 rounded">
            <h3 className="text-md font-semibold">Selected Unit:</h3>
            <p className="text-sm">Type: {selectedUnit.type}</p>
            <p className="text-sm">Health: {selectedUnit.lifespan}/{selectedUnit.maxLifespan}</p>
            <p className="text-sm">Attack: {selectedUnit.attackPower}</p>
            <p className="text-sm">Movement: {selectedUnit.movementRange}</p>
          </div>
        )}
        
        <button 
          onClick={onEndTurn}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-2"
        >
          End Turn
        </button>
      </>
    )}
  </div>
);

interface CombatResolverProps {
  gameState: GameState;
  onResolveCombat: (combatIndex: number, retreat: boolean) => void;
}

const CombatResolver: React.FC<CombatResolverProps> = ({ 
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
    <div className="absolute top-0 right-0 p-4 bg-gray-800 bg-opacity-90 text-white rounded-lg m-4 w-80">
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
        
        <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
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
        <div className="bg-gray-700 p-2 rounded">
          <h3 className={`font-semibold ${isPlayerDefending ? 'text-red-400' : 'text-blue-400'}`}>
            Attacking Units ({combat.attackers.length})
          </h3>
          <ul className="text-sm">
            {combat.attackers.map((unit, index) => (
              <li key={index} className="mb-1">
                {unit.type} - HP: {unit.lifespan}/{unit.maxLifespan}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-gray-700 p-2 rounded">
          <h3 className={`font-semibold ${isPlayerDefending ? 'text-blue-400' : 'text-red-400'}`}>
            Defending Units ({combat.defenders.length})
          </h3>
          <ul className="text-sm">
            {combat.defenders.map((unit, index) => (
              <li key={index} className="mb-1">
                {unit.type} - HP: {unit.lifespan}/{unit.maxLifespan}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {isPlayerDefending && (
        <div className="flex space-x-2 mt-4">
          <button 
            onClick={() => onResolveCombat(unresolvedCombatIndex, false)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Stand & Fight
          </button>
          <button 
            onClick={() => onResolveCombat(unresolvedCombatIndex, true)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Retreat
          </button>
        </div>
      )}
      
      {!isPlayerDefending && (
        <div className="mt-4">
          <p className="mb-2 text-center italic">AI is deciding whether to retreat...</p>
          <button 
            className="w-full bg-gray-600 text-white font-bold py-2 px-4 rounded opacity-50 cursor-wait"
            disabled
          >
            Waiting for AI decision
          </button>
        </div>
      )}
    </div>
  );
};

interface GameOverScreenProps {
  winner: 'player' | 'ai';
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, onRestart }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
    <div className="bg-white p-8 rounded-lg text-center">
      <h1 className="text-3xl font-bold mb-4">
        Game Over
      </h1>
      <p className="text-xl mb-6">
        {winner === 'player' ? 'You Won!' : 'AI Won!'}
      </p>
      <button 
        onClick={onRestart}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Play Again
      </button>
    </div>
  </div>
);

// Add this new component before the GameController
interface IntroScreenProps {
  onStartGame: (difficulty: 'easy' | 'medium' | 'hard') => void;
  onContinueGame: () => void;
  hasSavedGame: boolean;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onStartGame, onContinueGame, hasSavedGame }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10">
      <div className="bg-gray-800 p-8 rounded-lg max-w-2xl">
        <h1 className="text-4xl font-bold mb-6 text-center">Hex Strategy Game</h1>
        
        {hasSavedGame && (
          <div className="mb-6 text-center">
            <button 
              onClick={onContinueGame}
              className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-8 rounded text-lg"
            >
              Continue Saved Game
            </button>
          </div>
        )}
        
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">How to Play</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Start by selecting a location for your base on the hexagonal map</li>
            <li>During the planning phase, purchase new units and move your existing units</li>
            <li>All moves execute simultaneously after the planning phase ends</li>
            <li>Capture the enemy base to win the game</li>
            <li>Control resource hexes (orange) to gain more points each turn</li>
          </ol>
        </div>
        
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Units</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 p-2 rounded">
              <h3 className="font-bold">Infantry</h3>
              <p className="text-sm">Balanced unit with moderate movement and attack</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <h3 className="font-bold">Tank</h3>
              <p className="text-sm">Heavy unit with strong attack but slower movement</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <h3 className="font-bold">Artillery</h3>
              <p className="text-sm">Long-range attack but vulnerable up close</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <h3 className="font-bold">Helicopter</h3>
              <p className="text-sm">Fast movement over any terrain</p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <h3 className="font-bold">Medic</h3>
              <p className="text-sm">Can heal adjacent friendly units</p>
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">Select Difficulty</h2>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => onStartGame('easy')}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded"
            >
              Easy
            </button>
            <button 
              onClick={() => onStartGame('medium')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-6 rounded"
            >
              Medium
            </button>
            <button 
              onClick={() => onStartGame('hard')}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded"
            >
              Hard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Define a proper type for saved game data
interface SavedGameData {
  selectedHex: Hex | null;
  isAITurn: boolean;
  timer: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Update the utility functions with proper types
const saveGameToLocalStorage = (gameState: GameState, additionalData: SavedGameData) => {
  try {
    const saveData = {
      gameState,
      additionalData,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('hexStrategyGameSave', JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error('Failed to save game:', error);
    return false;
  }
};

const loadGameFromLocalStorage = (): { gameState: GameState, additionalData: SavedGameData } | null => {
  try {
    const saveData = localStorage.getItem('hexStrategyGameSave');
    if (!saveData) return null;
    
    return JSON.parse(saveData);
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
};

const clearSavedGame = () => {
  try {
    localStorage.removeItem('hexStrategyGameSave');
    return true;
  } catch (error) {
    console.error('Failed to clear saved game:', error);
    return false;
  }
};

// Add a new GameDashboard component
interface GameDashboardProps {
  gameState: GameState;
  turnNumber: number;
  isAITurn: boolean;
  onUnitSelect: (unit: Unit) => void;
}

// Base max health constant (should match the one in gameState.ts)
const BASE_MAX_HEALTH = 50;

const GameDashboard: React.FC<GameDashboardProps> = ({ 
  gameState, 
  turnNumber, 
  isAITurn,
  onUnitSelect 
}) => {
  const playerUnits = gameState.players.player.units;
  const playerBaseHealth = gameState.players.player.baseHealth || BASE_MAX_HEALTH;
  const aiBaseHealth = gameState.players.ai.baseHealth || BASE_MAX_HEALTH;
  
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-between items-end p-4 pointer-events-none">
      {/* Player base health (bottom left) */}
      <div className="bg-blue-900 bg-opacity-70 p-2 rounded-lg pointer-events-auto">
        <h3 className="text-white font-bold">Player Base</h3>
        <div className="w-40 h-4 bg-gray-700 rounded-full overflow-hidden mt-1">
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
        <p className="text-white text-sm mt-1">
          {playerBaseHealth}/{BASE_MAX_HEALTH} HP
        </p>
      </div>
      
      {/* Game info (center bottom) */}
      <div className="bg-gray-900 bg-opacity-70 p-2 rounded-lg mb-4">
        <h2 className="text-white text-lg font-bold">Turn {turnNumber}</h2>
        <p className="text-white">{isAITurn ? "AI's Turn" : "Your Turn"}</p>
        <p className="text-white">
          <span className="font-bold">Resources:</span> {gameState.players.player.points} pts
        </p>
      </div>
      
      {/* AI base health (top right) */}
      <div className="bg-red-900 bg-opacity-70 p-2 rounded-lg absolute top-4 right-4 pointer-events-auto">
        <h3 className="text-white font-bold">Enemy Base</h3>
        <div className="w-40 h-4 bg-gray-700 rounded-full overflow-hidden mt-1">
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
        <p className="text-white text-sm mt-1">
          {aiBaseHealth}/{BASE_MAX_HEALTH} HP
        </p>
      </div>
      
      {/* Troop overview panel (bottom right) */}
      <div className="bg-gray-800 bg-opacity-80 p-3 rounded-lg max-h-48 overflow-y-auto pointer-events-auto">
        <h3 className="text-white font-bold mb-2">Your Units</h3>
        {playerUnits.length === 0 ? (
          <p className="text-gray-400 text-sm">No units deployed</p>
        ) : (
          <ul className="space-y-2">
            {playerUnits.map(unit => (
              <li 
                key={unit.id} 
                className="flex justify-between items-center gap-3 text-white text-sm cursor-pointer hover:bg-gray-700 p-1 rounded"
                onClick={() => onUnitSelect(unit)}
              >
                <span className="capitalize">{unit.type}</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
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
                <span>{unit.lifespan}/{unit.maxLifespan}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const GameController: React.FC = () => {
  // Add state to track if there's a saved game
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  
  // Game state
  const [gameState, setGameState] = useState<GameState>(() => 
    initializeGameState({ ...DEFAULT_SETTINGS, aiDifficulty: difficulty })
  );
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [validMoves, setValidMoves] = useState<HexCoordinates[]>([]);
  const [isAITurn, setIsAITurn] = useState(false);
  const [timer, setTimer] = useState(DEFAULT_SETTINGS.planningPhaseTime);
  
  // Check for saved game on mount
  useEffect(() => {
    const savedGame = loadGameFromLocalStorage();
    setHasSavedGame(!!savedGame);
  }, []);
  
  // Auto-save game state when it changes (but only if game has started)
  useEffect(() => {
    if (gameStarted && gameState.currentPhase !== 'gameOver') {
      saveGameToLocalStorage(gameState, { 
        selectedHex, 
        isAITurn, 
        timer,
        difficulty 
      });
    }
  }, [gameState, selectedHex, isAITurn, timer, gameStarted, difficulty]);
  
  // Continue saved game
  const handleContinueGame = () => {
    const savedData = loadGameFromLocalStorage();
    if (savedData) {
      setGameState(savedData.gameState);
      setIsAITurn(savedData.additionalData.isAITurn);
      setTimer(savedData.additionalData.timer);
      setDifficulty(savedData.additionalData.difficulty || 'medium');
      setGameStarted(true);
    }
  };
  
  // Handle game start
  const handleStartGame = (selectedDifficulty: 'easy' | 'medium' | 'hard') => {
    setDifficulty(selectedDifficulty);
    setGameState(initializeGameState({ 
      ...DEFAULT_SETTINGS, 
      aiDifficulty: selectedDifficulty 
    }));
    // Clear any existing saved game
    clearSavedGame();
    setGameStarted(true);
  };
  
  // Modify handleRestart to clear saved game
  const handleRestart = () => {
    clearSavedGame();
    setGameState(initializeGameState({ 
      ...DEFAULT_SETTINGS, 
      aiDifficulty: difficulty 
    }));
    setSelectedHex(null);
    setSelectedUnit(null);
    setValidMoves([]);
    setIsAITurn(false);
    setTimer(DEFAULT_SETTINGS.planningPhaseTime);
    setGameStarted(false);
    setHasSavedGame(false);
  };
  
  // Clear selection when game phase changes
  useEffect(() => {
    setSelectedHex(null);
    setSelectedUnit(null);
    setValidMoves([]);
  }, [gameState.currentPhase]);
  
  // Timer management for planning phase
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    
    if (gameState.currentPhase === 'planning' && !isAITurn) {
      setTimer(gameState.planningTimeRemaining);
      
      timerInterval = setInterval(() => {
        setTimer(prevTime => {
          if (prevTime <= 1) {
            // Time's up, execute moves
            clearInterval(timerInterval!);
            executeAllMoves();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [gameState.currentPhase, isAITurn]);
  
  // AI turn management
  useEffect(() => {
    if (gameState.currentPhase === 'planning' && isAITurn) {
      // Small delay to make AI seem like it's "thinking"
      const aiThinkingDelay = setTimeout(() => {
        handleAITurn();
      }, 1500);
      
      return () => clearTimeout(aiThinkingDelay);
    }
  }, [gameState.currentPhase, isAITurn]);
  
  // Combat resolution for AI
  useEffect(() => {
    if (gameState.currentPhase === 'combat' && gameState.combats.length > 0) {
      const unresolvedCombatIndex = gameState.combats.findIndex(c => !c.resolved);
      
      if (unresolvedCombatIndex !== -1) {
        const combat = gameState.combats[unresolvedCombatIndex];
        const defenders = combat.defenders;
        
        // AI is defending, decide to retreat or fight
        if (defenders.some(unit => unit.owner === 'ai')) {
          const aiDelay = setTimeout(() => {
            const shouldRetreat = decideAICombatStrategy(gameState, unresolvedCombatIndex);
            handleCombatResolve(unresolvedCombatIndex, shouldRetreat);
          }, 1000);
          
          return () => clearTimeout(aiDelay);
        }
      }
    }
  }, [gameState.currentPhase, gameState.combats]);
  
  // Handle hex click based on game phase
  const handleHexClick = useCallback((hex: Hex) => {
    switch (gameState.currentPhase) {
      case 'setup':
        handleBaseSelection(hex);
        break;
      
      case 'planning':
        // If we have a selected unit, try to move it
        if (selectedUnit && !isAITurn) {
          handleUnitMove(selectedUnit, hex);
        } else if (hex.isResourceHex) {
          // Show info about resource hex
          setSelectedHex(hex);
        } else if (hex.isBase) {
          // Show base info
          setSelectedHex(hex);
        } else if (!hex.unit) {
          // Select hex for unit placement
          setSelectedHex(hex);
          setSelectedUnit(null);
          
          // Check if it's a valid placement position (near base)
          const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
          if (playerBase) {
            const isNearBase = getHexDistance(hex.coordinates, playerBase.coordinates) === 1;
            if (!isNearBase) {
              setValidMoves([]);
            }
          }
        }
        break;
        
      case 'combat':
        // Select the hex to view combat details
        setSelectedHex(hex);
        break;
        
      default:
        setSelectedHex(hex);
        break;
    }
  }, [gameState, selectedUnit, isAITurn]);
  
  // Handle unit click
  const handleUnitClick = useCallback((unit: Unit) => {
    if (gameState.currentPhase !== 'planning' || isAITurn) return;
    
    // Can only select player's units
    if (unit.owner !== 'player') {
      setSelectedUnit(null);
      return;
    }
    
    setSelectedUnit(unit);
    
    // Calculate valid moves for this unit
    const unitHex = findHexByCoordinates(gameState.hexGrid, unit.position);
    if (!unitHex) return;
    
    // Show movement range
    const hexesInRange = getHexesInRange(gameState.hexGrid, unit.position, unit.movementRange);
    const validMoveCoords = hexesInRange
      .filter(hex => {
        // Filter to empty hexes or enemy base
        if (hex.unit && !(hex.isBase && hex.owner !== unit.owner)) return false;
        return true;
      })
      .map(hex => hex.coordinates);
    
    setValidMoves(validMoveCoords);
  }, [gameState]);
  
  // ==================
  // Game Phase Handlers
  // ==================
  
  const handleBaseSelection = (hex: Hex) => {
    // Cannot place base on resource hexes or when already placed
    if (hex.isResourceHex || gameState.hexGrid.some(h => h.isBase && h.owner === 'player')) return;
    
    // Update game state with player base location
    const updatedState = setBaseLocation(gameState, 'player', hex.coordinates);
    
    // If player base is set, AI will automatically place base on opposite side
    if (updatedState.hexGrid.some(h => h.isBase && h.owner === 'player')) {
      // Place AI base on a different side of the map
      const playerBase = updatedState.hexGrid.find(h => h.isBase && h.owner === 'player')!;
      let maxDistance = 0;
      let furthestHex: Hex | null = null;
      
      // Find the hex furthest from player base that's not a resource
      for (const hex of updatedState.hexGrid) {
        if (hex.isResourceHex) continue;
        
        const distance = getHexDistance(hex.coordinates, playerBase.coordinates);
        if (distance > maxDistance) {
          maxDistance = distance;
          furthestHex = hex;
        }
      }
      
      if (furthestHex) {
        const finalState = setBaseLocation(updatedState, 'ai', furthestHex.coordinates);
        setGameState({
          ...finalState,
          currentPhase: 'planning'
        });
      }
    } else {
      setGameState(updatedState);
    }
  };
  
  const handleUnitMove = (unit: Unit, targetHex: Hex) => {
    // Check if the move is valid
    const isValidMove = validMoves.some(coords => 
      coords.q === targetHex.coordinates.q && 
      coords.r === targetHex.coordinates.r
    );
    
    if (!isValidMove) return;
    
    const unitHex = findHexByCoordinates(gameState.hexGrid, unit.position);
    if (!unitHex) return;
    
    // Add this move to the pending moves
    const newGameState = addPendingMove(
      gameState,
      unit.id,
      gameState.players.player.id,
      targetHex.coordinates
    );
    
    // Create a visually updated state to immediately show the unit movement
    // This doesn't affect the actual game logic, which happens during executeAllMoves
    const visuallyUpdatedHexGrid = [...newGameState.hexGrid];
    
    // Find the indices of the source and target hexes
    const sourceHexIndex = visuallyUpdatedHexGrid.findIndex(
      h => h.coordinates.q === unit.position.q && h.coordinates.r === unit.position.r
    );
    
    const targetHexIndex = visuallyUpdatedHexGrid.findIndex(
      h => h.coordinates.q === targetHex.coordinates.q && h.coordinates.r === targetHex.coordinates.r
    );
    
    if (sourceHexIndex !== -1 && targetHexIndex !== -1) {
      // Create updated unit with new position
      const updatedUnit = {
        ...unit,
        position: targetHex.coordinates
      };
      
      // Update the player's units array with the new position
      const updatedPlayerUnits = newGameState.players.player.units.map(u => 
        u.id === unit.id ? updatedUnit : u
      );
      
      // Update the grid to move the unit visually
      visuallyUpdatedHexGrid[sourceHexIndex] = {
        ...visuallyUpdatedHexGrid[sourceHexIndex],
        unit: undefined
      };
      
      visuallyUpdatedHexGrid[targetHexIndex] = {
        ...visuallyUpdatedHexGrid[targetHexIndex],
        unit: updatedUnit
      };
      
      // Set the visually updated state
      setGameState({
        ...newGameState,
        hexGrid: visuallyUpdatedHexGrid,
        players: {
          ...newGameState.players,
          player: {
            ...newGameState.players.player,
            units: updatedPlayerUnits
          }
        }
      });
    } else {
      // If we couldn't find the hexes, just use the original state update
      setGameState(newGameState);
    }
    
    // Clear selection
    setSelectedUnit(null);
    setValidMoves([]);
  };
  
  const handleUnitPurchase = (unitType: UnitType) => {
    if (!selectedHex || gameState.currentPhase !== 'planning' || isAITurn) return;
    
    // Check if player can afford this unit
    const unitInfo = UNITS[unitType];
    if (!unitInfo || gameState.players.player.points < unitInfo.cost) return;
    
    // Ensure this is a valid placement (close to base)
    const playerBase = gameState.hexGrid.find(h => h.isBase && h.owner === 'player');
    if (!playerBase) return;
    
    const isNearBase = getHexDistance(selectedHex.coordinates, playerBase.coordinates) === 1;
    if (!isNearBase || selectedHex.unit) return;
    
    // Add this unit purchase to pending purchases
    const newGameState = addPendingPurchase(
      gameState, 
      gameState.players.player.id,
      unitType, 
      selectedHex.coordinates
    );
    
    setGameState(newGameState);
    setSelectedHex(null);
  };
  
  const handleEndTurn = () => {
    executeAllMoves();
  };
  
  const executeAllMoves = () => {
    // Execute all player and AI moves
    let updatedState = executeMoves(gameState);
    
    // Now check for combats
    if (updatedState.combats.length > 0) {
      updatedState = {
        ...updatedState,
        currentPhase: 'combat'
      };
    } else {
      // No combats, advance to next round
      updatedState = {
        ...updatedState,
        turnNumber: updatedState.turnNumber + 1,
        planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime,
        currentPhase: 'planning'
      };
      
      // Toggle player turn
      setIsAITurn(!isAITurn);
    }
    
    setGameState(updatedState);
  };
  
  const handleCombatResolve = (combatIndex: number, retreat: boolean) => {
    const updatedState = resolveCombat(gameState, combatIndex, retreat);
    
    // Check if all combats are resolved
    const allResolved = updatedState.combats.every(c => c.resolved);
    
    if (allResolved) {
      // Check win conditions
      const playerBaseDestroyed = !updatedState.hexGrid.some(
        h => h.isBase && h.owner === 'player'
      );
      
      const aiBaseDestroyed = !updatedState.hexGrid.some(
        h => h.isBase && h.owner === 'ai'
      );
      
      if (playerBaseDestroyed || aiBaseDestroyed) {
        setGameState({
          ...updatedState,
          currentPhase: 'gameOver',
          winner: playerBaseDestroyed ? 'ai' : 'player'
        });
      } else {
        // No win yet, advance to next round
        setGameState({
          ...updatedState,
          turnNumber: updatedState.turnNumber + 1,
          planningTimeRemaining: DEFAULT_SETTINGS.planningPhaseTime,
          currentPhase: 'planning',
          combats: []
        });
        
        // Toggle player turn
        setIsAITurn(!isAITurn);
      }
    } else {
      // Still have more combats to resolve
      setGameState(updatedState);
    }
  };
  
  const handleAITurn = () => {
    // AI makes decisions for all units and purchases
    const aiDecisions = getAIMoves(gameState);
    let updatedState = gameState;
    
    // Apply AI moves
    aiDecisions.moves.forEach(move => {
      updatedState = addPendingMove(
        updatedState, 
        move.unitId, 
        move.playerId, 
        move.to
      );
    });
    
    // Apply AI purchases
    aiDecisions.purchases.forEach(purchase => {
      updatedState = addPendingPurchase(
        updatedState,
        purchase.playerId,
        purchase.unitType,
        purchase.position
      );
    });
    
    setGameState(updatedState);
    
    // AI ends turn after short delay
    setTimeout(() => {
      executeAllMoves();
    }, 1000);
  };
  
  // New function to handle selecting a unit from the overview panel
  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    // Find the hex containing the unit
    const unitHex = gameState.hexGrid.find(
      hex => hex.unit && hex.unit.id === unit.id
    );
    if (unitHex) {
      setSelectedHex(unitHex);
      // TODO: Pan camera to the hex (would require ref to camera controls)
    }
  };
  
  // ==================
  // UI Rendering
  // ==================
  
  const renderGameUI = () => {
    // Return the game dashboard during all phases except setup and gameOver
    const showDashboard = gameState.currentPhase !== 'setup' && gameState.currentPhase !== 'gameOver';
    
    switch (gameState.currentPhase) {
      case 'setup':
        return (
          <div className="absolute top-0 right-0 p-4 bg-gray-800 bg-opacity-80 text-white rounded-lg m-4">
            <h2 className="text-xl font-bold mb-2">Setup Phase</h2>
            <p>Select a hex to place your base</p>
          </div>
        );
        
      case 'planning':
        return (
          <>
            {showDashboard && (
              <GameDashboard 
                gameState={gameState}
                turnNumber={gameState.turnNumber}
                isAITurn={isAITurn}
                onUnitSelect={handleUnitSelect}
              />
            )}
            <PlanningPhase
              gameState={gameState}
              selectedHex={selectedHex}
              selectedUnit={selectedUnit}
              isAITurn={isAITurn}
              timer={timer}
              onUnitPurchase={handleUnitPurchase}
              onEndTurn={handleEndTurn}
            />
            {!isAITurn && (
              <div className="absolute top-4 left-64 ml-4">
                <button 
                  onClick={() => {
                    const saved = saveGameToLocalStorage(gameState, { 
                      selectedHex, isAITurn, timer, difficulty 
                    });
                    alert(saved ? 'Game saved successfully!' : 'Failed to save game.');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center"
                >
                  <span className="mr-2">💾</span> Save Game
                </button>
              </div>
            )}
          </>
        );
        
      case 'combat':
        return (
          <>
            {showDashboard && (
              <GameDashboard 
                gameState={gameState}
                turnNumber={gameState.turnNumber}
                isAITurn={isAITurn}
                onUnitSelect={handleUnitSelect}
              />
            )}
            <CombatResolver 
              gameState={gameState}
              onResolveCombat={handleCombatResolve}
            />
          </>
        );
        
      case 'gameOver':
        return (
          <GameOverScreen 
            winner={gameState.winner as 'player' | 'ai'} 
            onRestart={handleRestart}
          />
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="relative w-full h-full">
      <GameBoard 
        gameState={gameState}
        selectedHex={selectedHex ?? undefined}
        validMoves={validMoves}
        onHexClick={handleHexClick}
        onUnitClick={handleUnitClick}
      />
      {renderGameUI()}
      
      {/* Show intro screen if game hasn't started */}
      {!gameStarted && (
        <IntroScreen 
          onStartGame={handleStartGame} 
          onContinueGame={handleContinueGame}
          hasSavedGame={hasSavedGame}
        />
      )}
    </div>
  );
}; 