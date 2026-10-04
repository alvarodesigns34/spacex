/**
 * The Ninja H2R's supercharged 998 cm³ inline four, rebuilt piece by piece (October 2026).
 *
 * PROVENANCE
 *  - Published: the engine's type, displacement, bore and stroke (76.0 × 55.0 mm), the impeller's
 *    9.2 × gearing and blade count (data/h2r.js, Kawasaki).
 *  - Outlines on the right side: traced on a free photograph of the bike at a show (Wikimedia
 *    Commons, "Kawasaki Ninja H2R right"; reference only, not in the repository), its scale and
 *    roll solved on the two axles and the published wheelbase (1.644 mm a pixel, ≈ ±1 cm): the
 *    crankcase, the cast upper case, the sump, the oil cooler, the clutch cover (r 0.127 m) with its
 *    raised disc (r 0.090 m) and the pickup cover (r 0.035 m).
 *  - The cylinders, the head and the intake chamber keep the lines traced before on Kawasaki's
 *    studio photograph; the left side's covers and the supercharger's place too.
 *  - Reconstructed (≈): the widths, every depth across the bike, the bolts' pattern and sizes, the
 *    ribs, the hoses' routes, the cam cover's form, the throttle bodies.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right.
 */
import * as THREE from 'three';
import { slab, mergeAll, mesh, TAU } from './h2rParts.js';
import { PXY } from './h2rBody.js';

/** A side outline (x, y in metres) extruded across the bike from z0 to z1, its edges rounded by `bevel`. */
function ext(points, z0, z1, bevel = 0.008, seg = 3) {
  const g = slab(points, Math.max(0.001, z1 - z0 - 2 * bevel), bevel, seg);
  g.translate(0, 0, z0 + bevel);
  return g;
}
/** A lathed part (profile [r, d] with d along the axis), its axis across the bike at (x, y), facing out from z0 towards `side` (+1 right, −1 left). */
function turned(profile, x, y, z0, side, segs = 64) {
  // (The lathe's faces point outward when the profile runs up its axis: from the base out.)
  const pts = profile.map(([r, d]) => new THREE.Vector2(r, d));
  if (pts[0].y > pts[pts.length - 1].y) pts.reverse();
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(side * Math.PI / 2);
  g.translate(x, y, z0);
  return g;
}
/** Hex-headed bolts on a circle round (x, y), their heads out of the face at z, facing `side`. */
function boltRing(out, x, y, z, side, r, n, { head = 0.0052, h = 0.006, a0 = 0.3, skip = [] } = {}) {
  for (let k = 0; k < n; k++) {
    if (skip.includes(k)) continue;
    const a = a0 + (k / n) * TAU;
    out.push({ geometry: bolt(x + Math.cos(a) * r, y + Math.sin(a) * r, z, side, head, h) });
  }
}
function bolt(x, y, z, side, head = 0.0052, h = 0.006) {
  const b = new THREE.CylinderGeometry(head, head, h, 6);
  b.rotateX(Math.PI / 2); b.rotateZ(Math.PI / 6);
  b.translate(x, y, z + side * h / 2);
  // A washer under it.
  return mergeAll([{ geometry: b }, { geometry: (() => { const w = new THREE.CylinderGeometry(head * 1.35, head * 1.35, 0.0012, 16); w.rotateX(Math.PI / 2); w.translate(x, y, z + side * 0.0006); return w; })() }]);
}
/** A rubber hose along points. */
function hose(points, r, segs = 40) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), segs, r, 12);
}
const px = (u, v) => PXY(u, v);

