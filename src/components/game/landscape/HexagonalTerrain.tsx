import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Use the same hex size constant as the game board to ensure consistency
const HEX_SIZE = 1;
const BEVEL_THICKNESS = 0.05;

interface HexagonalTerrainProps {
  gridSize?: number;     // Size of the hex grid (in tiles, diameter)
  centerRadius?: number; // Radius of the inner area (actual game board)
  maxHeight?: number;    // Maximum height for the outer terrain
}

const createHexShape = () => {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Pointy-top hexagon - EXACTLY matching the game board hexes
    const angle = (Math.PI / 3) * i + Math.PI / 2;
    const x = HEX_SIZE * Math.cos(angle);
    const y = HEX_SIZE * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
};

// Large hexagonal terrain surrounding the game board.
// All tiles are merged into a single mesh so the scenery costs one draw call.
const HexagonalTerrain: React.FC<HexagonalTerrainProps> = ({
  gridSize = 40,
  centerRadius = 15,    // Game board is roughly 12x12, so 15 units is a safe distance
  maxHeight = 5
}) => {
  // Load grass texture
  const grassTexture = useLoader(THREE.TextureLoader, '/textures/grass_texture.jpg');

  // Configure texture
  React.useEffect(() => {
    if (grassTexture) {
      grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
      grassTexture.repeat.set(0.5, 0.5); // Slightly larger texture repeat for consistency
      grassTexture.anisotropy = 16;
    }
  }, [grassTexture]);

  // Calculate the actual radius in world units
  const worldRadius = gridSize * 1.5; // Approximate conversion to world units

  const geometry = useMemo(() => {
    const shape = createHexShape();
    const geometries: THREE.BufferGeometry[] = [];
    const color = new THREE.Color();

    // Calculate how many rings of tiles we need to cover the grid
    const ringCount = Math.ceil(gridSize / 2);

    for (let ring = 1; ring <= ringCount; ring++) {
      // Skip creating tiles in the center area (actual game board)
      if (ring < centerRadius / (HEX_SIZE * 2)) continue;

      // Height increases gradually the further from center
      const distance = ring * HEX_SIZE * 2;
      const heightRatio = Math.min((distance - centerRadius) / (worldRadius - centerRadius), 1);
      const tileHeight = Math.max(0.1, heightRatio * maxHeight);

      // For each ring, we start at (-ring, 0) and move around the ring
      let q = -ring;
      let r = 0;

      for (let side = 0; side < 6; side++) {
        for (let step = 0; step < ring; step++) {
          const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
          const z = HEX_SIZE * 3 / 2 * r;

          if (Math.sqrt(x * x + z * z) <= worldRadius) {
            const tile = new THREE.ExtrudeGeometry(shape, {
              steps: 1,
              depth: tileHeight,
              bevelEnabled: true,
              bevelThickness: BEVEL_THICKNESS,
              bevelSize: 0.05,
              bevelOffset: 0,
              bevelSegments: 1
            });
            tile.rotateX(-Math.PI / 2);
            tile.translate(x, BEVEL_THICKNESS, z);

            // Vary color slightly per tile for a natural look
            color.set('#8bc34a').offsetHSL(0, 0, Math.random() * 0.2 - 0.1);
            const count = tile.getAttribute('position').count;
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
              colors[i * 3] = color.r;
              colors[i * 3 + 1] = color.g;
              colors[i * 3 + 2] = color.b;
            }
            tile.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            tile.clearGroups();
            geometries.push(tile);
          }

          // Move to next position based on current side
          if (side === 0) { q++; r--; }
          else if (side === 1) { q++; }
          else if (side === 2) { r++; }
          else if (side === 3) { q--; r++; }
          else if (side === 4) { q--; }
          else if (side === 5) { r--; }
        }
      }
    }

    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    return merged;
  }, [gridSize, worldRadius, centerRadius, maxHeight]);

  return (
    <group position={[0, -0.1, 0]}>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors map={grassTexture} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  );
};

// Also export the axialToWorld function and hex constants to help
// with positioning landscape assets on the terrain
export const getHexagonConstants = () => ({
  HEX_SIZE,
  BEVEL_THICKNESS
});

export const axialToWorld = (q: number, r: number): [number, number, number] => {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r/2);
  const z = HEX_SIZE * 3/2 * r;
  return [x, 0, z];
};

export default HexagonalTerrain;
