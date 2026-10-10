import { PlayerType } from '@/types/game';
import { TROOPS, TroopId } from '@/lib/game/troops';
import type { CreatureLook } from './creatureTypes';

// How every troop looks on the board.
// Humanoids are KayKit's CC0 low-poly characters (Character Packs: Adventurers and Skeletons, by
// Kay Lousberg). They all share one skeleton, so a single animation pack drives every one of them.
// A troop picks a character, the weapons it carries, a colour palette (goblins are green, mummies
// wrapped in linen...) and its animation clips. Monsters without a character model are procedural
// creatures (see creatures.ts). Each side's colour is painted onto capes, shields and hats.

export type AnimationState = 'idle' | 'holdShield' | 'attack' | 'walk';

export type CharacterModel =
  | 'knight' | 'barbarian' | 'ranger' | 'mage' | 'rogue'
  | 'skeleton_minion' | 'skeleton_warrior' | 'skeleton_rogue' | 'skeleton_mage';

// Colours swapped into a character's texture atlas
export interface Palette {
  skin?: string;
  cloth?: string;
  leather?: string;
  metal?: string;
  bone?: string;
  // Glowing eyes of skeletons
  glow?: string;
}

export interface HumanoidLook {
  kind: 'humanoid';
  model: CharacterModel;
  scale: number;
  // Weapon and shield meshes (children of the hand slots) this troop carries; the rest are hidden
  weapons: string[];
  // Other parts to hide (hats, capes)
  hide?: string[];
  palette?: Palette;
  // Animation clip (by exact name) for each state
  animations: Record<AnimationState, string>;
  // Rides a horse (Knights), or a beast (Wolf Riders, Bear Wardens); the horse can be tinted and
  // given wings
  mount?: { tint?: string; wings?: boolean; beast?: { variant: 'wolf' | 'bear'; scale: number; colors: CreatureLook['colors'] } };
  // Carries a long pike (Pikemen)
  pike?: boolean;
  // Demonic extras
  wings?: string;
  horns?: string;
  // Height of the unit's label above its hex
  labelHeight: number;
  // Projectile fired by ranged troops
  projectile?: Projectile;
}

export type Projectile = 'arrow' | 'magic' | 'fire' | 'spit' | 'frost' | 'rock';

export type UnitLook = HumanoidLook | CreatureLook;

export const MODEL_URLS: Record<CharacterModel, string> = {
  knight: '/models/units/knight.glb',
  barbarian: '/models/units/barbarian.glb',
  ranger: '/models/units/ranger.glb',
  mage: '/models/units/mage.glb',
  rogue: '/models/units/rogue.glb',
  skeleton_minion: '/models/units/skeleton_minion.glb',
  skeleton_warrior: '/models/units/skeleton_warrior.glb',
  skeleton_rogue: '/models/units/skeleton_rogue.glb',
  skeleton_mage: '/models/units/skeleton_mage.glb'
};

// The animation clips every character shares
export const ANIMATION_PACK_URL = '/models/units/animations.glb';

// Low-poly galloping horse from the three.js examples (MIT; model by mirada for ROME)
export const HORSE_MODEL = '/models/units/horse.glb';

// --- Animation sets ------------------------------------------------------------------------

