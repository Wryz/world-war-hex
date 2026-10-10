import type { MaterialId } from './materials';

// The history of the Hexlands, told in pieces. Nothing here is ever explained outright: the
// battlefields are littered with what came before - a toppled waystone, a knight's grave someone
// still tends, the bones of something enormous - and each region hides one story site where the
// past can be dug up. The relic recovered there, and the trophy taken from each region's boss, add
// a page to the Chronicle. Read in order, the pages tell what happened to the realm.
//
// The story, for whoever writes the next page:
//
// Long ago the First Kings laid the Weave: they cut the wild land into hexes, marked every one with
// a waystone, and claimed it. Aldric, the last of them, forged the Ember Crown in the Emberforge to
// hold the wild things - goblins, the restless dead, the demons behind the Rift - beyond the borders,
// and set it with a stone the colour of a dragon's eye: a stone cut from the Elder Dragon's own
// heart, taken from the Dragonspire. The knights of the Seven Banners kept the peace the Crown made.
//
// Three hundred years ago the Crown went dark. The kingdom remembers it as the Sundering, a theft
// gone wrong, a dragon's revenge. The truth is in the pages: the Elder Dragon was dying without its
// heartstone, and Aldric climbed the Dragonspire to give it back. His knights fell holding the
// mountain while he did. The hordes have been waking ever since, one region at a time, drawn to
// the cold places where the Crown's light used to reach - and the player is rebuilding the Seven
// Banners to hold the line without it.

// A story site: how it looks on the battlefield, what it hints at, and the relic it holds
export interface StorySite {
  // The relic recovered by holding it
  relic: MaterialId;
  // What the troops see
  name: string;
  hint: string;
  // How it is laid out on its hex: KayKit props by name, placed around the centre (x and z in hex
  // widths, a turn in radians)
  props: StoryProp[];
}

export interface StoryProp { model: string; x: number; z: number; scale: number; turn?: number; lift?: number }

