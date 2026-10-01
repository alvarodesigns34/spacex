/**
 * F-16A Block 15 Fighting Falcon, at 1:1, on its gear on the apron of its runway.
 *
 * Built from NASA's published geometry (data/f16.js has every figure and its source): the wing,
 * the horizontal and vertical tails and the ventral fins from the F-16C wind-tunnel model's table
 * of TP-3355 (1/15 scale), their sections the NACA 64A204 (the 64A006 thickness form of TN-1368
 * scaled to 4 %) and biconvex; the fuselage's lines traced on that model's dimensioned three-view
 * (TP-3355 figure 2, ≈ ±5 cm); the weight and the control limits of TP-1538. What no NASA source
 * gives is reconstructed and marked: the cross-sections between the traced lines, the canopy's
 * section, the cockpit, the inlet duct, the nozzle's petals, the speed brakes, the gear (from the
 * widely published wheelbase, track and tyres, ≈) and the wing-tip launchers.
 *
 * Frame: X forward (X = −s, s metres aft of the nose probe's tip), Y up from the ground the
 * airplane stands on, Z to the right (X × Y). Moving surfaces are their own hinged groups, named
 * for the flight model: f16-lef-l/r, f16-flaperon-l/r, f16-stab-l/r, f16-rudder,
 * f16-speedbrake-*, f16-landing-gear.
 */
import * as THREE from 'three';
import { mergeAll, curve, mesh } from '../geometry/utils.js';
import { WING, HTAIL, FIN, VENTRAL, LINES, GEAR, NACA_64A006, OVERALL } from '../data/f16.js';
import { makeF16Skin, makeF16SurfaceTile, FS_COLOURS, SKIN_LEN } from '../materials/f16Textures.js';

const D2R = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Airplane coordinates (s aft, z up from the waterline, y right) → model (X fwd, Y up, Z right). */
const GROUND = -OVERALL.groundWL;
const P = (s, z, y) => V(-s, z + GROUND, y);

