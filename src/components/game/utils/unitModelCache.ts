import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinnedObject } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Each animated unit model is downloaded once and then cloned for every unit that uses it
const gltfCache = new Map<string, Promise<GLTF>>();

const loadGltf = (url: string): Promise<GLTF> => {
  let promise = gltfCache.get(url);

  if (!promise) {
    promise = new GLTFLoader().loadAsync(url);
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

// Find the clip whose name contains the requested animation name, falling back to the first clip
export const findAnimationClip = (
  clips: THREE.AnimationClip[],
  animationName: string
): THREE.AnimationClip | undefined => {
  const name = animationName.toLowerCase();
  return clips.find(clip => clip.name.toLowerCase().includes(name)) ?? clips[0];
};
