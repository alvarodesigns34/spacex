/**
 * The bars and their controls, as the photographs of the bike without its bodywork show them
 * (Wikimedia Commons, "Kawasaki Ninja H2R exposed top right", "… exposed left front"; reference
 * only; sizes ≈, scaled by the 22 mm bars and the fork's tubes):
 *  - each clip-on's collar round the fork tube under the top clamp, split at the back and closed by
 *    two bolts, its bar running out, down and back to the grip;
 *  - the grips, ribbed rubber (the right one on the throttle tube, its flange at the inner end), the
 *    bar-end weights, black with their grooves;
 *  - the switch housings at the grips' inner ends, their buttons, and on the right the throttle's
 *    housing with its two cables; on the left the clutch's;
 *  - the radial master cylinders (front brake on the right, clutch on the left): the body on its bar
 *    clamp, the lever's pivot at its front with the reach adjuster, the levers, black, forged in a
 *    gentle curve ahead of the grips, ball-ended; the round reservoirs, smoked, with black ribbed
 *    lids, on their stays above, and the hoses down to the bodies;
 *  - the brake's banjo, where the line to the callipers starts (steer.js routes it).
 * Frame: the steering group's (the bike's at rest).
 */
import * as THREE from 'three';
import { STEER_AXIS, TAU, segMatrix, sweep, mergeAll, mesh } from './geometry.js';
import { PXY } from './photo.js';

const Y = new THREE.Vector3(0, 1, 0);
/** A profile [[r, d], …] turned about an axis from `p` along `dir`, d along it. */
function turned(profile, p, dir, segs = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, d]) => new THREE.Vector2(r, d)), segs);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()));
  g.translate(p.x, p.y, p.z);
  return g;
}
const cyl = (A, B, r, segs = 16) => new THREE.CylinderGeometry(1, 1, 1, segs).applyMatrix4(segMatrix(A, B, r));

function materials(M) {
  M.h2rRubber ??= new THREE.MeshStandardMaterial({ name: 'h2r-grip', color: 0x1a1b1c, metalness: 0, roughness: 0.9 });
  M.h2rAmber ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-reservoir', color: 0x6b4a1c, metalness: 0.1, roughness: 0.2, transmission: 0, clearcoat: 1 });
  M.h2rLever ??= new THREE.MeshStandardMaterial({ name: 'h2r-lever', color: 0x17181a, metalness: 0.6, roughness: 0.32 });
  M.h2rRedButton ??= new THREE.MeshStandardMaterial({ name: 'h2r-kill-switch', color: 0xb3161b, metalness: 0.1, roughness: 0.45 });
  M.h2rHose ??= new THREE.MeshStandardMaterial({ name: 'h2r-hose', color: 0x101112, metalness: 0.05, roughness: 0.6 });
}

/** The ribbed grip's profile along its length L (r, d), with the throttle's flange if `flange`. */
function gripProfile(L, flange) {
  const p = [[0.0112, 0], [flange ? 0.021 : 0.0185, 0.0005], [flange ? 0.021 : 0.0185, 0.004], [0.0172, 0.007]];
  const ribs = Math.floor((L - 0.02) / 0.0055);
  for (let i = 0; i < ribs; i++) { const d = 0.009 + i * 0.0055; p.push([0.0176, d], [0.0183, d + 0.0015], [0.0183, d + 0.0035], [0.0176, d + 0.005]); }
  p.push([0.0178, L - 0.006], [0.0186, L - 0.002], [0.0112, L]);
  return p;
}

