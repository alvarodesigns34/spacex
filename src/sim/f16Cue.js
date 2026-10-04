/**
 * Where runway 28 is, for the F-16's HUD: the bearing and distance to its threshold from anywhere,
 * and on the final approach (within 10 NM, lined up within 30°, on the runway's side of it) the
 * deviations from a 3° glide path aimed 300 m past the threshold and from the centre line, as an
 * ILS would give them. Plain geometry with no Three.js, so the checks can run it.
 */
import { RUNWAY, toRunway, fromRunway } from '../core/terrain.js';

const R2D = 180 / Math.PI, FT = 0.3048, NM = 1852;
const L2 = RUNWAY.length / 2, AIM = 300, GS = 3 / R2D;
/** Runway 28's true heading (the scene's +X bears 100.8°; the F-16 lands towards −a). */
export const RW28 = { name: RUNWAY.idents[1], heading: (100.8 + RUNWAY.angleDeg + 180) % 360 };
const bearingOf = (dx, dz) => (100.8 + Math.atan2(dz, dx) * R2D + 360) % 360;
const wrap = (d) => ((d + 540) % 360) - 180;

/**
 * @param x, z     the airplane's position in the scene, m
 * @param agl      its height over the runway, m
 * @param heading  its heading, degrees
 * @returns { name, distNm, bearing, onFinal, gsDevFt (+ above the path), locDeg (+ right of the
 *   centre line, looking along the approach), alongNm (to the aim point) }
 */
export function runwayCue(x, z, agl, heading) {
  const [tx, tz] = fromRunway(L2, 0);
  const dx = tx - x, dz = tz - z;
  const out = { name: RW28.name, distNm: Math.hypot(dx, dz) / NM, bearing: bearingOf(dx, dz), onFinal: false, gsDevFt: 0, locDeg: 0, alongNm: 0 };
  const [a, c] = toRunway(x, z);
  const d = a - (L2 - AIM);                // ahead of the aim point, along the approach
  if (d > 0 && d < 10 * NM && Math.abs(Math.atan2(c, d)) < 30 / R2D && Math.abs(wrap(heading - RW28.heading)) < 30) {
    out.onFinal = true;
    out.alongNm = d / NM;
    out.gsDevFt = (agl - Math.tan(GS) * d) / FT;
    // Looking along the approach (towards −a), +c is on the left: the airplane right of the line is −c.
    out.locDeg = -Math.atan2(c, d) * R2D;
  }
  return out;
}
