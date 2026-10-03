/**
 * The Ninja H2R's bodywork as lofted sections. Each part is a run of cross-sections at stations
 * along the bike; each section a polyline from the centre line round the right side (mirrored
 * for the left), given in the side photograph's pixels (u forward-to-back, v down) for x and y —
 * the outline is the photograph's — and metres for the half-widths, fitted against the
 * three-quarter photograph through its calibrated camera.
 */
import * as THREE from 'three';
import { loft, mesh, mirrorZ, mergeAll } from './h2rParts.js';

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
  const tparts = part(tail, [[0, 5, M.h2rBlack, 'h2r-tail']]);
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
  M.h2rScreen ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-screen', color: 0x262b30, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
  const rows = [];
  const C0 = [177, 328], C1 = [383, 161], S0 = [205, 318], S1 = [407, 204];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const c = [C0[0] + (C1[0] - C0[0]) * t, C0[1] + (C1[1] - C0[1]) * t];
    const s = [S0[0] + (S1[0] - S0[0]) * t, S0[1] + (S1[1] - S0[1]) * t];
    const w = 0.13 + 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.6)) - 0.06 * t;
    const sec = [];
    for (let k = 0; k <= 6; k++) {
      const a = k / 6, e = Math.sin(a * Math.PI / 2);
      sec.push([...PXY(c[0] + (s[0] - c[0]) * a ** 1.5, c[1] + (s[1] - c[1]) * a ** 1.5), w * e]);
    }
    rows.push(sec);
  }
  let geo = loft(rows, { steps: 3 });
  geo = mergeAll([{ geometry: geo }, { geometry: mirrorZ(geo) }]);
  return mesh(geo, M.h2rScreen, { name: 'h2r-screen' });
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
  const cowl = shell([
    [141, [[364, 0.0], [366, 0.01], [368, 0.016], [370, 0.012]]],
    [160, [[346, 0.0], [350, 0.03], [358, 0.06], [372, 0.08]]],
    [185, [[330, 0.0], [336, 0.05], [352, 0.11], [383, 0.165]]],
    [215, [[314, 0.0], [319, 0.06], [338, 0.13], [372, 0.19]]],
    [255, [[292, 0.0], [297, 0.07], [322, 0.15], [366, 0.222]]],
    [300, [[266, 0.02], [272, 0.09], [300, 0.17], [361, 0.243]]],
    [335, [[276, 0.1], [282, 0.13], [310, 0.2], [364, 0.255]]],
    [380, [[318, 0.15], [323, 0.18], [340, 0.225], [377, 0.265]]],
    [440, [[352, 0.18], [356, 0.2], [370, 0.24], [400, 0.268]]],
    [520, [[392, 0.21], [395, 0.22], [403, 0.24], [418, 0.25]]],
  ], M.h2rCarbon, 'h2r-cowl', { steps: 5, creaseDeg: 40 });
  g.add(cowl);
  const panel = shell([
    // [top edge, crease (the upper facet's fold), lower edge tucked in] — angular, as pressed.
    [189, [[383, 0.162], [385, 0.168], [387, 0.16]]],
    [215, [[372, 0.19], [394, 0.206], [404, 0.17]]],
    [260, [[366, 0.222], [404, 0.252], [446, 0.18]]],
    [310, [[360, 0.242], [410, 0.284], [488, 0.17]]],
    [360, [[364, 0.256], [414, 0.302], [512, 0.18]]],
    [410, [[380, 0.266], [418, 0.312], [505, 0.2]]],
    [460, [[403, 0.268], [422, 0.306], [483, 0.23]]],
    [498, [[417, 0.262], [427, 0.295], [455, 0.25]]],
  ], M.h2rChrome, 'h2r-side-panel', { steps: 5, creaseDeg: 12 });
  g.add(panel);
  // The eye: the duct's dark mesh-lined opening either side of the beak.
  g.add(skin([[152, 357], [172, 356], [212, 360], [205, 374], [172, 376], [156, 368]], cowl, { mat: M.h2rVoid, name: 'h2r-eye', proud: 0.002 }));
  // The lower fin standing off the chin, and the chin itself (carbon), the inner lining dark.
  g.add(sidePatch([[172, 404, 0.13], [202, 406, 0.16], [249, 419, 0.2], [222, 436, 0.19], [161, 434, 0.15]], { mat: M.h2rCarbon, name: 'h2r-fin-lower' }));
  g.add(sidePatch([[141, 370, 0.01], [160, 374, 0.08], [188, 386, 0.16], [215, 418, 0.16], [205, 405, 0.12], [175, 395, 0.06]], { mat: M.h2rCarbon, name: 'h2r-chin' }));
  g.userData.panel = panel;
  g.add(buildWings(M));
  g.add(buildScreen(M));
  return g;
}

/**
 * The upper wings, carbon, where a road bike's mirrors are: each a plate standing out from the cowl
 * below the screen, nose-down, its outer corner the bike's widest point (the published 0.850 m).
 * Corners triangulated on the two studio photographs (the far wing shows clear of the cowl on the
 * three-quarter one): the high trailing corner ≈1.00 m up, the low outer tip ≈0.85 m.
 */
export function buildWings(M) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const quad = (A, B, C, D, t) => {
    // A plate A→B→C→D with thickness t along its normal.
    const n = new THREE.Vector3().subVectors(C, A).cross(new THREE.Vector3().subVectors(D, B)).normalize().multiplyScalar(t / 2);
    const top = [A, B, C, D].map(p => p.clone().add(n)), bot = [A, B, C, D].map(p => p.clone().sub(n));
    const pos = [];
    const tri = (a, b, c) => pos.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    tri(top[0], top[1], top[2]); tri(top[0], top[2], top[3]);
    tri(bot[0], bot[2], bot[1]); tri(bot[0], bot[3], bot[2]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; tri(top[i], bot[i], bot[j]); tri(top[i], bot[j], top[j]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 4 + pos[i + 2] * 4, pos[i + 1] * 4);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  const A = V(0.55, 0.975, 0.19), B = V(0.607, 1.004, 0.325), C = V(0.686, 0.85, 0.4175), D = V(0.67, 0.865, 0.2);
  let g = quad(A, B, C, D, 0.008);
  // A small down-turned lip along the outer edge.
  g = mergeAll([{ geometry: g }, { geometry: quad(B, B.clone().add(V(0.0, -0.035, 0.012)), C.clone().add(V(0, -0.03, 0.005)), C, 0.006) }]);
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
export function buildDecals(panel, tank) {
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
  return g;
}