// One story site per campaign region, by map theme (the region's name)
export const STORY_SITES: Record<string, StorySite> = {
  'Greenvale Meadows': {
    relic: 'waystone_fragment', name: 'A toppled waystone',
    hint: 'Half-buried by the old road, a stone carved with a hexagon. Something is written on it.',
    props: [
      { model: 'pillar_decorated', x: 0.05, z: -0.1, scale: 0.11, turn: 0.4 },
      { model: 'rubble_half', x: -0.25, z: 0.15, scale: 0.1, turn: 1.2 },
      { model: 'rock_single_B', x: 0.28, z: 0.2, scale: 1, turn: 2 }
    ]
  },
  'Goblin Woods': {
    relic: 'banner_gauntlet', name: 'A goblin trophy pole',
    hint: 'A pole hung with skulls and a single steel gauntlet - not goblin work.',
    props: [
      { model: 'post_skull', x: 0, z: -0.05, scale: 0.12 },
      { model: 'sword_shield_broken', x: 0.25, z: 0.2, scale: 0.14, turn: 0.8, lift: 0.04 },
      { model: 'bone_A', x: -0.25, z: 0.2, scale: 0.14, turn: 2.1 }
    ]
  },
  'Howling Hills': {
    relic: 'dragonbone', name: 'The bones of something vast',
    hint: 'A ribcage, taller than a man, half sunk into the hillside. The bones are burnt black.',
    props: [
      { model: 'ribcage', x: 0, z: 0, scale: 0.34, turn: 0.6 },
      { model: 'skull', x: 0.32, z: -0.18, scale: 0.2, turn: 2.4 },
      { model: 'bone_A', x: -0.3, z: 0.25, scale: 0.16, turn: 1 }
    ]
  },
  'Mirefen Marsh': {
    relic: 'drowned_bell', name: 'A sunken chapel',
    hint: 'A coffin, a grave-marker and a guttering candle where a chapel once stood. Something rings, very faintly, under the water.',
    props: [
      { model: 'coffin', x: 0, z: 0.05, scale: 0.07, turn: 0.5 },
      { model: 'gravemarker_B', x: -0.3, z: -0.15, scale: 0.15, turn: 0.2 },
      { model: 'candle_triple', x: 0.3, z: -0.2, scale: 0.3 }
    ]
  },
  'Sunscorch Desert': {
    relic: 'kings_tablet', name: 'A broken tomb door',
    hint: 'A column, a tomb-chest and scattered gold, all sealed with the mark of the First Kings. The seals were broken from inside.',
    props: [
      { model: 'column', x: -0.2, z: -0.15, scale: 0.4 },
      { model: 'coffin', x: 0.15, z: 0.1, scale: 0.065, turn: 1.6 },
      { model: 'coin_stack_large', x: 0.3, z: -0.25, scale: 0.15, turn: 0.4 }
    ]
  },
  'Frostpeak Pass': {
    relic: 'frozen_oath', name: 'A knights\' cairn',
    hint: 'A gravestone, a broken shield and a red banner frozen stiff in the wind.',
    props: [
      { model: 'gravestone', x: -0.05, z: -0.1, scale: 0.15, turn: 0.1 },
      { model: 'banner_patternA_red', x: 0.28, z: -0.2, scale: 0.13, turn: -0.4 },
      { model: 'sword_shield_broken', x: -0.25, z: 0.22, scale: 0.15, turn: 1.4, lift: 0.04 }
    ]
  },
  'Gravemoor': {
    relic: 'morthul_letter', name: 'A court mage\'s shrine',
    hint: 'Candles burn around an open coffin. It is empty, except for a sealed letter.',
    props: [
      { model: 'shrine_candles', x: -0.25, z: -0.15, scale: 0.14 },
      { model: 'coffin', x: 0.1, z: 0.1, scale: 0.068, turn: 0.9 },
      { model: 'candle_triple', x: 0.32, z: -0.22, scale: 0.28 }
    ]
  },
  'Ironfang Badlands': {
    relic: 'broken_standard', name: 'The Horde\'s trophy rack',
    hint: 'A rack of captured weapons under a red banner hung upside down - a standard of the Seven Banners.',
    props: [
      { model: 'weaponrack', x: -0.15, z: -0.1, scale: 1.25, turn: 0.3 },
      { model: 'banner_patternA_red', x: 0.25, z: -0.18, scale: 0.13, turn: Math.PI },
      { model: 'skull', x: 0.15, z: 0.28, scale: 0.13, turn: 2 }
    ]
  },
  'Emberforge Wastes': {
    relic: 'forge_hammer', name: 'The old crownforge',
    hint: 'The cold ruin of a great forge, its anvil-stone split. A torch still burns in its wall.',
    props: [
      { model: 'barrier_column', x: 0, z: -0.15, scale: 0.09, turn: 0.2 },
      { model: 'rubble_half', x: -0.22, z: 0.22, scale: 0.1, turn: 2.2 },
      { model: 'torch_lit', x: 0.3, z: 0.12, scale: 0.5, lift: 0.2 }
    ]
  },
  'Dragonspire Peaks': {
    relic: 'crown_shard', name: 'The Knight\'s Grave',
    hint: 'A sword and shield laid on a grave at the foot of the mountain. Fresh candles burn beside it. Something red glints in the snow.',
    props: [
      { model: 'gravestone', x: 0, z: -0.15, scale: 0.15 },
      { model: 'sword_shield_broken', x: 0, z: 0.12, scale: 0.16, turn: 0.1, lift: 0.04 },
      { model: 'shrine_candles', x: 0.32, z: 0.05, scale: 0.12 }
    ]
  },
  'The King\'s Road': {
    relic: 'herald_horn', name: 'A herald\'s cart',
    hint: 'An overturned cart: barrels, a sack of letters and the royal colours trampled in the mud.',
    props: [
      { model: 'barrel', x: -0.2, z: -0.15, scale: 1.3, turn: 0.4 },
      { model: 'sack', x: 0.05, z: 0.15, scale: 1.8, turn: 1.1 },
      { model: 'banner_patternA_red', x: 0.3, z: -0.15, scale: 0.12, turn: -1.2 },
      { model: 'crate_B_small', x: -0.3, z: 0.25, scale: 1.3, turn: 2.2 }
    ]
  },
  'Hallowmere': {
    relic: 'keeper_lantern', name: 'The Keeper\'s shrine',
    hint: 'Someone tends these graves. The candles are always fresh, the lantern always lit. The footprints lead towards the crypts.',
    props: [
      { model: 'lantern_standing', x: 0.25, z: -0.2, scale: 0.26 },
      { model: 'shrine_candles', x: -0.2, z: -0.18, scale: 0.13 },
      { model: 'grave_B', x: 0, z: 0.18, scale: 0.11, turn: 0.2 }
    ]
  },
  'The Underkeep': {
    relic: 'vault_ledger', name: 'The royal vault',
    hint: 'A treasure chest left open, gold spilled across the floor. A ledger lies on top, open at its last page.',
    props: [
      { model: 'chest_gold', x: -0.1, z: -0.05, scale: 0.2, turn: 0.5 },
      { model: 'coin_stack_large', x: 0.25, z: 0.2, scale: 0.16, turn: 1.8 },
      { model: 'torch_lit', x: 0.3, z: -0.25, scale: 0.5, lift: 0.2 }
    ]
  },
  'Rimeholt': {
    relic: 'giant_treaty', name: 'The treaty stone',
    hint: 'A carved pillar, taller than a giant\'s knee, cut with two kinds of writing.',
    props: [
      { model: 'pillar_decorated', x: 0, z: -0.1, scale: 0.13, turn: 1.1 },
      { model: 'gravemarker_B', x: -0.28, z: 0.2, scale: 0.14, turn: 0.4 },
      { model: 'bone_A', x: 0.28, z: 0.22, scale: 0.15, turn: 2.7 }
    ]
  },
  'The Last Bastion': {
    relic: 'empty_circlet', name: 'The fallen throne',
    hint: 'A broken column, a king\'s banner and a sword laid at the foot of where a throne once stood.',
    props: [
      { model: 'column', x: -0.22, z: -0.15, scale: 0.42 },
      { model: 'banner_patternA_red', x: 0.22, z: -0.22, scale: 0.14 },
      { model: 'sword_shield_broken', x: 0.05, z: 0.18, scale: 0.16, turn: 0.3, lift: 0.04 },
      { model: 'candle_triple', x: -0.3, z: 0.25, scale: 0.28 }
    ]
  }
};

