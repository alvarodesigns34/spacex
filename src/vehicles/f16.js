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
import { mergeAll, curve, mesh, mat4 } from '../geometry/utils.js';
import { WING, HTAIL, FIN, VENTRAL, LINES, GEAR, NACA_64A006, OVERALL } from '../data/f16.js';
import { makeF16Skin, makeF16SurfaceTile, FS_COLOURS, SKIN_LEN } from '../materials/f16Textures.js';
import { applyDetail } from '../materials/detail.js';

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
  // Hill Gray (f16Textures.js): the wings' upper surfaces gunship grey, the fin and the tailplanes light ghost grey.
  const up = makeF16SurfaceTile({ tone: FS_COLOURS.fs36118 }), lo = makeF16SurfaceTile({ tone: FS_COLOURS.fs36375 });
  M.f16Upper = new THREE.MeshStandardMaterial({ name: 'f16-upper', map: up.map, normalMap: up.normalMap, roughnessMap: up.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0.05, roughness: 1, envMapIntensity: 0.7 });
  M.f16Lower = new THREE.MeshStandardMaterial({ name: 'f16-lower', map: lo.map, normalMap: lo.normalMap, roughnessMap: lo.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0.05, roughness: 1, envMapIntensity: 0.7 });
  // The canopy: one polycarbonate bubble, faintly smoked.
  M.f16Canopy = new THREE.MeshPhysicalMaterial({
    name: 'f16-canopy', color: 0x9aa4a8, metalness: 0, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.28,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3, depthWrite: false,
  });
  // The inlet duct, the gear wells and the cockpit: flat dark paint (≈).
  M.f16Dark = new THREE.MeshStandardMaterial({ name: 'f16-dark', color: 0x2a2c2f, metalness: 0.1, roughness: 0.85 });
  // The nozzle (≈ from photographs): the outer flaps' heat-darkened titanium, bluish brown; the
  // divergent flaps inside, pale streaked metal. Facets shaded flat, as the flaps are flat.
  M.f16NozzleOuter = new THREE.MeshStandardMaterial({ name: 'f16-nozzle-outer', color: 0x5f5b56, metalness: 0.75, roughness: 0.5, flatShading: true });
  M.f16NozzleInner = new THREE.MeshStandardMaterial({ name: 'f16-nozzle-inner', color: 0xa69d90, metalness: 0.55, roughness: 0.55, flatShading: true });
  // Gear legs, wheels and the wells' doors' insides: gloss white (≈, as photographed).
  M.f16GearWhite = new THREE.MeshStandardMaterial({ name: 'f16-gear-white', color: 0xd9dad6, metalness: 0.15, roughness: 0.42 });
  // At a close look (detail.js; scales ≈): the flat polyurethane's fine stipple over the panels,
  // the nozzle flaps' streaked metal, the gear's gloss enamel.
  for (const k of ['f16Skin', 'f16Upper', 'f16Lower']) applyDetail(M[k], 'stipple', { size: 0.012, normal: 0.35, rough: 0.12 });
  for (const k of ['f16NozzleOuter', 'f16NozzleInner']) applyDetail(M[k], 'brushed', { size: 0.05, normal: 0.6, rough: 0.35 });
  applyDetail(M.f16GearWhite, 'peel', { size: 0.04, normal: 0.06, rough: 0.08 });
  applyDetail(M.f16Dark, 'stipple', { size: 0.01, normal: 0.6, rough: 0.2 });
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
  // Angle-of-attack probes either side of the nose, and the blade antennas: the UHF/IFF blades on
  // the spine and under the inlet aft of the nose gear (stations ≈,
  // from the photographs).
  {
    const probes = [];
    for (const sd of [-1, 1]) {
      const sp = 1.75, yy = sd * (width(sp) - 0.004), zz = chine(sp) + 0.04;
      const geo = new THREE.ConeGeometry(0.012, 0.16, 10);
      geo.rotateZ(Math.PI / 2 - 0.12);
      geo.rotateY(-sd * 0.25);
      const at = P(sp - 0.06, zz, yy + sd * 0.02);
      geo.translate(at.x, at.y, at.z);
      const base = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12);
      base.rotateX(Math.PI / 2);
      const b0 = P(sp, zz, yy);
      base.translate(b0.x, b0.y, b0.z);
      probes.push({ geometry: geo }, { geometry: base });
    }
    g.add(mesh(mergeAll(probes), M.alumDark, { name: 'f16-aoa-probes', castShadow: false }));
    const blade = (sp, zz, up, h, len, name) => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len * 0.75, h); sh.lineTo(len * 0.45, h); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false });
      geo.translate(-len, 0, -0.006);
      geo.scale(1, up, 1);
      const at = P(sp, zz, 0);
      geo.translate(at.x, at.y, at.z);
      return mesh(geo, M.f16Lower, { name, castShadow: false });
    };
    g.add(blade(7.6, top(7.6) - 0.01, 1, 0.13, 0.3, 'f16-antenna-spine'));
    g.add(blade(6.6, intakeBottom(6.6) + 0.01, -1, 0.1, 0.26, 'f16-antenna-belly'));
  }
  g.add(buildInlet(M, rowsFore[rowsFore.length - 1], rowsMain[0]));
  g.add(buildNozzle(M, rowsMain[rowsMain.length - 1]));
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
 * The F100's convergent–divergent nozzle, as USAF photographs show it from behind (the
 * maintenance photograph "F16 Pratt & Whitney F100 nozzle maintenance", public domain, read for
 * reference only):
 *  - a boat-tail fairing that closes the aft fuselage's section onto the nozzle's circle, so
 *    nothing can be seen between them;
 *  - the outer flaps, sixteen facets with dark seals and hinge brackets at the lip;
 *  - inside, the divergent flaps and their seals (16, faceted, pale heat-streaked metal) down to
 *    the throat, the convergent flaps opening back out, then the afterburner's liner;
 *  - deep inside, the flameholder's rings with its radial spray bars and the tail cone, in front
 *    of a solid back wall.
 * The nozzle is shown at rest, wide open, as photographed; its exit, throat, duct and flameholder
 * are read off the photograph (≈).
 */
