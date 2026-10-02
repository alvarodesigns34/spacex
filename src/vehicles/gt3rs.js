/**
 * Porsche 911 GT3 RS (type 992, model year 2023) in Arctic Grey, at 1:1.
 *
 * PROVENANCE
 *  - Every published figure is in data/gt3rs.js with its source (Porsche's technical data,
 *    MY P 08/2022, and the 2022 press kit): length 4.572 m, width 1.900 m (2.027 m over the
 *    mirrors), height 1.322 m to the rear wing's upper edge, wheelbase 2.457 m, tracks 1.630 /
 *    1.582 m, 275/35 ZR 20 and 335/30 ZR 21 tyres on 10 J × 20 and 13 J × 21 centre-lock wheels,
 *    408 / 380 mm discs.
 *  - The shape between those figures is TRACED on Porsche's studio side, front and rear
 *    photographs of the car (newsroom.porsche.com, reference only, not in the repository),
 *    scaled by the published wheelbase and height. The side photograph's long lens puts the
 *    wheels' faces at 203 px/m and the car's centre plane at 191 px/m; at that scale the traced
 *    ends fall 4.575 m apart against the published 4.572 m, and a camera ≈0.65 m up puts the
 *    roof at ≈1.29 m and the wing's upper edge at the published 1.322 m. Heights and
 *    half-widths read off them are ≈ ±2 cm. The cross-sections between the traced lines, the
 *    lamps, vents, louvres, intakes, the wing, the wheels and the cabin are reconstructed from
 *    the photographs (≈).
 *  - No badges, script, crests or number plates: the centre adds no logos.
 *
 * Frame: X forward from the middle of the wheelbase, Y up from the ground the tyres stand on,
 * Z to the right. The body is one master surface: cross-sections across the car, each a
 * centripetal Catmull-Rom through 15 points (sill, tuck, widest point, flank, hip, shoulder and
 * upper edge on each side of the centre line, and the crown), swept along X through key tables. The glass,
 * its frames, the lamps' openings and the skirts are regions of that one surface; the parts with
 * curved or slanted outlines are patches laid on it (bandPatch, loopPatch, facePatch), so neither can drift
 * apart from it. The body, wing, mirrors and cabin hang in group gt3-sprung, which the
 * drive pitches and rolls on the springs; the four wheels are outside it.
 */
import * as THREE from 'three';
import { mesh, mergeAll, curve } from '../geometry/utils.js';
import { BODY, WHEELS, BRAKES, PAINT } from '../data/gt3rs.js';

const L2 = BODY.length / 2, AX = BODY.wheelbase / 2, D2R = Math.PI / 180, TAU = Math.PI * 2;
const RF = WHEELS.front.dia / 2, RR = WHEELS.rear.dia / 2;
/** Static ride: the tyres stand ≈8 mm compressed under the car's weight (≈). */
const SQUASH = 0.008;
/**
 * The swept surface stops short of the published ends; a rounded face closes each (endCap), its
 * middle at the published ±2.286 m, its rim turning tangent into the sides — the bumpers' corners.
 * The faces carry their intakes, panel and lamps as patches (facePatch).
 */
const CAP = { nose: { bulge: 0.08, m: 4 }, tail: { bulge: 0.05, m: 5 } };
const X_NOSE = L2 - CAP.nose.bulge, X_TAIL = -L2 + CAP.tail.bulge;
export const AXLE_F = { x: AX, y: RF - SQUASH, track: BODY.trackFront, tyre: WHEELS.front };
export const AXLE_R = { x: -AX, y: RR - SQUASH, track: BODY.trackRear, tyre: WHEELS.rear };

// ---- Key tables (X ascending) -----------------------------------------------------------------
// TRACED on the studio photographs unless noted; the ends are the published ±2.286 m.
// Half-widths reconstructed against the published 1.900 m.

/** Centre-line crown: the tail's top, engine lid, rear window, roof, windscreen, bonnet, nose. */
const yCrown = curve([
  [-L2, 0.80], [-2.27, 0.835], [-2.24, 0.86], [-2.20, 0.875], [-2.13, 0.882], [-1.97, 0.897], [-1.76, 0.922], [-1.55, 0.987],
  [-1.35, 1.057], [-1.08, 1.153], [-0.93, 1.21], [-0.75, 1.262], [-0.55, 1.282], [-0.30, 1.289], [0, 1.283],
  [0.20, 1.247], [0.45, 1.075], [0.60, 0.975], [0.78, 0.867], [0.85, 0.842], [1.0, 0.822], [AX, 0.792],
  [1.50, 0.752], [1.70, 0.707], [1.90, 0.635], [2.05, 0.585], [2.15, 0.56], [2.22, 0.535], [2.26, 0.51], [L2, 0.48],
]);
/** Widest half-width of the body at each station, and the height where it is widest. */
// The section's curve stands ≈1 % proud of its widest control point, so the table is set that
// much under the published half-width.
const halfW = curve([
  [-L2, 0.796], [-2.27, 0.857], [-2.24, 0.887], [-2.18, 0.911], [-2.05, 0.931], [-1.80, 0.946], [-1.50, 0.946], [-AX, 0.946],
  [-1.0, 0.936], [-0.75, 0.911], [-0.50, 0.887], [0, 0.879], [0.50, 0.887], [0.80, 0.911], [1.0, 0.931],
  [AX, 0.941], [1.50, 0.934], [1.75, 0.924], [1.95, 0.911], [2.10, 0.887], [2.18, 0.862], [2.24, 0.826], [2.27, 0.786], [L2, 0.717],
]);
const yWide = curve([
  [-L2, 0.50], [-2.0, 0.60], [-1.5, 0.66], [-AX, 0.66], [-0.8, 0.56], [0, 0.48], [0.8, 0.50], [AX, 0.55], [1.8, 0.44], [L2, 0.40],
]);
/** The visible side's lower edge before the arches cut it. */
const ySillBase = curve([
  [-L2, 0.20], [-2.20, 0.19], [-2.0, 0.19], [-1.6, 0.18], [-1.0, 0.15], [-0.6, 0.135],
  [0.6, 0.135], [1.0, 0.14], [1.6, 0.15], [1.95, 0.15], [2.20, 0.145], [2.25, 0.15], [L2, 0.17],
]);
/**
 * Hip: the outer crest of the body's upper side — the front fender's crest, the door's top edge,
 * the rear haunch's. TRACED on the side and rear photographs (the rear camera fitted to the
 * published mirror width and wing height), ≈. [z, y]
 */
const hipZ = curve([
  [-L2, 0.70], [-2.27, 0.76], [-2.20, 0.83], [-2.0, 0.88], [-1.80, 0.895], [-1.50, 0.90], [-AX, 0.895],
  [-1.0, 0.88], [-0.80, 0.86], [-0.50, 0.85], [0, 0.845], [0.50, 0.845], [0.65, 0.832],
  [0.78, 0.80], [0.85, 0.785], [1.0, 0.77], [AX, 0.76], [1.50, 0.755], [1.64, 0.75], [1.77, 0.745],
  [1.90, 0.735], [2.05, 0.715], [2.20, 0.68], [2.26, 0.66], [L2, 0.64],
]);
const hipY = curve([
  [-L2, 0.74], [-2.27, 0.78], [-2.20, 0.815], [-2.0, 0.84], [-1.80, 0.852], [-1.50, 0.858], [-AX, 0.86],
  [-1.0, 0.862], [-0.80, 0.864], [-0.50, 0.866], [0, 0.868], [0.50, 0.868], [0.65, 0.867],
  [0.78, 0.866], [0.85, 0.866], [1.0, 0.866], [AX, 0.86], [1.50, 0.843], [1.64, 0.834], [1.72, 0.826], [1.79, 0.808], [1.85, 0.773],
  [1.92, 0.70], [2.05, 0.613], [2.15, 0.563], [2.22, 0.528], [2.26, 0.503], [L2, 0.473],
]);
/**
 * Shoulder: inboard of the hip — the front fender's inner slope down to the bonnet, the side
 * window's base along the cabin (≈0.885 m: the side photograph's camera, at the glass's depth), the C-pillar's foot over the rear haunch (the rear photograph
 * has the pillar falling almost straight from the roof's edge to a broad shelf of haunch). [z, y]
 */
const shoulderZ = curve([
  [-L2, 0.55], [-2.27, 0.58], [-2.20, 0.62], [-2.0, 0.64], [-1.80, 0.65], [-1.50, 0.66], [-AX, 0.665],
  [-1.0, 0.70], [-0.80, 0.77], [-0.50, 0.795], [0, 0.795], [0.50, 0.795], [0.65, 0.785],
  [0.78, 0.75], [0.85, 0.63], [1.0, 0.605], [AX, 0.60], [1.50, 0.59], [1.70, 0.58], [1.90, 0.57],
  [2.05, 0.56], [2.20, 0.53], [L2, 0.50],
]);
const shoulderY = curve([
  [-L2, 0.765], [-2.27, 0.80], [-2.20, 0.84], [-2.0, 0.868], [-1.80, 0.885], [-1.50, 0.895], [-AX, 0.90],
  [-1.0, 0.90], [-0.80, 0.892], [-0.50, 0.886], [0, 0.884], [0.50, 0.884], [0.65, 0.884],
  [0.78, 0.876], [0.85, 0.855], [1.0, 0.848], [AX, 0.835], [1.50, 0.81], [1.70, 0.78], [1.90, 0.70],
  [2.05, 0.605], [2.20, 0.531], [L2, 0.474],
]);
/** Upper edge: the bonnet's flank, the A-pillar, the roof's edge, the rear window's, the deck's. */
const upperZ = curve([
  [-L2, 0.40], [-2.27, 0.40], [-2.20, 0.41], [-2.13, 0.42], [-1.97, 0.44], [-1.76, 0.46], [-1.55, 0.50],
  [-1.35, 0.54], [-1.08, 0.55], [-0.93, 0.535], [-0.75, 0.515], [-0.55, 0.51], [-0.30, 0.52], [0, 0.53],
  [0.20, 0.55], [0.45, 0.62], [0.60, 0.665], [0.78, 0.72], [0.85, 0.52], [1.0, 0.46], [AX, 0.44],
  [1.50, 0.43], [1.70, 0.42], [1.90, 0.42], [2.05, 0.41], [2.20, 0.40], [L2, 0.40],
]);
const upperY = curve([
  [-L2, 0.79], [-2.27, 0.828], [-2.24, 0.853], [-2.20, 0.868], [-2.13, 0.877], [-1.97, 0.892], [-1.76, 0.912], [-1.55, 0.967],
  [-1.35, 1.032], [-1.08, 1.127], [-0.93, 1.182], [-0.75, 1.232], [-0.55, 1.257], [-0.30, 1.267], [0, 1.262],
  [0.20, 1.232], [0.45, 1.06], [0.60, 0.96], [0.78, 0.897], [0.85, 0.842], [1.0, 0.813], [AX, 0.782],
  [1.50, 0.742], [1.70, 0.699], [1.90, 0.627], [2.05, 0.578], [2.15, 0.553], [2.22, 0.528], [2.26, 0.503], [L2, 0.474],
]);

/** Wheel-arch openings in the side: centre height, radius (tyre plus the gap the RS carries, ≈). */
export const ARCHES = [
  { x: AXLE_F.x, y: AXLE_F.y, r: 0.42 },
  { x: AXLE_R.x, y: AXLE_R.y, r: 0.40 },
];
function sillEdge(x) {
  let y = ySillBase(x);
  for (const a of ARCHES) {
    const d = Math.abs(x - a.x) / a.r;
    if (d < 1) y = Math.max(y, a.y + a.r * Math.sqrt(1 - d * d));
  }
  return y;
}

