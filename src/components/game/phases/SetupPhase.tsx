import React from 'react';
import { PANEL_CLASS } from '../hud/styles';

interface SetupPhaseProps {
  isConfirmMode?: boolean;
  selectedHexValid?: boolean;
}

// Instructions for choosing where to build the player's castle
export const SetupPhase: React.FC<SetupPhaseProps> = ({
  isConfirmMode = false,
  selectedHexValid = false
}) => {
  return (
    <div className="fixed top-3 inset-x-0 z-20 flex justify-center pointer-events-none">
      <div className={`${PANEL_CLASS} pointer-events-auto max-w-md p-4 text-sm`}>
        <h2 className="text-lg font-black">👑 Choose your castle location</h2>

        {isConfirmMode ? (
          selectedHexValid ? (
            <p className="mt-2 rounded-lg bg-emerald-900/70 px-3 py-2 font-semibold text-emerald-100">
              Click the same hex again to build your castle there, or pick another green hex.
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-red-900/70 px-3 py-2 font-semibold text-red-100">
              You can&apos;t build there. Pick one of the green-outlined hexes.
            </p>
          )
        ) : (
          <p className="mt-2 text-slate-300">
            Click a <span className="font-bold text-emerald-300">green-outlined</span> hex on the edge of the map,
            then click it again to confirm. The enemy builds on the opposite side.
          </p>
        )}

        <ul className="mt-3 list-disc pl-5 text-xs text-slate-400 space-y-0.5">
          <li>Must be on the edge of the battlefield</li>
          <li>Not on water, mountains or gold mines</li>
          <li>Needs open ground next to it to deploy troops</li>
        </ul>
      </div>
    </div>
  );
};
