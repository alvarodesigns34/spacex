/**
 * Kawasaki Ninja H2R (ZX1000Y), at 1:1, as Kawasaki photographed it: Mirror Coated Spark Black,
 * the green trellis frame, carbon cowl, wings and ducts. The model is built piece by piece, one
 * module per part or system in this directory:
 *  - geometry.js, photo.js, materials.js: the frame of reference, the photograph's calibration, the materials;
 *  - wheels.js, brakes.js, steer.js (the fork, clamps, bars, front wheel), swingarm.js (with the chain and rear wheel);
 *  - trellis.js (the frame), engine/ (one module per part), intake.js (the ram-air duct), exhaust.js;
 *  - bodywork/: tank.js, seat.js, fairing.js (cowl, side panel, nose, wings, screen), decals.js, surfaces.js;
 *  - rearsets.js: the hangers, heel guards, footpegs, brake pedal and gear lever;
 *  - details.js and dash.js: the rest.
 *
 * PROVENANCE
 *  - Every published figure is in data/h2r.js with its source (Kawasaki's specifications, MY2027).
 *  - The shapes are fitted to Kawasaki's studio photographs (left side, right side, right front
 *    three-quarter; reference only, not in the repository) through their calibrated cameras: both
 *    studio cameras were solved together (a bundle adjustment, ≈2 px rms) on the published
 *    wheelbase, tyre diameters and height, so that every feature seen in both — the side panel's
 *    bolts and tip, the frame's nodes, the wings' corners — has its width as well as its side-view
 *    position. Outlines are traced on the side photograph (≈ ±1 cm); widths ≈ ±1.5 cm.
 *  - Reconstructed (≈): the sections between the fitted lines, the engine's covers and internals
 *    as seen, the wheels' spokes and the callipers, the controls, the dash's face.
 *  - Kawasaki's own markings, by the visitor's request (the one exception to the centre's
 *    no-logos rule): "Kawasaki" on the tank, "Ninja" and "H2R" on the side panels, "brembo" on the
 *    callipers, drawn as type.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right. Groups
 * the ride animates: h2r-steer (about the steering axis), h2r-wheel-f-spin / h2r-wheel-r-spin,
 * h2r-swingarm (about the pivot); the dash's face redraws through its userData.draw.
 */
import * as THREE from 'three';
import { applyDetail } from '../../materials/detail.js';
import { partMaterials, carbonMaterial } from './materials.js';
import { buildSteer } from './steer.js';
import { buildSwingarm } from './swingarm.js';
import { buildFrame } from './trellis.js';
import { buildEngine as buildEngineParts } from './engine/index.js';
import { buildDuct } from './intake.js';
import { buildExhaust } from './exhaust.js';
import { buildDetails } from './details.js';
import { buildRearsets } from './rearsets.js';
import { buildTank } from './bodywork/tank.js';
import { buildSeatTail } from './bodywork/seat.js';
import { buildFairing3 as buildFairing } from './bodywork/fairing.js';
import { buildDecals } from './bodywork/decals.js';

export { STEER_AXIS, AXLE_F, AXLE_R, PIVOT } from './geometry.js';

export function buildH2r(M) {
  partMaterials(M);
  const root = new THREE.Group();
  root.name = 'h2r';
  // Mirror Coated Spark Black: a silver mirror layer under a smoked clear: dark where it faces the
  // shadows, bright silver where it catches the light (≈).
  M.h2rChrome ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-mirror-coat', color: 0xc3c8cd, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 });
  M.h2rVoid ??= new THREE.MeshStandardMaterial({ name: 'h2r-void', color: 0x0a0a0b, metalness: 0.2, roughness: 0.7 });
  M.h2rCarbon ??= carbonMaterial();
  M.h2rTail ??= new THREE.MeshStandardMaterial({ name: 'h2r-tail-lamp', color: 0x8a0d10, emissive: 0xc0141a, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.2 });
  M.h2rSeat ??= new THREE.MeshStandardMaterial({ name: 'h2r-seat', color: 0x151617, metalness: 0, roughness: 0.85 });
  const fairing = buildFairing(M), tank = buildTank(M);
  root.add(buildSteer(M), buildSwingarm(M), buildFrame(M), buildEngine(M), buildExhaust(M), tank, buildSeatTail(M), fairing, buildDetails(M), buildRearsets(M));
  root.updateMatrixWorld(true);
  root.add(buildDecals(fairing.userData.panel, tank.getObjectByName('h2r-tank-top'), root.getObjectByName('h2r-tail')));
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  detailH2r(M);
  return root;
}

/**
 * What each material is made of, close up (materials/detail.js; tile sizes and strengths ≈,
 * against the photographs): the tyres' rubber, the cast cases and sump, the brushed and machined
 * aluminium, the satin and powder-coated black, the seat's grain, the carbon's twill, the orange
 * peel under the mirror coat's and the frame's clear coats.
 */
function detailH2r(M) {
  const D = (m, kind, o) => m && applyDetail(m, kind, o);
  D(M.h2rTyre, 'rubber', { size: 0.012, normal: 0.8, rough: 0.35 });
  D(M.h2rTyreWall, 'rubber', { size: 0.008, normal: 0.5, rough: 0.2 });
  D(M.h2rRubber, 'rubber', { size: 0.01, normal: 0.8, rough: 0.35 });
  for (const k of ['h2rSatin', 'h2rSatin2', 'h2rBlack2', 'h2rChain', 'h2rMeshDark']) D(M[k], 'stipple', { size: 0.008, normal: 0.6, rough: 0.25 });
  for (const k of ['h2rEngine', 'h2rCover', 'h2rCast', 'h2rCaliper']) D(M[k], 'cast', { size: 0.018, normal: 0.8, rough: 0.35 });
  for (const k of ['h2rAlu', 'h2rMachined', 'h2rTi', 'h2rTiGold', 'h2rSilencer', 'h2rPlenum']) D(M[k], 'brushed', { size: 0.03, normal: 0.35, rough: 0.3 });
  D(M.h2rDiscF, 'brushed', { size: 0.015, normal: 0.6, rough: 0.35 });
  D(M.h2rSprocket, 'brushed', { size: 0.02, normal: 0.4, rough: 0.3 });
  // The brake lines' stainless braid: a fine twill across the line (≈1.5 mm).
  D(M.h2rBraid, 'twill', { size: 0.003, normal: 1, rough: 0.3 });
  D(M.h2rSeat, 'grain', { size: 0.02, normal: 1, rough: 0.4 });
  D(M.h2rCarbon, 'twill', { size: 0.032, normal: 0.6, rough: 0.2, color: 0.85 });
  for (const k of ['h2rChrome', 'h2rChrome2', 'h2rGreen', 'h2rRim', 'h2rBlack', 'h2rRedAnod']) D(M[k], 'peel', { size: 0.06, normal: 0.18, rough: 0.1 });
}

/** The engine (engine/) and the ram-air duct that feeds its supercharger. */
function buildEngine(M) {
  const g = buildEngineParts(M);
  g.add(buildDuct(M));
  return g;
}
