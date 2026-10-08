// Tests for signature abilities, tactic cards and choosing the castle's site. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, TacticCard } from '@/types/game';
import {
  DEFAULT_SETTINGS, addPendingMove, canStrike, chooseCastle, createBattle, drawTactic, executeMoves, findBaseHex,
  getCombatPreview, getHeightOfHex, getValidMoveTargets
} from './gameState';
import { getTacticTargets, playTactic } from './battleTactics';
import { getHexDistance } from './hexUtils';
import { MAX_SIGNATURE_RANK, signatureRank, strafeDamage } from './signatures';
import { TACTIC_HAND_LIMIT, isTacticDrawRound, mendHeal, rallyBonus, volleyDamage } from './tactics';
import { at, find, health, makeBattle, makeUnit, place, playTurn } from './testUtils';

// Damage the first defender would take if the attackers struck it now
const damageTo = (state: GameState, attackers: ReturnType<typeof makeUnit>[], defender: ReturnType<typeof makeUnit>) =>
  getCombatPreview(state, { hexCoordinates: defender.position, attackers, defenders: [defender], resolved: false }).defenders[0].damageTaken;

test('signatures wake at level 2 and gain a rank every two levels', () => {
  assert.equal(signatureRank(1), 0);
  assert.equal(signatureRank(2), 1);
  assert.equal(signatureRank(3), 1);
  assert.equal(signatureRank(10), 5);
  assert.equal(signatureRank(15), MAX_SIGNATURE_RANK);
});

