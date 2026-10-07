import { memo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { HexCoordinates, Unit } from '@/types/game';
import {
  ATTACK_INTERVALS,
  getUnitLook,
  getAnimationName,
  AnimationState
} from './utils/UnitModelSystem';
import { playBattleSound, BattleSound } from './utils/battleSounds';
import { DRAG_CLICK_TOLERANCE } from './HexTile';
import { instantiateUnitModel, findAnimationClip, disposeUnitModel } from './utils/unitModelCache';
import { ArrowIcon, AttackIcon, GoldIcon, TerrainIcon, UnitIcon, WaitIcon } from './icons';

// Small lift so the unit's indicator doesn't z-fight with the tile surface
const UNIT_ELEVATION = 0.02;
// Owner ring height above the unit's base: clear of hovered tiles, which rise slightly
const RING_HEIGHT = 0.05;
const WALK_SPEED = 2.4; // world units per second
const TURN_SPEED = 8; // how quickly units rotate to face their target
const ANIMATION_FADE_DURATION = 0.3;
// How far melee units step towards their target on each strike
const LUNGE_DISTANCE = 0.4;
// Seconds a bolt or spell takes to reach its target, and the height it is shot from
const ARROW_FLIGHT_TIME = 0.35;
const PROJECTILE_HEIGHT = 0.6;

// Small per-unit delay so units in the same battle don't strike in lockstep
const strikeOffset = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 1000) / 1000 * 0.35;
};

export const OWNER_COLORS = {
  player: '#3b82f6',
  ai: '#ef4444'
};

// The fight a unit is taking part in right now, if any
export interface UnitBattle {
  // Changes for every new battle so the animation restarts
  key: string;
  // World position (on the tile surface) of the enemy this unit strikes at, or null if it can't reach any
  target: [number, number, number] | null;
}

