import { HexPosition } from './HexPosition';
import { UnitEntity } from './UnitEntity';

/**
 * Represents a combat situation in the game
 */
export class Combat {
  hexPosition: HexPosition;
  attackers: UnitEntity[];
  defenders: UnitEntity[];
  resolved: boolean;
  retreating?: UnitEntity[];

  constructor(
    hexPosition: HexPosition,
    attackers: UnitEntity[],
    defenders: UnitEntity[],
    resolved: boolean = false,
    retreating?: UnitEntity[]
  ) {
    this.hexPosition = hexPosition;
    this.attackers = attackers;
    this.defenders = defenders;
    this.resolved = resolved;
    this.retreating = retreating;
  }
} 