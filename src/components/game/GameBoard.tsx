import { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { GameState, Hex, HexCoordinates, Unit } from '@/types/game';
import { HexTile, UnitMesh } from './HexTile';

// Constants for hex height calculation (should match those in HexTile.tsx)
const BASE_HEIGHT = 0.5;
const MIN_HEIGHT = 0.1;
const MAX_HEIGHT = 1.0;

const TERRAIN_HEIGHTS: Record<string, number> = {
  mountain: MAX_HEIGHT,
  forest: 0.7,
  plain: 0.5,
  desert: 0.3,
  resource: 0.6,
  water: MIN_HEIGHT
};

// Calculate height for a specific hex based on terrain
const getHexHeight = (hex: Hex): number => {
  const terrainHeight = TERRAIN_HEIGHTS[hex.terrain] || BASE_HEIGHT;
  // Add some randomness for natural look (but keep a seed based on coordinates for consistency)
  const randomSeed = hex.coordinates.q * 1000 + hex.coordinates.r;
  const heightNoise = ((Math.sin(randomSeed) + 1) / 2) * 0.3; // 0-0.3 variation
  return terrainHeight + heightNoise;
};

// Calculate position for a hex using pointy-top orientation
const axialToWorld = (coordinates: HexCoordinates): [number, number, number] => {
  // For pointy-top layout with proper 3D orientation
  // q runs along one diagonal, and r runs along the other diagonal
  const x = 1 * Math.sqrt(3) * (coordinates.q + coordinates.r/2);
  const z = 1 * 3/2 * coordinates.r;
  // Always return y=0 to ensure all hexes sit on the same plane
  return [x, 0, z];
};

interface GameBoardProps {
  gameState: GameState;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unit: Unit) => void;
  selectedHex?: Hex;
  validMoves?: HexCoordinates[];
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  selectedHex,
  validMoves = []
}) => {
  // Set up scene with appropriate lighting and camera
  return (
    <div className="w-full h-full">
      <Canvas shadows>
        {/* Improved lighting for 3D terrain */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {/* Add a secondary light source for better depth perception */}
        <directionalLight
          position={[-8, 10, -8]}
          intensity={0.4}
          color="#b0c4de"
        />
        <BoardScene
          gameState={gameState}
          onHexClick={onHexClick}
          onUnitClick={onUnitClick}
          selectedHex={selectedHex}
          validMoves={validMoves}
        />
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
          target={[0, 0, 0]} // Keep focused on center
          minPolarAngle={Math.PI / 8} // Lock to 45 degrees
          maxPolarAngle={Math.PI / 4} // Lock to 45 degrees
        />
        {/* Fixed camera position looking down at 45 degrees */}
        <PerspectiveCamera 
          makeDefault 
          position={[0, 15, 15]} 
          fov={60}
        />
      </Canvas>
    </div>
  );
};

interface BoardSceneProps {
  gameState: GameState;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unit: Unit) => void;
  selectedHex?: Hex;
  validMoves?: HexCoordinates[];
}

const BoardScene: React.FC<BoardSceneProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  selectedHex,
  validMoves = []
}) => {
  const [hoveredHex, setHoveredHex] = useState<Hex | null>(null);
  
  // Check if a hex is a valid move target
  const isValidMoveTarget = useCallback(
    (hex: Hex) => {
      return validMoves.some(
        coords => coords.q === hex.coordinates.q && coords.r === hex.coordinates.r
      );
    },
    [validMoves]
  );
  
  // Handle hex click
  const handleHexClick = useCallback(
    (hex: Hex) => {
      onHexClick(hex);
    },
    [onHexClick]
  );
  
  // Handle unit click
  const handleUnitClick = useCallback(
    (unit: Unit, event: React.MouseEvent) => {
      event.stopPropagation();
      onUnitClick(unit);
    },
    [onUnitClick]
  );
  
  // Handle mouse over for hexes
  const handleHexPointerOver = useCallback(
    (hex: Hex) => {
      setHoveredHex(hex);
    },
    []
  );
  
  // Handle mouse out for hexes
  const handleHexPointerOut = useCallback(
    () => {
      setHoveredHex(null);
    },
    []
  );
  
  // Calculate if a hex is selected
  const isHexSelected = useCallback(
    (hex: Hex) => {
      if (!selectedHex) return false;
      return hex.coordinates.q === selectedHex.coordinates.q && 
             hex.coordinates.r === selectedHex.coordinates.r;
    },
    [selectedHex]
  );
  
  return (
    <group>
      {/* Render all hexes */}
      {gameState.hexGrid.map(hex => (
        <HexTile
          key={hex.id}
          hex={hex}
          isSelected={isHexSelected(hex)}
          isHighlighted={
            (hoveredHex && hex.id === hoveredHex.id) ||
            isValidMoveTarget(hex)
          }
          onClick={() => handleHexClick(hex)}
          onPointerOver={() => handleHexPointerOver(hex)}
          onPointerOut={handleHexPointerOut}
        />
      ))}
      
      {/* Render all units */}
      {gameState.hexGrid
        .filter(hex => hex.unit)
        .map(hex => {
          // Calculate correct position based on hex height
          const hexHeight = getHexHeight(hex);
          const [x, , z] = axialToWorld(hex.coordinates);
          // Add bevel thickness (should match value in HexTile.tsx)
          const bevelThickness = 0.05;
          const totalHeight = hexHeight + bevelThickness;
          // Position unit on top of hex
          const unitPosition: [number, number, number] = [x, totalHeight + 0.3, z];
          
          return (
            <UnitMesh
              key={hex.unit!.id}
              unit={hex.unit!}
              position={unitPosition}
              hexHeight={hexHeight}
              onClick={(e) => handleUnitClick(hex.unit!, e)}
            />
          );
        })
      }
    </group>
  );
}; 