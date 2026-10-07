import React from 'react';
import { PANEL_CLASS } from '../hud/styles';

interface SetupPhaseProps {
  isConfirmMode?: boolean;
  selectedHexValid?: boolean;
}

// Prompt for choosing where to build the player's castle
export const SetupPhase: React.FC<SetupPhaseProps> = ({
  isConfirmMode = false,
  selectedHexValid = false
}) => {
  const message = !isConfirmMode
    ? 'Click a green hex on the edge of the map'
    : selectedHexValid
      ? 'Click it again to build your castle'
      : "Can't build there - pick a green hex";

  return (
    <div className="fixed top-3 inset-x-0 z-20 flex justify-center pointer-events-none">
      <div className={`${PANEL_CLASS} px-5 py-3 text-center`}>
        <div className="font-display text-lg">👑 Place your castle</div>
        <div className={`mt-1 text-sm ${isConfirmMode && !selectedHexValid ? 'text-red-300' : 'text-slate-300'}`}>
          {message}
        </div>
      </div>
    </div>
  );
};
