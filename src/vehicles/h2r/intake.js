/** The ram-air duct. */
import * as THREE from 'three';
import { TAU, loft, mesh } from './geometry.js';
import { PXY } from './photo.js';
import { carbonMaterial } from './materials.js';

/**
 * The ram-air duct, carbon: from the nose's central intake back along the left side under the
 * panel (the side photograph shows its last 0.4 m, 7 cm tall), to the supercharger's inlet.
 */
export function buildDuct(M) {
  M.h2rCarbon ??= carbonMaterial();
  const P = (u, v, z) => new THREE.Vector3(...PXY(u, v), z);
  const path = new THREE.CatmullRomCurve3([P(150, 372, 0), P(220, 395, -0.08), P(330, 425, -0.17), P(430, 452, -0.19), P(540, 468, -0.18), P(640, 482, -0.15), P(672, 478, -0.12)], false, 'centripetal');
  const secs = [], N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = path.getPoint(t), tan = path.getTangent(t);
    const side = new THREE.Vector3(0, 1, 0).cross(tan).normalize(), up = tan.clone().cross(side).normalize();
    const h = 0.03 + 0.008 * Math.sin(Math.PI * t), w = 0.03 + 0.012 * t;
    const sec = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU, c = Math.cos(a), sn = Math.sin(a), e = 0.55;
      sec.push(p.clone().addScaledVector(side, Math.sign(c) * Math.abs(c) ** e * w).addScaledVector(up, Math.sign(sn) * Math.abs(sn) ** e * h).toArray());
    }
    sec.push(sec[0]);
    secs.push(sec);
  }
  return mesh(loft(secs, { steps: 2, creaseDeg: 60 }), M.h2rCarbon, { name: 'h2r-ram-air-duct' });
}
