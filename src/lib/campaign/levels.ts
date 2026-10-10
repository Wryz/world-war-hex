import type { GameSettings, Roster, TerrainType } from '@/types/game';
import { DEFAULT_SETTINGS, type GuardSpec } from '../game/gameState';
import { Faction, MOB_IDS, TROOPS, TroopId, cardPower, levelMultiplier, scaleTroop, statsPower } from '../game/troops';
import { baseOf } from '../game/lineages';
import { expectedProgression, recommendedPower, baseLevelReward, treeCardPower } from '../meta/economy';
import { LEVEL_TUNING } from './levelTuning';
import { SWARM_COST, WeatherId, getFactionTrait } from '../game/regionRules';

// The campaign: fifteen regions of ten levels each. Every region has its own map theme, enemy
// faction and terrain; the tenth level of each is a boss battle. The last five regions are
// rematches: old factions return with allies, on new ground. Enemies get stronger level by
// level, in step with how strong the player can expect their cards to be by then.

export interface Region {
  id: number;
  name: string;
  // Map theme (see mapGenerator REGION_THEMES)
  theme: string;
  faction: Faction;
  // Factions that lend the region's faction troops
  allies?: Faction[];
  boss: TroopId;
  // Terrain this region introduces
  newTerrain: TerrainType[];
  blurb: string;
  // Colours of the region's band on the campaign map: ground, accent
  colors: [string, string];
  // Names of the ten battles
  places: string[];
  // Its weather (regionRules.ts)
  weather?: WeatherId;
}

