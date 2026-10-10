import type { TerrainType } from '@/types/game';
import type { TroopId } from './troops';

// Materials: what an army carries home from a battlefield, to train and evolve its troops with.
// Everything comes from the field itself and what is done on it:
//
// - The land: a troop that ends a turn on a hex with something worth gathering (it glints) takes
//   it - timber in the woods, ore in the hills, reeds in the marsh. Each spot gives once.
// - Springs, gold mines and the blackened ground a fire leaves behind can be gathered the same way.
// - Deeds: felling a great tree yields heartwood.
// - Buildings: the first time a battle's building or camp is taken, it gives up its stores.
// - The fallen: every enemy troop destroyed leaves something of its kind behind, and each boss a
//   trophy.
// - Relics: on most battlefields something older than the war lies half-buried - a story site.
//   Hold it at the end of a turn to recover its region's relic (see lore.ts).
//
// A battle won brings the whole haul home; a battle lost, half of it; one given up, nothing.

export type MaterialRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type MaterialCategory = 'land' | 'deed' | 'building' | 'spoils' | 'trophy' | 'relic';

export interface MaterialDef {
  name: string;
  rarity: MaterialRarity;
  category: MaterialCategory;
  // Where it is found, in a few words
  source: string;
  // A line of flavour
  flavour: string;
}