test('Swordsmen hit harder with friends beside them', () => {
  const { state, centre } = makeBattle();
  const sword = makeUnit('ai', centre, { type: 'infantry', level: 10 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, sword, enemy);
  const alone = damageTo(state, [sword], enemy);
  place(state, makeUnit('ai', at(centre, -1, 0)), makeUnit('ai', at(centre, 0, -1)));
  assert.ok(damageTo(state, [sword], enemy) > alone);
});

test('a level 1 card has no signature yet', () => {
  const { state, centre } = makeBattle();
  const sword = makeUnit('ai', centre, { type: 'infantry', level: 1 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, sword, enemy);
  const alone = damageTo(state, [sword], enemy);
  place(state, makeUnit('ai', at(centre, -1, 0)), makeUnit('ai', at(centre, 0, -1)));
  assert.equal(damageTo(state, [sword], enemy), alone);
});

test('Archers aim better when they stand still', () => {
  const { state, centre } = makeBattle();
  const archer = makeUnit('ai', centre, { type: 'artillery', level: 10, abilities: ['rangedAttack'] });
  const enemy = makeUnit('player', at(centre, 2, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, archer, enemy);
  const still = damageTo(state, [archer], enemy);
  archer.movedHexes = 1;
  assert.ok(damageTo(state, [archer], enemy) < still);
});

test('Pikemen brace on the enemy turn', () => {
  const { state, centre } = makeBattle('player');
  const pike = makeUnit('ai', centre, { type: 'tank', level: 10 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, pike, enemy);
  const braced = damageTo(state, [pike], enemy);
  state.activePlayer = 'ai';
  assert.ok(damageTo(state, [pike], enemy) < braced);
});

test('Rogues fight best alone', () => {
  const { state, centre } = makeBattle();
  const rogue = makeUnit('ai', centre, { type: 'rogue', level: 10 });
  const enemy = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, rogue, enemy);
  const alone = damageTo(state, [rogue], enemy);
  place(state, makeUnit('ai', at(centre, -2, 0)));
  assert.ok(damageTo(state, [rogue], enemy) < alone);
});

test('Mages ward the troops beside them', () => {
  const { state, centre } = makeBattle();
  const attacker = makeUnit('ai', centre, { attackPower: 10 });
  const target = makeUnit('player', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, attacker, target);
  const unwarded = damageTo(state, [attacker], target);
  place(state, makeUnit('player', at(centre, 2, 0), { type: 'medic', level: 10 }));
  assert.ok(damageTo(state, [attacker], target) < unwarded);
});

test('Shieldbearers pull the nearest enemy one hex closer at the end of their turn', () => {
  const { state, centre } = makeBattle('player');
  const bearer = makeUnit('player', centre, { type: 'shieldbearer', level: 2 });
  const enemy = makeUnit('ai', at(centre, 2, 0));
  place(state, bearer, enemy);
  const after = playTurn(state);
  assert.equal(getHexDistance(find(after, enemy)!.position, centre), 1);
});

test('Siege Sappers that stand still dig out the ground around them', () => {
  const { state, centre } = makeBattle('player');
  place(state, makeUnit('player', centre, { type: 'sapper', level: 10 }));
  const before = getHeightOfHex(state, at(centre, 1, 0));
  const after = playTurn(state);
  assert.ok(getHeightOfHex(after, at(centre, 1, 0)) < before);
  assert.equal(getHeightOfHex(after, centre), getHeightOfHex(state, centre), 'its own hex stays put');
});

test('Pegasus Knights strafe the enemies they fly past', () => {
  const { state, centre } = makeBattle('player');
  const pegasus = makeUnit('player', centre, { type: 'pegasus', level: 4, abilities: ['flying'], movementRange: 5 });
  const passed = makeUnit('ai', at(centre, 2, -1));
  place(state, pegasus, passed);
  const moved = addPendingMove(state, pegasus.id, state.players.player.id, at(centre, 4, 0));
  assert.notEqual(moved, state, 'the move is allowed');
  const after = executeMoves(moved);
  assert.equal(health(after, passed), 20 - strafeDamage(signatureRank(4)));
});

test('Berserkers heal when they destroy an enemy', () => {
  const { state, centre } = makeBattle();
  const berserker = makeUnit('ai', centre, { type: 'berserker', level: 10, attackPower: 20, lifespan: 5 });
  const victim = makeUnit('player', at(centre, 1, 0), { lifespan: 3, maxLifespan: 3, attackPower: 1 });
  place(state, berserker, victim);
  const after = playTurn(state);
  assert.equal(find(after, victim), undefined);
  assert.ok(health(after, berserker) > 5);
});

// --- Tactic cards ---------------------------------------------------------------------------

const LOADOUT: TacticCard[] = [{ id: 'mend', level: 1 }, { id: 'volley', level: 1 }, { id: 'rally', level: 1 }];

const withHand = (state: GameState, ...cards: TacticCard[]): GameState => ({
  ...state,
  tactics: {
    player: { loadout: LOADOUT, hand: cards.map((card, i) => ({ ...card, uid: `p${i}` })), drawn: cards.length },
    ai: { loadout: LOADOUT, hand: [], drawn: 0 }
  }
});

test('tactic cards are drawn from round 2, every second round', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(isTacticDrawRound), [false, true, false, true, false, true]);
});

test('a side draws one of its own cards, and holds no more than three', () => {
  let { state } = makeBattle('player');
  state = withHand(state);
  for (let i = 0; i < 5; i++) state = drawTactic(state, 'player');
  assert.equal(state.tactics!.player.hand.length, TACTIC_HAND_LIMIT);
  assert.ok(state.tactics!.player.hand.every(card => LOADOUT.some(owned => owned.id === card.id)));
});

test('the turn after round 1 ends, each side draws a tactic card', () => {
  let { state } = makeBattle('player');
  state = withHand(state);
  state.turnNumber = 1;
  const afterPlayer = playTurn(state);
  assert.equal(afterPlayer.tactics!.ai.hand.length, 0, 'no draw in round 1');
  const afterAi = playTurn(afterPlayer);
  assert.equal(afterAi.turnNumber, 2);
  assert.equal(afterAi.tactics!.player.hand.length, 1);
});

test('Mend heals, Volley hurts', () => {
  const { state: base, centre } = makeBattle('player');
  const state = withHand(base, { id: 'mend', level: 3 }, { id: 'volley', level: 3 });
  const wounded = makeUnit('player', centre, { lifespan: 5 });
  const enemy = makeUnit('ai', at(centre, 2, 0));
  place(state, wounded, enemy);
  const mended = playTactic(state, 'player', 'p0', centre);
  assert.equal(health(mended, wounded), 5 + mendHeal(3));
  const volleyed = playTactic(mended, 'player', 'p1', enemy.position);
  assert.equal(health(volleyed, enemy), 20 - volleyDamage(3));
  assert.equal(volleyed.tactics!.player.hand.length, 0);
});

test('a tactic card needs a valid target and the right turn', () => {
  const { state: base, centre } = makeBattle('player');
  const state = withHand(base, { id: 'mend', level: 1 });
  place(state, makeUnit('player', centre));
  assert.equal(getTacticTargets(state, 'player', 'mend').length, 0, 'nobody is wounded');
  assert.equal(playTactic(state, 'player', 'p0', centre), state);
  const wounded = { ...state, players: { ...state.players, player: { ...state.players.player, units: [{ ...state.players.player.units[0], lifespan: 5 }] } } };
  assert.notEqual(playTactic(wounded, 'player', 'p0', centre), wounded, 'playable on its own turn');
  const enemyTurn = { ...wounded, activePlayer: 'ai' as const };
  assert.equal(playTactic(enemyTurn, 'player', 'p0', centre), enemyTurn, 'not on the enemy turn');
});

test('Rally makes this turn\'s attacks hit harder, then wears off', () => {
  const { state: base, centre } = makeBattle('player');
  const state = withHand(base, { id: 'rally', level: 1 });
  const attacker = makeUnit('player', centre, { attackPower: 10 });
  const target = makeUnit('ai', at(centre, 1, 0), { lifespan: 99, maxLifespan: 99 });
  place(state, attacker, target);
  const plain = damageTo(state, [attacker], target);
  const rallied = playTactic(state, 'player', 'p0');
  assert.equal(damageTo(rallied, [attacker], target), Math.round(plain * (1 + rallyBonus(1))));
  assert.equal(playTurn(rallied).effects?.length ?? 0, 0);
});

test('Forced March adds movement for one turn only', () => {
  const { state: base, centre } = makeBattle('player');
  const state = withHand(base, { id: 'forcedMarch', level: 1 });
  const unit = makeUnit('player', centre, { movementRange: 2 });
  place(state, unit);
  const before = getValidMoveTargets(state, unit).length;
  const marched = playTactic(state, 'player', 'p0', centre);
  assert.ok(getValidMoveTargets(marched, find(marched, unit)!).length > before);
  assert.equal(find(playTurn(marched), unit)!.movementRange, 2);
});

test('Smoke stops shots from afar but not blows from the next hex', () => {
  const { state: base, centre } = makeBattle('player');
  const state = withHand(base, { id: 'smoke', level: 1 });
  const target = makeUnit('ai', centre);
  const archer = makeUnit('player', at(centre, 2, 0), { abilities: ['rangedAttack'] });
  const sword = makeUnit('player', at(centre, -1, 0));
  place(state, target, archer, sword);
  assert.ok(canStrike(state, archer, target));
  const smoked = playTactic(state, 'player', 'p0', centre);
  assert.ok(!canStrike(smoked, archer, target));
  assert.ok(canStrike(smoked, sword, target));
});

test('Earthworks raise the ground and Sinkhole lowers it', () => {
  const { state: base, centre } = makeBattle('player');
  const state = withHand(base, { id: 'earthworks', level: 1 }, { id: 'sinkhole', level: 1 });
  place(state, makeUnit('player', centre));
  const target = at(centre, 1, 0);
  const raised = playTactic(state, 'player', 'p0', target);
  assert.ok(getHeightOfHex(raised, target) > getHeightOfHex(state, target));
  const sunk = playTactic(raised, 'player', 'p1', at(centre, 0, 1));
  assert.ok(getHeightOfHex(sunk, at(centre, 0, 1)) < getHeightOfHex(raised, at(centre, 0, 1)));
});

test('Sabotage burns enemy gold, and Call to Arms brings a free troop to the castle', () => {
  const { state: base } = makeBattle('player');
  const state = withHand(base, { id: 'sabotage', level: 1 }, { id: 'callToArms', level: 1 });
  state.players.ai.points = 20;
  const sabotaged = playTactic(state, 'player', 'p0');
  assert.ok(sabotaged.players.ai.points < 20);
  const called = playTactic(sabotaged, 'player', 'p1');
  assert.equal(called.players.player.units.length, 1);
  const castle = findBaseHex(called, 'player')!;
  assert.equal(getHexDistance(called.players.player.units[0].position, castle.coordinates), 1);
});

// --- Choosing the castle --------------------------------------------------------------------

test('the player can choose between castle sites before the first turn', () => {
  const state = createBattle({ ...DEFAULT_SETTINGS, seed: 11 }, {
    rosters: { player: {}, ai: {} },
    chooseCastle: true
  });
  assert.equal(state.currentPhase, 'setup');
  const choices = state.castleChoices!;
  assert.ok(choices.length >= 2);
  const picked = chooseCastle(state, choices[choices.length - 1]);
  assert.equal(picked.currentPhase, 'planning');
  assert.deepEqual(findBaseHex(picked, 'player')!.coordinates, choices[choices.length - 1]);
  assert.ok(findBaseHex(picked, 'ai'));
  assert.equal(chooseCastle(state, { q: 99, r: 99 }), state, 'only an offered site');
});
