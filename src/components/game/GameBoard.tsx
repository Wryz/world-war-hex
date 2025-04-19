import { useState, useCallback, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { GameState, Hex, HexCoordinates, Unit } from '@/types/game';
import { HexTile, UnitMesh } from './HexTile';
import LandscapeModels from './landscape/LandscapeModels';
import SkyDome from './environment/Sky';
import Clouds from './environment/Clouds';
import Fog from './environment/Fog';
import { Html } from '@react-three/drei';
import { DEFAULT_SETTINGS } from '@/lib/game/gameState';
import { useLoadingManager } from './utils/LoadingManager';

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
  gameStarted: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  selectedHex,
  validMoves = [],
  gameStarted
}) => {
  // Use loading state from the parent provider
  const { isComplete: assetsLoaded } = useLoadingManager();

  // Set up scene with appropriate lighting and camera
  return (
    <div className="w-full h-full">
      <Canvas shadows>
        {/* Wrap all 3D elements in Suspense */}
        <Suspense fallback={null}>
          {/* Sky background - always visible */}
          <SkyDome />
          
          {/* Basic lighting that's always available */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={0.6} />

          {/* Game board scene with interactive elements */}
          <BoardScene
            gameState={gameState}
            onHexClick={onHexClick}
            onUnitClick={onUnitClick}
            selectedHex={selectedHex}
            validMoves={validMoves}
            assetsLoaded={assetsLoaded}
            gameStarted={gameStarted}
          />
          
          {/* Camera controls */}
          <OrbitControls 
            enablePan={false}
            enableZoom={true}  // Allow zooming for better exploration
            enableRotate={true}
            target={[0, 0, 0]} // Keep focused on center
            minPolarAngle={Math.PI / 10} // Allow slightly more top-down view
            maxPolarAngle={Math.PI / 3}  // Allow more angled view to see the terrain
            minDistance={20}             // Prevent zooming in too close
            maxDistance={60}             // Prevent zooming out too far
          />
          
          {/* Fixed camera position looking down at a slightly higher angle */}
          <PerspectiveCamera 
            makeDefault 
            position={[5, 20, 20]} 
            fov={65}
          />
        </Suspense>
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
  assetsLoaded: boolean;
  gameStarted: boolean;
}

const BoardScene: React.FC<BoardSceneProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  selectedHex,
  validMoves = [],
  assetsLoaded,
  gameStarted
}) => {
  const [hoveredHex, setHoveredHex] = useState<Hex | null>(null);
  
  // Determine if we're in setup phase
  const isSetupPhase = gameState.currentPhase === 'setup';
  
  // Identify valid base placement hexes (edge hexes that are not water or resource)
  const validBasePlacementHexes = useMemo(() => {
    if (!isSetupPhase) return [];
    
    const gridSize = DEFAULT_SETTINGS.gridSize;
    return gameState.hexGrid.filter(hex => {
      // Check if it's an edge hex
      const isEdgeHex = Math.abs(hex.coordinates.q) === gridSize || 
                        Math.abs(hex.coordinates.r) === gridSize ||
                        Math.abs(hex.coordinates.q + hex.coordinates.r) === gridSize;
                        
      // Check if it's a valid terrain type
      const isValidTerrain = hex.terrain !== 'water' && !hex.isResourceHex;
      
      return isEdgeHex && isValidTerrain;
    });
  }, [isSetupPhase, gameState.hexGrid]);
  
  // Check if a hex is a valid move target
  const isValidMoveTarget = useCallback(
    (hex: Hex) => {
      // During setup phase, highlight valid base placement hexes
      if (isSetupPhase) {
        return validBasePlacementHexes.some(
          validHex => validHex.coordinates.q === hex.coordinates.q && 
                     validHex.coordinates.r === hex.coordinates.r
        );
      }
      
      // Otherwise show valid movement targets
      return validMoves.some(
        coords => coords.q === hex.coordinates.q && coords.r === hex.coordinates.r
      );
    },
    [validMoves, isSetupPhase, validBasePlacementHexes]
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
    (hex: Hex) => {
      // Only clear if this hex is the currently hovered one
      if (hoveredHex && 
          hoveredHex.coordinates.q === hex.coordinates.q && 
          hoveredHex.coordinates.r === hex.coordinates.r) {
        setHoveredHex(null);
      }
    },
    [hoveredHex]
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
  
  // Check if a hex is currently hovered
  const isHexHovered = useCallback(
    (hex: Hex) => {
      if (!hoveredHex) return false;
      return hex.coordinates.q === hoveredHex.coordinates.q && 
             hex.coordinates.r === hoveredHex.coordinates.r;
    },
    [hoveredHex]
  );

  return (
    <>
      {/* Environment elements */}
      {gameStarted && assetsLoaded && <Clouds count={15} height={100} />}
      {assetsLoaded && <Fog color="#e6f7ff" near={80} far={150} />}
      
      {/* Improved lighting */}
      {assetsLoaded && (
        <>
          <ambientLight intensity={0.8} /> 
          <directionalLight
            position={[20, 25, 10]}
            intensity={1.3}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={150}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
            color="#fffaf0"
          />
          <directionalLight
            position={[-15, 10, -15]}
            intensity={0.7}
            color="#e6f7ff"
          />
        </>
      )}
      
      {/* Landscape terrain */}
      {gameStarted && assetsLoaded && <LandscapeModels boardRadius={15} />}
      
      {/* Game hex grid - always render but only make it interactive when assets are loaded */}
      {gameState.hexGrid.map((hex: Hex) => (
        <HexTile
          key={`${hex.coordinates.q},${hex.coordinates.r}`}
          hex={hex}
          isSelected={isHexSelected(hex)}
          isHighlighted={isValidMoveTarget(hex)}
          isHovered={isHexHovered(hex)} 
          onClick={() => assetsLoaded && handleHexClick(hex)}
          onPointerOver={() => assetsLoaded && handleHexPointerOver(hex)}
          onPointerOut={() => assetsLoaded && handleHexPointerOut(hex)}
        />
      ))}
      
      {/* Units on the board - only show when assets are loaded */}
      {assetsLoaded && gameState.hexGrid
        .filter((hex: Hex) => hex.unit)
        .map((hex: Hex) => {
          if (!hex.unit) return null;
          
          return (
            <UnitMesh
              key={hex.unit.id}
              unit={hex.unit}
              position={axialToWorld(hex.coordinates)}
              hexHeight={getHexHeight(hex)}
              onClick={(e) => handleUnitClick(hex.unit!, e)}
            />
          );
        })}
      
      {/* Hover info - only show when assets are loaded */}
      {assetsLoaded && hoveredHex && (
        <Html position={axialToWorld(hoveredHex.coordinates)} style={{ pointerEvents: 'none' }}>
          <div
            className="bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs pointer-events-none"
            style={{
              textAlign: 'center',
            }}
          >
            <div>{hoveredHex.terrain.charAt(0).toUpperCase() + hoveredHex.terrain.slice(1)}</div>
            {hoveredHex.unit && (
              <div className="mt-1">
                {hoveredHex.unit.type} ({hoveredHex.unit.owner})
              </div>
            )}
            {hoveredHex.isBase && (
              <div className="mt-1">
                Base ({hoveredHex.owner || 'Neutral'})
              </div>
            )}
          </div>
        </Html>
      )}
    </>
  );
}; 