/**
 * The wind over the site: one field for everything that moves through the air — the F-16, the
 * GT3 RS, the H2R, the windsock, the pad's vapour — so they all agree on where it blows.
 *
 * The mean wind: the coast's sea breeze, from the SSE (157.5°) at 6.2 m/s (13.9 mph, ≈12 kt) at
 * the standard 10 m. NOAA's engineering weather data for Brownsville (WMO 722500, 1973–1996)
 * give the warm season's mean coincident wind as 13.9–15.7 mph, prevailing SSE; a typical warm
 * afternoon is taken here, not a measurement of any one day (≈).
 *
 * With height, the log law over open, flat ground (roughness length z0 ≈ 3 cm: short grass and
 * flats, ≈): U(h) = U10 · ln(h / z0) / ln(10 / z0), up to the top of the surface layer (≈ 300 m),
 * constant above it (≈: the free atmosphere's winds are not modelled).
 *
 * Gusts: frozen turbulence carried along by the mean wind, so a gust that passes the windsock
 * reaches the runway a few seconds later. Each component is a sum of a few waves of incommensurate
 * wavelengths (≈ 40 to 400 m: the energetic eddies near the ground), with the standard deviations
 * of open terrain: σu ≈ 15 % of the mean along the wind, σv ≈ 0.75 σu across it, σw ≈ 0.5 σu
 * vertically (≈, the usual surface-layer ratios), fading with height above the surface layer.
 * Smooth and deterministic in (x, y, z, t): the checks see the same wind every run.
 *
 * Bearings are true; the scene's +X bears 100.8° and bearings grow clockwise, towards +Z.
 */
export const WIND = {
  fromDeg: 157.5, speed10: 6.2, z0: 0.03, top: 300, turb: 0.15,
  source: 'NOAA Engineering Weather Data, Brownsville TX (WMO 722500): warm-season mean coincident wind 13.9–15.7 mph, prevailing SSE',
};

const D2R = Math.PI / 180;
// The direction the air moves towards, in the scene: bearing β → (cos(β − 100.8°), sin(β − 100.8°)).
const TOWARDS = (WIND.fromDeg + 180) * D2R - 100.8 * D2R;
export const DOWNWIND = { x: Math.cos(TOWARDS), z: Math.sin(TOWARDS) };
const CROSS = { x: -DOWNWIND.z, z: DOWNWIND.x };
const LOG10 = Math.log(10 / WIND.z0);

/** The mean wind speed at height h over the ground, m/s. */
export function meanSpeed(h, speed10 = WIND.speed10) {
  const z = Math.min(Math.max(h, WIND.z0 * 3), WIND.top);
  return speed10 * Math.log(z / WIND.z0) / LOG10;
}

// The turbulence's waves: wavelength (m), direction of the wave front (rad), phase, share.
const WAVES = [[410, 0.3, 0.7, 0.42], [233, 1.9, 2.1, 0.33], [131, 4.0, 4.4, 0.27], [77, 2.7, 1.3, 0.2], [41, 5.3, 3.6, 0.13]];
const NORM = 1 / Math.sqrt(WAVES.reduce((a, w) => a + 0.5 * w[3] * w[3], 0));
function gust(x, z, t, U, seed) {
  // Frozen turbulence: the field moves downwind at the mean speed.
  const ax = x - DOWNWIND.x * U * t, az = z - DOWNWIND.z * U * t;
  let g = 0;
  for (const [L, dir, ph, a] of WAVES) {
    const k = 2 * Math.PI / L;
    g += a * Math.sin(k * (ax * Math.cos(dir + seed) + az * Math.sin(dir + seed)) + ph + 1.7 * seed);
  }
  return g * NORM;     // unit standard deviation
}

/**
 * The wind at a point (x, z in the scene, h metres over the ground) at time t (s): written into
 * `out` as { x, y, z } m/s, and returned. `scale` multiplies the whole field (0: still air).
 */
export function windAt(x, h, z, t, out = { x: 0, y: 0, z: 0 }, scale = 1) {
  const U = meanSpeed(h) * scale;
  const fade = h < WIND.top ? 1 : Math.max(0.2, WIND.top / h);
  const s = WIND.turb * U * fade;
  const u = U + s * gust(x, z, t, U, 0), v = 0.75 * s * gust(x, z, t, U, 1.3), w = 0.5 * s * gust(x, z, t, U, 2.9) * Math.min(1, h / 10);
  out.x = DOWNWIND.x * u + CROSS.x * v;
  out.z = DOWNWIND.z * u + CROSS.z * v;
  out.y = w;
  return out;
}
