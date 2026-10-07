import { useRef, useEffect, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Unit } from '@/types/game';
import {
  getUnitModelAttributes,
  getUnitModelPath,
  determineAnimationState,
  getAnimationName
} from './utils/UnitModelSystem';
import { instantiateUnitModel, findAnimationClip } from './utils/unitModelCache';

// Default height of the tile surface a unit stands on
const DEFAULT_SURFACE_HEIGHT = 0.6;
// Small lift so the unit's indicator doesn't z-fight with the tile surface
const UNIT_ELEVATION = 0.02;
const ANIMATION_FADE_DURATION = 0.3;

const OWNER_RING_COLORS = {
  player: '#2196f3',
  ai: '#f44336'
};

interface UnitMeshProps {
  unit: Unit;
  position?: [number, number, number];
  // Height of the top surface of the tile the unit stands on
  hexHeight?: number;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  isPendingPurchase?: boolean;
  isMoving?: boolean;
}

export const UnitMesh: React.FC<UnitMeshProps> = ({
  unit,
  position = [0, 0, 0],
  hexHeight = DEFAULT_SURFACE_HEIGHT,
  onClick,
  isPendingPurchase = false,
  isMoving = false
}) => {
  const unitModelAttributes = getUnitModelAttributes(unit.type);
  const modelUrl = getUnitModelPath(unit.owner);
  const animationState = determineAnimationState(unit.type, isPendingPurchase, isMoving);

  const [x, y, z] = position;
  const unitPosition: [number, number, number] = [x, y + hexHeight + UNIT_ELEVATION, z];

  // Face the center of the map
  const facing = Math.abs(x) + Math.abs(z) > 0.001 ? Math.atan2(-x, -z) : 0;

  const modelRef = useRef<THREE.Group>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

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

  // Cross-fade to the animation matching the unit's current state
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!modelLoaded || !mixer) return;

    const clip = findAnimationClip(clipsRef.current, getAnimationName(unit.type, animationState));
    if (!clip) return;

    const nextAction = mixer.clipAction(clip);
    if (actionRef.current === nextAction) return;

    actionRef.current?.fadeOut(ANIMATION_FADE_DURATION);
    nextAction.reset().fadeIn(ANIMATION_FADE_DURATION).play();
    actionRef.current = nextAction;
  }, [modelLoaded, animationState, unit.type]);

  useFrame((state, delta) => {
    mixerRef.current?.update(delta);

    // Animate indicator
    if (indicatorRef.current) {
      const time = state.clock.getElapsedTime();
      indicatorRef.current.position.y = 0.02 + Math.sin(time * 2) * 0.02;
      const material = indicatorRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onClick) return;
    e.stopPropagation();
    onClick(e);
  };

  const healthRatio = unit.maxLifespan > 0 ? unit.lifespan / unit.maxLifespan : 1;

  return (
    <group position={unitPosition} onClick={handleClick}>
      {/* Invisible click area that's larger than the unit */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* The 3D model is loaded into this group */}
      <group
        ref={modelRef}
        rotation={[0, facing + unitModelAttributes.rotationOffset, 0]}
        visible={modelLoaded}
      />

      {/* Owner ring so it's always clear which side a unit belongs to */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[unitModelAttributes.indicatorScale + 0.05, unitModelAttributes.indicatorScale + 0.15, 32]} />
        <meshStandardMaterial
          color={OWNER_RING_COLORS[unit.owner]}
          emissive={OWNER_RING_COLORS[unit.owner]}
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Unit type indicator circle below the unit */}
      <mesh
        ref={indicatorRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[unitModelAttributes.indicatorScale, 32]} />
        <meshStandardMaterial
          color={unitModelAttributes.indicatorColor}
          emissive={unitModelAttributes.indicatorColor}
          emissiveIntensity={isPendingPurchase ? 0.7 : 0.5}
          transparent={true}
          opacity={isPendingPurchase ? 0.8 : 0.7}
        />
      </mesh>

      {/* Health bar */}
      {!isPendingPurchase && (
        <Billboard position={[0, 1.6, 0]}>
          <mesh>
            <planeGeometry args={[0.8, 0.1]} />
            <meshBasicMaterial color="#222222" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-0.4 + 0.4 * healthRatio, 0, 0.001]}>
            <planeGeometry args={[0.8 * healthRatio, 0.08]} />
            <meshBasicMaterial
              color={healthRatio > 0.6 ? '#4caf50' : healthRatio > 0.3 ? '#ffc107' : '#f44336'}
              side={THREE.DoubleSide}
            />
          </mesh>
        </Billboard>
      )}

      {/* Simple placeholder while the model is loading (no external assets so it can't suspend the scene) */}
      {!modelLoaded && (
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
          <meshStandardMaterial color={OWNER_RING_COLORS[unit.owner]} />
        </mesh>
      )}

      {/* Extra indicator for pending purchases */}
      {isPendingPurchase && (
        <mesh position={[0, 1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.35, 32]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FFFFFF"
            emissiveIntensity={0.8}
            transparent={true}
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};
