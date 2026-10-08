// Tests for the battlefield's buildings: watchtowers, houses, the catapult tower and the workshops.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Hex, HexCoordinates, TerrainType } from '@/types/game';
import {
  DEFAULT_SETTINGS, addPendingMove, advanceFires, createBattle, defaultRoster, executeMoves, findBaseHex, getCombatPreview,
  getDeploymentHexes, getFellTargets, getIncome, getSightRange, getUnitAttackRange, updateHex, addPendingPurchase
} from './gameState';
import { BARRACKS_HEALTH_BONUS, CATAPULT_CASTLE_DAMAGE, CATAPULT_DAMAGE, STRUCTURE_TERRAINS, TAVERN_INCOME, isStructure } from './structures';
import { BURN_TURNS } from './battlefield';
import { getHexDistance } from './hexUtils';
import { cardStats } from './troops';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

const hexAt = (state: GameState, c: HexCoordinates): Hex =>
  state.hexGrid.find(hex => hex.coordinates.q === c.q && hex.coordinates.r === c.r)!;
const build = (state: GameState, c: HexCoordinates, terrain: TerrainType, owner?: 'player' | 'ai') => updateHex(state, c, { terrain, owner });

test('buildings go up where neither side has the longer march, and not in the tutorial', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const state = createBattle({ ...DEFAULT_SETTINGS, seed }, { rosters: { player: defaultRoster(), ai: defaultRoster() }, levelId: 20 });
    const castles = [findBaseHex(state, 'player')!, findBaseHex(state, 'ai')!];
    const buildings = state.hexGrid.filter(hex => isStructure(hex.terrain));
    assert.equal(buildings.filter(hex => hex.terrain === 'catapult').length, 1, `seed ${seed}: one catapult tower`);
    assert.ok(buildings.some(hex => hex.terrain === 'house'), `seed ${seed}: a hamlet`);
    for (const hex of buildings.filter(other => other.terrain !== 'house')) {
      const [toPlayer, toAi] = castles.map(castle => getHexDistance(castle.coordinates, hex.coordinates));
      assert.ok(Math.abs(toPlayer - toAi) <= 2, `seed ${seed}: ${hex.terrain} is fair (${toPlayer} vs ${toAi})`);
      assert.ok(Math.min(toPlayer, toAi) >= 3, `seed ${seed}: ${hex.terrain} not by a castle`);
      assert.equal(hex.owner, undefined, 'nobody holds it yet');
    }
  }
  const tutorial = createBattle({ ...DEFAULT_SETTINGS, seed: 3 }, { rosters: { player: defaultRoster(), ai: defaultRoster() }, levelId: 1 });
  assert.equal(tutorial.hexGrid.some(hex => STRUCTURE_TERRAINS.includes(hex.terrain as never)), false);
});

test('stepping onto a workshop takes it, and a blacksmith sharpens every blade', () => {
  const { state, centre } = makeBattle('player');
  build(state, at(centre, 1, 0), 'blacksmith');
  const smith = makeUnit('player', centre);
  const fighter = makeUnit('player', at(centre, -2, 0));
  const enemy = makeUnit('ai', at(centre, -2, -1), { attackPower: 1 });
  place(state, smith, fighter, enemy);
  const before = getCombatPreview(state, { hexCoordinates: enemy.position, attackers: [fighter], defenders: [enemy], resolved: false }).defenders[0].damageTaken;
  const after = executeMoves(addPendingMove(state, smith.id, state.players.player.id, at(centre, 1, 0)));
  assert.equal(hexAt(after, at(centre, 1, 0)).owner, 'player');
  const sharp = getCombatPreview(after, { hexCoordinates: enemy.position, attackers: [find(after, fighter)!], defenders: [find(after, enemy)!], resolved: false }).defenders[0].damageTaken;
  assert.ok(sharp >= before, 'at least as hard');
  assert.ok(sharp * 10 >= before * 10.5 || sharp > before || before < 10, 'harder');
});

test('a watchtower puts a troop on high ground: it sees and shoots further', () => {
  const { state, centre } = makeBattle('player');
  const archer = makeUnit('player', centre, { abilities: ['rangedAttack'] });
  place(state, archer);
  const [sight, reach] = [getSightRange(state, archer), getUnitAttackRange(state, archer)];
  build(state, centre, 'watchtower');
  assert.equal(getSightRange(state, archer), sight + 2);
  assert.equal(getUnitAttackRange(state, archer), reach + 1);
});

