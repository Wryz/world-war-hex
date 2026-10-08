import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerType } from '@/types/game';
import { OWNER_COLORS } from './UnitMesh';
import { CampIcon } from './icons';
import { usePropLibrary } from './utils/kaykitProps';

interface CampProps {
  // Side holding the camp, or null while it is still neutral
  owner: PlayerType | null;
  // World x/z of the camp hex and the height of its surface
  position: [number, number, number];
  // Hide the floating label (e.g. on the menu's decorative island)
  hideLabel?: boolean;
}

const NEUTRAL_COLOR = '#facc15';
const WOOD = '#a0703f';
const WOOD_DARK = '#7a5230';
const CANVAS = '#f5ecd7';

// Stakes of the palisade around the rim of the tile, with a gap for the gate
const STAKES = Array.from({ length: 14 }, (_, i) => (i / 16) * Math.PI * 2 + Math.PI / 8);

// A small neutral camp: palisade, tent and a banner in the colour of whoever holds it
const CampComponent: React.FC<CampProps> = ({ owner, position, hideLabel = false }) => {
  const flagRef = useRef<THREE.Group>(null);
  const color = owner ? OWNER_COLORS[owner] : NEUTRAL_COLOR;
  const props = usePropLibrary();
  const flag = props?.get(owner === 'player' ? 'flag_blue' : owner === 'ai' ? 'flag_red' : 'flag_yellow');
  const tent = props?.get('tent');
  const crate = props?.get('crate_A_big');
  const barrel = props?.get('barrel');
  const kaykit = flag && tent && crate && barrel ? { flag, tent, crate, barrel } : null;

  useFrame((state) => {
    // Banner flutters in the wind
    if (flagRef.current) {
      const time = state.clock.getElapsedTime();
      flagRef.current.rotation.y = Math.sin(time * 2.2 + position[0]) * 0.25;
    }
  });

  return (
    <group position={position}>
      {/* Palisade */}
      {STAKES.map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.72, 0.14, Math.sin(angle) * 0.72]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 0.28 + (i % 3) * 0.04, 5]} />
          <meshStandardMaterial color={i % 2 ? WOOD : WOOD_DARK} flatShading />
        </mesh>
      ))}

      {kaykit ? (
        // KayKit tents, supplies and a flag in the colour of whoever holds the camp, around the
        // spot where a unit stands
        <>
          <mesh geometry={kaykit.tent.geometry} material={kaykit.tent.material} position={[-0.34, 0, -0.3]} rotation={[0, Math.PI / 4, 0]} scale={0.95} castShadow />
          <mesh geometry={kaykit.tent.geometry} material={kaykit.tent.material} position={[0.36, 0, 0.3]} rotation={[0, -Math.PI / 5, 0]} scale={0.7} castShadow />
          <mesh geometry={kaykit.crate.geometry} material={kaykit.crate.material} position={[0.42, 0, -0.12]} rotation={[0, 0.4, 0]} scale={0.9} castShadow />
          <mesh geometry={kaykit.barrel.geometry} material={kaykit.barrel.material} position={[-0.4, 0, 0.28]} scale={0.9} castShadow />
          <group ref={flagRef} position={[0.3, 0, -0.42]}>
            <mesh geometry={kaykit.flag.geometry} material={kaykit.flag.material} scale={2.4} castShadow />
          </group>
        </>
      ) : (
        <>
      {/* Tent behind the spot where a unit stands */}
        <group position={[-0.32, 0, -0.32]} rotation={[0, Math.PI / 4, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <coneGeometry args={[0.26, 0.44, 4]} />
            <meshStandardMaterial color={CANVAS} flatShading />
          </mesh>
          <mesh position={[0, 0.47, 0]}>
            <coneGeometry args={[0.05, 0.08, 4]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </group>

        {/* Banner pole */}
        <mesh position={[0.38, 0.45, -0.3]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.9, 6]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
        <group ref={flagRef} position={[0.38, 0.78, -0.3]}>
          <mesh position={[0.15, 0, 0]}>
            <boxGeometry args={[0.3, 0.18, 0.012]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} />
          </mesh>
        </group>

        </>
      )}

      {/* Label so camps are easy to spot from far away */}
      {!hideLabel && (
        <Html position={[0, 1.3, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="flex items-center rounded-full p-1 text-[0.8125rem] leading-none shadow select-none"
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: `2px solid ${color}` }}
            title={owner ? (owner === 'player' ? 'Your camp' : 'Enemy camp') : 'Neutral camp'}
          >
            <CampIcon color={color} />
          </div>
        </Html>
      )}
    </group>
  );
};

export const Camp = memo(CampComponent);
