import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnitType } from '@/types/game';
import { getUnitLook, getAnimationName } from './utils/UnitModelSystem';
import { instantiateUnitModel, findAnimationClip, disposeUnitModel, UnitModelInstance } from './utils/unitModelCache';
import { FACTIONS, TROOPS } from '@/lib/game/troops';

// How far a hovering (not yet placed) preview floats above the tile
const HOVER_ELEVATION = 0.4;

interface AnimatedUnitPreviewProps {
  unitType: UnitType;
  position: [number, number, number];
  // Height of the top surface of the tile the preview is shown on
  hexHeight: number;
  isPlaced?: boolean;
}

// Semi-transparent preview of a unit the player is about to deploy from the barracks
export const AnimatedUnitPreview: React.FC<AnimatedUnitPreviewProps> = ({
  unitType,
  position,
  hexHeight,
  isPlaced = false
}) => {
  const look = getUnitLook(unitType);
  const modelScale = look.kind === 'humanoid' ? look.scale : 1;
  // Disc under the preview in the troop's faction colour
  const indicatorColor = FACTIONS[TROOPS[unitType].faction].color;
  const animationState = isPlaced ? 'holdShield' : 'idle';

  const [x, y, z] = position;
  const elevation = isPlaced ? 0.02 : HOVER_ELEVATION;
  // Face the center of the map
  const facing = Math.abs(x) + Math.abs(z) > 0.001 ? Math.atan2(-x, -z) : 0;

  const modelRef = useRef<THREE.Group>(null);
  const hoverRef = useRef<THREE.Group>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const rigRef = useRef<UnitModelInstance['rig'] | null>(null);
  const mountMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<THREE.AnimationClip[]>([]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Load (a clone of) the model for this unit type
  useEffect(() => {
    const container = modelRef.current;
    if (!container) return;

    let cancelled = false;
    let loaded: UnitModelInstance | null = null;

    instantiateUnitModel(unitType, 'player')
      .then(instance => {
        if (cancelled) {
          disposeUnitModel(instance);
          return;
        }
        loaded = instance;
        const { scene, animations, mount, rig } = instance;
        rigRef.current = rig ?? null;

        scene.scale.setScalar(modelScale);
        container.add(scene);
        if (mount) {
          // The horse stands still in the barracks
          mount.gallop.timeScale = 0;
          mountMixerRef.current = mount.mixer;
        }

        mixerRef.current = rig ? null : new THREE.AnimationMixer(scene);
        clipsRef.current = animations;
        setModelLoaded(true);
      })
      .catch(error => {
        console.error(`Error loading preview model for ${unitType}:`, error);
      });

    return () => {
      cancelled = true;
      if (loaded) disposeUnitModel(loaded, mixerRef.current);
      rigRef.current = null;
      mountMixerRef.current?.stopAllAction();
      mountMixerRef.current = null;
      mixerRef.current = null;
      actionRef.current = null;
      clipsRef.current = [];
      container.clear();
      setModelLoaded(false);
    };
  }, [unitType, modelScale]);

  // Cross-fade to the animation for the current state
  useEffect(() => {
    rigRef.current?.setState(isPlaced ? 'hold' : 'idle');
    const mixer = mixerRef.current;
    if (!modelLoaded || !mixer) return;

    const clip = findAnimationClip(clipsRef.current, getAnimationName(unitType, animationState));
    if (!clip) return;

    const nextAction = mixer.clipAction(clip);
    if (actionRef.current === nextAction) return;

    actionRef.current?.fadeOut(0.3);
    nextAction.reset().fadeIn(0.3).play();
    actionRef.current = nextAction;
  }, [modelLoaded, animationState, unitType, isPlaced]);

  // Animate indicator effects
  useFrame((state, delta) => {
    mixerRef.current?.update(delta);
    rigRef.current?.update(delta);
    mountMixerRef.current?.update(delta);
    const time = state.clock.getElapsedTime();

    if (indicatorRef.current) {
      const material = indicatorRef.current.material as THREE.MeshStandardMaterial;

      if (isPlaced) {
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
      if (!isPlaced) {
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
          rotation={[0, facing, 0]}
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
        <circleGeometry args={[0.5, 32]} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={indicatorColor}
          emissiveIntensity={isPlaced ? 0.5 : 0.3}
          transparent={true}
          opacity={0.7}
        />
      </mesh>

      {/* Glowing ring for placed/confirmed units */}
      {isPlaced && (
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
