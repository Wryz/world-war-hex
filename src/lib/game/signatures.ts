import type { Unit } from '@/types/game';
import { TroopId, getTroop } from './troops';

// Signature abilities: every Kingdom card has one special ability that only works when its
// condition is met - fighting beside friends, standing still, alone, after a long charge. It wakes
// at card level 2 and grows stronger every two levels after that (rank I at level 2, II at 4 ... VII
// at 14). Rival kingdoms in quick battles field the same cards, so their troops have them too;
// monsters don't.

export type SignatureId =
  | 'shoulderToShoulder' | 'steadyAim' | 'brace' | 'loneBlade' | 'charge' | 'ward' | 'challenge'
  | 'bloodlust' | 'piercingShot' | 'holySmite' | 'undermine' | 'strafe' | 'eyeOfTheStorm' | 'fieldworks' | 'warCry';

export interface SignatureDef {
  id: SignatureId;
  name: string;
  // When it works, in a few words
  condition: string;
  // What it does at a rank
  describe: (rank: number) => string;
  // The same in a couple of words, for the board
  short: (rank: number) => string;
}

export const SIGNATURE_UNLOCK_LEVEL = 2;
export const MAX_SIGNATURE_RANK = 7;

// A card's signature rank at a level: 0 (not yet awake) at level 1, then one rank every two levels
export const signatureRank = (level: number | undefined): number =>
  Math.min(MAX_SIGNATURE_RANK, Math.floor(Math.max(1, level ?? 1) / 2));

// The level a card reaches its next rank at, or null at the top rank
export const nextRankLevel = (level: number): number | null =>
  signatureRank(level) >= MAX_SIGNATURE_RANK ? null : (signatureRank(level) + 1) * 2;

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const pct = (share: number) => `${Math.round(share * 100)}%`;

// --- The numbers behind each signature, by rank ----------------------------------------------

// Swordsmen: extra attack for each friendly troop beside them (up to three)
export const shoulderBonusPerAlly = (rank: number) => 0.04 * rank;
export const SHOULDER_MAX_ALLIES = 3;
// Archers: extra attack while they haven't moved this turn
export const steadyAimBonus = (rank: number) => 0.06 * rank;
// Pikemen: extra attack on the enemy's turn (striking back at attackers)
export const braceBonus = (rank: number) => 0.08 * rank;
// Rogues: extra attack with no friendly troop within LONE_BLADE_RADIUS hexes
export const loneBladeBonus = (rank: number) => 0.08 * rank;
export const LONE_BLADE_RADIUS = 2;
// Knights: extra attack after moving at least CHARGE_DISTANCE hexes this turn
export const chargeBonus = (rank: number) => 0.06 * rank;
export const CHARGE_DISTANCE = 3;
// Mages: friendly troops beside them take this much less damage
export const wardReduction = (rank: number) => 0.04 * rank;
// Shieldbearers: at the end of their turn, pull this many enemies within reach one hex closer
export const challengePulls = (rank: number) => 1 + Math.floor((rank - 1) / 3);
export const challengeRange = (rank: number) => 2 + Math.floor(rank / 3);
// Berserkers: health restored when they destroy an enemy
export const bloodlustHeal = (rank: number) => 3 * rank;
// Longbowmen: share of the target's cover their arrows ignore
export const piercingShare = (rank: number) => Math.min(1, 0.15 * rank);
// War Clerics: extra attack against the undead and demons
export const holySmiteBonus = (rank: number) => 0.12 * rank;
export const HOLY_SMITE_FACTIONS = ['undead', 'infernal'] as const;
// Siege Sappers: height the ground around them sinks by at the end of a turn they didn't move
export const undermineDepth = (rank: number) => Math.round(0.08 * rank * 100) / 100;
// Engineers: height their own hex rises by at the end of a turn they didn't move
export const fieldworksHeight = (rank: number) => Math.round(0.08 * rank * 100) / 100;
// Pegasus Knights: damage dealt to every enemy they fly past
export const strafeDamage = (rank: number) => rank + 1;
// Archmage: extra spell damage with no enemy within EYE_OF_STORM_RADIUS hexes
export const eyeOfStormBonus = (rank: number) => 0.08 * rank;
export const EYE_OF_STORM_RADIUS = 2;
// Warlord: extra attack for friendly troops beside it
export const warCryBonus = (rank: number) => 0.04 * rank;

const SHARED = {
  steadyAim: {
    id: 'steadyAim', name: 'Steady Aim', condition: "Hasn't moved",
    describe: rank => `+${pct(steadyAimBonus(rank))} attack on any turn it hasn't moved.`,
    short: rank => `+${pct(steadyAimBonus(rank))} attack`
  },
  brace: {
    id: 'brace', name: 'Brace', condition: "On the enemy's turn",
    describe: rank => `+${pct(braceBonus(rank))} attack when striking back on the enemy's turn.`,
    short: rank => `+${pct(braceBonus(rank))} attack`
  },
  charge: {
    id: 'charge', name: 'Charge', condition: `Moved ${CHARGE_DISTANCE}+ hexes`,
    describe: rank => `+${pct(chargeBonus(rank))} attack on a turn it rides ${CHARGE_DISTANCE} or more hexes.`,
    short: rank => `+${pct(chargeBonus(rank))} attack`
  },
  bloodlust: {
    id: 'bloodlust', name: 'Bloodlust', condition: 'Destroys an enemy',
    describe: rank => `Heals ${bloodlustHeal(rank)} health whenever it destroys an enemy.`,
    short: rank => `+${bloodlustHeal(rank)} health per kill`
  },
  fieldworks: {
    id: 'fieldworks', name: 'Fieldworks', condition: "Hasn't moved",
    describe: rank => `At the end of a turn it didn't move, it digs in: the ground of its hex rises ${fieldworksHeight(rank).toFixed(2)} higher.`,
    short: rank => `Raises its ground ${fieldworksHeight(rank).toFixed(2)}`
  }
} satisfies Partial<Record<SignatureId, SignatureDef>>;

