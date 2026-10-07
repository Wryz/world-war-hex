import { PlayerType, UnitType } from '@/types/game';

// Unit models: low-poly adventurers from KayKit's Character Pack: Adventurers (CC0, Kay Lousberg).
// All characters share one skeleton and animation set; each unit type picks a character, the weapons
// it carries and which animation clips to play. Each side's colour is painted onto capes, shields and hats.

export type AnimationState = 'idle' | 'holdShield' | 'attack' | 'walk';

interface UnitLook {
  // Character model
  model: string;
  scale: number;
  // Weapon and prop meshes in the model that this unit doesn't carry
  hide: string[];
  // Animation clip (by exact name) for each state
  animations: Record<AnimationState, string>;
  // Rides a horse (Knights)
  mounted?: boolean;
  // Carries a long pike (Pikemen)
  pike?: boolean;
  // Height of the unit's label above its hex
  labelHeight: number;
  // Projectile fired by ranged units
  projectile?: 'arrow' | 'magic';
  // Colour of the disc under a unit previewed in the barracks
  indicatorColor: string;
  indicatorScale: number;
}

const MODELS = {
  knight: '/models/units/knight.glb',
  barbarian: '/models/units/barbarian.glb',
  ranger: '/models/units/ranger.glb',
  mage: '/models/units/mage.glb',
  rogue: '/models/units/rogue.glb'
};

// Low-poly galloping horse from the three.js examples (MIT; model by mirada for ROME)
export const HORSE_MODEL = '/models/units/horse.glb';

// Every model the game loads, for preloading
export const ALL_UNIT_MODELS = [...Object.values(MODELS), HORSE_MODEL];

const UNIT_LOOKS: Record<UnitType, UnitLook> = {
  infantry: {
    model: MODELS.knight,
    scale: 0.44,
    hide: ['Badge_Shield'],
    animations: { idle: 'Idle', holdShield: 'Blocking', attack: '1H_Melee_Attack_Slice_Diagonal', walk: 'Walking_A' },
    labelHeight: 1.53,
    indicatorColor: '#4682B4',
    indicatorScale: 0.5
  },
  helicopter: {
    model: MODELS.knight,
    scale: 0.41,
    hide: ['Round_Shield'],
    animations: { idle: 'Idle', holdShield: 'Blocking', attack: '1H_Melee_Attack_Slice_Diagonal', walk: 'Idle' },
    mounted: true,
    labelHeight: 1.95,
    indicatorColor: '#7B1FA2',
    indicatorScale: 0.55
  },
  tank: {
    model: MODELS.barbarian,
    scale: 0.47,
    hide: [],
    animations: { idle: 'Idle', holdShield: 'Blocking', attack: '1H_Melee_Attack_Stab', walk: 'Walking_A' },
    pike: true,
    labelHeight: 1.59,
    indicatorColor: '#8B0000',
    indicatorScale: 0.6
  },
  artillery: {
    model: MODELS.ranger,
    scale: 0.42,
    hide: [],
    animations: { idle: 'Idle', holdShield: '2H_Ranged_Aiming', attack: '2H_Ranged_Shoot', walk: 'Walking_A' },
    labelHeight: 1.47,
    projectile: 'arrow',
    indicatorColor: '#006400',
    indicatorScale: 0.5
  },
  medic: {
    model: MODELS.mage,
    scale: 0.43,
    hide: [],
    animations: { idle: 'Idle', holdShield: 'Spellcasting', attack: 'Spellcast_Shoot', walk: 'Walking_A' },
    labelHeight: 1.59,
    projectile: 'magic',
    indicatorColor: '#a855f7',
    indicatorScale: 0.5
  },
  rogue: {
    model: MODELS.rogue,
    scale: 0.41,
    hide: [],
    animations: { idle: 'Idle', holdShield: 'Blocking', attack: 'Dualwield_Melee_Attack_Slice', walk: 'Running_A' },
    labelHeight: 1.42,
    indicatorColor: '#334155',
    indicatorScale: 0.5
  }
};

// Team colour for each side (capes, shields, hats)
export const TEAM_COLORS: Record<PlayerType, string> = {
  player: '#2f6fe4',
  ai: '#d93a3a'
};

// Seconds between strikes in battle - each troop type fights at its own pace
export const ATTACK_INTERVALS: Record<UnitType, number> = {
  rogue: 0.6,      // Rogues: flurries of quick stabs
  helicopter: 0.7, // Knights: quick cavalry strikes
  infantry: 0.9,   // Swordsmen
  tank: 1.3,       // Pikemen: heavy, deliberate thrusts
  medic: 1.4,      // Mages: gather and release a spell
  artillery: 1.6   // Archers: draw, aim and loose
};

export const getUnitLook = (unitType: UnitType): UnitLook => UNIT_LOOKS[unitType] ?? UNIT_LOOKS.infantry;

// Name of the animation clip to play for a unit doing something
export const getAnimationName = (unitType: UnitType, state: AnimationState): string =>
  getUnitLook(unitType).animations[state];
