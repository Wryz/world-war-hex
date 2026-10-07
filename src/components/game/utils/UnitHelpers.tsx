import { UnitType } from '@/types/game';
import { UNIT_NAMES } from '@/lib/game/gameState';

// Helper function to get emoji for unit type
export const getUnitTypeEmoji = (unitType: UnitType): string => {
  switch(unitType) {
    case 'infantry': return '🗡️';
    case 'tank': return '🛡️';
    case 'artillery': return '🏹';
    case 'helicopter': return '🐎';
    case 'medic': return '⚒️';
    default: return '❓';
  }
};

// Helper function to get name for unit type
export const getUnitTypeName = (unitType: UnitType): string => UNIT_NAMES[unitType] ?? 'Unknown';
