import React from 'react';
import { IconType } from 'react-icons';
import {
  GiBroadsword, GiBowArrow, GiPikeman, GiMountedKnight, GiPointyHat, GiHoodedAssassin, GiShield, GiBattleAxe,
  GiBowman, GiPrayer, GiPowderBag, GiPegasus, GiWizardFace, GiBrute, GiArcher, GiBandit, GiCavalry, GiBarbarian,
  GiGoblinHead, GiStonePile, GiWizardStaff, GiBombingRun, GiTroll, GiWolfHead, GiBoar, GiSpiderFace, GiBearHead,
  GiWolfHowl, GiSlime, GiLizardman, GiFrog, GiWitchFlight, GiHydra, GiScorpion, GiNinjaHead, GiMummyHead, GiGolemHead,
  GiPharoah, GiFrozenOrb, GiCaveman, GiElfHelmet, GiGiant, GiSkeleton, GiSkullShield, GiCrossbow, GiGhost,
  GiCrownedSkull, GiOrcHead, GiBroadheadArrow, GiTribalMask, GiOgre, GiHornedHelm, GiImpLaugh, GiMineralHeart, GiFlame,
  GiFlamingClaw, GiDaemonSkull, GiCowled, GiWyvern, GiDragonHead, GiBlackKnightHelm, GiSpikedDragonHead,
  GiWheat, GiPineTree, GiCactus, GiGoldMine, GiMountains, GiWaves, GiCrown, GiTwoCoins, GiCrossedSwords, GiHearts,
  GiFootprint, GiDeathSkull, GiSandsOfTime, GiCastle, GiCheckedShield, GiCampingTent, GiHills, GiSwamp, GiSnowflake1,
  GiFountain, GiLava, GiIceCube, GiBrokenWall, GiVillage, GiTombstone, GiCrownCoin, GiSwordsPower, GiPadlock, GiPokerHand,
  GiTreasureMap, GiFastForwardButton, GiUpgrade, GiTrophy, GiPodium, GiOpenBook, GiKnapsack, GiScrollQuill, GiPoisonBottle, GiSpiderWeb, GiSharpAxe, GiTargetArrows, GiHeartPlus,
  GiAngelWings, GiRegeneration, GiChestArmor, GiSiegeRam, GiAngryEyes, GiRaiseSkeleton, GiWingfoot, GiFireRing,
  GiSkullCrossedBones, GiLaurelCrown, GiStarMedal, GiRoundStar, GiSpellBook, GiLinkedRings, GiPaintBrush, GiCrosshair, GiFog,
  GiSparkles, GiAxeInStump, GiFire, GiBurningEmbers, GiLog, GiWatchtower, GiHouse, GiCatapult, GiAnvil, GiBarracksTent,
  GiBeerStein, GiWoodPile, GiPointing, GiTargeted, GiDemolish, GiTorch, GiHammerNails, GiStoneWall, GiGate, GiStoneBridge, GiSpikedFence,
  GiThreeFriends, GiUnlitBomb, GiSandstorm, GiStomp, GiTrumpet, GiMeteorImpact, GiFireBreath, GiDespair, GiPawPrint, GiSnowing,
  GiSmokingVolcano, GiGoblinCamp, GiWingedShield, GiFlyingFlag,
  GiShieldBash, GiWarAxe, GiHalberd, GiHammerDrop, GiPolarBear, GiStrong, GiSpyglass, GiHeavyArrow, GiCompass,
  GiFlamingArrow, GiCloakDagger, GiPentacle, GiVampireDracula, GiShieldReflect
} from 'react-icons/gi';
import {
  LuSave, LuCircleHelp, LuScrollText, LuArrowRight, LuCheck, LuSkipForward, LuUndo2, LuChevronDown, LuRotateCcw, LuTriangleAlert,
  LuVolume2, LuVolumeX, LuHouse, LuStar, LuDownload, LuUpload, LuMusic, LuShare2, LuX, LuChevronLeft, LuTrash2, LuPlay,
  LuSettings, LuBookOpen, LuGamepad2, LuPause, LuClapperboard
} from 'react-icons/lu';
import { Ability, TerrainType, UnitAction, UnitType } from '@/types/game';
import type { BossPowerId } from '@/lib/game/bosses';
import type { FactionTraitId, WeatherId } from '@/lib/game/regionRules';
import type { AttributeId, PlayerSkillId } from '@/lib/game/lineages';

