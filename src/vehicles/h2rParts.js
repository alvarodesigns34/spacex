/**
 * The Ninja H2R's running gear: wheels and slicks, brakes, the fork, the single-sided swingarm,
 * the chain. Shared helpers for the bodywork (lofted surfaces, extrusions) live here too.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right.
 * T(x, y, z) takes traced millimetres from the front axle (x forward, y up) and metres for z.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeAll, mesh } from '../geometry/utils.js';
import { BODY, WHEELS, CHASSIS } from '../data/h2r.js';

export const D2R = Math.PI / 180, TAU = Math.PI * 2;
export const AX = BODY.wheelbase / 2;
export const T = (x, y, z = 0) => new THREE.Vector3(x / 1000 + AX, y / 1000, z);
export const RF = WHEELS.front.dia / 2, RR = WHEELS.rear.dia / 2;
/** The slicks stand ≈5 mm squashed under the bike's weight (≈). */
const SQUASH = 0.005;
export const AXLE_F = new THREE.Vector3(AX, RF - SQUASH, 0);
export const AXLE_R = new THREE.Vector3(-AX, RR - SQUASH, 0);
const RAKE = CHASSIS.rake * D2R;
export const STEER_AXIS = new THREE.Vector3(-Math.sin(RAKE), Math.cos(RAKE), 0);
export const STEER_GROUND = new THREE.Vector3(AX + CHASSIS.trail, 0, 0);
/** The swingarm's pivot (traced on the side photograph). */
export const PIVOT = T(-866, 345);

// ---- Geometry helpers ----------------------------------------------------------------------------

/** A unit cylinder (y-axis, height 1) stretched from A to B with radius r. */
export function segMatrix(A, B, r, r2 = r) {
  const d = new THREE.Vector3().subVectors(B, A), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return new THREE.Matrix4().compose(A.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(r, L, r2));
}
/** A shape (points in a plane, metres) extruded `depth`, with a small bevel; returned in the shape's plane (z = 0…depth). */
export function slab(points, depth, bevel = 0.002, curve = 1) {
  const s = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: curve, curveSegments: 12 });
}
/**
 * A lofted surface: `sections` are polylines with the same number of points (each [x, y, z]
 * in metres), swept in order; `closedU` closes each section, `smooth` smooths between sections
 * with a Catmull-Rom (steps per span). Normals are smoothed except across the creases (indices
 * into a section, where the surface folds).
 */