function buildNozzle(M, lastRing) {
  const g = new THREE.Group();
  g.name = 'f16-nozzle';
  const { s0, s1, r0, r1, exitArea } = LINES.nozzle;
  // At rest, engine off, the nozzle hangs wide open (the photograph): the divergent flaps' edge
  // nearly meets the outer flaps' (≈). TP-3355's 0.40 m² is the model's exit in flight.
  void exitArea;
  const rExit = r1 - 0.035, zc = (top(s0) + intakeBottom(s0)) / 2, yc = GROUND + zc;
  const N = 16;
  // The boat-tail: each point of the fuselage's last ring carried onto the nozzle's circle at its
  // own angle round the nozzle's axis.
  if (lastRing) {
    const sEnd = s0 + 0.08, rEnd = r0 + 0.012;
    const far = lastRing.map((p) => {
      const a = Math.atan2(p.y - yc, p.z);
      return P(sEnd, zc + rEnd * Math.sin(a), rEnd * Math.cos(a));
    });
    const mid = lastRing.map((p, k) => p.clone().lerp(far[k], 0.55).add(V(0, 0, 0)));
    const geo = outward(loft([lastRing, mid, far], { closed: true }), (x, y, z, c) => c.set(x, yc, 0));
    g.add(mesh(geo, M.f16Lower, { name: 'f16-boattail' }));
  }
  // Outer flaps: a sixteen-sided shell from the boat-tail to the lip.
  {
    const prof = [[s0 + 0.04, r0 + 0.012], [s0 + 0.2, r0 + 0.004], [s1 - 0.1, r1 + 0.008], [s1, r1]];
    const geo = new THREE.LatheGeometry(prof.map(([ss, r]) => new THREE.Vector2(r, -ss)), N);
    geo.rotateZ(-Math.PI / 2);
    // A lathe's normals are analytic, whatever its winding: take them from the winding first.
    geo.computeVertexNormals();
    outward(geo, (x, y, z, c) => c.set(x, 0, 0));   // faces away from the axis
    g.add(mesh(geo, M.f16NozzleOuter, { name: 'f16-nozzle-petals', position: [0, yc, 0] }));
    // The seals between the flaps, and a hinge bracket on each at the lip.
    const seals = [], brackets = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const len = s1 - s0 - 0.3;
      seals.push({ geometry: new THREE.BoxGeometry(len, 0.007, 0.022), matrix: mat4([-(s0 + 0.18 + len / 2), (r0 + 0.002) * Math.sin(a), (r0 + 0.002) * Math.cos(a)], [Math.PI / 2 - a, 0, 0]) });
      brackets.push({ geometry: new THREE.BoxGeometry(0.06, 0.018, 0.035), matrix: mat4([-(s1 - 0.05), (r1 + 0.008) * Math.sin(a + Math.PI / N), (r1 + 0.008) * Math.cos(a + Math.PI / N)], [Math.PI / 2 - (a + Math.PI / N), 0, 0]) });
    }
    g.add(mesh(mergeAll(seals), M.f16NozzleOuter, { name: 'f16-nozzle-seals', position: [0, yc, 0], castShadow: false }));
    g.add(mesh(mergeAll(brackets), M.f16Dark, { name: 'f16-nozzle-brackets', position: [0, yc, 0], castShadow: false }));
  }
  // The lip, the divergent flaps to the throat, the convergent flaps back out to the liner.
  const rThroat = 0.42, sThroat = s1 - 0.34, rLiner = 0.46, sLiner = s1 - 0.62, sBack = 12.25;
  {
    // The lip: an annulus at the exit plane between the outer flaps and the inner ones, facing
    // aft. It closes the nozzle's wall: without it the outer shell's inside showed through.
    const lip = new THREE.RingGeometry(rExit - 0.004, r1 + 0.003, N, 1, Math.PI / 2, Math.PI * 2);
    lip.rotateY(-Math.PI / 2);
    g.add(mesh(lip, M.f16NozzleOuter, { name: 'f16-nozzle-lip', position: [-s1, yc, 0] }));
    const prof = [[s1, rExit], [sThroat, rThroat], [sLiner, rLiner]];
    const geo = new THREE.LatheGeometry(prof.map(([ss, r]) => new THREE.Vector2(r, -ss)), N);
    geo.rotateZ(-Math.PI / 2);
    // The flaps look into the nozzle: taken from the winding, away from the axis, then turned in.
    geo.computeVertexNormals();
    flip(outward(geo, (x, y, z, c) => c.set(x, 0, 0)));
    g.add(mesh(geo, M.f16NozzleInner, { name: 'f16-nozzle-flaps', position: [0, yc, 0] }));
    const seals = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, rr = (rExit + rThroat) / 2 - 0.006, len = s1 - sThroat;
      const tilt = Math.atan2(rExit - rThroat, len);
      seals.push({ geometry: new THREE.BoxGeometry(len, 0.008, 0.05), matrix: mat4([-(s1 + sThroat) / 2, rr * Math.sin(a), rr * Math.cos(a)], [Math.PI / 2 - a, 0, 0]).multiply(new THREE.Matrix4().makeRotationZ(-tilt)) });
    }
    g.add(mesh(mergeAll(seals), M.f16NozzleOuter, { name: 'f16-nozzle-flap-seals', position: [0, yc, 0], castShadow: false }));
  }
  // The afterburner's liner, the flameholder and the tail cone, closed by a solid back wall.
  {
    const liner = new THREE.CylinderGeometry(rLiner, rLiner, sLiner - sBack, 32, 1, true);
    liner.rotateZ(Math.PI / 2);
    liner.computeVertexNormals();
    flip(outward(liner, (x, y, z, c) => c.set(x, 0, 0)));   // seen from inside
    g.add(mesh(liner, M.f16Dark, { name: 'f16-afterburner-liner', position: [-(sLiner + sBack) / 2, yc, 0], castShadow: false }));
    const parts = [];
    for (const r of [0.17, 0.3]) { const t = new THREE.TorusGeometry(r, 0.018, 6, 40); t.rotateY(Math.PI / 2); parts.push({ geometry: t, matrix: mat4([-(sBack + 0.12), 0, 0]) }); }
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      parts.push({ geometry: new THREE.BoxGeometry(0.03, 0.3, 0.025), matrix: mat4([-(sBack + 0.1), 0.26 * Math.sin(a), 0.26 * Math.cos(a)], [-a + Math.PI / 2, 0, 0]) });
    }
    const cone = new THREE.LatheGeometry([[0.13, 0], [0.11, 0.1], [0.05, 0.2], [0.012, 0.25]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    cone.rotateZ(Math.PI / 2);
    parts.push({ geometry: cone, matrix: mat4([-(sBack + 0.05), 0, 0]) });
    g.add(mesh(mergeAll(parts), M.alumDark, { name: 'f16-flameholder', position: [0, yc, 0], castShadow: false }));
    const wall = new THREE.CircleGeometry(rLiner + 0.01, 32);
    wall.rotateY(-Math.PI / 2);
    g.add(mesh(wall, M.blackMatte ?? M.f16Dark, { name: 'f16-turbine-face', position: [-sBack, yc, 0], castShadow: false }));
  }
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
  grp.add(mesh(geo, M.f16Lower, { name: `f16-stab-skin-${tag}` }));
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
  g.add(mesh(mergeAll([{ geometry: b1.geo }, { geometry: b2.geo }, { geometry: b3.geo }, { geometry: cap(tipRows[tipRows.length - 1], V(0, 1, 0)) }]), M.f16Lower, { name: 'f16-fin-skin' }));
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
    hinge.add(mesh(geo, M.f16Lower, { name: 'f16-rudder-skin' }));
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

/**
 * The tail booms beside the nozzle that carry the stabilators, and the split speed brakes at their
 * ends. Each boom is a rounded fairing growing out of the fuselage's side under the stabilator's
 * root; its last 0.75 m is the clamshell speed brake, an upper and a lower petal hinged at their
 * forward edge that open to 60° (TP-1538) and close to a blunt edge (sections and lengths ≈, from
 * the photographs).
 */
const BOOM = { zc: 0.02, y: 0.88, s0: 10.9, s1: 11.8, sb: 13.7, end: 14.45, w: 0.16, h: 0.12 };
const boomSection = (s, phi0, phi1, n, scale = [1, 1]) => {
  const grow = 0.15 + 0.85 * sstep(BOOM.s0, BOOM.s1, s);
  const t = Math.max(0, (s - BOOM.sb) / (BOOM.end - BOOM.sb));
  const w = BOOM.w * grow * (1 - 0.45 * t) * scale[0], h = BOOM.h * grow * (1 - 0.8 * Math.pow(t, 1.4)) * scale[1];
  const se = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  return Array.from({ length: n + 1 }, (_, j) => {
    const ph = phi0 + (phi1 - phi0) * j / n;
    return [w * se(Math.cos(ph), 0.8), h * se(Math.sin(ph), 0.8)];
  });
};
/** Moves a part's UVs to start at 0: caps project world coordinates, metres from the origin, and
 *  merged with a loft's they would stretch one tile over the whole range. */
function uvFromZero(g) {
  const uv = g.attributes.uv;
  let u0 = Infinity, v0 = Infinity;
  for (let i = 0; i < uv.count; i++) { u0 = Math.min(u0, uv.getX(i)); v0 = Math.min(v0, uv.getY(i)); }
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) - u0, uv.getY(i) - v0);
  return g;
}
function buildBooms(M) {
  const g = new THREE.Group();
  g.name = 'f16-booms';
  const N = 24;
  for (const side of [-1, 1]) {
    const tag = side > 0 ? 'r' : 'l';
    const at = (s, [dz, dy]) => P(s, BOOM.zc + dy, side * (BOOM.y + dz));
    // The fixed fairing, s0 → sb, closed round; its aft face shows when the brakes open.
    const rows = [];
    for (let i = 0; i <= 14; i++) {
      const sx = BOOM.s0 + (BOOM.sb - BOOM.s0) * i / 14;
      rows.push(boomSection(sx, 0, 2 * Math.PI, N).slice(0, -1).map(q => at(sx, q)));
    }
    const fair = outward(loft(rows, { closed: true }), (x, y, z, c) => c.set(x, GROUND + BOOM.zc, side * BOOM.y));
    const face = cap(rows[rows.length - 1], V(-1, 0, 0));
    g.add(mesh(mergeAll([{ geometry: uvFromZero(fair) }, { geometry: uvFromZero(face) }]), M.f16Lower, { name: `f16-boom-${tag}` }));
    // Speed brakes: each petal a half shell with its flat inner face on the split line.
    for (const up of [1, -1]) {
      const h = new THREE.Group();
      h.name = `f16-speedbrake-${tag}-${up > 0 ? 'upper' : 'lower'}`;
      const h0 = boomSection(BOOM.sb, Math.PI / 2, Math.PI / 2, 1)[0][1];
      const hinge = at(BOOM.sb, [0, up * h0]);
      h.position.copy(hinge);
      // Upper petal's trailing edge swings up, the lower's down, on both sides.
      h.userData.hinge = { axis: [0, 0, -up], range: [0, 60] };
      const pr = [];
      for (let i = 0; i <= 8; i++) {
        const sx = BOOM.sb + (BOOM.end - BOOM.sb) * i / 8;
        // A hair in from the split line, so the closed petals do not fight over one plane.
        pr.push(boomSection(sx, up > 0 ? 0 : Math.PI, up > 0 ? Math.PI : 2 * Math.PI, N / 2).map(([dz, dy]) => at(sx, [dz, dy + up * 0.002])));
      }
      const shell = outward(loft(pr), (x, y, z, c) => c.set(x, GROUND + BOOM.zc, side * BOOM.y));
      const lip = [...pr.map(r => r[0]), ...pr.slice().reverse().map(r => r[r.length - 1])];
      const inner = cap(lip, V(0, -up, 0));
      const tail = cap(pr[pr.length - 1], V(-1, 0, 0)), front = cap(pr[0], V(1, 0, 0));
      const geo = mergeAll([shell, inner, tail, front].map(x => ({ geometry: uvFromZero(x) })));
      geo.translate(-hinge.x, -hinge.y, -hinge.z);
      h.add(mesh(geo, M.f16Lower, { name: `f16-speedbrake-panel-${tag}-${up > 0 ? 'u' : 'd'}` }));
      // The actuator's clevis on the inner face, and its rod into the boom (≈).
      const clevis = new THREE.BoxGeometry(0.08, 0.03, 0.05);
      clevis.translate(-0.22, -up * (h0 - 0.015), 0);
      h.add(mesh(clevis, M.alumDark, { name: `f16-speedbrake-clevis-${tag}-${up > 0 ? 'u' : 'd'}` }));
      g.add(h);
    }
  }
  return g;
}

