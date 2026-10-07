import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinnedObject } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PlayerType, UnitType } from '@/types/game';
import { HORSE_MODEL, TEAM_COLORS, getUnitLook } from './UnitModelSystem';

// Each model is downloaded once and then cloned for every unit that uses it.
// The models are meshopt-compressed, so the loader needs the meshopt decoder.
const gltfCache = new Map<string, Promise<GLTF>>();

export const loadGltf = (url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF> => {
  let promise = gltfCache.get(url);

  if (!promise) {
    promise = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url, onProgress);
    // Allow a retry if loading failed
    promise.catch(() => gltfCache.delete(url));
    gltfCache.set(url, promise);
  }

  return promise;
};

export interface UnitModelInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  // The horse under a mounted unit gallops on its own mixer
  mount?: { mixer: THREE.AnimationMixer; gallop: THREE.AnimationAction };
}

// Parts painted in each side's colour so units are easy to tell apart: capes, shields and the Mage's hat
const isTeamColoredPart = (name: string) => /(_Cape|Shield|Mage_Hat)$/.test(name);

// One team material per side, shared by every unit
const teamMaterials: Partial<Record<PlayerType, THREE.MeshStandardMaterial>> = {};
const getTeamMaterial = (owner: PlayerType) =>
  (teamMaterials[owner] ??= new THREE.MeshStandardMaterial({ color: TEAM_COLORS[owner], roughness: 0.8, flatShading: true }));

// A long pike for Pikemen: wooden shaft with a steel head, held at the lower third.
// Built in the character's own units (it is scaled along with the model).
const pikeGeometry = (() => {
  const shaft = new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6).translate(0, 0.6, 0);
  const head = new THREE.ConeGeometry(0.08, 0.32, 4).translate(0, 2.06, 0);
  return { shaft, head };
})();
const pikeMaterials = {
  shaft: new THREE.MeshStandardMaterial({ color: '#8d5a3b', flatShading: true }),
  head: new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.5, roughness: 0.4, flatShading: true })
};

const createPike = () => {
  const pike = new THREE.Group();
  pike.name = 'Pike';
  pike.add(new THREE.Mesh(pikeGeometry.shaft, pikeMaterials.shaft), new THREE.Mesh(pikeGeometry.head, pikeMaterials.head));
  pike.traverse(child => { child.castShadow = true; });
  return pike;
};

// Bones that stay in the seated pose while a rider is mounted; everything else (arms, chest, head)
// follows the normal idle and attack animations
const isLowerBodyTrack = (track: THREE.KeyframeTrack) =>
  /^(root|hips|upperleg|lowerleg|foot|toes|knee|heel|ik-|control)/i.test(track.name.split('.')[0]);

// Combine a seated lower body with each clip's upper body so a rider can fight in the saddle
const mountedClips = (clips: THREE.AnimationClip[], seatClipName: string) => {
  const seat = clips.find(clip => clip.name === seatClipName);
  if (!seat) return clips;
  const lowerBody = seat.tracks.filter(isLowerBodyTrack);
  return clips.map(clip => new THREE.AnimationClip(
    clip.name,
    Math.max(clip.duration, seat.duration),
    [...lowerBody, ...clip.tracks.filter(track => !isLowerBodyTrack(track))]
  ));
};

// Mounted rider clips are derived once per model, so every Knight shares them
const mountedClipCache = new WeakMap<THREE.AnimationClip[], THREE.AnimationClip[]>();

// Rider height and the horse's size, in the rider's (character model) units
const HORSE_SCALE = 0.0125;
const SADDLE_HEIGHT = 0.62;

const createHorse = async (): Promise<{ horse: THREE.Object3D; mixer: THREE.AnimationMixer; gallop: THREE.AnimationAction }> => {
  const gltf = await loadGltf(HORSE_MODEL);
  const horse = gltf.scene.clone(true);
  horse.scale.setScalar(HORSE_SCALE);
  let mesh: THREE.Mesh | undefined;
  horse.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      mesh = child as THREE.Mesh;
      child.castShadow = true;
    }
  });

  // The gallop clip targets the mesh by its original id, so rebind it to the cloned mesh
  const source = gltf.animations[0];
  const clip = new THREE.AnimationClip('gallop', source.duration, source.tracks.map(track => {
    const copy = track.clone();
    copy.name = `.${track.name.split('.').pop()}`;
    return copy;
  }));
  const mixer = new THREE.AnimationMixer(mesh ?? horse);
  const gallop = mixer.clipAction(clip);
  gallop.play();
  return { horse, mixer, gallop };
};

// Create an independent, animatable copy of a unit's model in its side's colours
export const instantiateUnitModel = async (unitType: UnitType, owner: PlayerType): Promise<UnitModelInstance> => {
  const look = getUnitLook(unitType);
  const gltf = await loadGltf(look.model);
  const character = cloneSkinnedObject(gltf.scene) as THREE.Group;

  let rightHand: THREE.Object3D | undefined;
  character.traverse(child => {
    if (look.hide.includes(child.name)) child.visible = false;
    if (child.name === 'handslotr') rightHand = child;
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      if (isTeamColoredPart(child.name)) (child as THREE.Mesh).material = getTeamMaterial(owner);
    }
  });

  if (look.pike && rightHand) rightHand.add(createPike());

  const scene = new THREE.Group();
  scene.add(character);

  if (!look.mounted) return { scene, animations: gltf.animations };

  // Knights ride: sit the rider in the saddle of a galloping horse
  let animations = mountedClipCache.get(gltf.animations);
  if (!animations) {
    animations = mountedClips(gltf.animations, 'Sit_Chair_Idle');
    mountedClipCache.set(gltf.animations, animations);
  }
  const { horse, mixer, gallop } = await createHorse();
  scene.add(horse);
  character.position.set(0, SADDLE_HEIGHT, -0.1);
  return { scene, animations, mount: { mixer, gallop } };
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

// Find the clip with the requested name (or, failing that, one containing it), falling back to the first clip
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
    lookup.set(
      animationName,
      clips.find(clip => clip.name.toLowerCase() === name) ??
        clips.find(clip => clip.name.toLowerCase().includes(name)) ??
        clips[0]
    );
  }
  return lookup.get(animationName);
};
