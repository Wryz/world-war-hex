import type { Ability, TroopStats } from '@/types/game';

// Every troop in the game: the player's cards (the Kingdom) and the fifty monsters met across the
// campaign, five per enemy faction (four that the enemy recruits and one boss).
// Base stats are for a level 1 card; campaign levels scale monsters up as the map gets harder.

export const TROOP_IDS = [
  // Kingdom - the player's cards (the first six ids predate the card system and are kept for saves)
  'infantry', 'artillery', 'tank', 'rogue', 'helicopter', 'medic',
  'shieldbearer', 'berserker', 'longbow', 'cleric', 'sapper', 'pegasus', 'archmage',
  // Bandits
  'bandit_thug', 'bandit_archer', 'highwayman', 'bandit_raider', 'bandit_king',
  // Goblins
  'goblin_scrapper', 'goblin_slinger', 'goblin_shaman', 'goblin_sapper', 'goblin_warchief',
  // Beasts
  'grey_wolf', 'wild_boar', 'giant_spider', 'cave_bear', 'alpha_direwolf',
  // Swamp
  'bog_slime', 'lizardman', 'toxic_toad', 'swamp_witch', 'bog_hydra',
  // Desert
  'giant_scorpion', 'sand_raider', 'mummy', 'sand_golem', 'pharaoh',
  // Frost
  'snow_wolf', 'ice_wraith', 'yeti', 'frost_huntress', 'frost_giant',
  // Undead
  'skeleton_minion', 'skeleton_warrior', 'skeleton_archer', 'ghost', 'lich_king',
  // Orcs
  'orc_grunt', 'orc_archer', 'orc_shaman', 'ogre', 'orc_warlord',
  // Infernal
  'imp', 'magma_golem', 'fire_elemental', 'hellhound', 'demon_lord',
  // Dragons
  'dragon_cultist', 'wyvern', 'drake', 'dragon_knight', 'elder_dragon'
] as const;

export type TroopId = (typeof TROOP_IDS)[number];

export type Faction =
  | 'kingdom' | 'bandits' | 'goblins' | 'beasts' | 'swamp' | 'desert'
  | 'frost' | 'undead' | 'orcs' | 'infernal' | 'dragons';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'boss';

// What a troop fights like, for counters: each class hits some others extra hard (see COUNTERS)
export type TroopClass = 'infantry' | 'spear' | 'cavalry' | 'ranged' | 'magic' | 'skirmisher' | 'brute';

export interface TroopDef {
  id: TroopId;
  name: string;
  faction: Faction;
  rarity: Rarity;
  troopClass: TroopClass;
  // Gold to recruit in battle
  cost: number;
  attack: number;
  health: number;
  move: number;
  abilities: Ability[];
  // One-line role shown on the card
  role: string;
  // Bestiary entry
  lore: string;
  // Seconds between strikes in battle animations
  attackInterval: number;
  isBoss?: boolean;
}

export interface FactionInfo {
  name: string;
  // Card frame and banner colour
  color: string;
  // What the enemy is called in battle ("The Goblins")
  title: string;
  description: string;
}

export const FACTIONS: Record<Faction, FactionInfo> = {
  kingdom: { name: 'Kingdom', color: '#3b82f6', title: 'The Kingdom', description: 'Your loyal army.' },
  bandits: { name: 'Bandits', color: '#a16207', title: 'The Bandit Gang', description: 'Cutthroats who rule the roads of Greenvale.' },
  goblins: { name: 'Goblins', color: '#65a30d', title: 'The Goblin Horde', description: 'Small, quick and far too many of them.' },
  beasts: { name: 'Beasts', color: '#78716c', title: 'The Wild Pack', description: 'The hungry creatures of the Howling Hills.' },
  swamp: { name: 'Swamp Folk', color: '#0f766e', title: 'The Mire', description: 'Things that lurk beneath the fen.' },
  desert: { name: 'Sand Court', color: '#d97706', title: 'The Sand Court', description: 'Ancient guardians of the buried kings.' },
  frost: { name: 'Frostborn', color: '#38bdf8', title: 'The Frostborn', description: 'Giants and spirits of the frozen pass.' },
  undead: { name: 'Undead', color: '#a78bfa', title: 'The Restless Dead', description: 'The dead of Gravemoor do not rest.' },
  orcs: { name: 'Orcs', color: '#4d7c0f', title: 'The Iron Horde', description: 'Brutal warbands of the Ironfang Badlands.' },
  infernal: { name: 'Infernal', color: '#dc2626', title: 'The Infernal Legion', description: 'Demons pouring from the Emberforge.' },
  dragons: { name: 'Dragonkin', color: '#be123c', title: 'The Dragonkin', description: 'The ancient dragon and its fanatical brood.' }
};

