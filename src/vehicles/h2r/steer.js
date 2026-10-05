/** The steering, assembled: the fork's legs (fork.js), the triple clamps (clamps.js), the bars and their controls (controls.js), the front brakes and their lines, the front wheel and fender. */
import * as THREE from 'three';
import { AXLE_F, STEER_AXIS, STEER_GROUND, RF, D2R, loft, mergeAll, mesh } from './geometry.js';
import { forkLeg } from './fork.js';
import { buildClamps } from './clamps.js';
import { buildControls } from './controls.js';
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
  const up = STEER_AXIS;
  const along = (base, d) => base.clone().addScaledVector(up, d);
  const banjos = [];
  for (const side of [-1, 1]) {
    inner.add(forkLeg(M, side));
    // The Stylema on the disc, radially mounted behind and above the axle.
    const cal = stylema(M, side);
    const a = 148 * D2R;          // ≈ its centre's angle from the forward horizontal (the side photograph)
    cal.position.set(AXLE_F.x + Math.cos(a) * 0.147, AXLE_F.y + Math.sin(a) * 0.147, side * 0.069);
    cal.rotation.z = a - Math.PI / 2;
    // Its banjo (the calliper's own frame: 22 mm along, 34 mm out, 15 mm to the fork's side), in the bike's.
    banjos.push(new THREE.Vector3(0.022, 0.04, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2).add(cal.position).setZ(side * (0.069 + 0.015)));
    inner.add(cal);
  }
  // The triple clamps (clamps.js): the bottom one, the top one on the head tube, the clip-ons ≈4 cm under it.
  inner.add(buildClamps(M, TOP_CLAMP, 0.47));
  // The bars and their controls (controls.js).
  const controls = buildControls(M);
  inner.add(controls);
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
    const mc = controls.userData.brakeBanjo;
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
