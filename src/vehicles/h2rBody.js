/**
 * The Ninja H2R's bodywork as lofted sections. Each part is a run of cross-sections at stations
 * along the bike; each section a polyline from the centre line round the right side (mirrored
 * for the left), given in the side photograph's pixels (u forward-to-back, v down) for x and y —
 * the outline is the photograph's — and metres for the half-widths, fitted against the
 * three-quarter photograph through its calibrated camera.
 */
import * as THREE from 'three';
import { loft, mesh, mirrorZ, mergeAll, canvasTexture } from './h2rParts.js';

/** Side-photograph pixel → model metres (x forward from the wheelbase's middle, y up). */
// (The side camera, fitted with the three-quarter one to the published wheelbase, tyre sizes and
// height: ≈559 px/m, 82 m away; this is its inverse on the centre plane.)
export const PXY = (u, v) => [-0.0017884 * (u - 640.576) + -0.0000028 * (v - 809.183), 0.0000023 * (u - 640.576) + -0.0017895 * (v - 809.183)];
export const PX = (u, v = 400) => PXY(u, v)[0];
export const PY = (v, u = 600) => PXY(u, v)[1];

/**
 * A part from its station table: rows of [u, [[v, z], [v, z], …]] — the same number of points in
 * every row, from the top centre line (z = 0) down the right side. Returns one mesh per material
 * span: spans = [[from, to, material, name], …] index ranges into the section's points.
 */
export function part(rows, spans, { steps = 4, mirror = true, creaseDeg = 30, closeTop = true } = {}) {
  const meshes = [];
  for (const [a, b, mat, name] of spans) {
    const secs = rows.map(([u, pts]) => pts.slice(a, b + 1).map(([v, z]) => [...PXY(u, v), z]));
    let g = loft(secs, { steps, creaseDeg });
    if (mirror) {
      const L = mirrorZ(g);
      g = mergeAll([{ geometry: g }, { geometry: L }]);
      g = withNormals(g, creaseDeg);
    }
    meshes.push(mesh(g, mat, { name }));
  }
  return meshes;
}
import { withCreaseNormals } from './h2rParts.js';
function withNormals(g, deg) { return withCreaseNormals(g, deg); }

