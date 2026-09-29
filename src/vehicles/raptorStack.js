/**
 * The Raptor 3 above its nozzle joint — collar, chamber stack, injector manifold, turbopump
 * block, thrust puck and the heavy side duct — shared by the Engine Row's display engines and
 * the instanced engines on Super Heavy and Starship (which take the `lite` version: no
 * bolts, valves or instrumentation lines). Read off SpaceX's August 2024 portraits of the
 * first Raptor 3 (reference only); every dimension is ≈ against the published 1.3 × 2.9 m.
 */
import * as THREE from 'three';
import { lathe, mat4 } from '../geometry/utils.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const lat = (pts, seg = 48) => lathe(pts.map(([r, y, sharp]) => ({ r, y, sharp })), { segments: seg, uvMode: 'normalized' });
export const tube = (pts, r, seg = 24, radial = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), seg, r, radial, false);
export const cyl = (r0, r1, h, seg = 16) => new THREE.CylinderGeometry(r0, r1, h, seg);

/** A ring of bolt heads round the axis at height y. */
export function boltRing(parts, y, R, n, { size = 0.012, len = 0.02, up = false } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push({
      geometry: cyl(size, size, len, 6),
      matrix: up ? mat4([Math.sin(a) * R, y, Math.cos(a) * R]) : mat4([Math.sin(a) * R, y, Math.cos(a) * R], [Math.PI / 2, a, 0]),
    });
  }
}


// ---- Raptor 3 powerhead, shared with the vacuum engine ----------------------------------
/**
 * Everything above the nozzle joint of a Raptor 3, from the flared collar to the thrust puck,
 * as the August 2024 portraits show it. y0 is the collar's foot and s scales the stack
 * vertically (the vacuum engine carries the same pack in a little less height).
 */
