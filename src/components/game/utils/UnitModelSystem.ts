import { PlayerType, UnitType } from '@/types/game';

// Animation clip names in a unit's model (matched case-insensitively by substring)
interface UnitAnimations {
  idle: string;
  holdShield: string;
  attack: string;
  walk: string;
}

interface UnitAttributes {
  animations: UnitAnimations;
  scale: number;                 // Scale of the model
  heightOffset: number;          // Height offset to position model correctly
  rotationOffset: number;        // Rotation in radians if needed
  indicatorColor: string;        // Color for the unit indicator
  indicatorScale: number;        // Scale of the indicator
}

// 3D models for each side - every unit type uses the knight model in its side's colours,
// and unit types are told apart by size and by the coloured indicator under the unit
const UNIT_MODEL_PATHS: Record<PlayerType, string> = {
  player: '/models/blue-knight.glb',
  ai: '/models/red-knight.glb'
};

// The knight models face -Z; the game treats +Z as forward, so turn them around
const KNIGHT_MODEL_FACING = Math.PI;

const KNIGHT_ANIMATIONS: UnitAnimations = {
  idle: 'idle',
  holdShield: 'holdshield',
  attack: 'stab',
  walk: 'walk'
};

const knight = (scale: number, indicatorColor: string, indicatorScale: number): UnitAttributes => ({
  animations: KNIGHT_ANIMATIONS,
  scale,
  heightOffset: 0,
  rotationOffset: KNIGHT_MODEL_FACING,
  indicatorColor,
  indicatorScale
});

// Map of unit types to their 3D model attributes
const UNIT_MODELS: Record<UnitType, UnitAttributes> = {
  infantry: knight(1.0, '#4682B4', 0.5),
  tank: knight(1.15, '#8B0000', 0.6),
  helicopter: knight(1.05, '#7B1FA2', 0.55),
  artillery: knight(0.9, '#006400', 0.5),
  medic: knight(0.95, '#FFFF00', 0.5)
};

// Seconds between strikes in battle - each troop type fights at its own pace
export const ATTACK_INTERVALS: Record<UnitType, number> = {
  helicopter: 0.7, // Knights: quick cavalry strikes
  infantry: 0.9,   // Swordsmen
  medic: 1.2,
  tank: 1.3,       // Pikemen: heavy, deliberate thrusts
  artillery: 1.6   // Archers: draw, aim and loose
};

export type AnimationState = keyof UnitAnimations;

export const getUnitModelAttributes = (unitType: UnitType): UnitAttributes =>
  UNIT_MODELS[unitType] ?? UNIT_MODELS.infantry;

// The 3D model for a unit's owner
export const getUnitModelPath = (owner: PlayerType): string => UNIT_MODEL_PATHS[owner];

// Name of the animation clip to play for a unit doing something
export const getAnimationName = (unitType: UnitType, state: AnimationState): string =>
  getUnitModelAttributes(unitType).animations[state];
