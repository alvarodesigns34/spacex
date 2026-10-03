/**
 * Porsche 911 GT3 RS (type 992, model year 2023), at 1:1, as Porsche photographed it: near-white
 * grey, red wheels.
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
 * curved or slanted outlines are patches laid on it (bandPatch, loopPatch, endPatch), so neither can drift
 * apart from it; the nose and the tail are reliefs over the last sections (relief). The cabin is
 * its own module (gt3Cabin.js). The body, wing, mirrors and cabin hang in group gt3-sprung, which the
 * drive pitches and rolls on the springs; the four wheels are outside it.
 */
import * as THREE from 'three';
import { mesh, mergeAll, curve } from '../geometry/utils.js';
import { BODY, WHEELS, BRAKES, PAINT } from '../data/gt3rs.js';
import { buildCabin } from './gt3Cabin.js';

const L2 = BODY.length / 2, AX = BODY.wheelbase / 2, D2R = Math.PI / 180, TAU = Math.PI * 2;
const RF = WHEELS.front.dia / 2, RR = WHEELS.rear.dia / 2;
/** Static ride: the tyres stand ≈8 mm compressed under the car's weight (≈). */
const SQUASH = 0.008;
/**
 * Where the swept body hands over to the ends' reliefs (NOSE and TAIL below): each stands out to
 * the published ±2.286 m and turns tangent into the sides at its rim — the bumpers' corners.
 */
const X_NOSE = 2.00, X_TAIL = -2.10;
export const AXLE_F = { x: AX, y: RF - SQUASH, track: BODY.trackFront, tyre: WHEELS.front };
export const AXLE_R = { x: -AX, y: RR - SQUASH, track: BODY.trackRear, tyre: WHEELS.rear };

// ---- Key tables (X ascending) -----------------------------------------------------------------
// TRACED on the studio photographs unless noted; the ends are the published ±2.286 m.
// Half-widths reconstructed against the published 1.900 m.

