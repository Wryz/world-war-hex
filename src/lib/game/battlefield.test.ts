// Tests for the battlefield's objects: great trees to fell and fires around lava. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Hex, HexCoordinates } from '@/types/game';
import {
  addPendingMove, advanceFires, endTurn, executeMoves, findBaseHex, getFellTargets, getValidMoveTargets, isImpassable, updateHex
} from './gameState';
import { BURN_TURNS, FELL_DAMAGE, FIRE_DAMAGE, pickGreatTrees } from './battlefield';
import { getHexDistance, getNeighbors } from './hexUtils';
import { planAITurn } from '../ai/aiPlayer';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

const hexAt = (state: GameState, c: HexCoordinates): Hex =>
  state.hexGrid.find(hex => hex.coordinates.q === c.q && hex.coordinates.r === c.r)!;
const has = (list: HexCoordinates[], c: HexCoordinates) => list.some(other => other.q === c.q && other.r === c.r);

// A great tree east of the centre, a troop of ours west of it and an enemy on the far side
const treeScene = () => {
  const { state, centre } = makeBattle('player');
  const tree = at(centre, 1, 0);
  updateHex(state, tree, { terrain: 'forest', feature: 'greatTree' });
  const axe = makeUnit('player', centre);
  const enemy = makeUnit('ai', at(centre, 2, 0));
  place(state, axe, enemy);
  return { state, centre, tree, axe, enemy, landing: at(centre, 2, 0) };
};

test('a great tree blocks the way until it is felled', () => {
  const { state, tree, axe } = treeScene();
  assert.ok(isImpassable(hexAt(state, tree)));
  assert.equal(has(getValidMoveTargets(state, axe), tree), false, 'nobody walks onto it');
  assert.ok(has(getFellTargets(state, axe), tree), 'a troop next to it can chop it down');
});

test('a felled tree falls away from the troop, crushing the enemy on the far hex', () => {
  const { state, centre, tree, axe, enemy, landing } = treeScene();
  const ordered = addPendingMove(state, axe.id, state.players.player.id, tree);
  assert.notEqual(ordered, state, 'the order is accepted');
  const after = executeMoves(ordered);
  assert.equal(health(after, enemy), 20 - FELL_DAMAGE);
  assert.deepEqual(find(after, axe)!.position, centre, 'the troop stays where it is');
  assert.equal(hexAt(after, tree).feature, undefined, 'the tree is gone');
  assert.equal(hexAt(after, landing).feature, 'log', 'its trunk lies on the far hex');
  assert.ok(isImpassable(hexAt(after, landing)), 'and blocks it');
  assert.equal(after.lastFell?.side, 'player');
});

test('felled across water a tree makes a bridge', () => {
  const { state, centre, tree, axe, enemy, landing } = treeScene();
  state.players.ai.units = state.players.ai.units.filter(unit => unit.id !== enemy.id);
  hexAt(state, landing).unit = undefined;
  updateHex(state, landing, { terrain: 'water' });
  assert.ok(isImpassable(hexAt(state, landing)));
  const after = executeMoves(addPendingMove(state, axe.id, state.players.player.id, tree));
  assert.equal(hexAt(after, landing).feature, 'logBridge');
  assert.equal(isImpassable(hexAt(after, landing)), false, 'troops can walk over it');
  assert.ok(getHexDistance(centre, landing) === 2);
});

test('flyers cannot fell trees, and no tree falls onto a castle', () => {
  const { state, tree, axe } = treeScene();
  const flyer = { ...axe, id: 'flyer', abilities: ['flying' as const] };
  assert.equal(getFellTargets(state, flyer).length, 0);

  const castle = findBaseHex(state, 'player')!.coordinates;
  const beside = getNeighbors(castle).find(c => {
    const from = { q: 2 * c.q - castle.q, r: 2 * c.r - castle.r };
    return state.hexGrid.some(hex => hex.coordinates.q === from.q && hex.coordinates.r === from.r && !hex.isBase);
  })!;
  updateHex(state, beside, { terrain: 'forest', feature: 'greatTree' });
  const opposite = makeUnit('player', { q: 2 * beside.q - castle.q, r: 2 * beside.r - castle.r });
  place(state, opposite);
  assert.equal(has(getFellTargets(state, opposite), beside), false);
  assert.ok(has(getFellTargets(state, axe), tree));
});

test('the AI fells a tree onto a troop of ours when it can', () => {
  const { state, centre } = makeBattle('ai');
  const tree = at(centre, 1, 0);
  updateHex(state, tree, { terrain: 'forest', feature: 'greatTree' });
  const axe = makeUnit('ai', centre, { movementRange: 0 });
  const target = makeUnit('player', at(centre, 2, 0));
  place(state, axe, target);
  const planned = planAITurn(state);
  assert.ok(planned.pendingMoves.some(move => move.unitId === axe.id && move.to.q === tree.q && move.to.r === tree.r));
});

// --- Fire ------------------------------------------------------------------------------------

