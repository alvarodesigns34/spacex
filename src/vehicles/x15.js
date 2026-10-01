/**
 * North American X-15 #1, USAF 56-6670, as it stood on the lakebed after a flight: gear down,
 * ventral jettisoned, flaps up. Every published dimension is taken from data/x15.js, which says
 * where each comes from; this module only turns them into surfaces.
 *
 * Airframe frame (the one the flight model will use): X forward (X = −station), Y up from the
 * fuselage reference line, Z to the right (X × Y). The exhibit group puts that frame on its gear: the
 * nose wheels and the skids on the ground, the FRL pitched nose-down by the angle the gear
 * gives (≈1.4°, derived — see GEAR in data/x15.js).
 *
 * What is published and used as given: the wing, horizontal-tail, fin, speed-brake and flap
 * planforms (TN D-3343), the modified NACA 66-005 ordinates of the wing and of the horizontal
 * tails (TM X-236), the fuselage stations of TM X-236's dimensioned figure 2, the 10° wedge of
 * the fins, the XLR99's 39.3 in nozzle and 9.8 area ratio, the skids, tyres and wheelbase (TM
 * X-207), and the manual's length, span and landing height. Reconstructed (≈): the fuselage's
 * cross-sections between the traced outlines, the canopy's section, the ball nose, the gear's
 * struts and braces, and the wing-tip pods.
 */
import * as THREE from 'three';
import { curve, mesh, mergeAll, mat4 } from '../geometry/utils.js';
import {
  X15, STATIONS, OUTLINE, NOSE, WING, HTAIL, HTAIL_EXPOSED_ROOT, UPPER_FIN, LOWER_FIN,
  WING_AIRFOIL, HTAIL_AIRFOIL, GEAR, TIP_POD, groundAttitude,
} from '../data/x15.js';
import { makeX15Skin, makeX15SurfaceTile, makeX15Decal } from '../materials/x15Textures.js';

const D2R = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Station, height, lateral → airframe frame. */
const P = (s, y, z) => V(-s, y, z);

// ---- Outline functions -------------------------------------------------------------------
const top = curve(OUTLINE.top), keel = curve(OUTLINE.keel), plan = curve(OUTLINE.plan);
const fairW = curve(OUTLINE.fairingWidth), fairUp = curve(OUTLINE.fairingUp), fairLo = curve(OUTLINE.fairingLo);
const canTop = curve(OUTLINE.canopyTop), canHalf = curve(OUTLINE.canopyHalf);
const R_BODY = STATIONS.bodyRadius;
const S_BASE = STATIONS.apexToBase, S_FAIR_END = STATIONS.fairingEnd, S_FAIR0 = STATIONS.fairingStart;
const S_BALL = NOSE.tip + NOSE.ballRadius;   // the ball's centre
const S_RING = NOSE.ringStation;

/** The body alone at station s: centre height, vertical and lateral semi-axes. */
function body(s) {
  if (s <= S_RING) {
    // Ball-nose cone: straight from the ball to the ring, circular, its axis dropping with the
    // nose's own droop (the keel falls away faster than the top).
    const r = body(S_RING + 1e-6), u = Math.max(0, (s - S_BALL) / (S_RING - S_BALL));
    const R = NOSE.ballRadius;
    return { yc: r.yc * u, a: R + (r.a - R) * u, b: R + (r.b - R) * u };
  }
  const aft = s > 11.6;
  const t = aft ? keel(s) : top(s), k = keel(s);
  const b = aft ? k : s < 4.2 ? plan(s) : R_BODY;
  return { yc: (t - k) / 2, a: (t + k) / 2, b };
}
/** Height of the body's upper surface at lateral offset z (for seating the canopy). */
function bodyTopAt(s, z) {
  const { yc, a, b } = body(s);
  const q = Math.min(1, Math.abs(z) / b);
  return yc + a * Math.sqrt(1 - q * q);
}

const smax = (p, q, k) => (p + q + Math.sqrt((p - q) * (p - q) + k * k)) / 2;
/** Radius of the fuselage section at station s along direction (dz, dy) from the body centre. */
function sectionRadius(s, dz, dy, withFairing) {
  const { yc, a, b } = body(s);
  const rb = 1 / Math.sqrt((dz / b) ** 2 + (dy / a) ** 2);
  if (!withFairing || s < S_FAIR0 || s > S_FAIR_END) return rb;
  const w = fairW(s), up = fairUp(s), lo = fairLo(s);
  if (up + lo < 1e-3) return rb;
  const yf = (up - lo) / 2, h = (up + lo) / 2, n = 2.6;
  const f = (r) => Math.abs(r * dz / w) ** n + Math.abs((yc + r * dy - yf) / h) ** n - 1;
  if (f(0) >= 0) return rb;
  let lo_ = 0, hi = 3;
  for (let i = 0; i < 40; i++) { const m = (lo_ + hi) / 2; if (f(m) < 0) lo_ = m; else hi = m; }
  // A small fillet where the fairing meets the body, not a mitre.
  return smax(rb, lo_, 0.05);
}

// ---- Swept surfaces with hard edges --------------------------------------------------------
/**
 * Sweeps a list of sections. Each section is a list of polylines (arrays of Vector3); polyline
 * p of every section has the same number of points. Each polyline becomes its own strip with
 * its own vertices, so a hard edge between two strips stays hard (a blunt trailing edge, the
 * hinge face of a flap) while the surface along each strip is smooth. UVs are in metres.
 */
