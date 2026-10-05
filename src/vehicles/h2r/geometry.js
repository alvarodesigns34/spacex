/**
 * The Ninja H2R's shared frame of reference and geometry helpers: the axles, the steering axis and
 * the swingarm's pivot; lofted surfaces with creased normals, extrusions, mirroring, canvases.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right.
 * T(x, y, z) takes traced millimetres from the front axle (x forward, y up) and metres for z.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeAll, mesh } from '../../geometry/utils.js';
import { BODY, WHEELS, CHASSIS } from '../../data/h2r.js';

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
/**
 * Drops the triangles without area (a shape with many holes triangulates now and then three
 * collinear points into one: its normal is (0, 0, 0), a NaN in the shading). Non-indexed or indexed.
 */
export function dropSlivers(g, eps = 1e-13) {
  const p = g.attributes.position, idx = g.index, n = idx ? idx.count : p.count, keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    const i = idx ? idx.getX(t) : t, j = idx ? idx.getX(t + 1) : t + 1, k = idx ? idx.getX(t + 2) : t + 2;
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, j); c.fromBufferAttribute(p, k);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > eps) keep.push(i, j, k);
  }
  if (keep.length === n) return g;
  g.setIndex(keep);
  return g;
}

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

// ---- The engine ------------------------------------------------------------------------------------
export function lathe(points, segs = 48) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs); }

/**
 * A section swept along a curve through `points` (Vector3s): at each step a rounded box `w(t)`
 * wide (across, ⟂ the curve and `up`) and `h(t)` tall (along the part of `up` ⟂ the curve),
 * `e` its roundness (1 a diamond, 0.5 a rounded box, small a box). Caps close the ends unless
 * `open`. Faces outward. Returns an indexed geometry with smooth normals.
 */
export function sweep(points, w, h, { up = new THREE.Vector3(0, 1, 0), n = 14, steps = 32, e = 0.45, open = false, tension = 'centripetal' } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, tension);
  const W = typeof w === 'function' ? w : () => w, H = typeof h === 'function' ? h : () => h;
  const pos = [], idx = [], centres = [];
  const side = new THREE.Vector3(), upv = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), tan = curve.getTangent(t);
    side.crossVectors(up, tan); if (side.lengthSq() < 1e-10) side.set(0, 0, 1); side.normalize();
    upv.crossVectors(tan, side).normalize();
    const ww = W(t) / 2, hh = H(t) / 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, c = Math.cos(a), s = Math.sin(a);
      const q = p.clone().addScaledVector(side, Math.sign(c) * Math.abs(c) ** e * ww).addScaledVector(upv, Math.sign(s) * Math.abs(s) ** e * hh);
      pos.push(q.x, q.y, q.z);
    }
    centres.push(p);
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + (k + 1) % n, c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  if (!open) {
    for (const [i, flipCap] of [[0, true], [steps, false]]) {
      const ci = pos.length / 3; pos.push(centres[i].x, centres[i].y, centres[i].z);
      for (let k = 0; k < n; k++) { const a = i * n + k, b = i * n + (k + 1) % n; if (flipCap) idx.push(ci, b, a); else idx.push(ci, a, b); }
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Outward: the first ring's normal away from its centre.
  const nn = g.attributes.normal;
  const v0 = new THREE.Vector3(nn.getX(n + 1), nn.getY(n + 1), nn.getZ(n + 1));
  const q1 = new THREE.Vector3(pos[(n + 1) * 3], pos[(n + 1) * 3 + 1], pos[(n + 1) * 3 + 2]).sub(centres[1]);
  if (v0.dot(q1) < 0) {
    const ix = g.index;
    for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); }
    g.computeVertexNormals();
  }
  return g;
}