export const REGIONS: Region[] = [
  {
    id: 0, name: 'Greenvale Meadows', theme: 'Greenvale Meadows', faction: 'bandits', boss: 'bandit_king',
    newTerrain: ['plain', 'forest', 'water', 'resource'], colors: ['#9be15d', '#4d7c0f'],
    blurb: 'Bandits have overrun the farmland of Greenvale. Drive them from the roads.',
    places: ['Millbrook Crossing', 'Old Mill', 'Hayfield Ambush', 'Thornhedge Farm', 'Bandit Camp', 'Willow Ford', 'Crow Hill', 'Lantern Road', 'Robbers\' Hollow', 'The Bandit King\'s Hall']
  },
  {
    id: 1, name: 'Goblin Woods', theme: 'Goblin Woods', faction: 'goblins', boss: 'goblin_warchief',
    newTerrain: ['hills'], colors: ['#5cc45a', '#166534'],
    blurb: 'The forest crawls with goblins. They are small, but they are many.',
    places: ['Mosswood Edge', 'Toadstool Glade', 'Snare Thicket', 'Rotten Bridge', 'Goblin Warren', 'Mudpot Clearing', 'Bramble Maze', 'Totem Hill', 'Stinkhollow', 'Grubnak\'s Throne']
  },
  {
    id: 2, name: 'Howling Hills', theme: 'Howling Hills', faction: 'beasts', boss: 'alpha_direwolf',
    newTerrain: ['spring'], colors: ['#c3d97a', '#78716c'],
    blurb: 'Something has driven the beasts of the hills into a frenzy.',
    places: ['Shepherd\'s Rest', 'Bone Ridge', 'Webbed Ravine', 'Boar Run', 'Moonlit Tor', 'Bear Caves', 'Echo Pass', 'Fang Rocks', 'The Long Howl', 'Fenrak\'s Den']
  },
  {
    id: 3, name: 'Mirefen Marsh', theme: 'Mirefen Marsh', faction: 'swamp', boss: 'bog_hydra', weather: 'fogBanks',
    newTerrain: ['swamp'], colors: ['#7fa36b', '#0f766e'],
    blurb: 'The marsh is rising, and so is whatever lives beneath it.',
    places: ['Reedwater', 'Sinking Steps', 'Slime Pools', 'Witch\'s Hut', 'Croaking Fen', 'Drowned Chapel', 'Lizard Shoals', 'Gloomwater', 'Hag\'s Cauldron', 'The Hydra\'s Lair']
  },
  {
    id: 4, name: 'Sunscorch Desert', theme: 'Sunscorch Desert', faction: 'desert', boss: 'pharaoh', weather: 'sandstorm',
    newTerrain: ['desert', 'ruins'], colors: ['#ffd97a', '#b45309'],
    blurb: 'Raiders have broken open the tombs of the old kings.',
    places: ['Oasis Gate', 'Dune Sea', 'Scorpion Flats', 'Broken Obelisk', 'Sandstorm Road', 'Sunken Temple', 'Valley of Kings', 'Golem Quarry', 'Mirage Walls', 'The Pharaoh\'s Tomb']
  },
  {
    id: 5, name: 'Frostpeak Pass', theme: 'Frostpeak Pass', faction: 'frost', boss: 'frost_giant', weather: 'blizzard',
    newTerrain: ['snow', 'ice'], colors: ['#eef6fc', '#0284c7'],
    blurb: 'The only road north runs through the giants\' frozen pass.',
    places: ['Snowgate', 'Frozen Lake', 'Wraith Hollow', 'Yeti Tracks', 'Icefall', 'Hunter\'s Lodge', 'Glacier Bridge', 'Whiteout', 'Giant\'s Stair', 'Hrimgar\'s Hall']
  },
  {
    id: 6, name: 'Gravemoor', theme: 'Gravemoor', faction: 'undead', boss: 'lich_king',
    newTerrain: ['cursed'], colors: ['#94a3b8', '#6d28d9'],
    blurb: 'Beyond the pass lies Gravemoor, where the dead walk the moors.',
    places: ['Gallows Gate', 'Bone Fields', 'Weeping Abbey', 'Crypt Road', 'Ghostlight Marsh', 'Ossuary', 'Black Chapel', 'Tombstone Rise', 'The Withered Wood', 'Morthul\'s Necropolis']
  },
  {
    id: 7, name: 'Ironfang Badlands', theme: 'Ironfang Badlands', faction: 'orcs', boss: 'orc_warlord',
    newTerrain: [], colors: ['#d6b77a', '#4d7c0f'],
    blurb: 'The Iron Horde gathers in the badlands, ready to march on the realm.',
    places: ['Rustgate', 'Skull Canyon', 'War Drums', 'Ogre Bridge', 'Spiked Walls', 'Bloodrock', 'Warg Pits', 'Smoking Forge', 'Horde Muster', 'Gorrash\'s Fortress']
  },
  {
    id: 8, name: 'Emberforge Wastes', theme: 'Emberforge Wastes', faction: 'infernal', boss: 'demon_lord', weather: 'ashfall',
    newTerrain: ['lava'], colors: ['#f97316', '#7f1d1d'],
    blurb: 'A rift has opened in the Emberforge. Demons pour through it.',
    places: ['Ashfall', 'Cinder Road', 'Imp Nest', 'Magma Falls', 'Brimstone Gate', 'Burning Ruins', 'Obsidian Field', 'Hellhound Kennels', 'The Rift', 'Azgaroth\'s Throne']
  },
  {
    id: 9, name: 'Dragonspire Peaks', theme: 'Dragonspire Peaks', faction: 'dragons', boss: 'elder_dragon',
    newTerrain: [], colors: ['#fca5a5', '#9f1239'],
    blurb: 'At the roof of the world, the Elder Dragon waits. End this.',
    places: ['Cultist Camp', 'Wyvern Roost', 'Scorched Steps', 'Drake Hatchery', 'Knight\'s Grave', 'Ember Glacier', 'Hoard Gate', 'Sky Bridge', 'Dragon\'s Maw', 'The Dragonspire']
  },
  {
    id: 10, name: 'The King\'s Road', theme: 'The King\'s Road', faction: 'orcs', allies: ['bandits', 'goblins'], boss: 'orc_warlord',
    newTerrain: ['village'], colors: ['#bef264', '#a16207'],
    blurb: 'The Iron Horde is back, burning the villages along the King\'s Road. Houses give cover and block arrows.',
    places: ['Haywain Village', 'Miller\'s Green', 'Burnt Barn', 'Crossroads Inn', 'Market Square', 'Old Watchtower', 'Bellwether Church', 'Windmill Hill', 'The Sacked Town', 'Gorrash Rides Again']
  },
  {
    id: 11, name: 'Hallowmere', theme: 'Hallowmere', faction: 'undead', allies: ['swamp'], boss: 'lich_king',
    newTerrain: [], colors: ['#fdba74', '#7c2d12'],
    blurb: 'Morthul has risen again, and the pumpkin fields of Hallowmere glow at night.',
    places: ['Pumpkin Patch', 'Lanternway', 'Scarecrow Field', 'Hollow Oak', 'Coffin Lane', 'Candle Crypt', 'Witchlight Bog', 'Ravenhall', 'The Bone Orchard', 'Morthul\'s Return']
  },
  {
    id: 12, name: 'The Underkeep', theme: 'The Underkeep', faction: 'infernal', allies: ['goblins'], boss: 'demon_lord',
    newTerrain: [], colors: ['#fca5a5', '#57534e'],
    blurb: 'Under the mountains lies the old keep. Demons and goblins fight over its treasure vaults.',
    places: ['Deepgate', 'Torchlit Hall', 'Pillar Maze', 'Collapsed Stair', 'Vault of Coins', 'Goblin Mines', 'Chained Bridge', 'Flooded Forge', 'Hall of Banners', 'The Pit Throne']
  },
  {
    id: 13, name: 'Rimeholt', theme: 'Rimeholt', faction: 'frost', allies: ['dragons'], boss: 'frost_giant', weather: 'blizzard',
    newTerrain: [], colors: ['#e0f2fe', '#1e3a8a'],
    blurb: 'Far north of the pass, the frost giants have woken the ice drakes.',
    places: ['Rime Gate', 'Frostfang Village', 'Shattered Lake', 'Iceveil Woods', 'Wyrm\'s Rest', 'Hoarfrost Keep', 'Glacier Tombs', 'Northwind Tower', 'Rimeholt Peak', 'Hrimgar\'s Vengeance']
  },
  {
    id: 14, name: 'The Last Bastion', theme: 'The Last Bastion', faction: 'dragons',
    allies: ['bandits', 'goblins', 'beasts', 'swamp', 'desert', 'frost', 'undead', 'orcs', 'infernal'], boss: 'elder_dragon',
    newTerrain: [], colors: ['#fde68a', '#7e22ce'],
    blurb: 'Every army you have beaten marches together on the realm\'s last fortress. Hold the line.',
    places: ['Outer Walls', 'Refugee Camp', 'Siege Lines', 'Burning Village', 'Broken Gate', 'Dragon\'s Shadow', 'Hall of Heroes', 'The Inner Keep', 'The Final Charge', 'The Last Bastion']
  }
];