/** Linear interpolation in a [[u, value], …] table. */
export function lerpTable(t, u) {
  if (u <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (u <= t[i][0]) { const k = (u - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * k; }
  return t[t.length - 1][1];
}

/** The silhouette's top in the side photograph (v px), every 15 px of u (measured). */
const TOP = [[460, 290], [475, 280], [490, 271], [505, 264], [520, 257], [535, 254], [550, 254], [565, 245], [580, 244], [595, 243], [610, 243], [625, 244], [640, 245], [655, 253], [670, 263], [685, 274], [700, 286], [715, 298], [730, 314], [745, 336], [760, 345], [775, 348], [790, 348], [805, 348], [820, 346], [835, 344], [850, 342], [865, 338], [880, 335], [895, 302], [910, 286], [925, 276], [940, 271], [955, 252], [970, 247], [985, 246], [1000, 244], [1015, 243], [1030, 243], [1060, 243], [1090, 243], [1105, 244]];
export const topV = (u) => lerpTable(TOP, u);

export function buildTank(M) {
  // Stations: u, the mirror-coat top's lower edge (v), the black side's lower edge on the frame rail
  // (v), the half-widths at the top's edge and at the side's foot (m).
  const S = [
    [462, 300, 345, 0.08, 0.10],
    [485, 297, 356, 0.11, 0.115],
    [515, 300, 368, 0.135, 0.125],
    [550, 302, 378, 0.15, 0.13],
    [590, 303, 388, 0.158, 0.13],
    [630, 304, 397, 0.158, 0.13],
    [670, 305, 405, 0.15, 0.125],
    [705, 310, 412, 0.138, 0.12],
    [730, 322, 418, 0.125, 0.115],
    [748, 340, 420, 0.115, 0.11],
  ];
  const rows = S.map(([u, vc, vb, zc, zb]) => {
    const vt = topV(u), h = Math.max(4, vc - vt);
    return [u, [[vt, 0], [vt + 0.08 * h, 0.4 * zc], [vt + 0.3 * h, 0.8 * zc], [vt + 0.7 * h, 0.97 * zc], [vc, zc], [vc + 0.3 * (vb - vc), zc * 0.98], [vb, zb]]];
  });
  const g = new THREE.Group(); g.name = 'h2r-tank';
  g.add(...part(rows, [[0, 4, M.h2rChrome, 'h2r-tank-top'], [4, 6, M.h2rBlack, 'h2r-tank-side']], { creaseDeg: 24 }));
  return g;
}

export function buildSeatTail(M) {
  const g = new THREE.Group(); g.name = 'h2r-seat-tail';
  // The seat: from the tank's back to the hump, ≈250 mm wide, its base on the subframe.
  const seat = [
    [745, 0.10, 0.12, 380], [770, 0.12, 0.13, 384], [800, 0.125, 0.13, 384], [830, 0.12, 0.125, 382], [860, 0.11, 0.12, 380], [888, 0.10, 0.11, 378],
  ].map(([u, z1, z2, vb]) => { const vt = topV(u); return [u, [[vt, 0], [vt + 2, z1 * 0.6], [vt + 6, z1], [vt + 14, z2], [vb, z2 * 0.95]]]; });
  g.add(...part(seat, [[0, 4, M.h2rSeat, 'h2r-seat']]));
  // The tail: the pillion cowl's hump and the long tapering tail to the tip, black underneath, a
  // mirror-coat side panel (stations: u, top v, lower edge v, half-width at the top shoulder and at
  // the lower edge).
  const LOW = [[888, 420], [910, 412], [927, 400], [953, 387], [980, 368], [1007, 347], [1030, 322], [1050, 300], [1070, 285], [1090, 273], [1105, 258], [1112, 250]];
  const tail = [
    [890, 0.10, 0.115], [905, 0.105, 0.12], [925, 0.105, 0.12], [950, 0.10, 0.115], [975, 0.092, 0.105], [1000, 0.082, 0.095], [1025, 0.07, 0.08], [1050, 0.058, 0.066], [1075, 0.045, 0.05], [1095, 0.03, 0.034], [1108, 0.012, 0.014],
  ].map(([u, z1, z2]) => { const vt = Math.min(topV(u), u > 890 && u < 960 ? topV(u) : topV(u)), vb = lerpTable(LOW, u), h = vb - vt; return [u, [[vt, 0], [vt + 0.04 * h, z1 * 0.7], [vt + 0.12 * h, z1], [vt + 0.5 * h, z2], [vb - 0.08 * h, z2 * 0.9], [vb, z2 * 0.4]]]; });
  // Sharp-edged sections: the tail is pressed in flat facets (the right-side photograph).
  const tparts = part(tail, [[0, 5, M.h2rBlack, 'h2r-tail']], { creaseDeg: 14 });
  g.add(...tparts);
  // The mirror-coat wedge on the tail's side, the black inlay above it, the red lamp at the tip.
  g.add(skin([[905, 360], [960, 300], [1000, 290], [1060, 272], [1100, 258], [1050, 300], [1000, 340], [945, 385], [895, 418], [870, 430]], tparts[0], { mat: M.h2rChrome, name: 'h2r-tail-panel' }));
  g.add(skin([[1046, 276], [1100, 258], [1108, 252], [1062, 292], [1048, 300]], tparts[0], { mat: M.h2rTail, name: 'h2r-tail-lamp', proud: 0.003 }));
  // The black side cover under the seat's front, between the tank and the tail.
  g.add(sidePatch([[745, 382], [800, 380], [860, 372], [895, 365], [905, 362], [880, 410], [810, 420], [748, 425]].map(([u, v]) => [u, v, 0.11 + (v < 400 ? 0.015 : 0) - (u - 745) * 0.00005]), { mat: M.h2rBlack, name: 'h2r-side-cover' }));
  return g;
}

/**
 * A panel seen from the side: its outline in the side photograph's pixels with a half-width at each
 * vertex ([u, v, z]), and optional interior control points; the surface between is a smooth
 * interpolation of those half-widths (inverse-distance weighted, ≈ a thin sheet pulled to them),
 * finely triangulated. Mirrored to the left. `flip` turns it to face inwards (a recess's floor).
 */
export function sidePatch(outline, { inner = [], mat, name, levels = 3, mirror = true, power = 2.2, flip = false, offset = 0 }) {
  const ctrl = [...outline, ...inner];
  const pts = outline.map(([u, v]) => new THREE.Vector2(u, v));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  let faces = THREE.ShapeUtils.triangulateShape(pts, []).map(t => t.map(i => [pts[i].x, pts[i].y]));
  for (let l = 0; l < levels; l++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  const zAt = (u, v) => {
    let sw = 0, sz = 0;
    for (const [cu, cv, cz] of ctrl) {
      const d2 = (u - cu) ** 2 + (v - cv) ** 2;
      if (d2 < 1e-6) return cz;
      const w = 1 / d2 ** (power / 2); sw += w; sz += w * cz;
    }
    return sz / sw;
  };
  const pos = [];
  for (const f of faces) {
    const tri = flip ? [f[0], f[2], f[1]] : f;
    for (const [u, v] of tri) { const [x, y] = PXY(u, v); pos.push(x, y, zAt(u, v) + offset); }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 3, pos[i + 1] * 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // The outline as seen from the side faces +z (the right side, outwards): wind accordingly.
  g = withCreaseNormals(g, 40);
  if (mirror) g = withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), 40);
  return mesh(g, mat, { name });
}

/**
 * The fairing (the side photograph for the outlines; half-widths fitted on the three-quarter one,
 * the panel's bolts and front tip triangulated in both): the mirror-coat side panel in its three
 * facets (the upper one with "Ninja H2R", the narrow dark one folding under it, the big lower one),
 * the carbon of the upper cowl's side, the screen, the eye ducts and the chin.
 */
export function buildFairing(M) {
  const g = new THREE.Group(); g.name = 'h2r-fairing';
  // The side panel, upper facet.
  g.add(sidePatch([[188, 383, 0.167], [213, 372, 0.19], [270, 362, 0.222], [313, 360, 0.24], [357, 365, 0.255], [403, 378, 0.265], [457, 402, 0.268], [500, 417, 0.262],
    [450, 404, 0.296], [403, 391, 0.303], [345, 400, 0.288], [287, 410, 0.258]], { mat: M.h2rChrome, name: 'h2r-panel-upper' }));
  // The narrow facet folding down and in under it.
  g.add(sidePatch([[287, 410, 0.258], [345, 400, 0.288], [403, 391, 0.303], [450, 404, 0.296], [500, 417, 0.262], [500, 427, 0.30], [400, 419, 0.31], [287, 410, 0.258]].slice(0, 7), { mat: M.h2rChrome, name: 'h2r-panel-fold' }));
  // The big lower facet.
  g.add(sidePatch([[188, 383, 0.167], [287, 410, 0.258], [400, 419, 0.31], [500, 427, 0.30], [488, 455, 0.29], [437, 487, 0.275], [380, 506, 0.25], [330, 520, 0.225], [290, 470, 0.205], [240, 430, 0.18]],
    { inner: [[350, 460, 0.28]], mat: M.h2rChrome, name: 'h2r-panel-lower' }));
  // The upper cowl's carbon side: from the screen's base and the wing's root down to the panel.
  g.add(sidePatch([[146, 360, 0.03], [165, 342, 0.07], [200, 316, 0.11], [240, 290, 0.14], [280, 262, 0.16], [320, 250, 0.18], [370, 268, 0.2], [430, 312, 0.22], [480, 360, 0.23], [520, 395, 0.235],
    [500, 417, 0.262], [457, 402, 0.268], [403, 378, 0.265], [357, 365, 0.255], [313, 360, 0.24], [270, 362, 0.222], [213, 372, 0.19], [188, 383, 0.167], [172, 375, 0.12], [160, 372, 0.08]],
    { inner: [[300, 320, 0.215], [400, 330, 0.235]], mat: M.h2rCarbon, name: 'h2r-cowl-side' }));
  // The chin below the beak, carbon, down to the lower fin.
  g.add(sidePatch([[141, 370, 0.02], [160, 372, 0.08], [172, 375, 0.12], [188, 383, 0.167], [240, 430, 0.18], [210, 405, 0.13], [192, 405, 0.10], [170, 395, 0.06]], { mat: M.h2rCarbon, name: 'h2r-chin' }));
  // The lower fin: a carbon blade pointing forward and down from the chin.
  g.add(sidePatch([[172, 404, 0.13], [202, 406, 0.16], [249, 419, 0.2], [222, 436, 0.19], [161, 434, 0.15]], { mat: M.h2rCarbon, name: 'h2r-fin-lower', offset: 0.004 }));
  // The eye: the duct's dark mesh-lined recess either side of the beak.
  g.add(sidePatch([[152, 357, 0.05], [172, 356, 0.08], [212, 360, 0.13], [205, 374, 0.12], [172, 376, 0.1], [156, 368, 0.05]], { mat: M.h2rVoid, name: 'h2r-eye' }));
  g.add(buildScreen(M));
  return g;
}

export function buildScreen(M) { return buildScreen0(M); }
/** The screen: a smoked bubble from the beak to its top, wrapping round to its lower side edges. */
function buildScreen0(M) {
  // A light smoke (the photographs: the dash and the bars read through it). Its outside is glossy;
  // its inside, the face the rider looks through, is drawn as plain tint with no reflection: a
  // double-sided glossy sheet mirrored the bright sky back at the rider and read milky white.
  M.h2rScreen ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-screen', color: 0x1b1f23, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.FrontSide, envMapIntensity: 0.8 });
  M.h2rScreenIn ??= new THREE.MeshBasicMaterial({ name: 'h2r-screen-inside', color: 0x0d1013, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.BackSide });
  const rows = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, c = lerp3(SCREEN_C0, SCREEN_C1, t), e = alongPolyline(SCREEN_EDGE, t);
    const sec = [];
    for (let k = 0; k <= 8; k++) {
      const a = k / 8, f = a ** 1.8;
      sec.push([c[0] + (e[0] - c[0]) * f, c[1] + (e[1] - c[1]) * f, e[2] * Math.sin(a * Math.PI / 2)]);
    }
    rows.push(sec);
  }
  let geo = loft(rows, { steps: 3 });
  geo = mergeAll([{ geometry: geo }, { geometry: mirrorZ(geo) }]);
  const out = mesh(geo, M.h2rScreen, { name: 'h2r-screen' });
  out.add(mesh(geo, M.h2rScreenIn, { name: 'h2r-screen-inside' }));
  out.castShadow = false;
  // The black mounting strips along its side edges, with their screws (the head-on photograph).
  const strip = [], screws = [];
  for (let i = 0; i <= 10; i++) {
    const t = 0.25 + 0.75 * i / 10, e = alongPolyline(SCREEN_EDGE, t), c = lerp3(SCREEN_C0, SCREEN_C1, t);
    const d = new THREE.Vector3(c[0] - e[0], c[1] - e[1], -e[2]).normalize();
    const lift = [0.0015, 0.003, 0.002];
    strip.push([e[0] + lift[0], e[1] + lift[1], e[2] + lift[2]], [e[0] + d.x * 0.016 + lift[0], e[1] + d.y * 0.016 + lift[1], e[2] + d.z * 0.016 + lift[2]]);
    if (i % 2 === 1) screws.push([e[0] + d.x * 0.008, e[1] + d.y * 0.008 + 0.005, e[2] + d.z * 0.008 + 0.003]);
  }
  const polys = []; for (let i = 0; i < 10; i++) polys.push([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1]);
  out.add(facets(strip, polys, twoSided(M, 'h2rBlack2', M.h2rBlack, 'h2r-black-2s'), 'h2r-screen-strip'));
  const sg = screws.map(([x, y, z]) => ({ geometry: new THREE.SphereGeometry(0.0035, 8, 6).translate(x, y, z) }));
  const sm = mergeAll([...sg, ...sg.map(({ geometry }) => ({ geometry: mirrorZ(geometry) }))]);
  out.add(mesh(sm, M.h2rAlu ?? M.h2rBlack, { name: 'h2r-screen-screws' }));
  return out;
}
/**
 * The screen (the right-side and head-on photographs, triangulated): its centre line from under the
 * nose to the top (1.152 m, the published 1.160 m overall with the rubber edge), and its side edge,
 * the black strip, from the top corner (0.472, 1.08) m, 0.161 m out — the screen widens upwards —
 * down to (0.669, 0.955) m, 0.087 m out, where it passes under the nose's carbon, and on under it.
 */
const SCREEN_C0 = [0.830, 0.860, 0], SCREEN_C1 = [0.463, 1.157, 0];
const SCREEN_EDGE = [[0.80, 0.874, 0.074], [0.669, 0.955, 0.088], [0.57, 1.018, 0.125], [0.472, 1.080, 0.162]];
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function alongPolyline(P, t) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(...P[i].map((v, k) => v - P[i - 1][k])));
  const d = t * L[L.length - 1];
  for (let i = 1; i < P.length; i++) if (d <= L[i] || i === P.length - 1) return lerp3(P[i - 1], P[i], Math.min(1, (d - L[i - 1]) / (L[i] - L[i - 1])));
  return P[P.length - 1];
}

