import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Hex, HexCoordinates, TerrainType, Unit } from '@/types/game';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

// Hex geometry
const HEX_SIZE = 1;
// Base hex height is 5 units, with variations based on terrain
const BASE_HEIGHT = 0.5;
const MIN_HEIGHT = 0.1;
const MAX_HEIGHT = 1.0;
const BASE_MAX_HEALTH = 50; // Base max health constant

// Terrain heights - scale these to make more dramatic landscape
const TERRAIN_HEIGHTS: Record<TerrainType, number> = {
  mountain: MAX_HEIGHT,
  forest: 0.7,
  plain: 0.5,
  desert: 0.3,
  resource: 0.6,
  water: MIN_HEIGHT
};

// Coordinate converter for pointy-top hexagons - y is up in Three.js
const axialToWorld = (coordinates: HexCoordinates): [number, number, number] => {
  // For pointy-top layout with proper 3D orientation
  // q runs along one diagonal, and r runs along the other diagonal
  const x = HEX_SIZE * Math.sqrt(3) * (coordinates.q + coordinates.r/2);
  const z = HEX_SIZE * 3/2 * coordinates.r;
  // Always return y=0 to ensure all hexes sit on the same plane
  return [x, 0, z];
};

// Terrain type colors
const TERRAIN_COLORS: Record<TerrainType, string> = {
  plain: '#8bc34a',    // Brighter green for plains
  mountain: '#a0a0a0', // Lighter gray for mountains
  forest: '#2e7d32',   // Darker green for forests
  water: '#4fc3f7',    // Brighter blue for water
  desert: '#ffd54f',   // Brighter yellow for desert
  resource: '#ffb74d'  // Brighter orange for resources
};

