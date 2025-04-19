import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Types of assets we can load
export type AssetType = 'model' | 'texture' | 'audio' | 'other';

// Asset interface
export interface Asset {
  id: string;
  url: string;
  type: AssetType;
  loaded: boolean;
  progress: number;
  error: boolean;
}

// Loading manager state
interface LoadingManagerState {
  assets: Asset[];
  totalProgress: number;
  isLoading: boolean;
  isComplete: boolean;
  startLoading: (forceReload?: boolean) => void;
  registerAsset: (url: string, type: AssetType, id?: string) => void;
  getAsset: (id: string) => Asset | undefined;
  areAssetsLoaded: (ids: string[]) => boolean;
}

// Default context state
const defaultState: LoadingManagerState = {
  assets: [],
  totalProgress: 0,
  isLoading: false,
  isComplete: false,
  startLoading: () => {},
  registerAsset: () => {},
  getAsset: () => undefined,
  areAssetsLoaded: () => false,
};

// Create context
const LoadingManagerContext = createContext<LoadingManagerState>(defaultState);

// Custom hook to use the loading manager
export const useLoadingManager = () => useContext(LoadingManagerContext);

interface LoadingManagerProviderProps {
  children: ReactNode;
  initialAssets?: { url: string; type: AssetType; id?: string }[];
}

// Caches for different asset types
const modelCache = new Map<string, THREE.Group>();
const textureCache = new Map<string, THREE.Texture>();

