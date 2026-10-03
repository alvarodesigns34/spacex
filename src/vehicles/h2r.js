/**
 * Kawasaki Ninja H2R (ZX1000Y), at 1:1, as Kawasaki photographed it: Mirror Coated Spark Black
 * bodywork, the green trellis frame, carbon upper cowl and wings.
 *
 * PROVENANCE
 *  - Every published figure is in data/h2r.js with its source (Kawasaki's specifications,
 *    MY2027): length 2.070 m, width 0.850 m, height 1.160 m, wheelbase 1.450 m, seat 0.830 m,
 *    ground clearance 0.130 m, rake 25.1°, trail 108 mm, 120/600 R17 and 190/650 R17 tyres,
 *    330 mm and 250 mm discs.
 *  - The shapes between those figures are TRACED on Kawasaki's studio side photograph (left
 *    side; reference only, not in the repository), scaled at 1.80 mm a pixel: at that scale the
 *    traced axles fall 1.445 m apart (published 1.450), the screen's top 1.165 m up (1.160) and
 *    the seat 0.830 m (0.830). Read off it ≈ ±1 cm: the profile of the cowl, screen, tank, seat
 *    and tail, the panels' outlines, the frame's nodes, the engine's covers, the headers, the
 *    swingarm, the fender. The widths are not on a side view: ≈ from the right-front and the
 *    head-on photographs, within the published 0.850 m.
 *  - Reconstructed (≈): the sections between the traced outlines, the engine's internals'
 *    covers, the wheels' spokes, the callipers, the controls.
 *  - Kawasaki's own markings, as on the photographed bike, by the visitor's request (the one
 *    exception to the centre's no-logos rule): "Kawasaki" on the tank, "Ninja" and "H2R" on the
 *    fairing, "brembo" on the front callipers. Drawn as type, not copied artwork.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground the tyres stand on,
 * z to the right. Traced coordinates are in millimetres from the front axle (T()). Groups the
 * ride animates: h2r-steer (turns about the steering axis: fork, front wheel, bars, fender),
 * h2r-wheel-f / h2r-wheel-r (spin), h2r-swingarm (pivots with the rear wheel on the shock).
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeAll, mesh } from '../geometry/utils.js';
import { BODY, WHEELS, CHASSIS } from '../data/h2r.js';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const AX = BODY.wheelbase / 2;
/** Traced millimetres from the front axle (x forward, y up) to the model's metres. */
const T = (x, y, z = 0) => new THREE.Vector3(x / 1000 + AX, y / 1000, z);
const RF = WHEELS.front.dia / 2, RR = WHEELS.rear.dia / 2;
/** Static ride: the slicks stand ≈5 mm squashed under the bike's weight (≈). */
const SQUASH = 0.005;
export const AXLE_F = new THREE.Vector3(AX, RF - SQUASH, 0);
export const AXLE_R = new THREE.Vector3(-AX, RR - SQUASH, 0);
/** The steering axis: through the ground the trail ahead of the front contact, at the rake. */
const RAKE = CHASSIS.rake * D2R;
export const STEER_AXIS = new THREE.Vector3(-Math.sin(RAKE), Math.cos(RAKE), 0);
export const STEER_GROUND = new THREE.Vector3(AX + CHASSIS.trail, 0, 0);
/** The swingarm's pivot (traced). */
export const PIVOT = T(-861, 330);

