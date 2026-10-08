import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGltf } from './unitModelCache';

// Scenery, castles and camps from KayKit's Medieval Hexagon Pack, Halloween Bits and Dungeon
// Remastered (CC0, Kay Lousberg), packed into meshopt-compressed GLBs with one named mesh per
// model. Every model in a pack shares one small texture atlas, so each kind of prop draws as a
// single instanced mesh.

const PACK_URLS = ['/models/kaykit/medieval.glb', '/models/kaykit/halloween.glb', '/models/kaykit/dungeon.glb'];

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

let library: PropLibrary | null = null;
let loading: Promise<PropLibrary> | null = null;

export const loadPropLibrary = (): Promise<PropLibrary> => {
  loading ??= Promise.all(PACK_URLS.map(url => loadGltf(url))).then(packs => {
    const props: PropLibrary = new Map();
    for (const pack of packs) {
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
    }
    library = props;
    return props;
  });
  // Allow a retry if a pack failed to download
  loading.catch(() => { loading = null; });
  return loading;
};

// The prop library once it has loaded (null until then, so callers can show a fallback)
export const usePropLibrary = (): PropLibrary | null => {
  const [props, setProps] = useState<PropLibrary | null>(library);
  useEffect(() => {
    if (props) return;
    let cancelled = false;
    loadPropLibrary().then(loaded => { if (!cancelled) setProps(loaded); }).catch(() => {});
    return () => { cancelled = true; };
  }, [props]);
  return props;
};
