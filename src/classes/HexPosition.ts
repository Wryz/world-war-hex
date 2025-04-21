import { HexCoordinates } from '@/types/game';

/**
 * Represents a position on the hex grid
 */
export class HexPosition {
  q: number;
  r: number;

  constructor(q: number, r: number) {
    this.q = q;
    this.r = r;
  }

  equals(other: HexPosition | HexCoordinates): boolean {
    return this.q === other.q && this.r === other.r;
  }

  hash(): string {
    return `${this.q},${this.r}`;
  }

  static fromCoordinates(coordinates: HexCoordinates): HexPosition {
    return new HexPosition(coordinates.q, coordinates.r);
  }

  toCoordinates(): HexCoordinates {
    return { q: this.q, r: this.r };
  }
} 