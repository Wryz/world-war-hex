import { GamePhase, UnitType, PlayerType } from '@/types/game';
import { HexPosition } from './HexPosition';
import { HexTile, IHex } from './HexTile';
import { Player } from './Player';
import { PendingMove } from './PendingMove';
import { PendingPurchase } from './PendingPurchase';
import { Combat } from './Combat';
import { UnitEntity, IUnit } from './UnitEntity';

// Define interface for legacy game state format
export interface ILegacyGameState {
  hexGrid: IHex[];
  players: {
    player: {
      id: string;
      type: PlayerType;
      points: number;
      baseLocation?: { q: number; r: number };
      baseHealth?: number;
      maxBaseHealth?: number;
      units: IUnit[];
    };
    ai: {
      id: string;
      type: PlayerType;
      points: number;
      baseLocation?: { q: number; r: number };
      baseHealth?: number;
      maxBaseHealth?: number;
      units: IUnit[];
    };
  };
  currentPhase: GamePhase;
  turnNumber: number;
  planningTimeRemaining: number;
  winner?: PlayerType;
  pendingMoves: {
    unitId: string;
    playerId: string;
    from: { q: number; r: number };
    to: { q: number; r: number };
  }[];
  pendingPurchases: {
    playerId: string;
    unitType: UnitType;
    position: { q: number; r: number };
  }[];
  combats: {
    hexCoordinates: { q: number; r: number };
    attackers: IUnit[];
    defenders: IUnit[];
    resolved: boolean;
    retreating?: IUnit[];
  }[];
  selectedUnitTypeForPurchase?: UnitType | null;
}

/**
 * The main game state class that contains all game data
 */
export class GameState {
  hexGrid: Map<string, HexTile>; // Map of position hash to HexTile
  players: Map<PlayerType, Player>; // Map of player type to Player
  currentPhase: GamePhase;
  turnNumber: number;
  planningTimeRemaining: number;
  winner?: PlayerType;
  pendingMoves: PendingMove[];
  pendingPurchases: PendingPurchase[];
  combats: Combat[];
  selectedUnitTypeForPurchase?: UnitType | null;

  constructor() {
    this.hexGrid = new Map();
    this.players = new Map();
    this.currentPhase = 'setup';
    this.turnNumber = 0;
    this.planningTimeRemaining = 60; // Default planning time in seconds
    this.pendingMoves = [];
    this.pendingPurchases = [];
    this.combats = [];
  }

  addHex(hex: HexTile): void {
    this.hexGrid.set(hex.position.hash(), hex);
  }

  getHex(position: HexPosition): HexTile | undefined {
    return this.hexGrid.get(position.hash());
  }

  getAllHexes(): HexTile[] {
    return Array.from(this.hexGrid.values());
  }

  addPlayer(player: Player): void {
    this.players.set(player.type, player);
  }

  getPlayer(type: PlayerType): Player | undefined {
    return this.players.get(type);
  }

  addPendingMove(move: PendingMove): void {
    this.pendingMoves.push(move);
  }

  addPendingPurchase(purchase: PendingPurchase): void {
    this.pendingPurchases.push(purchase);
  }

