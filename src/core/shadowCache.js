/**
 * When the sun's shadow map is drawn.
 *
 * Three.js draws the shadow map inside every `renderer.render()` call that sees a shadow-casting
 * light. A frame here makes two such calls on the high tier — the scene itself and the ambient
 * occlusion pass's normal buffer — so the whole scene was drawn into a 4096² depth map twice a
 * frame, for two identical results (the pass that colours the image is the first one).
 *
 * So the renderer's own refresh is switched off and this decides, once a frame, whether the map
 * is out of date. It is when something that could change it has changed since the last time:
 *
 *   · the light: its position and target (already snapped to the texel grid by
 *     `updateShadow`, so an orbiting camera that keeps its target leaves it alone) and the
 *     size of its frustum;
 *   · a caster: any visible mesh, line or point cloud that casts a shadow (see sceneSignature.js);
 *   · a sequence or a drive that moves things: it asks for every frame outright.
 *
 * A map older than `maxAgeMs` (1 s) is redrawn whatever the signature says, so a change this does
 * not see (a shader that moves vertices) shows for a moment and never stays. Nothing it skips would
 * have drawn anything different: the map is a pure function of the light and of the casters, and
 * both are the same.
 *
 * The windsock turns every frame with the wind. It is flagged `userData.shadowLocal`, and only
 * counts while it is near enough to the shadow target to be inside the frustum.
 */
import * as THREE from 'three';
import { createSceneSignature } from './sceneSignature.js';

const MAX_AGE_MS = 1000;
const LIGHT_VALUES = 12;

export function createShadowCache(renderer, scene, sun) {
  const map = renderer.shadowMap;
  // Off for good: this module is the only thing that asks for a redraw.
  map.autoUpdate = false;
  map.needsUpdate = true;

  const light = new Float64Array(LIGHT_VALUES);
  let lastDraw = -Infinity;
  const stats = { frames: 0, draws: 0, enabled: true, maxAgeMs: MAX_AGE_MS };
  const target = new THREE.Vector3();
  const at = new THREE.Vector3();
  let reach = 0;
  const signature = createSceneSignature({
    include: (o) => (o.isMesh || o.isLine || o.isPoints) && o.castShadow,
    // Only worth a redraw while it can be in the frustum.
    skip: (o, e) => o.userData.shadowLocal && at.set(e[12], e[13], e[14]).distanceTo(target) > reach,
  });

  /** True when the sun, its frustum or its target differ from the last signature (and stores it). */
  function lightChanged() {
    const c = sun.shadow.camera;
    let changed = false;
    const put = (i, v) => { if (light[i] !== v) { changed = true; light[i] = v; } };
    put(0, sun.position.x); put(1, sun.position.y); put(2, sun.position.z);
    put(3, sun.target.position.x); put(4, sun.target.position.y); put(5, sun.target.position.z);
    put(6, c.left); put(7, c.right); put(8, c.top); put(9, c.bottom); put(10, c.far);
    put(11, sun.castShadow && sun.visible ? 1 : 0);
    return changed;
  }

  return {
    stats,
    /** Call once a frame, after everything that moves has been updated and before rendering. */
    prepare(nowMs, everyFrame = false) {
      if (!map.enabled) return;
      stats.frames++;
      let dirty = everyFrame || !stats.enabled || nowMs - lastDraw >= stats.maxAgeMs;
      if (lightChanged()) dirty = true;
      // The frustum's reach: its half-size (the light camera's, in its own plane) plus the
      // height a caster can be projected from along a low sun.
      target.copy(sun.target.position);
      const cam = sun.shadow.camera;
      reach = Math.max(cam.right, cam.top) * 1.5 + 150;
      if (signature.changed(scene)) dirty = true;
      if (dirty) { map.needsUpdate = true; lastDraw = nowMs; stats.draws++; }
    },
    /** The next prepare() draws: after a lost context or anything else that empties the map. */
    invalidate() { signature.reset(); lastDraw = -Infinity; map.needsUpdate = true; },
    /** For tests: with false it draws every frame, as the renderer's own refresh would. */
    set enabled(v) { stats.enabled = !!v; },
    get enabled() { return stats.enabled; },
  };
}
