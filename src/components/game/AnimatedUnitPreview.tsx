import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLoadingManager } from './utils/LoadingManager';
import { UnitType } from '@/types/game';
import { 
  getUnitModelAttributes, 
  getAnimationName, 
  AnimationState as UnitAnimationState
} from './utils/UnitModelSystem';

// Add a constant for the additional height needed to prevent clipping
const UNIT_ELEVATION = 0.5;
// The center of the map in world coordinates
const MAP_CENTER: [number, number, number] = [0, 0, 0];

interface AnimatedUnitPreviewProps {
  unitType: UnitType;
  position: [number, number, number];
  hexHeight: number;
  isPlaced?: boolean;
  isConfirmed?: boolean; // To indicate a confirmed unit that should show hold shield
}

export const AnimatedUnitPreview: React.FC<AnimatedUnitPreviewProps> = ({
  unitType,
  position,
  hexHeight,
  isPlaced = false,
  isConfirmed = false
}) => {
  // Get unit model configuration
  const unitModelAttributes = getUnitModelAttributes(unitType);
  const modelUrl = unitModelAttributes.modelPath;
  
  // Calculate rotation to face center of the map
  const [initialRotation, setInitialRotation] = useState<number>(0);
  
  // Calculate the direction toward the center when position changes
  useEffect(() => {
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
  }, [position]);
  
  // Determine the appropriate animation state based on the props
  const [animationState, setAnimationState] = useState<UnitAnimationState>(
    isConfirmed || isPlaced ? 'holdShield' : 'idle'
  );
  
  const [currentAnimation, setCurrentAnimation] = useState<THREE.AnimationAction | null>(null);
  const [animationMixer, setAnimationMixer] = useState<THREE.AnimationMixer | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  
  // Refs for animation effects
  const indicatorRef = useRef<THREE.Mesh>(null);
  const hoverRef = useRef<THREE.Group>(null);
  
  // Store animation clips to avoid reloading them
  const animationClipsRef = useRef<{[key: string]: THREE.AnimationClip}>({});
  
  const modelRef = useRef<THREE.Group>(null);
  const { registerAsset, startLoading } = useLoadingManager();

  // Load the model with animations - only do this once
  useEffect(() => {
    registerAsset(modelUrl, 'model');
    startLoading();

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
            console.log(`Preview animations for ${unitType}:`, gltf.animations.map(a => a.name));

            // Store all animation clips in the ref for later use
            gltf.animations.forEach(clip => {
              animationClipsRef.current[clip.name] = clip;
            });
            
            // Get the animation name based on the state and unit type
            const animationName = getAnimationName(unitType, animationState);
            
            // Find the animation clip
            let targetClip = gltf.animations.find(clip => 
              clip.name.toLowerCase().includes(animationName.toLowerCase())
            );
            
            // Fall back to first animation if needed
            if (!targetClip && gltf.animations.length > 0) {
              console.warn(`Animation '${animationName}' not found for preview, using default`);
              targetClip = gltf.animations[0];
            }
            
            if (targetClip) {
              // Start the animation
              const action = mixer.clipAction(targetClip);
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
        console.error(`Error loading preview model for ${unitType}:`, error);
      }
    );
  }, [modelUrl, registerAsset, startLoading, unitType, unitModelAttributes, initialRotation, animationState]);

  // Update model rotation when initialRotation changes
  useEffect(() => {
    if (modelRef.current && modelRef.current.children.length > 0) {
      // Get the first child which should be our model
      const model = modelRef.current.children[0];
      // Update rotation to face center
      model.rotation.y = initialRotation + unitModelAttributes.rotationOffset;
    }
  }, [initialRotation, unitModelAttributes.rotationOffset]);

  // Update animation when props change
  useEffect(() => {
    // Update animation state based on props
    let targetState: UnitAnimationState = isConfirmed || isPlaced ? 'holdShield' : 'idle';
    
    // For infantry units (knights), always use holdShield if placed or confirmed
    if (unitType === 'infantry' && (isPlaced || isConfirmed)) {
      targetState = 'holdShield';
    }
    
    // Only update if the state is different
    if (animationState !== targetState) {
      setAnimationState(targetState);
    }
  }, [isPlaced, isConfirmed, animationState, unitType]);

  // Update animation when animation state changes
  useEffect(() => {
    if (!animationMixer || !modelLoaded || Object.keys(animationClipsRef.current).length === 0) return;

    // Get the animation name based on the state and unit type
    const animationName = getAnimationName(unitType, animationState);
    
    // Find the animation clip
    let targetClip: THREE.AnimationClip | null = null;
    for (const clipName in animationClipsRef.current) {
      if (clipName.toLowerCase().includes(animationName.toLowerCase())) {
        targetClip = animationClipsRef.current[clipName];
        break;
      }
    }
    
    // Fall back to first animation if needed
    if (!targetClip && Object.values(animationClipsRef.current).length > 0) {
      console.warn(`Animation '${animationName}' not found for state change, using fallback`);
      targetClip = Object.values(animationClipsRef.current)[0];
    }
    
    // If we have a current animation, fade it out
    if (currentAnimation) {
      // For knights in holdShield, use a slower transition for a more dramatic effect
      const fadeOutDuration = unitType === 'infantry' && animationState === 'holdShield' ? 0.5 : 0.3;
      currentAnimation.fadeOut(fadeOutDuration);
    }
    
    // If we have a target clip, play it
    if (targetClip) {
      const newAction = animationMixer.clipAction(targetClip);
      
      // For knights in holdShield, we want a slower, more dramatic transition
      const fadeInDuration = unitType === 'infantry' && animationState === 'holdShield' ? 0.5 : 0.3;
      
      // Set time scale to be slightly slower for holdShield to make it more dramatic
      if (unitType === 'infantry' && animationState === 'holdShield') {
        newAction.timeScale = 0.8;
      }
      
      newAction.reset().fadeIn(fadeInDuration).play();
      setCurrentAnimation(newAction);
    }
  }, [animationState, animationMixer, modelLoaded, unitType, currentAnimation]);

  // Animate indicator effects
  useFrame((_, delta) => {
    // Update animation mixer
    if (animationMixer) {
      animationMixer.update(delta);
    }
    
    // Animate indicator
    if (indicatorRef.current) {
      const time = Date.now() * 0.001; // Convert to seconds
      
      if (isConfirmed) {
        // Pulsing confirmed indicator
        indicatorRef.current.scale.setScalar(0.7 + Math.sin(time * 5) * 0.1);
        // Use type assertion to safely access opacity
        if (indicatorRef.current.material instanceof THREE.Material) {
          indicatorRef.current.material.opacity = 0.8 + Math.sin(time * 3) * 0.2;
        }
      } else if (isPlaced) {
        // Gentle bobbing for placed indicator
        indicatorRef.current.position.y = Math.sin(time * 3) * 0.05;
        // Use type assertion to safely access opacity
        if (indicatorRef.current.material instanceof THREE.Material) {
          indicatorRef.current.material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
        }
      } else {
        // Floating hover indicator
        indicatorRef.current.position.y = Math.sin(time * 2) * 0.1;
        // Use type assertion to safely access opacity
        if (indicatorRef.current.material instanceof THREE.Material) {
          indicatorRef.current.material.opacity = 0.3 + Math.sin(time * 1.5) * 0.2;
        }
      }
    }
    
    // Hover animation for the entire unit
    if (hoverRef.current && !isPlaced) {
      const time = Date.now() * 0.001;
      hoverRef.current.position.y = Math.sin(time * 1.5) * 0.15;
      
      // Don't rotate the preview unit if it should face the center
      // This allows the player to see which direction it will face when placed
      if (!isPlaced && !isConfirmed) {
        // Apply a gentle bobbing rotation instead of full rotation
        hoverRef.current.rotation.y = initialRotation + Math.sin(time * 0.7) * 0.1;
      }
    }
  });

  // Get the appropriate color for the unit type
  const unitColor = unitModelAttributes.indicatorColor;

  return (
    <group position={[position[0], position[1] + hexHeight + UNIT_ELEVATION, position[2]]}>
      {/* Hover group for floating effect */}
      <group ref={hoverRef}>
        {/* The model is loaded into this group */}
        <group 
          ref={modelRef}
          visible={modelLoaded} // Only show when model and animation are loaded
        />
      </group>
      
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
          emissiveIntensity={isConfirmed ? 0.8 : isPlaced ? 0.5 : 0.3}
          transparent={true}
          opacity={0.7}
        />
      </mesh>
      
      {/* Glowing ring for confirmed units */}
      {isConfirmed && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshStandardMaterial 
            color="#FFFFFF" 
            emissive="#FFFFFF"
            emissiveIntensity={0.8}
            transparent={true}
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  );
}; 