// SVG icons used throughout the game: Game Icons (game-icons.net) and Lucide, via react-icons

export const UNIT_ICONS: Record<UnitType, IconType> = {
  infantry: GiBroadsword, artillery: GiBowArrow, tank: GiPikeman, rogue: GiHoodedAssassin, helicopter: GiMountedKnight,
  medic: GiPointyHat, engineer: GiHammerNails, shieldbearer: GiShield, berserker: GiBattleAxe, longbow: GiBowman, cleric: GiPrayer,
  sapper: GiPowderBag, pegasus: GiPegasus, archmage: GiWizardFace,
  warden: GiShieldBash, warlord: GiWarAxe, crossbow: GiCrossbow, halberdier: GiHalberd, wolf_rider: GiWolfHowl,
  siege_engineer: GiHammerDrop, bear_warden: GiPolarBear,
  bandit_thug: GiBrute, bandit_archer: GiArcher, highwayman: GiBandit, bandit_raider: GiCavalry, bandit_king: GiBarbarian,
  goblin_scrapper: GiGoblinHead, goblin_slinger: GiStonePile, goblin_shaman: GiWizardStaff, goblin_sapper: GiBombingRun,
  goblin_warchief: GiTroll,
  grey_wolf: GiWolfHead, wild_boar: GiBoar, giant_spider: GiSpiderFace, cave_bear: GiBearHead, alpha_direwolf: GiWolfHowl,
  bog_slime: GiSlime, lizardman: GiLizardman, toxic_toad: GiFrog, swamp_witch: GiWitchFlight, bog_hydra: GiHydra,
  giant_scorpion: GiScorpion, sand_raider: GiNinjaHead, mummy: GiMummyHead, sand_golem: GiGolemHead, pharaoh: GiPharoah,
  snow_wolf: GiWolfHead, ice_wraith: GiFrozenOrb, yeti: GiCaveman, frost_huntress: GiElfHelmet, frost_giant: GiGiant,
  skeleton_minion: GiSkeleton, skeleton_warrior: GiSkullShield, skeleton_archer: GiCrossbow, ghost: GiGhost,
  lich_king: GiCrownedSkull,
  orc_grunt: GiOrcHead, orc_archer: GiBroadheadArrow, orc_shaman: GiTribalMask, ogre: GiOgre, orc_warlord: GiHornedHelm,
  imp: GiImpLaugh, magma_golem: GiMineralHeart, fire_elemental: GiFlame, hellhound: GiFlamingClaw, demon_lord: GiDaemonSkull,
  dragon_cultist: GiCowled, wyvern: GiWyvern, drake: GiDragonHead, dragon_knight: GiBlackKnightHelm,
  elder_dragon: GiSpikedDragonHead
};

export const TERRAIN_ICON_COMPONENTS: Record<TerrainType, IconType> = {
  plain: GiWheat,
  forest: GiPineTree,
  desert: GiCactus,
  resource: GiGoldMine,
  mountain: GiMountains,
  water: GiWaves,
  hills: GiHills,
  swamp: GiSwamp,
  snow: GiSnowflake1,
  spring: GiFountain,
  lava: GiLava,
  ice: GiIceCube,
  ruins: GiBrokenWall,
  village: GiVillage,
  cursed: GiTombstone,
  watchtower: GiWatchtower,
  house: GiHouse,
  catapult: GiCatapult,
  blacksmith: GiAnvil,
  barracks: GiBarracksTent,
  tavern: GiBeerStein,
  lumbermill: GiWoodPile,
  wall: GiStoneWall,
  gate: GiGate,
  bridge: GiStoneBridge
};

// Colours that make each terrain icon recognisable at a glance
export const TERRAIN_ICON_COLORS: Record<TerrainType, string> = {
  plain: '#a3e635',
  forest: '#4ade80',
  desert: '#fcd34d',
  resource: '#fbbf24',
  mountain: '#cbd5e1',
  water: '#38bdf8',
  hills: '#bef264',
  swamp: '#86a873',
  snow: '#e0f2fe',
  spring: '#5eead4',
  lava: '#fb923c',
  ice: '#a5f3fc',
  ruins: '#d6c7a1',
  village: '#fde68a',
  cursed: '#c084fc',
  watchtower: '#e2e8f0',
  house: '#fdba74',
  catapult: '#d6d3d1',
  blacksmith: '#94a3b8',
  barracks: '#f87171',
  tavern: '#fbbf24',
  lumbermill: '#d97706',
  wall: '#cbd5e1',
  gate: '#e2e8f0',
  bridge: '#d6d3d1'
};

