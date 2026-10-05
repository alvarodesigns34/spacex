/**
 * The rearsets, traced in millimetres on the right-side photograph (engine/parts.js's grid) and
 * detailed on the photographs of the bike without its bodywork (Wikimedia Commons, "Kawasaki Ninja
 * H2R right", "… exposed left rear"; reference only):
 *  - on each side a machined aluminium hanger shaped like an X, bolted at its front to the frame's
 *    rear leg (its boss at 0.42 m up): its upper arm carries the heel guard, a flat plate up and
 *    back towards the tail with its slot; its lower rear arm the footpeg; its lower front arm the
 *    lever's stop;
 *  - the footpegs, folding, knurled, on their clevis with the return spring;
 *  - on the right the brake pedal, from the peg's pivot forward and down to its toe piece, the rear
 *    master cylinder upright behind the hanger with its pushrod, and its reservoir up under the
 *    tail with the hose;
 *  - on the left the gear lever, forward and up from the peg's pivot to its toe piece, and the rod
 *    with its two ball joints forward to the shift shaft's arm above the sprocket's cover.
 * The left side is the right's mirror (the photographs show them alike). Thicknesses ≈.
 */
import * as THREE from 'three';
import { mergeAll, mesh, mirrorZ, TAU, withCreaseNormals } from './geometry.js';
import { mm } from './engine/parts.js';

const P = Object.fromEntries(Object.entries({
  node: [-171.4, 423.1], fbolt: [-204.3, 422.4], x: [-278.3, 416.6], up: [-270.9, 453.8], piv: [-314.5, 378.7], low: [-239.9, 355.7],
  pedal: [-181.1, 305.5], lever: [-200, 402],
}).map(([k, v]) => [k, mm([v])[0]]));
const HEEL = mm([[-412.5, 520.6], [-317.6, 514.5], [-254.7, 462.4], [-258.2, 437.6], [-369.5, 443.4], [-411.6, 483.6]]);
const SLOT = mm([[-362.6, 499.1], [-304.5, 481.9]]);
/** The shift shaft's arm, above the sprocket's cover (engine/core.js puts the sprocket at −0.065, 0.362). */
const SHIFT = [-0.02, 0.445];

/** A flat bar with round ends from a to b (x, y), `w` wide, from z0 to z1. */
function bar(a, b, w, z0, z1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), s = new THREE.Shape();
  s.absarc(0, 0, w / 2, Math.PI / 2, 1.5 * Math.PI, false); s.absarc(L, 0, w / 2, -Math.PI / 2, Math.PI / 2, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0 - 0.0016, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 10 });
  g.rotateZ(ang); g.translate(a[0], a[1], z0 + 0.0008);
  return withCreaseNormals(g, 40);
}
/** A cylinder across the bike at (x, y) from z0 to z1. */
function across(x, y, z0, z1, r, segs = 24) {
  const c = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), segs); c.rotateX(Math.PI / 2); c.translate(x, y, (z0 + z1) / 2); return c;
}
/** A geometry built for the right side (z > 0), mirrored to the left with its faces kept outward. */
const side = (g, s) => (s > 0 ? g : withCreaseNormals(mirrorZ(g), 40));

