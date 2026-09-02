/**
 * Crew Dragon (Dragon 2): 8.1 m with trunk, 4 m maximum diameter, 3.7 m trunk/base diameter,
 * 16 Draco, 8 SuperDraco in four pods, PICA heat shield, trunk with solar panels on one half
 * and stabilising fins (spacex.com / Wikipedia). Capsule/trunk split (~4.4 / ~3.7 m), wall
 * angle, window and hatch placement are approximated from imagery.
 */
import * as THREE from 'three';
import { lathe, domeProfile, mesh, mergeAll, mat4, plate } from '../geometry/utils.js';

const R = 1.85;          // 3.7 m
const TRUNK_H = 3.7;     // approx (8.1 − 4.4)
const CAPSULE_BASE = TRUNK_H;
const TOP = 8.1;
const WALL_ANGLE = Math.atan((1.80 - 1.24) / (3.2 - 0.36)); // ≈11° conical sidewall (approx)
const wallR = (y) => 1.80 - (y - (CAPSULE_BASE + 0.36)) * Math.tan(WALL_ANGLE);

export function buildDragon(M) {
  const g = new THREE.Group();
  g.name = 'dragon';

  // ---- Trunk ----
  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: TRUNK_H }], { segments: 128, phiStart: -Math.PI / 2, phiLength: Math.PI }), M.radiator, { name: 'trunk-radiator' }));
  // Solar half (−Z): curved panel array in 4 bays with thin gaps.
  const bays = 4;
  for (let i = 0; i < bays; i++) {
    const a0 = Math.PI / 2 + (i / bays) * Math.PI + 0.012;
    const seg = lathe([{ r: R + 0.02, y: 0.25 }, { r: R + 0.02, y: TRUNK_H - 0.25 }], { segments: 24, phiStart: a0, phiLength: Math.PI / bays - 0.024 });
    g.add(mesh(seg, M.solar, { name: 'trunk-solar' }));
  }
  g.add(mesh(lathe([{ r: R, y: 0 }, { r: R, y: TRUNK_H }], { segments: 128, phiStart: Math.PI / 2, phiLength: Math.PI }), M.white));
  // Inner trunk structure (open aft end)
  g.add(mesh(lathe([{ r: R - 0.02, y: 0.05 }, { r: R - 0.02, y: TRUNK_H - 0.05 }], { segments: 64, flip: true }), M.blackMatte, { castShadow: false }));
  const ribs = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ribs.push({ geometry: new THREE.BoxGeometry(0.08, TRUNK_H - 0.2, 0.12), matrix: mat4([Math.sin(a) * (R - 0.1), TRUNK_H / 2, Math.cos(a) * (R - 0.1)], [0, a, 0]) });
  }
  ribs.push({ geometry: new THREE.TorusGeometry(R - 0.1, 0.05, 6, 64), matrix: mat4([0, 0.15, 0], [Math.PI / 2, 0, 0]) });
  ribs.push({ geometry: new THREE.TorusGeometry(R - 0.1, 0.05, 6, 64), matrix: mat4([0, TRUNK_H - 0.4, 0], [Math.PI / 2, 0, 0]) });
  g.add(mesh(mergeAll(ribs), M.alumDark));
  // Capsule/trunk interface ring (the trunk is open: the heat shield is visible from the aft end)
  g.add(mesh(new THREE.TorusGeometry(R - 0.16, 0.07, 8, 96), M.goldKapton, { position: [0, TRUNK_H - 0.25, 0], rotation: [Math.PI / 2, 0, 0] }));
  // Fins (4) — Crew Dragon only
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const fin = plate([[0, 0.45], [0.78, 0.9], [0.78, 2.7], [0, 3.25]], 0.05, 0.01);
    const e1 = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const e3 = new THREE.Vector3().crossVectors(e1, new THREE.Vector3(0, 1, 0));
    const m = new THREE.Matrix4().makeBasis(e1, new THREE.Vector3(0, 1, 0), e3);
    const f = mesh(fin, M.white);
    f.applyMatrix4(new THREE.Matrix4().makeTranslation(e1.x * (R - 0.01), 0, e1.z * (R - 0.01)).multiply(m));
    g.add(f);
  }

  // ---- Capsule ----
  const y0 = CAPSULE_BASE;
  // Heat shield: shallow convex cap with planar UVs for the PICA sector pattern.
  const shieldDepth = 0.22;
  const shield = lathe([...domeProfile(R, shieldDepth, y0 + shieldDepth, 16, -1).reverse(), { r: R, y: y0 + shieldDepth }].map(p => ({ r: p.r, y: p.y - shieldDepth + 0.02 })), { segments: 96 });
  {
    const pos = shield.attributes.position, uv = shield.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * R), 0.5 + pos.getZ(i) / (2 * R));
    uv.needsUpdate = true;
  }
  g.add(mesh(shield, M.pica, { name: 'heatshield' }));
  // Sidewall: shoulder, conical wall, nose.
  const wall = [
    { r: R, y: y0 + 0.02 }, { r: R + 0.02, y: y0 + 0.28, sharp: true }, { r: 1.80, y: y0 + 0.36, sharp: true },
    { r: 1.24, y: y0 + 3.2 }, { r: 1.16, y: y0 + 3.36, sharp: true },
  ];
  g.add(mesh(lathe(wall, { segments: 128 }), M.whitePanel, { name: 'capsule-wall' }));
  // Nose: rounded cone (hinged nose cone over the docking adapter)
  const noseBase = y0 + 3.36;
  const noseProfile = [{ r: 1.16, y: noseBase }];
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const ang = t * Math.PI / 2;
    noseProfile.push({ r: 1.16 * Math.cos(ang) * (1 - 0.15 * t) + 0.0, y: noseBase + (TOP - noseBase) * Math.sin(ang) });
  }
  g.add(mesh(lathe(noseProfile, { segments: 128 }), M.whiteFresh, { name: 'nosecone' }));
  // Nose cone hinge seam and the docking-ring outline visible under the cone
  g.add(mesh(new THREE.TorusGeometry(1.16, 0.012, 6, 96), M.blackMatte, { position: [0, noseBase, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false }));

  // SuperDraco pods: 4 pods × 2 engines, between the windows.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const pod = new THREE.Group();
    const shell = new THREE.CapsuleGeometry(0.31, 0.62, 6, 20);
    shell.scale(1, 1, 0.5);
    pod.add(mesh(shell, M.blackGloss, { position: [0, 0, 0] }));
    for (const dx of [-0.15, 0.15]) {
      const nozzle = mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 20), M.bellCool, { position: [dx, -0.55, 0.06], rotation: [0.35, 0, 0] });
      pod.add(nozzle);
    }
    const podY = y0 + 1.5;
    pod.position.set(Math.sin(a) * (wallR(podY) + 0.02), podY, Math.cos(a) * (wallR(podY) + 0.02));
    pod.rotation.set(-WALL_ANGLE, a, 0, 'YXZ'); // lean with the conical wall
    g.add(pod);
  }
  // Windows (4) and hatch
  const winY = y0 + 2.35;
  for (const a of [Math.PI / 2 + 0.6, Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6]) {
    const rr = wallR(winY);
    const w = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 32), M.glass);
    w.position.set(Math.sin(a) * (rr + 0.005), winY, Math.cos(a) * (rr + 0.005));
    w.rotation.set(Math.PI / 2 - WALL_ANGLE, a, 0, 'YXZ'); // disc axis = wall normal
    g.add(w);
    const frame = mesh(new THREE.TorusGeometry(0.215, 0.012, 8, 32), M.darkMetal);
    frame.position.copy(w.position);
    frame.rotation.copy(w.rotation);
    g.add(frame);
  }
  {
    const a = Math.PI / 2;
    const hatchY = y0 + 1.75;
    const rr = wallR(hatchY);
    const hatch = mesh(new THREE.BoxGeometry(0.95, 1.05, 0.03), M.whiteFresh);
    hatch.position.set(Math.sin(a) * (rr + 0.01), hatchY, Math.cos(a) * (rr + 0.01));
    hatch.rotation.set(-WALL_ANGLE, a, 0, 'YXZ');
    g.add(hatch);
    const seam = mesh(new THREE.BoxGeometry(1.0, 1.1, 0.02), M.blackMatte);
    seam.position.copy(hatch.position); seam.rotation.copy(hatch.rotation);
    g.add(seam);
  }
  // Draco thrusters: 4 clusters of 4 near the shoulder.
  const dracos = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    for (let k = 0; k < 4; k++) {
      const da = a + (k - 1.5) * 0.12;
      const y = y0 + 0.62 + (k % 2) * 0.16;
      const rr = wallR(y) - 0.02;
      const m = new THREE.Matrix4().makeRotationY(da).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - WALL_ANGLE));
      m.setPosition(Math.sin(da) * rr, y, Math.cos(da) * rr);
      dracos.push({ geometry: new THREE.CylinderGeometry(0.05, 0.04, 0.1, 12), matrix: m });
    }
  }
  g.add(mesh(mergeAll(dracos), M.blackMatte));

  g.userData.height = TOP;
  g.userData.annotations = [
    { label: 'Escudo térmico PICA', position: [0.0, y0 - 0.15, 1.2] },
    { label: 'Vaina SuperDraco (2 × 4 = 8)', position: [Math.sin(Math.PI / 4) * 2.15, y0 + 1.55, Math.cos(Math.PI / 4) * 2.15] },
    { label: 'Ventana', position: [Math.sin(0.42) * 1.9, winY, Math.cos(0.42) * 1.9] },
    { label: 'Escotilla lateral', position: [2.1, y0 + 1.75, 0] },
    { label: 'Morro abatible · adaptador IDSS', position: [0, TOP + 0.25, 0.6] },
    { label: 'Trunk · paneles solares (media circunferencia)', position: [0, 1.9, -R - 0.3] },
    { label: 'Trunk · radiador', position: [0, 2.6, R + 0.3] },
    { label: 'Aleta del trunk', position: [Math.sin(Math.PI / 4) * (R + 0.9), 2.0, Math.cos(Math.PI / 4) * (R + 0.9)] },
    { label: 'Draco (16)', position: [0, y0 + 0.8, R + 0.25] },
  ];
  return g;
}
