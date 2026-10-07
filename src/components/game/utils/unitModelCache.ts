import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinnedObject } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PlayerType, UnitType } from '@/types/game';
import {
  ANIMATION_PACK_URL, HORSE_MODEL, HumanoidLook, MODEL_URLS, Palette, TEAM_COLORS, getUnitLook
} from './UnitModelSystem';
import type { CreatureRig } from './creatureTypes';
import { createCreature, createHorns, createWings } from './creatures';

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

// The animation clips every character shares
const loadAnimationPack = () => loadGltf(ANIMATION_PACK_URL).then(gltf => gltf.animations);

type Wings = ReturnType<typeof createWings>;

export interface UnitModelInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  // The horse under a mounted unit gallops on its own mixer
  mount?: { mixer: THREE.AnimationMixer; gallop: THREE.AnimationAction };
  // Procedural monsters animate themselves
  rig?: CreatureRig;
  // Wings that flap (demons, pegasi)
  wings?: Wings;
}

// --- Team colours and palettes -------------------------------------------------------------

// Parts painted in each side's colour so units are easy to tell apart: capes, cloaks, shields and the Mage's hat
const isTeamColoredPart = (name: string) => /(_Cape|_Cloak|Shield|Mage_Hat)$/.test(name);

// One team material per side, shared by every unit
const teamMaterials: Partial<Record<PlayerType, THREE.MeshStandardMaterial>> = {};
const getTeamMaterial = (owner: PlayerType) =>
  (teamMaterials[owner] ??= new THREE.MeshStandardMaterial({ color: TEAM_COLORS[owner], roughness: 0.8, flatShading: true }));

// KayKit characters are coloured from a texture atlas of 8 x 4 gradient swatches. Each swatch is
// classified by its colour (skin, bone, metal, leather or cloth) and repainted with the palette's
// colour for that class, keeping the swatch's shading.
type SwatchClass = keyof Omit<Palette, 'glow'>;

const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 4;

// Texture pixels are sRGB bytes, so colours here are plain sRGB 0-255 triples (three.js colours
// would be converted to linear space)
type Rgb = [number, number, number];
const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const SKIN = hexToRgb('#f6c09c');
const BONES = [hexToRgb('#e7cdb4'), hexToRgb('#e0bd9b')];

const classifySwatch = (r: number, g: number, b: number): SwatchClass => {
  const distance = ([or, og, ob]: Rgb) => Math.hypot(r - or, g - og, b - ob);
  if (distance(SKIN) < 40) return 'skin';
  if (BONES.some(bone => distance(bone) < 22)) return 'bone';
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.s < 0.16 || hsl.l < 0.12) return 'metal';
  const hue = hsl.h * 360;
  if (hue >= 5 && hue <= 40 && hsl.s < 0.6 && hsl.l < 0.62) return 'leather';
  return 'cloth';
};

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

const paletteTextures = new Map<string, THREE.Texture>();