const SWORD = { idle: 'Idle', holdShield: 'Blocking', attack: '1H_Melee_Attack_Slice_Diagonal', walk: 'Walking_A' };
const CHOP = { idle: 'Idle', holdShield: 'Blocking', attack: '1H_Melee_Attack_Chop', walk: 'Walking_A' };
const STAB = { idle: 'Idle', holdShield: 'Blocking', attack: '1H_Melee_Attack_Stab', walk: 'Walking_A' };
const GREAT = { idle: '2H_Melee_Idle', holdShield: '2H_Melee_Idle', attack: '2H_Melee_Attack_Chop', walk: 'Walking_A' };
const DUAL = { idle: 'Idle', holdShield: 'Blocking', attack: 'Dualwield_Melee_Attack_Slice', walk: 'Running_A' };
const CROSSBOW = { idle: 'Idle', holdShield: '2H_Ranged_Aiming', attack: '2H_Ranged_Shoot', walk: 'Walking_A' };
const HAND_CROSSBOW = { idle: 'Idle', holdShield: '1H_Ranged_Aiming', attack: '1H_Ranged_Shoot', walk: 'Walking_A' };
const SPELL = { idle: 'Idle', holdShield: 'Spellcasting', attack: 'Spellcast_Shoot', walk: 'Walking_A' };
const THROW = { idle: 'Idle', holdShield: 'Blocking', attack: 'Throw', walk: 'Running_A' };
const BRAWL = { idle: 'Idle', holdShield: 'Blocking', attack: 'Unarmed_Melee_Attack_Punch_A', walk: 'Walking_A' };
const SHAMBLE = { idle: 'Idle', holdShield: 'Blocking', attack: 'Unarmed_Melee_Attack_Punch_A', walk: 'Walking_D_Skeletons' };
const BONE_SWORD = { ...SWORD, walk: 'Walking_D_Skeletons' };
const BONE_CHOP = { ...CHOP, walk: 'Walking_D_Skeletons' };
const BONE_CROSSBOW = { ...HAND_CROSSBOW, walk: 'Walking_D_Skeletons' };
const BONE_SPELL = { ...SPELL, walk: 'Walking_D_Skeletons' };

// --- Palettes ------------------------------------------------------------------------------

const GOBLIN_SKIN = '#86c34f';
const ORC_SKIN = '#5f8f3c';

const humanoid = (look: Omit<HumanoidLook, 'kind' | 'labelHeight'> & { labelHeight?: number }): HumanoidLook => ({
  kind: 'humanoid',
  labelHeight: 1.5 * (look.scale / 0.44) + (look.mount ? (look.mount.beast?.variant === 'bear' ? 0.6 : 0.42) : 0),
  ...look
});

const creature = (look: Omit<CreatureLook, 'kind'>): CreatureLook => ({ kind: 'creature', ...look });

