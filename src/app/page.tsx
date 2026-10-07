'use client';

import IntroScreen from '@/components/game/intro/IntroScreen';
import { useRouter } from 'next/navigation';
import { BattleConfig, Difficulty, battlePath, loadGameFromLocalStorage } from '@/components/game/storage/GameStorage';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [savedBattle, setSavedBattle] = useState<BattleConfig | null>(null);

  useEffect(() => {
    setSavedBattle(loadGameFromLocalStorage()?.additionalData.battle ?? null);
  }, []);

  const handleQuickBattle = (difficulty: Difficulty) => {
    if (savedBattle && !window.confirm('Start a new battle? Your battle in progress will be lost.')) return;
    router.push(battlePath({ mode: 'quick', difficulty }));
  };

  return (
    <IntroScreen
      onStartQuickBattle={handleQuickBattle}
      savedBattle={savedBattle}
      onContinueBattle={savedBattle ? () => router.push(battlePath(savedBattle, true)) : undefined}
    />
  );
}