/** One side's controls (+1 right, −1 left). Returns the group's items and, on the right, the brake's banjo. */
function side(M, s) {
  const out = { satin: [], rubber: [], lever: [], alu: [], amber: [], hose: [], red: [], gold: [], banjo: null };
  const root = new THREE.Vector3(...PXY(425, 292), s * 0.104), end = new THREE.Vector3(...PXY(472, 352), s * 0.355);
  const e1 = end.clone().sub(root).normalize(), L = end.distanceTo(root);
  const fwd = new THREE.Vector3(1, 0, 0).addScaledVector(e1, -e1.x).normalize();
  const upv = new THREE.Vector3().crossVectors(fwd, e1).normalize(); if (upv.y < 0) upv.negate();
  const at = (d, f = 0, u = 0) => root.clone().addScaledVector(e1, d).addScaledVector(fwd, f).addScaledVector(upv, u);
  // The collar round the fork tube, its boss for the bar, the split and its two bolts at the back.
  out.satin.push({ geometry: turned([[0.0282, -0.024], [0.033, -0.023], [0.0335, -0.02], [0.0335, 0.02], [0.033, 0.023], [0.0282, 0.024]], root, STEER_AXIS, 40) });
  out.satin.push({ geometry: turned([[0.0, 0.0], [0.0165, 0.0], [0.0165, 0.034], [0.012, 0.038], [0, 0.038]], root.clone().addScaledVector(e1, 0.012), e1, 28) });
  for (const k of [-0.012, 0.012]) {
    const b = root.clone().addScaledVector(STEER_AXIS, k).addScaledVector(fwd, -0.036);
    out.alu.push({ geometry: cyl(b.clone().addScaledVector(e1, -0.009), b.clone().addScaledVector(e1, 0.009), 0.0042, 12) });
  }
  // The bar, 22 mm.
  out.satin.push({ geometry: cyl(at(0.04), at(L - 0.004), 0.011, 20) });
  // The grip (the right one on the throttle tube), the bar-end weight.
  const g0 = L * 0.52, gl = L - g0 - 0.004;
  out.rubber.push({ geometry: turned(gripProfile(gl, s > 0), at(g0), e1, 36) });
  out.satin.push({ geometry: turned([[0.0, 0.0], [0.0185, 0.0], [0.0195, 0.003], [0.0195, 0.008], [0.0178, 0.009], [0.0178, 0.011], [0.0195, 0.012], [0.0195, 0.018], [0.017, 0.022], [0.009, 0.0245], [0, 0.025]], at(L - 0.003), e1, 32) });
  out.alu.push({ geometry: turned([[0.0, 0.0244], [0.0065, 0.0244], [0.0065, 0.0255], [0, 0.0256]], at(L - 0.003), e1, 16) });
  // The switch housing at the grip's inner end: a clamshell round the bar, its buttons on the
  // rider's side; the right one is the throttle's, the kill switch in red.
  const sw = at(g0 - 0.027);
  out.satin.push({ geometry: turned([[0.012, 0.0], [0.021, 0.001], [0.0275, 0.008], [0.0285, 0.016], [0.0285, 0.03], [0.026, 0.038], [0.02, 0.0425], [0.012, 0.044]], sw.clone().addScaledVector(e1, -0.019), e1, 32) });
  out.satin.push({ geometry: sweep([sw.clone().addScaledVector(fwd, -0.018).addScaledVector(upv, -0.01).addScaledVector(e1, -0.008), sw.clone().addScaledVector(fwd, -0.024).addScaledVector(upv, -0.014).addScaledVector(e1, 0.012)], 0.028, 0.026, { up: upv, e: 0.35, steps: 4 }) });
  for (const [du, dd, red] of s > 0 ? [[0.004, -0.004, true], [-0.012, 0.008, false]] : [[0.006, -0.006, false], [-0.01, 0.006, false], [-0.02, -0.004, false]]) {
    const c = sw.clone().addScaledVector(fwd, -0.0335).addScaledVector(upv, du - 0.008).addScaledVector(e1, dd);
    const b = cyl(c, c.clone().addScaledVector(fwd, -0.004), 0.0052, 14);
    (red ? out.red : out.satin).push({ geometry: b });
  }
  // The master cylinder (brake on the right, clutch on the left): its clamp on the bar inboard of
  // the switches, the body running forward, the lever's pivot boss at its front.
  const mcC = at(g0 - 0.068);
  out.satin.push({ geometry: turned([[0.0112, 0], [0.0165, 0], [0.0172, 0.003], [0.0172, 0.025], [0.0165, 0.028], [0.0112, 0.028]], mcC.clone().addScaledVector(e1, -0.014), e1, 28) });
  const body0 = mcC.clone().addScaledVector(fwd, 0.012), body1 = mcC.clone().addScaledVector(fwd, 0.088);
  out.satin.push({ geometry: turned([[0.0, 0], [0.0122, 0], [0.0125, 0.004], [0.0125, 0.06], [0.0118, 0.066], [0.0095, 0.076], [0, 0.077]], body0, fwd, 28) });
  const piv = body1.clone().addScaledVector(fwd, -0.006);
  out.satin.push({ geometry: cyl(piv.clone().addScaledVector(upv, -0.016), piv.clone().addScaledVector(upv, 0.016), 0.0095, 20) });
  // The reach adjuster's knurled wheel on the pivot, a gold ring on it.
  out.alu.push({ geometry: cyl(piv.clone().addScaledVector(upv, 0.016), piv.clone().addScaledVector(upv, 0.024), 0.0082, 24) });
  out.gold.push({ geometry: (() => { const t = new THREE.TorusGeometry(0.0085, 0.0011, 6, 24); t.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), upv)); const c = piv.clone().addScaledVector(upv, 0.02); t.translate(c.x, c.y, c.z); return t; })() });
  // The lever: from its pivot out along the bar ahead of the grip, curving in a little towards
  // it, its section tapering, a ball at its end.
  const lev = [];
  for (let k = 0; k <= 6; k++) { const u = k / 6; lev.push(piv.clone().addScaledVector(e1, 0.012 + 0.17 * u).addScaledVector(fwd, -0.004 - 0.016 * u * u).addScaledVector(upv, -0.012 * u)); }
  out.lever.push({ geometry: sweep(lev, (t) => 0.0075 - 0.0015 * t, (t) => 0.017 - 0.006 * t, { up: upv, e: 0.4, steps: 36 }) });
  const tip = lev[lev.length - 1].clone().addScaledVector(e1, 0.004);
  out.lever.push({ geometry: (() => { const b = new THREE.SphereGeometry(0.0072, 16, 12); b.translate(tip.x, tip.y, tip.z); return b; })() });
  // The reservoir on its stay above the master cylinder, near the clamp: a round cup, smoked, its
  // ribbed black lid; the hose down to the body's top.
  const rc = mcC.clone().addScaledVector(fwd, 0.03).addScaledVector(upv, 0.055).addScaledVector(e1, -0.03);
  out.amber.push({ geometry: turned([[0.0, 0], [0.019, 0], [0.0205, 0.004], [0.0205, 0.032], [0.019, 0.034], [0, 0.034]], rc, Y, 32) });
  const lid = rc.clone().add(new THREE.Vector3(0, 0.033, 0));
  out.satin.push({ geometry: turned([[0.0, 0], [0.0222, 0], [0.0222, 0.009], [0.020, 0.011], [0, 0.0115]], lid, Y, 24) });
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, p = lid.clone().add(new THREE.Vector3(Math.cos(a) * 0.0224, 0.0045, Math.sin(a) * 0.0224)); out.satin.push({ geometry: (() => { const b = new THREE.BoxGeometry(0.0016, 0.007, 0.0016); b.translate(p.x, p.y, p.z); return b; })() }); }
  out.satin.push({ geometry: cyl(rc.clone().add(new THREE.Vector3(0, 0.012, 0)), mcC.clone().addScaledVector(upv, 0.012).addScaledVector(fwd, 0.02), 0.0028, 8) });
  out.hose.push({ geometry: sweep([rc.clone().add(new THREE.Vector3(0, -0.002, 0)), rc.clone().add(new THREE.Vector3(0, -0.02, 0)).addScaledVector(fwd, 0.015), body0.clone().addScaledVector(fwd, 0.05).addScaledVector(upv, 0.012)], 0.008, 0.008, { e: 1, steps: 18, n: 10, open: true }) });
  // The outlet's banjo under the body's front: the brake line (right) or the clutch's hose (left).
  const bj = body0.clone().addScaledVector(fwd, 0.058).addScaledVector(upv, -0.016);
  out.alu.push({ geometry: (() => { const t = new THREE.TorusGeometry(0.0065, 0.003, 8, 20); t.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), e1)); t.translate(bj.x, bj.y, bj.z); return t; })() });
  out.alu.push({ geometry: cyl(bj.clone().addScaledVector(e1, -0.008), bj.clone().addScaledVector(e1, 0.008), 0.0055, 6) });
  if (s > 0) out.banjo = bj.clone().addScaledVector(upv, -0.008);
  else out.hose.push({ geometry: sweep([bj.clone().addScaledVector(upv, -0.006), bj.clone().addScaledVector(upv, -0.06).addScaledVector(fwd, -0.02), new THREE.Vector3(...PXY(470, 395), -0.16), new THREE.Vector3(...PXY(560, 470), -0.17)], 0.0085, 0.0085, { e: 1, steps: 40, n: 10, open: true }) });
  // The throttle's two cables (right), out of the housing's front and down behind the head.
  if (s > 0) {
    for (const dz of [-0.006, 0.006]) {
      const o = sw.clone().addScaledVector(fwd, 0.026).addScaledVector(upv, -0.012).addScaledVector(e1, dz);
      out.hose.push({ geometry: sweep([o, o.clone().addScaledVector(fwd, 0.03).addScaledVector(upv, -0.02), new THREE.Vector3(...PXY(445, 330), 0.12 + dz), new THREE.Vector3(...PXY(480, 380), 0.09 + dz), new THREE.Vector3(...PXY(540, 400), 0.07 + dz)], 0.0068, 0.0068, { e: 1, steps: 40, n: 8, open: true }) });
    }
  }
  return out;
}