function sweep(sections, closed = [], centre = null) {
  const geos = [];
  const nP = sections[0].length;
  for (let p = 0; p < nP; p++) {
    const rows = sections.map(sec => sec[p]);
    const loop = closed[p] ?? false;
    const nI = rows.length, nJ = rows[0].length + (loop ? 1 : 0);
    const pos = new Float32Array(nI * nJ * 3), uv = new Float32Array(nI * nJ * 2);
    let vAcc = 0;
    for (let i = 0; i < nI; i++) {
      if (i > 0) vAcc += rows[i][0].distanceTo(rows[i - 1][0]);
      let uAcc = 0;
      for (let j = 0; j < nJ; j++) {
        const q = rows[i][j % rows[i].length];
        if (j > 0) uAcc += q.distanceTo(rows[i][(j - 1) % rows[i].length]);
        pos.set([q.x, q.y, q.z], (i * nJ + j) * 3);
        uv.set([uAcc, vAcc], (i * nJ + j) * 2);
      }
    }
    const idx = [];
    for (let i = 0; i < nI - 1; i++) {
      for (let j = 0; j < nJ - 1; j++) {
        const a = i * nJ + j, b = a + 1, c = a + nJ, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (loop) weldSeam(g, nI, nJ);
    if (centre) orientOutward(g, centre);
    geos.push(g);
  }
  return geos.length === 1 ? geos[0] : mergeAll(geos.map(geometry => ({ geometry })));
}
/** A closed strip's first and last columns are the same points: give them one normal. */
function weldSeam(g, nI, nJ) {
  const n = g.attributes.normal;
  for (let i = 0; i < nI; i++) {
    const a = i * nJ, b = i * nJ + nJ - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
}
/**
 * Makes every normal of a geometry point away from a reference point (or line): the sweeps
 * are built without caring which way their rows run.
 */
function orientOutward(g, centreOf) {
  const p = g.attributes.position, n = g.attributes.normal;
  let score = 0;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 7) {
    centreOf(p.getX(i), p.getY(i), p.getZ(i), c);
    score += (p.getX(i) - c.x) * n.getX(i) + (p.getY(i) - c.y) * n.getY(i) + (p.getZ(i) - c.z) * n.getZ(i);
  }
  if (score < 0) flip(g);
  return g;
}
function flip(g) {
  reverseWinding(g);
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
}
/** Reverses every triangle's winding, indexed or not, leaving the normals alone. */
function reverseWinding(g) {
  if (g.index) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    return g;
  }
  for (const a of Object.values(g.attributes)) {
    const k = a.itemSize, arr = a.array;
    for (let v = 0; v < a.count; v += 3) {
      for (let c = 0; c < k; c++) { const t = arr[(v + 1) * k + c]; arr[(v + 1) * k + c] = arr[(v + 2) * k + c]; arr[(v + 2) * k + c] = t; }
    }
    a.needsUpdate = true;
  }
  return g;
}
/** Mirrors a geometry to the other side (z → −z), keeping its faces outward. */
function mirrorZ(geo) { geo.scale(1, 1, -1); return reverseWinding(geo); }
/** A flat cap over a planar polygon (points in order), facing `normal`. */
function cap(points, normal) {
  const nrm = normal.clone().normalize();
  const t1 = Math.abs(nrm.y) < 0.9 ? V(0, 1, 0).cross(nrm).normalize() : V(1, 0, 0).cross(nrm).normalize();
  const t2 = nrm.clone().cross(t1);
  const pts2 = points.map(p => new THREE.Vector2(p.dot(t1), p.dot(t2)));
  let tris = THREE.ShapeUtils.triangulateShape(pts2, []);
  const pos = [], uv = [], nor = [];
  for (const q of points) { pos.push(q.x, q.y, q.z); nor.push(nrm.x, nrm.y, nrm.z); }
  for (const q of pts2) uv.push(q.x - pts2[0].x, q.y - pts2[0].y);   // metric, from the first point
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // Wind the triangles to face the normal.
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  tris = tris.map(([i, j, k]) => {
    a.copy(points[i]); b.copy(points[j]); c.copy(points[k]);
    return b.sub(a).cross(c.sub(a)).dot(nrm) >= 0 ? [i, j, k] : [i, k, j];
  });
  g.setIndex(tris.flat());
  return g;
}

// ---- Airfoils ----------------------------------------------------------------------------------
/**
 * A section of the modified NACA 66-005 at span fraction f (0 exposed root … 1 tip). The two
 * columns differ only forward of 15 % chord (linear taper); aft of 67 % the sides are straight
 * to the 1 %-thick trailing edge, which is enforced here rather than left to the spline.
 */
function airfoilHalf(table) {
  const xs = [], root = [], tip = [];
  // The horizontal tails' table already gives its straight aft sides (75 % and 90 % lie on the
  // line from 67 % to the 1 % trailing edge: 1.652 % at 75 % against 1.653 printed); the wing's
  // stops at 67 %, and its line is drawn in here.
  const keepAft = !table.x.includes(67);
  for (let i = 0; i < table.x.length; i++) {
    if (!keepAft && table.x[i] > 67 && table.x[i] < 100) continue;
    xs.push(table.x[i] / 100); root.push(table.root[i] / 100); tip.push(table.tip[i] / 100);
  }
  if (keepAft) {
    const c = (arr) => curve(xs.map((x, i) => [x, arr[i]]));
    const cr = c(root), ct = c(tip);
    return (x, f) => cr(x) + (ct(x) - cr(x)) * f;
  }
  const iAft = xs.indexOf(0.67);
  // Straight sides from 67 % to the blunt TE: keys along the line so the cubic stays on it.
  const lin = (arr) => { const y67 = arr[iAft], y1 = arr[arr.length - 1]; return [0.75, 0.85, 0.95].map(x => y67 + (y1 - y67) * (x - 0.67) / 0.33); };
  const fx = [...xs.slice(0, -1), 0.75, 0.85, 0.95, 1];
  const fr = [...root.slice(0, -1), ...lin(root), root[root.length - 1]];
  const ft = [...tip.slice(0, -1), ...lin(tip), tip[tip.length - 1]];
  const cr = curve(fx.map((x, i) => [x, fr[i]])), ct = curve(fx.map((x, i) => [x, ft[i]]));
  return (x, f) => cr(x) + (ct(x) - cr(x)) * f;
}
const WING_T = airfoilHalf(WING_AIRFOIL);
const HT_T = airfoilHalf(HTAIL_AIRFOIL);
/** Chord stations, clustered at the nose where the ordinates change fastest. */
function chordStations(n, from = 0, to = 1) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = (1 - Math.cos(u * Math.PI / 2)) ;   // cosine clustering at the LE
    out.push(from + (to - from) * x);
  }
  return out;
}

// ---- Materials ---------------------------------------------------------------------------------
/** The X-15's own finishes, built once and kept on M. */
function x15Materials(M) {
  if (M.x15Skin) return M;
  // Bare Inconel X and steel: the ball-nose cone, the ball, sensor and hinge fittings.
  M.x15Metal = new THREE.MeshStandardMaterial({ name: 'x15-bare-inconel', color: 0xc2beb4, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.0 });
  M.x15MetalDark = new THREE.MeshStandardMaterial({ name: 'x15-metal-dark', color: 0x5d5b57, metalness: 0.9, roughness: 0.45 });
  M.x15Glass = new THREE.MeshPhysicalMaterial({ name: 'x15-glass', color: 0x2c3a3c, metalness: 0, roughness: 0.04, transmission: 0, opacity: 0.55, transparent: true, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 });
  M.x15Gear = new THREE.MeshStandardMaterial({ name: 'x15-gear-inconel', color: 0x9a9892, metalness: 0.95, roughness: 0.38 });
  // Tyres, and the matte black of the cockpit well and the rocket ports (one material: the
  // scene's budget is 200).
  M.x15Tyre = new THREE.MeshStandardMaterial({ name: 'x15-tyre', color: 0x1b1b1b, metalness: 0, roughness: 0.85 });
  // The nozzle's inside: heat-darkened, not black, with the long streaks NASM photographed.
  M.x15Nozzle = new THREE.MeshStandardMaterial({ name: 'x15-nozzle', color: 0x4a4038, metalness: 0.75, roughness: 0.62, side: THREE.DoubleSide });
  // The fuselage: one atlas (seams, rivets, bare panels, stencils); roughness in G and
  // metalness in B of one map, so the bare panels are metal and the paint is not.
  const skin = makeX15Skin({ uvAt: arcAt, perimeter: perimeterAt, level: levelPhi, decals: SKIN_DECALS });
  const coat = { metalness: 1.0, roughness: 1.0, clearcoat: 0.45, clearcoatRoughness: 0.24, envMapIntensity: 1.0 };
  M.x15Skin = new THREE.MeshPhysicalMaterial({ name: 'x15-skin', ...coat, map: skin.map, normalMap: skin.normalMap, normalScale: new THREE.Vector2(0.6, -0.6), roughnessMap: skin.ormMap, metalnessMap: skin.ormMap });
  const tile = makeX15SurfaceTile();
  M.x15Surface = new THREE.MeshPhysicalMaterial({ name: 'x15-surface', ...coat, map: tile.map, normalMap: tile.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: tile.ormMap, metalnessMap: tile.ormMap });
  return M;
}

