'use client';

import IntroScreen from '@/components/game/intro/IntroScreen';
import { useRouter } from 'next/navigation';
import { loadGameFromLocalStorage } from '@/components/game/storage/GameStorage';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [hasSavedGame, setHasSavedGame] = useState(false);

  useEffect(() => {
    // Check if there's a saved game on mount
    const savedGame = loadGameFromLocalStorage();
    setHasSavedGame(!!savedGame);
  }, []);

  const handleStartGame = (difficulty: 'easy' | 'medium' | 'hard') => {
    // Store difficulty in session storage to access it on the game page
    sessionStorage.setItem('gameDifficulty', difficulty);
    router.push('/play');
  };

  const handleContinueGame = () => {
    router.push('/play?continue=true');
  };

  return (
    <div className="w-screen h-screen">
      <div className="w-full h-full">
        <IntroScreen
          onStartGame={handleStartGame}
          onContinueGame={handleContinueGame}
          hasSavedGame={hasSavedGame}
        />
      </div>
    </div>
  );
}
