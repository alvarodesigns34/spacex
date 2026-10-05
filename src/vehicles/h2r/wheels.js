/**
 * The wheels, as the photographs of the bike without its bodywork show them (Wikimedia Commons,
 * "Kawasaki Ninja H2R exposd right front", "… exposed left front", "… exposed left rear"; reference
 * only, not in the repository):
 *  - the slicks: a round crown, the shoulder, the sidewall with its moulded rim protector rib, the
 *    bead on the rim; the tread scuffed matt, the sidewalls a deeper satin black;
 *  - the rims: a drop-centre barrel between the bead seats and their humps, J flanges, black, a
 *    green stripe round each flange's face;
 *  - the front's five spokes, each splitting into a narrow Y to the rim; the rear's five Y spokes
 *    whose arms meet their neighbours' at the rim, a star; swept sections, their outer edges
 *    machined bright;
 *  - the discs: floating braking bands drilled in diagonal rows of holes, tabs on their inner edge
 *    riding on the buttons, black carriers cut away between their arms; the front left's speed
 *    sensor's toothed ring; the rear sprocket, its teeth cut, on the machined cush-drive carrier
 *    with its nine windows and the castellated axle nut.
 * Sizes published: tyres 120/600 R17 and 190/650 R17, rims 17 in, discs 330 and 250 mm (data/h2r.js).
 * The rest ≈ from the photographs, scaled by those.
 */
import * as THREE from 'three';
import { AXLE_F, AXLE_R, TAU, mergeAll, mesh, dropSlivers } from './geometry.js';
import { partMaterials } from './materials.js';
import { WHEELS } from '../../data/h2r.js';

// ---- Revolved profiles ---------------------------------------------------------------------------
/** A profile [[r, z], …] revolved about the axle (z), its faces outward when it runs up z (or set `inward`). */
function revolve(profile, segs, { inward = false } = {}) {
  const pts = profile.map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(Math.PI / 2);
  if (inward) flipFaces(g);
  return g;
}
function flipFaces(g) {
  const ix = g.index;
  for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); }
  g.computeVertexNormals();
  return g;
}

/**
 * A slick: from the bead round the sidewall (its rim protector rib ≈6 mm proud, a fine moulding
 * line half way up) to the shoulder and the crown (a superellipse, ≈2.4: a slick's full shoulder).
 * Two groups: the tread (scuffed) and the sidewalls.
 */
function tyreGeometry(R, width, rimR, beadHalf) {
  const hw = width / 2, h = R - rimR, e = 2 / 2.4;
  const crown = (t) => {    // t −π/2…π/2 across the crown
    const c = Math.cos(t), s = Math.sin(t);
    return [rimR + 0.012 + (h - 0.012) * Math.abs(c) ** e, hw * Math.sign(s) * Math.abs(s) ** e];
  };
  const side = (sgn) => {   // from the bead up the sidewall to where the crown takes over (|t| = 0.72π/2)
    const top = crown(sgn * 0.72 * Math.PI / 2), pts = [];
    const z0 = sgn * beadHalf;
    pts.push([rimR - 0.004, z0], [rimR + 0.002, z0 + sgn * 0.004], [rimR + 0.010, z0 + sgn * 0.009]);
    // The rim protector: a rib standing out over the flange.
    pts.push([rimR + 0.016, z0 + sgn * 0.0125], [rimR + 0.021, z0 + sgn * 0.0135], [rimR + 0.026, z0 + sgn * 0.0118]);
    // The sidewall bulging out to its widest, a fine moulding line on the way.
    for (let k = 1; k <= 12; k++) {
      const u = k / 12, r = rimR + 0.026 + (top[0] - rimR - 0.026) * u;
      const bulge = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.006;
      const z = z0 + sgn * 0.0118 + (top[1] - z0 - sgn * 0.0118) * (1 - (1 - u) ** 2) + sgn * bulge;
      pts.push([r + (k === 6 ? 0.0006 : 0), z + (k === 6 ? sgn * 0.0007 : 0)]);
    }
    return pts;
  };
  // The tread: across the crown between the two sidewalls' tops.
  const tread = [];
  for (let i = 0; i <= 48; i++) tread.push(crown((-0.72 + 1.44 * i / 48) * Math.PI / 2));
  const L = side(-1), Rt = side(1).reverse();
  const segs = 128;
  const sideL = revolve(L, segs), sideR = revolve(Rt, segs), crownG = revolve(tread, segs);
  for (const g of [sideL, sideR, crownG]) g.computeVertexNormals();
  // (The profiles run up z, so their faces point outward; the tread first, then the sidewalls.)
  const walls = mergeAll([{ geometry: sideL }, { geometry: sideR }]);
  const tg = crownG.index ? crownG.toNonIndexed() : crownG;
  const all = mergeAll([{ geometry: tg }, { geometry: walls }]);
  all.clearGroups();
  const nTread = tg.attributes.position.count;
  all.addGroup(0, nTread, 0);
  all.addGroup(nTread, all.attributes.position.count - nTread, 1);
  return all;
}