export const MATERIALS = {
  // --- The land: gathered by ending a turn on a hex where it glints -----------------------------
  wild_herbs: { name: 'Wild Herbs', rarity: 'common', category: 'land', source: 'Open ground', flavour: 'Yarrow and feverfew, for binding wounds.' },
  wheat_sheaf: { name: 'Wheat Sheaf', rarity: 'common', category: 'land', source: 'Farmland', flavour: 'An army marches on its stomach.' },
  wool_tuft: { name: 'Wool Tuft', rarity: 'common', category: 'land', source: 'Open ground in the hills and meadows', flavour: 'Caught on a thornbush, from flocks long scattered.' },
  timber: { name: 'Timber', rarity: 'common', category: 'land', source: 'Woods', flavour: 'Straight, seasoned and ready for the axe.' },
  pine_resin: { name: 'Pine Resin', rarity: 'common', category: 'land', source: 'Pine woods of the hills and the north', flavour: 'Sticky, sweet-smelling, and it burns hot.' },
  glowcap: { name: 'Glowcap', rarity: 'uncommon', category: 'land', source: 'Dark woods and deep places', flavour: 'A mushroom that glows faintly blue. Goblins eat them raw.' },
  granite: { name: 'Granite', rarity: 'common', category: 'land', source: 'Hills', flavour: 'Good, honest stone.' },
  flint: { name: 'Flint', rarity: 'common', category: 'land', source: 'Hills of the wild country', flavour: 'Knapped to an edge, it cuts like steel.' },
  iron_ore: { name: 'Iron Ore', rarity: 'uncommon', category: 'land', source: 'Hills of the badlands and the deep', flavour: 'Rust-red seams in the rock.' },
  reeds: { name: 'Reeds', rarity: 'common', category: 'land', source: 'Marsh', flavour: 'Woven into mats, baskets and arrow shafts.' },
  bog_peat: { name: 'Bog Peat', rarity: 'common', category: 'land', source: 'Marsh', flavour: 'Cut in bricks and dried, it burns for days.' },
  lily_pad: { name: 'Lily Pad', rarity: 'uncommon', category: 'land', source: 'Marshes and swamps', flavour: 'The frogs will not miss one. Probably.' },
  sunstone: { name: 'Sunstone', rarity: 'uncommon', category: 'land', source: 'Desert', flavour: 'Holds the day\'s heat long after dark.' },
  desert_glass: { name: 'Desert Glass', rarity: 'uncommon', category: 'land', source: 'Desert and ruins in the sands', flavour: 'Sand fused into glass by lightning - or something worse.' },
  frost_salt: { name: 'Frost Salt', rarity: 'common', category: 'land', source: 'Snow', flavour: 'Keeps meat on the march and ice off the road.' },
  glacier_ice: { name: 'Glacier Ice', rarity: 'uncommon', category: 'land', source: 'Ice', flavour: 'Old ice. It does not melt in your hand.' },
  obsidian: { name: 'Obsidian', rarity: 'uncommon', category: 'land', source: 'The scorched ground of the Emberforge', flavour: 'Black glass, sharper than any blade.' },
  brimstone: { name: 'Brimstone', rarity: 'uncommon', category: 'land', source: 'The Emberforge and the deep', flavour: 'It smells exactly as bad as they say.' },
  grave_dust: { name: 'Grave Dust', rarity: 'uncommon', category: 'land', source: 'Cursed ground', flavour: 'Fine, grey, and always cold.' },
  ancient_masonry: { name: 'Ancient Masonry', rarity: 'uncommon', category: 'land', source: 'Ruins', flavour: 'Carved with hexes, in the style of the First Kings.' },
  hallow_pumpkin: { name: 'Hallow Pumpkin', rarity: 'uncommon', category: 'land', source: 'The fields of Hallowmere', flavour: 'It grins. Nobody carved it.' },

  // --- Deeds and special ground ------------------------------------------------------------------
  heartwood: { name: 'Heartwood', rarity: 'rare', category: 'deed', source: 'Felling a great tree', flavour: 'The dark core of a tree older than the realm.' },
  charcoal: { name: 'Charcoal', rarity: 'common', category: 'deed', source: 'Ground a fire has blackened', flavour: 'What the fire left. The smiths will want it.' },
  spring_water: { name: 'Spring Water', rarity: 'uncommon', category: 'deed', source: 'Springs', flavour: 'Clear and cold, and it heals a little.' },
  gold_nugget: { name: 'Gold Nugget', rarity: 'uncommon', category: 'deed', source: 'Gold mines', flavour: 'Missed by the miners. Not by you.' },

  // --- Buildings: taken the first time in a battle -----------------------------------------------
  tent_canvas: { name: 'Tent Canvas', rarity: 'common', category: 'building', source: 'Taking a camp', flavour: 'Patched, waxed and still mostly waterproof.' },
  roof_thatch: { name: 'Roof Thatch', rarity: 'common', category: 'building', source: 'Taking a house', flavour: 'Dry, light and terribly flammable.' },
  clay_bricks: { name: 'Clay Bricks', rarity: 'common', category: 'building', source: 'Holding a village', flavour: 'Fired in the village kiln.' },
  spyglass_lens: { name: 'Spyglass Lens', rarity: 'uncommon', category: 'building', source: 'Taking a watchtower', flavour: 'Ground by the old tower-wardens. Not a scratch on it.' },
  siege_rope: { name: 'Siege Rope', rarity: 'uncommon', category: 'building', source: 'Taking a catapult tower', flavour: 'Twisted sinew and hemp. It has thrown a thousand stones.' },
  steel_ingot: { name: 'Steel Ingot', rarity: 'uncommon', category: 'building', source: 'Taking a blacksmith', flavour: 'Folded and quenched, still faintly warm.' },
  banner_cloth: { name: 'Banner Cloth', rarity: 'uncommon', category: 'building', source: 'Taking a barracks', flavour: 'Red, the colour of the Seven Banners.' },
  oak_staves: { name: 'Oak Staves', rarity: 'common', category: 'building', source: 'Taking a tavern', flavour: 'From an ale barrel. The ale is gone.' },
  sawn_planks: { name: 'Sawn Planks', rarity: 'common', category: 'building', source: 'Taking a lumber mill', flavour: 'Cut true and stacked to dry.' },
  gate_iron: { name: 'Gate Iron', rarity: 'uncommon', category: 'building', source: 'Taking a gatehouse', flavour: 'Hinges and bars from a gate that held, once.' },

  // --- Spoils: left by the enemy's fallen ---------------------------------------------------------
  stolen_purse: { name: 'Stolen Purse', rarity: 'common', category: 'spoils', source: 'Bandits', flavour: 'Embroidered with someone else\'s initials.' },
  red_bandana: { name: 'Red Bandana', rarity: 'common', category: 'spoils', source: 'Bandits', flavour: 'Every outlaw on the King\'s Road wears one.' },
  goblin_tooth: { name: 'Goblin Tooth', rarity: 'common', category: 'spoils', source: 'Goblins', flavour: 'Sharper than it has any right to be.' },
  scrap_metal: { name: 'Scrap Metal', rarity: 'common', category: 'spoils', source: 'Goblins', flavour: 'Goblin craftsmanship: bent, rusted and somehow still dangerous.' },
  beast_pelt: { name: 'Beast Pelt', rarity: 'common', category: 'spoils', source: 'Beasts of the hills', flavour: 'Thick, warm, and it still smells of the wild.' },
  spider_silk: { name: 'Spider Silk', rarity: 'uncommon', category: 'spoils', source: 'Giant spiders', flavour: 'Stronger than steel wire, and twice as sticky.' },
  slime_gel: { name: 'Slime Gel', rarity: 'common', category: 'spoils', source: 'Swamp folk', flavour: 'It wobbles when you are not looking.' },
  toad_venom: { name: 'Toad Venom', rarity: 'uncommon', category: 'spoils', source: 'Swamp folk', flavour: 'Do not lick.' },
  mummy_wrap: { name: 'Mummy Wrappings', rarity: 'common', category: 'spoils', source: 'The Sand Court', flavour: 'Linen, resin and three thousand years of dust.' },
  scorpion_stinger: { name: 'Scorpion Stinger', rarity: 'uncommon', category: 'spoils', source: 'The Sand Court', flavour: 'Still dripping.' },
  yeti_fur: { name: 'Yeti Fur', rarity: 'common', category: 'spoils', source: 'The Frostborn', flavour: 'White as fresh snow, warm as a hearth.' },
  wraith_essence: { name: 'Wraith Essence', rarity: 'uncommon', category: 'spoils', source: 'The Frostborn', flavour: 'A wisp of frozen breath in a stoppered vial.' },
  bone_shard: { name: 'Bone Shard', rarity: 'common', category: 'spoils', source: 'The undead', flavour: 'It twitches, now and then.' },
  ectoplasm: { name: 'Ectoplasm', rarity: 'uncommon', category: 'spoils', source: 'The undead', flavour: 'Cold, glowing and faintly sad.' },
  orc_tusk: { name: 'Orc Tusk', rarity: 'common', category: 'spoils', source: 'The Iron Horde', flavour: 'Worn as a trophy by whoever knocked it out.' },
  iron_rivets: { name: 'Iron Rivets', rarity: 'common', category: 'spoils', source: 'The Iron Horde', flavour: 'Hammered out of stolen plough-shares.' },
  imp_horn: { name: 'Imp Horn', rarity: 'uncommon', category: 'spoils', source: 'The Infernal Legion', flavour: 'Small, curled, and hot to the touch.' },
  hellfire_ash: { name: 'Hellfire Ash', rarity: 'uncommon', category: 'spoils', source: 'The Infernal Legion', flavour: 'Ash that never quite stops smouldering.' },
  drake_scale: { name: 'Drake Scale', rarity: 'uncommon', category: 'spoils', source: 'Dragonkin', flavour: 'Shed in battle, hard as a shield.' },
  wyvern_talon: { name: 'Wyvern Talon', rarity: 'uncommon', category: 'spoils', source: 'Dragonkin', flavour: 'Hooked and serrated, made for snatching.' },

  // --- Trophies: one from each boss ---------------------------------------------------------------
  bandit_signet: { name: 'The Bandit King\'s Signet', rarity: 'epic', category: 'trophy', source: 'The Bandit King', flavour: 'He sealed his orders with it. Look closer at the seal.' },
  warchief_totem: { name: 'Grubnak\'s Totem', rarity: 'epic', category: 'trophy', source: 'The Goblin Warchief', flavour: 'Carved with a cracked crown and a goblin dancing on it.' },
  direwolf_fang: { name: 'Fenrak\'s Fang', rarity: 'epic', category: 'trophy', source: 'The Alpha Direwolf', flavour: 'Shot through with veins of red stone.' },
  hydra_heart: { name: 'Hydra Heart', rarity: 'epic', category: 'trophy', source: 'The Bog Hydra', flavour: 'It still beats, slowly, as if listening.' },
  pharaoh_scarab: { name: 'The Pharaoh\'s Scarab', rarity: 'epic', category: 'trophy', source: 'The Pharaoh', flavour: 'Inscribed with an oath and a warning.' },
  rime_core: { name: 'Rime Core', rarity: 'epic', category: 'trophy', source: 'The Frost Giant', flavour: 'A heart of ice with something red frozen at its centre.' },
  phylactery_shard: { name: 'Phylactery Shard', rarity: 'epic', category: 'trophy', source: 'The Lich King', flavour: 'Part of a knight\'s helm, cold as the grave.' },
  war_horn: { name: 'Gorrash\'s War Horn', rarity: 'epic', category: 'trophy', source: 'The Orc Warlord', flavour: 'Blown at every muster of the Iron Horde.' },
  demon_horn: { name: 'Azgaroth\'s Horn', rarity: 'epic', category: 'trophy', source: 'The Demon Lord', flavour: 'It smells of the Emberforge.' },
  heartscale: { name: 'The Elder Heartscale', rarity: 'epic', category: 'trophy', source: 'The Elder Dragon', flavour: 'The scale over the dragon\'s heart, healed around a red stone.' },

  // --- Relics: recovered from the story sites of each region --------------------------------------
  waystone_fragment: { name: 'Waystone Fragment', rarity: 'legendary', category: 'relic', source: 'Greenvale Meadows', flavour: 'A carved hex of stone from the old road.' },
  banner_gauntlet: { name: 'Banner Knight\'s Gauntlet', rarity: 'legendary', category: 'relic', source: 'Goblin Woods', flavour: 'Stamped with seven small banners.' },
  dragonbone: { name: 'Dragonbone Splinter', rarity: 'legendary', category: 'relic', source: 'Howling Hills', flavour: 'Scorched black from the inside.' },
  drowned_bell: { name: 'The Drowned Bell', rarity: 'legendary', category: 'relic', source: 'Mirefen Marsh', flavour: 'Green with weed, its clapper bound in rope.' },
  kings_tablet: { name: 'Tablet of the Kings', rarity: 'legendary', category: 'relic', source: 'Sunscorch Desert', flavour: 'Clay, sealed with the mark of the First Kings.' },
  frozen_oath: { name: 'The Frozen Oath', rarity: 'legendary', category: 'relic', source: 'Frostpeak Pass', flavour: 'A red banner frozen into the ice, seven names stitched on it.' },
  morthul_letter: { name: 'Morthul\'s Letter', rarity: 'legendary', category: 'relic', source: 'Gravemoor', flavour: 'Sealed, addressed, and never sent.' },
  broken_standard: { name: 'The Broken Standard', rarity: 'legendary', category: 'relic', source: 'Ironfang Badlands', flavour: 'A standard of the Seven Banners, flown upside down.' },
  forge_hammer: { name: 'The Crownforge Hammer', rarity: 'legendary', category: 'relic', source: 'Emberforge Wastes', flavour: 'Split clean through.' },
  crown_shard: { name: 'Shard of the Ember Crown', rarity: 'legendary', category: 'relic', source: 'Dragonspire Peaks', flavour: 'Warm to the touch, though it lies in snow.' },
  herald_horn: { name: 'The Herald\'s Horn', rarity: 'legendary', category: 'relic', source: 'The King\'s Road', flavour: 'Dented by an axe. It still sounds true.' },
  keeper_lantern: { name: 'The Keeper\'s Lantern', rarity: 'legendary', category: 'relic', source: 'Hallowmere', flavour: 'Always lit. Nobody remembers lighting it.' },
  vault_ledger: { name: 'The Vault Ledger', rarity: 'legendary', category: 'relic', source: 'The Underkeep', flavour: 'The royal treasury\'s last book of accounts.' },
  giant_treaty: { name: 'The Giants\' Treaty', rarity: 'legendary', category: 'relic', source: 'Rimeholt', flavour: 'A stone the size of a door, cut in two scripts.' },
  empty_circlet: { name: 'The Empty Circlet', rarity: 'legendary', category: 'relic', source: 'The Last Bastion', flavour: 'A plain gold crown with an empty setting.' }
} as const satisfies Record<string, MaterialDef>;

