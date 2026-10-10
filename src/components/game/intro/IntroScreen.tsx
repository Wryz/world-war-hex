import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getLevel, LEVEL_COUNT, REGIONS } from '@/lib/campaign/levels';
import { MOB_IDS, FACTIONS } from '@/lib/game/troops';
import { MATERIAL_IDS } from '@/lib/game/materials';
import { highestCleared, highestUnlocked, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { setMuted, useMuted } from '../utils/SoundPlayer';
import { CARD_CLASS, PRIMARY_BUTTON, ResourceBadges, SKY_BACKGROUND } from '@/components/menu/MenuShell';
import { TroopCard } from '../cards/TroopCard';
import {
  AttackIcon, BookIcon, BossIcon, SatchelIcon, CardsIcon, MapIcon, ResumeIcon, SoundOffIcon, SoundOnIcon,
  StarIcon, StatsIcon, StyleIcon, SettingsIcon
} from '../icons';
import { SettingsPanel, SettingsTab } from '../../menu/SettingsPanel';
import { BattleConfig, Difficulty } from '../storage/GameStorage';

// The 3D island needs WebGL, so it only renders in the browser
const IslandDiorama = dynamic(() => import('./IslandDiorama'), { ssr: false });
// Its first island's terrain as a picture (scripts/render-hero-poster.mjs), drawn this many times
// wider than tall: the camera keeps its height, so a wider hero only shows more sky either side
const HERO_POSTER = '/hero-island.webp';
const HERO_POSTER_ASPECT = 2;

export interface IntroScreenProps {
  onStartQuickBattle: (difficulty: Difficulty) => void;
  // The battle in progress, if there is one
  savedBattle?: BattleConfig | null;
  onContinueBattle?: () => void;
}

const Cloud: React.FC<{ className: string; delay: string; duration: string }> = ({ className, delay, duration }) => (
  <div
    className={`animate-drift pointer-events-none absolute ${className}`}
    style={{ animationDelay: delay, animationDuration: duration }}
    aria-hidden
  >
    <div className="relative h-10 w-36 rounded-full bg-white/80">
      <div className="absolute -top-6 left-6 h-14 w-14 rounded-full bg-white/80" />
      <div className="absolute -top-9 left-16 h-16 w-16 rounded-full bg-white/80" />
    </div>
  </div>
);

const MenuTile: React.FC<{ href: string; icon: React.ReactNode; title: string; detail: string }> = ({ href, icon, title, detail }) => (
  <Link href={href} className={`${CARD_CLASS} group flex items-center gap-3 px-4 py-3.5 transition-transform hover:-translate-y-1 sm:gap-4 sm:py-4`}>
    <span className="text-3xl transition-transform group-hover:scale-110 sm:text-4xl">{icon}</span>
    <span className="min-w-0">
      <span className="font-display block text-lg leading-tight sm:text-2xl">{title}</span>
      <span className="block truncate text-xs text-slate-300 sm:text-sm">{detail}</span>
    </span>
  </Link>
);

const IntroScreen: React.FC<IntroScreenProps> = ({ onStartQuickBattle, savedBattle, onContinueBattle }) => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const isMuted = useMuted();
  const [themeName, setThemeName] = useState<string | null>(null);
  const [islandReady, setIslandReady] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  useMusic('menu');

  const nextLevel = getLevel(hydrated ? highestUnlocked(profile) : 1);
  const cleared = hydrated ? highestCleared(profile) : 0;
  const campaignDone = cleared >= LEVEL_COUNT;
  const discovered = MOB_IDS.filter(id => (profile.bestiary[id]?.seen ?? 0) > 0).length;
  const savedLevel = savedBattle?.mode === 'campaign' ? getLevel(savedBattle.levelId) : null;

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden lg:block" style={{ background: SKY_BACKGROUND }}>
      <Cloud className="top-[8%]" delay="-8s" duration="70s" />
      <Cloud className="top-[22%] scale-75 opacity-80" delay="-40s" duration="90s" />
      <Cloud className="top-[70%] scale-90 opacity-70" delay="-22s" duration="80s" />

      {/* A living battlefield made of the game's own pieces */}
      <div className="relative order-2 h-[40vh] min-h-[260px] lg:absolute lg:inset-y-0 lg:left-[40%] lg:right-0 lg:h-auto">
        {/* A picture of the island's terrain shows at once; the live island fades in over it once its
            own terrain and scenery are ready, and its troops arrive after */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_POSTER}
            alt=""
            fetchPriority="high"
            draggable={false}
            className={`absolute left-1/2 top-0 h-full w-auto max-w-none -translate-x-1/2 transition-opacity duration-500 ${islandReady ? 'opacity-0' : 'opacity-100'}`}
            style={{ aspectRatio: `${HERO_POSTER_ASPECT}` }}
          />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-500 ${islandReady ? 'opacity-100' : 'opacity-0'}`}>
          <IslandDiorama onThemeChange={setThemeName} onReady={() => setIslandReady(true)} />
        </div>
        {themeName && (
          <div className="pointer-events-none absolute bottom-[calc(1rem+var(--safe-b))] right-[calc(1rem+var(--safe-r))] lg:bottom-8 lg:right-8">
            <div key={themeName} className={`${CARD_CLASS} animate-fadeIn px-5 py-2.5 text-right`}>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-300">{LEVEL_COUNT} battles across</div>
              <div className="font-display text-2xl text-amber-300">{themeName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Resources and sound */}
      <div className="absolute right-[calc(0.75rem+var(--safe-r))] top-[calc(0.75rem+var(--safe-t))] z-20 flex items-center gap-2 sm:right-[calc(1.5rem+var(--safe-r))]">
        <ResourceBadges />
        <button
          onClick={() => setMuted(!isMuted)}
          className={`${CARD_CLASS} p-3 text-xl`}
          aria-label={isMuted ? 'Turn sound on' : 'Mute sound'}
          aria-pressed={isMuted}
        >
          {isMuted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
        <button
          onClick={() => setSettingsTab('sound')}
          className={`${CARD_CLASS} p-3 text-xl`}
          aria-label="Settings"
          title="Settings: sound, gameplay, quick battles and the guide"
        >
          <SettingsIcon />
        </button>
      </div>
      {settingsTab && <SettingsPanel initialTab={settingsTab} onClose={() => setSettingsTab(null)} onStartQuickBattle={onStartQuickBattle} />}

      <main className="relative z-10 order-1 flex flex-col justify-center pb-4 pl-[calc(1rem+var(--safe-l))] pr-[calc(1rem+var(--safe-r))] pt-[calc(4rem+var(--safe-t))] sm:pl-[calc(2rem+var(--safe-l))] sm:pr-[calc(2rem+var(--safe-r))] lg:min-h-screen lg:max-w-[46rem] lg:pl-[calc(3.5rem+var(--safe-l))] lg:pr-14 lg:py-10 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Wordmark */}
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt=""
              width={112}
              height={112}
              className="animate-bob h-20 w-20 drop-shadow-[0_6px_0_rgba(15,23,42,0.35)] sm:h-32 sm:w-32"
              priority
            />
            <h1 className="font-display leading-[0.85]">
              <span className="block text-3xl text-slate-800 sm:text-5xl">Hex</span>
              <span
                className="block text-5xl text-amber-400 sm:text-8xl"
                style={{ WebkitTextStroke: '3px #0f172a', paintOrder: 'stroke fill', textShadow: '0 6px 0 #0f172a' }}
              >
                HORDES
              </span>
            </h1>
          </div>
          <p className="mt-3 max-w-xl text-xl font-semibold text-slate-700 sm:text-2xl">
            Play your cards, read the land, topple the castle.
          </p>

          {/* Campaign */}
          <div className={`${CARD_CLASS} mt-6 max-w-2xl p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold uppercase tracking-widest text-slate-300">
                  {campaignDone ? 'Campaign complete!' : `Campaign · ${nextLevel.region.name}`}
                </div>
                <div className="font-display mt-1 flex items-center gap-1.5 text-3xl sm:text-4xl">
                  {nextLevel.isBoss && <BossIcon />}Level {nextLevel.id}: {nextLevel.name}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-base text-slate-300">
                  <StarIcon /> {cleared}/{LEVEL_COUNT} levels cleared · vs {FACTIONS[nextLevel.region.faction].title}
                </div>
              </div>
              <div className="hidden shrink-0 sm:block">
                <TroopCard type={nextLevel.isBoss ? nextLevel.region.boss : nextLevel.enemyRoster[0]} size="sm" hideLevel hidden={!nextLevel.isBoss && hydrated && !(profile.bestiary[nextLevel.enemyRoster[0]]?.seen)} />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href={`/play?level=${nextLevel.id}`} className={`${PRIMARY_BUTTON} flex-1 py-4 text-center text-2xl sm:text-3xl`}>
                <span className="inline-flex items-center gap-2"><AttackIcon color="currentColor" /> {cleared === 0 ? 'Start Campaign' : 'Battle!'}</span>
              </Link>
              {savedBattle && onContinueBattle && (
                <button
                  onClick={onContinueBattle}
                  className="font-display rounded-xl bg-slate-700 px-6 py-4 text-2xl text-slate-100 shadow-[0_5px_0_#020617] transition-transform hover:-translate-y-0.5 hover:bg-slate-600 active:translate-y-1"
                  title={savedLevel ? `Continue level ${savedLevel.id}: ${savedLevel.name}` : 'Continue your skirmish'}
                >
                  <span className="inline-flex items-center gap-2"><ResumeIcon /> Continue</span>
                </button>
              )}
            </div>
          </div>

          {/* Everything else */}
          <div className="mt-5 grid max-w-2xl grid-cols-2 gap-3">
            <MenuTile href="/campaign" icon={<MapIcon />} title="World Map" detail={`${REGIONS.length} regions · ${LEVEL_COUNT} battles`} />
            <MenuTile href="/army" icon={<CardsIcon />} title="Army" detail="Build your deck, upgrade cards" />
            <MenuTile href="/bestiary" icon={<BookIcon />} title="Bestiary" detail={`${hydrated ? discovered : 0}/${MOB_IDS.length} monsters discovered`} />
            <MenuTile href="/satchel" icon={<SatchelIcon />} title="Satchel" detail={`${hydrated ? profile.materialsFound.length : 0}/${MATERIAL_IDS.length} materials · Chronicle`} />
            <MenuTile href="/style" icon={<StyleIcon />} title="Style" detail="Card frames, castle styles" />
            <MenuTile href="/stats" icon={<StatsIcon />} title="Stats & Save" detail="Records and save file" />
          </div>

        </div>
      </main>
    </div>
  );
};

export default IntroScreen;