const top = curve(LINES.top), foreBottom = curve(LINES.bottom), intakeBottom = curve(LINES.intake);
const width = curve(LINES.width), chine = curve(LINES.chine), intakeWidth = curve(LINES.intakeWidth);
const canopyTop = curve(LINES.canopyTop), canopyWidth = curve(LINES.canopyWidth);
const LIP = LINES.intakeLip;
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---- Generic surface tools ---------------------------------------------------------------------
/** Lofts rows of points (each row the same length) into one strip; UVs in metres (along, across). */
function loft(rows, { closed = false, uv = null } = {}) {
  const nI = rows.length, nJ = rows[0].length + (closed ? 1 : 0);
  const pos = new Float32Array(nI * nJ * 3), uvs = new Float32Array(nI * nJ * 2);
  for (let i = 0; i < nI; i++) {
    let acc = 0;
    for (let j = 0; j < nJ; j++) {
      const q = rows[i][j % rows[i].length];
      if (j > 0) acc += q.distanceTo(rows[i][(j - 1) % rows[i].length]);
      pos.set([q.x, q.y, q.z], (i * nJ + j) * 3);
      const t = uv ? uv(i, j, q, acc) : [-q.x, acc];
      uvs.set(t, (i * nJ + j) * 2);
    }
  }
  const idx = [];
  for (let i = 0; i < nI - 1; i++) for (let j = 0; j < nJ - 1; j++) {
    const a = i * nJ + j, b = a + 1, c = a + nJ, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (closed) {   // one normal on the seam
    const n = g.attributes.normal;
    for (let i = 0; i < nI; i++) {
      const a = i * nJ, b = a + nJ - 1;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
}
function flip(g) {
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
/** Faces every normal away from a reference (point or line) the caller gives. */
function outward(g, centre) {
  const p = g.attributes.position, n = g.attributes.normal, c = V(0, 0, 0);
  let score = 0;
  for (let i = 0; i < p.count; i += 5) {
    centre(p.getX(i), p.getY(i), p.getZ(i), c);
    score += (p.getX(i) - c.x) * n.getX(i) + (p.getY(i) - c.y) * n.getY(i) + (p.getZ(i) - c.z) * n.getZ(i);
  }
  return score < 0 ? flip(g) : g;
}
/** A flat cap over a planar polygon, facing `normal`. */
function cap(points, normal) {
  const nrm = normal.clone().normalize();
  const t1 = Math.abs(nrm.y) < 0.9 ? V(0, 1, 0).cross(nrm).normalize() : V(1, 0, 0).cross(nrm).normalize();
  const t2 = nrm.clone().cross(t1);
  const p2 = points.map(p => new THREE.Vector2(p.dot(t1), p.dot(t2)));
  const tris = THREE.ShapeUtils.triangulateShape(p2, []);
  const pos = [], uv = [], nor = [];
  for (const q of points) { pos.push(q.x, q.y, q.z); nor.push(nrm.x, nrm.y, nrm.z); }
  for (const q of p2) uv.push(q.x, q.y);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
  g.setIndex(tris.map(([i, j, k]) => {
    a.copy(points[i]); b.copy(points[j]); c.copy(points[k]);
    return b.sub(a).cross(c.sub(a)).dot(nrm) >= 0 ? [i, j, k] : [i, k, j];
  }).flat());
  return g;
}
/** Averages the normals where two lofts meet point for point, so the join does not show. */
function shareNormals(ga, gb) {
  const key = (p, i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  const pa = ga.attributes.position, pb = gb.attributes.position, na = ga.attributes.normal, nb = gb.attributes.normal;
  const at = new Map();
  for (let i = 0; i < pa.count; i++) at.set(key(pa, i), i);
  for (let j = 0; j < pb.count; j++) {
    const i = at.get(key(pb, j));
    if (i === undefined) continue;
    const x = na.getX(i) + nb.getX(j), y = na.getY(i) + nb.getY(j), z = na.getZ(i) + nb.getZ(j), l = Math.hypot(x, y, z) || 1;
    na.setXYZ(i, x / l, y / l, z / l); nb.setXYZ(j, x / l, y / l, z / l);
  }
}
/** Keeps only the triangles whose centroid passes `keep(x, y, z)`. */
function keepTriangles(g, keep) {
  const p = g.attributes.position, ix = g.index.array, out = [];
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i], b = ix[i + 1], c = ix[i + 2];
    const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, y = (p.getY(a) + p.getY(b) + p.getY(c)) / 3, z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
    if (keep(x, y, z)) out.push(a, b, c);
  }
  g.setIndex(out);
  return g;
}

// ---- Sections ----------------------------------------------------------------------------------
/** Thin airfoils. The 64A204: TN-1368's 64A006 thickness form scaled to 4 %, cambered for a design
 *  lift coefficient of 0.2 on the uniform-load (a = 1) mean line (≈: the 6A series is drawn on the
 *  a = 0.8 modified line, whose ordinates are not in the sources at hand; the difference is under
 *  0.2 % of the chord). Biconvex: two circular arcs. */
const T64 = curve(NACA_64A006.x.map((x, i) => [x / 100, NACA_64A006.y[i] / 100 / 0.06]));
const t64 = (x) => Math.max(0, T64(Math.min(1, Math.max(0, x))));     // per unit thickness ratio
const camber = (x) => (x <= 0 || x >= 1) ? 0 : -(0.2 / (4 * Math.PI)) * ((1 - x) * Math.log(1 - x) + x * Math.log(x));
const biconvex = (x) => 2 * x * (1 - x);                               // half-thickness per unit t/c
/** Chord stations, clustered at both edges. */
const chordStations = (n) => Array.from({ length: n + 1 }, (_, i) => (1 - Math.cos(Math.PI * i / n)) / 2);

/**
 * The fuselage's section at station s: one ring, the bottom centre line round the right side,
 * the top, the left side and back. `main` sections run down to the inlet's floor aft of the lip;
 * forward of it the forebody's own bottom. NU and NL points a quarter.
 */
const NU = 14, NL = 14;
function fuselageRing(s, main) {
  const T = top(s), W = Math.max(0.004, width(s)), zc = chine(s);
  const bot = main ? intakeBottom(s) : foreBottom(s);
  const Wi = main ? intakeWidth(s) : W;
  // Rounder over the top forward, flatter aft over the engine.
  const nu = 2.2 + 0.8 * sstep(6, 10, s), nl = main ? 3.2 : 2.2;
  const right = [];
  // Lower quarter, bottom centre → side.
  for (let k = NL; k >= 0; k--) {
    const ph = (k / NL) * Math.PI / 2, c = Math.cos(ph), sn = Math.sin(ph);
    const q = main ? sstep(0.0, 0.55, sn) : 0;
    const w = W + (Wi - W) * q;
    right.push([w * Math.pow(c, 2 / nl), zc - (zc - bot) * Math.pow(sn, 2 / nl)]);
  }
  // Upper quarter, side → top centre. Forward, a rounded superellipse; from the canopy aft the
  // F-16's blended body: broad shoulders falling from the spine to the strakes and the wing's root
  // (a cubic from the chine to the spine, ≈ from the photographs), mixed in over 4.5–6.5 m.
  const blend = sstep(4.5, 6.5, s), H = T - zc;
  const b0 = [W, zc], b1 = [W * 0.92, zc + 0.42 * H], b2 = [W * 0.42, zc + H], b3 = [0, T];
  for (let k = 1; k <= NU; k++) {
    const ph = (k / NU) * Math.PI / 2, c = Math.cos(ph), sn = Math.sin(ph);
    const ey = W * Math.pow(c, 2 / nu), ez = zc + H * Math.pow(sn, 2 / nu);
    const u = k / NU, v = 1 - u;
    const by = v * v * v * b0[0] + 3 * v * v * u * b1[0] + 3 * v * u * u * b2[0] + u * u * u * b3[0];
    const bz = v * v * v * b0[1] + 3 * v * v * u * b1[1] + 3 * v * u * u * b2[1] + u * u * u * b3[1];
    right.push([ey + (by - ey) * blend, ez + (bz - ez) * blend]);
  }
  const left = right.slice(0, -1).reverse().map(([y, z]) => [-y, z]);
  return [...right, ...left.slice(0, -1)].map(([y, z]) => P(s, z, y));
}
/** Fraction of the way round (0 bottom, 0.25 right, 0.5 top, 0.75 left) for the atlas's V: the
 *  ring has 2(NL + NU) points, the first the bottom centre, NL + NU the top. */
const ringFractions = (n) => Array.from({ length: n }, (_, j) => j / n);

// ---- Materials -----------------------------------------------------------------------------------
function f16Materials(M) {
  if (M.f16Skin) return M;
  const skin = makeF16Skin();
  // The atlas's rows run from the bottom centre line (top of the image) round the right side: read
  // as drawn, so the gun port lands on the left, where the F-16 carries its M61.
  for (const t of [skin.map, skin.normalMap, skin.roughnessMap]) { t.flipY = false; t.needsUpdate = true; }
  M.f16Skin = new THREE.MeshStandardMaterial({
    name: 'f16-skin', map: skin.map, normalMap: skin.normalMap, roughnessMap: skin.roughnessMap,
    normalScale: new THREE.Vector2(0.6, -0.6), metalness: 0.05, roughness: 1, envMapIntensity: 0.7,
  });
  const up = makeF16SurfaceTile({ tone: FS_COLOURS.fs36270 }), lo = makeF16SurfaceTile({ tone: FS_COLOURS.fs36375 });
  M.f16Upper = new THREE.MeshStandardMaterial({ name: 'f16-upper', map: up.map, normalMap: up.normalMap, roughnessMap: up.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0.05, roughness: 1, envMapIntensity: 0.7 });
  M.f16Lower = new THREE.MeshStandardMaterial({ name: 'f16-lower', map: lo.map, normalMap: lo.normalMap, roughnessMap: lo.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0.05, roughness: 1, envMapIntensity: 0.7 });
  // The canopy: one polycarbonate bubble, faintly smoked.
  M.f16Canopy = new THREE.MeshPhysicalMaterial({
    name: 'f16-canopy', color: 0x9aa4a8, metalness: 0, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.28,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3, depthWrite: false,
  });
  // The inlet duct, the gear wells and the cockpit: flat dark paint (≈).
  M.f16Dark = new THREE.MeshStandardMaterial({ name: 'f16-dark', color: 0x2a2c2f, metalness: 0.1, roughness: 0.85 });
  // Gear legs, wheels and the wells' doors' insides: gloss white (≈, as photographed).
  M.f16GearWhite = new THREE.MeshStandardMaterial({ name: 'f16-gear-white', color: 0xd9dad6, metalness: 0.15, roughness: 0.42 });
  return M;
}

// ---- Fuselage --------------------------------------------------------------------------------------
const FORE = [], MAIN = [];
for (let s = 0.62; s <= LIP + 1e-9; s += (s < 1.2 ? 0.04 : 0.1)) FORE.push(Math.min(s, LIP));
if (FORE[FORE.length - 1] < LIP) FORE.push(LIP);
for (let s = LIP; s <= LINES.nozzle.s0 + 1e-9; s += 0.1) MAIN.push(Math.min(s, LINES.nozzle.s0));

/** The cockpit's opening under the canopy (removed from the skin so the cockpit shows). */
const CPIT = { s0: 3.2, s1: 5.95 };
function inCockpit(x, y, z) {
  const s = -x;
  if (s < CPIT.s0 || s > CPIT.s1) return false;
  return Math.abs(z) < canopyWidth(s) - 0.03 && y - GROUND > top(s) - 0.06;
}

function buildFuselage(M) {
  const g = new THREE.Group();
  g.name = 'f16-fuselage';
  const rowsFore = FORE.map(s => fuselageRing(s, false)), rowsMain = MAIN.map(s => fuselageRing(s, true));
  const n = rowsFore[0].length, fr = ringFractions(n);
  const uvAtlas = (rows, ss) => (i, j) => [ss[i] / SKIN_LEN, j >= n ? 1 : fr[j]];
  const centre = (x, y, z, c) => c.set(x, GROUND + chine(-x), 0);
  const fore = outward(loft(rowsFore, { closed: true, uv: uvAtlas(rowsFore, FORE) }), centre);
  const main = outward(loft(rowsMain, { closed: true, uv: uvAtlas(rowsMain, MAIN) }), centre);
  keepTriangles(fore, (x, y, z) => !inCockpit(x, y, z));
  keepTriangles(main, (x, y, z) => !inCockpit(x, y, z));
  shareNormals(fore, main);
  g.add(mesh(fore, M.f16Skin, { name: 'f16-forebody' }));
  g.add(mesh(main, M.f16Skin, { name: 'f16-fuselage-skin' }));

  // The nose probe: a slim boom from the radome's tip, with its thicker base (≈).
  {
    const pts = [[0, 0.006], [0.02, 0.012], [0.3, 0.014], [0.32, 0.022], [0.5, 0.026], [0.62, 0.03]];
    const geo = new THREE.LatheGeometry(pts.map(([s, r]) => new THREE.Vector2(r, s)), 16);
    geo.rotateZ(Math.PI / 2);
    g.add(mesh(geo, M.alumDark, { name: 'f16-nose-probe', position: [0, (top(0.62) + foreBottom(0.62)) / 2 + GROUND, 0], castShadow: false }));
  }
  g.add(buildInlet(M, rowsFore[rowsFore.length - 1], rowsMain[0]));
  g.add(buildNozzle(M));
  return g;
}

/**
 * The inlet: the mouth between the forebody's bottom and the lip at s 4.6, a dark duct running
 * back to the fan face, which is a solid disc — nothing behind the mouth can be seen through.
 */
function buildInlet(M, foreRing, mainRing) {
  const g = new THREE.Group();
  g.name = 'f16-inlet';
  const n = foreRing.length, half = NL;   // indices 0..NL on the right, n−NL..n−1 on the left
  // The mouth's outline: the lip's lower curve (main ring) from the left side round the bottom to
  // the right side, then the forebody's bottom back across.
  const lipIdx = [...Array.from({ length: NL }, (_, k) => n - NL + k), ...Array.from({ length: half + 1 }, (_, k) => k)];
  const lower = lipIdx.map(i => mainRing[i].clone());
  const upper = lipIdx.slice().reverse().map(i => foreRing[i].clone());
  const mouth = [...lower, ...upper.slice(1, -1)];
  // The lip: a rounded rim along the lower curve.
  const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lower), 48, 0.025, 8, false);
  g.add(mesh(rim, M.f16Lower, { name: 'f16-inlet-lip' }));
  // The duct: the mouth's outline carried aft, shrinking to the fan face's circle.
  const fanS = 6.8, fanR = Math.sqrt(LINES.inletArea / Math.PI) * 1.18, fanZ = -0.42;
  // Each point of the mouth runs back to the fan face's circle at its own angle round the mouth's centre.
  const cy = mouth.reduce((a, p) => a + p.y, 0) / mouth.length;
  const rows = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, s = LIP + (fanS - LIP) * t;
    rows.push(mouth.map((p) => {
      const a = Math.atan2(p.y - cy, p.z);
      const c = P(s, fanZ + fanR * 0.9 * Math.sin(a), fanR * Math.cos(a));
      return V(-s, p.y, p.z).lerp(c, sstep(0, 1, t));
    }));
  }
  const duct = loft(rows, { closed: true });
  outward(duct, (x, y, z, c) => c.set(x, GROUND + fanZ, 0));
  flip(duct);   // seen from inside
  g.add(mesh(duct, M.f16Dark, { name: 'f16-inlet-duct', castShadow: false }));
  const face = new THREE.CircleGeometry(fanR * 1.02, 32);
  face.rotateY(Math.PI / 2);
  g.add(mesh(face, M.blackMatte ?? M.f16Dark, { name: 'f16-fan-face', position: [-fanS - 0.01, GROUND + fanZ, 0], castShadow: false }));
  return g;
}

