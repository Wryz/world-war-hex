import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Hex, PlayerType, TerrainType } from '@/types/game';
import { STRUCTURE_TERRAINS, isStructure } from '@/lib/game/structures';
import type { MapDecor } from '@/lib/game/mapGenerator';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';
import { KAYKIT_HEX_SCALE, PropLibrary, PropPack, packOfModel, usePropLibrary } from './utils/kaykitProps';
import { StoryProp, historyFor, storySiteFor } from '@/lib/game/lore';

// Terrain props (trees, peaks, dunes, gold) drawn with one instanced mesh per part,
// so the whole board's decorations cost a handful of draw calls

const PARTS = {
  treeTrunk: {
    geometry: new THREE.CylinderGeometry(0.04, 0.05, 0.2, 5).translate(0, 0.1, 0),
    material: new THREE.MeshStandardMaterial({ color: '#8d5a3b' }),
    castShadow: false
  },
  treeTop: {
    geometry: new THREE.ConeGeometry(0.18, 0.45, 6).translate(0, 0.38, 0),
    material: new THREE.MeshStandardMaterial({ color: '#2fa84f', flatShading: true }),
    castShadow: true
  },
  peak: {
    // Unit-height cone with its base at y=0, scaled per instance
    geometry: new THREE.ConeGeometry(0.35, 1, 5).translate(0, 0.5, 0),
    material: new THREE.MeshStandardMaterial({ color: '#97a6b0', flatShading: true }),
    castShadow: true
  },
  snow: {
    geometry: new THREE.ConeGeometry(0.1, 1, 5),
    material: new THREE.MeshStandardMaterial({ color: '#fafafa', flatShading: true }),
    castShadow: false
  },
  dune: {
    geometry: new THREE.SphereGeometry(1, 10, 6),
    material: new THREE.MeshStandardMaterial({ color: '#f2c45a', flatShading: true }),
    castShadow: false
  },
  nugget: {
    geometry: new THREE.OctahedronGeometry(1),
    material: new THREE.MeshStandardMaterial({ color: '#ffd54f', emissive: '#ffb300', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }),
    castShadow: false
  },
  hill: {
    // Low grassy dome, scaled per instance
    geometry: new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    material: new THREE.MeshStandardMaterial({ color: '#a9c25f', flatShading: true }),
    castShadow: true
  },
  reed: {
    geometry: new THREE.ConeGeometry(0.025, 0.32, 4).translate(0, 0.16, 0),
    material: new THREE.MeshStandardMaterial({ color: '#4d6b3a', flatShading: true }),
    castShadow: false
  },
  puddle: {
    geometry: new THREE.CylinderGeometry(1, 1, 0.02, 7),
    material: new THREE.MeshStandardMaterial({ color: '#5f8f86', roughness: 0.3 }),
    castShadow: false
  },
  snowTree: {
    geometry: new THREE.ConeGeometry(0.17, 0.42, 6).translate(0, 0.36, 0),
    material: new THREE.MeshStandardMaterial({ color: '#dceef7', flatShading: true }),
    castShadow: true
  },
  drift: {
    geometry: new THREE.SphereGeometry(1, 8, 5),
    material: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }),
    castShadow: false
  },
  pool: {
    geometry: new THREE.CylinderGeometry(1, 1, 0.03, 12),
    material: new THREE.MeshStandardMaterial({ color: '#3fd7e8', emissive: '#22b8cf', emissiveIntensity: 0.35, roughness: 0.2 }),
    castShadow: false
  },
  rock: {
    geometry: new THREE.DodecahedronGeometry(1),
    material: new THREE.MeshStandardMaterial({ color: '#b8c4cc', flatShading: true }),
    castShadow: false
  },
  magma: {
    // Glowing pools and cracks in the lava fields
    geometry: new THREE.CylinderGeometry(1, 1, 0.03, 7),
    material: new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: '#ff5a00', emissiveIntensity: 1.4, roughness: 0.4 }),
    castShadow: false
  },
  basalt: {
    geometry: new THREE.DodecahedronGeometry(1),
    material: new THREE.MeshStandardMaterial({ color: '#2b211f', flatShading: true }),
    castShadow: true
  },
  iceShard: {
    geometry: new THREE.ConeGeometry(0.08, 1, 4).translate(0, 0.5, 0),
    material: new THREE.MeshStandardMaterial({ color: '#e0f7ff', emissive: '#7dd3fc', emissiveIntensity: 0.25, roughness: 0.15, flatShading: true }),
    castShadow: true
  },
  pillar: {
    // Broken column, scaled per instance
    geometry: new THREE.CylinderGeometry(0.08, 0.09, 1, 6).translate(0, 0.5, 0),
    material: new THREE.MeshStandardMaterial({ color: '#e8dcc0', flatShading: true }),
    castShadow: true
  },
  block: {
    geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    material: new THREE.MeshStandardMaterial({ color: '#d4c6a2', flatShading: true }),
    castShadow: true
  },
  tombstone: {
    geometry: new THREE.BoxGeometry(0.14, 0.2, 0.05).translate(0, 0.1, 0),
    material: new THREE.MeshStandardMaterial({ color: '#8a8299', flatShading: true }),
    castShadow: true
  },
  wisp: {
    geometry: new THREE.OctahedronGeometry(1),
    material: new THREE.MeshStandardMaterial({ color: '#e9d5ff', emissive: '#a855f7', emissiveIntensity: 1.3 }),
    castShadow: false
  },
  deadTree: {
    geometry: new THREE.ConeGeometry(0.05, 0.5, 4).translate(0, 0.25, 0),
    material: new THREE.MeshStandardMaterial({ color: '#3f3540', flatShading: true }),
    castShadow: true
  }
};

