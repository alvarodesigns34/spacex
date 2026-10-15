/**
 * The Tesla Model Y (2025) from its Blender-built asset (assets/modely/modely.glb, exported from
 * the scene that blender/modely/ty_*.py build): a static exhibit beside the Porsche. On loading:
 *  - the model is turned nose to +X, as the other cars stand (Blender built it nose to −X);
 *  - a part with several materials, which glTF splits into one primitive per material, is one
 *    mesh again with its material array;
 *  - the asset carries what Blender's shaders drew procedurally as images (blender/modely/ty_bake.py):
 *    an ambient-occlusion atlas on the second UV set and tiled detail normal maps (leather grain,
 *    plastic stipple, rubber, felt, weave, carpet, brushed aluminium, perforations, metallic flake);
 *  - the materials that do not travel in a file are laid on again by name: the paint's
 *    base under its clear coat (Blender mixes it by view angle), and the glazing and lenses
 *    (Blender's panes pass shadow rays by a light-path switch; here they are thin transparent
 *    panes, each with its own tint);
 *  - every mesh casts and receives shadows, but the panes cast none.
 * If the asset cannot be had (no network, a test without a browser), an empty group stands in.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MODELY_ASSET = new URL('../../assets/modely/modely.glb', import.meta.url);

// [tint, opacity]: what Blender's two tinted surfaces of each pane let through, as one pane.
const PANES = {
  // A light tint lit by the sun read as frosted plastic: a clear pane is a dark film over what is behind it.
  TY_Glass_Clear: [[0.10, 0.125, 0.12], 0.24],
  TY_Glass_Tinted: [[0.05, 0.06, 0.06], 0.62],
  TY_Glass_Roof: [[0.03, 0.035, 0.035], 0.80],
  TY_Lens_Clear: [[0.85, 0.88, 0.92], 0.22],
  TY_Lens_Smoke_Dark: [[0.03, 0.03, 0.035], 0.82],
  TY_Lens_Smoke: [[0.20, 0.02, 0.02], 0.55],
  TY_Lens_Red: [[0.45, 0.0, 0.01], 0.70],
};

function adapt(m) {
  const pane = PANES[m.name];
  if (pane) {
    const [tint, opacity] = pane;
    return new THREE.MeshPhysicalMaterial({
      name: m.name, color: new THREE.Color().setRGB(...tint), metalness: 0, roughness: 0.03, ior: 1.52,
      transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4,
    });
  }
  if (m.name === 'TY_Paint_UltraRed') {
    // The flake (normal map) and the baked occlusion come from the file; the flakes tilt the base under a
    // smooth clear coat, as in the paint itself.
    return new THREE.MeshPhysicalMaterial({
      name: m.name, color: new THREE.Color().setRGB(0.30, 0.004, 0.008), metalness: 0.5, roughness: 0.27,
      clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3,
      normalMap: m.normalMap, normalScale: m.normalScale, aoMap: m.aoMap, aoMapIntensity: m.aoMapIntensity,
    });
  }
  return m;
}

/** The asset's scene as the runtime wants it (see above). */
export function adoptModelY(scene, associations = null) {
  const root = new THREE.Group();
  root.name = 'modely';
  const inner = scene.getObjectByName('TESLA_MODEL_Y_ROOT') ?? scene;
  inner.removeFromParent();
  inner.rotation.y += Math.PI;
  inner.position.set(-inner.position.x, inner.position.y, -inner.position.z);
  root.add(inner);
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
  const made = new Map();
  const swap = m => { if (!made.has(m)) made.set(m, adapt(m)); return made.get(m); };
  root.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    const pane = [].concat(o.material).some(m => m.transparent);
    o.castShadow = !pane; o.receiveShadow = !pane;
    if (pane) o.renderOrder = 2;
  });
  root.userData.source = 'blender';
  return root;
}

/** Loads the asset; an empty group stands in if it cannot be had. */
export async function loadModelY() {
  try {
    const res = await fetch(MODELY_ASSET);
    if (!res.ok) throw new Error(`${res.status}`);
    const gltf = await new GLTFLoader().parseAsync(await res.arrayBuffer(), '');
    return adoptModelY(gltf.scene, gltf.parser.associations);
  } catch (e) {
    console.warn(`Model Y asset not loaded (${e.message}): the exhibit stands empty`);
    const root = new THREE.Group();
    root.name = 'modely';
    root.userData.source = 'none';
    return root;
  }
}
