/**
 * The Porsche's circuit and its skid pad, as plain geometry with no Three.js in it, so the
 * terrain (terrain.js), the meshes (circuit.js) and the car's tyres all read the same lines.
 *
 * WHAT IS CITED AND WHAT IS NOT
 *
 * No real circuit is drawn. The layout is designed here: a 2.5 km clockwise lap with a main
 * straight of ≈460 m, a heavy-braking first corner, esses, a fast left kink, a back straight
 * with a chicane, a hairpin and a long left. The cross-section follows the usual practice of
 * permanent European circuits, sized to the FIA's figures for new circuits where those are the
 * ones widely quoted (a 12 m track; FIA Appendix O itself was not reached): ≈.
 *
 * The centre line is a chain of straights and constant-radius arcs ("turtle" commands), so
 * every corner's radius is known exactly; two straights (the main and the west straight) are
 * solved so the lap closes on itself.
 *
 * Placement: by a search for the spot nearest the exhibit row that stays inside the ground
 * disc, ≥320 m inland of the shoreline, clear of the site, the pad, the pools and the runway.
 * The main straight runs south along x = −675 m, the lap lies to its west; the skid pad lies
 * east of the straight, towards the site, ≈450 m from the row's west end.
 *
 * Frames:
 *  - local (u, v): u along the main straight (its start at the origin, +u the racing
 *    direction), v to the right of it (the lap lies at +v). World = (X0 − v, Z0 + u).
 *  - track (s, d): s metres along the centre line from the start line's station, d metres to
 *    the right of it, looking in the racing direction.
 */

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Where the circuit lies: its local origin in the world, and its cross-section (≈). */
export const CIRCUIT = {
  x: -675, z: -375,
  width: 12,              // track, edge to edge (the FIA's usual minimum for new circuits)
  shoulder: 3,            // paved verge either side
  kerbWidth: 1.5,         // ≈ red and white kerbs on the corners
  margin: 45,             // flat, bare land round it
  // The lap, clockwise (right turns towards +v): 'A' and 'B' are the two straights solved for
  // closure. ['S', L] a straight; ['R'|'L', radius, degrees] an arc.
  layout: ['A', ['R', 30, 95], ['S', 90], ['L', 55, 65], ['R', 45, 110], ['S', 150], ['L', 150, 35], ['S', 120],
    ['R', 35, 75], ['S', 280], ['L', 20, 55], ['R', 20, 110], ['L', 20, 55], ['S', 240], ['R', 22, 160], ['S', 140],
    ['L', 70, 70], ['S', 80], ['R', 80, 60], ['L', 60, 60], 'B', ['R', 55, 90]],
};
/** The skid pad (local u, v): a plain asphalt square beside the main straight, and its lane. */
export const SKIDPAD = { u0: 120, u1: 280, v0: -140, v1: -40, lane: { u: 200, width: 10 } };
/** Where the start line and the grid are: metres along the main straight (local u). */
export const START = { u: 330, gridSlots: 10, slotPitch: 8 };   // ≈ 8 m between staggered slots

export const toWorld = (u, v) => [CIRCUIT.x - v, CIRCUIT.z + u];
export const toLocal = (x, z) => [z - CIRCUIT.z, CIRCUIT.x - x];

/** Runs the turtle; returns the centre line's points (local), headings and the arcs' spans. */
function walk(A, B, ds = 2) {
  const pts = [[0, 0]], head = [0], curv = [0];
  let u = 0, v = 0, h = 0;
  for (const c0 of CIRCUIT.layout) {
    const c = c0 === 'A' ? ['S', A] : c0 === 'B' ? ['S', B] : c0;
    if (c[0] === 'S') {
      const n = Math.max(1, Math.round(c[1] / ds));
      for (let i = 0; i < n; i++) { u += Math.cos(h) * c[1] / n; v += Math.sin(h) * c[1] / n; pts.push([u, v]); head.push(h); curv.push(0); }
    } else {
      const R = c[1], a = c[2] * Math.PI / 180, sg = c[0] === 'R' ? 1 : -1;
      const n = Math.max(2, Math.round(R * a / ds)), da = a / n, step = 2 * R * Math.sin(da / 2);
      for (let i = 0; i < n; i++) {
        u += Math.cos(h + sg * da / 2) * step; v += Math.sin(h + sg * da / 2) * step; h += sg * da;
        pts.push([u, v]); head.push(h); curv.push(sg / R);
      }
    }
  }
  return { pts, head, curv };
}
/** The two closing straights, by Newton's method on the end point's miss. */
function solve() {
  let A = 450, B = 150;
  for (let it = 0; it < 20; it++) {
    const end = (a, b) => walk(a, b).pts.at(-1);
    const r = end(A, B), rA = end(A + 1, B), rB = end(A, B + 1);
    const j = [[rA[0] - r[0], rB[0] - r[0]], [rA[1] - r[1], rB[1] - r[1]]];
    const det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
    const dA = (-r[0] * j[1][1] + r[1] * j[0][1]) / det, dB = (-r[1] * j[0][0] + r[0] * j[1][0]) / det;
    A += dA; B += dB;
    if (Math.hypot(dA, dB) < 1e-9) break;
  }
  return { A, B };
}
const { A: MAIN, B: WEST } = solve();
const W = walk(MAIN, WEST);
W.pts.pop(); W.head.pop(); W.curv.pop();           // the last point is the first again
const N = W.pts.length;
/** Arc length at each centre-line point, from the local origin (the main straight's start). */
const S_AT = new Float64Array(N);
for (let i = 1; i < N; i++) S_AT[i] = S_AT[i - 1] + Math.hypot(W.pts[i][0] - W.pts[i - 1][0], W.pts[i][1] - W.pts[i - 1][1]);
export const LAP = S_AT[N - 1] + Math.hypot(W.pts[0][0] - W.pts[N - 1][0], W.pts[0][1] - W.pts[N - 1][1]);
export const MAIN_STRAIGHT = MAIN, WEST_STRAIGHT = WEST;

