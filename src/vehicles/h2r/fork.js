/**
 * The fork's legs (published: 43 mm inverted, 120 mm of travel, 25.1° of rake; data/h2r.js), as the
 * photographs of the bike without its bodywork show them (Wikimedia Commons; reference only):
 *  - the inner tubes, 43 mm, bright hard chrome, from the axle brackets up into the outer tubes;
 *  - at each outer tube's foot its seal holder, stepped in machined rings, and the black dust
 *    wiper on the inner tube;
 *  - the outer tubes, ≈56 mm, anodised a light champagne, up through both clamps and ≈3 cm proud
 *    of the top one, a chamfered ring at their top under the caps;
 *  - the caps, green anodised hexagons, with the preload adjuster's flats and the damping screw
 *    in their centre;
 *  - the axle brackets, black, cast round the axle with its pinch slot and two bolts behind, and
 *    the calliper's two radial lugs.
 * Sizes not published ≈, from the photographs scaled by the 43 mm tube and the 330 mm disc.
 */
import * as THREE from 'three';
import { AXLE_F, STEER_AXIS, D2R, slab, mergeAll, mesh } from './geometry.js';

const Y = new THREE.Vector3(0, 1, 0);

/** A profile [[r, d], …] turned about the fork leg's axis (through `base`, along STEER_AXIS), d along it. */
function turnedOnLeg(profile, base, segs = 40) {
  const pts = profile.map(([r, d]) => new THREE.Vector2(r, d));
  const g = new THREE.LatheGeometry(pts, segs);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, STEER_AXIS));
  g.translate(base.x, base.y, base.z);
  return g;
}

function materials(M) {
  M.h2rForkOuter ??= new THREE.MeshStandardMaterial({ name: 'h2r-fork-outer', color: 0xcfc6b2, metalness: 0.92, roughness: 0.22 });
  M.h2rChromeHard ??= new THREE.MeshStandardMaterial({ name: 'h2r-hard-chrome', color: 0xe4e7ea, metalness: 1, roughness: 0.08 });
  M.h2rGreenAnod ??= new THREE.MeshStandardMaterial({ name: 'h2r-green-anodised', color: 0x1f9a2c, metalness: 0.8, roughness: 0.3 });
  M.h2rRubber ??= new THREE.MeshStandardMaterial({ name: 'h2r-grip', color: 0x1a1b1c, metalness: 0, roughness: 0.9 });
}