/**
 * The carbon upper cowl, in metres (the right-side and head-on photographs triangulated, ≈ ±2 cm),
 * in three runs of sections so that its sharp places stay sharp:
 *  - the nose, from the beak (0.898, 0.79) m up to the screen's base (0.70, 0.96) m: a V-topped
 *    ridge whose edges carry the green pinstripes, falling outwards to the crease over the eyes;
 *  - the cowl's side behind it, low over the side panel and running back to the frame (as first
 *    traced);
 *  - the horns, strips from the screen's base up its side edges to its top corners
 *    (0.474, 1.079) m, 0.17–0.21 m out.
 * Rows: [inner edge, outer shoulder, side, crease], each point [x, y, z].
 */
function buildCowl(M) {
  const nose = [
    [[0.898, 0.792, 0], [0.898, 0.790, 0.012], [0.897, 0.787, 0.020], [0.895, 0.782, 0.026]],
    [[0.875, 0.812, 0], [0.875, 0.808, 0.036], [0.873, 0.795, 0.070], [0.872, 0.779, 0.072]],
    [[0.840, 0.842, 0], [0.840, 0.837, 0.050], [0.838, 0.818, 0.120], [0.840, 0.787, 0.118]],
    [[0.800, 0.876, 0], [0.800, 0.871, 0.064], [0.800, 0.850, 0.160], [0.795, 0.800, 0.190]],
    [[0.750, 0.919, 0], [0.750, 0.914, 0.078], [0.755, 0.893, 0.190], [0.750, 0.795, 0.205]],
    [[0.700, 0.962, 0], [0.700, 0.957, 0.090], [0.700, 0.935, 0.196], [0.700, 0.792, 0.218]],
  ];
  // The cowl's side behind the nose: low, so the cockpit shows above it from the side (the right-side
  // photograph: the bars and reservoirs between the screen's edge and the panel).
  const side = [
    [[0.700, 0.900, 0.195], [0.700, 0.890, 0.205], [0.700, 0.840, 0.214], [0.700, 0.792, 0.218]],
    [[0.580, 0.890, 0.200], [0.580, 0.885, 0.222], [0.580, 0.840, 0.240], [0.575, 0.799, 0.250]],
    [[0.466, 0.879, 0.150], [0.466, 0.870, 0.180], [0.466, 0.840, 0.225], [0.466, 0.773, 0.265]],
    [[0.359, 0.818, 0.180], [0.359, 0.811, 0.200], [0.359, 0.786, 0.240], [0.359, 0.732, 0.268]],
    [[0.216, 0.746, 0.210], [0.216, 0.741, 0.220], [0.216, 0.727, 0.240], [0.216, 0.700, 0.250]],
  ];
  // The horns: strips along the screen's side edges, ≈5 cm wide at the top corners and ≈10 cm low
  // down (head-on), ≈3–4 cm seen from the side, with a 1.5 cm return at their outer edge.
  const horn = [
    [[0.700, 0.957, 0.090], [0.700, 0.935, 0.196], [0.700, 0.920, 0.198]],
    [[0.640, 0.975, 0.104], [0.640, 0.968, 0.201], [0.640, 0.953, 0.203]],
    [[0.570, 1.019, 0.130], [0.580, 1.010, 0.206], [0.580, 0.995, 0.208]],
    [[0.520, 1.050, 0.148], [0.530, 1.043, 0.209], [0.530, 1.028, 0.211]],
    [[0.474, 1.079, 0.166], [0.484, 1.073, 0.212], [0.484, 1.058, 0.214]],
  ];
  const carbon2 = twoSided(M, 'h2rCarbon2', M.h2rCarbon, 'h2r-carbon-2s');
  const run = (rows, steps) => { const g = loft(rows, { steps, creaseDeg: 35 }); return withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), 35); };
  const g = new THREE.Group(); g.name = 'h2r-cowl-group';
  const cowl = mesh(mergeAll([{ geometry: run(nose, 3) }, { geometry: run(side, 4) }]), carbon2, { name: 'h2r-cowl' });
  g.add(cowl);
  g.add(mesh(run(horn, 3), carbon2, { name: 'h2r-cowl-horn' }));
  return g;
}

