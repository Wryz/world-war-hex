import { useSyncExternalStore } from 'react';

// Shared state for the battle's "juice": game speed and slow motion, screen shake, flying coins,
// big callouts and confetti. The 3D scene and the HUD overlay both read from here.

type Listener = () => void;

const createSignal = <T,>(initial: T) => {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
};

// --- Game speed ----------------------------------------------------------------------------

const SPEED_KEY = 'wwhSpeed';
export type GameSpeed = 1 | 2;

const readSpeed = (): GameSpeed => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(SPEED_KEY) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
};

const speedSignal = createSignal<GameSpeed>(readSpeed());
// Temporary slow motion for big moments (1 = normal)
const slowMotion = createSignal(1);

export const getGameSpeed = () => speedSignal.get();
export const setGameSpeed = (speed: GameSpeed) => {
  speedSignal.set(speed);
  try {
    localStorage.setItem(SPEED_KEY, String(speed));
  } catch {
    // Not remembered, but still applies
  }
};
export const useGameSpeed = () => useSyncExternalStore(speedSignal.subscribe, speedSignal.get, () => 1 as GameSpeed);

// --- Castle damage being shown ---------------------------------------------------------------

// Damage a castle has visibly taken so far in the battle being fought (before the battle's result
// is applied), so the top bar's castle health counts down with the castle's own label
const castleShownDamage = createSignal<Record<'player' | 'ai', number>>({ player: 0, ai: 0 });
export const setCastleShownDamage = (owner: 'player' | 'ai', damage: number) => {
  if (castleShownDamage.get()[owner] !== damage) castleShownDamage.set({ ...castleShownDamage.get(), [owner]: damage });
};
const NO_DAMAGE = { player: 0, ai: 0 };
export const useCastleShownDamage = () => useSyncExternalStore(castleShownDamage.subscribe, castleShownDamage.get, () => NO_DAMAGE);

// How fast animations run right now: the chosen speed, slowed during slow motion
export const getTimeScale = () => speedSignal.get() * slowMotion.get();

// The battle's own clock (ms): real time run at the time scale, so it keeps pace with the
// animations through changes of speed and slow motion
let clockReal = typeof performance !== 'undefined' ? performance.now() : 0;
let clockGame = 0;
let clockScale = getTimeScale();
const settleClock = () => {
  const now = performance.now();
  clockGame += (now - clockReal) * clockScale;
  clockReal = now;
};
export const getGameClock = () => {
  settleClock();
  return clockGame;
};
// (the clock runs at the old rate up to a change, the new one after)
const rescaleClock = () => {
  settleClock();
  clockScale = getTimeScale();
};
speedSignal.subscribe(rescaleClock);
slowMotion.subscribe(rescaleClock);

let slowMotionTimeout: ReturnType<typeof setTimeout> | undefined;
export const triggerSlowMotion = (scale: number, durationMs: number) => {
  slowMotion.set(scale);
  clearTimeout(slowMotionTimeout);
  slowMotionTimeout = setTimeout(() => slowMotion.set(1), durationMs);
};

// --- Screen shake --------------------------------------------------------------------------

// Trauma decays over time; shake strength is trauma squared so small bumps stay subtle
let trauma = 0;
const TRAUMA_DECAY = 1.6;

export const shakeScreen = (amount: number) => {
  trauma = Math.min(1, trauma + amount);
};

// Camera offset for this frame (world units)
export const takeShake = (delta: number, time: number): [number, number, number] => {
  trauma = Math.max(0, trauma - delta * TRAUMA_DECAY);
  const strength = trauma * trauma * 0.6;
  if (strength === 0) return [0, 0, 0];
  return [
    Math.sin(time * 47.3) * strength,
    Math.sin(time * 39.1 + 1.7) * strength * 0.6,
    Math.sin(time * 43.7 + 3.1) * strength
  ];
};

// --- Projecting the 3D board onto the screen -----------------------------------------------

type Projector = (world: [number, number, number]) => { x: number; y: number } | null;
let projector: Projector | null = null;

export const setProjector = (next: Projector | null) => {
  projector = next;
};

export const projectToScreen = (world: [number, number, number]) => projector?.(world) ?? null;

// --- Flying coins, callouts and confetti ---------------------------------------------------

export type CoinTarget = 'gold' | 'coins';

export interface CoinBurst {
  id: number;
  from: { x: number; y: number };
  count: number;
  target: CoinTarget;
}

export type MomentTone = 'gold' | 'red' | 'blue' | 'purple' | 'green';

export interface Moment {
  id: number;
  title: string;
  subtitle?: string;
  tone: MomentTone;
  // Huge moments (boss defeated, victory) fill the screen
  big?: boolean;
  // Show the subtitle even though it isn't huge (a new rule worth explaining)
  explain?: boolean;
}

export interface EffectsState {
  coins: CoinBurst[];
  moments: Moment[];
  // Confetti bursts (each a burst id)
  confetti: number[];
  // Red flash when your castle is hit
  flash: number;
}

const effects = createSignal<EffectsState>({ coins: [], moments: [], confetti: [], flash: 0 });
let nextId = 1;

const update = (patch: (state: EffectsState) => EffectsState) => effects.set(patch(effects.get()));

const removeLater = (key: 'coins' | 'moments' | 'confetti', id: number, ms: number) => {
  setTimeout(() => update(state => ({
    ...state,
    [key]: (state[key] as { id?: number }[]).filter(item => (typeof item === 'number' ? item : item.id) !== id)
  })), ms);
};

export const emitCoins = (from: { x: number; y: number }, count: number, target: CoinTarget = 'gold') => {
  if (count <= 0) return;
  const id = nextId++;
  update(state => ({ ...state, coins: [...state.coins, { id, from, count: Math.min(count, 14), target }] }));
  removeLater('coins', id, 1600);
};

export const emitMoment = (moment: Omit<Moment, 'id'>) => {
  const id = nextId++;
  // One callout at a time: a new one replaces the last, unless that one is huge and this isn't
  let shown = false;
  update(state => {
    if (!moment.big && state.moments.some(current => current.big)) return state;
    shown = true;
    return { ...state, moments: [{ ...moment, id }] };
  });
  if (shown) removeLater('moments', id, moment.big ? 2600 : 1900);
};

export const emitConfetti = () => {
  const id = nextId++;
  update(state => ({ ...state, confetti: [...state.confetti, id] }));
  removeLater('confetti', id, 3500);
};

export const flashDamage = () => update(state => ({ ...state, flash: state.flash + 1 }));

const emptyEffects: EffectsState = { coins: [], moments: [], confetti: [], flash: 0 };
export const useEffects = () => useSyncExternalStore(effects.subscribe, effects.get, () => emptyEffects);

export const resetEffects = () => effects.set(emptyEffects);
