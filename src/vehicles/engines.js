/**
 * Rocket engines as instanced geometry. Each engine type returns three geometries
 * (outer bell, inner bell, powerhead) in a local frame where the exit plane is y = 0 and the
 * engine extends towards +Y. Instancing keeps 33 Raptors at three draw calls.
 */
import * as THREE from 'three';
import { lathe, mergeAll, mat4 } from '../geometry/utils.js';

function bellProfile(points) { return points.map(([r, y]) => ({ r, y })); }

/** Raptor 3 (sea level): 1.3 m diameter, 2.9 m tall (spacex.com). Internal layout approximate. */
export function raptorGeometry({ exitRadius = 0.62, height = 2.9 } = {}) {
  const bell = bellProfile([
    [exitRadius, 0], [exitRadius * 0.97, 0.12], [exitRadius * 0.86, 0.45], [exitRadius * 0.7, 0.85],
    [exitRadius * 0.52, 1.2], [exitRadius * 0.38, 1.45], [0.215, 1.62], [0.235, 1.75], [0.3, 1.95], [0.3, 2.2],
  ]);
  const outer = lathe(bell, { segments: 64 });
  const innerP = bell.map(p => ({ r: Math.max(p.r - 0.02, 0.19), y: p.y }));
  const inner = lathe(innerP, { segments: 64, flip: true });

  const parts = [];
  // Powerhead block (turbopumps + preburners are enclosed in Raptor 3).
  parts.push({ geometry: new THREE.CylinderGeometry(0.42, 0.36, 0.55, 40), matrix: mat4([0, 2.45, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.30, 0.42, 0.14, 40), matrix: mat4([0, 2.11, 0]) });
  // Gimbal/thrust mount.
  parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.28, 0.22, 24), matrix: mat4([0, height - 0.11, 0]) });
  // Twin turbopump housings and a methane inlet elbow.
  parts.push({ geometry: new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20), matrix: mat4([0.38, 2.35, 0.1], [0, 0, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.13, 0.13, 0.45, 20), matrix: mat4([-0.3, 2.3, 0.28]) });
  parts.push({ geometry: new THREE.TorusGeometry(0.34, 0.045, 10, 40), matrix: mat4([0, 1.78, 0], [Math.PI / 2, 0, 0]) });
  parts.push({ geometry: new THREE.TorusGeometry(0.33, 0.035, 10, 40), matrix: mat4([0, 2.02, 0], [Math.PI / 2, 0, 0]) });
  // Feed lines from the head down to the manifold.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), matrix: mat4([Math.cos(a) * 0.36, 2.05, Math.sin(a) * 0.36]) });
  }
  const head = mergeAll(parts);
  return { outer, inner, head, height, profile: bell };
}

