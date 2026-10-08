import type { GameSettings, Roster, TerrainType } from '@/types/game';
import type { GuardSpec } from '../game/gameState';
import { Faction, MOB_IDS, TROOPS, TroopId, cardPower, scaleTroop, statsPower } from '../game/troops';
import { expectedProgression, recommendedPower, baseLevelReward } from '../meta/economy';
import { LEVEL_TUNING } from './levelTuning';

// The campaign: ten regions of ten levels each. Every region has its own map theme, enemy
// faction and terrain; the tenth level of each is a boss battle. Enemies get stronger level by
// level, in step with how strong the player can expect their cards to be by then.

export interface Region {
  id: number;
  name: string;
  // Map theme (see mapGenerator REGION_THEMES)
  theme: string;
  faction: Faction;
  boss: TroopId;
  // Terrain this region introduces
  newTerrain: TerrainType[];
  blurb: string;
  // Colours of the region's band on the campaign map: ground, accent
  colors: [string, string];
  // Names of the ten battles
  places: string[];
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
    id: 3, name: 'Mirefen Marsh', theme: 'Mirefen Marsh', faction: 'swamp', boss: 'bog_hydra',
    newTerrain: ['swamp'], colors: ['#7fa36b', '#0f766e'],
    blurb: 'The marsh is rising, and so is whatever lives beneath it.',
    places: ['Reedwater', 'Sinking Steps', 'Slime Pools', 'Witch\'s Hut', 'Croaking Fen', 'Drowned Chapel', 'Lizard Shoals', 'Gloomwater', 'Hag\'s Cauldron', 'The Hydra\'s Lair']
  },
  {
    id: 4, name: 'Sunscorch Desert', theme: 'Sunscorch Desert', faction: 'desert', boss: 'pharaoh',
    newTerrain: ['desert', 'ruins'], colors: ['#ffd97a', '#b45309'],
    blurb: 'Raiders have broken open the tombs of the old kings.',
    places: ['Oasis Gate', 'Dune Sea', 'Scorpion Flats', 'Broken Obelisk', 'Sandstorm Road', 'Sunken Temple', 'Valley of Kings', 'Golem Quarry', 'Mirage Walls', 'The Pharaoh\'s Tomb']
  },
  {
    id: 5, name: 'Frostpeak Pass', theme: 'Frostpeak Pass', faction: 'frost', boss: 'frost_giant',
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
    id: 8, name: 'Emberforge Wastes', theme: 'Emberforge Wastes', faction: 'infernal', boss: 'demon_lord',
    newTerrain: ['lava'], colors: ['#f97316', '#7f1d1d'],
    blurb: 'A rift has opened in the Emberforge. Demons pour through it.',
    places: ['Ashfall', 'Cinder Road', 'Imp Nest', 'Magma Falls', 'Brimstone Gate', 'Burning Ruins', 'Obsidian Field', 'Hellhound Kennels', 'The Rift', 'Azgaroth\'s Throne']
  },
  {
    id: 9, name: 'Dragonspire Peaks', theme: 'Dragonspire Peaks', faction: 'dragons', boss: 'elder_dragon',
    newTerrain: [], colors: ['#fca5a5', '#9f1239'],
    blurb: 'At the roof of the world, the Elder Dragon waits. End this.',
    places: ['Cultist Camp', 'Wyvern Roost', 'Scorched Steps', 'Drake Hatchery', 'Knight\'s Grave', 'Ember Glacier', 'Hoard Gate', 'Sky Bridge', 'Dragon\'s Maw', 'The Dragonspire']
  }
];

export const LEVELS_PER_REGION = 10;
export const LEVEL_COUNT = REGIONS.length * LEVELS_PER_REGION;

export interface StarGoal {
  label: string;
}

export interface LevelDef {
  id: number; // 1..100
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
  fastRounds: number;
  baseReward: number;
}

// How strong the enemy's troops are compared with the player's expected cards: the enemy's
// average troop power is this share of the model player's average card power. Tuned with the
// battle simulator (scripts/simulate-balance.ts) so a deck at recommended power usually, but not always, wins.
const ENEMY_STRENGTH = 0.835;
// Factions whose troops are cheaper or trickier than their power suggests (goblin swarms, undead
// healed by cursed ground) are toned down; the simulator measured these
const FACTION_STRENGTH: Partial<Record<Faction, number>> = {
  bandits: 1.06, goblins: 0.79, beasts: 0.87, swamp: 0.59, desert: 0.49, frost: 0.52, undead: 0.55, orcs: 0.54, infernal: 0.42, dragons: 0.6
};
// Later levels in a region are a little harder than earlier ones; the first meets a new enemy, so it is gentler
const IN_REGION_RAMP = 0.012;
const FIRST_LEVEL_EASE = 0.92;
// The tutorial battle is gentler still
const TUTORIAL_EASE = 0.75;
// Bosses and champions are far tougher than a regular troop, so their stats are scaled less
const BOSS_STRENGTH = 0.42;
// ...adjusted per boss, as some abilities (flying, healing) count for more than others
const BOSS_ADJUST: Partial<Record<TroopId, number>> = {
  goblin_warchief: 1.25, alpha_direwolf: 0.65, bog_hydra: 0.8, pharaoh: 0.8, lich_king: 0.75,
  orc_warlord: 1.3, demon_lord: 0.5, elder_dragon: 0.8
};
const CHAMPION_STRENGTH = 0.55;
// First level fought in the fog of war
export const FOG_FROM_LEVEL = 11;

