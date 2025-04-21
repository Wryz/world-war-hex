import { UnitType } from '@/types/game';

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
  modelPath: string;             // Path to the 3D model
  animations: UnitAnimations;    // Animation mapping
  scale: number;                 // Scale of the model
  heightOffset: number;          // Height offset to position model correctly
  rotationOffset: number;        // Rotation in radians if needed
  indicatorColor: string;        // Color for the unit indicator
  indicatorScale: number;        // Scale of the indicator
}

// Map of unit types to their 3D model attributes
export const UNIT_MODELS: Record<UnitType, UnitAttributes> = {
  'infantry': {
    modelPath: '/models/blue-knight.glb',
    animations: {
      idle: 'idle',
      holdShield: 'shield',
      attack: 'attack',
      walk: 'walk'
    },
    scale: 0.7,
    heightOffset: 0.1,
    rotationOffset: 0,
    indicatorColor: '#4682B4',
    indicatorScale: 0.5
  },
  'tank': {
    modelPath: '/models/tank.glb',
    animations: {
      idle: 'idle',
      attack: 'fire',
      walk: 'move'
    },
    scale: 0.8,
    heightOffset: 0.3,
    rotationOffset: 0,
    indicatorColor: '#8B0000',
    indicatorScale: 0.6
  },
  'helicopter': {
    modelPath: '/models/helicopter.glb',
    animations: {
      idle: 'hover',
      attack: 'attack',
      walk: 'fly'
    },
    scale: 0.6,
    heightOffset: 0.8,
    rotationOffset: 0,
    indicatorColor: '#00008B',
    indicatorScale: 0.5
  },
  'artillery': {
    modelPath: '/models/artillery.glb',
    animations: {
      idle: 'idle',
      attack: 'fire',
      walk: 'move'
    },
    scale: 0.75,
    heightOffset: 0.25,
    rotationOffset: 0,
    indicatorColor: '#006400',
    indicatorScale: 0.6
  },
  'medic': {
    modelPath: '/models/medic.glb',
    animations: {
      idle: 'idle',
      holdShield: 'heal',
      walk: 'walk'
    },
    scale: 0.7,
    heightOffset: 0.1,
    rotationOffset: 0,
    indicatorColor: '#FFFF00',
    indicatorScale: 0.5
  }
};

// Animation state for each unit type
export type AnimationState = 'idle' | 'holdShield' | 'attack' | 'walk' | 'death' | 'special';

// Function to get model attributes for a unit type
export const getUnitModelAttributes = (unitType: UnitType): UnitAttributes => {
  return UNIT_MODELS[unitType] || UNIT_MODELS.infantry;
};

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