// ---- The master surface --------------------------------------------------------------------------
/** Landmarks of the section's parameter: control point i sits at t = i/14. */
export const T = { sillL: 0, hipL: 4 / 14, shoulderL: 5 / 14, upperL: 6 / 14, centre: 0.5, upperR: 8 / 14, shoulderR: 9 / 14, hipR: 10 / 14, sillR: 1 };
const _cache = new Map();
function section(x) {
  const key = Math.round(x * 1e5);
  const hit = _cache.get(key);
  if (hit) return hit;
  const W = halfW(x), yc = yCrown(x), ys = sillEdge(x);
  const zH = hipZ(x), yH = hipY(x), zS = shoulderZ(x), yS = shoulderY(x), zU = upperZ(x), yU = upperY(x);
  // Over an arch the side's lower points ride up with the cut edge, so the section stays in order.
  const yW = Math.min(yH - 0.03, Math.max(yWide(x), ys + 0.42 * (yH - ys)));
  const half = [
    [0.93 * W, ys],                                   // sill or arch edge
    [0.975 * W, ys + 0.3 * (yW - ys)],                // tuck-under
    [W, yW],                                          // widest
    [0.985 * W + 0.015 * zH, yW + 0.55 * (yH - yW)],  // flank
    [zH, yH],                                         // hip: fender crest, door top, haunch crest
    [zS, yS],                                         // shoulder: fender's inner slope, window base, C-pillar foot
    [zU, yU],                                         // upper edge: bonnet edge, roof edge, deck edge
  ];
  const pts = [];
  for (const [z, y] of half) pts.push(new THREE.Vector3(x, y, -z));
  pts.push(new THREE.Vector3(x, yc, 0));
  for (let i = half.length - 1; i >= 0; i--) pts.push(new THREE.Vector3(x, half[i][1], half[i][0]));
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.25);
  if (_cache.size > 6000) _cache.clear();
  _cache.set(key, c);
  return c;
}
const _p = new THREE.Vector3();
/** One point of the body: x along the car, t round the section (0 left sill, 0.5 crown, 1 right sill). */
export function bodyPoint(x, t, out = new THREE.Vector3()) {
  return out.copy(section(x).getPoint(Math.min(1, Math.max(0, t)), _p));
}
/** The outward normal at (x, t), from the surface's own tangents. */
function bodyNormal(x, t, out = new THREE.Vector3()) {
  const e = 0.004, a = bodyPoint(x + e, t), b = bodyPoint(x - e, t), c = bodyPoint(x, t + e), d = bodyPoint(x, t - e);
  return out.subVectors(c, d).cross(a.sub(b)).normalize();
}
/** Stations along the car, refined at the arches, the cowl, the roof's ends and the tips. */
function stationsX(x0, x1, n) {
  const refine = [AX - 0.42, AX + 0.42, -AX - 0.40, -AX + 0.40, 0.78, 0.22, -0.95, -L2 + 0.06, L2 - 0.06];
  const out = [];
  for (let i = 0; i <= n; i++) {
    let u = i / n;
    for (const r of refine) {
      const tr = (r - x0) / (x1 - x0);
      if (tr <= 0.01 || tr >= 0.99) continue;
      const d = u - tr;
      u -= 0.08 * d * Math.exp(-((d / 0.04) ** 2));
    }
    out.push(x0 + (x1 - x0) * u);
  }
  out[0] = x0; out[n] = x1;
  return out;
}
/** Section parameters, refined at the shoulders and the upper edges. */
function paramsT(t0, t1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    let u = i / n;
    for (const land of [T.hipL, T.shoulderL, T.upperL, T.upperR, T.shoulderR, T.hipR]) {
      const tr = (land - t0) / (t1 - t0);
      if (tr <= 0.01 || tr >= 0.99) continue;
      const d = u - tr;
      u -= 0.1 * d * Math.exp(-((d / 0.05) ** 2));
    }
    out.push(t0 + (t1 - t0) * u);
  }
  out[0] = t0; out[n] = t1;
  return out;
}

/**
 * Sweeps the surface over stations xs and parameters ts. `keep(x, t)` picks the quads that
 * belong to this panel (by their centre); UVs in metres. `lift` pushes the surface out along
 * its normal (glass seated proud of the body, a lamp's bowl inside it, the cabin's lining).
 */
function sweep(xs, ts, { keep = null, lift = 0, inward = false } = {}) {
  const nu = xs.length, nv = ts.length;
  const P = [];
  for (const x of xs) { const row = []; for (const t of ts) row.push(bodyPoint(x, t)); P.push(row); }
  const pos = new Float32Array(nu * nv * 3), uv = new Float32Array(nu * nv * 2);
  const n = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < nu; i++) {
    let acc = 0;
    for (let j = 0; j < nv; j++) {
      const p = P[i][j];
      if (j > 0) acc += p.distanceTo(P[i][j - 1]);
      let q = p;
      if (lift) {
        u.subVectors(P[i][Math.min(nv - 1, j + 1)], P[i][Math.max(0, j - 1)]);
        w.subVectors(P[Math.min(nu - 1, i + 1)][j], P[Math.max(0, i - 1)][j]);
        n.crossVectors(u, w).normalize();
        q = p.clone().addScaledVector(n, lift);
      }
      pos.set([q.x, q.y, q.z], (i * nv + j) * 3);
      uv.set([q.x, acc], (i * nv + j) * 2);
    }
  }
  const idx = [];
  for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
    if (keep && !keep((xs[i] + xs[i + 1]) / 2, (ts[j] + ts[j + 1]) / 2)) continue;
    const a = i * nv + j, b = (i + 1) * nv + j, c = (i + 1) * nv + j + 1, d = i * nv + j + 1;
    if (inward) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
  }
  // Keep only the vertices this panel uses: every panel is cut from the same grid, and carrying
  // the whole grid in each would upload it a dozen times.
  const remap = new Int32Array(nu * nv).fill(-1), P2 = [], U2 = [];
  const idx2 = idx.map(k => {
    if (remap[k] < 0) { remap[k] = P2.length / 3; P2.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); U2.push(uv[k * 2], uv[k * 2 + 1]); }
    return remap[k];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
  g.setIndex(idx2);
  g.computeVertexNormals();
  return g;
}

/**
 * The section's parameters for the body: dense in the side-window bands (the panes' slanted
 * edges step by one row each, so rows a centimetre apart keep them straight), coarser below
 * the beltline and over the roof.
 */
function bodyParams() {
  const seg = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / n);
  const half = [...seg(0, T.hipL, 30), ...seg(T.hipL, T.shoulderL - 0.02, 10), ...seg(T.shoulderL - 0.02, T.upperL + 0.01, 46), ...seg(T.upperL + 0.01, 0.5, 26)];
  return [...half, ...half.slice().reverse().map(t => 1 - t).filter(t => t > 0.5 + 1e-9), 0.5].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 1e-9);
}

// ---- Regions of the surface -------------------------------------------------------------------
const side = (t) => (t < 0.5 ? t : 1 - t);                 // fold to the left half: 0 sill … 0.5 crown
const PILLAR = 0.012;                                       // ≈ the painted pillars' width, in t
/** The windscreen, between the A-pillars from the cowl to the header. */
export const inWindscreen = (x, t) => x < 0.765 && x > 0.22 && side(t) > T.upperL + PILLAR;
/**
 * The side windows' daylight opening — the black-framed outline of the door glass and the rear
 * quarter window together — TRACED on the side photograph with its camera (≈1.5 cm): the base
 * along the beltline, the top under the roof's edge falling to the quarter window's rear tip,
 * the front edge along the A-pillar.
 */
export const DLO = {
  bottom: curve([[-1.20, 0.935], [-1.10, 0.912], [-0.90, 0.899], [-0.55, 0.888], [0, 0.886], [0.52, 0.886]]),
  top: curve([[-1.20, 0.935], [-1.16, 0.958], [-1.05, 1.016], [-0.90, 1.080], [-0.70, 1.152], [-0.50, 1.203], [-0.30, 1.222], [0, 1.228], [0.06, 1.228]]),
  /** The front edge, along the A-pillar: x at height y. */
  front: (y) => 0.505 - (y - 0.886) * (0.465 / 0.342),
  tail: -1.20,
  /** The B-pillar's black cover between the panes, and each pane's black frame (≈). */
  bPillar: [-0.578, -0.522], frame: { bottom: 0.016, top: 0.034, front: 0.03, tail: 0.03 },
};
const inSideBand = (t) => side(t) > T.hipL && side(t) < T.upperL + 0.004;
function inDLO(x, y) {
  return x > DLO.tail && x < DLO.front(y) && y > DLO.bottom(x) && y < DLO.top(x);
}
/** The side glass: inside the opening, clear of its black frame and of the B-pillar. */
export function inSideGlass(x, t, y) {
  if (!inSideBand(t)) return false;
  const f = DLO.frame;
  if (!(x > DLO.tail + f.tail && x < DLO.front(y) - f.front && y > DLO.bottom(x) + f.bottom && y < DLO.top(x) - f.top)) return false;
  return !(x > DLO.bPillar[0] && x < DLO.bPillar[1]);
}
/** The rear window, between the C-pillars. */
export const inRearWindow = (x, t) => x < -0.93 && x > -1.60 && side(t) > T.upperL + PILLAR * 1.5;
/** The black seal round the windscreen and the rear window: a band just outside each (≈ 1.5 cm). */
function inSeal(x, t) {
  const pane = (a, b) => inWindscreen(a, b) || inRearWindow(a, b);
  if (pane(x, t)) return false;
  const dx = 0.015, dt = 0.004;
  return pane(x + dx, t) || pane(x - dx, t) || pane(x, t + dt) || pane(x, t - dt);
}

/** The headlamps: round in front elevation, on the front of each fender (≈ ⌀ 0.236 m). */
export const LAMP = { z: 0.715, y: 0.69, r: 0.118, x0: 1.55 };
const lampD = (p) => Math.hypot(Math.abs(p.z) - LAMP.z, p.y - LAMP.y);
/**
 * What covers the body at (x, t): 'glass', 'seal' (the panes' black frames), 'lamp' (a
 * headlamp's opening), 'plastic' (the matt black skirts and the tail's underside), 'tail', or
 * 'paint'. Positions TRACED on the studio photographs, sizes ≈. The parts with curved or slanted
 * outlines — intakes, outlets, louvres, handles — are laid on the surface as patches of their
 * own (loopPatch, bandPatch), whose edges the grid would draw as staircases.
 */
const _rp = new THREE.Vector3();
export function region(x, t) {
  if (inWindscreen(x, t) || inRearWindow(x, t)) return 'glass';
  if (inSeal(x, t)) return 'seal';
  const p = bodyPoint(x, t, _rp), az = Math.abs(p.z), sill = sillEdge(x);
  if (inSideBand(t) && inDLO(x, p.y)) return inSideGlass(x, t, p.y) ? 'glass' : 'seal';
  if (x > LAMP.x0 && lampD(p) < LAMP.r) return 'lamp';
  // The side skirts between the wheels.
  if (x > -0.86 && x < 0.84 && az > 0.80 && p.y < sill + 0.055) return 'plastic';
  // Under the tail, ahead of the diffuser's fins.
  if (x < -1.95 && p.y < 0.24 && az < 0.86) return 'plastic';
  return 'paint';
}

// ---- Materials -------------------------------------------------------------------------------
function gt3Materials(M) {
  if (M.gt3Paint) return M;
  // Arctic Grey: a solid (non-metallic) light grey under a deep clearcoat.
  M.gt3Paint = new THREE.MeshPhysicalMaterial({
    name: 'gt3-paint', color: PAINT.srgb, metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.0,
  });
  M.gt3Glass = new THREE.MeshPhysicalMaterial({
    name: 'gt3-glass', color: 0x1b2024, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.42,
    envMapIntensity: 1.3, depthWrite: false, side: THREE.DoubleSide,
  });
  M.gt3Black = new THREE.MeshStandardMaterial({ name: 'gt3-black-gloss', color: 0x0d0e10, metalness: 0.1, roughness: 0.22 });
  M.gt3Plastic = new THREE.MeshStandardMaterial({ name: 'gt3-black-plastic', color: 0x1c1d1f, metalness: 0, roughness: 0.78 });
  M.gt3Interior = new THREE.MeshStandardMaterial({ name: 'gt3-interior', color: 0x161718, metalness: 0, roughness: 0.9, side: THREE.DoubleSide });
  M.gt3Tyre = new THREE.MeshStandardMaterial({ name: 'gt3-tyre', color: 0x18191a, metalness: 0, roughness: 0.86 });
  // The wheels: forged, in a satin dark finish (≈: the colour is a choice for this car).
  M.gt3Wheel = new THREE.MeshStandardMaterial({ name: 'gt3-wheel', color: 0x2b2d30, metalness: 0.6, roughness: 0.42 });
  M.gt3WheelDS = M.gt3Wheel.clone(); M.gt3WheelDS.name = 'gt3-wheel-rim'; M.gt3WheelDS.side = THREE.DoubleSide;
  M.gt3Disc = new THREE.MeshStandardMaterial({ name: 'gt3-disc', color: 0x6e6a66, metalness: 0.8, roughness: 0.48 });
  // Cast-iron brakes carry red callipers (ceramic ones are yellow).
  M.gt3Calliper = new THREE.MeshStandardMaterial({ name: 'gt3-calliper', color: 0xb3141a, metalness: 0.15, roughness: 0.36 });
  M.gt3Carbon = new THREE.MeshStandardMaterial({ name: 'gt3-carbon', color: 0x17181a, metalness: 0.3, roughness: 0.3 });
  // Lamps: a clear lens over a dark chrome bowl, the four-point daytime lights lit.
  M.gt3Lens = new THREE.MeshPhysicalMaterial({ name: 'gt3-lens', color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.1, envMapIntensity: 0.5, depthWrite: false });
  M.gt3Bowl = new THREE.MeshStandardMaterial({ name: 'gt3-lamp-bowl', color: 0x17191c, metalness: 0.45, roughness: 0.38 });
  M.gt3Drl = new THREE.MeshStandardMaterial({ name: 'gt3-drl', color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.6, roughness: 0.4 });
  M.gt3Tail = new THREE.MeshStandardMaterial({ name: 'gt3-tail', color: 0x7a0a0c, emissive: 0xd0161a, emissiveIntensity: 0.9, roughness: 0.35 });
  M.gt3Smoke = new THREE.MeshStandardMaterial({ name: 'gt3-tail-smoke', color: 0x1a0d0e, metalness: 0.2, roughness: 0.15 });
  // The cabin: Alcantara, smooth leather, the seats' dark red centres, the red belts, the wheel's yellow mark.
  M.gt3Alcantara = new THREE.MeshStandardMaterial({ name: 'gt3-alcantara', color: 0x18191b, metalness: 0, roughness: 0.98 });
  M.gt3Leather = new THREE.MeshStandardMaterial({ name: 'gt3-leather', color: 0x111214, metalness: 0, roughness: 0.55 });
  M.gt3SeatRed = new THREE.MeshStandardMaterial({ name: 'gt3-seat-red', color: 0x4a1015, metalness: 0, roughness: 0.85 });
  M.gt3Belt = new THREE.MeshStandardMaterial({ name: 'gt3-belt', color: 0xb3161e, metalness: 0, roughness: 0.7 });
  M.gt3Yellow = new THREE.MeshStandardMaterial({ name: 'gt3-yellow', color: 0xd6bd22, metalness: 0, roughness: 0.8 });
  {
    const map = clusterTexture();
    M.gt3Cluster = new THREE.MeshStandardMaterial({ name: 'gt3-cluster', color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: map ? 0.9 : 0, roughness: 0.3 });
  }
  // Openings into the body (intakes, outlets, wheel wells): near black, matt.
  M.gt3Void = new THREE.MeshStandardMaterial({ name: 'gt3-void', color: 0x060607, metalness: 0, roughness: 0.95 });
  M.gt3Liner = new THREE.MeshStandardMaterial({ name: 'gt3-arch-liner', color: 0x0c0c0d, metalness: 0, roughness: 0.92, side: THREE.DoubleSide });
  M.gt3Amber = new THREE.MeshStandardMaterial({ name: 'gt3-amber', color: 0x8a4a00, emissive: 0xff9a1a, emissiveIntensity: 0.6, roughness: 0.4 });
  M.gt3MirrorGlass = new THREE.MeshStandardMaterial({ name: 'gt3-mirror-glass', color: 0x9aa0a6, metalness: 1, roughness: 0.04 });
  // The bonnet outlets' and the intakes' grille: the centre's honeycomb texture where it is loaded.
  M.gt3Mesh = M.honeycomb ?? new THREE.MeshStandardMaterial({ name: 'gt3-mesh', color: 0x141516, metalness: 0.15, roughness: 0.62 });
  return M;
}