/** Centre-line crown: the tail's top, engine lid, rear window, roof, windscreen, bonnet, nose. */
const yCrown = curve([
  // The engine lid ends in the ducktail: its lip rises ≈2.5 cm over the lid to 0.906 m (side and tail photographs).
  [-L2, 0.80], [-2.27, 0.835], [-2.20, 0.88], [-2.10, 0.906], [-2.04, 0.894], [-1.97, 0.893], [-1.76, 0.922], [-1.55, 0.987],
  [-1.35, 1.057], [-1.08, 1.153], [-0.93, 1.21], [-0.75, 1.262], [-0.55, 1.282], [-0.30, 1.289], [0, 1.283],
  [0.20, 1.247], [0.45, 1.075], [0.60, 0.975], [0.78, 0.867], [0.85, 0.842], [1.0, 0.82], [AX, 0.792],
  [1.50, 0.750], [1.70, 0.697], [1.85, 0.637], [1.95, 0.585], [2.0, 0.556], [2.10, 0.50], [L2, 0.45],
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
  // Ahead of the cowl, TRACED on the side photograph's silhouette (its top there is this crest):
  // it falls steadily from 0.855 m over the wheel to 0.60 m where the bumper begins.
  [0.78, 0.864], [0.85, 0.861], [1.0, 0.856], [AX, 0.848], [1.39, 0.838], [1.50, 0.824], [1.61, 0.800],
  [1.70, 0.762], [1.78, 0.716], [1.85, 0.673], [1.92, 0.636], [2.0, 0.600], [2.10, 0.54], [L2, 0.47],
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
  [0.78, 0.872], [0.85, 0.853], [1.0, 0.845], [AX, 0.832], [1.50, 0.802], [1.70, 0.738], [1.85, 0.658],
  [2.0, 0.586], [2.10, 0.53], [L2, 0.465],
]);
/** Upper edge: the bonnet's flank, the A-pillar, the roof's edge, the rear window's, the deck's. */
const upperZ = curve([
  [-L2, 0.40], [-2.27, 0.40], [-2.20, 0.41], [-2.13, 0.42], [-1.97, 0.44], [-1.76, 0.46], [-1.55, 0.50],
  [-1.35, 0.54], [-1.08, 0.55], [-0.93, 0.535], [-0.75, 0.515], [-0.55, 0.51], [-0.30, 0.52], [0, 0.53],
  [0.20, 0.55], [0.45, 0.62], [0.60, 0.665], [0.78, 0.72], [0.85, 0.52], [1.0, 0.46], [AX, 0.44],
  [1.50, 0.43], [1.70, 0.42], [1.90, 0.42], [2.05, 0.41], [2.20, 0.40], [L2, 0.40],
]);
const upperY = curve([
  [-L2, 0.79], [-2.27, 0.828], [-2.20, 0.872], [-2.10, 0.898], [-2.04, 0.888], [-1.97, 0.888], [-1.76, 0.912], [-1.55, 0.967],
  [-1.35, 1.032], [-1.08, 1.127], [-0.93, 1.182], [-0.75, 1.232], [-0.55, 1.257], [-0.30, 1.267], [0, 1.262],
  [0.20, 1.232], [0.45, 1.06], [0.60, 0.96], [0.78, 0.897], [0.85, 0.840], [1.0, 0.815], [AX, 0.786],
  [1.50, 0.746], [1.70, 0.694], [1.85, 0.634], [1.95, 0.584], [2.0, 0.556], [2.10, 0.50], [L2, 0.45],
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
const PILLAR = 0.012;                                       // ≈ the painted C-pillars' width, in t
/**
 * The windscreen, between the A-pillars from the cowl to the header. Past the roof's edge it wraps
 * round the corner a little way down the side, as the 992's does (a band of the section's
 * parameter, so its edge runs with the surface's grid): the painted A-pillar left between it and
 * the side window is ≈7–12 cm along the car up its upper half (the side photograph's ≈6.5 cm across
 * it), broadening to the mirror at its foot.
 */
const WRAP = 0.02;
export const inWindscreen = (x, t) => x < 0.765 && x > 0.22 && side(t) > T.upperL - WRAP;
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
  // The whole opening is glass; its black frame and the B-pillar's cover are laid over it along
  // their exact outline (buildGlassSeals), where the grid would draw the slanted edges as steps.
  if (inSideBand(t) && inDLO(x, p.y)) return 'glass';
  if (x > LAMP.x0 && lampD(p) < LAMP.r) return 'lamp';
  // The side skirts between the wheels.
  if (x > -0.86 && x < 0.84 && az > 0.80 && p.y < sill + 0.055) return 'plastic';
  return 'paint';
}

// ---- Materials -------------------------------------------------------------------------------
function gt3Materials(M) {
  if (M.gt3Paint) return M;
  // The photographs' near-white grey: a solid (non-metallic) paint under a deep clearcoat.
  M.gt3Paint = new THREE.MeshPhysicalMaterial({
    name: 'gt3-paint', color: PAINT.srgb, metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.0,
  });
  M.gt3Glass = new THREE.MeshPhysicalMaterial({
    name: 'gt3-glass', color: 0x1b2024, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.42,
    envMapIntensity: 1.3, depthWrite: false, side: THREE.DoubleSide,
  });
  M.gt3Black = new THREE.MeshStandardMaterial({ name: 'gt3-black-gloss', color: 0x0d0e10, metalness: 0.1, roughness: 0.22 });
  // Satin, not dead matt: in the studio photographs the black bumpers and skirts show their form in soft highlights.
  M.gt3Plastic = new THREE.MeshStandardMaterial({ name: 'gt3-black-plastic', color: 0x222326, metalness: 0, roughness: 0.6 });
  M.gt3Interior = new THREE.MeshStandardMaterial({ name: 'gt3-interior', color: 0x161718, metalness: 0, roughness: 0.9, side: THREE.DoubleSide });
  M.gt3Tyre = new THREE.MeshStandardMaterial({ name: 'gt3-tyre', color: 0x18191a, metalness: 0, roughness: 0.86 });
  // The wheels: forged, in a satin dark finish (≈: the colour is a choice for this car).
  // The wheels painted red and the callipers black, as on the car in Porsche's studio photographs (≈ the colours).
  M.gt3Wheel = new THREE.MeshPhysicalMaterial({ name: 'gt3-wheel', color: 0xb8211f, metalness: 0.35, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  M.gt3WheelDS = M.gt3Wheel.clone(); M.gt3WheelDS.name = 'gt3-wheel-rim'; M.gt3WheelDS.side = THREE.DoubleSide;
  M.gt3WheelBarrel = new THREE.MeshStandardMaterial({ name: 'gt3-wheel-barrel', color: 0x3a0d0c, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });
  // Cast iron, dark and dull behind the spokes as in the photographs.
  M.gt3Disc = new THREE.MeshStandardMaterial({ name: 'gt3-disc', color: 0x45423f, metalness: 0.7, roughness: 0.58 });
  // Cast-iron brakes carry red callipers (ceramic ones are yellow).
  M.gt3Calliper = new THREE.MeshStandardMaterial({ name: 'gt3-calliper', color: 0xb3141a, metalness: 0.15, roughness: 0.36 });
  M.gt3CalliperBlack = new THREE.MeshStandardMaterial({ name: 'gt3-calliper-black', color: 0x121314, metalness: 0.2, roughness: 0.4 });
  M.gt3Carbon = new THREE.MeshStandardMaterial({ name: 'gt3-carbon', color: 0x17181a, metalness: 0.3, roughness: 0.3 });
  // Lamps: a clear lens over a dark chrome bowl, the four-point daytime lights lit.
  M.gt3Lens = new THREE.MeshPhysicalMaterial({ name: 'gt3-lens', color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.1, envMapIntensity: 0.5, depthWrite: false });
  // The lamp's bowl: bright chrome behind the clear lens, as in the front close-up (≈ its finish).
  M.gt3Bowl = new THREE.MeshStandardMaterial({ name: 'gt3-lamp-bowl', color: 0x8d939a, metalness: 1, roughness: 0.26 });
  M.gt3Drl = new THREE.MeshStandardMaterial({ name: 'gt3-drl', color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.4, roughness: 0.4 });
  M.gt3Tail = new THREE.MeshStandardMaterial({ name: 'gt3-tail', color: 0x7a0a0c, emissive: 0xd0161a, emissiveIntensity: 0.9, roughness: 0.35 });
  // The brake lights (the lamp units' blades and the high-level light): lit only on the brakes,
  // which the drive does (userData.brakeLights). Unlit, a smoked red.
  M.gt3Brake = new THREE.MeshStandardMaterial({ name: 'gt3-brake-lights', color: 0x5a0a0c, emissive: 0xff2020, emissiveIntensity: 0.25, roughness: 0.3 });
  M.gt3Reflector = new THREE.MeshStandardMaterial({ name: 'gt3-reflector', color: 0x9a1014, emissive: 0x400406, roughness: 0.4 });
  M.gt3Smoke = new THREE.MeshStandardMaterial({ name: 'gt3-tail-smoke', color: 0x1a0d0e, metalness: 0.2, roughness: 0.15 });
  // Openings into the body (intakes, outlets, wheel wells): near black, matt.
  M.gt3Void = new THREE.MeshStandardMaterial({ name: 'gt3-void', color: 0x060607, metalness: 0, roughness: 0.95 });
  M.gt3Liner = new THREE.MeshStandardMaterial({ name: 'gt3-arch-liner', color: 0x0c0c0d, metalness: 0, roughness: 0.92, side: THREE.DoubleSide });
  M.gt3Amber = new THREE.MeshStandardMaterial({ name: 'gt3-amber', color: 0x8a4a00, emissive: 0xff9a1a, emissiveIntensity: 0.6, roughness: 0.4 });
  M.gt3MirrorGlass = new THREE.MeshStandardMaterial({ name: 'gt3-mirror-glass', color: 0x9aa0a6, metalness: 1, roughness: 0.04 });
  // The bonnet outlets' and the intakes' grille: the centre's honeycomb texture where it is loaded.
  M.gt3Mesh = M.honeycomb ?? new THREE.MeshStandardMaterial({ name: 'gt3-mesh', color: 0x141516, metalness: 0.15, roughness: 0.62 });
  return M;
}

// ---- The ends: reliefs over the front and rear elevations ------------------------------------------
/** Signed distance from (z, y) to a closed polygon [[z, y], …] of an elevation: negative inside. */
function polySD(z, y, poly) {
  let d = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [zi, yi] = poly[i], [zj, yj] = poly[j];
    const ez = zi - zj, ey = yi - yj, wz = z - zj, wy = y - yj;
    const t = Math.max(0, Math.min(1, (wz * ez + wy * ey) / (ez * ez + ey * ey || 1e-12)));
    d = Math.min(d, Math.hypot(wz - ez * t, wy - ey * t));
    if ((yi > y) !== (yj > y) && z < (zj - zi) * (y - yi) / (yj - yi) + zi) inside = !inside;
  }
  return inside ? -d : d;
}
/** A rounded polygon: each corner [z, y, r] cut by an arc of radius r (r 0: sharp). Outline for polySD and the regions. */
function roundPoly(corners, nArc = 6) {
  const out = [], n = corners.length;
  for (let i = 0; i < n; i++) {
    const [z, y, r = 0] = corners[i], [zp, yp] = corners[(i + n - 1) % n], [zn, yn] = corners[(i + 1) % n];
    if (!r) { out.push([z, y]); continue; }
    const a = Math.atan2(yp - y, zp - z), b = Math.atan2(yn - y, zn - z);
    const la = Math.hypot(zp - z, yp - y), lb = Math.hypot(zn - z, yn - y), rr = Math.min(r, la * 0.45, lb * 0.45);
    const pa = [z + Math.cos(a) * rr, y + Math.sin(a) * rr], pb = [z + Math.cos(b) * rr, y + Math.sin(b) * rr];
    // A quadratic Bézier through the corner stands in for the arc: tangent to both edges.
    for (let k = 0; k <= nArc; k++) {
      const t = k / nArc, u = 1 - t;
      out.push([u * u * pa[0] + 2 * u * t * z + t * t * pb[0], u * u * pa[1] + 2 * u * t * y + t * t * pb[1]]);
    }
  }
  return out;
}
/**
 * An end of the car as a relief over its elevation. The swept surface stops at x; its last section
 * is the end's outline, and inside it the end stands out along dir by
 *   depth(|z|, y) · (1 − u^p)^½ · (1 − f^24)^½,
 * u the fraction of the outline's half-width at that height and f of the way from the centroid to
 * the outline: the square roots turn the face tangentially into the sides and the top at the
 * outline, so the end and the swept body meet without a crease. Built on rings round the centroid.
 * The intakes are holes in it (every cell touching one is left out); intake() then builds each
 * one's lip, wall and floor along its exact outline, and endPatch() lays the black panels, lamps
 * and lights on the face along theirs, so no edge follows the grid's steps.
 */
const ENDS = {};
function relief(spec) {
  const { x, dir, holes = [] } = spec;
  const ts = paramsT(0, 1, spec.n ?? 320);
  const ring = ts.map(t => bodyPoint(x, t));
  const yb = Math.min(ring[0].y, ring[ring.length - 1].y);
  const floor = [];
  for (let k = 1; k < 40; k++) floor.push(new THREE.Vector3(x, yb, ring[ring.length - 1].z + (ring[0].z - ring[ring.length - 1].z) * k / 40));
  const loop = [...ring, ...floor];
  const ys = loop.map(p => p.y), y0 = Math.min(...ys), y1 = Math.max(...ys), cy = (y0 + y1) / 2;
  // The outline's half-width at each height, tabulated.
  const NY = 400, half = new Float64Array(NY + 1);
  for (let i = 0; i <= NY; i++) {
    const y = y0 + (y1 - y0) * i / NY;
    let w = 0;
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) w = Math.max(w, Math.abs(a.z + (b.z - a.z) * (y - a.y) / (b.y - a.y)));
    }
    half[i] = w;
  }
  const halfAt = (y) => { const u = Math.min(NY, Math.max(0, (y - y0) / (y1 - y0) * NY)), i = Math.min(NY - 1, Math.floor(u)); return half[i] + (half[i + 1] - half[i]) * (u - i); };
  const pOf = typeof spec.p === 'function' ? spec.p : () => spec.p ?? 6;
  const out = (z, y, f) => {
    const W = halfAt(y) || 1e-6, u = Math.min(1, Math.abs(z) / W);
    return spec.depth(Math.abs(z), y) * Math.sqrt(Math.max(0, 1 - u ** pOf(y))) * Math.sqrt(Math.max(0, 1 - f ** 24));
  };
  const n = loop.length;
  const fracAt = (z, y) => {
    const dz = z, dy = y - cy;
    if (Math.hypot(dz, dy) < 1e-9) return 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const a = loop[i], b = loop[(i + 1) % n];
      const ez = b.z - a.z, ey = b.y - a.y, den = dz * ey - dy * ez;
      if (Math.abs(den) < 1e-12) continue;
      const sr = (a.z * ey - (a.y - cy) * ez) / den, uu = (a.z * dy - (a.y - cy) * dz) / den;
      if (sr > 0 && uu >= 0 && uu <= 1 && sr < best) best = sr;
    }
    return Math.min(1, 1 / best);
  };
  const xAt = (z, y) => x + dir * out(z, y, fracAt(z, y));
  const K = spec.rings ?? 64;
  const pos = new Float32Array((K + 1) * n * 3), uvs = new Float32Array((K + 1) * n * 2), inHole = new Uint8Array((K + 1) * n);
  for (let k = 0; k <= K; k++) {
    // Rings closer towards the outline, where the face turns sharply into the sides.
    const f = 1 - (1 - k / K) ** 2;
    for (let i = 0; i < n; i++) {
      const q = loop[i], z = q.z * f, y = cy + (q.y - cy) * f, o = k * n + i;
      pos[o * 3] = x + dir * out(z, y, f); pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      uvs[o * 2] = z; uvs[o * 2 + 1] = y;
      for (const h of holes) if (polySD(Math.abs(z), y, h) < 0.0015) { inHole[o] = 1; break; }
    }
  }
  const idx = [];
  for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
    if (inHole[a] || inHole[b] || inHole[c] || inHole[d]) continue;
    idx.push(a, b, c, b, d, c);
  }
  // Wound to face out along dir (summed: the innermost ring sits at the centroid, degenerate).
  let sx = 0;
  for (let j = 0; j < idx.length; j += 3) {
    const a = idx[j] * 3, b = idx[j + 1] * 3, c = idx[j + 2] * 3;
    sx += (pos[b + 1] - pos[a + 1]) * (pos[c + 2] - pos[a + 2]) - (pos[b + 2] - pos[a + 2]) * (pos[c + 1] - pos[a + 1]);
  }
  if (sx * dir < 0) for (let j = 0; j < idx.length; j += 3) [idx[j + 1], idx[j + 2]] = [idx[j + 2], idx[j + 1]];
  const g = indexed(Array.from(pos), Array.from(uvs), idx);
  ENDS[dir] = { x, dir, xAt, halfAt, cy, y0, y1 };
  return g;
}
/** The face's outward normal at (z, y). */
function endNormal(dir, z, y, out = new THREE.Vector3()) {
  const E = ENDS[dir], e = 0.003;
  const dxz = (E.xAt(z + e, y) - E.xAt(z - e, y)) / (2 * e), dxy = (E.xAt(z, y + e) - E.xAt(z, y - e)) / (2 * e);
  // The face is x = X + dir·out(z, y): its outward normal is (dir, −out_y, −out_z), and xAt's slopes are dir·out_y, dir·out_z.
  return out.set(dir, -dxy * dir, -dxz * dir).normalize();
}
/**
 * A patch on an end over a closed outline [[z, y], …] (full width: z signed), `lift` out along its
 * normal, fanned from the centroid; open where `holes` are (the intakes it surrounds).
 */
