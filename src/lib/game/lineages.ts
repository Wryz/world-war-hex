import type { Ability, TroopStats } from '@/types/game';
import type { Haul, MaterialId } from './materials';
import type { MobSkill, MobSkillKind } from './mobSkills';
import type { TroopId } from './troops';

// Lineages: each of the six cards sold in the shop is the root of a family of troops. A card grows
// on its skill tree, paid for with the materials carried home from the battlefields:
//
//   - Tier 1, attributes: pick two of four (hardier, harder-hitting, faster, keener-eyed ...),
//     paid with common materials
//   - Tier 2, a skill: pick one of two tricks of the kind monsters have, paid with uncommon ones
//   - Tier 3, evolutions: new forms of the troop, each paid with its own materials - a boss's
//     trophy or a region's relic among them - and open once a campaign level is won. Some forms
//     evolve further (Knights into Pegasus Knights).
//
// Every form of a lineage shares the base card's level and its tree; the deck holds one form of
// each lineage, and the player switches between the forms they have unlocked freely. Changing a
// choice already paid for (a respec) costs coins instead of materials.

export type LineageId = 'infantry' | 'artillery' | 'tank' | 'rogue' | 'medic' | 'engineer';
export const LINEAGE_IDS: LineageId[] = ['infantry', 'artillery', 'tank', 'rogue', 'medic', 'engineer'];

export type AttributeId = 'hardy' | 'drilled' | 'swift' | 'trailblazer' | 'keen' | 'steadfast' | 'mender';

export type PlayerSkillId =
  | 'rally' | 'executioner' | 'fireArrows' | 'huntersMark' | 'bulwark' | 'impale'
  | 'poisonedBlades' | 'ambush' | 'hex' | 'lifeSiphon' | 'guard' | 'fortify';

export type MaterialCost = Partial<Record<MaterialId, number>>;

export interface AttributeDef {
  id: AttributeId;
  name: string;
  description: string;
  cost: MaterialCost;
  // What it does to the troop's stats
  health?: number;
  attack?: number;
  move?: number;
  ability?: Ability;
}

export const ATTRIBUTES: Record<AttributeId, AttributeDef> = {
  hardy: { id: 'hardy', name: 'Hardy', description: '+20% health.', health: 0.2, cost: { wild_herbs: 4, wool_tuft: 3 } },
  drilled: { id: 'drilled', name: 'Drilled', description: '+10% attack.', attack: 0.1, cost: { granite: 3, timber: 4 } },
  swift: { id: 'swift', name: 'Swift', description: '+1 movement.', move: 1, cost: { wheat_sheaf: 4, roof_thatch: 2 } },
  trailblazer: { id: 'trailblazer', name: 'Trailblazer', description: 'Desert, swamp, snow and ice cost only 1 movement.', ability: 'pathfinder', cost: { timber: 3, tent_canvas: 2 } },
  keen: { id: 'keen', name: 'Keen Eyes', description: 'Sees one hex further through the fog.', ability: 'keenEyed', cost: { granite: 2, tent_canvas: 3 } },
  steadfast: { id: 'steadfast', name: 'Steadfast', description: 'Fearless: never shaken by curses, fallen champions or being surrounded.', ability: 'fearless', cost: { clay_bricks: 3, granite: 3 } },
  mender: { id: 'mender', name: 'Field Dressing', description: 'Heals 2 health at the end of each of its turns.', ability: 'regenerate', cost: { wild_herbs: 6, clay_bricks: 2 } }
};