export function h2rMaterials(M) {
  if (M.h2rChrome) return;
  // Mirror Coated Spark Black: a silver mirror coat under a dark tinted clear, so it reads as
  // chrome where it catches the sky and near black where it faces the ground (≈).
  M.h2rChrome = new THREE.MeshPhysicalMaterial({ name: 'h2r-mirror-coat', color: 0x9da3aa, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25 });
  M.h2rBlack = new THREE.MeshPhysicalMaterial({ name: 'h2r-black', color: 0x0b0c0e, metalness: 0.3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  M.h2rMatte = new THREE.MeshStandardMaterial({ name: 'h2r-matte-black', color: 0x151618, metalness: 0.2, roughness: 0.7 });
  M.h2rCarbon = new THREE.MeshPhysicalMaterial({ name: 'h2r-carbon', color: 0xffffff, map: carbonTexture(), metalness: 0.2, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 });
  M.h2rGreen = new THREE.MeshPhysicalMaterial({ name: 'h2r-frame-green', color: 0x2f9d3a, metalness: 0.15, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.h2rTyre = new THREE.MeshStandardMaterial({ name: 'h2r-tyre', color: 0x1b1c1d, metalness: 0, roughness: 0.82 });
  M.h2rRim = new THREE.MeshPhysicalMaterial({ name: 'h2r-rim', color: 0x0e0f10, metalness: 0.5, roughness: 0.3, clearcoat: 0.8 });
  M.h2rMachined = new THREE.MeshStandardMaterial({ name: 'h2r-machined', color: 0xd4d7da, metalness: 1, roughness: 0.22 });
  M.h2rDisc = new THREE.MeshStandardMaterial({ name: 'h2r-disc', color: 0xa9abad, metalness: 0.85, roughness: 0.32, alphaMap: discHoles(), alphaTest: 0.5, side: THREE.DoubleSide });
  M.h2rCaliper = new THREE.MeshStandardMaterial({ name: 'h2r-calliper', color: 0x9ea3a8, metalness: 0.7, roughness: 0.32 });
  M.h2rEngine = new THREE.MeshStandardMaterial({ name: 'h2r-engine', color: 0x1b1c1e, metalness: 0.55, roughness: 0.45 });
  M.h2rTitanium = new THREE.MeshStandardMaterial({ name: 'h2r-titanium', color: 0xa69e92, metalness: 0.9, roughness: 0.3 });
  M.h2rGold = new THREE.MeshStandardMaterial({ name: 'h2r-gold', color: 0xc8941e, metalness: 0.9, roughness: 0.3 });
  M.h2rRed = new THREE.MeshStandardMaterial({ name: 'h2r-red-anodised', color: 0x7a1414, metalness: 0.6, roughness: 0.4 });
  M.h2rScreen = new THREE.MeshPhysicalMaterial({ name: 'h2r-screen', color: 0x8b9399, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  M.h2rTail = new THREE.MeshStandardMaterial({ name: 'h2r-tail-lamp', color: 0x7a0a0c, emissive: 0xd0161a, emissiveIntensity: 0.6, roughness: 0.3 });
  // Shared where the finish is the same, to keep the scene's material count down.
  M.h2rVoid = M.h2rMatte; M.h2rRubber = M.h2rTyre; M.h2rSeat = M.h2rMatte; M.h2rChain = M.h2rEngine;
  M.h2rCase = M.h2rCaliper; M.h2rAlu = M.h2rMachined;
}

// ---- Textures -----------------------------------------------------------------------------------
function canvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
/** 2×2 twill, ≈3 mm tows: drawn, so it repeats with the UVs (x, y in metres × 60). */
function carbonTexture() {
  const t = canvas(64, 64, (g, w) => {
    g.fillStyle = '#141517'; g.fillRect(0, 0, w, w);
    const s = w / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const k = (i + j) % 4 < 2;
      const grd = k ? g.createLinearGradient(i * s, 0, i * s + s, 0) : g.createLinearGradient(0, j * s, 0, j * s + s);
      grd.addColorStop(0, '#1b1c1f'); grd.addColorStop(0.5, k ? '#3a3d42' : '#2a2c30'); grd.addColorStop(1, '#1b1c1f');
      g.fillStyle = grd; g.fillRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1);
    }
  });
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; }
  return t;
}
/** The 330 mm disc's two staggered rows of holes on its braking band, as an alpha map over a ring's UVs. */
function discHoles() {
  const t = canvas(512, 512, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#000';
    const c = w / 2;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU, r = (i % 2 ? 0.86 : 0.93) * c;
      g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, w * 0.012, 0, TAU); g.fill();
    }
  });
  if (t) t.colorSpace = THREE.NoColorSpace;
  return t;
}
/** A decal: text on a transparent canvas, for a plane laid on a panel. */
function textDecal(lines, w = 1024, h = 256) {
  return canvas(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    for (const L of lines) {
      g.save();
      g.translate(L.x * w, L.y * h);
      if (L.skew) g.transform(1, 0, -L.skew, 1, 0, 0);
      g.font = L.font;
      g.textAlign = L.align ?? 'left'; g.textBaseline = 'middle';
      if (L.box) { g.fillStyle = L.box; const m = g.measureText(L.text); g.fillRect(-0.08 * h, -0.28 * h, m.width + 0.16 * h, 0.56 * h); }
      g.fillStyle = L.color;
      g.fillText(L.text, 0, 0);
      if (L.red) { g.fillStyle = '#d0141a'; g.fillText(L.red, g.measureText(L.text).width, 0); }
      g.restore();
    }
  });
}

// ---- Body surfaces ------------------------------------------------------------------------------
/**
 * A body panel from its side-view outline (traced mm, closed polygon) blown out to a
 * half-width w(x, y) (mm) each side of `zc`, rounded over `r` mm to meet itself at the outline:
 * the shape a pressed panel or a tank has seen from the side. The interior is filled by
 * subdividing the outline's triangulation so the half-width can vary across it. `edge`:
 * 'round' (a rolled edge) or 'chamfer' (a flat bevel, the H2R's faceted panels).
 */