/**
 * The F100's convergent–divergent nozzle: a ring of overlapping petals from the aft fuselage's
 * edge to the exit, its exit area the model's (TP-3355, 0.40 m²), the turbine's dark face inside.
 */
function buildNozzle(M) {
  const g = new THREE.Group();
  g.name = 'f16-nozzle';
  const { s0, s1, r0, r1, exitArea } = LINES.nozzle;
  const rExit = Math.sqrt(exitArea / Math.PI), zc = (top(s0) + intakeBottom(s0)) / 2;
  const prof = [[s0 - 0.05, r0 + 0.01], [s0 + 0.1, r0], [s1 - 0.12, r1 + 0.01], [s1, r1], [s1, rExit + 0.03], [s1 - 0.25, rExit], [s0 + 0.15, r0 - 0.08]];
  // Walked from the inside out: with the axis running aft (−s), that keeps the faces outward.
  const geo = new THREE.LatheGeometry(prof.reverse().map(([s, r]) => new THREE.Vector2(r, -s)), 30);
  geo.rotateZ(-Math.PI / 2);
  geo.rotateX(Math.PI / 30);   // a petal's edge on top
  g.add(mesh(geo, M.titanium, { name: 'f16-nozzle-petals', position: [0, GROUND + zc, 0] }));
  // The turbine's face and the afterburner's flameholder, deep inside: dark and solid.
  const face = new THREE.CircleGeometry(rExit * 1.05, 32);
  face.rotateY(-Math.PI / 2);
  g.add(mesh(face, M.blackMatte ?? M.f16Dark, { name: 'f16-turbine-face', position: [-(s1 - 0.6), GROUND + zc, 0], castShadow: false }));
  return g;
}

