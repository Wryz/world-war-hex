import React, { useEffect, useRef, useState } from 'react';
import { useIsNarrow } from '../../shared/useIsNarrow';
import { GameState, HeldTactic, UnitType } from '@/types/game';
import { getHand, getNextCard, getRosterStats, getTroopName } from '@/lib/game/gameState';
import { TroopCard } from '../cards/TroopCard';
import { TacticCard } from '../cards/TacticCard';
import { TACTICS } from '@/lib/game/tactics';
import { ArrowIcon, BondIcon, GoldIcon, UndoIcon } from '../icons';
import { BondDef, describeBond, getBond } from '@/lib/game/bonds';
import { PANEL_CLASS } from './styles';

// The bonds at work this battle as one small badge with their count; tapping it lists them
const BondBadge: React.FC<{ bonds: BondDef[] }> = ({ bonds }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1">
      {open && (
        <div className="flex flex-col gap-0.5 rounded-xl bg-slate-900/90 px-3 py-1.5 text-[0.6875rem] shadow">
          {bonds.map(bond => (
            <span key={bond.id}><b className="text-amber-200">{bond.name}</b> <span className="text-slate-300">{describeBond(bond)}</span></span>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label={`${bonds.length} active bond${bonds.length === 1 ? '' : 's'}`}
        title={bonds.map(bond => `${bond.name}: ${describeBond(bond)}`).join('\n')}
        className="flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[0.6875rem] font-bold text-amber-200 shadow ring-1 ring-amber-300/50"
      >
        <BondIcon /> {bonds.length}
      </button>
    </div>
  );
};

// Phones get smaller cards so a full hand and the End Turn button fit across the screen

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
  // Tactic cards held, the one being aimed, and picking one
  tactics?: HeldTactic[];
  selectedTactic?: string | null;
  onTacticSelect?: (uid: string) => void;
}

// The player's hand at the bottom of the screen: the cards they brought into battle. Pick a card,
// then a glowing hex to play it.
export const CardHand: React.FC<CardHandProps> = ({
  gameState, isAITurn, selectedUnitType, hint, onCardSelect, onEndTurn, canUndo = false, onUndo, tactics = [], selectedTactic = null, onTacticSelect
}) => {
  const hand = getHand(gameState);
  const nextCard = getNextCard(gameState);
  const gold = gameState.players.player.points;
  const isNarrow = useIsNarrow();
  const bonds = (gameState.bonds ?? []).map(getBond);

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
  }, [gameState.deck]);

  if (isAITurn) {
    return (
      <div className="fixed bottom-4 inset-x-0 z-20 flex justify-center pointer-events-none">
        <div className={`${PANEL_CLASS} px-5 py-2.5 flex items-center gap-3 text-sm`}>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold">Enemy is planning…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-2 inset-x-2 z-20 flex flex-col items-center gap-2 pointer-events-none" data-tutorial="hand">
      {/* Bonds the player's cards complete this battle: one badge, tap for the list */}
      {bonds.length > 0 && !hint && <BondBadge bonds={bonds} />}
      {hint && (
        <div className="rounded-full bg-slate-900/85 px-4 py-1.5 text-center text-xs font-semibold text-slate-100 shadow">
          {hint}
        </div>
      )}

      {/* Tactic cards held: tap to play (or to aim, then tap a pink hex) */}
      {tactics.length > 0 && onTacticSelect && (
        <div className="pointer-events-auto flex items-end gap-1.5 sm:gap-2" role="group" aria-label="Your tactic cards" data-tutorial="tactics">
          <span className="mr-0.5 self-center text-[0.5625rem] font-bold uppercase tracking-widest text-slate-100 drop-shadow">Tactics</span>
          {tactics.map(card => (
            <TacticCard
              key={card.uid}
              id={card.id}
              level={card.level}
              size={isNarrow ? 'xs' : 'sm'}
              selected={selectedTactic === card.uid}
              onClick={() => onTacticSelect(card.uid)}
              className="card-draw"
              title={`${TACTICS[card.id].name} (level ${card.level}): ${TACTICS[card.id].describe(card.level)}`}
            />
          ))}
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
            const stats = getRosterStats(gameState, 'player', type);
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
                data-tutorial={index === 0 ? 'first-card' : undefined}
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
              <TroopCard type={nextCard} level={getRosterStats(gameState, 'player', nextCard)?.level ?? 1} size="xs" hideLevel />
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-stretch gap-1.5">
          {/* Gold on small screens */}
          <span className={`${PANEL_CLASS} font-display flex items-center justify-center gap-1 px-2 py-1 text-base text-amber-300 sm:hidden`}>
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
            className="font-display rounded-xl bg-amber-500 px-2 py-2.5 text-sm leading-tight text-slate-900 shadow-[0_5px_0_#b45309] transition-transform hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-1 active:shadow-[0_1px_0_#b45309] sm:px-5 sm:py-3 sm:text-lg"
          >
            <span className="flex items-center gap-1 sm:gap-1.5">End{isNarrow ? <br /> : ' '}Turn <ArrowIcon /></span>
          </button>
        </div>
      </div>
    </div>
  );
};