export const LEVELS_PER_REGION = 10;
export const LEVEL_COUNT = REGIONS.length * LEVELS_PER_REGION;

export interface StarGoal {
  label: string;
}

export interface LevelDef {
  id: number; // 1..LEVEL_COUNT
  region: Region;
  // 0..9 within its region
  index: number;
  name: string;
  isBoss: boolean;
  // A champion (a strong regular) guards the castle
  isElite: boolean;
  settings: GameSettings;
  enemyRoster: TroopId[];
  // Stat multiplier applied to the enemy's troops
  enemyScale: number;
  // Level shown on enemy cards
  enemyTier: number;
  guards: GuardSpec[];
  recommendedPower: number;
  // Rounds to win within for the third star
  baseReward: number;
}

// How strong the enemy's troops are compared with the player's expected cards: the enemy's
// average troop power is this share of the model player's average card power. Tuned with the
// battle simulator (scripts/simulate-balance.ts) so a deck at recommended power usually, but not always, wins.
const ENEMY_STRENGTH = 0.82;
// Factions whose troops are cheaper or trickier than their power suggests (goblin swarms, undead
// healed by cursed ground) are toned down; the simulator measured these
const FACTION_STRENGTH: Partial<Record<Faction, number>> = {
  bandits: 0.88, goblins: 0.65, beasts: 1.02, swamp: 0.86, desert: 0.85, frost: 1.08, undead: 0.65, orcs: 0.89, infernal: 0.86, dragons: 1.16
};
// Later levels in a region are a little harder than earlier ones; the first meets a new enemy, so it is gentler
const IN_REGION_RAMP = 0.012;
const FIRST_LEVEL_EASE = 0.92;
// The first two battles are gentler still (the second, a little less so)
const TUTORIAL_EASE = 0.75;
const SECOND_TUTORIAL_EASE = 0.85;
// Bosses and champions are far tougher than a regular troop, so their stats are scaled less - a
// boss's attack much less than its health: it is a fortress of a troop that takes a whole army to
// bring down, and it fights with its power (bosses.ts) as much as its blows
const BOSS_STRENGTH = 0.42;
const BOSS_HEALTH = 1.0;
// ...adjusted per boss battle, as some bosses' abilities (flying, healing) count for more than others.
// Bosses stay big: a boss level's own troops are eased to make up for it (LEVEL_TUNING, tuned with
// the balance simulator's --troops-only --tune). Retuned for the small field to keep each boss battle
// about as hard as it was (between 30% and 75% of the model player's battles won), easing a boss
// to no less than 0.6 of its earlier size and its level's troops for the rest.
const BOSS_TUNING: Record<number, number> = {
  10: 0.48, 20: 1.22, 30: 0.58, 40: 0.48, 50: 0.91, 60: 1.6, 70: 0.66, 80: 0.58, 90: 0.53, 100: 0.5,
  110: 0.51, 120: 0.79, 130: 0.74, 140: 0.48, 150: 0.45
};
const CHAMPION_STRENGTH = 0.55;
// First level fought in the fog of war
export const FOG_FROM_LEVEL = 11;

