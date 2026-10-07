import React from 'react';
import { GameLogEntry } from '@/types/game';
import { SIDE_COLORS } from './styles';
import { CollapsiblePanel } from './CollapsiblePanel';

interface EventFeedProps {
  log: GameLogEntry[];
}

const Entry: React.FC<{ entry: GameLogEntry; truncate?: boolean }> = ({ entry, truncate = false }) => (
  <div className="flex gap-2 leading-snug">
    <span className="mt-1 inline-block w-2 h-2 shrink-0 rounded-full" style={{ background: SIDE_COLORS[entry.side] }} />
    <span className={truncate ? 'truncate' : ''}>{entry.text}</span>
  </div>
);

// Recent battle events - collapsed to the latest one by default
export const EventFeed: React.FC<EventFeedProps> = ({ log }) => {
  if (log.length === 0) return null;
  const latest = log[log.length - 1];

  return (
    <CollapsiblePanel
      id="battle-log"
      title="📜 Battle log"
      collapsedPreview={<Entry entry={latest} truncate />}
    >
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
        {[...log].reverse().slice(0, 15).map(entry => <Entry key={entry.id} entry={entry} />)}
      </div>
    </CollapsiblePanel>
  );
};
