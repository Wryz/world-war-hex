import { UnitType } from '@/types/game';

// Unit types offered in the barracks
export const RECRUITABLE: UnitType[] = ['infantry', 'artillery', 'helicopter', 'tank', 'rogue', 'medic'];

// One-line role of each unit type
export const UNIT_ROLES: Record<UnitType, string> = {
  infantry: 'Cheap all-rounder',
  artillery: 'Hits hard, fragile',
  helicopter: 'Fast cavalry',
  tank: 'Tough, strong in forest',
  medic: 'Ranged magic, heals allies',
  rogue: 'Sneak attacks, no strike-back'
};