// Share of battles the model player should win at each level (what the balance simulator tunes
// for): the first battles are gentle while the basics sink in, easing to the usual challenge by
// the middle of the second region
const BEGINNER_TARGET = 0.9;
const STANDARD_TARGET = 0.65;
const BEGINNER_LEVELS = 15;
export const targetWinRate = (levelId: number): number =>
  levelId > BEGINNER_LEVELS ? STANDARD_TARGET
    : BEGINNER_TARGET - (BEGINNER_TARGET - STANDARD_TARGET) * (levelId - 1) / BEGINNER_LEVELS;

const regularsOf = (faction: Faction): TroopId[] =>
  MOB_IDS.filter(id => TROOPS[id].faction === faction && !TROOPS[id].isBoss);

// The enemy's troop types: the region's faction, introduced a type or two at a time, joined
// later in the region by a troop from the previous region's faction, or by its allies'
const enemyRosterFor = (region: Region, index: number): TroopId[] => {
  const faction = regularsOf(region.faction);
  // A rematch starts from the faction's tougher troops
  const offset = region.allies ? 2 : 0;
  const own = [...faction.slice(offset), ...faction.slice(0, offset)];
  const count = index === 0 ? 1 : index <= 2 ? 2 : index <= 4 ? 3 : 4;
  const roster = own.slice(0, region.allies ? Math.min(count, 3) : count);
  if (region.allies) {
    // Allies join from the second battle: one troop, then two from the seventh
    const allyCount = index === 0 ? 0 : index < 6 ? 1 : 2;
    for (let i = 0; i < allyCount; i++) {
      const troops = regularsOf(region.allies[(index + i) % region.allies.length]);
      roster.push(troops[(region.id + index + i) % troops.length]);
    }
  } else if (region.id > 0 && (index === 6 || index === 8)) {
    const previous = regularsOf(REGIONS[region.id - 1].faction);
    roster.push(previous[(region.id + index) % previous.length]);
  }
  return roster;
};