// ---- Canopy and cockpit ----------------------------------------------------------------------------
function buildCanopy(M) {
  const g = new THREE.Group();
  g.name = 'f16-canopy';
  const rows = [];
  for (let s = 3.0; s <= 6.1 + 1e-9; s += 0.05) {
    const ss = Math.min(s, 6.1), w = canopyWidth(ss), base = top(ss) - 0.02, h = canopyTop(ss) - base;
    const row = [];
    for (let k = 0; k <= 24; k++) {
      const a = Math.PI * k / 24, c = Math.cos(a), sn = Math.sin(a);
      row.push(P(ss, base + h * Math.pow(sn, 0.8), w * Math.sign(c) * Math.pow(Math.abs(c), 0.85)));
    }
    rows.push(row);
  }
  const shell = outward(loft(rows), (x, y, z, c) => c.set(x, GROUND + top(-x), 0));
  g.add(mesh(shell, M.f16Canopy, { name: 'f16-canopy-glass', castShadow: false, receiveShadow: false }));
  // The frame at the canopy's aft end and the sills it closes on.
  const aft = rows[Math.round((5.75 - 3.0) / 0.05)];
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(aft), 32, 0.03, 6, false), M.f16Dark, { name: 'f16-canopy-frame' }));
  for (const side of [-1, 1]) {
    const sill = rows.map(r => r[side > 0 ? 0 : r.length - 1]);
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sill), 48, 0.016, 6, false), M.f16Dark, { name: `f16-canopy-sill-${side > 0 ? 'r' : 'l'}` }));
  }
  return g;
}

/** The cockpit (≈, reconstructed): the tub under the canopy, the ACES II seat, the panel and the HUD. */
export const COCKPIT = { eye: { s: 4.45, z: 0.88 }, panel: 3.55, hud: 3.62 };
function buildCockpit(M) {
  const g = new THREE.Group();
  g.name = 'f16-cockpit';
  // Tub: the canopy's footprint carried down 0.8 m.
  {
    const rows = [];
    for (let s = CPIT.s0; s <= CPIT.s1 + 1e-9; s += 0.1) {
      const ss = Math.min(s, CPIT.s1), w = canopyWidth(ss) - 0.03, t = top(ss) - 0.05;
      rows.push([P(ss, t, -w), P(ss, t - 0.75, -w * 0.9), P(ss, t - 0.8, 0), P(ss, t - 0.75, w * 0.9), P(ss, t, w)]);
    }
    const tub = loft(rows);
    outward(tub, (x, y, z, c) => c.set(x, y + 1, 0));
    flip(tub);
    g.add(mesh(tub, M.f16Dark, { name: 'f16-cockpit-tub', castShadow: false }));
    for (const d of [1, -1]) {
      const r = rows[d > 0 ? 0 : rows.length - 1];
      g.add(mesh(cap(r, V(-d, 0, 0)), M.f16Dark, { name: d > 0 ? 'f16-cockpit-front' : 'f16-cockpit-rear', castShadow: false }));
    }
  }
  // Instrument panel and its glare shield, the HUD's combiner on top.
  const pz = top(COCKPIT.panel);
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.42, 0.6), M.f16Dark, { name: 'f16-instrument-panel', position: [-COCKPIT.panel, GROUND + pz - 0.2, 0], castShadow: false }));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.5), M.f16Dark, { name: 'f16-glare-shield', position: [-(COCKPIT.panel + 0.1), GROUND + pz + 0.02, 0], castShadow: false }));
  const comb = new THREE.PlaneGeometry(0.16, 0.2);
  comb.rotateY(-Math.PI / 2);
  g.add(mesh(comb, M.f16Canopy, { name: 'f16-hud-combiner', position: [-COCKPIT.hud, GROUND + pz + 0.14, 0], rotation: [0, 0, -25 * D2R], castShadow: false }));
  // ACES II seat (≈): pan, back, headrest, side rails; reclined 30°, as the F-16's is.
  {
    const parts = [
      { geometry: new THREE.BoxGeometry(0.5, 0.1, 0.5), matrix: new THREE.Matrix4().makeTranslation(-4.6, GROUND + top(4.6) - 0.62, 0) },
      { geometry: new THREE.BoxGeometry(0.12, 0.85, 0.48), matrix: new THREE.Matrix4().makeRotationZ(30 * D2R).premultiply(new THREE.Matrix4().makeTranslation(-4.95, GROUND + top(4.95) - 0.25, 0)) },
      { geometry: new THREE.BoxGeometry(0.16, 0.26, 0.34), matrix: new THREE.Matrix4().makeRotationZ(30 * D2R).premultiply(new THREE.Matrix4().makeTranslation(-5.18, GROUND + top(5.18) + 0.14, 0)) },
    ];
    g.add(mesh(mergeAll(parts), M.f16Dark, { name: 'f16-ejection-seat', castShadow: false }));
  }
  return g;
}

