'use client';

import { GameController } from '@/components/game/GameController';
import { Difficulty } from '@/components/game/storage/GameStorage';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const LoadingFallback = () => <div className="h-screen w-screen bg-slate-900" />;

function GameContent() {
  const searchParams = useSearchParams();
  // The game reads the saved game from localStorage, so it only renders in the browser
  const [game, setGame] = useState<{ difficulty: Difficulty; resume: boolean } | null>(null);

  useEffect(() => {
    if (game) return;
    const requested = searchParams.get('difficulty') as Difficulty | null;
    const difficulty = requested && DIFFICULTIES.includes(requested) ? requested : 'medium';
    // A new game is only started when the menu asks for one; anything else resumes the saved game
    // (or starts a new one if there is none)
    const isNewGame = searchParams.get('new') === 'true';
    setGame({ difficulty, resume: !isNewGame });

    // Reloading the page later should resume the autosave rather than start over again
    if (isNewGame) window.history.replaceState(null, '', `/play?difficulty=${difficulty}`);
  }, [game, searchParams]);

  if (!game) return <LoadingFallback />;

  return (
    <div className="w-screen h-screen overflow-hidden">
      <GameController initialDifficulty={game.difficulty} shouldContinueGame={game.resume} />
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
