import React, { useState } from 'react';
import { GameLogEntry } from '@/types/game';
import { PANEL_CLASS, SIDE_COLORS } from './styles';

interface EventFeedProps {
  log: GameLogEntry[];
}

const VISIBLE_ENTRIES = 5;

// Recent battle events so it's clear what just happened
export const EventFeed: React.FC<EventFeedProps> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  if (log.length === 0) return null;

  const entries = [...log].reverse().slice(0, expanded ? 20 : VISIBLE_ENTRIES);

  return (
    <div className={`${PANEL_CLASS} fixed right-3 top-24 z-20 w-72 p-3 text-xs`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Battle log</div>
        {log.length > VISIBLE_ENTRIES && (
          <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-slate-400 hover:text-slate-200">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <ul className={`flex flex-col gap-1.5 ${expanded ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
        {entries.map((entry, index) => (
          <li
            key={entry.id}
            className="flex gap-2 leading-snug"
            style={{ opacity: expanded ? 1 : 1 - index * 0.15 }}
          >
            <span className="mt-1 inline-block w-2 h-2 shrink-0 rounded-full" style={{ background: SIDE_COLORS[entry.side] }} />
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
