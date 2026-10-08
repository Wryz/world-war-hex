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
  GiFountain, GiLava, GiIceCube, GiBrokenWall, GiTombstone, GiCrownCoin, GiSwordsPower, GiPadlock, GiPokerHand,
  GiTreasureMap, GiFastForwardButton, GiUpgrade, GiTrophy, GiPodium, GiOpenBook, GiTargetArrows, GiHeartPlus,
  GiAngelWings, GiRegeneration, GiChestArmor, GiSiegeRam, GiAngryEyes, GiRaiseSkeleton, GiWingfoot, GiFireRing,
  GiSkullCrossedBones, GiLaurelCrown, GiStarMedal, GiRoundStar, GiSpellBook, GiLinkedRings, GiPaintBrush, GiCrosshair, GiFog
} from 'react-icons/gi';
import {
  LuSave, LuCircleHelp, LuScrollText, LuArrowRight, LuChevronDown, LuRotateCcw, LuTriangleAlert,
  LuVolume2, LuVolumeX, LuHouse, LuStar, LuDownload, LuUpload, LuMusic, LuShare2, LuX, LuChevronLeft, LuTrash2, LuPlay
} from 'react-icons/lu';
import { Ability, TerrainType, UnitType } from '@/types/game';

// SVG icons used throughout the game: Game Icons (game-icons.net) and Lucide, via react-icons

export const UNIT_ICONS: Record<UnitType, IconType> = {
  infantry: GiBroadsword, artillery: GiBowArrow, tank: GiPikeman, rogue: GiHoodedAssassin, helicopter: GiMountedKnight,
  medic: GiPointyHat, shieldbearer: GiShield, berserker: GiBattleAxe, longbow: GiBowman, cleric: GiPrayer,
  sapper: GiPowderBag, pegasus: GiPegasus, archmage: GiWizardFace,
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
  cursed: GiTombstone
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
  cursed: '#c084fc'
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
  magic: GiSpellBook
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
// Bonds between cards
export const BondIcon = icon(GiLinkedRings, '#fbbf24');
// Cosmetics: card frames and castle styles
export const StyleIcon = icon(GiPaintBrush, '#f0abfc');
export const MapIcon = icon(GiTreasureMap, '#fcd34d');
export const SpeedIcon = icon(GiFastForwardButton);
export const UpgradeIcon = icon(GiUpgrade, '#4ade80');
export const TrophyIcon = icon(GiTrophy, '#facc15');
export const StatsIcon = icon(GiPodium, '#a5b4fc');
export const BookIcon = icon(GiOpenBook, '#fca5a5');
export const BossIcon = icon(GiSkullCrossedBones, '#f87171');
export const LaurelIcon = icon(GiLaurelCrown, '#facc15');
export const MedalIcon = icon(GiStarMedal, '#facc15');
export const SaveIcon = icon(LuSave);
export const HelpIcon = icon(LuCircleHelp);
export const LogIcon = icon(LuScrollText);
export const ArrowIcon = icon(LuArrowRight);
export const BackIcon = icon(LuChevronLeft);
export const ChevronIcon = icon(LuChevronDown);
export const ResumeIcon = icon(LuRotateCcw);
export const WarningIcon = icon(LuTriangleAlert);
export const SoundOnIcon = icon(LuVolume2);
export const SoundOffIcon = icon(LuVolumeX);
export const MusicIcon = icon(LuMusic);
export const HomeIcon = icon(LuHouse);
export const DownloadIcon = icon(LuDownload);
export const UploadIcon = icon(LuUpload);
export const ShareIcon = icon(LuShare2);
export const CloseIcon = icon(LuX);
export const TrashIcon = icon(LuTrash2);
export const PlayIcon = icon(LuPlay);
