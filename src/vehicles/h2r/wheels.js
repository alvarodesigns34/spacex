/**
 * The wheels: the slicks, the rims and their spokes, the hubs, the discs on their carriers, the
 * rear sprocket and its carrier.
 */
import * as THREE from 'three';
import { AXLE_F, AXLE_R, TAU, slab, mergeAll, mesh } from './geometry.js';
import { partMaterials } from './materials.js';
import { WHEELS } from '../../data/h2r.js';

// ---- Wheels ----------------------------------------------------------------------------------------
/**
 * A slick's section: a round crown (a superellipse, ≈ the 120 and 190 mm sections' profiles)
 * down to the bead on the rim, revolved.
 */
function tyreGeometry(R, width, rimR, beadHalf) {
  const pts = [], hw = width / 2, h = R - rimR;
  pts.push(new THREE.Vector2(rimR - 0.004, -beadHalf));
  pts.push(new THREE.Vector2(rimR + 0.012, -beadHalf - 0.006));
  for (let i = 0; i <= 40; i++) {
    const t = -Math.PI / 2 + Math.PI * i / 40, c = Math.cos(t), s = Math.sin(t);
    // Superellipse exponent ≈2.4: a fuller shoulder than a circle, as a slick's.
    const e = 2 / 2.4;
    const z = hw * Math.sign(s) * Math.abs(s) ** e, r = rimR + 0.012 + (h - 0.012) * Math.abs(c) ** e;
    pts.push(new THREE.Vector2(r, z));
  }
  pts.push(new THREE.Vector2(rimR + 0.012, beadHalf + 0.006));
  pts.push(new THREE.Vector2(rimR - 0.004, beadHalf));
  const g = new THREE.LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2);   // axle along z
  return g;
}

/** The rim's barrel and flanges, revolved: black, the flange lip machined. */
function rimGeometry(rimR, beadHalf, dish) {
  const pts = [
    new THREE.Vector2(rimR - 0.020, -beadHalf - 0.004), new THREE.Vector2(rimR + 0.010, -beadHalf - 0.004), new THREE.Vector2(rimR + 0.012, -beadHalf + 0.004),
    new THREE.Vector2(rimR - 0.006, -beadHalf + 0.006), new THREE.Vector2(rimR - 0.010, dish), new THREE.Vector2(rimR - 0.006, beadHalf - 0.006),
    new THREE.Vector2(rimR + 0.012, beadHalf - 0.004), new THREE.Vector2(rimR + 0.010, beadHalf + 0.004), new THREE.Vector2(rimR - 0.020, beadHalf + 0.004),
  ];
  const g = new THREE.LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2);
  return g;
}

/** The front wheel's spokes: five pairs, each pair a narrow V from the hub to the rim (≈ the photographs). */
function frontSpokes(rimR) {
  const items = [], edges = [];
  for (let i = 0; i < 5; i++) {
    const c = (i / 5) * TAU + 0.31;
    for (const d of [-1, 1]) {
      const a0 = c + d * 0.09, a1 = c + d * 0.24;
      const r0 = 0.058, r1 = rimR - 0.012;
      const shape = [[Math.cos(a0 - 0.08) * r0, Math.sin(a0 - 0.08) * r0], [Math.cos(a1 - 0.022) * r1, Math.sin(a1 - 0.022) * r1], [Math.cos(a1 + 0.022) * r1, Math.sin(a1 + 0.022) * r1], [Math.cos(a0 + 0.08) * r0, Math.sin(a0 + 0.08) * r0]];
      const g = slab(shape, 0.018, 0.0025);
      g.translate(0, 0, -0.009);
      items.push({ geometry: g });
      const e = slab(shape.map(([x, y]) => [x * 1.0, y * 1.0]), 0.001, 0);
      e.scale(0.98, 0.98, 1); e.translate(0, 0, 0.0125);
      edges.push({ geometry: e });
    }
  }
  return { body: mergeAll(items), edge: mergeAll(edges) };
}

