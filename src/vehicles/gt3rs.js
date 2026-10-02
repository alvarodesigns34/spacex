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
 * centripetal Catmull-Rom through 13 points (sill, tuck, widest point, flank, shoulder and
 * upper edge on each side of the centre line), swept along X through key tables. The glass,
 * the black trim, the lamps and the openings are regions of that one surface, so they cannot
 * drift apart from it. The body, wing, mirrors and cabin hang in group gt3-sprung, which the
 * drive pitches and rolls on the springs; the four wheels are outside it.
 */
import * as THREE from 'three';
import { mesh, mergeAll, curve } from '../geometry/utils.js';
import { BODY, WHEELS, BRAKES, PAINT } from '../data/gt3rs.js';

const L2 = BODY.length / 2, AX = BODY.wheelbase / 2, D2R = Math.PI / 180, TAU = Math.PI * 2;
const RF = WHEELS.front.dia / 2, RR = WHEELS.rear.dia / 2;
/** Static ride: the tyres stand ≈8 mm compressed under the car's weight (≈). */
const SQUASH = 0.008;
/** The swept surface stops short of the ends; a shallow dome closes each to the published length. */
const X_NOSE = L2 - 0.03, X_TAIL = -L2;
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
  [-L2, 0.792], [-2.27, 0.852], [-2.24, 0.882], [-2.18, 0.906], [-2.05, 0.926], [-1.80, 0.941], [-1.50, 0.941], [-AX, 0.941],
  [-1.0, 0.931], [-0.75, 0.906], [-0.50, 0.882], [0, 0.874], [0.50, 0.882], [0.80, 0.906], [1.0, 0.926],
  [AX, 0.936], [1.50, 0.929], [1.75, 0.919], [1.95, 0.906], [2.10, 0.882], [2.18, 0.857], [2.24, 0.822], [2.27, 0.782], [L2, 0.713],
]);
const yWide = curve([
  [-L2, 0.50], [-2.0, 0.56], [-AX, 0.60], [-0.8, 0.55], [0, 0.48], [0.8, 0.50], [AX, 0.55], [1.8, 0.44], [L2, 0.40],
]);
/** The visible side's lower edge before the arches cut it. */
const ySillBase = curve([
  [-L2, 0.20], [-2.20, 0.19], [-2.0, 0.19], [-1.6, 0.18], [-1.0, 0.15], [-0.6, 0.135],
  [0.6, 0.135], [1.0, 0.14], [1.6, 0.15], [1.95, 0.15], [2.20, 0.145], [2.25, 0.15], [L2, 0.17],
]);
/** Shoulder: the front fender's crest, the beltline along the cabin, the rear haunch. [z, y] */
const shoulderZ = curve([
  [-L2, 0.66], [-2.27, 0.70], [-2.20, 0.74], [-2.13, 0.75], [-2.0, 0.77], [-1.80, 0.78], [-1.50, 0.79],
  [-AX, 0.80], [-1.0, 0.815], [-0.80, 0.825], [-0.50, 0.83], [0, 0.83], [0.50, 0.828], [0.65, 0.82],
  [0.78, 0.79], [0.85, 0.77], [1.0, 0.755], [AX, 0.745], [1.50, 0.74], [1.64, 0.735], [1.77, 0.73],
  [1.90, 0.72], [2.05, 0.70], [2.20, 0.67], [2.26, 0.65], [L2, 0.63],
]);
const shoulderY = curve([
  [-L2, 0.76], [-2.27, 0.80], [-2.20, 0.84], [-2.13, 0.86], [-2.0, 0.875], [-1.80, 0.89], [-1.50, 0.9],
  [-AX, 0.905], [-1.0, 0.91], [-0.80, 0.925], [-0.50, 0.935], [0, 0.937], [0.50, 0.935], [0.65, 0.925],
  [0.78, 0.905], [0.85, 0.895], [1.0, 0.88], [AX, 0.865], [1.50, 0.846], [1.64, 0.836], [1.72, 0.828], [1.79, 0.81], [1.85, 0.775],
  [1.92, 0.70], [2.05, 0.615], [2.15, 0.565], [2.22, 0.53], [2.26, 0.505], [L2, 0.475],
]);
/** Upper edge: the bonnet's flank, the A-pillar, the roof's edge, the rear window's, the deck's. */
const upperZ = curve([
  [-L2, 0.40], [-2.27, 0.40], [-2.20, 0.41], [-2.13, 0.42], [-1.97, 0.44], [-1.76, 0.46], [-1.55, 0.50],
  [-1.35, 0.52], [-1.08, 0.51], [-0.93, 0.50], [-0.75, 0.50], [-0.55, 0.51], [-0.30, 0.52], [0, 0.53],
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
/** Landmarks of the section's parameter: control point i sits at t = i/12. */
export const T = { sillL: 0, shoulderL: 4 / 12, upperL: 5 / 12, centre: 0.5, upperR: 7 / 12, shoulderR: 8 / 12, sillR: 1 };
const _cache = new Map();
function section(x) {
  const key = Math.round(x * 1e5);
  const hit = _cache.get(key);
  if (hit) return hit;
  const W = halfW(x), yc = yCrown(x), ys = sillEdge(x);
  const zS = shoulderZ(x), yS = shoulderY(x), zU = upperZ(x), yU = upperY(x);
  // Over an arch the side's lower points ride up with the cut edge, so the section stays in order.
  const yW = Math.min(yS - 0.03, Math.max(yWide(x), ys + 0.42 * (yS - ys)));
  const half = [
    [0.93 * W, ys],                                   // sill or arch edge
    [0.975 * W, ys + 0.3 * (yW - ys)],                // tuck-under
    [W, yW],                                          // widest
    [0.985 * W + 0.015 * zS, yW + 0.55 * (yS - yW)],  // flank
    [zS, yS],                                         // shoulder: fender crest, beltline, haunch
    [zU, yU],                                         // upper edge
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
/** The section parameter on one side (sd −1 left, +1 right) where the body is at height y, from the sill up to the shoulder. */
export function tAtHeight(x, y, sd) {
  let lo = 0, hi = T.shoulderL;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bodyPoint(x, m).y < y) lo = m; else hi = m; }
  const t = (lo + hi) / 2;
  return sd < 0 ? t : 1 - t;
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
    for (const land of [T.shoulderL, T.upperL, T.upperR, T.shoulderR]) {
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
  const half = [...seg(0, T.shoulderL - 0.02, 34), ...seg(T.shoulderL - 0.02, T.upperL + 0.01, 46), ...seg(T.upperL + 0.01, 0.5, 26)];
  return [...half, ...half.slice().reverse().map(t => 1 - t).filter(t => t > 0.5 + 1e-9), 0.5].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 1e-9);
}

// ---- Regions of the surface -------------------------------------------------------------------
const side = (t) => (t < 0.5 ? t : 1 - t);                 // fold to the left half: 0 sill … 0.5 crown
/** Fraction up the side window band, 0 at the beltline, 1 at the roof's edge. */
const winUp = (t) => (side(t) - T.shoulderL) / (T.upperL - T.shoulderL);
const PILLAR = 0.012;                                       // ≈ the painted pillars' width, in t
/** The windscreen, between the A-pillars from the cowl to the header. */
export const inWindscreen = (x, t) => x < 0.765 && x > 0.22 && side(t) > T.upperL + PILLAR;
/** The side glass: door window and rear quarter window, the B-pillar between them (≈). */
export function inSideGlass(x, t) {
  const f = winUp(t);
  if (f <= 0.06 || f >= 0.94) return false;
  const front = 0.45 - 0.28 * f, rear = -1.24 + 0.44 * f;
  if (x > front || x < rear) return false;
  return !(x < -0.40 && x > -0.46);
}
/** The rear window, between the C-pillars. */
export const inRearWindow = (x, t) => x < -0.93 && x > -1.60 && side(t) > T.upperL + PILLAR * 1.5;
const inGlass = (x, t) => inWindscreen(x, t) || inSideGlass(x, t) || inRearWindow(x, t);
/** The black seal round each pane: a band just outside the glass (≈ 1.5 cm). */
function inSeal(x, t) {
  if (inGlass(x, t)) return false;
  const dx = 0.015, dt = 0.004;
  return inGlass(x + dx, t) || inGlass(x - dx, t) || inGlass(x, t + dt) || inGlass(x, t - dt);
}

/** The headlamps: round in front elevation, on the front of each fender (≈ ⌀ 0.236 m). */
export const LAMP = { z: 0.715, y: 0.69, r: 0.118, x0: 1.55 };
const lampD = (p) => Math.hypot(Math.abs(p.z) - LAMP.z, p.y - LAMP.y);
/** The side intake on the rear fender, ahead of the rear wheel: a slanted slot (≈). */
function inSideIntake(p) {
  const dx = p.x + 0.955, dy = p.y - 0.675, c = Math.cos(-0.95), s = Math.sin(-0.95);
  const u = dx * c - dy * s, v = dx * s + dy * c;
  return (u / 0.175) ** 2 + (v / 0.042) ** 2 < 1;
}
/**
 * What covers the body at (x, t): 'glass', 'seal', 'lamp' (a headlamp's opening), 'ring' (its
 * black surround), 'plastic' (the matt black intakes, skirts, diffuser), 'vent' (the bonnet's
 * outlets), 'tail' (the red light bar), 'smoke' (the tail lamps' dark lenses), or 'paint'.
 * Positions TRACED on the studio photographs, sizes ≈.
 */
const _rp = new THREE.Vector3();
export function region(x, t) {
  if (inGlass(x, t)) return 'glass';
  if (inSeal(x, t)) return 'seal';
  const p = bodyPoint(x, t, _rp), az = Math.abs(p.z), sill = sillEdge(x);
  // Front: the lamps, the bumper's intakes.
  if (x > LAMP.x0) {
    const d = lampD(p);
    if (d < LAMP.r) return 'lamp';
  }
  if (x > 1.98 && az < 0.56 && p.y > 0.165 && p.y < 0.335) return 'plastic';           // central intake
  if (x > 1.96 && az > 0.60 && az < 0.79 && p.y > 0.20 && p.y < 0.40) return 'plastic';  // corner intakes
  // The bonnet's two outlets (the central radiator's air leaves through them).
  if (x > 1.42 && x < 1.80 && az > 0.06 && az < 0.34 && p.y > 0.6) return 'vent';
  // The front fenders' louvres over the wheels: slats every 4 cm (≈).
  if (x > 0.98 && x < 1.42 && az > 0.56 && az < 0.82 && p.y > 0.78 && Math.floor((x - 0.98) / 0.04) % 2 === 0) return 'plastic';
  // Behind the front wheels: the GT1-style inlets, and the side skirts.
  if (x > 0.83 && x < 0.97 && az > 0.86 && p.y > 0.16 && p.y < 0.60) return 'plastic';
  if (x > -0.86 && x < 0.84 && az > 0.80 && p.y < sill + 0.055) return 'plastic';
  // The rear fenders: the side intake ahead of the wheel, the arch outlets behind it.
  if (az > 0.80 && inSideIntake(p)) return 'plastic';
  if (x < -1.70 && x > -1.84 && az > 0.84 && p.y > 0.18 && p.y < 0.56) return 'plastic';
  // Tail: the light bar, the lamps' dark lenses, the black lower panel and the diffuser.
  if (x < -2.12) {
    if (Math.abs(p.y - 0.735) < 0.011 && az < 0.84) return 'tail';
    if (p.y > 0.70 && p.y < 0.77 && az > 0.60 && az < 0.86) return 'smoke';
    if (p.y > 0.31 && p.y < 0.335 && az > 0.60 && az < 0.70) return 'tail';
    if (p.y > 0.24 && p.y < 0.485 && az < 0.82) return 'plastic';
  }
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
  M.gt3Disc = new THREE.MeshStandardMaterial({ name: 'gt3-disc', color: 0x6e6a66, metalness: 0.8, roughness: 0.48 });
  // Cast-iron brakes carry red callipers (ceramic ones are yellow).
  M.gt3Calliper = new THREE.MeshStandardMaterial({ name: 'gt3-calliper', color: 0xb3141a, metalness: 0.15, roughness: 0.36 });
  M.gt3Carbon = new THREE.MeshStandardMaterial({ name: 'gt3-carbon', color: 0x17181a, metalness: 0.3, roughness: 0.3 });
  // Lamps: a clear lens over a dark chrome bowl, the four-point daytime lights lit.
  M.gt3Lens = new THREE.MeshPhysicalMaterial({ name: 'gt3-lens', color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.18, envMapIntensity: 1.6, depthWrite: false });
  M.gt3Bowl = new THREE.MeshStandardMaterial({ name: 'gt3-lamp-bowl', color: 0x2a2d31, metalness: 0.9, roughness: 0.25 });
  M.gt3Drl = new THREE.MeshStandardMaterial({ name: 'gt3-drl', color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.6, roughness: 0.4 });
  M.gt3Tail = new THREE.MeshStandardMaterial({ name: 'gt3-tail', color: 0x7a0a0c, emissive: 0xd0161a, emissiveIntensity: 0.9, roughness: 0.35 });
  M.gt3Smoke = new THREE.MeshStandardMaterial({ name: 'gt3-tail-smoke', color: 0x1a0d0e, metalness: 0.2, roughness: 0.15 });
  M.gt3Seat = new THREE.MeshStandardMaterial({ name: 'gt3-seat', color: 0x1e1f21, metalness: 0, roughness: 0.85 });
  return M;
}

// ---- The body ---------------------------------------------------------------------------------
/**
 * One end of the body closed with a shallow dome: rings shrinking from the last section to its
 * centroid, pushed out by up to `bulge` (the bumper's curve in plan, ≈). The dome's triangles
 * take their region from where they land, as the swept surface's do.
 */
function endCap(x, dir, bulge, regionOf) {
  const ts = paramsT(0, 1, 136);
  const ring = ts.map(t => bodyPoint(x, t));
  // The section is open across the bottom (sill to sill): close it along the floor.
  const yb = Math.min(ring[0].y, ring[ring.length - 1].y);
  const floor = [];
  for (let k = 1; k < 24; k++) floor.push(new THREE.Vector3(x, yb, ring[ring.length - 1].z + (ring[0].z - ring[ring.length - 1].z) * k / 24));
  const loop = [...ring, ...floor];
  const cy = loop.reduce((s, p) => s + p.y, 0) / loop.length;
  const K = 20, n = loop.length;
  const pts = [];
  for (let k = 0; k <= K; k++) {
    const f = 1 - k / K;
    for (const p of loop) {
      pts.push(new THREE.Vector3(x + dir * bulge * (1 - f * f), cy + (p.y - cy) * f, p.z * f));
    }
  }
  const byRegion = new Map();
  const add = (key, a, b, c) => { if (!byRegion.has(key)) byRegion.set(key, []); byRegion.get(key).push(a, b, c); };
  const c3 = new THREE.Vector3();
  for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
    for (const [p, q, r] of [[a, b, c], [b, d, c]]) {
      c3.copy(pts[p]).add(pts[q]).add(pts[r]).multiplyScalar(1 / 3);
      const key = regionOf(c3);
      if (dir > 0) add(key, p, q, r); else add(key, p, r, q);
    }
  }
  const pos = new Float32Array(pts.length * 3), uv = new Float32Array(pts.length * 2);
  pts.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); uv.set([p.z, p.y], i * 2); });
  const out = new Map();
  for (const [key, idx] of byRegion) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv.slice(), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Wound to face out along ±X whichever way the loop ran.
    let sx = 0; const nn = g.attributes.normal;
    for (let i = 0; i < nn.count; i += 7) sx += nn.getX(i);
    if (sx * dir < 0) { g.setIndex(Array.from(g.index.array).reverse()); g.computeVertexNormals(); }
    out.set(key, g);
  }
  return out;
}
/** The tail's and nose's regions by position (the cap is beyond the swept stations). */
function capRegion(p) {
  const az = Math.abs(p.z);
  if (p.x > 0) {
    if (az < 0.56 && p.y > 0.165 && p.y < 0.335) return 'plastic';
    if (az > 0.60 && az < 0.79 && p.y > 0.20 && p.y < 0.40) return 'plastic';
    if (p.y < 0.165) return 'plastic';
    return 'paint';
  }
  if (Math.abs(p.y - 0.735) < 0.011 && az < 0.84) return 'tail';
  if (p.y > 0.70 && p.y < 0.77 && az > 0.60) return 'smoke';
  if (p.y > 0.31 && p.y < 0.335 && az > 0.60 && az < 0.70) return 'tail';
  if (p.y < 0.485) return 'plastic';
  return 'paint';
}

