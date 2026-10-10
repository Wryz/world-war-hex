import React, { useEffect, useRef, useState } from 'react';
import { useIsNarrow } from '../../shared/useIsNarrow';
import { GameState, PlayerType, UnitType } from '@/types/game';
import { getHand, getNextCard, getRosterStats, getTroopName } from '@/lib/game/gameState';
import { TroopCard } from '../cards/TroopCard';
import { CheckIcon, GoldIcon, UndoIcon } from '../icons';
import { PANEL_CLASS } from './styles';

// Phones get smaller cards so a full hand and the Confirm button fit across the screen

interface CardHandProps {
  gameState: GameState;
  isAITurn: boolean;
  selectedUnitType: UnitType | null;
  // Short instruction for the current action, if any
  hint: string | null;
  onCardSelect: (unitType: UnitType) => void;
  onEndTurn: () => void;
  // Take back the last order this turn
  canUndo?: boolean;
  onUndo?: () => void;
  // The side whose hand this is, and who the others are waiting on while it isn't their turn
  viewer?: PlayerType;
  waitingFor?: string;
  // Said instead while waiting, when there is more to say than who is planning
  waitingLine?: string;
}

// The player's hand at the bottom of the screen: the cards they brought into battle. Pick a card,
// then a glowing hex to play it.
export const CardHand: React.FC<CardHandProps> = ({
  gameState, isAITurn, selectedUnitType, hint, onCardSelect, onEndTurn, canUndo = false, onUndo, viewer = 'player', waitingFor, waitingLine
}) => {
  const hand = getHand(gameState, viewer);
  const nextCard = getNextCard(gameState, viewer);
  const gold = gameState.players[viewer]?.points ?? 0;
  const isNarrow = useIsNarrow();

  // Cards that just arrived in the hand animate in; keyed by slot so each slot redraws when its card changes
  const previousHandRef = useRef<UnitType[]>(hand);
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  useEffect(() => {
    const previous = previousHandRef.current;
    const changed = new Set(hand.map((card, i) => (previous[i] !== card ? i : -1)).filter(i => i !== -1));
    previousHandRef.current = hand;
    if (changed.size === 0) return;
    setDrawn(changed);
    const timeout = setTimeout(() => setDrawn(new Set()), 400);
    return () => clearTimeout(timeout);
    // The hand is derived from the deck, which is what changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.deck, gameState.decks]);

  if (isAITurn) {
    return (
      <div className="fixed bottom-[calc(1rem+var(--safe-b))] left-[var(--safe-l)] right-[var(--safe-r)] z-20 flex justify-center pointer-events-none">
        <div className={`${PANEL_CLASS} px-5 py-2.5 flex items-center gap-3 text-sm`}>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold">{waitingLine ?? `${waitingFor ?? 'Enemy'} is planning…`}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[calc(0.5rem+var(--safe-b))] left-[calc(0.5rem+var(--safe-l))] right-[calc(0.5rem+var(--safe-r))] z-20 flex flex-col items-center gap-2 pointer-events-none" data-tutorial="hand">
      {hint && (
        <div className="rounded-full bg-slate-900/85 px-4 py-1.5 text-center text-xs font-semibold text-slate-100 shadow">
          {hint}
        </div>
      )}


      <div className="flex max-w-full items-end gap-1.5 sm:gap-3">
        {/* Treasury */}
        <div className={`${PANEL_CLASS} pointer-events-auto hidden flex-col items-center px-3 py-2 sm:flex`}>
          <span className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Gold</span>
          <span className="font-display flex items-center gap-1 text-2xl text-amber-300"><GoldIcon />{gold}</span>
        </div>

        {/* Hand */}
        <div className="pointer-events-auto flex items-end gap-1 sm:gap-2.5" role="group" aria-label="Your hand">
          {hand.map((type, index) => {
            const stats = getRosterStats(gameState, viewer, type);
            if (!stats) return null;
            const canAfford = gold >= stats.cost;
            const isSelected = selectedUnitType === type;
            // A gentle fan: outer cards tilt away
            const tilt = (index - (hand.length - 1) / 2) * 3;
            return (
              <div
                key={`${index}-${type}`}
                className={drawn.has(index) ? 'card-draw' : ''}
                style={{ transform: isSelected ? undefined : `rotate(${tilt}deg)`, transformOrigin: 'bottom center' }}
                // (the tutorial points at a card by its type)
                data-tutorial={hand.indexOf(type) === index ? `card-${type}` : undefined}
              >
                <TroopCard
                  type={type}
                  level={stats.level}
                  stats={stats}
                  size={isNarrow ? 'xm' : 'md'}
                  selected={isSelected}
                  disabled={!canAfford && !isSelected}
                  onClick={() => onCardSelect(type)}
                  title={canAfford ? `Play ${getTroopName(type)} for ${stats.cost} gold` : `${getTroopName(type)} needs ${stats.cost} gold`}
                />
              </div>
            );
          })}

          {/* The card that will be drawn next */}
          {nextCard && (
            <div className="hidden flex-col items-center opacity-80 md:flex" title="Next card">
              <span className="mb-1 text-[0.5625rem] font-bold uppercase tracking-widest text-slate-200 drop-shadow">Next</span>
              <TroopCard type={nextCard} level={getRosterStats(gameState, viewer, nextCard)?.level ?? 1} size="xs" hideLevel />
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-stretch gap-1.5">
          {/* Gold on small screens */}
          <span id="hud-gold-phone" className={`${PANEL_CLASS} font-display flex items-center justify-center gap-1 px-2 py-1 text-base text-amber-300 sm:hidden`}>
            <GoldIcon />{gold}
          </span>
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Take back your last order (Ctrl+Z)"
              aria-label="Undo last order"
              className={`${PANEL_CLASS} flex items-center justify-center gap-1 px-2 py-1.5 text-sm font-bold text-slate-200 transition-opacity hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <UndoIcon /><span className="hidden sm:inline">Undo</span>
            </button>
          )}
          <button
            onClick={onEndTurn}
            data-tutorial="end-turn"
            aria-label="Confirm your orders and end the turn"
            title="Confirm your orders: your troops move and fight, then the enemy takes its turn"
            className="font-display rounded-xl bg-amber-500 px-1.5 py-2 text-xs leading-tight text-slate-900 shadow-[0_5px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-1 active:shadow-[0_1px_0_#b45309] sm:px-5 sm:py-3 sm:text-lg"
          >
            {/* (icon over the word on phones, so the button fits beside a full hand) */}
            <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5"><CheckIcon className="text-base sm:text-lg" /> Confirm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
