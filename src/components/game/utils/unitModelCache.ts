import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinnedObject } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Each animated unit model is downloaded once and then cloned for every unit that uses it
const gltfCache = new Map<string, Promise<GLTF>>();

export const loadGltf = (url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF> => {
  let promise = gltfCache.get(url);

  if (!promise) {
    promise = new GLTFLoader().loadAsync(url, onProgress);
    // Allow a retry if loading failed
    promise.catch(() => gltfCache.delete(url));
    gltfCache.set(url, promise);
  }

  return promise;
};

export interface UnitModelInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

// Create an independent copy of a (skinned) model that can be animated on its own
export const instantiateUnitModel = async (url: string): Promise<UnitModelInstance> => {
  const gltf = await loadGltf(url);
  const scene = cloneSkinnedObject(gltf.scene) as THREE.Group;

  scene.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
    }
  });

  return { scene, animations: gltf.animations };
};

// Free the GPU resources owned by one clone. Geometry and materials are shared with the
// cached model, so only each clone's own skeleton (and its bone texture) is disposed.
export const disposeUnitModel = (scene: THREE.Object3D, mixer?: THREE.AnimationMixer | null) => {
  mixer?.stopAllAction();
  mixer?.uncacheRoot(scene);
  scene.traverse(child => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      (child as THREE.SkinnedMesh).skeleton.dispose();
    }
  });
};

// Clip lookups by name are cached per clip list, since animations are switched every frame
const clipLookupCache = new WeakMap<THREE.AnimationClip[], Map<string, THREE.AnimationClip | undefined>>();

// Find the clip whose name contains the requested animation name, falling back to the first clip
export const findAnimationClip = (
  clips: THREE.AnimationClip[],
  animationName: string
): THREE.AnimationClip | undefined => {
  let lookup = clipLookupCache.get(clips);
  if (!lookup) {
    lookup = new Map();
    clipLookupCache.set(clips, lookup);
  }
  if (!lookup.has(animationName)) {
    const name = animationName.toLowerCase();
    lookup.set(animationName, clips.find(clip => clip.name.toLowerCase().includes(name)) ?? clips[0]);
  }
  return lookup.get(animationName);
};
