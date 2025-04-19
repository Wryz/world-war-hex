import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { Unit } from '@/types/game';

// Base hex height constant from HexTile.tsx
const BASE_HEIGHT = 0.5;

interface UnitMeshProps {
  unit: Unit;
  position?: [number, number, number];
  hexHeight?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (event: any) => void;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
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
        {unit.type.charAt(0).toUpperCase()}
      </Text>
    </group>
  );
}; 