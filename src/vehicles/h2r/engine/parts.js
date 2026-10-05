/**
 * The engine's shared shapes: side outlines extruded across the bike, parts turned about an axis
 * across it, fasteners, hoses, and the right-side photograph's calibration.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right.
 */
import * as THREE from 'three';
import { slab, mergeAll, withCreaseNormals, TAU } from '../geometry.js';

/**
 * Model metres from millimetres measured on the right-side photograph ("Kawasaki Ninja H2R right",
 * Wikimedia Commons; reference only), warped onto the model's side plane by the two axles' centres
 * (photograph (192.5, 507.5) and (1072.5, 542.5) px; 1.644 mm a pixel, rolled 1.3°): the grid the
 * engine's covers are traced on. ≈ ±3 mm in the centre plane; the covers stand ≈0.2 m nearer the
 * camera, ≈ +0.2 % in scale (negligible).
 */
export const mm = (pts) => pts.map(([x, y]) => [x / 1000, y / 1000]);

/** A polygon moved in by `d` along its vertices' bisectors (a convex-ish outline's inset). */
export function inset(points, d) {
  const n = points.length, out = [];
  let area = 0;
  for (let i = 0; i < n; i++) { const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  const s = Math.sign(area);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[(i + n - 1) % n], [bx, by] = points[i], [cx, cy] = points[(i + 1) % n];
    const e1 = new THREE.Vector2(bx - ax, by - ay).normalize(), e2 = new THREE.Vector2(cx - bx, cy - by).normalize();
    const n1 = new THREE.Vector2(-e1.y, e1.x).multiplyScalar(s), n2 = new THREE.Vector2(-e2.y, e2.x).multiplyScalar(s);
    const m = n1.clone().add(n2); const k = m.lengthSq() < 1e-9 ? 1 : 2 / m.lengthSq();
    out.push([bx + m.x * k * d, by + m.y * k * d]);
  }
  return out;
}

/** A side outline (x, y in metres) extruded across the bike from z0 to z1, its edges rounded by `bevel` (inside the outline). */
export function ext(points, z0, z1, bevel = 0.008, seg = 3) {
  let g = slab(bevel > 0 ? inset(points, bevel) : points, Math.max(0.001, z1 - z0 - 2 * bevel), bevel, seg);
  g.translate(0, 0, z0 + bevel);
  // (A rounded edge shaded round, not in facets; the outline's corners stay crisp.)
  if (seg >= 3) g = withCreaseNormals(g, 40);
  return g;
}

/** A lathed part (profile [r, d], d along the axis), its axis across the bike at (x, y), from z0 towards `side` (+1 right, −1 left). */
export function turned(profile, x, y, z0, side, segs = 64) {
  // (The lathe's faces point outward when the profile runs up its axis: from the base out.)
  const pts = profile.map(([r, d]) => new THREE.Vector2(r, d));
  if (pts[0].y > pts[pts.length - 1].y) pts.reverse();
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(side * Math.PI / 2);
  g.translate(x, y, z0);
  return g;
}

/** A flanged hex bolt, its head out of the face at z towards `side`, with its washer. */
export function bolt(x, y, z, side, head = 0.0052, h = 0.006) {
  const b = new THREE.CylinderGeometry(head, head, h, 6);
  b.rotateX(Math.PI / 2); b.rotateZ(Math.PI / 6);
  b.translate(x, y, z + side * (h / 2 + 0.0012));
  const f = new THREE.CylinderGeometry(head * 1.3, head * 1.38, 0.0014, 20);
  f.rotateX(Math.PI / 2); f.translate(x, y, z + side * 0.0007);
  return mergeAll([{ geometry: b }, { geometry: f }]);
}

/** A socket-head cap screw: the round head and its hex socket (`dark` receives the socket). */
export function capScrew(x, y, z, side, r, dark) {
  const h = new THREE.CylinderGeometry(r, r, r * 1.1, 20); h.rotateX(Math.PI / 2); h.translate(x, y, z + side * r * 0.55);
  const s = new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.0008, 6); s.rotateX(Math.PI / 2); s.translate(x, y, z + side * (r * 1.1 + 0.0002));
  dark?.push({ geometry: s });
  return h;
}

/** Hex bolts on a circle round (x, y), out of the face at z towards `side`. */
export function boltRing(out, x, y, z, side, r, n, { head = 0.0052, h = 0.006, a0 = 0.3, skip = [] } = {}) {
  for (let k = 0; k < n; k++) {
    if (skip.includes(k)) continue;
    const a = a0 + (k / n) * TAU;
    out.push({ geometry: bolt(x + Math.cos(a) * r, y + Math.sin(a) * r, z, side, head, h) });
  }
}

/** Points every `step` metres along a closed outline (for the bolts round a cover). */
export function alongOutline(points, step, offset = 0) {
  const n = points.length, segs = [];
  let total = 0;
  for (let i = 0; i < n; i++) { const a = points[i], b = points[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, L]); total += L; }
  const count = Math.max(1, Math.round(total / step)), out = [];
  for (let k = 0; k < count; k++) {
    let d = ((offset + k / count) % 1) * total;
    for (const [a, b, L] of segs) { if (d <= L) { out.push([a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L]); break; } d -= L; }
  }
  return out;
}

/** A rubber hose along points. */
export function hose(points, r, segs = 40) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), segs, r, 12);
}

/** A hose clamp: a band round the axis `dir` at `c`, its screw housing on top. */
export function hoseClamp(c, dir, r, w = 0.009) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const band = new THREE.CylinderGeometry(r, r, w, 40, 1, true); band.applyQuaternion(q); band.translate(c.x, c.y, c.z);
  const d = dir.clone().normalize(), up = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const radial = up.sub(d.clone().multiplyScalar(up.dot(d))).normalize(), tangent = radial.clone().cross(d);
  const basis = new THREE.Matrix4().makeBasis(tangent, radial, d);
  const box = new THREE.BoxGeometry(0.014, 0.007, w * 1.1); box.translate(0, r + 0.003, 0); box.applyMatrix4(basis); box.translate(c.x, c.y, c.z);
  const screw = new THREE.CylinderGeometry(0.0028, 0.0028, 0.02, 6); screw.rotateZ(Math.PI / 2); screw.translate(0.002, r + 0.0065, 0); screw.applyMatrix4(basis); screw.translate(c.x, c.y, c.z);
  return mergeAll([{ geometry: band }, { geometry: box }, { geometry: screw }]);
}