export type MaterialId = keyof typeof MATERIALS;
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
export const getMaterial = (id: MaterialId): MaterialDef => MATERIALS[id];
export const isMaterialId = (id: string): id is MaterialId => Object.prototype.hasOwnProperty.call(MATERIALS, id);

export const RARITY_ORDER: MaterialRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// A haul of materials, by kind
export type Haul = Partial<Record<MaterialId, number>>;

export const addToHaul = (haul: Haul, id: MaterialId, amount = 1): Haul => ({ ...haul, [id]: (haul[id] ?? 0) + amount });
export const haulSize = (haul: Haul | undefined): number => Object.values(haul ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);

// --- Where it all comes from -------------------------------------------------------------------

// What the land gives, by terrain - and on some battlefields, something of their own as well (or
// instead), by the map theme (the campaign's region names)
const LAND: Partial<Record<TerrainType, MaterialId[]>> = {
  plain: ['wild_herbs'],
  forest: ['timber'],
  hills: ['granite'],
  swamp: ['reeds', 'bog_peat'],
  desert: ['sunstone'],
  snow: ['frost_salt'],
  ice: ['glacier_ice'],
  cursed: ['grave_dust'],
  ruins: ['ancient_masonry']
};
const THEME_LAND: Record<string, Partial<Record<TerrainType, MaterialId[]>>> = {
  'Greenvale Meadows': { plain: ['wheat_sheaf', 'wool_tuft'] },
  'The King\'s Road': { plain: ['wheat_sheaf'] },
  'Farmlands': { plain: ['wheat_sheaf'] },
  'Goblin Woods': { forest: ['timber', 'glowcap'] },
  'Howling Hills': { plain: ['wool_tuft'], hills: ['granite', 'flint'], forest: ['pine_resin'] },
  'Highlands': { hills: ['granite', 'flint'] },
  'Mirefen Marsh': { swamp: ['reeds', 'bog_peat', 'lily_pad'] },
  'Marshlands': { swamp: ['reeds', 'lily_pad'] },
  'Sunscorch Desert': { desert: ['sunstone', 'desert_glass'], ruins: ['ancient_masonry', 'desert_glass'] },
  'Desert Frontier': { desert: ['sunstone', 'desert_glass'] },
  'Frostpeak Pass': { forest: ['pine_resin'] },
  'Frozen Pass': { forest: ['pine_resin'] },
  'Rimeholt': { forest: ['pine_resin'] },
  'Dragonspire Peaks': { forest: ['pine_resin'], hills: ['granite', 'iron_ore'] },
  'Ironfang Badlands': { hills: ['flint', 'iron_ore'], plain: ['flint'] },
  'Emberforge Wastes': { plain: ['obsidian', 'brimstone'], hills: ['obsidian', 'iron_ore'] },
  'The Underkeep': { plain: ['glowcap', 'brimstone'], hills: ['iron_ore'], forest: ['glowcap'] },
  'Hallowmere': { plain: ['hallow_pumpkin', 'wild_herbs'], forest: ['glowcap', 'timber'] }
};