// Terrain effects shown on a unit's label: cover, an attack bonus (Pikemen in forest, high ground),
// being exposed in a swamp, healing at a spring, a held gold mine
export type UnitBadge = 'cover' | 'attack' | 'exposed' | 'heal' | 'gold';

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
  battle?: UnitBattle | null;
  // Short labels for terrain effects currently helping this unit
  terrainBadges?: UnitBadge[];
  // Decorative use (e.g. the menu's island): no label and no battle sounds
  decorative?: boolean;
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
  battle = null,
  terrainBadges = [],
  decorative = false
}) => {
  const look = getUnitLook(unit.type);
  const ownerColor = OWNER_COLORS[unit.owner];

  const rootRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  // Horse under a mounted unit, galloping while the unit walks
  const mountRef = useRef<{ mixer: THREE.AnimationMixer; gallop: THREE.AnimationAction } | null>(null);
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

  // Load (a clone of) the model for this unit type and side
  useEffect(() => {
    const container = modelRef.current;
    if (!container) return;

    let cancelled = false;
    let loadedScene: THREE.Group | null = null;

    instantiateUnitModel(unit.type, unit.owner)
      .then(({ scene, animations, mount }) => {
        if (cancelled) {
          disposeUnitModel(scene);
          return;
        }
        loadedScene = scene;

        scene.scale.setScalar(look.scale);
        container.add(scene);

        mixerRef.current = new THREE.AnimationMixer(scene);
        mountRef.current = mount ?? null;
        clipsRef.current = animations;
        setModelLoaded(true);
      })
      .catch(error => {
        console.error(`Error loading model for ${unit.type}:`, error);
      });

    return () => {
      cancelled = true;
      if (loadedScene) disposeUnitModel(loadedScene, mixerRef.current);
      mountRef.current?.mixer.stopAllAction();
      mountRef.current = null;
      mixerRef.current = null;
      actionRef.current = null;
      clipsRef.current = [];
      container.clear();
      setModelLoaded(false);
    };
  }, [unit.type, unit.owner, look.scale]);

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

  const playSfx = (sound: BattleSound, volume: number) => {
    if (!decorative) playBattleSound(sound, volume);
  };

  const isRanged = unit.abilities.includes('rangedAttack');
  const projectile = look.projectile ?? 'arrow';
  const attackInterval = ATTACK_INTERVALS[unit.type];
  const arrowRef = useRef<THREE.Group>(null);
  // When the current battle started (clock time) and which strike was last played
  const battleClockRef = useRef<{ key: string; start: number; lastStrike: number; lastImpact: number } | null>(null);
  const targetVector = useRef(new THREE.Vector3());
  // Scratch vector reused every frame for the arrow's flight
  const arrowOffset = useRef(new THREE.Vector3());

  // Play one strike of the attack animation, sped up to fit the unit's attack interval
  const strike = () => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const clip = findAnimationClip(clipsRef.current, getAnimationName(unit.type, 'attack'));
    if (!clip) return;

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    if (actionRef.current && actionRef.current !== action) actionRef.current.fadeOut(0.1);
    action.reset().setEffectiveTimeScale(Math.max(1, clip.duration / (attackInterval * 0.8))).fadeIn(0.05).play();
    actionRef.current = action;
  };

  useFrame((frameState, rawDelta) => {
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

    // Battle: strike at the target on this unit's own cadence
    let lunge = 0;
    let isStriking = false;
    const arrow = arrowRef.current;
    if (arrow) arrow.visible = false;

    if (battle && !walkRef.current) {
      const now = frameState.clock.getElapsedTime();
      if (battleClockRef.current?.key !== battle.key) {
        battleClockRef.current = { key: battle.key, start: now + strikeOffset(unit.id), lastStrike: -1, lastImpact: -1 };
      }
      const clock = battleClockRef.current;
      const elapsed = now - clock.start;

      if (battle.target && elapsed >= 0) {
        const [tx, ty, tz] = battle.target;
        targetVector.current.set(tx, ty, tz);
        desiredHeading = Math.atan2(tx - root.position.x, tz - root.position.z);

        const strikeNumber = Math.floor(elapsed / attackInterval);
        const sinceStrike = elapsed - strikeNumber * attackInterval;
        const progress = sinceStrike / attackInterval;

        if (strikeNumber !== clock.lastStrike) {
          clock.lastStrike = strikeNumber;
          strike();
          if (isRanged) playSfx(projectile === 'magic' ? 'spellCast' : 'bowShot', 0.8);
        }

        if (isRanged) {
          // The bolt (or spell) flies from the shooter to the target in an arc, once the shot is released
          const flightStart = attackInterval * 0.3;
          if (sinceStrike >= flightStart && sinceStrike < flightStart + ARROW_FLIGHT_TIME && arrow) {
            const flight = (sinceStrike - flightStart) / ARROW_FLIGHT_TIME;
            const arc = projectile === 'magic' ? 0.3 : 0.6;
            const local = arrowOffset.current.copy(targetVector.current).sub(root.position);
            arrow.visible = true;
            arrow.position.set(local.x * flight, PROJECTILE_HEIGHT + local.y * flight + Math.sin(flight * Math.PI) * arc, local.z * flight);
            const ahead = Math.min(1, flight + 0.05);
            arrow.lookAt(
              root.position.x + local.x * ahead,
              root.position.y + PROJECTILE_HEIGHT + local.y * ahead + Math.sin(ahead * Math.PI) * arc,
              root.position.z + local.z * ahead
            );
          } else if (sinceStrike >= flightStart + ARROW_FLIGHT_TIME && strikeNumber !== clock.lastImpact) {
            clock.lastImpact = strikeNumber;
            playSfx(projectile === 'magic' ? 'spellHit' : 'arrowHit', 0.7);
          }
          isStriking = progress < 0.6;
        } else {
          // Step in, strike, step back
          isStriking = progress < 0.6;
          lunge = progress < 0.25
            ? Math.sin((progress / 0.25) * Math.PI / 2)
            : progress < 0.6 ? Math.cos(((progress - 0.25) / 0.35) * Math.PI / 2) : 0;
          if (progress >= 0.25 && strikeNumber !== clock.lastImpact) {
            clock.lastImpact = strikeNumber;
            playSfx('swordClash', 0.7);
            playSfx('swordHit', 0.5);
          }
        }
      }
    } else {
      battleClockRef.current = null;
    }

    if (modelRef.current) {
      if (lunge > 0 && desiredHeading !== null) {
        modelRef.current.position.set(Math.sin(desiredHeading) * lunge * LUNGE_DISTANCE, 0, Math.cos(desiredHeading) * lunge * LUNGE_DISTANCE);
      } else {
        modelRef.current.position.set(0, 0, 0);
      }
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
    }
    if (modelRef.current) {
      // With nothing to face yet, still apply the model's own facing correction
      modelRef.current.rotation.y = headingRef.current ?? 0;
    }

    // Pick the animation for what the unit is doing right now
    if (walkRef.current) playAnimation('walk');
    else if (battle) {
      // Between strikes, hold the shield up
      if (!isStriking || !actionRef.current?.isRunning()) playAnimation('holdShield');
    }
    else if (isPendingPurchase) playAnimation('holdShield');
    else playAnimation('idle');

    mixerRef.current?.update(delta);

    // The horse gallops while walking and stands still otherwise
    const mount = mountRef.current;
    if (mount) {
      mount.gallop.timeScale = walkRef.current ? 1.6 : 0;
      mount.mixer.update(delta);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onSelect) return;
    e.stopPropagation();
    // A press that moved is a camera drag, not a click
    if (e.delta > DRAG_CLICK_TOLERANCE) return;
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
        <mesh position={[0, 0.6, 0]} visible={false}>
          <cylinderGeometry args={[0.45, 0.45, 1.2, 10]} />
        </mesh>
      )}

      {/* The 3D model is loaded into this group */}
      <group ref={modelRef} visible={modelLoaded} />

      {/* Crossbow bolt (pointed along +z) or glowing spell fired by ranged units in battle */}
      {isRanged && projectile === 'arrow' && (
        <group ref={arrowRef} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.4, 5]} />
            <meshStandardMaterial color="#8d5a3b" />
          </mesh>
          <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.035, 0.08, 6]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          <mesh position={[0, 0, -0.19]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.045, 0.06, 3]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
      )}
      {isRanged && projectile === 'magic' && (
        <group ref={arrowRef} visible={false}>
          <mesh>
            <icosahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial color="#e9d5ff" emissive="#a855f7" emissiveIntensity={1.5} flatShading />
          </mesh>
          <mesh position={[0, 0, -0.14]} scale={[0.6, 0.6, 1.6]}>
            <icosahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Simple placeholder while the model is loading (no external assets so it can't suspend the scene) */}
      {!modelLoaded && (
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
          <meshStandardMaterial color={ownerColor} />
        </mesh>
      )}

      {/* Owner ring so it's always clear which side a unit belongs to */}
      <mesh position={[0, RING_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, isSelected ? 0.62 : 0.54, 32]} />
        <meshBasicMaterial
          color={isSelected ? '#facc15' : ownerColor}
          transparent
          opacity={isPendingPurchase ? 0.5 : 0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Compact unit label: type, health and terrain bonuses */}
      {!decorative && (
        <Html
          position={[0, look.labelHeight, 0]}
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
            <UnitIcon type={unit.type} className="text-[13px]" />
            {isPendingPurchase ? (
              <WaitIcon title="Arrives at the end of the turn" />
            ) : (
              <>
                <span className="w-6 h-1.5 rounded-full bg-slate-600 overflow-hidden inline-block">
                  <span className="block h-full" style={{ width: `${healthRatio * 100}%`, background: healthColor }} />
                </span>
                {/* Terrain bonuses as icons only - details are in the selection card */}
                {terrainBadges.map(badge =>
                  badge === 'cover' ? <TerrainIcon key={badge} terrain="forest" />
                    : badge === 'attack' ? <AttackIcon key={badge} />
                      : badge === 'exposed' ? <TerrainIcon key={badge} terrain="swamp" />
                        : badge === 'heal' ? <TerrainIcon key={badge} terrain="spring" />
                          : <GoldIcon key={badge} />
                )}
                {hasPlannedMove && <ArrowIcon />}
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export const UnitMesh = memo(UnitMeshComponent);
