import React from 'react';
import { getMaxRounds } from '@/lib/game/gameState';
import { setGameSpeed, useGameSpeed } from '../effects/effects';
import { PANEL_CLASS } from '../hud/styles';
import { CloseIcon, PauseIcon, PlayIcon, ReplayIcon, ResumeIcon, SpeedIcon } from '../icons';
import type { ReplayPlayer } from './replay';

const BUTTON = 'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold hover:bg-slate-700';

// The controls while a battle is being watched again: where it's got to, pause, from the start,
// speed, and back to the results
export const ReplayBar: React.FC<{ replay: ReplayPlayer; onClose: () => void }> = ({ replay, onClose }) => {
  const speed = useGameSpeed();
  const maxRounds = getMaxRounds(replay.state);
  return (
    <div className="pointer-events-none fixed left-[calc(0.75rem+var(--safe-l))] right-[calc(0.75rem+var(--safe-r))] top-[calc(0.75rem+var(--safe-t))] z-30 flex justify-center">
      <div className={`${PANEL_CLASS} pointer-events-auto flex flex-wrap items-center justify-center gap-1 p-1.5`} role="toolbar" aria-label="Replay">
        <span className="font-display flex items-center gap-1.5 px-2 text-amber-300">
          <ReplayIcon /> Replay
        </span>
        <span className="px-1 text-sm tabular-nums text-slate-300" aria-live="polite">
          {replay.finished ? 'The end' : <>Round {Math.max(1, replay.round)}<span className="text-slate-500">/{maxRounds}</span></>}
        </span>
        <button onClick={replay.togglePlaying} className={BUTTON} aria-label={replay.finished ? 'Watch again' : replay.playing ? 'Pause' : 'Play'}>
          {replay.finished ? <><ResumeIcon /> Again</> : replay.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        {!replay.finished && (
          <button onClick={replay.restart} className={BUTTON} aria-label="From the start" title="From the start">
            <ResumeIcon />
          </button>
        )}
        <button onClick={() => setGameSpeed(speed === 1 ? 2 : 1)} className={BUTTON} aria-pressed={speed === 2} title="Speed">
          <SpeedIcon /> {speed}x
        </button>
        <button onClick={onClose} className={BUTTON} aria-label="Back to the results">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
