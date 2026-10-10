// Online rooms: the battle a room's members fight, and armies from other devices made valid
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM_SETTINGS, RoomMember, buildRoomBattle, sanitizeArmy, sideViewOf } from './room';
import { getAllUnits } from '../game/sides';
import { isUnitVisibleTo } from '../game/gameState';
import { makeUnit, place } from '../game/testUtils';
import { arenaGridSize } from './arena';

const member = (seat: number, team: number | null = null): RoomMember => ({
  room_id: 'ABC234', user_id: `user-${seat}`, name: `Player ${seat + 1}`, seat, color: seat, team,
  army: { deck: ['infantry', 'artillery', 'tank', 'rogue'], cards: { infantry: 9, artillery: 3, tank: 2, rogue: 1 } }
});

test("a room's battle seats every member, then its AI sides, on a map sized for them all", () => {
  const state = buildRoomBattle([member(0), member(1), member(2)], { ...DEFAULT_ROOM_SETTINGS, bots: 2 }, 42);
  assert.deepEqual(state.sides, ['s1', 's2', 's3', 'ai1', 'ai2']);
  assert.equal(state.settings!.gridSize, arenaGridSize(5));
  assert.ok(state.players.ai1.ai && !state.players.s1.ai);
  // (people draw their hand from their deck; the AI recruits from its roster)
  assert.equal(state.decks!.s1.length, 4);
  assert.equal(state.decks!.ai1, undefined);
});

test('in a team battle the turn passes from team to team, and AI sides make up the smaller team', () => {
  const state = buildRoomBattle([member(0, 0), member(1, 0), member(2, 1)], { ...DEFAULT_ROOM_SETTINGS, mode: 'teams', bots: 1 }, 7);
  assert.equal(state.players.ai1.team, 1);
  const teams = state.sides!.map(side => state.players[side].team);
  assert.deepEqual(teams, [0, 1, 0, 1]);
});

test('fair mode puts every card at the fair level; otherwise each side brings its own levels', () => {
  const fair = buildRoomBattle([member(0), member(1)], { ...DEFAULT_ROOM_SETTINGS, fair: true, fairLevel: 4 }, 1);
  assert.ok(Object.values(fair.rosters!.s1).every(stats => stats!.level === 4));
  const own = buildRoomBattle([member(0), member(1)], { ...DEFAULT_ROOM_SETTINGS, fair: false }, 1);
  assert.equal(own.rosters!.s1.infantry!.level, 9);
});

test('an army sent from another device is checked like an imported save', () => {
  const army = sanitizeArmy({ deck: ['dragon_boss' as never, 'infantry', 'infantry'], cards: { infantry: 999, tank: -3 } as never });
  assert.ok(army.deck.every(id => army.cards[id] !== undefined), 'only cards it owns');
  assert.ok(!army.deck.includes('dragon_boss' as never), 'no monsters');
  assert.ok(Object.values(army.cards).every(level => level! >= 1 && level! <= 15), 'real levels');
  assert.ok(sanitizeArmy(null).deck.length > 0, 'nothing sent still makes an army');
});

test("in the fog a guest is sent only what their side can see, and nobody else's hand", () => {
  const state = buildRoomBattle([member(0), member(1), member(2)], { ...DEFAULT_ROOM_SETTINGS, fog: true }, 3);
  // A troop of each side beside its own castle: far out of the others' sight
  for (const side of state.sides!) {
    const castle = state.players[side].baseLocation!;
    const free = state.hexGrid.find(hex => !hex.isBase && !hex.unit && Math.abs(hex.coordinates.q - castle.q) + Math.abs(hex.coordinates.r - castle.r) === 1);
    if (free) place(state, makeUnit(side, free.coordinates));
  }
  const hidden = getAllUnits(state).filter(unit => !isUnitVisibleTo(state, 's1', unit));
  assert.ok(hidden.length > 0, 'some troops are out of s1\'s sight');
  const view = sideViewOf(state, 's1');
  assert.ok(hidden.every(unit => !getAllUnits(view).some(other => other.id === unit.id)), 'they are left out');
  assert.ok(getAllUnits(view).every(unit => isUnitVisibleTo(state, 's1', unit)), 'no hidden enemy troops');
  assert.ok(getAllUnits(view).some(unit => unit.owner === 's1'), 'its own troops');
  assert.deepEqual(new Set(view.knownUnitIds), new Set(getAllUnits(state).map(unit => unit.id)), 'every troop there is, by id');
  assert.deepEqual(Object.keys(view.decks ?? {}), ['s1']);
  // (without fog, everyone sees the same)
  const clear = buildRoomBattle([member(0), member(1)], { ...DEFAULT_ROOM_SETTINGS, fog: false }, 3);
  assert.equal(sideViewOf(clear, 's1'), clear);
});
