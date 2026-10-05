/**
 * The Ninja H2R from its Blender-built asset (assets/h2r/h2r.glb, made by blender/h2r/build.py):
 * the model is Blender's; what moves it stays in code (sim/h2rBike.js, sim/h2rRide.js), which
 * finds its parts by name: h2r-steer, h2r-wheel-f-spin, h2r-wheel-r-spin, h2r-swingarm,
 * h2r-impeller, h2r-dash. On loading:
 *  - Blender's ".001" suffixes on repeated names are taken off (the code's names, exactly);
 *  - a part with several materials, which glTF splits into one primitive per material (the loader
 *    makes a group of meshes), is one mesh again with its material array, as the code built it;
 *  - each material's surface detail is laid on again from its recipe (userData.detailSpec, the
 *    glTF extras: materials/detail.js's shaders do not travel in a file);
 *  - the dash is the live one (its face is redrawn by the ride), in the asset's place;
 *  - every mesh casts and receives shadows.
 * If the asset cannot be had (no network, a test without a browser), the code-built model
 * (vehicles/h2r/) stands in.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyDetail } from '../materials/detail.js';
import { partMaterials } from './h2r/materials.js';
import { buildDash } from './h2r/dash.js';
import { buildH2r } from './h2r/index.js';

export const H2R_ASSET = new URL('../../assets/h2r/h2r.glb', import.meta.url);

/** The asset's scene as the runtime wants it (see above); `M` gives the live dash its materials. */
export function adoptH2r(scene, M, associations = null) {
  const root = scene.getObjectByName('h2r') ?? scene;
  root.removeFromParent();
  if (associations) {
    const split = [];
    root.traverse(o => { const a = associations.get(o); if (!o.isMesh && a && a.meshes !== undefined && a.primitives === undefined && o.children.every(c => c.isMesh)) split.push(o); });
    for (const g of split) {
      const parts = g.children.filter(c => c.isMesh);
      const mesh = new THREE.Mesh(mergeGeometries(parts.map(c => c.geometry), true), parts.map(c => c.material));
      mesh.name = g.name; mesh.position.copy(g.position); mesh.quaternion.copy(g.quaternion); mesh.scale.copy(g.scale);
      mesh.userData = { ...g.userData };
      for (const c of g.children.filter(c => !c.isMesh)) mesh.add(c);
      g.parent.add(mesh); g.removeFromParent();
    }
  }
  root.traverse(o => { o.name = o.name.replace(/\.\d{3}$/, ''); });
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    for (const m of [].concat(o.material)) {
      if (seen.has(m)) continue; seen.add(m);
      m.name = m.name.replace(/\.\d{3}$/, '');
      const spec = m.userData.detailSpec;
      if (spec) { delete m.userData.detail; const { kind, ...opts } = spec; applyDetail(m, kind, opts); }
    }
  });
  const old = root.getObjectByName('h2r-dash');
  if (old) {
    partMaterials(M);
    const dash = buildDash(M), parent = old.parent;
    parent.remove(old); parent.add(dash);
  }
  root.userData.source = 'blender';
  return root;
}

/** Loads the asset; falls back to the code-built model. */
export async function loadH2r(M) {
  try {
    const res = await fetch(H2R_ASSET);
    if (!res.ok) throw new Error(`${res.status}`);
    const gltf = await new GLTFLoader().parseAsync(await res.arrayBuffer(), '');
    return adoptH2r(gltf.scene, M, gltf.parser.associations);
  } catch (e) {
    console.warn(`H2R asset not loaded (${e.message}): the code-built model stands in`);
    const root = buildH2r(M);
    root.userData.source = 'code';
    return root;
  }
}

