import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';

// Use the same hex size constant as the game board to ensure consistency
const HEX_SIZE = 1;
const BEVEL_THICKNESS = 0.05;

interface HexTileProps {
  position: [number, number, number];
  height: number;
  texture?: THREE.Texture;
  color?: string;
  receiveShadow?: boolean;
}

// A single hexagonal tile for the terrain
const HexTile: React.FC<HexTileProps> = ({
  position,
  height,
  texture,
  color = '#8bc34a',
  receiveShadow = true
}) => {
  // Create hexagon shape
  const shape = useMemo(() => {
    const hexShape = new THREE.Shape();
    const vertices = [];
    
    // Create pointy-top hexagon shape - EXACTLY matching the game board hexes
    for (let i = 0; i < 6; i++) {
      // Start with top point (Math.PI/2 is up in the XZ plane)
      const angle = (Math.PI / 3) * i + Math.PI/2;
      vertices.push(new THREE.Vector2(
        HEX_SIZE * Math.cos(angle),
        HEX_SIZE * Math.sin(angle)
      ));
    }
    
    hexShape.moveTo(vertices[0].x, vertices[0].y);
    
    for (let i = 1; i < 6; i++) {
      hexShape.lineTo(vertices[i].x, vertices[i].y);
    }
    
    hexShape.lineTo(vertices[0].x, vertices[0].y);
    
    return hexShape;
  }, []);
  
  // Extrude settings - match the game board's bevel settings
  const extrudeSettings = useMemo(() => {
    return {
      steps: 1,
      depth: height,
      bevelEnabled: true,
      bevelThickness: BEVEL_THICKNESS,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 3
    };
  }, [height]);
  
  // Create geometry
  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so it's facing up (y-axis)
    geo.rotateX(-Math.PI / 2);
    // Translate up to account for bevel, exactly like in the game board
    geo.translate(0, BEVEL_THICKNESS, 0);
    return geo;
  }, [shape, extrudeSettings]);
  
  return (
    <mesh position={position} geometry={geometry} receiveShadow={receiveShadow}>
      <meshStandardMaterial 
        color={color} 
        map={texture} 
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
};

interface HexagonalTerrainProps {
  gridSize?: number;     // Size of the hex grid (in tiles, diameter)
  centerRadius?: number; // Radius of the inner area (actual game board)
  maxHeight?: number;    // Maximum height for the outer terrain
}

// Create a large hexagonal terrain made of individual hex tiles
const HexagonalTerrain: React.FC<HexagonalTerrainProps> = ({
  gridSize = 40,        // 40x40 grid as requested
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
  
  // Generate the terrain tiles
  const terrainTiles = useMemo(() => {
    const tiles = [];
    
    // Convert from axial to cartesian coordinates - EXACTLY matching the game board's conversion
    const axialToWorld = (q: number, r: number): [number, number, number] => {
      const x = HEX_SIZE * Math.sqrt(3) * (q + r/2);
      const z = HEX_SIZE * 3/2 * r;
      return [x, 0, z];
    };
    
    // Calculate how many rings of tiles we need to cover the grid
    const ringCount = Math.ceil(gridSize / 2);
    
    // Generate the tiles in rings
    for (let ring = 0; ring <= ringCount; ring++) {
      // Skip creating tiles in the center area (actual game board)
      if (ring < centerRadius / (HEX_SIZE * 2)) {
        continue;
      }
      
      // Calculate height based on distance from center
      const distance = ring * HEX_SIZE * 2;
      // Height increases gradually the further from center
      const heightRatio = Math.min((distance - centerRadius) / (worldRadius - centerRadius), 1);
      const tileHeight = Math.max(0.1, heightRatio * maxHeight); // Ensure minimum height for terrain
      
      if (ring === 0) {
        // Center tile at (0,0)
        const pos = axialToWorld(0, 0);
        tiles.push(
          <HexTile
            key="center"
            position={pos}
            height={tileHeight}
            texture={grassTexture}
            color="#8bc34a"
          />
        );
      } else {
        // For each ring, we start at (-ring, 0) and move around the ring
        let q = -ring;
        let r = 0;
        
        // Each ring has 6 sides, each with 'ring' tiles
        for (let side = 0; side < 6; side++) {
          // Move 'ring' steps along each side
          for (let step = 0; step < ring; step++) {
            const pos = axialToWorld(q, r);
            
            // Only create tiles within our target radius
            if (Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]) <= worldRadius) {
              // Vary color slightly for natural look
              const colorVariation = Math.random() * 0.2 - 0.1; // -0.1 to 0.1
              const colorHex = new THREE.Color('#8bc34a')
                .offsetHSL(0, 0, colorVariation)
                .getHexString();
              
              tiles.push(
                <HexTile
                  key={`${q},${r}`}
                  position={pos}
                  height={tileHeight}
                  texture={grassTexture}
                  color={`#${colorHex}`}
                />
              );
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
    }
    
    return tiles;
  }, [worldRadius, centerRadius, maxHeight, grassTexture]);
  
  return (
    <group position={[0, -0.1, 0]}>
      {terrainTiles}
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