// ---- The body ---------------------------------------------------------------------------------
/**
 * One end of the body closed with a rounded face: rings shrinking from the last section to its
 * centroid, standing out along ±X by bulge·(1 − f^m)^½ at ring fraction f — flat in the middle,
 * turning through a quarter round at the rim, where it meets the sides tangentially. The face's
 * shape is kept (faceX) for the patches laid on it.
 */
const FACES = {};
function endCap(x, dir, { bulge, m }) {
  const ts = paramsT(0, 1, 136);
  const ring = ts.map(t => bodyPoint(x, t));
  // The section is open across the bottom (sill to sill): close it along the floor.
  const yb = Math.min(ring[0].y, ring[ring.length - 1].y);
  const floor = [];
  for (let k = 1; k < 24; k++) floor.push(new THREE.Vector3(x, yb, ring[ring.length - 1].z + (ring[0].z - ring[ring.length - 1].z) * k / 24));
  const loop = [...ring, ...floor];
  const cy = loop.reduce((s, p) => s + p.y, 0) / loop.length;
  const prof = (f) => bulge * Math.sqrt(Math.max(0, 1 - f ** m));
  FACES[dir] = { x, dir, cy, prof, loop: loop.map(p => [p.z, p.y]) };
  // Rings crowd towards the rim, where the face turns.
  const K = 28, n = loop.length;
  const pts = [];
  for (let k = 0; k <= K; k++) {
    const f = 1 - (k / K) ** 2;
    for (const p of loop) pts.push(new THREE.Vector3(x + dir * prof(f), cy + (p.y - cy) * f, p.z * f));
  }
  const idx = [];
  for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
    idx.push(a, b, c, b, d, c);
  }
  const pos = new Float32Array(pts.length * 3), uv = new Float32Array(pts.length * 2);
  pts.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); uv.set([p.z, p.y], i * 2); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Wound to face out along ±X whichever way the loop ran.
  let sx = 0; const nn = g.attributes.normal;
  for (let i = 0; i < nn.count; i += 7) sx += nn.getX(i);
  if (sx * dir < 0) { g.setIndex(idx.slice().reverse()); g.computeVertexNormals(); }
  return g;
}
/** The face's x at (z, y) of its front elevation: the ring through the point, by its fraction. */
function faceX(dir, z, y) {
  const F = FACES[dir], dz = z, dy = y - F.cy, r = Math.hypot(dz, dy);
  if (r < 1e-9) return F.x + dir * F.prof(0);
  // Where the ray from the centroid through (z, y) leaves the face's outline.
  let best = Infinity;
  const L = F.loop, n = L.length;
  for (let i = 0; i < n; i++) {
    const [z1, y1] = L[i], [z2, y2] = L[(i + 1) % n];
    const ez = z2 - z1, ey = (y2 - F.cy) - (y1 - F.cy), den = dz * ey - dy * ez;
    if (Math.abs(den) < 1e-12) continue;
    const s = (z1 * ey - (y1 - F.cy) * ez) / den, u = (z1 * dy - (y1 - F.cy) * dz) / den;
    if (s > 0 && u >= 0 && u <= 1 && s < best) best = s;
  }
  const f = Math.min(1, 1 / best);
  return F.x + dir * F.prof(f);
}
/**
 * A patch on an end face over a closed outline [[z, y], …] of its front elevation, `lift` out
 * along the face's normal, fanned in rings from the centroid. UVs in metres.
 */
function facePatch(dir, outline, lift = 0.003, minRings = 3) {
  const loop = densify(outline), n = loop.length;
  const cz = loop.reduce((s, p) => s + p[0], 0) / n, cy = loop.reduce((s, p) => s + p[1], 0) / n;
  const rings = ringsFor(loop, cz, cy, minRings);
  const pos = [], uv = [], idx = [];
  const e = 0.004, nrm = new THREE.Vector3();
  const put = (z, y) => {
    const x = faceX(dir, z, y);
    nrm.set(dir, -(faceX(dir, z, y + e) - faceX(dir, z, y - e)) / (2 * e), -(faceX(dir, z + e, y) - faceX(dir, z - e, y)) / (2 * e)).normalize();
    if (nrm.x * dir < 0) nrm.negate();
    pos.push(x + nrm.x * lift, y + nrm.y * lift, z + nrm.z * lift); uv.push(z, y);
  };
  put(cz, cy);
  for (let k = 1; k <= rings; k++) for (const [z, y] of loop) put(cz + (z - cz) * k / rings, cy + (y - cy) * k / rings);
  for (let j = 0; j < n; j++) idx.push(0, 1 + j, 1 + (j + 1) % n);
  for (let k = 1; k < rings; k++) for (let j = 0; j < n; j++) {
    const a = 1 + (k - 1) * n + j, b = 1 + (k - 1) * n + (j + 1) % n;
    idx.push(a, a + n, b, b, a + n, b + n);
  }
  const g = indexed(pos, uv, idx);
  let sx = 0; const nn = g.attributes.normal;
  for (let i = 0; i < nn.count; i++) sx += nn.getX(i);
  if (sx * dir < 0) { g.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  return g;
}

/** A thin dark line drawn on the body along (x, t) samples: shut lines and seams (≈ 4 mm); a negative lift lays it inside, on the cabin's lining. */
function lineOnBody(samples, width = 0.004, lift = 0.0012) {
  const pos = [], idx = [];
  const n = new THREE.Vector3(), d = new THREE.Vector3(), s = new THREE.Vector3();
  const P = samples.map(([x, t]) => bodyPoint(x, t));
  P.forEach((p, i) => {
    const [x, t] = samples[i];
    bodyNormal(x, t, n);
    d.subVectors(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    s.crossVectors(n, d).normalize().multiplyScalar(width / 2);
    const q = p.clone().addScaledVector(n, lift);
    pos.push(q.x - s.x, q.y - s.y, q.z - s.z, q.x + s.x, q.y + s.y, q.z + s.z);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Faces out: compare with the body's normal at the first sample.
  bodyNormal(samples[0][0], samples[0][1], n);
  if ((g.attributes.normal.getX(0) * n.x + g.attributes.normal.getY(0) * n.y + g.attributes.normal.getZ(0) * n.z) * Math.sign(lift) < 0) {
    g.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]]));
    g.computeVertexNormals();
  }
  return g;
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

/**
 * The panels' shut lines: doors, front lid, engine lid, the front bumper's joint. The door's
 * outline TRACED on the side photograph with its camera (≈ ±1.5 cm): the front edge at x ≈ 0.66,
 * the rear one bowing back to −0.58, the bottom 0.27 m up, round corners; the rest ≈.
 */
function buildShutLines(M) {
  const lines = [];
  // The door in side elevation, (x, y), from the top of its front edge round to the top of its rear edge.
  const door = [
    [0.675, 0.862], [0.668, 0.78], [0.662, 0.60], [0.660, 0.40], [0.652, 0.33], [0.630, 0.290], [0.590, 0.272],
    [0.30, 0.270], [0, 0.270], [-0.30, 0.271], [-0.45, 0.276], [-0.515, 0.295], [-0.552, 0.34], [-0.572, 0.42],
    [-0.580, 0.55], [-0.578, 0.66], [-0.566, 0.76], [-0.548, 0.862],
  ];
  const dense = [];
  for (let i = 0; i < door.length - 1; i++) {
    const [x0, y0] = door[i], [x1, y1] = door[i + 1], n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.02));
    for (let k = 0; k < n; k++) dense.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  dense.push(door[door.length - 1]);
  for (const sd of [-1, 1]) {
    lines.push(dense.map(([x, y]) => [x, tAtY(x, y, sd)]));
    // Front lid: along the fender's inner flank, from the cowl to the bumper.
    const tU = sd < 0 ? T.upperL - 0.006 : 1 - T.upperL + 0.006;
    lines.push(range(0.84, 2.05, 40).map(x => [x, tU]));
    // Engine lid: along the deck's edge from the rear window to the ducktail.
    lines.push(range(-2.12, -1.62, 20).map(x => [x, sd < 0 ? T.upperL - 0.004 : 1 - T.upperL + 0.004]));
    // The front bumper's joint with the fender, ahead of the arch (≈).
    const tTop = sd < 0 ? T.upperL - 0.006 : 1 - T.upperL + 0.006;
    lines.push(range(0, 1, 20).map(f => [2.05 - 0.15 * (1 - f), tAtY(1.95, 0.18, sd) + (tTop - tAtY(1.95, 0.18, sd)) * f]));
  }
  // Across the front lid's leading edge and the engine lid's trailing edge.
  lines.push(range(T.upperL - 0.006, 1 - T.upperL + 0.006, 30).map(t => [2.05, t]));
  lines.push(range(T.upperL - 0.004, 1 - T.upperL + 0.004, 30).map(t => [-2.12, t]));
  return mesh(mergeAll(lines.map(l => ({ geometry: lineOnBody(l) }))), M.gt3Black, { name: 'gt3-shut-lines', castShadow: false });
}

// ---- Lamps and seals: smooth outlines over the surface's grid -------------------------------------
/**
 * The body point whose front elevation is (z, y), near a starting guess (x, t): Newton's method
 * on the surface's two parameters. Used to lay round lamps on the fenders, which the grid's
 * quads would draw as staircases.
 */
