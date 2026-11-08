/**
 * Local reflection probes: what a vehicle's metal and glass reflect, captured from the scene round
 * it, not the one probe of sky and ground the whole site shares (environment.js). Starship's hull
 * stands ≈30 m from the launch tower; with the shared probe its near-mirror steel showed the open
 * sky where the tower's lattice stands, and nothing of the pad under it.
 *
 * Each probe is a cube render of the live scene from one point (the vehicle itself hidden), turned
 * into the same prefiltered map three.js makes of the shared probe (PMREM), and handed to private
 * copies of that vehicle's materials. It goes stale when the shared probe is rebuilt (a change of
 * the Sun, a context restored) and is retaken when the camera next comes near its vehicle, one probe
 * a frame at most. Until then, and whenever the vehicle is not where it was captured (the launch,
 * the re-entry), the copies use the shared probe, as before.
 *
 * Two things three.js does for the shared probe have to be done here by hand: a material with its
 * own envMap is not scaled by scene.environmentIntensity (the night and altitude dimming), and
 * Material.clone() does not carry onBeforeCompile or customProgramCacheKey.
 */
import * as THREE from 'three';

export function createLocalProbes(renderer, scene, { size = 256, delay = 250 } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const probes = [];

  /**
   * @param o.name     for the console and the checks
   * @param o.target   the object, or objects, whose meshes get the probe (their materials are
   *                   copied once); all of them are hidden while it is captured
   * @param o.position world position of the capture
   * @param o.active   () => true while the target is where the probe was captured
   * @param o.near     metres from the camera within which a stale probe is retaken
   */
  function add({ name, target, position, active = () => true, near = 150 }) {
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(1, 250000, rt);
    cam.position.copy(position);
    const copies = new Map();
    const targets = Array.isArray(target) ? target : [target];
    for (const t of targets) t.traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => {
        if (!m || !m.isMeshStandardMaterial || m.envMap) return m;
        let c = copies.get(m);
        if (!c) {
          c = m.clone();
          c.onBeforeCompile = m.onBeforeCompile;
          c.customProgramCacheKey = m.customProgramCacheKey;
          c.name = m.name;
          copies.set(m, c);
        }
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    const p = { name, targets, cam, rt, copies: [...copies.values()], active, near, map: null, using: null, stale: true };
    probes.push(p);
    return p;
  }

  // Captures are taken on demand, one probe a frame at most, and only for a vehicle the camera is
  // near: after a change of Sun every probe is stale, and taking all of them at once (six passes of
  // the scene each) froze the page for tens of seconds on a software renderer — the scene check's
  // next click timed out. A stale probe's vehicle uses the shared probe until it is retaken.
  let envRef = null, staleSince = 0;
  function captureOne(p, camera) {
    // The shadow map must not be redrawn while the vehicle is hidden: drawn now, it would keep the
    // vehicle's shadow out until the shadow cache next asks for a redraw (core/shadowCache.js).
    const sm = renderer.shadowMap, auto = sm.autoUpdate, need = sm.needsUpdate;
    sm.autoUpdate = false; sm.needsUpdate = false;
    const was = p.targets.map(t => t.visible);
    for (const t of p.targets) t.visible = false;
    // The sky box and the cloud dome follow whatever camera draws; put them round the probe.
    envRef.followCamera(p.cam);
    p.cam.update(renderer, scene);
    p.targets.forEach((t, i) => { t.visible = was[i]; });
    p.map?.dispose();
    p.map = pmrem.fromCubemap(p.rt.texture);
    p.stale = false;
    sm.autoUpdate = auto; sm.needsUpdate = need;
    if (camera) envRef.followCamera(camera);
  }
  /** Every stale probe now, whatever the distance (the console and the checks). */
  function captureNow(env, camera) {
    envRef = env ?? envRef;
    for (const p of probes) if (p.stale) captureOne(p, camera);
  }

  return {
    probes,
    add,
    /** Every probe is stale (a change of Sun): each is retaken when the camera next comes near it. */
    schedule(env) {
      envRef = env;
      staleSince = performance.now();
      for (const p of probes) { p.map?.dispose(); p.map = null; p.stale = true; }
    },
    captureNow,
    /**
     * Per frame: retake at most one stale probe the camera is near (`delay` ms after the last
     * change, so a dragged Sun slider costs one capture when it stops), then the probe or the shared
     * map, and the shared map's intensity, on every copy.
     */
    update(scene, camera) {
      if (envRef && camera && performance.now() - staleSince > delay) {
        const p = probes.find(q => q.stale && q.active() && q.cam.position.distanceTo(camera.position) < q.near);
        if (p) captureOne(p, camera);
      }
      for (const p of probes) {
        const map = p.map && p.active() ? p.map.texture : null;
        if (map !== p.using) {
          for (const m of p.copies) { m.envMap = map; m.needsUpdate = true; }
          p.using = map;
        }
        // With its own envMap three.js uses envMapIntensity; without, the scene's.
        const k = scene.environmentIntensity;
        for (const m of p.copies) m.envMapIntensity = k;
      }
    },
    dispose() {
      for (const p of probes) { p.rt.dispose(); p.map?.dispose(); }
      pmrem.dispose();
    },
  };
}