const LOOKS: Record<TroopId, UnitLook> = {
  // --- Kingdom ---
  infantry: humanoid({ model: 'knight', scale: 0.44, weapons: ['1H_Sword', 'Round_Shield'], animations: SWORD }),
  artillery: humanoid({ model: 'ranger', scale: 0.42, weapons: ['2H_Crossbow'], animations: CROSSBOW, projectile: 'arrow' }),
  tank: humanoid({ model: 'barbarian', scale: 0.47, weapons: ['Barbarian_Round_Shield'], pike: true, animations: STAB }),
  rogue: humanoid({ model: 'rogue', scale: 0.41, weapons: ['Knife', 'Knife_Offhand'], animations: DUAL }),
  helicopter: humanoid({ model: 'knight', scale: 0.41, weapons: ['1H_Sword', 'Badge_Shield'], mount: {}, animations: { ...SWORD, walk: 'Idle' } }),
  medic: humanoid({ model: 'mage', scale: 0.43, weapons: ['2H_Staff'], animations: SPELL, projectile: 'magic' }),
  // Engineers: woodsmen with an axe and a work apron
  engineer: humanoid({
    model: 'barbarian', scale: 0.45, weapons: ['1H_Axe', 'Badge_Shield'], animations: CHOP, hide: ['Barbarian_Hat'],
    palette: { cloth: '#c2410c', leather: '#7c4a2a' }
  }),
  shieldbearer: humanoid({
    model: 'knight', scale: 0.46, weapons: ['1H_Sword', 'Rectangle_Shield'], animations: { ...STAB, idle: 'Blocking' },
    palette: { metal: '#9aa7b4' }
  }),
  berserker: humanoid({
    model: 'barbarian', scale: 0.46, weapons: ['1H_Axe', '1H_Axe_Offhand'], animations: DUAL, hide: ['Barbarian_Hat'],
    palette: { cloth: '#7c4a2a' }
  }),
  longbow: humanoid({ model: 'rogue', scale: 0.43, weapons: ['2H_Crossbow'], animations: CROSSBOW, projectile: 'arrow', palette: { cloth: '#2f7a3b' } }),
  cleric: humanoid({
    model: 'knight', scale: 0.45, weapons: ['1H_Sword', 'Spike_Shield'], animations: CHOP,
    palette: { metal: '#f1e7c8', cloth: '#e8c25a' }
  }),
  sapper: humanoid({ model: 'rogue', scale: 0.42, weapons: ['Throwable'], animations: THROW, palette: { cloth: '#6b4b2e' } }),
  pegasus: humanoid({
    model: 'knight', scale: 0.41, weapons: ['1H_Sword', 'Round_Shield'], animations: { ...SWORD, walk: 'Idle' },
    mount: { tint: '#f8fafc', wings: true }, palette: { metal: '#e2e8f0' }
  }),
  archmage: humanoid({
    model: 'mage', scale: 0.47, weapons: ['2H_Staff', 'Spellbook_open'], animations: SPELL, projectile: 'magic',
    palette: { cloth: '#3b2a7a' }
  }),
  // Evolved forms: built from the same packs' parts no other troop carries
  warden: humanoid({
    model: 'knight', scale: 0.5, weapons: ['1H_Sword', 'Rectangle_Shield'], animations: { ...STAB, idle: 'Blocking' },
    palette: { metal: '#64748b', cloth: '#1e3a5f' }
  }),
  warlord: humanoid({
    model: 'barbarian', scale: 0.52, weapons: ['2H_Axe'], animations: GREAT,
    palette: { cloth: '#7f1d1d', leather: '#3f2a1a' }
  }),
  crossbow: humanoid({
    model: 'ranger', scale: 0.45, weapons: ['2H_Crossbow'], animations: CROSSBOW, projectile: 'arrow',
    palette: { cloth: '#57534e', leather: '#3b2a1a', metal: '#4b5563' }
  }),
  halberdier: humanoid({
    model: 'knight', scale: 0.46, weapons: [], pike: true, animations: STAB,
    palette: { metal: '#cbd5e1', cloth: '#b45309' }
  }),
  wolf_rider: humanoid({
    model: 'rogue', scale: 0.4, weapons: ['Knife', 'Knife_Offhand'], animations: { ...DUAL, walk: 'Idle' },
    mount: { beast: { variant: 'wolf', scale: 1.5, colors: { primary: '#6b7280', secondary: '#d1d5db', accent: '#facc15' } } },
    palette: { cloth: '#44403c' }
  }),
  siege_engineer: humanoid({
    model: 'barbarian', scale: 0.47, weapons: ['2H_Axe'], animations: GREAT, hide: ['Barbarian_Hat'],
    palette: { cloth: '#b45309', leather: '#5a3a1a' }
  }),
  bear_warden: humanoid({
    model: 'barbarian', scale: 0.42, weapons: ['1H_Axe', 'Barbarian_Round_Shield'], animations: { ...CHOP, walk: 'Idle' },
    mount: { beast: { variant: 'bear', scale: 1.25, colors: { primary: '#5b3a1e', secondary: '#8a5a32', accent: '#1f1308' } } },
    palette: { cloth: '#9a3412', leather: '#4a2e1a' }
  }),

  // --- Bandits ---
  bandit_thug: humanoid({ model: 'barbarian', scale: 0.45, weapons: ['1H_Axe'], animations: CHOP, palette: { cloth: '#8a6a45', metal: '#9a948c' } }),
  bandit_archer: humanoid({ model: 'ranger', scale: 0.42, weapons: ['1H_Crossbow'], animations: HAND_CROSSBOW, projectile: 'arrow', palette: { cloth: '#6b5a2e' } }),
  highwayman: humanoid({ model: 'rogue', scale: 0.42, weapons: ['Knife', 'Knife_Offhand'], animations: DUAL, palette: { cloth: '#3a2a2a' } }),
  bandit_raider: humanoid({
    model: 'knight', scale: 0.41, weapons: ['1H_Sword'], animations: { ...SWORD, walk: 'Idle' },
    mount: { tint: '#6b4a32' }, palette: { metal: '#5b5048', cloth: '#7a5a3a' }
  }),
  bandit_king: humanoid({ model: 'barbarian', scale: 0.62, weapons: ['2H_Axe'], animations: GREAT, palette: { cloth: '#b91c1c', metal: '#d4a72c' } }),

  // --- Goblins ---
  goblin_scrapper: humanoid({ model: 'rogue', scale: 0.33, weapons: ['Knife'], animations: { ...SWORD, walk: 'Running_A' }, palette: { skin: GOBLIN_SKIN, cloth: '#7a5c3a' } }),
  goblin_slinger: humanoid({ model: 'ranger', scale: 0.33, weapons: ['Throwable'], animations: THROW, projectile: 'rock', palette: { skin: GOBLIN_SKIN, cloth: '#6b6b3a' } }),
  goblin_shaman: humanoid({ model: 'mage', scale: 0.34, weapons: ['1H_Wand'], animations: SPELL, projectile: 'magic', palette: { skin: GOBLIN_SKIN, cloth: '#7a5aa0' } }),
  goblin_sapper: humanoid({ model: 'rogue', scale: 0.33, weapons: ['Throwable'], animations: THROW, palette: { skin: GOBLIN_SKIN, cloth: '#5a4a3a' } }),
  goblin_warchief: humanoid({ model: 'barbarian', scale: 0.56, weapons: ['2H_Axe'], animations: GREAT, palette: { skin: GOBLIN_SKIN, cloth: '#5a3a1a', metal: '#7a6a5a' } }),

  // --- Beasts ---
  grey_wolf: creature({ body: 'quadruped', variant: 'wolf', scale: 1.15, colors: { primary: '#8a9099', secondary: '#c9ced4', accent: '#facc15' }, labelHeight: 1.05 }),
  wild_boar: creature({ body: 'quadruped', variant: 'boar', scale: 0.9, colors: { primary: '#7a5238', secondary: '#4a3020', accent: '#f5f0e0' }, labelHeight: 1.0 }),
  giant_spider: creature({ body: 'spider', scale: 0.95, colors: { primary: '#3b2f4a', secondary: '#6b3a6b', accent: '#ef4444' }, labelHeight: 0.95 }),
  cave_bear: creature({ body: 'quadruped', variant: 'bear', scale: 1.05, colors: { primary: '#6b4423', secondary: '#a0754a', accent: '#1f1308' }, labelHeight: 1.4 }),
  alpha_direwolf: creature({ body: 'quadruped', variant: 'wolf', scale: 1.6, colors: { primary: '#2f3238', secondary: '#5b6068', accent: '#fde047', glow: '#fde047' }, labelHeight: 1.75 }),

  // --- Swamp ---
  bog_slime: creature({ body: 'slime', scale: 0.85, colors: { primary: '#6fbf4a', secondary: '#3f8a2a', accent: '#1a2e05' }, labelHeight: 0.95 }),
  lizardman: humanoid({ model: 'barbarian', scale: 0.46, weapons: [], pike: true, hide: ['Barbarian_Hat'], animations: STAB, palette: { skin: '#3f9a6e', cloth: '#2e5a3a', leather: '#4a5a2a' } }),
  toxic_toad: creature({ body: 'frog', scale: 0.9, colors: { primary: '#a3c22a', secondary: '#6b2a8a', accent: '#fde047' }, labelHeight: 0.9, projectile: 'spit' }),
  swamp_witch: humanoid({ model: 'mage', scale: 0.43, weapons: ['2H_Staff'], animations: SPELL, projectile: 'magic', palette: { skin: '#a8c47e', cloth: '#3d2a55' } }),
  bog_hydra: creature({ body: 'hydra', scale: 1.5, colors: { primary: '#2f7a62', secondary: '#9ad1a8', accent: '#facc15', glow: '#bef264' }, labelHeight: 1.9 }),

  // --- Desert ---
  giant_scorpion: creature({ body: 'scorpion', scale: 0.95, colors: { primary: '#d08a3a', secondary: '#8a4a1a', accent: '#1f1308' }, labelHeight: 1.0 }),
  sand_raider: humanoid({ model: 'ranger', scale: 0.42, weapons: ['Knife', 'Knife_Offhand'], animations: DUAL, palette: { cloth: '#d6b477', skin: '#c8915e' } }),
  mummy: humanoid({ model: 'skeleton_minion', scale: 0.44, weapons: [], animations: SHAMBLE, palette: { bone: '#efe3c4', cloth: '#cdb994', glow: '#84cc16' } }),
  sand_golem: creature({ body: 'golem', variant: 'sand', scale: 1.05, colors: { primary: '#d9b46a', secondary: '#b08a4a', accent: '#38bdf8', glow: '#38bdf8' }, labelHeight: 1.55 }),
  pharaoh: humanoid({ model: 'skeleton_mage', scale: 0.6, weapons: ['Skeleton_Staff'], animations: BONE_SPELL, projectile: 'magic', palette: { cloth: '#1d4ed8', bone: '#f4e3b0', glow: '#facc15' } }),

  // --- Frost ---
  snow_wolf: creature({ body: 'quadruped', variant: 'wolf', scale: 1.15, colors: { primary: '#eef4fb', secondary: '#c7d7e8', accent: '#38bdf8' }, labelHeight: 1.05 }),
  ice_wraith: creature({ body: 'wisp', variant: 'ice', scale: 0.95, colors: { primary: '#bae6fd', secondary: '#7dd3fc', accent: '#e0f2fe', glow: '#38bdf8' }, labelHeight: 1.35 }),
  yeti: humanoid({ model: 'barbarian', scale: 0.58, weapons: [], hide: ['Barbarian_Hat'], animations: BRAWL, palette: { skin: '#dfe9f5', cloth: '#f1f5f9', leather: '#b8c7d9' } }),
  frost_huntress: humanoid({ model: 'ranger', scale: 0.42, weapons: ['2H_Crossbow'], animations: CROSSBOW, projectile: 'frost', palette: { cloth: '#5fb4e0' } }),
  frost_giant: humanoid({ model: 'barbarian', scale: 0.7, weapons: ['2H_Axe'], animations: GREAT, palette: { skin: '#9fc8ec', cloth: '#1e3a6a', metal: '#cfe8ff' } }),

  // --- Undead ---
  skeleton_minion: humanoid({ model: 'skeleton_minion', scale: 0.43, weapons: ['Skeleton_Blade'], animations: BONE_SWORD }),
  skeleton_warrior: humanoid({ model: 'skeleton_warrior', scale: 0.45, weapons: ['Skeleton_Axe', 'Skeleton_Shield_Large_A'], animations: BONE_CHOP }),
  skeleton_archer: humanoid({ model: 'skeleton_rogue', scale: 0.43, weapons: ['Skeleton_Crossbow'], animations: BONE_CROSSBOW, projectile: 'arrow' }),
  ghost: creature({ body: 'wisp', variant: 'ghost', scale: 0.95, colors: { primary: '#d9f99d', secondary: '#a3e635', accent: '#1a2e05', glow: '#bef264' }, labelHeight: 1.35 }),
  lich_king: humanoid({ model: 'skeleton_mage', scale: 0.62, weapons: ['Skeleton_Staff'], animations: BONE_SPELL, projectile: 'magic', palette: { cloth: '#4c1d95', glow: '#c084fc' } }),

  // --- Orcs ---
  orc_grunt: humanoid({ model: 'barbarian', scale: 0.5, weapons: ['1H_Axe', 'Barbarian_Round_Shield'], animations: CHOP, palette: { skin: ORC_SKIN, cloth: '#5a2a1a', metal: '#8a847a' } }),
  orc_archer: humanoid({ model: 'ranger', scale: 0.47, weapons: ['2H_Crossbow'], animations: CROSSBOW, projectile: 'arrow', palette: { skin: ORC_SKIN, cloth: '#4a3a2a' } }),
  orc_shaman: humanoid({ model: 'mage', scale: 0.47, weapons: ['2H_Staff'], animations: SPELL, projectile: 'fire', palette: { skin: ORC_SKIN, cloth: '#8a2a1a' } }),
  ogre: humanoid({ model: 'barbarian', scale: 0.66, weapons: ['2H_Axe'], hide: ['Barbarian_Hat'], animations: GREAT, palette: { skin: '#b7a27c', cloth: '#5a4a3a' } }),
  orc_warlord: humanoid({ model: 'knight', scale: 0.62, weapons: ['2H_Sword'], animations: GREAT, palette: { skin: ORC_SKIN, metal: '#2a2a2e', cloth: '#7f1d1d' } }),

  // --- Infernal ---
  imp: creature({ body: 'imp', scale: 0.8, colors: { primary: '#dc2626', secondary: '#7f1d1d', accent: '#fde047', glow: '#f97316' }, labelHeight: 1.15 }),
  magma_golem: creature({ body: 'golem', variant: 'magma', scale: 1.05, colors: { primary: '#3a2a2a', secondary: '#1f1515', accent: '#f97316', glow: '#f97316' }, labelHeight: 1.55 }),
  fire_elemental: creature({ body: 'wisp', variant: 'fire', scale: 1.0, colors: { primary: '#f97316', secondary: '#facc15', accent: '#fff7ed', glow: '#f97316' }, labelHeight: 1.4, projectile: 'fire' }),
  hellhound: creature({ body: 'quadruped', variant: 'wolf', scale: 1.2, colors: { primary: '#3a1414', secondary: '#7f1d1d', accent: '#f97316', glow: '#f97316' }, labelHeight: 1.1 }),
  demon_lord: humanoid({
    model: 'barbarian', scale: 0.7, weapons: ['2H_Axe'], hide: ['Barbarian_Hat'], animations: GREAT,
    palette: { skin: '#c2302a', cloth: '#1c1917', metal: '#3a3a3a' }, wings: '#3b0d0d', horns: '#f5e6c8'
  }),

  // --- Dragons ---
  dragon_cultist: humanoid({ model: 'mage', scale: 0.43, weapons: ['1H_Wand'], animations: SPELL, projectile: 'fire', palette: { cloth: '#7f1d1d' } }),
  wyvern: creature({ body: 'dragon', variant: 'wyvern', scale: 1.0, colors: { primary: '#4d7c0f', secondary: '#a3e635', accent: '#fde047' }, labelHeight: 1.4 }),
  drake: creature({ body: 'dragon', variant: 'drake', scale: 1.0, colors: { primary: '#b91c1c', secondary: '#fca5a5', accent: '#fde047', glow: '#f97316' }, labelHeight: 1.3 }),
  dragon_knight: humanoid({
    model: 'knight', scale: 0.42, weapons: ['1H_Sword', 'Spike_Shield'], animations: { ...SWORD, walk: 'Idle' },
    mount: { tint: '#2a1f1f' }, palette: { metal: '#2a2228', cloth: '#9f1239' }
  }),
  elder_dragon: creature({ body: 'dragon', variant: 'elder', scale: 1.75, colors: { primary: '#9f1239', secondary: '#fbbf24', accent: '#fde68a', glow: '#f97316' }, labelHeight: 2.3 })
};