interface HexTileProps {
  hex: Hex;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onContextMenu?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

export const HexTile: React.FC<HexTileProps> = ({
  hex,
  isSelected = false,
  isHighlighted = false,
  isHovered = false,
  onClick,
  onContextMenu,
  onPointerOver,
  onPointerOut
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const topFaceRef = useRef<THREE.Mesh>(null);
  
  // Get terrain-based height
  const terrainHeight = TERRAIN_HEIGHTS[hex.terrain] || BASE_HEIGHT;
  
  // Add some randomness for natural look (but keep a seed based on coordinates for consistency)
  const randomSeed = hex.coordinates.q * 1000 + hex.coordinates.r;
  const heightNoise = ((Math.sin(randomSeed) + 1) / 2) * 0.3; // 0-0.3 variation
  const hexHeight = terrainHeight + heightNoise;
  
  // Position hex in world - always on the ground plane (y=0)
  const [x, , z] = axialToWorld(hex.coordinates);
  
  // Create the hex geometry with points facing up/down
  const geometry = useMemo(() => {
    // Create a flat regular hexagon shape with points facing up/down
    const shape = new THREE.Shape();
    const vertices = [];
    
    // Start at the top point and go clockwise - for pointy top hexes
    for (let i = 0; i < 6; i++) {
      // Start with top point (Math.PI/2 is up in the XZ plane)
      const angle = (Math.PI / 3) * i + Math.PI/2;
      vertices.push(new THREE.Vector2(
        HEX_SIZE * Math.cos(angle),
        HEX_SIZE * Math.sin(angle)
      ));
    }
    
    shape.moveTo(vertices[0].x, vertices[0].y);
    
    for (let i = 1; i < 6; i++) {
      shape.lineTo(vertices[i].x, vertices[i].y);
    }
    
    shape.lineTo(vertices[0].x, vertices[0].y);
    
    // Fixed bevel settings to ensure consistent bottom alignment
    const bevelThickness = 0.05;
    const bevelSize = 0.05;
    
    // For the extrude, we'll create the shape in the XY plane
    // Three.js will extrude along the Y axis, but we'll rotate it later
    const extrudeSettings = {
      steps: 1,
      depth: hexHeight,
      bevelEnabled: true,
      bevelThickness,
      bevelSize,
      bevelOffset: 0,
      bevelSegments: 3
    };
    
    // Create geometry and rotate it to get pointy-top hexes facing up in 3D space
    const hexGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Rotate the geometry so that the hexes are facing up with points at top and bottom
    // We need to rotate around the X axis to get the hex to face up in 3D space
    hexGeometry.rotateX(-Math.PI / 2);
    
    // By default, ExtrudeGeometry places the base shape at y=0 and extrudes upward.
    // After rotation, this means the bottom of the shape is at y=-bevelThickness
    // and we need to translate it up to have the bottom exactly at y=0
    hexGeometry.translate(0, bevelThickness, 0);
    
    return hexGeometry;
  }, [hexHeight]);
  
  // Determine material color based on terrain and selection state
  const color = useMemo(() => {
    const baseColor = TERRAIN_COLORS[hex.terrain];
    
    if (isSelected) {
      return new THREE.Color(baseColor).offsetHSL(0, 0, 0.2);
    }
    
    if (isHighlighted || isHovered) {
      // More noticeable color change on hover - brighter and slightly saturated
      return new THREE.Color(baseColor).offsetHSL(0, 0.1, 0.15);
    }
    
    return new THREE.Color(baseColor);
  }, [hex.terrain, isSelected, isHighlighted, isHovered]);
  
  // Add a darker color for the sides
  const sideColor = useMemo(() => {
    if (isHovered) {
      // Brighter sides when hovered
      return new THREE.Color(TERRAIN_COLORS[hex.terrain]).offsetHSL(0, 0.05, 0);
    }
    return new THREE.Color(TERRAIN_COLORS[hex.terrain]).offsetHSL(0, 0, -0.1);
  }, [hex.terrain, isHovered]);
  
  // Apply gentle hover animation and handle hover detection
  useFrame(() => {
    if (meshRef.current) {
      // Handle elevation animation when highlighted or hovered
      const currentY = meshRef.current.position.y;
      
      // More noticeable elevation change on hover
      const targetY = isHovered ? 0.15 : isHighlighted ? 0.08 : 0;
      
      // Faster transition when hovering (0.2) than when returning to normal (0.1)
      const lerpFactor = isHovered ? 0.2 : 0.1;
      
      meshRef.current.position.y = THREE.MathUtils.lerp(currentY, targetY, lerpFactor);
      
      // Update top face reference for hover detection
      if (topFaceRef.current) {
        // Set top face position to follow the main mesh
        topFaceRef.current.position.y = meshRef.current.position.y + hexHeight;
      }
    }
  });
  
  // Create an invisible mesh for the top face of the hex
  // This will be used for hover detection
  const hexTopShape = useMemo(() => {
    const shape = new THREE.Shape();
    const vertices = [];
    
    // Create pointy-top hexagon shape
    for (let i = 0; i < 6; i++) {
      // Start with top point (Math.PI/2 is up in the XZ plane)
      const angle = (Math.PI / 3) * i + Math.PI/2;
      vertices.push(new THREE.Vector2(
        // Make the hover detection area slightly larger (110%) for better user experience
        HEX_SIZE * 1.05 * Math.cos(angle),
        HEX_SIZE * 1.05 * Math.sin(angle)
      ));
    }
    
    shape.moveTo(vertices[0].x, vertices[0].y);
    
    for (let i = 1; i < 6; i++) {
      shape.lineTo(vertices[i].x, vertices[i].y);
    }
    
    shape.lineTo(vertices[0].x, vertices[0].y);
    
    return shape;
  }, []);
  
  // Calculate the total height including bevel
  const bevelThickness = 0.05;
  const totalHeight = hexHeight + bevelThickness;
  
  return (
    <group position={[x, 0, z]}>
      {/* Main hex tile - positioned with bottom at y=0 as adjusted in the geometry */}
      <mesh 
        ref={meshRef}
        position={[0, 0, 0]}
        geometry={geometry}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {/* We'll use separate materials for top and sides for better visuals */}
        <meshStandardMaterial 
          attach="material-0" // Top face
          color={color} 
          roughness={0.8}
          metalness={0.2}
          flatShading={true}
        />
        <meshStandardMaterial 
          attach="material-1" // Side faces
          color={sideColor} 
          roughness={0.9}
          metalness={0.1}
          flatShading={true}
        />
      </mesh>
      
      {/* Invisible top face mesh for hover detection - positioned exactly at the top surface */}
      <mesh 
        ref={topFaceRef}
        position={[0, totalHeight - 0.03, 0]} /* Position it right at the top surface */
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <shapeGeometry args={[hexTopShape]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Base indicator - position at the top of the hex */}
      {hex.isBase && (
        <group position={[0, totalHeight + 0.3, 0]}>
          <mesh>
            <cylinderGeometry args={[0.8, 0.8, 0.3, 6]} />
            <meshStandardMaterial 
              color={hex.owner === 'player' ? '#2196f3' : '#f44336'} 
              emissive={hex.owner === 'player' ? '#1976d2' : '#d32f2f'}
              emissiveIntensity={0.5}
            />
          </mesh>
          
          {/* Base health bar - positioned above the base for better visibility */}
          {hex.baseHealth !== undefined && (
            <group position={[0, 0.5, 0]}>
              {/* Health bar background */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.5, 0.2, 0.1]} />
                <meshBasicMaterial color="#444444" />
              </mesh>
              {/* Health bar fill */}
              <mesh 
                position={[(hex.baseHealth / BASE_MAX_HEALTH - 1) * 0.75, 0, 0.05]} 
                scale={[hex.baseHealth / BASE_MAX_HEALTH, 1, 1]}
              >
                <boxGeometry args={[1.5, 0.2, 0.05]} />
                <meshBasicMaterial 
                  color={
                    hex.baseHealth / BASE_MAX_HEALTH > 0.6 
                      ? '#4caf50' 
                      : hex.baseHealth / BASE_MAX_HEALTH > 0.3 
                        ? '#ff9800' 
                        : '#f44336'
                  } 
                />
              </mesh>
              {/* Health text */}
              <Text 
                position={[0, 0.2, 0]} 
                fontSize={0.2}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                {`${hex.baseHealth}/${BASE_MAX_HEALTH}`}
              </Text>
            </group>
          )}
        </group>
      )}
      
      {/* Resource indicator - position at the top of the hex */}
      {hex.isResourceHex && (
        <group position={[0, totalHeight + 0.1, 0]}>
          <mesh>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial 
              color="#ffd700" 
              metalness={0.7} 
              roughness={0.3}
            />
          </mesh>
          <Text 
            position={[0, 0.3, 0]} 
            fontSize={0.3}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            {hex.resourceValue}
          </Text>
        </group>
      )}
      
      {/* Coordinates for debugging (can be removed in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Text 
          position={[0, totalHeight + 0.01, 0]} 
          fontSize={0.2}
          color="black"
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, 0]} // Text faces up
        >
          {`${hex.coordinates.q},${hex.coordinates.r}`}
        </Text>
      )}
    </group>
  );
};

// Unit representation on the hex tile
interface UnitMeshProps {
  unit: Unit;
  position?: [number, number, number];
  hexHeight?: number;
  onClick?: (event: React.MouseEvent) => void;
}

export const UnitMesh: React.FC<UnitMeshProps> = ({
  unit,
  position,
  hexHeight = BASE_HEIGHT,
  onClick
}) => {
  // Find hex terrain to determine height
  const terrainHeight = hexHeight || BASE_HEIGHT;
  const defaultPosition: [number, number, number] = [0, terrainHeight + 0.3, 0];
  const unitPosition = position || defaultPosition;
  
  // Add invisible click area that's larger than the unit
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick(e);
  };
  
  // Different unit type geometries
  const unitGeometry = useMemo(() => {
    switch (unit.type) {
      case 'infantry':
        return (
          <mesh>
            <cylinderGeometry args={[0.2, 0.3, 0.5, 4]} />
            <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
          </mesh>
        );
      case 'tank':
        return (
          <mesh>
            <boxGeometry args={[0.5, 0.3, 0.7]} />
            <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
          </mesh>
        );
      case 'artillery':
        return (
          <mesh>
            <cylinderGeometry args={[0.2, 0.4, 0.6, 8]} />
            <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
          </mesh>
        );
      case 'helicopter':
        return (
          <group>
            <mesh>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
              <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
            </mesh>
          </group>
        );
      case 'medic':
        return (
          <group>
            <mesh>
              <cylinderGeometry args={[0.25, 0.25, 0.4, 8]} />
              <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.15, 0.5, 0.15]} />
              <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
            </mesh>
          </group>
        );
      default:
        return (
          <mesh>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color={unit.owner === 'player' ? '#2196f3' : '#f44336'} />
          </mesh>
        );
    }
  }, [unit.type, unit.owner]);
  
  const unitColor = unit.owner === 'player' ? '#2196f3' : '#f44336';
  
  // Health indicator
  const healthPercentage = unit.lifespan / unit.maxLifespan;
  
  return (
    <group position={unitPosition} onClick={handleClick}>
      {/* Invisible click area */}
      <mesh visible={false}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Unit model */}
      {unitGeometry}
      
      {/* Health bar - positioned above the unit */}
      <group position={[0, 0.4, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 0.1, 0.1]} />
          <meshBasicMaterial color="#444444" />
        </mesh>
        <mesh 
          position={[(healthPercentage - 1) * 0.3, 0, 0.05]} 
          scale={[healthPercentage, 1, 1]}
        >
          <boxGeometry args={[0.6, 0.1, 0.05]} />
          <meshBasicMaterial 
            color={healthPercentage > 0.6 ? '#4caf50' : healthPercentage > 0.3 ? '#ff9800' : '#f44336'} 
          />
        </mesh>
      </group>
      
      {/* Unit type indicator */}
      <Text 
        position={[0, 0.6, 0]} 
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        <meshBasicMaterial color={unitColor} />
        {unit.type.charAt(0).toUpperCase()}
      </Text>
    </group>
  );
}; 