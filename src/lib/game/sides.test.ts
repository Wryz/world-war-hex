// Battles between more than two sides: turn order, allies, strike-backs from every side, sides
// knocked out, and whole battles played out by the AI
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, PlayerType } from '@/types/game';
import {
  DEFAULT_SETTINGS, SideSetup, createBattle, defaultRoster, executeMoves, findBaseHex, getStandings, resign, resolveAllCombats
} from './gameState';
import { getEnemySides, getLivingSides, nextSide } from './sides';
import { getHexDistance, getNeighbors } from './hexUtils';
import { planAITurn } from '../ai/aiPlayer';
import { makeUnit, place, health, playTurn } from './testUtils';

const sideSetups = (count: number, teams?: number[]): SideSetup[] =>
  Array.from({ length: count }, (_, i) => ({ id: `s${i + 1}`, name: `Side ${i + 1}`, color: i, ai: true, team: teams?.[i] }));

const multiBattle = (count: number, options: { teams?: number[]; gridSize?: number; seed?: number; fog?: boolean } = {}): GameState => {
  const sides = sideSetups(count, options.teams);
  return createBattle(
    { ...DEFAULT_SETTINGS, gridSize: options.gridSize ?? Math.max(4, count), fogOfWar: options.fog ?? false, seed: options.seed ?? 11 },
    { sides, rosters: Object.fromEntries(sides.map(side => [side.id, defaultRoster()])), battleSeed: options.seed ?? 11 }
  );
};

// An open, empty field with every castle standing, on `active`'s turn
const openField = (state: GameState, active: PlayerType): GameState => {
  for (const hex of state.hexGrid) {
    if (!hex.isBase) {
      hex.terrain = 'plain';
      hex.owner = undefined;
    }
    hex.feature = undefined;
    hex.fire = undefined;
    hex.isResourceHex = false;
    hex.isCamp = false;
    hex.unit = undefined;
  }
  for (const player of Object.values(state.players)) player.units = [];
  return { ...state, currentPhase: 'planning', activePlayer: active };
};

test('every side gets a castle on the edge, none next to another', () => {
  for (const count of [3, 4, 5, 8]) {
    const state = multiBattle(count);
    const castles = state.sides!.map(side => findBaseHex(state, side));
    assert.ok(castles.every(Boolean), `${count} sides: every side has a castle`);
    for (const [i, a] of castles.entries()) {
      for (const b of castles.slice(i + 1)) assert.ok(getHexDistance(a!.coordinates, b!.coordinates) >= 3);
    }
    assert.equal(state.currentPhase, 'planning');
    assert.equal(state.activePlayer, 's1');
  }
});

test('turns pass round every side still in the battle, and a round ends after the last', () => {
  const state = multiBattle(3);
  assert.deepEqual(nextSide(state, 's1'), { side: 's2', newRound: false });
  assert.deepEqual(nextSide(state, 's3'), { side: 's1', newRound: true });
  state.players.s2.eliminated = true;
  assert.deepEqual(nextSide(state, 's1'), { side: 's3', newRound: false });

  let played = multiBattle(3);
  played = playTurn(played);
  assert.equal(played.activePlayer, 's2');
  assert.equal(played.turnNumber, 1);
  played = playTurn(playTurn(played));
  assert.equal(played.activePlayer, 's1');
  assert.equal(played.turnNumber, 2);
});

test('allies are never enemies', () => {
  const state = multiBattle(4, { teams: [0, 1, 0, 1] });
  assert.deepEqual(getEnemySides(state, 's1').sort(), ['s2', 's4']);
  assert.deepEqual(getEnemySides(state, 's2').sort(), ['s1', 's3']);
});

