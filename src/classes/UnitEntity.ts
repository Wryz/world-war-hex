import { UnitType, PlayerType, Ability } from '@/types/game';
import { GameEntity } from './GameEntity';
import { HexPosition } from './HexPosition';

// Define interface for the original Unit type for compatibility
export interface IUnit {
  id: string;
  type: UnitType;
  owner: PlayerType;
  position: { q: number; r: number };
  movementRange: number;
  attackPower: number;
  lifespan: number;
  maxLifespan: number;
  cost: number;
  abilities: Ability[];
  hasMoved: boolean;
  isEngagedInCombat: boolean;
}

/**
 * Represents a unit in the game
 */
export class UnitEntity extends GameEntity {
  type: UnitType;
  owner: PlayerType;
  movementRange: number;
  attackPower: number;
  lifespan: number;
  maxLifespan: number;
  cost: number;
  abilities: Ability[];
  hasMoved: boolean;
  isEngagedInCombat: boolean;
  modelUrl: string;

  constructor(
    id: string, 
    type: UnitType, 
    owner: PlayerType, 
    position: HexPosition,
    movementRange: number,
    attackPower: number,
    lifespan: number,
    maxLifespan: number,
    cost: number,
    abilities: Ability[] = [],
    modelUrl: string = '/models/blue-knight.glb', // Default model
  ) {
    super(id, position);
    this.type = type;
    this.owner = owner;
    this.movementRange = movementRange;
    this.attackPower = attackPower;
    this.lifespan = lifespan;
    this.maxLifespan = maxLifespan;
    this.cost = cost;
    this.abilities = abilities;
    this.hasMoved = false;
    this.isEngagedInCombat = false;
    this.modelUrl = modelUrl;

    // Set the appropriate model based on unit type and owner
    if (owner === 'player') {
      this.modelUrl = '/models/blue-knight.glb';
    } else {
      this.modelUrl = '/models/red-knight.glb';
    }
  }

  // Convert to the original Unit type for compatibility
  toUnit(): IUnit {
    return {
      id: this.id,
      type: this.type,
      owner: this.owner,
      position: this.position.toCoordinates(),
      movementRange: this.movementRange,
      attackPower: this.attackPower,
      lifespan: this.lifespan,
      maxLifespan: this.maxLifespan,
      cost: this.cost,
      abilities: [...this.abilities],
      hasMoved: this.hasMoved,
      isEngagedInCombat: this.isEngagedInCombat
    };
  }

  static fromUnit(unit: IUnit): UnitEntity {
    return new UnitEntity(
      unit.id,
      unit.type,
      unit.owner,
      HexPosition.fromCoordinates(unit.position),
      unit.movementRange,
      unit.attackPower,
      unit.lifespan,
      unit.maxLifespan,
      unit.cost,
      [...unit.abilities],
      unit.owner === 'player' ? '/models/blue-knight.glb' : '/models/red-knight.glb'
    );
  }
} 