/**
 * The brakes (published: Brembo Stylema monobloc radial four-piston callipers on twin 330 mm
 * discs, a Brembo two-piston calliper on the 250 mm rear; data/h2r.js), shaped on the photographs
 * of the bike without its bodywork (Wikimedia Commons; reference only):
 *  - the Stylema: one machined body in bare aluminium, its outer face swelling over its two pistons
 *    in two lobes with "brembo" along it in red; the bridge over the disc with the pads seen through
 *    its window, their pin and spring; the radial mounting ears at its ends with their bolts; the
 *    banjo where the line comes in at the top, and the bleed nipple with its rubber cap;
 *  - the rear calliper, smaller, one piston a side, on its hanger;
 *  - the braided steel lines with their banjo fittings (routing ≈).
 * Sizes ≈ (the published disc and the photographs: the Stylema ≈105 mm along the disc).
 *
 * A calliper's own frame: x along the disc's edge, y radially out, z across (the disc's plane at
 * z = 0, the fork's side towards +z for `side` +1). Built for its side, never mirrored by a scale.
 */
import * as THREE from 'three';
import { mergeAll, mesh, mirrorZ } from './geometry.js';

/** A rounded slab from an outline in the xy plane, extruded from z0 to z1 with edges rounded by `r`. */
function rounded(points, z0, z1, r, seg = 3) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, z1 - z0 - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 16 });
  g.translate(0, 0, z0 + r);
  return g;
}
/** The outline of the Stylema's face: a straight outer edge (the bridge's), rounded ends, and two lobes round the pistons underneath. */
function stylemaOutline(L = 0.105, top = 0.027, lobe = 0.031, waist = 0.021) {
  const pts = [], hx = L / 2, er = 0.013;
  // The outer edge, left to right, then the right end's round.
  for (let i = 0; i <= 8; i++) pts.push([-hx + er + (L - 2 * er) * i / 8, top]);
  for (let k = 1; k <= 6; k++) { const a = Math.PI / 2 - (k / 6) * Math.PI / 2; pts.push([hx - er + Math.cos(a) * er, top - er + Math.sin(a) * er]); }
  // Underneath: down the right end, round the right piston's lobe, the waist, the left lobe, up the left end.
  for (let k = 0; k <= 24; k++) {
    const u = k / 24, x = hx - 0.002 - (L - 0.004) * u;
    const lob = Math.max(Math.cos(Math.PI * (x - 0.025) / 0.05) * (Math.abs(x - 0.025) < 0.025 ? 1 : 0), Math.cos(Math.PI * (x + 0.025) / 0.05) * (Math.abs(x + 0.025) < 0.025 ? 1 : 0));
    const end = Math.max(0, 1 - Math.min(1, (hx - Math.abs(x)) / 0.006));
    pts.push([x, -(waist + (lobe - waist) * Math.max(0, lob) ** 0.6) * (1 - 0.35 * end) + 0.002]);
  }
  for (let k = 0; k <= 6; k++) { const a = Math.PI + Math.PI / 2 - (k / 6) * Math.PI / 2; pts.push([-hx + er + Math.cos(a) * er, top - er + Math.sin(a) * er]); }
  return pts;
}

/** Text drawn on a transparent canvas, for the callipers' "brembo". */
function brakeDecal(M) {
  if (M.h2rDecalBrembo !== undefined) return M.h2rDecalBrembo;
  if (typeof document === 'undefined') return (M.h2rDecalBrembo = null);
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = '#d0141c'; g.font = 'bold 112px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('brembo', 256, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (M.h2rDecalBrembo = new THREE.MeshStandardMaterial({ name: 'h2r-decal-brembo', map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5 }));
}