const regularsOf = (faction: Faction): TroopId[] =>
  MOB_IDS.filter(id => TROOPS[id].faction === faction && !TROOPS[id].isBoss);

// The enemy's troop types: the region's faction, introduced a type or two at a time, joined
// later in the region by a troop from the previous region's faction
const enemyRosterFor = (region: Region, index: number): TroopId[] => {
  const own = regularsOf(region.faction);
  const count = index === 0 ? 1 : index <= 2 ? 2 : index <= 4 ? 3 : 4;
  const roster = own.slice(0, count);
  if (region.id > 0 && (index === 6 || index === 8)) {
    const previous = regularsOf(REGIONS[region.id - 1].faction);
    roster.push(previous[(region.id + index) % previous.length]);
  }
  return roster;
};

// Average power of the model player's cards when reaching a level
const expectedCardPower = (levelId: number) => {
  const { deck, levels } = expectedProgression(levelId);
  return deck.reduce((sum, id) => sum + cardPower(id, levels[id] ?? 1), 0) / Math.max(1, deck.length);
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
    (1 + IN_REGION_RAMP * index) * (index === 0 ? FIRST_LEVEL_EASE : 1) * (isTutorial ? TUTORIAL_EASE : 1) *
    (LEVEL_TUNING[id - 1] ?? 1) * 100
  ) / 100;
  const enemyTier = Math.max(1, Math.round((enemyScale - 1) / 0.1) + 1);
  const gridSize = region.id < 2 ? 4 : 5;
  const maxRounds = gridSize === 4 ? 10 : 12;

  const guards: GuardSpec[] = [];
  if (isBoss) {
    guards.push({ type: region.boss, stats: scaleTroop(TROOPS[region.boss], enemyScale * BOSS_STRENGTH * (BOSS_ADJUST[region.boss] ?? 1), enemyTier), isBoss: true });
  } else if (isElite) {
    // The strongest regular of the roster, a size up
    const champion = [...enemyRoster].sort((a, b) =>
      statsPower(scaleTroop(TROOPS[b], 1)) - statsPower(scaleTroop(TROOPS[a], 1)))[0];
    guards.push({ type: champion, stats: scaleTroop(TROOPS[champion], enemyScale * CHAMPION_STRENGTH, enemyTier) });
  }

  const settings: GameSettings = {
    gridSize,
    planningPhaseTime: 30,
    aiDifficulty: isTutorial || id <= 6 ? 'easy' : id <= 35 ? 'medium' : 'hard',
    resourceHexCount: gridSize === 4 ? 3 : 4,
    castleHealth: gridSize === 4 ? 45 : 54,
    startingGold: 30,
    aiIncomeBonus: isTutorial ? -2 : Math.floor((id - 1) / 25),
    maxRounds,
    // The fog of war rolls in from the second region, once the basics are learned
    fogOfWar: id >= FOG_FROM_LEVEL,
    themeName: region.theme,
    seed: 7919 * id + 104729
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
    fastRounds: Math.ceil(maxRounds * 0.7),
    baseReward: baseLevelReward(id)
  };
  levelCache.set(id, level);
  return level;
};

export const getRegionLevels = (regionId: number): LevelDef[] =>
  Array.from({ length: LEVELS_PER_REGION }, (_, i) => getLevel(regionId * LEVELS_PER_REGION + i + 1));

// The enemy's recruitable troops for a level
export const enemyRosterStats = (level: LevelDef): Roster =>
  Object.fromEntries(level.enemyRoster.map(id => [id, scaleTroop(TROOPS[id], level.enemyScale, level.enemyTier)]));

// Every troop type the player will face in a level (recruits and guards)
export const levelEnemies = (level: LevelDef): TroopId[] =>
  [...new Set([...level.guards.map(g => g.type), ...level.enemyRoster])];

export const starGoals = (level: LevelDef): string[] => [
  'Win the battle',
  'Win with your castle above half health',
  `Win within ${level.fastRounds} rounds`
];

// Stars earned for a won battle
export const starsForWin = (level: LevelDef, castleRatio: number, rounds: number): number =>
  1 + (castleRatio > 0.5 ? 1 : 0) + (rounds <= level.fastRounds ? 1 : 0);