// What a hex of a terrain can hold, on a map theme (empty: nothing worth gathering)
export const landMaterials = (terrain: TerrainType, theme: string | undefined): MaterialId[] =>
  (theme ? THEME_LAND[theme]?.[terrain] : undefined) ?? LAND[terrain] ?? [];

// What a building or camp gives up the first time it is taken in a battle
export const BUILDING_MATERIAL: Partial<Record<TerrainType | 'camp', MaterialId>> = {
  camp: 'tent_canvas',
  house: 'roof_thatch',
  village: 'clay_bricks',
  watchtower: 'spyglass_lens',
  catapult: 'siege_rope',
  blacksmith: 'steel_ingot',
  barracks: 'banner_cloth',
  tavern: 'oak_staves',
  lumbermill: 'sawn_planks',
  gate: 'gate_iron'
};

// What each enemy troop leaves behind when it falls (bosses leave their trophies)
export const SPOILS: Partial<Record<TroopId, MaterialId>> = {
  bandit_thug: 'stolen_purse', bandit_archer: 'stolen_purse', highwayman: 'red_bandana', bandit_raider: 'red_bandana',
  goblin_scrapper: 'goblin_tooth', goblin_slinger: 'goblin_tooth', goblin_shaman: 'scrap_metal', goblin_sapper: 'scrap_metal',
  grey_wolf: 'beast_pelt', wild_boar: 'beast_pelt', giant_spider: 'spider_silk', cave_bear: 'beast_pelt',
  bog_slime: 'slime_gel', lizardman: 'slime_gel', toxic_toad: 'toad_venom', swamp_witch: 'toad_venom',
  giant_scorpion: 'scorpion_stinger', sand_raider: 'mummy_wrap', mummy: 'mummy_wrap', sand_golem: 'scorpion_stinger',
  snow_wolf: 'yeti_fur', ice_wraith: 'wraith_essence', yeti: 'yeti_fur', frost_huntress: 'wraith_essence',
  skeleton_minion: 'bone_shard', skeleton_warrior: 'bone_shard', skeleton_archer: 'bone_shard', ghost: 'ectoplasm',
  orc_grunt: 'orc_tusk', orc_archer: 'iron_rivets', orc_shaman: 'orc_tusk', ogre: 'iron_rivets',
  imp: 'imp_horn', magma_golem: 'hellfire_ash', fire_elemental: 'hellfire_ash', hellhound: 'imp_horn',
  dragon_cultist: 'drake_scale', wyvern: 'wyvern_talon', drake: 'drake_scale', dragon_knight: 'wyvern_talon',
  bandit_king: 'bandit_signet',
  goblin_warchief: 'warchief_totem',
  alpha_direwolf: 'direwolf_fang',
  bog_hydra: 'hydra_heart',
  pharaoh: 'pharaoh_scarab',
  frost_giant: 'rime_core',
  lich_king: 'phylactery_shard',
  orc_warlord: 'war_horn',
  demon_lord: 'demon_horn',
  elder_dragon: 'heartscale'
};