type PartName = keyof typeof PARTS;

// Deterministic pseudo random number for a hex so decorations are stable
const seededRandom = (hex: Hex, salt: number) => {
  const x = Math.sin(hex.coordinates.q * 127.1 + hex.coordinates.r * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

// Points around the rim of a tile, leaving the centre free for a unit
const rimSpots = (hex: Hex, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + seededRandom(hex, i) * 0.8;
    const radius = 0.5 + seededRandom(hex, i + 10) * 0.15;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, r: seededRandom(hex, i + 20) };
  });

const buildMatrices = (hexes: Hex[], skip: ReadonlySet<TerrainType>): Record<PartName, THREE.Matrix4[]> => {
  const result: Record<PartName, THREE.Matrix4[]> = {
    treeTrunk: [], treeTop: [], peak: [], snow: [], dune: [], nugget: [],
    hill: [], reed: [], puddle: [], snowTree: [], drift: [], pool: [], rock: [],
    magma: [], basalt: [], iceShard: [], pillar: [], block: [], tombstone: [], wisp: [], deadTree: []
  };
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const add = (part: PartName, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0) => {
    position.set(x, y, z);
    quaternion.setFromEuler(rotation.set(rx, ry, 0));
    scale.set(sx, sy, sz);
    result[part].push(new THREE.Matrix4().compose(position, quaternion, scale));
  };

  for (const hex of hexes) {
    // (a story site's hex is cleared for what happened there)
    if (skip.has(hex.terrain) || hex.storySite) continue;
    const [cx, , cz] = axialToWorld(hex.coordinates);
    const y = getHexSurfaceHeight(hex);

    switch (hex.terrain) {
      case 'forest':
        for (const { x, z, r } of rimSpots(hex, 4)) {
          const s = 0.8 + r * 0.4;
          add('treeTrunk', cx + x, y, cz + z, s, s, s);
          add('treeTop', cx + x, y, cz + z, s, s, s);
        }
        break;
      case 'mountain':
        for (const [x, z, h] of [[0, 0, 0.75], [0.35, 0.2, 0.5], [-0.3, 0.25, 0.45]]) {
          add('peak', cx + x, y, cz + z, 1, h, 1);
          add('snow', cx + x, y + h * 0.85, cz + z, 1, h * 0.3, 1);
        }
        break;
      case 'desert':
        for (const { x, z, r } of rimSpots(hex, 3)) {
          add('dune', cx + x, y, cz + z, 0.25 + r * 0.1, 0.06, 0.15);
        }
        break;
      case 'resource':
        for (const { x, z, r } of rimSpots(hex, 3)) {
          const s = 0.12 + r * 0.05;
          add('nugget', cx + x, y + 0.1, cz + z, s, s, s, r, r * 2);
        }
        break;
      case 'hills':
        for (const { x, z, r } of rimSpots(hex, 2)) {
          add('hill', cx + x * 0.8, y, cz + z * 0.8, 0.32 + r * 0.08, 0.16 + r * 0.06, 0.26 + r * 0.06, 0, r * 3);
        }
        break;
      case 'swamp':
        for (const { x, z, r } of rimSpots(hex, 2)) {
          add('puddle', cx + x * 0.7, y + 0.005, cz + z * 0.7, 0.2 + r * 0.08, 1, 0.14 + r * 0.06, 0, r * 3);
        }
        for (const { x, z, r } of rimSpots(hex, 5)) {
          const s = 0.8 + r * 0.5;
          add('reed', cx + x, y, cz + z, s, s, s, (r - 0.5) * 0.3);
        }
        break;
      case 'snow':
        for (const { x, z, r } of rimSpots(hex, 3)) {
          if (r > 0.5) {
            const s = 0.8 + r * 0.3;
            add('treeTrunk', cx + x, y, cz + z, s, s, s);
            add('snowTree', cx + x, y, cz + z, s, s, s);
          } else {
            add('drift', cx + x, y, cz + z, 0.16 + r * 0.08, 0.06, 0.12);
          }
        }
        break;
      case 'spring':
        add('pool', cx, y + 0.01, cz, 0.36, 1, 0.36);
        for (const { x, z, r } of rimSpots(hex, 5)) {
          const s = 0.05 + r * 0.04;
          add('rock', cx + x * 0.72, y + s * 0.4, cz + z * 0.72, s, s * 0.8, s, r, r * 2);
        }
        break;
      case 'lava':
        add('magma', cx, y + 0.005, cz, 0.42, 1, 0.3, 0, seededRandom(hex, 1) * 3);
        for (const { x, z, r } of rimSpots(hex, 3)) {
          const s = 0.1 + r * 0.07;
          add('basalt', cx + x, y + s * 0.4, cz + z, s, s * 1.3, s, r, r * 2);
        }
        break;
      case 'ice':
        for (const { x, z, r } of rimSpots(hex, 4)) {
          add('iceShard', cx + x, y, cz + z, 1, 0.18 + r * 0.22, 1, (r - 0.5) * 0.5, r * 3);
        }
        break;
      case 'ruins':
        for (const { x, z, r } of rimSpots(hex, 3)) {
          if (r > 0.45) add('pillar', cx + x, y, cz + z, 1, 0.25 + r * 0.4, 1, (r - 0.5) * 0.2);
          else add('block', cx + x, y, cz + z, 0.18, 0.1 + r * 0.1, 0.14, 0, r * 4);
        }
        break;
      case 'village':
        for (const { x, z, r } of rimSpots(hex, 3)) {
          add('block', cx + x, y, cz + z, 0.2, 0.18 + r * 0.1, 0.16, 0, Math.atan2(x, z));
        }
        break;
      case 'cursed':
        for (const { x, z, r } of rimSpots(hex, 3)) {
          if (r > 0.6) add('deadTree', cx + x, y, cz + z, 1, 1 + r * 0.4, 1, (r - 0.5) * 0.4);
          else add('tombstone', cx + x, y, cz + z, 1, 1, 1, (r - 0.5) * 0.3, r * 3);
        }
        add('wisp', cx + 0.15, y + 0.45, cz - 0.1, 0.05, 0.08, 0.05);
        break;
    }
  }

  return result;
};

