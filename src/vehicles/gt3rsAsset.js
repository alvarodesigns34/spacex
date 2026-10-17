/**
 * The Porsche 911 GT3 RS from its Blender-refined asset (assets/gt3rs/gt3rs.glb, made by
 * blender/gt3rs/build.py from the code-built car): Blender rebuilds the wheels (five forged
 * Y-spokes, the machined lip, the tyres' sidewall markings) and bakes the ambient occlusion; what
 * drives the car stays in code (sim/gt3*.js) and finds its parts by the code's names. On loading:
 *  - Blender's ".001" suffixes (".001", or "001" once the loader has taken the dot out) are taken
 *    off, and a part split by material into a group of meshes is one mesh again;
 *  - every part keeps its material's library name (gt3Paint, gt3Plastic…): the library's own
 *    material goes back on it, with its surface detail (materials/detail.js), and the baked
 *    occlusion from the file as its aoMap; a material the library does not have (the wheels'
 *    machined lip) is the file's;
 *  - each wheel's spinning part is found again (userData.spin, which a file cannot carry);
 *  - the cabin is the code's (its instruments are live), put where the file left its empty;
 *  - the markings are hung on as on the code-built car (gt3rsMarkings.js).
 * If the asset cannot be had, the code-built car stands in, with its markings.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { takeBytes } from '../core/prefetch.js';
import { markSmallParts } from './lodParts.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BODY } from '../data/gt3rs.js';
import { gt3Materials } from './gt3rs.js';
import { buildCabin } from './gt3Cabin.js';
import { applyMarkings, loadGt3rs, GT3RS_MARKINGS } from './gt3rsMarkings.js';

export const GT3RS_ASSET = new URL('../../assets/gt3rs/gt3rs.glb', import.meta.url);
const WHEELS = ['gt3-wheel-fl', 'gt3-wheel-fr', 'gt3-wheel-rl', 'gt3-wheel-rr'];
const strip = (s) => s.replace(/\.?\d{3}$/, '');

/** The asset's scene as the runtime wants it (see above). */
export function adoptGt3rs(scene, M, associations = null) {
  gt3Materials(M);
  const root = scene.getObjectByName('gt3rs') ?? scene;
  root.removeFromParent();
  if (associations) {
    const split = [];
    root.traverse(o => { const a = associations.get(o); if (!o.isMesh && a && a.meshes !== undefined && a.primitives === undefined && o.children.length && o.children.every(c => c.isMesh)) split.push(o); });
    for (const g of split) {
      const parts = g.children.filter(c => c.isMesh);
      const mesh = new THREE.Mesh(mergeGeometries(parts.map(c => c.geometry), true), parts.map(c => c.material));
      mesh.name = g.name; mesh.position.copy(g.position); mesh.quaternion.copy(g.quaternion); mesh.scale.copy(g.scale);
      mesh.userData = { ...g.userData };
      g.parent.add(mesh); g.removeFromParent();
    }
  }
  root.traverse(o => { o.name = strip(o.name); });
  // The library's materials back on, each with the baked occlusion (one atlas for the whole car).
  // Only the Porsche's own materials take the occlusion: a library material the car shares with the
  // rest of the centre (the generic aluminium, the honeycomb its gt3Mesh points at) would carry it
  // onto meshes that have no second UV set.
  const own = (lib) => /^gt3-/.test(lib.name);
  const swap = (m) => {
    const key = strip(m.name);
    const lib = M[key];
    if (!lib?.isMaterial) return m;
    if (m.aoMap && !lib.aoMap && own(lib)) { lib.aoMap = m.aoMap; lib.aoMapIntensity = 1; lib.needsUpdate = true; }
    return lib;
  };
  root.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    const clear = [].concat(o.material).every(m => m.transparent);
    o.castShadow = !clear; o.receiveShadow = true;
  });
  for (const n of WHEELS) {
    const w = root.getObjectByName(n);
    if (w) w.userData.spin = w.getObjectByName(`${n}-spin`);
  }
  const old = root.getObjectByName('gt3-cabin');
  if (old) {
    const cabin = buildCabin(M);
    cabin.position.copy(old.position); cabin.quaternion.copy(old.quaternion); cabin.scale.copy(old.scale);
    old.parent.add(cabin); old.removeFromParent();
  }
  root.userData.length = BODY.length;
  root.userData.height = BODY.height;
  root.userData.lodMarked = markSmallParts(root);
  root.userData.source = 'blender';
  return root;
}

/** Loads the asset (and the markings); falls back to the code-built car. */
export async function loadGt3rsAsset(M) {
  let car;
  try {
    const gltf = await new GLTFLoader().parseAsync(await takeBytes(GT3RS_ASSET), '');
    car = adoptGt3rs(gltf.scene, M, gltf.parser.associations);
  } catch (e) {
    console.warn(`GT3 RS asset not loaded (${e.message}): the code-built car stands in`);
    return loadGt3rs(M);
  }
  try {
    const gltf = await new GLTFLoader().parseAsync(await takeBytes(GT3RS_MARKINGS), '');
    applyMarkings(car, gltf.scene);
  } catch (e) {
    console.warn(`GT3 RS markings not loaded (${e.message}): the car stands without them`);
  }
  return car;
}
