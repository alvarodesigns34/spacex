/**
 * Engine Row display engines: one of each, built as exhibits rather than as the instanced
 * silhouettes the rockets carry (33 Raptors on a booster have to be cheap; three engines a
 * visitor walks round at arm's length have to look like the photographs).
 *
 * Read off, as reference only (none of these images is in the repository):
 *  - Merlin 1D Block 5: SpaceX's factory portrait of a new engine (2017): a satin light-grey
 *    bell with a rolled lip and one stiffening ring, a bolted flange at the throat, a smooth
 *    cylindrical chamber, the turbopump hanging beside it with its turbine exhaust, the gas
 *    generator opposite, and a crown of braided lines and orange harnesses under the mount.
 *  - Raptor 3: SpaceX's portraits of the first Raptor 3 (August 2024): a matte charcoal bell,
 *    almost conical; a flared collar at the nozzle joint; a narrow throat; a stack of rings up
 *    the chamber to a broad manifold disc at about two metres; a bolted silver ring; the
 *    turbopump block with its round ports; and the silver thrust puck on top, with one heavy
 *    curved duct sweeping down the side from the powerhead into the chamber.
 *  - Raptor Vacuum: NASA's photograph of two vacuum engines (see raptorVacGeometry) for the
 *    bell, under the same clean Raptor 3 powerhead, which is what Starship V3 flies.
 * Published: 0.92 m Merlin exit (Wikipedia), Raptor 3 1.3 × 2.9 m and Raptor Vacuum 2.3 ×
 * 4.4 m (spacex.com). Every other dimension is photogrammetry against those, marked ≈.
 *
 * Frame: exit plane at y = 0, engine along +Y, as in engines.js.
 */
import * as THREE from 'three';
import { lathe, mergeAll, mat4, mesh } from '../geometry/utils.js';
import { raptorVacGeometry } from './engines.js';
import { V, lat, tube, cyl, boltRing, raptor3Stack, RAPTOR3_BELL } from './raptorStack.js';

/** A cylinder whose axis runs from a to b. */
function strut(parts, a, b, r, seg = 10) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  parts.push({ geometry: cyl(r, r, d.length(), seg), matrix: new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, V(1, 1, 1)) });
}

/** Adds one merged mesh per material from a { material: parts[] } table. */
function addParts(g, table, M, prefix) {
  for (const [key, parts] of Object.entries(table)) {
    if (!parts.length) continue;
    const m = mesh(mergeAll(parts), M[key], { name: `${prefix}-${key}` });
    g.add(m);
  }
}

// ---- Merlin 1D --------------------------------------------------------------------------
/** Bell profile (r, y) read off the factory portrait, 0.92 m exit as the rule (≈). */
export const MERLIN_EXHIBIT_BELL = [
  [0.46, 0], [0.455, 0.1], [0.43, 0.35], [0.385, 0.55], [0.35, 0.69], [0.3, 0.8], [0.25, 0.88], [0.19, 0.95], [0.135, 1.0], [0.118, 1.03],
];