const troop = (def: TroopDef) => def;

export const TROOPS: Record<TroopId, TroopDef> = {
  // --- Kingdom ---------------------------------------------------------------------------
  infantry: troop({
    id: 'infantry', name: 'Swordsmen', faction: 'kingdom', rarity: 'common', troopClass: 'infantry', cost: 10, attack: 4, health: 10, move: 2,
    abilities: [], role: 'Cheap all-rounder', attackInterval: 0.9,
    lore: 'The backbone of every royal army: a sword, a shield and a stubborn refusal to retreat.'
  }),
  artillery: troop({
    id: 'artillery', name: 'Archers', faction: 'kingdom', rarity: 'common', troopClass: 'ranged', cost: 20, attack: 10, health: 6, move: 1,
    abilities: ['rangedAttack'], role: 'Hits hard from 2 hexes', attackInterval: 1.6,
    lore: 'Crossbow volleys from behind the line. Keep them out of reach of blades.'
  }),
  tank: troop({
    id: 'tank', name: 'Pikemen', faction: 'kingdom', rarity: 'common', troopClass: 'spear', cost: 24, attack: 8, health: 16, move: 3,
    abilities: ['terrainBonus'], role: 'Tough, strong in forest', attackInterval: 1.3,
    lore: 'A wall of long pikes. In the woods they strike from cover with terrible force.'
  }),
  rogue: troop({
    id: 'rogue', name: 'Rogues', faction: 'kingdom', rarity: 'common', troopClass: 'skirmisher', cost: 18, attack: 6, health: 6, move: 4,
    abilities: ['stealth'], role: 'Sneak attacks, no strike-back', attackInterval: 0.6,
    lore: 'They strike from the shadows and are gone before anyone can swing back.'
  }),
  helicopter: troop({
    id: 'helicopter', name: 'Knights', faction: 'kingdom', rarity: 'rare', troopClass: 'cavalry', cost: 26, attack: 8, health: 10, move: 5,
    abilities: ['rapidMovement'], role: 'Fast mounted cavalry', attackInterval: 0.7,
    lore: 'Mounted knights who reach camps and gold mines long before anyone else.'
  }),
  medic: troop({
    id: 'medic', name: 'Mages', faction: 'kingdom', rarity: 'rare', troopClass: 'magic', cost: 20, attack: 6, health: 8, move: 2,
    abilities: ['rangedAttack', 'healing', 'magic'], role: 'Ranged spells, heals allies', attackInterval: 1.4,
    lore: 'Battle mages hurl bolts from afar and mend the wounds of the soldiers beside them.'
  }),
  shieldbearer: troop({
    id: 'shieldbearer', name: 'Shieldbearers', faction: 'kingdom', rarity: 'rare', troopClass: 'infantry', cost: 22, attack: 4, health: 20, move: 2,
    abilities: ['armored'], role: 'Armored wall, takes less damage', attackInterval: 1.1,
    lore: 'Behind their tower shields, arrows and claws alike glance away.'
  }),
  berserker: troop({
    id: 'berserker', name: 'Berserkers', faction: 'kingdom', rarity: 'rare', troopClass: 'brute', cost: 26, attack: 10, health: 12, move: 3,
    abilities: ['berserk'], role: 'Rages harder when wounded', attackInterval: 0.75,
    lore: 'Northmen who fight harder the more they bleed.'
  }),
  longbow: troop({
    id: 'longbow', name: 'Longbowmen', faction: 'kingdom', rarity: 'epic', troopClass: 'ranged', cost: 28, attack: 12, health: 8, move: 2,
    abilities: ['rangedAttack', 'longRange'], role: 'Shoots from 3 hexes', attackInterval: 1.5,
    lore: 'Their great bows outrange anything on the field.'
  }),
  cleric: troop({
    id: 'cleric', name: 'War Clerics', faction: 'kingdom', rarity: 'epic', troopClass: 'infantry', cost: 28, attack: 8, health: 18, move: 2,
    abilities: ['healing', 'armored'], role: 'Armored healer of the front line', attackInterval: 1.2,
    lore: 'Plate, mace and prayer: they hold the line and keep it standing.'
  }),
  sapper: troop({
    id: 'sapper', name: 'Siege Sappers', faction: 'kingdom', rarity: 'epic', troopClass: 'skirmisher', cost: 24, attack: 10, health: 10, move: 3,
    abilities: ['siege', 'stealth'], role: 'Double damage to castles', attackInterval: 0.9,
    lore: 'Powder kegs and bad intentions. Castle walls fear them most.'
  }),
  pegasus: troop({
    id: 'pegasus', name: 'Pegasus Knights', faction: 'kingdom', rarity: 'legendary', troopClass: 'cavalry', cost: 36, attack: 12, health: 18, move: 5,
    abilities: ['flying'], role: 'Flies over water and mountains', attackInterval: 0.7,
    lore: 'Riders on winged steeds who strike wherever the enemy is weakest.'
  }),
  archmage: troop({
    id: 'archmage', name: 'Archmage', faction: 'kingdom', rarity: 'legendary', troopClass: 'magic', cost: 36, attack: 12, health: 14, move: 2,
    abilities: ['rangedAttack', 'longRange', 'healing', 'magic'], role: 'Long-range spells, heals allies', attackInterval: 1.4,
    lore: 'The greatest wizard of the realm, wielding storms from three hexes away.'
  }),

  // --- Bandits (Greenvale Meadows) ------------------------------------------------------
  bandit_thug: troop({
    id: 'bandit_thug', name: 'Bandit Thug', faction: 'bandits', rarity: 'common', troopClass: 'infantry', cost: 10, attack: 4, health: 10, move: 2,
    abilities: [], role: 'Club-swinging brawler', attackInterval: 1.0,
    lore: 'Hired muscle with a heavy axe and light morals.'
  }),
  bandit_archer: troop({
    id: 'bandit_archer', name: 'Bandit Archer', faction: 'bandits', rarity: 'common', troopClass: 'ranged', cost: 18, attack: 8, health: 6, move: 2,
    abilities: ['rangedAttack'], role: 'Shoots from 2 hexes', attackInterval: 1.6,
    lore: 'Poachers turned highway robbers. They never miss a fat purse.'
  }),
  highwayman: troop({
    id: 'highwayman', name: 'Highwayman', faction: 'bandits', rarity: 'rare', troopClass: 'skirmisher', cost: 20, attack: 6, health: 8, move: 4,
    abilities: ['stealth'], role: 'Ambushes, no strike-back', attackInterval: 0.6,
    lore: '"Stand and deliver!" By the time you turn around, he is gone.'
  }),
  bandit_raider: troop({
    id: 'bandit_raider', name: 'Mounted Raider', faction: 'bandits', rarity: 'rare', troopClass: 'cavalry', cost: 28, attack: 6, health: 10, move: 5,
    abilities: [], role: 'Fast horse raider', attackInterval: 0.75,
    lore: 'Raiders on stolen horses who strike farms, camps and careless armies.'
  }),
  bandit_king: troop({
    id: 'bandit_king', name: 'Redcap Rufus, Bandit King', faction: 'bandits', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 10, health: 52, move: 2,
    abilities: ['armored', 'berserk'], role: 'Boss: armored brute', attackInterval: 1.0, isBoss: true,
    lore: 'The self-crowned king of Greenvale. His red cap is dyed in a way you would rather not know.'
  }),

  // --- Goblins (Goblin Woods) -----------------------------------------------------------
  goblin_scrapper: troop({
    id: 'goblin_scrapper', name: 'Goblin Scrapper', faction: 'goblins', rarity: 'common', troopClass: 'infantry', cost: 8, attack: 4, health: 8, move: 3,
    abilities: [], role: 'Cheap and quick', attackInterval: 0.6,
    lore: 'Knee-high, all teeth and rusty knives. Where there is one, there are ten.'
  }),
  goblin_slinger: troop({
    id: 'goblin_slinger', name: 'Goblin Slinger', faction: 'goblins', rarity: 'common', troopClass: 'ranged', cost: 12, attack: 6, health: 4, move: 2,
    abilities: ['rangedAttack'], role: 'Flings rocks from 2 hexes', attackInterval: 1.2,
    lore: 'Throws anything that is not nailed down, and some things that are.'
  }),
  goblin_shaman: troop({
    id: 'goblin_shaman', name: 'Goblin Shaman', faction: 'goblins', rarity: 'rare', troopClass: 'magic', cost: 18, attack: 4, health: 6, move: 2,
    abilities: ['rangedAttack', 'healing', 'magic'], role: 'Hexes foes, heals goblins', attackInterval: 1.4,
    lore: 'Mutters smelly curses that somehow patch up its friends.'
  }),
  goblin_sapper: troop({
    id: 'goblin_sapper', name: 'Goblin Sapper', faction: 'goblins', rarity: 'rare', troopClass: 'skirmisher', cost: 16, attack: 8, health: 6, move: 3,
    abilities: ['siege'], role: 'Blows up castle walls', attackInterval: 0.9,
    lore: 'Carries a lit bomb at all times. Life expectancy: short.'
  }),
  goblin_warchief: troop({
    id: 'goblin_warchief', name: 'Grubnak the Warchief', faction: 'goblins', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 10, health: 56, move: 3,
    abilities: ['berserk', 'regenerate'], role: 'Boss: regenerating brute', attackInterval: 0.8, isBoss: true,
    lore: 'The biggest goblin anyone has ever seen. Nobody dares tell him he is probably part troll.'
  }),

  // --- Beasts (Howling Hills) -----------------------------------------------------------
  grey_wolf: troop({
    id: 'grey_wolf', name: 'Grey Wolf', faction: 'beasts', rarity: 'common', troopClass: 'cavalry', cost: 14, attack: 6, health: 8, move: 4,
    abilities: [], role: 'Fast pack hunter', attackInterval: 0.6,
    lore: 'Hunts in packs and always circles to the weakest.'
  }),
  wild_boar: troop({
    id: 'wild_boar', name: 'Wild Boar', faction: 'beasts', rarity: 'common', troopClass: 'cavalry', cost: 16, attack: 6, health: 12, move: 3,
    abilities: ['armored'], role: 'Thick-hided charger', attackInterval: 0.9,
    lore: 'Bristles like iron wire and a temper to match.'
  }),
  giant_spider: troop({
    id: 'giant_spider', name: 'Giant Spider', faction: 'beasts', rarity: 'rare', troopClass: 'skirmisher', cost: 18, attack: 6, health: 8, move: 3,
    abilities: ['stealth', 'pathfinder'], role: 'Ambush predator', attackInterval: 0.7,
    lore: 'It drops from the canopy without a sound. Nobody sees the second strike either.'
  }),
  cave_bear: troop({
    id: 'cave_bear', name: 'Cave Bear', faction: 'beasts', rarity: 'rare', troopClass: 'brute', cost: 30, attack: 10, health: 20, move: 2,
    abilities: ['berserk'], role: 'Huge, furious when hurt', attackInterval: 1.2,
    lore: 'Wake it up and it will not stop until everything nearby is quiet.'
  }),
  alpha_direwolf: troop({
    id: 'alpha_direwolf', name: 'Fenrak the Alpha', faction: 'beasts', rarity: 'boss', troopClass: 'cavalry', cost: 80, attack: 12, health: 56, move: 4,
    abilities: ['regenerate', 'berserk'], role: 'Boss: leader of the pack', attackInterval: 0.6, isBoss: true,
    lore: 'A direwolf the size of a cart, whose howl calls every beast in the hills.'
  }),

  // --- Swamp (Mirefen Marsh) ------------------------------------------------------------
  bog_slime: troop({
    id: 'bog_slime', name: 'Bog Slime', faction: 'swamp', rarity: 'common', troopClass: 'infantry', cost: 12, attack: 4, health: 12, move: 2,
    abilities: ['regenerate', 'pathfinder'], role: 'Squishy, regrows', attackInterval: 1.0,
    lore: 'Cut it in half and you just have two smaller problems.'
  }),
  lizardman: troop({
    id: 'lizardman', name: 'Lizardman Spear', faction: 'swamp', rarity: 'common', troopClass: 'spear', cost: 20, attack: 8, health: 12, move: 3,
    abilities: ['pathfinder'], role: 'Swamp-born spearman', attackInterval: 1.1,
    lore: 'Glides through the marsh as if it were dry land.'
  }),
  toxic_toad: troop({
    id: 'toxic_toad', name: 'Toxic Toad', faction: 'swamp', rarity: 'rare', troopClass: 'ranged', cost: 16, attack: 6, health: 8, move: 2,
    abilities: ['rangedAttack', 'pathfinder'], role: 'Spits venom from 2 hexes', attackInterval: 1.3,
    lore: 'Its spit can strip paint. And armour. And skin.'
  }),
  swamp_witch: troop({
    id: 'swamp_witch', name: 'Swamp Witch', faction: 'swamp', rarity: 'rare', troopClass: 'magic', cost: 22, attack: 4, health: 8, move: 2,
    abilities: ['rangedAttack', 'healing', 'pathfinder', 'magic'], role: 'Curses foes, heals allies', attackInterval: 1.4,
    lore: 'She brews in a cauldron the size of a pond. Do not ask what is in it.'
  }),
  bog_hydra: troop({
    id: 'bog_hydra', name: 'The Bog Hydra', faction: 'swamp', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 10, health: 48, move: 2,
    abilities: ['regenerate', 'pathfinder'], role: 'Boss: many heads, regrows', attackInterval: 0.9, isBoss: true,
    lore: 'Three heads, three appetites, and every one of them grows back.'
  }),

  // --- Desert (Sunscorch Desert) --------------------------------------------------------
  giant_scorpion: troop({
    id: 'giant_scorpion', name: 'Giant Scorpion', faction: 'desert', rarity: 'common', troopClass: 'spear', cost: 20, attack: 8, health: 10, move: 3,
    abilities: ['armored', 'pathfinder'], role: 'Armored stinger', attackInterval: 0.9,
    lore: 'Its shell turns spears and its tail does not miss.'
  }),
  sand_raider: troop({
    id: 'sand_raider', name: 'Sand Raider', faction: 'desert', rarity: 'common', troopClass: 'skirmisher', cost: 18, attack: 6, health: 8, move: 4,
    abilities: ['pathfinder', 'stealth'], role: 'Dune-runner ambusher', attackInterval: 0.6,
    lore: 'Rises out of the dunes, strikes, and is swallowed by the sand again.'
  }),
  mummy: troop({
    id: 'mummy', name: 'Mummy', faction: 'desert', rarity: 'rare', troopClass: 'infantry', cost: 20, attack: 6, health: 14, move: 2,
    abilities: ['undead', 'regenerate'], role: 'Shambling, hard to kill', attackInterval: 1.1,
    lore: 'Wrapped for eternity, and very cross about being woken.'
  }),
  sand_golem: troop({
    id: 'sand_golem', name: 'Sand Golem', faction: 'desert', rarity: 'rare', troopClass: 'brute', cost: 32, attack: 10, health: 24, move: 1,
    abilities: ['armored'], role: 'Slow sandstone colossus', attackInterval: 1.4,
    lore: 'A statue of the old kings, given one order: guard.'
  }),
  pharaoh: troop({
    id: 'pharaoh', name: 'Pharaoh Ankhamun', faction: 'desert', rarity: 'boss', troopClass: 'magic', cost: 80, attack: 12, health: 60, move: 2,
    abilities: ['rangedAttack', 'healing', 'undead', 'magic'], role: 'Boss: undying sorcerer-king', attackInterval: 1.3, isBoss: true,
    lore: 'The buried king rises with a golden staff and three thousand years of grudges.'
  }),

  // --- Frost (Frostpeak Pass) -----------------------------------------------------------
  snow_wolf: troop({
    id: 'snow_wolf', name: 'Snow Wolf', faction: 'frost', rarity: 'common', troopClass: 'cavalry', cost: 16, attack: 6, health: 8, move: 4,
    abilities: ['pathfinder'], role: 'Runs over snow and ice', attackInterval: 0.6,
    lore: 'White as the drifts it hides in.'
  }),
  ice_wraith: troop({
    id: 'ice_wraith', name: 'Ice Wraith', faction: 'frost', rarity: 'rare', troopClass: 'skirmisher', cost: 22, attack: 6, health: 6, move: 3,
    abilities: ['flying', 'stealth'], role: 'Flying, chilling strikes', attackInterval: 0.8,
    lore: 'A sigh of freezing wind with a grudge and a face.'
  }),
  yeti: troop({
    id: 'yeti', name: 'Yeti', faction: 'frost', rarity: 'rare', troopClass: 'brute', cost: 28, attack: 10, health: 18, move: 2,
    abilities: ['pathfinder', 'berserk'], role: 'Huge mountain brute', attackInterval: 1.1,
    lore: 'The footprints are real. So is the rest of it.'
  }),
  frost_huntress: troop({
    id: 'frost_huntress', name: 'Frost Huntress', faction: 'frost', rarity: 'common', troopClass: 'ranged', cost: 20, attack: 8, health: 6, move: 2,
    abilities: ['rangedAttack', 'pathfinder'], role: 'Icy arrows from 2 hexes', attackInterval: 1.5,
    lore: 'Her arrows are tipped with ice that never melts.'
  }),
  frost_giant: troop({
    id: 'frost_giant', name: 'Jarl Hrimgar the Frost Giant', faction: 'frost', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 14, health: 64, move: 2,
    abilities: ['armored', 'pathfinder'], role: 'Boss: armored giant', attackInterval: 1.3, isBoss: true,
    lore: 'A king of giants whose beard is a glacier and whose temper is an avalanche.'
  }),

  // --- Undead (Gravemoor) ---------------------------------------------------------------
  skeleton_minion: troop({
    id: 'skeleton_minion', name: 'Skeleton Minion', faction: 'undead', rarity: 'common', troopClass: 'infantry', cost: 8, attack: 4, health: 8, move: 2,
    abilities: ['undead'], role: 'Cheap bony soldier', attackInterval: 0.9,
    lore: 'Rattling bones with a rusty blade. There are always more.'
  }),
  skeleton_warrior: troop({
    id: 'skeleton_warrior', name: 'Skeleton Warrior', faction: 'undead', rarity: 'common', troopClass: 'infantry', cost: 20, attack: 6, health: 14, move: 2,
    abilities: ['undead', 'armored'], role: 'Shielded bone knight', attackInterval: 1.1,
    lore: 'Once a knight. Still a knight, technically.'
  }),
  skeleton_archer: troop({
    id: 'skeleton_archer', name: 'Skeleton Crossbowman', faction: 'undead', rarity: 'rare', troopClass: 'ranged', cost: 18, attack: 8, health: 6, move: 2,
    abilities: ['undead', 'rangedAttack'], role: 'Bone bolts from 2 hexes', attackInterval: 1.5,
    lore: 'Hollow eyes, steady hands.'
  }),
  ghost: troop({
    id: 'ghost', name: 'Wailing Ghost', faction: 'undead', rarity: 'rare', troopClass: 'skirmisher', cost: 22, attack: 6, health: 8, move: 4,
    abilities: ['undead', 'flying', 'stealth'], role: 'Flies, strikes unseen', attackInterval: 0.8,
    lore: 'You hear it long before it reaches you. It reaches you anyway.'
  }),
  lich_king: troop({
    id: 'lich_king', name: 'Morthul the Lich King', faction: 'undead', rarity: 'boss', troopClass: 'magic', cost: 80, attack: 12, health: 60, move: 2,
    abilities: ['undead', 'rangedAttack', 'healing', 'regenerate', 'magic'], role: 'Boss: undying necromancer', attackInterval: 1.3, isBoss: true,
    lore: 'He traded his heart for eternity and has regretted nothing since.'
  }),

  // --- Orcs (Ironfang Badlands) ---------------------------------------------------------
  orc_grunt: troop({
    id: 'orc_grunt', name: 'Orc Grunt', faction: 'orcs', rarity: 'common', troopClass: 'infantry', cost: 18, attack: 8, health: 14, move: 2,
    abilities: [], role: 'Heavy-hitting warrior', attackInterval: 1.0,
    lore: 'Big, green and very fond of axes.'
  }),
  orc_archer: troop({
    id: 'orc_archer', name: 'Orc Archer', faction: 'orcs', rarity: 'common', troopClass: 'ranged', cost: 22, attack: 10, health: 8, move: 2,
    abilities: ['rangedAttack'], role: 'Heavy bolts from 2 hexes', attackInterval: 1.5,
    lore: 'Fires bolts the size of fence posts.'
  }),
  orc_shaman: troop({
    id: 'orc_shaman', name: 'Orc Shaman', faction: 'orcs', rarity: 'rare', troopClass: 'magic', cost: 24, attack: 6, health: 10, move: 2,
    abilities: ['rangedAttack', 'healing', 'magic'], role: 'War magic, heals orcs', attackInterval: 1.4,
    lore: 'Speaks to the spirits of the badlands. They mostly say "smash".'
  }),
  ogre: troop({
    id: 'ogre', name: 'Ogre', faction: 'orcs', rarity: 'rare', troopClass: 'brute', cost: 36, attack: 14, health: 26, move: 2,
    abilities: ['berserk', 'siege'], role: 'Wall-smashing giant', attackInterval: 1.4,
    lore: 'Hired by the orcs for its one talent: knocking things down.'
  }),
  orc_warlord: troop({
    id: 'orc_warlord', name: 'Warlord Gorrash', faction: 'orcs', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 16, health: 72, move: 2,
    abilities: ['armored', 'berserk', 'siege'], role: 'Boss: siege-breaker', attackInterval: 1.0, isBoss: true,
    lore: 'He has torn down a hundred castles. Yours would make a hundred and one.'
  }),

  // --- Infernal (Emberforge Wastes) -----------------------------------------------------
  imp: troop({
    id: 'imp', name: 'Imp', faction: 'infernal', rarity: 'common', troopClass: 'skirmisher', cost: 14, attack: 6, health: 6, move: 4,
    abilities: ['flying', 'fireborn'], role: 'Flying firestarter', attackInterval: 0.6,
    lore: 'Cackling, winged and always on fire.'
  }),
  magma_golem: troop({
    id: 'magma_golem', name: 'Magma Golem', faction: 'infernal', rarity: 'rare', troopClass: 'brute', cost: 32, attack: 10, health: 24, move: 1,
    abilities: ['armored', 'fireborn'], role: 'Molten colossus', attackInterval: 1.4,
    lore: 'A walking volcano that cools for nobody.'
  }),
  fire_elemental: troop({
    id: 'fire_elemental', name: 'Fire Elemental', faction: 'infernal', rarity: 'rare', troopClass: 'magic', cost: 26, attack: 10, health: 10, move: 3,
    abilities: ['rangedAttack', 'fireborn', 'magic'], role: 'Hurls fire from 2 hexes', attackInterval: 1.2,
    lore: 'Living flame, bound by an unwise summoner.'
  }),
  hellhound: troop({
    id: 'hellhound', name: 'Hellhound', faction: 'infernal', rarity: 'common', troopClass: 'cavalry', cost: 24, attack: 8, health: 12, move: 4,
    abilities: ['fireborn', 'berserk'], role: 'Fast, furious when hurt', attackInterval: 0.6,
    lore: 'Its bark is bad. Its bite is on fire.'
  }),
  demon_lord: troop({
    id: 'demon_lord', name: 'Azgaroth the Demon Lord', faction: 'infernal', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 18, health: 76, move: 3,
    abilities: ['flying', 'fireborn', 'berserk'], role: 'Boss: winged destroyer', attackInterval: 0.9, isBoss: true,
    lore: 'Lord of the Emberforge, with wings of smoke and a crown of horns.'
  }),

  // --- Dragons (Dragonspire Peaks) ------------------------------------------------------
  dragon_cultist: troop({
    id: 'dragon_cultist', name: 'Dragon Cultist', faction: 'dragons', rarity: 'common', troopClass: 'magic', cost: 20, attack: 6, health: 10, move: 2,
    abilities: ['rangedAttack', 'healing', 'magic'], role: 'Fire spells, heals the brood', attackInterval: 1.4,
    lore: 'Fanatics who believe the dragon will spare them. It will not.'
  }),
  wyvern: troop({
    id: 'wyvern', name: 'Wyvern', faction: 'dragons', rarity: 'rare', troopClass: 'cavalry', cost: 28, attack: 8, health: 12, move: 5,
    abilities: ['flying'], role: 'Fast flying hunter', attackInterval: 0.7,
    lore: 'A lesser dragon, all wings and talons.'
  }),
  drake: troop({
    id: 'drake', name: 'Fire Drake', faction: 'dragons', rarity: 'rare', troopClass: 'brute', cost: 30, attack: 10, health: 18, move: 3,
    abilities: ['armored', 'fireborn'], role: 'Scaled fire-breather', attackInterval: 1.0,
    lore: 'Too young to fly, more than old enough to burn.'
  }),
  dragon_knight: troop({
    id: 'dragon_knight', name: 'Dragon Knight', faction: 'dragons', rarity: 'epic', troopClass: 'cavalry', cost: 32, attack: 10, health: 16, move: 4,
    abilities: ['armored'], role: 'Black-armoured cavalry', attackInterval: 0.8,
    lore: 'Fallen knights who swore their swords to the dragon.'
  }),
  elder_dragon: troop({
    id: 'elder_dragon', name: 'Vyrmathrax the Elder Dragon', faction: 'dragons', rarity: 'boss', troopClass: 'brute', cost: 80, attack: 20, health: 88, move: 3,
    abilities: ['flying', 'fireborn', 'armored', 'regenerate'], role: 'Final boss', attackInterval: 1.0, isBoss: true,
    lore: 'The oldest thing in the world, and the angriest. Defeat it and the realm is free.'
  })
};