function endPatch(dir, outline, lift = 0.0015, holes = [], ringPow = 1) {
  const loop = densify(outline, 0.008), n = loop.length;
  const cz = loop.reduce((s, q) => s + q[0], 0) / n, cy = loop.reduce((s, q) => s + q[1], 0) / n;
  const R = Math.max(...loop.map(([z, y]) => Math.hypot(z - cz, y - cy)));
  const rings = Math.max(3, Math.min(30, Math.ceil(R / 0.012)));
  const pos = [], uv = [], idx = [], nn = new THREE.Vector3();
  // Out along the normal, and as far again along dir: where the face rolls under, its normal turns
  // downwards and a patch lifted along it alone would sink into the face.
  const put = (z, y) => { endNormal(dir, z, y, nn); const xx = ENDS[dir].xAt(z, y); pos.push(xx + (nn.x + 0.6 * dir) * lift, y + nn.y * lift, z + nn.z * lift); uv.push(z, y); };
  put(cz, cy);
  for (let k = 1; k <= rings; k++) { const f = 1 - (1 - k / rings) ** ringPow; for (const [z, y] of loop) put(cz + (z - cz) * f, cy + (y - cy) * f); }
  for (let j = 0; j < n; j++) idx.push(0, 1 + j, 1 + (j + 1) % n);
  for (let k = 1; k < rings; k++) for (let j = 0; j < n; j++) {
    const a = 1 + (k - 1) * n + j, b = 1 + (k - 1) * n + (j + 1) % n;
    idx.push(a, a + n, b, b, a + n, b + n);
  }
  if (holes.length) {
    const keep = [];
    for (let j = 0; j < idx.length; j += 3) {
      const zc = (uv[idx[j] * 2] + uv[idx[j + 1] * 2] + uv[idx[j + 2] * 2]) / 3, yc = (uv[idx[j] * 2 + 1] + uv[idx[j + 1] * 2 + 1] + uv[idx[j + 2] * 2 + 1]) / 3;
      if (!holes.some(h => polySD(zc, yc, h) < 0.002)) keep.push(idx[j], idx[j + 1], idx[j + 2]);
    }
    idx.length = 0; idx.push(...keep);
  }
  const g = indexed(pos, uv, idx);
  const nrm = g.attributes.normal;
  let sxx = 0;
  for (let i = 0; i < nrm.count; i++) sxx += nrm.getX(i);
  if (sxx * dir < 0) { const ix = g.index.array; g.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  return g;
}
/**
 * A rounded rectangle on an end as a grid (rows up it, columns across): long thin panels and
 * strips, which a fan from the centroid would fill with slivers. Its half-width runs from `hb`
 * at the foot y0 to `ht` at the head y1; corners of radius r.
 */
function endRect(dir, { y0, y1, hb, ht = hb, r = 0, lift = 0.0015, step = 0.01 }) {
  const ny = Math.max(2, Math.ceil((y1 - y0) / step)), nz = Math.max(2, Math.ceil(2 * Math.max(hb, ht) / step));
  const pos = [], uv = [], idx = [], nn = new THREE.Vector3();
  for (let i = 0; i <= ny; i++) {
    const y = y0 + (y1 - y0) * i / ny, f = i / ny;
    const d = Math.max(0, r - Math.min(y - y0, y1 - y));
    const H = hb + (ht - hb) * f - r + Math.sqrt(Math.max(0, r * r - d * d));
    for (let j = 0; j <= nz; j++) {
      const z = H * (-1 + 2 * j / nz);
      endNormal(dir, z, y, nn);
      const xx = ENDS[dir].xAt(z, y);
      pos.push(xx + (nn.x + 0.6 * dir) * lift, y + nn.y * lift, z + nn.z * lift); uv.push(z, y);
    }
  }
  for (let i = 0; i < ny; i++) for (let j = 0; j < nz; j++) {
    const a = i * (nz + 1) + j, b = a + nz + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = indexed(pos, uv, idx);
  const nrm = g.attributes.normal;
  let sx = 0;
  for (let i = 0; i < nrm.count; i++) sx += nrm.getX(i);
  if (sx * dir < 0) { const ix = g.index.array; g.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  return g;
}
/** A band on an end along a closed outline, from `inner` inside it to `outer` outside (signed metres), `lift` proud: an opening's lip. */
function endBand(dir, outline, inner, outer, lift = 0.0015) {
  const loop = densify(outline, 0.006), n = loop.length;
  // Offset each vertex along its 2-D normal (outward of the outline, which polySD decides).
  const off = loop.map(([z, y], i) => {
    const [z0, y0] = loop[(i + n - 1) % n], [z1, y1] = loop[(i + 1) % n];
    let tz = z1 - z0, ty = y1 - y0; const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
    let nz = ty, ny = -tz;
    if (polySD(z + nz * 0.002, y + ny * 0.002, loop) < 0) { nz = -nz; ny = -ny; }
    return [nz, ny];
  });
  const pos = [], uv = [], idx = [], nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) for (const d of [-inner, outer]) {
    const z = loop[i][0] + off[i][0] * d, y = loop[i][1] + off[i][1] * d;
    endNormal(dir, z, y, nn);
    const xx = ENDS[dir].xAt(z, y);
    pos.push(xx + nn.x * lift, y + nn.y * lift, z + nn.z * lift); uv.push(z, y);
  }
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = indexed(pos, uv, idx);
  const nrm = g.attributes.normal;
  let sxx = 0;
  for (let i = 0; i < nrm.count; i++) sxx += nrm.getX(i);
  if (sxx * dir < 0) { const ix = g.index.array; g.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]])); g.computeVertexNormals(); }
  return g;
}
/**
 * An opening in an end along its exact outline: the wall from the face (or `start` behind it)
 * straight back `depth` along −dir (narrowing by `taper`), and the floor at its foot. Returns { wall, floor }.
 */
