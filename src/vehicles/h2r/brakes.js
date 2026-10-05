/** The brakes' callipers. */
import * as THREE from 'three';
import { slab, mesh } from './geometry.js';

// ---- Brakes ----------------------------------------------------------------------------------------
/** A Brembo Stylema: a radial monobloc four-piston calliper, its body sculpted, two pads visible. */
export function stylema(M, decal) {
  const g = new THREE.Group();
  g.name = 'h2r-calliper';
  // Side profile: 105 mm along the disc's arc, 60 mm deep (radially), ≈48 mm across (≈).
  const prof = [[-0.052, -0.012], [-0.046, -0.03], [-0.02, -0.036], [0.02, -0.036], [0.046, -0.03], [0.052, -0.012], [0.05, 0.022], [0.03, 0.03], [-0.03, 0.03], [-0.05, 0.022]];
  for (const side of [-1, 1]) {
    const half = slab(prof, 0.014, 0.004, 2);
    half.translate(0, 0, side > 0 ? 0.006 : -0.02);
    g.add(mesh(half, M.h2rCaliper, { name: 'h2r-calliper-half' }));
  }
  const bridge = new THREE.BoxGeometry(0.1, 0.014, 0.05); bridge.translate(0, 0.024, 0);
  g.add(mesh(bridge, M.h2rCaliper, { name: 'h2r-calliper-bridge' }));
  for (const x of [-0.035, 0.035]) {
    const bolt = new THREE.CylinderGeometry(0.006, 0.006, 0.052, 6); bolt.rotateX(Math.PI / 2); bolt.translate(x, 0.0, 0.0);
    g.add(mesh(bolt, M.h2rAlu, { name: 'h2r-calliper-bolt' }));
  }
  if (decal) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.022), decal);
    d.name = 'h2r-decal-brembo'; d.position.set(0, -0.004, 0.0245);
    g.add(d);
  }
  return g;
}
