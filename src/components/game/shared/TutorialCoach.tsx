import React, { useEffect, useLayoutEffect, useState } from 'react';
import { GameState, UnitType } from '@/types/game';
import { ArrowIcon, CloseIcon } from '../icons';

// A short interactive tutorial for the first battle: each step points at what to do next and
// moves on as soon as the player does it

type Step = 'playCard' | 'deploy' | 'endTurn' | 'waitForTurn' | 'move' | 'fight' | 'win';

const STEPS: Record<Step, { text: string; target?: string; manual?: boolean }> = {
  playCard: { text: 'Your troops are cards. Tap one to play it.', target: 'first-card' },
  deploy: { text: 'Tap a glowing hex to deploy it.' },
  endTurn: { text: 'Press End Turn.', target: 'end-turn' },
  waitForTurn: { text: 'Enemy turn. Troops in range fight automatically.' },
  move: { text: 'Tap a troop, then a hex to march it.' },
  fight: {
    text: 'Capture tents to deploy closer to the front. Forests give cover, hills give height.',
    manual: true
  },
  win: {
    text: 'Attack the enemy castle. At half health, step onto it to win!',
    manual: true
  }
};

interface TutorialCoachProps {
  gameState: GameState;
  selectedUnitType: UnitType | null;
  onDone: () => void;
}

export const TutorialCoach: React.FC<TutorialCoachProps> = ({ gameState, selectedUnitType, onDone }) => {
  const [step, setStep] = useState<Step>('playCard');
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const isPlayerPlanning = gameState.currentPhase === 'planning' && gameState.activePlayer === 'player';
  const hasMovedUnit = gameState.pendingMoves.length > 0;

  // Move on as soon as the player does what the step asks
  useEffect(() => {
    setStep(current => {
      if (current === 'playCard' && selectedUnitType) return 'deploy';
      if (current === 'deploy' && gameState.pendingPurchases.length > 0) return 'endTurn';
      if (current === 'deploy' && !selectedUnitType) return 'playCard';
      if (current === 'endTurn' && !isPlayerPlanning) return 'waitForTurn';
      if (current === 'waitForTurn' && isPlayerPlanning && gameState.turnNumber >= 2) return 'move';
      if (current === 'move' && hasMovedUnit) return 'fight';
      return current;
    });
  }, [selectedUnitType, gameState.pendingPurchases.length, isPlayerPlanning, gameState.turnNumber, hasMovedUnit]);

  // Point at the element the step is about
  const target = STEPS[step].target;
  useLayoutEffect(() => {
    if (!target) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const element = document.querySelector(`[data-tutorial="${target}"]`);
      const rect = element?.getBoundingClientRect();
      setAnchor(rect && rect.width > 0 ? { x: rect.left + rect.width / 2, y: rect.top } : null);
    };
    update();
    const interval = setInterval(update, 300);
    return () => clearInterval(interval);
  }, [target, isPlayerPlanning]);

  const { text, manual } = STEPS[step];
  const next = () => (step === 'fight' ? setStep('win') : onDone());

  return (
    <>
      {anchor && (
        <div className="pointer-events-none fixed z-[45] -translate-x-1/2 -translate-y-full" style={{ left: anchor.x, top: anchor.y - 6 }}>
          <div className="pointer-bob font-display text-4xl text-amber-300 drop-shadow-[0_3px_0_rgba(15,23,42,0.8)]">▼</div>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[45] flex justify-center px-3">
        <div className="animate-fadeIn pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-slate-900/95 p-3 text-sm text-slate-100 shadow-2xl ring-2 ring-amber-400/70">
          <span className="font-display mt-0.5 rounded-full bg-amber-400 px-2 text-xs text-slate-900">Tutorial</span>
          <p className="flex-1 font-semibold leading-snug">{text}</p>
          {manual ? (
            <button onClick={next} className="font-display shrink-0 rounded-lg bg-amber-500 px-3 py-1 text-slate-900 hover:bg-amber-400">
              <span className="flex items-center gap-1">{step === 'win' ? 'Got it' : 'Next'} <ArrowIcon /></span>
            </button>
          ) : (
            <button onClick={onDone} title="Skip tutorial" aria-label="Skip tutorial" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white">
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
    </>
  );
};
