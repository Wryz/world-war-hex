import React from 'react';
import { UnitType } from '@/types/game';
import { getUnitTypeEmoji, getUnitTypeName } from './utils/UnitHelpers';
import { UNITS } from '@/lib/game/gameState';

// Troop descriptions - costs and stats come from the game rules in UNITS
const TROOP_DESCRIPTIONS: Record<UnitType, string> = {
  'infantry': 'Versatile ground unit',
  'artillery': 'Hard-hitting but fragile',
  'helicopter': 'Fast movement',
  'tank': 'Heavy armor',
  'medic': 'Healing support',
};

interface BarracksProps {
  availableGold: number;
  selectedUnitType?: UnitType | null;
  onUnitTypeSelect: (unitType: UnitType) => void;
  isAITurn: boolean;
}

const Barracks: React.FC<BarracksProps> = ({ 
  availableGold, 
  selectedUnitType = null,
  onUnitTypeSelect,
  isAITurn
}) => {
  // If it's AI's turn, don't show the barracks
  if (isAITurn) return null;

  const troopTypes: UnitType[] = ['infantry', 'artillery', 'helicopter', 'tank'];

  return (
    <div className="fixed bottom-4 right-4 bg-[var(--background)] bg-opacity-90 p-3 rounded-md border-2 border-[var(--secondary)] shadow-lg z-10 max-w-[320px]">
      <h3 className="text-[var(--parchment)] font-bold mb-2 text-center">Barracks</h3>
      
      <div className="grid grid-cols-2 gap-2">
        {troopTypes.map(troopType => {
          const unitInfo = UNITS[troopType];
          const canAfford = availableGold >= unitInfo.cost;
          const isSelected = selectedUnitType === troopType;
          
          return (
            <button
              key={troopType}
              onClick={() => canAfford && onUnitTypeSelect(troopType)}
              disabled={!canAfford}
              aria-pressed={isSelected}
              className={`
                flex flex-col items-center p-2 rounded-md border transition-all
                ${isSelected ? 'ring-4 ring-[var(--accent)]' : ''}
                ${canAfford 
                  ? 'border-[var(--foreground)] bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer hover:shadow-md hover:-translate-y-1' 
                  : 'border-[var(--foreground)] border-opacity-40 bg-[var(--background)] bg-opacity-30 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }
              `}
            >
              <span className="text-3xl mb-1">{getUnitTypeEmoji(troopType)}</span>
              <span className="font-semibold text-sm">{getUnitTypeName(troopType)}</span>
              <span className="text-xs mt-1">{unitInfo.cost} gold</span>
              <span className="text-xs mt-1">
                ⚔️{unitInfo.attackPower} ❤️{unitInfo.maxLifespan} 👣{unitInfo.movementRange}
              </span>
              <span className="text-xs mt-1 italic">{TROOP_DESCRIPTIONS[troopType]}</span>
            </button>
          );
        })}
      </div>
      
      <div className="mt-3 text-center text-[var(--parchment)] text-sm">
        <p><strong>Available Gold:</strong> {availableGold}</p>
        <p className="mt-1 text-xs italic">
          {selectedUnitType
            ? 'Click a highlighted hex next to your castle, then click it again to deploy'
            : 'Select a unit to see where it can be deployed'}
        </p>
      </div>
    </div>
  );
};

export default Barracks; 