const InstancedPart: React.FC<{ part: PartName; matrices: THREE.Matrix4[] }> = ({ part, matrices }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geometry, material, castShadow } = PARTS[part];

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh
      // Recreate the mesh when the instance count changes
      key={matrices.length}
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
};

// --- KayKit scenery ---------------------------------------------------------------------------

// Terrain drawn with KayKit models once they have loaded (the rest keeps the shapes above)
const KAYKIT_TERRAIN: ReadonlySet<TerrainType> = new Set(['forest', 'mountain', 'plain', 'resource', 'ruins', 'cursed', 'water', 'swamp', 'village', ...STRUCTURE_TERRAINS]);

// Buildings drawn in the colour of the side holding them (yellow while nobody does), and their size
const BUILDING_MODELS: Partial<Record<TerrainType, { model: string; scale: number }>> = {
  watchtower: { model: 'building_tower_A', scale: 0.62 },
  catapult: { model: 'building_tower_catapult', scale: 0.6 },
  blacksmith: { model: 'building_blacksmith', scale: 0.58 },
  barracks: { model: 'building_barracks', scale: 0.58 },
  tavern: { model: 'building_tavern', scale: 0.58 },
  lumbermill: { model: 'building_lumbermill', scale: 0.58 }
};
const SIDE_COLOR: Record<PlayerType | 'none', string> = { player: 'blue', ai: 'red', none: 'yellow' };
const S = KAYKIT_HEX_SCALE;

