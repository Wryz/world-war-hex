import React from 'react';
import type { IconType } from 'react-icons';
import {
  GiAncientRuins, GiAnimalHide, GiBandana, GiBarrel, GiBigDiamondRing, GiBoneKnife, GiBrickWall,
  GiBrokenTablet, GiBurningEmbers, GiCampingTent, GiCoalPile, GiCrownedHeart, GiCrystalCluster,
  GiDeadWood, GiDevilMask, GiDragonHead, GiDroplets, GiFangs, GiFireGem, GiFlintSpark, GiFrozenOrb, GiGate, GiGauntlet, GiGears,
  GiGhost, GiGoldNuggets, GiHeartBeats, GiHerbsBundle, GiHornedSkull, GiHut, GiIceCube, GiLantern, GiLilyPads, GiLog,
  GiMetalBar, GiMummyHead, GiMushroomGills, GiNails, GiOre, GiPoison, GiPowder, GiPumpkin, GiReed, GiRingingBell,
  GiRopeCoil, GiRuneStone, GiSaltShaker, GiScales, GiScarabBeetle, GiScorpionTail, GiScrollUnfurled, GiSkullCrack, GiSlime,
  GiSnowflake1, GiSpectre, GiSpiderWeb, GiSpikedDragonHead, GiSpyglass, GiStoneBlock, GiStonePile, GiStoneTablet, GiSun,
  GiSwapBag, GiTatteredBanner, GiTiara, GiTotem, GiTusksFlag, GiRolledCloth, GiPolarBear, GiWarhammer, GiWaterFlask, GiWheat, GiWolfHead, GiWoodBeam,
  GiWoodPile, GiWool, GiWaxSeal, GiOrcHead, GiCrossedBones, GiWoodenCrate
} from 'react-icons/gi';
import { MATERIALS, MaterialId, MaterialRarity, isMaterialId } from '@/lib/game/materials';

// Each material's icon, and the colour of its rarity

const ICONS: Record<MaterialId, IconType> = {
  wild_herbs: GiHerbsBundle, wheat_sheaf: GiWheat, wool_tuft: GiWool, timber: GiWoodPile, pine_resin: GiDroplets,
  glowcap: GiMushroomGills, granite: GiStoneBlock, flint: GiFlintSpark, iron_ore: GiOre, reeds: GiReed, bog_peat: GiStonePile,
  lily_pad: GiLilyPads, sunstone: GiSun, desert_glass: GiCrystalCluster, frost_salt: GiSaltShaker, glacier_ice: GiIceCube,
  obsidian: GiFireGem, brimstone: GiPowder, grave_dust: GiSkullCrack, ancient_masonry: GiAncientRuins, hallow_pumpkin: GiPumpkin,
  heartwood: GiLog, charcoal: GiCoalPile, spring_water: GiWaterFlask, gold_nugget: GiGoldNuggets,
  tent_canvas: GiCampingTent, roof_thatch: GiHut, clay_bricks: GiBrickWall, spyglass_lens: GiSpyglass, siege_rope: GiRopeCoil,
  steel_ingot: GiMetalBar, banner_cloth: GiRolledCloth, oak_staves: GiBarrel, sawn_planks: GiWoodBeam, gate_iron: GiGate,
  stolen_purse: GiSwapBag, red_bandana: GiBandana, goblin_tooth: GiFangs, scrap_metal: GiGears, beast_pelt: GiAnimalHide,
  spider_silk: GiSpiderWeb, slime_gel: GiSlime, toad_venom: GiPoison, mummy_wrap: GiMummyHead, scorpion_stinger: GiScorpionTail,
  yeti_fur: GiPolarBear, wraith_essence: GiSpectre, bone_shard: GiBoneKnife, ectoplasm: GiGhost, orc_tusk: GiTusksFlag,
  iron_rivets: GiNails, imp_horn: GiHornedSkull, hellfire_ash: GiBurningEmbers, drake_scale: GiScales, wyvern_talon: GiSpikedDragonHead,
  bandit_signet: GiBigDiamondRing, warchief_totem: GiTotem, direwolf_fang: GiWolfHead, hydra_heart: GiHeartBeats,
  pharaoh_scarab: GiScarabBeetle, rime_core: GiFrozenOrb, phylactery_shard: GiCrossedBones, war_horn: GiOrcHead,
  demon_horn: GiDevilMask, heartscale: GiDragonHead,
  waystone_fragment: GiRuneStone, banner_gauntlet: GiGauntlet, dragonbone: GiDeadWood, drowned_bell: GiRingingBell,
  kings_tablet: GiStoneTablet, frozen_oath: GiSnowflake1, morthul_letter: GiWaxSeal, broken_standard: GiTatteredBanner,
  forge_hammer: GiWarhammer, crown_shard: GiCrownedHeart, herald_horn: GiScrollUnfurled, keeper_lantern: GiLantern,
  vault_ledger: GiWoodenCrate, giant_treaty: GiBrokenTablet, empty_circlet: GiTiara
};

export const RARITY_COLORS: Record<MaterialRarity, { text: string; ring: string; glow: string; label: string }> = {
  common: { text: '#e2e8f0', ring: '#64748b', glow: 'rgba(148,163,184,0.35)', label: 'Common' },
  uncommon: { text: '#86efac', ring: '#16a34a', glow: 'rgba(34,197,94,0.35)', label: 'Uncommon' },
  rare: { text: '#7dd3fc', ring: '#0284c7', glow: 'rgba(14,165,233,0.4)', label: 'Rare' },
  epic: { text: '#d8b4fe', ring: '#9333ea', glow: 'rgba(168,85,247,0.45)', label: 'Epic' },
  legendary: { text: '#fcd34d', ring: '#d97706', glow: 'rgba(245,158,11,0.5)', label: 'Legendary' }
};

export const MaterialIcon: React.FC<{ id: MaterialId; className?: string; color?: string }> = ({ id, className = '', color }) => {
  // (an unknown id, from a hand-edited save, shows nothing rather than breaking the page)
  if (!isMaterialId(id)) return null;
  const Icon = ICONS[id];
  return <Icon className={`inline-block shrink-0 align-[-0.125em] ${className}`} color={color ?? RARITY_COLORS[MATERIALS[id].rarity].text} aria-hidden />;
};

// A material in a rounded tile tinted by its rarity, with a count
export const MaterialTile: React.FC<{ id: MaterialId; count?: number; size?: 'sm' | 'md' | 'lg'; dim?: boolean; title?: string }> = ({
  id, count, size = 'md', dim = false, title
}) => {
  if (!isMaterialId(id)) return null;
  const rarity = RARITY_COLORS[MATERIALS[id].rarity];
  const box = size === 'sm' ? 'h-9 w-9 text-xl' : size === 'lg' ? 'h-16 w-16 text-4xl' : 'h-12 w-12 text-2xl';
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-800 ${box} ${dim ? 'opacity-40 grayscale' : ''}`}
      style={{ boxShadow: `inset 0 0 0 2px ${rarity.ring}, 0 0 12px ${dim ? 'transparent' : rarity.glow}` }}
      title={title ?? MATERIALS[id].name}
    >
      <MaterialIcon id={id} />
      {count !== undefined && count > 0 && (
        <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-slate-950 px-1.5 text-[0.6875rem] font-bold leading-4 text-white ring-1 ring-white/20">
          {count}
        </span>
      )}
    </span>
  );
};