export function raptor3Stack(P, y0, s = 1, { collarR = 0.47, neckR = 0.4, lite = false } = {}) {
  const Y = (y) => y0 + (y - 1.22) * s;
  // The lite version is drawn 33 times over on a booster: a third of the facets.
  const S = (n) => (lite ? Math.max(10, Math.round(n * 0.3)) : n);
  // Flared collar at the nozzle joint and the neck down into the throat.
  P.engineDark.push({ geometry: lat([[neckR - 0.02, Y(1.2)], [collarR, Y(1.235), true], [collarR, Y(1.26), true], [neckR - 0.05, Y(1.28)], [0.3, Y(1.34)], [0.22, Y(1.4)], [0.2, Y(1.44)]], S(64)) });
  // Chamber stack: rings and drums up to the injector manifold.
  P.engineDark.push({ geometry: lat([[0.2, Y(1.44)], [0.23, Y(1.47)], [0.23, Y(1.52)], [0.25, Y(1.53), true], [0.25, Y(1.555), true], [0.235, Y(1.56)], [0.235, Y(1.69)], [0.27, Y(1.7), true], [0.27, Y(1.725), true], [0.3, Y(1.74), true], [0.3, Y(1.83), true], [0.27, Y(1.84)], [0.27, Y(1.93)]], S(64)) });
  // Injector manifold: the broad disc two thirds of the way up, rounded at its rim.
  P.engineDark.push({ geometry: lat([[0.27, Y(1.93)], [0.385, Y(1.95), true], [0.405, Y(1.975)], [0.405, Y(2.045)], [0.385, Y(2.07), true], [0.3, Y(2.085), true], [0.29, Y(2.18)]], S(72)) });
  // Bolts round the chamber rings and the collar, and two instrumentation lines up the stack.
  if (!lite) {
  boltRing(P.engineSilver, Y(1.5425), 0.25, 24, { size: 0.007, len: 0.012 });
  boltRing(P.engineSilver, Y(1.7125), 0.27, 24, { size: 0.007, len: 0.012 });
  boltRing(P.engineSilver, Y(1.785), 0.3, 30, { size: 0.008, len: 0.012 });
  boltRing(P.engineSilver, Y(1.2475), collarR, 40, { size: 0.008, len: 0.012 });
  for (const a of [2.2, 3.6]) {
    P.engineSilver.push({ geometry: tube([[Math.sin(a) * 0.3, Y(2.12), Math.cos(a) * 0.3], [Math.sin(a) * 0.325, Y(1.8), Math.cos(a) * 0.325], [Math.sin(a) * 0.26, Y(1.6), Math.cos(a) * 0.26], [Math.sin(a) * 0.24, Y(1.46), Math.cos(a) * 0.24]], 0.009, S(20), S(6)) });
  }
  }
  // Bolted silver ring under the turbopump block.
  P.engineSilver.push({ geometry: lat([[0.29, Y(2.18)], [0.3, Y(2.185), true], [0.3, Y(2.215), true], [0.26, Y(2.22)]], S(48)) });
  if (!lite) boltRing(P.engineSilver, Y(2.2), 0.3, 28, { size: 0.01, len: 0.018 });
  // Turbopump block: a squat, rounded body with round ports on its faces (≈ 0.5 m across).
  // A superellipse in plan (exponent 4): square-ish, with the rounded corners of a casting.
  const blk = new THREE.CylinderGeometry(1, 1, (2.55 - 2.22) * s, S(40), 3);
  {
    const p = blk.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < 1e-6) continue;
      const c = Math.abs(x / r), sn = Math.abs(z / r), k = 1 / Math.pow(c ** 4 + sn ** 4, 0.25);
      p.setXYZ(i, (x / r) * k * 0.23, p.getY(i), (z / r) * k * 0.2);
    }
    blk.computeVertexNormals();
  }
  P.enginePurple.push({ geometry: blk, matrix: mat4([0, Y(2.385), 0]) });
  for (const [x, z, ry] of [[0.2, 0.08, Math.PI / 2], [-0.2, -0.05, Math.PI / 2], [0.06, 0.19, 0], [-0.1, -0.19, 0], [0.12, -0.19, 0]]) {
    P.engineSilver.push({ geometry: cyl(0.05, 0.05, 0.05, S(20)), matrix: mat4([x, Y(2.4), z], [Math.PI / 2, ry, 0]) });
    P.engineDark.push({ geometry: cyl(0.032, 0.032, 0.056, S(16)), matrix: mat4([x, Y(2.4), z], [Math.PI / 2, ry, 0]) });
  }
  // Neck, silver collar and the thrust puck on top.
  P.engineDark.push({ geometry: cyl(0.16, 0.2, 0.06 * s, S(32)), matrix: mat4([0, Y(2.58), 0]) });
  P.engineSilver.push({ geometry: lat([[0.13, Y(2.61)], [0.15, Y(2.62), true], [0.15, Y(2.66), true], [0.125, Y(2.67)], [0.125, Y(2.82)], [0.13, Y(2.83), true], [0.13, Y(2.86), true], [0.1, Y(2.88)], [0.001, Y(2.9)]], S(40)) });
  if (!lite) boltRing(P.engineSilver, Y(2.64), 0.15, 16, { size: 0.008, len: 0.014 });
  // The heavy duct sweeping down the side from the powerhead into the chamber.
  P.engineDark.push({ geometry: tube([[0.22, Y(2.42), 0.05], [0.42, Y(2.44), 0.08], [0.5, Y(2.3), 0.08], [0.46, Y(2.02), 0.06], [0.38, Y(1.72), 0.04], [0.27, Y(1.5), 0.03]], 0.058, S(40), S(16)) });
  P.engineDark.push({ geometry: new THREE.TorusGeometry(0.066, 0.016, 8, S(20)), matrix: mat4([0.29, Y(1.53), 0.03], [Math.PI / 2 - 0.9, 0, 0.6]) });
  // A second, thinner run behind it to the throat, ending in a flange (≈).
  P.engineDark.push({ geometry: tube([[0.22, Y(2.12), -0.16], [0.36, Y(1.95), -0.18], [0.33, Y(1.62), -0.14], [0.24, Y(1.42), -0.1]], 0.04, S(30), S(12)) });
  P.engineSilver.push({ geometry: cyl(0.058, 0.058, 0.02, S(16)), matrix: mat4([0.25, Y(1.43), -0.1], [0.3, 0, 0.5]) });
  if (lite) return;
  // Small valves, sensors and short lines round the powerhead: the silver, gold and blue
  // details that are nearly all the colour the engine has.
  const small = [
    [[0.18, Y(2.55), 0.16], [0.26, Y(2.6), 0.18], [0.3, Y(2.5), 0.12]],
    [[-0.18, Y(2.55), 0.14], [-0.28, Y(2.58), 0.1], [-0.3, Y(2.42), 0.04]],
    [[-0.2, Y(2.3), -0.12], [-0.3, Y(2.2), -0.14], [-0.3, Y(2.02), -0.1]],
    [[0.02, Y(2.56), -0.2], [0.02, Y(2.62), -0.26], [0.08, Y(2.66), -0.28]],
  ];
  for (const r of small) P.engineSilver.push({ geometry: tube(r, 0.016, S(14), S(8)) });
  for (const [x, y, z, k] of [[0.3, 2.5, 0.12, 'engineGold'], [-0.3, 2.42, 0.04, 'engineSilver'], [0.26, 2.3, -0.16, 'engineBlue'], [-0.24, 2.56, -0.16, 'engineGold'], [0.12, 2.58, 0.22, 'engineSilver']]) {
    P[k].push({ geometry: cyl(0.03, 0.03, 0.07, S(14)), matrix: mat4([x, Y(y), z]) });
  }
}


/** Nozzle profile, 1.3 m exit as the rule (≈): almost a cone, gently convex. */
export const RAPTOR3_BELL = [
  [0.65, 0], [0.646, 0.08], [0.622, 0.3], [0.588, 0.5], [0.548, 0.7], [0.503, 0.9], [0.462, 1.05], [0.43, 1.15], [0.41, 1.22],
];

