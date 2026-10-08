import React, { memo, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState, Hex, HexCoordinates } from '@/types/game';
import { axialToWorld, getHexSurfaceHeight } from './utils/boardGeometry';
import { PropModel, usePropLibrary } from './utils/kaykitProps';
import { isStructure } from '@/lib/game/structures';

// The battlefield's objects (see lib/game/battlefield): great trees standing in the forests, the
// trunks of felled ones lying where they fell (toppling over when it has just happened), and fires -
// smouldering embers, then flames and smoke.

// How tall a great tree stands, and how long one takes to fall
const GREAT_TREE_HEIGHT = 2.4;
const FALL_SECONDS = 1.1;

const key = (c: HexCoordinates) => `${c.q},${c.r}`;

const surface = (hex: Hex | undefined, c: HexCoordinates): THREE.Vector3 => {
  const [x, , z] = axialToWorld(c);
  return new THREE.Vector3(x, hex ? getHexSurfaceHeight(hex) : 1, z);
};

// The tree itself: KayKit's tree scaled up to a giant (a simple low-poly one until the models load)
const TreeShape: React.FC<{ model: PropModel | null }> = ({ model }) => {
  // Sized to a giant's height, standing on the ground
  const fit = useMemo(() => {
    if (!model) return null;
    model.geometry.computeBoundingBox();
    const box = model.geometry.boundingBox!;
    const scale = GREAT_TREE_HEIGHT / Math.max(0.01, box.max.y - box.min.y);
    return { scale, lift: -box.min.y * scale };
  }, [model]);
  if (model && fit) {
    return <mesh geometry={model.geometry} material={model.material} scale={fit.scale} position={[0, fit.lift, 0]} castShadow receiveShadow />;
  }
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 1.2, 7]} />
        <meshStandardMaterial color="#7c4a2d" flatShading />
      </mesh>
      {[[1.2, 0.7], [1.65, 0.55], [2.05, 0.36]].map(([y, r]) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#2f7d32" flatShading />
        </mesh>
      ))}
    </group>
  );
};

