import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGIONS, Region, getLevel, getRegionLevels, LevelDef } from '@/lib/campaign/levels';
import { topUpDeck } from '@/lib/campaign/startLevel';
import { FACTIONS, TROOPS } from '@/lib/game/troops';
import { highestUnlocked, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { LockIcon, MapIcon, StarIcon, TerrainIcon, UnitIcon } from '../game/icons';
import { RegionMap } from './RegionMap';
import { LevelPopup } from './LevelPopup';
import { MAP_SEA_URL } from '@/lib/campaign/mapArt';

// The sea the region islands sit in
const SEA_STYLE: React.CSSProperties = { backgroundColor: '#a6e1f5', backgroundImage: `url(${MAP_SEA_URL})`, backgroundSize: '64px 64px' };

const RegionBand: React.FC<{
  region: Region;
  selected: LevelDef | null;
  onSelect: (level: LevelDef) => void;
  onFight: (level: LevelDef) => void;
  onClose: () => void;
}> = ({ region, selected, onSelect, onFight, onClose }) => {
  const profile = useProfile();
  const unlockedUpTo = highestUnlocked(profile);
  const levels = getRegionLevels(region.id);
  const regionUnlocked = levels[0].id <= unlockedUpTo;
  const regionStars = levels.reduce((sum, level) => sum + (profile.levels[level.id]?.stars ?? 0), 0);
  const faction = FACTIONS[region.faction];

  return (
    <section className="relative mb-6 rounded-3xl shadow-[0_8px_0_rgba(15,23,42,0.35)]" style={SEA_STYLE}>
      {/* Region title */}
      <div className={`${CARD_CLASS} m-3 flex flex-wrap items-center gap-3 p-3`}>
        <div className="min-w-0 flex-1">
          <div className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Region {region.id + 1} · Levels {levels[0].id}-{levels[9].id}</div>
          <h2 className="font-display text-2xl" style={{ color: region.colors[0] }}>{region.name}</h2>
          <p className="text-xs text-slate-300">{region.blurb}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-xs font-bold" style={{ color: faction.color }}>
            <UnitIcon type={region.boss} /> {faction.title}
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-amber-300"><StarIcon /> {regionStars}/30</span>
          {region.newTerrain.length > 0 && (
            <span className="flex gap-1">{region.newTerrain.map(t => <TerrainIcon key={t} terrain={t} />)}</span>
          )}
        </div>
      </div>

      {/* The region's island, with its levels along the road */}
      <div className="px-2 pb-3">
        <RegionMap
          regionId={region.id}
          levels={levels}
          starsFor={level => profile.levels[level.id]?.stars ?? 0}
          medalFor={level => !!profile.levels[level.id]?.challenge}
          unlockedUpTo={unlockedUpTo}
          isNext={level => level.id === unlockedUpTo && !(profile.levels[level.id]?.wins)}
          locked={!regionUnlocked}
          lockedLabel={region.id > 0 && (
            <span className={`${CARD_CLASS} flex items-center gap-2 px-4 py-2 text-sm font-bold`}>
              <LockIcon /> Beat {TROOPS[REGIONS[region.id - 1].boss].name} to enter
            </span>
          )}
          onSelect={onSelect}
          selectedId={selected?.id ?? null}
          popup={selected && <LevelPopup key={selected.id} level={selected} onFight={() => onFight(selected)} onClose={onClose} />}
        />
      </div>
    </section>
  );
};

// The campaign map: fifteen regions of ten battles, from Greenvale to the Last Bastion. Tapping a
// level opens a callout from its spot with what to know about it and the button to fight it.
export const CampaignScreen: React.FC<{ initialLevel?: number }> = ({ initialLevel }) => {
  const router = useRouter();
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const [selected, setSelected] = useState<LevelDef | null>(null);
  const scrolledRef = useRef(false);
  useMusic('map');

  // Scroll to the requested level (or the next one) once progress has loaded, and open a requested one
  useEffect(() => {
    if (!hydrated || scrolledRef.current) return;
    scrolledRef.current = true;
    const next = highestUnlocked(profile);
    const focus = initialLevel && initialLevel <= next ? initialLevel : next;
    document.querySelector(`[data-level="${focus}"]`)?.scrollIntoView({ block: 'center' });
    if (initialLevel && initialLevel <= next) setSelected(getLevel(initialLevel));
  }, [hydrated, profile, initialLevel]);

  const fight = (level: LevelDef) => {
    topUpDeck(level);
    router.push(`/play?level=${level.id}`);
  };
  const close = useCallback(() => setSelected(null), []);

  return (
    <MenuShell title="Campaign" icon={<MapIcon />}>
      {REGIONS.map(region => (
        <RegionBand
          key={region.id}
          region={region}
          selected={selected && selected.region.id === region.id ? selected : null}
          onSelect={level => setSelected(current => (current?.id === level.id ? null : level))}
          onFight={fight}
          onClose={close}
        />
      ))}
    </MenuShell>
  );
};
