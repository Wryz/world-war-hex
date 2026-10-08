// Helpers for the rules tests: small battles on open ground with hand-placed troops
import assert from 'node:assert/strict';
import type { Ability, GameState, HexCoordinates, PlayerType, Unit, UnitType } from '@/types/game';
import { DEFAULT_SETTINGS, createBattle, executeMoves, findBaseHex, resolveAllCombats } from './gameState';
import { getHexDistance } from './hexUtils';

let nextId = 0;

// A unit with simple, round stats unless told otherwise
export const makeUnit = (owner: PlayerType, position: HexCoordinates, overrides: Partial<Unit> & { abilities?: Ability[] } = {}): Unit => ({
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

// A battle on open ground with no troops, on the given side's turn. `centre` is a hex at least 5
// away from both castles, so troops placed around it fight each other rather than a castle.
export const makeBattle = (activePlayer: PlayerType = 'ai', extra: Partial<GameState> = {}) => {
  const state = { ...createBattle({ ...DEFAULT_SETTINGS, gridSize: 5, fogOfWar: false, seed: 7 }), ...extra };
  for (const hex of state.hexGrid) {
    if (!hex.isBase) hex.terrain = 'plain';
    hex.feature = undefined;
    hex.fire = undefined;
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

export const at = (centre: HexCoordinates, dq: number, dr: number): HexCoordinates => ({ q: centre.q + dq, r: centre.r + dr });

export const place = (state: GameState, ...units: Unit[]) => {
  for (const unit of units) state.players[unit.owner].units.push(unit);
  for (const hex of state.hexGrid) {
    hex.unit = units.find(unit => unit.position.q === hex.coordinates.q && unit.position.r === hex.coordinates.r) ?? hex.unit;
  }
};

export const find = (state: GameState, unit: Unit) =>
  state.players[unit.owner].units.find(candidate => candidate.id === unit.id);

export const health = (state: GameState, unit: Unit) => find(state, unit)?.lifespan ?? 0;

// Carry out the active side's orders and fight out any battles, ending its turn
export const playTurn = (state: GameState): GameState => {
  const moved = executeMoves(state);
  return moved.currentPhase === 'combat' ? resolveAllCombats(moved) : moved;
};