  // Helper method to convert from legacy GameState format
  static fromLegacy(legacyState: ILegacyGameState): GameState {
    const state = new GameState();
    
    // Set basic properties
    state.currentPhase = legacyState.currentPhase;
    state.turnNumber = legacyState.turnNumber;
    state.planningTimeRemaining = legacyState.planningTimeRemaining;
    state.winner = legacyState.winner;
    state.selectedUnitTypeForPurchase = legacyState.selectedUnitTypeForPurchase;
    
    // Convert hex grid
    legacyState.hexGrid.forEach((hex: IHex) => {
      const hexTile = HexTile.fromHex(hex);
      state.addHex(hexTile);
    });
    
    // Convert players - now we have specific player and ai objects
    // Add player
    const playerData = legacyState.players.player;
    const playerBaseLocation = playerData.baseLocation 
      ? HexPosition.fromCoordinates(playerData.baseLocation) 
      : undefined;
      
    const playerObj = new Player(
      playerData.id,
      'player',
      playerData.points,
      playerBaseLocation,
      playerData.baseHealth,
      playerData.maxBaseHealth
    );
    
    // Add units to player
    playerData.units.forEach((unit: IUnit) => {
      const unitEntity = UnitEntity.fromUnit(unit);
      playerObj.addUnit(unitEntity);
    });
    
    state.addPlayer(playerObj);
    
    // Add AI
    const aiData = legacyState.players.ai;
    const aiBaseLocation = aiData.baseLocation 
      ? HexPosition.fromCoordinates(aiData.baseLocation) 
      : undefined;
      
    const aiObj = new Player(
      aiData.id,
      'ai',
      aiData.points,
      aiBaseLocation,
      aiData.baseHealth,
      aiData.maxBaseHealth
    );
    
    // Add units to AI
    aiData.units.forEach((unit: IUnit) => {
      const unitEntity = UnitEntity.fromUnit(unit);
      aiObj.addUnit(unitEntity);
    });
    
    state.addPlayer(aiObj);
    
    // Convert pending moves
    state.pendingMoves = legacyState.pendingMoves.map((move) => 
      new PendingMove(
        move.unitId,
        move.playerId,
        HexPosition.fromCoordinates(move.from),
        HexPosition.fromCoordinates(move.to)
      )
    );
    
    // Convert pending purchases
    state.pendingPurchases = legacyState.pendingPurchases.map((purchase) =>
      new PendingPurchase(
        purchase.playerId,
        purchase.unitType,
        HexPosition.fromCoordinates(purchase.position)
      )
    );
    
    // Convert combats
    state.combats = legacyState.combats.map((combat) => {
      const attackers = combat.attackers.map((unit: IUnit) => UnitEntity.fromUnit(unit));
      const defenders = combat.defenders.map((unit: IUnit) => UnitEntity.fromUnit(unit));
      const retreating = combat.retreating 
        ? combat.retreating.map((unit: IUnit) => UnitEntity.fromUnit(unit)) 
        : undefined;
        
      return new Combat(
        HexPosition.fromCoordinates(combat.hexCoordinates),
        attackers,
        defenders,
        combat.resolved,
        retreating
      );
    });
    
    return state;
  }
  
  // Helper method to convert to legacy GameState format for compatibility
  toLegacy(): ILegacyGameState {
    const playerUnits = this.players.get('player')?.getUnits() || [];
    const aiUnits = this.players.get('ai')?.getUnits() || [];
    
    return {
      hexGrid: this.getAllHexes().map(hex => hex.toHex()),
      players: {
        player: {
          id: this.players.get('player')?.id || 'player',
          type: 'player',
          points: this.players.get('player')?.points || 0,
          baseLocation: this.players.get('player')?.baseLocation?.toCoordinates(),
          baseHealth: this.players.get('player')?.baseHealth,
          maxBaseHealth: this.players.get('player')?.maxBaseHealth,
          units: playerUnits.map(unit => unit.toUnit())
        },
        ai: {
          id: this.players.get('ai')?.id || 'ai',
          type: 'ai',
          points: this.players.get('ai')?.points || 0,
          baseLocation: this.players.get('ai')?.baseLocation?.toCoordinates(),
          baseHealth: this.players.get('ai')?.baseHealth,
          maxBaseHealth: this.players.get('ai')?.maxBaseHealth,
          units: aiUnits.map(unit => unit.toUnit())
        }
      },
      currentPhase: this.currentPhase,
      turnNumber: this.turnNumber,
      planningTimeRemaining: this.planningTimeRemaining,
      winner: this.winner,
      pendingMoves: this.pendingMoves.map(move => ({
        unitId: move.unitId,
        playerId: move.playerId,
        from: move.from.toCoordinates(),
        to: move.to.toCoordinates()
      })),
      pendingPurchases: this.pendingPurchases.map(purchase => ({
        playerId: purchase.playerId,
        unitType: purchase.unitType,
        position: purchase.position.toCoordinates()
      })),
      combats: this.combats.map(combat => ({
        hexCoordinates: combat.hexPosition.toCoordinates(),
        attackers: combat.attackers.map(unit => unit.toUnit()),
        defenders: combat.defenders.map(unit => unit.toUnit()),
        resolved: combat.resolved,
        retreating: combat.retreating?.map(unit => unit.toUnit())
      })),
      selectedUnitTypeForPurchase: this.selectedUnitTypeForPurchase
    };
  }
} 