/** The green pinstripes along the nose's V and the horns (the photographs), laid on the cowl. */
function buildPinstripe(M, cowl) {
  const ray = new THREE.Raycaster(); cowl.updateMatrixWorld(true);
  const line = [[0.50, 0.195], [0.601, 0.160], [0.70, 0.112], [0.794, 0.072], [0.85, 0.052], [0.885, 0.030]];
  const pts = [];
  for (const [x, z] of line) for (const dz of [0.003, -0.003]) {
    ray.set(new THREE.Vector3(x, 2, z + dz), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(cowl, true)[0];
    pts.push([x, (hit ? hit.point.y : 0.9) + 0.002, z + dz]);
  }
  const lp = []; for (let i = 0; i < line.length - 1; i++) lp.push([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1]);
  return facets(pts, lp, M.h2rPinGreen, 'h2r-pinstripe-cowl');
}

/**
 * A skin: a panel's outline in the side photograph's pixels, laid on a base surface by casting each
 * of its (finely subdivided) points across the bike onto it from the right (and mirrored), 1.5 mm
 * proud. The base's own colour shows where no skin lies: panels meet the volume exactly.
 */
const _ray = new THREE.Raycaster();
export function skin(outline, base, { mat, name, levels = 3, proud = 0.0015, mirror = true }) {
  const pts = outline.map(([u, v]) => new THREE.Vector2(u, v));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  let faces = THREE.ShapeUtils.triangulateShape(pts, []).map(t => t.map(i => [pts[i].x, pts[i].y]));
  for (let l = 0; l < levels; l++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  const targets = Array.isArray(base) ? base : [base];
  for (const t of targets) t.updateMatrixWorld(true);
  const cache = new Map();
  const hit = (u, v) => {
    const k = `${u.toFixed(2)},${v.toFixed(2)}`;
    if (cache.has(k)) return cache.get(k);
    const [x, y] = PXY(u, v);
    _ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
    const h = _ray.intersectObjects(targets, false).filter(i => i.point.z >= -0.001)[0];
    const r = h ? [h.point.x, h.point.y, h.point.z + proud * Math.max(0.3, h.face.normal.z)] : null;
    cache.set(k, r);
    return r;
  };
  const pos = [];
  for (const f of faces) {
    const P = f.map(([u, v]) => hit(u, v));
    if (P.some(p => !p)) continue;
    for (const p of P) pos.push(...p);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 3, pos[i + 1] * 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g = withCreaseNormals(g, 40);
  if (mirror) g = withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), 40);
  return mesh(g, mat, { name });
}

/**
 * A base volume from stations: rows of [u, [[v, z], …]] from the top (inner) edge round the right
 * side to the lower edge; mirrored; double-sided so the open inside reads as the panels' dark
 * backs.
 */
export function shell(rows, mat, name, { steps = 4, creaseDeg = 50, mirror = true } = {}) {
  const secs = rows.map(([u, pts]) => pts.map(([v, z]) => [...PXY(u, v), z]));
  let g = loft(secs, { steps, creaseDeg });
  if (mirror) g = withCreaseNormals(mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]), creaseDeg);
  const m = mesh(g, mat, { name });
  return m;
}

