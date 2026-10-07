import { useEffect, useRef } from 'react';
import { useLoadingManager, AssetType } from './LoadingManager';

// Define the asset entry type
interface AssetEntry {
  url: string;
  id: string;
}

// Define categories of assets that need to be loaded
const GAME_ASSETS: Record<string, AssetEntry[]> = {
  models: [
    { url: '/models/blue-knight.glb', id: 'blue-knight-model' },
    { url: '/models/red-knight.glb', id: 'red-knight-model' },
  ],
  textures: [],
  audio: [
    // Game sound effects
    { url: '/sounds/hover-1.mp3', id: 'hex-hover-sound' },
    { url: '/sounds/select-1.mp3', id: 'hex-select-sound' },
  ]
};

interface GameAssetPreloaderProps {
  onLoadingComplete?: () => void;
  children?: React.ReactNode;
}

const ALL_ASSETS = [...GAME_ASSETS.models, ...GAME_ASSETS.textures, ...GAME_ASSETS.audio];

const GameAssetPreloader: React.FC<GameAssetPreloaderProps> = ({ 
  onLoadingComplete, 
  children 
}) => {
  const { assets, registerAsset, startLoading, isComplete } = useLoadingManager();
  const loadingStartedRef = useRef(false);

  // Register all assets on mount
  useEffect(() => {
    // Register models
    GAME_ASSETS.models.forEach(asset => {
      registerAsset(asset.url, 'model' as AssetType, asset.id);
    });

    // Register textures
    GAME_ASSETS.textures.forEach(asset => {
      registerAsset(asset.url, 'texture' as AssetType, asset.id);
    });

    // Register audio
    GAME_ASSETS.audio.forEach(asset => {
      registerAsset(asset.url, 'audio' as AssetType, asset.id);
    });
  }, [registerAsset]);

  // Start loading once the registrations have reached the loading manager's state
  useEffect(() => {
    if (loadingStartedRef.current) return;
    
    const allRegistered = ALL_ASSETS.every(entry => assets.some(asset => asset.id === entry.id));
    if (!allRegistered) return;
    
    loadingStartedRef.current = true;
    startLoading();
  }, [assets, startLoading]);

  // Call onLoadingComplete when loading is done
  useEffect(() => {
    if (isComplete && onLoadingComplete) {
      onLoadingComplete();
    }
  }, [isComplete, onLoadingComplete]);

  // Just render children, this component handles the preloading in the background
  return <>{children}</>;
};

export default GameAssetPreloader; 