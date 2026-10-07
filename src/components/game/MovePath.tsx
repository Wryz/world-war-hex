import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface MovePathProps {
  // World positions along the route, from the unit to its destination
  points: THREE.Vector3[];
  color: string;
  // Preview paths (while hovering) are drawn thinner and fainter than confirmed orders
  isPreview?: boolean;
}

const PATH_LIFT = 0.25;

// Dashed route with an arrowhead showing where a unit is going to walk
export const MovePath: React.FC<MovePathProps> = ({ points, color, isPreview = false }) => {
  // drei's Line forwards its ref to the underlying three Line2 object
  const lineRef = useRef<{ material: { dashOffset: number } } | null>(null);

  const lifted = useMemo(
    () => points.map(p => new THREE.Vector3(p.x, p.y + PATH_LIFT, p.z)),
    [points]
  );

  // Arrowhead at the end of the path, pointing along the last segment
  const arrow = useMemo(() => {
    if (lifted.length < 2) return null;
    const end = lifted[lifted.length - 1];
    const before = lifted[lifted.length - 2];
    const direction = new THREE.Vector3().subVectors(end, before).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    return { position: end.clone().addScaledVector(direction, -0.15), quaternion, end };
  }, [lifted]);

  // Marching dashes show the direction of travel
  useFrame((_, delta) => {
    if (lineRef.current) {
      lineRef.current.material.dashOffset -= delta * 0.8;
    }
  });

  if (lifted.length < 2 || !arrow) return null;

  return (
    <group>
      <Line
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={lineRef as any}
        points={lifted}
        color={color}
        lineWidth={isPreview ? 4 : 6}
        dashed
        dashSize={0.25}
        gapSize={0.15}
        transparent
        opacity={isPreview ? 0.7 : 0.95}
        depthTest={false}
        renderOrder={5}
      />
      {/* Destination marker */}
      <mesh position={[arrow.end.x, arrow.end.y - PATH_LIFT + 0.04, arrow.end.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <ringGeometry args={[0.5, 0.68, 6, 1, Math.PI / 6]} />
        <meshBasicMaterial color={color} transparent opacity={isPreview ? 0.5 : 0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={arrow.position} quaternion={arrow.quaternion} renderOrder={5}>
        <coneGeometry args={[0.18, 0.35, 12]} />
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={isPreview ? 0.7 : 1} />
      </mesh>
    </group>
  );
};
