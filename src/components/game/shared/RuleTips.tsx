import React, { useEffect, useState } from 'react';
import { GameState } from '@/types/game';
import { FLANK_BONUS, HEIGHT_DAMAGE_PER_UNIT, getCombatEffects, getSituationalBonuses } from '@/lib/game/gameState';
import { ArrowIcon } from '../icons';
import { unitSignature } from '@/lib/game/signatures';
import { SHAKEN_ATTACK, WEATHER, WeatherId } from '@/lib/game/regionRules';

// One-off tips the first time a rule comes up in a battle (flanking, height, village cover,
// following a troop out of its hex). Each shows once per browser, then never again.

type TipId = 'flank' | 'height' | 'village' | 'follow' | 'signature' | 'morale' | 'undying' | `weather-${WeatherId}`;

const TIPS: Record<TipId, string> = {
  flank: `Flanked! Each extra attacker on one enemy adds +${Math.round(FLANK_BONUS * 100)}% (up to two).`,
  height: `Height: +${Math.round(HEIGHT_DAMAGE_PER_UNIT * 100)}% damage per 1.0 above your target. Uphill costs the same.`,
  village: 'Villages: 20% less damage, and walls that block arrows from below.',
  follow: 'A hex your troop is leaving is free for another. Ctrl+Z undoes an order.',
  signature: 'A glowing sparkle under a troop: its signature ability is working. Tap for details.',
  morale: `Morale: when a boss or champion falls its army is shaken, and a badly hurt troop surrounded with no friend beside it wavers. Shaken troops hit ${Math.round((1 - SHAKEN_ATTACK) * 100)}% softer for a turn.`,
  undying: 'The undead rise again once when slain. War Clerics and fire finish them for good.',
  'weather-fogBanks': `Fog banks drift a hex every round. ${WEATHER.fogBanks.description}`,
  'weather-sandstorm': `Sandstorms blow two rounds in every four (watch the top bar). ${WEATHER.sandstorm.description}`,
  'weather-blizzard': `Blizzards blow two rounds in every four (watch the top bar). ${WEATHER.blizzard.description}`,
  'weather-ashfall': WEATHER.ashfall.description
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
  if (state.settings?.weather) tips.push(`weather-${state.settings.weather}`);
  if ([...state.players.player.units, ...state.players.ai.units].some(unit => unit.shaken)) tips.push('morale');
  if (state.players.ai.units.some(unit => unit.risen)) tips.push('undying');
  if (state.hexGrid.some(hex => hex.terrain === 'village')) tips.push('village');
  if (state.currentPhase === 'combat') {
    const labels = state.combats.filter(combat => !combat.resolved).flatMap(combat => getCombatEffects(state, combat).map(effect => effect.label));
    if (labels.includes('Flanked')) tips.push('flank');
    if (labels.includes('High ground') || labels.includes('Uphill')) tips.push('height');
  }
  if (state.currentPhase === 'planning' && state.activePlayer === 'player' &&
    state.pendingMoves.length > 0 && state.players.player.units.length >= 2) tips.push('follow');
  // The first time one of your troops' signatures is working
  if (state.players.player.units.some(unit => {
    const signature = unitSignature(unit);
    return signature && getSituationalBonuses(state, unit).some(bonus => bonus.label === signature.def.name);
  })) tips.push('signature');
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
  // (below the boss's health bar, while there is one)
  const hasBoss = gameState.players.ai.units.some(unit => unit.isBoss);
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-[44] flex justify-center px-3 ${hasBoss ? 'top-[7.25rem]' : 'top-20'}`}>
      <div className="animate-fadeIn pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl bg-slate-900/95 p-2 text-xs text-slate-100 shadow-2xl ring-2 ring-sky-400/70 sm:gap-3 sm:p-3 sm:text-sm">
        <span className="font-display mt-0.5 hidden rounded-full bg-sky-400 px-2 text-xs text-slate-900 sm:inline">New rule</span>
        <p className="flex-1 font-semibold leading-snug">{TIPS[tip]}</p>
        <button onClick={() => setTip(null)} className="font-display shrink-0 rounded-lg bg-sky-500 px-2 py-1 text-slate-900 hover:bg-sky-400 sm:px-3">
          <span className="flex items-center gap-1">Got it <ArrowIcon /></span>
        </button>
      </div>
    </div>
  );
};
