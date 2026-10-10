'use client';

import { GameController } from '@/components/game/GameController';
import { BattleConfig, battlePath, loadGameFromLocalStorage, quickBattleFromParams, sameBattle } from '@/components/game/storage/GameStorage';
import { LEVEL_COUNT } from '@/lib/campaign/levels';
import { isLevelUnlocked, getProfile } from '@/lib/meta/profile';
import { useRouter, useSearchParams } from 'next/navigation';
import { cameFromAnotherPage } from '@/lib/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';

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
  // The address last looked at for a battle in progress
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    const battle = battleFromParams(searchParams);
    if (!battle || (battle.mode === 'campaign' && !isLevelUnlocked(getProfile(), battle.levelId))) {
      router.replace('/campaign');
      return;
    }
    const resume = searchParams.get('resume') === '1';
    // (once per address: StrictMode runs effects twice, and a question asked twice is worse than once)
    const address = searchParams.toString();
    if (checkedRef.current === address) return;
    checkedRef.current = address;
    // A friend's challenge reaching someone who has never played: the tutorial first, if they like
    if (battle.mode === 'quick' && battle.challenge && !resume && !getProfile().tutorialDone &&
      window.confirm('New to Hex Hordes? Play the short tutorial battle first? (Cancel to take on the challenge now.)')) {
      router.replace('/play?level=1');
      return;
    }
    const saved = loadGameFromLocalStorage()?.additionalData.battle;
    // The battle in progress is this one (down to a friend's score to beat, for a challenge)
    const isSaved = !!saved && sameBattle(saved, battle) &&
      (battle.mode !== 'quick' || !battle.challenge || battlePath(saved) === battlePath(battle));
    let fresh = false;
    if (saved && !isSaved) {
      // A different one (a friend's challenge, another level, an old address to continue) would replace
      // it: ask first, and on second thoughts go back to the page the player came from (or, arriving
      // from outside the game, to the battle in progress)
      if (!window.confirm('Start this battle? Your battle in progress will be lost.')) {
        if (cameFromAnotherPage()) router.back();
        else router.replace(battlePath(saved, true));
        return;
      }
      fresh = true;
    } else if (saved && !resume) {
      // The battle in progress, asked for again: carry on with it rather than start it over
      router.replace(battlePath(saved, true));
      return;
    }
    const continuing = resume && !fresh;
    // Marking the URL as resumable (below) changes the search params but not the battle
    setGame(current => (current && !fresh && sameBattle(current.battle, battle) ? current : { battle, resume: continuing, key: (current?.key ?? 0) + 1 }));

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
