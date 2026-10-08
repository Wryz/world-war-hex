import { createBattle, executeMoves, resolveAllCombats, getTimeScore, getMaxRounds } from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { getLevel, enemyRosterStats } from '@/lib/campaign/levels';
import { deckRoster } from '@/lib/campaign/battleSetup';
import { expectedProgression } from '@/lib/meta/economy';
const ids = process.argv.slice(2).map(Number);
for (const id of ids) {
  const level = getLevel(id); const { deck, levels } = expectedProgression(id);
  const rows: number[][] = [];
  for (let b = 0; b < 24; b++) {
    let s = createBattle({ ...level.settings, seed: 5000 + b * 7 + id }, { rosters: { player: deckRoster(deck, levels), ai: enemyRosterStats(level) }, deck, levelId: id, guards: level.guards });
    for (let i = 0; i < 500 && s.currentPhase !== 'gameOver'; i++) {
      if (s.currentPhase === 'planning') s = executeMoves(planAITurn(s, { side: s.activePlayer ?? 'player', difficulty: s.activePlayer === 'player' ? 'medium' : level.settings.aiDifficulty }));
      else if (s.currentPhase === 'combat') s = resolveAllCombats(s); else break;
    }
    if (s.winner !== 'player') continue;
    const t = getTimeScore(s, 'player');
    rows.push([t.kills, t.gold, t.camps, getMaxRounds(s) - s.turnNumber]);
  }
  const med = (k: number) => { const v = rows.map(r => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0; };
  const totals = rows.map(r => r[0] + r[1] + r[2]).sort((a, b) => a - b);
  console.log(id, 'wins', rows.length, 'med kills', med(0), 'gold', med(1), 'camps', med(2), 'roundsLeft', med(3), 'totals p25/50/80', totals[Math.floor(totals.length * .25)], totals[Math.floor(totals.length * .5)], totals[Math.floor(totals.length * .8)]);
}
