import { PlayerType } from '@/types/game';
import { HexPosition } from './HexPosition';
import { UnitEntity } from './UnitEntity';

/**
 * Represents a player in the game
 */
export class Player {
  id: string;
  type: PlayerType;
  points: number;
  baseLocation?: HexPosition;
  baseHealth?: number;
  maxBaseHealth?: number;
  units: Map<string, UnitEntity>; // Map of unit ID to UnitEntity

  constructor(
    id: string,
    type: PlayerType,
    points: number,
    baseLocation?: HexPosition,
    baseHealth?: number,
    maxBaseHealth?: number
  ) {
    this.id = id;
    this.type = type;
    this.points = points;
    this.baseLocation = baseLocation;
    this.baseHealth = baseHealth;
    this.maxBaseHealth = maxBaseHealth;
    this.units = new Map();
  }

  addUnit(unit: UnitEntity): void {
    this.units.set(unit.id, unit);
  }

  removeUnit(unitId: string): boolean {
    return this.units.delete(unitId);
  }

  getUnits(): UnitEntity[] {
    return Array.from(this.units.values());
  }
} 