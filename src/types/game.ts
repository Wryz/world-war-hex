export type TerrainType = 
  | 'plain'
  | 'mountain'
  | 'forest'
  | 'water'
  | 'desert'
  | 'resource';

export type PlayerType = 'player' | 'ai';

export interface HexCoordinates {
  q: number; // Axial coordinates
  r: number;
}

export interface Hex {
  id: string;
  coordinates: HexCoordinates;
  terrain: TerrainType;
  isBase?: boolean;
  isResourceHex?: boolean;
  resourceValue?: number; // Points generated per turn if controlled
  owner?: PlayerType;
  unit?: Unit;
  baseHealth?: number; // Health of base if this is a base hex
}

export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerType;
  position: HexCoordinates;
  movementRange: number;
  attackPower: number;
  lifespan: number; // Current health
  maxLifespan: number; // Max health
  cost: number;
  abilities: Ability[];
  hasMoved: boolean;
  isEngagedInCombat: boolean;
}

export type UnitType = 
  | 'infantry' 
  | 'tank' 
  | 'artillery' 
  | 'helicopter' 
  | 'medic';

export type Ability = 
  | 'rangedAttack' 
  | 'healing' 
  | 'terrainBonus' 
  | 'rapidMovement' 
  | 'stealth';

export interface Player {
  id: string;
  type: PlayerType;
  points: number;
  baseLocation?: HexCoordinates;
  baseHealth?: number; // Current health of player's base
  maxBaseHealth?: number; // Maximum health of player's base
  units: Unit[];
}

export interface GameState {
  hexGrid: Hex[];
  players: Record<PlayerType, Player>;
  currentPhase: GamePhase;
  turnNumber: number;
  planningTimeRemaining: number;
  winner?: PlayerType;
  pendingMoves: Move[];
  pendingPurchases: Purchase[];
  combats: Combat[];
  settings?: GameSettings;
}

export type GamePhase = 
  | 'setup' 
  | 'planning' 
  | 'execution' 
  | 'combat' 
  | 'gameOver';

export interface Move {
  unitId: string;
  playerId: string;
  from: HexCoordinates;
  to: HexCoordinates;
}

export interface Purchase {
  playerId: string;
  unitType: UnitType;
  position: HexCoordinates;
}

export interface Combat {
  hexCoordinates: HexCoordinates;
  attackers: Unit[];
  defenders: Unit[];
  resolved: boolean;
  retreating?: Unit[];
}

export interface GameSettings {
  gridSize: number;
  planningPhaseTime: number;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  terrainDistribution: Record<TerrainType, number>;
  resourceHexCount: number;
} 