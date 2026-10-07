import { UnitType } from '@/types/game';
import { UNIT_NAMES } from '@/lib/game/gameState';

// Helper function to get name for unit type
export const getUnitTypeName = (unitType: UnitType): string => UNIT_NAMES[unitType] ?? 'Unknown';