// Where each KayKit model goes on the board: one list of transforms per model
// A map's decor style swaps some scenery for its region's own (a dungeon's pillars, a haunted wood's
// pumpkins)
const buildPropMatrices = (hexes: Hex[], decor?: MapDecor): Map<string, THREE.Matrix4[]> => {
  const result = new Map<string, THREE.Matrix4[]>();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  // Many models stand on a flat base; a hair above the hex top so the two never flicker through each other
  const LIFT = 0.006;
  const add = (model: string, x: number, y: number, z: number, scale: number, turn = 0) => {
    quaternion.setFromAxisAngle(up, turn);
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y + LIFT, z), quaternion, new THREE.Vector3(scale, scale, scale));
    const list = result.get(model);
    if (list) list.push(matrix);
    else result.set(model, [matrix]);
  };
  const pick = (models: string[], r: number) => models[Math.min(models.length - 1, Math.floor(r * models.length))];

  const hexAt = new Map(hexes.map(hex => [`${hex.coordinates.q},${hex.coordinates.r}`, hex]));
  // The heading along the first of the hex's three axes with a matching hex on both sides (or one)
  const lineTurn = (hex: Hex, matches: (other: Hex) => boolean) => {
    const axes = [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: 1, r: -1 }];
    const score = (d: { q: number; r: number }) => [1, -1].filter(sign => {
      const other = hexAt.get(`${hex.coordinates.q + sign * d.q},${hex.coordinates.r + sign * d.r}`);
      return other && matches(other);
    }).length;
    const best = [...axes].sort((a, b) => score(b) - score(a))[0];
    const [x0, , z0] = axialToWorld(hex.coordinates);
    const [x1, , z1] = axialToWorld({ q: hex.coordinates.q + best.q, r: hex.coordinates.r + best.r });
    return Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  };

  for (const hex of hexes) {
    // Stakes planted against cavalry: a hedge of sharpened fence posts
    if (hex.feature === 'stakes') {
      const [cx, , cz] = axialToWorld(hex.coordinates);
      const y = getHexSurfaceHeight(hex);
      for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3 + 0.3;
        add('fence_wood_straight', cx + Math.cos(angle) * 0.3, y, cz + Math.sin(angle) * 0.3, 0.75, -angle + Math.PI / 4);
      }
    }
    if (!KAYKIT_TERRAIN.has(hex.terrain) || hex.isBase || hex.isCamp || hex.storySite) continue;
    const [cx, , cz] = axialToWorld(hex.coordinates);
    const y = getHexSurfaceHeight(hex);
    const spin = (salt: number) => seededRandom(hex, salt) * Math.PI * 2;

    // Toward the hex's centre from a spot on its rim, so buildings face the middle
    const facing = (x: number, z: number) => Math.atan2(-x, -z);

    switch (hex.terrain) {
      case 'forest':
        for (const { x, z, r } of rimSpots(hex, 4)) {
          if (decor === 'haunted') {
            add(r > 0.5 ? 'tree_pine_orange_medium' : 'tree_dead_large', cx + x, y, cz + z, r > 0.5 ? 0.16 + r * 0.04 : 0.17 + r * 0.05, r * 6);
          } else {
            add(r > 0.5 ? 'tree_single_A' : 'tree_single_B', cx + x, y, cz + z, 0.5 + r * 0.25, r * 6);
          }
        }
        break;
      case 'village': {
        // Two or three buildings evenly round the middle (kept clear for troops), small enough that
        // they never overlap each other or the buildings of a neighbouring village
        const buildings = ['building_home_A_yellow', 'building_home_B_yellow', 'building_home_A_yellow', 'building_windmill_yellow',
          'building_well_yellow', 'building_market_yellow', 'building_church_yellow', 'building_home_B_yellow'];
        const scales: Record<string, number> = { building_market_yellow: 0.32, building_church_yellow: 0.4, building_windmill_yellow: 0.44 };
        const first = seededRandom(hex, 29) * Math.PI * 2;
        for (let i = 0; i < 3; i++) {
          // The third spot is sometimes left open
          if (i === 2 && seededRandom(hex, 33) < 0.35) continue;
          const model = pick(buildings, seededRandom(hex, i + 30));
          const angle = first + i * Math.PI * 2 / 3;
          const x = Math.cos(angle) * 0.48;
          const z = Math.sin(angle) * 0.48;
          add(model, cx + x, y, cz + z, scales[model] ?? 0.46, facing(x, z));
        }
        break;
      }
      case 'watchtower':
      case 'catapult':
      case 'blacksmith':
      case 'barracks':
      case 'tavern':
      case 'lumbermill': {
        const building = BUILDING_MODELS[hex.terrain]!;
        add(`${building.model}_${SIDE_COLOR[hex.owner ?? 'none']}`, cx, y, cz, building.scale, Math.round(seededRandom(hex, 3) * 6) * Math.PI / 3);
        break;
      }
      case 'wall':
      case 'gate': {
        // Stone wall along its line (towards the next stretch of wall or the gate); the gatehouse flies
        // the flag of whoever holds it
        // (a gate torn down to ruins still lines the wall up)
        const turn = lineTurn(hex, other => other.terrain === 'wall' || other.terrain === 'gate' || other.terrain === 'ruins');
        add(hex.terrain === 'gate' ? 'wall_straight_gate' : 'wall_straight', cx, y, cz, S * 0.98, turn);
        if (hex.terrain === 'gate' && hex.owner) add(hex.owner === 'player' ? 'flag_blue' : 'flag_red', cx + 0.35, y, cz + 0.35, 0.9, turn);
        break;
      }
      case 'bridge':
        // Across the water, from bank to bank
        add('building_bridge_A', cx, y, cz, S * 0.98, lineTurn(hex, other => other.terrain !== 'water' && other.terrain !== 'bridge' && other.terrain !== 'mountain'));
        break;
      case 'house': {
        // A cottage, and a crate or barrel by the door
        const turn = Math.round(seededRandom(hex, 3) * 6) * Math.PI / 3;
        add(seededRandom(hex, 4) > 0.5 ? 'building_home_A_yellow' : 'building_home_B_yellow', cx, y, cz, 0.68, turn);
        const [{ x, z, r }] = rimSpots(hex, 1);
        add(r > 0.5 ? 'barrel' : 'crate_B_small', cx + x * 1.1, y, cz + z * 1.1, 1.4, r * 6);
        break;
      }
      case 'mountain':
        // (the grassy variants' tops read as yellow once the palette is lifted, so bare rock only)
        add(pick(['mountain_A', 'mountain_B', 'mountain_C'], seededRandom(hex, 1)), cx, y, cz, S * 0.95, Math.round(seededRandom(hex, 2) * 6) * Math.PI / 3);
        break;
      case 'plain':
        // A little scenery on some open ground: a rock, or a lone tree at the edge
        if (decor === 'dungeon' && seededRandom(hex, 7) < 0.45) {
          const [{ x, z, r }] = rimSpots(hex, 1);
          if (r > 0.55) add('torch_lit', cx + x, y + 0.2, cz + z, 0.5, r * 6);
          else add(r > 0.25 ? 'column' : 'rubble_half', cx + x, y, cz + z, r > 0.25 ? 0.42 : 0.12, r * 6);
        } else if (decor === 'haunted' && seededRandom(hex, 7) < 0.35) {
          const [{ x, z, r }] = rimSpots(hex, 1);
          if (r > 0.5) add(r > 0.75 ? 'pumpkin_orange' : 'pumpkin_orange_jackolantern', cx + x, y, cz + z, r > 0.75 ? 0.2 : 0.16, r * 6);
          else add('fence_broken', cx + x, y, cz + z, 0.1, facing(x, z) + Math.PI / 2);
        } else if (seededRandom(hex, 7) < 0.35) {
          const [{ x, z, r }] = rimSpots(hex, 1);
          if (r > 0.6) add(r > 0.8 ? 'tree_single_A' : 'tree_single_B', cx + x * 1.1, y, cz + z * 1.1, 0.42, r * 6);
          else add(pick(['rock_single_A', 'rock_single_D', 'rock_single_E'], r), cx + x, y, cz + z, 1, r * 6);
        }
        break;
      case 'resource': {
        const [mine, stone, crate] = rimSpots(hex, 3);
        if (decor === 'dungeon') {
          // A treasure vault rather than a mine
          add('chest_gold', cx + mine.x, y, cz + mine.z, 0.2, facing(mine.x, mine.z));
          add('coin_stack_large', cx + stone.x, y, cz + stone.z, 0.18, spin(4));
          add('torch_lit', cx + crate.x, y + 0.2, cz + crate.z, 0.5, spin(5));
          break;
        }
        add('building_mine_yellow', cx + mine.x * 1.05, y, cz + mine.z * 1.05, 0.3, Math.atan2(-mine.x, -mine.z));
        add('resource_stone', cx + stone.x, y, cz + stone.z, 0.75, spin(4));
        add('crate_A_big', cx + crate.x, y, cz + crate.z, 1, spin(5));
        break;
      }
      case 'ruins': {
        const [ruin, wall, rock] = rimSpots(hex, 3);
        if (decor === 'dungeon') {
          // Broken halls: pillars, rubble and a fallen banner
          add('pillar_decorated', cx + ruin.x, y, cz + ruin.z, 0.13, facing(ruin.x, ruin.z));
          add('rubble_large', cx + wall.x, y, cz + wall.z, 0.08, Math.atan2(wall.x, wall.z) + Math.PI / 2);
          add(rock.r > 0.5 ? 'sword_shield_broken' : 'candle_triple', cx + rock.x, y + (rock.r > 0.5 ? 0.06 : 0), cz + rock.z, rock.r > 0.5 ? 0.16 : 0.3, spin(6));
          break;
        }
        add('building_destroyed', cx + ruin.x, y, cz + ruin.z, 0.32, spin(4));
        add('wall_straight', cx + wall.x, y, cz + wall.z, 0.2, Math.atan2(wall.x, wall.z) + Math.PI / 2);
        add('rock_single_D', cx + rock.x, y, cz + rock.z, 1, spin(6));
        break;
      }
      case 'cursed':
        for (const [i, { x, z, r }] of rimSpots(hex, 3).entries()) {
          const model = pick(['gravestone', 'grave_A', 'tree_dead_medium', 'pumpkin_orange_jackolantern', 'lantern_standing', 'gravemarker_A'], r);
          const scale = model === 'tree_dead_medium' ? 0.13 : model === 'grave_A' ? 0.11 : model.startsWith('pumpkin') ? 0.18 : model === 'lantern_standing' ? 0.24 : 0.14;
          add(model, cx + x, y, cz + z, scale, spin(i + 8));
        }
        break;
      case 'water':
        for (const [i, { x, z, r }] of rimSpots(hex, 3).entries()) {
          add(r > 0.5 ? 'waterlily_A' : 'waterlily_B', cx + x * 0.7, y, cz + z * 0.7, 1.6, spin(i + 2));
        }
        if (seededRandom(hex, 9) > 0.5) add('waterplant_A', cx + 0.4, y, cz - 0.3, 1.6, spin(10));
        break;
      case 'swamp':
        for (const [i, { x, z, r }] of rimSpots(hex, 4).entries()) {
          add(pick(['waterplant_A', 'waterplant_B', 'waterplant_C', 'waterlily_A'], r), cx + x, y, cz + z, 1.7, spin(i + 2));
        }
        break;
    }
  }
  return result;
};