export function loft(sections, { steps = 6, smoothU = 0, creases = [], closedU = false, creaseDeg = 32 } = {}) {
  const n = sections[0].length;
  // Along the sweep: Catmull-Rom through the sections, point by point.
  const rows = [];
  const S = sections.map(s => s.map(p => new THREE.Vector3(...p)));
  for (let i = 0; i < S.length - 1; i++) {
    for (let k = 0; k < steps; k++) {
      const t = k / steps, row = [];
      for (let j = 0; j < n; j++) {
        const p0 = S[Math.max(0, i - 1)][j], p1 = S[i][j], p2 = S[i + 1][j], p3 = S[Math.min(S.length - 1, i + 2)][j];
        row.push(catmull(p0, p1, p2, p3, t));
      }
      rows.push(row);
    }
  }
  rows.push(S[S.length - 1]);
  // Across each section: optional subdivision (a Catmull-Rom through its points), keeping creases sharp.
  const cols = [];
  const crease = new Set(creases);
  for (let j = 0; j < n - (closedU ? 0 : 1); j++) {
    cols.push({ j, t: 0 });
    const sharp = crease.has(j) || crease.has((j + 1) % n);
    for (let k = 1; k <= smoothU; k++) cols.push({ j, t: k / (smoothU + 1), sharp });
  }
  if (!closedU) cols.push({ j: n - 1, t: 0 });
  const grid = rows.map(row => cols.map(({ j, t, sharp }) => {
    if (t === 0) return row[j];
    const a = row[j], b = row[(j + 1) % n];
    if (sharp) return a.clone().lerp(b, t);
    const p0 = row[closedU ? (j - 1 + n) % n : Math.max(0, j - 1)], p3 = row[closedU ? (j + 2) % n : Math.min(n - 1, j + 2)];
    return catmull(p0, a, b, p3, t);
  }));
  const W = grid[0].length + (closedU ? 1 : 0), H = grid.length;
  const pos = [], uv = [], idx = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const p = grid[r][c % grid[0].length];
      pos.push(p.x, p.y, p.z); uv.push(c / (W - 1), r / (H - 1));
    }
  }
  for (let r = 0; r < H - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // Smooth across the gentle curvature, crisp across the folds (≈ the panels' pressed creases).
  return withCreaseNormals(g, creaseDeg);
}
/** Recomputes smooth normals, averaging only across faces within `deg` of each other. */
export function withCreaseNormals(geo, deg = 35) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position, N = new Float32Array(P.count * 3);
  const fn = [], key = (i) => `${P.getX(i).toFixed(5)},${P.getY(i).toFixed(5)},${P.getZ(i).toFixed(5)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < P.count / 3; f++) {
    a.fromBufferAttribute(P, f * 3); b.fromBufferAttribute(P, f * 3 + 1); c.fromBufferAttribute(P, f * 3 + 2);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    const area = n.length();
    fn.push(area > 0 ? n.divideScalar(area) : n, area);
  }
  const at = new Map();
  for (let i = 0; i < P.count; i++) { const k = key(i); if (!at.has(k)) at.set(k, []); at.get(k).push(i); }
  const cos = Math.cos(deg * D2R);
  for (const list of at.values()) {
    for (const i of list) {
      const ni = fn[Math.floor(i / 3) * 2], s = new THREE.Vector3();
      for (const j of list) {
        const nj = fn[Math.floor(j / 3) * 2];
        if (ni.dot(nj) >= cos) s.addScaledVector(nj, fn[Math.floor(j / 3) * 2 + 1] + 1e-9);
      }
      s.normalize();
      N[i * 3] = s.x; N[i * 3 + 1] = s.y; N[i * 3 + 2] = s.z;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return new THREE.Vector3(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3));
}
/** Mirrors a geometry to the other side (z → −z), keeping the faces outward. */
export function mirrorZ(g) {
  const m = g.clone();
  m.scale(1, 1, -1);
  const idx = m.index;
  if (idx) { for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); } }
  else {
    for (const name of Object.keys(m.attributes)) {
      const A = m.attributes[name];
      for (let i = 0; i < A.count; i += 3) for (let k = 0; k < A.itemSize; k++) { const t = A.array[(i + 1) * A.itemSize + k]; A.array[(i + 1) * A.itemSize + k] = A.array[(i + 2) * A.itemSize + k]; A.array[(i + 2) * A.itemSize + k] = t; }
    }
  }
  m.computeVertexNormals?.();
  return m;
}
export { mergeVertices, mergeAll, mesh };

// ---- Textures ------------------------------------------------------------------------------------
export function canvasTexture(w, h, draw, color = true) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
/** The discs' braking bands: three staggered rows of holes, as an alpha map over a ring's UVs. */
function discHoles(rows) {
  const t = canvasTexture(1024, 1024, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#000';
    const c = w / 2;
    for (const [n, r, off, size] of rows) {
      for (let i = 0; i < n; i++) {
        const a = (i / n + off) * TAU;
        g.beginPath(); g.arc(c + Math.cos(a) * r * c, c + Math.sin(a) * r * c, w * size, 0, TAU); g.fill();
      }
    }
  }, false);
  return t;
}

// ---- Materials -----------------------------------------------------------------------------------
export function partMaterials(M) {
  if (M.h2rTyre) return;
  M.h2rTyre = new THREE.MeshStandardMaterial({ name: 'h2r-tyre', color: 0x18191a, metalness: 0, roughness: 0.78 });
  M.h2rRim = new THREE.MeshPhysicalMaterial({ name: 'h2r-rim', color: 0x0b0b0c, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.h2rMachined = new THREE.MeshStandardMaterial({ name: 'h2r-machined', color: 0xd9dcdf, metalness: 1, roughness: 0.18 });
  M.h2rRimStripe = new THREE.MeshStandardMaterial({ name: 'h2r-rim-stripe', color: 0x3fae3a, metalness: 0.3, roughness: 0.35 });
  M.h2rDiscF = new THREE.MeshStandardMaterial({ name: 'h2r-disc', color: 0xb2b4b6, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide,
    alphaMap: discHoles([[30, 0.94, 0, 0.0085], [30, 0.87, 0.5 / 30, 0.0085], [30, 0.80, 0, 0.0085]]), alphaTest: 0.5 });
  M.h2rDiscR = new THREE.MeshStandardMaterial({ name: 'h2r-disc-rear', color: 0xb2b4b6, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide,
    alphaMap: discHoles([[24, 0.92, 0, 0.011], [24, 0.82, 0.5 / 24, 0.011]]), alphaTest: 0.5 });
  M.h2rCaliper = new THREE.MeshStandardMaterial({ name: 'h2r-calliper', color: 0x8e9196, metalness: 0.75, roughness: 0.42 });
  M.h2rPad = new THREE.MeshStandardMaterial({ name: 'h2r-pad', color: 0x9a6a3a, metalness: 0.6, roughness: 0.5 });
  M.h2rFork = new THREE.MeshPhysicalMaterial({ name: 'h2r-fork', color: 0x101112, metalness: 0.7, roughness: 0.18, clearcoat: 1 });
  M.h2rForkInner = new THREE.MeshStandardMaterial({ name: 'h2r-fork-inner', color: 0x2a2b2d, metalness: 0.9, roughness: 0.12 });
  M.h2rBlack = new THREE.MeshPhysicalMaterial({ name: 'h2r-black', color: 0x0a0b0c, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  M.h2rSatin = new THREE.MeshStandardMaterial({ name: 'h2r-satin-black', color: 0x141517, metalness: 0.45, roughness: 0.55 });
  M.h2rAlu = new THREE.MeshStandardMaterial({ name: 'h2r-aluminium', color: 0xc9ccd0, metalness: 0.95, roughness: 0.3 });
  M.h2rChain = new THREE.MeshStandardMaterial({ name: 'h2r-chain', color: 0x5a5b5d, metalness: 0.85, roughness: 0.45 });
  M.h2rGold = new THREE.MeshStandardMaterial({ name: 'h2r-gold', color: 0xc8941e, metalness: 0.95, roughness: 0.3 });
}

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
    // carrier with its eight slots, on the left (the side photograph).
    const tooth = [];
    const N = 42, ro = 0.108, ri = 0.098;
    for (let i = 0; i < N * 2; i++) { const a = (i / (N * 2)) * TAU, r = i % 2 ? ri : ro; tooth.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    const spr = new THREE.Shape(tooth);
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + 0.12, a1 = a0 + TAU / 6 - 0.24, h = new THREE.Path();
      h.absarc(0, 0, 0.088, a0, a1, false); h.absarc(0, 0, 0.07, a1, a0, true); spr.holes.push(h);
    }
    const sg = new THREE.ExtrudeGeometry(spr, { depth: 0.006, bevelEnabled: false, curveSegments: 6 }); sg.translate(0, 0, -0.108);
    spin.add(mesh(sg, M.h2rAlu, { name: 'h2r-sprocket' }));
    const car = new THREE.Shape(); car.absarc(0, 0, 0.068, 0, TAU, false);
    for (let i = 0; i < 8; i++) { const a0 = (i / 8) * TAU + 0.1, a1 = a0 + TAU / 8 - 0.2, h = new THREE.Path(); h.absarc(0, 0, 0.058, a0, a1, false); h.absarc(0, 0, 0.032, a1, a0, true); car.holes.push(h); }
    const cg = new THREE.ExtrudeGeometry(car, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 }); cg.translate(0, 0, -0.13);
    spin.add(mesh(cg, M.h2rMachined, { name: 'h2r-sprocket-carrier' }));
    const nut = new THREE.CylinderGeometry(0.024, 0.024, 0.02, 6); nut.rotateX(Math.PI / 2); nut.translate(0, 0, -0.14);
    spin.add(mesh(nut, M.h2rAlu, { name: 'h2r-hub-nut' }));
  }
  return g;
}

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
