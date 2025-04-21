import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { UnitType, PlayerType } from '@/types/game';
import { GameState, HexTile, UnitEntity, HexPosition } from '@/classes';
import { DEFAULT_SETTINGS, UNITS } from '@/lib/game/gameState';

// Define the state structure that will be stored in the context
interface GameDataState {
  gameState: GameState;
  selectedHex: HexTile | null;
  selectedUnit: UnitEntity | null;
  validMoves: HexPosition[];
  selectedUnitTypeForPurchase: UnitType | null;
  isAITurn: boolean;
  timer: number;
  gameStarted: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Define the actions that can be dispatched to the reducer
type GameDataAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'SET_SELECTED_HEX'; payload: HexTile | null }
  | { type: 'SET_SELECTED_UNIT'; payload: UnitEntity | null }
  | { type: 'SET_VALID_MOVES'; payload: HexPosition[] }
  | { type: 'SET_SELECTED_UNIT_TYPE'; payload: UnitType | null }
  | { type: 'SET_IS_AI_TURN'; payload: boolean }
  | { type: 'SET_TIMER'; payload: number }
  | { type: 'SET_GAME_STARTED'; payload: boolean }
  | { type: 'SET_DIFFICULTY'; payload: 'easy' | 'medium' | 'hard' }
  | { type: 'UPDATE_HEX'; payload: { position: HexPosition; updates: Partial<HexTile> } }
  | { type: 'UPDATE_UNIT'; payload: { unitId: string; playerId: PlayerType; updates: Partial<UnitEntity> } }
  | { type: 'ADD_UNIT'; payload: { unit: UnitEntity; position: HexPosition } }
  | { type: 'REMOVE_UNIT'; payload: { unitId: string; playerId: PlayerType } }
  | { type: 'ADD_PENDING_PURCHASE'; payload: { unitType: UnitType; position: HexPosition } }
  | { type: 'EXECUTE_MOVES' };

// Define the context type
interface GameDataContextType {
  state: GameDataState;
  dispatch: React.Dispatch<GameDataAction>;
  
  // Helper methods to manipulate the game state
  selectHex: (hex: HexTile | null) => void;
  selectUnit: (unit: UnitEntity | null) => void;
  calculateValidMoves: (unit: UnitEntity) => HexPosition[];
  purchaseUnit: (unitType: UnitType, position: HexPosition) => boolean;
  moveUnit: (unit: UnitEntity, targetPosition: HexPosition) => void;
  endTurn: () => void;
  startGame: (difficulty: 'easy' | 'medium' | 'hard') => void;
  restartGame: () => void;
}

// Create the context
const GameDataContext = createContext<GameDataContextType | undefined>(undefined);

// Initial state function
const createInitialState = (): GameDataState => {
  // Create a new game state with our class structure
  const gameState = new GameState();
  
  return {
    gameState,
    selectedHex: null,
    selectedUnit: null,
    validMoves: [],
    selectedUnitTypeForPurchase: null,
    isAITurn: false,
    timer: DEFAULT_SETTINGS.planningPhaseTime,
    gameStarted: false,
    difficulty: 'medium',
  };
};

