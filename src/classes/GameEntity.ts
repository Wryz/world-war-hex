import { HexPosition } from './HexPosition';

/**
 * Base class for game entities that exist on the hex grid
 */
export abstract class GameEntity {
  id: string;
  position: HexPosition;

  constructor(id: string, position: HexPosition) {
    this.id = id;
    this.position = position;
  }
} 