/** The centre line, local: [{ u, v, h (heading, rad), k (curvature, 1/m, + right), s }]. */
export const CENTRE = W.pts.map(([u, v], i) => ({ u, v, h: W.head[i], k: W.curv[i], s: S_AT[i] }));

// ---- Nearest-point lookup --------------------------------------------------------------------
// A coarse grid over the circuit's box holds, per cell, the centre-line segments near it, so
// a query looks at a handful of segments instead of all of them.
// REACH covers the verge, the run-off and the flat margin, so the mask meets 1 before it ends.
const CELL = 20, REACH = CIRCUIT.width / 2 + CIRCUIT.shoulder + 25 + CIRCUIT.margin + 5;
let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
for (const p of CENTRE) { u0 = Math.min(u0, p.u); u1 = Math.max(u1, p.u); v0 = Math.min(v0, p.v); v1 = Math.max(v1, p.v); }
u0 -= REACH; v0 -= REACH; u1 += REACH; v1 += REACH;
const NU = Math.ceil((u1 - u0) / CELL), NV = Math.ceil((v1 - v0) / CELL);
const BUCKETS = Array.from({ length: NU * NV }, () => []);
for (let i = 0; i < N; i++) {
  const a = CENTRE[i], b = CENTRE[(i + 1) % N];
  const iu0 = Math.max(0, Math.floor((Math.min(a.u, b.u) - REACH - u0) / CELL)), iu1 = Math.min(NU - 1, Math.floor((Math.max(a.u, b.u) + REACH - u0) / CELL));
  const iv0 = Math.max(0, Math.floor((Math.min(a.v, b.v) - REACH - v0) / CELL)), iv1 = Math.min(NV - 1, Math.floor((Math.max(a.v, b.v) + REACH - v0) / CELL));
  for (let iu = iu0; iu <= iu1; iu++) for (let iv = iv0; iv <= iv1; iv++) BUCKETS[iu * NV + iv].push(i);
}

/**
 * Track coordinates of a local point: { s, d, dist, i } — s along the lap, d to the right of
 * the centre line (signed), dist = |d| — or null when it is beyond REACH of the centre line.
 */
export function trackCoords(u, v) {
  const iu = Math.floor((u - u0) / CELL), iv = Math.floor((v - v0) / CELL);
  if (iu < 0 || iv < 0 || iu >= NU || iv >= NV) return null;
  let best = null, bd = REACH * REACH;
  for (const i of BUCKETS[iu * NV + iv]) {
    const a = CENTRE[i], b = CENTRE[(i + 1) % N];
    const ex = b.u - a.u, ev = b.v - a.v, L2 = ex * ex + ev * ev;
    const t = Math.min(1, Math.max(0, ((u - a.u) * ex + (v - a.v) * ev) / L2));
    const pu = a.u + ex * t - u, pv = a.v + ev * t - v, d2 = pu * pu + pv * pv;
    if (d2 < bd) {
      bd = d2;
      // Right of the direction of travel: (−sin h, cos h) rotated… in (u, v) the right-hand
      // normal of (ex, ev) is (−ev, ex).
      const side = Math.sign((u - a.u) * -ev + (v - a.v) * ex) || 1;
      best = { s: a.s + Math.sqrt(L2) * t, d: side * Math.sqrt(d2), dist: Math.sqrt(d2), i };
    }
  }
  return best;
}
/** Distance from a local point to the skid pad's slab and its lane (0 inside). */
export function skidpadDistance(u, v) {
  const P = SKIDPAD;
  const pad = Math.hypot(Math.max(0, P.u0 - u, u - P.u1), Math.max(0, P.v0 - v, v - P.v1));
  const lane = Math.hypot(Math.max(0, Math.abs(u - P.lane.u) - P.lane.width / 2), Math.max(0, P.v1 - v, v - (-CIRCUIT.width / 2 - CIRCUIT.shoulder)));
  return Math.min(pad, lane);
}
/** 0 on the circuit, its verges, run-off and the skid pad (plus a margin), 1 in open country. */
export function circuitMask(x, z) {
  const [u, v] = toLocal(x, z);
  const dp = skidpadDistance(u, v);
  const tc = trackCoords(u, v);
  const dt = tc ? Math.max(0, tc.dist - CIRCUIT.width / 2 - CIRCUIT.shoulder - 25) : REACH;
  return smooth(0, CIRCUIT.margin, Math.min(dp, dt));
}