// A felled trunk lying across the hex it fell onto (`at`), pointing away from where it stood
// (`from`): bark, a couple of snapped branches and its crown crushed on the ground. Over water it
// rests at the height of the bank, as a bridge.
const FallenLog: React.FC<{ from: THREE.Vector3; at: THREE.Vector3; bridge: boolean }> = ({ from, at, bridge }) => {
  const heading = Math.atan2(at.x - from.x, at.z - from.z);
  const y = bridge ? Math.max(from.y, at.y) : at.y;
  return (
    <group position={[at.x, y, at.z]} rotation={[0, heading, 0]}>
      {/* The trunk, lying along the way it fell */}
      <mesh position={[0, 0.17, -0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.19, 1.7, 8]} />
        <meshStandardMaterial color="#7c4a2d" flatShading />
      </mesh>
      {/* Its sawn-off end, pale wood */}
      <mesh position={[0, 0.17, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.02, 8]} />
        <meshStandardMaterial color="#e7c08a" flatShading />
      </mesh>
      {/* Snapped branches */}
      {[[0.22, 0.1, 0.9], [-0.25, -0.2, -0.8]].map(([x, z, turn]) => (
        <mesh key={x} position={[x, 0.24, z]} rotation={[0, turn, Math.PI / 2.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.05, 0.45, 5]} />
          <meshStandardMaterial color="#6b3f26" flatShading />
        </mesh>
      ))}
      {/* The crown, crushed flat at the far end */}
      {[[0, 0.62, 0.42], [0.28, 0.45, 0.3], [-0.26, 0.5, 0.28]].map(([x, z, r]) => (
        <mesh key={`${x},${z}`} position={[x, 0.18, z]} scale={[1, 0.55, 1]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#2f6b2f" flatShading />
        </mesh>
      ))}
    </group>
  );
};

// A great tree, standing - or lying towards `toward` (the hex it fell onto), toppling if `falling`
const GreatTree: React.FC<{
  base: THREE.Vector3;
  model: PropModel | null;
  toward?: THREE.Vector3;
  falling?: boolean;
  bridge?: boolean;
}> = ({ base, model, toward, falling = false, bridge = false }) => {
  const pivotRef = useRef<THREE.Group>(null);
  const progressRef = useRef(falling ? 0 : 1);
  // Once down, it is shown as a log lying across the hex
  const [landed, setLanded] = useState(!falling);
  // Tipping over means turning about the horizontal axis square to the way it falls
  const axis = useMemo(() => {
    if (!toward) return null;
    const direction = new THREE.Vector3(toward.x - base.x, 0, toward.z - base.z).normalize();
    return new THREE.Vector3(direction.z, 0, -direction.x);
  }, [base, toward]);

  useFrame((_, delta) => {
    const pivot = pivotRef.current;
    if (!pivot || !axis) return;
    progressRef.current = Math.min(1, progressRef.current + Math.min(delta, 0.05) / FALL_SECONDS);
    // Slow to start, then crashing down; a lying trunk rests a little short of flat, on its branches
    const t = progressRef.current;
    pivot.quaternion.setFromAxisAngle(axis, t * t * Math.PI * 0.47);
    if (t >= 1 && !landed) setLanded(true);
  });

  if (toward && landed) return <FallenLog from={base} at={toward} bridge={bridge} />;

  return (
    <group position={base}>
      <group ref={pivotRef}>
        <TreeShape model={model} />
      </group>
    </group>
  );
};

// Flames and smoke on a burning hex
const Flames: React.FC<{ at: THREE.Vector3; seed: number }> = ({ at, seed }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tongues = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const angle = seed * 1.7 + i * 2.39;
    const distance = i === 0 ? 0 : 0.25 + ((seed * 7 + i * 13) % 10) / 30;
    return {
      x: Math.cos(angle) * distance, z: Math.sin(angle) * distance,
      height: 0.35 + ((seed + i * 3) % 5) * 0.08, radius: 0.1 + ((seed + i) % 3) * 0.035,
      phase: i * 1.3 + seed, color: i % 2 === 0 ? '#f97316' : '#fbbf24'
    };
  }), [seed]);
  const puffs = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ offset: i / 4, x: ((seed + i * 5) % 7 - 3) * 0.06 })), [seed]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const time = clock.elapsedTime;
    group.children.forEach((child, i) => {
      if (i < tongues.length) {
        const tongue = tongues[i];
        const flicker = 0.75 + 0.35 * Math.sin(time * 9 + tongue.phase) * Math.sin(time * 5.3 + tongue.phase * 2);
        child.scale.set(1, flicker, 1);
        child.position.y = (tongue.height * flicker) / 2;
      } else {
        // Smoke rising and thinning out on a loop
        const puff = puffs[i - tongues.length];
        const t = (time * 0.35 + puff.offset) % 1;
        child.position.set(puff.x + Math.sin(t * 4 + i) * 0.08, 0.6 + t * 1.6, 0);
        child.scale.setScalar(0.18 + t * 0.35);
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t);
      }
    });
  });

  return (
    <group position={at}>
      <group ref={groupRef}>
        {tongues.map((tongue, i) => (
          <mesh key={i} position={[tongue.x, tongue.height / 2, tongue.z]}>
            <coneGeometry args={[tongue.radius, tongue.height, 5]} />
            <meshBasicMaterial color={tongue.color} transparent opacity={0.92} />
          </mesh>
        ))}
        {puffs.map((_, i) => (
          <mesh key={`smoke-${i}`}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#57534e" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 0.5, 0]} color="#fb923c" intensity={2.2} distance={2.6} decay={2} />
    </group>
  );
};

// Glowing embers and a wisp of smoke: this hex catches fire next turn
const Embers: React.FC<{ at: THREE.Vector3; seed: number }> = ({ at, seed }) => {
  const groupRef = useRef<THREE.Group>(null);
  const sparks = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const angle = seed + i * 2.4;
    const distance = 0.1 + ((seed * 3 + i * 7) % 10) / 16;
    return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, phase: i * 0.9 + seed };
  }), [seed]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const time = clock.elapsedTime;
    group.children.forEach((child, i) => {
      if (i < sparks.length) {
        const glow = 0.55 + 0.45 * Math.sin(time * 3 + sparks[i].phase);
        child.scale.setScalar(0.035 + glow * 0.03);
      } else {
        const t = (time * 0.3 + seed * 0.1) % 1;
        child.position.set(Math.sin(t * 5) * 0.05, 0.15 + t * 0.9, 0);
        child.scale.setScalar(0.08 + t * 0.2);
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
      }
    });
  });

  return (
    <group position={at} ref={groupRef}>
      {sparks.map((spark, i) => (
        <mesh key={i} position={[spark.x, 0.03, spark.z]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#fde047' : '#f97316'} />
        </mesh>
      ))}
      <mesh>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#78716c" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
};

// A catapult stone flying in a high arc from the tower to where it lands, then gone
const STONE_SECONDS = 1.1;
const CatapultStone: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; model: PropModel | null }> = ({ from, to, model }) => {
  const ref = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const height = 2.5 + from.distanceTo(to) * 0.25;
  useFrame((_, delta) => {
    const stone = ref.current;
    if (!stone) return;
    progressRef.current = Math.min(1, progressRef.current + Math.min(delta, 0.05) / STONE_SECONDS);
    const t = progressRef.current;
    stone.position.lerpVectors(from, to, t);
    stone.position.y += 1.2 + Math.sin(t * Math.PI) * height - t * 1.2;
    stone.rotation.x += delta * 6;
    stone.visible = t < 1;
  });
  return (
    <group ref={ref} position={from}>
      {model ? <mesh geometry={model.geometry} material={model.material} scale={0.9} castShadow /> : (
        <mesh castShadow>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial color="#78716c" flatShading />
        </mesh>
      )}
    </group>
  );
};