/** Both sides' controls as meshes; `brakeBanjo` where the front brake's line leaves the right master cylinder. */
export function buildControls(M) {
  materials(M);
  const g = new THREE.Group(); g.name = 'h2r-controls';
  const all = { satin: [], rubber: [], lever: [], alu: [], amber: [], hose: [], red: [], gold: [] };
  let banjo = null;
  for (const s of [-1, 1]) { const o = side(M, s); for (const k of Object.keys(all)) all[k].push(...o[k]); if (o.banjo) banjo = o.banjo; }
  g.add(mesh(mergeAll(all.satin), M.h2rSatin, { name: 'h2r-bars-and-housings' }));
  g.add(mesh(mergeAll(all.rubber), M.h2rRubber, { name: 'h2r-grip' }));
  g.add(mesh(mergeAll(all.lever), M.h2rLever, { name: 'h2r-lever' }));
  g.add(mesh(mergeAll(all.alu), M.h2rAlu, { name: 'h2r-controls-hardware' }));
  g.add(mesh(mergeAll(all.amber), M.h2rAmber, { name: 'h2r-reservoir' }));
  g.add(mesh(mergeAll(all.hose), M.h2rHose, { name: 'h2r-control-hoses' }));
  g.add(mesh(mergeAll(all.red), M.h2rRedButton, { name: 'h2r-kill-switch' }));
  g.add(mesh(mergeAll(all.gold), M.h2rGold, { name: 'h2r-lever-adjusters' }));
  g.userData.brakeBanjo = banjo;
  return g;
}
