import React from 'react';
import { GameLogEntry } from '@/types/game';
import { SIDE_COLORS } from './styles';
import { CollapsiblePanel } from './CollapsiblePanel';
import { LogIcon } from '../icons';

interface EventFeedProps {
  log: GameLogEntry[];
}

const Entry: React.FC<{ entry: GameLogEntry }> = ({ entry }) => (
  <div className="flex gap-2 leading-snug">
    <span className="mt-1 inline-block w-2 h-2 shrink-0 rounded-full" style={{ background: SIDE_COLORS[entry.side] }} />
    <span>{entry.text}</span>
  </div>
);

// Recent battle events - collapsed to its header by default (the board's callouts tell the story)
export const EventFeed: React.FC<EventFeedProps> = ({ log }) => {
  if (log.length === 0) return null;

  return (
    <CollapsiblePanel
      id="battle-log"
      title={<span className="flex items-center gap-1.5"><LogIcon className="text-sm" /> Battle log</span>}
    >
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
        {[...log].reverse().slice(0, 15).map(entry => <Entry key={entry.id} entry={entry} />)}
      </div>
    </CollapsiblePanel>
  );
};
