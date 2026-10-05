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
 * between the legs, the V behind the head; the head's gusset plates and bearing cups; a weld bead
 * at every tube's end.
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
  // The V behind the head (Kawasaki's photograph of the frame alone, Technical Review No. 180,
  // Fig. 4): from each upper rail in to a node on the centre line over the cylinder head, and that
  // node forward to the cross tube.
  {
    const C = P(560, 362, 0);
    for (const s of [-1, 1]) tubes.push([[P(615, 386, s * 0.138), C], R * 0.8]);
    tubes.push([[C, P(500, 345, 0)], R * 0.8]);
    bosses.push(C.clone().setZ(0.0001));
  }
  const items = [], welds = [], cyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
  // (Each tube's ends: a weld bead round it where it meets the next tube or a boss, MAG beads
  // "flat and constant", Kawasaki says, their starts and ends hidden.)
  const bead = (p, dir, r) => {
    const t = new THREE.TorusGeometry(r + 0.0006, 0.0018, 6, 24);
    t.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
    t.translate(p.x, p.y, p.z); welds.push({ geometry: t });
  };
  for (const [pts, r] of tubes) {
    if (pts.length === 2) items.push({ geometry: cyl, matrix: segMatrix(pts[0], pts[1], r) });
    else items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 64, r, 18) });
    const a = pts[0], b = pts[pts.length - 1], da = pts[1].clone().sub(a), db = b.clone().sub(pts[pts.length - 2]);
    bead(a.clone().addScaledVector(da.clone().normalize(), r * 0.9), da, r);
    bead(b.clone().addScaledVector(db.clone().normalize(), -r * 0.9), db, r);
  }
  // The head's castings: on each side a gusset plate between the upper and lower rails' starts,
  // and the bearing cups' rings at the head tube's ends.
  for (const s of [-1, 1]) {
    const hT = headTop.clone().add(new THREE.Vector3(-0.02, -0.01, s * 0.045)), hB = headBot.clone().add(new THREE.Vector3(-0.02, 0, s * 0.05));
    const u = P(440, 330, s * 0.085), l = P(455, 398, s * 0.16);
    const a = hT.clone().lerp(u, 0.35), b = hB.clone().lerp(l, 0.32);
    const pts = [hT, a, b, hB].map(v => new THREE.Vector2(v.x, v.y));
    const sh = new THREE.Shape(pts), plate = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    // (Leaning out with the rails: its z follows the line from the head out to the rails.)
    const zc = (hT.z + a.z + b.z + hB.z) / 4; plate.translate(0, 0, zc - 0.002);
    items.push({ geometry: plate });
  }
  for (const [p, d] of [[headTop, 0.004], [headBot, -0.046]]) {
    const ring = new THREE.CylinderGeometry(0.033, 0.033, 0.012, 32); ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), STEER_AXIS));
    const c = p.clone().addScaledVector(STEER_AXIS, d); ring.translate(c.x, c.y, c.z); items.push({ geometry: ring });
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
  g.add(mesh(mergeAll([...items, ...welds]), M.h2rGreen, { name: 'h2r-trellis' }));
  g.add(mesh(mergeAll(boltItems), M.h2rMachined, { name: 'h2r-trellis-bolts' }));
  return g;
}
