/** The X-15 flight model (src/sim/x15Flight.js) against NASA's flight data. Node 22.15+; no browser.
 * Mutations deliberately restore defects and must be caught by these assertions.
 *
 * What is compared, and to what:
 *  - the atmosphere against the 1976 US Standard Atmosphere's own table;
 *  - the short-period oscillation (pitch damper off) against TN D-2532 table III, period ±25 %;
 *  - the Dutch roll (roll and yaw dampers off, lower rudder off) against TN D-2532 table V,
 *    period ±20 %;
 *  - the XLR99's burn at full throttle against SP-60 (18,000 lb in 85 s), ±3 %;
 *  - a speed profile against the basic airplane's Mach 6.04 (X-15-2, 9 Nov 1961) and an altitude
 *    profile against 354,200 ft (X-15-3, 22 Aug 1963), both from a launch at 45,000 ft and Mach
 *    0.8, with a simple attitude autopilot: plausibility bands, not a reconstruction;
 *  - the landing against TM X-207 (nose gear down 0.52 s after the skids) and the exhibit's
 *    attitude on its gear;
 *  - energy conserved in a vacuum coast, quaternion and body axes consistent, the reaction
 *    controls' angular acceleration equal to torque over inertia.
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mutant = process.argv.find(a => a.startsWith('--mutant='))?.split('=')[1];
registerHooks({
  load(url, context, next) {
    const result = next(url, context);
    if (!mutant) return result;
    let source = String(result.source).replace(/\r\n/g, '\n');
    if (url.endsWith('/src/sim/x15Flight.js')) {
      // The trim extrapolated the wrong way (found while building the model): every trim beyond
      // the printed settings ran to the stop.
      if (mutant === 'trim') source = source.replace('return a[0] + slope(a[0]) * (dh - T.dh[0]);', 'return a[0] - slope(a[0]) * (dh - T.dh[0]);');
      // No propellant burned: the engine never stops and the airplane never lightens.
      if (mutant === 'burn') source = source.replace('out.prop = -eng.flow;', 'out.prop = 0;');
      // The pitch damping derivative with its sign lost.
      if (mutant === 'damping') source = source.replace('lerp1(CM_Q.M, CM_Q.v, Mc) * q * hc', '-lerp1(CM_Q.M, CM_Q.v, Mc) * q * hc');
      // Gravity as a constant g along the initial vertical, the Earth flat.
      if (mutant === 'flat') source = source.replace('const grav = mul(s.r, -MU / (rn * rn * rn));', 'const grav = [-G0, 0, 0];');
    }
    if (url.endsWith('/src/data/x15Aero.js')) {
      // The wind-tunnel Cnβ line instead of the flight points between Mach 2 and 3.
      if (mutant === 'cnbeta') source = source.replace('0.0060, 0.0042, 0.0042, 0.0042, 0.0041', '0.0076, 0.0062, 0.0051, 0.0044, 0.0041');
    }
    return { ...result, source };
  },
});

const F = await import('../src/sim/x15Flight.js');
const FT = 0.3048, LB = 0.45359237, R2D = 180 / Math.PI;

// ---- Atmosphere --------------------------------------------------------------------------------
// The 1976 standard's table (geometric altitude, m: temperature K, pressure Pa, density kg/m³).
for (const [h, T, p, rho] of [[0, 288.15, 101325, 1.2250], [10000, 223.25, 26499.9, 0.41351], [20000, 216.65, 5529.3, 0.088910], [30000, 226.51, 1197.0, 0.018410], [50000, 270.65, 79.779, 0.0010269], [70000, 219.59, 5.2209, 8.2829e-5], [86000, 186.87, 0.37338, 6.958e-6], [100000, 195.08, 0.032011, 5.604e-7]]) {
  const a = F.atmosphere(h);
  assert.ok(Math.abs(a.T - T) / T < 0.002, `atmosphere T at ${h} m: ${a.T.toFixed(2)} K against ${T}`);
  assert.ok(Math.abs(a.p - p) / p < 0.003, `atmosphere p at ${h} m: ${a.p.toPrecision(5)} Pa against ${p}`);
  assert.ok(Math.abs(a.rho - rho) / rho < 0.003, `atmosphere ρ at ${h} m: ${a.rho.toPrecision(5)} against ${rho}`);
}
console.log('PASS 1976 US Standard Atmosphere, 0–100 km, within 0.3 %');

// ---- Frames ------------------------------------------------------------------------------------
{
  const s = F.makeState({ altitude: 13700, speed: 240, heading: 30, gamma: 5, alpha: 4, bank: 20 });
  const d = F.describe(s);
  assert.ok(Math.abs(d.alpha - 4) < 1e-6 && Math.abs(d.beta) < 1e-6 && Math.abs(d.gamma - 5) < 1e-6, `state angles: α ${d.alpha}, β ${d.beta}, γ ${d.gamma}`);
  const xb = F.rotate(s.q, [1, 0, 0]), yb = F.rotate(s.q, [0, 1, 0]), zb = F.rotate(s.q, [0, 0, 1]);
  const c = [xb[1] * yb[2] - xb[2] * yb[1], xb[2] * yb[0] - xb[0] * yb[2], xb[0] * yb[1] - xb[1] * yb[0]];
  assert.ok(Math.hypot(c[0] - zb[0], c[1] - zb[1], c[2] - zb[2]) < 1e-9, 'body axes right-handed');
  assert.ok(d.phi > 15 && d.phi < 25 && d.theta > 8 && d.theta < 9.5, `bank and pitch read back: φ ${d.phi.toFixed(2)}, θ ${d.theta.toFixed(2)}`);
}
console.log('PASS frames: state angles read back, body axes right-handed');

// ---- Ground track: the projection the scene's globe uses ----------------------------------------------
{
  let worst = 0;
  for (const [n, e] of [[0, 0], [1000, -2500], [-150000, 260000], [300000 * Math.cos(2.28), 300000 * Math.sin(2.28)], [-480000, -90000]]) {
    const u = F.fromGroundTrack(n, e), g = F.groundTrack(u.map(x => x * (F.R_EARTH + 12000)));
    worst = Math.max(worst, Math.hypot(g.north - n, g.east - e));
  }
  assert.ok(worst < 1e-3, `ground track round trip off by ${worst} m`);
  // Along a great circle leaving the origin on bearing B, the direction of travel carried back
  // to the origin is B itself: the airplane flies along the map's radial line, as it should.
  const B = 130.8 * Math.PI / 180, d = 300000;
  const p0 = F.fromGroundTrack(d * Math.cos(B), d * Math.sin(B)), p1 = F.fromGroundTrack((d + 1) * Math.cos(B), (d + 1) * Math.sin(B));
  const t = F.toOriginFrame([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], p0);
  const bearing = Math.atan2(t[1], t[2]) * R2D;
  assert.ok(Math.abs(bearing - 130.8) < 1e-6 && Math.abs(t[0]) < 1e-9, `carried direction ${bearing}°, up ${t[0]}`);
  console.log(`PASS ground track: azimuthal equidistant round trip within ${worst.toExponential(1)} m, radial direction carried back exactly`);
}

// ---- Short period ----------------------------------------------------------------------------------
function oscillation(series, dt) {
  const n = series.length, zc = [], pk = [];
  for (let i = 1; i < n; i++) if (series[i - 1] < 0 && series[i] >= 0) zc.push((i - 1 + series[i - 1] / (series[i - 1] - series[i])) * dt);
  for (let i = 1; i < n - 1; i++) if (series[i] > series[i - 1] && series[i] >= series[i + 1] && series[i] > 0) pk.push(series[i]);
  const period = zc.length > 1 ? (zc[zc.length - 1] - zc[0]) / (zc.length - 1) : NaN;
  const dec = pk.length > 1 ? Math.log(pk[0] / pk[1]) : NaN;
  return { period, zeta: dec / Math.sqrt(4 * Math.PI ** 2 + dec * dec) };
}
const detrend = (ys) => {
  const n = ys.length, mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  ys.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) ** 2; });
  return ys.map((y, i) => y - my - sxy / sxx * (i - mx));
};
const BURNOUT_LB = 15500;   // ≈ the airplane after the burn (CR-2144 table V-1: 15,560 lb)
function trimmedState(M, hft, alpha) {
  const h = hft * FT, atm = F.atmosphere(h);
  return { s: F.makeState({ altitude: h, speed: M * atm.a, alpha, propellant: BURNOUT_LB * LB - F.MASS.dry }), dh: F.trimStabilizer(M, alpha) };
}
// TN D-2532 table III, the cases with the pitch damper off: M, h (ft), α, period (s), ζ.
for (const [M, hft, alpha, P] of [[1.28, 60200, 7.7, 2.36], [4.00, 107050, 8.9, 4.66], [4.20, 102500, 3.3, 3.60], [4.36, 98450, 1.0, 3.00], [4.40, 97400, 2.2, 2.70], [4.49, 95100, 2.5, 2.90], [3.41, 61000, -2.7, 1.40]]) {
  let { s, dh } = trimmedState(M, hft, alpha);
  const dt = 1 / 200, qs = [];
  for (let i = 0; i < 200 * 12; i++) {
    s = F.step(s, { dh: dh + (i * dt < 0.25 ? -2 : 0), sas: false, gear: false }, dt);
    if (i * dt > 0.3) qs.push(s.w[1]);
  }
  const o = oscillation(detrend(qs), dt);
  assert.ok(dh > -35 && dh < 15, `trim at M ${M}, α ${alpha}: δh ${dh.toFixed(1)} on a stop`);
  assert.ok(Math.abs(o.period / P - 1) < 0.25, `short period at M ${M}, ${hft} ft, α ${alpha}: ${o.period.toFixed(2)} s against ${P} s (TN D-2532)`);
  assert.ok(o.zeta > 0.005 && o.zeta < 0.2, `short-period damping at M ${M}: ζ ${o.zeta.toFixed(3)}`);
  console.log(`PASS short period M ${M}, ${hft} ft, α ${alpha}°: ${o.period.toFixed(2)} s (flight ${P} s), ζ ${o.zeta.toFixed(3)}, δh ${dh.toFixed(1)}°`);
}

// ---- Dutch roll ------------------------------------------------------------------------------------
// TN D-2532 table V (lower rudder off), roll and yaw dampers off: M, h (ft), α, period (s).
for (const [M, hft, alpha, P] of [[0.82, 35000, 7.4, 2.50], [0.87, 36100, 6.6, 2.40], [1.06, 40600, 3.9, 2.25], [2.33, 72010, 4.8, 3.00], [2.34, 81475, 2.1, 4.20], [2.34, 78575, 3.7, 3.70]]) {
  let { s, dh } = trimmedState(M, hft, alpha);
  const dt = 1 / 200, rs = [];
  for (let i = 0; i < 200 * 14; i++) {
    s = F.step(s, { dh, dv: i * dt < 0.3 ? 3 : 0, sas: false, gear: false }, dt);
    if (i * dt > 0.5) rs.push(s.w[2]);
  }
  const o = oscillation(rs, dt);
  assert.ok(Math.abs(o.period / P - 1) < 0.2, `Dutch roll at M ${M}, ${hft} ft, α ${alpha}: ${o.period.toFixed(2)} s against ${P} s (TN D-2532)`);
  assert.ok(o.zeta > 0, `Dutch roll unstable at M ${M}`);
  console.log(`PASS Dutch roll M ${M}, ${hft} ft, α ${alpha}°: ${o.period.toFixed(2)} s (flight ${P} s), ζ ${o.zeta.toFixed(3)}`);
}

// ---- Powered flight ---------------------------------------------------------------------------------
function mission(thetaCmd) {
  const h0 = 45000 * FT, atm = F.atmosphere(h0);
  let s = F.makeState({ altitude: h0, speed: 0.8 * atm.a, alpha: 5, propellant: F.MASS.propellant });
  const dt = 1 / 100, m0 = F.MASS.dry + s.prop;
  let maxM = 0, maxH = 0, tBurn = null;
  for (let i = 0; i < 600 / dt; i++) {
    const d = F.describe(s);
    for (const v of [d.altitude, d.mach, d.alpha, d.theta, s.prop]) assert.ok(Number.isFinite(v), `mission θ ${thetaCmd}: not finite at T+${s.t.toFixed(1)}`);
    if (d.altitude < 15000 && s.t > 100) break;
    const dh = F.trimStabilizer(Math.max(0.6, d.mach), Math.max(-5, Math.min(25, d.alpha))) + 1.5 * (d.theta - thetaCmd) + 0.6 * d.q * R2D;
    const rcs = d.qbar < 500 ? [0, Math.max(-1, Math.min(1, -0.3 * (d.theta - thetaCmd) - 2 * d.q * R2D)), 0] : null;
    s = F.step(s, { dh, throttle: 1, sas: true, gear: false, rcs }, dt);
    if (tBurn === null && s.prop <= 0) tBurn = s.t;
    maxM = Math.max(maxM, d.mach);
    maxH = Math.max(maxH, d.altitude);
  }
  return { maxM, maxH: maxH / FT, tBurn, burned: (m0 - F.MASS.dry - s.prop) / LB };
}
{
  const speed = mission(15), alt = mission(48);
  assert.ok(speed.tBurn !== null && Math.abs(speed.tBurn / 85 - 1) < 0.03, `XLR99 burn ${speed.tBurn} s against SP-60's 85 s`);
  assert.ok(Math.abs(speed.burned - 18000) < 1, `propellant burned ${speed.burned.toFixed(0)} lb against 18,000`);
  assert.ok(speed.maxM > 5.4 && speed.maxM < 6.5, `speed profile: Mach ${speed.maxM.toFixed(2)} (record of the basic airplane 6.04)`);
  assert.ok(alt.maxH > 300000 && alt.maxH < 380000, `altitude profile: ${alt.maxH.toFixed(0)} ft (record 354,200 ft)`);
  console.log(`PASS XLR99: burn ${speed.tBurn.toFixed(1)} s (SP-60 85 s), 18,000 lb; speed profile Mach ${speed.maxM.toFixed(2)} (record 6.04); altitude profile ${(alt.maxH / 1000).toFixed(0)},000 ft (record 354,200)`);
}

// ---- Coast in a vacuum: energy --------------------------------------------------------------------
{
  let s = F.makeState({ altitude: 160000, speed: 1500, gamma: 20, alpha: 0, propellant: 0, rates: [0.2, 0.05, -0.1] });
  const e0 = F.specificEnergy(s);
  for (let i = 0; i < 60 * 50; i++) s = F.step(s, { gear: false, sas: false }, 1 / 50);
  const e1 = F.specificEnergy(s), d = F.describe(s);
  assert.ok(Math.abs(e1 - e0) / Math.abs(e0) < 1e-7, `vacuum coast energy drift ${((e1 - e0) / e0).toExponential(2)}`);
  assert.ok(d.altitude > 160000 + 1000, `vacuum coast: climbing at 20° gains height (${d.altitude.toFixed(0)} m)`);
  console.log(`PASS vacuum coast: energy conserved to ${Math.abs((e1 - e0) / e0).toExponential(1)} over 60 s`);
}

// ---- Reaction controls ----------------------------------------------------------------------------
{
  const s = F.makeState({ altitude: 170000, speed: 1500, propellant: 0 });
  const dt = 1e-3;
  const s1 = F.step(s, { rcs: [0, 1, 0], gear: false, sas: false }, dt);
  const I = F.inertiaAt(F.MASS.dry);
  const arm = F.CG_STATION - (0.9 + 0.2), torque = 2 * 113 * 4.4482216152605 * arm;
  const qdot = s1.w[1] / dt;
  assert.ok(Math.abs(qdot / (torque / I.Iy) - 1) < 1e-3, `RCS pitch: q̇ ${qdot.toExponential(3)} against ${(torque / I.Iy).toExponential(3)}`);
  console.log(`PASS reaction controls: pitch ${(qdot * R2D).toFixed(2)}°/s² from two 113 lbf nose thrusters`);
}

// ---- Landing ---------------------------------------------------------------------------------------
{
  let s = F.makeState({ altitude: 3.6, speed: 95, gamma: -0.6, alpha: 9, propellant: 0 });
  const dt = 1 / 400, gm = F.GEAR_MODEL.points;
  let tMain = null, tNose = null, n0 = 0;
  const heights = () => gm.map(g => { const p = F.rotate(s.q, g.p); return Math.hypot(s.r[0] + p[0], s.r[1] + p[1], s.r[2] + p[2]) - F.R_EARTH; });
  for (let i = 0; i < 400 * 120; i++) {
    const d = F.describe(s);
    assert.ok(Number.isFinite(d.altitude) && Number.isFinite(d.theta), `landing not finite at T+${s.t.toFixed(2)}`);
    const dh = tMain === null ? F.trimStabilizer(Math.max(0.6, d.mach), d.alpha) + 1.5 * (d.theta - 8.4) + 0.5 * d.q * R2D : 0;
    s = F.step(s, { dh, flaps: 32, gear: true, sas: true }, dt);
    const h = heights();
    if (tMain === null && Math.min(h[1], h[2]) <= 0) { tMain = s.t; n0 = d.north; assert.ok(h[0] > 0, 'skids touch before the nose'); }
    if (tNose === null && h[0] <= 0) tNose = s.t;
    if (tNose !== null && d.V < 0.05) break;
  }
  const d = F.describe(s), rest = -F.GEAR_MODEL.pitch * R2D;
  assert.ok(tMain !== null && tNose !== null, 'the airplane lands');
  assert.ok(tNose - tMain > 0.3 && tNose - tMain < 1.2, `nose gear down ${(tNose - tMain).toFixed(2)} s after the skids (TM X-207: 0.52 s)`);
  assert.ok(d.V < 0.05, `the slide stops (${d.V.toFixed(2)} m/s)`);
  assert.ok(Math.abs(d.theta - rest) < 0.1, `at rest ${d.theta.toFixed(2)}° against the exhibit's ${rest.toFixed(2)}°`);
  assert.ok(Math.abs(d.phi) < 0.5 && d.altitude > 1 && d.altitude < 1.5, `at rest level on the ground (φ ${d.phi.toFixed(2)}°, CG ${d.altitude.toFixed(2)} m up)`);
  console.log(`PASS landing: skids first, nose ${(tNose - tMain).toFixed(2)} s later (TM X-207 0.52 s), slide ${(d.north - n0).toFixed(0)} m, at rest ${d.theta.toFixed(2)}° (exhibit ${rest.toFixed(2)}°)`);
}

if (!mutant) {
  for (const name of ['trim', 'burn', 'damping', 'flat', 'cnbeta']) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--mutant=${name}`], { encoding: 'utf8' });
    assert.notEqual(run.status, 0, `the X-15 checks must reject sabotage: ${name}`);
    assert.match(run.stderr, /AssertionError/, `sabotage ${name} must fail an assertion, not crash`);
    console.log(`PASS sabotage rejected: ${name}`);
  }
}