/** A thin dark line drawn on the body along (x, t) samples: shut lines and seams (≈ 4 mm). */
function lineOnBody(samples, width = 0.004) {
  const pos = [], idx = [];
  const n = new THREE.Vector3(), d = new THREE.Vector3(), s = new THREE.Vector3();
  const P = samples.map(([x, t]) => bodyPoint(x, t));
  P.forEach((p, i) => {
    const [x, t] = samples[i];
    bodyNormal(x, t, n);
    d.subVectors(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    s.crossVectors(n, d).normalize().multiplyScalar(width / 2);
    const q = p.clone().addScaledVector(n, 0.0012);
    pos.push(q.x - s.x, q.y - s.y, q.z - s.z, q.x + s.x, q.y + s.y, q.z + s.z);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Faces out: compare with the body's normal at the first sample.
  bodyNormal(samples[0][0], samples[0][1], n);
  if (g.attributes.normal.getX(0) * n.x + g.attributes.normal.getY(0) * n.y + g.attributes.normal.getZ(0) * n.z < 0) {
    g.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]]));
    g.computeVertexNormals();
  }
  return g;
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

/** The panels' shut lines: doors, front lid, engine lid, the front bumper's joint (≈). */
function buildShutLines(M) {
  const lines = [];
  for (const sd of [-1, 1]) {
    const tS = sd < 0 ? T.shoulderL : 1 - T.shoulderL;
    const tLow = (x) => tAtHeight(x, sillEdge(x) + 0.06, sd);
    // Door: the front edge just behind the wheel arch's inlet, the rear edge curving back at the top.
    lines.push(range(0, 1, 16).map(f => [0.49, tLow(0.49) + (tS - tLow(0.49)) * f]));
    lines.push(range(0, 1, 16).map(f => [-0.50 - 0.04 * f * f, tLow(-0.50) + (tS - tLow(-0.50)) * f]));
    lines.push(range(-0.50, 0.49, 30).map(x => [x, tLow(x)]));
    // Front lid: along the fender's inner flank, from the cowl to the bumper.
    const tU = sd < 0 ? T.upperL - 0.006 : 1 - T.upperL + 0.006;
    lines.push(range(0.84, 2.05, 40).map(x => [x, tU]));
    // Engine lid: along the deck's edge from the rear window to the ducktail.
    lines.push(range(-2.12, -1.62, 20).map(x => [x, sd < 0 ? T.upperL - 0.004 : 1 - T.upperL + 0.004]));
    // The front bumper's joint with the fender, ahead of the arch (≈).
    const tTop = sd < 0 ? T.upperL - 0.006 : 1 - T.upperL + 0.006;
    lines.push(range(0, 1, 20).map(f => [2.05 - 0.15 * (1 - f), tAtHeight(1.95, 0.18, sd) + (tTop - tAtHeight(1.95, 0.18, sd)) * f]));
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
  const centre = { x: 1.80, t: sd < 0 ? T.shoulderL - 0.01 : 1 - T.shoulderL + 0.01 };
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
/** Black seals along the side glass's slanted edges (the A-pillar's and the quarter window's). */
function buildGlassSeals(M) {
  const lines = [];
  for (const sd of [-1, 1]) {
    const tAt = (f) => { const ts = T.shoulderL + f * (T.upperL - T.shoulderL); return sd < 0 ? ts : 1 - ts; };
    lines.push(range(0.04, 0.96, 24).map(f => [0.45 - 0.28 * f, tAt(f)]));
    lines.push(range(0.04, 0.96, 24).map(f => [-1.24 + 0.44 * f, tAt(f)]));
  }
  return mesh(mergeAll(lines.map(l => ({ geometry: lineOnBody(l, 0.026) }))), M.gt3Black, { name: 'gt3-glass-edge-seals', castShadow: false });
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
  const MAT = { paint: M.gt3Paint, seal: M.gt3Black, plastic: M.gt3Plastic, vent: M.gt3Plastic, tail: M.gt3Tail, smoke: M.gt3Smoke };
  for (const [key, mat] of Object.entries(MAT)) {
    g.add(mesh(sweep(xs, ts, { keep: (x, t) => reg(x, t) === key, lift: key === 'seal' ? 0.001 : 0 }), mat, { name: key === 'paint' ? 'gt3-body-paint' : `gt3-body-${key}` }));
  }
  const glass = mesh(sweep(xs, ts, { keep: (x, t) => reg(x, t) === 'glass', lift: 0.002 }), M.gt3Glass, { name: 'gt3-glass', castShadow: false });
  glass.renderOrder = 2;
  g.add(glass);
  g.add(buildLamps(M));
  g.add(buildGlassSeals(M));
  // The cabin's lining: the same surface a few centimetres in, facing inwards, so the glass
  // shows a dark interior and never the outside world through the back of the body.
  g.add(mesh(sweep(stationsX(-1.45, 0.80, 90), paramsT(0.08, 0.92, 48), { lift: -0.03, inward: true }), M.gt3Interior, { name: 'gt3-cabin-lining', castShadow: false }));
  // The ends: a shallow dome each, the nose's carrying the intakes, the tail's the lamps.
  for (const [x, dir, bulge] of [[X_NOSE, 1, L2 - X_NOSE], [X_TAIL, -1, X_TAIL + L2]]) {
    for (const [key, geo] of endCap(x, dir, bulge, capRegion)) {
      g.add(mesh(geo, MAT[key] ?? M.gt3Paint, { name: `gt3-${dir > 0 ? 'nose' : 'tail'}-${key === 'paint' ? 'face' : key}` }));
    }
  }
  // Underbody: a flat floor between the sills, inside the wheels.
  {
    const geo = new THREE.PlaneGeometry(2 * L2 - 0.3, 1.5);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0.14, 0);
    g.add(mesh(geo, M.gt3Plastic, { name: 'gt3-floor', castShadow: false }));
  }
  g.add(buildShutLines(M));
  return g;
}
// ---- Wheels and brakes ------------------------------------------------------------------------------
/**
 * One corner: the tyre (a low-profile section turned round the axle), the forged centre-lock
 * wheel (barrel, flange and ten slim spokes, the published rim sizes; spoke shape ≈), the
 * centre-lock nut, the brake disc (published diameter and thickness; the dimples ≈) and the
 * monobloc calliper (six pistons front, four rear, published; its size ≈) at the back of the
 * disc. `side` +1 right, −1 left; the wheel's face looks out.
 */
function buildWheel(M, axle, side, name, brakes) {
  const g = new THREE.Group();
  g.name = name;
  const tyre = axle.tyre, R = tyre.dia / 2, w = tyre.width, rr = tyre.rimDia / 2, rw = tyre.rimWidth;
  // The wheel's own frame: its axle along local +Z, the outer face at +Z.
  const spin = new THREE.Group();
  spin.name = `${name}-spin`;
  // Tyre: bead to bead round the tread, square shoulders, sidewalls bulging a little past the rim.
  const prof = [];
  for (let k = 0; k <= 22; k++) {
    const a = -Math.PI / 2 + Math.PI * k / 22;
    const r = rr + 0.012 + (R - rr - 0.012) * Math.pow(Math.cos(a), 0.16);
    const bulge = 1 + 0.06 * Math.pow(Math.cos(a * 1.7), 2) * (Math.abs(a) > 0.9 ? 1 : 0.4);
    prof.push(new THREE.Vector2(r, (w / 2) * Math.sin(a) * Math.min(1.04, bulge)));
  }
  const tg = new THREE.LatheGeometry(prof, 72);
  tg.computeVertexNormals();
  tg.rotateX(Math.PI / 2);
  spin.add(mesh(tg, M.gt3Tyre, { name: `${name}-tyre` }));
  // Rim barrel (inside the tyre, seen past the spokes) and the outer flange.
  const barrel = new THREE.CylinderGeometry(rr - 0.004, rr - 0.004, rw * 0.92, 48, 1, true);
  barrel.rotateX(Math.PI / 2);
  spin.add(mesh(barrel, M.gt3Wheel, { name: `${name}-barrel` }));
  const flange = new THREE.TorusGeometry(rr + 0.006, 0.011, 8, 64);
  flange.translate(0, 0, rw * 0.46);
  spin.add(mesh(flange, M.gt3Wheel, { name: `${name}-flange` }));
  // Spokes: ten, each a tapered blade from the hub out to the flange, dished towards the face.
  const spokes = [];
  for (let k = 0; k < 10; k++) {
    const a = k * Math.PI / 5;
    const shape = new THREE.Shape();
    const r0 = 0.075, r1 = rr - 0.01;
    shape.moveTo(r0, -0.022); shape.lineTo(r1, -0.014); shape.lineTo(r1, 0.014); shape.lineTo(r0, 0.022); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
    // Dish: the hub stands proud of the rim's face, the blade falls back towards the barrel.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const r = p.getX(i); p.setZ(i, p.getZ(i) + rw * 0.42 - 0.035 - 0.07 * (r - r0) / (r1 - r0)); }
    geo.computeVertexNormals();
    geo.rotateZ(a);
    spokes.push({ geometry: geo });
  }
  spin.add(mesh(mergeAll(spokes), M.gt3Wheel, { name: `${name}-spokes` }));
  // Hub and centre-lock nut.
  const hub = new THREE.CylinderGeometry(0.085, 0.095, 0.05, 32);
  hub.rotateX(Math.PI / 2); hub.translate(0, 0, rw * 0.42 - 0.02);
  spin.add(mesh(hub, M.gt3Wheel, { name: `${name}-hub` }));
  const nut = new THREE.CylinderGeometry(0.045, 0.05, 0.045, 6);
  nut.rotateX(Math.PI / 2); nut.translate(0, 0, rw * 0.42 + 0.02);
  spin.add(mesh(nut, M.aluminum ?? M.gt3Wheel, { name: `${name}-nut` }));
  // Brake disc, inside the barrel, on the hub.
  const d = brakes.disc / 2;
  const disc = new THREE.CylinderGeometry(d, d, brakes.thickness, 48, 1);
  disc.rotateX(Math.PI / 2); disc.translate(0, 0, rw * 0.05);
  spin.add(mesh(disc, M.gt3Disc, { name: `${name}-disc` }));
  const bell = new THREE.CylinderGeometry(0.11, 0.12, 0.06, 32);
  bell.rotateX(Math.PI / 2); bell.translate(0, 0, rw * 0.05 + 0.04);
  spin.add(mesh(bell, M.alumDark ?? M.gt3Plastic, { name: `${name}-bell` }));
  // The wheel faces out: mirror the frame on the left.
  spin.scale.z = side;
  g.add(spin);
  // Calliper: fixed, gripping the disc's rear edge (≈), not turning with the wheel.
  const cal = new THREE.Group();
  cal.name = `${name}-calliper`;
  const ca = new THREE.TorusGeometry(d - 0.035, 0.032, 10, 20, brakes.pistons > 4 ? 1.05 : 0.85);
  ca.scale(1, 1, 1.6);
  ca.rotateZ(Math.PI - (brakes.pistons > 4 ? 1.05 : 0.85) / 2);
  ca.translate(0, 0, side * rw * 0.05);
  cal.add(mesh(ca, M.gt3Calliper, { name: `${name}-calliper-body` }));
  g.add(cal);
  g.position.set(axle.x, axle.y, side * axle.track / 2);
  g.userData.spin = spin;
  return g;
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
 * The swan-neck rear wing: a fixed main plane and the hydraulically adjusted upper element
 * (the DRS flap, hinged at its leading edge; group gt3-wing-flap), end plates, and the two
 * swan necks that hold it from above, rising from the engine lid. Its upper edge is the car's
 * published 1.322 m (Porsche: "higher than the car's roof"); chords, span and the necks' line
 * TRACED on the side and rear photographs (≈).
 */
export const WING = { span: 1.80, main: { le: -1.64, chord: 0.40, y: 1.215, aoa: 9 }, flap: { le: -1.99, chord: 0.36, y: 1.255, aoa: 16 } };
function buildWing(M) {
  const g = new THREE.Group();
  g.name = 'gt3-wing';
  const S = WING.span;
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
    grp.add(mesh(geo, M.gt3Carbon, { name: `${name}-skin` }));
    return grp;
  };
  g.add(element(WING.main, 'gt3-wing-main'));
  const flap = element(WING.flap, 'gt3-wing-flap');
  // DRS: the flap turns about its leading edge to flatten (the drive sets the angle).
  flap.userData.hinge = { axis: [0, 0, 1], range: [0, 14] };
  g.add(flap);
  // End plates: a plate each side, clear of both elements.
  for (const sd of [-1, 1]) {
    const outline = [[-1.60, 1.16], [-1.66, 1.30], [-2.42, 1.33], [-2.42, 1.17], [-2.10, 1.14]];
    const geo = plateXY(outline, 0.008);
    geo.translate(0, 0, sd * (S / 2 + 0.004));
    g.add(mesh(geo, M.gt3Carbon, { name: `gt3-wing-endplate-${sd > 0 ? 'r' : 'l'}` }));
  }
  // Swan necks: rising from the engine lid, curving back over the main plane to hold it from above.
  for (const sd of [-1, 1]) {
    const z = sd * 0.34;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.86, 0.93, z), new THREE.Vector3(-1.80, 1.08, z), new THREE.Vector3(-1.78, 1.22, z),
      new THREE.Vector3(-1.84, 1.29, z), new THREE.Vector3(-1.93, 1.27, z),
    ]);
    const sh = new THREE.Shape([new THREE.Vector2(-0.03, -0.007), new THREE.Vector2(0.03, -0.007), new THREE.Vector2(0.03, 0.007), new THREE.Vector2(-0.03, 0.007)]);
    const geo = new THREE.ExtrudeGeometry(sh, { steps: 24, bevelEnabled: false, extrudePath: path });
    g.add(mesh(geo, M.gt3Black, { name: `gt3-wing-neck-${sd > 0 ? 'r' : 'l'}` }));
  }
  // The wing's upper edge is the car's published height: set it there exactly.
  g.updateMatrixWorld(true);
  const box = new THREE.Box3();
  g.traverse(o => { if (o.isMesh && !o.name.includes('neck')) box.expandByObject(o); });
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
/** Door mirrors on slim arms from the door's top; their outer faces at the published 2.027 m. */
function buildMirrors(M) {
  const g = new THREE.Group();
  g.name = 'gt3-mirrors';
  for (const sd of [-1, 1]) {
    const tag = sd > 0 ? 'r' : 'l';
    const out = BODY.widthMirrors / 2;
    // Housing: a rounded teardrop, 0.24 long, 0.13 tall, 0.11 deep (≈).
    const geo = new THREE.SphereGeometry(0.5, 24, 16);
    geo.scale(0.24, 0.13, 0.11);
    const pos = geo.attributes.position;
    // Flatten the glass side (aft) and pull the nose forward.
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); if (x < -0.02) pos.setX(i, -0.02 - (x + 0.02) * 0.25); }
    geo.computeVertexNormals();
    geo.translate(0.40, 0.995, sd * (out - 0.055));
    g.add(mesh(geo, M.gt3Paint, { name: `gt3-mirror-${tag}` }));
    // The glass: a dark face on the housing's back.
    const glass = new THREE.CircleGeometry(0.5, 24);
    glass.scale(0.10, 0.11, 1);
    glass.rotateY(-Math.PI / 2);
    glass.translate(0.365, 0.995, sd * (out - 0.055));
    g.add(mesh(glass, M.gt3Black, { name: `gt3-mirror-glass-${tag}`, castShadow: false }));
    // Arm: from the door's top edge out to the housing.
    const root = bodyPoint(0.40, sd > 0 ? 1 - T.shoulderL : T.shoulderL);
    const arm = new THREE.CatmullRomCurve3([root.clone().add(new THREE.Vector3(0, 0.01, -sd * 0.01)), new THREE.Vector3(0.39, 0.985, sd * (root.z * sd + 0.07)), new THREE.Vector3(0.38, 1.0, sd * (out - 0.10))]);
    g.add(mesh(new THREE.TubeGeometry(arm, 10, 0.014, 8), M.gt3Black, { name: `gt3-mirror-arm-${tag}` }));
  }
  return g;
}

