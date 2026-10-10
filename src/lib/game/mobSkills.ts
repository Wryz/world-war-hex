import type { HexCoordinates, TerrainType, Unit } from '@/types/game';
import { TroopClass, TroopId, getTroopClass } from './troops';
import { getHexDistance } from './hexUtils';
import { PLAYER_SKILLS, PlayerSkillId, isPlayerSkillId } from './lineages';

// Monster skills: every regular enemy troop has one trick of its own, on top of its faction's trait
// (bosses have their powers instead). They are what makes a goblin sapper something to kill at
// range and a giant spider something not to let near your archers. Each is one of a handful of
// kinds of effect, with its own numbers:
//
//   - in the fight itself (the share shows in the combat preview, the callouts and the AI's sums):
//     ganging up, finishing off the wounded, charging, picking off stragglers, ambushing from home
//     ground, hunting a kind of troop, a war-cry for friends beside it, a hide that turns arrows
//   - after the blow lands: venom, a slowing bite, a curse that shakes the troop's nerve, draining
//     life, stealing gold
//   - when it falls: bursting over the troops beside it

export type MobSkillKind =
  // Harder when another of its side stands beside the target
  | 'gangUp'
  // Harder for every other troop of its side beside the target (up to `max`)
  | 'horde'
  // Harder against a target at half health or less
  | 'finisher'
  // Harder against a target at full health
  | 'firstBlood'
  // Harder after moving at least `distance` hexes this turn
  | 'charge'
  // Harder against a target with no friend beside it
  | 'isolate'
  // Harder against these classes of troop
  | 'hunter'
  // Harder striking from these kinds of ground
  | 'native'
  // Harder against a target standing on these kinds of ground
  | 'targetGround'
  // Friends of its side beside it strike harder
  | 'aura'
  // Friends of its side beside it take less damage
  | 'guard'
  // Takes less damage from ranged strikes
  | 'hide'
  // Takes less damage at half health or less
  | 'lastStand'
  // Troops it hurts lose `amount` health at the end of their side's next turn
  | 'venom'
  // Troops it hurts move one hex less on their next turn
  | 'slow'
  // Troops it hurts are shaken (strike softer) for a turn, unless fearless
  | 'curse'
  // Heals `amount` whenever it deals damage
  | 'leech'
  // Each blow that lands takes `amount` gold from the enemy's treasury
  | 'plunder'
  // When slain, deals `amount` damage to every enemy beside it
  | 'deathburst';