test('embers catch the next turn, and nothing can enter a burning hex', () => {
  const { state, centre } = makeBattle('player');
  updateHex(state, centre, { fire: { stage: 'smoulder', turnsLeft: 1 } });
  assert.equal(isImpassable(hexAt(state, centre)), false, 'embers can still be crossed');
  advanceFires(state, false, () => 1);
  assert.equal(hexAt(state, centre).fire?.stage, 'burning');
  assert.ok(isImpassable(hexAt(state, centre)));
});

test('a troop caught in a fire is burned at the end of its turn', () => {
  const { state, centre } = makeBattle('player');
  const caught = makeUnit('player', centre);
  const fireproof = makeUnit('player', at(centre, 0, 1), { abilities: ['fireborn'] });
  place(state, caught, fireproof);
  updateHex(state, centre, { fire: { stage: 'burning', turnsLeft: BURN_TURNS } });
  updateHex(state, at(centre, 0, 1), { fire: { stage: 'burning', turnsLeft: BURN_TURNS } });
  const after = playTurn(state);
  assert.equal(health(after, caught), 20 - FIRE_DAMAGE);
  assert.equal(health(after, fireproof), 20);
});

test('a burning forest burns out into scorched open ground', () => {
  const { state, centre } = makeBattle('player');
  updateHex(state, centre, { terrain: 'forest', fire: { stage: 'burning', turnsLeft: BURN_TURNS } });
  for (let turn = 0; turn < BURN_TURNS; turn++) advanceFires(state, false, () => 1);
  const hex = hexAt(state, centre);
  assert.equal(hex.fire, undefined);
  assert.equal(hex.terrain, 'plain');
  assert.equal(hex.scorched, true);
});

test('fire spreads to dry ground, and lava starts fires only when a round ends', () => {
  const { state, centre } = makeBattle('player');
  updateHex(state, centre, { terrain: 'forest', fire: { stage: 'burning', turnsLeft: BURN_TURNS } });
  updateHex(state, at(centre, 1, 0), { terrain: 'forest' });
  advanceFires(state, false, () => 0);
  assert.equal(hexAt(state, at(centre, 1, 0)).fire?.stage, 'smoulder', 'the flames spread');

  const { state: other, centre: middle } = makeBattle('player');
  updateHex(other, middle, { terrain: 'lava' });
  advanceFires(other, false, () => 0);
  assert.equal(other.hexGrid.some(hex => hex.fire), false, 'no flare-ups mid-round');
  advanceFires(other, true, () => 0);
  assert.equal(other.hexGrid.filter(hex => hex.fire?.stage === 'smoulder').length, 1, 'one hex next to the lava smoulders');
  assert.ok(other.hexGrid.filter(hex => hex.fire).every(hex => getHexDistance(hex.coordinates, middle) === 1));
});

test('great trees grow away from the edge, spread apart', () => {
  const { state } = makeBattle('player');
  for (const hex of state.hexGrid) if (!hex.isBase) hex.terrain = 'forest';
  let seed = 1;
  const trees = pickGreatTrees(state.hexGrid, 5, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
  assert.ok(trees.length > 0 && trees.length <= 3);
  for (const tree of trees) assert.ok(getHexDistance(tree, { q: 0, r: 0 }) < 5, 'not on the edge');
  for (const a of trees) for (const b of trees) if (a !== b) assert.ok(getHexDistance(a, b) >= 3);
});

test('a crushing tree is recorded for the board to show when it lands', () => {
  const { state, tree, axe, enemy } = treeScene();
  const after = executeMoves(addPendingMove(state, axe.id, state.players.player.id, tree));
  const event = after.healthEvents?.find(e => e.unit?.id === enemy.id);
  assert.ok(event, 'recorded');
  assert.equal(event!.cause, 'fell');
  assert.equal(event!.amount, -FELL_DAMAGE);
  assert.deepEqual(event!.from, tree);
  assert.equal(event!.unit!.lifespan, 20, 'with the troop as it was before');
});

test('a turn can stop after its moves, and end later: a spring heals then', () => {
  const { state, centre } = makeBattle('player');
  updateHex(state, at(centre, 1, 0), { terrain: 'spring' });
  const troop = makeUnit('player', centre, { lifespan: 10, maxLifespan: 20 });
  place(state, troop);
  const moved = executeMoves(addPendingMove(state, troop.id, state.players.player.id, at(centre, 1, 0)), { holdTurnEnd: true });
  assert.equal(moved.currentPhase, 'execution');
  assert.equal(health(moved, troop), 10, 'not healed while it walks there');
  const ended = endTurn(moved);
  assert.ok(health(ended, troop) > 10, 'healed when the turn ends');
  assert.equal(moved.players.player.units.find(u => u.id === troop.id)!.lifespan, 10, 'the held state is left alone');
  const heal = ended.healthEvents!.find(e => e.cause === 'spring');
  assert.ok(heal && heal.amount > 0);
});
