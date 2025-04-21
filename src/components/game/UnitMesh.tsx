import { useRef, useEffect, useState } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Unit } from '@/types/game';
import { useLoadingManager } from './utils/LoadingManager';
import { 
  getUnitModelAttributes, 
  determineAnimationState, 
  getAnimationName,
  AnimationState
} from './utils/UnitModelSystem';

// Base hex height constant from HexTile.tsx
const BASE_HEIGHT = 0.5;
// Add a constant for the additional height needed to prevent clipping
const UNIT_ELEVATION = 0.5;
// The center of the map in world coordinates
const MAP_CENTER: [number, number, number] = [0, 0, 0];

interface UnitMeshProps {
  unit: Unit;
  position?: [number, number, number];
  hexHeight?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (event: any) => void;
  isPendingPurchase?: boolean;
  isMoving?: boolean;
}

export const UnitMesh: React.FC<UnitMeshProps> = ({
  unit,
  position,
  hexHeight = BASE_HEIGHT,
  onClick,
  isPendingPurchase = false,
  isMoving = false
}) => {
  // Find hex terrain to determine height
  const terrainHeight = hexHeight || BASE_HEIGHT;
  // Increase the Y position to ensure the unit sits on top of the hex
  const defaultPosition: [number, number, number] = [0, terrainHeight + UNIT_ELEVATION, 0];
  // If position is provided, adjust its Y value to add the elevation
  const unitPosition = position ? 
    [position[0], position[1] + UNIT_ELEVATION, position[2]] as [number, number, number] : 
    defaultPosition;
  
  // Calculate rotation to face center of the map
  const [initialRotation, setInitialRotation] = useState<number>(0);
  
  // Calculate the direction toward the center when position changes
  useEffect(() => {
    if (position) {
      // Create vectors to calculate the angle
      const unitPos = new THREE.Vector3(position[0], 0, position[2]);
      const centerPos = new THREE.Vector3(MAP_CENTER[0], 0, MAP_CENTER[2]);
      
      // Direction vector from unit to center (ignore Y component for ground rotation)
      const direction = centerPos.clone().sub(unitPos);
      
      // If unit is not at the exact center
      if (direction.length() > 0.001) {
        // Calculate the angle between the direction and the positive Z-axis
        // The angle can be calculated using Math.atan2(x, z) for rotation around Y-axis
        const angle = Math.atan2(direction.x, direction.z);
        setInitialRotation(angle);
      }
    }
  }, [position]);
  
  // Get unit model configuration based on unit type
  const unitModelAttributes = getUnitModelAttributes(unit.type);
  const modelUrl = unitModelAttributes.modelPath;
  
  // Determine the appropriate animation state
  const [animationState, setAnimationState] = useState<AnimationState>(
    determineAnimationState(unit.type, isPendingPurchase, isMoving)
  );
  
  const [animationMixer, setAnimationMixer] = useState<THREE.AnimationMixer | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<THREE.AnimationAction | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const modelRef = useRef<THREE.Group>(null);
  const { registerAsset } = useLoadingManager();
  
  // Store animation clips to avoid reloading them
  const animationClipsRef = useRef<{[key: string]: THREE.AnimationClip}>({});
  const indicatorRef = useRef<THREE.Mesh>(null);

  // Load the model with animations - only do this once
  useEffect(() => {
    registerAsset(modelUrl, 'model');

    // Hide the model until animation is ready
    if (modelRef.current) {
      modelRef.current.visible = false;
    }

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (modelRef.current) {
          // Clear existing children
          while (modelRef.current.children.length) {
            modelRef.current.remove(modelRef.current.children[0]);
          }

          // Add the new model
          const model = gltf.scene;
          modelRef.current.add(model);

          // Apply unit-specific scale and offsets
          model.scale.set(
            unitModelAttributes.scale, 
            unitModelAttributes.scale, 
            unitModelAttributes.scale
          );
          model.position.set(0, unitModelAttributes.heightOffset, 0);
          
          // Apply initial rotation toward center + model-specific rotation offset
          model.rotation.y = initialRotation + unitModelAttributes.rotationOffset;

          // Set up animations
          if (gltf.animations && gltf.animations.length) {
            const mixer = new THREE.AnimationMixer(model);
            setAnimationMixer(mixer);

            // Log available animations for debugging
            console.log(`Available animations for ${unit.type}:`, gltf.animations.map(a => a.name));

            // Store all animation clips in the ref for later use
            gltf.animations.forEach(clip => {
              animationClipsRef.current[clip.name] = clip;
            });
            
            // Find the correct animation based on the current state
            const animationName = getAnimationName(unit.type, animationState);
            
            // Try to find the animation by name
            let animationClip = gltf.animations.find(clip => 
              clip.name.toLowerCase().includes(animationName.toLowerCase())
            );
            
            // Fall back to first animation if not found
            if (!animationClip && gltf.animations.length > 0) {
              console.warn(`Animation '${animationName}' not found for ${unit.type}, using default`);
              animationClip = gltf.animations[0];
            }
            
            if (animationClip) {
              // Start the animation
              const action = mixer.clipAction(animationClip);
              action.reset().play();
              setCurrentAnimation(action);
            }
            
            // Only make the model visible once animation is ready
            modelRef.current.visible = true;
            setModelLoaded(true);
          }
        }
      },
      undefined,
      (error) => {
        console.error(`Error loading model for ${unit.type}:`, error);
      }
    );
  }, [modelUrl, registerAsset, unit.type, animationState, unitModelAttributes, initialRotation]);

  // Update model rotation when initialRotation changes
  useEffect(() => {
    if (modelRef.current && modelRef.current.children.length > 0) {
      // Get the first child which should be our model
      const model = modelRef.current.children[0];
      // Update rotation to face center
      model.rotation.y = initialRotation + unitModelAttributes.rotationOffset;
    }
  }, [initialRotation, unitModelAttributes.rotationOffset]);

  // Update animation when animationState changes
  useEffect(() => {
    // Determine the appropriate animation state based on current props
    const newAnimationState = determineAnimationState(unit.type, isPendingPurchase, isMoving);
    
    // Only update if the state is different
    if (animationState !== newAnimationState) {
      setAnimationState(newAnimationState);
    }
  }, [unit.type, isPendingPurchase, isMoving, animationState]);

  // Update current animation when animationState changes
  useEffect(() => {
    if (!animationMixer || !modelLoaded || Object.keys(animationClipsRef.current).length === 0) return;

    // Get the animation name for the current state
    const animationName = getAnimationName(unit.type, animationState);
    console.log(`Switching to animation: ${animationName} for ${unit.type}`);
    
    // Find the animation clip by name
    let targetClip: THREE.AnimationClip | null = null;
    for (const clipName in animationClipsRef.current) {
      if (clipName.toLowerCase().includes(animationName.toLowerCase())) {
        targetClip = animationClipsRef.current[clipName];
        break;
      }
    }
    
    // Fall back to first animation if target not found
    if (!targetClip && Object.values(animationClipsRef.current).length > 0) {
      console.warn(`Animation '${animationName}' not found, using fallback`);
      targetClip = Object.values(animationClipsRef.current)[0];
    }
    
    if (targetClip) {
      // Fade out current animation if it exists
      if (currentAnimation) {
        // For knights in holdShield, use a slower transition for a more dramatic effect
        const fadeOutDuration = unit.type === 'infantry' && animationState === 'holdShield' ? 0.5 : 0.3;
        currentAnimation.fadeOut(fadeOutDuration);
      }
      
      // Start new animation with fade-in
      const newAction = animationMixer.clipAction(targetClip);
      
      // For knights in holdShield, we want a slower, more dramatic transition
      const fadeInDuration = unit.type === 'infantry' && animationState === 'holdShield' ? 0.5 : 0.3;
      
      // Set time scale to be slightly slower for holdShield to make it more dramatic
      if (unit.type === 'infantry' && animationState === 'holdShield') {
        newAction.timeScale = 0.8;
      }
      
      newAction.reset().fadeIn(fadeInDuration).play();
      setCurrentAnimation(newAction);
    }
  }, [animationState, animationMixer, modelLoaded, unit.type, currentAnimation]);

  // Update animation
  useFrame((_, delta) => {
    // Update animation mixer
    if (animationMixer) {
      animationMixer.update(delta);
    }
    
    // Animate indicator
    if (indicatorRef.current) {
      const time = Date.now() * 0.001; // Convert to seconds
      indicatorRef.current.position.y = Math.sin(time * 2) * 0.05;
      // Use type assertion to safely access opacity
      if (indicatorRef.current.material instanceof THREE.Material) {
        indicatorRef.current.material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
      }
    }
  });

  // Add invisible click area that's larger than the unit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (onClick) onClick(e);
  };
  
  // Get the appropriate color for the unit type
  const unitColor = unitModelAttributes.indicatorColor;
  
  return (
    <group position={unitPosition} onClick={handleClick}>
      {/* Invisible click area */}
      <mesh visible={false}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* The 3D model is loaded into this group */}
      <group 
        ref={modelRef}
        visible={modelLoaded} // Only show when model and animation are loaded
      />
      
      {/* Unit type indicator circle below the unit */}
      <mesh 
        ref={indicatorRef}
        position={[0, -0.1, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[unitModelAttributes.indicatorScale, 32]} />
        <meshStandardMaterial 
          color={unitColor}
          emissive={unitColor} 
          emissiveIntensity={isPendingPurchase ? 0.7 : 0.5}
          transparent={true}
          opacity={isPendingPurchase ? 0.8 : 0.7}
        />
      </mesh>
      
      {/* Only show text label if model isn't loaded yet */}
      {!modelLoaded && (
        <Text 
          position={[0, 0.6, 0]} 
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {unit.type.charAt(0).toUpperCase()}
        </Text>
      )}
      
      {/* Extra indicator for pending purchases */}
      {isPendingPurchase && (
        <>
          <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.65, 32]} />
            <meshStandardMaterial 
              color="#FFFFFF" 
              emissive="#FFFFFF"
              emissiveIntensity={0.8}
              transparent={true}
              opacity={0.9}
            />
          </mesh>
          
          {/* Special shield glow effect for infantry units */}
          {unit.type === 'infantry' && (
            <mesh position={[0, 0.5, 0.3]} rotation={[0, 0, 0]}>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshStandardMaterial 
                color="#4682B4" 
                emissive="#4682B4"
                emissiveIntensity={0.7}
                transparent={true}
                opacity={0.4}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}; 