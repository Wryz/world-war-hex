import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Hex, HexCoordinates } from '@/types/game';
import { axialToWorld, getHexSurfaceHeight } from '../utils/boardGeometry';
import { MovePath } from '../MovePath';
import { TargetIcon } from '../icons';
import type { TutorialVisuals } from './TutorialGuide';

// What the first battle's tutorial marks on the board, without a word: a pulsing ring on your
// castle (blue), on the enemy castle (red, with a target over it) and on the hex to tap next (gold),
// and the way across the board traced in gold.

const RING_COLORS = { home: '#3b82f6', target: '#ef4444', tap: '#fbbf24' } as const;

const key = (c: HexCoordinates) => `${c.q},${c.r}`;

const surfaceOf = (hex: Hex | undefined, c: HexCoordinates): THREE.Vector3 => {
  const [x, , z] = axialToWorld(c);
  return new THREE.Vector3(x, hex ? getHexSurfaceHeight(hex) : 1, z);
};

// A ring that swells and fades outward over and over, on top of a steady one
const PulseRing: React.FC<{ at: THREE.Vector3; color: string }> = ({ at, color }) => {
  const pulseRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const pulse = pulseRef.current;
    if (!pulse) return;
    const t = (clock.elapsedTime * 0.9) % 1;
    pulse.scale.setScalar(1 + t * 0.9);
    (pulse.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
  });
  return (
    <group position={[at.x, at.y + 0.09, at.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={2}>
        <ringGeometry args={[0.62, 0.78, 6, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={pulseRef} renderOrder={2}>
        <ringGeometry args={[0.66, 0.74, 6, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export const TutorialMarkers: React.FC<{ visuals: TutorialVisuals; hexByKey: Map<string, Hex> }> = ({ visuals, hexByKey }) => {
  const path = useMemo(
    () => visuals.path?.map(c => surfaceOf(hexByKey.get(key(c)), c)) ?? null,
    [visuals.path, hexByKey]
  );
  const target = visuals.target && surfaceOf(hexByKey.get(key(visuals.target)), visuals.target);
  return (
    <group>
      {visuals.rings.map(ring => (
        <PulseRing key={`${ring.tone}-${key(ring.at)}`} at={surfaceOf(hexByKey.get(key(ring.at)), ring.at)} color={RING_COLORS[ring.tone]} />
      ))}
      {path && path.length > 1 && <MovePath points={path} color="#fbbf24" />}
      {/* The enemy castle: the thing to take */}
      {target && (
        <Html position={[target.x, target.y + 2.6, target.z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <span className="pointer-bob block text-5xl drop-shadow-[0_3px_0_rgba(15,23,42,0.7)]" aria-hidden><TargetIcon /></span>
        </Html>
      )}
    </group>
  );
};
