import { useEffect, useState } from 'react';
import * as THREE from 'three';
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

let library: PropLibrary | null = null;
let loading: Promise<PropLibrary> | null = null;

export const loadPropLibrary = (): Promise<PropLibrary> => {
  loading ??= Promise.all(PACK_URLS.map(url => loadGltf(url))).then(packs => {
    const props: PropLibrary = new Map();
    for (const pack of packs) {
      pack.scene.updateMatrixWorld(true);
      pack.scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Each model is one mesh, named after it (or sitting under a node that is)
        const name = mesh.name || mesh.parent?.name;
        if (!name || props.has(name)) return;
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.roughness = 1;
        material.metalness = 0;
        // Lift KayKit's palette to the board's brighter colours
        material.color.setScalar(PALETTE_LIFT);
        props.set(name, { geometry, material });
      });
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
