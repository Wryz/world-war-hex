// Balance check for the campaign: plays AI-vs-AI battles where the "player" side uses the deck the
// progression model expects at each level, and reports how often it wins and how long battles last.
//
//   npx tsx scripts/simulate-balance.ts [battlesPerLevel] [level ...]
//   npx tsx scripts/simulate-balance.ts --tune [battlesPerLevel] [level ...]
//   npx tsx scripts/simulate-balance.ts --boss-only --tune [battlesPerLevel] [boss level ...]
//   npx tsx scripts/simulate-balance.ts --troops-only --tune [battlesPerLevel] [boss level ...]
//
// --tune searches, for each level, for the enemy strength (relative to the current setting) at which
// the model player wins its level's target share of battles (targetWinRate in levels.ts).

import { GameState } from '@/types/game';
import { createBattle, executeMoves, resolveAllCombats } from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { getLevel, enemyRosterStats, LEVEL_COUNT, targetWinRate } from '@/lib/campaign/levels';
import { expectedProgression } from '@/lib/meta/economy';
import { deckRoster } from '@/lib/campaign/battleSetup';
import { TROOPS, cardStats, scaleTroop } from '@/lib/game/troops';

const args = process.argv.slice(2);
// --no-fog plays every battle without the fog of war, to see what the fog changes
const noFog = args.includes('--no-fog');
if (noFog) args.splice(args.indexOf('--no-fog'), 1);
// --boss-only makes --strength and --tune scale only the guards (a boss level's boss), not the
// troops the enemy recruits; --troops-only the other way round
const bossOnly = args.includes('--boss-only');
if (bossOnly) args.splice(args.indexOf('--boss-only'), 1);
const troopsOnly = args.includes('--troops-only');
if (troopsOnly) args.splice(args.indexOf('--troops-only'), 1);
// --strength x plays every battle with the enemy x times as strong as the level's setting
const strengthAt = args.indexOf('--strength');
const fixedStrength = strengthAt >= 0 ? Number(args[strengthAt + 1]) : 1;
if (strengthAt >= 0) args.splice(strengthAt, 2);
const tune = args[0] === '--tune';
if (tune) args.shift();
const battlesPerLevel = Number(args[0] ?? 12);
const requested = args.slice(1).map(Number).filter(n => n >= 1 && n <= LEVEL_COUNT);
const levels = requested.length > 0 ? requested : [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];

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
  const enemy = strength === 1 || bossOnly
    ? enemyRosterStats(level)
    : Object.fromEntries(level.enemyRoster.map(id => [id, scaleTroop(TROOPS[id], level.enemyScale * strength)]));
  const guards = troopsOnly ? level.guards : level.guards.map(guard => ({
    ...guard,
    stats: { ...guard.stats, attackPower: guard.stats.attackPower * strength, maxLifespan: Math.round(guard.stats.maxLifespan * strength) }
  }));
  let state = createBattle({ ...level.settings, fogOfWar: level.settings.fogOfWar && !noFog, seed: Math.floor(Math.random() * 1e9) }, {
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
  console.log('level  strength-for-target-wins');
  for (const levelId of levels) {
    // Win rate falls as strength rises: bisect on a log scale
    let low = 0.3;
    let high = 2.6;
    for (let step = 0; step < 7; step++) {
      const mid = Math.sqrt(low * high);
      if (winRate(levelId, mid, battlesPerLevel) > targetWinRate(levelId)) low = mid;
      else high = mid;
    }
    console.log(String(levelId).padStart(5), Math.sqrt(low * high).toFixed(2).padStart(8));
  }
  process.exit(0);
}

console.log('level  region                 power  scale  win% target  avgRounds  recruits  peakArmy  destroy/time        castleHit%');
for (const levelId of levels) {
  const level = getLevel(levelId);
  let wins = 0;
  let rounds = 0;
  let recruits = 0;
  let peak = 0;
  const reasons = { destroyed: 0, timeout: 0 };
  // Battles in which either castle was attacked at all
  let castleHits = 0;
  for (let i = 0; i < battlesPerLevel; i++) {
    const result = playBattle(levelId, fixedStrength);
    if (result.winner === 'player') wins++;
    rounds += result.turnNumber;
    recruits += ((result.battleStats?.player.recruited ?? 0) + (result.battleStats?.ai.recruited ?? 0)) / 2;
    peak += peakArmy;
    if (result.winReason) reasons[result.winReason]++;
    if ((result.battleStats?.player.siegeDamage ?? 0) + (result.battleStats?.ai.siegeDamage ?? 0) > 0) castleHits++;
  }
  console.log(
    String(levelId).padStart(5),
    ' ', level.region.name.padEnd(22),
    String(expectedProgression(levelId).power).padStart(5),
    level.enemyScale.toFixed(2).padStart(6),
    String(Math.round(wins / battlesPerLevel * 100)).padStart(5),
    String(Math.round(targetWinRate(levelId) * 100)).padStart(6),
    (rounds / battlesPerLevel).toFixed(1).padStart(10),
    (recruits / battlesPerLevel).toFixed(1).padStart(9),
    (peak / battlesPerLevel).toFixed(1).padStart(9),
    `   ${reasons.destroyed}/${reasons.timeout}`.padEnd(20),
    String(Math.round(castleHits / battlesPerLevel * 100)).padStart(9)
  );
}