function materials(M) {
  M.h2rCaliper ??= new THREE.MeshStandardMaterial({ name: 'h2r-calliper', color: 0x9da1a6, metalness: 0.75, roughness: 0.38 });
  M.h2rPad ??= new THREE.MeshStandardMaterial({ name: 'h2r-pad', color: 0x6e5038, metalness: 0.3, roughness: 0.8 });
  M.h2rBraid ??= new THREE.MeshStandardMaterial({ name: 'h2r-braided-line', color: 0xb8bcc0, metalness: 0.85, roughness: 0.4 });
  M.h2rRubberCap ??= new THREE.MeshStandardMaterial({ name: 'h2r-rubber-cap', color: 0x111214, metalness: 0, roughness: 0.75 });
}

/**
 * A Brembo Stylema for one side (+1 right, −1 left): the group's origin on the disc's mid-plane at
 * the calliper's centre; mounted by the caller.
 */
export function stylema(M, side = 1) {
  materials(M);
  const g = new THREE.Group();
  g.name = 'h2r-calliper';
  const out = brakeDecal(M);
  const body = [], dark = [], pads = [], steel = [], cap = [];
  const O = stylemaOutline();
  // The two halves either side of the disc, their outer edges joined by the bridge.
  body.push({ geometry: rounded(O, 0.0045, 0.026, 0.006, 4) });             // the fork's half (+z)
  body.push({ geometry: rounded(O, -0.024, -0.0045, 0.0055, 4) });           // the wheel's half
  body.push({ geometry: rounded([[-0.046, 0.014], [0.046, 0.014], [0.046, 0.03], [-0.046, 0.03]], -0.02, 0.022, 0.004, 3) });
  // The raised panel on the outer face that carries the name, and the pistons' caps on the inner face.
  body.push({ geometry: rounded([[-0.044, 0.0], [0.044, 0.0], [0.044, 0.019], [-0.044, 0.019]], 0.025, 0.0275, 0.0008, 1) });
  for (const x of [-0.025, 0.025]) {
    const pc = new THREE.CylinderGeometry(0.014, 0.0145, 0.004, 32); pc.rotateX(Math.PI / 2); pc.translate(x, -0.012, -0.025);
    body.push({ geometry: pc });
  }
  // The bridge's window over the pads: a dark recess, and the two pads seen in it.
  dark.push({ geometry: rounded([[-0.03, 0.022], [0.03, 0.022], [0.03, 0.0305], [-0.03, 0.0305]], -0.0035, 0.0035, 0.001, 1) });
  for (const z of [-0.0042, 0.0042]) {
    pads.push({ geometry: rounded([[-0.034, 0.0], [0.034, 0.0], [0.031, 0.021], [-0.031, 0.021]], z - 0.0012, z + 0.0012, 0.0004, 1) });
  }
  // The pad pin across the window, its spring over the pads.
  { const pin = new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 12); pin.rotateX(Math.PI / 2); pin.translate(0, 0.026, 0); steel.push({ geometry: pin });
    const spr = new THREE.TorusGeometry(0.012, 0.001, 6, 20, Math.PI); spr.rotateX(Math.PI / 2); spr.translate(0, 0.0315, 0); steel.push({ geometry: spr }); }
  // The radial ears at the ends of the fork's half, and their bolts (radial, into the fork's lugs).
  for (const x of [-0.05, 0.05]) {
    body.push({ geometry: rounded([[x - 0.011, -0.03], [x + 0.011, -0.03], [x + 0.011, -0.006], [x - 0.011, -0.006]], 0.008, 0.026, 0.004, 2) });
    const b = new THREE.CylinderGeometry(0.0062, 0.0062, 0.012, 6); b.translate(x, -0.036, 0.017); steel.push({ geometry: b });
    const w = new THREE.CylinderGeometry(0.0082, 0.0082, 0.0015, 20); w.translate(x, -0.0305, 0.017); steel.push({ geometry: w });
  }
  // The banjo at the top of the fork's half, where the line comes in, and the bleed nipple and its cap.
  { const eye = new THREE.TorusGeometry(0.0065, 0.003, 8, 20); eye.rotateX(Math.PI / 2); eye.translate(0.022, 0.034, 0.015); steel.push({ geometry: eye });
    const bolt = new THREE.CylinderGeometry(0.0055, 0.0055, 0.012, 6); bolt.translate(0.022, 0.036, 0.015); steel.push({ geometry: bolt });
    const nip = new THREE.CylinderGeometry(0.0025, 0.0035, 0.01, 8); nip.translate(0.04, 0.034, 0.012); steel.push({ geometry: nip });
    const c = new THREE.CylinderGeometry(0.004, 0.004, 0.008, 12); c.translate(0.04, 0.041, 0.012); cap.push({ geometry: c }); }
  const build = (items) => { const m = mergeAll(items); return side > 0 ? m : mirrorZ(m); };
  g.add(mesh(build(body), M.h2rCaliper, { name: 'h2r-calliper-body' }));
  g.add(mesh(build(dark), M.h2rVoid ?? M.h2rSatin, { name: 'h2r-calliper-window' }));
  g.add(mesh(build(pads), M.h2rPad, { name: 'h2r-calliper-pads' }));
  g.add(mesh(build(steel), M.h2rAlu, { name: 'h2r-calliper-hardware' }));
  g.add(mesh(build(cap), M.h2rRubberCap, { name: 'h2r-bleed-cap' }));
  if (out) {
    // "brembo" along the raised panel, reading forward on each side's outer face.
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.0175), out);
    d.name = 'h2r-decal-brembo';
    d.position.set(0, 0.0095, side * 0.0279);
    if (side < 0) d.rotation.y = Math.PI;
    g.add(d);
  }
  return g;
}

