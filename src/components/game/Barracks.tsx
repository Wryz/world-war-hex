import React from 'react';
import { UnitType } from '@/types/game';
import { getUnitTypeEmoji, getUnitTypeName } from './utils/UnitHelpers';

// Troop information
const TROOP_INFO: Record<UnitType, { cost: number, description: string }> = {
  'infantry': { cost: 10, description: 'Versatile ground unit' },
  'artillery': { cost: 15, description: 'Long-range attack' },
  'helicopter': { cost: 20, description: 'Fast movement' },
  'tank': { cost: 20, description: 'Heavy armor' },
  'medic': { cost: 8, description: 'Healing support' },
};

interface BarracksProps {
  availableGold: number;
  onUnitTypeSelect: (unitType: UnitType) => void;
  isAITurn: boolean;
}

const Barracks: React.FC<BarracksProps> = ({ 
  availableGold, 
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
          const canAfford = availableGold >= TROOP_INFO[troopType].cost;
          
          return (
            <button
              key={troopType}
              onClick={() => canAfford && onUnitTypeSelect(troopType)}
              disabled={!canAfford}
              className={`
                flex flex-col items-center p-2 rounded-md border transition-all
                ${canAfford 
                  ? 'border-[var(--foreground)] bg-[var(--parchment)] hover:bg-[var(--accent-light)] text-[var(--secondary)] cursor-pointer hover:shadow-md hover:-translate-y-1' 
                  : 'border-[var(--foreground)] border-opacity-40 bg-[var(--background)] bg-opacity-30 text-[var(--primary)] text-opacity-50 cursor-not-allowed'
                }
              `}
            >
              <span className="text-3xl mb-1">{getUnitTypeEmoji(troopType)}</span>
              <span className="font-semibold text-sm">{getUnitTypeName(troopType)}</span>
              <span className="text-xs mt-1">{TROOP_INFO[troopType].cost} gold</span>
              <span className="text-xs mt-1 italic">{TROOP_INFO[troopType].description}</span>
            </button>
          );
        })}
      </div>
      
      <div className="mt-3 text-center text-[var(--parchment)] text-sm">
        <p><strong>Available Gold:</strong> {availableGold}</p>
        <p className="mt-1 text-xs italic">Select a unit to see where it can be deployed</p>
      </div>
    </div>
  );
};

export default Barracks; 