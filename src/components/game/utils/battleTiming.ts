import { Unit } from '@/types/game';
import { ATTACK_INTERVALS } from './UnitModelSystem';

// Timing of the battle animation, shared by the units fighting it and the board that shows its damage

// How long each battle plays out on the board before its result is applied (ms)
export const BATTLE_DURATION_MS = 2600;
// Blows land within this window (s), leaving a moment to see the final health before the result
export const BATTLE_STRIKE_WINDOW = 2.2;
// Seconds a bolt or spell takes to reach its target
export const PROJECTILE_FLIGHT_TIME = 0.35;
// Point in a strike (as a fraction of the unit's attack interval) where a melee blow lands,
// or where a ranged shot is released
export const MELEE_IMPACT_POINT = 0.25;
export const RANGED_RELEASE_POINT = 0.3;

// Small per-unit delay so units in the same battle don't strike in lockstep
export const strikeOffset = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 1000) / 1000 * 0.35;
};

// Seconds after a battle starts at which each of a unit's blows lands on its target
export const getImpactTimes = (unit: Unit): number[] => {
  const interval = ATTACK_INTERVALS[unit.type];
  const impactDelay = unit.abilities.includes('rangedAttack')
    ? interval * RANGED_RELEASE_POINT + PROJECTILE_FLIGHT_TIME
    : interval * MELEE_IMPACT_POINT;
  const times: number[] = [];
  for (let strike = 0; ; strike++) {
    const time = strikeOffset(unit.id) + strike * interval + impactDelay;
    if (time > BATTLE_STRIKE_WINDOW) break;
    times.push(time);
  }
  return times;
};