function pillow(outline, { w, r = 30, zc = 0, levels = 2, sides = [-1, 1], inner = 0, edge = 'round', step = 28 }) {
  const pts = densify(outline, step);
  const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
  let faces = tris.map(t => t.map(i => pts[i]));
  for (let l = 0; l < levels; l++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  const wf = typeof w === 'function' ? w : () => w;
  const segs = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  const cache = new Map();
  const half = (p) => {
    const k = `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    if (cache.has(k)) return cache.get(k);
    let d = Infinity;
    for (const [a, b] of segs) d = Math.min(d, segDist(p, a, b));
    const u = Math.min(1, d / r);
    const v = inner + (wf(p[0], p[1]) - inner) * (edge === 'round' ? Math.sqrt(1 - (1 - u) * (1 - u)) : u);
    cache.set(k, v);
    return v;
  };
  const pos = [];
  for (const side of sides) {
    for (const f of faces) {
      const tri = side > 0 ? f : [f[0], f[2], f[1]];
      for (const p of tri) {
        const v = T(p[0], p[1], zc / 1000 + side * half(p) / 1000);
        pos.push(v.x, v.y, v.z);
      }
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // UVs for the carbon weave: side-view metres.
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 60, pos[i + 1] * 60);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  return g;
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function densify(poly, step) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
/** Linear interpolation through [x, value] keys (x descending or ascending). */
function ramp(keys) {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (x <= k[i][0]) { const t = (x - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t; }
    return k[k.length - 1][1];
  };
}

// ---- Outlines (TRACED, mm from the front axle) ---------------------------------------------------
const OUT = {
  // The upper cowl, carbon: nose to the screen's base, down to the side panel's top edge.
  cowl: [[175, 800], [160, 842], [127, 890], [73, 930], [0, 984], [-60, 992], [-130, 990], [-175, 940], [-185, 870], [-150, 830], [-60, 810], [40, 790], [94, 773], [150, 770]],
  // The chin below the nose, carbon, with its forward vane.
  chin: [[175, 800], [150, 770], [94, 773], [60, 735], [25, 708], [-20, 712], [10, 690], [80, 688], [140, 690], [158, 740]],
  // The side panel with "Ninja H2R", mirror coat: from the nose down and back to the frame.
  side: [[94, 773], [40, 790], [-60, 810], [-150, 830], [-300, 795], [-470, 700], [-520, 640], [-430, 630], [-330, 600], [-200, 560], [-120, 520], [-60, 560], [-20, 640], [30, 700], [70, 740]],
  // The lower panel under it, beside the radiator (mirror coat).
  lower: [[-120, 520], [-200, 560], [-240, 545], [-270, 420], [-300, 330], [-240, 335], [-180, 400], [-140, 470]],
  // The tank, mirror coat over black: crest, rear slope to the seat, the knee recess.
  tank: [[-330, 900], [-430, 960], [-560, 1018], [-650, 1015], [-750, 990], [-830, 955], [-885, 893], [-920, 838], [-880, 790], [-760, 770], [-620, 790], [-470, 830], [-380, 860]],
  // The seat, black.
  seat: [[-920, 838], [-1027, 830], [-1117, 844], [-1189, 875], [-1230, 905], [-1200, 830], [-1100, 790], [-960, 790], [-900, 805]],
  // The seat cowl's hump and the tail, black and mirror coat, to the tip over the lamp.
  tail: [[-1189, 875], [-1234, 947], [-1279, 992], [-1293, 1010], [-1360, 1019], [-1576, 1014], [-1549, 997], [-1459, 920], [-1396, 866], [-1279, 749], [-1234, 713], [-1099, 704], [-946, 677], [-919, 722], [-1000, 790], [-1100, 790], [-1200, 830]],
  // The tail's mirror-coat side panel (laid over the tail).
  tailSide: [[-1090, 708], [-1153, 803], [-1225, 875], [-1351, 920], [-1396, 866], [-1279, 749], [-1234, 713]],
  // The screen, smoked.
  screen: [[-12, 984], [-246, 1161], [-266, 1155], [-282, 1105], [-262, 1062], [-200, 1030], [-130, 992], [-60, 990]],
  // The front fender, black, over the tyre.
  fender: null,
};

// ---- Build -----------------------------------------------------------------------------------------
export function buildH2r(M) {
  h2rMaterials(M);
  const root = new THREE.Group();
  root.name = 'h2r';
  const body = new THREE.Group();
  body.name = 'h2r-body';
  root.add(body);
  const add = (parent, g, mat, name) => { const m = mesh(g, mat, { name }); parent.add(m); return m; };

  // Bodywork.
  add(body, pillow(OUT.cowl, { w: ramp([[175, 25], [100, 120], [0, 190], [-185, 225]]), r: 80, edge: 'chamfer', levels: 3 }), M.h2rCarbon, 'h2r-cowl');
  add(body, pillow(OUT.chin, { w: ramp([[175, 25], [100, 90], [0, 140]]), r: 50, edge: 'chamfer' }), M.h2rCarbon, 'h2r-chin');
  add(body, pillow(OUT.side, { w: (x, y) => ramp([[94, 105], [0, 190], [-200, 228], [-470, 212]])(x) * (0.62 + 0.38 * Math.min(1, Math.max(0, (y - 520) / 260))), r: 40, edge: 'chamfer', levels: 3 }), M.h2rChrome, 'h2r-side-panel');
  add(body, pillow(OUT.lower, { w: (x, y) => 120 + (y - 330) * 0.12, r: 20, edge: 'chamfer' }), M.h2rChrome, 'h2r-lower-panel');
  add(body, pillow(OUT.tank, { w: (x, y) => ramp([[-330, 160], [-500, 215], [-700, 205], [-900, 150]])(x), r: 75, edge: 'chamfer', levels: 3 }), M.h2rChrome, 'h2r-tank');
  add(body, pillow(OUT.seat, { w: ramp([[-920, 140], [-1050, 125], [-1200, 95]]), r: 40 }), M.h2rSeat, 'h2r-seat');
  add(body, pillow(OUT.tail, { w: ramp([[-920, 120], [-1200, 115], [-1400, 85], [-1576, 30]]), r: 45 }), M.h2rBlack, 'h2r-tail');
  // The black side cover under the seat, between the frame's rear node and the tail (traced).
  add(body, pillow([[-880, 805], [-1000, 795], [-1150, 800], [-1100, 700], [-990, 650], [-905, 640], [-875, 700]], { w: 125, r: 25, edge: 'chamfer' }), M.h2rBlack, 'h2r-side-cover');
  add(body, pillow(OUT.tailSide, { w: ramp([[-1090, 128], [-1250, 122], [-1396, 96]]), r: 20 }), M.h2rChrome, 'h2r-tail-panel');
  {
    // The screen: a thin curved sheet over the cowl's opening.
    const g = pillow(OUT.screen, { w: ramp([[-12, 150], [-150, 170], [-280, 120]]), r: 160, levels: 3, step: 40 });
    add(body, g, M.h2rScreen, 'h2r-screen');
  }
  // The tail lamp under the tip.
  add(body, pillow([[-1549, 997], [-1459, 920], [-1440, 935], [-1530, 1005]], { w: 45, r: 10 }), M.h2rTail, 'h2r-tail-lamp');

  body.add(buildFrame(M), buildEngine(M), buildExhaust(M), buildDuct(M), buildWings(M), buildRadiator(M), buildRearsets(M));
  body.updateMatrixWorld(true);
  body.add(buildDecals(M, { tank: body.getObjectByName('h2r-tank'), side: body.getObjectByName('h2r-side-panel') }));
  root.add(buildSteer(M), buildSwingarm(M));

  root.userData.length = BODY.length;
  root.userData.height = BODY.height;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

/** The green trellis: straight high-tensile steel tubes between the traced nodes, each side. */
function buildFrame(M) {
  const g = new THREE.Group();
  g.name = 'h2r-frame';
  const N = {
    headTop: [-300, 905, 0.055], headBot: [-255, 790, 0.055],
    up1: [-577, 818, 0.125], up2: [-885, 674, 0.150],
    lo1: [-613, 674, 0.150], lo2: [-775, 727, 0.145],
    v1: [-885, 541, 0.150], v2: [-888, 427, 0.150], pivot: [-861, 330, 0.140],
    eng: [-470, 600, 0.150],
  };
  const tubes = [['headTop', 'up1', 0.0145], ['up1', 'up2', 0.0145], ['headBot', 'lo1', 0.0145], ['lo1', 'lo2', 0.013], ['lo2', 'up2', 0.013],
    ['up1', 'lo1', 0.012], ['up2', 'v1', 0.0145], ['v1', 'v2', 0.0145], ['v2', 'pivot', 0.0145], ['lo1', 'v1', 0.012], ['headBot', 'eng', 0.0135], ['eng', 'lo1', 0.012]];
  const items = [];
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false);
  for (const side of [-1, 1]) {
    for (const [a, b, r] of tubes) {
      const A = T(N[a][0], N[a][1], side * N[a][2]), B = T(N[b][0], N[b][1], side * N[b][2]);
      items.push({ geometry: cyl, matrix: segMatrix(A, B, r) });
    }
    for (const n of ['up2', 'v1', 'v2', 'lo1']) {
      const P = T(N[n][0], N[n][1], side * N[n][2]);
      items.push({ geometry: new THREE.SphereGeometry(0.021, 12, 8), matrix: new THREE.Matrix4().makeTranslation(P.x, P.y, P.z) });
    }
  }
  // The steering head.
  const H0 = T(-300, 905), H1 = T(-255, 790);
  items.push({ geometry: cyl, matrix: segMatrix(H1, H0, 0.03) });
  g.add(mesh(mergeAll(items), M.h2rGreen, { name: 'h2r-trellis' }));
  // Cross tubes and the subframe (black) under the seat.
  const sub = [];
  for (const side of [-1, 1]) {
    sub.push({ geometry: cyl, matrix: segMatrix(T(-885, 674, side * 0.15), T(-1250, 860, side * 0.09), 0.012) });
    sub.push({ geometry: cyl, matrix: segMatrix(T(-885, 541, side * 0.15), T(-1200, 780, side * 0.09), 0.011) });
  }
  sub.push({ geometry: cyl, matrix: segMatrix(T(-885, 674, -0.15), T(-885, 674, 0.15), 0.012) });
  g.add(mesh(mergeAll(sub), M.h2rMatte, { name: 'h2r-subframe' }));
  return g;
}
/** A unit cylinder (y-axis, height 1) stretched from A to B with radius r. */
function segMatrix(A, B, r) {
  const d = new THREE.Vector3().subVectors(B, A), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return new THREE.Matrix4().compose(A.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(r, L, r));
}

/** The supercharged 998 cm³ four, black: crankcase, block and head leaning forward, covers. */
function buildEngine(M) {
  const g = new THREE.Group();
  g.name = 'h2r-engine';
  const box = (x0, y0, x1, y1, hw, tilt = 0, mat = M.h2rEngine, name) => {
    const geo = new THREE.BoxGeometry((x0 - x1) / 1000, (y1 - y0) / 1000, hw * 2, 2, 2, 2);
    const m = mesh(geo, mat, { name });
    const c = T((x0 + x1) / 2, (y0 + y1) / 2);
    m.position.copy(c); m.rotation.z = tilt;
    g.add(m);
    return m;
  };
  // The engine's side view (traced): head and cam cover leaning forward, the cylinders, the
  // crankcase and gearbox, the sump; ≈0.30 m across the cases.
  g.add(mesh(pillow([[-430, 590], [-470, 645], [-640, 655], [-700, 600], [-840, 520], [-850, 330], [-780, 190], [-680, 150], [-520, 170], [-450, 250], [-420, 400]],
    { w: (x, y) => (y > 450 ? 135 : 155), r: 30 }), M.h2rEngine, { name: 'h2r-engine-cases' }));
  // Covers: the generator (left) and the clutch (right), round.
  for (const [x, y, z, r, nm] of [[-622, 413, -0.165, 0.082, 'h2r-generator-cover'], [-700, 380, 0.165, 0.095, 'h2r-clutch-cover']]) {
    // The right-hand clutch cover is cast grey (the right-front photograph), the left one black.
    const c = mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.03, 40), z > 0 ? M.h2rCase : M.h2rEngine, { name: nm });
    c.rotation.x = Math.PI / 2; c.position.copy(T(x, y, z)); g.add(c);
    const ring = mesh(new THREE.TorusGeometry(r * 0.98, 0.004, 6, 48), M.h2rMachined, { name: `${nm}-ring` });
    ring.position.copy(T(x, y, z + Math.sign(z) * 0.016)); g.add(ring);
    // Its bolts, round the rim.
    const bolts = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU, P = T(x, y, z + Math.sign(z) * 0.017);
      bolts.push({ geometry: new THREE.CylinderGeometry(0.0055, 0.0055, 0.008, 6), matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(P.x + Math.cos(a) * (r + 0.012), P.y + Math.sin(a) * (r + 0.012), P.z) });
    }
    g.add(mesh(mergeAll(bolts), M.h2rMachined, { name: `${nm}-bolts` }));
  }
  // The supercharger: impeller housing behind the cylinders, its intake chamber's red anodised face.
  const sc = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.11, 32), M.h2rEngine, { name: 'h2r-supercharger' });
  sc.rotation.x = Math.PI / 2; sc.position.copy(T(-760, 610, -0.08)); g.add(sc);
  const scFace = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 32), M.h2rRed, { name: 'h2r-supercharger-face' });
  scFace.rotation.x = Math.PI / 2; scFace.position.copy(T(-760, 610, -0.14)); g.add(scFace);
  // The airbox / plenum over the engine, under the tank.
  box(-430, 650, -860, 770, 0.12, 0, M.h2rMatte, 'h2r-plenum');
  return g;
}

/** Four titanium headers down the front of the engine into a collector under it, the silencer up the right. */
function buildExhaust(M) {
  const items = [];
  for (let i = 0; i < 4; i++) {
    const z = -0.075 + i * 0.05;
    const pts = [T(-410, 520, z), T(-380, 400, z * 1.05), T(-400, 260, z * 1.1), T(-460, 185, z * 0.9), T(-600, 170 + i * 6, z * 0.5), T(-760, 190, z * 0.25)];
    items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.019, 10) });
  }
  // Collector to the silencer on the right.
  const col = [T(-760, 190, 0), T(-900, 215, 0.04), T(-990, 245, 0.13)];
  items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(col), 20, 0.034, 12) });
  const g = new THREE.Group();
  g.name = 'h2r-exhaust';
  g.add(mesh(mergeAll(items), M.h2rTitanium, { name: 'h2r-headers' }));
  // The silencer: a long titanium megaphone, rising to behind the footpeg.
  const A = T(-990, 245, 0.13), B = T(-1340, 445, 0.19);
  const L = A.distanceTo(B);
  const sil = mesh(new THREE.CylinderGeometry(0.062, 0.05, L, 24, 1, true), M.h2rTitanium, { name: 'h2r-silencer' });
  sil.applyMatrix4(segMatrix(A, B, 1)); sil.scale.set(1, 1, 1);
  const s2 = mesh(new THREE.CylinderGeometry(0.062, 0.05, 1, 24, 1, false), M.h2rTitanium, { name: 'h2r-silencer' });
  s2.matrixAutoUpdate = true;
  const d = new THREE.Vector3().subVectors(B, A);
  s2.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.clone().normalize());
  s2.position.copy(A).addScaledVector(d, 0.5);
  s2.scale.set(1, L, 1);
  g.add(s2);
  const cap = mesh(new THREE.CircleGeometry(0.058, 24), M.h2rMatte, { name: 'h2r-silencer-end' });
  cap.position.copy(B); cap.lookAt(B.clone().add(d)); g.add(cap);
  return g;
}

/** The ram-air duct, carbon: from the nose's intake down the left side to the supercharger. */
function buildDuct(M) {
  const pts = [T(150, 770, 0), T(40, 745, -0.05), T(-150, 720, -0.15), T(-450, 690, -0.175), T(-700, 645, -0.15), T(-760, 620, -0.11)];
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.045, 16);
  // Flattened against the bike's side: ≈90 mm tall, ≈55 mm deep.
  const P = geo.attributes.position, cz = new THREE.CatmullRomCurve3(pts);
  for (let i = 0; i < P.count; i++) {
    const t = Math.floor(i / 17) / 48, c = cz.getPoint(Math.min(1, t));
    P.setZ(i, c.z + (P.getZ(i) - c.z) * 0.6);
  }
  geo.computeVertexNormals();
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 50, uv.getY(i) * 6);
  return mesh(geo, M.h2rCarbon, { name: 'h2r-ram-air-duct' });
}

/** The carbon wings: the upper pair where a road bike's mirrors are, and the fins on the sides. */
function buildWings(M) {
  const g = new THREE.Group();
  g.name = 'h2r-wings';
  // A blade: chord back from its leading edge along −x, thickness up, span along +z.
  const fin = (chord, span, thick) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(-chord, 0.004); s.lineTo(-chord * 0.94, thick); s.lineTo(-0.015, thick * 0.85); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: false });
  };
  for (const side of [-1, 1]) {
    // Upper wing: where a road bike's mirror is, a swept carbon blade out from the cowl's upper
    // flank, near level, its tip turned up into a small end plate (the head-on and three-quarter
    // photographs); the tips are the bike's widest points (the published 0.850 m).
    {
      const root = T(-10, 915, 0.215), span = 0.21, sweep = 0.07, chord = 0.13, dih = 0.12;
      const P = (u, c, up = 0) => new THREE.Vector3(root.x - sweep * u - chord * c, root.y + dih * span * u + up, root.z + span * u);
      const pts = [];
      const quad = (a, b, c2, d) => pts.push(a, b, c2, a, c2, d);
      const t = 0.006;
      // The blade, top and bottom, and the end plate up from its tip.
      for (const dy of [t, -t]) {
        const A = P(0, 0, dy), B = P(1, 0, dy), C = P(1, 1, dy), D = P(0, 1, dy);
        if (dy > 0) quad(A, D, C, B); else quad(A, B, C, D);
      }
      quad(P(0, 0, t), P(1, 0, t), P(1, 0, -t), P(0, 0, -t));
      const E0 = P(1, 0.05), E1 = P(1, 1), E2 = P(1, 0.85, 0.06), E3 = P(1, 0.25, 0.05);
      quad(E0, E1, E2, E3); quad(E0, E3, E2, E1);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.computeVertexNormals();
      const uv = []; for (const p of pts) uv.push(p.x * 60, (p.z + p.y) * 60);
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const up = mesh(geo, M.h2rCarbon, { name: `h2r-wing-upper-${side > 0 ? 'r' : 'l'}` });
      const wrap = new THREE.Group(); wrap.scale.z = side; wrap.add(up); g.add(wrap);
    }
    // Two fins on the side panel's lower half.
    for (const [x, y, c] of [[-200, 655, 0.2], [-240, 605, 0.22]]) {
      const f = mesh(fin(c, 0.045, 0.012), M.h2rCarbon, { name: 'h2r-side-fin' });
      f.position.copy(T(x, y, 0.215)); f.rotation.z = 0.18;
      const w2 = new THREE.Group(); w2.scale.z = side; w2.add(f); g.add(w2);
    }
  }
  return g;
}

function buildRadiator(M) {
  const r = mesh(new THREE.BoxGeometry(0.06, 0.36, 0.42), M.h2rMatte, { name: 'h2r-radiator' });
  r.position.copy(T(-180, 520)); r.rotation.z = -0.25;
  return r;
}

/** Rearsets: the aluminium heel plates, footpegs and levers. */
function buildRearsets(M) {
  const g = new THREE.Group();
  g.name = 'h2r-rearsets';
  for (const side of [-1, 1]) {
    const plate = new THREE.Shape();
    const P = [[-950, 516], [-1112, 444], [-1040, 380], [-940, 420]];
    plate.moveTo(P[0][0] / 1000, P[0][1] / 1000); for (const p of P.slice(1)) plate.lineTo(p[0] / 1000, p[1] / 1000);
    const geo = new THREE.ExtrudeGeometry(plate, { depth: 0.008, bevelEnabled: false });
    const m = mesh(geo, M.h2rAlu, { name: 'h2r-heel-plate' });
    m.position.set(AX, 0, side * 0.17 - (side < 0 ? 0.008 : 0));
    g.add(m);
    const peg = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.08, 12), M.h2rAlu, { name: 'h2r-footpeg' });
    peg.rotation.x = Math.PI / 2; peg.position.copy(T(-1010, 400, side * 0.215)); g.add(peg);
  }
  return g;
}

/** Kawasaki's own markings, as photographed (see the header), laid on the panel's surface. */
function buildDecals(M, panels) {
  const g = new THREE.Group();
  g.name = 'h2r-decals';
  const ray = new THREE.Raycaster();
  const decal = (tex, x, y, wm, hm, target, rot, name) => {
    if (!tex) return;
    const mat = new THREE.MeshStandardMaterial({ name, map: tex, transparent: true, metalness: 0.4, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    for (const side of [-1, 1]) {
      ray.set(T(x, y, side * 1), new THREE.Vector3(0, 0, -side));
      const hit = ray.intersectObject(target, false)[0];
      if (!hit) continue;
      // A grid laid flat at the hit, then each vertex dropped onto the panel along the view
      // across the bike, so the decal follows the panel's curve.
      const geo = new THREE.PlaneGeometry(wm, hm, 24, 6);
      const tmp = new THREE.Object3D();
      tmp.position.copy(hit.point);
      tmp.lookAt(hit.point.clone().add(new THREE.Vector3(0, 0, side)));
      tmp.rotateZ(rot * (side > 0 ? 1 : -1));
      tmp.updateMatrixWorld(true);
      geo.applyMatrix4(tmp.matrixWorld);
      const P = geo.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i);
        ray.set(new THREE.Vector3(v.x, v.y, side * 1), new THREE.Vector3(0, 0, -side));
        const h = ray.intersectObject(target, false)[0];
        if (h) P.setXYZ(i, h.point.x, h.point.y, h.point.z + side * 0.0015);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      g.add(m);
    }
  };
  decal(textDecal([{ text: 'Kawasaki', x: 0.04, y: 0.55, font: 'italic 900 150px Arial, Helvetica, sans-serif', color: '#3a3d42', skew: 0.18 }]), -640, 968, 0.22, 0.055, panels.tank, 0.12, 'h2r-decal-kawasaki');
  decal(textDecal([{ text: 'Ninja', x: 0.02, y: 0.5, font: 'italic 700 170px "Brush Script MT", "Segoe Script", cursive', color: '#eef0f2' },
    { text: 'H2', red: 'R', x: 0.56, y: 0.72, font: 'bold 90px Arial, sans-serif', color: '#e9ebed', box: '#202226' }]), -90, 765, 0.24, 0.06, panels.side, 0.1, 'h2r-decal-ninja');
  return g;
}

// ---- Steering: fork, wheel, brakes, fender, bars --------------------------------------------------
function buildSteer(M) {
  const g = new THREE.Group();
  g.name = 'h2r-steer';
  // Pivot on the steering axis: the group's origin on the axis at the axle's height.
  const pivot = STEER_GROUND.clone().addScaledVector(STEER_AXIS, AXLE_F.y / STEER_AXIS.y);
  g.position.copy(pivot);
  g.userData.axis = STEER_AXIS.clone();
  const inner = new THREE.Group();
  inner.position.copy(pivot).negate();
  g.add(inner);
  // The callipers' "brembo", one texture for both.
  const brembo = textDecal([{ text: 'brembo', x: 0.5, y: 0.5, align: 'center', font: 'bold 150px Arial, sans-serif', color: '#c8161d' }], 512, 160);
  const bremboMat = brembo && new THREE.MeshStandardMaterial({ name: 'h2r-decal-brembo', map: brembo, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  // Fork legs: from the axle up the rake; the inverted fork's lower (inner) tubes and the upper
  // (outer) tubes in the clamps.
  const up = STEER_AXIS;
  for (const side of [-1, 1]) {
    const z = side * 0.105;
    const base = AXLE_F.clone().setZ(z);
    const lower = mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.36, 18), M.h2rBlack, { name: 'h2r-fork-lower' });
    lower.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    lower.position.copy(base).addScaledVector(up, 0.20);
    inner.add(lower);
    const upper = mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.40, 18), M.h2rMatte, { name: 'h2r-fork-upper' });
    upper.quaternion.copy(lower.quaternion);
    upper.position.copy(base).addScaledVector(up, 0.50);
    inner.add(upper);
    const cap = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 14), M.h2rGold, { name: 'h2r-fork-cap' });
    cap.quaternion.copy(lower.quaternion); cap.position.copy(base).addScaledVector(up, 0.71); inner.add(cap);
    const foot = mesh(new THREE.BoxGeometry(0.07, 0.11, 0.05), M.h2rBlack, { name: 'h2r-axle-clamp' });
    foot.quaternion.copy(lower.quaternion); foot.position.copy(base).addScaledVector(up, 0.02); inner.add(foot);
    // The Brembo Stylema, radial, behind the fork leg, on the disc.
    const cal = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.045, 2, 3, 2), M.h2rCaliper, { name: 'h2r-calliper' });
    const a = -0.3;   // ≈ the calliper's angle behind and above the axle
    cal.position.copy(AXLE_F).add(new THREE.Vector3(-Math.cos(a) * 0.15, Math.sin(-a) * 0.15 * 0.3, side * 0.085));
    cal.rotation.z = 0.35;
    inner.add(cal);
    if (bremboMat) {
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.03), bremboMat);
      dm.name = 'h2r-decal-brembo';
      dm.position.copy(cal.position).add(new THREE.Vector3(0, 0, side * 0.024));
      dm.rotation.set(0, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI / 2 + 0.35 : -Math.PI / 2 - 0.35);
      inner.add(dm);
    }
  }
  // Triple clamps.
  for (const k of [0.38, 0.62]) {
    const c = mesh(new THREE.BoxGeometry(0.09, 0.03, 0.27), k < 0.5 ? M.h2rMatte : M.h2rAlu, { name: 'h2r-triple-clamp' });
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    c.position.copy(AXLE_F).addScaledVector(up, k + 0.02).add(new THREE.Vector3(-0.03, 0, 0));
    inner.add(c);
  }
  // Clip-on bars to the grips (out to ±0.36 m), levers, the master cylinder's gold reservoir.
  for (const side of [-1, 1]) {
    const A = T(-300, 880, side * 0.11), B = T(-346, 885, side * 0.36);
    inner.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 10).applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1)), M.h2rMatte, { name: 'h2r-bar' }));
    const bar = inner.children[inner.children.length - 1];
    bar.applyMatrix4(segMatrix(A, B, 1)); bar.geometry = new THREE.CylinderGeometry(0.011, 0.011, 1, 10);
    const grip = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.13, 14), M.h2rRubber, { name: 'h2r-grip' });
    grip.applyMatrix4(segMatrix(T(-330, 883, side * 0.27), T(-350, 886, side * 0.38), 1));
    grip.geometry = new THREE.CylinderGeometry(0.017, 0.017, 1, 14);
    inner.add(grip);
    const lever = mesh(new THREE.BoxGeometry(0.012, 0.008, 0.17), M.h2rAlu, { name: 'h2r-lever' });
    lever.position.copy(T(-280, 870, side * 0.29)); lever.rotation.y = side * 0.2; inner.add(lever);
  }
  const res = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.045, 14), M.h2rGold, { name: 'h2r-reservoir' });
  res.position.copy(T(-215, 950, 0.13)); inner.add(res);
  // The front fender, black, hugging the tyre over its front and top (traced: from ≈56° to
  // ≈110° above the axle's horizontal), with a short beak ahead.
  {
    const R = RF + 0.03, a0 = 45 * D2R, a1 = 118 * D2R;
    const geo = new THREE.CylinderGeometry(R, R, 0.13, 32, 1, true, a0 + Math.PI / 2, a1 - a0);
    const f = mesh(geo, M.h2rBlack, { name: 'h2r-fender' });
    f.rotation.x = Math.PI / 2;
    f.position.copy(AXLE_F);
    inner.add(f);
  }
  // The wheel, spinning.
  inner.add(buildWheel(M, 'f'));
  return g;
}

/** A wheel: slick, black rim with machined lips and spokes, discs (front: two; rear: one, left). */
function buildWheel(M, which) {
  const front = which === 'f';
  const W = front ? WHEELS.front : WHEELS.rear;
  const g = new THREE.Group();
  g.name = `h2r-wheel-${which}`;
  g.position.copy(front ? AXLE_F : AXLE_R);
  const R = W.dia / 2, rim = W.rimDia / 2, hw = W.width / 2, bead = front ? 0.044 : 0.076;   // rims ≈17 × 3.50 and 17 × 6.00
  // The tyre's section: round crown, sidewalls down to the bead.
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = -Math.PI / 2 + Math.PI * i / 24;
    prof.push(new THREE.Vector2(R - (R - rim - 0.012) * (1 - Math.cos(t)) * 0.55 - (Math.abs(Math.sin(t)) > 0.95 ? 0.02 : 0), Math.sin(t) * hw));
  }
  prof.unshift(new THREE.Vector2(rim + 0.005, -bead)); prof.push(new THREE.Vector2(rim + 0.005, bead));
  const tyre = mesh(new THREE.LatheGeometry(prof, 64), M.h2rTyre, { name: `h2r-tyre-${which}` });
  tyre.rotation.x = Math.PI / 2;
  g.add(tyre);
  const spin = new THREE.Group();
  spin.name = `h2r-wheel-${which}-spin`;
  g.add(spin);
  // Rim barrel and lips.
  const barrel = mesh(new THREE.CylinderGeometry(rim, rim, bead * 2, 48, 1, true), M.h2rRim, { name: 'h2r-rim' });
  barrel.rotation.x = Math.PI / 2; spin.add(barrel);
  for (const s of [-1, 1]) {
    const lip = mesh(new THREE.TorusGeometry(rim + 0.004, 0.005, 6, 64), M.h2rMachined, { name: 'h2r-rim-lip' });
    lip.position.z = s * bead; spin.add(lip);
  }
  // Spokes: five, each a pair (the front's split spokes, the rear's open star), black with a machined edge.
  const items = [], edges = [];
  for (let i = 0; i < 5; i++) {
    for (const d of [-1, 1]) {
      const a0 = (i / 5) * TAU + d * (front ? 0.05 : 0.07), a1 = (i / 5) * TAU + d * (front ? 0.13 : 0.22);
      const A = new THREE.Vector3(Math.cos(a0) * 0.045, Math.sin(a0) * 0.045, front ? 0 : -0.01);
      const B = new THREE.Vector3(Math.cos(a1) * (rim - 0.005), Math.sin(a1) * (rim - 0.005), 0);
      items.push({ geometry: new THREE.BoxGeometry(1, 1, 1), matrix: new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize()), new THREE.Vector3(A.distanceTo(B), front ? 0.016 : 0.03, front ? 0.03 : 0.05)) });
      const E = A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, 0, (front ? 0.015 : 0.0225) + 0.001));
      edges.push({ geometry: new THREE.BoxGeometry(1, 1, 1), matrix: new THREE.Matrix4().compose(E, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize()), new THREE.Vector3(A.distanceTo(B) * 0.85, 0.004, 0.002)) });
    }
  }
  spin.add(mesh(mergeAll(items), M.h2rRim, { name: 'h2r-spokes' }));
  spin.add(mesh(mergeAll(edges), M.h2rMachined, { name: 'h2r-spoke-edges' }));
  const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, front ? 0.11 : 0.16, 24), M.h2rRim, { name: 'h2r-hub' });
  hub.rotation.x = Math.PI / 2; spin.add(hub);
  const nut = mesh(new THREE.CylinderGeometry(0.022, 0.022, front ? 0.24 : 0.2, 6), M.h2rAlu, { name: 'h2r-axle-nut' });
  nut.rotation.x = Math.PI / 2; spin.add(nut);
  // Discs: the braking band with its holes, on a black carrier.
  const discs = front ? [[0.165, 0.123, -0.085], [0.165, 0.123, 0.085]] : [[0.125, 0.09, -0.07]];
  for (const [ro, ri, z] of discs) {
    const band = mesh(new THREE.RingGeometry(ri, ro, 64, 1), M.h2rDisc, { name: 'h2r-disc' });
    // RingGeometry's UVs map the square round the ring, as the alpha map expects.
    band.position.z = z; spin.add(band);
    const carrier = mesh(new THREE.RingGeometry(0.05, ri + 0.004, 10, 1), M.h2rRim, { name: 'h2r-disc-carrier' });
    carrier.position.z = z - Math.sign(z) * 0.002; spin.add(carrier);
  }
  if (!front) {
    // The 42-tooth sprocket on the left, and the hub's big machined nut on the right face.
    const spr = mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.006, 42), M.h2rAlu, { name: 'h2r-sprocket' });
    spr.rotation.x = Math.PI / 2; spr.position.z = -0.1; spin.add(spr);
  }
  return g;
}

/** The single-sided swingarm (left), the shock's hidden; the rear wheel on its end. */
function buildSwingarm(M) {
  const g = new THREE.Group();
  g.name = 'h2r-swingarm';
  g.position.copy(PIVOT);
  const inner = new THREE.Group();
  inner.position.copy(PIVOT).negate();
  g.add(inner);
  // The arm in side view (traced): deep at the pivot, tapering to a round boss round the hub.
  const shape = new THREE.Shape();
  const P = [[-861, 415], [-1000, 430], [-1200, 395], [-1380, 375]];
  shape.moveTo(P[0][0] / 1000 + AX, P[0][1] / 1000);
  for (const p of P.slice(1)) shape.lineTo(p[0] / 1000 + AX, p[1] / 1000);
  shape.absarc(AXLE_R.x, AXLE_R.y, 0.075, Math.PI * 0.6, -Math.PI * 0.6, true);
  for (const p of [[-1380, 262], [-1200, 262], [-1000, 285], [-861, 265]]) shape.lineTo(p[0] / 1000 + AX, p[1] / 1000);
  const arm = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 }), M.h2rBlack, { name: 'h2r-swingarm-beam' });
  arm.position.z = -0.19;
  inner.add(arm);
  const cross = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16), M.h2rBlack, { name: 'h2r-pivot' });
  cross.rotation.x = Math.PI / 2; cross.position.copy(PIVOT); inner.add(cross);
  // The chain: a loop from the gearbox sprocket to the wheel's.
  const front = T(-790, 360, -0.1), back = AXLE_R.clone().setZ(-0.1);
  const r0 = 0.046, r1 = 0.106;
  const pts = [];
  const dir = new THREE.Vector3().subVectors(back, front).normalize();
  const nrm = new THREE.Vector3(-dir.y, dir.x, 0);
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + Math.PI * i / 16; const v = new THREE.Vector3(Math.cos(a), Math.sin(a), 0); pts.push(front.clone().addScaledVector(nrm, r0 * v.y).addScaledVector(dir, r0 * v.x)); }
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * i / 16; const v = new THREE.Vector3(Math.cos(a), Math.sin(a), 0); pts.push(back.clone().addScaledVector(nrm, r1 * v.y).addScaledVector(dir, r1 * v.x)); }
  inner.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.006, 6, true), M.h2rChain, { name: 'h2r-chain' }));
  // The Öhlins shock's gold spring, seen through the frame.
  const spring = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 24), M.h2rGold, { name: 'h2r-shock-spring' });
  spring.position.copy(T(-930, 470)); inner.add(spring);
  inner.add(buildWheel(M, 'r'));
  // The hugger over the rear tyre, black.
  const hug = mesh(new THREE.CylinderGeometry(RR + 0.025, RR + 0.025, 0.21, 32, 1, true, (70 + 90) * D2R, 65 * D2R), M.h2rMatte, { name: 'h2r-hugger' });
  hug.rotation.x = Math.PI / 2; hug.position.copy(AXLE_R); inner.add(hug);
  return g;
}
