import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Define properties for a single cloud
interface CloudProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  speed?: number;
}

// Component for a single cloud
const Cloud: React.FC<CloudProps> = ({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  speed = 0.1
}) => {
  const mesh = useRef<THREE.Group>(null);
  
  // Create a simple cloud shape using multiple sphere geometries
  const cloudGeometry = useMemo(() => {
    // Random cloud generation - each cloud is unique
    const geometry = new THREE.Group();
    
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
      roughness: 1,
      metalness: 0
    });
    
    // Create 3-7 spheres for each cloud in random arrangement
    const sphereCount = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < sphereCount; i++) {
      const radius = 1 + Math.random() * 0.5;
      const xOffset = (Math.random() - 0.5) * 2;
      const yOffset = (Math.random() - 0.5) * 0.5;
      const zOffset = (Math.random() - 0.5) * 2;
      
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 8, 8),
        material
      );
      sphere.position.set(xOffset, yOffset, zOffset);
      
      geometry.add(sphere);
    }
    
    return geometry;
  }, []);
  
  // Make cloud drift across the sky
  useFrame(() => {
    if (mesh.current) {
      // Move cloud slowly along x-axis
      mesh.current.position.x -= speed * 0.01;
      
      // Reset position when cloud moves far out of view
      const boundaryLimit = 200;
      if (mesh.current.position.x < -boundaryLimit) {
        mesh.current.position.x = boundaryLimit;
      }
    }
  });
  
  return (
    <group
      ref={mesh}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
    >
      <primitive object={cloudGeometry} />
    </group>
  );
};

// Main component that generates multiple clouds
interface CloudsProps {
  count?: number;
  height?: number;
  radiusMin?: number;
  radiusMax?: number;
}

export const Clouds: React.FC<CloudsProps> = ({
  count = 20,
  height = 80,
  radiusMin = 50,
  radiusMax = 150
}) => {
  // Generate random clouds with different positions, rotations, and sizes
  const clouds = useMemo(() => {
    const items = [];
    
    for (let i = 0; i < count; i++) {
      // Random position in a circle around the center
      const angle = Math.random() * Math.PI * 2;
      const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
      const x = Math.cos(angle) * radius;
      const y = height + (Math.random() - 0.5) * 20; // Vary cloud height
      const z = Math.sin(angle) * radius;
      
      // Random properties
      const scale = 8 + Math.random() * 12; // Cloud size
      const rotation: [number, number, number] = [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ];
      const speed = 0.05 + Math.random() * 0.15; // Drift speed
      
      items.push(
        <Cloud 
          key={i}
          position={[x, y, z]} 
          rotation={rotation}
          scale={scale}
          speed={speed}
        />
      );
    }
    
    return items;
  }, [count, height, radiusMin, radiusMax]);
  
  return <>{clouds}</>;
};

export default Clouds; 