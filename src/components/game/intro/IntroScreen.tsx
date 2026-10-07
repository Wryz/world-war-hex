import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getLevel, LEVEL_COUNT } from '@/lib/campaign/levels';
import { MOB_IDS, FACTIONS } from '@/lib/game/troops';
import { highestCleared, highestUnlocked, useHasHydrated, useProfile } from '@/lib/meta/profile';
import { useMusic } from '@/lib/audio/music';
import { setMuted, useMuted } from '../utils/SoundPlayer';
import { CARD_CLASS, PRIMARY_BUTTON, ResourceBadges, SKY_BACKGROUND } from '@/components/menu/MenuShell';
import { TroopCard } from '../cards/TroopCard';
import {
  AttackIcon, BookIcon, BossIcon, CardsIcon, MapIcon, ResumeIcon, ShieldIcon, SkullIcon, SoundOffIcon, SoundOnIcon,
  StarIcon, StatsIcon
} from '../icons';
import { BattleConfig, Difficulty } from '../storage/GameStorage';

// The 3D island needs WebGL, so it only renders in the browser
const IslandDiorama = dynamic(() => import('./IslandDiorama'), { ssr: false });

export interface IntroScreenProps {
  onStartQuickBattle: (difficulty: Difficulty) => void;
  // The battle in progress, if there is one
  savedBattle?: BattleConfig | null;
  onContinueBattle?: () => void;
}

const DIFFICULTY_OPTIONS: { level: Difficulty; label: string; Icon: typeof ShieldIcon }[] = [
  { level: 'easy', label: 'Easy', Icon: ShieldIcon },
  { level: 'medium', label: 'Medium', Icon: AttackIcon },
  { level: 'hard', label: 'Hard', Icon: SkullIcon }
];

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
  <Link href={href} className={`${CARD_CLASS} group flex items-center gap-3 px-3 py-3 transition-transform hover:-translate-y-1`}>
    <span className="text-3xl transition-transform group-hover:scale-110">{icon}</span>
    <span className="min-w-0">
      <span className="font-display block text-lg leading-tight">{title}</span>
      <span className="block truncate text-[11px] text-slate-400">{detail}</span>
    </span>
  </Link>
);