/** Raptor Vacuum: 2.3 m diameter, 4.4 m tall (spacex.com). Radiatively cooled skirt. */
export function raptorVacGeometry({ exitRadius = 1.15, height = 4.4 } = {}) {
  const bell = bellProfile([
    [exitRadius, 0], [exitRadius * 0.985, 0.25], [exitRadius * 0.93, 0.8], [exitRadius * 0.82, 1.5],
    [exitRadius * 0.66, 2.2], [exitRadius * 0.47, 2.8], [exitRadius * 0.3, 3.25], [0.215, 3.5], [0.235, 3.62], [0.3, 3.8], [0.3, 3.95],
  ]);
  const outer = lathe(bell, { segments: 80 });
  const inner = lathe(bell.map(p => ({ r: Math.max(p.r - 0.02, 0.19), y: p.y })), { segments: 80, flip: true });
  const parts = [];
  parts.push({ geometry: new THREE.CylinderGeometry(0.42, 0.36, 0.45, 40), matrix: mat4([0, 4.12, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.28, 0.16, 24), matrix: mat4([0, height - 0.08, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.45, 20), matrix: mat4([0.36, 4.05, 0.12]) });
  parts.push({ geometry: new THREE.TorusGeometry(0.34, 0.045, 10, 40), matrix: mat4([0, 3.66, 0], [Math.PI / 2, 0, 0]) });
  // Stiffening rings on the radiatively cooled nozzle extension.
  for (const y of [0.3, 1.0, 1.8]) {
    const r = bell.find(p => p.y >= y)?.r ?? exitRadius;
    parts.push({ geometry: new THREE.TorusGeometry(r * 0.99, 0.02, 6, 80), matrix: mat4([0, y, 0], [Math.PI / 2, 0, 0]) });
  }
  const head = mergeAll(parts);
  return { outer, inner, head, height, profile: bell };
}

/** Merlin 1D (sea level): 0.92 m nozzle exit (Wikipedia). Overall height approximate. */
export function merlinGeometry({ exitRadius = 0.46, height = 2.3 } = {}) {
  const bell = bellProfile([
    [exitRadius, 0], [exitRadius * 0.96, 0.12], [exitRadius * 0.82, 0.5], [exitRadius * 0.62, 0.9],
    [exitRadius * 0.42, 1.2], [0.14, 1.42], [0.15, 1.5], [0.2, 1.62], [0.2, 1.8],
  ]);
  const outer = lathe(bell, { segments: 48 });
  const inner = lathe(bell.map(p => ({ r: Math.max(p.r - 0.015, 0.12), y: p.y })), { segments: 48, flip: true });
  const parts = [];
  parts.push({ geometry: new THREE.CylinderGeometry(0.27, 0.24, 0.4, 32), matrix: mat4([0, 2.0, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.14, 0.18, 0.15, 20), matrix: mat4([0, height - 0.07, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.11, 0.11, 0.42, 16), matrix: mat4([0.26, 1.95, 0.05]) }); // turbopump
  parts.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), matrix: mat4([-0.2, 1.9, 0.2]) });   // gas generator
  parts.push({ geometry: new THREE.TorusGeometry(0.22, 0.03, 8, 32), matrix: mat4([0, 1.68, 0], [Math.PI / 2, 0, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), matrix: mat4([0.32, 1.35, -0.1], [0.25, 0, 0]) }); // turbine exhaust duct
  const head = mergeAll(parts);
  return { outer, inner, head, height, profile: bell };
}

/** Merlin Vacuum: 3.3 m nozzle exit (Wikipedia). Lives inside the interstage. */
export function merlinVacGeometry({ exitRadius = 1.65, height = 4.0 } = {}) {
  const bell = bellProfile([
    [exitRadius, 0], [exitRadius * 0.97, 0.3], [exitRadius * 0.86, 1.0], [exitRadius * 0.66, 1.9],
    [exitRadius * 0.42, 2.6], [0.14, 3.1], [0.15, 3.2], [0.2, 3.32], [0.2, 3.5],
  ]);
  const outer = lathe(bell, { segments: 64 });
  const inner = lathe(bell.map(p => ({ r: Math.max(p.r - 0.015, 0.12), y: p.y })), { segments: 64, flip: true });
  const head = mergeAll([
    { geometry: new THREE.CylinderGeometry(0.27, 0.24, 0.4, 32), matrix: mat4([0, 3.7, 0]) },
    { geometry: new THREE.CylinderGeometry(0.14, 0.18, 0.15, 20), matrix: mat4([0, height - 0.07, 0]) },
    { geometry: new THREE.TorusGeometry(0.22, 0.03, 8, 32), matrix: mat4([0, 3.38, 0], [Math.PI / 2, 0, 0]) },
  ]);
  return { outer, inner, head, height };
}

/**
 * Creates instanced meshes for an engine geometry set.
 * transforms: array of { position:[x,y,z], tilt?:[rx,rz], spin?:number }
 */
export function instanceEngines(geo, materials, transforms, { bellMaterial, headMaterial } = {}) {
  const group = new THREE.Group();
  group.name = 'engines';
  const n = transforms.length;
  // Published engine counts are the one figure on every sheet that the geometry can silently
  // disagree with — a loop bound is easy to mistype and nothing about the render says "34".
  // Recording it here lets verify.js sum the whole vehicle and compare against the sheet.
  group.userData.engineCount = n;
  const outer = new THREE.InstancedMesh(geo.outer, bellMaterial ?? materials.bell, n);
  const inner = new THREE.InstancedMesh(geo.inner, materials.bellInner, n);
  const head = new THREE.InstancedMesh(geo.head, headMaterial ?? materials.darkMetal, n);
  const dummy = new THREE.Object3D();
  transforms.forEach((t, i) => {
    dummy.position.set(...t.position);
    dummy.rotation.set(t.tilt?.[0] ?? 0, t.spin ?? 0, t.tilt?.[1] ?? 0);
    dummy.updateMatrix();
    outer.setMatrixAt(i, dummy.matrix);
    inner.setMatrixAt(i, dummy.matrix);
    head.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [outer, inner, head]) { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; }
  group.add(outer, inner, head);
  return group;
}

/** Ring layout helper. */
export function ringLayout(count, radius, y, { phase = 0, tilt = 0 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    // small outward cant for outer rings (approximation of the real installation angle)
    out.push({ position: [x, y, z], tilt: [tilt * Math.cos(a), -tilt * Math.sin(a)], spin: a });
  }
  return out;
}