export function buildMerlinExhibit(M) {
  const g = new THREE.Group();
  g.name = 'merlin-exhibit';
  const bell = MERLIN_EXHIBIT_BELL.map(([r, y]) => ({ r, y }));
  g.add(mesh(lathe(bell, { segments: 72, uvMode: 'normalized' }), M.merlinNozzle, { name: 'merlin-bell' }));
  g.add(mesh(lathe(bell.map(p => ({ r: Math.max(p.r - 0.012, 0.1), y: p.y })), { segments: 72, flip: true, uvMode: 'normalized' }), M.bellInnerSoot, { name: 'merlin-bell-inner', castShadow: false }));

  const P = { merlinNozzle: [], engineSilver: [], engineDark: [], braided: [], harness: [], mountBlue: [] };
  // Rolled lip at the exit and the stiffening ring two thirds of the way up the bell.
  P.merlinNozzle.push({ geometry: new THREE.TorusGeometry(0.462, 0.014, 8, 72), matrix: mat4([0, 0.012, 0], [Math.PI / 2, 0, 0]) });
  P.merlinNozzle.push({ geometry: lat([[0.352, 0.675], [0.368, 0.68, true], [0.368, 0.705, true], [0.345, 0.71]], 72) });
  // Throat flange, bolted, where the bell meets the chamber.
  P.merlinNozzle.push({ geometry: lat([[0.12, 0.99], [0.2, 0.995, true], [0.2, 1.035, true], [0.13, 1.04]], 48) });
  boltRing(P.engineSilver, 1.015, 0.2, 24, { size: 0.009, len: 0.018 });
  // Chamber: converging section up from the throat, the cylindrical barrel, and the injector
  // shoulder under the dome (≈).
  P.merlinNozzle.push({ geometry: lat([[0.118, 1.03], [0.16, 1.09], [0.215, 1.17], [0.245, 1.24], [0.25, 1.3], [0.25, 1.52], [0.24, 1.58], [0.215, 1.64]], 48) });
  // Regen coolant manifold round the barrel's foot and the injector ring above it.
  P.engineSilver.push({ geometry: new THREE.TorusGeometry(0.255, 0.022, 8, 40), matrix: mat4([0, 1.28, 0], [Math.PI / 2, 0, 0]) });
  P.engineDark.push({ geometry: lat([[0.215, 1.63], [0.235, 1.64, true], [0.235, 1.69, true], [0.19, 1.72], [0.17, 1.78], [0.001, 1.8]], 36) });
  boltRing(P.engineSilver, 1.665, 0.235, 20, { size: 0.008, len: 0.016 });
  // Gimbal block and bearing on top of the dome, and the thrust post up to the mount (≈).
  P.engineDark.push({ geometry: cyl(0.11, 0.13, 0.16, 20), matrix: mat4([0, 1.87, 0]) });
  P.engineSilver.push({ geometry: new THREE.SphereGeometry(0.085, 16, 12), matrix: mat4([0, 1.97, 0]) });
  P.engineDark.push({ geometry: cyl(0.1, 0.1, 0.14, 20), matrix: mat4([0, 2.07, 0]) });
  // Mount interface: the dark-blue plate the engine hangs from on the stand (≈ 0.56 m across).
  P.mountBlue.push({ geometry: new THREE.BoxGeometry(0.56, 0.035, 0.56), matrix: mat4([0, 2.16, 0]) });
  P.mountBlue.push({ geometry: new THREE.BoxGeometry(0.62, 0.03, 0.1), matrix: mat4([0, 2.2, 0.24]) });
  P.mountBlue.push({ geometry: new THREE.BoxGeometry(0.62, 0.03, 0.1), matrix: mat4([0, 2.2, -0.24]) });

  // Turbopump, hanging beside the chamber: a single-shaft unit, LOX pump on top, fuel pump,
  // turbine at the bottom exhausting through a short flared duct (≈ from the portrait).
  const TP = [0.4, 0, 0.08];
  P.merlinNozzle.push({ geometry: lat([[0.06, 1.04], [0.1, 1.08], [0.13, 1.14], [0.14, 1.18, true], [0.14, 1.5, true], [0.155, 1.52, true], [0.155, 1.58, true], [0.135, 1.62], [0.11, 1.7], [0.06, 1.74], [0.001, 1.75]], 32), matrix: mat4(TP) });
  P.engineDark.push({ geometry: lat([[0.001, 1.02], [0.075, 1.02, true], [0.095, 0.96], [0.1, 0.94, true], [0.07, 0.94]], 24), matrix: mat4(TP) });
  P.engineSilver.push({ geometry: new THREE.TorusGeometry(0.15, 0.02, 8, 28), matrix: mat4([TP[0], 1.52, TP[2]], [Math.PI / 2, 0, 0]) });
  boltRing(P.engineSilver, 1.35, 0.14, 16, { size: 0.007, len: 0.012 });
  P.engineSilver.push(...[0, 0].map(() => ({ geometry: new THREE.TorusGeometry(0.16, 0.035, 10, 28), matrix: mat4([TP[0], 1.42, TP[2]], [Math.PI / 2, 0, 0]) })).slice(0, 1));
  // LOX inlet into the pump top and fuel inlet into its side, coming down from the mount.
  P.engineSilver.push({ geometry: tube([[TP[0], 1.74, TP[2]], [TP[0] - 0.02, 1.85, TP[2]], [0.28, 2.0, 0.05], [0.12, 2.1, 0.02]], 0.055, 20, 14) });
  P.engineSilver.push({ geometry: tube([[TP[0] + 0.13, 1.44, TP[2]], [0.58, 1.6, 0.05], [0.5, 1.95, -0.1], [0.2, 2.1, -0.18]], 0.042, 24, 12) });
  // Pump discharge lines to the chamber: LOX to the injector dome, fuel to the regen manifold.
  P.engineSilver.push({ geometry: tube([[TP[0] - 0.1, 1.6, TP[2] + 0.05], [0.24, 1.7, 0.1], [0.12, 1.74, 0.08]], 0.04, 16, 12) });
  P.engineSilver.push({ geometry: tube([[TP[0] - 0.08, 1.4, TP[2] - 0.08], [0.3, 1.33, -0.06], [0.24, 1.28, -0.05]], 0.034, 16, 12) });

  // Gas generator on the far side, with its valves, feeding the turbine through a hot duct
  // round the back of the chamber.
  const GG = [-0.32, 0, 0.12];
  P.engineDark.push({ geometry: lat([[0.001, 1.38], [0.05, 1.4], [0.065, 1.46], [0.065, 1.62], [0.05, 1.68], [0.001, 1.7]], 20), matrix: mat4(GG) });
  P.engineSilver.push({ geometry: cyl(0.04, 0.04, 0.09, 12), matrix: mat4([GG[0] - 0.02, 1.76, GG[2] + 0.02]) });
  P.engineSilver.push({ geometry: cyl(0.035, 0.035, 0.08, 12), matrix: mat4([GG[0] + 0.05, 1.74, GG[2] - 0.06]) });
  P.engineSilver.push({ geometry: tube([[GG[0], 1.4, GG[2]], [-0.3, 1.2, -0.15], [0.05, 1.12, -0.33], [0.32, 1.1, -0.12], [TP[0] - 0.05, 1.08, TP[2] - 0.05]], 0.035, 32, 12) });

  // Braided propellant and pressurant lines and the orange instrumentation harnesses that
  // crown every Merlin under its mount: many thin runs from the plate down to the valves.
  const runs = [
    [[0.18, 2.14, 0.16], [0.22, 1.95, 0.2], [0.2, 1.72, 0.16]],
    [[-0.12, 2.14, 0.2], [-0.2, 1.95, 0.22], [-0.26, 1.78, 0.14]],
    [[-0.2, 2.14, -0.12], [-0.28, 1.92, -0.14], [-0.3, 1.72, 0.05]],
    [[0.05, 2.14, -0.22], [0.1, 1.92, -0.26], [0.18, 1.74, -0.2]],
    [[0.24, 2.14, -0.02], [0.34, 1.9, -0.04], [0.36, 1.78, 0.02]],
    [[-0.06, 2.14, 0.24], [0.02, 1.9, 0.27], [0.12, 1.66, 0.22]],
  ];
  for (const r of runs) P.braided.push({ geometry: tube(r, 0.014, 18, 8) });
  const harness = [
    [[-0.22, 2.14, 0.18], [-0.3, 1.98, 0.2], [-0.36, 1.84, 0.16], [-0.34, 1.7, 0.16]],
    [[-0.26, 2.14, 0.1], [-0.35, 1.94, 0.12], [-0.4, 1.8, 0.1]],
    [[0.22, 2.14, 0.2], [0.32, 1.96, 0.22], [0.42, 1.8, 0.16]],
  ];
  for (const r of harness) P.harness.push({ geometry: tube(r, 0.011, 18, 6) });
  // Two hydraulic TVC actuators from the mount to lugs on the chamber, 90° apart.
  for (const a of [0.9, 0.9 + Math.PI / 2]) {
    const top = [Math.sin(a) * 0.3, 2.12, Math.cos(a) * 0.3], bot = [Math.sin(a) * 0.27, 1.5, Math.cos(a) * 0.27];
    strut(P.engineDark, top, [(top[0] + bot[0]) / 2, 1.8, (top[2] + bot[2]) / 2], 0.034);
    strut(P.engineSilver, [(top[0] + bot[0]) / 2, 1.8, (top[2] + bot[2]) / 2], bot, 0.018);
    P.engineDark.push({ geometry: new THREE.BoxGeometry(0.07, 0.07, 0.07), matrix: mat4(bot, [0, a, 0]) });
  }
  addParts(g, P, M, 'merlin');
  g.userData.height = 2.22;
  return g;
}