const repaintAtlas = (source: THREE.Texture, palette: Palette, key: string): THREE.Texture => {
  const cached = paletteTextures.get(key);
  if (cached) return cached;

  const image = source.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const cellWidth = canvas.width / ATLAS_COLUMNS;
  const cellHeight = canvas.height / ATLAS_ROWS;

  for (let row = 0; row < ATLAS_ROWS; row++) {
    for (let column = 0; column < ATLAS_COLUMNS; column++) {
      // Sample the swatch left of the thin highlight strip on its right edge
      const sx = Math.floor((column + 0.3) * cellWidth);
      const sy = Math.floor((row + 0.5) * cellHeight);
      const s = (sy * canvas.width + sx) * 4;
      const target = palette[classifySwatch(data[s], data[s + 1], data[s + 2])];
      if (!target) continue;

      const reference = Math.max(1, luminance(data[s], data[s + 1], data[s + 2]));
      const [tr, tg, tb] = hexToRgb(target);
      for (let y = Math.floor(row * cellHeight); y < Math.floor((row + 1) * cellHeight); y++) {
        for (let x = Math.floor(column * cellWidth); x < Math.floor((column + 1) * cellWidth); x++) {
          const i = (y * canvas.width + x) * 4;
          const shade = luminance(data[i], data[i + 1], data[i + 2]) / reference;
          data[i] = Math.min(255, tr * shade);
          data[i + 1] = Math.min(255, tg * shade);
          data[i + 2] = Math.min(255, tb * shade);
        }
      }
    }
  }
  context.putImageData(pixels, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = source.flipY;
  texture.colorSpace = source.colorSpace;
  texture.magFilter = source.magFilter;
  texture.minFilter = source.minFilter;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  paletteTextures.set(key, texture);
  return texture;
};

// Repainted copies of a model's material, shared by every unit with the same look
const paletteMaterials = new Map<string, THREE.Material>();

const getPaletteMaterial = (material: THREE.Material, look: HumanoidLook): THREE.Material => {
  const palette = look.palette;
  const standard = material as THREE.MeshStandardMaterial;
  if (!palette || !standard.isMeshStandardMaterial) return material;

  const isGlow = !standard.map;
  if (isGlow && !palette.glow) return material;
  const key = `${look.model}:${material.uuid}:${JSON.stringify(palette)}`;
  let repainted = paletteMaterials.get(key);
  if (!repainted) {
    const copy = standard.clone();
    if (isGlow) {
      // Skeletons' glowing eyes
      copy.color.set(palette.glow!);
      copy.emissive.set(palette.glow!);
      copy.emissiveIntensity = 1.5;
    } else {
      copy.map = repaintAtlas(standard.map!, palette, `${look.model}:${JSON.stringify(palette)}`);
    }
    paletteMaterials.set(key, copy);
    repainted = copy;
  }
  return repainted;
};

// --- Props ---------------------------------------------------------------------------------

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

// --- Mounts --------------------------------------------------------------------------------

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

// Mounted rider clips are derived once, so every rider shares them
const mountedClipCache = new WeakMap<THREE.AnimationClip[], THREE.AnimationClip[]>();

// Rider height and the horse's size, in the rider's (character model) units
const HORSE_SCALE = 0.0125;
const SADDLE_HEIGHT = 0.62;

const tintedHorseMaterials = new Map<string, THREE.Material>();

const createHorse = async (tint?: string): Promise<{ horse: THREE.Object3D; mixer: THREE.AnimationMixer; gallop: THREE.AnimationAction }> => {
  const gltf = await loadGltf(HORSE_MODEL);
  const horse = gltf.scene.clone(true);
  horse.scale.setScalar(HORSE_SCALE);
  let mesh: THREE.Mesh | undefined;
  horse.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      mesh = child as THREE.Mesh;
      child.castShadow = true;
      if (tint) {
        const original = mesh.material as THREE.MeshStandardMaterial;
        let material = tintedHorseMaterials.get(tint);
        if (!material) {
          const copy = original.clone();
          // The horse is coloured by vertex colours; a tinted horse is a single colour instead
          copy.color.set(tint);
          copy.vertexColors = false;
          tintedHorseMaterials.set(tint, copy);
          material = copy;
        }
        mesh.material = material;
      }
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

// --- Instancing ----------------------------------------------------------------------------

const instantiateHumanoid = async (look: HumanoidLook, owner: PlayerType): Promise<UnitModelInstance> => {
  const [gltf, pack] = await Promise.all([loadGltf(MODEL_URLS[look.model]), loadAnimationPack()]);
  const character = cloneSkinnedObject(gltf.scene) as THREE.Group;

  let rightHand: THREE.Object3D | undefined;
  let head: THREE.Object3D | undefined;
  let chest: THREE.Object3D | undefined;
  character.traverse(child => {
    if (child.name === 'handslotr' || child.name === 'handslot.r') rightHand = child;
    if (child.name === 'head') head = child;
    if (child.name === 'chest') chest = child;
    // Weapons and shields hang from the hand slots: only show the ones this troop carries
    const parentName = child.parent?.name ?? '';
    if (/^handslot/.test(parentName) && !look.weapons.includes(child.name)) child.visible = false;
    if (look.hide?.includes(child.name)) child.visible = false;
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.material = isTeamColoredPart(child.name)
        ? getTeamMaterial(owner)
        : getPaletteMaterial(mesh.material as THREE.Material, look);
    }
  });

  if (look.pike && rightHand) rightHand.add(createPike());
  if (look.horns && head) {
    const horns = createHorns(look.horns, 0.35);
    horns.position.set(0, 0.55, 0);
    head.add(horns);
  }
  let wings: Wings | undefined;
  if (look.wings && chest) {
    wings = createWings(look.wings, 2.2);
    wings.object.position.set(0, 0.25, -0.25);
    chest.add(wings.object);
  }

  const scene = new THREE.Group();
  scene.add(character);

  if (!look.mount) return { scene, animations: pack, wings };

  // Riders sit in the saddle of a galloping horse
  let animations = mountedClipCache.get(pack);
  if (!animations) {
    animations = mountedClips(pack, 'Sit_Chair_Idle');
    mountedClipCache.set(pack, animations);
  }
  const { horse, mixer, gallop } = await createHorse(look.mount.tint);
  scene.add(horse);
  if (look.mount.wings) {
    wings = createWings('#f8fafc', 2.4);
    wings.object.position.set(0, 0.85, 0.15);
    scene.add(wings.object);
  }
  character.position.set(0, SADDLE_HEIGHT, -0.1);
  return { scene, animations, mount: { mixer, gallop }, wings };
};

// Create an independent, animatable copy of a unit's model in its side's colours
export const instantiateUnitModel = async (unitType: UnitType, owner: PlayerType): Promise<UnitModelInstance> => {
  const look = getUnitLook(unitType);
  if (look.kind === 'humanoid') return instantiateHumanoid(look, owner);

  const rig = createCreature(look, TEAM_COLORS[owner]);
  const scene = new THREE.Group();
  scene.add(rig.object);
  return { scene, animations: [], rig };
};

// Free the GPU resources owned by one clone. Geometry and materials are shared with the
// cached model, so only each clone's own skeleton (and its bone texture) is disposed.
export const disposeUnitModel = (instance: Pick<UnitModelInstance, 'scene' | 'rig' | 'wings'>, mixer?: THREE.AnimationMixer | null) => {
  const { scene } = instance;
  mixer?.stopAllAction();
  mixer?.uncacheRoot(scene);
  instance.rig?.dispose();
  instance.wings?.dispose();
  scene.traverse(child => {
    // Horns carry their own clean-up
    (child.userData.dispose as (() => void) | undefined)?.();
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
