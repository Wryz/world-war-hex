// Tests for the battle rules: who fights whom, strike-backs, sneak attacks, castle attacks, the
// time-up points and stars. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ability, GameState, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import {
  DEFAULT_SETTINGS, createBattle, executeMoves, findBaseHex, getCombatPreview, getStarScore, getTimeScore, resolveAllCombats
} from './gameState';
import { getHexDistance } from './hexUtils';
import { getLevel, starThresholds, starsForWin } from '../campaign/levels';

let nextId = 0;

// A unit with simple, round stats unless told otherwise
const makeUnit = (owner: PlayerType, position: HexCoordinates, overrides: Partial<Unit> & { abilities?: Ability[] } = {}): Unit => ({
  id: `test-${owner}-${nextId++}`,
  type: (overrides.type ?? 'infantry') as UnitType,
  owner,
  position,
  movementRange: 2,
  attackPower: 5,
  lifespan: 20,
  maxLifespan: 20,
  cost: 10,
  abilities: [],
  hasMoved: false,
  isEngagedInCombat: false,
  ...overrides
});

// A battle on open ground with no troops, on the given side's turn. `centre` is a hex at least 4
// away from both castles, so troops placed around it fight each other rather than a castle.
const makeBattle = (activePlayer: PlayerType = 'ai') => {
  const state = createBattle({ ...DEFAULT_SETTINGS, gridSize: 5, fogOfWar: false, seed: 7 });
  for (const hex of state.hexGrid) {
    if (!hex.isBase) hex.terrain = 'plain';
    hex.isResourceHex = false;
    hex.isCamp = false;
    hex.unit = undefined;
  }
  state.players.player.units = [];
  state.players.ai.units = [];
  state.currentPhase = 'planning';
  state.activePlayer = activePlayer;
  const castles = [findBaseHex(state, 'player')!, findBaseHex(state, 'ai')!];
  const centre = state.hexGrid
    .map(hex => hex.coordinates)
    .filter(c => getHexDistance(c, { q: 0, r: 0 }) <= 2)
    .find(c => castles.every(castle => getHexDistance(c, castle.coordinates) >= 5))!;
  assert.ok(centre, 'a hex far from both castles');
  return { state, centre };
};

const at = (centre: HexCoordinates, dq: number, dr: number): HexCoordinates => ({ q: centre.q + dq, r: centre.r + dr });

const place = (state: GameState, ...units: Unit[]) => {
  for (const unit of units) state.players[unit.owner].units.push(unit);
  for (const hex of state.hexGrid) {
    hex.unit = units.find(unit => unit.position.q === hex.coordinates.q && unit.position.r === hex.coordinates.r) ?? hex.unit;
  }
};

const health = (state: GameState, unit: Unit) =>
  state.players[unit.owner].units.find(candidate => candidate.id === unit.id)?.lifespan ?? 0;

test('troops out of reach of each other do not fight', () => {
  const { state, centre } = makeBattle();
  place(state, makeUnit('ai', centre), makeUnit('player', at(centre, 3, 0)));
  const after = executeMoves(state);
  assert.equal(after.combats.length, 0);
});

test('an attacked troop strikes back at an attacker in its reach', () => {
  const { state, centre } = makeBattle();
  const attacker = makeUnit('ai', centre);
  const defender = makeUnit('player', at(centre, 1, 0));
  place(state, attacker, defender);
  const fought = executeMoves(state);
  assert.equal(fought.combats.length, 1);
  const preview = getCombatPreview(fought, fought.combats[0]);
  assert.equal(preview.attackers[0].canBeHitBack, true);
  const after = resolveAllCombats(fought);
  assert.ok(health(after, attacker) < 20, 'attacker took strike-back damage');
  assert.ok(health(after, defender) < 20, 'defender took the attack');
});

test('a sneak attack gets no strike-back, except from another sneak attacker', () => {
  const sneaky = (state: ReturnType<typeof makeBattle>, defenderAbilities: Ability[]) => {
    const rogue = makeUnit('ai', state.centre, { type: 'rogue' as UnitType, abilities: ['stealth'] });
    const target = makeUnit('player', at(state.centre, 1, 0), { abilities: defenderAbilities });
    place(state.state, rogue, target);
    const fought = executeMoves(state.state);
    return getCombatPreview(fought, fought.combats[0]).attackers[0].canBeHitBack;
  };
  assert.equal(sneaky(makeBattle(), []), false);
  assert.equal(sneaky(makeBattle(), ['stealth']), true);
});