export const SIGNATURES: Partial<Record<TroopId, SignatureDef>> = {
  infantry: {
    id: 'shoulderToShoulder', name: 'Shoulder to Shoulder', condition: 'Next to friends',
    describe: rank => `+${pct(shoulderBonusPerAlly(rank))} attack for each friendly troop beside it (up to ${SHOULDER_MAX_ALLIES}).`,
    short: rank => `+${pct(shoulderBonusPerAlly(rank))} attack per ally`
  },
  artillery: SHARED.steadyAim,
  tank: SHARED.brace,
  rogue: {
    id: 'loneBlade', name: 'Lone Blade', condition: 'Alone',
    describe: rank => `+${pct(loneBladeBonus(rank))} attack with no friendly troop within ${LONE_BLADE_RADIUS} hexes.`,
    short: rank => `+${pct(loneBladeBonus(rank))} attack`
  },
  helicopter: SHARED.charge,
  medic: {
    id: 'ward', name: 'Ward', condition: 'Friends beside it',
    describe: rank => `Friendly troops next to it take ${pct(wardReduction(rank))} less damage.`,
    short: rank => `Allies -${pct(wardReduction(rank))} damage`
  },
  shieldbearer: {
    id: 'challenge', name: 'Challenge', condition: 'Enemies nearby',
    describe: rank => {
      const pulls = challengePulls(rank);
      return `At the end of its turn, pulls ${pulls === 1 ? 'the nearest enemy' : `the ${pulls} nearest enemies`} within ${challengeRange(rank)} hexes one hex closer. Bosses hold their ground.`;
    },
    short: rank => `Pulls ${challengePulls(rank)} within ${challengeRange(rank)}`
  },
  berserker: SHARED.bloodlust,
  longbow: {
    id: 'piercingShot', name: 'Piercing Shot', condition: 'Target in cover',
    describe: rank => piercingShare(rank) >= 1
      ? 'Its arrows ignore cover completely.'
      : `Its arrows ignore ${pct(piercingShare(rank))} of a target's cover.`,
    short: rank => `Ignores ${pct(piercingShare(rank))} cover`
  },
  cleric: {
    id: 'holySmite', name: 'Holy Smite', condition: 'Undead or demons',
    describe: rank => `+${pct(holySmiteBonus(rank))} attack against the Undead and the Infernal Legion.`,
    short: rank => `+${pct(holySmiteBonus(rank))} vs undead, demons`
  },
  sapper: {
    id: 'undermine', name: 'Undermine', condition: "Hasn't moved",
    describe: rank => `At the end of a turn it didn't move, the ground around it sinks ${undermineDepth(rank).toFixed(2)} lower.`,
    short: rank => `Sinks ground ${undermineDepth(rank).toFixed(2)}`
  },
  engineer: SHARED.fieldworks,
  pegasus: {
    id: 'strafe', name: 'Strafe', condition: 'Flies past enemies',
    describe: rank => `Every enemy it flies past on its way takes ${strafeDamage(rank)} damage.`,
    short: rank => `${strafeDamage(rank)} damage per pass`
  },
  archmage: {
    id: 'eyeOfTheStorm', name: 'Eye of the Storm', condition: 'No enemy within 2',
    describe: rank => `+${pct(eyeOfStormBonus(rank))} spell damage with no enemy within ${EYE_OF_STORM_RADIUS} hexes.`,
    short: rank => `+${pct(eyeOfStormBonus(rank))} spell damage`
  },
  warden: SHARED.brace,
  warlord: {
    id: 'warCry', name: 'War Cry', condition: 'Friends beside it',
    describe: rank => `Friendly troops next to it strike ${pct(warCryBonus(rank))} harder.`,
    short: rank => `Allies +${pct(warCryBonus(rank))} attack`
  },
  crossbow: SHARED.steadyAim,
  halberdier: SHARED.brace,
  wolf_rider: SHARED.charge,
  siege_engineer: SHARED.fieldworks,
  bear_warden: SHARED.bloodlust
};

export const getSignature = (type: TroopId): SignatureDef | undefined => SIGNATURES[type];

// A unit's signature and its rank, if it has an awake one
export const unitSignature = (unit: Pick<Unit, 'type' | 'level'>): { def: SignatureDef; rank: number } | null => {
  const def = SIGNATURES[unit.type];
  const rank = signatureRank(unit.level);
  return def && rank > 0 ? { def, rank } : null;
};

// Rank of a particular signature on a unit (0 if it doesn't have it awake)
export const rankOf = (unit: Pick<Unit, 'type' | 'level'>, id: SignatureId): number => {
  const signature = unitSignature(unit);
  return signature?.def.id === id ? signature.rank : 0;
};

// Holy Smite's targets
export const isSmitable = (type: TroopId) => (HOLY_SMITE_FACTIONS as readonly string[]).includes(getTroop(type).faction);
