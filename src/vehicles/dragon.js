/**
 * Crew Dragon (Dragon 2).
 *
 * Verified figures: 8.1 m with the trunk, 4 m maximum diameter, 9.3 m³ pressurised and 37 m³
 * trunk volume, 16 Draco at 400 N, 8 SuperDraco at 71 kN, solar cells over one half of the
 * trunk (spacex.com); capsule alone 4.4 m × 3.7 m, PICA heat shield, two drogue and four main
 * parachutes (Wikipedia). The trunk is 3.7 m across — the diameter of the Falcon 9 it rides
 * on — and the capsule flares slightly wider than that at the heat-shield shoulder, which is
 * what makes the published 4 m and the 8.1 m total consistent: 3.7 m of trunk plus 4.4 m of
 * capsule. Wall angle, window and hatch placement and the SuperDraco fairings are
 * reconstructed from photographs.
 */
import * as THREE from 'three';
import { lathe, domeProfile, mesh, mergeAll, mat4, plate } from '../geometry/utils.js';

const TRUNK_R = 1.85;      // 3.7 m — matches the Falcon 9 it launches on
const CAP_R = 2.0;         // 4 m maximum diameter at the heat-shield shoulder (spacex.com)
const TRUNK_H = 3.7;
const CAP_H = 4.4;         // capsule alone (Wikipedia)
const TOP = TRUNK_H + CAP_H;   // 8.1 m (spacex.com)

const SHOULDER = TRUNK_H + 0.30;   // top of the constant-diameter shoulder band
const NOSE_BASE = TRUNK_H + 3.05;  // base of the hinged nose cone
const NOSE_R = 1.30;
const WALL_ANGLE = Math.atan((CAP_R - NOSE_R) / (NOSE_BASE - SHOULDER));   // ≈14°
const wallR = (y) => CAP_R - (y - SHOULDER) * Math.tan(WALL_ANGLE);

