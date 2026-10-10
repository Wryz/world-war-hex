import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '@/types/game';
import { getStarScore } from '@/lib/game/gameState';
import { getLevel, starThresholds } from '@/lib/campaign/levels';
import { TUTORIAL_LEVEL_ID } from '@/lib/game/tutorialField';
import { FilledStarIcon, StarIcon } from '../icons';
import { emitMoment } from '../effects/effects';
import { playBattleSound } from '../utils/battleSounds';

// The stars a campaign battle would earn if it were won this round: the points so far (kills, gold,
// camps and the bonus for the rounds left) against the level's two- and three-star marks. Every
// point scored pops up beside it, and reaching a mark gets a callout, so a good move pays off at once.

interface Popup {
  id: number;
  amount: number;
}

export const StarMeter: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const levelId = gameState.levelId;
  const level = levelId && levelId !== TUTORIAL_LEVEL_ID ? getLevel(levelId) : null;
  const hasLevel = !!level;
  const score = getStarScore(gameState, 'player');
  const [two, three] = level ? starThresholds(level) : [Infinity, Infinity];
  const inReach = 1 + (score.total >= two ? 1 : 0) + (score.total >= three ? 1 : 0);

  const [popups, setPopups] = useState<Popup[]>([]);
  const previousRef = useRef<{ levelId?: number; points: number; inReach: number } | null>(null);
  const nextId = useRef(0);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { levelId, points: score.total, inReach };
    // (nothing to compare with in a battle's first moment)
    if (!hasLevel || !previous || previous.levelId !== levelId || gameState.currentPhase === 'gameOver') return;
    // Points scored (the round bonus ticking down as rounds pass is no news)
    const gained = score.total - previous.points;
    if (gained > 0) {
      const id = nextId.current++;
      setPopups(current => [...current.slice(-2), { id, amount: gained }]);
      setTimeout(() => setPopups(current => current.filter(popup => popup.id !== id)), 1500);
    }
    if (inReach > previous.inReach && gained > 0) {
      playBattleSound('bounty', 0.6);
      emitMoment(inReach === 3
        ? { title: 'Three Stars in Reach!', subtitle: 'Win now for every star', tone: 'gold' }
        : { title: 'Two Stars in Reach!', subtitle: 'Keep scoring for the third', tone: 'gold' });
    }
  }, [hasLevel, levelId, score.total, inReach, gameState.currentPhase]);

  if (!level) return null;
  const next = score.total < two ? two : score.total < three ? three : null;
  const title = `If you win this round: ${score.total} points, ${inReach} ${inReach === 1 ? 'star' : 'stars'}. ` +
    `Two stars at ${two}, three at ${three}. ` +
    `Kills ${score.kills}, gold ${score.gold}, camps ${score.camps}, round bonus ${score.speed} (it shrinks every round).`;

  return (
    <span className="relative flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5" title={title} aria-label={title}>
      <span className="flex items-center text-sm">
        {[1, 2, 3].map(star => star <= inReach
          ? <FilledStarIcon key={star} />
          : <StarIcon key={star} color="#64748b" />)}
      </span>
      <span className="text-xs font-bold tabular-nums text-amber-200">
        {score.total}
        {next !== null && <span className="hidden text-slate-500 sm:inline">/{next}</span>}
      </span>
      {popups.map(popup => (
        <span key={popup.id} className="animate-float-up pointer-events-none absolute -bottom-5 right-1 text-xs font-bold text-amber-300 drop-shadow">
          +{popup.amount}
        </span>
      ))}
    </span>
  );
};
