import { memo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { HexCoordinates, Unit } from '@/types/game';
import {
  getUnitModelAttributes,
  getUnitModelPath,
  getAnimationName,
  AnimationState
} from './utils/UnitModelSystem';
import { instantiateUnitModel, findAnimationClip } from './utils/unitModelCache';
import { getUnitTypeEmoji } from './utils/UnitHelpers';

// Small lift so the unit's indicator doesn't z-fight with the tile surface
const UNIT_ELEVATION = 0.02;
const WALK_SPEED = 2.4; // world units per second
const TURN_SPEED = 8; // how quickly units rotate to face their target
const ANIMATION_FADE_DURATION = 0.3;

export const OWNER_COLORS = {
  player: '#3b82f6',
  ai: '#ef4444'
};

export type CombatRole = 'attacker' | 'defender' | null;

interface UnitMeshProps {
  unit: Unit;
  // Where the unit stands: world x/z of its hex and the height of the tile surface
  position: [number, number, number];
  // World x/z the unit should face while standing still
  facingTarget?: [number, number] | null;
  // World positions (on tile surfaces) a unit walks through to get between two hexes
  computeWalkPath?: (from: HexCoordinates, to: HexCoordinates) => THREE.Vector3[];
  onSelect?: (unit: Unit) => void;
  isPendingPurchase?: boolean;
  isSelected?: boolean;
  hasPlannedMove?: boolean;
  combatRole?: CombatRole;
  // Short labels for terrain effects currently helping this unit
  terrainBadges?: string[];
}

// Smallest signed difference between two angles
const angleDelta = (from: number, to: number) => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

const UnitMeshComponent: React.FC<UnitMeshProps> = ({
  unit,
  position,
  facingTarget = null,
  computeWalkPath,
  onSelect,
  isPendingPurchase = false,
  isSelected = false,
  hasPlannedMove = false,
  combatRole = null,
  terrainBadges = []
}) => {
  const unitModelAttributes = getUnitModelAttributes(unit.type);
  const modelUrl = getUnitModelPath(unit.owner);
  const ownerColor = OWNER_COLORS[unit.owner];

  const rootRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Walking animation along a path of world positions
  const walkRef = useRef<{ points: THREE.Vector3[]; segment: number; progress: number } | null>(null);
  const lastCoordinatesRef = useRef<HexCoordinates>(unit.position);
  const targetPosition = useRef(new THREE.Vector3());
  targetPosition.current.set(position[0], position[1] + UNIT_ELEVATION, position[2]);

  // Facing direction the unit is currently turned towards
  const headingRef = useRef<number | null>(null);

  // Place the unit on mount; afterwards useFrame owns its position so walking isn't interrupted
  useLayoutEffect(() => {
    rootRef.current?.position.copy(targetPosition.current);
  }, []);

  // When the unit's hex changes, walk there instead of teleporting
  useLayoutEffect(() => {
    const last = lastCoordinatesRef.current;
    lastCoordinatesRef.current = unit.position;
    if (last.q === unit.position.q && last.r === unit.position.r) return;

    const points = computeWalkPath?.(last, unit.position) ?? [];
    if (points.length > 1) {
      walkRef.current = { points, segment: 0, progress: 0 };
    }
  }, [unit.position, computeWalkPath]);

  // Load (a clone of) the model once per model URL
  useEffect(() => {
    const container = modelRef.current;
    if (!container) return;

    let cancelled = false;

    instantiateUnitModel(modelUrl)
      .then(({ scene, animations }) => {
        if (cancelled) return;

        scene.scale.setScalar(unitModelAttributes.scale);
        scene.position.set(0, unitModelAttributes.heightOffset, 0);
        container.add(scene);

        mixerRef.current = new THREE.AnimationMixer(scene);
        clipsRef.current = animations;
        setModelLoaded(true);
      })
      .catch(error => {
        console.error(`Error loading model for ${unit.type}:`, error);
      });

    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionRef.current = null;
      clipsRef.current = [];
      container.clear();
      setModelLoaded(false);
    };
  }, [modelUrl, unit.type, unitModelAttributes.scale, unitModelAttributes.heightOffset]);

  // Cross-fade to an animation clip if it isn't already playing
  const playAnimation = (state: AnimationState) => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    const clip = findAnimationClip(clipsRef.current, getAnimationName(unit.type, state));
    if (!clip) return;

    const nextAction = mixer.clipAction(clip);
    if (actionRef.current === nextAction) return;

    actionRef.current?.fadeOut(ANIMATION_FADE_DURATION);
    nextAction.reset().fadeIn(ANIMATION_FADE_DURATION).play();
    actionRef.current = nextAction;
  };

  useFrame((_, rawDelta) => {
    const root = rootRef.current;
    if (!root) return;
    // Avoid huge jumps after the tab was in the background
    const delta = Math.min(rawDelta, 0.1);

    let desiredHeading: number | null = null;
    const walk = walkRef.current;

    if (walk) {
      // Move along the path segment by segment
      let remaining = WALK_SPEED * delta;
      while (remaining > 0 && walk.segment < walk.points.length - 1) {
        const from = walk.points[walk.segment];
        const to = walk.points[walk.segment + 1];
        const length = from.distanceTo(to);
        const left = length * (1 - walk.progress);

        if (remaining >= left) {
          remaining -= left;
          walk.segment += 1;
          walk.progress = 0;
        } else {
          walk.progress += remaining / Math.max(length, 0.0001);
          remaining = 0;
        }
      }

      if (walk.segment >= walk.points.length - 1) {
        walkRef.current = null;
        root.position.copy(targetPosition.current);
      } else {
        const from = walk.points[walk.segment];
        const to = walk.points[walk.segment + 1];
        root.position.lerpVectors(from, to, walk.progress);
        desiredHeading = Math.atan2(to.x - from.x, to.z - from.z);
      }
    } else if (root.position.distanceToSquared(targetPosition.current) > 0.0001) {
      root.position.lerp(targetPosition.current, Math.min(1, delta * 10));
    }

    if (desiredHeading === null && facingTarget) {
      const dx = facingTarget[0] - root.position.x;
      const dz = facingTarget[1] - root.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) desiredHeading = Math.atan2(dx, dz);
    }

    // Turn smoothly towards the desired heading
    if (modelRef.current && desiredHeading !== null) {
      if (headingRef.current === null) headingRef.current = desiredHeading;
      headingRef.current += angleDelta(headingRef.current, desiredHeading) * Math.min(1, delta * TURN_SPEED);
      modelRef.current.rotation.y = headingRef.current + unitModelAttributes.rotationOffset;
    }

    // Pick the animation for what the unit is doing right now
    if (walkRef.current) playAnimation('walk');
    else if (combatRole === 'attacker') playAnimation('attack');
    else if (combatRole === 'defender' || isPendingPurchase) playAnimation('holdShield');
    else playAnimation('idle');

    mixerRef.current?.update(delta);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onSelect) return;
    e.stopPropagation();
    onSelect(unit);
  };

  const healthRatio = unit.maxLifespan > 0 ? unit.lifespan / unit.maxLifespan : 1;
  const healthColor = healthRatio > 0.6 ? '#22c55e' : healthRatio > 0.3 ? '#eab308' : '#ef4444';

  return (
    <group
      ref={rootRef}
      onClick={onSelect ? handleClick : undefined}
    >
      {/* Invisible click area */}
      {onSelect && (
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 1.2, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* The 3D model is loaded into this group */}
      <group ref={modelRef} visible={modelLoaded} />

      {/* Simple placeholder while the model is loading (no external assets so it can't suspend the scene) */}
      {!modelLoaded && (
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
          <meshStandardMaterial color={ownerColor} />
        </mesh>
      )}

      {/* Owner ring so it's always clear which side a unit belongs to */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, isSelected ? 0.62 : 0.54, 32]} />
        <meshBasicMaterial
          color={isSelected ? '#facc15' : ownerColor}
          transparent
          opacity={isPendingPurchase ? 0.5 : 0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Compact unit label: type, health and terrain bonuses */}
      <Html
        position={[0, 1.9, 0]}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold text-white whitespace-nowrap shadow select-none"
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: `2px solid ${ownerColor}`,
            opacity: isPendingPurchase ? 0.7 : 1
          }}
        >
          <span>{getUnitTypeEmoji(unit.type)}</span>
          {isPendingPurchase ? (
            <span title="Arrives at the end of the turn">⏳</span>
          ) : (
            <>
              <span className="w-6 h-1.5 rounded-full bg-slate-600 overflow-hidden inline-block">
                <span className="block h-full" style={{ width: `${healthRatio * 100}%`, background: healthColor }} />
              </span>
              {/* Terrain bonuses as icons only - details are in the selection card */}
              {terrainBadges.map(badge => <span key={badge}>{badge.split(' ')[0]}</span>)}
              {hasPlannedMove && <span>➜</span>}
            </>
          )}
        </div>
      </Html>
    </group>
  );
};

export const UnitMesh = memo(UnitMeshComponent);