export function buildEngine(M) {
  // Materials: the cases a dark satin charcoal (not black: the photographs show their form in
  // grey); the covers a shade lighter; the castings bare aluminium; the supercharger red anodised.
  M.h2rEngine ??= new THREE.MeshStandardMaterial({ name: 'h2r-engine', color: 0x34363a, metalness: 0.35, roughness: 0.52 });
  M.h2rCaseGrey ??= new THREE.MeshStandardMaterial({ name: 'h2r-case-grey', color: 0x6c6f74, metalness: 0.45, roughness: 0.48 });
  M.h2rRedAnod ??= new THREE.MeshStandardMaterial({ name: 'h2r-red-anodised', color: 0xa3200f, metalness: 0.7, roughness: 0.32 });
  M.h2rPlenum ??= new THREE.MeshStandardMaterial({ name: 'h2r-intake-chamber', color: 0xc4c8cc, metalness: 0.9, roughness: 0.3 });
  M.h2rCast ??= new THREE.MeshStandardMaterial({ name: 'h2r-cast-aluminium', color: 0xa9adb2, metalness: 0.75, roughness: 0.46 });
  M.h2rRubber ??= new THREE.MeshStandardMaterial({ name: 'h2r-grip', color: 0x1a1b1c, metalness: 0, roughness: 0.9 });
  const g = new THREE.Group(); g.name = 'h2r-engine';
  const dark = [], grey = [], cast = [], bright = [], red = [], rubber = [], plenum = [];

  // ---- The crankcase: upper and lower halves, split along the crankshaft, the gearbox behind.
  const CASE = [[-0.1411, 0.5549], [0.0887, 0.5718], [0.1717, 0.5409], [0.2141, 0.4844], [0.2176, 0.3365], [0.1681, 0.3435], [-0.0455, 0.3385], [-0.0686, 0.2722], [-0.1179, 0.271], [-0.1386, 0.3116]];
  const ZC = 0.15;
  dark.push({ geometry: ext(CASE, -ZC, ZC, 0.012) });
  // The parting line: a raised flange round both halves at the crank's height.
  const split = 0.415;
  dark.push({ geometry: ext([[-0.142, split - 0.006], [0.216, split - 0.006], [0.216, split + 0.006], [-0.142, split + 0.006]], -ZC - 0.004, ZC + 0.004, 0.002) });
  // Its bolts along the flange, both sides.
  for (const s of [-1, 1]) for (let k = 0; k < 9; k++) dark.push({ geometry: bolt(-0.12 + k * 0.04, split, s * (ZC + 0.004), s, 0.0045, 0.006) });
  // Ribs cast into the lower half's sides (stiffeners), between the covers.
  for (const s of [-1, 1]) for (const [x0, y0, x1, y1] of [[-0.11, 0.30, -0.07, 0.36], [0.16, 0.35, 0.2, 0.40], [0.12, 0.35, 0.17, 0.39]]) {
    const d = new THREE.Vector2(x1 - x0, y1 - y0), n = new THREE.Vector2(-d.y, d.x).normalize().multiplyScalar(0.004);
    dark.push({ geometry: ext([[x0 - n.x, y0 - n.y], [x1 - n.x, y1 - n.y], [x1 + n.x, y1 + n.y], [x0 + n.x, y0 + n.y]], s > 0 ? ZC : -ZC - 0.01, s > 0 ? ZC + 0.01 : -ZC, 0.002) });
  }

  // ---- The cast upper case behind the cylinders (the cam chain's tunnel on the right, the
  // supercharger's drive on the left), bare aluminium.
  const UP = [[-0.1342, 0.6817], [0.0036, 0.6932], [0.0862, 0.6787], [0.1044, 0.6051], [0.089, 0.5603], [-0.131, 0.5453]];
  cast.push({ geometry: ext(UP, -0.165, 0.165, 0.01) });
  // Its round boss on the right (the photograph's emblem), r ≈0.03 m.
  cast.push({ geometry: turned([[0, 0.012], [0.024, 0.011], [0.03, 0.006], [0.031, 0]], -0.0577, 0.6457, 0.165, 1, 40) });
  boltRing(bright, -0.0577, 0.6457, 0.177, 1, 0.022, 3, { head: 0.0035, h: 0.004 });

  // ---- The cylinders and the head, leaning forward (the lines traced on the studio photograph),
  // with the water jacket's ribs, the head's joint, and the cam cover on top.
  const CYL = [[0.255, 0.508], [0.298, 0.661], [0.305, 0.723], [0.251, 0.750], [0.135, 0.746], [0.055, 0.678], [0.001, 0.553]];
  cast.push({ geometry: ext(CYL, -0.175, 0.175, 0.012) });
  // The head gasket's line and the head's lower flange, a band across the block.
  {
    const a = new THREE.Vector2(0.298, 0.661), b = new THREE.Vector2(0.055, 0.678);
    const t = new THREE.Vector2(0.004, -0.06).normalize().multiplyScalar(0.006);
    cast.push({ geometry: ext([[a.x + t.x, a.y + t.y], [b.x + t.x, b.y + t.y], [b.x - t.x, b.y - t.y], [a.x - t.x, a.y - t.y]], -0.18, 0.18, 0.002) });
  }
  // Ribs on the block's sides.
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const f = 0.15 + k * 0.17, x0 = 0.03 + f * 0.25, y0 = 0.565 + f * 0.09;
    cast.push({ geometry: ext([[x0, y0], [x0 + 0.13, y0 + 0.02], [x0 + 0.13, y0 + 0.027], [x0, y0 + 0.007]], s > 0 ? 0.175 : -0.183, s > 0 ? 0.183 : -0.175, 0.002) });
  }
  // The cam cover, dark, a little narrower than the head, with its two cam bumps along it.
  const CAM = [[0.135, 0.746], [0.251, 0.750], [0.278, 0.742], [0.272, 0.768], [0.24, 0.79], [0.15, 0.786], [0.125, 0.765]];
  dark.push({ geometry: ext(CAM, -0.16, 0.16, 0.01) });
  // The four ignition coils' caps through it, black rubber, and the cover's bolts.
  for (let i = 0; i < 4; i++) {
    const z = -0.114 + i * 0.076;
    const c = new THREE.CylinderGeometry(0.016, 0.018, 0.03, 24); c.rotateZ(0.32); c.translate(0.205, 0.792, z);
    rubber.push({ geometry: c });
    const top = new THREE.BoxGeometry(0.04, 0.012, 0.03); top.rotateZ(0.32); top.translate(0.2, 0.808, z);
    rubber.push({ geometry: top });
  }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) dark.push({ geometry: bolt(0.145 + k * 0.04, 0.775 + k * 0.004, s * 0.16, s, 0.0042, 0.006) });

  // ---- The clutch cover on the right: a stepped flange (r 0.127 m) round a domed body, the raised
  // disc (r 0.090 m), and the ring of bolts.
  const [cx, cy] = [-0.0108, 0.4676];
  dark.push({ geometry: turned([[0, 0.042], [0.06, 0.041], [0.085, 0.036], [0.1, 0.03], [0.116, 0.02], [0.122, 0.012], [0.127, 0.006], [0.128, 0]], cx, cy, ZC, 1, 96) });
  grey.push({ geometry: turned([[0, 0.012], [0.08, 0.011], [0.088, 0.007], [0.09, 0]], cx - 0.005, cy + 0.003, ZC + 0.04, 1, 96) });
  // The disc's flat notch on its upper front, as the photograph shows.
  grey.push({ geometry: ext([[cx - 0.02, cy + 0.085], [cx + 0.03, cy + 0.09], [cx + 0.045, cy + 0.06], [cx + 0.01, cy + 0.055]], ZC + 0.04, ZC + 0.048, 0.002) });
  boltRing(bright, cx, cy, ZC + 0.008, 1, 0.12, 12, { head: 0.0048, h: 0.007 });
  boltRing(bright, cx - 0.005, cy + 0.003, ZC + 0.052, 1, 0.075, 6, { head: 0.0035, h: 0.004, a0: 0.1 });
  // The oil filler on its top front, a red-ringed cap.
  { const cap = new THREE.CylinderGeometry(0.017, 0.018, 0.022, 32); cap.rotateX(Math.PI / 2); cap.translate(0.076, 0.547, ZC + 0.03); grey.push({ geometry: cap }); }
  { const ring = new THREE.TorusGeometry(0.0185, 0.0028, 10, 40); ring.translate(0.076, 0.547, ZC + 0.04); red.push({ geometry: ring }); }

  // ---- The pickup cover (the crank's), r 0.035 m, and its bolts.
  grey.push({ geometry: turned([[0, 0.018], [0.026, 0.017], [0.033, 0.01], [0.036, 0]], 0.097, 0.429, ZC, 1, 48) });
  boltRing(bright, 0.097, 0.429, ZC + 0.002, 1, 0.042, 4, { head: 0.004, h: 0.006, a0: 0.78 });

  // ---- The sump, cast, with its cooling ribs underneath, and the drain plug.
  const SUMP = [[-0.0704, 0.3461], [0.1679, 0.3517], [0.1859, 0.2864], [0.1462, 0.2279], [-0.0345, 0.2187], [-0.0602, 0.2642]];
  cast.push({ geometry: ext(SUMP, -0.11, 0.11, 0.008) });
  for (let k = 0; k < 6; k++) {
    const z = -0.09 + k * 0.036;
    cast.push({ geometry: ext([[-0.03, 0.222], [0.14, 0.231], [0.14, 0.218], [-0.03, 0.209]], z - 0.003, z + 0.003, 0.0015) });
  }
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) cast.push({ geometry: bolt(-0.05 + k * 0.042, 0.343, s * 0.11, s, 0.004, 0.005) });
  { const d = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6); d.translate(-0.0538, 0.214, 0.03); bright.push({ geometry: d }); }

  // ---- The oil cooler at the front, under the headers: a finned core in its black frame.
  const CO = [0.1188, 0.2277, 0.2545, 0.3449];
  dark.push({ geometry: ext([[CO[0], CO[2]], [CO[1], CO[2]], [CO[1], CO[2] + 0.008], [CO[0], CO[2] + 0.008]], -0.09, 0.09, 0.002) });
  dark.push({ geometry: ext([[CO[0], CO[3] - 0.008], [CO[1], CO[3] - 0.008], [CO[1], CO[3]], [CO[0], CO[3]]], -0.09, 0.09, 0.002) });
  for (let k = 0; k < 14; k++) {
    const y = CO[2] + 0.012 + k * 0.0055;
    dark.push({ geometry: ext([[CO[0] + 0.004, y], [CO[1] - 0.004, y], [CO[1] - 0.004, y + 0.0018], [CO[0] + 0.004, y + 0.0018]], -0.088, 0.088, 0) });
  }
  // The oil filter, a black can on the front of the crankcase, below the cooler.
  { const f = new THREE.CylinderGeometry(0.034, 0.034, 0.075, 40); f.rotateZ(-1.2); f.translate(0.215, 0.275, -0.05); dark.push({ geometry: f }); }

  // ---- The left side: the generator cover and the sprocket cover (with its slots), and the
  // water pump at the front with the hoses to the radiator.
  // (The sprocket's cover centred on the gearbox's sprocket, where the chain starts: h2r.js.)
  const [gx, gy] = px(583, 578), [sx, sy] = [-0.065, 0.362];
  dark.push({ geometry: turned([[0, 0.036], [0.05, 0.035], [0.07, 0.026], [0.08, 0.016], [0.085, 0.006], [0.086, 0]], gx, gy, -ZC, -1, 80) });
  boltRing(bright, gx, gy, -ZC - 0.006, -1, 0.081, 10, { head: 0.0045, h: 0.006 });
  dark.push({ geometry: turned([[0, 0.03], [0.045, 0.029], [0.062, 0.02], [0.068, 0]], sx, sy, -ZC, -1, 64) });
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * TAU, r0 = 0.03;
    grey.push({ geometry: ext([[sx + Math.cos(a) * r0, sy + Math.sin(a) * r0], [sx + Math.cos(a + 0.4) * r0, sy + Math.sin(a + 0.4) * r0], [sx + Math.cos(a + 0.4) * 0.055, sy + Math.sin(a + 0.4) * 0.055], [sx + Math.cos(a) * 0.055, sy + Math.sin(a) * 0.055]], -ZC - 0.032, -ZC - 0.029, 0) });
  }
  boltRing(bright, sx, sy, -ZC - 0.004, -1, 0.064, 6, { head: 0.0042, h: 0.006 });
  { const wp = turned([[0, 0.03], [0.034, 0.028], [0.042, 0.014], [0.044, 0]], 0.185, 0.43, -ZC, -1, 48); grey.push({ geometry: wp }); }
  boltRing(bright, 0.185, 0.43, -ZC - 0.004, -1, 0.04, 4, { head: 0.004, h: 0.005 });
  rubber.push({ geometry: hose([[0.2, 0.45, -0.19], [0.26, 0.5, -0.19], [0.31, 0.58, -0.17], [0.34, 0.66, -0.13]], 0.013) });
  rubber.push({ geometry: hose([[0.27, 0.72, 0.12], [0.33, 0.7, 0.15], [0.37, 0.66, 0.15]], 0.012) });

  // ---- The supercharger behind the cylinders on the left: the scroll housing round the impeller,
  // red anodised, its volute spiralling out to the outlet that rises into the intake chamber; the
  // inlet facing the ram-air duct; the drive's housing behind it.
  const [scx, scy] = px(672, 470), scz = -0.11;
  red.push({ geometry: turned([[0, -0.045], [0.05, -0.045], [0.068, -0.036], [0.077, -0.02], [0.079, 0], [0.077, 0.02], [0.068, 0.036], [0.05, 0.045], [0, 0.045]], scx, scy, scz, 1, 72) });
  {
    // The volute: a tube spiralling round the housing, growing, out to the outlet.
    const pts = [];
    for (let i = 0; i <= 40; i++) { const a = -0.5 + i / 40 * 5.4, r = 0.075 + 0.02 * i / 40; pts.push(new THREE.Vector3(scx + Math.cos(a) * r, scy + Math.sin(a) * r, scz + 0.012)); }
    pts.push(new THREE.Vector3(scx + 0.06, scy + 0.13, scz + 0.03), new THREE.Vector3(scx + 0.08, scy + 0.2, scz + 0.06));
    red.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.024, 16) });
  }
  // The inlet bell on the left face, polished, its lip, and the housing's bolts.
  bright.push({ geometry: turned([[0.034, 0], [0.04, 0.006], [0.046, 0.018], [0.05, 0.024], [0.047, 0.026], [0.036, 0.012], [0.03, 0]], scx, scy, scz - 0.045, -1, 56) });
  boltRing(bright, scx, scy, scz - 0.045, -1, 0.066, 8, { head: 0.0042, h: 0.005 });
  // The impeller seen in the inlet: its hub and blades (6 at the tip, Kawasaki), polished.
  {
    const hub = new THREE.ConeGeometry(0.014, 0.03, 24); hub.rotateX(-Math.PI / 2); hub.translate(scx, scy, scz - 0.045);
    bright.push({ geometry: hub });
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU, bl = new THREE.BoxGeometry(0.03, 0.0016, 0.02);
      bl.translate(0.02, 0, 0); bl.rotateZ(a); bl.translate(scx, scy, scz - 0.035);
      bright.push({ geometry: bl });
    }
  }

  // ---- The throttle bodies between the intake chamber and the head (four, polished), and the
  // intake chamber itself, aluminium, with its seam and bolts.
  for (let i = 0; i < 4; i++) {
    const z = -0.114 + i * 0.076;
    const tb = new THREE.CylinderGeometry(0.022, 0.024, 0.06, 28); tb.rotateZ(0.45); tb.translate(0.12, 0.77, z);
    plenum.push({ geometry: tb });
    const lever = new THREE.BoxGeometry(0.012, 0.03, 0.004); lever.translate(0.12, 0.77, z + 0.026);
    bright.push({ geometry: lever });
  }
  const CH = [px(470, 398), px(482, 362), px(560, 336), px(650, 350), px(665, 395), px(600, 412), px(520, 410)];
  plenum.push({ geometry: ext(CH, -0.15, 0.15, 0.022, 4) });
  {
    // The seam round its middle and the bolts along it.
    const seam = CH.map(([x, y]) => [x, y]);
    const c = seam.reduce((a, p) => [a[0] + p[0] / seam.length, a[1] + p[1] / seam.length], [0, 0]);
    const ring = seam.map(([x, y]) => [c[0] + (x - c[0]) * 1.025, c[1] + (y - c[1]) * 1.025]);
    plenum.push({ geometry: ext(ring, -0.004, 0.004, 0.001) });
    for (const [x, y] of seam) bright.push({ geometry: (() => { const b = new THREE.CylinderGeometry(0.004, 0.004, 0.012, 6); b.translate(x, y + 0.004, 0); return b; })() });
  }

  g.add(mesh(mergeAll(dark), M.h2rEngine, { name: 'h2r-engine-cases' }));
  g.add(mesh(mergeAll(grey), M.h2rCaseGrey, { name: 'h2r-engine-covers' }));
  g.add(mesh(mergeAll(cast), M.h2rCast, { name: 'h2r-engine-castings' }));
  g.add(mesh(mergeAll(bright), M.h2rMachined ?? M.h2rSatin, { name: 'h2r-engine-bolts' }));
  g.add(mesh(mergeAll(red), M.h2rRedAnod, { name: 'h2r-supercharger' }));
  g.add(mesh(mergeAll(rubber), M.h2rRubber, { name: 'h2r-engine-hoses' }));
  g.add(mesh(mergeAll(plenum), M.h2rPlenum, { name: 'h2r-intake-chamber' }));
  return g;
}