// ---- Wing ------------------------------------------------------------------------------------------
const strakeS = (() => {
  const pts = WING.strake.map(([s, y]) => [y, s]);
  const c = curve(pts);
  return (y) => (y <= pts[0][0] ? pts[0][1] : c(Math.min(y, pts[pts.length - 1][0])));
})();
const lefChord = curve(WING.lefHinge);
const WING_ROOT = 0.78;
/** The wing's leading edge at y: the strake inboard of its junction with the trapezoid, then that. */
const wingLE = (y) => (y < WING.strake[WING.strake.length - 1][1] ? strakeS(y) : WING.le(y));
/** Half-thickness at chord position s along the wing at y: the 64A204 over the trapezoid's chord,
 *  the strake a thin blade ahead of it. */
function wingHalf(y, s) {
  const leT = WING.le(y), c = WING.chord(y);
  const xT = (s - leT) / c;
  const foil = xT >= 0 ? t64(xT) * 0.04 * c : 0;
  const le = wingLE(y);
  const blade = s < leT ? 0.004 + 0.022 * (s - le) / Math.max(0.05, leT - le) : 0.026;
  return Math.max(foil, Math.min(blade, xT >= 0 ? 0.026 : blade));
}
const wingCamber = (y, s) => { const c = WING.chord(y), x = (s - WING.le(y)) / c; return x > 0 && x < 1 ? camber(x) * c : 0; };

/**
 * One chordwise piece of the wing between s0(y) and s1(y), y0…y1: a closed section (upper surface
 * forward to aft, lower back) at each span station, lofted, with flat faces where it is cut.
 */
function wingPiece(y0, y1, s0, s1, side, nSpan = 10, nChord = 22) {
  const ys = Array.from({ length: nSpan + 1 }, (_, k) => y0 + (y1 - y0) * k / nSpan);
  const rows = ys.map(y => {
    const a = s0(y), b = s1(y), xs = chordStations(nChord).map(u => a + (b - a) * u);
    const up = xs.map(s => P(s, wingCamber(y, s) + wingHalf(y, s), side * y));
    const lo = xs.slice().reverse().map(s => P(s, wingCamber(y, s) - wingHalf(y, s), side * y));
    return [...up, ...lo];
  });
  const g = loft(rows, { closed: true, uv: (i, j, q) => [-q.x, q.z * side] });
  outward(g, (x, y, z, c) => c.set(x, GROUND, z));
  const caps = [rows[0], rows[rows.length - 1]].map((r, k) => cap(r, V(0, 0, side * (k ? 1 : -1))));
  const merged = mergeAll([{ geometry: g }, ...caps.map(geometry => ({ geometry }))]);
  // Metric UVs, one rule for every face: the planform's (−x, z), with the height above the ground
  // added to both so the faces standing on edge (the caps, hinge faces and trailing edge) are
  // mapped too. On the skin, which is nearly flat, that height moves the map by millimetres.
  {
    const p = merged.attributes.position, uv = merged.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) - GROUND;
      uv.setXY(i, -p.getX(i) - h, p.getZ(i) * side + h);
    }
  }
  // Two materials: the upper surface medium grey, the lower light grey, by each face's own normal.
  // The faces where a piece is cut (hinge lines, the trailing edge) stand nearly vertical; they go
  // with the upper surface, whole, so a cut never shows as a saw-tooth of the two greys.
  const pos = merged.attributes.position, n = pos.count / 3;
  const upIdx = [], loIdx = [], a = V(), b = V(), c = V();
  for (let t = 0; t < n; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    const ny = b.sub(a).cross(c.sub(a)).normalize().y;
    (ny >= -0.3 ? upIdx : loIdx).push(t * 3, t * 3 + 1, t * 3 + 2);
  }
  merged.setIndex([...upIdx, ...loIdx]);
  merged.clearGroups();
  merged.addGroup(0, upIdx.length, 0);
  merged.addGroup(upIdx.length, loIdx.length, 1);
  return merged;
}