export const LoadingManagerProvider: React.FC<LoadingManagerProviderProps> = ({ 
  children, 
  initialAssets = [] 
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);

  // Register an asset to be loaded
  const registerAsset = useCallback((url: string, type: AssetType, id?: string) => {
    const assetId = id || url;
    
    setAssets(currentAssets => {
      // Check if this asset is already registered
      if (currentAssets.some(asset => asset.id === assetId)) {
        return currentAssets;
      }
      
      // Add the new asset
      return [...currentAssets, {
        id: assetId,
        url,
        type,
        loaded: false,
        progress: 0,
        error: false
      }];
    });
  }, []);

  // Initialize with initial assets if provided
  useEffect(() => {
    if (initialAssets.length > 0) {
      initialAssets.forEach(asset => {
        registerAsset(asset.url, asset.type, asset.id);
      });
    }
  }, [initialAssets, registerAsset]);

  // Get an asset by ID
  const getAsset = useCallback((id: string) => {
    return assets.find(asset => asset.id === id);
  }, [assets]);

  // Check if a set of assets are loaded
  const areAssetsLoaded = useCallback((ids: string[]) => {
    return ids.every(id => {
      const asset = assets.find(a => a.id === id);
      return asset?.loaded || false;
    });
  }, [assets]);

  // Load a model (GLB/GLTF)
  const loadModel = useCallback((asset: Asset) => {
    return new Promise<void>((resolve, reject) => {
      // Check if model is already in cache
      if (modelCache.has(asset.url)) {
        // Update asset status
        setAssets(currentAssets => 
          currentAssets.map(a => 
            a.id === asset.id 
              ? { ...a, loaded: true, progress: 1 }
              : a
          )
        );
        resolve();
        return;
      }

      const loader = new GLTFLoader();
      
      loader.load(
        asset.url,
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
          modelCache.set(asset.url, model);
          
          // Update asset status
          setAssets(currentAssets => 
            currentAssets.map(a => 
              a.id === asset.id 
                ? { ...a, loaded: true, progress: 1 }
                : a
            )
          );
          
          resolve();
        },
        // Progress callback
        (xhr) => {
          const progress = xhr.loaded / xhr.total;
          setAssets(currentAssets => 
            currentAssets.map(a => 
              a.id === asset.id 
                ? { ...a, progress: progress }
                : a
            )
          );
        },
        // Error callback
        (error) => {
          console.error(`Error loading model from ${asset.url}:`, error);
          setAssets(currentAssets => 
            currentAssets.map(a => 
              a.id === asset.id 
                ? { ...a, error: true }
                : a
            )
          );
          reject(error);
        }
      );
    });
  }, []);

  // Load a texture
  const loadTexture = useCallback((asset: Asset) => {
    return new Promise<void>((resolve, reject) => {
      // Check if texture is already in cache
      if (textureCache.has(asset.url)) {
        // Update asset status
        setAssets(currentAssets => 
          currentAssets.map(a => 
            a.id === asset.id 
              ? { ...a, loaded: true, progress: 1 }
                : a
          )
        );
        resolve();
        return;
      }

      const loader = new THREE.TextureLoader();
      
      // Load the texture
      loader.load(
        asset.url,
        (texture: THREE.Texture) => {
          // Optimize the texture
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 16;
          
          // Store in cache
          textureCache.set(asset.url, texture);
          
          // Update asset status
          setAssets(currentAssets => 
            currentAssets.map(a => 
              a.id === asset.id 
                ? { ...a, loaded: true, progress: 1 }
                : a
            )
          );
          
          resolve();
        },
        // Progress callback (not all loaders support progress)
        (xhr: { loaded: number; total: number; lengthComputable?: boolean }) => {
          if (xhr.lengthComputable) {
            const progress = xhr.loaded / xhr.total;
            setAssets(currentAssets => 
              currentAssets.map(a => 
                a.id === asset.id 
                  ? { ...a, progress: progress }
                  : a
              )
            );
          }
        },
        // Error callback
        (error: unknown) => {
          console.error(`Error loading texture from ${asset.url}:`, error);
          setAssets(currentAssets => 
            currentAssets.map(a => 
              a.id === asset.id 
                ? { ...a, error: true }
                : a
            )
          );
          reject(error);
        }
      );
    });
  }, []);

  // Load audio (no progress tracking)
  const loadAudio = useCallback((asset: Asset) => {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio();
      audio.src = asset.url;
      
      audio.addEventListener('canplaythrough', () => {
        // Update asset status
        setAssets(currentAssets => 
          currentAssets.map(a => 
            a.id === asset.id 
              ? { ...a, loaded: true, progress: 1 }
              : a
          )
        );
        resolve();
      });
      
      audio.addEventListener('error', (err) => {
        console.error(`Error loading audio from ${asset.url}:`, err);
        setAssets(currentAssets => 
          currentAssets.map(a => 
            a.id === asset.id 
              ? { ...a, error: true }
              : a
          )
        );
        reject(err);
      });
      
      // Start loading
      audio.load();
    });
  }, []);

  // Start loading all registered assets
  const startLoading = useCallback((forceReload = false) => {
    if (isLoading && !forceReload) return;
    
    setIsLoading(true);
    setIsComplete(false);
    
    // Reset progress for assets if force reload
    if (forceReload) {
      setAssets(currentAssets => 
        currentAssets.map(asset => ({
          ...asset,
          loaded: false,
          progress: 0,
          error: false
        }))
      );
    }
    
    // Filter assets that need loading
    const assetsToLoad = forceReload 
      ? assets 
      : assets.filter(asset => !asset.loaded);
    
    if (assetsToLoad.length === 0) {
      setIsLoading(false);
      setIsComplete(true);
      setTotalProgress(1);
      return;
    }
    
    // Load each asset based on its type
    const loadPromises = assetsToLoad.map(asset => {
      switch (asset.type) {
        case 'model':
          return loadModel(asset);
        case 'texture':
          return loadTexture(asset);
        case 'audio':
          return loadAudio(asset);
        default:
          // Mark as loaded immediately for unknown types
          setAssets(currentAssets => 
            currentAssets.map(a => 
              a.id === asset.id 
                ? { ...a, loaded: true, progress: 1 }
                : a
            )
          );
          return Promise.resolve();
      }
    });
    
    // When all assets are loaded
    Promise.allSettled(loadPromises).then(() => {
      setIsLoading(false);
      setIsComplete(true);
    });
  }, [assets, isLoading, loadAudio, loadModel, loadTexture]);

  // Calculate total progress whenever asset progress changes
  useEffect(() => {
    if (assets.length === 0) {
      setTotalProgress(0);
      return;
    }
    
    const totalProgress = assets.reduce((sum, asset) => sum + asset.progress, 0) / assets.length;
    setTotalProgress(totalProgress);
  }, [assets]);

  // Context value
  const value: LoadingManagerState = {
    assets,
    totalProgress,
    isLoading,
    isComplete,
    startLoading,
    registerAsset,
    getAsset,
    areAssetsLoaded,
  };

  return (
    <LoadingManagerContext.Provider value={value}>
      {children}
    </LoadingManagerContext.Provider>
  );
};

// Export the model cache for outside access
export { modelCache, textureCache };

// Function to get a cached model
export const getCachedModel = (url: string): THREE.Group | undefined => {
  const model = modelCache.get(url);
  return model ? model.clone() : undefined;
};

// Function to get a cached texture
export const getCachedTexture = (url: string): THREE.Texture | undefined => {
  return textureCache.get(url);
}; 