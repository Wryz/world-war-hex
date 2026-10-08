// Packs chosen KayKit models (CC0, Kay Lousberg) into one meshopt-compressed GLB: one named node
// per model, all sharing the pack's texture atlas.
//   node scripts/build-kaykit-pack.mjs <output.glb> <name=path/to/model.gltf> ...
// Needs @gltf-transform/core, @gltf-transform/functions, @gltf-transform/extensions and meshoptimizer
// (npm i -D them, or run it from a folder that has them). The packs in public/models/kaykit/ were
// built from the glTF files in KayKit's GitHub releases.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, unpartition, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const [, , output, ...entries] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready;

const target = await io.read(entries[0].split('=')[1]);
const rename = (document, name) => {
  const scene = document.getRoot().listScenes().at(-1);
  const roots = scene.listChildren();
  roots.forEach(node => node.setName(name));
};
rename(target, entries[0].split('=')[0]);
const mainScene = target.getRoot().listScenes()[0];
for (const entry of entries.slice(1)) {
  const [name, path] = entry.split('=');
  const source = await io.read(path);
  rename(source, name);
  const map = mergeDocuments(target, source);
  // Move the merged scene's nodes into the main scene
  for (const scene of source.getRoot().listScenes()) {
    const merged = map.get(scene);
    for (const child of merged.listChildren()) mainScene.addChild(child);
    merged.dispose();
  }
}
target.getRoot().setDefaultScene(mainScene);
await target.transform(dedup(), unpartition(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, target);
console.log('nodes', mainScene.listChildren().map(node => node.getName()).join(' '));