const IntroScreen: React.FC<IntroScreenProps> = ({ onStartQuickBattle, savedBattle, onContinueBattle }) => {
  const profile = useProfile();
  const hydrated = useHasHydrated();
  const isMuted = useMuted();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [themeName, setThemeName] = useState<string | null>(null);
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
      <div className="relative order-2 h-[40vh] min-h-[260px] lg:absolute lg:inset-y-0 lg:left-[36%] lg:right-0 lg:h-auto">
        <IslandDiorama onThemeChange={setThemeName} />
        {themeName && (
          <div className="pointer-events-none absolute bottom-4 right-4 lg:bottom-8 lg:right-8">
            <div key={themeName} className={`${CARD_CLASS} animate-fadeIn px-4 py-2 text-right`}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">100 battles across</div>
              <div className="font-display text-lg text-amber-300">{themeName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Resources and sound */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-6">
        <ResourceBadges />
        <button
          onClick={() => setMuted(!isMuted)}
          className={`${CARD_CLASS} p-2.5`}
          aria-label={isMuted ? 'Turn sound on' : 'Mute sound'}
          aria-pressed={isMuted}
        >
          {isMuted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
      </div>

      <main className="relative z-10 order-1 flex flex-col justify-center px-4 pt-16 pb-4 sm:px-8 lg:min-h-screen lg:max-w-[40rem] lg:px-14 lg:py-10 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Wordmark */}
          <div className="flex items-center gap-4">
            <Image
              src="/world-war-hex-logo.png"
              alt=""
              width={112}
              height={112}
              className="animate-bob h-20 w-20 drop-shadow-[0_6px_0_rgba(15,23,42,0.35)] sm:h-28 sm:w-28"
              priority
            />
            <h1 className="font-display leading-[0.85]">
              <span className="block text-2xl text-slate-800 sm:text-3xl">World War</span>
              <span
                className="block text-6xl text-amber-400 sm:text-8xl"
                style={{ WebkitTextStroke: '3px #0f172a', paintOrder: 'stroke fill', textShadow: '0 6px 0 #0f172a' }}
              >
                HEX
              </span>
            </h1>
          </div>
          <p className="mt-3 max-w-lg text-lg font-semibold text-slate-700">
            Play your troop cards, read the land and topple the enemy castle - in under five minutes.
          </p>

          {/* Campaign */}
          <div className={`${CARD_CLASS} mt-5 max-w-lg p-4 sm:p-5`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {campaignDone ? 'Campaign complete!' : `Campaign · ${nextLevel.region.name}`}
                </div>
                <div className="font-display mt-0.5 flex items-center gap-1.5 text-2xl">
                  {nextLevel.isBoss && <BossIcon />}Level {nextLevel.id}: {nextLevel.name}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <StarIcon /> {cleared}/{LEVEL_COUNT} levels cleared · vs {FACTIONS[nextLevel.region.faction].title}
                </div>
              </div>
              <div className="hidden shrink-0 sm:block">
                <TroopCard type={nextLevel.isBoss ? nextLevel.region.boss : nextLevel.enemyRoster[0]} size="xs" hideLevel hidden={!nextLevel.isBoss && hydrated && !(profile.bestiary[nextLevel.enemyRoster[0]]?.seen)} />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href={`/campaign?level=${nextLevel.id}`} className={`${PRIMARY_BUTTON} flex-1 text-center`}>
                <span className="inline-flex items-center gap-2"><AttackIcon color="currentColor" /> {cleared === 0 ? 'Start Campaign' : 'Battle!'}</span>
              </Link>
              {savedBattle && onContinueBattle && (
                <button
                  onClick={onContinueBattle}
                  className="font-display rounded-xl bg-slate-700 px-5 py-3 text-lg text-slate-100 shadow-[0_5px_0_#020617] transition-transform hover:-translate-y-0.5 hover:bg-slate-600 active:translate-y-1"
                  title={savedLevel ? `Continue level ${savedLevel.id}: ${savedLevel.name}` : 'Continue your skirmish'}
                >
                  <span className="inline-flex items-center gap-2"><ResumeIcon /> Continue</span>
                </button>
              )}
            </div>
          </div>

          {/* Everything else */}
          <div className="mt-4 grid max-w-lg grid-cols-2 gap-2">
            <MenuTile href="/campaign" icon={<MapIcon />} title="World Map" detail="10 regions · 100 battles" />
            <MenuTile href="/army" icon={<CardsIcon />} title="Army" detail="Build your deck, upgrade cards" />
            <MenuTile href="/bestiary" icon={<BookIcon />} title="Bestiary" detail={`${hydrated ? discovered : 0}/${MOB_IDS.length} monsters discovered`} />
            <MenuTile href="/stats" icon={<StatsIcon />} title="Stats & Save" detail="Records, settings, save file" />
          </div>

          {/* Quick battle */}
          <div className={`${CARD_CLASS} mt-4 flex max-w-lg flex-wrap items-center gap-2 p-3`}>
            <span className="font-display mr-auto text-lg">Quick battle</span>
            <div className="flex gap-1" role="group" aria-label="Difficulty">
              {DIFFICULTY_OPTIONS.map(({ level, label, Icon }) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  aria-pressed={difficulty === level}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-bold ${
                    difficulty === level ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Icon color="currentColor" /> {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => onStartQuickBattle(difficulty)}
              className="font-display rounded-lg bg-sky-500 px-4 py-1.5 text-slate-900 shadow-[0_3px_0_#0369a1] hover:bg-sky-400"
            >
              Play
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default IntroScreen;
