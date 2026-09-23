/**
 * Screen-space ambient occlusion (three.js GTAO), tuned for a scene that spans five orders of
 * magnitude.
 *
 * Direct sun and its shadow map were the only occlusion the centre had, so every crease that
 * the sun did not happen to shadow — a wheel arch, the gap between a grid fin and the hull,
 * the underside of a tower arm, a leg against the octaweb, the Roadster's cockpit — was lit by
 * the sky exactly as brightly as an open face. That is what made close views read as plastic
 * models on a table. GTAO darkens those contacts from the depth and normal buffers.
 *
 * The one thing it has to get right here is scale. A fixed world-space radius that suits the
 * Roadster's panel gaps (tens of centimetres) is invisible at 124 m of Starship, and one that
 * suits the tower smears a black halo around the car. So the radius follows the distance the
 * camera is orbiting at: a constant fraction of the frame, clamped to the physical range where
 * AO is meaningful. It is a lighting approximation, never geometry: nothing is measured from it.
 *
 * Transparent, additive and point-sprite objects (glass, plume, ground cloud, cloud dome,
 * haze) are hidden from its G-buffer, so exhaust and glazing do not cast contact shadows.
 */
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

class SceneAOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.isSprite) { o.visible = false; return; }
      const m = o.material;
      if (!m) return;
      const first = Array.isArray(m) ? m[0] : m;
      if (first && (first.transparent || first.depthWrite === false || first.blending === THREE.AdditiveBlending)) o.visible = false;
    });
  }
}

export function createAO(scene, camera, width, height) {
  const pass = new SceneAOPass(scene, camera, width, height, undefined, {
    radius: 1,
    distanceExponent: 1,
    thickness: 1,
    distanceFallOff: 1,
    scale: 1.5,
    samples: 16,
  }, {
    lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16,
  });
  pass.blendIntensity = 1;
  let lastRadius = 1;
  return {
    pass,
    /** @param distance metres from the camera to what it is looking at; on false skips the pass */
    update(distance, on) {
      pass.enabled = on;
      if (!on) return;
      const r = THREE.MathUtils.clamp(distance * 0.09, 0.35, 9);
      if (Math.abs(r - lastRadius) > lastRadius * 0.02) {
        pass.updateGtaoMaterial({ radius: r, thickness: r });
        lastRadius = r;
      }
    },
  };
}
