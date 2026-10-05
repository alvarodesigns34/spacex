/** The exhaust: the headers, the collector, the silencer. */
import * as THREE from 'three';
import { D2R, TAU, mergeAll, mesh } from './geometry.js';
import { heatTint } from './materials.js';

/**
 * The exhaust, traced on the right-side photograph (engine.js's calibration): four titanium
 * headers out of the head's front, down past the oil cooler and back under the engine, merging
 * into the collector, and the long silencer along the right side, from under the engine up to its
 * slash-cut outlet beside the rear wheel (≈0.11 m across, ≈0.6 m long).
 * The headers wear titanium's heat tint as the photographs show it (≈): straw by the ports, blue
 * and violet down the front, bronze under the engine.
 */
export function buildExhaust(M) {
  M.h2rTi ??= new THREE.MeshStandardMaterial({ name: 'h2r-titanium', color: 0xffffff, map: heatTint(), metalness: 1, roughness: 0.26 });
  const g = new THREE.Group(); g.name = 'h2r-exhaust';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const items = [];
  for (let i = 0; i < 4; i++) {
    const z = -0.114 + i * 0.076, k = i - 1.5;
    const pts = [V(0.275, 0.6, z), V(0.31, 0.53, z * 1.02), V(0.326, 0.42, z * 1.04), V(0.33 - k * 0.004, 0.29, z), V(0.3 - k * 0.006, 0.215 + k * 0.004, z * 0.85),
      V(0.22, 0.183 + k * 0.006, z * 0.6), V(0.12, 0.172 + k * 0.004, z * 0.42 + 0.02), V(0.05, 0.176, z * 0.22 + 0.05)];
    items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 90, 0.0168, 16) });
  }
  g.add(mesh(mergeAll(items), M.h2rTi, { name: 'h2r-headers' }));
  // The collector: the four into one, a cone, then the link pipe rising to the silencer.
  const col = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.07, 0.176, 0.05), V(0.02, 0.18, 0.08), V(-0.03, 0.2, 0.11)]), 24, 0.036, 20);
  g.add(mesh(col, M.h2rTi, { name: 'h2r-collector' }));
  // The silencer: a tube along its axis whose radius grows out of the link, its outlet cut on a
  // slant (the end turned ≈30° to the axis), a dark liner inside.
  const A = V(-0.03, 0.2, 0.11), B = V(-0.57, 0.405, 0.165);
  g.add(mesh(silencerGeometry(A, B, (t) => t < 0.12 ? 0.036 + (0.055 - 0.036) * (t / 0.12) ** 0.7 : 0.055, 30 * D2R), M.h2rMachined, { name: 'h2r-silencer' }));
  const ax = B.clone().sub(A), L = ax.length(); ax.normalize();
  const liner = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 32, 1, true);
  liner.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax));
  liner.translate(...A.clone().addScaledVector(ax, L - 0.06).toArray());
  M.h2rVoid ??= new THREE.MeshStandardMaterial({ name: 'h2r-void', color: 0x0a0a0b, metalness: 0.2, roughness: 0.7 });
  const linerMat = M.h2rVoid.side === THREE.DoubleSide ? M.h2rVoid : (M.h2rVoid2 ??= Object.assign(M.h2rVoid.clone(), { side: THREE.DoubleSide, name: 'h2r-void-2s' }));
  g.add(mesh(liner, linerMat, { name: 'h2r-silencer-liner' }));
  // Its two hangers' bands round the body.
  for (const t of [0.35, 0.78]) {
    const band = new THREE.TorusGeometry(0.0565, 0.004, 8, 48);
    band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), ax));
    band.translate(...A.clone().addScaledVector(ax, L * t).toArray());
    g.add(mesh(band, M.h2rSatin, { name: 'h2r-silencer-band' }));
  }
  return g;
}

/** A tube from A to B with radius r(t), t 0..1 along it, its far end cut on a slant of `slash` to the axis. */
function silencerGeometry(A, B, r, slash, rings = 40, segs = 48) {
  const ax = B.clone().sub(A), L = ax.length(); ax.normalize();
  const u = Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = u.clone().sub(ax.clone().multiplyScalar(u.dot(ax))).normalize(), e2 = ax.clone().cross(e1);
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j <= segs; j++) {
      const a = j / segs * TAU, rr = r(t), c = Math.cos(a), s = Math.sin(a);
      // The last ring set back along the axis by the slant: longest on the upper side.
      const along = L * t - (i === rings ? Math.tan(slash) * rr * (1 - c) : 0);
      const p = A.clone().addScaledVector(ax, along).addScaledVector(e1, c * rr).addScaledVector(e2, s * rr);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + segs + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