// ---- Raptor 3 ---------------------------------------------------------------------------
export function buildRaptor3Exhibit(M) {
  const g = new THREE.Group();
  g.name = 'raptor-exhibit';
  const bell = RAPTOR3_BELL.map(([r, y]) => ({ r, y }));
  g.add(mesh(lathe(bell, { segments: 96, uvMode: 'normalized' }), M.bellRaptor3, { name: 'raptor-bell' }));
  g.add(mesh(lathe(bell.map(p => ({ r: p.r - 0.014, y: p.y })), { segments: 96, flip: true, uvMode: 'normalized' }), M.bellInnerSoot, { name: 'raptor-bell-inner', castShadow: false }));
  const P = { engineDark: [], engineSilver: [], enginePurple: [], engineGold: [], engineBlue: [], bellRaptor3: [] };
  // Rolled lip at the exit.
  P.bellRaptor3.push({ geometry: new THREE.TorusGeometry(0.652, 0.012, 8, 96), matrix: mat4([0, 0.01, 0], [Math.PI / 2, 0, 0]) });
  raptor3Stack(P, 1.22, 1);
  addParts(g, P, M, 'raptor');
  g.userData.height = 2.9;
  return g;
}

// ---- Raptor Vacuum ----------------------------------------------------------------------
/** The Raptor Vacuum's meshes, by name, for the dimensional check. */
export const RVAC_HULL = ['rvac-bell', 'rvac-bell-inner', 'rvac-engineDark', 'rvac-engineSilver', 'rvac-enginePurple'];