/** The rear calliper: smaller, one piston a side, cast; for the right (+z) side of the rear disc. */
export function rearCalliper(M) {
  materials(M);
  const g = new THREE.Group(); g.name = 'h2r-calliper-rear';
  const body = [], steel = [], pads = [];
  const O = stylemaOutline(0.07, 0.022, 0.026, 0.024);
  body.push({ geometry: rounded(O, 0.004, 0.022, 0.005, 3) }, { geometry: rounded(O, -0.019, -0.004, 0.005, 3) });
  body.push({ geometry: rounded([[-0.03, 0.01], [0.03, 0.01], [0.03, 0.024], [-0.03, 0.024]], -0.016, 0.018, 0.004, 2) });
  for (const z of [-0.004, 0.004]) pads.push({ geometry: rounded([[-0.024, 0.0], [0.024, 0.0], [0.022, 0.017], [-0.022, 0.017]], z - 0.0011, z + 0.0011, 0.0004, 1) });
  { const pin = new THREE.CylinderGeometry(0.0022, 0.0022, 0.04, 10); pin.rotateX(Math.PI / 2); pin.translate(0, 0.021, 0); steel.push({ geometry: pin }); }
  { const eye = new THREE.TorusGeometry(0.0055, 0.0026, 8, 18); eye.rotateX(Math.PI / 2); eye.translate(-0.015, 0.026, 0.013); steel.push({ geometry: eye }); }
  g.add(mesh(mergeAll(body), M.h2rCaliper, { name: 'h2r-calliper-body' }));
  g.add(mesh(mergeAll(pads), M.h2rPad, { name: 'h2r-calliper-pads' }));
  g.add(mesh(mergeAll(steel), M.h2rAlu, { name: 'h2r-calliper-hardware' }));
  return g;
}

/**
 * A braided steel brake line through points (world or group coordinates), r ≈4.5 mm over the braid,
 * with a crimped ferrule at each end. Returns geometries for the line and the ferrules.
 */
export function brakeLine(points, r = 0.0045) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = Math.max(24, Math.round(curve.getLength() / 0.008));
  const line = new THREE.TubeGeometry(curve, n, r, 10, false);
  const ferrules = [];
  for (const [t, dir] of [[0, 1], [1, -1]]) {
    const p = curve.getPoint(t), tan = curve.getTangent(t).multiplyScalar(dir);
    const f = new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.022, 12);
    f.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan));
    f.translate(...p.clone().addScaledVector(tan, 0.011).toArray());
    ferrules.push({ geometry: f });
  }
  return { line, ferrules: mergeAll(ferrules) };
}