export const ABILITY_ICON_COMPONENTS: Record<Ability, IconType> = {
  rangedAttack: GiBowArrow,
  longRange: GiTargetArrows,
  healing: GiHeartPlus,
  terrainBonus: GiPineTree,
  rapidMovement: GiWingfoot,
  stealth: GiHoodedAssassin,
  flying: GiAngelWings,
  regenerate: GiRegeneration,
  armored: GiChestArmor,
  siege: GiSiegeRam,
  berserk: GiAngryEyes,
  undead: GiRaiseSkeleton,
  pathfinder: GiFootprint,
  fireborn: GiFireRing,
  magic: GiSpellBook,
  demolition: GiDemolish,
  firebrand: GiTorch,
  engineering: GiHammerNails,
  fearless: GiStrong,
  keenEyed: GiSpyglass,
  reach: GiHalberd,
  heavyBolts: GiHeavyArrow,
  masterBuilder: GiCompass
};

interface IconProps {
  className?: string;
  title?: string;
  color?: string;
}

const icon = (Component: IconType, defaultColor?: string) => {
  const Wrapped: React.FC<IconProps> = ({ className = '', title, color }) => (
    <Component
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      color={color ?? defaultColor}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
  return Wrapped;
};

const WRAPPED_UNIT_ICONS = Object.fromEntries(
  Object.entries(UNIT_ICONS).map(([type, Component]) => [type, icon(Component)])
) as Record<UnitType, React.FC<IconProps>>;

const WRAPPED_TERRAIN_ICONS = Object.fromEntries(
  Object.entries(TERRAIN_ICON_COMPONENTS).map(([terrain, Component]) =>
    [terrain, icon(Component, TERRAIN_ICON_COLORS[terrain as TerrainType])]
  )
) as Record<TerrainType, React.FC<IconProps>>;

const WRAPPED_ABILITY_ICONS = Object.fromEntries(
  Object.entries(ABILITY_ICON_COMPONENTS).map(([ability, Component]) => [ability, icon(Component)])
) as Record<Ability, React.FC<IconProps>>;

export const UnitIcon: React.FC<IconProps & { type: UnitType }> = ({ type, ...props }) => {
  const Icon = WRAPPED_UNIT_ICONS[type] ?? WRAPPED_UNIT_ICONS.infantry;
  return <Icon {...props} />;
};

export const TerrainIcon: React.FC<IconProps & { terrain: TerrainType }> = ({ terrain, ...props }) => {
  const Icon = WRAPPED_TERRAIN_ICONS[terrain];
  return <Icon {...props} />;
};

export const AbilityIcon: React.FC<IconProps & { ability: Ability }> = ({ ability, ...props }) => {
  const Icon = WRAPPED_ABILITY_ICONS[ability];
  return <Icon {...props} />;
};

export const CrownIcon = icon(GiCrown, '#facc15');
// In-battle gold
export const GoldIcon = icon(GiTwoCoins, '#fbbf24');
// Campaign coins, spent in the shop
export const CoinIcon = icon(GiCrownCoin, '#fde047');
export const PowerIcon = icon(GiSwordsPower, '#fb923c');
export const StarIcon = icon(LuStar, '#facc15');
// A star that has been earned
export const FilledStarIcon = icon(GiRoundStar, '#facc15');
export const AttackIcon = icon(GiCrossedSwords, '#f87171');
export const HealthIcon = icon(GiHearts, '#fb7185');
export const MoveIcon = icon(GiFootprint, '#93c5fd');
export const SkullIcon = icon(GiDeathSkull, '#f1f5f9');
export const WaitIcon = icon(GiSandsOfTime, '#e2e8f0');
export const CastleIcon = icon(GiCastle);
export const ShieldIcon = icon(GiCheckedShield, '#4ade80');
export const CampIcon = icon(GiCampingTent, '#facc15');
export const LockIcon = icon(GiPadlock, '#94a3b8');
export const CardsIcon = icon(GiPokerHand, '#93c5fd');
// Threat preview toggle, and the fog of war
export const ThreatIcon = icon(GiCrosshair, '#f87171');
export const FogIcon = icon(GiFog, '#cbd5e1');
// Formations: troops fighting together, and an enemy pinned in place
export const FormationIcon = icon(GiLinkedRings, '#fbbf24');
export const PinnedIcon = icon(GiCrossedSwords, '#f87171');
// Morale and faction traits
export const ShakenIcon = icon(GiDespair, '#a5b4fc');
export const UndyingIcon = icon(GiRaiseSkeleton, '#c4b5fd');
export const FuryIcon = icon(GiAngryEyes, '#f87171');
export const PackIcon = icon(GiPawPrint, '#d6d3d1');
// Monster skills: the troop's own trick, venom working in a troop, and a web or chill slowing it
export const MonsterSkillIcon = icon(GiSharpAxe, '#fda4af');
export const VenomIcon = icon(GiPoisonBottle, '#a3e635');
export const SlowedIcon = icon(GiSpiderWeb, '#cbd5e1');
// Cosmetics: card frames and castle styles
export const StyleIcon = icon(GiPaintBrush, '#f0abfc');
export const MapIcon = icon(GiTreasureMap, '#fcd34d');
export const SpeedIcon = icon(GiFastForwardButton);
export const UpgradeIcon = icon(GiUpgrade, '#4ade80');
export const TrophyIcon = icon(GiTrophy, '#facc15');
export const StatsIcon = icon(GiPodium, '#a5b4fc');
export const BookIcon = icon(GiOpenBook, '#fca5a5');
// The satchel of materials gathered in battle, and the Chronicle of the realm's history
export const SatchelIcon = icon(GiKnapsack, '#d6a46b');
export const ChronicleIcon = icon(GiScrollQuill, '#fcd34d');
export const BossIcon = icon(GiSkullCrossedBones, '#f87171');
export const LaurelIcon = icon(GiLaurelCrown, '#facc15');
export const MedalIcon = icon(GiStarMedal, '#facc15');
export const SaveIcon = icon(LuSave);
export const HelpIcon = icon(LuCircleHelp);
export const SettingsIcon = icon(LuSettings);
export const GuideIcon = icon(LuBookOpen);
export const GameplayIcon = icon(LuGamepad2);
export const LogIcon = icon(LuScrollText);
export const ArrowIcon = icon(LuArrowRight);
export const CheckIcon = icon(LuCheck);
export const SkipIcon = icon(LuSkipForward);
export const UndoIcon = icon(LuUndo2);
export const BackIcon = icon(LuChevronLeft);
export const ChevronIcon = icon(LuChevronDown);
export const ResumeIcon = icon(LuRotateCcw);
export const WarningIcon = icon(LuTriangleAlert);
export const SoundOnIcon = icon(LuVolume2);
export const SoundOffIcon = icon(LuVolumeX);
export const MusicIcon = icon(LuMusic);
export const HomeIcon = icon(LuHouse);
// Giving up a battle
export const ResignIcon = icon(GiFlyingFlag, '#e2e8f0');
export const DownloadIcon = icon(LuDownload);
export const UploadIcon = icon(LuUpload);
export const ShareIcon = icon(LuShare2);
export const CloseIcon = icon(LuX);
export const TrashIcon = icon(LuTrash2);
export const PlayIcon = icon(LuPlay);
export const PauseIcon = icon(LuPause);
// Watching a battle again
export const ReplayIcon = icon(LuClapperboard);

// A card's signature ability
export const SignatureIcon = icon(GiSparkles, '#f0abfc');

// Battlefield objects: a great tree to fell, the log it leaves, fire and the embers before it
export const FellIcon = icon(GiAxeInStump, '#a16207');
export const FallenLogIcon = icon(GiLog, '#92400e');
export const FireIcon = icon(GiFire, '#f97316');
export const FrozenIcon = icon(GiIceCube, '#67e8f9');
export const EmbersIcon = icon(GiBurningEmbers, '#fb923c');
// Stakes planted against cavalry
export const StakesIcon = icon(GiSpikedFence, '#a16207');

// Work a troop does instead of moving
const ACTION_ICONS: Record<UnitAction, React.FC<IconProps>> = {
  demolish: icon(GiDemolish, '#0f172a'),
  ignite: icon(GiTorch, '#0f172a'),
  bridge: icon(GiStoneBridge, '#0f172a'),
  stakes: icon(GiSpikedFence, '#0f172a')
};
export const ActionIcon: React.FC<IconProps & { action: UnitAction }> = ({ action, ...props }) => {
  const Icon = ACTION_ICONS[action];
  return <Icon {...props} />;
};

// The tutorial's guiding hand, and the target it marks
export const PointingHandIcon = icon(GiPointing, '#fde68a');
export const TargetIcon = icon(GiTargeted, '#ef4444');

// Bosses' powers, in the colour each one strikes with
export const BOSS_POWER_COLORS: Record<BossPowerId, string> = {
  callTheGang: '#f87171', goblinBombs: '#fb923c', howl: '#cbd5e1', manyHeads: '#4ade80', sandstorm: '#fcd34d',
  iceStomp: '#67e8f9', raiseDead: '#c084fc', rallyHorde: '#f87171', hellfire: '#f97316', dragonBreath: '#fb923c'
};
const BOSS_POWER_ICONS: Record<BossPowerId, IconType> = {
  callTheGang: GiThreeFriends, goblinBombs: GiUnlitBomb, howl: GiWolfHowl, manyHeads: GiHydra, sandstorm: GiSandstorm,
  iceStomp: GiStomp, raiseDead: GiRaiseSkeleton, rallyHorde: GiTrumpet, hellfire: GiMeteorImpact, dragonBreath: GiFireBreath
};
const BOSS_POWER_ICON_COMPONENTS = Object.fromEntries(
  Object.entries(BOSS_POWER_ICONS).map(([power, Icon]) => [power, icon(Icon, BOSS_POWER_COLORS[power as BossPowerId])])
) as Record<BossPowerId, React.FC<IconProps>>;
export const BossPowerIcon: React.FC<IconProps & { power: BossPowerId }> = ({ power, ...props }) => {
  const Icon = BOSS_POWER_ICON_COMPONENTS[power];
  return <Icon {...props} />;
};

// Weather, in its own colour
export const WEATHER_COLORS: Record<WeatherId, string> = { fogBanks: '#e2e8f0', sandstorm: '#fcd34d', blizzard: '#bae6fd', ashfall: '#fb923c' };
const WEATHER_ICON_COMPONENTS: Record<WeatherId, React.FC<IconProps>> = {
  fogBanks: icon(GiFog, WEATHER_COLORS.fogBanks), sandstorm: icon(GiSandstorm, WEATHER_COLORS.sandstorm),
  blizzard: icon(GiSnowing, WEATHER_COLORS.blizzard), ashfall: icon(GiSmokingVolcano, WEATHER_COLORS.ashfall)
};
export const WeatherIcon: React.FC<IconProps & { weather: WeatherId }> = ({ weather, ...props }) => {
  const Icon = WEATHER_ICON_COMPONENTS[weather];
  return <Icon {...props} />;
};

// Faction traits
const TRAIT_ICON_COMPONENTS: Record<FactionTraitId, React.FC<IconProps>> = {
  swarm: icon(GiGoblinCamp, '#a3e635'), pack: PackIcon, bogborn: icon(GiSwamp, '#5eead4'), sandborn: icon(GiSandstorm, '#fcd34d'),
  frostborn: icon(GiSnowflake1, '#bae6fd'), undying: UndyingIcon, fury: FuryIcon, fireborn: icon(GiFireRing, '#fb923c'),
  skyborne: icon(GiWingedShield, '#fda4af')
};
export const TraitIcon: React.FC<IconProps & { trait: FactionTraitId }> = ({ trait, ...props }) => {
  const Icon = TRAIT_ICON_COMPONENTS[trait];
  return <Icon {...props} />;
};

// Skill tree attributes and skills
export const ATTRIBUTE_ICONS: Record<AttributeId, IconType> = {
  hardy: GiHeartPlus, drilled: GiCrossedSwords, swift: GiWingfoot, trailblazer: GiFootprint, keen: GiSpyglass,
  steadfast: GiStrong, mender: GiRegeneration
};
export const PLAYER_SKILL_ICONS: Record<PlayerSkillId, IconType> = {
  rally: GiFlyingFlag, executioner: GiSharpAxe, fireArrows: GiFlamingArrow, huntersMark: GiTargetArrows, bulwark: GiCheckedShield,
  impale: GiHalberd, poisonedBlades: GiPoisonBottle, ambush: GiCloakDagger, hex: GiPentacle, lifeSiphon: GiVampireDracula,
  guard: GiShieldReflect, fortify: GiStoneWall
};
