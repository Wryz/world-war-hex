import { useEffect } from 'react';
import { releaseSharedUnitResources } from './unitModelCache';
import { releasePropLibraries } from './kaykitProps';

// Every 3D view (the battle, the skill tree's scene, the previews) shares one copy of each model,
// prop and material. A renderer that draws a shared material or texture listens for its disposal,
// so a closed view's renderer - with its canvas and the page around it - stays in memory as long
// as the shared object does. Releasing the shared objects' GPU copies as a view closes lets it go;
// the objects stay usable, and the next view to draw them uploads them again.
export const releaseSharedGpuResources = () => {
  releaseSharedUnitResources();
  releasePropLibraries();
};

// For a component holding a 3D Canvas: release the shared resources when it goes
export const useReleaseGpuOnUnmount = () => {
  useEffect(() => () => releaseSharedGpuResources(), []);
};
