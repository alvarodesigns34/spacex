/**
 * The ground beyond the disc: the same coastal plain, beach and Gulf, out to 450 km, so that
 * whatever flies from the site — and the F-16 from its runway — stays over the simulation's own
 * land and sea instead of handing over to another scene.
 *
 * WHAT IT IS
 *  - The land is the disc's (environment.js groundSample): the same height, cover, beach and
 *    tidal fields from terrain.js, drawn with the same terrain material, so the two meet at the
 *    disc's edge as one plain. The lomas stay where terrain.js puts them; beyond the site the
 *    plain is its micro-relief only. Plausible, like the disc, not a survey.
 *  - The sea is the disc's own water surface carried on, with the same material: its shelf and
 *    surf graded by distance offshore as at the beach.
 *  - The Earth is round: past the disc's edge the ground falls away below the pad's horizontal
 *    plane by ρ² / (R + √(R² − ρ²)), R = 6371 km, measured from the edge so the two meet. From
 *    10 km up the horizon then lies where it should, 357 km out and 3.2° down; the flat disc
 *    itself is 0.5 m off the sphere at its rim.
 *
 * Cells grow with distance (square in plan, 2.45 % of the radius each: ≈60 m at the disc's
 * edge, ≈11 km at the rim), so the triangle count stays in the tens of thousands. Not drawn
 * during the launch and the re-entry, which keep their own stretched disc and globe.
 */
import * as THREE from 'three';

export const OUTER = { r0: 2500, r1: 450000, segments: 256 };
const R_EARTH = 6371000;
const drop = (r) => (r * r) / (R_EARTH + Math.sqrt(R_EARTH * R_EARTH - r * r));
/**
 * Height of the round Earth's surface below the pad's plane at ρ from it, beyond the disc. The
 * scene's ground ends at OUTER.r1 (450 km); past it the drop keeps growing to the sphere's edge,
 * ρ = R, and is held there: a number, never NaN, for whatever asks that far out.
 */
export function curvatureDrop(r) {
  if (!(r > OUTER.r0)) return 0;
  return drop(Math.min(r, R_EARTH)) - drop(OUTER.r0);
}

/** Ring radii, from the disc's edge out, each cell as long radially as it is wide. */
function radii() {
  const out = [OUTER.r0];
  const k = 1 + (2 * Math.PI) / OUTER.segments;
  while (out[out.length - 1] < OUTER.r1) out.push(Math.min(OUTER.r1, out[out.length - 1] * k));
  return out;
}

/**
 * @param {object} o
 * @param {THREE.Material} o.terrain  the disc's terrain material
 * @param {THREE.Material} o.sea      the disc's sea material
 * @param {Function} o.sample         environment.js groundSample(x, y)
 * @param {number} o.waterline        metres seaward of shoreZ where the sea surface begins
 * @returns {THREE.Group} in the disc's local frame (XY plane, z up): rotate it like the disc
 */
export function buildOuterGround({ terrain, sea, sample, waterline }) {
  const rs = radii(), S = OUTER.segments, nr = rs.length;
  const n = nr * (S + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  const shore = new Float32Array(n * 2), land = new Float32Array(n), tidal = new Float32Array(n);
  const past = new Float32Array(n);
  const wpos = new Float32Array(n * 3), wsea = new Float32Array(n);
  for (let j = 0; j < nr; j++) {
    const r = rs[j], dz = curvatureDrop(r);
    for (let i = 0; i <= S; i++) {
      const a = (i / S) * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const k = j * (S + 1) + i, g = sample(x, y);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = g.h - dz;
      uv[k * 2] = x; uv[k * 2 + 1] = y;
      col.set(g.col, k * 3);
      shore[k * 2] = g.dry; shore[k * 2 + 1] = g.wet;
      land[k] = g.land; tidal[k] = g.tidal; past[k] = g.past;
      wpos[k * 3] = x; wpos[k * 3 + 1] = y; wpos[k * 3 + 2] = -0.9 - dz;
      wsea[k] = g.past - waterline;
    }
  }
  // Land where any corner of a cell is ashore or near it; sea where any corner is offshore. The
  // two overlap only along the coast, where the land slopes under the water; elsewhere the
  // depth buffer, which cannot tell a few metres apart a hundred kilometres away, is never
  // asked to.
  const gIdx = [], wIdx = [];
  for (let j = 0; j < nr - 1; j++) {
    for (let i = 0; i < S; i++) {
      const p = j * (S + 1) + i, q = p + S + 1;
      const c = [p, p + 1, q, q + 1].map(v => past[v]);
      // Counter-clockwise seen from above (+z), as the disc's: inner, outer, next outer.
      if (Math.min(...c) < 250) gIdx.push(p, q, q + 1, p, q + 1, p + 1);
      if (Math.max(...c) > 0) wIdx.push(p, q, q + 1, p, q + 1, p + 1);
    }
  }
  const group = new THREE.Group();
  group.name = 'outer-ground';
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aShore', new THREE.BufferAttribute(shore, 2));
    g.setAttribute('aLand', new THREE.BufferAttribute(land, 1));
    g.setAttribute('aMarsh', new THREE.BufferAttribute(tidal, 1));
    g.setIndex(gIdx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, terrain);
    m.name = 'outer-ground-land';
    m.receiveShadow = true;
    group.add(m);
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
    g.setAttribute('aSea', new THREE.BufferAttribute(wsea, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(uv.slice(), 2));
    g.setIndex(wIdx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, sea);
    m.name = 'outer-ground-sea';
    group.add(m);
  }
  return group;
}
