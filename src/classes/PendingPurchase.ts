import { UnitType } from '@/types/game';
import { HexPosition } from './HexPosition';

/**
 * Represents a pending purchase in the game
 */
export class PendingPurchase {
  playerId: string;
  unitType: UnitType;
  position: HexPosition;

  constructor(playerId: string, unitType: UnitType, position: HexPosition) {
    this.playerId = playerId;
    this.unitType = unitType;
    this.position = position;
  }
} 