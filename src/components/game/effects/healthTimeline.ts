import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { GameState, HealthEvent, PlayerType, Unit } from '@/types/game';
import { FALL_SECONDS, STONE_SECONDS } from '../BattlefieldObjects';
import { BREATH_SWEEP, BURST_SECONDS } from '../BossPowers';
import { getGameClock, getTimeScale } from './effects';

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
    case 'swarm': case 'bloodlust': case 'drain': return 0.25;
    // (just after the blow that slew the troop bursting)
    case 'burst': return (event.after ? healthEventDelay({ ...event, cause: event.after, after: undefined }) : 0) + 0.25;
    // The end of a turn, in order: springs, mages, then the ground
    case 'spring': return 0.35;
    case 'mage': return 0.65;
    default: return 0.95;
  }
};

interface Scheduled {
  event: HealthEvent;
  // When it shows, on the battle's clock (see getGameClock: it keeps pace with the animations
  // through speed changes and slow motion)
  showAt: number;
}

// When each change seen so far shows (on the battle's clock), by serial, so that how long the board
// still needs can be told from a state alone - whether or not the board has scheduled its changes yet
const showsAt = new Map<number, number>();
// (changes up to this serial have been scheduled: one no longer listed showed a while ago)
let scheduledThrough = 0;

// How long (real ms, at the present time scale) until the board has shown every change in a state
// (or those of them `which` picks): for one it hasn't scheduled yet, its full delay from now
export const pendingHealthWait = (state: GameState, which: (event: HealthEvent) => boolean = () => true): number => {
  const now = getGameClock();
  const scale = Math.max(0.1, getTimeScale());
  return Math.max(0, ...(state.healthEvents ?? []).filter(which).map(event => {
    const at = showsAt.get(event.serial);
    if (at !== undefined) return (at - now) / scale;
    return event.serial <= scheduledThrough ? 0 : healthEventDelay(event) * 1000 / scale;
  }));
};

