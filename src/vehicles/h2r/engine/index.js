/**
 * The Ninja H2R's supercharged 998 cm³ inline four, built piece by piece (October 2026), one
 * module per part:
 *  - parts.js: the shared shapes (outlines across the bike, turned parts, fasteners, hoses) and the
 *    right-side photograph's millimetre grid;
 *  - core.js: the crankcase, the cylinders and head, the left side's covers, the sump;
 *  - right.js: the clutch cover, the upper and lower cases' cast sides, the emblem, the oil cooler;
 *  - supercharger.js: the impeller, its housing and scroll, the outlet and its coupler;
 *  - chamber.js: the intake chamber, the fuel rail, the throttle bodies.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right.
 */
import * as THREE from 'three';
import { buildCore } from './core.js';
import { buildRightSide } from './right.js';
import { buildSupercharger } from './supercharger.js';
import { buildChamber, CHAMBER_INLET } from './chamber.js';

export function buildEngine(M) {
  const g = new THREE.Group(); g.name = 'h2r-engine';
  g.add(buildCore(M), buildRightSide(M), buildSupercharger(M, CHAMBER_INLET), buildChamber(M));
  return g;
}