function onFront(z, y, guess) {
  let { x, t } = guess;
  const e = 1e-4;
  for (let i = 0; i < 12; i++) {
    const p = bodyPoint(x, t), px = bodyPoint(x + e, t), pt = bodyPoint(x, t + e);
    const a = (px.z - p.z) / e, b = (pt.z - p.z) / e, c = (px.y - p.y) / e, d = (pt.y - p.y) / e;
    const rz = z - p.z, ry = y - p.y, det = a * d - b * c;
    if (Math.abs(det) < 1e-9) break;
    x += (rz * d - b * ry) / det; t += (a * ry - c * rz) / det;
    if (Math.hypot(rz, ry) < 1e-5) break;
  }
  return { x, t, p: bodyPoint(x, t) };
}
/** A patch of the body over a ring of the front elevation, ρ from r0 to r1 of the lamp's radius. */
function lampPatch(sd, r0, r1, lift, nr = 6, na = 48) {
  const centre = { x: 1.80, t: sd < 0 ? T.hipL - 0.01 : 1 - T.hipL + 0.01 };
  const c0 = onFront(sd * LAMP.z, LAMP.y, centre);
  const rows = [];
  for (let i = 0; i <= nr; i++) {
    const rho = (r0 + (r1 - r0) * i / nr) * LAMP.r, row = [];
    let guess = c0;
    for (let j = 0; j <= na; j++) {
      const a = TAU * j / na;
      const q = onFront(sd * (LAMP.z + rho * Math.cos(a)), LAMP.y + rho * Math.sin(a), guess);
      guess = q;
      const n = bodyNormal(q.x, q.t);
      row.push(q.p.clone().addScaledVector(n, lift));
    }
    rows.push(row);
  }
  const pos = [], idx = [];
  rows.forEach(r => r.forEach(p => pos.push(p.x, p.y, p.z)));
  for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
    const a = i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Faces forward (out of the fender).
  let sx = 0; const nn = g.attributes.normal;
  for (let i = 0; i < nn.count; i++) sx += nn.getX(i);
  if (sx < 0) { g.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  const uv = new Float32Array(nn.count * 2);
  for (let i = 0; i < nn.count; i++) { uv[2 * i] = g.attributes.position.getZ(i); uv[2 * i + 1] = g.attributes.position.getY(i); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
/** The headlamps: a dark chrome bowl, a clear lens a few millimetres proud, a gloss black bezel over the opening's edge. */
function buildLamps(M) {
  const g = new THREE.Group();
  g.name = 'gt3-lamps';
  const bowls = [], lenses = [], bezels = [];
  for (const sd of [-1, 1]) {
    bowls.push({ geometry: lampPatch(sd, 0, 1.0, -0.002, 8) });
    lenses.push({ geometry: lampPatch(sd, 0, 1.0, 0.008, 8) });
    bezels.push({ geometry: lampPatch(sd, 0.93, 1.16, 0.003, 2) });
  }
  g.add(mesh(mergeAll(bowls), M.gt3Bowl, { name: 'gt3-lamp-bowls', castShadow: false }));
  const lens = mesh(mergeAll(lenses), M.gt3Lens, { name: 'gt3-lamp-lenses', castShadow: false });
  lens.renderOrder = 2;
  g.add(lens);
  g.add(mesh(mergeAll(bezels), M.gt3Black, { name: 'gt3-lamp-bezels', castShadow: false }));
  return g;
}
/**
 * The side windows' black outline laid along its exact edges (on the grid its slanted ones would
 * step): the front edge up the A-pillar, the top under the roof's edge, the base, and the
 * B-pillar's cover.
 */
function buildGlassSeals(M) {
  const lines = [], wide = [];
  const yTop = (x) => DLO.top(x), yBot = (x) => DLO.bottom(x);
  for (const sd of [-1, 1]) {
    const at = (pts) => pts.map(([x, y]) => [x, tAtY(x, y, sd)]);
    const yF = range(0, 1, 24).map(f => 0.886 + (1.228 - 0.886) * f);
    lines.push(at(yF.map(y => [DLO.front(y) - 0.006, y])));
    lines.push(at(range(DLO.tail + 0.01, DLO.front(1.228) - 0.004, 60).map(x => [x, yTop(x) - 0.006])));
    lines.push(at(range(DLO.tail + 0.01, DLO.front(0.886), 50).map(x => [x, yBot(x) + 0.005])));
    const xb = (DLO.bPillar[0] + DLO.bPillar[1]) / 2;
    wide.push(at(range(yBot(xb) + 0.01, yTop(xb) - 0.01, 12).map(y => [xb, y])));
  }
  return mesh(mergeAll([...lines.map(l => ({ geometry: lineOnBody(l, 0.016) })), ...wide.map(l => ({ geometry: lineOnBody(l, DLO.bPillar[1] - DLO.bPillar[0]) }))]), M.gt3Black, { name: 'gt3-glass-edge-seals', castShadow: false });
}

/** A rounded rectangle on one of the end faces, a few millimetres proud (intakes, the tail's panel and lamps). */
const facePlate = (dir, z0, z1, y0, y1, r, lift = 0.003) => facePatch(dir, rrectLoop(z0, z1, y0, y1, r), lift);
/**
 * What the faces carry: the bumper's black lower panel with the central honeycomb intake, its
 * two dividers, the large side openings and the black brows over them (TRACED on the front
 * photograph with its fitted camera, ≈ ±1.5 cm); the tail's lamps and black panel (rear
 * photograph), ≈.
 */
function buildFacePlates(M) {
  const g = new THREE.Group();
  g.name = 'gt3-face-plates';
  const P = (list, mat, name) => g.add(mesh(mergeAll(list.map(geometry => ({ geometry }))), mat, { name, castShadow: false }));
  const poly = (pts, n = 6) => pts.flatMap(([z0, y0], i) => { const [z1, y1] = pts[(i + 1) % pts.length]; return range(0, 1, n).slice(0, -1).map(f => [z0 + (z1 - z0) * f, y0 + (y1 - y0) * f]); });
  P([facePlate(1, -0.77, 0.77, 0.13, 0.275, 0.03, 0.002)], M.gt3Plastic, 'gt3-nose-panel');
  P([facePlate(1, -0.53, 0.53, 0.14, 0.302, 0.03, 0.004),
    ...[-1, 1].map(sd => facePatch(1, poly([[0.545, 0.14], [0.772, 0.14], [0.700, 0.385], [0.545, 0.385]].map(([z, y]) => [sd * z, y])), 0.004))], M.gt3Mesh, 'gt3-nose-intakes');
  P([...[-0.16, 0.16].map(z => facePlate(1, z - 0.006, z + 0.006, 0.142, 0.300, 0.004, 0.007)),
    ...[-1, 1].map(sd => facePatch(1, poly([[0.48, 0.372], [0.725, 0.398], [0.725, 0.414], [0.48, 0.390]].map(([z, y]) => [sd * z, y]), 4), 0.008))], M.gt3Black, 'gt3-nose-bars');
  // Tail: the black lower panel wrapping into the corners, the lamp units, the light bar between them, the reflectors.
  P([facePlate(-1, -0.86, 0.86, 0.22, 0.50, 0.06)], M.gt3Plastic, 'gt3-tail-panel');
  P([facePlate(-1, -0.80, -0.50, 0.665, 0.770, 0.03), facePlate(-1, 0.50, 0.80, 0.665, 0.770, 0.03)], M.gt3Smoke, 'gt3-tail-lamps');
  P([facePlate(-1, -0.76, 0.76, 0.728, 0.748, 0.006, 0.005), facePlate(-1, -0.80, -0.63, 0.345, 0.372, 0.008, 0.005), facePlate(-1, 0.63, 0.80, 0.345, 0.372, 0.008, 0.005)], M.gt3Tail, 'gt3-tail-lights');
  return g;
}

// ---- Parts laid on the surface ----------------------------------------------------------------------
/**
 * The section parameter on one side where the body stands at height y — side elevation, from the
 * sill to the roof's edge, where the section rises monotonically — or at half-width z — plan, from
 * the upper edge to the crown, where it narrows monotonically.
 */
function tAtY(x, y, sd) {
  let lo = 0, hi = T.upperL;
  for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (bodyPoint(x, m).y < y) lo = m; else hi = m; }
  const t = (lo + hi) / 2;
  return sd < 0 ? t : 1 - t;
}
function tAtZ(x, z, sd) {
  let lo = T.upperL, hi = 0.5;
  for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (-bodyPoint(x, m).z > z) lo = m; else hi = m; }
  const t = (lo + hi) / 2;
  return sd < 0 ? t : 1 - t;
}
/** (u, v) of a view — 'side' (x, y) or 'plan' (x, half-width) — to the body's (x, t) on side sd. */
const onBody = (view, sd, u, v) => ({ x: u, t: view === 'plan' ? tAtZ(u, v, sd) : tAtY(u, v, sd) });
const _sn = new THREE.Vector3();
function surf(view, sd, u, v, lift) {
  // Side elevation: no lower than just above the sill or arch edge, where the surface ends.
  if (view === 'side') v = Math.max(v, sillEdge(u) + 0.004);
  const { x, t } = onBody(view, sd, u, v);
  const p = bodyPoint(x, t);
  return lift ? p.addScaledVector(bodyNormal(x, t, _sn), lift) : p;
}
/** Faces wound to look along `out` (per face): flips the ones that do not. */
function facesGeo(faces) {
  const pos = [], ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for (const { q, out } of faces) {
    const tris = q.length === 4 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [q];
    for (let [a, b, c] of tris) {
      n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      if (n.dot(out) < 0) [b, c] = [c, b];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/**
 * A patch of the body between two curves of a view: u from u0 to u1, v from lo(u) to hi(u),
 * `lift` off the surface. UVs in metres. The outline follows the curves exactly, however the
 * body's grid runs beneath.
 */
function bandPatch(view, sd, u0, u1, lo, hi, { lift = 0.002, nu = 24, nv = 6 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = u0 + (u1 - u0) * i / nu;
    for (let j = 0; j <= nv; j++) {
      const v = lo(u) + (hi(u) - lo(u)) * j / nv;
      const p = surf(view, sd, u, v, lift);
      pos.push(p.x, p.y, p.z); uv.push(u, v);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return orientOut(indexed(pos, uv, idx), view, sd, (u0 + u1) / 2, (lo((u0 + u1) / 2) + hi((u0 + u1) / 2)) / 2);
}
/** A closed outline resampled so no edge is longer than `step`: patches follow the curved surface between vertices. */
function densify(loop, step = 0.012) {
  const out = [];
  loop.forEach(([u0, v0], i) => {
    const [u1, v1] = loop[(i + 1) % loop.length], n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / step));
    for (let k = 0; k < n; k++) out.push([u0 + (u1 - u0) * k / n, v0 + (v1 - v0) * k / n]);
  });
  return out;
}
/** Rings enough that none is more than ≈2.5 cm from the next (at most 14). */
const ringsFor = (loop, cu, cv, min) => Math.max(min, Math.min(14, Math.ceil(Math.max(...loop.map(([u, v]) => Math.hypot(u - cu, v - cv))) / 0.025)));
/** A patch over a closed outline [[u, v], …] of a view, fanned in rings from its centroid (star-shaped outlines). */
function loopPatch(view, sd, outline, { lift = 0.002, rings: minRings = 3 } = {}) {
  const loop = densify(outline), n = loop.length;
  const cu = loop.reduce((s, p) => s + p[0], 0) / n, cv = loop.reduce((s, p) => s + p[1], 0) / n;
  const rings = ringsFor(loop, cu, cv, minRings);
  const pos = [], uv = [], idx = [];
  const put = (u, v) => { const p = surf(view, sd, u, v, lift); pos.push(p.x, p.y, p.z); uv.push(u, v); };
  put(cu, cv);
  for (let k = 1; k <= rings; k++) for (const [u, v] of loop) put(cu + (u - cu) * k / rings, cv + (v - cv) * k / rings);
  for (let j = 0; j < n; j++) idx.push(0, 1 + j, 1 + (j + 1) % n);
  for (let k = 1; k < rings; k++) for (let j = 0; j < n; j++) {
    const a = 1 + (k - 1) * n + j, b = 1 + (k - 1) * n + (j + 1) % n;
    idx.push(a, a + n, b, b, a + n, b + n);
  }
  return orientOut(indexed(pos, uv, idx), view, sd, cu, cv);
}
/** The rim of a raised patch: a wall round a closed outline from the surface up to `lift`. */
function loopWall(view, sd, outline, lift, base = -0.002) {
  const faces = [], loop = densify(outline);
  const n = loop.length;
  const cu = loop.reduce((s, p) => s + p[0], 0) / n, cv = loop.reduce((s, p) => s + p[1], 0) / n;
  const c = surf(view, sd, cu, cv, 0);
  const lo = loop.map(([u, v]) => surf(view, sd, u, v, base)), hi = loop.map(([u, v]) => surf(view, sd, u, v, lift));
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    const out = lo[j].clone().add(lo[k]).multiplyScalar(0.5).sub(c);
    faces.push({ q: [lo[j], lo[k], hi[k], hi[j]], out });
  }
  return facesGeo(faces);
}
function indexed(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Turns a patch to face out of the body (the body's normal at a point of it). */
function orientOut(g, view, sd, u, v) {
  const { x, t } = onBody(view, sd, u, v);
  const n = bodyNormal(x, t), nn = g.attributes.normal;
  let s = 0;
  for (let i = 0; i < nn.count; i++) s += nn.getX(i) * n.x + nn.getY(i) * n.y + nn.getZ(i) * n.z;
  if (s < 0) { const ix = g.index.array; g.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  return g;
}
/**
 * A fin standing on the body along samples [{x, t}]: `h(f)` tall at fraction f along it, `th`
 * thick, leaning by `lean` (metres along the car per metre of height), its ends closed.
 */
function bodyFin(samples, h, th, { lean = 0, base = -0.002 } = {}) {
  const P = samples.map(({ x, t }) => bodyPoint(x, t)), N = samples.map(({ x, t }) => bodyNormal(x, t));
  const n = P.length, L = [], R = [], LT = [], RT = [];
  const d = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    s.crossVectors(N[i], d).normalize().multiplyScalar(th / 2);
    const hh = h(i / (n - 1));
    const b = P[i].clone().addScaledVector(N[i], base);
    const top = P[i].clone().addScaledVector(N[i], hh).add(new THREE.Vector3(-lean * hh, 0, 0));
    L.push(b.clone().sub(s)); R.push(b.clone().add(s)); LT.push(top.clone().sub(s)); RT.push(top.clone().add(s));
  }
  const faces = [];
  for (let i = 0; i < n - 1; i++) {
    const out = s.crossVectors(N[i], d.subVectors(P[i + 1], P[i])).clone();
    faces.push({ q: [L[i], L[i + 1], LT[i + 1], LT[i]], out: out.clone().negate() });
    faces.push({ q: [R[i], R[i + 1], RT[i + 1], RT[i]], out });
    faces.push({ q: [LT[i], LT[i + 1], RT[i + 1], RT[i]], out: N[i] });
  }
  faces.push({ q: [L[0], R[0], RT[0], LT[0]], out: P[0].clone().sub(P[1]) });
  faces.push({ q: [L[n - 1], R[n - 1], RT[n - 1], LT[n - 1]], out: P[n - 1].clone().sub(P[n - 2]) });
  return facesGeo(faces);
}
/** A stadium outline from centre a (radius ra) to centre b (radius rb): slots, handles. */
function slotLoop(a, b, ra, rb, n = 40) {
  const ux = b[0] - a[0], uy = b[1] - a[1], L = Math.hypot(ux, uy);
  const out = [];
  for (let k = 0; k < n; k++) {
    const th = TAU * k / n, cx = Math.cos(th), cy = Math.sin(th);
    const far = (cx * ux + cy * uy) / L >= 0;
    out.push(far ? [b[0] + rb * cx, b[1] + rb * cy] : [a[0] + ra * cx, a[1] + ra * cy]);
  }
  return out;
}
/** A rounded rectangle's outline in a view. */
function rrectLoop(u0, u1, v0, v1, r, nc = 5) {
  const out = [];
  const corner = (cu, cv, a0) => { for (let k = 0; k <= nc; k++) { const a = a0 + (Math.PI / 2) * k / nc; out.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } };
  corner(u1 - r, v0 + r, -Math.PI / 2); corner(u1 - r, v1 - r, 0); corner(u0 + r, v1 - r, Math.PI / 2); corner(u0 + r, v0 + r, Math.PI);
  return out;
}
const along = (view, sd, pts) => pts.map(([u, v]) => onBody(view, sd, u, v));

/**
 * The body's details, TRACED on the studio photographs (the side one with its fitted camera,
 * positions ≈ ±1.5 cm; heights and depths of the raised parts ≈):
 *  - the rear fenders' intakes ahead of the rear wheels, a slot leaning back, wider at the top;
 *  - the bonnet's two outlets for the central radiator's air, with their mesh, the tall black
 *    wall along each one's inboard edge and the two vanes inside;
 *  - the louvres over the front wheels, in an opening on the fender's outer slope;
 *  - the black blades behind and ahead of the front wheels, the dark outlet behind the front
 *    blade and the amber side repeater in it;
 *  - the flush door handles, the fuel filler flap on the right front fender, the fins on the
 *    roof, the wipers, and the wheel arches' black liners.
 */
function buildBodyDetails(M) {
  const g = new THREE.Group();
  g.name = 'gt3-body-details';
  const add = (list, mat, name, opts = {}) => g.add(mesh(mergeAll(list.map(geometry => ({ geometry }))), mat, { name, castShadow: false, ...opts }));
  const voids = [], plastic = [], paint = [], amber = [], honey = [], liners = [];
  for (const sd of [-1, 1]) {
    // Rear fender intake: from (−0.735, 0.575) up and back to (−0.925, 0.775).
    voids.push(loopPatch('side', sd, slotLoop([-0.735, 0.575], [-0.925, 0.775], 0.028, 0.042), { lift: 0.0015 }));
    // Door handle: thin at the front, round at the back, standing a few millimetres proud of a dark recess.
    const handle = slotLoop([-0.278, 0.692], [-0.488, 0.692], 0.007, 0.016);
    voids.push(loopPatch('side', sd, slotLoop([-0.272, 0.689], [-0.492, 0.689], 0.011, 0.021), { lift: 0.001 }));
    paint.push(loopPatch('side', sd, handle, { lift: 0.008 }), loopWall('side', sd, handle, 0.008));
    // Behind the front wheel: the outlet and the side repeater, then the black blade standing off the body.
    voids.push(loopPatch('side', sd, [[0.700, 0.17], [0.757, 0.17], [0.757, 0.55], [0.735, 0.562], [0.700, 0.55]], { lift: 0.0015 }));
    amber.push(loopPatch('side', sd, slotLoop([0.706, 0.499], [0.752, 0.505], 0.006, 0.006, 24), { lift: 0.004 }));
    {
      const outline = [[0.745, 0.135], [0.862, 0.135], [0.869, 0.25], [0.866, 0.36], [0.855, 0.45], [0.830, 0.530], [0.800, 0.562], [0.765, 0.565], [0.745, 0.52]];
      const geo = plateXY(outline, 0.012);
      geo.translate(0, 0, sd * 0.918);
      plastic.push(geo);
    }
    // Behind the rear wheel: the arch's black outlet; at the tail's corner, the black lower panel wrapping round.
    plastic.push(loopPatch('side', sd, [[-1.80, 0.205], [-1.895, 0.205], [-1.93, 0.30], [-1.93, 0.50], [-1.86, 0.53], [-1.80, 0.50]], { lift: 0.002 }));
    plastic.push(loopPatch('side', sd, [[-2.05, 0.21], [X_TAIL, 0.21], [X_TAIL, 0.48], [-2.115, 0.48]], { lift: 0.002 }));
    // Ahead of the front wheel: the bumper's black blade, standing off its corner in front of the tyre.
    {
      const geo = plateXY([[1.595, 0.16], [1.690, 0.16], [1.695, 0.47], [1.670, 0.505], [1.620, 0.50], [1.598, 0.45], [1.592, 0.30]], 0.012);
      geo.translate(0, 0, sd * 0.934);
      plastic.push(geo);
    }
    // Front fender louvres: the opening on the outer slope over the wheel, four slats leaning back, the wall along its top.
    {
      const lo = curve([[0.93, 0.775], [1.05, 0.775], [1.17, 0.765], [1.27, 0.737], [1.36, 0.70]]);
      const hi = curve([[0.93, 0.838], [1.01, 0.846], [1.16, 0.846], [1.29, 0.822], [1.36, 0.772]]);
      voids.push(bandPatch('side', sd, 0.93, 1.36, lo, hi, { lift: 0.0015, nu: 30, nv: 4 }));
      for (const x of [1.02, 1.10, 1.18, 1.26]) {
        plastic.push(bodyFin(along('side', sd, range(lo(x) + 0.004, hi(x) - 0.004, 6).map(y => [x, y])), () => 0.026, 0.006, { lean: 0.7 }));
      }
      plastic.push(bodyFin(along('side', sd, range(0.93, 1.35, 24).map(x => [x, hi(x)])), (f) => 0.008 + 0.018 * Math.sin(Math.PI * Math.min(1, f * 1.15)), 0.008));
    }
    // Bonnet outlets: the mesh, a black frame, the tall wall on the inboard edge, two vanes, the lip at the front.
    {
      // A trapezoid in plan, widening forwards (front photograph).
      const trap = (k) => [[1.42 - k, 0.10 - k], [1.80 + k, 0.10 - k], [1.80 + k, 0.405 + k], [1.42 - k, 0.300 + k]];
      const edge = (pts, n = 10) => pts.flatMap(([u0, v0], i) => { const [u1, v1] = pts[(i + 1) % pts.length]; return range(0, 1, n).slice(0, -1).map(f => [u0 + (u1 - u0) * f, v0 + (v1 - v0) * f]); });
      plastic.push(loopPatch('plan', sd, edge(trap(0.012)), { lift: 0.003, rings: 2 }));
      honey.push(loopPatch('plan', sd, edge(trap(-0.002)), { lift: 0.0045, rings: 4 }));
      const wallH = curve([[1.40, 0.012], [1.46, 0.068], [1.62, 0.074], [1.76, 0.062], [1.84, 0.012]]);
      plastic.push(bodyFin(along('plan', sd, range(1.40, 1.84, 22).map(x => [x, 0.095])), (f) => wallH(1.40 + 0.44 * f), 0.012));
      for (const z of [0.172, 0.248]) plastic.push(bodyFin(along('plan', sd, range(1.46, 1.76, 12).map(x => [x, z])), (f) => 0.012 + 0.024 * Math.sin(Math.PI * f), 0.006));
      plastic.push(bandPatch('plan', sd, 1.785, 1.835, () => 0.095, () => 0.40, { lift: 0.009, nu: 3, nv: 10 }));
    }
    // Roof fins: on the roof just inboard of its edges, rising towards the squared-off rear end.
    plastic.push(bandPatch('plan', sd, -0.875, -0.395, () => 0.428, () => 0.452, { lift: 0.0015, nu: 20, nv: 2 }));
    plastic.push(bodyFin(along('plan', sd, range(-0.865, -0.405, 24).map(x => [x, 0.44])), (f) => 0.034 - 0.030 * f ** 1.4, 0.006));
    // The wheel arches' liners: black shells inside each opening, so the wheel well is dark, not hollow.
    for (const a of ARCHES) {
      const pos = [], idx = [], na = 36, z0 = 0.52, z1 = 0.90;
      for (let i = 0; i <= na; i++) {
        const phi = -0.30 + (Math.PI + 0.60) * i / na, r = a.r - 0.004;
        for (const z of [z0, z1]) pos.push(a.x + r * Math.cos(phi), a.y + r * Math.sin(phi), sd * z);
        if (i < na) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      liners.push(indexed(pos, pos.map(() => 0).slice(0, (pos.length / 3) * 2), idx));
    }
  }
  // Fuel filler flap on the right front fender (the side photographs show it there): its shut line.
  {
    const loop = range(0, 1, 48).map(f => [0.90 + 0.09 * Math.cos(TAU * f), 0.77 + 0.065 * Math.sin(TAU * f)]);
    g.add(mesh(lineOnBody(loop.map(([x, y]) => [x, tAtY(x, y, 1)]), 0.0035), M.gt3Black, { name: 'gt3-fuel-flap', castShadow: false }));
  }
  // Wipers: two blades parked along the windscreen's foot (≈).
  {
    const blade = (z0, z1) => range(z0, z1, 16).map(z => { const sd = z < 0 ? -1 : 1; return { x: 0.735 - 0.02 * Math.abs(z) / 0.6, t: tAtZ(0.735 - 0.02 * Math.abs(z) / 0.6, Math.max(0.002, Math.abs(z)), sd) }; });
    add([bodyFin(blade(-0.60, -0.04), () => 0.016, 0.014, { base: 0.003 }), bodyFin(blade(-0.01, 0.52), () => 0.016, 0.014, { base: 0.003 })], M.gt3Black, 'gt3-wipers');
  }
  add(voids, M.gt3Void, 'gt3-openings');
  add(plastic, M.gt3Plastic, 'gt3-black-trim');
  add(paint, M.gt3Paint, 'gt3-door-handles');
  add(amber, M.gt3Amber, 'gt3-side-repeaters');
  add(honey, M.gt3Mesh, 'gt3-bonnet-mesh');
  add(liners, M.gt3Liner, 'gt3-arch-liners');
  return g;
}

function buildBody(M) {
  const g = new THREE.Group();
  g.name = 'gt3-body';
  const xs = stationsX(X_TAIL, X_NOSE, 330), ts = bodyParams();
  // Each region its own mesh, cut from the one surface.
  const cache = new Map();
  const reg = (x, t) => {
    const k = `${x.toFixed(5)},${t.toFixed(5)}`;
    let r = cache.get(k);
    if (r === undefined) { r = region(x, t); cache.set(k, r); }
    return r;
  };
  const MAT = { paint: M.gt3Paint, seal: M.gt3Black, plastic: M.gt3Plastic };
  for (const [key, mat] of Object.entries(MAT)) {
    g.add(mesh(sweep(xs, ts, { keep: (x, t) => reg(x, t) === key, lift: key === 'seal' ? 0.001 : 0 }), mat, { name: key === 'paint' ? 'gt3-body-paint' : `gt3-body-${key}` }));
  }
  const glass = mesh(sweep(xs, ts, { keep: (x, t) => reg(x, t) === 'glass', lift: 0.002 }), M.gt3Glass, { name: 'gt3-glass', castShadow: false });
  glass.renderOrder = 2;
  g.add(glass);
  // The ends: a rounded face each, the nose's carrying the intakes, the tail's the lamps.
  g.add(mesh(endCap(X_NOSE, 1, CAP.nose), M.gt3Paint, { name: 'gt3-nose-face' }));
  g.add(mesh(endCap(X_TAIL, -1, CAP.tail), M.gt3Paint, { name: 'gt3-tail-face' }));
  g.add(buildLamps(M));
  g.add(buildGlassSeals(M));
  g.add(buildFacePlates(M));
  // The cabin's lining: the same surface a few centimetres in, facing inwards, so the inside of
  // the body is trimmed, not the back of the paint — open where the glass is, so the driver sees
  // out and the cabin is seen through the windows.
  g.add(mesh(sweep(stationsX(-1.45, 0.80, 120), bodyParams().filter(t => t > 0.08 && t < 0.92), { lift: -0.03, inward: true, keep: (x, t) => reg(x, t) !== 'glass' }), M.gt3Interior, { name: 'gt3-cabin-lining', castShadow: false }));
  // Inside, the side windows' frames along their exact outline: the lining's own edge steps on its grid.
  {
    const trims = [];
    for (const sd of [-1, 1]) {
      const at = (pts) => pts.map(([x, y]) => [x, tAtY(x, y, sd)]);
      trims.push(at(range(0.886, 1.228, 24).map(y => [DLO.front(y) - DLO.frame.front, y])));
      trims.push(at(range(DLO.tail + 0.02, DLO.front(1.228) - 0.02, 60).map(x => [x, DLO.top(x) - DLO.frame.top])));
    }
    g.add(mesh(mergeAll(trims.map(l => ({ geometry: lineOnBody(l, 0.06, -0.028) }))), M.gt3Interior, { name: 'gt3-cabin-window-trims', castShadow: false }));
  }
  // Underbody: a flat floor between the sills, inside the wheels.
  {
    const geo = new THREE.PlaneGeometry(2 * L2 - 0.3, 1.5);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0.14, 0);
    g.add(mesh(geo, M.gt3Plastic, { name: 'gt3-floor', castShadow: false }));
  }
  g.add(buildShutLines(M));
  g.add(buildBodyDetails(M));
  return g;
}
// ---- Wheels and brakes ------------------------------------------------------------------------------
/**
 * One corner, at the published sizes (275/35 ZR 20 on 10 J × 20 front, 335/30 ZR 21 on 13 J × 21
 * rear, 408 × 36 and 380 × 30 mm discs): the tyre with its rounded shoulders, bulging sidewalls and
 * three circumferential grooves (≈, no lettering); the forged centre-lock wheel with ten spokes
 * that fork in a Y before the rim, dished towards the face (≈ from the photographs), its barrel
 * and flanges; the centre-lock nut; the cross-drilled disc on its aluminium bell; and the fixed
 * monobloc calliper, six pistons front and four rear (published), hugging the disc's trailing edge
 * (size ≈). `side` +1 right, −1 left; the wheel's face looks out.
 */
function buildWheel(M, axle, side, name, brakes) {
  const g = new THREE.Group();
  g.name = name;
  const tyre = axle.tyre, R = tyre.dia / 2, w = tyre.width, rr = tyre.rimDia / 2, rw = tyre.rimWidth;
  const front = axle === AXLE_F;
  // The wheel's own frame: its axle along local +Z, the outer face at +Z.
  const spin = new THREE.Group();
  spin.name = `${name}-spin`;
  spin.add(mesh(tyreGeo(R, w, rr), M.gt3Tyre, { name: `${name}-tyre` }));
  // Rim: outer flange and lip, the barrel, the inner flange — one turned profile, seen from both sides.
  const rim = [
    [rr - 0.006, -rw / 2 - 0.004], [rr + 0.012, -rw / 2 - 0.006], [rr + 0.014, -rw / 2 + 0.004], [rr - 0.002, -rw / 2 + 0.012],
    [rr - 0.006, -rw / 2 + 0.03], [rr - 0.006, rw / 2 - 0.03], [rr - 0.001, rw / 2 - 0.012], [rr + 0.015, rw / 2 - 0.004],
    [rr + 0.013, rw / 2 + 0.008], [rr - 0.004, rw / 2 + 0.006], [rr - 0.016, rw / 2 - 0.004],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const rimGeo = new THREE.LatheGeometry(rim, 96);
  rimGeo.rotateX(Math.PI / 2);
  spin.add(mesh(rimGeo, M.gt3WheelDS, { name: `${name}-rim` }));
  // Spokes: ten stems from the hub, each forking into two arms that meet the rim's lip.
  const faces = [];
  const zFace = rw / 2 - 0.006, dish = front ? 0.045 : 0.075;
  const r0 = 0.078, rs = rr * 0.58, r1 = rr - 0.010;
  const zAt = (r) => zFace - dish * Math.pow(Math.max(0, (r - r0) / (r1 - r0)), 0.8);
  const bar = (a0, a1, ra, rb, wa, wb, da, db) => {
    // A tapered bar from (ra, a0) to (rb, a1) in polar coordinates, da/db deep at its ends, its face on the dish.
    const P = (r, a, off, dz) => {
      const c = Math.cos(a), s = Math.sin(a);
      return new THREE.Vector3(r * c - off * s, r * s + off * c, zAt(r) - dz);
    };
    const A = [P(ra, a0, -wa / 2, 0), P(ra, a0, wa / 2, 0), P(rb, a1, wb / 2, 0), P(rb, a1, -wb / 2, 0)];
    const B = [P(ra, a0, -wa / 2, da), P(ra, a0, wa / 2, da), P(rb, a1, wb / 2, db), P(rb, a1, -wb / 2, db)];
    const mid = A.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    const o = (q) => q.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(1 / q.length).sub(mid);
    faces.push({ q: A, out: new THREE.Vector3(0, 0, 1) });
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, q = [A[i], A[j], B[j], B[i]], out = o(q);
      out.z = 0;
      faces.push({ q, out });
    }
  };
  const spread = Math.PI / 10 * 0.46;
  for (let k = 0; k < 10; k++) {
    const a = k * TAU / 10;
    bar(a, a, r0, rs + 0.006, 0.034, 0.028, 0.040, 0.030);
    for (const sgn of [-1, 1]) bar(a + sgn * spread * 0.08, a + sgn * spread, rs - 0.004, r1, 0.017, 0.015, 0.030, 0.024);
  }
  spin.add(mesh(facesGeo(faces), M.gt3Wheel, { name: `${name}-spokes` }));
  // Hub and centre-lock nut with its cap.
  const hub = new THREE.CylinderGeometry(r0 + 0.006, r0 + 0.012, 0.05, 40);
  hub.rotateX(Math.PI / 2); hub.translate(0, 0, zFace - 0.022);
  spin.add(mesh(hub, M.gt3Wheel, { name: `${name}-hub` }));
  const nut = new THREE.CylinderGeometry(0.046, 0.05, 0.034, 12);
  nut.rotateX(Math.PI / 2); nut.translate(0, 0, zFace + 0.016);
  spin.add(mesh(nut, M.alumDark ?? M.gt3Disc, { name: `${name}-nut` }));
  const cap = new THREE.CylinderGeometry(0.034, 0.036, 0.012, 32);
  cap.rotateX(Math.PI / 2); cap.translate(0, 0, zFace + 0.036);
  spin.add(mesh(cap, M.gt3Black, { name: `${name}-nut-cap`, castShadow: false }));
  // The cross-drilled disc on its bell, inboard of the spokes.
  const d = brakes.disc / 2, zDisc = -0.022;
  spin.add(mesh(drilledDisc(d, d * 0.56, brakes.thickness, zDisc), M.gt3Disc, { name: `${name}-disc` }));
  const bell = new THREE.CylinderGeometry(d * 0.56, d * 0.58, 0.05, 40);
  bell.rotateX(Math.PI / 2); bell.translate(0, 0, zDisc + brakes.thickness / 2 + 0.02);
  spin.add(mesh(bell, M.alumDark ?? M.gt3Plastic, { name: `${name}-bell` }));
  // The wheel faces out: mirror the frame on the left.
  spin.scale.z = side;
  g.add(spin);
  // Calliper: fixed, gripping the disc's trailing edge, a little below the axle (≈); not turning with the wheel.
  const span = brakes.pistons > 4 ? 1.30 : 1.05, ac = Math.PI + 0.32;
  const sh = new THREE.Shape();
  const rin = d - 0.068, rout = d + 0.018;
  sh.absarc(0, 0, rout, ac - span / 2, ac + span / 2, false);
  sh.absarc(0, 0, rin, ac + span / 2, ac - span / 2, true);
  const depth = brakes.thickness + 0.075;
  const ca = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 2, curveSegments: 24 });
  ca.translate(0, 0, zDisc - depth / 2);
  ca.scale(1, 1, side);
  const cal = mesh(ca, M.gt3Calliper, { name: `${name}-calliper` });
  g.add(cal);
  g.position.set(axle.x, axle.y, side * axle.track / 2);
  g.userData.spin = spin;
  return g;
}
/** The tyre's section turned round the axle: beads, bulging sidewalls, rounded shoulders, a tread with three grooves. */
function tyreGeo(R, w, rr) {
  const h = w / 2;
  // From the outer bead up the sidewall to the shoulder (z > 0 side), as (r, z).
  const side = [[rr + 0.010, h * 0.86], [rr + 0.030, h * 0.95], [rr + 0.42 * (R - rr), h * 1.03], [rr + 0.75 * (R - rr), h * 1.01], [R - 0.020, h * 0.96], [R - 0.006, h * 0.90], [R, h * 0.80]];
  // The tread from that shoulder across, the grooves ≈8 mm wide and 6 mm deep.
  const tread = [];
  for (const gz of [0.42, -0.06, -0.50].map(f => f * h)) tread.push([R, gz + 0.004], [R - 0.006, gz + 0.003], [R - 0.006, gz - 0.003], [R, gz - 0.004]);
  // Ordered from the inner bead to the outer one, as the lathe faces outwards.
  const prof = [...side, ...tread, ...side.slice().reverse().map(([r, z]) => [r, -z])].reverse();
  const geo = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 96);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}
/** A brake disc: an annulus `th` thick with three spiralling rows of cross-drilled holes (≈ the pattern). */
function drilledDisc(rOut, rIn, th, z) {
  const circle = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => new THREE.Vector2(cx + r * Math.cos(TAU * i / n), cy + r * Math.sin(TAU * i / n)));
  const sh = new THREE.Shape(circle(0, 0, rOut, 120));
  sh.holes.push(new THREE.Path(circle(0, 0, rIn, 72).reverse()));
  for (let k = 0; k < 24; k++) for (let row = 0; row < 3; row++) {
    const r = rIn + (rOut - rIn) * (0.30 + 0.22 * row), a = k * TAU / 24 + row * 0.07;
    sh.holes.push(new THREE.Path(circle(r * Math.cos(a), r * Math.sin(a), 0.0045, 8).reverse()));
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false });
  geo.translate(0, 0, z - th / 2);
  return geo;
}

