/**
 * The ground under the F-16, as its flight model touches it (sim/f16Flight.js): the runway's
 * pavement, the terrain's height function with the beach and the sea, and past the disc the
 * Earth's curvature. It is the ground the scene draws (core/runway.js, core/environment.js,
 * core/outerGround.js), in one place so the checks (tools/f16-check.mjs) can test it headless.
 *
 * Land or sea is decided on the flat terrain's own height, before the curvature lowers both:
 * compared after it, the plain 10 km out (7 m down) read as sea.
 */
import { runwaySurface } from './runway.js';
import { groundSample } from './environment.js';
import { toRunway, poolDepth, POOL_SURFACE } from './terrain.js';
import { curvatureDrop } from './outerGround.js';

/** Sea surface below the pad's plane, m (where the terrain's height reads as water). */
export const SEA_LEVEL = -0.9;

/** ground(x, z) → { h, hard: true on pavement, water: true on the sea, surface: a pool's water over its bed }, scene coordinates. */
export function f16Ground(x, z) {
  const [a, c] = toRunway(x, z);
  const pave = runwaySurface(a, c);
  if (pave > 0.01) return { h: pave, hard: true, water: false };
  const drop = curvatureDrop(Math.hypot(x, z));
  const h = groundSample(x, -z).h;
  if (h < SEA_LEVEL) return { h: SEA_LEVEL - drop, hard: false, water: true };
  // A tidal pool: its carved bed under its surface (terrain.js): the wheels roll on the bed.
  const pool = poolDepth(x, z);
  return pool > 0 ? { h: h - drop, hard: false, water: false, surface: POOL_SURFACE - drop } : { h: h - drop, hard: false, water: false };
}