// Team colour for each side (capes, shields, hats)
export const TEAM_COLORS: Record<PlayerType, string> = {
  player: '#2f6fe4',
  ai: '#d93a3a'
};

export const getUnitLook = (unitType: TroopId): UnitLook => LOOKS[unitType] ?? LOOKS.infantry;

// Seconds between strikes in battle - each troop type fights at its own pace
export const getAttackInterval = (unitType: TroopId): number => TROOPS[unitType]?.attackInterval ?? 1;

// Name of the animation clip to play for a humanoid doing something
export const getAnimationName = (unitType: TroopId, state: AnimationState): string => {
  const look = getUnitLook(unitType);
  return look.kind === 'humanoid' ? look.animations[state] : 'Idle';
};

export const getProjectile = (unitType: TroopId): Projectile => getUnitLook(unitType).projectile ?? 'arrow';

// Model files a set of troops needs, so a battle only downloads what it uses
export const modelsFor = (types: TroopId[]): string[] => {
  const urls = new Set<string>([ANIMATION_PACK_URL]);
  for (const type of types) {
    const look = getUnitLook(type);
    if (look.kind !== 'humanoid') continue;
    urls.add(MODEL_URLS[look.model]);
    // (beasts are built from primitives; only horses have a model)
    if (look.mount && !look.mount.beast) urls.add(HORSE_MODEL);
  }
  return [...urls];
};
