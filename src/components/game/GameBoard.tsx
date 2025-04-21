import { useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { GameState, Hex, HexCoordinates, Unit, UnitType } from '@/types/game';
import { HexTile } from './HexTile';
import { UnitMesh } from './UnitMesh';
import LandscapeModels from './landscape/LandscapeModels';
import SkyDome from './environment/Sky';
import Clouds from './environment/Clouds';
import Fog from './environment/Fog';
import { Html } from '@react-three/drei';
import { DEFAULT_SETTINGS, UNITS } from '@/lib/game/gameState';
import { useLoadingManager } from './utils/LoadingManager';
import { AnimatedUnitPreview } from './AnimatedUnitPreview';
import { playSound } from './utils/SoundPlayer';

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
  onUnitPurchase: (unitType: UnitType) => boolean;
  selectedHex?: Hex;
  validMoves?: HexCoordinates[];
  gameStarted: boolean;
  isAITurn: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  onUnitPurchase,
  selectedHex,
  validMoves = [],
  gameStarted,
  isAITurn
}) => {
  // Use loading state from the parent provider
  const { isComplete: assetsLoaded } = useLoadingManager();
  
  // Extract selectedUnitTypeForPurchase from gameState if available
  const selectedUnitTypeForPurchase = gameState.selectedUnitTypeForPurchase || null;

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
            onUnitPurchase={onUnitPurchase}
            selectedHex={selectedHex}
            validMoves={validMoves}
            assetsLoaded={assetsLoaded}
            gameStarted={gameStarted}
            selectedUnitTypeForPurchase={selectedUnitTypeForPurchase}
            isAITurn={isAITurn}
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
  onUnitPurchase: (unitType: UnitType) => boolean;
  selectedHex?: Hex;
  validMoves?: HexCoordinates[];
  assetsLoaded: boolean;
  gameStarted: boolean;
  selectedUnitTypeForPurchase?: UnitType | null;
  isAITurn: boolean;
}

