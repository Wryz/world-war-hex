import { UnitType } from '@/types/game';

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
export const getUnitTypeName = (unitType: UnitType): string => {
  switch(unitType) {
    case 'infantry': return 'Swordsmen';
    case 'tank': return 'Pikemen';
    case 'artillery': return 'Archers';
    case 'helicopter': return 'Knights';
    case 'medic': return 'Siege Engineers';
    default: return 'Unknown';
  }
}; 