// Each troop's health as the board shows it right now, and how much of each castle's change is
// still to show (the HUD reads them too)
let shownHealth = new Map<string, number>();
let shownCastleOwed: Record<PlayerType, number> = { player: 0, ai: 0 };
const listeners = new Set<() => void>();
const publish = (health: Map<string, number>, owed: Record<PlayerType, number>) => {
  shownHealth = health;
  // (a new object only when some castle's owed damage changed, so the HUD only redraws then)
  const sides = new Set([...Object.keys(owed), ...Object.keys(shownCastleOwed)]);
  if ([...sides].some(side => (owed[side] ?? 0) !== (shownCastleOwed[side] ?? 0))) shownCastleOwed = owed;
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
// A troop's health as the board shows it, or undefined when the board doesn't show it (gone, or
// never drawn) - one destroyed is still shown until its fatal blow lands
export const useShownHealthOf = (id: string | null | undefined): number | undefined => {
  const map = useSyncExternalStore(subscribe, () => shownHealth, () => shownHealth);
  return id ? map.get(id) : undefined;
};
// A castle's health as the board shows it
export const useShownCastleHealth = (side: PlayerType, health: number): number => {
  const owed = useSyncExternalStore(subscribe, () => shownCastleOwed, () => shownCastleOwed);
  return Math.max(0, health - (owed[side] ?? 0));
};

export interface LandedChange {
  serial: number;
  // The number to float (negative for damage)
  amount: number;
  fatal?: boolean;
}

export interface HealthTimeline {
  // The units to draw: health as shown so far, plus troops already destroyed whose fatal blow
  // hasn't landed yet
  units: Unit[];
  // Each castle's health as shown so far, and how much of its change is still to show
  castleHealth: (side: PlayerType, health: number) => number;
  castleOwed: Record<PlayerType, number>;
  // Changes that have just landed on each troop, for its floating numbers
  landed: Map<string, LandedChange[]>;
}

// How long a landed change keeps its floating number listed (on the battle's clock)
const LANDED_KEEP_MS = 1500;
// Longest a wait for the next change goes unchecked (real ms)
const RECHECK_MS = 300;

export const useHealthTimeline = (gameState: GameState, units: Unit[]): HealthTimeline => {
  const scheduledRef = useRef<Scheduled[]>([]);
  // Changes from before the board appeared aren't replayed (set as the first render starts afresh)
  const seenSerialRef = useRef(0);
  const gameIdRef = useRef<string | null>(null);
  // (the battle's clock)
  const [now, setNow] = useState(() => getGameClock());
  // Troops drawn last time, so a troop already out of sight isn't brought back to die
  const drawnRef = useRef(new Set<string>());

  // The board appearing, or a new battle: start afresh
  const gameId = Object.values(gameState.players)[0]?.id ?? '';
  if (gameIdRef.current !== gameId) {
    gameIdRef.current = gameId;
    scheduledRef.current = [];
    seenSerialRef.current = gameState.healthSerial ?? 0;
    showsAt.clear();
    scheduledThrough = seenSerialRef.current;
  }

  // Schedule new changes as soon as they arrive (during the render that brings them, so the board
  // never shows them early, even for a frame)
  const fresh = (gameState.healthEvents ?? []).filter(event => event.serial > seenSerialRef.current);
  if (fresh.length > 0) {
    const arrived = getGameClock();
    for (const event of fresh) {
      const showAt = arrived + healthEventDelay(event) * 1000;
      scheduledRef.current.push({ event, showAt });
      showsAt.set(event.serial, showAt);
    }
    seenSerialRef.current = Math.max(...fresh.map(event => event.serial));
    scheduledThrough = seenSerialRef.current;
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
    for (const { event } of pending) if (event.castle) castleOwed[event.castle] = (castleOwed[event.castle] ?? 0) + event.amount;

    const landed = new Map<string, LandedChange[]>();
    for (const { event, showAt } of scheduled) {
      if (showAt > now || !event.unit) continue;
      const list = landed.get(event.unit.id) ?? [];
      list.push({ serial: event.serial, amount: event.shown ?? event.amount, ...(event.fatal ? { fatal: true } : {}) });
      landed.set(event.unit.id, list);
    }

    return {
      units: drawn,
      castleHealth: (side, health) => Math.max(0, health - (castleOwed[side] ?? 0)),
      castleOwed,
      landed
    };
    // (recomputed when the units change, a change arrives or one lands)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, now, seenSerial]);

  // Re-render when the next pending change is due, and forget changes shown a while ago (once the
  // last has shown, when its number is done). The wait is checked again at least every so often, as
  // the time scale can change while it runs.
  useEffect(() => {
    const scheduled = scheduledRef.current;
    if (scheduled.length === 0) return;
    const due = scheduled.filter(item => item.showAt > now).map(item => item.showAt);
    const at = due.length > 0 ? Math.min(...due) : Math.min(...scheduled.map(item => item.showAt)) + LANDED_KEEP_MS;
    let timeout: ReturnType<typeof setTimeout>;
    const arm = () => {
      const wait = (at - getGameClock()) / Math.max(0.1, getTimeScale());
      timeout = setTimeout(() => {
        const time = getGameClock();
        if (time < at) {
          arm();
          return;
        }
        scheduledRef.current = scheduledRef.current.filter(item => item.showAt > time - LANDED_KEEP_MS);
        for (const [serial, showAt] of showsAt) if (showAt < time - LANDED_KEEP_MS) showsAt.delete(serial);
        setNow(time);
      }, Math.min(RECHECK_MS, Math.max(0, wait)) + 5);
    };
    arm();
    return () => clearTimeout(timeout);
  }, [now, seenSerial]);

  // Share what's shown with the HUD
  useEffect(() => {
    publish(new Map(timeline.units.map(unit => [unit.id, unit.lifespan])), timeline.castleOwed);
  }, [timeline]);

  return timeline;
};