// --- The land remembers ---------------------------------------------------------------------------

// Small scenes scattered over open ground, so every region looks lived in and fought over: a
// waystone by the road, a soldier's shield where he fell, a camp left in a hurry. Each is laid
// out around a spot near the edge of its hex (x and z in hex widths), and none of them does anything.
const WAYSTONE: StoryProp[] = [{ model: 'pillar', x: 0, z: 0, scale: 0.08, turn: 0.3 }, { model: 'rock_single_C', x: 0.14, z: 0.06, scale: 0.8, turn: 1 }];
const FALLEN: StoryProp[] = [{ model: 'sword_shield_broken', x: 0, z: 0, scale: 0.13, turn: 0.6, lift: 0.04 }, { model: 'skull', x: 0.13, z: 0.05, scale: 0.08, turn: 2 }];
const OLD_BONES: StoryProp[] = [{ model: 'bone_A', x: 0, z: 0, scale: 0.13, turn: 1.3 }, { model: 'skull', x: 0.1, z: -0.08, scale: 0.09, turn: 0.4 }];
const BEAST: StoryProp[] = [{ model: 'ribcage', x: 0, z: 0, scale: 0.22, turn: 0.9 }];
const CAMP: StoryProp[] = [{ model: 'sack', x: 0, z: 0, scale: 1.5, turn: 0.7 }, { model: 'crate_B_small', x: 0.14, z: 0.05, scale: 1.2, turn: 2.2 }];
const SUPPLIES: StoryProp[] = [{ model: 'barrel', x: 0, z: 0, scale: 1.2 }, { model: 'sack', x: 0.13, z: -0.06, scale: 1.4, turn: 1.9 }];
const RUINED_WALL: StoryProp[] = [{ model: 'wall_corner_A_outside', x: 0, z: 0, scale: 0.16, turn: 0.4 }, { model: 'rubble_half', x: 0.14, z: 0.08, scale: 0.07, turn: 1.5 }];
const SAPLINGS: StoryProp[] = [{ model: 'trees_A_small', x: 0, z: 0, scale: 0.38, turn: 0.5 }];
const THICKET: StoryProp[] = [{ model: 'trees_B_small', x: 0, z: 0, scale: 0.38, turn: 2.5 }];
const STONES: StoryProp[] = [{ model: 'rock_single_B', x: 0, z: 0, scale: 0.9, turn: 0.2 }, { model: 'rock_single_C', x: 0.13, z: 0.07, scale: 0.7, turn: 2 }];
const LONE_GRAVE: StoryProp[] = [{ model: 'grave_B', x: 0, z: 0, scale: 0.09, turn: 0.3 }, { model: 'candle_triple', x: 0.12, z: 0.06, scale: 0.22 }];
const MARKER: StoryProp[] = [{ model: 'gravemarker_B', x: 0, z: 0, scale: 0.12, turn: 0.2 }];
const DEAD_TREE: StoryProp[] = [{ model: 'tree_dead_small', x: 0, z: 0, scale: 0.15, turn: 1.2 }];
const OLD_FENCE: StoryProp[] = [{ model: 'fence', x: 0, z: 0, scale: 0.09, turn: 0.9 }];
const PUMPKINS: StoryProp[] = [{ model: 'pumpkin_yellow', x: 0, z: 0, scale: 0.18, turn: 0.4 }, { model: 'pumpkin_yellow', x: 0.12, z: 0.06, scale: 0.13, turn: 2 }];
const GOLDEN_PINE: StoryProp[] = [{ model: 'tree_pine_yellow_medium', x: 0, z: 0, scale: 0.15, turn: 0.6 }];
const BANNER: StoryProp[] = [{ model: 'banner_patternA_red', x: 0, z: 0, scale: 0.11, turn: 0.5 }, { model: 'sword_shield_broken', x: 0.12, z: 0.08, scale: 0.12, turn: 1.4, lift: 0.04 }];
const RACK: StoryProp[] = [{ model: 'weaponrack', x: 0, z: 0, scale: 1.1, turn: 0.4 }, { model: 'skull', x: 0.13, z: 0.07, scale: 0.08, turn: 1 }];
const BROKEN_COLUMN: StoryProp[] = [{ model: 'column', x: 0, z: 0, scale: 0.3 }, { model: 'rubble_half', x: 0.13, z: 0.07, scale: 0.07, turn: 0.8 }];
const CARVED_PILLAR: StoryProp[] = [{ model: 'pillar_decorated', x: 0, z: 0, scale: 0.09, turn: 1.1 }];
const BARRIER: StoryProp[] = [{ model: 'barrier_column', x: 0, z: 0, scale: 0.07, turn: 0.6 }, { model: 'rubble_half', x: 0.12, z: 0.07, scale: 0.07, turn: 2.1 }];
const VIGIL: StoryProp[] = [{ model: 'gravestone', x: 0, z: 0, scale: 0.12 }, { model: 'candle_triple', x: 0.12, z: 0.06, scale: 0.2 }];