/**
 * The fairing as one carbon shell (stations on the side photograph, half-widths on the three-quarter
 * one: the panel's bolts at 0.26–0.31 m, its front tip at 0.17 m), open behind the screen where the
 * cockpit is, with the mirror-coat panels laid on it as skins.
 */
export function buildFairing2(M) {
  const g = new THREE.Group(); g.name = 'h2r-fairing';
  // [u, [[v, z] from the inner top edge round to the lower edge]]
  const rows = [
    [141, [[362, 0.0], [364, 0.012], [368, 0.018], [372, 0.012], [376, 0.0]]],
    [160, [[343, 0.0], [350, 0.045], [362, 0.07], [376, 0.075], [392, 0.05]]],
    [185, [[326, 0.0], [334, 0.06], [352, 0.11], [383, 0.165], [410, 0.12]]],
    [215, [[311, 0.0], [320, 0.07], [342, 0.14], [376, 0.19], [425, 0.17]]],
    [255, [[289, 0.0], [298, 0.08], [325, 0.17], [366, 0.222], [455, 0.2]]],
    [300, [[266, 0.04], [278, 0.1], [312, 0.19], [362, 0.244], [488, 0.215]]],
    [345, [[250, 0.09], [262, 0.13], [300, 0.21], [372, 0.262], [515, 0.226]]],
    [395, [[262, 0.13], [272, 0.155], [302, 0.215], [385, 0.286], [500, 0.27]]],
    [440, [[300, 0.15], [310, 0.17], [335, 0.22], [398, 0.3], [478, 0.282]]],
    [485, [[345, 0.17], [352, 0.19], [372, 0.23], [412, 0.29], [455, 0.27]]],
    [515, [[385, 0.21], [392, 0.22], [402, 0.24], [418, 0.262], [432, 0.25]]],
  ];
  const base = shell(rows, M.h2rCarbon, 'h2r-fairing-shell', { steps: 5 });
  base.material = M.h2rCarbon;
  g.add(base);
  // Mirror-coat panels: the upper facet with "Ninja H2R", and the big lower one.
  g.add(skin([[188, 383], [213, 372], [270, 362], [313, 360], [357, 365], [403, 378], [457, 402], [500, 417], [450, 404], [403, 391], [345, 400], [287, 410]], base, { mat: M.h2rChrome, name: 'h2r-panel-upper' }));
  g.add(skin([[190, 386], [287, 412], [345, 403], [403, 394], [450, 407], [498, 422], [488, 455], [437, 487], [380, 506], [335, 518], [292, 470], [240, 430]], base, { mat: M.h2rChrome, name: 'h2r-panel-lower' }));
  // The eye: the duct's dark mesh-lined opening either side of the beak.
  g.add(skin([[152, 357], [172, 356], [212, 360], [205, 374], [172, 376], [156, 368]], base, { mat: M.h2rVoid, name: 'h2r-eye' }));
  // The lower fin, carbon, standing off the chin.
  g.add(sidePatch([[172, 404, 0.13], [202, 406, 0.16], [249, 419, 0.2], [222, 436, 0.19], [161, 434, 0.15]], { mat: M.h2rCarbon, name: 'h2r-fin-lower' }));
  g.add(buildScreen(M));
  return g;
}

/**
 * The fairing as Kawasaki builds it: the carbon upper cowl (a narrow nose rising under the screen,
 * its sides running back above the side panel to the frame), and the mirror-coat side panel, a
 * separate shell with a crease along it (the photographs), standing out 0.17 m at its front tip and
 * 0.31 m at its rear. Below the panel the fairing is open on the radiator.
 */
