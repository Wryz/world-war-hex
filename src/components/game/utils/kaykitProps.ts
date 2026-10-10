import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGltf } from './unitModelCache';

// Scenery, castles and camps from KayKit's Medieval Hexagon Pack, Halloween Bits and Dungeon
// Remastered (CC0, Kay Lousberg), packed into meshopt-compressed GLBs with one named mesh per
// model. Every model in a pack shares one small texture atlas, so each kind of prop draws as a
// single instanced mesh.

// Each pack downloads only when a battle needs it: the medieval one always (castles, camps, most
// scenery), the others for haunted ground and dungeon maps
export type PropPack = 'medieval' | 'halloween' | 'dungeon' | 'castles' | 'buildings';
const PACK_URLS: Record<PropPack, string> = {
  medieval: '/models/kaykit/medieval.glb',
  halloween: '/models/kaykit/halloween.glb',
  dungeon: '/models/kaykit/dungeon.glb',
  // The castle styles' buildings, for your own castle and the Style screen
  castles: '/models/kaykit/castles.glb',
  // The battlefield's buildings (watchtowers, workshops, the catapult tower, houses) in each side's colour
  buildings: '/models/kaykit/buildings.glb'
};
const MEDIEVAL_ONLY: PropPack[] = ['medieval'];

// The pack each of the optional packs' models is in (anything else is in the medieval pack)
const PACK_MODELS: Partial<Record<PropPack, string[]>> = {
  halloween: ['gravestone', 'grave_A', 'grave_B', 'gravemarker_A', 'gravemarker_B', 'crypt', 'tree_dead_small', 'tree_dead_medium',
    'tree_dead_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium', 'pumpkin_orange', 'pumpkin_orange_jackolantern',
    'pumpkin_yellow', 'fence', 'fence_broken', 'lantern_standing', 'skull', 'bone_A', 'ribcage', 'shrine_candles', 'coffin', 'post_skull'],
  dungeon: ['pillar', 'pillar_decorated', 'column', 'rubble_large', 'rubble_half', 'torch_lit', 'chest_gold', 'coin_stack_large',
    'sword_shield_broken', 'banner_patternA_red', 'barrier_column', 'candle_triple'],
  buildings: ['building_bridge_B', 'tree_single_A_cut', 'resource_lumber']
};
export const packOfModel = (model: string): PropPack =>
  (Object.keys(PACK_MODELS) as PropPack[]).find(pack => PACK_MODELS[pack]!.includes(model)) ?? 'medieval';

// KayKit's hexes are 2 units across their flat sides; ours are √3
export const KAYKIT_HEX_SCALE = Math.sqrt(3) / 2;
// How much brighter than the textures the models are drawn (the board's own colours are bright)
const PALETTE_LIFT = 1.3;

export interface PropModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export type PropLibrary = Map<string, PropModel>;

// The packs store positions and normals as small quantized integers, scaled back up by each model's
// node. Baking that scale into a quantized attribute would clip it, so copy them out as floats first.
const toFloatGeometry = (source: THREE.BufferGeometry): THREE.BufferGeometry => {
  const geometry = source.clone();
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name);
    if (!(attribute instanceof THREE.InterleavedBufferAttribute) && attribute.array instanceof Float32Array && !attribute.normalized) continue;
    const values = new Float32Array(attribute.count * attribute.itemSize);
    const read = [attribute.getX, attribute.getY, attribute.getZ, attribute.getW];
    for (let i = 0; i < attribute.count; i++) {
      for (let k = 0; k < attribute.itemSize; k++) values[i * attribute.itemSize + k] = read[k].call(attribute, i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  return geometry;
};

const loadedPacks = new Map<PropPack, PropLibrary>();
const loadingPacks = new Map<PropPack, Promise<PropLibrary>>();

const loadPack = (name: PropPack): Promise<PropLibrary> => {
  const cached = loadingPacks.get(name);
  if (cached) return cached;
  const loading = loadGltf(PACK_URLS[name]).then(pack => {
    const props: PropLibrary = new Map();
    pack.scene.updateMatrixWorld(true);
    // Each top-level node is one model, named after it; some (a windmill and its sails, a chest and
    // its lid) are made of several meshes, merged here into one
    for (const model of pack.scene.children) {
      if (!model.name || props.has(model.name)) continue;
      const parts: THREE.BufferGeometry[] = [];
      let material: THREE.MeshStandardMaterial | null = null;
      model.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const geometry = toFloatGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);
        parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
        material ??= mesh.material as THREE.MeshStandardMaterial;
      });
      if (parts.length === 0 || !material) continue;
      const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
      if (!geometry) continue;
      const shared = material as THREE.MeshStandardMaterial;
      shared.roughness = 1;
      shared.metalness = 0;
      // Lift KayKit's palette to the board's brighter colours
      shared.color.setScalar(PALETTE_LIFT);
      props.set(model.name, { geometry, material: shared });
    }
    loadedPacks.set(name, props);
    return props;
  });
  loadingPacks.set(name, loading);
  // Allow a retry if a pack failed to download
  loading.catch(() => { loadingPacks.delete(name); });
  return loading;
};

// Every model of the given packs, in one library
const combine = (packs: PropPack[]): PropLibrary | null => {
  if (!packs.every(pack => loadedPacks.has(pack))) return null;
  return new Map(packs.flatMap(pack => [...loadedPacks.get(pack)!]));
};

export const loadPropLibrary = (packs: PropPack[] = MEDIEVAL_ONLY): Promise<PropLibrary> =>
  Promise.all(packs.map(loadPack)).then(() => combine(packs)!);

// The models of the given packs once they have loaded (null until then, so callers can show a fallback)
export const usePropLibrary = (packs: PropPack[] = MEDIEVAL_ONLY): PropLibrary | null => {
  const key = [...packs].sort().join(',');
  const [state, setState] = useState<{ key: string; library: PropLibrary | null }>(() => ({ key, library: combine(packs) }));
  const library = state.key === key ? state.library : combine(packs);
  useEffect(() => {
    if (library) return;
    let cancelled = false;
    const wanted = key.split(',') as PropPack[];
    loadPropLibrary(wanted).then(loaded => { if (!cancelled) setState({ key, library: loaded }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [key, library]);
  return library;
};

// Release the GPU copies of the loaded props (see releaseSharedGpuResources in unitModelCache)
export const releasePropLibraries = () => {
  for (const library of loadedPacks.values()) {
    for (const prop of library.values()) {
      prop.geometry.dispose();
      for (const value of Object.values(prop.material)) if (value instanceof THREE.Texture) value.dispose();
      prop.material.dispose();
    }
  }
};