// Reducer function to handle state updates
const gameDataReducer = (state: GameDataState, action: GameDataAction): GameDataState => {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return {
        ...state,
        gameState: action.payload,
      };
    
    case 'SET_SELECTED_HEX':
      return {
        ...state,
        selectedHex: action.payload,
      };
    
    case 'SET_SELECTED_UNIT':
      return {
        ...state,
        selectedUnit: action.payload,
      };
    
    case 'SET_VALID_MOVES':
      return {
        ...state,
        validMoves: action.payload,
      };
    
    case 'SET_SELECTED_UNIT_TYPE':
      // Update both local state and game state
      state.gameState.selectedUnitTypeForPurchase = action.payload;
      return {
        ...state,
        selectedUnitTypeForPurchase: action.payload,
      };
    
    case 'SET_IS_AI_TURN':
      return {
        ...state,
        isAITurn: action.payload,
      };
    
    case 'SET_TIMER':
      return {
        ...state,
        timer: action.payload,
      };
    
    case 'SET_GAME_STARTED':
      return {
        ...state,
        gameStarted: action.payload,
      };
    
    case 'SET_DIFFICULTY':
      return {
        ...state,
        difficulty: action.payload,
      };
    
    case 'UPDATE_HEX': {
      const { position, updates } = action.payload;
      const hexTile = state.gameState.getHex(position);
      
      if (hexTile) {
        // Create a new hex with updated properties
        const updatedHex = new HexTile(
          hexTile.id,
          hexTile.position,
          updates.terrain || hexTile.terrain,
          updates.isBase !== undefined ? updates.isBase : hexTile.isBase,
          updates.isResourceHex !== undefined ? updates.isResourceHex : hexTile.isResourceHex,
          updates.resourceValue !== undefined ? updates.resourceValue : hexTile.resourceValue,
          updates.owner !== undefined ? updates.owner : hexTile.owner,
          updates.unit !== undefined ? updates.unit : hexTile.unit,
          updates.baseHealth !== undefined ? updates.baseHealth : hexTile.baseHealth
        );
        
        // Update the hex in the game state
        state.gameState.addHex(updatedHex);
      }
      
      return { ...state };
    }
    
    case 'UPDATE_UNIT': {
      const { unitId, playerId, updates } = action.payload;
      const player = state.gameState.getPlayer(playerId);
      
      if (player) {
        const unit = player.units.get(unitId);
        
        if (unit) {
          // Create a new unit with updated properties
          const updatedUnit = new UnitEntity(
            unit.id,
            updates.type || unit.type,
            unit.owner,
            updates.position || unit.position,
            updates.movementRange !== undefined ? updates.movementRange : unit.movementRange,
            updates.attackPower !== undefined ? updates.attackPower : unit.attackPower,
            updates.lifespan !== undefined ? updates.lifespan : unit.lifespan,
            updates.maxLifespan !== undefined ? updates.maxLifespan : unit.maxLifespan,
            unit.cost,
            updates.abilities || unit.abilities,
            unit.modelUrl
          );
          
          // Set other properties
          updatedUnit.hasMoved = updates.hasMoved !== undefined ? updates.hasMoved : unit.hasMoved;
          updatedUnit.isEngagedInCombat = updates.isEngagedInCombat !== undefined ? updates.isEngagedInCombat : unit.isEngagedInCombat;
          
          // Update the unit in the player
          player.addUnit(updatedUnit);
          
          // If position changed, update hex grid as well
          if (updates.position && !updates.position.equals(unit.position)) {
            // Remove unit from old position
            const oldHex = state.gameState.getHex(unit.position);
            if (oldHex && oldHex.unit?.id === unit.id) {
              const updatedOldHex = new HexTile(
                oldHex.id,
                oldHex.position,
                oldHex.terrain,
                oldHex.isBase,
                oldHex.isResourceHex,
                oldHex.resourceValue,
                oldHex.owner,
                undefined, // Remove unit
                oldHex.baseHealth
              );
              state.gameState.addHex(updatedOldHex);
            }
            
            // Add unit to new position
            const newHex = state.gameState.getHex(updates.position);
            if (newHex) {
              const updatedNewHex = new HexTile(
                newHex.id,
                newHex.position,
                newHex.terrain,
                newHex.isBase,
                newHex.isResourceHex,
                newHex.resourceValue,
                newHex.owner,
                updatedUnit,
                newHex.baseHealth
              );
              state.gameState.addHex(updatedNewHex);
            }
          }
        }
      }
      
      return { ...state };
    }
    
    case 'ADD_UNIT': {
      const { unit, position } = action.payload;
      const player = state.gameState.getPlayer(unit.owner);
      
      if (player) {
        // Add unit to the player
        player.addUnit(unit);
        
        // Add unit to the hex grid
        const hex = state.gameState.getHex(position);
        if (hex) {
          const updatedHex = new HexTile(
            hex.id,
            hex.position,
            hex.terrain,
            hex.isBase,
            hex.isResourceHex,
            hex.resourceValue,
            hex.owner,
            unit,
            hex.baseHealth
          );
          state.gameState.addHex(updatedHex);
        }
      }
      
      return { ...state };
    }
    
    case 'REMOVE_UNIT': {
      const { unitId, playerId } = action.payload;
      const player = state.gameState.getPlayer(playerId);
      
      if (player) {
        const unit = player.units.get(unitId);
        
        if (unit) {
          // Remove unit from player
          player.removeUnit(unitId);
          
          // Remove unit from hex grid
          const hex = state.gameState.getHex(unit.position);
          if (hex && hex.unit?.id === unitId) {
            const updatedHex = new HexTile(
              hex.id,
              hex.position,
              hex.terrain,
              hex.isBase,
              hex.isResourceHex,
              hex.resourceValue,
              hex.owner,
              undefined, // Remove unit
              hex.baseHealth
            );
            state.gameState.addHex(updatedHex);
          }
        }
      }
      
      return { ...state };
    }
    
    case 'ADD_PENDING_PURCHASE': {
      const { unitType, position } = action.payload;
      const purchase = {
        playerId: 'player',
        unitType,
        position,
      };
      
      state.gameState.addPendingPurchase(purchase);
      
      return { ...state };
    }
    
    case 'EXECUTE_MOVES': {
      // This would be a complex operation to execute all pending moves and purchases
      // For now, we'll just reset the pending arrays
      state.gameState.pendingMoves = [];
      state.gameState.pendingPurchases = [];
      
      return { ...state };
    }
    
    default:
      return state;
  }
};