// ---- Landing gear --------------------------------------------------------------------------------
/** A wheel on its axle along Z: the tyre's section a rounded profile turned round the axle, the
 *  rim's flanges and the hub with its bolt circle (≈ in proportion, sizes published). */
function wheel(M, d, w, name, { brake = false } = {}) {
  const g = new THREE.Group();
  g.name = name;
  const r = d / 2, hw = w / 2, rr = r * 0.6;            // bead seat ≈ 60 % of the tyre's radius
  // Tyre: from bead to bead round the tread, fullest at the centre line.
  const prof = [];
  for (let k = 0; k <= 16; k++) {
    const t = -Math.PI / 2 + Math.PI * k / 16;
    prof.push(new THREE.Vector2(rr + (r - rr) * Math.pow(Math.cos(t), 0.4), hw * 0.95 * Math.sin(t)));
  }
  const tyre = new THREE.LatheGeometry(prof, 48);
  tyre.computeVertexNormals();
  outward(tyre, (x, y, z, c) => c.set(0, y, 0));
  tyre.rotateX(Math.PI / 2);
  g.add(mesh(tyre, M.boot ?? M.f16Dark, { name: `${name}-tyre` }));
  // Rim: a drum between the beads with a flange each side, the hub cap proud of it.
  const rim = new THREE.CylinderGeometry(rr + 0.004, rr + 0.004, w * 0.86, 32, 1, true);
  rim.computeVertexNormals();
  flip(rim);                                            // seen from the axle's side, inside the tyre
  rim.rotateX(Math.PI / 2);
  g.add(mesh(rim, M.f16GearWhite, { name: `${name}-rim` }));
  for (const sd of [-1, 1]) {
    const disc = new THREE.CylinderGeometry(rr + 0.01, rr + 0.01, 0.012, 32);
    disc.rotateX(Math.PI / 2); disc.translate(0, 0, sd * w * 0.42);
    g.add(mesh(disc, M.f16GearWhite, { name: `${name}-flange-${sd > 0 ? 'o' : 'i'}` }));
    const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.24, 0.05, 20);
    hub.rotateX(Math.PI / 2); hub.translate(0, 0, sd * (w * 0.42 + 0.03));
    g.add(mesh(hub, brake && sd < 0 ? M.alumDark : M.f16GearWhite, { name: `${name}-hub-${sd > 0 ? 'o' : 'i'}` }));
    const bolts = [];
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, b = new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6);
      b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, sd * (w * 0.42 + 0.012));
      bolts.push({ geometry: b });
    }
    g.add(mesh(mergeAll(bolts), M.alumDark, { name: `${name}-bolts-${sd > 0 ? 'o' : 'i'}` }));
  }
  return g;
}
/** A strut between two points: a cylinder from a to b, its own radius at each end. */
function strut(a, b, r0, r1, mat, name, seg = 14) {
  const geo = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg);
  const m = mesh(geo, mat, { name });
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
/** Torque links: two flat arms meeting at a knee ahead of an oleo, from its cylinder to its axle. */
function torqueLinks(M, top, bot, ahead, name) {
  const g = new THREE.Group();
  g.name = name;
  const knee = top.clone().add(bot).multiplyScalar(0.5).add(ahead);
  for (const [a, b, n] of [[top, knee, 'u'], [knee, bot, 'l']]) {
    const len = a.distanceTo(b), geo = new THREE.BoxGeometry(0.03, len, 0.05);
    const m = mesh(geo, M.f16GearWhite, { name: `${name}-${n}` });
    m.position.copy(a.clone().add(b).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  }
  const pin = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10);
  pin.rotateX(Math.PI / 2);
  g.add(mesh(pin, M.alumDark, { name: `${name}-knee`, position: [knee.x, knee.y, knee.z] }));
  return g;
}

