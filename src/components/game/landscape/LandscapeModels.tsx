import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Model, preloadModels } from '../utils/ModelLoader';
import HexagonalTerrain, { axialToWorld, getHexagonConstants } from './HexagonalTerrain';

// Define model types for clarity
type ModelType = 'rock' | 'tree1' | 'tree2' | 'bush' | 'goldRock';

// Basic shapes to use as fallbacks if models fail to load
const createFallbackMesh = (type: ModelType) => {
  switch (type) {
    case 'rock':
      return <mesh>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#777777" roughness={0.8} />
      </mesh>;
    case 'tree1':
    case 'tree2':
      return <group>
        <mesh position={[0, 1.5, 0]}>
          <coneGeometry args={[1, 3, 8]} />
          <meshStandardMaterial color="#2e7d32" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
          <meshStandardMaterial color="#5d4037" roughness={0.8} />
        </mesh>
      </group>;
    case 'bush':
      return <mesh>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.9} />
      </mesh>;
    case 'goldRock':
      return <mesh>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshStandardMaterial color="#ffd700" roughness={0.5} metalness={0.5} />
      </mesh>;
    default:
      return <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>;
  }
};

// Animated model component that wraps our Model component
const AnimatedModel: React.FC<{
  type: ModelType;
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ 
  type,
  url, 
  position, 
  rotation = [0, 0, 0], 
  scale = 1
}) => {
  const group = useRef<THREE.Group>(null);
  
  // Apply animation
  useFrame(({ clock }) => {
    if (group.current) {
      // Gentle swaying or floating effect - only for trees and bushes
      const shouldAnimate = type === 'tree1' || type === 'tree2' || type === 'bush';
      if (shouldAnimate) {
        // Very subtle motion - just the top part should move, not floating
        group.current.rotation.z = rotation[2] + Math.sin(clock.getElapsedTime() * 0.3) * 0.02;
        group.current.rotation.x = rotation[0] + Math.sin(clock.getElapsedTime() * 0.2) * 0.01;
      }
    }
  });
  
  return (
    <group ref={group} position={position} rotation={rotation}>
      <Model 
        url={url} 
        position={[0, 0, 0]} 
        scale={scale}
        fallback={createFallbackMesh(type)}
      />
    </group>
  );
};

interface LandscapeModelsProps {
  boardRadius?: number; // Distance from center to use for placement
}

