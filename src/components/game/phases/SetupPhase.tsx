import React from 'react';

export const SetupPhase: React.FC = () => {
  return (
    <div className="fixed top-4 left-4 p-4 bg-[var(--background)] bg-opacity-80 text-[var(--parchment)] rounded-lg z-10 max-w-xs">
      <h2 className="text-xl font-bold mb-2">Setup Phase</h2>
      <p className="mb-2">Select a hex to place your base</p>
      <div className="text-sm bg-[var(--foreground)] text-[var(--secondary)] bg-opacity-20 p-2 rounded-md">
        <h3 className="font-semibold mb-1">Placement Rules:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Must be placed on the edge of the battlefield</li>
          <li>Cannot be placed on water</li>
          <li>Cannot be placed on resource tiles</li>
        </ul>
      </div>
    </div>
  );
}; 