// ---- Fuselage atlas coordinates ------------------------------------------------------------------
/**
 * Arc length round the fuselage section at station s and angle phi (degrees, 0 = top, 90 = the
 * left side, −Z): the same coordinate the skin's UVs carry, tabulated once. The sweep's arc
 * runs from the top towards +Z, the right side, so phi is turned round first.
 */
let ARC_TABLE = null;
function arcTable() {
  if (ARC_TABLE) return ARC_TABLE;
  const step = 0.025, rows = [];
  for (let s = -0.1; s <= 15.1 + 1e-9; s += step) {
    const sc = Math.min(Math.max(s, S_BALL), S_BASE);
    const pts = ring(sc, sc <= S_FAIR_END);
    const cum = [0];
    for (let k = 1; k <= pts.length; k++) cum.push(cum[k - 1] + pts[k % pts.length].distanceTo(pts[k - 1]));
    rows.push(cum);
  }
  return (ARC_TABLE = { step, rows });
}
function arcAt(s, phiDeg) {
  const { step, rows } = arcTable();
  const i = Math.min(rows.length - 2, Math.max(0, Math.floor((s + 0.1) / step)));
  const f = Math.min(1, Math.max(0, (s + 0.1) / step - i));
  const q = ((((360 - phiDeg) % 360) + 360) % 360) / 360 * N_AROUND, k = Math.min(N_AROUND - 1, Math.floor(q)), t = q - k;
  const at = (r) => r[k] + (r[k + 1] - r[k]) * t;
  return at(rows[i]) + (at(rows[i + 1]) - at(rows[i])) * f;
}
const perimeterAt = (s) => arcAt(s, 0.001);
/** Height above the FRL of the skin at station s, angle phi (degrees, either side). */
function skinHeight(s, phiDeg) {
  const sc = Math.min(Math.max(s, S_BALL), S_BASE), phi = phiDeg * D2R;
  return body(sc).yc + sectionRadius(sc, Math.abs(Math.sin(phi)), Math.cos(phi), sc <= S_FAIR_END) * Math.cos(phi);
}
/**
 * The angle at station s1 at the height the skin has at (s0, phi0), on the same side: the line
 * a stencil's baseline follows (painted level, not along a line of constant angle).
 */
function levelPhi(s0, phi0, s1) {
  const left = phi0 < 180, base = left ? phi0 : 360 - phi0, y = skinHeight(s0, base);
  let lo = 1, hi = 179;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (skinHeight(s1, m) > y) lo = m; else hi = m; }
  const m = (lo + hi) / 2;
  return left ? m : 360 - m;
}
/** The skin's UVs: (station, arc length), both in metres. The sweep gave (arc, distance). */
function stationUV(g) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, -p.getX(i), uv.getX(i));
  return g;
}

/**
 * The stencils, as photographed on 56-6670 (EC67-1652, NASM): station of the forward edge,
 * angle of the top (90 = left side, 270 = right), capital height (m). Positions ≈.
 */
const SKIN_DECALS = [];
for (const side of [90, 270]) {
  const L = side === 90, at = (phi) => (L ? phi : 360 - phi);
  SKIN_DECALS.push(
    { s: 9.1, phi: at(64), size: 0.30, lines: ['U.S. AIR FORCE'], color: '#ecebe6' },
    { s: 2.5, phi: at(66), size: 0.045, lines: ['U.S. AIR FORCE X-15', 'A.F. SERIAL NO. 56-6670'], color: '#e8e6dc', weight: 600 },
    { s: 3.12, phi: at(97), size: 0.06, lines: ['X15-1'], color: '#e8e6dc', weight: 600 },
    { s: 1.16, phi: at(78), size: 0.05, lines: ['BEWARE', 'OF BLAST'], color: '#b3261e', box: '#efeee8' },
    { s: 2.15, phi: at(94), size: 0.16, lines: [' '], color: '#000', arrow: '#e3b51d', arrowLength: 0.92, arrowHeight: 0.26 },
  );
}
// The rescue box is on the left side, under the canopy's external release.
SKIN_DECALS.push(
  { s: 3.24, phi: 68, size: 0.07, lines: ['RESCUE'], color: '#1a1a1a', box: '#e3b51d' },
  { s: 3.18, phi: 80, size: 0.042, lines: ['EMERGENCY ENTRANCE', 'CONTROL ON OTHER SIDE'], color: '#e3b51d', weight: 600 },
  { s: 3.3, phi: 284, size: 0.045, lines: ['DANGER', 'EJECTION', 'SEAT'], color: '#f2f0ea', triangle: '#c0261c' },
  { s: 10.6, phi: 112, size: 0.11, lines: ['APU', 'EXHAUST'], color: '#ecebe6' },
  { s: 12.4, phi: 120, size: 0.07, lines: ['H₂O₂ JETT'], color: '#ecebe6' },
  { s: 11.6, phi: 248, size: 0.06, lines: ['HYDROGEN PEROXIDE VENT'], color: '#ecebe6' },
  { s: 2.6, phi: 152, size: 0.032, lines: ['FWD JACKING POINT'], color: '#ecebe6', weight: 600 },
);

// ---- Fuselage ---------------------------------------------------------------------------------
const N_AROUND = 112;
function ring(s, withFairing, shrink = 0) {
  const { yc } = body(s);
  const pts = [];
  for (let k = 0; k < N_AROUND; k++) {
    const phi = (k / N_AROUND) * Math.PI * 2, dz = Math.sin(phi), dy = Math.cos(phi);
    const r = sectionRadius(s, dz, dy, withFairing) - shrink;
    pts.push(P(s, yc + r * dy, r * dz));
  }
  return pts;
}
function fuselageStations() {
  const out = new Set();
  const add = (a, b, step) => { for (let s = a; s < b - 1e-9; s += step) out.add(+s.toFixed(4)); };
  add(S_BALL, S_RING, 0.05); add(S_RING, 1.9, 0.08); add(1.9, 5.2, 0.07); add(5.2, 11.6, 0.2); add(11.6, S_FAIR_END, 0.12);
  for (const s of [S_RING, S_FAIR0, S_FAIR0 + 0.05, S_FAIR0 + 0.15, S_FAIR0 + 0.3, S_FAIR_END]) out.add(+s.toFixed(4));
  return [...out].filter(s => s >= S_BALL && s <= S_FAIR_END).sort((a, b) => a - b);
}