/** One leg (side +1 right, −1 left), its parts in the steering group's frame. */
export function forkLeg(M, side) {
  materials(M);
  const g = new THREE.Group(); g.name = `h2r-fork-leg-${side > 0 ? 'r' : 'l'}`;
  const base = AXLE_F.clone().setZ(side * 0.104);
  // The inner tube, 43 mm, from the bracket up into the outer tube.
  g.add(mesh(turnedOnLeg([[0.0215, 0.035], [0.0215, 0.47]], base, 48), M.h2rChromeHard, { name: 'h2r-fork-inner' }));
  // The dust wiper: a black lip ring on the tube at the seal holder's mouth.
  g.add(mesh(turnedOnLeg([[0.0216, 0.248], [0.0245, 0.249], [0.027, 0.252], [0.0275, 0.257], [0.026, 0.259]], base, 48), M.h2rRubber, { name: 'h2r-fork-wiper' }));
  // The outer tube: its seal holder stepped in machined rings, the tube, the chamfered ring at its top.
  const out = [
    [0.026, 0.258], [0.0305, 0.259], [0.0315, 0.262], [0.0315, 0.272], [0.0300, 0.274], [0.0300, 0.280],
    [0.0312, 0.282], [0.0312, 0.292], [0.0288, 0.296], [0.0280, 0.300], [0.0280, 0.770], [0.0284, 0.772],
    [0.0284, 0.782], [0.0270, 0.786], [0.0262, 0.790],
  ];
  g.add(mesh(turnedOnLeg(out, base, 56), M.h2rForkOuter, { name: 'h2r-fork-outer' }));
  // The cap: a green hexagon with a chamfer, the preload adjuster's silver flats, the damping screw (gold).
  {
    const cap = turnedOnLeg([[0.0262, 0.789], [0.0262, 0.802], [0.024, 0.806], [0.0, 0.807]], base, 6);
    g.add(mesh(cap, M.h2rGreenAnod, { name: 'h2r-fork-cap' }));
    const adj = turnedOnLeg([[0.0, 0.8065], [0.0115, 0.8065], [0.0115, 0.814], [0.0095, 0.8155], [0, 0.8158]], base, 6);
    g.add(mesh(adj, M.h2rAlu, { name: 'h2r-fork-preload' }));
    const scr = turnedOnLeg([[0.0, 0.8155], [0.0045, 0.8155], [0.0045, 0.8205], [0, 0.821]], base, 16);
    g.add(mesh(scr, M.h2rGold, { name: 'h2r-fork-damping-screw' }));
  }
  // The axle bracket, black: round the axle, up along the leg, back to the calliper's two radial
  // lugs; the axle's pinch slot and its two bolts behind.
  {
    // (The calliper sits at 148° from the axle, 0.147 m out, its ears ±0.05 m along it and its
    // bolts 0.036 m in: the lugs go where those bolts are, their axes radial.)
    const a = 148 * D2R, rot = a - Math.PI / 2;
    const ear = (x) => [Math.cos(a) * 0.147 + x * Math.cos(rot) + 0.036 * Math.sin(rot), Math.sin(a) * 0.147 + x * Math.sin(rot) - 0.036 * Math.cos(rot)];
    const [l1, l2] = [ear(0.05), ear(-0.05)];
    const br = slab([[-0.026, -0.03], [0.026, -0.026], [0.032, 0.015], [0.012, 0.09], [l1[0] + 0.03, l1[1] + 0.02], [l1[0] - 0.014, l1[1] + 0.012], [l1[0] - 0.02, l1[1] - 0.025], [l2[0] + 0.012, l2[1] + 0.016], [l2[0] - 0.012, l2[1] + 0.006], [l2[0] - 0.004, l2[1] - 0.014], [-0.07, -0.014], [-0.04, -0.032]], 0.026, 0.003, 2);
    br.translate(base.x, base.y, base.z - 0.013);
    const boss = new THREE.CylinderGeometry(0.03, 0.03, 0.044, 40); boss.rotateX(Math.PI / 2); boss.translate(base.x, base.y, base.z);
    const lugs = [], radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    for (const [lx, ly] of [l1, l2]) {
      const l = new THREE.CylinderGeometry(0.0115, 0.0115, 0.024, 24);
      l.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, radial));
      l.translate(base.x + lx - radial.x * 0.012, base.y + ly - radial.y * 0.012, base.z - side * 0.004);
      lugs.push({ geometry: l });
    }
    g.add(mesh(mergeAll([{ geometry: br }, { geometry: boss }, ...lugs]), M.h2rFork, { name: 'h2r-axle-bracket' }));
    // The pinch slot (dark) and its bolts, behind the axle.
    const slot = new THREE.BoxGeometry(0.002, 0.03, 0.046); slot.translate(base.x - 0.031, base.y - 0.012, base.z);
    g.add(mesh(slot, M.h2rVoid ?? M.h2rSatin, { name: 'h2r-axle-pinch-slot' }));
    const bolts = [];
    for (const dz of [-0.011, 0.011]) {
      const b = new THREE.CylinderGeometry(0.0048, 0.0048, 0.008, 6); b.rotateZ(Math.PI / 2); b.translate(base.x - 0.037, base.y - 0.012, base.z + dz);
      bolts.push({ geometry: b });
    }
    g.add(mesh(mergeAll(bolts), M.h2rAlu, { name: 'h2r-axle-bracket-bolts' }));
  }
  return g;
}
