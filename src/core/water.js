/**
 * Where there is water on the ground, and how deep: for the vehicles that drive and land on the
 * ground, which until 3 October 2026 drove over the pools and the sea as if they were dry land.
 *  - The sea: its surface 0.9 m below the site's ground (f16Ground.js SEA_LEVEL, the level the
 *    sea mesh is drawn at), its bed the shore's own slope down to 9 m (environment.js groundSample).
 *  - The wind-tidal pools: their surface 6 cm over the flat (campus.js), their beds carved down
 *    to 0.35 m in the middle (terrain.js poolDepth, ≈).
 *  - The marsh's tidal channels, which the terrain shader draws as winding water-filled cuts:
 *    the same function here (library.js, the terrain material's colour pass), ported, so that
 *    what reads as water is water. They are not carved into the ground mesh, which is too coarse
 *    for cuts a few metres across: a film over soft mud, ≈4 cm (≈).
 *
 * waterAt(x, z) gives { surface, bed, depth, kind } where there is water ('sea', 'pool',
 * 'channel'), else null.
 */
import { groundSample } from './environment.js';
import { marsh, poolDepth, POOL_SURFACE } from './terrain.js';
import { SEA_LEVEL } from './f16Ground.js';

export const CHANNEL_FILM = 0.04;

// The shader's value noise (library.js vcHash/vcNoise), step by step in single precision as
// the GPU runs it, so its isolines fall where the drawn channels do.
const f = Math.fround;
const fract = (x) => f(x - Math.floor(x));
function hash(px, py) {
  let x = fract(f(px * f(123.34))), y = fract(f(py * f(456.21)));
  const d = f(f(x * f(x + f(45.32))) + f(y * f(y + f(45.32))));
  x = f(x + d); y = f(y + d);
  return fract(f(x * y));
}
function vnoise(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py), fx = f(px - ix), fy = f(py - iy);
  const ux = f(fx * fx * (3 - 2 * fx)), uy = f(fy * fy * (3 - 2 * fy));
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/**
 * The tidal channels' water at a world point, 0..1, as the terrain shader draws it (its two
 * families of isolines of warped noise, tapered, inside the marsh's mask). The shader's
 * antialiasing against the pixel footprint has no counterpart here: this is the channel as
 * drawn close up.
 */
export function channelWater(x, z) {
  const m = marsh(x, z);
  if (m <= 0) return 0;
  const wx = x, wy = z;
  const cwx = vnoise(wx / 150 + 2.3, wy / 150 + 2.3) - 0.5, cwy = vnoise(wx / 150 - 5.1, wy / 150 - 5.1) - 0.5;
  const n1 = vnoise(wx / 620 + cwx * 1.5 + 17, wy / 240 + cwy * 1.5 + 17);
  const n2 = vnoise(wx / 180 + cwx * 2.2 - 8, wy / 80 + cwy * 2.2 - 8);
  const taper1 = smooth(0.3, 0.55, vnoise(wx / 380 + 3, wy / 380 + 3));
  const taper2 = smooth(0.5, 0.72, vnoise(wx / 190 - 21, wy / 190 - 21)) * smooth(0.3, 0.5, taper1 + vnoise(wx / 90, wy / 90));
  const w1 = 0.02 * taper1, w2 = 0.013 * taper2;
  const in1 = w1 > 0 && Math.abs(n1 - 0.5) < w1 ? 1 : 0, in2 = w2 > 0 && Math.abs(n2 - 0.5) < w2 ? 1 : 0;
  return Math.max(in1, in2) * m;
}

export function waterAt(x, z) {
  const g = groundSample(x, -z).h;
  if (g < SEA_LEVEL) return { surface: SEA_LEVEL, bed: g, depth: SEA_LEVEL - g, kind: 'sea' };
  const pd = poolDepth(x, z);
  if (pd > 0) return { surface: POOL_SURFACE, bed: g, depth: POOL_SURFACE - g, kind: 'pool' };
  if (channelWater(x, z) > 0.5) return { surface: g + CHANNEL_FILM, bed: g, depth: CHANNEL_FILM, kind: 'channel' };
  return null;
}