function buildWing(M, side) {
  const g = new THREE.Group();
  const tag = side > 0 ? 'r' : 'l';
  g.name = `f16-wing-${tag}`;
  const tip = WING.semispan, yJ = WING.strake[WING.strake.length - 1][1];
  const { y0: fy0, y1: fy1, chord: fc } = WING.flaperon;
  const TE = () => WING.te, hinge = () => WING.te - fc, lefH = (y) => WING.le(y) + lefChord(Math.min(Math.max(y, 1.32), 4.28));
  const pieces = [];
  // The strake and the root, inboard of the leading-edge flap.
  pieces.push(wingPiece(WING_ROOT, fy0, wingLE, TE, side, 4));
  pieces.push(wingPiece(fy0, yJ, wingLE, hinge, side, 6));
  // Outboard: the box between the LEF's hinge and the flaperon's (or the TE).
  pieces.push(wingPiece(yJ, fy1, lefH, hinge, side, 10));
  pieces.push(wingPiece(fy1, tip, lefH, TE, side, 6));
  const box = new THREE.Group();
  box.name = `f16-wing-panel-${tag}`;
  pieces.forEach((geo) => box.add(mesh(geo, [M.f16Upper, M.f16Lower], { name: `f16-wing-box-${tag}` })));
  g.add(box);

  // Leading-edge flap: hinged on its own line, deflecting down (flight model: f16-lef-*).
  {
    const piece = wingPiece(yJ, tip, (y) => WING.le(y), lefH, side, 12);
    const a = P(lefH(yJ), 0, side * yJ), b = P(lefH(tip), 0, side * tip);
    const hingeG = new THREE.Group();
    hingeG.name = `f16-lef-${tag}`;
    hingeG.position.copy(a);
    hingeG.userData.hinge = { axis: b.clone().sub(a).normalize().toArray(), range: [0, 25] };
    piece.translate(-a.x, -a.y, -a.z);
    hingeG.add(mesh(piece, [M.f16Upper, M.f16Lower], { name: `f16-lef-skin-${tag}` }));
    g.add(hingeG);
  }
  // Flaperon: plain flap on the trailing edge, ±21.5° (TP-1538 table I).
  {
    const piece = wingPiece(fy0, fy1, hinge, TE, side, 8, 10);
    const a = P(hinge(), 0, side * fy0);
    const hingeG = new THREE.Group();
    hingeG.name = `f16-flaperon-${tag}`;
    hingeG.position.copy(a);
    hingeG.userData.hinge = { axis: [0, 0, side], range: [-21.5, 21.5] };
    piece.translate(-a.x, -a.y, -a.z);
    hingeG.add(mesh(piece, [M.f16Upper, M.f16Lower], { name: `f16-flaperon-skin-${tag}` }));
    g.add(hingeG);
  }
  // The wing-tip launcher (LAU-129-like, ≈): a rail under the tip, empty.
  {
    const rail = new THREE.BoxGeometry(2.6, 0.1, 0.08);
    g.add(mesh(rail, M.f16Lower, { name: `f16-tip-launcher-${tag}`, position: [-(WING.te - 1.2), GROUND - 0.05, side * (tip + 0.15)] }));
    const pylon = new THREE.BoxGeometry(1.4, 0.06, 0.16);
    g.add(mesh(pylon, M.f16Lower, { name: `f16-tip-adapter-${tag}`, position: [-(WING.te - 0.9), GROUND, side * (tip + 0.06)] }));
  }
  return g;
}

// ---- Tails -----------------------------------------------------------------------------------------
/** A tail surface in its own plane: (along span r, chordwise s) from root chord to tip chord. */
function tailSurface({ rootLE, cr, ct, span, sweep, tRoot, tTip, nSpan = 8, nChord = 16, place }) {
  const rows = [];
  for (let k = 0; k <= nSpan; k++) {
    const f = k / nSpan, r = span * f, le = rootLE + r * Math.tan(sweep * D2R), c = cr + (ct - cr) * f, t = tRoot + (tTip - tRoot) * f;
    const xs = chordStations(nChord).map(u => le + c * u);
    const up = xs.map(s => place(s, r, biconvex((s - le) / c) * t * c));
    const lo = xs.slice().reverse().map(s => place(s, r, -biconvex((s - le) / c) * t * c));
    rows.push([...up, ...lo]);
  }
  const g = loft(rows, { closed: true, uv: (i, j, q) => [-q.x, q.y + q.z] });
  return { g, rows };
}

function buildStab(M, side) {
  const tag = side > 0 ? 'r' : 'l';
  const dih = HTAIL.dihedral * D2R;
  // Along the span the surface runs out and down (anhedral); its thickness along the plane's normal.
  const place = (s, r, t) => P(s, HTAIL.rootZ + r * Math.sin(dih) + t * Math.cos(dih), side * (HTAIL.rootY + r * Math.cos(dih) - t * Math.sin(dih)));
  const { g, rows } = tailSurface({ rootLE: HTAIL.rootLE, cr: HTAIL.cr, ct: HTAIL.ct, span: HTAIL.semispan, sweep: HTAIL.sweepLE, tRoot: HTAIL.tRoot, tTip: HTAIL.tTip, place });
  outward(g, (x, y, z, c) => c.set(x, GROUND + HTAIL.rootZ + (Math.abs(z) - HTAIL.rootY) * Math.tan(dih), z));
  const geo = mergeAll([{ geometry: g }, { geometry: cap(rows[rows.length - 1], V(0, 0, side)) }]);
  // All-moving: pivots on a spanwise spindle (±25°, TP-1538).
  const pivot = P(HTAIL.pivot, HTAIL.rootZ, side * HTAIL.rootY);
  const grp = new THREE.Group();
  grp.name = `f16-stab-${tag}`;
  grp.position.copy(pivot);
  grp.userData.hinge = { axis: [0, 0, 1], range: [-25, 25] };
  geo.translate(-pivot.x, -pivot.y, -pivot.z);
  grp.add(mesh(geo, M.f16Upper, { name: `f16-stab-skin-${tag}` }));
  return grp;
}