// Wrap the entire component in React.memo to prevent unnecessary re-renders
const LandscapeModels = React.memo(({ boardRadius = 15 }: LandscapeModelsProps) => {
  // Model paths - ensure these match EXACTLY what's in the public/models directory
  const MODEL_PATHS = {
    rock: '/models/rocks-1.glb',
    tree1: '/models/tree-1.glb',
    tree2: '/models/tree-2.glb',
    bush: '/models/bush-1.glb',
    goldRock: '/models/rock-gold-1.glb'
  };
  
  // Preload models when the component mounts
  useEffect(() => {
    preloadModels(Object.values(MODEL_PATHS));
  }, []);
  
  // Generate instances with positions
  const instances = React.useMemo(() => {
    const items: React.ReactNode[] = [];
    
    // Get hex constants to ensure we're using the same size as the game board
    const { HEX_SIZE } = getHexagonConstants();
    
    // Calculate how many rings we need for our grid
    const gridSize = 40; // Same as in HexagonalTerrain
    const ringCount = Math.ceil(gridSize / 2);
    
    // Function to calculate terrain height based on distance from center
    const getHeightForAxial = (q: number, r: number): number => {
      // Convert to world position - ignore the y component with _
      const [x, , z] = axialToWorld(q, r);
      const distance = Math.sqrt(x * x + z * z);
      
      // Calculate center radius and world radius like in HexagonalTerrain
      const centerRadius = boardRadius * 1.1;
      const worldRadius = gridSize * 1.5;
      
      // Skip if too close to game board
      if (distance <= centerRadius) {
        return 0;
      }
      
      // Height calculation exactly matching HexagonalTerrain
      const heightRatio = Math.min((distance - centerRadius) / (worldRadius - centerRadius), 1);
      const maxHeight = 5; // Match the maxHeight in HexagonalTerrain
      return Math.max(0.1, heightRatio * maxHeight);
    };
    
    // Store positions of tiles used for models to avoid overlaps
    const usedPositions = new Set<string>();
    
    // Function to place a model at a specific axial coordinate
    const placeModelAtAxial = (
      q: number, 
      r: number, 
      type: ModelType, 
      chanceToPlace: number = 0.3
    ) => {
      // Skip if position is already used or by random chance
      const posKey = `${q},${r}`;
      if (usedPositions.has(posKey) || Math.random() > chanceToPlace) {
        return;
      }
      
      // Convert to world position - ignore the y component with _
      const [x, , z] = axialToWorld(q, r);
      
      // Skip if inside board radius
      const distance = Math.sqrt(x * x + z * z);
      const centerRadius = boardRadius * 1.1;
      if (distance <= centerRadius) {
        return;
      }
      
      // Mark position as used
      usedPositions.add(posKey);
      
      // Get height for this position - same calculation as in HexagonalTerrain
      const tileHeight = getHeightForAxial(q, r);
      
      // Set y position to the TOP of the hex tile (tile height + tiny offset)
      const yPos = tileHeight;
      const position: [number, number, number] = [x, yPos, z];
      const rotation: [number, number, number] = [0, Math.random() * Math.PI * 2, 0];
      
      // Scale based on model type
      let scale = 0;
      if (type === 'rock') {
        scale = 0.5 + Math.random() * 0.3;
      } else if (type === 'tree1' || type === 'tree2') {
        scale = 0.7 + Math.random() * 0.4;
      } else if (type === 'bush') {
        scale = 0.4 + Math.random() * 0.3;
      } else if (type === 'goldRock') {
        scale = 0.4 + Math.random() * 0.2;
      }
      
      // Add the appropriate model type
      if (type === 'rock' || type === 'goldRock') {
        items.push(
          <Model 
            key={posKey}
            url={MODEL_PATHS[type]}
            position={position}
            rotation={rotation}
            scale={scale}
            fallback={createFallbackMesh(type)}
          />
        );
      } else if (type === 'tree1' || type === 'tree2' || type === 'bush') {
        items.push(
          <AnimatedModel
            key={posKey}
            type={type}
            url={MODEL_PATHS[type]}
            position={position}
            rotation={rotation}
            scale={scale}
          />
        );
      }
    };
    
    // Generate landscape elements in rings matching the hexagonal terrain
    for (let ring = 0; ring <= ringCount; ring++) {
      // Skip inner rings (game board area)
      if (ring < boardRadius / (HEX_SIZE * 2)) {
        continue;
      }
      
      // For each ring, we start at (-ring, 0) and move around the ring
      let q = -ring;
      let r = 0;

      // Each ring has 6 sides, each with 'ring' tiles
      for (let side = 0; side < 6; side++) {
        // Move 'ring' steps along each side
        for (let step = 0; step < ring; step++) {
          // Skip if this would be inside the center radius
          const [x, , z] = axialToWorld(q, r);
          const distance = Math.sqrt(x * x + z * z);
          const centerRadius = boardRadius * 1.1;
          
          if (distance > centerRadius) {
            // Select a model type based on position and randomness
            const rand = Math.random();
            
            // Different biomes based on sides of the hex
            if (side === 0 || side === 1) {
              // Forest region (more trees)
              if (rand < 0.4) placeModelAtAxial(q, r, 'tree1', 0.35);
              else if (rand < 0.7) placeModelAtAxial(q, r, 'tree2', 0.35);
              else if (rand < 0.9) placeModelAtAxial(q, r, 'bush', 0.3);
              else placeModelAtAxial(q, r, 'rock', 0.2);
            } else if (side === 2 || side === 3) {
              // Rocky region (more rocks)
              if (rand < 0.4) placeModelAtAxial(q, r, 'rock', 0.35);
              else if (rand < 0.6) placeModelAtAxial(q, r, 'bush', 0.3);
              else if (rand < 0.8) placeModelAtAxial(q, r, 'tree1', 0.25);
              else placeModelAtAxial(q, r, 'goldRock', 0.15);
            } else {
              // Mixed region
              if (rand < 0.3) placeModelAtAxial(q, r, 'tree2', 0.3);
              else if (rand < 0.6) placeModelAtAxial(q, r, 'bush', 0.35);
              else if (rand < 0.8) placeModelAtAxial(q, r, 'rock', 0.3);
              else placeModelAtAxial(q, r, 'goldRock', 0.1);
            }
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
    
    return items;
  }, [boardRadius]);
  
  return (
    <>
      {/* Use our updated hexagonal terrain with proper props */}
      <HexagonalTerrain 
        gridSize={40} 
        centerRadius={boardRadius * 1.1}
        maxHeight={5}
      />
      {instances}
    </>
  );
});

// Add display name
LandscapeModels.displayName = 'LandscapeModels';

export default LandscapeModels; 