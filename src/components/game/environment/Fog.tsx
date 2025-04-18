import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface FogProps {
  color?: string;
  near?: number;
  far?: number;
}

/**
 * Component that adds fog to the scene
 * This is a purely functional component with no render output,
 * it only modifies the scene's fog property
 */
const Fog: React.FC<FogProps> = ({
  color = '#e6f7ff',
  near = 60,
  far = 100
}) => {
  const { scene } = useThree();
  
  useEffect(() => {
    // Create fog and add to scene
    const fog = new THREE.Fog(color, near, far);
    scene.fog = fog;
    
    // Clean up on unmount
    return () => {
      scene.fog = null;
    };
  }, [scene, color, near, far]);
  
  // No visual output, just adds fog to the scene
  return null;
};

export default Fog; 