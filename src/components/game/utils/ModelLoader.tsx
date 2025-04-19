import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useLoadingManager, getCachedModel } from './LoadingManager';

// Legacy model cache for backward compatibility
const modelCache = new Map<string, THREE.Group>();

// Create a loader
const createLoader = () => {
  const loader = new GLTFLoader();
  return loader;
};

// Get a cached model or load it if not cached
export const loadGLTFModel = (url: string): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    // First try to get from the LoadingManager cache
    const cachedModel = getCachedModel(url);
    if (cachedModel) {
      resolve(cachedModel);
      return;
    }
    
    // Try to get from legacy cache
    if (modelCache.has(url)) {
      const legacyCachedModel = modelCache.get(url);
      if (legacyCachedModel) {
        resolve(legacyCachedModel.clone());
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
        
        // Store in legacy cache
        modelCache.set(url, model);
        
        // Return a clone to avoid modifying the cached version
        resolve(model.clone());
      },
      // Progress callback
      () => {
        // Progress callback - now handled by LoadingManager
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
  const { registerAsset, getAsset, startLoading } = useLoadingManager();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    // Register the asset with the LoadingManager
    registerAsset(url, 'model');
    
    // Start loading if not already in progress
    startLoading();
    
    // Check if the model is already loaded in the LoadingManager
    const asset = getAsset(url);
    if (asset && asset.loaded) {
      const cachedModel = getCachedModel(url);
      if (cachedModel && isMounted) {
        setModel(cachedModel);
        setLoading(false);
        return;
      }
    }
    
    // Fall back to the old loading mechanism if not in LoadingManager
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
  }, [url, registerAsset, getAsset, startLoading]);

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

// Preload a model for later use - now uses LoadingManager
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const preloadModel = (_url: string): void => {
  // This is now handled by the LoadingManager
};

// Function to preload multiple models - now uses LoadingManager
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const preloadModels = (_urls: string[]): void => {
  // This is now handled by the LoadingManager
}; 