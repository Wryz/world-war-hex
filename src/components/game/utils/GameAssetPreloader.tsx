import { useEffect, useState } from 'react';
import { useLoadingManager, AssetType } from './LoadingManager';

// Define the asset entry type
interface AssetEntry {
  url: string;
  id: string;
}

// Define categories of assets that need to be loaded
const GAME_ASSETS: Record<string, AssetEntry[]> = {
  models: [
    { url: '/models/rocks-1.glb', id: 'rock-model' },
    { url: '/models/tree-1.glb', id: 'tree1-model' },
    { url: '/models/tree-2.glb', id: 'tree2-model' },
    { url: '/models/bush-1.glb', id: 'bush-model' },
    { url: '/models/rock-gold-1.glb', id: 'gold-rock-model' },
    { url: '/models/blue-knight.glb', id: 'blue-knight-model' },
    { url: '/models/red-knight.glb', id: 'red-knight-model' },
  ],
  textures: [
    { url: '/textures/sky.jpg', id: 'sky-texture' },
    { url: '/textures/grass_texture.jpg', id: 'grass-plain-texture' },
  ],
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

const GameAssetPreloader: React.FC<GameAssetPreloaderProps> = ({ 
  onLoadingComplete, 
  children 
}) => {
  const { registerAsset, startLoading, isComplete } = useLoadingManager();
  const [assetsRegistered, setAssetsRegistered] = useState(false);

  // Register all assets on mount
  useEffect(() => {
    if (assetsRegistered) return;

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

    setAssetsRegistered(true);

    // Start loading assets
    startLoading();
  }, [registerAsset, startLoading, assetsRegistered]);

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