function intake(dir, outline, depth, taper = 0.01, start = 0) {
  const loop = densify(outline, 0.006), n = loop.length;
  const cz = loop.reduce((s, q) => s + q[0], 0) / n, cy = loop.reduce((s, q) => s + q[1], 0) / n;
  const pos = [], uvw = [], idx = [];
  const back = [];
  for (let i = 0; i < n; i++) {
    const [z, y] = loop[i], xx = ENDS[dir].xAt(z, y);
    const L = Math.hypot(z - cz, y - cy) || 1, k = Math.max(0, 1 - taper / L);
    const zb = cz + (z - cz) * k, yb = cy + (y - cy) * k, xb = xx - dir * (start + depth);
    pos.push(xx + dir * (0.002 - start), y, z, xb, yb, zb); uvw.push(i * 0.006, 0, i * 0.006, depth);
    back.push([zb, yb, xb]);
  }
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const wall = indexed(pos, uvw, idx);
  // Facing into the opening (towards its centre line).
  {
    const nrm = wall.attributes.normal, P = wall.attributes.position;
    let s = 0;
    for (let i = 0; i < nrm.count; i++) s += nrm.getY(i) * (cy - P.getY(i)) + nrm.getZ(i) * (cz - P.getZ(i));
    if (s < 0) { const ix = wall.index.array; wall.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]])); wall.computeVertexNormals(); }
  }
  // Floor: the foot of the wall, fanned from its centre.
  const fpos = [], fuv = [], fidx = [];
  const fx = back.reduce((s, q) => s + q[2], 0) / n;
  fpos.push(fx, cy, cz); fuv.push(cz, cy);
  for (const [zb, yb, xb] of back) { fpos.push(xb, yb, zb); fuv.push(zb, yb); }
  for (let i = 0; i < n; i++) fidx.push(0, 1 + i, 1 + (i + 1) % n);
  const fl = indexed(fpos, fuv, fidx);
  if (fl.attributes.normal.getX(0) * dir < 0) { const ix = fl.index.array; fl.setIndex(Array.from(ix, (_, k) => ix[k - (k % 3) + [0, 2, 1][k % 3]])); fl.computeVertexNormals(); }
  return { wall, floor: fl };
}
/** Mirrors a half outline (z ≥ 0) to the other side, reversed so it stays one way round. */
const mirrorZ = (poly) => poly.map(([z, y]) => [-z, y]).reverse();

/**
 * The nose and the tail as reliefs (relief above), TRACED on the front and rear studio photographs
 * with their solved cameras and on the side one (positions ≈ ±1.5 cm, depths ≈ ±2 cm). Outlines
 * for one side (z ≥ 0), mirrored; a centred one runs across.
 *  - Nose: the bumper's face stands at the published 2.286 m between 0.15 and 0.44 m and rolls back
 *    over its top to the front lid. In it: the central intake with its mesh, the two side intakes
 *    under their brows, the slots at the corners, the black lip below.
 *  - Tail: the ducktail's lip at 0.86 m, the face falling back to the light bar and the lamps at
 *    the corners, the bumper's widest at 2.286 m, the black lower panel and the black
 *    lower bumper wrapping round its corners, the reflectors.
 */