export interface PlayerSkillDef {
  id: PlayerSkillId;
  // How it works in battle: the same rules as a monster's skill of its kind (mobSkills.ts)
  skill: MobSkill;
  cost: MaterialCost;
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

const playerSkill = (
  id: PlayerSkillId, name: string, kind: MobSkillKind, numbers: Omit<MobSkill, 'name' | 'kind' | 'description'>,
  description: string, cost: MaterialCost
): PlayerSkillDef => ({ id, skill: { name, kind, ...numbers, description }, cost });

export const PLAYER_SKILLS: Record<PlayerSkillId, PlayerSkillDef> = {
  rally: playerSkill('rally', 'Rally', 'aura', { share: 0.15 }, `Friendly troops beside it strike ${pct(0.15)} harder.`, { banner_cloth: 2, gold_nugget: 2 }),
  executioner: playerSkill('executioner', 'Executioner', 'finisher', { share: 0.35 }, `+${pct(0.35)} attack against troops at half health or less.`, { steel_ingot: 2, gold_nugget: 2 }),
  fireArrows: playerSkill('fireArrows', 'Barbed Arrows', 'venom', { amount: 2 }, 'Troops it hits bleed: they lose 2 health at the end of their next turn.', { spyglass_lens: 1, gold_nugget: 2 }),
  huntersMark: playerSkill('huntersMark', "Hunter's Mark", 'hunter', { share: 0.35, classes: ['cavalry', 'skirmisher'] }, `+${pct(0.35)} attack against cavalry and skirmishers.`, { spyglass_lens: 2, spring_water: 1 }),
  bulwark: playerSkill('bulwark', 'Bulwark', 'guard', { share: 0.15 }, `Friendly troops beside it take ${pct(0.15)} less damage.`, { gate_iron: 1, steel_ingot: 1 }),
  impale: playerSkill('impale', 'Impale', 'charge', { share: 0.35, distance: 2 }, `+${pct(0.35)} attack after moving 2 or more hexes this turn.`, { steel_ingot: 2, spring_water: 1 }),
  poisonedBlades: playerSkill('poisonedBlades', 'Poisoned Blades', 'venom', { amount: 3 }, 'Troops it hurts are poisoned: they lose 3 health at the end of their next turn.', { glowcap: 2, gold_nugget: 1 }),
  ambush: playerSkill('ambush', 'Ambush', 'isolate', { share: 0.35 }, `+${pct(0.35)} attack against troops with no friend beside them.`, { spyglass_lens: 1, glowcap: 2 }),
  hex: playerSkill('hex', 'Hex', 'curse', {}, 'Troops it hits are hexed: they strike 30% softer on their next turn (the fearless shrug it off).', { glowcap: 2, spring_water: 2 }),
  lifeSiphon: playerSkill('lifeSiphon', 'Life Siphon', 'leech', { amount: 3 }, 'Heals 3 whenever it hurts a troop.', { spring_water: 3, gold_nugget: 1 }),
  guard: playerSkill('guard', 'Earthworks', 'guard', { share: 0.2 }, `Friendly troops beside it take ${pct(0.2)} less damage.`, { gate_iron: 1, siege_rope: 1 }),
  fortify: playerSkill('fortify', 'Mantlets', 'hide', { share: 0.25 }, `Takes ${pct(0.25)} less damage from troops shooting from 2 or more hexes away.`, { siege_rope: 2, steel_ingot: 1 })
};

export const isPlayerSkillId = (id: unknown): id is PlayerSkillId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(PLAYER_SKILLS, id);

// The setting a lineage's tree is shown in (and its evolutions play out in)
export type LineageSetting = 'barracks' | 'range' | 'stables' | 'hideout' | 'shrine' | 'workshop';

export interface FormDef {
  id: TroopId;
  // The form it evolves from (the lineage's base card when not given)
  from?: TroopId;
  // Campaign level that must be won before it can evolve
  unlockLevel: number;
  cost: MaterialCost;
}

export interface LineageDef {
  id: LineageId;
  // The base card (sold in the shop)
  base: TroopId;
  name: string;
  setting: LineageSetting;
  attributes: [AttributeId, AttributeId, AttributeId, AttributeId];
  skills: [PlayerSkillId, PlayerSkillId];
  forms: FormDef[];
}

export const ATTRIBUTE_PICKS = 2;

export const LINEAGES: Record<LineageId, LineageDef> = {
  infantry: {
    id: 'infantry', base: 'infantry', name: 'Swordsmen', setting: 'barracks',
    attributes: ['hardy', 'drilled', 'steadfast', 'trailblazer'],
    skills: ['rally', 'executioner'],
    forms: [
      { id: 'shieldbearer', unlockLevel: 20, cost: { banner_gauntlet: 1, goblin_tooth: 4, steel_ingot: 2, timber: 4 } },
      { id: 'warden', from: 'shieldbearer', unlockLevel: 70, cost: { phylactery_shard: 1, gate_iron: 3, granite: 4, steel_ingot: 3 } },
      { id: 'berserker', unlockLevel: 27, cost: { warchief_totem: 1, beast_pelt: 5, granite: 3 } },
      { id: 'warlord', from: 'berserker', unlockLevel: 85, cost: { war_horn: 1, orc_tusk: 6, iron_rivets: 4 } }
    ]
  },
  artillery: {
    id: 'artillery', base: 'artillery', name: 'Archers', setting: 'range',
    attributes: ['keen', 'drilled', 'trailblazer', 'hardy'],
    skills: ['fireArrows', 'huntersMark'],
    forms: [
      { id: 'longbow', unlockLevel: 35, cost: { drowned_bell: 1, reeds: 6, spyglass_lens: 2 } },
      { id: 'crossbow', unlockLevel: 48, cost: { hydra_heart: 1, scorpion_stinger: 3, siege_rope: 2, scrap_metal: 3 } }
    ]
  },
  tank: {
    id: 'tank', base: 'tank', name: 'Pikemen', setting: 'stables',
    attributes: ['hardy', 'steadfast', 'swift', 'mender'],
    skills: ['bulwark', 'impale'],
    forms: [
      { id: 'helicopter', unlockLevel: 5, cost: { red_bandana: 3, stolen_purse: 4, tent_canvas: 2 } },
      { id: 'pegasus', from: 'helicopter', unlockLevel: 65, cost: { morthul_letter: 1, ectoplasm: 3, spyglass_lens: 2, beast_pelt: 4 } },
      { id: 'halberdier', unlockLevel: 30, cost: { dragonbone: 1, flint: 4, steel_ingot: 2, beast_pelt: 3 } }
    ]
  },
  rogue: {
    id: 'rogue', base: 'rogue', name: 'Rogues', setting: 'hideout',
    attributes: ['swift', 'keen', 'trailblazer', 'hardy'],
    skills: ['poisonedBlades', 'ambush'],
    forms: [
      { id: 'wolf_rider', unlockLevel: 32, cost: { direwolf_fang: 1, beast_pelt: 6, spider_silk: 2 } },
      { id: 'sapper', unlockLevel: 55, cost: { frozen_oath: 1, siege_rope: 2, frost_salt: 4, scrap_metal: 3 } }
    ]
  },
  medic: {
    id: 'medic', base: 'medic', name: 'Mages', setting: 'shrine',
    attributes: ['hardy', 'keen', 'steadfast', 'swift'],
    skills: ['hex', 'lifeSiphon'],
    forms: [
      { id: 'cleric', unlockLevel: 45, cost: { kings_tablet: 1, mummy_wrap: 5, spring_water: 2 } },
      { id: 'archmage', unlockLevel: 78, cost: { broken_standard: 1, ectoplasm: 3, glowcap: 4, grave_dust: 3 } }
    ]
  },
  engineer: {
    id: 'engineer', base: 'engineer', name: 'Engineers', setting: 'workshop',
    attributes: ['hardy', 'mender', 'keen', 'drilled'],
    skills: ['guard', 'fortify'],
    forms: [
      { id: 'siege_engineer', unlockLevel: 15, cost: { scrap_metal: 5, sawn_planks: 3, goblin_tooth: 3 } },
      { id: 'bear_warden', unlockLevel: 60, cost: { rime_core: 1, yeti_fur: 5, beast_pelt: 4, oak_staves: 2 } }
    ]
  }
};

const LINEAGE_OF = new Map<TroopId, LineageId>(
  LINEAGE_IDS.flatMap(id => [[LINEAGES[id].base, id] as const, ...LINEAGES[id].forms.map(form => [form.id, id] as const)])
);

// The lineage a Kingdom card belongs to (undefined for monsters)
export const lineageOf = (id: TroopId): LineageId | undefined => LINEAGE_OF.get(id);
export const getLineage = (id: LineageId): LineageDef => LINEAGES[id];
// The six base cards, sold in the shop
export const BASE_CARD_IDS: TroopId[] = LINEAGE_IDS.map(id => LINEAGES[id].base);
export const isBaseCard = (id: TroopId) => BASE_CARD_IDS.includes(id);
export const baseOf = (id: TroopId): TroopId => {
  const lineage = lineageOf(id);
  return lineage ? LINEAGES[lineage].base : id;
};
export const getForm = (id: TroopId): FormDef | undefined => {
  const lineage = lineageOf(id);
  return lineage ? LINEAGES[lineage].forms.find(form => form.id === id) : undefined;
};
// The form a form evolves from
export const evolvesFrom = (id: TroopId): TroopId => {
  const form = getForm(id);
  return form?.from ?? baseOf(id);
};
// Every card of a lineage, the base first
export const lineageCards = (id: LineageId): TroopId[] => [LINEAGES[id].base, ...LINEAGES[id].forms.map(form => form.id)];

// --- A lineage's tree as chosen by the player --------------------------------------------------

export interface LineageTree {
  attributes: AttributeId[];
  skill?: PlayerSkillId;
}

export type Trees = Partial<Record<LineageId, LineageTree>>;

// A troop's stats with its lineage's tree applied
export const applyTree = (stats: TroopStats, tree: LineageTree | undefined): TroopStats => {
  if (!tree) return stats;
  const result: TroopStats = { ...stats, abilities: [...stats.abilities] };
  for (const id of tree.attributes) {
    const attribute = ATTRIBUTES[id];
    if (!attribute) continue;
    if (attribute.health) result.maxLifespan = Math.max(1, Math.round(result.maxLifespan * (1 + attribute.health)));
    if (attribute.attack) result.attackPower = Math.round(result.attackPower * (1 + attribute.attack) * 10) / 10;
    if (attribute.move) result.movementRange += attribute.move;
    if (attribute.ability && !result.abilities.includes(attribute.ability)) result.abilities.push(attribute.ability);
  }
  if (tree.skill) result.skill = tree.skill;
  return result;
};

// --- Paying with materials ---------------------------------------------------------------------

export const costEntries = (cost: MaterialCost): [MaterialId, number][] =>
  (Object.entries(cost) as [MaterialId, number][]).filter(([, count]) => count > 0);

export const canAfford = (haul: Haul, cost: MaterialCost) => costEntries(cost).every(([id, count]) => (haul[id] ?? 0) >= count);

export const spend = (haul: Haul, cost: MaterialCost): Haul => {
  const next = { ...haul };
  for (const [id, count] of costEntries(cost)) {
    const left = (next[id] ?? 0) - count;
    if (left > 0) next[id] = left;
    else delete next[id];
  }
  return next;
};

// Coins to change a choice already paid for (an attribute or the skill)
export const RESPEC_COST = 100;

// Cards with every owned card of `id`'s lineage set to `level`
export const withLineageLevel = (cards: Partial<Record<TroopId, number>>, id: TroopId, level: number): Partial<Record<TroopId, number>> => {
  const lineage = lineageOf(id);
  if (!lineage) return { ...cards, [id]: level };
  const next = { ...cards };
  for (const card of lineageCards(lineage)) if (next[card] !== undefined) next[card] = level;
  next[id] = level;
  return next;
};