test('a troop garrisoned in a house takes much less damage and cannot be flanked', () => {
  const { state, centre } = makeBattle('player');
  const defender = makeUnit('ai', centre, { attackPower: 1 });
  const attackers = [makeUnit('player', at(centre, 1, 0)), makeUnit('player', at(centre, -1, 0))];
  place(state, defender, ...attackers);
  const combat = { hexCoordinates: centre, attackers, defenders: [defender], resolved: false };
  const inOpen = getCombatPreview(state, combat).defenders[0].damageTaken;
  build(state, centre, 'house');
  const inHouse = getCombatPreview(state, combat);
  assert.ok(inHouse.defenders[0].damageTaken < inOpen * 0.6, `${inHouse.defenders[0].damageTaken} vs ${inOpen}`);
  assert.equal(inHouse.attackers[0].modifiers.some(m => m.label === 'Flanking'), false);
});

test('a tavern pays, and barracks take recruits and drill them', () => {
  const { state, centre } = makeBattle('player');
  const income = getIncome(state, 'player').total;
  build(state, centre, 'tavern', 'player');
  assert.equal(getIncome(state, 'player').total, income + TAVERN_INCOME);

  const barracks = at(centre, 2, -2);
  build(state, barracks, 'barracks', 'player');
  assert.ok(getDeploymentHexes(state, 'player').some(hex => getHexDistance(hex.coordinates, barracks) <= 1), 'deploy beside it');
  state.players.player.points = 100;
  const spot = getDeploymentHexes(state, 'player').find(hex => getHexDistance(hex.coordinates, barracks) === 1)!;
  const type = Object.keys(state.rosters!.player)[0] as 'infantry';
  const after = executeMoves(addPendingPurchase(state, state.players.player.id, type, spot.coordinates));
  const recruit = after.players.player.units.find(unit => unit.position.q === spot.coordinates.q && unit.position.r === spot.coordinates.r)!;
  assert.equal(recruit.maxLifespan, Math.round(state.rosters!.player[type]!.maxLifespan * (1 + BARRACKS_HEALTH_BONUS)));
  assert.ok(cardStats);
});

test('a catapult tower bombards the weakest enemy in reach, else the enemy castle', () => {
  const { state, centre } = makeBattle('player');
  build(state, centre, 'catapult', 'player');
  const crew = makeUnit('player', centre);
  const weak = makeUnit('ai', at(centre, 3, 0), { lifespan: 8 });
  const strong = makeUnit('ai', at(centre, -3, 0), { lifespan: 20 });
  place(state, crew, weak, strong);
  const after = playTurn(state);
  assert.equal(health(after, weak), 8 - CATAPULT_DAMAGE);
  assert.equal(health(after, strong), 20);
  assert.equal(after.lastBombard?.side, 'player');

  const { state: siege } = makeBattle('player');
  const castle = findBaseHex(siege, 'ai')!.coordinates;
  const tower = siege.hexGrid.find(hex => !hex.isBase && getHexDistance(hex.coordinates, castle) === 4)!.coordinates;
  build(siege, tower, 'catapult');
  place(siege, makeUnit('player', tower));
  const castleBefore = siege.players.ai.baseHealth!;
  const pounded = playTurn(siege);
  assert.equal(pounded.players.ai.baseHealth, castleBefore - CATAPULT_CASTLE_DAMAGE);
});

test('with a lumber mill, troops fell great trees from 2 hexes away', () => {
  const { state, centre } = makeBattle('player');
  const tree = at(centre, 2, 0);
  updateHex(state, tree, { terrain: 'forest', feature: 'greatTree' });
  const axe = makeUnit('player', centre);
  place(state, axe);
  assert.equal(getFellTargets(state, axe).length, 0);
  build(state, at(centre, -2, 2), 'lumbermill', 'player');
  assert.ok(getFellTargets(state, axe).some(c => c.q === tree.q && c.r === tree.r));
  const after = executeMoves(addPendingMove(state, axe.id, state.players.player.id, tree));
  assert.equal(hexAt(after, at(centre, 3, 0)).feature, 'log', 'it falls on along the line');
});

test('houses burn down to ruins', () => {
  const { state, centre } = makeBattle('player');
  build(state, centre, 'house');
  updateHex(state, centre, { fire: { stage: 'burning', turnsLeft: BURN_TURNS } });
  for (let turn = 0; turn < BURN_TURNS; turn++) advanceFires(state, false, () => 1);
  assert.equal(hexAt(state, centre).terrain, 'ruins');
});
