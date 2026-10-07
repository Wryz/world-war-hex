import { PlayerType, UnitType } from '@/types/game';

// Define the animation names each unit type can have
export interface UnitAnimations {
  idle: string;
  holdShield?: string;
  attack?: string;
  walk?: string;
  death?: string;
  special?: string;
}

// Define attributes for each unit type
export interface UnitAttributes {
  animations: UnitAnimations;    // Animation mapping
  scale: number;                 // Scale of the model
  heightOffset: number;          // Height offset to position model correctly
  rotationOffset: number;        // Rotation in radians if needed
  indicatorColor: string;        // Color for the unit indicator
  indicatorScale: number;        // Scale of the indicator
}

// 3D models for each side - every unit type uses the knight model in its side's colours,
// and unit types are told apart by size and by the coloured indicator under the unit
export const UNIT_MODEL_PATHS: Record<PlayerType, string> = {
  player: '/models/blue-knight.glb',
  ai: '/models/red-knight.glb'
};

// The knight models face -Z; the game treats +Z as forward, so turn them around
const KNIGHT_MODEL_FACING = Math.PI;

// Animation clip names in the knight models (matched case-insensitively by substring)
const KNIGHT_ANIMATIONS: UnitAnimations = {
  idle: 'idle',
  holdShield: 'holdshield',
  attack: 'stab',
  walk: 'walk'
};

// Map of unit types to their 3D model attributes
export const UNIT_MODELS: Record<UnitType, UnitAttributes> = {
  'infantry': {
    animations: KNIGHT_ANIMATIONS,
    scale: 1.0,
    heightOffset: 0,
    rotationOffset: KNIGHT_MODEL_FACING,
    indicatorColor: '#4682B4',
    indicatorScale: 0.5
  },
  'tank': {
    animations: KNIGHT_ANIMATIONS,
    scale: 1.15,
    heightOffset: 0,
    rotationOffset: KNIGHT_MODEL_FACING,
    indicatorColor: '#8B0000',
    indicatorScale: 0.6
  },
  'helicopter': {
    animations: KNIGHT_ANIMATIONS,
    scale: 1.05,
    heightOffset: 0,
    rotationOffset: KNIGHT_MODEL_FACING,
    indicatorColor: '#7B1FA2',
    indicatorScale: 0.55
  },
  'artillery': {
    animations: KNIGHT_ANIMATIONS,
    scale: 0.9,
    heightOffset: 0,
    rotationOffset: KNIGHT_MODEL_FACING,
    indicatorColor: '#006400',
    indicatorScale: 0.5
  },
  'medic': {
    animations: KNIGHT_ANIMATIONS,
    scale: 0.95,
    heightOffset: 0,
    rotationOffset: KNIGHT_MODEL_FACING,
    indicatorColor: '#FFFF00',
    indicatorScale: 0.5
  }
};

// Seconds between strikes in battle - each troop type fights at its own pace
export const ATTACK_INTERVALS: Record<UnitType, number> = {
  helicopter: 0.7, // Knights: quick cavalry strikes
  infantry: 0.9,   // Swordsmen
  medic: 1.2,
  tank: 1.3,       // Pikemen: heavy, deliberate thrusts
  artillery: 1.6   // Archers: draw, aim and loose
};

// Animation state for each unit type
export type AnimationState = 'idle' | 'holdShield' | 'attack' | 'walk' | 'death' | 'special';

// Function to get model attributes for a unit type
export const getUnitModelAttributes = (unitType: UnitType): UnitAttributes => {
  return UNIT_MODELS[unitType] || UNIT_MODELS.infantry;
};

// Function to get the 3D model for a unit's owner
export const getUnitModelPath = (owner: PlayerType): string => UNIT_MODEL_PATHS[owner];

// Function to get the animation name for a given state
export const getAnimationName = (unitType: UnitType, state: AnimationState): string => {
  const attributes = getUnitModelAttributes(unitType);
  
  // If the requested animation exists, return it
  if (state === 'holdShield' && attributes.animations.holdShield) {
    return attributes.animations.holdShield;
  }
  if (state === 'attack' && attributes.animations.attack) {
    return attributes.animations.attack;
  }
  if (state === 'walk' && attributes.animations.walk) {
    return attributes.animations.walk;
  }
  if (state === 'death' && attributes.animations.death) {
    return attributes.animations.death;
  }
  if (state === 'special' && attributes.animations.special) {
    return attributes.animations.special;
  }
  
  // Default to idle animation if requested animation doesn't exist
  return attributes.animations.idle;
};

// Function to determine the appropriate animation state based on unit status
export const determineAnimationState = (
  unitType: UnitType, 
  isPendingPurchase: boolean = false,
  isMoving: boolean = false
): AnimationState => {
  // Special case for infantry units (knights)
  if (unitType === 'infantry') {
    if (isPendingPurchase) {
      return 'holdShield'; // Always use holdShield for knights when pending purchase
    }
    
    if (isMoving) {
      return 'walk';
    }
    
    // For infantry, always prefer to show holdShield if it's available, unless moving
    return 'holdShield';
  }
  
  // For other unit types
  if (isPendingPurchase) {
    // Use holdShield for pending purchases if available, otherwise fall back to idle
    return UNIT_MODELS[unitType].animations.holdShield ? 'holdShield' : 'idle';
  }
  
  if (isMoving) {
    // Use walk animation if available, otherwise fall back to idle
    return UNIT_MODELS[unitType].animations.walk ? 'walk' : 'idle';
  }
  
  return 'idle';
}; 