// Average power of the model player's cards when reaching a level
// Evolved forms and skill trees count for part of the power they add: on paper they are worth more
// than they turn out to be in battle, the more so the stronger the forms get (measured with the
// balance simulator)
const weightAt = (levelId: number, early: number, late: number) =>
  early + (late - early) * Math.min(1, Math.max(0, (levelId - 20) / 100));
// Castles stand as many blows late in the campaign as early on: their health grows with the level of
// the cards fighting over them, as the troops' attack does
export const castleHealthFor = (cardLevel: number): number =>
  Math.round(DEFAULT_SETTINGS.castleHealth! * levelMultiplier(cardLevel));
// (in a campaign level, the card levels the level expects)
const castleHealthAt = (levelId: number): number => {
  const { deck, levels } = expectedProgression(levelId);
  return castleHealthFor(deck.reduce((sum, id) => sum + (levels[id] ?? 1), 0) / deck.length);
};

const expectedCardPower = (levelId: number) => {
  const { deck, levels, trees } = expectedProgression(levelId);
  const FORM_WEIGHT = weightAt(levelId, 1, 0.5);
  const TREE_WEIGHT = weightAt(levelId, 1, 0.8);
  return deck.reduce((sum, id) => {
    const level = levels[id] ?? 1;
    const base = cardPower(baseOf(id), level);
    const form = cardPower(id, level);
    return sum + base + FORM_WEIGHT * (form - base) + TREE_WEIGHT * (treeCardPower(id, level, trees) - form);
  }, 0) / Math.max(1, deck.length);
};

// Average power of a roster's troops at their base stats
const baseRosterPower = (roster: TroopId[]) =>
  roster.reduce((sum, id) => sum + statsPower(scaleTroop(TROOPS[id], 1)), 0) / Math.max(1, roster.length);

const levelCache = new Map<number, LevelDef>();

export const getLevel = (levelId: number): LevelDef => {
  const id = Math.min(Math.max(1, Math.round(levelId)), LEVEL_COUNT);
  const cached = levelCache.get(id);
  if (cached) return cached;

  const region = REGIONS[Math.floor((id - 1) / LEVELS_PER_REGION)];
  const index = (id - 1) % LEVELS_PER_REGION;
  const isBoss = index === LEVELS_PER_REGION - 1;
  const isElite = index === 4;
  const isTutorial = id === 1;

  const enemyRoster = enemyRosterFor(region, index);
  // Scale the enemy's troops so their average power tracks the player's expected cards
  const enemyScale = Math.round(
    expectedCardPower(id) / baseRosterPower(enemyRoster) * ENEMY_STRENGTH * (FACTION_STRENGTH[region.faction] ?? 1) *
    (1 + IN_REGION_RAMP * index) * (index === 0 ? FIRST_LEVEL_EASE : 1) * (isTutorial ? TUTORIAL_EASE : id === 2 ? SECOND_TUTORIAL_EASE : 1) *
    (LEVEL_TUNING[id - 1] ?? 1) * 100
  ) / 100;
  const enemyTier = Math.max(1, Math.round((enemyScale - 1) / 0.1) + 1);

  const guards: GuardSpec[] = [];
  if (isBoss) {
    const adjust = enemyScale * (BOSS_TUNING[id] ?? 1);
    const stats = scaleTroop(TROOPS[region.boss], adjust * BOSS_STRENGTH, enemyTier);
    stats.maxLifespan = scaleTroop(TROOPS[region.boss], adjust * BOSS_HEALTH, enemyTier).maxLifespan;
    guards.push({ type: region.boss, stats, isBoss: true });
  } else if (isElite) {
    // The strongest regular of the roster, a size up
    const champion = [...enemyRoster].sort((a, b) =>
      statsPower(scaleTroop(TROOPS[b], 1)) - statsPower(scaleTroop(TROOPS[a], 1)))[0];
    guards.push({ type: champion, stats: scaleTroop(TROOPS[champion], enemyScale * CHAMPION_STRENGTH, enemyTier), isChampion: true });
  }

  // The first battle is fought on a hand-laid field of its own (tutorialField.ts) 7 hexes across,
  // castles four hexes apart, with a lighter purse and castles; every other battle on the usual field
  // 9 hexes across (DEFAULT_SETTINGS)
  const settings: GameSettings = {
    ...DEFAULT_SETTINGS,
    aiDifficulty: isTutorial || id <= 6 ? 'easy' : id <= 35 ? 'medium' : 'hard',
    castleHealth: castleHealthAt(id),
    ...(isTutorial ? { gridSize: 3, maxRounds: 12, resourceHexCount: 0, castleHealth: 20, startingGold: 30 } : {}),
    aiIncomeBonus: isTutorial ? -2 : Math.floor((id - 1) / 25),
    // The fog of war rolls in from the second region, once the basics are learned
    fogOfWar: id >= FOG_FROM_LEVEL,
    themeName: region.theme,
    seed: 7919 * id + 104729,
    weather: region.weather
  };

  const level: LevelDef = {
    id,
    region,
    index,
    name: region.places[index],
    isBoss,
    isElite,
    settings,
    enemyRoster,
    enemyScale,
    enemyTier,
    guards,
    recommendedPower: recommendedPower(id),
    baseReward: baseLevelReward(id)
  };
  levelCache.set(id, level);
  return level;
};

