import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Hex } from '@/types/game';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';

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

const buildMatrices = (hexes: Hex[]): Record<PartName, THREE.Matrix4[]> => {
  const result: Record<PartName, THREE.Matrix4[]> = {
    treeTrunk: [], treeTop: [], peak: [], snow: [], dune: [], nugget: [],
    hill: [], reed: [], puddle: [], snowTree: [], drift: [], pool: [], rock: []
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

const BoardDecorationsComponent: React.FC<{ hexGrid: Hex[] }> = ({ hexGrid }) => {
  // Decorations only depend on the terrain, not on units moving around
  const terrainSignature = hexGrid.map(h => `${h.coordinates.q},${h.coordinates.r},${h.terrain}`).join('|');
  const hexesRef = useRef(hexGrid);
  hexesRef.current = hexGrid;

  // Rebuild only when the terrain signature changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const matrices = useMemo(() => buildMatrices(hexesRef.current), [terrainSignature]);

  return (
    <>
      {(Object.keys(PARTS) as PartName[]).map(part => (
        <InstancedPart key={part} part={part} matrices={matrices[part]} />
      ))}
    </>
  );
};

export const BoardDecorations = memo(BoardDecorationsComponent);
