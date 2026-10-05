/** The ram-air duct. */
import * as THREE from 'three';
import { TAU, loft, mesh } from './geometry.js';
import { PXY } from './photo.js';
import { carbonMaterial } from './materials.js';
import { SC } from './engine/supercharger.js';

/**
 * The ram-air duct, carbon: from the nose's central intake back along the left side under the
 * panel (the side photograph shows its last 0.4 m, 7 cm tall), turning in at its end to slide
 * square onto the supercharger's inlet bell (engine/supercharger.js), round there.
 */
export function buildDuct(M) {
  M.h2rCarbon ??= carbonMaterial();
  const P = (u, v, z) => new THREE.Vector3(...PXY(u, v), z);
  const path = new THREE.CatmullRomCurve3([P(150, 372, 0), P(220, 395, -0.08), P(330, 425, -0.17), P(430, 452, -0.19), P(540, 468, -0.18), new THREE.Vector3(0.07, SC.y, -0.208), new THREE.Vector3(-0.005, SC.y, -0.212), new THREE.Vector3(SC.x + 0.004, SC.y, -0.19), new THREE.Vector3(SC.x, SC.y, -0.158)], false, 'centripetal');
  const secs = [], N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = path.getPoint(t), tan = path.getTangent(t);
    const side = new THREE.Vector3(0, 1, 0).cross(tan).normalize(), up = tan.clone().cross(side).normalize();
    // (Round at the end: 34.5 mm, over the bell.)
    const kr = Math.max(0, (t - 0.78) / 0.22), h = (0.03 + 0.008 * Math.sin(Math.PI * t)) * (1 - kr) + 0.0345 * kr, w = (0.03 + 0.012 * t) * (1 - kr) + 0.0345 * kr;
    const sec = [];
    for (let k = 0; k < 16; k++) {
      // (Round the section clockwise about the path, so that its faces point out.)
      const a = -(k / 16) * TAU, c = Math.cos(a), sn = Math.sin(a), e = 0.55 + 0.45 * kr;
      sec.push(p.clone().addScaledVector(side, Math.sign(c) * Math.abs(c) ** e * w).addScaledVector(up, Math.sign(sn) * Math.abs(sn) ** e * h).toArray());
    }
    sec.push(sec[0]);
    secs.push(sec);
  }
  return mesh(loft(secs, { steps: 2, creaseDeg: 60 }), M.h2rCarbon, { name: 'h2r-ram-air-duct' });
}