/**
 * The rear wheel's star (the photographs): a hollow five-pointed star of slender arms whose points
 * meet the rim, and five short spokes from the hub to its inner corners; black, the arms' outer
 * edges machined bright.
 */
function rearStar(rimR) {
  const bars = [], edges = [];
  const bar = (A, B, w, d, list) => list.push({ geometry: new THREE.BoxGeometry(1, 1, 1), matrix: new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize()), new THREE.Vector3(A.distanceTo(B) + w * 0.6, w, d)) });
  const V = (r, a, z = 0) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + Math.PI / 2, rt = rimR - 0.004, ri = 0.118;
    for (const d of [-1, 1]) {
      const T0 = V(rt, a), I0 = V(ri, a + d * TAU / 10);
      bar(T0, I0, 0.02, 0.03, bars);
      bar(V(rt - 0.004, a, 0.016), V(ri, a + d * TAU / 10, 0.016), 0.006, 0.002, edges);
    }
    bar(V(0.05, a + TAU / 10), V(0.118, a + TAU / 10), 0.024, 0.032, bars);
  }
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 32); hub.rotateX(Math.PI / 2);
  bars.push({ geometry: hub });
  return { body: mergeAll(bars), edge: mergeAll(edges) };
}

/** A wheel group at its axle: the tyre (static), and a spinning group with rim, spokes, discs, hub. */
export function buildWheel(M, which) {
  partMaterials(M);
  const front = which === 'f';
  const W = front ? WHEELS.front : WHEELS.rear;
  const g = new THREE.Group();
  g.name = `h2r-wheel-${which}`;
  g.position.copy(front ? AXLE_F : AXLE_R);
  const R = W.dia / 2, rimR = W.rimDia / 2, beadHalf = front ? 0.0445 : 0.0762;   // rims ≈17 × 3.50 and 17 × 6.00
  const spin = new THREE.Group();
  spin.name = `h2r-wheel-${which}-spin`;
  g.add(spin);
  spin.add(mesh(tyreGeometry(R, W.width, rimR, beadHalf), M.h2rTyre, { name: `h2r-tyre-${which}` }));
  spin.add(mesh(rimGeometry(rimR, beadHalf, 0), M.h2rRim, { name: 'h2r-rim' }));
  for (const s of [-1, 1]) {
    const lip = new THREE.TorusGeometry(rimR + 0.011, 0.0018, 4, 96); lip.translate(0, 0, s * (beadHalf + 0.004));
    spin.add(mesh(lip, M.h2rMachined, { name: 'h2r-rim-lip' }));
  }
  if (front) {
    // The front rim's thin green stripe on its outer face (the detail photograph).
    const st = new THREE.RingGeometry(rimR - 0.004, rimR + 0.0, 96); st.translate(0, 0, beadHalf + 0.0045);
    spin.add(mesh(st, M.h2rRimStripe, { name: 'h2r-rim-stripe' }));
    const sp = frontSpokes(rimR);
    spin.add(mesh(sp.body, M.h2rRim, { name: 'h2r-spokes' }), mesh(sp.edge, M.h2rMachined, { name: 'h2r-spoke-edges' }));
  } else {
    const st = rearStar(rimR);
    spin.add(mesh(st.body, M.h2rRim, { name: 'h2r-spokes' }), mesh(st.edge, M.h2rMachined, { name: 'h2r-spoke-edges' }));
  }
  // Hub and axle.
  const hub = new THREE.CylinderGeometry(0.045, 0.045, front ? 0.12 : 0.17, 32); hub.rotateX(Math.PI / 2);
  spin.add(mesh(hub, M.h2rRim, { name: 'h2r-hub' }));
  const axle = new THREE.CylinderGeometry(0.0125, 0.0125, front ? 0.25 : 0.24, 16); axle.rotateX(Math.PI / 2);
  g.add(mesh(axle, M.h2rAlu, { name: 'h2r-axle' }));
  // Discs: the braking band with its holes, on a black carrier, joined by floating buttons.
  const discs = front ? [[0.165, 0.128, -0.069], [0.165, 0.128, 0.069]] : [[0.125, 0.094, 0.075]];   // the rear disc on the right, the sprocket on the left
  for (const [ro, ri, z] of discs) {
    const band = new THREE.RingGeometry(ri, ro, 96, 1); band.translate(0, 0, z);
    spin.add(mesh(band, front ? M.h2rDiscF : M.h2rDiscR, { name: 'h2r-disc' }));
    const n = front ? 6 : 5, carrier = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const arm = slab([[Math.cos(a - 0.12) * 0.05, Math.sin(a - 0.12) * 0.05], [Math.cos(a - 0.09) * (ri + 0.004), Math.sin(a - 0.09) * (ri + 0.004)], [Math.cos(a + 0.09) * (ri + 0.004), Math.sin(a + 0.09) * (ri + 0.004)], [Math.cos(a + 0.12) * 0.05, Math.sin(a + 0.12) * 0.05]], 0.005, 0.001);
      arm.translate(0, 0, z - 0.0025);
      carrier.push({ geometry: arm });
    }
    const ring = new THREE.RingGeometry(0.04, 0.062, 32); ring.translate(0, 0, z);
    carrier.push({ geometry: ring });
    spin.add(mesh(mergeAll(carrier), M.h2rSatin, { name: 'h2r-disc-carrier' }));
    const buttons = [];
    for (let i = 0; i < (front ? 10 : 6); i++) {
      const a = (i / (front ? 10 : 6)) * TAU + 0.15;
      const b = new THREE.CylinderGeometry(0.0055, 0.0055, 0.012, 10); b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * (ri + 0.003), Math.sin(a) * (ri + 0.003), z);
      buttons.push({ geometry: b });
    }
    spin.add(mesh(mergeAll(buttons), M.h2rAlu, { name: 'h2r-disc-buttons' }));
  }
  if (!front) {
    // The 42-tooth sprocket (a toothed ring, cut out between its arms) and the cush drive's machined
    // carrier with its eight slots, on the left end of the axle, outboard of the single-sided arm's
    // eccentric (the photographs with the bodywork off).
    const tooth = [];
    const N = 42, ro = 0.108, ri = 0.098;
    for (let i = 0; i < N * 2; i++) { const a = (i / (N * 2)) * TAU, r = i % 2 ? ri : ro; tooth.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    const spr = new THREE.Shape(tooth);
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + 0.12, a1 = a0 + TAU / 6 - 0.24, h = new THREE.Path();
      h.absarc(0, 0, 0.088, a0, a1, false); h.absarc(0, 0, 0.07, a1, a0, true); spr.holes.push(h);
    }
    const sg = new THREE.ExtrudeGeometry(spr, { depth: 0.006, bevelEnabled: false, curveSegments: 6 }); sg.translate(0, 0, -0.168);
    spin.add(mesh(sg, M.h2rAlu, { name: 'h2r-sprocket' }));
    const car = new THREE.Shape(); car.absarc(0, 0, 0.068, 0, TAU, false);
    for (let i = 0; i < 8; i++) { const a0 = (i / 8) * TAU + 0.1, a1 = a0 + TAU / 8 - 0.2, h = new THREE.Path(); h.absarc(0, 0, 0.058, a0, a1, false); h.absarc(0, 0, 0.032, a1, a0, true); car.holes.push(h); }
    const cg = new THREE.ExtrudeGeometry(car, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 }); cg.translate(0, 0, -0.19);
    spin.add(mesh(cg, M.h2rMachined, { name: 'h2r-sprocket-carrier' }));
    const nut = new THREE.CylinderGeometry(0.024, 0.024, 0.02, 6); nut.rotateX(Math.PI / 2); nut.translate(0, 0, -0.2);
    spin.add(mesh(nut, M.h2rAlu, { name: 'h2r-hub-nut' }));
  }
  return g;
}