// ---- Rear wing --------------------------------------------------------------------------------
/** A cambered wing section (downforce: camber below), chord along −X from the leading edge. */
function airfoil(chord, thick, camber, n = 18) {
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const t = (1 - Math.cos(Math.PI * i / n)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
    const yc = -camber * 4 * t * (1 - t);
    up.push([-t * chord, (yc + yt) * chord]); lo.push([-t * chord, (yc - yt) * chord]);
  }
  return [...up, ...lo.reverse().slice(1, -1)];
}
/**
 * The swan-neck rear wing, TRACED on the side and rear photographs with their fitted cameras
 * (≈ ±1.5 cm; sections ≈): the fixed main plane and the hydraulically adjusted upper element
 * (the DRS flap, hinged at its leading edge; group gt3-wing-flap), both carbon; the large black
 * end plates; the two swan necks, each a slanted front leg and an upright rear one rising from
 * the engine lid and holding the elements from above, with the DRS's red hydraulic cylinder
 * inside each. Its upper edge is the car's published height, 1.322 m. The span is not published:
 * the front photograph's camera reads ≈1.63 m between the end plates, the rear one's ≈1.80 m
 * over them; 1.74 m lies between them (≈ ±5 cm).
 */
export const WING = {
  span: 1.74, neckZ: 0.345,
  main: { le: -1.60, chord: 0.38, y: 1.188, aoa: 8 },
  flap: { le: -1.925, chord: 0.34, y: 1.236, aoa: 14 },
  // End plate in side elevation (x, y), at the plates' depth.
  plate: [[-1.538, 1.100], [-1.652, 1.224], [-1.75, 1.262], [-2.00, 1.284], [-2.30, 1.298], [-2.33, 1.282], [-2.33, 1.248], [-2.22, 1.140], [-1.88, 1.088]],
};
function buildWing(M) {
  const g = new THREE.Group();
  g.name = 'gt3-wing';
  const S = WING.span, skin = M.carbon ?? M.gt3Carbon;
  const element = (e, name) => {
    const pts = airfoil(e.chord, 0.12, 0.06);
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: S, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -S / 2);
    // Trailing edge up: the angle of attack for downforce.
    geo.rotateZ(-e.aoa * D2R);
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(e.le, e.y, 0);
    grp.add(mesh(geo, skin, { name: `${name}-skin` }));
    return grp;
  };
  g.add(element(WING.main, 'gt3-wing-main'));
  const flap = element(WING.flap, 'gt3-wing-flap');
  // DRS: the flap turns about its leading edge to flatten (the drive sets the angle).
  flap.userData.hinge = { axis: [0, 0, 1], range: [0, 14] };
  g.add(flap);
  // End plates: a plate each side, clear of both elements, with rounded corners (bevel).
  for (const sd of [-1, 1]) {
    const geo = plateXY(WING.plate, 0.010);
    geo.translate(0, 0, sd * (S / 2 + 0.005));
    g.add(mesh(geo, M.gt3Plastic, { name: `gt3-wing-endplate-${sd > 0 ? 'r' : 'l'}` }));
  }
  // Swan necks: one outline each in side elevation, the feet sunk into the engine lid.
  const foot = (x) => bodyPoint(x, tAtZ(x, WING.neckZ, 1)).y - 0.03;
  const neck = [
    [-1.640, foot(-1.640)], [-1.835, 1.272], [-1.870, 1.302], [-1.950, 1.308], [-2.020, 1.293], [-2.030, 1.268],
    [-1.988, 1.250], [-1.990, 1.20], [-1.997, foot(-1.997)], [-1.947, foot(-1.947)], [-1.935, 1.155],
    [-1.862, 1.155], [-1.708, foot(-1.708)],
  ];
  const red = [], alu = [];
  for (const sd of [-1, 1]) {
    const shape = new THREE.Shape(neck.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    geo.translate(0, 0, sd * WING.neckZ - 0.011);
    g.add(mesh(geo, M.gt3Plastic, { name: `gt3-wing-neck-${sd > 0 ? 'r' : 'l'}` }));
    // The DRS cylinder inboard of the neck's top, its rod to the flap's lever.
    const z = sd * (WING.neckZ - 0.032);
    const cyl = new THREE.CylinderGeometry(0.0125, 0.0125, 0.105, 16);
    cyl.rotateZ(Math.PI / 2 - 0.08); cyl.translate(-1.975, 1.272, z);
    red.push({ geometry: cyl });
    const rod = new THREE.CylinderGeometry(0.0045, 0.0045, 0.06, 10);
    rod.rotateZ(Math.PI / 2 - 0.08); rod.translate(-1.895, 1.268, z);
    alu.push({ geometry: rod });
  }
  g.add(mesh(mergeAll(red), M.gt3Calliper, { name: 'gt3-wing-drs-cylinders' }));
  g.add(mesh(mergeAll(alu), M.aluminum ?? M.gt3Disc, { name: 'gt3-wing-drs-rods', castShadow: false }));
  // The wing's upper edge is the car's published height: set it there exactly.
  g.updateMatrixWorld(true);
  const box = new THREE.Box3();
  g.traverse(o => { if (o.isMesh) box.expandByObject(o); });
  g.position.y += BODY.height - box.max.y;
  return g;
}
/** A flat plate in the XY plane from an outline, `thick` thick along Z (centred). */
function plateXY(outline, thick) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geo.translate(0, 0, -thick / 2);
  return geo;
}