export function buildFairing3(M) {
  const g = new THREE.Group(); g.name = 'h2r-fairing';
  const cowl = buildCowl(M);
  g.add(cowl);
  const panel = shell([
    // [top edge, crease (the upper facet's fold), lower edge tucked in] — angular, as pressed.
    // (Its front tip ≈4 cm further back and ≈5 cm further out than first traced: the right-side
    // and head-on photographs, triangulated, put it behind the eye's outer end.)
    [210, [[386, 0.200], [388, 0.208], [390, 0.198]]],
    [232, [[376, 0.210], [397, 0.224], [410, 0.185]]],
    [260, [[366, 0.222], [404, 0.252], [446, 0.18]]],
    [310, [[360, 0.242], [410, 0.284], [488, 0.17]]],
    [360, [[364, 0.256], [414, 0.302], [512, 0.18]]],
    [410, [[380, 0.266], [418, 0.312], [505, 0.2]]],
    [460, [[403, 0.268], [422, 0.306], [483, 0.23]]],
    [498, [[417, 0.262], [427, 0.295], [455, 0.25]]],
  ], M.h2rChrome, 'h2r-side-panel', { steps: 5, creaseDeg: 12 });
  g.add(panel);
  g.add(buildNose(M));
  g.add(buildPinstripe(M, cowl));
  g.userData.panel = panel;
  g.add(buildWings(M));
  g.add(buildScreen(M));
  return g;
}

/**
 * Flat-faceted pieces from vertices (right side, metres) and polygons of vertex indices, mirrored
 * to the left: the H2R's fairing is pressed in planes meeting at sharp creases, and flat shading
 * per facet reads as it does.
 */
function facets(V, polys, mat, name) {
  const pos = [];
  for (const poly of polys) for (let i = 1; i < poly.length - 1; i++) for (const k of [poly[0], poly[i], poly[i + 1]]) pos.push(...V[k]);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 3 + pos[i + 2] * 3, pos[i + 1] * 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g = mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]);
  g.computeVertexNormals();
  return mesh(g, mat, { name });
}
const twoSided = (M, key, base, name) => { if (!M[key]) { M[key] = base.clone(); M[key].side = THREE.DoubleSide; M[key].name = name; } return M[key]; };

/**
 * The nose below the carbon cowl's crease, as the head-on, right-side and three-quarter photographs
 * show it (the first two calibrated; x and y from the side camera, which fits ≈1.9 px, z from the
 * head-on one, which is close to orthographic; ≈ ±2 cm):
 *  - the eyes: two dark ducts under the crease, ≈6 cm tall, their mouths facing forward, pockets
 *    ≈7 cm deep; between them the nose's keel coming to a point under the emblem;
 *  - under each eye a carbon band, and below it the chevron: a carbon blade pointing forward and in,
 *    its lower edge picked out in green, from (0.693, 0.70) m, 0.22 m out, to (0.861, 0.663) m;
 *  - below the chevrons the dark lower face round the ram-air mouth, its lip ≈0.60 m up;
 *  - low on each side the chrome lower cowl, a blade continuing the side panel down to
 *    (0.365, 0.331) m, 0.235 m out, with the lower wing standing forward off it: an arrow-shaped
 *    chrome end plate 0.325 m out, from x 0.38 m back (0.514–0.596 m up) to its tip at
 *    (0.543, 0.537) m, and three carbon slats from the cowl to it.
 */
