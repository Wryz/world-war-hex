import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerType } from '@/types/game';
import { OWNER_COLORS } from './UnitMesh';
import { CrownIcon } from './icons';
import { getTimeScale } from './effects/effects';

interface CastleProps {
  owner: PlayerType;
  // World x/z of the base hex and the height of its surface
  position: [number, number, number];
  health: number;
  maxHealth: number;
  // Hide the health label (e.g. on the menu's decorative island)
  hideLabel?: boolean;
  // The castle has fallen: it crumbles in a cloud of rubble
  fallen?: boolean;
}


const STONE = '#cfc6b8';
const STONE_DARK = '#a39a8c';
const GOLD = '#ffcc33';

// Seconds the collapse takes, and how long a hit makes the castle shudder
const COLLAPSE_DURATION = 1.8;
const HIT_DURATION = 0.45;
const DEBRIS_COUNT = 14;
const DUST_COUNT = 7;

const debrisGeometry = new THREE.BoxGeometry(0.14, 0.12, 0.14);
const debrisMaterial = new THREE.MeshStandardMaterial({ color: STONE_DARK, flatShading: true });
const dustGeometry = new THREE.IcosahedronGeometry(0.3, 0);
const dustMaterial = new THREE.MeshStandardMaterial({ color: '#e7e1d6', transparent: true, opacity: 0.8, flatShading: true });

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

const CastleComponent: React.FC<CastleProps> = ({ owner, position, health, maxHealth, hideLabel = false, fallen = false }) => {
  const crownRef = useRef<THREE.Group>(null);
  const structureRef = useRef<THREE.Group>(null);
  const debrisRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  // Time since the last hit and since the collapse began (null when not happening)
  const hitRef = useRef<number | null>(null);
  const collapseRef = useRef<number | null>(null);
  const previousHealthRef = useRef(health);

  // Each piece of rubble flies off in its own direction
  const debrisVelocities = useMemo(() => Array.from({ length: DEBRIS_COUNT }, (_, i) => {
    const angle = (i / DEBRIS_COUNT) * Math.PI * 2 + (i % 3) * 0.4;
    const speed = 1.2 + (i % 4) * 0.45;
    return new THREE.Vector3(Math.cos(angle) * speed, 2.2 + (i % 5) * 0.5, Math.sin(angle) * speed);
  }), []);

  useEffect(() => {
    if (health < previousHealthRef.current) hitRef.current = 0;
    previousHealthRef.current = health;
  }, [health]);

  useEffect(() => {
    if (fallen && collapseRef.current === null) collapseRef.current = 0;
    if (!fallen) collapseRef.current = null;
  }, [fallen]);
  const ownerColor = OWNER_COLORS[owner];
  const healthRatio = maxHealth > 0 ? Math.max(0, health) / maxHealth : 0;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1) * getTimeScale();
    const time = state.clock.getElapsedTime();
    const structure = structureRef.current;

    // A hit makes the castle shudder
    let wobble = 0;
    if (hitRef.current !== null) {
      hitRef.current += delta;
      const left = 1 - hitRef.current / HIT_DURATION;
      if (left <= 0) hitRef.current = null;
      else wobble = Math.sin(hitRef.current * 60) * 0.06 * left;
    }

    const collapse = collapseRef.current;
    if (collapse !== null) collapseRef.current = collapse + delta;
    const progress = collapse === null ? 0 : Math.min(1, collapse / COLLAPSE_DURATION);
    // Ease in: it holds for a moment, then gives way
    const fall = progress * progress;

    if (structure) {
      structure.rotation.z = wobble + fall * 0.55;
      structure.rotation.x = fall * 0.25;
      structure.position.y = -fall * 0.95;
      structure.scale.y = 1 - fall * 0.45;
    }

    if (crownRef.current) {
      if (collapse === null) {
        crownRef.current.rotation.y = time * 0.6;
        crownRef.current.position.y = 1.75 + Math.sin(time * 1.5) * 0.08;
        crownRef.current.rotation.z = 0;
      } else {
        // The crown tumbles to the ground
        crownRef.current.rotation.y += delta * 6;
        crownRef.current.rotation.z = progress * 1.4;
        crownRef.current.position.y = Math.max(0.15, 1.75 - fall * 2);
        crownRef.current.position.x = progress * 0.7;
      }
    }

    // Rubble arcs out and settles; dust billows and fades
    const debris = debrisRef.current;
    if (debris) {
      debris.visible = collapse !== null && collapse < COLLAPSE_DURATION + 1.5;
      if (debris.visible && collapse !== null) {
        const t = Math.min(collapse, 1.4);
        debris.children.forEach((piece, i) => {
          const v = debrisVelocities[i];
          piece.position.set(v.x * t, Math.max(0.06, 0.6 + v.y * t - 4.9 * t * t), v.z * t);
          piece.rotation.set(t * 5 + i, t * 3, t * 4);
        });
      }
    }
    const dust = dustRef.current;
    if (dust) {
      dust.visible = collapse !== null && collapse < 2.4;
      if (dust.visible && collapse !== null) {
        const t = Math.min(collapse / 2.4, 1);
        dust.children.forEach((puff, i) => {
          const angle = (i / DUST_COUNT) * Math.PI * 2;
          puff.position.set(Math.cos(angle) * (0.3 + t * 1.1), 0.2 + t * 0.5, Math.sin(angle) * (0.3 + t * 1.1));
          puff.scale.setScalar(0.6 + t * 1.8);
        });
        dustMaterial.opacity = 0.8 * (1 - t);
      }
    }
  });

  const towerAngles = [0, 1, 2, 3, 4, 5].map(i => (i / 6) * Math.PI * 2 + Math.PI / 6);

  return (
    <group position={position}>
      <group ref={structureRef}>
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
      </group>

      {/* Rubble and dust when the castle falls */}
      <group ref={debrisRef} visible={false}>
        {Array.from({ length: DEBRIS_COUNT }, (_, i) => (
          <mesh key={i} geometry={debrisGeometry} material={debrisMaterial} castShadow />
        ))}
      </group>
      <group ref={dustRef} visible={false}>
        {Array.from({ length: DUST_COUNT }, (_, i) => (
          <mesh key={i} geometry={dustGeometry} material={dustMaterial} />
        ))}
      </group>

      {/* Crown */}
      <group ref={crownRef} position={[0, 1.75, 0]}>
        <Crown gemColor={ownerColor} />
      </group>

      {/* Castle health */}
      {!hideLabel && !fallen && (
        <Html position={[0, 2.35, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none font-bold text-white whitespace-nowrap shadow select-none"
            style={{ background: 'rgba(15, 23, 42, 0.85)', border: `2px solid ${ownerColor}` }}
          >
            <CrownIcon />
            <span className="w-10 h-1.5 rounded-full bg-slate-600 overflow-hidden inline-block">
              <span className="block h-full" style={{ width: `${healthRatio * 100}%`, background: healthColor }} />
            </span>
            <span>{health}</span>
          </div>
        </Html>
      )}
    </group>
  );
};

export const Castle = memo(CastleComponent);