// What each region's ground remembers (any other map gets the countryside's)
export const HISTORY: Record<string, StoryProp[][]> = {
  'Greenvale Meadows': [WAYSTONE, SAPLINGS, CAMP, RUINED_WALL, OLD_FENCE],
  'Goblin Woods': [FALLEN, THICKET, SUPPLIES, OLD_BONES],
  'Howling Hills': [OLD_BONES, BEAST, WAYSTONE, STONES],
  'Mirefen Marsh': [DEAD_TREE, LONE_GRAVE, OLD_FENCE, MARKER],
  'Sunscorch Desert': [BROKEN_COLUMN, OLD_BONES, BEAST, CARVED_PILLAR],
  'Frostpeak Pass': [FALLEN, BANNER, STONES, VIGIL],
  'Gravemoor': [LONE_GRAVE, MARKER, DEAD_TREE, OLD_BONES],
  'Ironfang Badlands': [RACK, FALLEN, OLD_BONES, SUPPLIES],
  'Emberforge Wastes': [BARRIER, FALLEN, STONES, BROKEN_COLUMN],
  'Dragonspire Peaks': [BEAST, FALLEN, VIGIL, OLD_BONES],
  'The King\'s Road': [RUINED_WALL, SUPPLIES, BANNER, WAYSTONE, CAMP],
  'Hallowmere': [PUMPKINS, GOLDEN_PINE, OLD_FENCE, LONE_GRAVE],
  'The Underkeep': [CARVED_PILLAR, BARRIER, LONE_GRAVE, FALLEN],
  'Rimeholt': [CARVED_PILLAR, OLD_BONES, STONES, FALLEN],
  'The Last Bastion': [BANNER, RUINED_WALL, FALLEN, BROKEN_COLUMN, VIGIL]
};
const COUNTRYSIDE: StoryProp[][] = [SAPLINGS, THICKET, STONES, CAMP, RUINED_WALL];