function buildFuselage(M) {
  const g = new THREE.Group();
  g.name = 'x15-fuselage';
  const axis = (x, y, z, c) => c.set(x, body(-x).yc, 0);
  // Forward and centre fuselage, with the side fairings, to their blunt ends.
  const secs = fuselageStations().map(s => [ring(s, true)]);
  const fwd = stationUV(orientOutward(sweep(secs, [true]), axis));
  g.add(mesh(fwd, M.x15Skin, { name: 'x15-fuselage-skin' }));
  // The fairings' blunt ends: from the section with the fairings to the body alone.
  {
    const a = ring(S_FAIR_END, true), b = ring(S_FAIR_END, false);
    const step = sweep([[a], [b]], [true]);
    for (let i = 0; i < step.attributes.normal.count; i++) step.attributes.normal.setXYZ(i, -1, 0, 0);
    g.add(mesh(orientBack(step), M.x15Surface, { name: 'x15-fairing-base' }));
  }
  // Aft body: the boat-tail to the base.
  const aft = [];
  for (let s = S_FAIR_END; s <= S_BASE + 1e-9; s += 0.08) aft.push([ring(Math.min(s, S_BASE), false)]);
  g.add(mesh(stationUV(orientOutward(sweep(aft, [true]), axis)), M.x15Skin, { name: 'x15-aft-fuselage' }));
  // Base: an annulus from the boat-tail's edge to the nozzle exit.
  {
    const outer = ring(S_BASE, false), rN = X15.xlr99.exitDiameter / 2 + 0.02, yc = body(S_BASE).yc;
    const inner = outer.map((_, k) => { const phi = (k / N_AROUND) * Math.PI * 2; return P(S_BASE, yc + rN * Math.cos(phi), rN * Math.sin(phi)); });
    const baseG = sweep([[outer], [inner]], [true]);
    for (let i = 0; i < baseG.attributes.normal.count; i++) baseG.attributes.normal.setXYZ(i, -1, 0, 0);
    g.add(mesh(orientBack(baseG), M.x15MetalDark, { name: 'x15-base' }));
  }
  // Ball nose: the hemisphere ahead of the cone, and the bare-metal cone to the riveted ring.
  {
    const R = NOSE.ballRadius;
    const ball = new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    ball.rotateZ(-Math.PI / 2);  // the dome's pole (+Y) turned to +X, forward
    g.add(mesh(ball, M.x15Metal, { name: 'x15-ball-nose', position: [-S_BALL, 0, 0] }));
    const cone = [];
    for (let s = S_BALL; s <= S_RING + 1e-9; s += 0.04) cone.push([ring(Math.min(s, S_RING), false, -0.0015)]);
    g.add(mesh(orientOutward(sweep(cone, [true]), axis), M.x15Metal, { name: 'x15-nose-cone' }));
    // The riveted ring where the bare cone meets the painted skin.
    const r = body(S_RING);
    const band = new THREE.TorusGeometry((r.a + r.b) / 2 + 0.004, 0.006, 8, 96);
    band.rotateY(Math.PI / 2);
    g.add(mesh(band, M.x15Metal, { name: 'x15-nose-ring', position: [-S_RING, r.yc, 0] }));
  }
  return g;
}
/** Winds a cap-like strip whose normals were set to −X so its faces look aft. */
function orientBack(g) {
  const p = g.attributes.position, ix = g.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let score = 0;
  for (let i = 0; i < ix.length; i += 3) {
    a.fromBufferAttribute(p, ix[i]); b.fromBufferAttribute(p, ix[i + 1]); c.fromBufferAttribute(p, ix[i + 2]);
    score += b.sub(a).cross(c.sub(a)).x;
  }
  if (score > 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  return g;
}

// ---- Canopy ------------------------------------------------------------------------------------
/**
 * The canopy: a V windshield of two flat panes meeting on a centre post, then a rounded roof
 * that runs down into the spine. Section: an inverted V over the windshield, a superellipse
 * behind it, seated on the body's own surface. Its top line and plan are traced (figure 2);
 * the section between them is reconstructed from NASM's photographs of 56-6670 (≈).
 */
const S_CAN0 = 2.05, S_CAN1 = 5.0, S_WIN1 = 2.9;
function canopySection(s, nU = 24) {
  const hw = Math.max(0.004, canHalf(s)), H = canTop(s);
  const m = s < S_WIN1 ? 1 : Math.min(2.6, 1 + 1.6 * (s - S_WIN1) / 0.4);
  const pts = [];
  for (let i = 0; i <= nU; i++) {
    const u = -1 + 2 * i / nU, z = hw * u;
    const base = bodyTopAt(s, z) - 0.02;
    const ap = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), m)), 1 / m);
    pts.push(P(s, base + Math.max(0, H - base) * ap, z));
  }
  return pts;
}
function buildCanopy(M) {
  const g = new THREE.Group();
  g.name = 'x15-canopy';
  const secs = [];
  for (let s = S_CAN0; s <= S_CAN1 + 1e-9; s += 0.05) secs.push([canopySection(Math.min(s, S_CAN1))]);
  const shell = sweep(secs);
  orientOutward(shell, (x, y, z, c) => c.set(x, bodyTopAt(-x, 0) - 0.2, 0));
  // Closed at the back, where it runs down into the spine.
  const last = secs[secs.length - 1][0];
  const rear = cap(last, V(-1, 0, 0));
  g.add(mesh(mergeAll([shell, rear].map(geometry => ({ geometry }))), M.x15Surface, { name: 'x15-canopy-shell' }));
  // The two windshield panes: the flat faces of the V between the frame, 4 mm proud.
  for (const side of [-1, 1]) {
    const rows = [];
    for (let s = 2.2; s <= 2.86 + 1e-9; s += 0.033) {
      const sec = canopySection(s, 40);
      const lo = side > 0 ? 22 : 3, hi = side > 0 ? 37 : 18;
      rows.push([sec.slice(lo, hi + 1)]);
    }
    const pane = sweep(rows);
    orientOutward(pane, (x, y, z, c) => c.set(x, bodyTopAt(-x, 0) - 0.2, 0));
    const n = pane.attributes.normal, p = pane.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * 0.004, p.getY(i) + n.getY(i) * 0.004, p.getZ(i) + n.getZ(i) * 0.004);
    g.add(mesh(pane, M.x15Glass, { name: side > 0 ? 'x15-windshield-r' : 'x15-windshield-l', castShadow: false }));
  }
  // The dark cockpit behind the glass.
  const inner = [];
  for (let s = 2.15; s <= 2.95; s += 0.05) inner.push([canopySection(s, 24).map(q => q.clone().add(V(0, -0.08, 0)).multiply(V(1, 1, 0.8)))]);
  g.add(mesh(sweep(inner), M.x15Tyre, { name: 'x15-cockpit-well', castShadow: false }));
  return g;
}

// ---- Wing --------------------------------------------------------------------------------------
const Y_EXPOSED = STATIONS.fairingHalfWidth;             // exposed root at the fairing's edge
const FLAP_OUT = Y_EXPOSED + X15.wing.flap.span;          // 2.489 m
/** The flaps hinge on a line square to the fuselage (0° sweep): the station that gives the
 *  published 2.61 ft inboard flap chord at the exposed root. */
