/** The steering: the fork, the triple clamps, the bars and their controls, the front wheel and fender. */
import * as THREE from 'three';
import { AXLE_F, STEER_AXIS, STEER_GROUND, RF, D2R, segMatrix, slab, loft, lathe, mergeAll, mesh } from './geometry.js';
import { PXY } from './photo.js';
import { buildWheel } from './wheels.js';
import { stylema, brakeLine } from './brakes.js';

/** The top triple clamp's place along the fork from the front axle, m (its top face ≈0.98 m up). */
const TOP_CLAMP = 0.76;

/** The steering: inverted fork on the published rake, the triple clamps, the front wheel and its brakes, the fender. */
export function buildSteer(M) {
  const g = new THREE.Group();
  g.name = 'h2r-steer';
  const pivot = STEER_GROUND.clone().addScaledVector(STEER_AXIS, AXLE_F.y / STEER_AXIS.y);
  g.position.copy(pivot);
  const inner = new THREE.Group(); inner.position.copy(pivot).negate(); g.add(inner);
  const up = STEER_AXIS, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const along = (base, d) => base.clone().addScaledVector(up, d);
  const banjos = [];
  for (const side of [-1, 1]) {
    const base = AXLE_F.clone().setZ(side * 0.104);
    // Inner (lower) tube, 43 mm, from the axle bracket up into the outer tube.
    const tubeIn = new THREE.CylinderGeometry(0.0215, 0.0215, 0.36, 24); tubeIn.applyQuaternion(q);
    const pIn = along(base, 0.2); tubeIn.translate(pIn.x, pIn.y, pIn.z);
    inner.add(mesh(tubeIn, M.h2rForkInner, { name: 'h2r-fork-inner' }));
    // Outer (upper) tube, ≈56 mm, through both clamps and ≈3 cm proud of the top one (the
    // photographs without the fairing), its lower end chamfered.
    const prof = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.0255, 0), new THREE.Vector2(0.028, 0.012), new THREE.Vector2(0.028, 0.52), new THREE.Vector2(0.0255, 0.535), new THREE.Vector2(0, 0.535)];
    const tubeOut = new THREE.LatheGeometry(prof, 28); tubeOut.applyQuaternion(q);
    const pOut = along(base, 0.255); tubeOut.translate(pOut.x, pOut.y, pOut.z);
    // (Its outer tubes are bright, as in every photograph; the axle brackets stay black.)
    inner.add(mesh(tubeOut, M.h2rMachined, { name: 'h2r-fork-outer' }));
    const cap = new THREE.CylinderGeometry(0.019, 0.022, 0.016, 20); cap.applyQuaternion(q);
    const pCap = along(base, 0.795); cap.translate(pCap.x, pCap.y, pCap.z);
    M.h2rGreenAnod ??= new THREE.MeshStandardMaterial({ name: 'h2r-green-anodised', color: 0x1f9a2c, metalness: 0.8, roughness: 0.3 });
    inner.add(mesh(cap, M.h2rGreenAnod, { name: 'h2r-fork-cap' }));
    // The axle bracket, black, with the radial calliper mounts behind the leg.
    // (Its outline: round the axle, up along the leg, and back to the calliper's two radial bolts.)
    const br = slab([[-0.026, -0.026], [0.024, -0.024], [0.03, 0.02], [0.012, 0.09], [-0.022, 0.095], [-0.052, 0.05], [-0.098, 0.072], [-0.112, 0.05], [-0.07, -0.004], [-0.04, -0.03]], 0.026, 0.003, 2);
    br.translate(0, 0, -0.013);
    const brm = mesh(br, M.h2rFork, { name: 'h2r-axle-bracket' });
    brm.position.copy(base); brm.rotation.z = -(25.1 * D2R) * 0;
    inner.add(brm);
    // The Stylema on the disc, radially mounted behind and above the axle.
    const cal = stylema(M, side);
    const a = 148 * D2R;          // ≈ its centre's angle from the forward horizontal (the side photograph)
    cal.position.set(AXLE_F.x + Math.cos(a) * 0.147, AXLE_F.y + Math.sin(a) * 0.147, side * 0.069);
    cal.rotation.z = a - Math.PI / 2;
    // Its banjo (the calliper's own frame: 22 mm along, 34 mm out, 15 mm to the fork's side), in the bike's.
    banjos.push(new THREE.Vector3(0.022, 0.04, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2).add(cal.position).setZ(side * (0.069 + 0.015)));
    inner.add(cal);
  }
  // Triple clamps, machined aluminium (the photographs without the fairing), joining the legs at the steering head. The
  // top one sits on the head tube, above where the frame's upper rails meet it, the clip-ons
  // ≈4 cm under it (the photographs without the fairing).
  for (const [d, mat, h] of [[0.47, M.h2rAlu, 0.04], [TOP_CLAMP, M.h2rAlu, 0.024]]) {
    const c = slab([[-0.04, -0.13], [0.03, -0.13], [0.05, -0.105], [0.05, 0.105], [0.03, 0.13], [-0.04, 0.13], [-0.075, 0.05], [-0.075, -0.05]], h, 0.003);
    c.rotateX(-Math.PI / 2); c.translate(0, -h / 2, 0);
    const cm = mesh(c, mat, { name: 'h2r-triple-clamp' });
    cm.quaternion.copy(q);
    cm.position.copy(along(AXLE_F.clone(), d)).add(new THREE.Vector3(-0.028 * Math.cos(25.1 * D2R), -0.028 * Math.sin(25.1 * D2R), 0));
    inner.add(cm);
  }
  // The steering stem's nut on the top clamp, on the steering axis.
  { const top = STEER_GROUND.clone().addScaledVector(STEER_AXIS, (AXLE_F.y + TOP_CLAMP * STEER_AXIS.y - 0.028 * Math.sin(25.1 * D2R) + 0.012) / STEER_AXIS.y);
    const nut = new THREE.CylinderGeometry(0.019, 0.019, 0.014, 6); nut.applyQuaternion(q); nut.translate(top.x, top.y + 0.006, top.z);
    inner.add(mesh(nut, M.h2rSatin, { name: 'h2r-stem-nut' })); }
  // Clip-on bars below the top clamp, angled down and back to the grips (the side photograph: the
  // grip from ≈0.90 m up at the clamp to ≈0.82 m at the bar end); the levers, the master cylinders'
  // reservoirs (smoked amber), the switchgear.
  M.h2rRubber ??= new THREE.MeshStandardMaterial({ name: 'h2r-grip', color: 0x1a1b1c, metalness: 0, roughness: 0.9 });
  M.h2rAmber ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-reservoir', color: 0x6b4a1c, metalness: 0.1, roughness: 0.2, transmission: 0, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const root = new THREE.Vector3(...PXY(425, 292), s * 0.104), end = new THREE.Vector3(...PXY(472, 352), s * 0.355);
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 16).applyMatrix4(segMatrix(root, end, 0.011)), M.h2rSatin, { name: 'h2r-clip-on' }));
    const clamp = new THREE.CylinderGeometry(0.032, 0.032, 0.05, 20); clamp.applyMatrix4(segMatrix(root.clone().addScaledVector(STEER_AXIS, -0.025), root.clone().addScaledVector(STEER_AXIS, 0.025), 1));
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 20).applyMatrix4(segMatrix(root.clone().addScaledVector(STEER_AXIS, -0.025), root.clone().addScaledVector(STEER_AXIS, 0.025), 0.026)), M.h2rSatin, { name: 'h2r-clip-on-clamp' }));
    const gA = root.clone().lerp(end, 0.52), gB = end.clone();
    const grip = lathe([[0.0165, 0], [0.0175, 0.01], [0.0175, 0.12], [0.019, 0.125], [0.0, 0.13]], 20);
    grip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), gB.clone().sub(gA).normalize())); grip.translate(gA.x, gA.y, gA.z);
    inner.add(mesh(grip, M.h2rRubber, { name: 'h2r-grip' }));
    const endW = new THREE.CylinderGeometry(0.019, 0.019, 0.02, 16).applyMatrix4(segMatrix(gB, gB.clone().add(gB.clone().sub(gA).normalize().multiplyScalar(0.022)), 1));
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 16).applyMatrix4(segMatrix(gB, gB.clone().add(gB.clone().sub(gA).normalize().multiplyScalar(0.022)), 0.019)), M.h2rAlu, { name: 'h2r-bar-end' }));
    void clamp; void endW;
    // Switchgear housing at the grip's inner end, the lever ahead of the grip.
    const sw = new THREE.BoxGeometry(0.05, 0.045, 0.04); sw.translate(...gA.toArray());
    inner.add(mesh(sw, M.h2rSatin, { name: 'h2r-switchgear' }));
    // The lever: ahead of the grip and parallel to it, from its pivot by the switchgear.
    const dir = gB.clone().sub(gA).normalize(), fwd = new THREE.Vector3(1, -0.15, 0).normalize();
    const L0 = gA.clone().addScaledVector(fwd, 0.045), L1 = L0.clone().addScaledVector(dir, 0.16).addScaledVector(fwd, 0.012);
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 10).applyMatrix4(segMatrix(L0, L1, 0.0055)), M.h2rAlu, { name: 'h2r-lever' }));
    const piv = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12).applyMatrix4(new THREE.Matrix4().makeTranslation(L0.x, L0.y, L0.z));
    inner.add(mesh(piv, M.h2rSatin, { name: 'h2r-lever-pivot' }));
    const res = lathe([[0, 0], [0.019, 0], [0.02, 0.03], [0.022, 0.034], [0.022, 0.04], [0, 0.04]], 20);
    res.translate(...PXY(366, 285), s * 0.13);
    inner.add(mesh(res, M.h2rAmber, { name: 'h2r-reservoir' }));
  }
  // The brake lines (≈ their routing, as on the photographs): from each calliper's banjo up behind
  // its fork leg, held by a clip on the leg, to the splitter under the bottom clamp; from there
  // one line up in front of the head to the master cylinder on the right bar.
  {
    const lines = [], ferr = [], back = new THREE.Vector3(-Math.cos(25.1 * D2R), -Math.sin(25.1 * D2R), 0);
    const leg = (side, d, aft, out = 0) => along(AXLE_F.clone().setZ(side * (0.104 + out)), d).addScaledVector(back, aft);
    const split = along(AXLE_F.clone().setZ(0), 0.44).addScaledVector(back, -0.045);
    for (const side of [-1, 1]) {
      const b = banjos[side < 0 ? 0 : 1];
      const pts = [b, b.clone().add(new THREE.Vector3(-0.01, 0.035, 0)), leg(side, 0.2, 0.042, -0.018), leg(side, 0.32, 0.04, -0.02), leg(side, 0.4, 0.0, -0.045), split.clone().add(new THREE.Vector3(0, -0.012, side * 0.02))];
      const l = brakeLine(pts); lines.push({ geometry: l.line }); ferr.push({ geometry: l.ferrules });
    }
    const mc = new THREE.Vector3(...PXY(372, 302), 0.118);
    const up = brakeLine([split.clone().add(new THREE.Vector3(0, 0.012, 0.004)), along(AXLE_F.clone().setZ(0.03), 0.6).addScaledVector(back, -0.06), along(AXLE_F.clone().setZ(0.09), 0.73).addScaledVector(back, -0.045), mc]);
    lines.push({ geometry: up.line }); ferr.push({ geometry: up.ferrules });
    inner.add(mesh(mergeAll(lines), M.h2rBraid, { name: 'h2r-brake-lines' }));
    inner.add(mesh(mergeAll(ferr), M.h2rAlu, { name: 'h2r-brake-line-ferrules' }));
    // The splitter: a small block with its three banjos.
    const sp = new THREE.BoxGeometry(0.03, 0.024, 0.05); sp.translate(split.x, split.y, split.z);
    inner.add(mesh(sp, M.h2rAlu, { name: 'h2r-brake-splitter' }));
    // The clips holding the lines to the legs.
    const clips = [];
    for (const side of [-1, 1]) { const c = new THREE.TorusGeometry(0.008, 0.002, 6, 16); c.rotateY(Math.PI / 2); c.translate(...leg(side, 0.2, 0.042, -0.018).toArray()); clips.push({ geometry: c }); }
    inner.add(mesh(mergeAll(clips), M.h2rSatin, { name: 'h2r-brake-line-clips' }));
  }
  // The front fender, black: a shell over the tyre's front and top with a beak (the side photograph).
  inner.add(buildFender(M));
  inner.add(buildWheel(M, 'f'));
  return g;
}

function buildFender(M) {
  const R = RF + 0.014, secs = [];
  // Along the tyre from ≈40° ahead-up to ≈118° (behind the fork), each section a shallow arch over the tread.
  for (let i = 0; i <= 12; i++) {
    const a = (30 + (125 - 30) * i / 12) * D2R;
    const hw = 0.068 + 0.012 * Math.sin(Math.PI * i / 12);
    const sec = [];
    for (let k = 0; k <= 8; k++) {
      const u = -1 + 2 * k / 8, z = u * hw, lift = 0.016 * (1 - u * u);
      const r = R + lift;
      sec.push([AXLE_F.x + Math.cos(a) * r, AXLE_F.y + Math.sin(a) * r, z]);
    }
    secs.push(sec);
  }
  M.h2rBlack2 ??= M.h2rBlack.clone(); M.h2rBlack2.side = THREE.DoubleSide; M.h2rBlack2.name = 'h2r-black-2s';
  return mesh(loft(secs, { steps: 3 }), M.h2rBlack2, { name: 'h2r-fender' });
}
