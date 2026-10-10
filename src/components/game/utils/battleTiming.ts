import { GameState, Unit } from '@/types/game';
import { findTerrainPath } from '@/lib/game/gameState';
import { getAttackInterval } from './UnitModelSystem';
import { axialToWorld } from './boardGeometry';

// Timing of the battle animation, shared by the units fighting it and the board that shows its damage

// How long each battle plays out on the board before its result is applied (ms)
export const BATTLE_DURATION_MS = 2800;
// Blows land within this window (s), leaving a moment to see the final health before the result
export const BATTLE_STRIKE_WINDOW = 2.2;
// Seconds a bolt or spell takes to reach its target
export const PROJECTILE_FLIGHT_TIME = 0.35;
// Point in a strike (as a fraction of the unit's attack interval) where a melee blow lands,
// or where a ranged shot is released
export const MELEE_IMPACT_POINT = 0.25;
export const RANGED_RELEASE_POINT = 0.3;
// How fast units walk between hexes (world units per second)
export const WALK_SPEED = 2.4;
// A little extra time after the last unit arrives before blows start landing (s)
const ARRIVAL_PAUSE = 0.25;

// Small per-unit delay so units in the same battle don't strike in lockstep
export const strikeOffset = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 1000) / 1000 * 0.35;
};

// Seconds after a battle starts at which each of a unit's blows lands on its target
export const getImpactTimes = (unit: Unit): number[] => {
  const interval = getAttackInterval(unit.type);
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

// When a unit's health bar runs out during a battle (seconds after it starts), given the times the
// blows land and the damage they add up to; null if it survives
export const getDeathTime = (times: number[], damage: number, health: number): number | null => {
  if (damage < health || times.length === 0) return null;
  for (let landed = 1; landed <= times.length; landed++) {
    if (Math.round(damage * landed / times.length) >= health) return times[landed - 1];
  }
  return times[times.length - 1];
};

// The blows a unit lands before it falls (at least its first, as the battle resolves all at once)
export const getImpactTimesUntil = (unit: Unit, diesAt: number | null): number[] => {
  const times = getImpactTimes(unit);
  if (diesAt === null) return times;
  const alive = times.filter(time => time <= diesAt);
  return alive.length > 0 ? alive : times.slice(0, 1);
};

// Seconds the walks of a turn's moves take to play out: battles only start once everyone has arrived
export const getArrivalTime = (before: GameState, after: GameState): number => {
  let longest = 0;
  for (const side of Object.keys(after.players)) {
    for (const unit of after.players[side].units) {
      const from = before.players[side]?.units.find(other => other.id === unit.id)?.position;
      if (!from || (from.q === unit.position.q && from.r === unit.position.r)) continue;
      const path = findTerrainPath(after.hexGrid, from, unit.position, unit.abilities.includes('flying')).map(axialToWorld);
      let length = 0;
      for (let i = 1; i < path.length; i++) {
        length += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
      }
      longest = Math.max(longest, length);
    }
  }
  // Walks also climb and drop between tiles, so allow a little more than the flat distance
  return longest > 0 ? longest * 1.1 / WALK_SPEED + ARRIVAL_PAUSE : 0;
};

// The arrival time of the turn being fought: set when the moves are executed, read by the board
let battleStartDelay = 0;
export const setBattleStartDelay = (seconds: number) => { battleStartDelay = seconds; };
export const getBattleStartDelay = () => battleStartDelay;