const S_HINGE = WING.le(Y_EXPOSED) + WING.chord(Y_EXPOSED) - X15.wing.flap.inboardChord;
function wingSection(y, from, to, n = 34) {
  const le = WING.le(y), c = WING.chord(y);
  const f = Math.min(1, Math.max(0, (y - Y_EXPOSED) / (WING.semispan - Y_EXPOSED)));
  const xs = chordStations(n, from, to);
  const upper = xs.map(x => P(le + x * c, WING_T(x, f) * c, y));
  const lower = xs.map(x => P(le + x * c, -WING_T(x, f) * c, y));
  return { upper, lower, le, c, f };
}
function buildWing(M, side) {
  const g = new THREE.Group();
  g.name = side > 0 ? 'x15-wing-right' : 'x15-wing-left';
  const mirror = (geo) => (side < 0 ? mirrorZ(geo) : geo);
  // Inboard: from inside the fairing to the flap's outer end, cut at the hinge line.
  const inb = [], outb = [];
  const hingeFrac = (y) => (S_HINGE - WING.le(y)) / WING.chord(y);
  for (const y of [0.85, Y_EXPOSED, 1.35, 1.6, 1.85, 2.1, 2.3, FLAP_OUT]) {
    const w = wingSection(y, 0, hingeFrac(y));
    inb.push([[...w.upper].reverse().concat(w.lower.slice(1))]);
  }
  const skin = [];
  const inboard = sweep(inb);
  orientOutward(inboard, (x, yy, z, c) => c.set(x, 0, z));
  skin.push(inboard);
  // Hinge face (the flap cove's forward wall).
  {
    const rows = [];
    for (const y of [0.85, Y_EXPOSED, 1.6, 2.1, FLAP_OUT]) {
      const w = wingSection(y, 0, hingeFrac(y));
      rows.push([[w.upper[w.upper.length - 1], w.lower[w.lower.length - 1]]]);
    }
    const face = sweep(rows);
    orientOutward(face, (x, yy, z, c) => c.set(x + 1, 0, z));
    skin.push(face);
  }
  // Outboard, full chord to the tip.
  const ys = [FLAP_OUT, 2.7, 2.9, 3.1, 3.25, WING.semispan];
  for (const y of ys) {
    const w = wingSection(y, 0, 1);
    outb.push([[...w.upper].reverse().concat(w.lower.slice(1))]);
  }
  const outboard = sweep(outb);
  orientOutward(outboard, (x, yy, z, c) => c.set(x, 0, z));
  skin.push(outboard);
  // Blunt trailing edge (1 % of chord thick) of the outboard wing.
  {
    const rows = ys.map(y => { const w = wingSection(y, 0, 1); return [[w.upper[w.upper.length - 1], w.lower[w.lower.length - 1]]]; });
    const te = sweep(rows);
    orientOutward(te, (x, yy, z, c) => c.set(x + 1, 0, z));
    skin.push(te);
  }
  // Side wall where the flap cut-out meets the outboard wing, and the tip.
  {
    const w = wingSection(FLAP_OUT, hingeFrac(FLAP_OUT), 1, 14);
    skin.push(cap([...w.upper, ...[...w.lower].reverse()], V(0, 0, -1)));
    const t = wingSection(WING.semispan, 0, 1);
    skin.push(cap([...t.upper, ...[...t.lower].reverse().slice(0, -1)], V(0, 0, 1)));
  }
  g.add(mesh(mirror(mergeAll(skin.map(geometry => ({ geometry })))), M.x15Surface, { name: side > 0 ? 'x15-wing-r' : 'x15-wing-l' }));

  // Flap: its own part, hinged on the fixed line for the flight model to turn.
  {
    const flap = new THREE.Group();
    flap.name = side > 0 ? 'x15-flap-r' : 'x15-flap-l';
    const rows = [];
    for (const y of [Y_EXPOSED + 0.005, 1.6, 2.1, FLAP_OUT - 0.005]) {
      const w = wingSection(y, hingeFrac(y), 1, 12);
      rows.push([[...w.upper].reverse().concat(w.lower.slice(1))]);
    }
    const parts = [sweep(rows)];
    orientOutward(parts[0], (x, yy, z, c) => c.set(x, 0, z));
    for (const [y, dir] of [[Y_EXPOSED + 0.005, -1], [FLAP_OUT - 0.005, 1]]) {
      const w = wingSection(y, hingeFrac(y), 1, 12);
      parts.push(cap([...w.upper, ...[...w.lower].reverse()], V(0, 0, dir)));
    }
    const te = sweep([Y_EXPOSED + 0.005, FLAP_OUT - 0.005].map(y => { const w = wingSection(y, hingeFrac(y), 1, 12); return [[w.upper[w.upper.length - 1], w.lower[w.lower.length - 1]]]; }));
    orientOutward(te, (x, yy, z, c) => c.set(x + 1, 0, z));
    parts.push(te);
    const geo = mirror(mergeAll(parts.map(geometry => ({ geometry }))));
    // Pivot on the hinge line: the geometry is moved so the group's origin is on it.
    geo.translate(S_HINGE, 0, 0);
    const m = mesh(geo, M.x15Surface, { name: `${flap.name}-skin` });
    flap.add(m);
    flap.position.set(-S_HINGE, 0, 0);
    flap.userData.hinge = { axis: [0, 0, side > 0 ? 1 : -1], range: [0, X15.wing.flap.deflection] };
    g.add(flap);
  }
  // Wing-tip pod (late experiment pods on 56-6670, NASM photographs; sized ≈).
  {
    const podS = WING.le(WING.semispan) + TIP_POD.front + TIP_POD.length / 2;
    const pod = new THREE.CapsuleGeometry(TIP_POD.radius, TIP_POD.length - 2 * TIP_POD.radius, 10, 28);
    pod.rotateZ(Math.PI / 2);
    g.add(mesh(pod, M.x15Metal, { name: side > 0 ? 'x15-tip-pod-r' : 'x15-tip-pod-l', position: [-podS, 0, side * (WING.semispan + TIP_POD.radius * 0.6)] }));
  }
  return g;
}

// ---- Horizontal tails -----------------------------------------------------------------------------
/**
 * All-moving, −15° anhedral, their planform in the surface's own plane (data/x15.js). The
 * surface passes through the FRL on the centre line, which puts the exposed root 0.28 m below
 * it, inside the side fairing (≈). Pivot: a spanwise spindle at 40 % of the exposed root chord
 * (≈; not published).
 */
function buildHTail(M, side) {
  const g = new THREE.Group();
  g.name = side > 0 ? 'x15-hstab-r' : 'x15-hstab-l';
  const an = -X15.htail.dihedral * D2R;   // 15° down
  const toAir = (s, e, t) => P(s, -e * Math.sin(an) + t * Math.cos(an), side * (e * Math.cos(an) + t * Math.sin(an)));
  const sec = (e, n = 30) => {
    const le = HTAIL.le(e), c = HTAIL.chord(e);
    const f = Math.min(1, Math.max(0, (e - HTAIL_EXPOSED_ROOT) / (HTAIL.semispan - HTAIL_EXPOSED_ROOT)));
    const xs = chordStations(n);
    return { up: xs.map(x => toAir(le + x * c, e, HT_T(x, f) * c)), lo: xs.map(x => toAir(le + x * c, e, -HT_T(x, f) * c)) };
  };
  const es = [0.8, HTAIL_EXPOSED_ROOT, 1.4, 1.8, 2.2, 2.55, HTAIL.semispan];
  const skin = sweep(es.map(e => { const q = sec(e); return [[...q.up].reverse().concat(q.lo.slice(1))]; }));
  const centre = (x, y, z, c) => c.set(x, -Math.abs(z) * Math.tan(an), z);
  orientOutward(skin, centre);
  const te = sweep(es.map(e => { const q = sec(e); return [[q.up[q.up.length - 1], q.lo[q.lo.length - 1]]]; }));
  orientOutward(te, (x, y, z, c) => c.set(x + 1, y, z));
  const q = sec(HTAIL.semispan);
  const tip = cap([...q.up, ...[...q.lo].reverse().slice(0, -1)], V(0, -Math.sin(an), side * Math.cos(an)));
  const geo = mergeAll([skin, te, tip].map(geometry => ({ geometry })));
  // Pivot.
  const pe = HTAIL_EXPOSED_ROOT, ps = HTAIL.le(pe) + 0.4 * HTAIL.chord(pe);
  const pivot = toAir(ps, pe, 0);
  geo.translate(-pivot.x, -pivot.y, -pivot.z);
  g.add(mesh(geo, M.x15Surface, { name: `${g.name}-skin` }));
  g.position.copy(pivot);
  g.userData.hinge = { axis: [0, -Math.sin(an) * 0, side], range: [-X15.htail.down, X15.htail.up] };
  return g;
}