const BoardScene: React.FC<BoardSceneProps> = ({
  gameState,
  onHexClick,
  onUnitClick,
  onUnitPurchase,
  selectedHex,
  validMoves = [],
  assetsLoaded,
  gameStarted,
  selectedUnitTypeForPurchase,
  isAITurn
}) => {
  const [hoveredHex, setHoveredHex] = useState<Hex | null>(null);
  const [baseSelectionConfirmMode, setBaseSelectionConfirmMode] = useState<boolean>(false);
  const [placedUnitHex, setPlacedUnitHex] = useState<Hex | null>(null);
  const [originalUnitHex, setOriginalUnitHex] = useState<Hex | null>(null);
  const [targetMoveHex, setTargetMoveHex] = useState<Hex | null>(null);
  
  // Create refs for our callback functions to solve circular dependencies
  const handleHexDoubleClickRef = useRef<(hex: Hex) => void>(() => {});
  
  // Store the currently selected unit from the selectedHex
  const selectedUnit = selectedHex?.unit || null;
  
  // Clear placedUnitHex when selectedUnitTypeForPurchase becomes null or phase changes
  useEffect(() => {
    if (!selectedUnitTypeForPurchase || gameState.currentPhase !== 'planning') {
      setPlacedUnitHex(null);
    }
  }, [selectedUnitTypeForPurchase, gameState.currentPhase]);
  
  // Clear original and target positions when game phase changes or no unit is selected
  useEffect(() => {
    if (gameState.currentPhase !== 'planning') {
      setOriginalUnitHex(null);
      setTargetMoveHex(null);
    } else if (!selectedUnit) {
      // Only clear original unit hex when no unit is selected
      setOriginalUnitHex(null);
      // Don't clear target move hex here - it will be handled in handleHexClick and handleUnitClick
    }
  }, [gameState.currentPhase, selectedUnit]);
  
  // Determine if we're in setup phase
  const isSetupPhase = gameState.currentPhase === 'setup';
  
  // Identify valid base placement hexes (edge hexes that are not water, mountain, or resource)
  const validBasePlacementHexes = useMemo(() => {
    if (!isSetupPhase) return [];
    
    const gridSize = DEFAULT_SETTINGS.gridSize;
    return gameState.hexGrid.filter(hex => {
      // Check if it's an edge hex
      const isEdgeHex = Math.abs(hex.coordinates.q) === gridSize || 
                        Math.abs(hex.coordinates.r) === gridSize ||
                        Math.abs(hex.coordinates.q + hex.coordinates.r) === gridSize;
                        
      // Check if it's a valid terrain type (not water, mountain, or resource)
      const isValidTerrain = hex.terrain !== 'water' && 
                            hex.terrain !== 'mountain' && 
                            !hex.isResourceHex;
      
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
  
  // Check if a hex is a valid setup tile
  const isValidSetupTile = useCallback(
    (hex: Hex) => {
      if (!isSetupPhase) return false;
      
      return validBasePlacementHexes.some(
        validHex => validHex.coordinates.q === hex.coordinates.q && 
                   validHex.coordinates.r === hex.coordinates.r
      );
    },
    [isSetupPhase, validBasePlacementHexes]
  );
  
  // Check if a hovered hex is a valid placement target for a unit from barracks
  const isValidUnitPlacement = useCallback(
    (hex: Hex | null) => {
      if (!hex || !selectedUnitTypeForPurchase) return false;
      
      // Check if the hex already has a unit or is a base
      if (hex.unit || hex.isBase) return false;
      
      // Check if terrain is valid (not water or mountain)
      if (hex.terrain === 'water' || hex.terrain === 'mountain') return false;
      
      // Check if it's in our valid moves list
      return validMoves.some(
        coords => coords.q === hex.coordinates.q && coords.r === hex.coordinates.r
      );
    },
    [validMoves, selectedUnitTypeForPurchase]
  );
  
  // Handle double click for confirming unit placement - defined first
  const handleHexDoubleClick = useCallback(
    (hex: Hex) => {
      // Only proceed if assets are loaded and we're in planning phase
      if (!assetsLoaded || gameState.currentPhase !== 'planning') {
        console.log('Double click ignored - assets not loaded or not in planning phase');
        return;
      }
      
      console.log('Double click detected on hex:', hex.coordinates, 'Selected unit type:', selectedUnitTypeForPurchase);
      
      // Simplified condition: If we have a unit type selected and we're on a valid hex, try to purchase
      if (selectedUnitTypeForPurchase && isValidUnitPlacement(hex)) {
        console.log('Attempting to purchase unit:', selectedUnitTypeForPurchase);
        
        // Try to purchase the unit
        const purchaseSuccess = onUnitPurchase(selectedUnitTypeForPurchase);
        
        if (purchaseSuccess) {
          console.log('Purchase successful');
          
          // Play confirmation sound
          playSound('hex-select-sound', 0.5);
          
          // Clear the placed unit hex and reset UI state
          setPlacedUnitHex(null);
          
          // Defensive code: force clear hoveredHex if it's the same as the one we just placed on
          if (hoveredHex && 
              hoveredHex.coordinates.q === hex.coordinates.q && 
              hoveredHex.coordinates.r === hex.coordinates.r) {
            setHoveredHex(null);
          }
        } else {
          console.log('Purchase failed - insufficient resources or invalid placement');
        }
      } else {
        console.log('Double click ignored - invalid hex for unit placement:', 
          'selectedUnitTypeForPurchase:', selectedUnitTypeForPurchase,
          'isValidPlacement:', isValidUnitPlacement(hex),
          'placedUnitHex:', placedUnitHex?.coordinates
        );
      }
    },
    [
      assetsLoaded, 
      gameState.currentPhase, 
      selectedUnitTypeForPurchase, 
      placedUnitHex, 
      onUnitPurchase,
      isValidUnitPlacement,
      hoveredHex
    ]
  );
  
  // Update the ref after the function is defined
  useEffect(() => {
    handleHexDoubleClickRef.current = handleHexDoubleClick;
  }, [handleHexDoubleClick]);
  
  // Handle unit click
  const handleUnitClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (unit: Unit, event: any) => {
      if (!assetsLoaded) return;
      event.stopPropagation();
      
      // Find the hex containing this unit
      const unitHex = gameState.hexGrid.find(h => 
        h.unit && h.unit.id === unit.id
      );
      
      if (unitHex) {
        // Set this as the original unit position
        setOriginalUnitHex(unitHex);
        
        // Check if this unit already has a pending move
        const pendingMove = gameState.pendingMoves.find(move => move.unitId === unit.id);
        if (pendingMove) {
          // Find the target hex from the pending move
          const targetHex = gameState.hexGrid.find(h => 
            h.coordinates.q === pendingMove.to.q && 
            h.coordinates.r === pendingMove.to.r
          );
          
          // If found, set it as the target move hex
          if (targetHex) {
            setTargetMoveHex(targetHex);
          } else {
            // Clear target move hex if no pending move is found
            setTargetMoveHex(null);
          }
        } else {
          // Clear target move hex if no pending move is found
          setTargetMoveHex(null);
        }
      }
      
      onUnitClick(unit);
    },
    [onUnitClick, assetsLoaded, gameState.hexGrid, gameState.pendingMoves]
  );
  
  // Handle mouse over for hexes
  const handleHexPointerOver = useCallback(
    (hex: Hex) => {
      if (!assetsLoaded) return;
      setHoveredHex(hex);
    },
    [assetsLoaded]
  );
  
  // Handle mouse out for hexes
  const handleHexPointerOut = useCallback(
    (hex: Hex) => {
      if (!assetsLoaded) return;
      // Only clear if this hex is the currently hovered one
      if (hoveredHex && 
          hoveredHex.coordinates.q === hex.coordinates.q && 
          hoveredHex.coordinates.r === hex.coordinates.r) {
        setHoveredHex(null);
      }
    },
    [hoveredHex, assetsLoaded]
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

  // Handle hex click - using the ref to avoid circular dependency
  const handleHexClick = useCallback(
    (hex: Hex) => {
      // Only proceed if assets are loaded
      if (!assetsLoaded) return;
      
      // Check if we have a selected unit and this hex is a valid move target
      if (selectedUnit && 
          validMoves.some(coords => coords.q === hex.coordinates.q && coords.r === hex.coordinates.r)) {
        // This is a valid move target, set it
        setTargetMoveHex(hex);
        
        // Call the parent onClick handler to handle the actual move
        onHexClick(hex);
        return;
      } else if (!hex.unit && (!selectedHex || !selectedHex.unit)) {
        // Only clear target move hex if we're clicking on an empty hex and don't have a unit selected
        // This prevents clearing the target when clicking elsewhere in the UI
        setTargetMoveHex(null);
      }
      
      // Check if placing a unit from barracks
      if (selectedUnitTypeForPurchase && isValidUnitPlacement(hex)) {
        console.log('Valid placement location for unit:', selectedUnitTypeForPurchase);
        
        // If clicking on the already placed unit hex, treat as confirmation (double-click alternative)
        if (placedUnitHex && 
            placedUnitHex.coordinates.q === hex.coordinates.q && 
            placedUnitHex.coordinates.r === hex.coordinates.r) {
          console.log('Click on already placed unit hex - treating as confirmation');
          handleHexDoubleClickRef.current(hex);
          return;
        }
        
        // Otherwise, set the placedUnitHex for a new placement
        setPlacedUnitHex(hex);
        
        // And explicitly set this hex as selected
        // Call the parent onClick handler
        onHexClick(hex);
        return;
      }
        
      // Handle other clicks (not unit placement)
      onHexClick(hex);
      
      // Update the confirmation mode state based on the current state
      if (isSetupPhase) {
        // If clicking a valid hex, enter confirmation mode
        const isHexValid = isValidSetupTile(hex);
        
        // If we already have a selected hex and we're clicking it again, 
        // this will be a confirmation handled by the parent
        if (selectedHex && 
            selectedHex.coordinates.q === hex.coordinates.q && 
            selectedHex.coordinates.r === hex.coordinates.r) {
          // After confirmation, exit confirmation mode
          setBaseSelectionConfirmMode(false);
        } else {
          // Initial selection - enter confirmation mode if it's a valid hex
          setBaseSelectionConfirmMode(isHexValid);
        }
      }
    },
    [
      onHexClick, 
      isSetupPhase, 
      selectedHex, 
      isValidSetupTile, 
      assetsLoaded, 
      selectedUnitTypeForPurchase, 
      isValidUnitPlacement, 
      placedUnitHex,
      validMoves,
      selectedUnit
    ]
  );
  
  // Reset confirmation mode when exiting setup phase
  useEffect(() => {
    if (!isSetupPhase) {
      setBaseSelectionConfirmMode(false);
    }
  }, [isSetupPhase]);
  
  // Determine if a hex is the target position for a unit move
  const isTargetMovePosition = useCallback(
    (hex: Hex) => {
      // Check if we have a direct target move hex
      if (targetMoveHex && 
          hex.coordinates.q === targetMoveHex.coordinates.q && 
          hex.coordinates.r === targetMoveHex.coordinates.r) {
        return true;
      }

      // Also check if this hex is a pending move destination for the selected unit
      if (selectedUnit) {
        return gameState.pendingMoves.some(
          move => move.unitId === selectedUnit.id && 
                 move.to.q === hex.coordinates.q && 
                 move.to.r === hex.coordinates.r
        );
      }
      
      return false;
    },
    [targetMoveHex, selectedUnit, gameState.pendingMoves]
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
      
      {/* Hex grid and units */}
      {gameState.hexGrid.map(hex => {
        // Check if this hex is a destination for a pending move
        const isPendingMoveDest = gameState.pendingMoves.some(
          move => move.to.q === hex.coordinates.q && move.to.r === hex.coordinates.r
        );

        return (
          <HexTile
            key={hex.id}
            hex={hex}
            isSelected={isHexSelected(hex)}
            isHighlighted={isValidMoveTarget(hex)}
            isHovered={isHexHovered(hex)}
            isSetupPhase={isSetupPhase}
            isValidSetupTile={isValidSetupTile(hex)}
            isBaseSelectionConfirmMode={baseSelectionConfirmMode && isHexSelected(hex)}
            isPendingMoveDestination={isPendingMoveDest}
            isTargetMovePosition={isTargetMovePosition(hex)}
            onClick={() => assetsLoaded && handleHexClick(hex)}
            onDoubleClick={() => assetsLoaded && handleHexDoubleClick(hex)}
            onPointerOver={() => assetsLoaded && handleHexPointerOver(hex)}
            onPointerOut={() => assetsLoaded && handleHexPointerOut(hex)}
          />
        );
      })}
      
      {/* Unit preview for barracks selection - only show when hovering over valid placement hex */}
      {assetsLoaded && 
       selectedUnitTypeForPurchase && 
       hoveredHex && 
       isValidUnitPlacement(hoveredHex) && 
       (!placedUnitHex || 
         (placedUnitHex.coordinates.q !== hoveredHex.coordinates.q || 
          placedUnitHex.coordinates.r !== hoveredHex.coordinates.r)
       ) && (
        <AnimatedUnitPreview
          unitType={selectedUnitTypeForPurchase}
          position={axialToWorld(hoveredHex.coordinates)}
          hexHeight={getHexHeight(hoveredHex)}
          isPlaced={false}
        />
      )}
      
      {/* Placed unit with idle animation */}
      {assetsLoaded && 
       gameState.currentPhase === 'planning' && 
       selectedUnitTypeForPurchase && 
       placedUnitHex && (
        <>
          <AnimatedUnitPreview
            unitType={selectedUnitTypeForPurchase}
            position={axialToWorld(placedUnitHex.coordinates)}
            hexHeight={getHexHeight(placedUnitHex)}
            isPlaced={true}
            isConfirmed={false}
          />
        </>
      )}
      
      {/* Check for pending unit purchases and display them */}
      {assetsLoaded && gameState.pendingPurchases
        .filter(purchase => purchase.playerId === 'player')
        .map((purchase, index) => {
          // Find the hex at this position
          const hex = gameState.hexGrid.find(
            h => h.coordinates.q === purchase.position.q && h.coordinates.r === purchase.position.r
          );
          
          if (!hex) return null;
          
          // Create a temporary unit object for the purchase
          const tempUnit: Unit = {
            id: `pending-${purchase.unitType}-${index}`,
            type: purchase.unitType,
            owner: 'player',
            position: purchase.position,
            movementRange: UNITS[purchase.unitType]?.movementRange || 2,
            attackPower: UNITS[purchase.unitType]?.attackPower || 1,
            lifespan: UNITS[purchase.unitType]?.lifespan || 5,
            maxLifespan: UNITS[purchase.unitType]?.maxLifespan || 5,
            cost: UNITS[purchase.unitType]?.cost || 10,
            abilities: UNITS[purchase.unitType]?.abilities || [],
            hasMoved: false,
            isEngagedInCombat: false
          };
          
          return (
            <UnitMesh
              key={`pending-unit-${purchase.position.q}-${purchase.position.r}-${index}`}
              unit={tempUnit}
              position={axialToWorld(purchase.position)}
              hexHeight={getHexHeight(hex)}
              isPendingPurchase={true}
            />
          );
        })
      }
      
      {/* Units on the board - only show when assets are loaded */}
      {assetsLoaded && gameState.hexGrid
        .filter((hex: Hex) => hex.unit)
        .map((hex: Hex) => {
          if (!hex.unit) return null;
          
          // Create a unique key by combining unit.id with position coordinates
          const uniqueKey = `${hex.unit.id}-${hex.coordinates.q}-${hex.coordinates.r}`;
          
          // Get the position for this unit
          const unitPosition = hex.coordinates;
          
          // Check if this unit is moving (has a pending move)
          const isMoving = gameState.pendingMoves.some(move => 
            move.unitId === hex.unit!.id
          );
          
          return (
            <UnitMesh
              key={uniqueKey}
              unit={hex.unit}
              position={axialToWorld(unitPosition)}
              hexHeight={getHexHeight(hex)}
              onClick={(e) => handleUnitClick(hex.unit!, e)}
              isMoving={isMoving}
            />
          );
        })
      }
      
      {/* Planned move indicators - arrows pointing from unit current position to destination */}
      {assetsLoaded && 
       gameState.currentPhase === 'planning' && 
       !isAITurn &&
       gameState.pendingMoves
         .filter(move => gameState.players.player.units.some(unit => unit.id === move.unitId))
         .map(move => {
           // Find the unit and its current hex
           const unit = gameState.players.player.units.find(u => u.id === move.unitId);
           if (!unit) return null;
           
           // Find the hex for the unit's current position
           const fromHex = gameState.hexGrid.find(h => 
             h.coordinates.q === unit.position.q && 
             h.coordinates.r === unit.position.r
           );
           
           // Find the destination hex
           const toHex = gameState.hexGrid.find(h => 
             h.coordinates.q === move.to.q && 
             h.coordinates.r === move.to.r
           );
           
           if (!fromHex || !toHex) return null;
           
           // Calculate positions for the destination
           const [toX, , toZ] = axialToWorld(move.to);
           
           return (
             <group key={`move-indicator-${move.unitId}`}>
               {/* Arrow pointing to destination */}
               <mesh 
                 position={[toX, getHexHeight(toHex) + 1.2, toZ]}
                 rotation={[Math.PI / 2, 0, 0]}
               >
                 <cylinderGeometry args={[0.2, 0.2, 0.1, 8]} />
                 <meshStandardMaterial color="#FFD700" emissive="#FFA500" emissiveIntensity={0.7} />
               </mesh>
             </group>
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
            {isTargetMovePosition(hoveredHex) && originalUnitHex?.unit && (
              <div className="mt-1 text-blue-300">
                Next {originalUnitHex.unit.type} location
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