test('every side in reach strikes back at an attacker, whoever it attacked', () => {
  const state = openField(multiBattle(3, { gridSize: 6 }), 's1');
  const centre = { q: 0, r: 0 };
  const [east, west] = [getNeighbors(centre)[0], getNeighbors(centre)[3]];
  const attacker = makeUnit('s1', centre, { attackPower: 4, lifespan: 30, maxLifespan: 30 });
  const target = makeUnit('s2', east, { attackPower: 1 });
  const bystander = makeUnit('s3', west, { attackPower: 6 });
  place(state, attacker, target, bystander);
  const moved = executeMoves(state);
  assert.equal(moved.currentPhase, 'combat');
  const attacked = moved.combats.find(combat => !combat.intercept)!.defenders[0].owner;
  const intercept = moved.combats.find(combat => combat.intercept);
  assert.ok(intercept, 'the side not attacked strikes back too');
  assert.equal(intercept!.attackers[0].owner, attacked === 's2' ? 's3' : 's2');
  const after = resolveAllCombats(moved);
  assert.ok(health(after, attacker) < 30);
});

test("an ally's troops don't strike back for the side attacked... but do fight the attacker's enemies", () => {
  const state = openField(multiBattle(4, { teams: [0, 1, 0, 1], gridSize: 6 }), 's1');
  const centre = { q: 0, r: 0 };
  const [east, west] = [getNeighbors(centre)[0], getNeighbors(centre)[3]];
  const attacker = makeUnit('s1', centre);
  const target = makeUnit('s2', east);
  const friend = makeUnit('s3', west);
  place(state, attacker, target, friend);
  const moved = executeMoves(state);
  assert.ok(moved.combats.every(combat => combat.attackers.every(unit => unit.owner !== 's3')), 'an ally never attacks its own side');
});

test('a side whose castle falls is out, and the battle goes on until one team is left', () => {
  let state = openField(multiBattle(3, { gridSize: 6 }), 's1');
  const castle = findBaseHex(state, 's2')!;
  state.players.s2.baseHealth = 1;
  castle.baseHealth = 1;
  const besieger = makeUnit('s1', getNeighbors(castle.coordinates).find(c => state.hexGrid.some(hex => hex.coordinates.q === c.q && hex.coordinates.r === c.r && !hex.isBase))!);
  place(state, besieger);
  state = playTurn(state);
  assert.equal(state.players.s2.eliminated, true);
  assert.notEqual(state.currentPhase, 'gameOver');
  assert.deepEqual(getLivingSides(state), ['s1', 's3']);
  assert.equal(state.activePlayer, 's3', 'the knocked-out side loses its turn');

  state = resign(state, 's3');
  assert.equal(state.currentPhase, 'gameOver');
  assert.equal(state.winner, 's1');
  assert.deepEqual(getStandings(state).map(standing => standing.sides), [['s1'], ['s3'], ['s2']]);
});

const playOut = (state: GameState, maxSteps = 2000): GameState => {
  for (let step = 0; step < maxSteps && state.currentPhase !== 'gameOver'; step++) {
    if (state.currentPhase === 'planning') state = executeMoves(planAITurn(state));
    else if (state.currentPhase === 'combat') state = resolveAllCombats(state);
    else if (state.currentPhase === 'execution') state = executeMoves(state);
  }
  return state;
};

test('the AI plays out a free-for-all, a team battle and a battle in the fog', () => {
  for (const [label, battle] of [
    ['4-side free-for-all', multiBattle(4, { seed: 3 })],
    ['2 v 2', multiBattle(4, { teams: [0, 1, 0, 1], seed: 5 })],
    ['3 sides in the fog', multiBattle(3, { seed: 9, fog: true })]
  ] as const) {
    const done = playOut(battle);
    assert.equal(done.currentPhase, 'gameOver', `${label} ends`);
    assert.ok(done.winner && done.sides!.includes(done.winner), `${label} has a winner`);
    const recruited = done.sides!.reduce((sum, side) => sum + (done.battleStats?.[side]?.recruited ?? 0), 0);
    assert.ok(recruited > 0, `${label}: the sides recruit troops`);
  }
});
