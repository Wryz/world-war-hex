import type { HexCoordinates } from '@/types/game';
import { TroopClass, TroopId, getTroopClass } from './troops';
import { getHexDistance } from './hexUtils';

// Formations: troops fight better together because of where they stand, not because of which cards
// they are. Every side's troops form them, monsters too.
//
// - Screen: archers and mages with a front-line troop (swords, spears, brutes) standing between
//   them and whoever attacks them take much less of the blow - more behind armour.
// - Pinned: an enemy next to one of your front-line troops is held in place, and your archers and
//   riders hit it harder (the anvil holds, the hammer falls).
// - Shield wall: front-line troops standing side by side take less damage.
// - Holding a crossing: a troop on a bridge or in a gateway can be got at from so few sides that it
//   can't be flanked.

const classOf = (type: string): TroopClass => getTroopClass(type as TroopId);

export const FRONT_LINE: TroopClass[] = ['infantry', 'spear', 'brute'];
export const BACK_LINE: TroopClass[] = ['ranged', 'magic'];
// Who strikes a pinned enemy harder
export const HAMMERS: TroopClass[] = ['ranged', 'cavalry'];

export const SCREEN_REDUCTION = 0.4;
export const ARMORED_SCREEN_REDUCTION = 0.5;
export const PIN_BONUS = 0.25;
export const SHIELD_WALL_REDUCTION = 0.15;

interface Placed {
  id: string;
  type: string;
  position: HexCoordinates;
  abilities: string[];
}

export const isFrontLine = (unit: { type: string }) => FRONT_LINE.includes(classOf(unit.type));
export const isBackLine = (unit: { type: string }) => BACK_LINE.includes(classOf(unit.type));

// The front-line friend shielding a back-line troop at `at` from a blow coming from `from`: beside
// it, and nearer the attacker than it is (the best screen, armoured first)
export const findScreen = <T extends Placed>(target: Placed, at: HexCoordinates, from: HexCoordinates, allies: T[]): T | undefined => {
  if (!isBackLine(target)) return undefined;
  const reach = getHexDistance(at, from);
  return allies
    .filter(ally => ally.id !== target.id && isFrontLine(ally) && getHexDistance(ally.position, at) === 1 && getHexDistance(ally.position, from) < reach)
    .sort((a, b) => Number(b.abilities.includes('armored')) - Number(a.abilities.includes('armored')))[0];
};

export const screenReduction = (screen: Placed | undefined) =>
  !screen ? 0 : screen.abilities.includes('armored') ? ARMORED_SCREEN_REDUCTION : SCREEN_REDUCTION;

// Whether a back-line troop at `at` has a front-line friend beside it (screened from that side)
export const hasScreenBeside = (target: Placed, at: HexCoordinates, allies: Placed[]) =>
  isBackLine(target) && allies.some(ally => ally.id !== target.id && isFrontLine(ally) && getHexDistance(ally.position, at) === 1);

// Whether an enemy standing at `at` is pinned by one of `holders` (front-line troops of the other
// side beside it), not counting the striker itself
export const isPinned = (at: HexCoordinates, holders: Placed[], strikerId?: string) =>
  holders.some(holder => holder.id !== strikerId && isFrontLine(holder) && getHexDistance(holder.position, at) === 1);

export const strikesPinned = (striker: { type: string }) => HAMMERS.includes(classOf(striker.type));

// Whether a front-line troop at `at` stands in a shield wall: another front-line friend beside it
export const inShieldWall = (unit: Placed, at: HexCoordinates, allies: Placed[]) =>
  isFrontLine(unit) && allies.some(ally => ally.id !== unit.id && isFrontLine(ally) && getHexDistance(ally.position, at) === 1);
