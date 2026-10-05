/** The green trellis frame. */
import * as THREE from 'three';
import { T, STEER_AXIS, STEER_GROUND, segMatrix, mergeAll, mesh } from './geometry.js';

// ---- The trellis --------------------------------------------------------------------------------
const LS = (u, v) => [(237.5 - u) * 1.8, 295 + (647.5 - v) * 1.8];   // side-photograph pixel → traced mm

/**
 * The green trellis (Kawasaki's photograph of it alone; nodes on the side photograph, their
 * widths triangulated with the three-quarter one): the head tube on the steering axis; on each
 * side an upper rail sweeping back from the head and down into the rear leg, a lower rail from the
 * head's foot to the leg's top, a diagonal between them, the rear leg's chain of bosses down to the
 * swingarm pivot, and the hangers to the front of the engine; cross tubes behind the head and
 * between the legs.
 */
export function buildFrame(M) {
  M.h2rGreen ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-frame-green', color: 0x229a35, metalness: 0.2, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 });
  const g = new THREE.Group(); g.name = 'h2r-frame';
  const P = (u, v, z) => { const [x, y] = LS(u, v); return T(x, y, z); };
  const headTop = STEER_GROUND.clone().addScaledVector(STEER_AXIS, 0.94 / STEER_AXIS.y), headBot = STEER_GROUND.clone().addScaledVector(STEER_AXIS, 0.80 / STEER_AXIS.y);
  const tubes = [], bosses = [];
  const R = 0.0135;
  for (const s of [-1, 1]) {
    const A = P(727, 436, s * 0.137), Mid = P(729, 511, s * 0.184), L = P(731, 574, s * 0.193), Pv = P(716, 628, s * 0.19);
    const B = P(580, 437, s * 0.205), J = P(685, 414, s * 0.15), U1 = P(530, 352, s * 0.13);
    const hT = headTop.clone().add(new THREE.Vector3(-0.02, -0.01, s * 0.045)), hB = headBot.clone().add(new THREE.Vector3(-0.02, 0, s * 0.05));
    // Upper rail: from the head's top, out and back, curving down to the leg's top.
    tubes.push([[hT, P(440, 330, s * 0.085), U1, P(630, 395, s * 0.135), A], R]);
    // Lower rail: from the head's foot, out round the cylinder head, to the junction on the upper rail.
    tubes.push([[hB, P(455, 398, s * 0.16), B, J], R]);
    // Diagonal and the short brace.
    tubes.push([[U1, B], R * 0.92]);
    tubes.push([[P(600, 375, s * 0.14), P(640, 425, s * 0.18)], R * 0.85]);
    // The rear leg's chain of bosses, down to the pivot plate.
    tubes.push([[A, Mid], R]); tubes.push([[Mid, L], R]); tubes.push([[L, Pv], R]);
    tubes.push([[B, Mid], R * 0.9]);
    // Hanger to the front of the engine, from the head's foot down to the cylinder head's mount.
    tubes.push([[hB, P(420, 470, s * 0.17)], R]);
    for (const n of [A, Mid, L, Pv, B, P(420, 470, s * 0.17)]) bosses.push(n);
  }
  // Cross tubes: behind the head, and between the legs' tops.
  tubes.push([[P(500, 345, -0.11), P(500, 345, 0.11)], R * 0.9]);
  tubes.push([[P(727, 436, -0.137), P(727, 436, 0.137)], R]);
  const items = [], cyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
  for (const [pts, r] of tubes) {
    if (pts.length === 2) items.push({ geometry: cyl, matrix: segMatrix(pts[0], pts[1], r) });
    else items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 48, r, 14) });
  }
  // The nodes' bosses, welded into the tubes (round, ≈34 mm across, as the photographs show), each
  // with the bolt it carries on its outer face (the engine's and the brackets' mounts).
  const boltItems = [];
  for (const b of bosses) {
    const s = Math.sign(b.z) || 1;
    const c = new THREE.CylinderGeometry(0.017, 0.0185, 0.03, 28); c.rotateX(Math.PI / 2); c.translate(b.x, b.y, b.z);
    items.push({ geometry: c });
    // The weld's fillet round the boss.
    const w = new THREE.TorusGeometry(0.0185, 0.0035, 8, 28); w.translate(b.x, b.y, b.z - s * 0.012);
    items.push({ geometry: w });
    const hb = new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 6); hb.rotateX(Math.PI / 2); hb.translate(b.x, b.y, b.z + s * 0.018);
    boltItems.push({ geometry: hb });
    const wa = new THREE.CylinderGeometry(0.011, 0.011, 0.0015, 24); wa.rotateX(Math.PI / 2); wa.translate(b.x, b.y, b.z + s * 0.0152);
    boltItems.push({ geometry: wa });
  }
  // The head tube on the steering axis.
  // (From just over the bottom clamp to just under the top one: it no longer stands through the
  // top clamp, where the rider saw its green end as a disc.)
  items.push({ geometry: new THREE.CylinderGeometry(1, 1, 1, 24), matrix: segMatrix(headBot.clone().addScaledVector(STEER_AXIS, -0.045), headTop.clone().addScaledVector(STEER_AXIS, 0.005), 0.03) });
  g.add(mesh(mergeAll(items), M.h2rGreen, { name: 'h2r-trellis' }));
  g.add(mesh(mergeAll(boltItems), M.h2rMachined, { name: 'h2r-trellis-bolts' }));
  return g;
}
