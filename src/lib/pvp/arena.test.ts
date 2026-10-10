// Free-for-all and team battles: the map's size, mirrored maps and fair mode
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArenaSpec, aiSideSpec, arenaGridSize, buildArenaBattle, mirrorSymmetry, sideId } from './arena';
import { DEFAULT_SETTINGS, findBaseHex } from '../game/gameState';
import { createHexagonalGrid } from '../game/mapGenerator';
import { hexOrbit } from '../game/hexUtils';

const spec = (count: number, extra: Partial<ArenaSpec> = {}): ArenaSpec => ({
  seed: 1234,
  sides: Array.from({ length: count }, (_, i) => aiSideSpec(sideId(i), `Side ${i + 1}`, i, 3, 99 + i)),
  weather: 'none',
  mapStyle: 'random',
  fog: false,
  difficulty: 'medium',
  turnSeconds: 30,
  maxRounds: 14,
  ...extra
});

test('the map grows by a hex for every side beyond four', () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(arenaGridSize), [4, 4, 4, 5, 6, 7, 8]);
  for (const count of [2, 4, 5, 8]) {
    const state = buildArenaBattle(spec(count));
    assert.equal(state.settings!.gridSize, arenaGridSize(count));
    assert.ok(state.sides!.every(side => findBaseHex(state, side)), `${count} sides: every castle stands`);
    assert.equal(state.currentPhase, 'planning');
  }
});

test('a mirrored map looks the same from every part: ground, mines, castles, camps and trees', () => {
  for (const count of [2, 3, 4, 6, 8]) {
    const parts = mirrorSymmetry(count);
    // (the ground as generated, before buildings go up on it)
    const settings = { ...DEFAULT_SETTINGS, gridSize: arenaGridSize(count), resourceHexCount: count + 1, symmetry: parts };
    const { hexGrid } = createHexagonalGrid(settings, 500 + count);
    const ground = new Map(hexGrid.map(hex => [`${hex.coordinates.q},${hex.coordinates.r}`, hex]));
    for (const hex of hexGrid) {
      for (const copy of hexOrbit(hex.coordinates, parts)) {
        const other = ground.get(`${copy.q},${copy.r}`)!;
        assert.equal(other.terrain, hex.terrain, `${count} sides: the ground mirrors`);
        assert.equal(other.resourceValue, hex.resourceValue, `${count} sides: gold mines mirror`);
      }
    }

    const state = buildArenaBattle(spec(count, { mapStyle: 'mirrored', seed: 77 + count }));
    assert.equal(state.settings!.symmetry, parts);
    const at = new Map(state.hexGrid.map(hex => [`${hex.coordinates.q},${hex.coordinates.r}`, hex]));
    for (const hex of state.hexGrid) {
      for (const copy of hexOrbit(hex.coordinates, parts)) {
        const other = at.get(`${copy.q},${copy.r}`)!;
        assert.equal(!!other.isBase, !!hex.isBase, `${count} sides: castles mirror`);
        assert.equal(!!other.isCamp, !!hex.isCamp, `${count} sides: camps mirror`);
        assert.equal(other.feature === 'greatTree', hex.feature === 'greatTree', `${count} sides: great trees mirror`);
      }
    }
  }
  assert.equal(mirrorSymmetry(5), 1);
  assert.equal(mirrorSymmetry(7), 1);
});

test('fair mode fields every card at the same level', () => {
  const sides = [aiSideSpec('s1', 'A', 0, 9, 1), aiSideSpec('s2', 'B', 1, 2, 2)];
  const state = buildArenaBattle(spec(2, { sides, fairLevel: 5 }));
  for (const side of ['s1', 's2']) {
    assert.ok(Object.values(state.rosters![side]).every(stats => stats!.level === 5));
  }
});
