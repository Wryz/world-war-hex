import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, Hex, HexCoordinates, Unit } from '@/types/game';
import { getBossPower } from '@/lib/game/bosses';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';
import { BOSS_POWER_COLORS, BossPowerIcon } from './icons';
import { getTimeScale } from './effects/effects';

// Bosses' powers on the board: the ground a boss has marked to strike glows red and pulses, with the
// power's icon over it, through the turn the enemy has to get clear; and when a power is used, each
// hex it hits (or where minions appear) flares in the power's colour.

const key = (c: HexCoordinates) => `${c.q},${c.r}`;
const surfaceOf = (hex: Hex | undefined, c: HexCoordinates): THREE.Vector3 => {
  const [x, , z] = axialToWorld(c);
  return new THREE.Vector3(x, hex ? getHexSurfaceHeight(hex) : 1, z);
};

const DANGER = '#ef4444';

// One marked hex: a red glow that breathes, inside a red rim
const MarkedHex: React.FC<{ at: THREE.Vector3 }> = ({ at }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const glow = glowRef.current;
    if (!glow) return;
    (glow.material as THREE.MeshBasicMaterial).opacity = 0.28 + 0.2 * Math.sin(clock.elapsedTime * 4);
  });
  return (
    <group position={[at.x, at.y + 0.07, at.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={glowRef} renderOrder={2}>
        <circleGeometry args={[0.8, 6]} />
        <meshBasicMaterial color={DANGER} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh renderOrder={2}>
        <ringGeometry args={[0.74, 0.86, 6, 1]} />
        <meshBasicMaterial color={DANGER} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export const BossThreats: React.FC<{ units: Unit[]; hexByKey: Map<string, Hex> }> = ({ units, hexByKey }) => (
  <group>
    {units.filter(unit => unit.threat && unit.threat.length > 0).map(boss => {
      const power = getBossPower(boss.type);
      const spots = boss.threat!.map(c => surfaceOf(hexByKey.get(key(c)), c));
      const middle = spots.reduce((sum, spot) => sum.add(spot), new THREE.Vector3()).divideScalar(spots.length);
      const top = Math.max(...spots.map(spot => spot.y));
      return (
        <group key={boss.id}>
          {spots.map((spot, i) => <MarkedHex key={i} at={spot} />)}
          {power && (
            <Html position={[middle.x, top + 1.5, middle.z]} center zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
              <span className="pointer-bob flex h-12 w-12 items-center justify-center rounded-full bg-red-600/85 text-3xl ring-2 ring-red-200 shadow-[0_0_18px_#ef4444]" aria-hidden>
                <BossPowerIcon power={power.id} color="#fff" />
              </span>
            </Html>
          )}
        </group>
      );
    })}
  </group>
);

// One hex flaring as a power hits it: a flash, a ring racing outwards and sparks thrown up
export const BURST_SECONDS = 1.1;
// A breath sweeps out along its line, hex after hex
export const BREATH_SWEEP = 0.12;
const SPARKS = 7;
const Burst: React.FC<{ at: THREE.Vector3; color: string; delay: number }> = ({ at, color, delay }) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(-delay);
  const sparks = useMemo(() => Array.from({ length: SPARKS }, (_, i) => ({
    angle: (i / SPARKS) * Math.PI * 2 + Math.random() * 0.5, speed: 0.6 + Math.random() * 0.6, lift: 1.4 + Math.random()
  })), []);
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    timeRef.current += Math.min(delta, 0.1) * getTimeScale();
    const t = timeRef.current / BURST_SECONDS;
    group.visible = t > 0 && t < 1;
    if (!group.visible) return;
    const [flash, ring, ...rest] = group.children as THREE.Mesh[];
    flash.scale.setScalar(0.4 + t * 0.6);
    (flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    ring.scale.setScalar(0.3 + t * 1.3);
    (ring.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    rest.forEach((spark, i) => {
      const { angle, speed, lift } = sparks[i];
      spark.position.set(Math.cos(angle) * speed * t, lift * t - 1.6 * t * t + 0.1, Math.sin(angle) * speed * t);
      spark.scale.setScalar(0.09 * (1 - t) + 0.02);
    });
  });
  return (
    <group ref={groupRef} position={[at.x, at.y + 0.1, at.z]} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <circleGeometry args={[0.8, 6]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.7, 0.85, 24, 1]} />
        <meshBasicMaterial color="#ffffff" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {sparks.map((_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={i % 2 === 0 ? color : '#fef3c7'} />
        </mesh>
      ))}
    </group>
  );
};

export const BossPowerBursts: React.FC<{ last: GameState['lastBossPower']; hexByKey: Map<string, Hex> }> = ({ last, hexByKey }) => {
  // A power used before the board appeared isn't replayed
  const firstSerialRef = useRef(last?.serial ?? 0);
  if (!last || last.serial <= firstSerialRef.current) return null;
  const color = BOSS_POWER_COLORS[last.power];
  // A breath sweeps out along its line; everything else lands at once
  const sweep = last.power === 'dragonBreath' ? BREATH_SWEEP : 0;
  return (
    <group key={last.serial}>
      {last.hexes.map((c, i) => <Burst key={i} at={surfaceOf(hexByKey.get(key(c)), c)} color={color} delay={i * sweep} />)}
    </group>
  );
};
