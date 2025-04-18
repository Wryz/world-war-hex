import React, { useRef } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky as DreiSky } from '@react-three/drei';

interface SkyProps {
  sunPosition?: [number, number, number];
}

// Simple sky component that uses drei's Sky
export const SimpleSky: React.FC<SkyProps> = ({ 
  sunPosition = [10, 2, 5] 
}) => {
  return (
    <DreiSky 
      distance={450}
      sunPosition={new THREE.Vector3(...sunPosition)}
      inclination={0.2}
      azimuth={0.25}
    />
  );
};

// Sky dome with procedural colors
export const SkyDome: React.FC = () => {
  const { scene } = useThree();
  const skyRef = useRef<THREE.Mesh>(null);
  
  // Use effect to set scene background color to match sky
  React.useEffect(() => {
    // Set a light blue background color
    scene.background = new THREE.Color('#87CEEB');
    
    return () => {
      // Reset to default when component unmounts
      scene.background = new THREE.Color('#000000');
    };
  }, [scene]);
  
  // Animate sky colors slightly to give a living sky feeling
  useFrame(({ clock }) => {
    if (skyRef.current) {
      const material = skyRef.current.material as THREE.ShaderMaterial;
      // Subtle color changes over time
      const time = clock.getElapsedTime() * 0.1;
      material.uniforms.topColor.value.setRGB(
        0.4 + Math.sin(time) * 0.1, 
        0.6 + Math.sin(time * 0.5) * 0.1, 
        0.9 + Math.sin(time * 0.7) * 0.1
      );
    }
  });
  
  // Custom shader for gradient sky
  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `;
  
  // Configure uniforms for sky shader
  const uniforms = {
    topColor: { value: new THREE.Color(0.4, 0.6, 0.9) },
    bottomColor: { value: new THREE.Color(0.8, 0.9, 1.0) },
    offset: { value: 0 },
    exponent: { value: 0.6 }
  };
  
  return (
    <mesh ref={skyRef} scale={[1, 1, 1]}>
      <sphereGeometry args={[1000, 32, 15]} />
      <shaderMaterial 
        side={THREE.BackSide}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

// Sky with clouds using a panorama texture
export const PanoramaSky: React.FC = () => {
  const texture = useLoader(THREE.TextureLoader, '/textures/sky.jpg');
  const { scene } = useThree();
  
  React.useEffect(() => {
    // Configure texture
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 16;
    
    // Set color space (modern Three.js API)
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // Create background with texture
    scene.background = texture;
    
    return () => {
      // Reset background when component unmounts
      scene.background = new THREE.Color('#000000');
    };
  }, [texture, scene]);
  
  return null; // No actual mesh is needed for this implementation
};

// Default export - choose the implementation you want to use
export default SkyDome; 