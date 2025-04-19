'use client';

import { GameController } from '@/components/game/GameController';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

// Create a client component that uses searchParams
function GameContent() {
  const searchParams = useSearchParams();
  const [shouldContinue, setShouldContinue] = useState(false);
  const [gameDifficulty, setGameDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isLoading, setIsLoading] = useState(true);
  const [isDirectNavigation, setIsDirectNavigation] = useState(false);

  useEffect(() => {
    // Get URL parameters and session data
    const continueParam = searchParams.get('continue');
    const difficulty = sessionStorage.getItem('gameDifficulty') as 'easy' | 'medium' | 'hard' | null;
    
    // Check if user navigated directly to /play without proper parameters
    if (!continueParam && !difficulty) {
      setIsDirectNavigation(true);
    } else {
      // Set states based on URL and session data
      setShouldContinue(continueParam === 'true');
      if (difficulty) {
        setGameDifficulty(difficulty);
      }
    }
    
    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-[var(--background)] flex items-center justify-center text-[var(--parchment)]">
        Loading...
      </div>
    );
  }

  // If user navigated directly to /play without proper initialization
  if (isDirectNavigation) {
    return (
      <div className="w-screen h-screen bg-[var(--background)] flex flex-col items-center justify-center text-[var(--parchment)]">
        <h1 className="text-3xl mb-6">Oops! Improper game initialization</h1>
        <p className="mb-6">It looks like you tried to access the game directly without proper setup.</p>
        <Link 
          href="/" 
          className="py-3 px-6 bg-[var(--accent)] text-[var(--parchment)] rounded-lg shadow-md hover:bg-[var(--accent-light)] transition-colors"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--background)]">
      <GameController 
        initialDifficulty={gameDifficulty} 
        shouldContinueGame={shouldContinue}
      />
    </div>
  );
}

// Loading fallback for Suspense
function GameLoading() {
  return (
    <div className="w-screen h-screen bg-[var(--background)] flex items-center justify-center text-[var(--parchment)]">
      <div className="animate-pulse">Loading game...</div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function PlayGame() {
  return (
    <Suspense fallback={<GameLoading />}>
      <GameContent />
    </Suspense>
  );
} 