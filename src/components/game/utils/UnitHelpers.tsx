import { UnitType } from '@/types/game';
import { getTroopName } from '@/lib/game/gameState';

// Display name for a troop type
export const getUnitTypeName = (unitType: UnitType): string => getTroopName(unitType);