/**
 * The rim: the bead seats with their humps, the drop centre between them, the J flanges rolled
 * over at the edge; the inside of the barrel (seen through the spokes) closes it.
 */
function rimGeometry(rimR, beadHalf, wellDepth) {
  const prof = (sgn) => [
    [rimR + 0.0135, sgn * (beadHalf + 0.0035)],   // the flange's rolled lip
    [rimR + 0.0105, sgn * (beadHalf + 0.0065)],
    [rimR + 0.0040, sgn * (beadHalf + 0.0070)],
    [rimR - 0.0030, sgn * (beadHalf + 0.0060)],
    [rimR - 0.0060, sgn * (beadHalf + 0.0020)],
  ];
  const outer = [
    ...prof(-1).reverse(),
    [rimR - 0.0005, -beadHalf + 0.002], [rimR - 0.0005, -beadHalf + 0.014],    // bead seat
    [rimR + 0.0018, -beadHalf + 0.017], [rimR - 0.002, -beadHalf + 0.021],     // hump
    [rimR - wellDepth, -beadHalf * 0.35], [rimR - wellDepth, beadHalf * 0.15], // the drop centre
    [rimR - 0.002, beadHalf - 0.021], [rimR + 0.0018, beadHalf - 0.017],
    [rimR - 0.0005, beadHalf - 0.014], [rimR - 0.0005, beadHalf - 0.002],
    ...prof(1),
  ];
  // Seen from outside the barrel the profile runs up z: faces out (the tyre's side).
  const tyreSide = revolve(outer.map(([r, z]) => [r, z]), 128);
  // The barrel's inside, a little thinner than the outside, facing the axle.
  const inner = [[rimR - 0.0065, -(beadHalf + 0.002)], [rimR - wellDepth - 0.004, -beadHalf * 0.35], [rimR - wellDepth - 0.004, beadHalf * 0.15], [rimR - 0.0065, beadHalf + 0.002]];
  const axleSide = revolve(inner, 128, { inward: true });
  return mergeAll([{ geometry: tyreSide }, { geometry: axleSide }]);
}

// ---- Spokes ----------------------------------------------------------------------------------------
/**
 * A spoke swept along a path in the wheel's plane: its section a rounded box `w(t)` wide and
 * `d(t)` deep (across the wheel), centred at z(t); the open ends are buried in the hub and the rim.
 * Returns the body and the two machined strips along its outer face's edges.
 */
