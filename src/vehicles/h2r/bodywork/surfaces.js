/**
 * The bodywork's surfaces: parts lofted from station tables on the side photograph, patches and
 * skins laid on them, shells, flat facets.
 */
import * as THREE from 'three';
import { loft, mesh, mirrorZ, mergeAll, withCreaseNormals } from '../geometry.js';
import { PXY } from '../photo.js';

/**
 * A part from its station table: rows of [u, [[v, z], [v, z], …]] — the same number of points in
 * every row, from the top centre line (z = 0) down the right side. Returns one mesh per material
 * span: spans = [[from, to, material, name], …] index ranges into the section's points.
 */
export function part(rows, spans, { steps = 4, mirror = true, creaseDeg = 30, closeTop = true } = {}) {
  const meshes = [];
  for (const [a, b, mat, name] of spans) {
    const secs = rows.map(([u, pts]) => pts.slice(a, b + 1).map(([v, z]) => [...PXY(u, v), z]));
    let g = loft(secs, { steps, creaseDeg });
    if (mirror) {
      const L = mirrorZ(g);
      g = mergeAll([{ geometry: g }, { geometry: L }]);
      g = withNormals(g, creaseDeg);
    }
    meshes.push(mesh(g, mat, { name }));
  }
  return meshes;
}

function withNormals(g, deg) { return withCreaseNormals(g, deg); }

/**
 * A panel seen from the side: its outline in the side photograph's pixels with a half-width at each
 * vertex ([u, v, z]), and optional interior control points; the surface between is a smooth
 * interpolation of those half-widths (inverse-distance weighted, ≈ a thin sheet pulled to them),
 * finely triangulated. Mirrored to the left. `flip` turns it to face inwards (a recess's floor).
 */
export function sidePatch(outline, { inner = [], mat, name, levels = 3, mirror = true, power = 2.2, flip = false, offset = 0 }) {
  const ctrl = [...outline, ...inner];
  const pts = outline.map(([u, v]) => new THREE.Vector2(u, v));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  let faces = THREE.ShapeUtils.triangulateShape(pts, []).map(t => t.map(i => [pts[i].x, pts[i].y]));
  for (let l = 0; l < levels; l++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  const zAt = (u, v) => {
    let sw = 0, sz = 0;
    for (const [cu, cv, cz] of ctrl) {
      const d2 = (u - cu) ** 2 + (v - cv) ** 2;
      if (d2 < 1e-6) return cz;
      const w = 1 / d2 ** (power / 2); sw += w; sz += w * cz;
    }
    return sz / sw;
  };
  const pos = [];
  for (const f of faces) {
    const tri = flip ? [f[0], f[2], f[1]] : f;
    for (const [u, v] of tri) { const [x, y] = PXY(u, v); pos.push(x, y, zAt(u, v) + offset); }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 3, pos[i + 1] * 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // The outline as seen from the side faces +z (the right side, outwards): wind accordingly.
  g = withCreaseNormals(g, 40);
  if (mirror) g = withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), 40);
  return mesh(g, mat, { name });
}

/**
 * A skin: a panel's outline in the side photograph's pixels, laid on a base surface by casting each
 * of its (finely subdivided) points across the bike onto it from the right (and mirrored), 1.5 mm
 * proud. The base's own colour shows where no skin lies: panels meet the volume exactly.
 */
const _ray = new THREE.Raycaster();

export function skin(outline, base, { mat, name, levels = 3, proud = 0.0015, mirror = true }) {
  const pts = outline.map(([u, v]) => new THREE.Vector2(u, v));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  let faces = THREE.ShapeUtils.triangulateShape(pts, []).map(t => t.map(i => [pts[i].x, pts[i].y]));
  for (let l = 0; l < levels; l++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  const targets = Array.isArray(base) ? base : [base];
  for (const t of targets) t.updateMatrixWorld(true);
  const cache = new Map();
  const hit = (u, v) => {
    const k = `${u.toFixed(2)},${v.toFixed(2)}`;
    if (cache.has(k)) return cache.get(k);
    const [x, y] = PXY(u, v);
    _ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
    const h = _ray.intersectObjects(targets, false).filter(i => i.point.z >= -0.001)[0];
    const r = h ? [h.point.x, h.point.y, h.point.z + proud * Math.max(0.3, h.face.normal.z)] : null;
    cache.set(k, r);
    return r;
  };
  const pos = [];
  for (const f of faces) {
    const P = f.map(([u, v]) => hit(u, v));
    if (P.some(p => !p)) continue;
    for (const p of P) pos.push(...p);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 3, pos[i + 1] * 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g = withCreaseNormals(g, 40);
  if (mirror) g = withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), 40);
  return mesh(g, mat, { name });
}

/**
 * A base volume from stations: rows of [u, [[v, z], …]] from the top (inner) edge round the right
 * side to the lower edge; mirrored; double-sided so the open inside reads as the panels' dark
 * backs.
 */
export function shell(rows, mat, name, { steps = 4, creaseDeg = 50, mirror = true } = {}) {
  const secs = rows.map(([u, pts]) => pts.map(([v, z]) => [...PXY(u, v), z]));
  let g = loft(secs, { steps, creaseDeg });
  if (mirror) g = withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), creaseDeg);
  const m = mesh(g, mat, { name });
  return m;
}

/**
 * Flat-faceted pieces from vertices (right side, metres) and polygons of vertex indices, mirrored
 * to the left: the H2R's fairing is pressed in planes meeting at sharp creases, and flat shading
 * per facet reads as it does.
 */
export function facets(V, polys, mat, name) {
  const pos = [];
  for (const poly of polys) for (let i = 1; i < poly.length - 1; i++) for (const k of [poly[0], poly[i], poly[i + 1]]) pos.push(...V[k]);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 3 + pos[i + 2] * 3, pos[i + 1] * 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g = mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]);
  g.computeVertexNormals();
  return mesh(g, mat, { name });
}