const NOSE = {
  // Rounder in plan low down, where the bumper's corners sweep back to the wheels (the
  // three-quarter photograph), squarer at the lamps' height.
  x: 2.00, dir: 1, p: (y) => 3.2 + 3.4 * Math.min(1, Math.max(0, (y - 0.12) / 0.25)),
  depth: (() => { const c = curve([[0.04, 0.10], [0.10, 0.205], [0.14, 0.262], [0.18, 0.275], [0.30, 0.2775], [0.42, 0.273], [0.46, 0.243], [0.50, 0.178], [0.53, 0.108], [0.56, 0.035], [0.64, 0]]); return (az, y) => Math.max(0, c(y)); })(),
  // Traced on the front photograph with its fitted camera (each at the face's depth, ≈ ±1 cm): the
  // honeycomb intake across the middle with its two thin dividers, z ±0.46 m, 0.21 to 0.34 m up.
  central: roundPoly([[-0.452, 0.207, 0.05], [0.452, 0.207, 0.05], [0.468, 0.343, 0.03], [0, 0.346], [-0.468, 0.343, 0.03]]),
  // The air-curtain inlets at the corners, upright, 0.21 to 0.58 m up.
  corner: roundPoly([[0.800, 0.21, 0.01], [0.848, 0.21, 0.012], [0.858, 0.58, 0.02], [0.812, 0.58, 0.02]]),
  lip: roundPoly([[-0.80, 0.02], [0.80, 0.02], [0.80, 0.172, 0.01], [-0.80, 0.172, 0.01]]),
  // The black lower bumper: one surface in a broad U, up to the indicators at the sides (0.47 m)
  // and to just under the plate in the middle (0.355 m), down to the splitter under the white
  // cheeks at the corners (front and three-quarter photographs).
  lower: (() => {
    const half = [[0.36, 0.358, 0.03], [0.43, 0.424, 0.02], [0.47, 0.442, 0.01], [0.645, 0.470, 0.015], [0.672, 0.26, 0.05], [0.70, 0.205, 0.02], [0.80, 0.205], [0.80, 0.152]];
    return roundPoly([[0, 0.355], ...half, ...half.map(([z, y, r]) => [-z, y, r]).reverse()], 6);
  })(),
  // The indicators under the brows, smoked strips leaning up to the corners.
  indicator: roundPoly([[0.425, 0.418, 0.008], [0.620, 0.448, 0.01], [0.632, 0.468, 0.008], [0.430, 0.438, 0.008]]),
};
NOSE.holes = [NOSE.central, NOSE.corner];
/** How far the black lower bumper sits behind the white face round it (the photographs' step and shadow, ≈). */
const NOSE_RECESS = 0.028;
const TAIL = {
  x: -2.10, dir: -1, p: 8,
  // From the top: the ducktail's lip (its trailing edge 0.88 m up, 6 cm out), the recess under it
  // with the light band, the bumper bulging out below the band to its widest, and in to the floor.
  depth: (() => { const c = curve([[0.12, 0.0], [0.17, 0.065], [0.20, 0.105], [0.26, 0.152], [0.36, 0.186], [0.55, 0.19], [0.63, 0.172], [0.70, 0.142], [0.76, 0.104],
    [0.785, 0.066], [0.812, 0.048], [0.835, 0.036], [0.855, 0.032], [0.872, 0.052], [0.882, 0.060], [0.893, 0.040], [0.906, 0.0]]); return (az, y) => Math.max(0, c(y)); })(),
  // Traced on the rear photograph with its fitted camera (≈ ±1 cm): the black band 0.77 to 0.84 m
  // up across the tail, the red light bar in it at 0.81 to 0.823 m, the lamp units at its ends.
  band: { y0: 0.772, y1: 0.842, hb: 0.60, r: 0.012, lift: 0.002, step: 0.008 },
  bar: { y0: 0.810, y1: 0.823, hb: 0.70, r: 0.005, lift: 0.0035, step: 0.008 },
  lamp: roundPoly([[0.462, 0.742, 0.02], [0.700, 0.736, 0.04], [0.792, 0.778, 0.03], [0.800, 0.852, 0.02], [0.480, 0.856, 0.02]]),
  blades: [roundPoly([[0.47, 0.810, 0.004], [0.785, 0.812, 0.004], [0.785, 0.822, 0.004], [0.47, 0.823, 0.004]]), roundPoly([[0.52, 0.778, 0.004], [0.76, 0.776, 0.004], [0.765, 0.785, 0.004], [0.52, 0.787, 0.004]])],
  // Between the white corners that come down beside it to the floor (rear photograph).
  panel: { y0: 0.168, y1: 0.575, hb: 0.74, ht: 0.765, r: 0.05, step: 0.014 },
  plate: { y0: 0.432, y1: 0.556, hb: 0.30, r: 0.02, lift: 0.004 },
  reflector: roundPoly([[0.590, 0.470, 0.01], [0.770, 0.470, 0.01], [0.765, 0.505, 0.01], [0.595, 0.505, 0.01]]),
};
function buildEnds(M) {
  const g = new THREE.Group();
  g.name = 'gt3-ends';
  const add = (list, mat, name, castShadow = false) => g.add(mesh(mergeAll(list.map(geometry => ({ geometry }))), mat, { name, castShadow }));
  const both = (poly) => [poly, mirrorZ(poly)];
  // Nose.
  // The black lower bumper is not painted on the face: it is set back into it, the white face
  // stepping down to it along its outline, so its edge catches the light and throws a shadow.
  add([relief({ ...NOSE, holes: [...NOSE.holes, NOSE.lower] })], M.gt3Paint, 'gt3-nose-face', true);
  {
    const walls = [], floors = [], mesh_ = [], lips = [], step = [], cover = [];
    // The honeycomb sits only a few centimetres in, where the light reaches it (front photograph).
    const c = intake(1, NOSE.central, 0.035, 0.006, NOSE_RECESS);
    walls.push(c.wall); mesh_.push(c.floor);
    lips.push(endBand(1, NOSE.central, 0.0, 0.016, 0.0015 - NOSE_RECESS));
    for (const poly of both(NOSE.corner)) {
      const o = intake(1, poly, 0.07, 0.01);
      walls.push(o.wall); floors.push(o.floor);
      lips.push(endBand(1, poly, 0.0, 0.012));
    }
    // The step from the white face down to the black panel, and a band of the face's own paint
    // over the face's cut edge (its cells step along the outline).
    step.push(intake(1, NOSE.lower, NOSE_RECESS + 0.004, 0).wall);
    cover.push(endBand(1, NOSE.lower, 0, 0.03, 0.0012));
    add(walls, M.gt3Plastic, 'gt3-nose-intake-walls');
    add(floors, M.gt3Void, 'gt3-nose-intake-floors');
    add(mesh_, M.gt3Mesh, 'gt3-nose-mesh');
    add(lips, M.gt3Plastic, 'gt3-nose-intake-lips');
    add(step, M.gt3Plastic, 'gt3-nose-lower-step');
    add(cover, M.gt3Paint, 'gt3-nose-lower-edge');
    add([endPatch(1, NOSE.lower, -NOSE_RECESS, NOSE.holes.flatMap(h => [h, mirrorZ(h)]))], M.gt3Plastic, 'gt3-nose-lower', true);
    add(both(NOSE.indicator).map(pl => endPatch(1, pl, 0.004)), M.gt3Smoke, 'gt3-nose-indicators');
  }
  // Tail.
  add([relief(TAIL)], M.gt3Paint, 'gt3-tail-face', true);
  {
    add([endRect(-1, TAIL.panel)], M.gt3Plastic, 'gt3-tail-panel', true);
    // The black lower bumper wrapping round each corner from the side (buildBodyDetails), up to
    // 0.39 m at the outline, falling to the panel's foot: its outer edge just inside the outline.
    {
      const E = ENDS[-1], yb = E.y0 + 0.003, edge = range(yb, 0.39, 16).map(y => [E.halfAt(y) - 0.0015, y]);
      const corner = [[0.70, yb], ...edge, [0.84, 0.36], [0.78, 0.29], [0.72, 0.24], [0.70, 0.22]];
      add(both(corner).map(pl => endPatch(-1, pl, 0.003, [], 2)), M.gt3Plastic, 'gt3-tail-corners', true);
    }
    add([endRect(-1, TAIL.plate)], M.gt3Plastic, 'gt3-tail-plate-recess');
    add([endRect(-1, TAIL.band)], M.gt3Black, 'gt3-tail-band');
    add([endRect(-1, TAIL.bar)], M.gt3Tail, 'gt3-tail-bar');
    // The lamp units stand out of the face ≈2 cm, a smoked lens over each with its wall round it.
    add(both(TAIL.lamp).map(pl => endPatch(-1, pl, 0.01)), M.gt3Smoke, 'gt3-tail-lamps');
    add(both(TAIL.lamp).map(pl => { const o = intake(-1, pl, -0.01, -0.003); return o.wall; }), M.gt3Black, 'gt3-tail-lamp-walls');
    // Inside each lamp, the light bar carries on as two red blades (rear photograph).
    add(TAIL.blades.flatMap(both).map(pl => endPatch(-1, pl, 0.0115)), M.gt3Brake, 'gt3-tail-lamp-blades');
    add(both(TAIL.reflector).map(pl => endPatch(-1, pl, 0.003)), M.gt3Reflector, 'gt3-tail-reflectors');
  }
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
/**
 * A patch of the body over a ring of the front elevation, ρ from r0 to r1 of the lamp's radius,
 * `lift` out along the body's normal plus `dome(ρ)` (the lens bulging), or sunk `sink(ρ)` back
 * along the lamp's axis (−x: the bowl inside the opening).
 */
function lampPatch(sd, r0, r1, lift, nr = 6, na = 48, { dome = null, sink = null } = {}) {
  const centre = { x: 1.80, t: sd < 0 ? T.hipL - 0.01 : 1 - T.hipL + 0.01 };
  const c0 = onFront(sd * LAMP.z, LAMP.y, centre);
  const rows = [];
  for (let i = 0; i <= nr; i++) {
    const f = r0 + (r1 - r0) * i / nr, rho = f * LAMP.r, row = [];
    let guess = c0;
    for (let j = 0; j <= na; j++) {
      const a = TAU * j / na;
      const q = onFront(sd * (LAMP.z + rho * Math.cos(a)), LAMP.y + rho * Math.sin(a), guess);
      guess = q;
      const n = bodyNormal(q.x, q.t);
      const p = q.p.clone().addScaledVector(n, lift + (dome ? dome(f) : 0));
      if (sink) p.x -= sink(f);
      row.push(p);
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
/**
 * The headlamps, as in the front and three-quarter photographs (≈ the parts' sizes): the opening in
 * the fender round in front elevation; inside it a dark chrome bowl sunk 7 cm along the lamp's axis,
 * with a chrome ring, the broad central projector in its black housing, the four-point daytime light
 * (four flat blades at 45° round it) and the matrix's band of small lights low down; over it all a
 * clear lens bulging out of the fender; a gloss
 * black bezel over the opening's edge.
 */
function buildLamps(M) {
  const g = new THREE.Group();
  g.name = 'gt3-lamps';
  const bowls = [], lenses = [], bezels = [], rings = [], drl = [], housings = [], glass = [], dark = [], cups = [];
  for (const sd of [-1, 1]) {
    bowls.push(lampPatch(sd, 0, 1.0, 0, 10, 64, { sink: (f) => 0.07 * (1 - f * f) ** 0.7 }));
    lenses.push(lampPatch(sd, 0, 1.0, 0.004, 10, 64, { dome: (f) => 0.022 * (1 - f * f) }));
    bezels.push(lampPatch(sd, 0.94, 1.12, 0.003, 2, 64));
    // The module's frame: on the plane of the opening's rim (raked back with the fender), 4 cm
    // in from it, so all of the module sits inside the bowl.
    const guess = { x: 1.80, t: sd < 0 ? T.hipL - 0.01 : 1 - T.hipL + 0.01 };
    const rim = (a) => onFront(sd * (LAMP.z + LAMP.r * Math.cos(a)), LAMP.y + LAMP.r * Math.sin(a), guess).p;
    const top = rim(Math.PI / 2), bot = rim(-Math.PI / 2), c = top.clone().add(bot).multiplyScalar(0.5);
    const up = top.clone().sub(bot).normalize(), across = new THREE.Vector3(0, 0, 1), fwd = across.clone().cross(up).normalize();
    if (fwd.x < 0) fwd.negate();
    const basis = new THREE.Matrix4().makeBasis(fwd, up, across);
    const o = c.clone().addScaledVector(fwd, -0.012);
    const place = (geo, dx = 0, dy = 0, dz = 0) => {
      geo.applyMatrix4(new THREE.Matrix4().makeTranslation(dx, dy, dz)).applyMatrix4(basis).translate(o.x, o.y, o.z);
      return geo;
    };
    // Chrome ring just inside the opening's rim, facing forward.
    // Round in front elevation like the opening: drawn out along the raked frame's up axis.
    const k = 1 / Math.max(0.5, up.y);
    const ring = new THREE.TorusGeometry(LAMP.r * 0.93, 0.003, 8, 64); ring.rotateY(Math.PI / 2); ring.scale(1, k, 1);
    rings.push(place(ring, -0.004));
    // The projector in the middle (the close-up of the front photograph): a broad black housing, its
    // lens nearly flat behind the outer glass, ≈0.45 of the lamp's radius.
    const hs = new THREE.CylinderGeometry(0.050, 0.054, 0.03, 40); hs.rotateZ(Math.PI / 2); hs.scale(1, k, 1);
    housings.push(place(hs, -0.024));
    const lensG = new THREE.SphereGeometry(0.044, 32, 12, 0, TAU, 0, Math.PI / 2); lensG.rotateZ(-Math.PI / 2); lensG.scale(0.35, k, 1);
    glass.push(place(lensG, -0.009));
    // Its chrome surround, and the dark glass of the projector's own lens inside it.
    const pr = new THREE.TorusGeometry(0.047, 0.0045, 8, 48); pr.rotateY(Math.PI / 2); pr.scale(1, k, 1);
    rings.push(place(pr, -0.008));
    const pl = new THREE.SphereGeometry(0.036, 32, 10, 0, TAU, 0, Math.PI / 2); pl.rotateZ(-Math.PI / 2); pl.scale(0.28, k, 1);
    dark.push(place(pl, -0.012));
    // The four-point daytime light: broad flat blades at 45°, from ≈0.45 to ≈0.85 of the radius,
    // widening outwards.
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const blade = new THREE.BoxGeometry(0.006, 0.052, 0.03);
      blade.rotateX(-(a - Math.PI / 2));            // its length along the radius in the (y, z) plane
      const dy = Math.sin(a) * LAMP.r * 0.64 / Math.max(0.5, up.y), dz = sd * Math.cos(a) * LAMP.r * 0.64;
      drl.push(place(blade, -0.006, dy, dz));
      // Each light in its own chrome cup, a little larger than it.
      const cup = new THREE.BoxGeometry(0.004, 0.066, 0.044);
      cup.rotateX(-(a - Math.PI / 2));
      cups.push(place(cup, -0.011, dy, dz));
    }
    // The matrix's row of small lights low in the bowl: two rows of fine lights under the projector.
    for (let row = 0; row < 2; row++) for (let i = 0; i < 13; i++) {
      const dot = new THREE.BoxGeometry(0.004, 0.006, 0.0055);
      drl.push(place(dot, -0.012, (-LAMP.r * 0.70 - row * 0.011) / Math.max(0.5, up.y), (i - 6) * 0.0085));
    }
  }
  const add = (list, mat, name) => g.add(mesh(mergeAll(list.map(geometry => ({ geometry }))), mat, { name, castShadow: false }));
  add(bowls, M.gt3Bowl, 'gt3-lamp-bowls');
  add(rings, M.chrome ?? M.gt3MirrorGlass, 'gt3-lamp-rings');
  add(housings, M.gt3Black, 'gt3-lamp-projectors');
  add(glass, M.gt3Lens, 'gt3-lamp-projector-lenses');
  add(drl, M.gt3Drl, 'gt3-drl');
  add(dark, M.gt3Black, 'gt3-lamp-projector-glass');
  add(cups, M.chrome ?? M.gt3MirrorGlass, 'gt3-drl-cups');
  add(bezels, M.gt3Black, 'gt3-lamp-bezels');
  const lens = mesh(mergeAll(lenses.map(geometry => ({ geometry }))), M.gt3Lens, { name: 'gt3-lamp-lenses', castShadow: false });
  lens.renderOrder = 2;
  g.add(lens);
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
    // Rear fender intake: from (−0.735, 0.575) up and back to (−0.925, 0.775), ≈7 cm wide at its
    // foot and ≈11 cm at its head (side photograph and its close-up of the rear wheel), with a
    // raised lip of the body's paint round it.
    {
      const slot = slotLoop([-0.735, 0.575], [-0.925, 0.775], 0.035, 0.055);
      voids.push(loopPatch('side', sd, slot, { lift: 0.0015 }));
      paint.push(loopWall('side', sd, slotLoop([-0.735, 0.575], [-0.925, 0.775], 0.041, 0.062), 0.006));
    }
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
    // Behind the rear wheel (side and rear three-quarter photographs, ≈ ±1.5 cm): the wheel house's
    // dark outlet, and the tall black blade standing off the body round the arch's rear edge, down
    // into the black lower bumper, which rises towards the tail and wraps round its corner (buildEnds).
    {
      voids.push(loopPatch('side', sd, [[-1.62, 0.19], [-1.84, 0.19], [-1.862, 0.30], [-1.80, 0.585], [-1.64, 0.59], [-1.648, 0.40]], { lift: 0.0015 }));
      // The blade: a shell following the body ≈2 cm proud of it, its rim closed (≈).
      const blade = [[-1.596, 0.16], [-1.630, 0.26], [-1.641, 0.36], [-1.632, 0.46], [-1.602, 0.552], [-1.62, 0.584], [-1.76, 0.570], [-1.79, 0.45], [-1.812, 0.30], [-1.822, 0.20], [-1.80, 0.16]];
      plastic.push(loopPatch('side', sd, blade, { lift: 0.02 }), loopWall('side', sd, blade, 0.02));
      const top = curve([[X_TAIL, 0.39], [-2.00, 0.33], [-1.90, 0.285], [-1.78, 0.25], [-1.62, 0.21]]);
      plastic.push(bandPatch('side', sd, -1.62, X_TAIL, (x) => sillEdge(x), top, { lift: 0.0015, nu: 20, nv: 6 }));
    }
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
      // The slats run along the car, stacked up the slope like shingles (the side photograph's
      // stripes over the wheel, the close-up of the fender): each from end to end of the opening at its height.
      for (const k of [1, 2, 3, 4]) {
        const y = 0.775 + (0.846 - 0.775) * k / 5;
        const xs = range(0.93, 1.36, 60).filter(x => lo(x) + 0.006 < y && y < hi(x) - 0.004);
        if (xs.length < 4) continue;
        plastic.push(bodyFin(along('side', sd, xs.map(x => [x, y])), (f) => 0.011 * Math.min(1, 6 * f, 6 * (1 - f)) ** 0.5, 0.005));
      }
      plastic.push(bodyFin(along('side', sd, range(0.93, 1.35, 24).map(x => [x, hi(x)])), (f) => 0.005 + 0.008 * Math.sin(Math.PI * Math.min(1, f * 1.15)), 0.008));
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
    // The engine lid's grille under the rear window (rear photograph): a black field across the
    // deck between the window and the ducktail, eight upright slats each side running along the
    // car (≈ their pitch and height).
    {
      const x0 = -1.945, x1 = -1.635, hiZ = () => 0.405;
      plastic.push(bandPatch('plan', sd, x0, x1, () => 0.003, hiZ, { lift: 0.0015, nu: 12, nv: 10 }));
      for (let k = 0; k < 8; k++) {
        const z = 0.045 + k * 0.047;
        plastic.push(bodyFin(along('plan', sd, range(x0 + 0.01, x1 - 0.01, 10).map(x => [x, z])), () => 0.014, 0.008));
      }
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
  // The high-level brake light in the middle of the grille: a black pod, its lamp along the top.
  {
    const pts = along('plan', 1, range(-1.83, -1.645, 8).map(x => [x, 0.0005]));
    plastic.push(bodyFin(pts, () => 0.052, 0.088));
    g.add(mesh(bodyFin(pts, () => 0.056, 0.05, { base: 0.051 }), M.gt3Brake, { name: 'gt3-brake-light', castShadow: false }));
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
  // The ends: reliefs over the front and rear elevations, with their intakes, lamps and panels.
  g.add(buildEnds(M));
  g.add(buildLamps(M));
  g.add(buildGlassSeals(M));
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
  // The face's lip in the wheel's paint; the barrel and the inner flange, in the shade of the
  // wheel house in every photograph, a darker satin (≈).
  const lathe = (pts, mat, nm) => { const geo = new THREE.LatheGeometry(pts, 96); geo.rotateX(Math.PI / 2); spin.add(mesh(geo, mat, { name: nm })); };
  lathe(rim.slice(5), M.gt3WheelDS, `${name}-rim`);
  lathe(rim.slice(0, 6), M.gt3WheelBarrel, `${name}-barrel`);
  // Spokes: ten stems from the hub, each forking into two arms that meet the rim's lip.
  const faces = [];
  const zFace = rw / 2 - 0.006, dish = front ? 0.040 : 0.065;
  const r0 = 0.052, rs = rr * 0.40, r1 = rr - 0.010;
  // Concave, as photographed: the spokes rise from the hub, sunk `dish` deep, to the rim's face.
  const zAt = (r) => zFace - dish * Math.pow(Math.max(0, 1 - (r - r0) / (r1 - r0)), 1.4);
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
  // As photographed (side close-up of the rear wheel, the rim ≈190 px in radius): ten short stems
  // ≈30 mm wide out of the hub, each forking at ≈0.4 of the radius into two thin straight arms
  // (≈14 mm) that splay out to meet the next stem's arm at the rim, ten narrow V's round it (≈).
  const spread = Math.PI / 10 * 0.965;
  for (let k = 0; k < 10; k++) {
    const a = k * TAU / 10;
    bar(a, a, r0 - 0.004, rs + 0.010, 0.036, 0.028, 0.052, 0.042);
    for (const sgn of [-1, 1]) bar(a + sgn * spread * 0.05, a + sgn * spread, rs - 0.006, r1, 0.016, 0.012, 0.040, 0.024);
  }
  spin.add(mesh(facesGeo(faces), M.gt3Wheel, { name: `${name}-spokes` }));
  // Hub and centre-lock nut with its cap.
  const hub = new THREE.CylinderGeometry(r0 + 0.006, r0 + 0.012, 0.05, 40);
  hub.rotateX(Math.PI / 2); hub.translate(0, 0, zFace - dish - 0.022);
  spin.add(mesh(hub, M.gt3Wheel, { name: `${name}-hub` }));
  const nut = new THREE.CylinderGeometry(0.042, 0.047, 0.034, 12);
  nut.rotateX(Math.PI / 2); nut.translate(0, 0, zFace - dish + 0.010);
  // The centre-lock nut is black in the photographs, its cap too.
  spin.add(mesh(nut, M.gt3Plastic, { name: `${name}-nut` }));
  const cap = new THREE.CylinderGeometry(0.031, 0.033, 0.012, 32);
  cap.rotateX(Math.PI / 2); cap.translate(0, 0, zFace - dish + 0.030);
  spin.add(mesh(cap, M.gt3Black, { name: `${name}-nut-cap`, castShadow: false }));
  // The cross-drilled disc on its bell, inboard of the spokes.
  const d = brakes.disc / 2, zDisc = -0.022;
  spin.add(mesh(drilledDisc(d, d * 0.56, brakes.thickness, zDisc), M.gt3Disc, { name: `${name}-disc` }));
  const bell = new THREE.CylinderGeometry(d * 0.56, d * 0.58, 0.05, 40);
  bell.rotateX(Math.PI / 2); bell.translate(0, 0, zDisc + brakes.thickness / 2 + 0.02);
  spin.add(mesh(bell, M.gt3CalliperBlack, { name: `${name}-bell` }));
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
  const cal = mesh(ca, M.gt3CalliperBlack, { name: `${name}-calliper` });
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
 * The swan-neck rear wing, TRACED on the side photograph with its fitted camera (each part at its
 * own depth: the end plates at ±0.87 m, the necks at ±0.345 m; ≈ ±1.5 cm) and read against the rear,
 * three-quarter and close-up photographs (AKOS5335, AKOS5487):
 *  - two elements, both satin silver: the fixed main plane and the DRS flap above and behind it,
 *    hinged at its leading edge (group gt3-wing-flap), a slot between them;
 *  - the end plates, satin black: a rounded parallelogram 0.47 m long, its lower edge rising to
 *    the rear, its front edge leaning forward at the foot;
 *  - the two swan necks, satin black blades: each rises from the engine lid behind the rear window,
 *    leaning back, a triangular window between its front and rear legs; in front of the main
 *    plane's leading edge it turns back into an arm that runs over the top of both elements and
 *    hooks down onto the flap, with a tab bolted to the main plane on the way; the DRS's red
 *    hydraulic cylinder lies inboard of each, from the arm to the flap's lever.
 * The side photograph puts the top of the end plates 1.275 m up, the rear one ≈1.34 m: the wing
 * is set so that its upper edge is the car's published height, 1.322 m, between them. The sections
 * are ≈ (cambered, ≈12 % thick); the span between the end plates, ≈1.74 m, is not published (the
 * front photograph reads ≈1.63 m between them, the rear ≈1.80 m over them).
 */
export const WING = {
  span: 1.74, neckZ: 0.345, neckT: 0.024, plateT: 0.012,
  main: { le: -1.800, y: 1.125, chord: 0.232, aoa: 7.4, thick: 0.12 },
  flap: { le: -2.005, y: 1.172, chord: 0.198, aoa: 16.4, thick: 0.12 },
  // End plate in side elevation [x, y, corner radius], at the plates' depth.
  plate: [[-1.745, 1.080, 0.02], [-1.800, 1.255, 0.025], [-2.180, 1.275, 0.03], [-2.206, 1.245, 0.03], [-2.184, 1.200, 0.04], [-2.016, 1.108, 0.08], [-1.950, 1.090, 0.04]],
};
function buildWing(M) {
  const g = new THREE.Group();
  g.name = 'gt3-wing';
  const S = WING.span;
  // Both elements read satin silver in the studio and track photographs.
  M.gt3WingMain ??= new THREE.MeshPhysicalMaterial({ name: 'gt3-wing-main', color: 0xaeb3b8, metalness: 0.7, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  const element = (e, name) => {
    const pts = airfoil(e.chord, e.thick, 0.05, 24);
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: S, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -S / 2);
    // Trailing edge up: the angle of attack for downforce.
    geo.rotateZ(-e.aoa * D2R);
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(e.le, e.y, 0);
    grp.add(mesh(geo, M.gt3WingMain, { name: `${name}-skin` }));
    return grp;
  };
  g.add(element(WING.main, 'gt3-wing-main'));
  const flap = element(WING.flap, 'gt3-wing-flap');
  // DRS: the flap turns about its leading edge to flatten (the drive sets the angle).
  flap.userData.hinge = { axis: [0, 0, 1], range: [0, 14] };
  g.add(flap);
  // End plates: a rounded plate each side, its edges rounded too (bevel).
  const plate = roundPoly(WING.plate, 8);
  for (const sd of [-1, 1]) {
    const shape = new THREE.Shape(plate.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WING.plateT - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
    geo.translate(0, 0, sd * (S / 2 + WING.plateT / 2) - (WING.plateT - 0.006) / 2);
    g.add(mesh(geo, M.gt3Plastic, { name: `gt3-wing-endplate-${sd > 0 ? 'r' : 'l'}` }));
  }
  // Swan necks: one outline each in side elevation, the feet sunk into the engine lid, the
  // triangular window between the legs.
  const foot = (x) => bodyPoint(x, tAtZ(x, WING.neckZ, 1)).y - 0.03;
  const neck = roundPoly([
    [-1.588, foot(-1.588)], [-1.721, 1.246, 0.03], [-1.80, 1.258, 0.02], [-2.07, 1.268, 0.015], [-2.105, 1.258, 0.012],
    [-2.105, 1.214, 0.006], [-2.075, 1.214, 0.006],
    // The tab down to the main plane, bolted to its upper face.
    [-1.968, 1.208, 0.004], [-1.968, 1.150, 0.004], [-1.935, 1.146, 0.004], [-1.935, 1.206, 0.004],
    [-1.885, 1.212, 0.02], [-1.793, 1.068, 0.03], [-1.816, foot(-1.816)],
  ], 6);
  const hole = roundPoly([[-1.700, foot(-1.700) + 0.035, 0.012], [-1.752, 1.050, 0.012], [-1.764, foot(-1.764) + 0.035, 0.012]], 5);
  const red = [], alu = [];
  for (const sd of [-1, 1]) {
    const shape = new THREE.Shape(neck.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WING.neckT - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 4 });
    geo.translate(0, 0, sd * WING.neckZ - (WING.neckT - 0.008) / 2);
    g.add(mesh(geo, M.gt3Plastic, { name: `gt3-wing-neck-${sd > 0 ? 'r' : 'l'}` }));
    // The DRS cylinder inboard of the neck: from under the arm back and down to the flap's lever.
    const z = sd * (WING.neckZ - 0.034);
    const a = new THREE.Vector3(-1.900, 1.214, z), b = new THREE.Vector3(-1.985, 1.192, z);
    const dir = b.clone().sub(a), len = dir.length();
    const cyl = new THREE.CylinderGeometry(0.0125, 0.0125, len * 0.7, 16);
    cyl.translate(0, len * 0.35, 0);
    cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    cyl.translate(a.x, a.y, a.z);
    red.push({ geometry: cyl });
    const rod = new THREE.CylinderGeometry(0.0045, 0.0045, len * 0.4, 10);
    rod.translate(0, len * 0.8, 0);
    rod.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    rod.translate(a.x, a.y, a.z);
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
 * plan and sections ≈ from the front and three-quarter photographs (≈0.17 m across in front view).
 */
export const MIRROR = { x0: 0.205, x1: 0.43, y0: 0.86, y1: 1.005, depth: 0.17 };
function buildMirrors(M) {
  const g = new THREE.Group();
  g.name = 'gt3-mirrors';
  const { x0, x1, y0, y1, depth } = MIRROR;
  const out = BODY.widthMirrors / 2, hz = depth / 2, hy = (y1 - y0) / 2, yc = (y0 + y1) / 2;
  // Sections along the housing: a rounded square (superellipse) shrinking to the nose.
  const NS = 18, NA = 40, pe = 2.4;
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
/**
 * The front splitter: a black blade under the bumper following the nose's own outline at its foot,
 * 2 cm proud of it (≈; the front and three-quarter photographs show only its edge).
 */
function buildSplitter(M) {
  const E = ENDS[1], y = 0.15, W = E.halfAt(y) * 0.98;
  const side = range(1.85, X_NOSE, 10).map(x => [x, Math.min(halfW(x) * 0.97, W)]);
  const front = range(W, -W, 40).map(z => [E.xAt(z, y) + 0.02, z]);
  const outline = [...side, ...front, ...side.slice().reverse().map(([x, z]) => [x, -z])];
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);          // the shape's (x, z) onto the ground plane, extruded down
  geo.translate(0, 0.14, 0);
  return mesh(geo, M.gt3Plastic, { name: 'gt3-splitter' });
}
/** Twin tailpipes in the middle of the tail (rear photograph with its solved camera: centres 0.29 m up, 0.12 m apart, ⌀ ≈0.10 m). */
function buildExhaust(M) {
  const parts = [];
  for (const sd of [-1, 1]) {
    const outer = new THREE.CylinderGeometry(0.05, 0.05, 0.14, 28, 1, true);
    outer.rotateZ(Math.PI / 2); outer.translate(-L2 + 0.05, 0.29, sd * 0.06);
    parts.push({ geometry: outer });
    const lip = new THREE.TorusGeometry(0.047, 0.0045, 6, 28);
    lip.rotateY(Math.PI / 2); lip.translate(-L2 - 0.02, 0.29, sd * 0.06);
    parts.push({ geometry: lip });
  }
  const g = new THREE.Group();
  g.name = 'gt3-exhaust';
  // The tips are dark titanium in the rear photograph, not bright.
  M.gt3Tip ??= new THREE.MeshStandardMaterial({ name: 'gt3-tailpipe-ti', color: 0x34322f, metalness: 0.9, roughness: 0.32 });
  g.add(mesh(mergeAll(parts), M.gt3Tip, { name: 'gt3-tailpipes' }));
  for (const sd of [-1, 1]) {
    const inner = new THREE.CircleGeometry(0.045, 24);
    inner.rotateY(-Math.PI / 2); inner.translate(-L2 + 0.0, 0.29, sd * 0.06);
    g.add(mesh(inner, M.gt3Black, { name: `gt3-tailpipe-bore-${sd > 0 ? 'r' : 'l'}`, castShadow: false }));
  }
  return g;
}
/**
 * The diffuser under the tail (rear photograph with its solved camera): six fins, 0.19 to 0.32 m up,
 * under the ramp they divide, which rises from the floor to the tail (≈).
 */
function buildDiffuser(M) {
  const fins = [];
  {
    const shape = new THREE.Shape([new THREE.Vector2(-1.90, 0.150), new THREE.Vector2(-L2 + 0.03, 0.212), new THREE.Vector2(-L2 + 0.03, 0.226), new THREE.Vector2(-1.90, 0.164)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.60, bevelEnabled: false });
    geo.translate(0, 0, -0.80);
    fins.push({ geometry: geo });
  }
  // Six strakes, at ±0.155, ±0.306 and ±0.474 m (rear photograph), 0.19 to 0.32 m up at the tail.
  for (const z of [0.155, 0.306, 0.474]) for (const sd of [-1, 1]) {
    const shape = new THREE.Shape([new THREE.Vector2(-1.80, 0.155), new THREE.Vector2(-L2 + 0.04, 0.19), new THREE.Vector2(-L2 + 0.03, 0.32), new THREE.Vector2(-2.00, 0.30)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
    geo.translate(0, 0, sd * z - 0.004);
    fins.push({ geometry: geo });
  }
  return mesh(mergeAll(fins), M.gt3Plastic, { name: 'gt3-diffuser-fins' });
}

// ---- The cabin -------------------------------------------------------------------------------------
export function buildGt3rs(M) {
  gt3Materials(M);
  const root = new THREE.Group();
  root.name = 'gt3rs';
  // Everything on the springs: body, wing, mirrors, cabin, lamps.
  const sprung = new THREE.Group();
  sprung.name = 'gt3-sprung';
  sprung.add(buildBody(M), buildWing(M), buildMirrors(M), buildCabin(M), buildSplitter(M), buildExhaust(M), buildDiffuser(M));
  root.add(sprung);
  for (const side of [-1, 1]) {
    root.add(buildWheel(M, AXLE_F, side, `gt3-wheel-f${side > 0 ? 'r' : 'l'}`, BRAKES.front));
    root.add(buildWheel(M, AXLE_R, side, `gt3-wheel-r${side > 0 ? 'r' : 'l'}`, BRAKES.rear));
  }
  root.userData.length = BODY.length;
  root.userData.height = BODY.height;
  return root;
}