interface BattlefieldObjectsProps {
  hexGrid: Hex[];
  // The most recent felling, which topples over rather than appearing already fallen
  lastFell?: GameState['lastFell'];
  // The catapult's most recent stone, which flies across when it is new
  lastBombard?: GameState['lastBombard'];
  // Hexes hidden in the fog of war (as "q,r" keys), where nothing new is shown; null without fog
  visibleKeys?: Set<string> | null;
}

const BattlefieldObjectsComponent: React.FC<BattlefieldObjectsProps> = ({ hexGrid, lastFell, lastBombard, visibleKeys = null }) => {
  // (the buildings pack holds the stumps and the catapult's stone)
  const hasBuildings = hexGrid.some(hex => isStructure(hex.terrain)) || hexGrid.some(hex => hex.fellFrom);
  const library = usePropLibrary(hasBuildings ? ['medieval', 'buildings'] : ['medieval']);
  const treeModel = library?.get('tree_single_A') ?? null;
  const stumpModel = library?.get('tree_single_A_cut') ?? null;
  const stoneModel = library?.get('projectile_catapult') ?? null;
  const hexByKey = useMemo(() => new Map(hexGrid.map(hex => [key(hex.coordinates), hex])), [hexGrid]);
  // Fellings and stones seen when the board first appeared are shown done; later ones play out
  const firstSerialRef = useRef(lastFell?.serial ?? 0);
  const firstStoneRef = useRef(lastBombard?.serial ?? 0);

  return (
    <group>
      {lastBombard && lastBombard.serial > firstStoneRef.current && (
        <CatapultStone
          key={`stone-${lastBombard.serial}`}
          from={surface(hexByKey.get(key(lastBombard.from)), lastBombard.from).add(new THREE.Vector3(0, 0.9, 0))}
          to={surface(hexByKey.get(key(lastBombard.to)), lastBombard.to)}
          model={stoneModel}
        />
      )}
      {hexGrid.map(hex => {
        const at = surface(hex, hex.coordinates);
        const id = key(hex.coordinates);
        const seed = Math.abs(hex.coordinates.q * 7 + hex.coordinates.r * 13) % 17;
        return (
          <React.Fragment key={id}>
            {hex.feature === 'greatTree' && <GreatTree base={at} model={treeModel} />}
            {/* The stump left where a felled tree stood */}
            {(hex.feature === 'log' || hex.feature === 'logBridge') && hex.fellFrom && stumpModel && (
              <mesh
                geometry={stumpModel.geometry}
                material={stumpModel.material}
                position={surface(hexByKey.get(key(hex.fellFrom)), hex.fellFrom)}
                scale={0.75}
                castShadow
              />
            )}
            {(hex.feature === 'log' || hex.feature === 'logBridge') && hex.fellFrom && (
              <GreatTree
                // A new felling mounts anew so it falls from upright
                key={lastFell && key(lastFell.to) === id ? `fell-${lastFell.serial}` : 'lying'}
                base={surface(hexByKey.get(key(hex.fellFrom)), hex.fellFrom)}
                toward={at}
                model={treeModel}
                falling={!!lastFell && key(lastFell.to) === id && lastFell.serial > firstSerialRef.current}
                bridge={hex.feature === 'logBridge'}
              />
            )}
            {hex.fire?.stage === 'burning' && (!visibleKeys || visibleKeys.has(id)) && <Flames at={at} seed={seed} />}
            {hex.fire?.stage === 'smoulder' && (!visibleKeys || visibleKeys.has(id)) && <Embers at={at} seed={seed} />}
          </React.Fragment>
        );
      })}
    </group>
  );
};

export const BattlefieldObjects = memo(BattlefieldObjectsComponent);
