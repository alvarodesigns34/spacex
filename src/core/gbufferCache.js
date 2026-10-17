/**
 * When the ambient occlusion's depth and normal buffer is drawn.
 *
 * The AO pass draws the whole opaque scene a second time every frame, with a normal material, to get
 * the depth and the normals it works from. When neither the camera nor anything the camera sees has
 * changed, that second picture is the one it drew a frame ago. This decides, once a frame, whether
 * it is: the pass keeps the buffer it has and runs the AO and the denoise on it, which is what a
 * redraw would have produced.
 *
 * The buffer is a function of the camera (position, orientation, lens, view offset), of the size of
 * the target, and of the opaque meshes in view — the ones GTAOPass does not hide while it draws:
 * not points, lines or sprites, and not transparent, additive or depth-write-free materials
 * (exhaust, clouds, glass). A change in any of them draws it. Sequences that move things ask for every
 * frame; a lost context, a resize and the pass coming back from being switched off draw it too; and a
 * buffer older than `maxAgeMs` (1 s) is drawn again whatever the signature says.
 *
 * Objects flagged `userData.shadowLocal` (the windsock turns every frame) count only while they are
 * big enough to show: under 1.5 px across, a stale mast cannot change a pixel.
 */
import * as THREE from 'three';
import { createSceneSignature } from './sceneSignature.js';

const MAX_AGE_MS = 1000;
const MIN_PIXELS = 1.5;
const CAMERA_VALUES = 30;

/** Whether GTAOPass would draw this object into its buffer (see overrideVisibility in ao.js). */
function inBuffer(o) {
  if (!o.isMesh) return false;
  const m = o.material;
  if (!m) return false;
  const first = Array.isArray(m) ? m[0] : m;
  return !(first && (first.transparent || first.depthWrite === false || first.blending === THREE.AdditiveBlending));
}

export function createGBufferCache(pass, scene, camera) {
  pass.reuseGBuffer = false;
  const stats = { frames: 0, draws: 0, enabled: true, maxAgeMs: MAX_AGE_MS };
  const cam = new Float64Array(CAMERA_VALUES);
  let lastDraw = -Infinity;
  let wasOn = false;
  const at = new THREE.Vector3();
  const _s = new THREE.Vector3();
  let mpp = 1;
  const signature = createSceneSignature({
    include: inBuffer,
    skip: (o, e) => {
      if (!o.userData.shadowLocal) return false;
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const r = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
      const d = at.set(e[12], e[13], e[14]).distanceTo(camera.position);
      return d > 1e-6 && (2 * r) / (d * mpp) < MIN_PIXELS;
    },
  });

  function cameraChanged() {
    let changed = false;
    const put = (i, v) => { if (cam[i] !== v) { changed = true; cam[i] = v; } };
    put(0, camera.position.x); put(1, camera.position.y); put(2, camera.position.z);
    put(3, camera.quaternion.x); put(4, camera.quaternion.y); put(5, camera.quaternion.z); put(6, camera.quaternion.w);
    const p = camera.projectionMatrix.elements;
    for (let k = 0; k < 16; k++) put(7 + k, p[k]);
    put(23, pass.width); put(24, pass.height);
    put(25, camera.near); put(26, camera.far);
    // A parent's motion reaches the camera's world matrix only at render time: one frame late, as for any object.
    const w = camera.matrixWorld.elements;
    put(27, w[12]); put(28, w[13]); put(29, w[14]);
    return changed;
  }

  return {
    stats,
    /** Call once a frame, after `ao.update()` and before rendering. */
    prepare(nowMs, everyFrame = false) {
      if (!pass.enabled) { wasOn = false; pass.reuseGBuffer = false; return; }
      stats.frames++;
      mpp = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, pass.height);
      let dirty = everyFrame || !stats.enabled || !wasOn || pass.gbufferStale || nowMs - lastDraw >= stats.maxAgeMs;
      wasOn = true;
      if (cameraChanged()) dirty = true;
      if (signature.changed(scene)) dirty = true;
      pass.reuseGBuffer = !dirty;
      if (dirty) { lastDraw = nowMs; stats.draws++; }
    },
    /** The next prepare() draws: after a lost context or anything else that empties the buffer. */
    invalidate() { signature.reset(); lastDraw = -Infinity; wasOn = false; pass.reuseGBuffer = false; },
    /** For tests: with false it draws every frame, as the pass would on its own. */
    set enabled(v) { stats.enabled = !!v; },
    get enabled() { return stats.enabled; },
  };
}