// ---- Vertical tails and speed brakes -------------------------------------------------------------
/**
 * 10° full-wedge sections: sharp leading edge, sides straight to a blunt base as thick as
 * 2·c·tan 5°. LE swept 30°, TE square (TM X-236 figure 2). The outer panel of each fin is the
 * rudder, the whole chord turning; the inner panel is fixed and carries the speed brakes, two
 * side panels hinged at their forward edges on its aft 3.36 ft (TN D-3343).
 */
const WEDGE = Math.tan(5 * D2R);
function finSection(fin, h, sign, fromX = 0) {
  // h: height above the fin's root line (along the span), sign: +1 up, −1 down.
  const le = fin.rootLE + h * Math.tan(STATIONS.finLESweep * D2R);
  const te = fin.rootLE + fin.rootChord;
  const y = sign * (fin.rootY + h);
  const x0 = Math.max(le, fromX);
  const n = 10;
  const pts = (side) => Array.from({ length: n + 1 }, (_, i) => {
    const s = x0 + (te - x0) * i / n;
    const t = Math.max(0.0015, (s - le) * WEDGE);
    return P(s, y, side * t);
  });
  return { l: pts(1), r: pts(-1), le, te, y };
}
function buildFin(M, fin, sign, name) {
  const g = new THREE.Group();
  g.name = name;
  const y0 = -0.12;                                  // root buried in the fuselage
  const hSplit = STATIONS.rudderBoundary - fin.rootY; // fixed panel / rudder
  const sbFwd = fin.rootLE + fin.rootChord - X15.speedBrake.chord;
  const faces = (hs, from, part) => {
    const secs = hs.map(h => { const q = finSection(fin, h, sign, from); return [q.l, q.r]; });
    const sides = sweep(secs, [], (x, y, z, c) => c.set(x, y, 0));
    const base = sweep(hs.map(h => { const q = finSection(fin, h, sign, from); return [[q.l[q.l.length - 1], q.r[q.r.length - 1]]]; }));
    orientOutward(base, (x, y, z, c) => c.set(x + 1, y, z));
    const out = [sides, base];
    if (part === 'tip' || part === 'split-top' || part === 'split-bottom') {
      const h = part === 'split-bottom' ? hs[0] : hs[hs.length - 1];
      const q = finSection(fin, h, sign, from);
      out.push(cap([...q.l, ...[...q.r].reverse()], V(0, (part === 'split-bottom' ? -1 : 1) * sign, 0)));
    }
    return out;
  };
  // Fixed panel, forward of the speed brakes.
  g.add(mesh(mergeAll(faces([y0, hSplit * 0.5, hSplit], 0, 'split-top').map(geometry => ({ geometry }))), sign > 0 ? M.x15Surface : M.x15Metal, { name: `${name}-fixed` }));
  if (sign > 0) for (const d of finSerial(M, fin)) g.add(d);
  // Speed brakes: the fixed panel's aft sides, closed. Each panel is its own part, hinged at
  // its forward edge (up to 35° out).
  for (const side of [1, -1]) {
    const pan = new THREE.Group();
    pan.name = `${name}-speedbrake-${side > 0 ? 'r' : 'l'}`;
    const secs = [0.02, hSplit - 0.01].map(h => {
      const q = finSection(fin, h, sign, sbFwd);
      const edge = side > 0 ? q.l : q.r;
      return [edge.map(p => p.clone().add(V(0, 0, side * 0.003)))];
    });
    const plateG = sweep(secs);
    orientOutward(plateG, (x, y, z, c) => c.set(x, y, 0));
    const hinge = finSection(fin, 0, sign, sbFwd)[side > 0 ? 'l' : 'r'][0];
    plateG.translate(-hinge.x, 0, -hinge.z);
    pan.add(mesh(plateG, M.x15Surface, { name: `${pan.name}-panel` }));
    pan.position.set(hinge.x, 0, hinge.z);
    pan.userData.hinge = { axis: [0, sign, 0], range: [0, X15.speedBrake.deflection] };
    g.add(pan);
  }
  // Rudder: the outer panel, the whole chord, on a vertical spindle (≈ at 40 % of its root chord).
  {
    const rud = new THREE.Group();
    rud.name = `${name}-rudder`;
    const hTip = fin.span;
    const geo = mergeAll(faces([hSplit + 0.004, (hSplit + hTip) / 2, hTip], 0, 'tip')
      .concat(faces([hSplit + 0.004, hSplit + 0.01], 0, 'split-bottom').slice(2)).map(geometry => ({ geometry })));
    const q = finSection(fin, hSplit, sign);
    const px = -(q.le + 0.4 * (q.te - q.le));   // X = −station: 40 % of the chord aft of the LE
    geo.translate(-px, 0, 0);
    rud.add(mesh(geo, M.x15Surface, { name: `${rud.name}-skin` }));
    rud.position.set(px, 0, 0);
    rud.userData.hinge = { axis: [0, 1, 0], range: [-X15.upperFin.deflection, X15.upperFin.deflection] };
    g.add(rud);
  }
  return g;
}

/**
 * The serial on both sides of the upper fin's fixed panel, white, just under the rudder's joint
 * (EC67-1652; the band at the tip carries an agency name and stays off, as the brief asks).
 * Figures ≈0.32 m high from 0.79 to 1.10 m above the FRL, from 10 % to 55 % of the chord, read
 * off the photograph against the rudder's published height (≈). Each is a flat card tilted 5°
 * to lie on the wedge's side, 2 mm off it.
 */