export const PLAYER_CARD_IDS = TROOP_IDS.filter(id => TROOPS[id].faction === 'kingdom');
export const MOB_IDS = TROOP_IDS.filter(id => TROOPS[id].faction !== 'kingdom');

export const getTroop = (id: TroopId): TroopDef => TROOPS[id] ?? TROOPS.infantry;
export const isTroopId = (id: string): id is TroopId => (TROOP_IDS as readonly string[]).includes(id);

// --- Abilities -----------------------------------------------------------------------------

export interface AbilityInfo {
  name: string;
  description: string;
  // Extra power this ability is worth (see troopPower)
  power: number;
}

export const ABILITIES: Record<Ability, AbilityInfo> = {
  rangedAttack: { name: 'Ranged', description: 'Strikes from 2 hexes away (3 from hills).', power: 1.5 },
  longRange: { name: 'Long range', description: 'Reaches one hex further than other ranged troops.', power: 1 },
  healing: { name: 'Healer', description: 'Heals adjacent allies 4 health at the end of each turn.', power: 1.5 },
  terrainBonus: { name: 'Forest fighter', description: 'Attacks 50% harder from a forest.', power: 0.5 },
  rapidMovement: { name: 'Swift', description: 'Mounted: covers ground quickly.', power: 0 },
  stealth: { name: 'Sneak attack', description: 'Enemies it attacks can\'t strike back.', power: 1 },
  flying: { name: 'Flying', description: 'Flies over water and mountains; all ground costs 1 movement.', power: 1.2 },
  regenerate: { name: 'Regenerates', description: 'Heals 2 health at the end of each of its turns.', power: 1 },
  armored: { name: 'Armored', description: 'Takes 2 less damage in every fight.', power: 1.5 },
  siege: { name: 'Siege', description: 'Deals double damage to castles.', power: 0.8 },
  berserk: { name: 'Berserk', description: 'Attacks 50% harder at half health or less.', power: 0.8 },
  undead: { name: 'Undead', description: 'Cursed ground heals it instead of hurting it.', power: 0.3 },
  pathfinder: { name: 'Pathfinder', description: 'Desert, swamp, snow and ice cost only 1 movement.', power: 0.5 },
  fireborn: { name: 'Fireborn', description: 'Lava doesn\'t harm it.', power: 0.3 },
  magic: { name: 'Spells', description: 'Spells arc over obstacles and ignore cover.', power: 0.6 }
};

