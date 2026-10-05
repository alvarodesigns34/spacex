/**
 * The triple clamps, machined aluminium (the photographs of the bike without its bodywork,
 * Wikimedia Commons; reference only; sizes ≈ scaled by the fork's tubes): the top one a plate
 * whose raised rim follows its outline round two machined pockets, each leg's boss split at the
 * back and closed by two socket-head bolts, the steering stem's nut sunk in its centre; the bottom
 * one deeper, with the stem down through the head tube.
 *
 * A clamp's own frame: X forward (⟂ the steering axis, in the bike's plane), Y along the steering
 * axis, Z to the right; the legs at X = +0.028 (the fork's offset), Z = ±0.104.
 */
import * as THREE from 'three';
import { AXLE_F, STEER_AXIS, D2R, TAU, mergeAll, mesh, dropSlivers } from './geometry.js';

const LEG = { x: 0.028, z: 0.104, r: 0.0282 };

/**
 * The clamp's outline in its XZ plane (a Shape in x, z), counter-clockwise: round the right boss
 * from its front-inner corner, by its outer side, to its back; in round the stem's tab at the back;
 * the left boss from its back, by its outer side, to its front; across the nose.
 */
function outline(boss) {
  const pts = [], add = (x, z) => pts.push(new THREE.Vector2(x, z)), D = Math.PI / 180;
  for (let k = 0; k <= 20; k++) { const t = (-30 + 240 * k / 20) * D; add(LEG.x + Math.cos(t) * boss, LEG.z + Math.sin(t) * boss); }
  for (let k = 0; k <= 12; k++) { const t = (70 + 220 * k / 12) * D; add(-0.03 + Math.cos(t) * 0.042, Math.sin(t) * 0.042); }
  for (let k = 0; k <= 20; k++) { const t = (150 + 240 * k / 20) * D; add(LEG.x + Math.cos(t) * boss, -LEG.z + Math.sin(t) * boss); }
  const z0 = LEG.z - boss * Math.sin(30 * D), x0 = LEG.x + boss * Math.cos(30 * D);
  for (let k = 1; k < 10; k++) { const u = k / 10; add(x0 + 0.011 * Math.sin(Math.PI * u), -z0 + 2 * z0 * u); }
  return new THREE.Shape(pts);
}
const circle = (x, z, r, n = 32) => { const p = new THREE.Path(); for (let i = 0; i < n; i++) { const a = -(i / n) * TAU; p[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, z + Math.sin(a) * r); } return p; };

/** A clamp as geometries in its own frame (Y up through its thickness). */
function clampGeometry({ h, boss, top }) {
  const body = [], dark = [], bolts = [];
  // The plate, bored for the legs and the stem.
  const sh = outline(boss);
  sh.holes.push(circle(LEG.x, LEG.z, LEG.r), circle(LEG.x, -LEG.z, LEG.r), circle(0, 0, top ? 0.0195 : 0.018));
  const plate = new THREE.ExtrudeGeometry(sh, { depth: h - (top ? 0.004 : 0.003), bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 8 });
  plate.rotateX(Math.PI / 2); plate.translate(0, h / 2 - 0.0015, 0); dropSlivers(plate);
  body.push({ geometry: plate });
  if (top) {
    // The raised rim round the outline and round each bore; the pockets inside it are the plate's face.
    const rim = outline(boss - 0.0005);
    const pocket = (cx, cz) => { const p = new THREE.Path(); const pts = [[-0.012, -0.03], [0.022, -0.026], [0.03, 0.0], [0.022, 0.026], [-0.012, 0.03], [-0.02, 0.0]]; pts.forEach(([x, z], i) => p[i ? 'lineTo' : 'moveTo'](cx + x * 0.7, cz + z * 0.7)); return p; };
    rim.holes.push(circle(LEG.x, LEG.z, LEG.r + 0.003), circle(LEG.x, -LEG.z, LEG.r + 0.003), circle(0, 0, 0.026), pocket(0.017, 0.05), pocket(0.017, -0.05));
    const rg = new THREE.ExtrudeGeometry(rim, { depth: 0.0025, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1, curveSegments: 8 });
    rg.rotateX(Math.PI / 2); rg.translate(0, h / 2 + 0.0031, 0); dropSlivers(rg);
    body.push({ geometry: rg });
  }
  // Each boss split at the back (a dark slot) and closed by two socket-head bolts across it.
  for (const s of [-1, 1]) {
    const slot = new THREE.BoxGeometry(0.02, h * 0.98, 0.0016); slot.translate(LEG.x - LEG.r - 0.009, 0, s * LEG.z); dark.push({ geometry: slot });
    for (const y of top ? [0] : [-h * 0.22, h * 0.22]) {
      const head = new THREE.CylinderGeometry(0.0042, 0.0042, 0.0045, 20); head.rotateX(Math.PI / 2); head.translate(LEG.x - LEG.r - 0.009, y, s * LEG.z + 0.0105);
      bolts.push({ geometry: head });
      const hex = new THREE.CylinderGeometry(0.002, 0.002, 0.001, 6); hex.rotateX(Math.PI / 2); hex.translate(LEG.x - LEG.r - 0.009, y, s * LEG.z + 0.0131);
      dark.push({ geometry: hex });
    }
  }
  return { body: mergeAll(body), dark: mergeAll(dark), bolts: mergeAll(bolts) };
}

/** Both clamps placed on the steering axis: `d` along the fork from the front axle; the steering group's frame. */
export function buildClamps(M, topD, bottomD) {
  const g = new THREE.Group(); g.name = 'h2r-triple-clamps';
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), STEER_AXIS);
  const back = new THREE.Vector3(-Math.cos(25.1 * D2R), -Math.sin(25.1 * D2R), 0);
  const place = (d) => AXLE_F.clone().addScaledVector(STEER_AXIS, d).addScaledVector(back, LEG.x);
  for (const [d, spec, name] of [[bottomD, { h: 0.04, boss: 0.041, top: false }, 'h2r-triple-clamp-bottom'], [topD, { h: 0.024, boss: 0.043, top: true }, 'h2r-triple-clamp']]) {
    const c = clampGeometry(spec);
    const grp = new THREE.Group(); grp.position.copy(place(d)); grp.quaternion.copy(q);
    grp.add(mesh(c.body, M.h2rAlu, { name }), mesh(c.dark, M.h2rVoid ?? M.h2rSatin, { name: `${name}-slots` }), mesh(c.bolts, M.h2rSatin, { name: `${name}-bolts` }));
    g.add(grp);
  }
  // The steering stem's nut sunk in the top clamp: a round nut with its four slots, and the stem
  // through the bottom clamp below it.
  {
    const grp = new THREE.Group(); grp.position.copy(place(topD)); grp.quaternion.copy(q);
    const nut = new THREE.CylinderGeometry(0.019, 0.019, 0.011, 40); nut.translate(0, 0.012, 0);
    const slots = [];
    for (let i = 0; i < 4; i++) { const b = new THREE.BoxGeometry(0.008, 0.003, 0.004); b.translate(0.0175, 0.0168, 0); b.rotateY((i / 4) * TAU); slots.push({ geometry: b }); }
    const hole = new THREE.CylinderGeometry(0.0095, 0.0095, 0.002, 24); hole.translate(0, 0.0176, 0);
    grp.add(mesh(nut, M.h2rSatin, { name: 'h2r-stem-nut' }), mesh(mergeAll([...slots, { geometry: hole }]), M.h2rVoid ?? M.h2rSatin, { name: 'h2r-stem-nut-slots' }));
    g.add(grp);
  }
  return g;
}
export { LEG };