export function buildRearsets(M) {
  M.h2rRearset ??= new THREE.MeshStandardMaterial({ name: 'h2r-rearset', color: 0xc9ccd0, metalness: 0.9, roughness: 0.32 });
  M.h2rAmber ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-reservoir-amber', color: 0xb8862e, metalness: 0, roughness: 0.15, transmission: 0.35, thickness: 0.01, transparent: true, opacity: 0.85 });
  const g = new THREE.Group(); g.name = 'h2r-rearsets';
  const alu = [], dark = [], steel = [], black = [], amber = [];
  for (const s of [-1, 1]) {
    const A = [], D = [], S = [], B = [];
    // ---- The hanger: the four arms from the X's centre, 8 mm thick, outside the frame's boss.
    const z0 = 0.209, z1 = 0.217;
    for (const [end, w] of [[P.node, 0.024], [P.up, 0.02], [P.piv, 0.024], [P.low, 0.018]]) A.push({ geometry: bar(P.x, end, w, z0, z1) });
    A.push({ geometry: across(P.x[0], P.x[1], z0, z1, 0.019, 32) });
    // Its two bolts into the frame's boss (one through, one beside it), one at the heel guard; the peg's pivot boss.
    for (const [x, y] of [P.node, P.fbolt, P.up]) { S.push({ geometry: across(x, y, z1, z1 + 0.004, 0.0068, 6) }); S.push({ geometry: across(x, y, z1, z1 + 0.0012, 0.0095, 20) }); }
    A.push({ geometry: across(P.piv[0], P.piv[1], z0 - 0.004, z1 + 0.003, 0.013, 32) });
    // The X's lightening pockets (the photograph's dark triangle above its centre).
    {
      const t = new THREE.Shape([[0, 0], [0.026, 0.004], [0.006, 0.024]].map(([x, y]) => new THREE.Vector2(x, y)));
      const pk = new THREE.ExtrudeGeometry(t, { depth: 0.0006, bevelEnabled: false }); pk.translate(P.x[0] + 0.012, P.x[1] + 0.008, z1 + 0.0001); D.push({ geometry: pk });
    }
    // ---- The heel guard: a flat plate up and back, 4 mm, its slot.
    {
      const sh = new THREE.Shape(HEEL.map(([x, y]) => new THREE.Vector2(x, y)));
      const [a, b] = SLOT, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * 0.0045, ny = dx / L * 0.0045;
      sh.holes.push(new THREE.Path([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]].map(([x, y]) => new THREE.Vector2(x, y))));
      const hp = new THREE.ExtrudeGeometry(sh, { depth: 0.0028, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1 });
      hp.translate(0, 0, 0.2045); A.push({ geometry: hp });
    }
    // ---- The footpeg: its clevis on the pivot, the knurled peg out to 0.29 m, the spring.
    {
      const [x, y] = P.piv;
      A.push({ geometry: across(x, y, z1 + 0.003, z1 + 0.016, 0.0115, 24) });
      const peg = new THREE.CylinderGeometry(0.0105, 0.0105, 0.058, 24); peg.rotateX(Math.PI / 2); peg.translate(x - 0.004, y + 0.002, z1 + 0.045); A.push({ geometry: peg });
      for (let k = 0; k < 9; k++) { const r = new THREE.TorusGeometry(0.0108, 0.0011, 6, 24); r.translate(x - 0.004, y + 0.002, z1 + 0.024 + k * 0.0045); A.push({ geometry: r }); }
      const end = new THREE.SphereGeometry(0.0105, 20, 8, 0, TAU, 0, Math.PI / 2); end.rotateX(Math.PI / 2); end.scale(1, 1, 0.4); end.translate(x - 0.004, y + 0.002, z1 + 0.074); A.push({ geometry: end });
      const pts = []; for (let k = 0; k <= 70; k++) { const a = k / 70 * TAU * 5; pts.push(new THREE.Vector3(x + 0.012 + Math.cos(a) * 0.0045, y - 0.012 + Math.sin(a) * 0.0045, z1 + 0.004 + k / 70 * 0.012)); }
      S.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.0009, 5) });
    }
    if (s > 0) {
      // ---- The brake pedal: from the pivot, inboard of the hanger, forward and down to its toe piece.
      A.push({ geometry: bar(P.piv, P.pedal, 0.016, 0.199, 0.207) });
      A.push({ geometry: across(P.pedal[0], P.pedal[1], 0.207, 0.24, 0.0085, 20) });
      for (let k = 0; k < 5; k++) { const r = new THREE.TorusGeometry(0.0088, 0.0009, 6, 20); r.translate(P.pedal[0], P.pedal[1], 0.214 + k * 0.005); A.push({ geometry: r }); }
      // The master cylinder upright behind the hanger, its pushrod to the pedal, its banjo; the
      // reservoir up under the tail and the hose down to the cylinder.
      const mc = [-0.236, 0.392];
      const body = new THREE.CylinderGeometry(0.0115, 0.0115, 0.06, 24); body.translate(mc[0], mc[1], 0.19); B.push({ geometry: body });
      const cap = new THREE.CylinderGeometry(0.009, 0.0115, 0.008, 24); cap.translate(mc[0], mc[1] + 0.034, 0.19); S.push({ geometry: cap });
      const rod = new THREE.CylinderGeometry(0.003, 0.003, 0.045, 10); rod.translate(mc[0], mc[1] - 0.05, 0.195); S.push({ geometry: rod });
      const clevis = new THREE.BoxGeometry(0.012, 0.012, 0.012); clevis.translate(mc[0], mc[1] - 0.07, 0.2); A.push({ geometry: clevis });
      // (The reservoir on its strap off the frame's upper rear node, rv, behind the leg.)
      const rv = [-0.2, 0.615, 0.165];
      const res = new THREE.CylinderGeometry(0.0115, 0.0115, 0.04, 24); res.translate(...rv); amber.push({ geometry: res });
      const lid = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 24); lid.translate(rv[0], rv[1] + 0.024, rv[2]); B.push({ geometry: lid });
      const strap = new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 24, 1, true); strap.translate(rv[0], rv[1] - 0.004, rv[2]); S.push({ geometry: strap });
      S.push({ geometry: bar([rv[0], rv[1] - 0.004], [-0.162, 0.668], 0.01, rv[2] - 0.004, rv[2] + 0.0) });
      B.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(rv[0], rv[1] - 0.021, rv[2]), new THREE.Vector3(rv[0] - 0.012, rv[1] - 0.08, rv[2] + 0.01), new THREE.Vector3(-0.245, 0.47, 0.19), new THREE.Vector3(mc[0] + 0.006, mc[1] + 0.04, 0.19)]), 40, 0.0042, 10) });
      // The line out of its banjo forward to the calliper's hose along the swingarm (≈).
      steel.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(mc[0] - 0.012, mc[1] + 0.012, 0.19), new THREE.Vector3(mc[0] - 0.04, mc[1] - 0.01, 0.175), new THREE.Vector3(-0.32, 0.36, 0.16)]), 30, 0.0035, 8) });
    } else {
      // ---- The gear lever: from the pivot, inboard, forward and up to its toe piece; the rod with its
      // ball joints forward to the shift shaft's arm.
      const pv = [P.piv[0], P.piv[1]], tip = [-0.205, 0.405], arm = [-0.265, 0.395];
      A.push({ geometry: bar(pv, tip, 0.015, 0.199, 0.207) });
      A.push({ geometry: across(tip[0], tip[1], 0.207, 0.24, 0.0085, 20) });
      for (let k = 0; k < 5; k++) { const r = new THREE.TorusGeometry(0.0088, 0.0009, 6, 20); r.translate(tip[0], tip[1], 0.214 + k * 0.005); A.push({ geometry: r }); }
      // The lever's arm up from the pivot to the rod's rear ball joint.
      A.push({ geometry: bar(pv, arm, 0.012, z1 + 0.016, z1 + 0.022) });
      const shaftArm = [SHIFT[0] - 0.03, SHIFT[1] + 0.02];
      // (The rod outside the hanger and the frame's leg.)
      A.push({ geometry: bar(SHIFT, shaftArm, 0.012, z1 + 0.016, z1 + 0.022) });
      A.push({ geometry: across(SHIFT[0], SHIFT[1], 0.2, z1 + 0.024, 0.008, 6) });
      const a3 = new THREE.Vector3(arm[0], arm[1], z1 + 0.027), b3 = new THREE.Vector3(shaftArm[0], shaftArm[1], z1 + 0.027);
      const rodG = new THREE.CylinderGeometry(0.004, 0.004, a3.distanceTo(b3) - 0.03, 12);
      rodG.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b3.clone().sub(a3).normalize())); rodG.translate(...a3.clone().add(b3).multiplyScalar(0.5).toArray());
      S.push({ geometry: rodG });
      for (const p of [a3, b3]) { const ball = new THREE.SphereGeometry(0.0075, 16, 10); ball.translate(p.x, p.y, p.z); B.push({ geometry: ball }); }
    }
    alu.push(...A.map(o => ({ geometry: side(o.geometry, s) }))); dark.push(...D.map(o => ({ geometry: side(o.geometry, s) })));
    steel.push(...S.map(o => ({ geometry: side(o.geometry, s) }))); black.push(...B.map(o => ({ geometry: side(o.geometry, s) })));
  }
  g.add(mesh(mergeAll(alu), M.h2rRearset, { name: 'h2r-rearset-plates' }));
  g.add(mesh(mergeAll(steel), M.h2rMachined ?? M.h2rAlu, { name: 'h2r-rearset-hardware' }));
  g.add(mesh(mergeAll(dark), M.h2rVoid, { name: 'h2r-rearset-pockets' }));
  g.add(mesh(mergeAll(black), M.h2rSatin, { name: 'h2r-rear-master-cylinder' }));
  g.add(mesh(mergeAll(amber), M.h2rAmber, { name: 'h2r-rear-reservoir' }));
  return g;
}