// --- The land's history ---------------------------------------------------------------------------

// Open ground where the past shows through (a waystone, a fallen knight's shield, an abandoned camp)
const HISTORY_GROUND: ReadonlySet<TerrainType> = new Set(['plain', 'desert', 'hills', 'snow']);
const HISTORY_SHARE = 0.14;

// The region's story site and the remnants of its history, as a list of transforms per model
const buildHistoryMatrices = (hexes: Hex[], theme: string | undefined): Map<string, THREE.Matrix4[]> => {
  const result = new Map<string, THREE.Matrix4[]>();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  // A scene laid out around (ax, az), turned as a whole
  const layout = (props: StoryProp[], ax: number, y: number, az: number, turn: number) => {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (const prop of props) {
      quaternion.setFromAxisAngle(up, (prop.turn ?? 0) + turn);
      const position = new THREE.Vector3(ax + prop.x * cos + prop.z * sin, y + 0.006 + (prop.lift ?? 0), az - prop.x * sin + prop.z * cos);
      const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(prop.scale, prop.scale, prop.scale));
      const list = result.get(prop.model);
      if (list) list.push(matrix);
      else result.set(prop.model, [matrix]);
    }
  };
  const site = storySiteFor(theme);
  const history = historyFor(theme);

  for (const hex of hexes) {
    if (hex.isBase || hex.isCamp) continue;
    const [cx, , cz] = axialToWorld(hex.coordinates);
    const y = getHexSurfaceHeight(hex);
    if (hex.storySite && site) {
      // Round the edge of the hex, leaving the middle to the troop that searches it
      site.props.forEach((prop, i) => {
        const angle = SITE_FIRST_ANGLE + i * Math.PI * 2 / site.props.length;
        layout([{ ...prop, x: 0, z: 0 }], cx + Math.cos(angle) * SITE_RADIUS, y, cz + Math.sin(angle) * SITE_RADIUS, 0);
      });
      continue;
    }
    // (not on ground that is burning or has burned, or under a fallen trunk or stakes)
    if (!HISTORY_GROUND.has(hex.terrain) || hex.scorched || hex.fire || hex.feature || seededRandom(hex, 41) >= HISTORY_SHARE) continue;
    // Near the edge, clear of the troop standing in the middle and of the tile's other scenery: across
    // from a field's rock or tree, between a hill's two mounds, and midway between a desert's (or a
    // snowfield's) first two dunes
    const spotAngle = ({ x, z }: { x: number; z: number }) => Math.atan2(z, x);
    const [first, second] = rimSpots(hex, 3);
    const angle = hex.terrain === 'plain' ? spotAngle(rimSpots(hex, 1)[0]) + Math.PI
      : hex.terrain === 'hills' ? spotAngle(rimSpots(hex, 2)[0]) + Math.PI / 2
        : (spotAngle(first) + spotAngle(second) + (spotAngle(second) < spotAngle(first) ? Math.PI * 2 : 0)) / 2;
    const scene = history[Math.min(history.length - 1, Math.floor(seededRandom(hex, 42) * history.length))];
    layout(scene, cx + Math.cos(angle) * 0.5, y, cz + Math.sin(angle) * 0.5, -angle + Math.PI / 2);
  }
  return result;
};