// ---- Mirrors ----------------------------------------------------------------------------------
/**
 * Door mirrors, TRACED on the side photograph (≈ ±1.5 cm): the housing from x 0.205 to 0.43 m,
 * 0.86 to 1.005 m up, its outer face at the published 2.027 m over both; body-coloured above, black
 * below, the glass on its flat back; a black arm from the door's front top corner. The housing's
 * plan and sections ≈ from the front and three-quarter photographs.
 */
export const MIRROR = { x0: 0.205, x1: 0.43, y0: 0.86, y1: 1.005, depth: 0.13 };
function buildMirrors(M) {
  const g = new THREE.Group();
  g.name = 'gt3-mirrors';
  const { x0, x1, y0, y1, depth } = MIRROR;
  const out = BODY.widthMirrors / 2, hz = depth / 2, hy = (y1 - y0) / 2, yc = (y0 + y1) / 2;
  // Sections along the housing: a rounded square (superellipse) shrinking to the nose.
  const NS = 18, NA = 40, pe = 3.0;
  const sect = (f) => [hz * Math.pow(Math.max(0, 1 - f ** 2.4), 0.5), hy * Math.pow(Math.max(0, 1 - f ** 2.8), 0.5)];
  for (const sd of [-1, 1]) {
    const tag = sd > 0 ? 'r' : 'l', zc = sd * (out - hz);
    const pts = [];
    for (let i = 0; i <= NS; i++) {
      const f = i / NS, x = x0 + (x1 - x0) * f, [a, b] = sect(Math.min(f, 0.999));
      // The nose sweeps inboard and down a little (≈).
      const dz = -sd * 0.02 * f * f, dy = -0.008 * f * f;
      for (let j = 0; j <= NA; j++) {
        const th = TAU * j / NA, c = Math.cos(th), s = Math.sin(th);
        pts.push([x, yc + dy + b * Math.sign(s) * Math.abs(s) ** (2 / pe), zc + dz + a * Math.sign(c) * Math.abs(c) ** (2 / pe)]);
      }
    }
    // Split at a line under the housing's middle: paint above, black below.
    const split = yc - 0.022;
    const upper = [], lower = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) {
      const k = (i * (NA + 1) + j), q = [pts[k], pts[k + NA + 1], pts[k + NA + 2], pts[k + 1]].map(p => new THREE.Vector3(...p));
      const mid = q.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      const outv = mid.clone().sub(new THREE.Vector3(mid.x, yc, zc));
      if (i === NS - 1) outv.x += 0.02;
      (mid.y > split ? upper : lower).push({ q, out: outv });
    }
    g.add(mesh(facesGeo(upper), M.gt3Paint, { name: `gt3-mirror-${tag}` }));
    g.add(mesh(facesGeo(lower), M.gt3Black, { name: `gt3-mirror-base-${tag}` }));
    // The back: a black rim closing the housing and the glass inside it, both flat.
    const back = (k, dx) => {
      const c = new THREE.Vector3(x0 - dx, yc, zc), ring = [];
      for (let j = 0; j < NA; j++) {
        const th = TAU * j / NA, co = Math.cos(th), si = Math.sin(th);
        ring.push(new THREE.Vector3(x0 - dx, yc + k * hy * Math.sign(si) * Math.abs(si) ** (2 / pe), zc + k * hz * Math.sign(co) * Math.abs(co) ** (2 / pe)));
      }
      return facesGeo(ring.map((p, j) => ({ q: [c, p, ring[(j + 1) % NA]], out: new THREE.Vector3(-1, 0, 0) })));
    };
    g.add(mesh(back(1, 0.0005), M.gt3Black, { name: `gt3-mirror-rim-${tag}`, castShadow: false }));
    g.add(mesh(back(0.9, 0.0015), M.gt3MirrorGlass, { name: `gt3-mirror-glass-${tag}`, castShadow: false }));
    // Arm: a flattened blade from the door's front top corner up and out to the housing's underside.
    const root = bodyPoint(0.47, tAtY(0.47, 0.872, sd));
    const path = new THREE.CatmullRomCurve3([
      root.clone().add(new THREE.Vector3(0, -0.004, -sd * 0.012)),
      new THREE.Vector3(0.45, 0.885, sd * (Math.abs(root.z) + 0.035)),
      new THREE.Vector3(0.41, 0.892, sd * (out - hz - 0.02)),
      new THREE.Vector3(0.36, 0.895, sd * (out - hz)),
    ]);
    g.add(mesh(bladeTube(path, 0.022, 0.009, 14), M.gt3Black, { name: `gt3-mirror-arm-${tag}` }));
  }
  return g;
}
/** A tube of elliptical section along a path: `a` across in the horizontal, `b` up (an arm, a stay). */
function bladeTube(path, a, b, n = 12, na = 14) {
  const pos = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = path.getPointAt(u);
    path.getTangentAt(u, t);
    e1.crossVectors(up, t).normalize(); e2.crossVectors(t, e1).normalize();
    for (let j = 0; j <= na; j++) {
      const th = TAU * j / na;
      const q = p.clone().addScaledVector(e1, a * Math.cos(th)).addScaledVector(e2, b * Math.sin(th));
      pos.push(q.x, q.y, q.z);
      if (i < n && j < na) { const k = i * (na + 1) + j; idx.push(k, k + na + 1, k + 1, k + 1, k + na + 1, k + na + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- Details: splitter, lamps' lights, exhaust, diffuser -------------------------
/** The front splitter: a carbon blade under the bumper, 2 cm proud of it all round (≈). */
function buildSplitter(M) {
  const pts = [];
  for (const x of range(1.85, X_NOSE, 16)) pts.push([x, halfW(x) * 0.97]);
  const outline = [...pts, [L2 + 0.025, 0.55], [L2 + 0.025, -0.55], ...pts.slice().reverse().map(([x, z]) => [x, -z])];
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);          // the shape's (x, z) onto the ground plane, extruded down
  geo.translate(0, 0.14, 0);
  return mesh(geo, M.gt3Carbon, { name: 'gt3-splitter' });
}
/** Each lamp's four-point daytime light and its projector, on the bowl inside the lens (≈ from the front photographs). */
function buildLampLights(M) {
  const dots = [], proj = [];
  for (const sd of [-1, 1]) {
    const guess = { x: 1.80, t: sd < 0 ? T.hipL - 0.01 : 1 - T.hipL + 0.01 };
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const hit = onFront(sd * (LAMP.z + Math.cos(a) * 0.072), LAMP.y + Math.sin(a) * 0.072, guess);
      const n = bodyNormal(hit.x, hit.t);
      const geo = new THREE.CapsuleGeometry(0.008, 0.038, 4, 8);
      // Each bar along its radius, lying on the bowl.
      const r = new THREE.Vector3(0, Math.sin(a), sd * Math.cos(a)).normalize();
      const along = r.clone().addScaledVector(n, -r.dot(n)).normalize();
      geo.applyMatrix4(new THREE.Matrix4().makeBasis(along.clone().cross(n).normalize(), along, n).setPosition(hit.p.clone().addScaledVector(n, 0.004)));
      dots.push({ geometry: geo });
    }
    const c = onFront(sd * LAMP.z, LAMP.y, guess);
    const n = bodyNormal(c.x, c.t);
    const geo = new THREE.CylinderGeometry(0.034, 0.038, 0.016, 24);
    const e1 = new THREE.Vector3(0, 1, 0).cross(n).normalize(), e3 = n.clone().cross(e1).normalize();
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(e1, n, e3).setPosition(c.p.clone().addScaledVector(n, 0.004)));
    proj.push({ geometry: geo });
  }
  const g = new THREE.Group();
  g.name = 'gt3-lamp-lights';
  g.add(mesh(mergeAll(dots), M.gt3Drl, { name: 'gt3-drl', castShadow: false }));
  g.add(mesh(mergeAll(proj), M.gt3Bowl, { name: 'gt3-projectors', castShadow: false }));
  return g;
}
/** Twin tailpipes in the middle of the diffuser (rear photograph: ⌀ ≈0.11 m, 0.15 m apart). */
function buildExhaust(M) {
  const parts = [];
  for (const sd of [-1, 1]) {
    const outer = new THREE.CylinderGeometry(0.056, 0.056, 0.10, 28, 1, true);
    outer.rotateZ(Math.PI / 2); outer.translate(-L2 + 0.03, 0.155, sd * 0.075);
    parts.push({ geometry: outer });
    const lip = new THREE.TorusGeometry(0.052, 0.005, 6, 28);
    lip.rotateY(Math.PI / 2); lip.translate(-L2 - 0.02, 0.155, sd * 0.075);
    parts.push({ geometry: lip });
  }
  const g = new THREE.Group();
  g.name = 'gt3-exhaust';
  g.add(mesh(mergeAll(parts), M.aluminum ?? M.gt3Disc, { name: 'gt3-tailpipes' }));
  for (const sd of [-1, 1]) {
    const inner = new THREE.CircleGeometry(0.05, 24);
    inner.rotateY(-Math.PI / 2); inner.translate(-L2 + 0.0, 0.155, sd * 0.075);
    g.add(mesh(inner, M.gt3Black, { name: `gt3-tailpipe-bore-${sd > 0 ? 'r' : 'l'}`, castShadow: false }));
  }
  return g;
}
/** The diffuser's fins under the tail (rear photograph: six, ≈). */
function buildDiffuser(M) {
  const fins = [];
  for (const z of [0.20, 0.42, 0.64]) for (const sd of [-1, 1]) {
    const shape = new THREE.Shape([new THREE.Vector2(-1.98, 0.12), new THREE.Vector2(-L2 + 0.01, 0.10), new THREE.Vector2(-L2 + 0.01, 0.235), new THREE.Vector2(-2.10, 0.235)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
    geo.translate(0, 0, sd * z - 0.004);
    fins.push({ geometry: geo });
  }
  return mesh(mergeAll(fins), M.gt3Plastic, { name: 'gt3-diffuser-fins' });
}

// ---- The cabin -------------------------------------------------------------------------------------
/** A box w × h × d with rounded edges of radius r, centred at the origin. */
function roundBox(w, h, d, r) {
  const sh = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
  sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.absarc(x, -y, r, -Math.PI / 2, 0, false);
  sh.lineTo(w / 2, y); sh.absarc(x, y, r, 0, Math.PI / 2, false);
  sh.lineTo(-x, h / 2); sh.absarc(-x, y, r, Math.PI / 2, Math.PI, false);
  sh.lineTo(-w / 2, -y); sh.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: 3, curveSegments: 4 });
  geo.translate(0, 0, -(d - 2 * r) / 2);
  return geo;
}
const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
  return geo;
};
/**
 * The instrument cluster's faces: the analogue tachometer in the middle (to 10,000 /min, the
 * red line at 9,000) between four round screens, drawn once on a canvas (browser only; ≈ the
 * layout of the photographs, no logos).
 */