export function buildDragon(M) {
  const g = new THREE.Group();
  g.name = 'dragon';

  // ---- Trunk -------------------------------------------------------------------------
  // Solar cells wrap one half (−Z); the other half carries the radiator panels.
  g.add(mesh(lathe([{ r: TRUNK_R, y: 0 }, { r: TRUNK_R, y: TRUNK_H }], { segments: 128, phiStart: -Math.PI / 2, phiLength: Math.PI }), M.radiator, { name: 'trunk-radiator' }));
  const bays = 5;
  for (let i = 0; i < bays; i++) {
    const a0 = Math.PI / 2 + (i / bays) * Math.PI + 0.014;
    g.add(mesh(lathe([{ r: TRUNK_R + 0.02, y: 0.22 }, { r: TRUNK_R + 0.02, y: TRUNK_H - 0.3 }],
      { segments: 22, phiStart: a0, phiLength: Math.PI / bays - 0.028 }), M.solar, { name: 'trunk-solar' }));
  }
  g.add(mesh(lathe([{ r: TRUNK_R, y: 0 }, { r: TRUNK_R, y: TRUNK_H }], { segments: 128, phiStart: Math.PI / 2, phiLength: Math.PI }), M.white));
  g.add(mesh(lathe([{ r: TRUNK_R - 0.03, y: 0.05 }, { r: TRUNK_R - 0.03, y: TRUNK_H - 0.05 }], { segments: 64, flip: true }), M.blackMatte, { castShadow: false }));

  // Internal stringers and the two end rings, visible through the open aft end.
  const ribs = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ribs.push({ geometry: new THREE.BoxGeometry(0.07, TRUNK_H - 0.25, 0.14), matrix: mat4([Math.sin(a) * (TRUNK_R - 0.11), TRUNK_H / 2, Math.cos(a) * (TRUNK_R - 0.11)], [0, a, 0]) });
  }
  ribs.push({ geometry: new THREE.TorusGeometry(TRUNK_R - 0.1, 0.055, 6, 64), matrix: mat4([0, 0.16, 0], [Math.PI / 2, 0, 0]) });
  ribs.push({ geometry: new THREE.TorusGeometry(TRUNK_R - 0.1, 0.055, 6, 64), matrix: mat4([0, TRUNK_H - 0.4, 0], [Math.PI / 2, 0, 0]) });
  g.add(mesh(mergeAll(ribs), M.alumDark));
  // Capsule interface ring at the top of the trunk.
  g.add(mesh(new THREE.TorusGeometry(TRUNK_R - 0.05, 0.075, 10, 96), M.goldKapton, { position: [0, TRUNK_H - 0.16, 0], rotation: [Math.PI / 2, 0, 0] }));

  // Four stabilising fins (Crew Dragon only; Cargo Dragon flies without them).
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const fin = plate([[0, 0.4], [0.82, 0.85], [0.82, 2.75], [0, 3.3]], 0.06, 0.015);
    const e1 = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const e3 = new THREE.Vector3().crossVectors(e1, new THREE.Vector3(0, 1, 0));
    const f = mesh(fin, M.white);
    f.applyMatrix4(new THREE.Matrix4()
      .makeTranslation(e1.x * (TRUNK_R - 0.01), 0, e1.z * (TRUNK_R - 0.01))
      .multiply(new THREE.Matrix4().makeBasis(e1, new THREE.Vector3(0, 1, 0), e3)));
    g.add(f);
  }

  // ---- Capsule -----------------------------------------------------------------------
  // PICA heat shield: a shallow convex cap, planar-mapped so the ablator's sector pattern
  // reads correctly across it.
  const depth = 0.26;
  const shield = lathe(domeProfile(CAP_R, depth, TRUNK_H, 18, -1).reverse(), { segments: 112 });
  {
    const pos = shield.attributes.position, uv = shield.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * CAP_R), 0.5 + pos.getZ(i) / (2 * CAP_R));
    uv.needsUpdate = true;
  }
  g.add(mesh(shield, M.pica, { name: 'heatshield' }));

  // Sidewall: shoulder band, then the conical pressure vessel.
  g.add(mesh(lathe([
    { r: CAP_R, y: TRUNK_H }, { r: CAP_R, y: SHOULDER, sharp: true },
    { r: NOSE_R, y: NOSE_BASE, sharp: true },
  ], { segments: 128 }), M.whitePanel, { name: 'capsule-wall' }));
  g.add(mesh(new THREE.TorusGeometry(CAP_R, 0.035, 8, 128), M.darkMetal, { position: [0, TRUNK_H + 0.02, 0], rotation: [Math.PI / 2, 0, 0] }));

  // Hinged nose cone over the docking adapter.
  const noseProfile = [{ r: NOSE_R, y: NOSE_BASE }];
  for (let i = 1; i <= 18; i++) {
    const t = i / 18, a = t * Math.PI / 2;
    noseProfile.push({ r: NOSE_R * Math.cos(a * 0.94), y: NOSE_BASE + (TOP - NOSE_BASE) * Math.sin(a) });
  }
  g.add(mesh(lathe(noseProfile, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
  g.add(mesh(new THREE.TorusGeometry(NOSE_R + 0.005, 0.02, 8, 96), M.blackMatte, { position: [0, NOSE_BASE + 0.02, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));

  // ---- SuperDraco pods ---------------------------------------------------------------
  // Eight engines in four pods, built into the capsule wall as shallow raised fairings
  // rather than external pods, with a pair of canted nozzles at the bottom of each.
  let superDracos = 0;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const podY = TRUNK_H + 1.55;
    const pod = new THREE.Group();
    const shell = new THREE.CapsuleGeometry(0.46, 0.95, 6, 22);
    shell.scale(1, 1, 0.34);                       // flattened into the wall
    pod.add(mesh(shell, M.whitePanel));
    pod.add(mesh(new THREE.BoxGeometry(0.72, 0.34, 0.3), M.blackGloss, { position: [0, -0.62, 0.08] }));
    for (const dx of [-0.19, 0.19]) {
      pod.add(mesh(new THREE.CylinderGeometry(0.115, 0.085, 0.26, 20), M.bellCool, { position: [dx, -0.78, 0.05], rotation: [0.42, 0, 0] }));
      superDracos++;
    }
    pod.position.set(Math.sin(a) * (wallR(podY) - 0.02), podY, Math.cos(a) * (wallR(podY) - 0.02));
    pod.rotation.set(-WALL_ANGLE, a, 0, 'YXZ');
    g.add(pod);
  }
  g.userData.superDracoCount = superDracos;

  // ---- Windows, hatch and Draco ------------------------------------------------------
  const winY = TRUNK_H + 2.35;
  for (const a of [0.62, -0.62, Math.PI + 0.62, Math.PI - 0.62]) {
    const rr = wallR(winY);
    const w = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 32), M.glass);
    w.position.set(Math.sin(a) * (rr + 0.005), winY, Math.cos(a) * (rr + 0.005));
    w.rotation.set(Math.PI / 2 - WALL_ANGLE, a, 0, 'YXZ');
    g.add(w);
    const frame = mesh(new THREE.TorusGeometry(0.225, 0.022, 10, 36), M.darkMetal);
    frame.position.copy(w.position); frame.rotation.copy(w.rotation);
    g.add(frame);
  }
  {
    const a = Math.PI / 2, hatchY = TRUNK_H + 1.85, rr = wallR(hatchY);
    const hatch = mesh(new THREE.BoxGeometry(1.0, 1.1, 0.04), M.whiteFresh);
    hatch.position.set(Math.sin(a) * (rr + 0.012), hatchY, Math.cos(a) * (rr + 0.012));
    hatch.rotation.set(-WALL_ANGLE, a, 0, 'YXZ');
    g.add(hatch);
    const seam = mesh(new THREE.BoxGeometry(1.08, 1.18, 0.02), M.blackMatte);
    seam.position.copy(hatch.position); seam.rotation.copy(hatch.rotation);
    g.add(seam);
  }
  // 16 Draco (spacex.com): four clusters of three near the shoulder, four more around the nose.
  // The published figure is the count, not the grouping — how the sixteen are distributed round
  // the hull is reconstructed from photographs, like the windows and the SuperDraco fairings.
  // The nested 2 × 2 loop that used to sit here built four clusters of four and so flew twenty,
  // contradicting both the sheet and the annotation a metre away from it.
  const dracos = [];
  const addDraco = (phi, y, r) => {
    const m = new THREE.Matrix4().makeRotationY(phi).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - WALL_ANGLE));
    m.setPosition(Math.sin(phi) * r, y, Math.cos(phi) * r);
    dracos.push({ geometry: new THREE.CylinderGeometry(0.055, 0.042, 0.11, 12), matrix: m });
  };
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    // Two side by side on the lower row, one centred above them.
    for (const [dphi, dy] of [[-0.075, 0], [0.075, 0], [0, 0.2], [0.2, 0.2]]) {
      const y = TRUNK_H + 0.62 + dy;
      addDraco(a + dphi, y, wallR(y) - 0.015);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const y = NOSE_BASE - 0.42;
    addDraco(a, y, wallR(y) - 0.015);
  }
  g.userData.dracoCount = dracos.length;
  g.add(mesh(mergeAll(dracos), M.blackMatte, { name: 'draco' }));

  g.userData.height = TOP;
  g.userData.footprint = CAP_R * 2;
  g.userData.stations = { trunkTop: TRUNK_H, shoulder: SHOULDER, noseBase: NOSE_BASE, capR: CAP_R, trunkR: TRUNK_R };
  g.userData.annotations = [
    { label: 'PICA heat shield', position: [0, TRUNK_H - 0.2, 1.3] },
    { label: 'SuperDraco pod (2 × 4 = 8)', position: [Math.sin(Math.PI / 4) * 2.35, TRUNK_H + 1.55, Math.cos(Math.PI / 4) * 2.35] },
    { label: 'Window', position: [Math.sin(0.62) * 2.0, winY, Math.cos(0.62) * 2.0] },
    { label: 'Side hatch', position: [2.2, TRUNK_H + 1.85, 0] },
    { label: 'Hinged nose cone · IDSS adapter', position: [0, TOP + 0.25, 0.6] },
    { label: 'Trunk · solar cells (half the circumference)', position: [0, 1.9, -TRUNK_R - 0.35] },
    { label: 'Trunk · radiators', position: [0, 2.6, TRUNK_R + 0.35] },
    { label: 'Trunk fin', position: [Math.sin(Math.PI / 4) * (TRUNK_R + 0.95), 2.0, Math.cos(Math.PI / 4) * (TRUNK_R + 0.95)] },
    { label: 'Draco (16)', position: [0, TRUNK_H + 0.75, CAP_R + 0.3] },
  ];
  return g;
}
