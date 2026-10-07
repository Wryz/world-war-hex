import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGIONS, Region, getRegionLevels, getLevel, LevelDef } from '@/lib/campaign/levels';
import { FACTIONS, TROOPS } from '@/lib/game/troops';
import { highestUnlocked, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { MenuShell, CARD_CLASS } from './MenuShell';
import { PreBattleSheet } from './PreBattleSheet';
import { BossIcon, FilledStarIcon, LockIcon, MapIcon, ShieldIcon, StarIcon, TerrainIcon, UnitIcon } from '../game/icons';

// Horizontal position (percent) of each level along the winding road through a region
const ROAD = [22, 42, 64, 80, 66, 44, 24, 30, 52, 74];
const ROW_HEIGHT = 84;

const LevelNode: React.FC<{
  level: LevelDef;
  stars: number;
  unlocked: boolean;
  isNext: boolean;
  onSelect: () => void;
}> = ({ level, stars, unlocked, isNext, onSelect }) => {
  const size = level.isBoss ? 64 : 50;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!unlocked}
      data-level={level.id}
      title={unlocked ? `${level.id}. ${level.name}` : 'Locked'}
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      style={{ left: `${ROAD[level.index]}%`, top: level.index * ROW_HEIGHT + 44 }}
    >
      <span
        className={`font-display flex items-center justify-center rounded-full text-lg transition-transform ${unlocked ? 'hover:scale-110' : ''} ${isNext ? 'node-pulse' : ''}`}
        style={{
          width: size,
          height: size,
          background: !unlocked ? '#475569' : level.isBoss ? 'linear-gradient(160deg, #f87171, #7f1d1d)' : stars > 0 ? 'linear-gradient(160deg, #fde68a, #d97706)' : 'linear-gradient(160deg, #e2e8f0, #64748b)',
          color: unlocked ? '#0f172a' : '#cbd5e1',
          boxShadow: '0 5px 0 rgba(15,23,42,0.55)',
          border: isNext ? '3px solid #fde047' : '3px solid #0f172a'
        }}
      >
        {!unlocked ? <LockIcon color="#cbd5e1" /> : level.isBoss ? <BossIcon color="#fff" className="text-2xl" /> : level.id}
      </span>
      {unlocked && (
        <span className="mt-0.5 flex gap-0.5 rounded-full bg-slate-900/70 px-1.5 py-0.5">
          {[0, 1, 2].map(i => i < stars
            ? <FilledStarIcon key={i} className="text-[11px]" />
            : <StarIcon key={i} className="text-[11px]" color="#475569" />)}
        </span>
      )}
      {level.isElite && unlocked && <ShieldIcon className="absolute -right-2 -top-1 text-base" color="#a78bfa" />}
    </button>
  );
};

const RegionBand: React.FC<{ region: Region; onSelect: (level: LevelDef) => void }> = ({ region, onSelect }) => {
  const profile = useProfile();
  const unlockedUpTo = highestUnlocked(profile);
  const levels = getRegionLevels(region.id);
  const regionUnlocked = levels[0].id <= unlockedUpTo;
  const regionStars = levels.reduce((sum, level) => sum + (profile.levels[level.id]?.stars ?? 0), 0);
  const faction = FACTIONS[region.faction];
  const points = levels.map(level => `${ROAD[level.index]},${level.index * ROW_HEIGHT + 44}`);

  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl shadow-[0_8px_0_rgba(15,23,42,0.35)]" style={{ background: `linear-gradient(180deg, ${region.colors[0]}, ${region.colors[1]})` }}>
      {/* Region title */}
      <div className={`${CARD_CLASS} m-3 flex flex-wrap items-center gap-3 p-3`}>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Region {region.id + 1} · Levels {levels[0].id}-{levels[9].id}</div>
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

      {/* The road */}
      <div className={`relative mx-3 mb-3 ${regionUnlocked ? '' : 'opacity-60'}`} style={{ height: ROW_HEIGHT * 10 }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${ROW_HEIGHT * 10}`} preserveAspectRatio="none" aria-hidden>
          <polyline points={points.join(' ')} fill="none" stroke="rgba(15,23,42,0.35)" strokeWidth={10} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <polyline points={points.join(' ')} fill="none" stroke="#fef3c7" strokeWidth={4} strokeDasharray="10 9" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {levels.map(level => (
          <LevelNode
            key={level.id}
            level={level}
            stars={profile.levels[level.id]?.stars ?? 0}
            unlocked={level.id <= unlockedUpTo}
            isNext={level.id === unlockedUpTo && !(profile.levels[level.id]?.wins)}
            onSelect={() => onSelect(level)}
          />
        ))}
        {!regionUnlocked && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className={`${CARD_CLASS} flex items-center gap-2 px-4 py-2 text-sm font-bold`}>
              <LockIcon /> Beat {TROOPS[REGIONS[region.id - 1].boss].name} to enter
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

// The campaign map: ten regions of ten battles, from Greenvale to the Dragonspire
export const CampaignScreen: React.FC<{ initialLevel?: number }> = ({ initialLevel }) => {
  const router = useRouter();
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const [selected, setSelected] = useState<LevelDef | null>(null);
  const scrolledRef = useRef(false);
  useMusic('map');

  // Open the requested level (or scroll to the next one) once progress has loaded
  useEffect(() => {
    if (!hydrated || scrolledRef.current) return;
    scrolledRef.current = true;
    const next = highestUnlocked(profile);
    const focus = initialLevel && initialLevel <= next ? initialLevel : next;
    document.querySelector(`[data-level="${focus}"]`)?.scrollIntoView({ block: 'center' });
    if (initialLevel && initialLevel <= next) setSelected(getLevel(initialLevel));
  }, [hydrated, profile, initialLevel]);

  return (
    <MenuShell title="Campaign" icon={<MapIcon />}>
      {REGIONS.map(region => <RegionBand key={region.id} region={region} onSelect={setSelected} />)}
      {selected && (
        <PreBattleSheet
          level={selected}
          onClose={() => setSelected(null)}
          onFight={() => router.push(`/play?level=${selected.id}`)}
        />
      )}
    </MenuShell>
  );
};
