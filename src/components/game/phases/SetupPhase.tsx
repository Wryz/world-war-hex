import React from 'react';

interface SetupPhaseProps {
  isConfirmMode?: boolean;
  selectedHexValid?: boolean;
}

export const SetupPhase: React.FC<SetupPhaseProps> = ({ 
  isConfirmMode = false,
  selectedHexValid = false
}) => {
  return (
    <div className="fixed top-4 left-4 p-4 bg-[var(--background)] bg-opacity-80 text-[var(--parchment)] rounded-lg z-10 max-w-xs">
      <h2 className="text-xl font-bold mb-2">Setup Phase</h2>
      
      {isConfirmMode ? (
        <>
          {selectedHexValid ? (
            <div className="mb-3 text-[var(--success)] font-semibold border border-[var(--success)] p-2 rounded-md bg-[var(--success-muted)] bg-opacity-20">
              <p className="mb-1">Confirm base placement?</p>
              <p className="text-sm">
                Click the highlighted hex again to confirm, or click elsewhere to cancel.
              </p>
            </div>
          ) : (
            <div className="mb-3 text-[var(--error)] border border-[var(--error)] p-2 rounded-md bg-[var(--error-muted)] bg-opacity-20">
              <p className="mb-1 font-semibold">Invalid location!</p>
              <p className="text-sm">
                You cannot place your base here. Click elsewhere to select a valid edge tile.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="mb-2">Select a hex to place your base</p>
      )}
      
      <div className="text-sm bg-[var(--foreground)] text-[var(--primary)] bg-opacity-20 p-2 rounded-md">
        <h3 className="font-semibold mb-1">Placement Rules:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Must be placed on the edge of the battlefield</li>
          <li>Cannot be placed on water</li>
          <li>Cannot be placed on resource tiles</li>
        </ul>
      </div>
      
      <div className="text-sm mt-3 bg-[var(--foreground)] text-[var(--secondary)] bg-opacity-20 p-2 rounded-md">
        <h3 className="font-semibold mb-1">How to place:</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Hover over hexes to see valid locations (green)</li>
          <li>Click once to select a location</li>
          <li>Click again to confirm placement</li>
        </ol>
      </div>
    </div>
  );
}; 