function buildNose(M) {
  const g = new THREE.Group(); g.name = 'h2r-nose';
  M.h2rMeshDark ??= new THREE.MeshStandardMaterial({ name: 'h2r-duct-mesh', color: 0xffffff, map: meshTexture(), metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });
  M.h2rPinGreen ??= new THREE.MeshStandardMaterial({ name: 'h2r-pinstripe', color: 0x46c23a, emissive: 0x0c3a08, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
  const carbon2 = twoSided(M, 'h2rCarbon2', M.h2rCarbon, 'h2r-carbon-2s');
  const black2 = twoSided(M, 'h2rBlack2', M.h2rBlack, 'h2r-black-2s');
  const chrome2 = twoSided(M, 'h2rChrome2', M.h2rChrome, 'h2r-mirror-coat-2s');
  // The eye: mouth (top outer, top inner, bottom inner, bottom outer) and its pocket's floor 7 cm in.
  const E = [[0.790, 0.800, 0.200], [0.886, 0.776, 0.046], [0.881, 0.716, 0.046], [0.797, 0.745, 0.186]];
  const Eb = E.map(([x, y, z]) => [x - 0.07, y + 0.004, z - 0.01]);
  const eyeV = [...E, ...Eb];
  g.add(facets(eyeV, [[4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3]], M.h2rMeshDark, 'h2r-eye'));
  // The keel between the eyes, under the beak, coming to a point at the chevrons' tips.
  g.add(facets([[0.908, 0.786, 0], [0.886, 0.776, 0.046], [0.876, 0.700, 0.034], [0.866, 0.655, 0], [0.84, 0.786, 0], [0.84, 0.70, 0.034]],
    [[0, 1, 2, 3], [1, 4, 5, 2]], black2, 'h2r-keel'));
  // The carbon band under the eye, down to the chevron's top edge.
  const K1 = [0.700, 0.713, 0.218], K2 = [0.858, 0.673, 0.050], K1b = [0.693, 0.692, 0.222], K2b = [0.862, 0.658, 0.048];
  g.add(facets([E[3], E[2], K2, K1], [[0, 1, 2, 3]], carbon2, 'h2r-under-eye'));
  // The chevron: a wedge, its front face and a top and bottom running ≈4 cm back and in.
  const back = ([x, y, z]) => [x - 0.035, y + 0.004, z - 0.012];
  g.add(facets([K1, K2, K2b, K1b, back(K1), back(K2), back(K2b), back(K1b)],
    [[0, 1, 2, 3], [0, 4, 5, 1], [3, 2, 6, 7], [1, 5, 6, 2]], carbon2, 'h2r-chevron'));
  // Its green pinstripe along the lower front edge.
  const up = ([x, y, z], d) => [x + 0.0015, y + d, z + 0.0005];
  g.add(facets([up(K1b, 0.0005), up(K2b, 0.0005), up(K2b, 0.006), up(K1b, 0.0065)], [[0, 1, 2, 3]], M.h2rPinGreen, 'h2r-pinstripe'));
  // The lower face under the chevrons, round the mouth (its inner edge 0.105 m out), and the mouth:
  // a floor (the lip) and a dark back wall inside.
  const L0 = [0.80, 0.605, 0.105], L1 = [0.66, 0.60, 0.215];
  g.add(facets([K2b, K1b, L1, L0, [0.866, 0.655, 0.0], [0.81, 0.606, 0.0]], [[0, 1, 2, 3], [4, 0, 3, 5]], black2, 'h2r-lower-face'));
  g.add(facets([[0.81, 0.606, 0], L0, [0.73, 0.60, 0.105], [0.73, 0.60, 0]], [[0, 1, 2, 3]], black2, 'h2r-mouth-lip'));
  g.add(facets([[0.73, 0.60, 0], [0.73, 0.60, 0.105], [0.76, 0.66, 0.06], [0.76, 0.66, 0]], [[0, 1, 2, 3]], M.h2rMeshDark, 'h2r-mouth'));
  // The chrome lower cowl: a blade from under the side panel down to its tip, in two facets
  // folding along its middle (the photographs: a lit upper facet, a darker one turning in).
  const C = [[0.555, 0.540, 0.300], [0.386, 0.590, 0.262], [0.365, 0.331, 0.235], [0.47, 0.55, 0.29], [0.40, 0.44, 0.255], [0.47, 0.43, 0.24]];
  g.add(facets([...C, [0.66, 0.60, 0.215], [0.60, 0.50, 0.22]], [[1, 3, 4], [3, 0, 5, 4], [4, 5, 2], [1, 4, 2], [0, 6, 7, 5], [5, 7, 2]], chrome2, 'h2r-lower-cowl'));
  // The lower wing: the chrome end plate and three carbon slats from the cowl out to it.
  const zE = 0.325, plateP = [[0.38, 0.596], [0.50, 0.574], [0.543, 0.537], [0.50, 0.522], [0.38, 0.514]];
  const plate = [...plateP.map(([x, y]) => [x, y, zE + 0.003]), ...plateP.map(([x, y]) => [x, y, zE - 0.003])];
  g.add(facets(plate, [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5], [0, 5, 6, 1], [1, 6, 7, 2], [2, 7, 8, 3], [3, 8, 9, 4], [4, 9, 5, 0]], chrome2, 'h2r-lower-wing-plate'));
  const slats = [];
  for (const y of [0.528, 0.553, 0.578]) {
    const x1 = y < 0.54 ? 0.52 : y < 0.56 ? 0.53 : 0.505, t = 0.003;
    const P = [[0.385, y + t, zE], [x1, y + t - 0.012, zE], [x1, y - t - 0.012, zE], [0.385, y - t, zE], [0.385, y + t, 0.245], [x1, y + t - 0.012, 0.27], [x1, y - t - 0.012, 0.27], [0.385, y - t, 0.245]];
    slats.push(P);
  }
  const slatV = slats.flat(), polys = [];
  for (let k = 0; k < 3; k++) { const o = k * 8; polys.push([o, o + 4, o + 5, o + 1], [o + 3, o + 2, o + 6, o + 7], [o + 1, o + 5, o + 6, o + 2]); }
  g.add(facets(slatV, polys, carbon2, 'h2r-lower-wing-slats'));
  return g;
}
function meshTexture() {
  const t = canvasTexture(64, 64, (x, w) => {
    x.fillStyle = '#060708'; x.fillRect(0, 0, w, w);
    x.strokeStyle = '#2a2d31'; x.lineWidth = 2;
    for (let i = -w; i < 2 * w; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + w, w); x.stroke(); x.beginPath(); x.moveTo(i + w, 0); x.lineTo(i, w); x.stroke(); }
  });
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); }
  return t;
}

/**
 * The upper wings, carbon, where a road bike's mirrors would be. Each is a thin flat blade that
 * leaves a triangular foot bolted to the cowl's side beside the screen's base, and runs out, up and
 * back, nose down; its square-cut outer end is the bike's widest point (the published 0.850 m).
 * Measured on the right-side photograph through its calibrated camera (≈1.9 px rms on the
 * published wheelbase and tyre diameters), the corners back-projected onto their planes: the root's
 * leading edge at (0.773, 0.886) m, 0.19 m out; the tip's leading and trailing edges at (0.672,
 * 0.948) and (0.594, 0.988) m, 0.425 m out. That is ≈15° of dihedral (≈18° in the head-on
 * photograph), ≈23° of sweep and ≈20° nose-down. The root's trailing edge (≈) is a 0.105 m chord
 * at that incidence. Thickness ≈. The head-on photograph (its camera solved on the same points,
 * ≈9 px) shows the tip ≈5 cm deep, the chord's drop: no down-turned lip.
 */