const FIN_SERIAL = { text: '66670', centre: 0.945, figures: 0.32, from: 0.10, to: 0.55 };
function finSerial(M, fin) {
  const h = FIN_SERIAL.centre - fin.rootY;
  const q = finSection(fin, h, 1);
  const c = q.te - q.le;
  const sc = q.le + (FIN_SERIAL.from + FIN_SERIAL.to) / 2 * c;
  const ph = FIN_SERIAL.figures / 0.86, pw = (FIN_SERIAL.to - FIN_SERIAL.from) * c;
  if (!M.x15Serial) {
    const map = makeX15Decal(FIN_SERIAL.text, { w: Math.round(256 * pw / ph), h: 256, color: '#ecebe6', fill: true });
    M.x15Serial = new THREE.MeshStandardMaterial({ name: 'x15-fin-serial', map, transparent: true, alphaTest: 0.35, metalness: 0, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  }
  const out = [];
  for (const side of [1, -1]) {
    const geo = new THREE.PlaneGeometry(pw, ph);
    const tilt = Math.atan(WEDGE);
    geo.rotateY(side > 0 ? tilt : Math.PI - tilt);
    const z = side * ((sc - q.le) * WEDGE + 0.002);
    out.push(mesh(geo, M.x15Serial, { name: `x15-fin-serial-${side > 0 ? 'r' : 'l'}`, position: [-sc, FIN_SERIAL.centre, z], castShadow: false }));
  }
  return out;
}

// ---- XLR99 nozzle -----------------------------------------------------------------------------------
/** 39.3 in exit (SP-60), 9.8 area ratio: a 12.6 in throat; a 20° conical expansion (NASA). */
function buildNozzle(M) {
  const g = new THREE.Group();
  g.name = 'x15-xlr99-nozzle';
  const re = X15.xlr99.exitDiameter / 2, rt = re / Math.sqrt(X15.xlr99.areaRatio);
  const L = (re - rt) / Math.tan(20 * D2R);
  const yc = body(S_BASE).yc;
  const prof = [];
  const n = 24;
  for (let i = 0; i <= n; i++) { const u = i / n; prof.push(new THREE.Vector2(rt + (re - rt) * u, L * u)); }
  // A short converging section ahead of the throat, into the chamber.
  prof.unshift(new THREE.Vector2(rt * 1.35, -0.14), new THREE.Vector2(rt * 1.08, -0.05));
  const geo = new THREE.LatheGeometry(prof, 64);
  geo.rotateZ(Math.PI / 2);    // lathe axis Y → X, opening aft (−X)
  geo.scale(-1, 1, 1);
  g.add(mesh(geo, M.x15Nozzle, { name: 'x15-nozzle-bell', position: [-(S_BASE - L - 0.005), yc, 0] }));
  const lip = new THREE.TorusGeometry(re + 0.008, 0.012, 8, 96);
  lip.rotateY(Math.PI / 2);
  g.add(mesh(lip, M.x15MetalDark, { name: 'x15-nozzle-lip', position: [-S_BASE + 0.004, yc, 0] }));
  g.userData.exit = { station: S_BASE, radius: re, throat: rt, length: L };
  return g;
}

// ---- Landing gear -------------------------------------------------------------------------------------
/**
 * Nose: a dual, corotating pair of 18 × 4.4 in tyres on an oleo strut under the nose, well
 * forward (TM X-207). Main: two cantilevered Inconel legs from trunnions on the aft fuselage's
 * sides to 3 ft × 6 in steel skids, a drag brace from the fuselage to each skid ahead of its
 * pivot (TM X-207 figure 3). Strut diameters, the trunnion stations and the brace are
 * reconstructed from those drawings (≈).
 *
 * @param groundY  height of the ground below the FRL at the nose wheel and at the skids, in
 *                 the airframe frame (both negative)
 */
function buildGear(M, groundNose, groundSkid, pitch) {
  const g = new THREE.Group();
  g.name = 'x15-landing-gear';
  // Nose gear.
  {
    const ng = new THREE.Group(); ng.name = 'x15-nose-gear';
    const s = GEAR.noseStation, rr = X15.gear.noseRollingRadius, R = X15.gear.noseTyreDiameter / 2, w = X15.gear.noseTyreWidth;
    const axleY = groundNose + rr;
    const topY = -keel(s) + 0.05;
    // Read off the close-up of EC67-1652, scaled by the 18 in tyre (≈): a 104 mm oleo cylinder
    // with three grooves down to 0.2 m over the axle, a chrome piston into an axle yoke, a
    // torque link on its forward side, and a door hanging transversely aft of the wheels.
    const xs = -s + 0.03, cylBot = axleY + 0.2;
    const parts = [];
    parts.push({ geometry: new THREE.CylinderGeometry(0.052, 0.052, topY - cylBot, 20), matrix: mat4([xs, (topY + cylBot) / 2, 0]) });
    parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), matrix: mat4([xs, topY - 0.025, 0]) });   // trunnion collar
    const yoke = new THREE.BoxGeometry(0.1, 0.1, 0.12);
    parts.push({ geometry: yoke, matrix: mat4([-s + 0.01, axleY + 0.04, 0]) });
    const axle = new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12);
    parts.push({ geometry: axle, matrix: mat4([-s, axleY, 0], [Math.PI / 2, 0, 0]) });
    ng.add(mesh(mergeAll(parts), M.x15Gear, { name: 'x15-nose-strut' }));
    const piston = new THREE.CylinderGeometry(0.034, 0.034, cylBot - axleY - 0.05, 16);
    ng.add(mesh(piston, M.x15Metal, { name: 'x15-nose-piston', position: [xs, (cylBot + axleY + 0.05) / 2, 0] }));
    const grooves = [];
    for (let k = 1; k <= 3; k++) grooves.push({ geometry: new THREE.TorusGeometry(0.0525, 0.004, 6, 32), matrix: mat4([xs, cylBot + k * 0.05, 0], [Math.PI / 2, 0, 0]) });
    ng.add(mesh(mergeAll(grooves), M.x15MetalDark, { name: 'x15-nose-oleo-grooves', castShadow: false }));
    // Torque link: two arms meeting ahead of the piston.
    {
      const top = V(xs + 0.05, cylBot + 0.01, 0), apex = V(xs + 0.12, (cylBot + axleY) / 2 + 0.03, 0), bot = V(-s + 0.06, axleY + 0.07, 0);
      const arms = [[top, apex], [apex, bot]].map(([a, b]) => {
        const d = b.clone().sub(a), geo = new THREE.BoxGeometry(0.03, d.length(), 0.05);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
        return { geometry: geo, matrix: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)) };
      });
      ng.add(mesh(mergeAll(arms), M.x15Gear, { name: 'x15-nose-torque-link' }));
    }
    // Door: a plate across the bay aft of the wheels, open, its lower edge swung aft.
    {
      const sd = s + R + 0.04, top = -keel(sd) + 0.02, len = 0.38;
      const door = new THREE.BoxGeometry(0.008, len, 0.3);
      door.translate(0, -len / 2, 0);
      ng.add(mesh(door, M.x15Surface, { name: 'x15-nose-gear-door', position: [-sd, top, 0], rotation: [0, 0, -13 * D2R] }));
    }
    for (const z of [-0.105, 0.105]) {
      const tyre = new THREE.TorusGeometry(R - w * 0.42, w * 0.42, 14, 40);
      ng.add(mesh(tyre, M.x15Tyre, { name: 'x15-nose-tyre', position: [-s, axleY, z] }));
      const hub = new THREE.CylinderGeometry(R - w * 0.7, R - w * 0.7, w * 0.8, 28);
      hub.rotateX(Math.PI / 2);
      ng.add(mesh(hub, M.x15Gear, { name: 'x15-nose-hub', position: [-s, axleY, z] }));
      // The wheel's boss and its five spokes, standing proud of the outer face.
      const face = Math.sign(z) * w * 0.4, spokes = [];
      const boss = new THREE.CylinderGeometry(0.035, 0.04, 0.03, 16); boss.rotateX(Math.PI / 2);
      spokes.push({ geometry: boss, matrix: mat4([-s, axleY, z + face]) });
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2, rs = (R - w * 0.7) * 0.55;
        spokes.push({ geometry: new THREE.BoxGeometry(0.032, (R - w * 0.7) * 0.9, 0.02), matrix: mat4([-s + Math.sin(a) * rs, axleY + Math.cos(a) * rs, z + face], [0, 0, -a]) });
      }
      ng.add(mesh(mergeAll(spokes), M.x15Metal, { name: 'x15-nose-wheel-spokes' }));
    }
    g.add(ng);
  }
  // Main gear.
  const sk = GEAR.skidStation, half = GEAR.tread / 2;
  for (const side of [1, -1]) {
    const mg = new THREE.Group(); mg.name = `x15-main-gear-${side > 0 ? 'r' : 'l'}`;
    const L = X15.gear.skidLength, W = X15.gear.skidWidth;
    // Skid: a steel channel, 3 ft long, its nose turned up.
    {
      const outline = [[-L / 2, 0], [L / 2 - 0.12, 0], [L / 2, 0.09], [L / 2 - 0.02, 0.1], [-L / 2, 0.05]];
      const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
      const skid = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
      skid.translate(0, 0, -W / 2);
      mg.add(mesh(skid, M.x15MetalDark, { name: 'x15-skid', position: [-sk, groundSkid, side * half], rotation: [0, 0, pitch] }));
    }
    // Leg: from a trunnion on the fuselage side, down, out and aft to the skid's pivot.
    const trunnion = P(sk - 0.55, -0.35, side * 0.64);
    const pivot = P(sk + 0.05, groundSkid + 0.1, side * half);
    const legDir = pivot.clone().sub(trunnion);
    const leg = new THREE.CylinderGeometry(0.05, 0.065, legDir.length(), 16);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), legDir.clone().normalize());
    mg.add(mesh(leg, M.x15Gear, { name: 'x15-main-leg', matrix: new THREE.Matrix4().compose(trunnion.clone().add(pivot).multiplyScalar(0.5), q, V(1, 1, 1)) }));
    // Drag brace from the fuselage to the skid ahead of the pivot.
    const bTop = P(sk - 1.2, -0.52, side * 0.55), bBot = P(sk - 0.28, groundSkid + 0.07, side * half);
    const bDir = bBot.clone().sub(bTop);
    const brace = new THREE.CylinderGeometry(0.018, 0.018, bDir.length(), 10);
    const qb = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), bDir.clone().normalize());
    mg.add(mesh(brace, M.x15Gear, { name: 'x15-drag-brace', matrix: new THREE.Matrix4().compose(bTop.clone().add(bBot).multiplyScalar(0.5), qb, V(1, 1, 1)) }));
    g.add(mg);
  }
  return g;
}

