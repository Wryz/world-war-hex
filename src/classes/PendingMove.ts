import { HexPosition } from './HexPosition';

/**
 * Represents a pending move in the game
 */
export class PendingMove {
  unitId: string;
  playerId: string;
  from: HexPosition;
  to: HexPosition;

  constructor(unitId: string, playerId: string, from: HexPosition, to: HexPosition) {
    this.unitId = unitId;
    this.playerId = playerId;
    this.from = from;
    this.to = to;
  }
} 