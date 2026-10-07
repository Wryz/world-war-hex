import React from 'react';
import { IconType } from 'react-icons';
import {
  GiBroadsword,
  GiBowArrow,
  GiHorseHead,
  GiPikeman,
  GiHammerNails,
  GiWheat,
  GiPineTree,
  GiCactus,
  GiGoldMine,
  GiMountains,
  GiWaves,
  GiCrown,
  GiTwoCoins,
  GiCrossedSwords,
  GiHearts,
  GiFootprint,
  GiDeathSkull,
  GiSandsOfTime,
  GiCastle,
  GiCheckedShield,
  GiCampingTent,
  GiHills,
  GiSwamp,
  GiSnowflake1,
  GiFountain
} from 'react-icons/gi';
import {
  LuSave, LuCircleHelp, LuScrollText, LuArrowRight, LuChevronDown, LuRotateCcw, LuTriangleAlert,
  LuVolume2, LuVolumeX, LuHouse
} from 'react-icons/lu';
import { TerrainType, UnitType } from '@/types/game';

// SVG icons used throughout the game: Game Icons (game-icons.net) and Lucide, via react-icons

export const UNIT_ICONS: Record<UnitType, IconType> = {
  infantry: GiBroadsword,
  artillery: GiBowArrow,
  helicopter: GiHorseHead,
  tank: GiPikeman,
  medic: GiHammerNails
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
  spring: GiFountain
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
  spring: '#5eead4'
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

export const UnitIcon: React.FC<IconProps & { type: UnitType }> = ({ type, ...props }) => {
  const Icon = WRAPPED_UNIT_ICONS[type];
  return <Icon {...props} />;
};

export const TerrainIcon: React.FC<IconProps & { terrain: TerrainType }> = ({ terrain, ...props }) => {
  const Icon = WRAPPED_TERRAIN_ICONS[terrain];
  return <Icon {...props} />;
};

export const CrownIcon = icon(GiCrown, '#facc15');
export const GoldIcon = icon(GiTwoCoins, '#fbbf24');
export const AttackIcon = icon(GiCrossedSwords, '#f87171');
export const HealthIcon = icon(GiHearts, '#fb7185');
export const MoveIcon = icon(GiFootprint, '#93c5fd');
export const SkullIcon = icon(GiDeathSkull, '#f1f5f9');
export const WaitIcon = icon(GiSandsOfTime, '#e2e8f0');
export const CastleIcon = icon(GiCastle);
export const ShieldIcon = icon(GiCheckedShield, '#4ade80');
export const CampIcon = icon(GiCampingTent, '#facc15');
export const SaveIcon = icon(LuSave);
export const HelpIcon = icon(LuCircleHelp);
export const LogIcon = icon(LuScrollText);
export const ArrowIcon = icon(LuArrowRight);
export const ChevronIcon = icon(LuChevronDown);
export const ResumeIcon = icon(LuRotateCcw);
export const WarningIcon = icon(LuTriangleAlert);
export const SoundOnIcon = icon(LuVolume2);
export const SoundOffIcon = icon(LuVolumeX);
export const HomeIcon = icon(LuHouse);