// ---- Details: splitter, bonnet fins, lamps' lights, exhaust, diffuser -------------------------
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
/** The bonnet's outlets: three fins along each (≈), standing in the black opening. */
function buildVentFins(M) {
  const fins = [];
  for (const z of [0.12, 0.20, 0.28]) for (const sd of [-1, 1]) {
    const top = range(1.44, 1.78, 12).map(x => [x, yCrown(x) - 0.004]);
    const outline = [...top, ...top.slice().reverse().map(([x, y]) => [x, y - 0.045])];
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false });
    geo.translate(0, 0, sd * z - 0.003);
    fins.push({ geometry: geo });
  }
  return mesh(mergeAll(fins), M.gt3Plastic, { name: 'gt3-bonnet-fins', castShadow: false });
}
/** Each lamp's four-point daytime light and its projector, on the bowl inside the lens (≈ from the front photographs). */
function buildLampLights(M) {
  const dots = [], proj = [];
  for (const sd of [-1, 1]) {
    const guess = { x: 1.80, t: sd < 0 ? T.shoulderL - 0.01 : 1 - T.shoulderL + 0.01 };
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
/**
 * What the glass shows: two carbon bucket seats, the roll cage of the Clubsport package behind
 * them, the dashboard and the steering wheel (left-hand drive), all ≈ from the photographs.
 */
function buildCabin(M) {
  const g = new THREE.Group();
  g.name = 'gt3-cabin';
  const seat = (sd) => {
    const s = new THREE.Group();
    s.name = `gt3-seat-${sd > 0 ? 'r' : 'l'}`;
    const base = new THREE.BoxGeometry(0.50, 0.10, 0.48, 2, 1, 2);
    base.translate(-0.30, 0.30, sd * 0.37);
    const back = new THREE.BoxGeometry(0.10, 0.78, 0.52, 1, 4, 2);
    back.translate(0, 0.39, 0);
    back.rotateZ(0.32);
    back.translate(-0.58, 0.32, sd * 0.37);
    const wings = [];
    for (const w of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.42, 0.20, 0.06);
      b.translate(-0.30, 0.40, sd * 0.37 + w * 0.24);
      wings.push({ geometry: b });
    }
    s.add(mesh(mergeAll([{ geometry: base }, { geometry: back }, ...wings]), M.gt3Seat, { name: `gt3-seat-shell-${sd > 0 ? 'r' : 'l'}` }));
    return s;
  };
  g.add(seat(-1), seat(1));
  // Roll cage: the main hoop behind the seats, its diagonal, and the stays back to the tail.
  const tubes = [];
  const tube = (pts, r = 0.02) => tubes.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 16, r, 8) });
  tube([[-0.82, 0.25, -0.58], [-0.82, 0.95, -0.56], [-0.80, 1.17, -0.40], [-0.80, 1.19, 0], [-0.80, 1.17, 0.40], [-0.82, 0.95, 0.56], [-0.82, 0.25, 0.58]]);
  tube([[-0.82, 0.30, -0.54], [-0.81, 1.12, 0.40]]);
  tube([[-0.82, 0.30, 0.54], [-0.81, 1.12, -0.40]]);
  for (const sd of [-1, 1]) tube([[-0.80, 1.15, sd * 0.44], [-1.35, 0.95, sd * 0.52]]);
  g.add(mesh(mergeAll(tubes), M.gt3Black, { name: 'gt3-roll-cage' }));
  // Dashboard along the cowl, the instrument binnacle ahead of the driver.
  const dash = new THREE.BoxGeometry(0.30, 0.12, 1.50);
  dash.translate(0.62, 0.80, 0);
  const binnacle = new THREE.BoxGeometry(0.16, 0.08, 0.36);
  binnacle.translate(0.50, 0.89, -0.37);
  g.add(mesh(mergeAll([{ geometry: dash }, { geometry: binnacle }]), M.gt3Interior, { name: 'gt3-dash' }));
  // Steering wheel: ⌀ 360 mm (published), on its column ahead of the driver's seat.
  const wheel = new THREE.TorusGeometry(0.165, 0.016, 10, 32);
  wheel.rotateY(Math.PI / 2); wheel.rotateZ(-0.35);
  wheel.translate(0.33, 0.83, -0.37);
  const column = new THREE.CylinderGeometry(0.03, 0.035, 0.28, 10);
  column.rotateZ(Math.PI / 2 - 0.35); column.translate(0.46, 0.79, -0.37);
  g.add(mesh(mergeAll([{ geometry: wheel }, { geometry: column }]), M.gt3Black, { name: 'gt3-steering-wheel' }));
  // The cabin's floor and tunnel.
  const floor = new THREE.BoxGeometry(1.5, 0.04, 1.5);
  floor.translate(-0.15, 0.22, 0);
  const tunnel = new THREE.BoxGeometry(1.1, 0.16, 0.22);
  tunnel.translate(0.0, 0.30, 0);
  g.add(mesh(mergeAll([{ geometry: floor }, { geometry: tunnel }]), M.gt3Interior, { name: 'gt3-cabin-floor', castShadow: false }));
  return g;
}

export function buildGt3rs(M) {
  gt3Materials(M);
  const root = new THREE.Group();
  root.name = 'gt3rs';
  // Everything on the springs: body, wing, mirrors, cabin, lamps.
  const sprung = new THREE.Group();
  sprung.name = 'gt3-sprung';
  sprung.add(buildBody(M), buildWing(M), buildMirrors(M), buildCabin(M), buildSplitter(M), buildVentFins(M), buildLampLights(M), buildExhaust(M), buildDiffuser(M));
  root.add(sprung);
  for (const side of [-1, 1]) {
    root.add(buildWheel(M, AXLE_F, side, `gt3-wheel-f${side > 0 ? 'r' : 'l'}`, BRAKES.front));
    root.add(buildWheel(M, AXLE_R, side, `gt3-wheel-r${side > 0 ? 'r' : 'l'}`, BRAKES.rear));
  }
  root.userData.length = BODY.length;
  root.userData.height = BODY.height;
  return root;
}
