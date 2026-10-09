// Audit of the tutorial's guidance: plays the tutorial battles with the player's side doing exactly
// what the hand shows (planTutorialTurn) and reports how often that wins, what the hand says, and any
// step that sends a healthy troop away from the fight without attacking.
//
//   npx tsx scripts/audit-tutorial.ts [battles] [level ...]

import { GameState } from '@/types/game';
import {
  addPendingMove, addPendingPurchase, chooseCastle, executeMoves, getVisibleEnemies, resolveAllCombats
} from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { buildBattle } from '@/lib/campaign/battleSetup';
import { getLevel } from '@/lib/campaign/levels';
import { createProfile } from '@/lib/meta/profile';
import { getHexDistance } from '@/lib/game/hexUtils';
import { bestCastleSite, planTutorialTurn } from '@/lib/game/tutorialPlan';

const args = process.argv.slice(2).map(Number);
const battles = args[0] || 20;
const levels = args.length > 1 ? args.slice(1) : [1, 2];

for (const levelId of levels) {
  let wins = 0;
  let rounds = 0;
  const captions = new Map<string, number>();
  const odd: string[] = [];
  for (let battle = 0; battle < battles; battle++) {
    let state: GameState = buildBattle({ mode: 'campaign', levelId }, createProfile());
    if (state.castleChoices) state = chooseCastle(state, bestCastleSite(state)!);
    for (let step = 0; step < 600 && state.currentPhase !== 'gameOver'; step++) {
      if (state.currentPhase === 'planning' && state.activePlayer === 'player') {
        const plan = planTutorialTurn(state);
        const foes = getVisibleEnemies(state, 'player');
        for (const item of plan) {
          const label = item.caption.replace(/the [A-Z][\w ]+?(:|$| before)/, 'the X$1').split(':')[0];
          captions.set(label, (captions.get(label) ?? 0) + 1);
          if (item.kind === 'move') {
            const unit = state.players.player.units.find(other => other.id === item.unitId)!;
            const nearest = (c: { q: number; r: number }) => Math.min(99, ...foes.map(foe => getHexDistance(foe.position, c)));
            if (unit.lifespan > unit.maxLifespan / 2 && foes.length > 0 && nearest(item.to) > nearest(unit.position) + 1 && !/Attack|Stop|castle|camp|mine/.test(item.caption)) {
              odd.push(`L${levelId} r${state.turnNumber} ${unit.type} ${unit.lifespan}/${unit.maxLifespan}: ${item.caption} (nearest foe ${nearest(unit.position)} -> ${nearest(item.to)})`);
            }
            state = addPendingMove(state, item.unitId, state.players.player.id, item.to);
          } else {
            state = addPendingPurchase(state, state.players.player.id, item.unitType, item.at);
          }
        }
        state = executeMoves(state);
      } else if (state.currentPhase === 'planning') {
        state = executeMoves(planAITurn(state, { difficulty: getLevel(levelId).settings.aiDifficulty }));
      } else if (state.currentPhase === 'combat') {
        state = resolveAllCombats(state);
      } else break;
    }
    if (state.winner === 'player') wins++;
    rounds += state.turnNumber;
  }
  console.log(`Level ${levelId}: won ${wins}/${battles}, ${(rounds / battles).toFixed(1)} rounds on average`);
  for (const [label, count] of [...captions].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(4)}  ${label}`);
  console.log(`  ${odd.length} steps send a healthy troop away from the fight:`);
  for (const line of odd.slice(0, 12)) console.log(`    ${line}`);
}
