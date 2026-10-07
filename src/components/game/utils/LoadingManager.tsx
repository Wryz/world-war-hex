import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { loadGltf } from './unitModelCache';
import { preloadSound } from './SoundPlayer';
import { modelsFor } from './UnitModelSystem';
import { UnitType } from '@/types/game';

interface Asset {
  id: string;
  url: string;
  type: 'model' | 'audio';
}

// Everything a battle needs before the board is shown: the models of the troops in it, and sounds
const assetsFor = (types: UnitType[]): Asset[] => [
  ...modelsFor(types).map(url => ({ id: url, url, type: 'model' as const })),
  { id: 'hex-hover-sound', url: '/sounds/hover-1.mp3', type: 'audio' },
  { id: 'hex-select-sound', url: '/sounds/select-1.mp3', type: 'audio' }
];

interface LoadingState {
  // 0..1 across all assets
  progress: number;
  isComplete: boolean;
}

const LoadingContext = createContext<LoadingState>({ progress: 0, isComplete: false });

export const useLoadingManager = () => useContext(LoadingContext);

// Downloads the game's models and sounds once and reports overall progress.
// Models go straight into the shared model cache, so units can be created from them without another download.
export const LoadingManagerProvider: React.FC<{ children: ReactNode; types: UnitType[] }> = ({ children, types }) => {
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  // The troops in a battle don't change, so the asset list is worked out once
  const [assets] = useState(() => assetsFor(types));
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const setProgress = (id: string, value: number) => {
      if (!cancelled) setProgressById(current => ({ ...current, [id]: value }));
    };

    const loads = assets.map(asset => {
      if (asset.type === 'audio') {
        preloadSound(asset.url, asset.id);
        setProgress(asset.id, 1);
        return Promise.resolve();
      }

      return loadGltf(asset.url, event => {
        // Servers don't always send a content length
        if (event.total) setProgress(asset.id, Math.min(1, event.loaded / event.total));
      })
        .catch(error => console.error(`Could not load ${asset.url}:`, error))
        // A failed asset counts as settled so the game can still start
        .finally(() => setProgress(asset.id, 1));
    });

    Promise.allSettled(loads).then(() => {
      if (!cancelled) setIsComplete(true);
    });

    return () => {
      cancelled = true;
    };
  }, [assets]);

  const progress = assets.reduce((sum, asset) => sum + (progressById[asset.id] ?? 0), 0) / assets.length;
  const value = useMemo(() => ({ progress, isComplete }), [progress, isComplete]);

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};