export const getRegionLevels = (regionId: number): LevelDef[] =>
  Array.from({ length: LEVELS_PER_REGION }, (_, i) => getLevel(regionId * LEVELS_PER_REGION + i + 1));

// The enemy's recruitable troops for a level
// (goblins swarm: they come cheap)
export const enemyRosterStats = (level: LevelDef): Roster =>
  Object.fromEntries(level.enemyRoster.map(id => {
    const stats = scaleTroop(TROOPS[id], level.enemyScale, level.enemyTier);
    if (getFactionTrait(id)?.id === 'swarm') stats.cost = Math.max(1, Math.round(stats.cost * SWARM_COST));
    return [id, stats];
  }));

// Every troop type the player will face in a level (recruits and guards)
export const levelEnemies = (level: LevelDef): TroopId[] =>
  [...new Set([...level.guards.map(g => g.type), ...level.enemyRoster])];

// Stars: one for winning, and two and three for winning with enough points - kills, gold earned,
// camps held and a bonus for every round left (see getStarScore). The bars rise with the level's
// recommended power; the balance simulator put a typical win near the second and a strong one
// near the third.
const TWO_STAR_SHARE = 0.37;
const THREE_STAR_SHARE = 0.47;
const roundTo5 = (value: number) => Math.round(value / 5) * 5;
export const starThresholds = (level: LevelDef): [number, number] =>
  [roundTo5(level.recommendedPower * TWO_STAR_SHARE), roundTo5(level.recommendedPower * THREE_STAR_SHARE)];

export const starGoals = (level: LevelDef): string[] => {
  const [two, three] = starThresholds(level);
  return ['Win the battle', `Win with ${two}+ points`, `Win with ${three}+ points`];
};

// The same goals as short labels, with the full wording for a tooltip
export const starGoalLabels = (level: LevelDef): { short: string; full: string }[] => {
  const full = starGoals(level);
  const [two, three] = starThresholds(level);
  const how = ' (kills, gold, camps, and a bonus for every round left)';
  return [`Win`, `${two}+ pts`, `${three}+ pts`].map((short, i) => ({ short, full: i === 0 ? full[i] : full[i] + how }));
};

// Stars earned for a won battle with this many points
export const starsForWin = (level: LevelDef, points: number): number => {
  const [two, three] = starThresholds(level);
  return 1 + (points >= two ? 1 : 0) + (points >= three ? 1 : 0);
};