function buildFin(M) {
  const g = new THREE.Group();
  g.name = 'f16-fin';
  const { rudder } = FIN;
  const leAt = (z) => FIN.rootLE + (z - FIN.rootZ) * Math.tan(FIN.sweepLE * D2R);
  const chordAt = (z) => FIN.cr + (FIN.ct - FIN.cr) * (z - FIN.rootZ) / FIN.span;
  // The fixed fin in three bands, cut exactly round the rudder: below it, beside it (forward of
  // its hinge) and above it.
  const rudderAt = (z) => rudder.chordRoot + (rudder.chordTip - rudder.chordRoot) * (z - rudder.z0) / (rudder.z1 - rudder.z0);
  const tAt = (z) => FIN.tRoot + (FIN.tTip - FIN.tRoot) * (z - FIN.rootZ) / FIN.span;
  const band = (z0, z1, aft, n) => {
    const rows = [];
    for (let k = 0; k <= n; k++) {
      const z = z0 + (z1 - z0) * k / n, le = leAt(z), c = chordAt(z), t = tAt(z), end = aft(z);
      const xs = chordStations(16).map(u => le + (end - le) * u);
      const up = xs.map(q => P(q, z, biconvex((q - le) / c) * t * c + 0.001));
      const lo = xs.slice().reverse().map(q => P(q, z, -biconvex((q - le) / c) * t * c - 0.001));
      rows.push([...up, ...lo]);
    }
    return { geo: outward(loft(rows, { closed: true }), (x, y, z, cc) => cc.set(x, y, 0)), rows };
  };
  const TEat = (z) => leAt(z) + chordAt(z), hingeAt = (z) => TEat(z) - rudderAt(z);
  const b1 = band(FIN.rootZ, rudder.z0, TEat, 3), b2 = band(rudder.z0, rudder.z1, hingeAt, 8), b3 = band(rudder.z1, FIN.rootZ + FIN.span, TEat, 3);
  const tipRows = b3.rows;
  g.add(mesh(mergeAll([{ geometry: b1.geo }, { geometry: b2.geo }, { geometry: b3.geo }, { geometry: cap(tipRows[tipRows.length - 1], V(0, 1, 0)) }]), M.f16Upper, { name: 'f16-fin-skin' }));
  // Rudder: ±30° (TP-1538), hinged on its leading edge.
  {
    const rows2 = [];
    for (let k = 0; k <= 8; k++) {
      const z = rudder.z0 + (rudder.z1 - rudder.z0) * k / 8, le = leAt(z), c = chordAt(z), rc = rudderAt(z);
      const t = FIN.tRoot + (FIN.tTip - FIN.tRoot) * (z - FIN.rootZ) / FIN.span;
      const xs = chordStations(8).map(u => le + c - rc + rc * u);
      const up = xs.map(s => P(s, z, biconvex((s - le) / c) * t * c));
      const lo = xs.slice().reverse().map(s => P(s, z, -biconvex((s - le) / c) * t * c));
      rows2.push([...up, ...lo]);
    }
    const rg = outward(loft(rows2, { closed: true }), (x, y, z, c) => c.set(x, y, 0));
    const geo = mergeAll([{ geometry: rg }, { geometry: cap(rows2[0], V(0, -1, 0)) }, { geometry: cap(rows2[rows2.length - 1], V(0, 1, 0)) }]);
    const a = P(leAt(rudder.z0) + chordAt(rudder.z0) - rudderAt(rudder.z0), rudder.z0, 0);
    const b = P(leAt(rudder.z1) + chordAt(rudder.z1) - rudderAt(rudder.z1), rudder.z1, 0);
    const hinge = new THREE.Group();
    hinge.name = 'f16-rudder';
    hinge.position.copy(a);
    hinge.userData.hinge = { axis: b.clone().sub(a).normalize().toArray(), range: [-30, 30] };
    geo.translate(-a.x, -a.y, -a.z);
    hinge.add(mesh(geo, M.f16Upper, { name: 'f16-rudder-skin' }));
    g.add(hinge);
  }
  // The dorsal fillet ahead of the fin's root (TRACED): a thin wedge on the spine.
  {
    const [[s0], [s1, z1]] = FIN.dorsal;
    const pts = [P(s0, top(s0) - 0.02, 0), P(s1, z1, 0), P(s1 + 0.6, FIN.rootZ, 0)];
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    geo.translate(0, 0, -0.06);
    g.add(mesh(geo, M.f16Upper, { name: 'f16-dorsal-fillet' }));
  }
  return g;
}

function buildVentrals(M) {
  const g = new THREE.Group();
  g.name = 'f16-ventral-fins';
  for (const side of [-1, 1]) {
    const cant = VENTRAL.cant * D2R;
    const place = (s, r, t) => P(s, VENTRAL.rootZ - r * Math.cos(cant), side * (VENTRAL.rootY + r * Math.sin(cant)) + t);
    const rows = [];
    for (let k = 0; k <= 4; k++) {
      const f = k / 4, r = VENTRAL.span * f, le = VENTRAL.rootLE + r * Math.tan(VENTRAL.sweepLE * D2R), c = VENTRAL.cr + (VENTRAL.ct - VENTRAL.cr) * f;
      const half = VENTRAL.thickness * VENTRAL.cr / 2;
      const xs = chordStations(6).map(u => le + c * u);
      // A modified wedge: sharp leading edge, constant thickness aft of 40 %.
      const t = (s) => half * Math.min(1, (s - le) / (0.4 * c));
      rows.push([...xs.map(s => place(s, r, t(s))), ...xs.slice().reverse().map(s => place(s, r, -t(s)))]);
    }
    const fin = outward(loft(rows, { closed: true }), (x, y, z, c) => c.set(x, y, side * VENTRAL.rootY));
    g.add(mesh(mergeAll([{ geometry: fin }, { geometry: cap(rows[rows.length - 1], V(0, -1, 0)) }]), M.f16Lower, { name: `f16-ventral-${side > 0 ? 'r' : 'l'}` }));
  }
  return g;
}