function clusterTexture() {
  if (typeof document === 'undefined') return null;
  try {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#050607'; x.fillRect(0, 0, 1024, 256);
    const dial = (cx, r, analogue) => {
      x.beginPath(); x.arc(cx, 128, r, 0, TAU); x.fillStyle = analogue ? '#0c0d0f' : '#07090b'; x.fill();
      x.lineWidth = 3; x.strokeStyle = '#5b6066'; x.stroke();
      if (!analogue) {
        x.strokeStyle = '#2f8fd8'; x.lineWidth = 5; x.beginPath(); x.arc(cx, 128, r * 0.72, Math.PI * 0.8, Math.PI * 1.9); x.stroke();
        x.fillStyle = '#d8dde2'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText(cx < 512 ? '90 °C' : '24 °C', cx, 138);
        return;
      }
      // Tachometer: 0–10 (× 1,000 /min) over 270°, red from 9.
      for (let k = 0; k <= 50; k++) {
        const a = Math.PI * 0.75 + (k / 50) * Math.PI * 1.5, big = k % 5 === 0;
        x.strokeStyle = k >= 45 ? '#d6222a' : '#e8ecef'; x.lineWidth = big ? 4 : 2;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r * (big ? 0.78 : 0.84), 128 + Math.sin(a) * r * (big ? 0.78 : 0.84)); x.lineTo(cx + Math.cos(a) * r * 0.92, 128 + Math.sin(a) * r * 0.92); x.stroke();
        if (big) { x.fillStyle = '#e8ecef'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillText(String(k / 5), cx + Math.cos(a) * r * 0.62, 136 + Math.sin(a) * r * 0.62); }
      }
      // The needle at idle, the gear and the speed in the middle.
      const a = Math.PI * 0.75 + 0.09 * Math.PI * 1.5;
      x.strokeStyle = '#f2c230'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx, 128); x.lineTo(cx + Math.cos(a) * r * 0.8, 128 + Math.sin(a) * r * 0.8); x.stroke();
      x.fillStyle = '#e8ecef'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('N', cx, 196);
    };
    dial(110, 82, false); dial(300, 96, false); dial(512, 118, true); dial(724, 96, false); dial(914, 82, false);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  } catch { return null; }
}
/**
 * What the glass shows, and the driver's view: the dashboard with the cluster's hood, its five
 * round instruments (an analogue tachometer in the middle) and the centre screen; the stopwatch
 * on the dash's top; the 360 mm (published) GT steering wheel in Alcantara with its yellow
 * twelve-o'clock marker, three spokes, hub and paddles; the centre console with the gear
 * selector; two carbon full bucket seats with cut-outs, a dark red centre and red belts; the
 * doors' red pull straps; the Clubsport package's bolted roll cage with its cross behind the
 * seats; the pedals, the floor and the tunnel. Left-hand drive. Positions and sizes ≈ from the
 * interior photographs, the published wheel diameter aside.
 */
