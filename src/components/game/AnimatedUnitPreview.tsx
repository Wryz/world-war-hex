import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnitType } from '@/types/game';
import {
  getUnitModelAttributes,
  getUnitModelPath,
  getAnimationName
} from './utils/UnitModelSystem';
import { instantiateUnitModel, findAnimationClip } from './utils/unitModelCache';

// How far a hovering (not yet placed) preview floats above the tile
const HOVER_ELEVATION = 0.4;

interface AnimatedUnitPreviewProps {
  unitType: UnitType;
  position: [number, number, number];
  // Height of the top surface of the tile the preview is shown on
  hexHeight: number;
  isPlaced?: boolean;
  isConfirmed?: boolean; // To indicate a confirmed unit that should show hold shield
}

// Semi-transparent preview of a unit the player is about to deploy from the barracks
export const AnimatedUnitPreview: React.FC<AnimatedUnitPreviewProps> = ({
  unitType,
  position,
  hexHeight,
  isPlaced = false,
  isConfirmed = false
}) => {
  const unitModelAttributes = getUnitModelAttributes(unitType);
  const modelUrl = getUnitModelPath('player');
  const animationState = isConfirmed || isPlaced ? 'holdShield' : 'idle';

  const [x, y, z] = position;
  const elevation = isPlaced || isConfirmed ? 0.02 : HOVER_ELEVATION;
  // Face the center of the map
  const facing = Math.abs(x) + Math.abs(z) > 0.001 ? Math.atan2(-x, -z) : 0;

  const modelRef = useRef<THREE.Group>(null);
  const hoverRef = useRef<THREE.Group>(null);
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
        console.error(`Error loading preview model for ${unitType}:`, error);
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
  }, [modelUrl, unitType, unitModelAttributes.scale, unitModelAttributes.heightOffset]);

  // Cross-fade to the animation for the current state
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!modelLoaded || !mixer) return;

    const clip = findAnimationClip(clipsRef.current, getAnimationName(unitType, animationState));
    if (!clip) return;

    const nextAction = mixer.clipAction(clip);
    if (actionRef.current === nextAction) return;

    actionRef.current?.fadeOut(0.3);
    nextAction.reset().fadeIn(0.3).play();
    actionRef.current = nextAction;
  }, [modelLoaded, animationState, unitType]);

  // Animate indicator effects
  useFrame((state, delta) => {
    mixerRef.current?.update(delta);
    const time = state.clock.getElapsedTime();

    if (indicatorRef.current) {
      const material = indicatorRef.current.material as THREE.MeshStandardMaterial;

      if (isConfirmed) {
        // Pulsing confirmed indicator
        indicatorRef.current.scale.setScalar(0.7 + Math.sin(time * 5) * 0.1);
        material.opacity = 0.8 + Math.sin(time * 3) * 0.2;
      } else if (isPlaced) {
        // Gentle bobbing for placed indicator
        indicatorRef.current.position.y = Math.sin(time * 3) * 0.02;
        material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
      } else {
        // Floating hover indicator
        material.opacity = 0.3 + Math.sin(time * 1.5) * 0.2;
      }
    }

    // Hover animation for a preview that hasn't been placed yet
    if (hoverRef.current) {
      if (!isPlaced && !isConfirmed) {
        hoverRef.current.position.y = Math.sin(time * 1.5) * 0.15;
        hoverRef.current.rotation.y = Math.sin(time * 0.7) * 0.1;
      } else {
        hoverRef.current.position.y = 0;
        hoverRef.current.rotation.y = 0;
      }
    }
  });

  return (
    <group position={[x, y + hexHeight + elevation, z]}>
      {/* Hover group for floating effect */}
      <group ref={hoverRef}>
        {/* The model is loaded into this group */}
        <group
          ref={modelRef}
          rotation={[0, facing + unitModelAttributes.rotationOffset, 0]}
          visible={modelLoaded}
        />
      </group>

      {/* Unit type indicator circle below the unit */}
      <mesh
        ref={indicatorRef}
        // Keep the indicator on the tile surface even while the model floats
        position={[0, 0.02 - elevation, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[unitModelAttributes.indicatorScale, 32]} />
        <meshStandardMaterial
          color={unitModelAttributes.indicatorColor}
          emissive={unitModelAttributes.indicatorColor}
          emissiveIntensity={isConfirmed ? 0.8 : isPlaced ? 0.5 : 0.3}
          transparent={true}
          opacity={0.7}
        />
      </mesh>

      {/* Glowing ring for placed/confirmed units */}
      {(isPlaced || isConfirmed) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.65, 32]} />
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