// --- Counters ------------------------------------------------------------------------------

export interface TroopClassInfo {
  name: string;
  // Plural, for "Strong vs Cavalry"
  plural: string;
}

export const TROOP_CLASSES: Record<TroopClass, TroopClassInfo> = {
  infantry: { name: 'Infantry', plural: 'Infantry' },
  spear: { name: 'Spear', plural: 'Spears' },
  cavalry: { name: 'Cavalry', plural: 'Cavalry' },
  ranged: { name: 'Ranged', plural: 'Ranged' },
  magic: { name: 'Caster', plural: 'Casters' },
  skirmisher: { name: 'Skirmisher', plural: 'Skirmishers' },
  brute: { name: 'Brute', plural: 'Brutes' }
};

// Damage multiplier when a troop fights one of the classes it is strong against. The cycle
// Spears > Cavalry > Ranged > Spears, with Infantry, Skirmishers and Brutes hunting their own prey,
// means no single army beats every other one.
export const COUNTERS: Record<TroopClass, Partial<Record<TroopClass, number>>> = {
  spear: { cavalry: 2, brute: 1.5 },        // Pikes brace against charges and big beasts
  cavalry: { ranged: 1.5, magic: 1.5 },     // Riders run down archers and casters
  ranged: { spear: 1.5, brute: 1.25 },      // Arrows pick off slow, heavy targets
  infantry: { spear: 1.5, skirmisher: 1.5 }, // Swords get inside pikes and catch skirmishers
  skirmisher: { ranged: 1.5, magic: 1.5 },  // Assassins go for the back line
  brute: { infantry: 1.5 },                 // Giants and beasts smash ordinary soldiers
  magic: {}
};