export function buildRvacExhibit(M) {
  const g = new THREE.Group();
  g.name = 'rvac-exhibit';
  // The flight builder's bell runs on up through a plain chamber; the display engine stops it
  // at the top of the regenerative section, where the Raptor 3 stack takes over.
  const H = raptorVacGeometry().height;
  const prof = raptorVacGeometry().profile;
  const outer = lathe(prof, { segments: 128, uvMode: 'normalized' });
  {
    const p = outer.attributes.position, uv = outer.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / H);
    uv.needsUpdate = true;
  }
  g.add(mesh(outer, M.bellRvac, { name: 'rvac-bell' }));
  g.add(mesh(lathe(prof.map(p => ({ r: p.r - 0.02, y: p.y })), { segments: 128, flip: true, uvMode: 'normalized' }), M.bellInner, { name: 'rvac-bell-inner', castShadow: false }));
  // The stack sits on the regen bell's top (≈3.04 m) and ends at the published 4.4 m.
  const P = { engineDark: [], engineSilver: [], enginePurple: [], engineGold: [], engineBlue: [] };
  const y0 = 3.02, s = (4.4 - y0) / (2.9 - 1.22);
  raptor3Stack(P, y0, s, { collarR: 0.44, neckR: 0.4 });
  // The one faint hoop on the extension, as photographed.
  P.engineSilver.push({ geometry: new THREE.TorusGeometry(1.105 + 0.006, 0.01, 6, 120), matrix: mat4([0, 0.95, 0], [Math.PI / 2, 0, 0]) });
  // verify.js measures the Raptor Vacuum by its bell and these parts (RVAC_HULL), so the
  // published 4.4 m is read off the geometry that is drawn.
  addParts(g, P, M, 'rvac');
  g.userData.height = 4.4;
  return g;
}