// ---- Reaction-control ports ----------------------------------------------------------------------------
/** The nose's pitch and yaw rockets: paired ports in bare-metal panels just aft of the ring, as
 *  on 56-6670 (NASM); two independent systems, so two ports per direction (TN D-2864). */
function buildRcsPorts(M) {
  const parts = [];
  const s = S_RING + 0.2, b = body(s);
  for (const [dz, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const off of [-0.045, 0.045]) {
      const r = 1 / Math.sqrt((dz / b.b) ** 2 + (dy / b.a) ** 2);
      const c = P(s + off, b.yc + dy * r, dz * r);
      const port = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(0, dy, dz));
      parts.push({ geometry: port, matrix: new THREE.Matrix4().compose(c, q, V(1, 1, 1)) });
    }
  }
  return mesh(mergeAll(parts), M.x15Tyre, { name: 'x15-rcs-nose-ports', castShadow: false });
}

// ---- Assembly ----------------------------------------------------------------------------------------------
/** The airframe alone, in its own frame (FRL at y = 0, nose apex at the origin, X forward). */
export function buildX15Airframe(M, { ventral = false } = {}) {
  x15Materials(M);
  const air = new THREE.Group();
  air.name = 'x15-airframe';
  air.add(buildFuselage(M));
  air.add(buildCanopy(M));
  air.add(buildWing(M, 1), buildWing(M, -1));
  air.add(buildHTail(M, 1), buildHTail(M, -1));
  air.add(buildFin(M, UPPER_FIN, 1, 'x15-upper-fin'));
  const lower = buildFin(M, LOWER_FIN, -1, 'x15-lower-fin');
  // The ventral is the lower fin's rudder, jettisoned before every landing: on the ground it
  // is not there at all (it would hang half a metre below the skids).
  const ventralPart = lower.getObjectByName('x15-lower-fin-rudder');
  ventralPart.name = 'x15-ventral';
  if (!ventral) lower.remove(ventralPart);
  air.add(lower);
  air.add(buildNozzle(M));
  air.add(buildRcsPorts(M));
  return air;
}

/** Ground attitude: the FRL's pitch that puts the upper fin tip at the manual's 11 ft 6 in. */
const groundPitch = groundAttitude;

/**
 * The exhibit: the airframe on its gear, landing configuration. The group's origin is on the
 * ground under the middle of the airplane; +X local is forward.
 */
export function buildX15(M) {
  x15Materials(M);
  const root = new THREE.Group();
  root.name = 'x15';
  const th = groundPitch();
  const air = buildX15Airframe(M, { ventral: false });
  // Ground below the FRL, in the airframe frame, at the nose wheel and at the skids.
  const gN = -GEAR.noseFRLHeight, gS = -(GEAR.noseFRLHeight + (GEAR.skidStation - GEAR.noseStation) * Math.tan(th));
  air.add(buildGear(M, gN, gS, th));
  // Pitch nose-down about the nose-wheel contact point, then set that point on the ground.
  const pivot = P(GEAR.noseStation, gN, 0);
  const holder = new THREE.Group();
  holder.name = 'x15-on-gear';
  holder.rotation.z = -th;
  air.position.copy(pivot).negate();
  holder.add(air);
  // The airplane's middle over the origin: the nose-wheel contact sits that far forward of it.
  holder.position.set((NOSE.tip + STATIONS.apexToBase) / 2 - GEAR.noseStation, 0, 0);
  root.add(holder);
  root.userData.height = X15.landingHeight;
  root.userData.groundPitchDeg = th / D2R;
  root.userData.annotations = [
    { label: 'Ball nose · flow-direction sensor', position: [7.4, 1.1, 0] },
    { label: 'Canopy · two flat windshield panes', position: [4.8, 1.75, 0] },
    { label: 'Side fairing · propellant lines and cables', position: [0.5, 1.25, 1.25] },
    { label: 'All-moving horizontal tail · −15° anhedral', position: [-5.8, 0.45, 2.7] },
    { label: 'Speed brakes · on the fixed fin panels', position: [-6.6, 2.35, 0.35] },
    { label: 'XLR99 nozzle · 39.3 in', position: [-7.8, 1.35, 0] },
    { label: 'Steel skids · 3 ft × 6 in', position: [-5.9, 0.25, 1.6] },
    { label: 'Ventral jettisoned before landing', position: [-6.3, 0.2, 0] },
  ];
  return root;
}