export const getTroopClass = (id: TroopId): TroopClass => getTroop(id).troopClass;

export const getClassCounter = (attacker: TroopClass, target: TroopClass): number => COUNTERS[attacker][target] ?? 1;

// Classes a troop class is strong and weak against
export const strongAgainst = (troopClass: TroopClass): TroopClass[] => Object.keys(COUNTERS[troopClass]) as TroopClass[];
export const weakAgainst = (troopClass: TroopClass): TroopClass[] =>
  (Object.keys(COUNTERS) as TroopClass[]).filter(other => COUNTERS[other][troopClass]);

// --- Levels and power ----------------------------------------------------------------------

export const MAX_CARD_LEVEL = 10;
// Each card level adds this share of the base attack and health
export const LEVEL_STAT_STEP = 0.1;

export const levelMultiplier = (level: number) => 1 + LEVEL_STAT_STEP * (Math.max(1, level) - 1);

// Stats a troop is recruited with at a given strength multiplier (card level or campaign scaling)
export const scaleTroop = (def: TroopDef, multiplier: number, level = 1): TroopStats => ({
  cost: def.cost,
  attackPower: Math.round(def.attack * multiplier * 10) / 10,
  maxLifespan: Math.max(1, Math.round(def.health * multiplier)),
  movementRange: def.move,
  abilities: [...def.abilities],
  level
});

export const cardStats = (id: TroopId, level: number): TroopStats =>
  scaleTroop(getTroop(id), levelMultiplier(level), level);

// A single number for how strong a troop is, used for army power and recommended power
export const statsPower = (stats: Pick<TroopStats, 'attackPower' | 'maxLifespan' | 'movementRange' | 'abilities'>): number =>
  Math.round(10 * (
    stats.attackPower * 0.6 +
    stats.maxLifespan * 0.225 +
    stats.movementRange * 0.35 +
    stats.abilities.reduce((sum, ability) => sum + ABILITIES[ability].power, 0) * (0.6 + stats.attackPower * 0.05)
  ));

export const cardPower = (id: TroopId, level: number) => statsPower(cardStats(id, level));
