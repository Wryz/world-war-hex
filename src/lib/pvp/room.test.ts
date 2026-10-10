// Online rooms: the battle a room's members fight, and armies from other devices made valid
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM_SETTINGS, RoomMember, buildRoomBattle, sanitizeArmy } from './room';
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