// Provider component
export const GameDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameDataReducer, null, createInitialState);
  
  // Helper methods to manipulate the game state
  const selectHex = (hex: HexTile | null) => {
    dispatch({ type: 'SET_SELECTED_HEX', payload: hex });
  };
  
  const selectUnit = (unit: UnitEntity | null) => {
    dispatch({ type: 'SET_SELECTED_UNIT', payload: unit });
    
    if (unit) {
      const validMoves = calculateValidMoves(unit);
      dispatch({ type: 'SET_VALID_MOVES', payload: validMoves });
    } else {
      dispatch({ type: 'SET_VALID_MOVES', payload: [] });
    }
  };
  
  const calculateValidMoves = (unit: UnitEntity): HexPosition[] => {
    // Basic implementation - in a real game this would consider terrain, other units, etc.
    const validMoves: HexPosition[] = [];
    const { q, r } = unit.position;
    
    // Check neighboring hexes within movement range
    for (let dq = -unit.movementRange; dq <= unit.movementRange; dq++) {
      for (let dr = Math.max(-unit.movementRange, -dq - unit.movementRange); 
           dr <= Math.min(unit.movementRange, -dq + unit.movementRange); 
           dr++) {
        const newQ = q + dq;
        const newR = r + dr;
        
        // Skip the current position
        if (dq === 0 && dr === 0) continue;
        
        const position = new HexPosition(newQ, newR);
        const hex = state.gameState.getHex(position);
        
        // Check if the hex exists and is valid for movement
        if (hex && hex.terrain !== 'water' && hex.terrain !== 'mountain' && !hex.unit) {
          validMoves.push(position);
        }
      }
    }
    
    return validMoves;
  };
  
  const purchaseUnit = (unitType: UnitType, position: HexPosition): boolean => {
    const playerState = state.gameState.getPlayer('player');
    
    if (playerState) {
      const unitData = UNITS[unitType];
      
      // Check if player has enough points
      if (playerState.points >= unitData.cost) {
        // Check if position is valid (near base, not occupied, etc.)
        const hex = state.gameState.getHex(position);
        
        if (hex && !hex.unit && !hex.isBase && hex.terrain !== 'water' && hex.terrain !== 'mountain') {
          // Add pending purchase
          dispatch({ 
            type: 'ADD_PENDING_PURCHASE', 
            payload: { unitType, position } 
          });
          
          // Update player points
          playerState.points -= unitData.cost;
          
          // Clear selected unit type
          dispatch({ type: 'SET_SELECTED_UNIT_TYPE', payload: null });
          
          return true;
        }
      }
    }
    
    return false;
  };
  
  const moveUnit = (unit: UnitEntity, targetPosition: HexPosition) => {
    const validMoves = calculateValidMoves(unit);
    
    // Check if the target position is valid
    const isValidMove = validMoves.some(pos => pos.equals(targetPosition));
    
    if (isValidMove) {
      // Update the unit's position
      dispatch({
        type: 'UPDATE_UNIT',
        payload: {
          unitId: unit.id,
          playerId: unit.owner,
          updates: {
            position: targetPosition,
            hasMoved: true
          }
        }
      });
      
      // Clear selection
      selectHex(null);
      selectUnit(null);
    }
  };
  
  const endTurn = () => {
    // Execute pending moves and purchases
    dispatch({ type: 'EXECUTE_MOVES' });
    
    // Clear any selections
    selectHex(null);
    selectUnit(null);
    dispatch({ type: 'SET_VALID_MOVES', payload: [] });
    dispatch({ type: 'SET_SELECTED_UNIT_TYPE', payload: null });
    
    // Switch to AI turn
    dispatch({ type: 'SET_IS_AI_TURN', payload: true });
    
    // In a real implementation, you would trigger AI logic here
    // For now, we'll just switch back to player turn after a delay
    setTimeout(() => {
      dispatch({ type: 'SET_IS_AI_TURN', payload: false });
    }, 1000);
  };
  
  const startGame = (difficulty: 'easy' | 'medium' | 'hard') => {
    // In a full implementation, you would initialize the game state from the legacy functions
    // For now, just set the difficulty and mark the game as started
    dispatch({ type: 'SET_DIFFICULTY', payload: difficulty });
    dispatch({ type: 'SET_GAME_STARTED', payload: true });
    
    // Create a basic game state
    const newGameState = new GameState();
    // Initialize with default settings (method needs to be implemented in GameState class)
    // For now, we'll just use the empty constructor
    
    dispatch({ type: 'SET_GAME_STATE', payload: newGameState });
  };
  
  const restartGame = () => {
    // Reset to initial state
    dispatch({ type: 'SET_GAME_STATE', payload: new GameState() });
    dispatch({ type: 'SET_SELECTED_HEX', payload: null });
    dispatch({ type: 'SET_SELECTED_UNIT', payload: null });
    dispatch({ type: 'SET_VALID_MOVES', payload: [] });
    dispatch({ type: 'SET_SELECTED_UNIT_TYPE', payload: null });
    dispatch({ type: 'SET_IS_AI_TURN', payload: false });
    dispatch({ type: 'SET_TIMER', payload: DEFAULT_SETTINGS.planningPhaseTime });
    dispatch({ type: 'SET_GAME_STARTED', payload: false });
  };
  
  // Create the context value
  const contextValue: GameDataContextType = {
    state,
    dispatch,
    selectHex,
    selectUnit,
    calculateValidMoves,
    purchaseUnit,
    moveUnit,
    endTurn,
    startGame,
    restartGame
  };
  
  return (
    <GameDataContext.Provider value={contextValue}>
      {children}
    </GameDataContext.Provider>
  );
};

// Hook for using the game data context
export const useGameData = (): GameDataContextType => {
  const context = useContext(GameDataContext);
  
  if (context === undefined) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  
  return context;
}; 