function buildGear(M) {
  const g = new THREE.Group();
  g.name = 'f16-landing-gear';
  // Nose gear, on the inlet's floor aft of the lip: the oleo's white cylinder, its chrome piston (the shared bright metal)
  // (≈ 18 cm showing at the static load), torque links ahead of it and a fork round the 18 in wheel
  // trailing a little behind the strut's line (≈).
  {
    const s = GEAR.nose.s, rw = GEAR.nose.d / 2, zFloor = intakeBottom(s) + GROUND, axleY = rw;
    const axle = V(-(s + 0.08), axleY, 0);
    const forkTop = V(-(s + 0.02), axleY + rw + 0.05, 0);
    const pistonTop = V(-s, forkTop.y + 0.18, 0), top = V(-s, zFloor, 0);
    g.add(strut(pistonTop, top, 0.065, 0.06, M.f16GearWhite, 'f16-nose-strut'));
    g.add(strut(forkTop, pistonTop.clone().add(V(0, 0.02, 0)), 0.042, 0.042, M.aluminum, 'f16-nose-piston'));
    // The fork: a crown over the tyre and an arm down each side to the axle.
    const crown = new THREE.BoxGeometry(0.16, 0.05, GEAR.nose.w + 0.06);
    g.add(mesh(crown, M.f16GearWhite, { name: 'f16-nose-fork', position: [forkTop.x, forkTop.y, 0] }));
    for (const sd of [-1, 1]) {
      g.add(strut(V(forkTop.x, forkTop.y, sd * (GEAR.nose.w / 2 + 0.03)), V(axle.x, axle.y, sd * (GEAR.nose.w / 2 + 0.03)), 0.022, 0.026, M.f16GearWhite, `f16-nose-fork-${sd > 0 ? 'r' : 'l'}`));
    }
    g.add(torqueLinks(M, V(-s, pistonTop.y + 0.04, 0), V(forkTop.x, forkTop.y + 0.02, 0), V(0.09, 0, 0), 'f16-nose-torque'));
    // Taxi and landing lights on the strut (≈).
    const lamp = new THREE.CylinderGeometry(0.045, 0.04, 0.05, 16);
    lamp.rotateZ(Math.PI / 2);
    g.add(mesh(lamp, M.alumDark, { name: 'f16-nose-lamp', position: [-s + 0.07, pistonTop.y + 0.2, 0] }));
    const w = wheel(M, GEAR.nose.d, GEAR.nose.w, 'f16-nose-wheel');
    w.position.copy(axle);
    g.add(w);
    // The doors: a long one each side of the well, hanging open aft of the leg (DVIDS photographs
    // 7682498 and 8138193 of F-16s on the ramp; sizes ≈).
    for (const sd of [-1, 1]) {
      const door = new THREE.BoxGeometry(0.80, 0.36, 0.01);
      const dm = mesh(door, M.f16Lower, { name: `f16-nose-door-${sd > 0 ? 'r' : 'l'}`, position: [-(s + 0.47), zFloor - 0.17, sd * 0.2] });
      dm.rotation.x = sd * 0.08;
      g.add(dm);
    }
  }
  // Main gear: each leg from its trunnion in the lower fuselage's side out and down to the axle at
  // the published track, a drag brace forward to the fuselage, torque links, the 27.75 in wheel with
  // its brake inboard, and the door on the leg's outer side.
  for (const side of [-1, 1]) {
    const tag = side > 0 ? 'r' : 'l';
    const s = GEAR.main.s, rw = GEAR.main.d / 2, axleY = rw;
    const top0 = P(s, intakeBottom(s) + 0.18, side * 0.62);
    const axle = V(-s, axleY, side * (GEAR.track / 2 - GEAR.main.w * 0.55 - 0.04));
    const dir = top0.clone().sub(axle).normalize();
    const pistonTop = axle.clone().add(dir.clone().multiplyScalar(0.36)).add(V(0, 0.05, 0));
    g.add(strut(pistonTop, top0, 0.078, 0.07, M.f16GearWhite, `f16-main-strut-${tag}`));
    const axleBoss = axle.clone().add(V(0, 0.06, 0));
    g.add(strut(axleBoss, pistonTop.clone().add(dir.clone().multiplyScalar(0.04)), 0.05, 0.05, M.aluminum, `f16-main-piston-${tag}`));
    // Axle beam from the piston's foot out to the wheel.
    const stub = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12);
    stub.rotateX(Math.PI / 2);
    g.add(mesh(stub, M.f16GearWhite, { name: `f16-main-axle-${tag}`, position: [axle.x, axle.y, axle.z + side * 0.07] }));
    // Drag brace, forward and up into the fuselage (≈).
    const braceTop = P(s - 0.75, intakeBottom(s - 0.75) + 0.12, side * 0.55);
    g.add(strut(pistonTop.clone().add(dir.clone().multiplyScalar(0.12)), braceTop, 0.03, 0.028, M.f16GearWhite, `f16-main-brace-${tag}`));
    g.add(torqueLinks(M, pistonTop.clone().add(dir.clone().multiplyScalar(0.06)), axleBoss, V(-0.1, 0, 0), `f16-main-torque-${tag}`));
    const w = wheel(M, GEAR.main.d, GEAR.main.w, `f16-main-wheel-${tag}`, { brake: true });
    w.position.set(-s, axleY, side * GEAR.track / 2);
    w.scale.z = side;                                    // the brake's side faces the airplane
    g.add(w);
    // The door: a trapezoid hinged along the fuselage's lower edge ahead of the wheel, hanging
    // open and leaning out, its lower edge rising to the front (the same photographs; ≈ sizes).
    const shape = new THREE.Shape([[0, 0], [1.12, 0], [0.98, -0.40], [0.10, -0.50]].map(([a, b]) => new THREE.Vector2(a, b)));
    const door = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
    door.translate(0, 0, -0.006);
    const dm = mesh(door, M.f16Lower, { name: `f16-main-door-${tag}` });
    dm.position.set(-(s - 0.14), top0.y - 0.12, side * 0.66);
    dm.rotation.x = -side * 0.26;
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
