import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerType } from '@/types/game';
import { OWNER_COLORS } from './UnitMesh';

interface CastleProps {
  owner: PlayerType;
  // World x/z of the base hex and the height of its surface
  position: [number, number, number];
  health: number;
  maxHealth: number;
}

const STONE = '#cfc6b8';
const STONE_DARK = '#a39a8c';
const GOLD = '#ffcc33';

// A floating golden crown marking whose castle this is
const Crown: React.FC<{ gemColor: string }> = ({ gemColor }) => {
  const spikes = 5;
  return (
    <group>
      {/* Band */}
      <mesh>
        <cylinderGeometry args={[0.32, 0.28, 0.2, 20, 1, true]} />
        <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.25} emissive="#b8860b" emissiveIntensity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: spikes }, (_, i) => {
        const angle = (i / spikes) * Math.PI * 2;
        const x = Math.cos(angle) * 0.3;
        const z = Math.sin(angle) * 0.3;
        return (
          <group key={i} position={[x, 0.18, z]}>
            <mesh>
              <coneGeometry args={[0.08, 0.2, 4]} />
              <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.25} emissive="#b8860b" emissiveIntensity={0.35} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
      {/* Gems in the owner's colour */}
      {Array.from({ length: spikes }, (_, i) => {
        const angle = ((i + 0.5) / spikes) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.31, 0, Math.sin(angle) * 0.31]}>
            <octahedronGeometry args={[0.05]} />
            <meshStandardMaterial color={gemColor} emissive={gemColor} emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
};

const CastleComponent: React.FC<CastleProps> = ({ owner, position, health, maxHealth }) => {
  const crownRef = useRef<THREE.Group>(null);
  const ownerColor = OWNER_COLORS[owner];
  const healthRatio = maxHealth > 0 ? Math.max(0, health) / maxHealth : 0;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';

  useFrame((state) => {
    if (crownRef.current) {
      const time = state.clock.getElapsedTime();
      crownRef.current.rotation.y = time * 0.6;
      crownRef.current.position.y = 1.75 + Math.sin(time * 1.5) * 0.08;
    }
  });

  const towerAngles = [0, 1, 2, 3, 4, 5].map(i => (i / 6) * Math.PI * 2 + Math.PI / 6);

  return (
    <group position={position}>
      {/* Keep */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.9, 6]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {/* Battlements */}
      {towerAngles.map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.38, 0.98, Math.sin(angle) * 0.38]} castShadow>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshStandardMaterial color={STONE_DARK} flatShading />
        </mesh>
      ))}
      {/* Roof in the owner's colour */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.32, 0.4, 6]} />
        <meshStandardMaterial color={ownerColor} flatShading />
      </mesh>
      {/* Flag */}
      <mesh position={[0.22, 1.35, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0.36, 1.5, 0]}>
        <boxGeometry args={[0.26, 0.16, 0.01]} />
        <meshStandardMaterial color={ownerColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Crown */}
      <group ref={crownRef} position={[0, 1.75, 0]}>
        <Crown gemColor={ownerColor} />
      </group>

      {/* Castle health */}
      <Html position={[0, 2.35, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none font-bold text-white whitespace-nowrap shadow select-none"
          style={{ background: 'rgba(15, 23, 42, 0.85)', border: `2px solid ${ownerColor}` }}
        >
          <span>👑 {owner === 'player' ? 'Your castle' : 'Enemy castle'}</span>
          <span className="w-10 h-1.5 rounded-full bg-slate-600 overflow-hidden inline-block">
            <span className="block h-full" style={{ width: `${healthRatio * 100}%`, background: healthColor }} />
          </span>
          <span>{health}</span>
        </div>
      </Html>
    </group>
  );
};

export const Castle = memo(CastleComponent);