export interface MobSkill {
  name: string;
  kind: MobSkillKind;
  description: string;
  // The share it adds (or, for defences, takes off)
  share?: number;
  amount?: number;
  distance?: number;
  max?: number;
  classes?: TroopClass[];
  ground?: TerrainType[];
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

const skill = (name: string, kind: MobSkillKind, numbers: Omit<MobSkill, 'name' | 'kind' | 'description'>, description: (s: Omit<MobSkill, 'description'>) => string): MobSkill => {
  const base = { name, kind, ...numbers };
  return { ...base, description: description(base) };
};

export const MOB_SKILLS: Partial<Record<TroopId, MobSkill>> = {
  // Bandits: greedy and opportunistic, never a fair fight
  bandit_thug: skill('Gang Up', 'horde', { share: 0.25, max: 3 }, s => `+${pct(s.share!)} attack for every other troop of its warband beside its target (up to ${s.max}).`),
  bandit_archer: skill('Cheap Shot', 'finisher', { share: 0.5 }, s => `+${pct(s.share!)} attack against troops at half health or less.`),
  highwayman: skill('Stand and Deliver', 'plunder', { amount: 5 }, s => `Every blow that lands steals ${s.amount} gold from your treasury.`),
  bandit_raider: skill('Ride Down', 'charge', { share: 0.4, distance: 2 }, s => `+${pct(s.share!)} attack after riding ${s.distance} or more hexes this turn.`),
  // Goblins: dirty fighters who come in numbers
  goblin_scrapper: skill('Dirty Tricks', 'isolate', { share: 0.2 }, s => `+${pct(s.share!)} attack against troops with no friend beside them.`),
  goblin_slinger: skill('Opening Volley', 'firstBlood', { share: 0.35 }, s => `+${pct(s.share!)} attack against unhurt troops.`),
  goblin_shaman: skill('War Paint', 'aura', { share: 0.2 }, s => `Its warband's troops beside it strike ${pct(s.share!)} harder.`),
  goblin_sapper: skill('Kaboom', 'deathburst', { amount: 4 }, s => `Blows up when slain: ${s.amount} damage to every enemy beside it.`),
  // Beasts: hunters that pull down stragglers
  grey_wolf: skill('Bring Down', 'finisher', { share: 0.25 }, s => `+${pct(s.share!)} attack against troops at half health or less.`),
  wild_boar: skill('Gore', 'charge', { share: 0.25, distance: 2 }, s => `+${pct(s.share!)} attack after charging ${s.distance} or more hexes this turn.`),
  giant_spider: skill('Web', 'slow', {}, () => 'Troops it bites are caught in its web: they move one hex less on their next turn.'),
  cave_bear: skill('Thick Fur', 'hide', { share: 0.2 }, s => `Takes ${pct(s.share!)} less damage from troops shooting from 2 or more hexes away.`),
  // Swamp: things that lurk in the water
  bog_slime: skill('Engulf', 'leech', { amount: 3 }, s => `Heals ${s.amount} whenever it hurts a troop.`),
  lizardman: skill('Reed Ambush', 'native', { share: 0.4, ground: ['swamp', 'water', 'forest'] }, s => `+${pct(s.share!)} attack striking from swamp, water or forest.`),
  toxic_toad: skill('Toxic Spit', 'venom', { amount: 3 }, s => `Troops it hits are poisoned: they lose ${s.amount} health at the end of their next turn.`),
  swamp_witch: skill('Hex', 'curse', {}, () => 'Troops it hits are hexed: they strike 30% softer on their next turn (the fearless shrug it off).'),
  // Desert: patient killers of the dunes
  giant_scorpion: skill('Venom Sting', 'venom', { amount: 4 }, s => `Troops it stings are poisoned: they lose ${s.amount} health at the end of their next turn.`),
  sand_raider: skill('Dune Ambush', 'native', { share: 0.4, ground: ['desert'] }, s => `+${pct(s.share!)} attack striking from the desert.`),
  mummy: skill('Curse of Ages', 'curse', {}, () => 'Troops it hits are cursed: they strike 30% softer on their next turn (the fearless shrug it off).'),
  sand_golem: skill('Stone Skin', 'lastStand', { share: 0.35 }, s => `Takes ${pct(s.share!)} less damage at half health or less.`),
  // Frost: the cold itself fights for them
  snow_wolf: skill('Frostbite', 'venom', { amount: 4 }, s => `Troops it bites are frostbitten: they lose ${s.amount} health at the end of their next turn.`),
  ice_wraith: skill('Chilling Touch', 'slow', {}, () => 'Troops it touches are chilled: they move one hex less on their next turn.'),
  yeti: skill('Rampage', 'charge', { share: 0.5, distance: 2 }, s => `+${pct(s.share!)} attack after charging ${s.distance} or more hexes this turn.`),
  frost_huntress: skill('Hunter\'s Mark', 'hunter', { share: 0.5, classes: ['cavalry', 'skirmisher'] }, s => `+${pct(s.share!)} attack against cavalry and skirmishers.`),
  // Undead: endless, and they feed on the living
  skeleton_minion: skill('Bone Horde', 'horde', { share: 0.15, max: 3 }, s => `+${pct(s.share!)} attack for every other troop of its horde beside its target (up to ${s.max}).`),
  skeleton_warrior: skill('Bone Shield', 'hide', { share: 0.35 }, s => `Takes ${pct(s.share!)} less damage from troops shooting from 2 or more hexes away.`),
  skeleton_archer: skill('Grave Volley', 'firstBlood', { share: 0.35 }, s => `+${pct(s.share!)} attack against unhurt troops.`),
  ghost: skill('Life Drain', 'leech', { amount: 3 }, s => `Heals ${s.amount} whenever it hurts a troop.`),
  // Orcs: brute force, and plenty of it
  orc_grunt: skill('Waaagh!', 'gangUp', { share: 0.3 }, s => `+${pct(s.share!)} attack when another of its warband stands beside its target.`),
  orc_archer: skill('Iron Bolts', 'hunter', { share: 0.35, classes: ['infantry', 'spear'] }, s => `+${pct(s.share!)} attack against infantry and spears.`),
  orc_shaman: skill('Blood Rites', 'aura', { share: 0.2 }, s => `Its warband's troops beside it strike ${pct(s.share!)} harder.`),
  ogre: skill('Smash', 'curse', {}, () => 'Troops it hits are stunned: they strike 30% softer on their next turn (the fearless shrug it off).'),
  // Infernal: everything burns
  imp: skill('Scorch', 'venom', { amount: 3 }, s => `Troops it hits are set alight: they lose ${s.amount} health at the end of their next turn.`),
  magma_golem: skill('Molten Core', 'deathburst', { amount: 6 }, s => `Bursts when slain: ${s.amount} damage to every enemy beside it.`),
  fire_elemental: skill('Wildfire', 'targetGround', { share: 0.5, ground: ['forest', 'plain', 'village', 'house'] }, s => `+${pct(s.share!)} attack against troops in forests, fields and villages.`),
  hellhound: skill('Hunt the Weak', 'finisher', { share: 0.5 }, s => `+${pct(s.share!)} attack against troops at half health or less.`),
  // Dragons: the brood and its worshippers
  dragon_cultist: skill('Scale Blessing', 'guard', { share: 0.3 }, s => `Troops beside it take ${pct(s.share!)} less damage.`),
  wyvern: skill('Snatch', 'isolate', { share: 0.5 }, s => `+${pct(s.share!)} attack against troops with no friend beside them.`),
  drake: skill('Burning Breath', 'venom', { amount: 4 }, s => `Troops it breathes on burn: they lose ${s.amount} health at the end of their next turn.`),
  dragon_knight: skill('Lance Charge', 'charge', { share: 0.5, distance: 2 }, s => `+${pct(s.share!)} attack after riding ${s.distance} or more hexes this turn.`)
};

// A troop's skill: a monster's own, or one a Kingdom card learnt on its skill tree (lineages.ts)
export const getMobSkill = (unit: { type: TroopId; isBoss?: boolean; skill?: PlayerSkillId }): MobSkill | undefined =>
  unit.isBoss ? undefined : unit.skill && isPlayerSkillId(unit.skill) ? PLAYER_SKILLS[unit.skill].skill : MOB_SKILLS[unit.type];

export const hasMobSkill = (unit: { type: TroopId; isBoss?: boolean; skill?: PlayerSkillId }, kind: MobSkillKind): MobSkill | undefined => {
  const found = getMobSkill(unit);
  return found?.kind === kind ? found : undefined;
};

// How much a cursed troop's strikes are softened (as a shaken one's)
export const CURSE_TURNS = 1;
// Movement lost to a slowing bite
export const SLOW_MOVEMENT = 1;

// The share a monster's own skill adds to its strike on `target`, standing at `at`, from `from`
// having walked `moved` hexes; `friends` are its side's troops (itself included)
export const mobStrikeShare = (
  attacker: Unit, target: Unit, from: HexCoordinates, at: HexCoordinates, moved: number,
  friends: Unit[], targetFriends: Unit[], groundAt: (c: HexCoordinates) => TerrainType
): { label: string; share: number } | null => {
  const own = getMobSkill(attacker);
  if (!own || own.share === undefined) return null;
  const beside = (units: Unit[], c: HexCoordinates, except: string) =>
    units.filter(unit => unit.id !== except && getHexDistance(unit.position, c) === 1);
  let applies = false;
  let share = own.share;
  switch (own.kind) {
    case 'gangUp': applies = beside(friends, at, attacker.id).length > 0; break;
    case 'horde': {
      const count = Math.min(own.max ?? 3, beside(friends, at, attacker.id).length);
      applies = count > 0;
      share = own.share * count;
      break;
    }
    case 'finisher': applies = target.lifespan <= target.maxLifespan / 2; break;
    case 'firstBlood': applies = target.lifespan >= target.maxLifespan; break;
    case 'charge': applies = moved >= (own.distance ?? 3); break;
    case 'isolate': applies = beside(targetFriends, at, target.id).length === 0; break;
    case 'hunter': applies = !!own.classes?.includes(getTroopClass(target.type)); break;
    case 'native': applies = !!own.ground?.includes(groundAt(from)); break;
    case 'targetGround': applies = !!own.ground?.includes(groundAt(at)); break;
    default: return null;
  }
  return applies ? { label: own.name, share } : null;
};

// What a friend's War Paint (and the like) adds to a strike from `from`
export const mobAuraShare = (attacker: Unit, from: HexCoordinates, friends: Unit[]): { label: string; share: number } | null => {
  let best: { label: string; share: number } | null = null;
  for (const friend of friends) {
    if (friend.id === attacker.id || getHexDistance(friend.position, from) !== 1) continue;
    const aura = hasMobSkill(friend, 'aura');
    if (aura && (!best || aura.share! > best.share)) best = { label: aura.name, share: aura.share! };
  }
  return best;
};

// The share a target's own skill (or a guarding friend's) takes off a strike from `distance` hexes
// (the better of its own and a guard's, if both work)
export const mobDefenceShare = (target: Unit, at: HexCoordinates, distance: number, friends: Unit[]): { label: string; share: number } | null => {
  const own = getMobSkill(target);
  let best: { label: string; share: number } | null = null;
  if (own?.kind === 'hide' && distance > 1) best = { label: own.name, share: own.share! };
  if (own?.kind === 'lastStand' && target.lifespan <= target.maxLifespan / 2) best = { label: own.name, share: own.share! };
  for (const friend of friends) {
    if (friend.id === target.id || getHexDistance(friend.position, at) !== 1) continue;
    const guard = hasMobSkill(friend, 'guard');
    if (guard && (!best || guard.share! > best.share)) best = { label: guard.name, share: guard.share! };
  }
  return best;
};
