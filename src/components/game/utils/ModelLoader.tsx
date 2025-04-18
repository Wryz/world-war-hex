import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

// Cache for loaded models to avoid loading the same model multiple times
const modelCache = new Map<string, THREE.Group>();

// Create a loader
const createLoader = () => {
  const loader = new GLTFLoader();
  return loader;
};

// Get a cached model or load it if not cached
export const loadGLTFModel = (url: string): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    // Check if model is already in cache
    if (modelCache.has(url)) {
      const cachedModel = modelCache.get(url);
      if (cachedModel) {
        resolve(cachedModel.clone());
        return;
      }
    }

    const loader = createLoader();
    
    // Load the model
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        
        // Optimize the model
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Optimize geometries
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) {
              mesh.geometry.computeVertexNormals();
            }
          }
        });
        
        // Store in cache
        modelCache.set(url, model);
        
        // Return a clone to avoid modifying the cached version
        resolve(model.clone());
      },
      // Progress callback
      () => {
        // Progress callback - can be used to show loading status
        // console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      // Error callback
      (error) => {
        console.error(`Error loading model from ${url}:`, error);
        reject(error);
      }
    );
  });
};

// React hook for loading models
export const useGLTF = (url: string) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    loadGLTFModel(url)
      .then((loadedModel) => {
        if (isMounted) {
          setModel(loadedModel);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(`Failed to load model: ${url}`, err);
          setError(err);
          setLoading(false);
        }
      });
      
    return () => {
      isMounted = false;
    };
  }, [url]);

  return { model, loading, error };
};

// Component for rendering a model with fallback
interface ModelProps {
  url: string;
  fallback?: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export const Model: React.FC<ModelProps> = ({ 
  url, 
  fallback, 
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1
}) => {
  const { model, loading, error } = useGLTF(url);
  
  if (loading || error || !model) {
    return fallback ? <>{fallback}</> : null;
  }
  
  return (
    <primitive 
      object={model} 
      position={position}
      rotation={rotation}
      scale={typeof scale === 'number' ? [scale, scale, scale] : scale}
    />
  );
};

// Preload a model for later use
export const preloadModel = (url: string): void => {
  if (!modelCache.has(url)) {
    loadGLTFModel(url).catch(err => {
      console.warn(`Failed to preload model: ${url}`, err);
    });
  }
};

// Function to preload multiple models
export const preloadModels = (urls: string[]): void => {
  urls.forEach(url => preloadModel(url));
}; 