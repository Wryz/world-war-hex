import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '@/types/game';
import { getGameSpeed } from '../effects/effects';
import { getBattleStartDelay, setBattleStartDelay } from '../utils/battleTiming';

// Watching a battle again once it's over. While it's fought, every state the board is shown (the
// turns carried out, their battles resolved, the turns ended, each side's orders) is kept with the
// time it took to arrive; the replay feeds them to a fresh board at the same pace, and the board
// plays them out just as it did the first time. The states share everything they didn't change, so
// a battle's worth costs little memory. It's kept only until the page is left.

export interface ReplayFrame {
  state: GameState;
  // Real ms since the frame before, at normal speed
  wait: number;
  // How long the troops took to walk into the turn's battles (see battleTiming)
  startDelay: number;
}

export interface ReplayLog {
  frames: ReplayFrame[];
  // When the last frame arrived (performance.now)
  last: number;
}

export const createReplayLog = (state: GameState): ReplayLog => {
  const log: ReplayLog = { frames: [], last: 0 };
  recordFrame(log, state);
  return log;
};

export const recordFrame = (log: ReplayLog, state: GameState) => {
  if (log.frames[log.frames.length - 1]?.state === state) return;
  const now = performance.now();
  log.frames.push({ state, wait: log.frames.length === 0 ? 0 : (now - log.last) * getGameSpeed(), startDelay: getBattleStartDelay() });
  log.last = now;
};

// The castle being chosen isn't worth watching: a replay starts with the first turn
const firstFrame = (frames: ReplayFrame[]) => Math.max(0, frames.findIndex(frame => frame.state.currentPhase !== 'setup'));

export const canReplay = (frames: ReplayFrame[]) => frames.length - firstFrame(frames) >= 3;

const isPlayerPlanning = (state: GameState) => state.currentPhase === 'planning' && (state.activePlayer ?? 'player') === 'player';

// The time the player spent thinking is cut short (but long enough to see their orders on the board);
// anything else plays at the pace it was fought, up to a limit (a tab left in the background)
const PLAYER_TURN_MIN_MS = 700;
const PLAYER_TURN_MAX_MS = 1500;
const LONGEST_WAIT_MS = 6000;
// A moment for the board to appear before the first move
const START_PAUSE_MS = 1000;
const frameWait = (frames: ReplayFrame[], index: number) => {
  const { wait } = frames[index];
  return isPlayerPlanning(frames[index - 1].state)
    ? Math.min(PLAYER_TURN_MAX_MS, Math.max(PLAYER_TURN_MIN_MS, wait))
    : Math.min(LONGEST_WAIT_MS, wait);
};

// The whole battlefield: a replay lifts the fog of war, so you see what the enemy was up to
const revealed = (state: GameState): GameState =>
  state.settings?.fogOfWar ? { ...state, settings: { ...state.settings, fogOfWar: false }, sightings: undefined } : state;

export interface ReplayPlayer {
  state: GameState;
  playing: boolean;
  finished: boolean;
  // Each showing gets a fresh board (its timelines and markers start afresh)
  showing: number;
  round: number;
  togglePlaying: () => void;
  restart: () => void;
}

export const useReplayPlayer = (frames: ReplayFrame[]): ReplayPlayer => {
  const start = firstFrame(frames);
  const [index, setIndex] = useState(start);
  const [playing, setPlaying] = useState(true);
  const [showing, setShowing] = useState(0);
  const indexRef = useRef(index);
  indexRef.current = index;
  const finished = index >= frames.length - 1;

  useEffect(() => {
    if (!playing || finished) return;
    const next = index + 1;
    const delay = (index === start ? START_PAUSE_MS : 0) + frameWait(frames, next) / getGameSpeed();
    const timeout = setTimeout(() => {
      // (the board reads how long the troops walk before the battle as the state arrives)
      setBattleStartDelay(frames[next].startDelay);
      setIndex(next);
    }, delay);
    return () => clearTimeout(timeout);
  }, [frames, index, playing, finished, start]);

  const restart = useCallback(() => {
    setIndex(start);
    setShowing(value => value + 1);
    setPlaying(true);
  }, [start]);

  const togglePlaying = useCallback(() => {
    if (indexRef.current >= frames.length - 1) restart();
    else setPlaying(value => !value);
  }, [frames.length, restart]);

  const raw = frames[index].state;
  const state = useMemo(() => revealed(raw), [raw]);
  return { state, playing: playing && !finished, finished, showing, round: raw.turnNumber, togglePlaying, restart };
};