function spoke(path, w, d, zc, { n = 16, steps = 26, outer = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const pos = [], idx = [], edgePos = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), tan = curve.getTangent(t);
    const across = new THREE.Vector3(-tan.y, tan.x, 0);
    const W = w(t) / 2, D = d(t) / 2, z = zc(t);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, c = Math.cos(a), s = Math.sin(a), ee = 0.45;
      const q = p.clone().addScaledVector(across, Math.sign(c) * Math.abs(c) ** ee * W);
      pos.push(q.x, q.y, z + Math.sign(s) * Math.abs(s) ** ee * D);
    }
    // The outer face's edges, machined: thin strips just proud of the face's corners.
    for (const sgn of [-1, 1]) {
      const q0 = p.clone().addScaledVector(across, sgn * W * 0.97), q1 = p.clone().addScaledVector(across, sgn * W * 0.80);
      edgePos.push([q0.x, q0.y, z + outer * D * 1.002], [q1.x, q1.y, z + outer * D * 1.012]);
    }
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + (k + 1) % n, c = a + n, e = b + n;
    idx.push(a, b, c, b, e, c);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setIndex(idx); body.computeVertexNormals();
  // Faces outward: check one against its section's centre.
  {
    const p0 = new THREE.Vector3(pos[0], pos[1], pos[2]), c0 = curve.getPoint(0).setZ(zc(0)), nn = body.attributes.normal;
    const nrm = new THREE.Vector3(nn.getX(0), nn.getY(0), nn.getZ(0));
    if (nrm.dot(p0.sub(c0)) < 0) flipFaces(body);
  }
  const ep = [], ei = [];
  for (let s = 0; s < 2; s++) for (let i = 0; i <= steps; i++) { const [a, b] = [edgePos[(i * 2 + s) * 2], edgePos[(i * 2 + s) * 2 + 1]]; ep.push(...a, ...b); }
  for (let s = 0; s < 2; s++) for (let i = 0; i < steps; i++) { const o = s * (steps + 1) * 2 + i * 2; ei.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  const edge = new THREE.BufferGeometry();
  edge.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
  edge.setIndex(ei); edge.computeVertexNormals();
  // Both strips face out of the wheel's side.
  for (let s = 0; s < 2; s++) {
    const nz = edge.attributes.normal.getZ(s * (steps + 1) * 2);
    if (nz * outer < 0) {
      for (let i = 0; i < steps; i++) { const q = (s * steps + i) * 6; for (const k of [0, 3]) { const t = ei[q + k + 1]; ei[q + k + 1] = ei[q + k + 2]; ei[q + k + 2] = t; } }
    }
  }
  edge.setIndex(ei); edge.computeVertexNormals();
  return { body, edge };
}
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
/** A circle as a polygon (no repeated closing point), for shapes and their holes. */
function circlePath(r, n, Kind = THREE.Path, cx = 0, cy = 0) {
  const p = new Kind();
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; p[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return p;
}

/** The front wheel's spokes: five, each forking into a narrow Y half way out (the photographs). */
function frontSpokes(rimR) {
  const bodies = [], edges = [];
  for (let i = 0; i < 5; i++) {
    const c = (i / 5) * TAU + 0.31;
    for (const d of [-1, 1]) {
      const path = [polar(0.05, c + d * 0.02), polar(0.085, c + d * 0.035), polar(0.14, c + d * 0.095), polar(rimR - 0.035, c + d * 0.17), polar(rimR - 0.004, c + d * 0.19)];
      const sp = spoke(path, (t) => 0.024 - 0.011 * t, (t) => 0.024 - 0.008 * t, (t) => 0.004 - 0.004 * t, { outer: 1 });
      bodies.push({ geometry: sp.body }); edges.push({ geometry: sp.edge });
    }
  }
  return { body: mergeAll(bodies), edge: mergeAll(edges) };
}

/**
 * The rear's five Y spokes: from the hub each splits into two arms that run out to the rim, where
 * each meets its neighbour's: a five-pointed star (the photographs; the sprocket's side flat, the
 * disc's dished).
 */
function rearSpokes(rimR) {
  const bodies = [], edges = [];
  for (let i = 0; i < 5; i++) {
    const c = (i / 5) * TAU + Math.PI / 2;
    // The stem, hub to the fork.
    const stem = spoke([polar(0.062, c), polar(0.09, c), polar(0.125, c)], (t) => 0.03 - 0.004 * t, () => 0.034, (t) => 0.012 * t, { outer: 1 });
    bodies.push({ geometry: stem.body }); edges.push({ geometry: stem.edge });
    for (const d of [-1, 1]) {
      // Straight from the fork to the rim, where it meets its neighbour (the photographs).
      const A = polar(0.118, c), B = polar(rimR - 0.004, c + d * TAU / 10);
      const lerp2 = (u) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
      const arm = spoke([A, lerp2(0.33), lerp2(0.66), B],
        (t) => 0.021 - 0.006 * t, (t) => 0.028 - 0.008 * t, (t) => 0.012 + 0.012 * t, { outer: 1 });
      bodies.push({ geometry: arm.body }); edges.push({ geometry: arm.edge });
    }
  }
  return { body: mergeAll(bodies), edge: mergeAll(edges) };
}

// ---- Discs -------------------------------------------------------------------------------------------
/**
 * A floating disc: the braking band (ro, ri) drilled in diagonal rows of holes, `tabs` tabs on its
 * inner edge each with the half-round seat of a button; its black carrier inside it, cut away
 * between `arms` arms, its centre bolted to the hub; the buttons. Returns band, carrier, buttons
 * and bolts at z (the band's mid-plane), axle along z.
 */
function floatingDisc({ ro, ri, t, rows, tabs, arms, rc, z }) {
  // The band: a circle with the inner edge (tabs and their seats) as a hole, and the drillings.
  const band = circlePath(ro, 240, THREE.Shape);
  const inner = new THREE.Path(), N = tabs * 24;
  for (let i = 0; i < N; i++) {   // (not back to the first point: a repeated point makes a sliver)
    const a = -(i / N) * TAU, k = ((i / N) * tabs) % 1;
    // The tab: a bump inward ≈26 % of the pitch wide, its tip ≈9 mm in.
    const bump = Math.max(0, 1 - Math.abs(k - 0.5) / 0.15);
    const r = ri - 0.009 * Math.min(1, bump * 1.6);
    inner[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  band.holes.push(inner);
  for (const [n, r0, r1, dr, size, twist] of rows) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < dr; j++) {
        const r = r0 + (r1 - r0) * j / Math.max(1, dr - 1), a = (i / n) * TAU + twist * j;
        band.holes.push(circlePath(size, 10, THREE.Path, Math.cos(a) * r, Math.sin(a) * r));
      }
    }
  }
  const bandG = new THREE.ExtrudeGeometry(band, { depth: t - 0.001, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 1, curveSegments: 10 });
  bandG.translate(0, 0, z - t / 2 + 0.0005);
  dropSlivers(bandG);
  // The carrier: from the hub out to the buttons' circle, cut away between its arms.
  const rb = ri - 0.0045;                          // the buttons' circle
  const car = new THREE.Shape(); car.absarc(0, 0, rb + 0.004, 0, TAU, false);
  for (let i = 0; i < arms; i++) {
    const a0 = (i / arms) * TAU + 0.16, a1 = a0 + TAU / arms - 0.32, h = new THREE.Path();
    h.absarc(0, 0, rb - 0.012, a0, a1, false);
    h.absarc(0, 0, rc + 0.012, a1, a0, true);
    car.holes.push(h);
  }
  const hub = new THREE.Path(); hub.absarc(0, 0, rc - 0.016, 0, TAU, true); car.holes.push(hub);
  const carG = new THREE.ExtrudeGeometry(car, { depth: t * 0.85, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 12 });
  carG.translate(0, 0, z - t * 0.425);
  dropSlivers(carG);
  // The buttons: a domed rivet each side through the tab's seat, its centre drilled.
  const buttons = [];
  for (let i = 0; i < tabs; i++) {
    const a = ((i + 0.5) / tabs) * TAU, x = Math.cos(a) * rb, y = Math.sin(a) * rb;
    for (const s of [-1, 1]) {
      const b = revolve([[0.0025, 0], [0.0062, 0], [0.0064, 0.0012], [0.0052, 0.0024], [0.0025, 0.0026]], 16);
      if (s < 0) { b.scale(1, 1, -1); flipFaces(b); }
      b.translate(x, y, z + s * t / 2);
      buttons.push({ geometry: b });
    }
  }
  // The carrier's bolts into the hub.
  const bolts = [];
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * TAU, b = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 6);
    b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * (rc - 0.006), Math.sin(a) * (rc - 0.006), z + Math.sign(z || 1) * (t / 2 + 0.003));
    bolts.push({ geometry: b });
  }
  return { band: bandG, carrier: carG, buttons: mergeAll(buttons), bolts: mergeAll(bolts) };
}