test('troops in reach of an attacker strike it, and it cannot hit them back', () => {
  const { state, centre } = makeBattle();
  // An enemy archer shoots a wounded rogue it can finish off; two of your archers can reach the
  // enemy archer too
  const enemyArcher = makeUnit('ai', centre, { type: 'archer' as UnitType, abilities: ['rangedAttack'], lifespan: 30, maxLifespan: 30 });
  const rogue = makeUnit('player', at(centre, -2, 0), { lifespan: 3 });
  const guardA = makeUnit('player', at(centre, 2, 0), { type: 'archer' as UnitType, abilities: ['rangedAttack'] });
  const guardB = makeUnit('player', at(centre, 0, 2), { type: 'archer' as UnitType, abilities: ['rangedAttack'] });
  place(state, enemyArcher, rogue, guardA, guardB);
  const fought = executeMoves(state);
  const intercept = fought.combats.find(combat => combat.intercept);
  assert.ok(intercept, 'a strike-back battle forms');
  assert.deepEqual(intercept.attackers.map(unit => unit.id).sort(), [guardA.id, guardB.id].sort());
  const after = resolveAllCombats(fought);
  assert.ok(health(after, enemyArcher) < 30, 'the enemy archer is struck');
  assert.equal(health(after, guardA), 20);
  assert.equal(health(after, guardB), 20);
  assert.equal(health(after, rogue), 0, 'the enemy archer still lands its own shot');
});

test('only troops actually attacking a castle damage it', () => {
  const { state } = makeBattle();
  const castle = findBaseHex(state, 'player')!;
  const neighbour = state.hexGrid.find(hex => !hex.isBase && getHexDistance(hex.coordinates, castle.coordinates) === 1)!;
  const nearby = state.hexGrid.find(hex => !hex.isBase && getHexDistance(hex.coordinates, castle.coordinates) === 3)!;
  place(state, makeUnit('ai', neighbour.coordinates, { attackPower: 6 }), makeUnit('ai', nearby.coordinates, { attackPower: 6 }));
  const before = state.players.player.baseHealth!;
  const fought = executeMoves(state);
  assert.equal(fought.siege?.attackerIds.length, 1);
  const after = resolveAllCombats(fought);
  assert.equal(after.players.player.baseHealth, before - 6);
});

test('a castle attacker struck down by the guards does no damage', () => {
  const { state } = makeBattle();
  const castle = findBaseHex(state, 'player')!;
  const neighbours = state.hexGrid.filter(hex => !hex.isBase && getHexDistance(hex.coordinates, castle.coordinates) === 1);
  const raider = makeUnit('ai', neighbours[0].coordinates, { attackPower: 6, lifespan: 3, maxLifespan: 20 });
  // A guard right beside the raider, but not beside the castle's other side
  const guardHex = state.hexGrid.find(hex => !hex.isBase && getHexDistance(hex.coordinates, raider.position) === 1 &&
    getHexDistance(hex.coordinates, castle.coordinates) === 2)!;
  place(state, raider, makeUnit('player', guardHex.coordinates, { attackPower: 10 }));
  const before = state.players.player.baseHealth!;
  // The raider can finish nothing off, so it goes for the walls; the guard strikes it down
  const after = resolveAllCombats(executeMoves(state));
  assert.equal(health(after, raider), 0);
  assert.equal(after.players.player.baseHealth, before);
});

test('time-up points add kills, half the gold earned and 15 per camp', () => {
  const { state } = makeBattle('player');
  state.battleStats!.player.slainValue = 40;
  state.battleStats!.player.goldEarned = 30;
  state.hexGrid[0].isCamp = true;
  state.hexGrid[0].owner = 'player';
  const score = getTimeScore(state, 'player');
  assert.deepEqual(score, { kills: 40, gold: 15, camps: 15, total: 70 });
  state.turnNumber = state.settings!.maxRounds! - 3;
  assert.equal(getStarScore(state, 'player').speed, 30);
  assert.equal(getStarScore(state, 'player').total, 100);
});

test('stars: one for a win, two and three for enough points', () => {
  const level = getLevel(10);
  const [two, three] = starThresholds(level);
  assert.ok(two < three);
  assert.equal(starsForWin(level, 0), 1);
  assert.equal(starsForWin(level, two), 2);
  assert.equal(starsForWin(level, three), 3);
});