function buildCabin(M) {
  const g = new THREE.Group();
  g.name = 'gt3-cabin';
  const parts = { trim: [], leather: [], red: [], belt: [], black: [], carbon: [], alu: [], yellow: [], screen: [], glass: [] };
  const P = (k, geo) => parts[k].push({ geometry: geo });
  const DZ = -0.37;                       // the driver's centre line (left-hand drive)
  // Dashboard: one profile across the car, the cowl to the knees.
  {
    const prof = [[0.78, 0.835], [0.58, 0.885], [0.46, 0.884], [0.405, 0.862], [0.395, 0.80], [0.42, 0.70], [0.47, 0.60], [0.78, 0.56]];
    const sh = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
    const dash = new THREE.ExtrudeGeometry(sh, { depth: 1.40, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    dash.translate(0, 0, -0.70);
    P('leather', dash);
  }
  // The cluster's hood over the driver's instruments, and their face.
  {
    const hood = new THREE.CylinderGeometry(0.205, 0.205, 0.13, 32, 1, true, -Math.PI / 2, Math.PI);
    P('leather', at(hood, 0.445, 0.87, DZ, 0, 0, Math.PI / 2 - 0.12));
    const face = new THREE.PlaneGeometry(0.40, 0.10);
    P('screen', at(face, 0.41, 0.895, DZ, 0, -Math.PI / 2, 0.22));
    // The centre screen and the vents under it; the stopwatch on top of the dash.
    P('glass', at(new THREE.PlaneGeometry(0.26, 0.10), 0.398, 0.79, 0.08, 0, -Math.PI / 2, 0.18));
    for (const z of [-0.06, 0.20]) P('black', at(roundBox(0.02, 0.035, 0.16, 0.006), 0.40, 0.70, z));
    const clock = new THREE.CylinderGeometry(0.038, 0.042, 0.035, 28);
    P('black', at(clock, 0.60, 0.895, 0, 0, 0, 0.5));
    P('alu', at(new THREE.TorusGeometry(0.038, 0.004, 6, 28), 0.585, 0.905, 0, 0, Math.PI / 2, -0.5));
  }
  // Steering wheel: ⌀ 360 mm, its top leaning forward ≈22°, the column down into the dash. Built
  // facing the driver (its axis along X), then tilted and placed.
  {
    const local = [];
    const rim = new THREE.TorusGeometry(0.163, 0.0175, 12, 48);
    rim.rotateY(Math.PI / 2);
    local.push(['trim', rim]);
    const mark = new THREE.TorusGeometry(0.163, 0.0182, 12, 6, 0.10);
    mark.rotateZ(Math.PI / 2 - 0.05); mark.rotateY(Math.PI / 2);
    local.push(['yellow', mark]);
    for (const s of [-1, 1]) local.push(['leather', at(roundBox(0.022, 0.032, 0.105, 0.008), 0, -0.01, s * 0.112)]);
    local.push(['leather', at(roundBox(0.022, 0.10, 0.036, 0.008), 0, -0.11, 0)]);
    const hub = new THREE.CylinderGeometry(0.068, 0.072, 0.045, 32);
    hub.rotateZ(Math.PI / 2);
    local.push(['leather', hub]);
    for (const s of [-1, 1]) local.push(['carbon', at(roundBox(0.012, 0.10, 0.05, 0.005), 0.04, 0.02, s * 0.12)]);
    const col = new THREE.CylinderGeometry(0.032, 0.045, 0.30, 16);
    col.rotateZ(Math.PI / 2); col.translate(0.17, 0, 0);
    local.push(['black', col]);
    const m = new THREE.Matrix4().makeRotationZ(-0.38).setPosition(0.255, 0.815, DZ);
    for (const [k, geo] of local) P(k, geo.applyMatrix4(m));
  }
  // Centre console and tunnel, the gear selector on it.
  {
    const con = new THREE.Shape([[0.43, 0.62], [0.40, 0.66], [0.22, 0.60], [-0.30, 0.47], [-0.30, 0.22], [0.43, 0.22]].map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(con, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    geo.translate(0, 0, -0.11);
    P('carbon', geo);
    const stick = new THREE.CylinderGeometry(0.009, 0.012, 0.11, 10);
    P('alu', at(stick, 0.17, 0.66, 0, 0, 0, 0.25));
    P('black', at(new THREE.SphereGeometry(0.03, 16, 12), 0.157, 0.715, 0));
    P('leather', at(roundBox(0.12, 0.03, 0.10, 0.01), 0.18, 0.605, 0, 0, 0, 0.25));
  }
  // Floor, pedals (two: the PDK has no clutch) and the footwell's sides.
  P('trim', at(roundBox(1.55, 0.03, 1.46, 0.01), -0.12, 0.215, 0));
  for (const [z, w] of [[DZ + 0.06, 0.07], [DZ - 0.08, 0.05]]) P('alu', at(roundBox(0.012, 0.09, w, 0.004), 0.72, 0.33, z, 0, 0, -0.35));
  // Seats: carbon full buckets, the backrest's cut-outs at the shoulders, a dark red centre, red belts.
  for (const sd of [-1, 1]) {
    const zc = sd * 0.37;
    const shell = new THREE.Shape();
    const W = 0.27;
    shell.moveTo(-W, 0); shell.lineTo(W, 0); shell.lineTo(W * 1.02, 0.42); shell.quadraticCurveTo(W * 0.98, 0.62, W * 0.62, 0.70);
    shell.lineTo(W * 0.42, 0.80); shell.quadraticCurveTo(0, 0.86, -W * 0.42, 0.80); shell.lineTo(-W * 0.62, 0.70);
    shell.quadraticCurveTo(-W * 0.98, 0.62, -W * 1.02, 0.42); shell.closePath();
    for (const [hx, hw] of [[-0.12, 0.065], [0, 0.05], [0.12, 0.065]]) {
      const h = new THREE.Path();
      h.absellipse(hx, 0.575, hw, 0.035, 0, TAU, true);
      shell.holes.push(h);
    }
    const back = new THREE.ExtrudeGeometry(shell, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8 });
    // The shape's (z, y) across the car and up; its depth along the car; leaning back.
    back.rotateY(Math.PI / 2);
    P('carbon', at(back, -0.50, 0.30, zc, 0, 0, 0.30));
    // Bolsters and cushion, leather, with the dark red centre panels.
    for (const s of [-1, 1]) P('leather', at(roundBox(0.12, 0.42, 0.075, 0.03), -0.47, 0.55, zc + s * 0.22, 0, 0, 0.30));
    P('leather', at(roundBox(0.06, 0.45, 0.36, 0.025), -0.46, 0.55, zc, 0, 0, 0.30));
    P('red', at(roundBox(0.012, 0.36, 0.22, 0.004), -0.425, 0.56, zc, 0, 0, 0.30));
    P('leather', at(roundBox(0.48, 0.09, 0.40, 0.03), -0.22, 0.305, zc, 0, 0, -0.08));
    for (const s of [-1, 1]) P('leather', at(roundBox(0.46, 0.13, 0.07, 0.03), -0.22, 0.34, zc + s * 0.22, 0, 0, -0.08));
    P('red', at(roundBox(0.34, 0.012, 0.22, 0.004), -0.20, 0.352, zc, 0, 0, -0.08));
    // The belt: from the shoulder, across the backrest to the buckle by the tunnel, and the lap belt.
    const inner = -sd;
    const belt = (a, b, wid) => {
      const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), len = d.length();
      const geo = new THREE.BoxGeometry(0.004, len, wid);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
      return geo;
    };
    P('belt', belt([-0.52, 0.95, zc - inner * 0.17], [-0.36, 0.42, zc + inner * 0.16], 0.048));
    P('belt', belt([-0.30, 0.38, zc - inner * 0.20], [-0.34, 0.38, zc + inner * 0.18], 0.048));
    P('alu', at(roundBox(0.05, 0.03, 0.02, 0.005), -0.33, 0.40, zc + inner * 0.20));
    // The door's red pull strap.
    P('belt', at(roundBox(0.11, 0.022, 0.012, 0.004), 0.26, 0.70, sd * 0.79));
  }
  // Roll cage (Clubsport package): the main hoop behind the seats with its cross, the stays aft, a harness bar.
  {
    const tubes = [];
    const tube = (pts, r = 0.02) => tubes.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 20, r, 10) });
    tube([[-0.82, 0.24, -0.60], [-0.82, 0.95, -0.58], [-0.80, 1.16, -0.42], [-0.80, 1.19, 0], [-0.80, 1.16, 0.42], [-0.82, 0.95, 0.58], [-0.82, 0.24, 0.60]]);
    tube([[-0.82, 0.30, -0.56], [-0.81, 1.13, 0.40]], 0.018);
    tube([[-0.82, 0.30, 0.56], [-0.81, 1.13, -0.40]], 0.018);
    tube([[-0.82, 0.70, -0.59], [-0.82, 0.70, 0.59]], 0.017);
    for (const sd of [-1, 1]) tube([[-0.80, 1.15, sd * 0.44], [-1.10, 1.03, sd * 0.50], [-1.40, 0.92, sd * 0.55]], 0.018);
    g.add(mesh(mergeAll(tubes), M.gt3Black, { name: 'gt3-roll-cage' }));
  }
  const MAT = {
    trim: M.gt3Alcantara, leather: M.gt3Leather, red: M.gt3SeatRed, belt: M.gt3Belt, black: M.gt3Black,
    carbon: M.carbon ?? M.gt3Carbon, alu: M.aluminum ?? M.gt3Disc, yellow: M.gt3Yellow, screen: M.gt3Cluster, glass: M.gt3Black,
  };
  for (const [k, list] of Object.entries(parts)) if (list.length) g.add(mesh(mergeAll(list), MAT[k], { name: `gt3-cabin-${k}`, castShadow: k !== 'screen' && k !== 'glass' }));
  return g;
}

export function buildGt3rs(M) {
  gt3Materials(M);
  const root = new THREE.Group();
  root.name = 'gt3rs';
  // Everything on the springs: body, wing, mirrors, cabin, lamps.
  const sprung = new THREE.Group();
  sprung.name = 'gt3-sprung';
  sprung.add(buildBody(M), buildWing(M), buildMirrors(M), buildCabin(M), buildSplitter(M), buildLampLights(M), buildExhaust(M), buildDiffuser(M));
  root.add(sprung);
  for (const side of [-1, 1]) {
    root.add(buildWheel(M, AXLE_F, side, `gt3-wheel-f${side > 0 ? 'r' : 'l'}`, BRAKES.front));
    root.add(buildWheel(M, AXLE_R, side, `gt3-wheel-r${side > 0 ? 'r' : 'l'}`, BRAKES.rear));
  }
  root.userData.length = BODY.length;
  root.userData.height = BODY.height;
  return root;
}
