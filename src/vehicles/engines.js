/**
 * Rocket engines as instanced geometry. Each engine type returns three geometries
 * (outer bell, inner bell, powerhead) in a local frame where the exit plane is y = 0 and the
 * engine extends towards +Y. Instancing keeps 33 Raptors at three draw calls.
 *
 * Every bell here is lathed with `uvMode: 'normalized'`, unlike the airframes. The rest of the
 * project authors UVs in metres because its maps tile metrically; makeEngineBell does not tile
 * at all — it paints ONE wrap of a bell, with the exit at v = 0, the throat at v = 1, the heat
 * tint placed along v and ninety cooling ribs counted across u. Given metric UVs a 1.24 m
 * Raptor bell wrapped that gradient ~3.9 times around and ~2.5 times along, which is the
 * banding and the rib moiré the close views were showing.
 */
import * as THREE from 'three';
import { lathe, mergeAll, mat4 } from '../geometry/utils.js';

function bellProfile(points) { return points.map(([r, y]) => ({ r, y })); }

/** Raptor 3 (sea level): 1.3 m diameter, 2.9 m tall (spacex.com). Internal layout approximate. */
export function raptorGeometry({ exitRadius = 0.62, height = 2.9, gimbal = true } = {}) {
  const bell = bellProfile([
    [exitRadius, 0], [exitRadius * 0.97, 0.12], [exitRadius * 0.86, 0.45], [exitRadius * 0.7, 0.85],
    [exitRadius * 0.52, 1.2], [exitRadius * 0.38, 1.45], [0.215, 1.62], [0.235, 1.75], [0.3, 1.95], [0.3, 2.2],
  ]);
  const outer = lathe(bell, { segments: 64, uvMode: 'normalized' });
  const innerP = bell.map(p => ({ r: Math.max(p.r - 0.02, 0.19), y: p.y }));
  const inner = lathe(innerP, { segments: 64, flip: true, uvMode: 'normalized' });

  const parts = [];
  // Raptor 3 encloses the pumps. The readable shape is a faceted powerpack with
  // two preburner domes on the shoulders and a methane inlet, not a Merlin's
  // exposed gas generator. Housing layout is reconstructed from photographs.
  parts.push({ geometry: new THREE.CylinderGeometry(0.46, 0.40, 0.62, 8), matrix: mat4([0, 2.42, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.34, 0.46, 0.12, 8), matrix: mat4([0, 2.08, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.28, 0.22, 16), matrix: mat4([0, height - 0.11, 0]) });
  parts.push({ geometry: new THREE.SphereGeometry(0.16, 12, 10), matrix: mat4([0.30, 2.70, 0.10]) });
  parts.push({ geometry: new THREE.SphereGeometry(0.13, 12, 8), matrix: mat4([-0.28, 2.66, -0.12]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 0.26, 10), matrix: mat4([0.06, 2.64, 0.34], [0.95, 0, 0.15]) });
  parts.push({ geometry: new THREE.TorusGeometry(0.36, 0.04, 8, 28), matrix: mat4([0, 1.82, 0], [Math.PI / 2, 0, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.50, 0.36, 0.07, 16), matrix: mat4([0, 2.16, 0]) });
  // Gimbal actuators. Raptor 3 steers the inner engines; the hardware is enclosed,
  // so these are the two rods and clevises that photographs actually show, not a
  // guessed turbopump cutaway.
  if (gimbal) for (const ang of [0.5, 2.6]) {
    parts.push({
      geometry: new THREE.CylinderGeometry(0.03, 0.03, 0.48, 8),
      matrix: mat4([Math.cos(ang) * 0.34, 2.28, Math.sin(ang) * 0.34], [0.4, -ang, 0]),
    });
    parts.push({
      geometry: new THREE.BoxGeometry(0.08, 0.08, 0.06),
      matrix: mat4([Math.cos(ang) * 0.4, 2.08, Math.sin(ang) * 0.4], [0, -ang, 0]),
    });
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
  const outer = lathe(bell, { segments: 80, uvMode: 'normalized' });
  const inner = lathe(bell.map(p => ({ r: Math.max(p.r - 0.02, 0.19), y: p.y })), { segments: 80, flip: true, uvMode: 'normalized' });
  const parts = [];
  // Same enclosed full-flow pack as the sea-level engine, sat on a much longer bell.
  parts.push({ geometry: new THREE.CylinderGeometry(0.44, 0.38, 0.48, 8), matrix: mat4([0, 4.14, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.28, 0.16, 16), matrix: mat4([0, height - 0.08, 0]) });
  // Domes stay inside the published 4.4 m height. The previous station stuck out.
  parts.push({ geometry: new THREE.SphereGeometry(0.12, 12, 10), matrix: mat4([0.26, 4.18, 0.08]) });
  parts.push({ geometry: new THREE.SphereGeometry(0.10, 10, 8), matrix: mat4([-0.22, 4.16, -0.10]) });
  parts.push({ geometry: new THREE.TorusGeometry(0.34, 0.045, 8, 32), matrix: mat4([0, 3.66, 0], [Math.PI / 2, 0, 0]) });
  // Joint between the regen chamber and the radiatively cooled extension.
  parts.push({ geometry: new THREE.TorusGeometry(0.36, 0.03, 8, 48), matrix: mat4([0, 3.52, 0], [Math.PI / 2, 0, 0]) });
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
  const outer = lathe(bell, { segments: 48, uvMode: 'normalized' });
  const inner = lathe(bell.map(p => ({ r: Math.max(p.r - 0.015, 0.12), y: p.y })), { segments: 48, flip: true, uvMode: 'normalized' });
  // Powerhead. A Merlin is the most photographed rocket engine there is and it is not a
  // smooth drum: the turbopump hangs off one side, the gas generator off the other, the
  // turbine exhaust duct wraps down and out into the nozzle skirt, and the whole assembly is
  // strapped together with braided lines. Nine of these sit in a bay the "Octaweb" preset
  // looks straight into from two metres, where a plain cylinder is obvious.
  const parts = [];
  parts.push({ geometry: new THREE.CylinderGeometry(0.24, 0.22, 0.36, 20), matrix: mat4([0, 2.0, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.14, 0.18, 0.15, 16), matrix: mat4([0, height - 0.07, 0]) });
  // Open gas-generator cycle: the turbopump hangs off one side and the gas
  // generator off the other, with the turbine exhaust duct outside the bell.
  // That lopsided silhouette is the Merlin, against Raptor's enclosed pack.
  parts.push({ geometry: new THREE.CylinderGeometry(0.13, 0.13, 0.48, 14), matrix: mat4([0.36, 1.88, 0.02]) });
  parts.push({ geometry: new THREE.SphereGeometry(0.16, 12, 10), matrix: mat4([0.40, 2.16, 0.02]) });
  parts.push({ geometry: new THREE.BoxGeometry(0.18, 0.32, 0.16), matrix: mat4([-0.30, 1.96, 0.14], [0.15, 0.3, 0.25]) });
  parts.push({ geometry: new THREE.TorusGeometry(0.22, 0.03, 8, 24), matrix: mat4([0, 1.68, 0], [Math.PI / 2, 0, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.045, 0.05, 1.05, 8), matrix: mat4([0.42, 1.22, -0.08], [0.4, 0.2, 0.15]) });
  // Propellant inlets and the braided runs down to the injector manifold.
  for (const [ang, rad, len] of [[0.9, 0.05, 0.75], [2.5, 0.042, 0.68], [4.3, 0.038, 0.6], [5.6, 0.032, 0.52]]) {
    parts.push({
      geometry: new THREE.CylinderGeometry(rad, rad, len, 8),
      matrix: mat4([Math.cos(ang) * 0.22, 1.58 + len / 2, Math.sin(ang) * 0.22]),
    });
  }
  // Gimbal actuator: a Merlin steers on two of these, and their pivot blocks are the clearest
  // thing separating an engine that moves from a cone stuck to a plate.
  for (const ang of [0.6, 2.2]) {
    parts.push({
      geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.62, 10),
      matrix: mat4([Math.cos(ang) * 0.34, 1.96, Math.sin(ang) * 0.34], [0.3, -ang, 0]),
    });
    parts.push({
      geometry: new THREE.BoxGeometry(0.12, 0.12, 0.1),
      matrix: mat4([Math.cos(ang) * 0.36, 1.7, Math.sin(ang) * 0.36], [0, -ang, 0]),
    });
  }
  const head = mergeAll(parts);
  return { outer, inner, head, height, profile: bell };
}

/** Merlin Vacuum: 3.3 m nozzle exit (Wikipedia). Lives inside the interstage. */
export function merlinVacGeometry({ exitRadius = 1.65, height = 4.0 } = {}) {
  const bell = bellProfile([
    [exitRadius, 0], [exitRadius * 0.97, 0.3], [exitRadius * 0.86, 1.0], [exitRadius * 0.66, 1.9],
    [exitRadius * 0.42, 2.6], [0.14, 3.1], [0.15, 3.2], [0.2, 3.32], [0.2, 3.5],
  ]);
  const outer = lathe(bell, { segments: 64, uvMode: 'normalized' });
  const inner = lathe(bell.map(p => ({ r: Math.max(p.r - 0.015, 0.12), y: p.y })), { segments: 64, flip: true, uvMode: 'normalized' });
  const head = mergeAll([
    { geometry: new THREE.CylinderGeometry(0.24, 0.22, 0.36, 20), matrix: mat4([0, 3.7, 0]) },
    { geometry: new THREE.CylinderGeometry(0.14, 0.18, 0.15, 16), matrix: mat4([0, height - 0.07, 0]) },
    { geometry: new THREE.SphereGeometry(0.15, 12, 10), matrix: mat4([0.32, 3.78, 0.06]) },
    { geometry: new THREE.BoxGeometry(0.14, 0.26, 0.14), matrix: mat4([-0.26, 3.62, 0.14], [0.2, 0, -0.3]) },
    { geometry: new THREE.CylinderGeometry(0.04, 0.045, 0.7, 8), matrix: mat4([0.36, 3.15, -0.05], [0.5, 0, 0.2]) },
    { geometry: new THREE.TorusGeometry(0.22, 0.03, 8, 24), matrix: mat4([0, 3.38, 0], [Math.PI / 2, 0, 0]) },
    { geometry: new THREE.TorusGeometry(0.86, 0.028, 6, 40), matrix: mat4([0, 2.35, 0], [Math.PI / 2, 0, 0]) },
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
  for (const m of [outer, inner, head]) { m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; }
  // The inner bell sits inside the outer one. Casting a shadow from it only
  // adds a draw in the shadow map.
  outer.castShadow = true;
  inner.castShadow = false;
  head.castShadow = true;
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
