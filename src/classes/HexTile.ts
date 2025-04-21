import { TerrainType, PlayerType } from '@/types/game';
import { GameEntity } from './GameEntity';
import { HexPosition } from './HexPosition';
import { UnitEntity, IUnit } from './UnitEntity';

// Define interface for the original Hex type for compatibility
export interface IHex {
  id: string;
  coordinates: { q: number; r: number };
  terrain: TerrainType;
  isBase?: boolean;
  isResourceHex?: boolean;
  resourceValue?: number;
  owner?: PlayerType;
  unit?: IUnit;
  baseHealth?: number;
}

/**
 * Represents a hex tile on the grid
 */
export class HexTile extends GameEntity {
  terrain: TerrainType;
  isBase: boolean;
  isResourceHex: boolean;
  resourceValue: number;
  owner?: PlayerType;
  unit?: UnitEntity;
  baseHealth?: number;

  constructor(
    id: string,
    position: HexPosition,
    terrain: TerrainType,
    isBase: boolean = false,
    isResourceHex: boolean = false,
    resourceValue: number = 0,
    owner?: PlayerType,
    unit?: UnitEntity,
    baseHealth?: number
  ) {
    super(id, position);
    this.terrain = terrain;
    this.isBase = isBase;
    this.isResourceHex = isResourceHex;
    this.resourceValue = resourceValue;
    this.owner = owner;
    this.unit = unit;
    this.baseHealth = baseHealth;
  }

  // Convert to the original Hex type for compatibility
  toHex(): IHex {
    return {
      id: this.id,
      coordinates: this.position.toCoordinates(),
      terrain: this.terrain,
      isBase: this.isBase,
      isResourceHex: this.isResourceHex,
      resourceValue: this.resourceValue,
      owner: this.owner,
      unit: this.unit?.toUnit(),
      baseHealth: this.baseHealth
    };
  }

  static fromHex(hex: IHex): HexTile {
    return new HexTile(
      hex.id,
      HexPosition.fromCoordinates(hex.coordinates),
      hex.terrain,
      hex.isBase || false,
      hex.isResourceHex || false,
      hex.resourceValue || 0,
      hex.owner,
      hex.unit ? UnitEntity.fromUnit(hex.unit) : undefined,
      hex.baseHealth
    );
  }
} 