/** The tail booms beside the nozzle that carry the stabilators, and the split speed brakes at their ends. */
function buildBooms(M) {
  const g = new THREE.Group();
  g.name = 'f16-booms';
  for (const side of [-1, 1]) {
    const tag = side > 0 ? 'r' : 'l';
    const boom = new THREE.BoxGeometry(2.2, 0.22, 0.28);
    g.add(mesh(boom, M.f16Lower, { name: `f16-boom-${tag}`, position: [-(12.6), GROUND + 0.02, side * 0.88] }));
    // Speed brakes: upper and lower petals, hinged at their forward edge, opening to 60°.
    for (const up of [1, -1]) {
      const h = new THREE.Group();
      h.name = `f16-speedbrake-${tag}-${up > 0 ? 'upper' : 'lower'}`;
      h.position.copy(P(13.7, 0.02 + up * 0.11, side * 0.88));
      h.userData.hinge = { axis: [0, 0, up * side], range: [0, 60] };
      const plate = new THREE.BoxGeometry(0.75, 0.025, 0.3);
      plate.translate(-0.375, 0, 0);
      h.add(mesh(plate, M.f16Lower, { name: `f16-speedbrake-panel-${tag}-${up > 0 ? 'u' : 'd'}` }));
      g.add(h);
    }
  }
  return g;
}

// ---- Landing gear --------------------------------------------------------------------------------
function wheel(M, d, w, name) {
  const g = new THREE.Group();
  g.name = name;
  const r = d / 2;
  const tyre = new THREE.TorusGeometry(r - w * 0.38, w * 0.42, 12, 40);
  g.add(mesh(tyre, M.boot ?? M.f16Dark, { name: `${name}-tyre` }));
  const hub = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 0.8, 24);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, M.f16GearWhite, { name: `${name}-hub` }));
  return g;
}

function buildGear(M) {
  const g = new THREE.Group();
  g.name = 'f16-landing-gear';
  // Nose gear: an oleo strut from the inlet's floor, the wheel on a short trailing fork (≈).
  {
    const s = GEAR.nose.s, rw = GEAR.nose.d / 2, zFloor = intakeBottom(s) + GROUND, axleY = rw;
    const strut = new THREE.CylinderGeometry(0.055, 0.06, zFloor - axleY, 12);
    g.add(mesh(strut, M.f16GearWhite, { name: 'f16-nose-strut', position: [-s, (zFloor + axleY) / 2, 0] }));
    const w = wheel(M, GEAR.nose.d, GEAR.nose.w, 'f16-nose-wheel');
    w.position.set(-(s + 0.08), axleY, 0);
    g.add(w);
    const fork = new THREE.BoxGeometry(0.14, 0.05, 0.2);
    g.add(mesh(fork, M.f16GearWhite, { name: 'f16-nose-fork', position: [-(s + 0.04), axleY + rw + 0.04, 0] }));
    const door = new THREE.BoxGeometry(0.75, 0.3, 0.012);
    g.add(mesh(door, M.f16Lower, { name: 'f16-nose-door', position: [-(s - 0.2), zFloor - 0.15, 0.2] }));
  }
  // Main gear: legs from the lower fuselage's sides out to the wheels at the published track.
  for (const side of [-1, 1]) {
    const tag = side > 0 ? 'r' : 'l';
    const s = GEAR.main.s, rw = GEAR.main.d / 2, axleY = rw;
    const top0 = P(s, intakeBottom(s) + 0.18, side * 0.62);
    const axle = V(-s, axleY, side * (GEAR.track / 2 - GEAR.main.w * 0.55));
    const leg = new THREE.CylinderGeometry(0.06, 0.07, top0.distanceTo(axle), 12);
    const m = mesh(leg, M.f16GearWhite, { name: `f16-main-strut-${tag}` });
    m.position.copy(top0.clone().add(axle).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(V(0, 1, 0), top0.clone().sub(axle).normalize());
    g.add(m);
    const w = wheel(M, GEAR.main.d, GEAR.main.w, `f16-main-wheel-${tag}`);
    w.position.set(-s, axleY, side * GEAR.track / 2);
    g.add(w);
    const door = new THREE.BoxGeometry(1.1, 0.42, 0.012);
    const dm = mesh(door, M.f16Lower, { name: `f16-main-door-${tag}`, position: [-(s - 0.1), GROUND + intakeBottom(s) - 0.12, side * 0.78] });
    dm.rotation.x = side * 0.25;
    g.add(dm);
  }
  return g;
}

// ---- Assembly ----------------------------------------------------------------------------------------
export function buildF16Airframe(M) {
  f16Materials(M);
  const air = new THREE.Group();
  air.name = 'f16-airframe';
  air.add(buildFuselage(M));
  air.add(buildCanopy(M));
  air.add(buildCockpit(M));
  for (const side of [-1, 1]) { air.add(buildWing(M, side)); air.add(buildStab(M, side)); }
  air.add(buildFin(M));
  air.add(buildVentrals(M));
  air.add(buildBooms(M));
  air.add(buildGear(M));
  return air;
}

/**
 * The exhibit: the airframe centred on its own length so the row's camera presets frame it, on
 * its gear on the apron (no plinth).
 */
export function buildF16(M) {
  const root = new THREE.Group();
  root.name = 'f16';
  const air = buildF16Airframe(M);
  air.position.x = OVERALL.length / 2;
  root.add(air);
  root.userData.height = OVERALL.height;
  root.userData.length = OVERALL.length;
  return root;
}