export const historyFor = (theme: string | undefined): StoryProp[][] => (theme ? HISTORY[theme] : undefined) ?? COUNTRYSIDE;

export const storySiteFor = (theme: string | undefined): StorySite | undefined => (theme ? STORY_SITES[theme] : undefined);

// --- The Chronicle -------------------------------------------------------------------------------

export interface ChroniclePage {
  id: string;
  title: string;
  // Where it comes from, shown before it is found
  clue: string;
  text: string;
  // The material that unlocks it (none: always open)
  unlockedBy?: MaterialId;
}

// In the order they are best read
export const CHRONICLE: ChroniclePage[] = [
  {
    id: 'prologue', title: 'The Hexlands',
    clue: '',
    text: 'The old maps call this land the Hexlands, and say it was not always so. The First Kings, they say, "laid the Weave": cut the wild country into hexes, set a waystone on every one, and claimed them all. Nobody remembers what the waystones were for. Bandits are on the roads again, and the old garrisons are empty. Someone has to raise the banners.'
  },
  {
    id: 'waystone', title: 'The Waystone', unlockedBy: 'waystone_fragment',
    clue: 'A story site in Greenvale Meadows',
    text: 'Carved into the broken stone, in the old hex-script: "Here the Weave holds. Here the road is the King\'s." The carving is older than the farms around it. Beneath it, someone has scratched a newer line with a knife: "The road is ours now."'
  },
  {
    id: 'signet', title: 'The Bandit King\'s Seal', unlockedBy: 'bandit_signet',
    clue: 'Taken from the Bandit King',
    text: 'The Bandit King sealed his orders with this ring. Scrape away the grime and the crest is plain: the hex-and-flame of the royal house. Whoever he was before he took to the roads, he did not steal it.'
  },
  {
    id: 'gauntlet', title: 'The Seven Banners', unlockedBy: 'banner_gauntlet',
    clue: 'A story site in Goblin Woods',
    text: 'A steel gauntlet hung on a goblin totem like a prize, stamped with seven small banners. Goblins do not make steel like this. Whoever wore it marched with the Seven Banners, the knights who kept the King\'s peace - when there was a King, and a peace.'
  },
  {
    id: 'totem', title: 'The Dancing Goblin', unlockedBy: 'warchief_totem',
    clue: 'Taken from the Goblin Warchief',
    text: 'Grubnak\'s totem is carved with a crown, cracked down the middle, and a goblin dancing on top of it. Goblins have long memories and short tempers. They remember the day the Crown went dark, and they still celebrate it.'
  },
  {
    id: 'dragonbone', title: 'Bone Ridge', unlockedBy: 'dragonbone',
    clue: 'A story site in Howling Hills',
    text: 'Bone Ridge is not a ridge. The bones run for a mile under the heather, and they are burnt black from the inside, as if whatever owned them breathed fire until the end. The beasts of the hills howl loudest where the skull lies.'
  },
  {
    id: 'fang', title: 'The Red Vein', unlockedBy: 'direwolf_fang',
    clue: 'Taken from the Alpha Direwolf',
    text: 'Fenrak\'s fang is shot through with veins of red stone, the colour of a dragon\'s eye. The beasts of the hills were not mad. Something in the bones beneath them was calling, and they were answering.'
  },
  {
    id: 'bell', title: 'The Drowned Bell', unlockedBy: 'drowned_bell',
    clue: 'A story site in Mirefen Marsh',
    text: 'The bell of the Drowned Chapel, green with weed. The inscription round its lip gives its purpose: "To be rung if the Crown should fail." Its clapper has been bound with rope. The marsh began to rise the year someone tied it.'
  },
  {
    id: 'hydra', title: 'The Sleeper', unlockedBy: 'hydra_heart',
    clue: 'Taken from the Bog Hydra',
    text: 'The hydra slept beneath the chapel for three hundred years, lulled by a bell that was rung each dawn. When the bell fell silent it woke. Its heart still beats, slowly, as if listening for the bell.'
  },
  {
    id: 'tablet', title: 'The Pact of the Dead', unlockedBy: 'kings_tablet',
    clue: 'A story site in Sunscorch Desert',
    text: 'A clay tablet from the Valley of Kings, sealed with the hex-and-flame: the dead of the desert swear to sleep "for as long as the Ember Crown burns." The raiders who broke open the tombs found the seals already cracked - from the inside.'
  },
  {
    id: 'scarab', title: 'The Pharaoh\'s Warning', unlockedBy: 'pharaoh_scarab',
    clue: 'Taken from the Pharaoh',
    text: 'The scarab repeats the pact, and adds a line the tablet left out: "Should the Crown go dark, the dead shall march to the one who keeps it." The dead are marching north.'
  },
  {
    id: 'oath', title: 'The Frozen Oath', unlockedBy: 'frozen_oath',
    clue: 'A story site in Frostpeak Pass',
    text: 'A red banner frozen into the ice of the pass. Stitched across it in gold: "We hold the north for Aldric." Seven names are stitched beneath. Six have been crossed out, each in a different hand.'
  },
  {
    id: 'rime', title: 'What the Giants Kept', unlockedBy: 'rime_core',
    clue: 'Taken from the Frost Giant',
    text: 'Frozen at the heart of the giant\'s rime core is a red splinter. Hrimgar kept it for three hundred years, as a reminder of a promise - and of who broke it first.'
  },
  {
    id: 'letter', title: 'Morthul\'s Letter', unlockedBy: 'morthul_letter',
    clue: 'A story site in Gravemoor',
    text: '"Majesty - the Crown is failing. I can keep the dead in their graves a while longer, if you let me use the fallen knights as wards. It is a dark thing to ask. Forgive me. - M., Court Mage." The letter was sealed, and addressed, and never sent.'
  },
  {
    id: 'phylactery', title: 'The Lich\'s Promise', unlockedBy: 'phylactery_shard',
    clue: 'Taken from the Lich King',
    text: 'Morthul did not betray his King. He kept his promise too well: he bound himself to the dead so that they would follow him instead of the dark. Every lich must hide its soul in something. His is a knight\'s helm, from the Dragonspire.'
  },
  {
    id: 'standard', title: 'The Upside-Down Standard', unlockedBy: 'broken_standard',
    clue: 'A story site in Ironfang Badlands',
    text: 'The Iron Horde flies it upside down over Gorrash\'s fortress: a torn standard of the Seven Banners. They took it the year the knights stopped coming. They have been waiting ever since for someone to come and take it back.'
  },
  {
    id: 'horn', title: 'The Squire\'s Challenge', unlockedBy: 'war_horn',
    clue: 'Taken from the Orc Warlord',
    text: 'Gorrash won his horn, and his name, by beating the squire of the last Banner Knight in single combat at the foot of the Dragonspire. The squire had been sent down the mountain with a message. Gorrash never let him deliver it.'
  },
  {
    id: 'hammer', title: 'The Crownforge', unlockedBy: 'forge_hammer',
    clue: 'A story site in Emberforge Wastes',
    text: 'The head of the hammer that forged the Ember Crown, split clean through. The forge-master\'s mark is on one half. On the other, the Rift has burned a shape like a claw.'
  },
  {
    id: 'demonhorn', title: 'The Rift', unlockedBy: 'demon_horn',
    clue: 'Taken from the Demon Lord',
    text: 'The Rift opened where the Crown was forged. The same fire that made the Crown had held the Rift shut. When the Crown went dark, the fire went out, and the world cracked as it cooled.'
  },
  {
    id: 'shard', title: 'The Stone in the Crown', unlockedBy: 'crown_shard',
    clue: 'A story site in Dragonspire Peaks',
    text: 'A chip of red stone, warm though it lies in snow, beside the grave of the last Banner Knight. Here the truth is plain at last: the Ember Crown was set with a stone cut from the Elder Dragon\'s own heart.'
  },
  {
    id: 'heartscale', title: 'The Debt', unlockedBy: 'heartscale',
    clue: 'Taken from the Elder Dragon',
    text: 'The scale over the Elder Dragon\'s heart, healed around a red stone that fits a crown\'s setting exactly. The Crown was not stolen. Aldric climbed the mountain and gave the stone back, because the dragon was dying without it. The Crown went dark, the hordes woke - and the King thought it worth the price.'
  },
  {
    id: 'herald', title: 'The Spring Horn', unlockedBy: 'herald_horn',
    clue: 'A story site on the King\'s Road',
    text: 'The villages of the King\'s Road kept a custom nobody remembered the reason for: once each spring, blow the herald\'s horn towards the Bastion, "so the King knows we still stand." Nobody has blown it in years. Nobody thought anyone was listening.'
  },
  {
    id: 'lantern', title: 'The Keeper', unlockedBy: 'keeper_lantern',
    clue: 'A story site in Hallowmere',
    text: 'Someone tends the old graves of Hallowmere. The candles are always fresh, the lantern always lit, and the footprints lead towards the crypts and never come back. The lantern is engraved with seven banners, one of them crossed out.'
  },
  {
    id: 'ledger', title: 'The Last Entry', unlockedBy: 'vault_ledger',
    clue: 'A story site in the Underkeep',
    text: 'The royal treasury\'s last ledger. The final entry, in a shaking hand: "Paid to the Emberforge: one stone, red, of a size to set in a crown. Paid by: the Dragonspire. Unwillingly." Below it, in another hand: "Debt to be repaid in full. - A."'
  },
  {
    id: 'treaty', title: 'The Treaty Stone', unlockedBy: 'giant_treaty',
    clue: 'A story site in Rimeholt',
    text: 'Two scripts, giant runes and the King\'s hand: the giants keep the ice drakes sleeping in the north, and the Kings keep the Crown burning in the south. The south broke the treaty first. The giants waited three hundred years before they did the same.'
  },
  {
    id: 'circlet', title: 'The Empty Circlet', unlockedBy: 'empty_circlet',
    clue: 'A story site at the Last Bastion',
    text: 'Aldric\'s crown, found at last behind the Bastion\'s throne: a plain gold circlet with an empty setting. It was never lost. Every king after him was crowned with nothing at all, and told it was the Ember Crown, so that the people would not be afraid. The banners are raised again now. Perhaps that was always the point.'
  }
];

export const pageUnlocked = (page: ChroniclePage, found: (id: MaterialId) => boolean): boolean =>
  !page.unlockedBy || found(page.unlockedBy);