/** A sprocket: N teeth on a pitch circle of radius rp (their tips rounded), cut away inside between six arms. */
function sprocketShape(N, rp, roller) {
  const s = new THREE.Shape(), pts = [];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU, step = TAU / N;
    // The seat for the roller between two teeth, then the tooth's flank up to its rounded tip.
    for (let k = 0; k <= 6; k++) { const a = a0 - step * 0.22 + step * 0.44 * k / 6, r = rp - roller * 0.5 * Math.sin(Math.PI * k / 6) * 0.98; pts.push(polar(r, a)); }
    for (let k = 1; k <= 5; k++) { const u = k / 6, a = a0 + step * (0.22 + 0.56 * u), r = rp + 0.0062 * Math.sin(Math.PI * u) - 0.0005; pts.push(polar(r, a)); }
  }
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + 0.14, a1 = a0 + TAU / 6 - 0.28, h = new THREE.Path();
    h.absarc(0, 0, rp - 0.016, a0, a1, false); h.absarc(0, 0, 0.074, a1, a0, true); s.holes.push(h);
  }
  const c = new THREE.Path(); c.absarc(0, 0, 0.052, 0, TAU, true); s.holes.push(c);
  return s;
}

// ---- The wheel -------------------------------------------------------------------------------------
/** A wheel group at its axle: the tyre, rim, spokes, discs and hub in a spinning group; the axle fixed. */
export function buildWheel(M, which) {
  partMaterials(M);
  const front = which === 'f';
  const W = front ? WHEELS.front : WHEELS.rear;
  const g = new THREE.Group();
  g.name = `h2r-wheel-${which}`;
  g.position.copy(front ? AXLE_F : AXLE_R);
  const R = W.dia / 2, rimR = W.rimDia / 2, beadHalf = front ? 0.0445 : 0.0762;   // rims ≈17 × 3.50 and 17 × 6.00
  const spin = new THREE.Group();
  spin.name = `h2r-wheel-${which}-spin`;
  g.add(spin);
  spin.add(mesh(tyreGeometry(R, W.width, rimR, beadHalf), [M.h2rTyre, M.h2rTyreWall], { name: `h2r-tyre-${which}` }));
  spin.add(mesh(rimGeometry(rimR, beadHalf, front ? 0.016 : 0.02), M.h2rRim, { name: 'h2r-rim' }));
  // The flanges' rolled lips, machined, and the green stripe round each face.
  const lips = [], stripes = [];
  for (const s of [-1, 1]) {
    const lip = new THREE.TorusGeometry(rimR + 0.0128, 0.0016, 6, 128); lip.translate(0, 0, s * (beadHalf + 0.0045));
    lips.push({ geometry: lip });
    const st = new THREE.RingGeometry(rimR - 0.0045, rimR + 0.0005, 128);
    if (s < 0) st.rotateY(Math.PI);          // facing out of each side
    st.translate(0, 0, s * (beadHalf + 0.0072));
    stripes.push({ geometry: st });
  }
  spin.add(mesh(mergeAll(lips), M.h2rMachined, { name: 'h2r-rim-lip' }));
  spin.add(mesh(mergeAll(stripes), M.h2rRimStripe, { name: 'h2r-rim-stripe' }));
  const sp = front ? frontSpokes(rimR) : rearSpokes(rimR);
  spin.add(mesh(sp.body, M.h2rRim, { name: 'h2r-spokes' }), mesh(sp.edge, M.h2rMachined, { name: 'h2r-spoke-edges' }));
  // The hub: its barrel, the bearings' seals at each end, the flanges the discs bolt to.
  {
    const half = front ? 0.062 : 0.088;
    const prof = [[0.026, -half], [0.034, -half], [0.036, -half + 0.004], [0.05, -half + 0.008], [0.056, -half + 0.03], [0.062, -0.02], [0.062, 0.02], [0.056, half - 0.03], [0.05, half - 0.008], [0.036, half - 0.004], [0.034, half], [0.026, half]];
    spin.add(mesh(revolve(prof, 48), M.h2rRim, { name: 'h2r-hub' }));
    const seals = [];
    for (const s of [-1, 1]) { const r = new THREE.RingGeometry(0.0135, 0.026, 32); if (s < 0) r.rotateY(Math.PI); r.translate(0, 0, s * half); seals.push({ geometry: r }); }
    spin.add(mesh(mergeAll(seals), M.h2rSatin, { name: 'h2r-hub-seals' }));
  }
  // The axle (fixed): hollow, its ends and nut.
  {
    const L = front ? 0.25 : 0.24, ax = revolve([[0.009, -L / 2], [0.0125, -L / 2], [0.0125, L / 2], [0.009, L / 2]], 24);
    g.add(mesh(ax, M.h2rAlu, { name: 'h2r-axle' }));
    const bore = revolve([[0.009, L / 2], [0.009, -L / 2]], 24);
    g.add(mesh(bore, M.h2rSatin, { name: 'h2r-axle-bore' }));
  }
  // Discs: front two 330 mm, the rear one 250 mm on the right (the sprocket on the left).
  const discs = front
    ? [[-0.069, { ro: 0.165, ri: 0.128, t: 0.0055, tabs: 10, arms: 5, rc: 0.052, rows: [[30, 0.1335, 0.1595, 4, 0.0029, 0.026]] }],
      [0.069, { ro: 0.165, ri: 0.128, t: 0.0055, tabs: 10, arms: 5, rc: 0.052, rows: [[30, 0.1335, 0.1595, 4, 0.0029, 0.026]] }]]
    : [[0.075, { ro: 0.125, ri: 0.094, t: 0.005, tabs: 8, arms: 4, rc: 0.05, rows: [[24, 0.1, 0.12, 3, 0.0029, 0.03]] }]];
  for (const [z, spec] of discs) {
    const d = floatingDisc({ ...spec, z });
    spin.add(mesh(d.band, front ? M.h2rDiscF : M.h2rDiscR, { name: 'h2r-disc' }));
    spin.add(mesh(d.carrier, M.h2rSatin, { name: 'h2r-disc-carrier' }));
    spin.add(mesh(d.buttons, M.h2rAlu, { name: 'h2r-disc-buttons' }));
    spin.add(mesh(d.bolts, M.h2rAlu, { name: 'h2r-disc-bolts' }));
  }
  if (front) {
    // The speed sensor's toothed ring inside the left disc (the left front photograph).
    const ring = circlePath(0.076, 192, THREE.Shape);
    ring.holes.push(circlePath(0.062, 192));
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * TAU, a1 = a0 + TAU / 96, h = new THREE.Path();
      h.absarc(0, 0, 0.073, a0, a1, false); h.absarc(0, 0, 0.0655, a1, a0, true); ring.holes.push(h);
    }
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.002, bevelEnabled: false, curveSegments: 4 });
    rg.translate(0, 0, -0.074);
    dropSlivers(rg);
    spin.add(mesh(rg, M.h2rAlu, { name: 'h2r-sensor-ring' }));
  } else {
    // The 42-tooth sprocket on a 5/8 in pitch (radius 106 mm at the rollers' centres), dark; the
    // cush drive's machined carrier with its nine windows and the rubber blocks in them; the
    // castellated axle nut and its washer (the left rear photograph).
    const sg = new THREE.ExtrudeGeometry(sprocketShape(42, 0.1062, 0.0102), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1, curveSegments: 6 });
    sg.translate(0, 0, -0.171);
    dropSlivers(sg);
    spin.add(mesh(sg, M.h2rSprocket, { name: 'h2r-sprocket' }));
    const car = new THREE.Shape(); car.absarc(0, 0, 0.078, 0, TAU, false);
    const blocks = [];
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * TAU + 0.09, a1 = a0 + TAU / 9 - 0.18, h = new THREE.Path();
      h.absarc(0, 0, 0.066, a0, a1, false); h.absarc(0, 0, 0.036, a1, a0, true); car.holes.push(h);
      const bs = new THREE.Shape(); bs.absarc(0, 0, 0.064, a0 + 0.02, a1 - 0.02, false); bs.absarc(0, 0, 0.038, a1 - 0.02, a0 + 0.02, true);
      const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
      bg.translate(0, 0, -0.19); blocks.push({ geometry: bg });
    }
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.018, 0, TAU, true); car.holes.push(hole);
    const cg = new THREE.ExtrudeGeometry(car, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 10 });
    cg.translate(0, 0, -0.192);
    dropSlivers(cg);
    spin.add(mesh(cg, M.h2rMachined, { name: 'h2r-sprocket-carrier' }));
    spin.add(mesh(mergeAll(blocks), M.h2rRubber ?? M.h2rSatin, { name: 'h2r-cush-blocks' }));
    // The castellated nut: a hexagon with six slots across its face, on its washer.
    const nut = new THREE.Shape(); for (let i = 0; i < 6; i++) { const [x, y] = polar(0.026, (i / 6) * TAU); i ? nut.lineTo(x, y) : nut.moveTo(x, y); }
    const nh = new THREE.Path(); nh.absarc(0, 0, 0.0095, 0, TAU, true); nut.holes.push(nh);
    const ng = new THREE.ExtrudeGeometry(nut, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 12 });
    ng.translate(0, 0, -0.214);
    const slots = [];
    for (let i = 0; i < 6; i++) { const sb = new THREE.BoxGeometry(0.03, 0.005, 0.006); sb.rotateZ((i / 6) * TAU + TAU / 12); sb.translate(0, 0, -0.2125); slots.push({ geometry: sb }); }
    const washer = new THREE.CylinderGeometry(0.032, 0.032, 0.003, 40); washer.rotateX(Math.PI / 2); washer.translate(0, 0, -0.1965);
    spin.add(mesh(mergeAll([{ geometry: ng }, { geometry: washer }]), M.h2rAlu, { name: 'h2r-hub-nut' }));
    spin.add(mesh(mergeAll(slots), M.h2rSatin, { name: 'h2r-hub-nut-slots' }));
  }
  return g;
}
