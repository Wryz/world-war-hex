import React, { useEffect, useState } from 'react';
import { GameState } from '@/types/game';
import { FLANK_BONUS, HEIGHT_DAMAGE_PER_UNIT, getCombatEffects } from '@/lib/game/gameState';
import { ArrowIcon } from '../icons';
import { unitSignature } from '@/lib/game/signatures';

// One-off tips the first time a rule comes up in a battle (flanking, height, village cover,
// following a troop out of its hex). Each shows once per browser, then never again.

type TipId = 'flank' | 'height' | 'village' | 'follow' | 'tactics' | 'signature';

const TIPS: Record<TipId, string> = {
  flank: `Flanked! Two or more troops attacking the same enemy each hit +${Math.round(FLANK_BONUS * 100)}% harder (up to two extra).`,
  height: `Height counts: every 1.0 of height (the number on each hex) above your target adds +${Math.round(HEIGHT_DAMAGE_PER_UNIT * 100)}% damage. Uphill takes it away.`,
  village: 'Villages: troops in one take 20% less damage, and the houses block arrows from lower ground.',
  follow: 'Tip: a hex one of your troops is leaving counts as free - send another troop onto it. Undo (Ctrl+Z) takes back an order.',
  tactics: 'Tactic card! From round 2, every second round you draw one of the three you brought (hold up to 3). Tap it to play - some need a target. The enemy draws them too.',
  signature: 'Signature abilities: from level 2 every card has one, and it grows every two levels. Tap the sparkle under a troop to see what it does and when it works.'
};

const STORAGE_KEY = 'wwhTipsSeen';

const readSeen = (): Set<TipId> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TipId[]);
  } catch {
    return new Set();
  }
};

const markSeen = (id: TipId) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readSeen(), id]));
  } catch {
    // Storage blocked: the tip may show again next visit
  }
};

// Which tips the battle's current moment calls for
const tipsFor = (state: GameState): TipId[] => {
  const tips: TipId[] = [];
  if (state.hexGrid.some(hex => hex.terrain === 'village')) tips.push('village');
  if (state.currentPhase === 'combat') {
    const labels = state.combats.filter(combat => !combat.resolved).flatMap(combat => getCombatEffects(state, combat).map(effect => effect.label));
    if (labels.includes('Flanked')) tips.push('flank');
    if (labels.includes('High ground') || labels.includes('Uphill')) tips.push('height');
  }
  if (state.currentPhase === 'planning' && state.activePlayer === 'player' &&
    state.pendingMoves.length > 0 && state.players.player.units.length >= 2) tips.push('follow');
  if (state.currentPhase === 'planning' && state.activePlayer === 'player' && (state.tactics?.player.hand.length ?? 0) > 0) tips.push('tactics');
  if (state.players.player.units.some(unit => unitSignature(unit))) tips.push('signature');
  return tips;
};

export const RuleTips: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const [tip, setTip] = useState<TipId | null>(null);

  useEffect(() => {
    if (tip) return;
    const seen = readSeen();
    const next = tipsFor(gameState).find(id => !seen.has(id));
    if (next) {
      markSeen(next);
      setTip(next);
    }
  }, [gameState, tip]);

  if (!tip) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[44] flex justify-center px-3">
      <div className="animate-fadeIn pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-slate-900/95 p-3 text-sm text-slate-100 shadow-2xl ring-2 ring-sky-400/70">
        <span className="font-display mt-0.5 rounded-full bg-sky-400 px-2 text-xs text-slate-900">New rule</span>
        <p className="flex-1 font-semibold leading-snug">{TIPS[tip]}</p>
        <button onClick={() => setTip(null)} className="font-display shrink-0 rounded-lg bg-sky-500 px-3 py-1 text-slate-900 hover:bg-sky-400">
          <span className="flex items-center gap-1">Got it <ArrowIcon /></span>
        </button>
      </div>
    </div>
  );
};
