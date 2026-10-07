// Balance check for the campaign: plays AI-vs-AI battles where the "player" side uses the deck the
// progression model expects at each level, and reports how often it wins and how long battles last.
//
//   npx tsx scripts/simulate-balance.ts [battlesPerLevel] [level ...]
//   npx tsx scripts/simulate-balance.ts --tune [battlesPerLevel] [level ...]
//
// --tune searches, for each level, for the enemy strength (relative to the current setting) at which
// the model player wins TARGET_WIN_RATE of battles.

import { GameState } from '@/types/game';
import { createBattle, executeMoves, resolveAllCombats } from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { getLevel, enemyRosterStats, LEVEL_COUNT } from '@/lib/campaign/levels';
import { expectedProgression } from '@/lib/meta/economy';
import { deckRoster } from '@/lib/campaign/battleSetup';
import { TROOPS, cardStats, scaleTroop } from '@/lib/game/troops';

const args = process.argv.slice(2);
const tune = args[0] === '--tune';
if (tune) args.shift();
const TARGET_WIN_RATE = 0.65;
const battlesPerLevel = Number(args[0] ?? 12);
const requested = args.slice(1).map(Number).filter(n => n >= 1 && n <= LEVEL_COUNT);
const levels = requested.length > 0 ? requested : [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100];

// Shuffle so the hand differs from battle to battle, as it would for a real player
const shuffle = <T>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// `strength` scales the enemy's troops relative to the level's own setting
// Largest army either side fielded in the last battle played
let peakArmy = 0;

const playBattle = (levelId: number, strength = 1): GameState => {
  const level = getLevel(levelId);
  const { deck, levels: cardLevels } = expectedProgression(levelId);
  const enemy = strength === 1
    ? enemyRosterStats(level)
    : Object.fromEntries(level.enemyRoster.map(id => [id, scaleTroop(TROOPS[id], level.enemyScale * strength)]));
  const guards = level.guards.map(guard => ({
    ...guard,
    stats: { ...guard.stats, attackPower: guard.stats.attackPower * strength, maxLifespan: Math.round(guard.stats.maxLifespan * strength) }
  }));
  let state = createBattle({ ...level.settings, seed: Math.floor(Math.random() * 1e9) }, {
    rosters: {
      player: deckRoster(deck, cardLevels),
      ai: enemy
    },
    deck: shuffle(deck),
    levelId,
    guards
  });

  peakArmy = 0;
  for (let step = 0; step < 500 && state.currentPhase !== 'gameOver'; step++) {
    peakArmy = Math.max(peakArmy, state.players.player.units.length, state.players.ai.units.length);
    if (state.currentPhase === 'planning') {
      const side = state.activePlayer ?? 'player';
      // The model player plays at medium skill
      state = executeMoves(planAITurn(state, { side, difficulty: side === 'player' ? 'medium' : level.settings.aiDifficulty }));
    } else if (state.currentPhase === 'combat') {
      state = resolveAllCombats(state);
    } else {
      break;
    }
  }
  return state;
};

const winRate = (levelId: number, strength: number, battles: number) => {
  let wins = 0;
  for (let i = 0; i < battles; i++) if (playBattle(levelId, strength).winner === 'player') wins++;
  return wins / battles;
};

if (tune) {
  console.log('level  strength-for-' + Math.round(TARGET_WIN_RATE * 100) + '%-wins');
  for (const levelId of levels) {
    // Win rate falls as strength rises: bisect on a log scale
    let low = 0.3;
    let high = 1.6;
    for (let step = 0; step < 7; step++) {
      const mid = Math.sqrt(low * high);
      if (winRate(levelId, mid, battlesPerLevel) > TARGET_WIN_RATE) low = mid;
      else high = mid;
    }
    console.log(String(levelId).padStart(5), Math.sqrt(low * high).toFixed(2).padStart(8));
  }
  process.exit(0);
}

console.log('level  region                 power  scale  win%  avgRounds  recruits  peakArmy  storm/destroy/time');
for (const levelId of levels) {
  const level = getLevel(levelId);
  let wins = 0;
  let rounds = 0;
  let recruits = 0;
  let peak = 0;
  const reasons = { stormed: 0, destroyed: 0, timeout: 0 };
  for (let i = 0; i < battlesPerLevel; i++) {
    const result = playBattle(levelId);
    if (result.winner === 'player') wins++;
    rounds += result.turnNumber;
    recruits += ((result.battleStats?.player.recruited ?? 0) + (result.battleStats?.ai.recruited ?? 0)) / 2;
    peak += peakArmy;
    if (result.winReason) reasons[result.winReason]++;
  }
  console.log(
    String(levelId).padStart(5),
    ' ', level.region.name.padEnd(22),
    String(expectedProgression(levelId).power).padStart(5),
    level.enemyScale.toFixed(2).padStart(6),
    String(Math.round(wins / battlesPerLevel * 100)).padStart(5),
    (rounds / battlesPerLevel).toFixed(1).padStart(10),
    (recruits / battlesPerLevel).toFixed(1).padStart(9),
    (peak / battlesPerLevel).toFixed(1).padStart(9),
    `   ${reasons.stormed}/${reasons.destroyed}/${reasons.timeout}`
  );
}
