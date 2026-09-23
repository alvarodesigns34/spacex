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
  // Full resolution. It ran at half, on the grounds that occlusion is low-frequency; it is not
  // at a silhouette. The half-resolution term, blended up bilinearly, bled across every depth
  // edge, and on a bright surface in front of a dark one — Starman's white suit against the
  // seat, from a metre and a half — that bleed printed as a ragged, sawtoothed grey fringe
  // round the helmet and the arms. This pass only runs on the high tier.
  setSize(width, height) {
    super.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }

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
    lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 16,
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
      // Thickness well under the radius: with the two equal, a surface metres behind a thin
      // object counted as occluding it, and the object's outline wore a grainy dark halo.
      if (Math.abs(r - lastRadius) > lastRadius * 0.02) {
        pass.updateGtaoMaterial({ radius: r, thickness: r * 0.3 });
        lastRadius = r;
      }
    },
  };
}
