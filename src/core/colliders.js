/**
 * What stands on the ground, for the vehicles that drive and fly through the scene: every solid
 * triangle of the static scene (the exhibits on their plinths, the pad's tower and mount, the
 * site's fence, lecterns and posts, the people standing about) laid into a sparse grid of
 * 0.25 m cells in plan, each holding the lowest and highest height of what crosses it. It is
 * built once, from the meshes themselves, so nothing drawn can be driven through and nothing
 * undrawn stops a car; a vertical sheet (the fence's chain-link panel) projects to a line and
 * marks the cells along it.
 *
 * Left out: the ground and its relief (the vehicles have their own ground function), the water,
 * the sky and the clouds, smoke and exhaust, labels, and whatever a caller excludes (the vehicle
 * being driven or flown, which moves). Level faces (decks, roofs) are left out too unless asked
 * for (`level`): for a car what stops it is the sides they stand on; an airplane can hit a roof.
 *
 *   grid.query(x0, z0, x1, z1, cb)   calls cb(cx, cz, lo, hi) for each occupied cell in the box
 *   grid.at(x, z)                     { lo, hi } of the cell under a point, or null
 *   grid.hits(a, b)                   true if the segment a → b (world points) passes through an
 *                                     occupied cell within its heights
 */
import * as THREE from 'three';

export const CELL = 0.25;
const KEY = (i, j) => i * 1048576 + j;   // i, j in ±524 288 cells: ±131 km
const SKIP = /^(ground|outer-ground|terrain|foredune|dune|campus-ground|campus-scrub|campus-bunchgrass|sea|ocean|water|tidal-flat|surf|sky|cloud|plume|smoke|exhaust|spray|foam|label|ruler|skid|grass|shadow|human-shadow|reentry|launch-glow|flame|flight-earth|orbit|gt3-tyre-marks|circuit-|runway-pavement|runway-mark|taxi|apron)/i;

export function buildColliders(scene, { exclude = [], skip = SKIP, maxY = Infinity, bounds = null, stats = null, level = false } = {}) {
  const lo = new Map(), hi = new Map();
  const ex = new Set(exclude);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const m = new THREE.Matrix4(), mi = new THREE.Matrix4();
  let tris = 0;
  const mark = (i, j, y0, y1) => {
    const k = KEY(i, j), l = lo.get(k);
    if (l === undefined) { lo.set(k, y0); hi.set(k, y1); return; }
    if (y0 < l) lo.set(k, y0);
    if (y1 > hi.get(k)) hi.set(k, y1);
  };
  // Conservative rasterisation of a triangle's plan into cells: its bounding box in cells,
  // each kept if the triangle's plan overlaps the cell (separating axes: the box's two and the
  // triangle's three edge normals). A triangle seen edge-on (a vertical sheet) is a segment,
  // which the same test keeps along its length.
  const tri = (ax, az, bx, bz, cx, cz, y0, y1) => {
    const i0 = Math.floor(Math.min(ax, bx, cx) / CELL), i1 = Math.floor(Math.max(ax, bx, cx) / CELL);
    const j0 = Math.floor(Math.min(az, bz, cz) / CELL), j1 = Math.floor(Math.max(az, bz, cz) / CELL);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return;   // a ground-sized sheet: not an obstacle
    const E = [[ax, az, bx, bz], [bx, bz, cx, cz], [cx, cz, ax, az]];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      if (i1 - i0 + j1 - j0 > 1) {
        const x0 = i * CELL, z0 = j * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
        let sep = false;
        for (const [px, pz, qx, qz] of E) {
          const nx = qz - pz, nz = px - qx;
          if (nx === 0 && nz === 0) continue;
          // The triangle's own extent along the edge normal, and the cell's.
          const t0 = Math.min(ax * nx + az * nz, bx * nx + bz * nz, cx * nx + cz * nz), t1 = Math.max(ax * nx + az * nz, bx * nx + bz * nz, cx * nx + cz * nz);
          const c0 = Math.min(x0 * nx + z0 * nz, x1 * nx + z0 * nz, x0 * nx + z1 * nz, x1 * nx + z1 * nz);
          const c1 = Math.max(x0 * nx + z0 * nz, x1 * nx + z0 * nz, x0 * nx + z1 * nz, x1 * nx + z1 * nz);
          if (c1 < t0 || c0 > t1) { sep = true; break; }
        }
        if (sep) continue;
      }
      mark(i, j, y0, y1);
    }
  };
  scene.updateMatrixWorld(true);
  const visit = (o) => {
    if (ex.has(o) || (o.name && skip.test(o.name)) || o.visible === false || o.isSprite || o.isPoints || o.isLine) return;
    if (o.isMesh && o.geometry?.attributes?.position && !o.material?.transparent) {
      const g = o.geometry, P = g.attributes.position, I = g.index;
      const n = I ? I.count : P.count;
      const count = o.isInstancedMesh ? o.count : 1;
      for (let k = 0; k < count; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, mi); m.multiplyMatrices(o.matrixWorld, mi); } else m.copy(o.matrixWorld);
        for (let t = 0; t < n; t += 3) {
          const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
          a.fromBufferAttribute(P, ia).applyMatrix4(m); b.fromBufferAttribute(P, ib).applyMatrix4(m); c.fromBufferAttribute(P, ic).applyMatrix4(m);
          const y0 = Math.min(a.y, b.y, c.y), y1 = Math.max(a.y, b.y, c.y);
          if (y0 > maxY) continue;
          // A level face (a deck, a paved floor, a roof) stops nothing by itself: the sides it
          // stands on do. Only faces that rise more than a few centimetres go in.
          if (!level && y1 - y0 < 0.04) continue;
          if (bounds && (Math.max(a.x, b.x, c.x) < bounds[0] || Math.min(a.x, b.x, c.x) > bounds[2] || Math.max(a.z, b.z, c.z) < bounds[1] || Math.min(a.z, b.z, c.z) > bounds[3])) continue;
          tri(a.x, a.z, b.x, b.z, c.x, c.z, y0, y1);
          tris++;
          if (stats) stats[o.name || o.parent?.name || '?'] = (stats[o.name || o.parent?.name || '?'] ?? 0) + 1;
        }
      }
    }
    for (const ch of o.children) visit(ch);
  };
  visit(scene);
  return {
    cells: lo.size, tris,
    at(x, z) { const k = KEY(Math.floor(x / CELL), Math.floor(z / CELL)), l = lo.get(k); return l === undefined ? null : { lo: l, hi: hi.get(k) }; },
    hits(a, b) {
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.8)));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        const k = KEY(Math.floor(x / CELL), Math.floor(z / CELL)), l = lo.get(k);
        if (l !== undefined && y >= l - 0.05 && y <= hi.get(k) + 0.05) return true;
      }
      return false;
    },
    query(x0, z0, x1, z1, cb) {
      const i0 = Math.floor(Math.min(x0, x1) / CELL), i1 = Math.floor(Math.max(x0, x1) / CELL);
      const j0 = Math.floor(Math.min(z0, z1) / CELL), j1 = Math.floor(Math.max(z0, z1) / CELL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = KEY(i, j), l = lo.get(k);
        if (l !== undefined) cb((i + 0.5) * CELL, (j + 0.5) * CELL, l, hi.get(k));
      }
    },
  };
}