// Where a story site's props stand: round the hex's rim, beyond the ring under a troop standing there,
// the first (its centrepiece) at the back, away from the camera
const SITE_RADIUS = 0.62;
const SITE_FIRST_ANGLE = -Math.PI / 2;

// Every pack a region's story site and history could call on, so they load once with the board
// (and a scene appearing later in the battle never sends the board back to plain shapes while one loads)
const regionPacks = (theme: string | undefined): PropPack[] => {
  const models = [...(storySiteFor(theme)?.props ?? []), ...historyFor(theme).flat()].map(prop => prop.model);
  return [...new Set(models.map(packOfModel))].sort();
};

const InstancedProp: React.FC<{ library: PropLibrary; model: string; matrices: THREE.Matrix4[] }> = ({ library, model, matrices }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const prop = library.get(model);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  if (!prop || matrices.length === 0) return null;
  return <instancedMesh key={matrices.length} ref={ref} args={[prop.geometry, prop.material, matrices.length]} castShadow receiveShadow />;
};

const NO_SKIP: ReadonlySet<TerrainType> = new Set();

// `history` off leaves out the region's remnants and story site (the landing page's island, which
// keeps to the scenery its poster shows and downloads as little as it can)
const BoardDecorationsComponent: React.FC<{ hexGrid: Hex[]; decor?: MapDecor; mapName?: string; history?: boolean }> = ({
  hexGrid, decor, mapName, history: showHistory = true
}) => {
  // Decorations only depend on the terrain, not on units moving around
  // (and on who holds each building, which shows in its colours)
  // (and on how high it stands, once troops dig in or undermine it)
  const terrainSignature = hexGrid.map(h => `${h.coordinates.q},${h.coordinates.r},${h.terrain}${isStructure(h.terrain) ? h.owner ?? '' : ''}${h.feature ?? ''}${h.storySite ? '!' : ''}${h.scorched ? '*' : ''}${h.fire ? 'f' : ''}${h.heightOffset ?? ''}`).join('|');
  const hexesRef = useRef(hexGrid);
  hexesRef.current = hexGrid;
  const history = useMemo(
    () => (showHistory ? buildHistoryMatrices(hexesRef.current, mapName) : new Map<string, THREE.Matrix4[]>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrainSignature, mapName, showHistory]
  );
  const historyPacks = useMemo(() => (showHistory ? regionPacks(mapName).join(',') : ''), [mapName, showHistory]);

  // Only the packs this map's scenery uses download (Halloween bits for haunted ground, dungeon props
  // for the Underkeep, whichever its history needs)
  const hasCursed = hexGrid.some(hex => hex.terrain === 'cursed');
  const hasBuildings = hexGrid.some(hex => isStructure(hex.terrain));
  const packs = useMemo((): PropPack[] => [...new Set<PropPack>([
    'medieval',
    ...(hasCursed || decor === 'haunted' ? ['halloween' as const] : []),
    ...(decor === 'dungeon' ? ['dungeon' as const] : []),
    ...(hasBuildings ? ['buildings' as const] : []),
    ...(historyPacks ? historyPacks.split(',') as PropPack[] : [])
  ])], [hasCursed, decor, hasBuildings, historyPacks]);
  const library = usePropLibrary(packs);

  // Rebuild only when the terrain signature changes (or the KayKit models arrive)
  const matrices = useMemo(
    () => buildMatrices(hexesRef.current, library ? KAYKIT_TERRAIN : NO_SKIP),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrainSignature, !!library]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const props = useMemo(() => (library ? buildPropMatrices(hexesRef.current, decor) : null), [terrainSignature, library, decor]);

  return (
    <>
      {(Object.keys(PARTS) as PartName[]).map(part => (
        <InstancedPart key={part} part={part} matrices={matrices[part]} />
      ))}
      {library && props && [...props].map(([model, list]) => (
        <InstancedProp key={model} library={library} model={model} matrices={list} />
      ))}
      {library && [...history].map(([model, list]) => (
        <InstancedProp key={`history-${model}`} library={library} model={model} matrices={list} />
      ))}
    </>
  );
};

export const BoardDecorations = memo(BoardDecorationsComponent);
