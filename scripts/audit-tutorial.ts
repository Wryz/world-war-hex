// Audit of the tutorial's guidance: plays the tutorial battles with the player's side doing exactly
// what the hand shows (planTutorialTurn) and reports how often that wins, what the hand says, and any
// step that sends a healthy troop away from the fight without attacking.
//
//   npx tsx scripts/audit-tutorial.ts [battles] [level ...]

import { GameState } from '@/types/game';
import {
  addPendingMove, addPendingPurchase, canStrike, canStrikeCastle, chooseCastle, executeMoves, findBaseHex, getTerrainDistanceMap,
  getVisibleEnemies, resolveAllCombats
} from '@/lib/game/gameState';
import { planAITurn } from '@/lib/ai/aiPlayer';
import { buildBattle } from '@/lib/campaign/battleSetup';
import { getLevel } from '@/lib/campaign/levels';
import { createProfile } from '@/lib/meta/profile';
import { getHexDistance } from '@/lib/game/hexUtils';
import { bestCastleSite, deployCandidates, frontOf, planTutorialTurn } from '@/lib/game/tutorialPlan';

const args = process.argv.slice(2).map(Number);
const battles = args[0] || 20;
const levels = args.length > 1 ? args.slice(1) : [1, 2];

for (const levelId of levels) {
  let wins = 0;
  let rounds = 0;
  const captions = new Map<string, number>();
  const odd: string[] = [];
  const mismatched: string[] = [];
  // Recruits placed well back from the fight when a spot nearer it was free
  const deployedBack: string[] = [];
  let deploys = 0;
  for (let battle = 0; battle < battles; battle++) {
    let state: GameState = buildBattle({ mode: 'campaign', levelId }, createProfile());
    if (state.castleChoices) state = chooseCastle(state, bestCastleSite(state)!);
    for (let step = 0; step < 600 && state.currentPhase !== 'gameOver'; step++) {
      if (state.currentPhase === 'planning' && state.activePlayer === 'player') {
        const plan = planTutorialTurn(state);
        const start = state;
        const spoken = new Set(plan.flatMap(step => step.kind === 'move' ? [`${step.to.q},${step.to.r}`] : []));
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
            // Does the caption describe the move?
            const hexAt = (c: { q: number; r: number }) => state.hexGrid.find(hex => hex.coordinates.q === c.q && hex.coordinates.r === c.r);
            const there = { ...unit, position: item.to };
            const near = (c: { q: number; r: number }, wanted: (hex: GameState['hexGrid'][number]) => boolean) =>
              Math.min(99, ...state.hexGrid.filter(wanted).map(hex => getHexDistance(hex.coordinates, c)));
            const castle = findBaseHex(state, 'ai')!.coordinates;
            const steps = getTerrainDistanceMap(state.hexGrid, castle);
            const stepsTo = (c: { q: number; r: number }) => steps.get(`${c.q},${c.r}`) ?? 99;
            const checks: [RegExp, boolean][] = [
              [/^Attack the (?!enemy castle)|^Stop the/, foes.some(foe => canStrike(state, there, foe))],
              [/^Attack the enemy castle/, canStrikeCastle(state, there)],
              [/heal at the spring/, hexAt(item.to)?.terrain === 'spring'],
              [/make for the spring/, near(item.to, hex => hex.terrain === 'spring') < near(unit.position, hex => hex.terrain === 'spring')],
              [/fall back/, nearest(item.to) > nearest(unit.position)],
              [/^Take the camp/, !!hexAt(item.to)?.isCamp],
              [/^Take the gold mine/, !!hexAt(item.to)?.isResourceHex],
              [/^Head off/, nearest(item.to) < nearest(unit.position)],
              [/^March on|^All-out/, stepsTo(item.to) <= stepsTo(unit.position)]
            ];
            for (const [pattern, holds] of checks) {
              if (pattern.test(item.caption) && !holds) mismatched.push(`L${levelId} r${state.turnNumber} ${unit.type} ${unit.lifespan}/${unit.maxLifespan}: "${item.caption}"`);
            }
            state = addPendingMove(state, item.unitId, state.players.player.id, item.to);
          } else {
            // Against the nearest spot it could have had (by the tutorial's own rules: out of reach
            // when it can be, never beside an enemy for archers and mages)
            // (on the board as the plan saw it, before this turn's orders, with the spots its moves
            // and earlier cards use set aside)
            const front = frontOf(start)!;
            const best = Math.min(99, ...deployCandidates(start, item.unitType, spoken).map(hex => getHexDistance(hex.coordinates, front)));
            spoken.add(`${item.at.q},${item.at.r}`);
            deploys++;
            if (getHexDistance(item.at, front) > best + 1) {
              deployedBack.push(`L${levelId} r${state.turnNumber} ${item.unitType}: ${getHexDistance(item.at, front)} from the front, ${best} was free ("${item.placeCaption}")`);
            }
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
  console.log(`  ${deployedBack.length} of ${deploys} recruits placed well back from the fight:`);
  for (const line of deployedBack.slice(0, 12)) console.log(`    ${line}`);
  console.log(`  ${mismatched.length} captions that don't match their move:`);
  for (const line of mismatched.slice(0, 12)) console.log(`    ${line}`);
}
