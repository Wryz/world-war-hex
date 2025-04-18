import React from 'react';

export const SetupPhase: React.FC = () => {
  return (
    <div className="fixed top-4 left-4 p-4 bg-[var(--background)] bg-opacity-80 text-[var(--parchment)] rounded-lg z-10">
      <h2 className="text-xl font-bold mb-2">Setup Phase</h2>
      <p>Select a hex to place your base</p>
    </div>
  );
}; 