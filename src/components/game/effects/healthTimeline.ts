import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { GameState, HealthEvent, PlayerType, Unit } from '@/types/game';
import { FALL_SECONDS, STONE_SECONDS } from '../BattlefieldObjects';
import { BREATH_SWEEP, BURST_SECONDS } from '../BossPowers';
import { getTimeScale } from './effects';

// The board shows each change to a troop's health outside a fight (and a castle's) when the thing
// that caused it is seen to happen, never before: the crush when the felled tree lands, the stone's
// blow when it lands, a boss's strike as its burst hits, a strafe as the flyer passes, and the end of
// the turn's healing and burning one after another once the troops have arrived. Until then the
// troop's health shows what it was, and a troop the change destroys stays on its feet - it falls
// when the blow lands (and its death, bounty and coins come then).
//
// The rules have already applied the changes; this only decides when the board lets them show.

// Seconds (at normal speed) after the change reaches the board that it shows
export const healthEventDelay = (event: HealthEvent): number => {
  switch (event.cause) {
    case 'fell': return FALL_SECONDS;
    case 'catapult': return STONE_SECONDS;
    case 'boss': return BURST_SECONDS * 0.3 + (event.order ?? 0) * BREATH_SWEEP;
    // (as the flyer passes overhead, part-way through its flight)
    case 'strafe': return 0.7;
    case 'swarm': case 'bloodlust': return 0.25;
    // The end of a turn, in order: springs, mages, then the ground
    case 'spring': return 0.35;
    case 'mage': return 0.65;
    default: return 0.95;
  }
};

interface Scheduled {
  event: HealthEvent;
  // performance.now() when it shows
  showAt: number;
}

// The latest time anything scheduled shows, for the turn that follows to wait for
let busyUntil = 0;
export const getTimelineBusyUntil = () => busyUntil;

// Each troop's health as the board shows it right now (the HUD reads it too)
let shownHealth = new Map<string, number>();
const listeners = new Set<() => void>();
const publishShownHealth = (next: Map<string, number>) => {
  shownHealth = next;
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useShownHealth = (unit: Pick<Unit, 'id' | 'lifespan'> | null | undefined): number | undefined => {
  const map = useSyncExternalStore(subscribe, () => shownHealth, () => shownHealth);
  return unit ? map.get(unit.id) ?? unit.lifespan : undefined;
};

export interface HealthTimeline {
  // The units to draw: health as shown so far, plus troops already destroyed whose fatal blow
  // hasn't landed yet
  units: Unit[];
  // Each castle's health as shown so far
  castleHealth: (side: PlayerType, health: number) => number;
  // Changes that have just landed on each troop, for its floating numbers
  landed: Map<string, { serial: number; amount: number }[]>;
}

// How long a landed change keeps its floating number listed
const LANDED_KEEP_MS = 1500;

export const useHealthTimeline = (gameState: GameState, units: Unit[]): HealthTimeline => {
  const scheduledRef = useRef<Scheduled[]>([]);
  // Changes from before the board appeared aren't replayed
  const seenSerialRef = useRef(gameState.healthSerial ?? 0);
  const gameIdRef = useRef(gameState.players.player.id);
  const [now, setNow] = useState(() => performance.now());
  // Troops drawn last time, so a troop already out of sight isn't brought back to die
  const drawnRef = useRef(new Set<string>());

  // A new battle: start afresh
  if (gameIdRef.current !== gameState.players.player.id) {
    gameIdRef.current = gameState.players.player.id;
    scheduledRef.current = [];
    seenSerialRef.current = gameState.healthSerial ?? 0;
  }

  // Schedule new changes as soon as they arrive (during the render that brings them, so the board
  // never shows them early, even for a frame)
  const fresh = (gameState.healthEvents ?? []).filter(event => event.serial > seenSerialRef.current);
  if (fresh.length > 0) {
    const arrived = performance.now();
    const scale = Math.max(0.1, getTimeScale());
    for (const event of fresh) {
      const showAt = arrived + healthEventDelay(event) * 1000 / scale;
      scheduledRef.current.push({ event, showAt });
      busyUntil = Math.max(busyUntil, showAt);
    }
    seenSerialRef.current = Math.max(...fresh.map(event => event.serial));
  }

  const seenSerial = seenSerialRef.current;
  const timeline = useMemo<HealthTimeline>(() => {
    const scheduled = scheduledRef.current;
    const pending = scheduled.filter(item => item.showAt > now);

    // Each troop: its health less what hasn't shown yet (damage still to land, or healing)
    const owed = new Map<string, number>();
    for (const { event } of pending) {
      if (event.unit) owed.set(event.unit.id, (owed.get(event.unit.id) ?? 0) + event.amount);
    }
    const present = new Set(units.map(unit => unit.id));
    const shown: Unit[] = units.map(unit => {
      const later = owed.get(unit.id);
      return later ? { ...unit, lifespan: Math.max(1, unit.lifespan - later) } : unit;
    });
    // Troops already destroyed, standing until their fatal blow lands: as they were before the
    // first change still to show (only those on the board until now)
    const ghosts = new Map<string, Unit>();
    for (const { event } of pending) {
      const unit = event.unit;
      if (!unit || present.has(unit.id) || ghosts.has(unit.id) || !drawnRef.current.has(unit.id)) continue;
      if (!pending.some(item => item.event.unit?.id === unit.id && item.event.fatal)) continue;
      ghosts.set(unit.id, { ...unit, lifespan: Math.max(1, unit.lifespan) });
    }
    const drawn = [...shown, ...ghosts.values()];
    drawnRef.current = new Set(drawn.map(unit => unit.id));

    const castleOwed: Record<PlayerType, number> = { player: 0, ai: 0 };
    for (const { event } of pending) if (event.castle) castleOwed[event.castle] += event.amount;

    const landed = new Map<string, { serial: number; amount: number }[]>();
    for (const { event, showAt } of scheduled) {
      if (showAt > now || !event.unit) continue;
      const list = landed.get(event.unit.id) ?? [];
      list.push({ serial: event.serial, amount: event.amount });
      landed.set(event.unit.id, list);
    }

    return {
      units: drawn,
      castleHealth: (side, health) => Math.max(0, health - castleOwed[side]),
      landed
    };
    // (recomputed when the units change, a change arrives or one lands)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, now, seenSerial]);

  // Re-render when the next pending change is due, and forget changes shown a while ago
  useEffect(() => {
    const due = scheduledRef.current.filter(item => item.showAt > now).map(item => item.showAt);
    if (due.length === 0) return;
    const timeout = setTimeout(() => {
      const at = performance.now();
      scheduledRef.current = scheduledRef.current.filter(item => item.showAt > at - LANDED_KEEP_MS);
      setNow(at);
    }, Math.max(0, Math.min(...due) - performance.now()) + 5);
    return () => clearTimeout(timeout);
  }, [now, seenSerial]);

  // Share the shown health with the HUD
  useEffect(() => {
    publishShownHealth(new Map(timeline.units.map(unit => [unit.id, unit.lifespan])));
  }, [timeline]);

  return timeline;
};
