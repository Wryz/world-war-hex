'use client';

import { GameController } from '@/components/game/GameController';
import { BattleConfig, battlePath, loadGameFromLocalStorage, quickBattleFromParams, sameBattle } from '@/components/game/storage/GameStorage';
import { LEVEL_COUNT } from '@/lib/campaign/levels';
import { isLevelUnlocked, getProfile } from '@/lib/meta/profile';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

const LoadingFallback = () => <div className="h-screen w-screen bg-slate-900" />;

// The battle a URL asks for: /play?level=7 or /play?mode=quick&difficulty=hard (a friend's challenge
// adds &seed=, &rival=, &score= and &won=)
const battleFromParams = (params: URLSearchParams): BattleConfig | null => {
  if (params.get('mode') === 'quick') return quickBattleFromParams(params);
  const level = Math.round(Number(params.get('level')));
  return level >= 1 && level <= LEVEL_COUNT ? { mode: 'campaign', levelId: level } : null;
};

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The game reads saves from localStorage, so it only renders in the browser
  const [game, setGame] = useState<{ battle: BattleConfig; resume: boolean; key: number } | null>(null);

  useEffect(() => {
    const battle = battleFromParams(searchParams);
    if (!battle || (battle.mode === 'campaign' && !isLevelUnlocked(getProfile(), battle.levelId))) {
      router.replace('/campaign');
      return;
    }
    const resume = searchParams.get('resume') === '1';
    // A link to a different battle (a friend's challenge) would replace the one in progress: ask first
    const saved = loadGameFromLocalStorage()?.additionalData.battle;
    if (!resume && saved && !sameBattle(saved, battle) &&
      !window.confirm('Start this battle? Your battle in progress will be lost.')) {
      router.replace(battlePath(saved, true));
      return;
    }
    // Marking the URL as resumable (below) changes the search params but not the battle
    setGame(current => (current && sameBattle(current.battle, battle) ? current : { battle, resume, key: (current?.key ?? 0) + 1 }));

    // Reloading the page later should resume the autosave rather than start over again
    if (!resume) window.history.replaceState(null, '', battlePath(battle, true));
  }, [searchParams, router]);

  if (!game) return <LoadingFallback />;

  return (
    <div className="w-screen h-screen overflow-hidden">
      {/* A new battle (e.g. "Next level") remounts the game */}
      <GameController key={game.key} battle={game.battle} shouldContinueGame={game.resume} />
    </div>
  );
}

export default function PlayGame() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GameContent />
    </Suspense>
  );
}
