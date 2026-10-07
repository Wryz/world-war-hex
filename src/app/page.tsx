'use client';

import IntroScreen from '@/components/game/intro/IntroScreen';
import { useRouter } from 'next/navigation';
import { Difficulty, loadGameFromLocalStorage } from '@/components/game/storage/GameStorage';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [hasSavedGame, setHasSavedGame] = useState(false);

  useEffect(() => {
    setHasSavedGame(!!loadGameFromLocalStorage());
  }, []);

  const handleStartGame = (difficulty: Difficulty) => {
    if (hasSavedGame && !window.confirm('Start a new game? Your saved game will be lost.')) return;
    router.push(`/play?new=true&difficulty=${difficulty}`);
  };

  const handleContinueGame = () => {
    router.push('/play');
  };

  return (
    <IntroScreen
      onStartGame={handleStartGame}
      onContinueGame={handleContinueGame}
      hasSavedGame={hasSavedGame}
    />
  );
}