export function buildWings(M) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const plate = (pts, t) => {
    // A flat plate through the outline pts (in order round its face) with thickness t along its normal.
    const n = new THREE.Vector3().subVectors(pts[2], pts[0]).cross(new THREE.Vector3().subVectors(pts[3 % pts.length], pts[1])).normalize().multiplyScalar(t / 2);
    const top = pts.map(p => p.clone().add(n)), bot = pts.map(p => p.clone().sub(n));
    const pos = [], tri = (a, b, d) => pos.push(...a.toArray(), ...b.toArray(), ...d.toArray());
    for (let i = 1; i < pts.length - 1; i++) { tri(top[0], top[i], top[i + 1]); tri(bot[0], bot[i + 1], bot[i]); }
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; tri(top[i], bot[i], bot[j]); tri(top[i], bot[j], top[j]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 4 + pos[i + 2] * 4, pos[i + 1] * 4 + pos[i + 2] * 2);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  };
  const rootLE = V(0.773, 0.886, 0.19), rootTE = V(0.674, 0.922, 0.19);
  const tipLE = V(0.672, 0.948, 0.4245), tipTE = V(0.594, 0.988, 0.4245);
  const parts = [];
  // The blade.
  parts.push(plate([rootLE, tipLE, tipTE, rootTE], 0.009));
  // The foot: a vertical plate from the blade's root down into the cowl, ≈10 cm, swept like the blade.
  const footZ = 0.188;
  parts.push(plate([V(rootLE.x, rootLE.y, footZ), V(rootTE.x, rootTE.y, footZ), V(0.69, 0.81, footZ), V(0.80, 0.79, footZ)], 0.014));
  let g = withCreaseNormals(mergeAll(parts.map(geometry => ({ geometry }))), 30);
  g = mergeAll([{ geometry: g }, { geometry: mirrorZ(g) }]);
  return mesh(g, M.h2rCarbon, { name: 'h2r-wings' });
}

/**
 * A decal laid on a panel: its parallelogram in the side photograph's pixels (top-front corner,
 * top-rear, bottom-front — as the text reads on the left side, front to back), projected across
 * onto the base and mirrored so it reads the right way on both sides.
 */
export function decal(corners, base, mat, name, side = 'L') {
  // corners: [top of the text's start, top of its end, bottom of its start] in the side photograph's
  // pixels; the text runs from front to back on the left side and from back to front on the right.
  const [p0, p1, p2] = corners;
  const ax = [p1[0] - p0[0], p1[1] - p0[1]], bx = [p2[0] - p0[0], p2[1] - p0[1]];
  const det = ax[0] * bx[1] - ax[1] * bx[0];
  const uvOf = (u, v) => { const du = u - p0[0], dv = v - p0[1]; return [(du * bx[1] - dv * bx[0]) / det, (ax[0] * dv - ax[1] * du) / det]; };
  const outline = [p0, p1, [p1[0] + bx[0], p1[1] + bx[1]], p2];
  const m = skin(outline, base, { mat, name, levels: 4, proud: 0.002, mirror: false });
  let g = m.geometry;
  if (side === 'L') g = mirrorZ(g);
  const P = g.attributes.position, uv = new Float32Array(P.count * 2);
  const Ainv = (x, y) => [640.576 + (-559.17 * x + 0.887 * y), 809.183 + (-0.732 * x - 558.817 * y)];
  for (let i = 0; i < P.count; i++) { const [u, v] = Ainv(P.getX(i), P.getY(i)); const [s2, t] = uvOf(u, v); uv[i * 2] = s2; uv[i * 2 + 1] = 1 - t; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.geometry = g;
  m.castShadow = false;
  return m;
}
/** Text drawn on a transparent canvas for a decal (Kawasaki's own markings, drawn as type). */
export function decalMaterial(name, w, h, draw) {
  if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ name, visible: false });
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ name, map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, metalness: 0.5, roughness: 0.3 });
}
export function buildDecals(panel, tank, tail) {
  const g = new THREE.Group(); g.name = 'h2r-decals';
  const ninja = decalMaterial('h2r-decal-ninja', 512, 256, (x, w, h) => {
    x.fillStyle = '#eef1f3'; x.font = 'italic 190px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
    x.textBaseline = 'middle'; x.fillText('Ninja', 10, h * 0.55);
  });
  g.add(decal([[262, 362], [318, 360], [264, 396]], panel, ninja, 'h2r-decal-ninja'), decal([[338, 360], [282, 362], [336, 396]], panel, ninja, 'h2r-decal-ninja', 'R'));
  const badge = decalMaterial('h2r-decal-h2r', 256, 96, (x, w, h) => {
    x.fillStyle = '#e9ecee'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#16181a'; x.fillRect(6, 6, w - 12, h - 12);
    x.font = 'bold 72px Arial, Helvetica, sans-serif'; x.textBaseline = 'middle';
    x.fillStyle = '#e9ecee'; x.fillText('H2', 30, h / 2 + 3);
    x.fillStyle = '#d0141c'; x.fillText('R', 150, h / 2 + 3);
  });
  g.add(decal([[306, 377], [337, 375], [307, 392]], panel, badge, 'h2r-decal-h2r'), decal([[276, 377], [245, 379], [275, 392]], panel, badge, 'h2r-decal-h2r', 'R'));
  const kaw = decalMaterial('h2r-decal-kawasaki', 1024, 160, (x, w, h) => {
    x.font = 'italic 900 132px Arial Black, Arial, Helvetica, sans-serif'; x.textBaseline = 'middle';
    x.fillStyle = '#1e2124'; x.fillText('Kawasaki', 14, h / 2 + 4);
    x.fillStyle = '#5c6167'; x.fillText('Kawasaki', 8, h / 2);
  });
  g.add(decal([[535, 280], [611, 268], [536, 296]], tank, kaw, 'h2r-decal-kawasaki'), decal([[611, 268], [535, 280], [612, 284]], tank, kaw, 'h2r-decal-kawasaki', 'R'));
  // "Ninja" on the tail's upper mirror-coat panel (the right-side photograph through its camera:
  // ≈0.2 m long, from x −0.48 to −0.68 m), mirrored for each side.
  if (tail) g.add(decal([[908, 301], [1019, 266], [919, 324]], tail, ninja, 'h2r-decal-ninja-tail'), decal([[1019, 266], [908, 301], [1030, 289]], tail, ninja, 'h2r-decal-ninja-tail', 'R'));
  return g;
}
