#!/usr/bin/env node
// A lap of the Porsche's circuit (core/circuitPlan.js, 2.5 km), driven headless on the vehicle
// model by a scripted driver, PSM on, as a regression guard for the car's handling as a whole:
// the lap time and the g-g-V envelope (the peak lateral g at 60/100/150 km/h: the lap has no corner
// taken at 200 or more) must stay
// within ±1 % of the reference below, and the car must stay on the asphalt or the kerbs.
//
// The driver: pure pursuit on the centre line (a look-ahead of ≈0.6 s, 8–40 m) for the steering;
// for the pedals, a speed profile from the corners' curvature — the speed each radius allows at
// ≈0.85 of the grip with the downforce (the car holds ≈1.3 g steady at 60–100 km/h) — and a backward pass at the braking the car makes, so it
// brakes in time; a proportional throttle and brake on the error. Not a racing line and not a
// racing driver: the car's best lap is quicker. The number is the model's, on this driver; it
// changes when the model does, and the guard says so.
//
// The Nordschleife's 6:49.328 (Porsche, 20.832 km) cannot be checked: there is no licensed
// centre line and elevation profile of it here.
//
// Run: node tools/gt3rs-lap.mjs           (prints the lap and the envelope, exits 1 on a drift)
//      node tools/gt3rs-lap.mjs --update  (prints the new reference to paste in REF)
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { createGt3Car, CAR } = await import('../src/sim/gt3Car.js');
const { AERO, TYRES } = await import('../src/data/gt3rs.js');
const { circuitSurface } = await import('../src/core/circuit.js');
const { toWorld, toLocal, trackCoords, CENTRE, LAP, START } = await import('../src/core/circuitPlan.js');

// The reference, from this tool on the model as committed (s, g).
const REF = { lap: 86.421, envelope: [1.358, 1.457, 0.637] };

const G = 9.80665;
// The ground as the drive gives it (main.js gt3Ground), on the circuit; off it, grass.
const GRIP = { track: 1, pad: 1, verge: 0.97, kerb: 0.9, gravel: 0.45 };
const ground = (x, z) => {
  const c = circuitSurface(x, z);
  if (c) return { h: c.y, mu: GRIP[c.kind] ?? 1, roll: c.kind === 'gravel' ? 0.22 : 0, kind: c.kind };
  return { h: 0, mu: 0.55, roll: 0.06, kind: 'grass' };
};

// The centre line by station: position (local u, v) and curvature, interpolated.
const N = CENTRE.length;
const wrapS = (s) => ((s % LAP) + LAP) % LAP;
function at(s) {
  s = wrapS(s);
  let lo = 0, hi = N - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CENTRE[m].s <= s) lo = m; else hi = m; }
  const a = CENTRE[lo], b = CENTRE[(lo + 1) % N], L = (lo + 1 < N ? b.s : LAP) - a.s;
  const t = L > 0 ? Math.min(1, Math.max(0, (s - a.s) / L)) : 0;
  return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, k: a.k };
}
// The speed profile: every 2 m, what the radius allows, then the braking back from each corner.
const STEP = 2, M = Math.ceil(LAP / STEP);
const vMax = new Float64Array(M);
for (let j = 0; j < M; j++) {
  // The curvature over ±6 m (an arc's ends are exact, the straights 0).
  let k = 0;
  for (let d = -6; d <= 6; d += 2) k = Math.max(k, Math.abs(at(j * STEP + d).k));
  let v = 90;
  for (let it = 0; it < 30 && k > 1e-6; it++) {
    const down = 0.5 * AERO.rho * AERO.clA * v * v;
    const ay = 0.85 * TYRES.mu * G * (1 + TYRES.downGain * down / (CAR.m * G));
    v = Math.min(90, Math.sqrt(ay / k));
  }
  vMax[j] = v;
}
for (let pass = 0; pass < 2; pass++) {
  for (let j = M - 1; j >= 0; j--) {
    const n = vMax[(j + 1) % M], down = 0.5 * AERO.rho * AERO.clA * n * n;
    const ax = 0.9 * TYRES.mu * G * (1 + 0.6 * down / (CAR.m * G)) * 0.85;
    vMax[j] = Math.min(vMax[j], Math.sqrt(n * n + 2 * ax * STEP));
  }
}
const target = (s) => vMax[Math.floor(wrapS(s) / STEP) % M];

// The car on the grid at the start line, facing the racing direction.
const car = createGt3Car({ ground });
const s = car.state, i = car.input;
{
  const p = at(START.u - 20), q = at(START.u - 18);
  const [x, z] = toWorld(p.u, p.v), [x2, z2] = toWorld(q.u, q.v);
  car.reset({ x, z, psi: Math.atan2(-(z2 - z), x2 - x) });
}
const H = 1 / 240;
let lastRel = null, laps = 0, lapStart = null, lapTime = null, off = 0, offWorst = 0;
const bins = [60, 100, 150], env = bins.map(() => 0);
for (let t = 0; t < 400 && lapTime === null; t += H) {
  const [u, v] = toLocal(s.x, s.z);
  const tc = trackCoords(u, v);
  const st = tc ? tc.s : 0;
  // Pure pursuit: the point on the centre line a look-ahead on, in the car's frame.
  const V = Math.hypot(s.u, s.v);
  const ld = Math.min(40, Math.max(8, 0.6 * V));
  const p = at(st + ld), [px, pz] = toWorld(p.u, p.v);
  const dx = px - s.x, dz = pz - s.z, c = Math.cos(s.psi), sn = Math.sin(s.psi);
  const fx = dx * c - dz * sn, fy = -dx * sn - dz * c;              // forward, left
  const alpha = Math.atan2(fy, fx), dist = Math.hypot(fx, fy);
  const delta = Math.atan(2 * CAR.L * Math.sin(alpha) / Math.max(1, dist));
  i.steer = Math.max(-1, Math.min(1, delta / CAR.maxSteer));
  // The pedals on the speed profile, looking ≈0.3 s ahead.
  const vT = Math.min(target(st + V * 0.3), target(st));
  const e = vT - V;
  i.throttle = e > 0 ? Math.min(1, 0.4 + e * 0.5) : Math.max(0, 0.4 + e * 0.5);
  i.brake = e < -1 ? Math.min(1, -e * 0.25) : 0;
  car.step(H);
  // Off the circuit's hard surfaces?
  const kinds = s.surface;
  if (kinds.some(k => k !== 'track' && k !== 'kerb')) { off += H; offWorst = Math.max(offWorst, tc?.dist ?? 99); }
  // The envelope: the peak lateral g in ±10 km/h of each speed.
  const kmh = V * 3.6;
  bins.forEach((b, k) => { if (Math.abs(kmh - b) < 10) env[k] = Math.max(env[k], Math.abs(s.ay) / G); });
  // The line, crossed in the racing direction.
  const rel = wrapS(st - START.u);
  if (lastRel !== null && lastRel > LAP - 60 && rel < 60) {
    laps++;
    if (laps === 1) lapStart = s.t; else if (laps === 2) lapTime = s.t - lapStart;
  }
  lastRel = rel;
}

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;
const round = (x) => Math.round(x * 1000) / 1000;
const out = { lap: lapTime === null ? null : round(lapTime), envelope: env.map(round) };
console.log(`Vuelta al circuito (${LAP.toFixed(1)} m), PSM puesto, conductor automático: ${lapTime === null ? 'no completada' : fmt(lapTime)} · media ${lapTime ? (LAP / lapTime * 3.6).toFixed(1) : '—'} km/h`);
console.log(`Aceleración lateral máxima: ${bins.map((b, k) => `${b} km/h ${env[k].toFixed(2)} g`).join(' · ')}`);
console.log(`Fuera del asfalto y los pianos: ${off.toFixed(2)} s (a ${offWorst.toFixed(1)} m del eje como mucho)`);
if (process.argv.includes('--update')) { console.log(`REF = ${JSON.stringify(out)}`); process.exit(0); }
let failed = 0;
const report = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`); if (!ok) failed++; };
report(lapTime !== null && off < 0.5, 'la vuelta se completa sin salirse (menos de 0,5 s con alguna rueda fuera del asfalto y los pianos)', `${off.toFixed(2)} s fuera`);
if (REF.lap !== null) {
  report(Math.abs(out.lap - REF.lap) / REF.lap < 0.01, `tiempo de vuelta a ±1 % de la referencia (${fmt(REF.lap)})`, fmt(out.lap ?? 0));
  report(REF.envelope.every((r, k) => r === 0 ? out.envelope[k] === 0 : Math.abs(out.envelope[k] - r) / r < 0.01),
    'envolvente g-g-V a ±1 % de la referencia', `${out.envelope.join(' / ')} frente a ${REF.envelope.join(' / ')} g`);
}
process.exit(failed ? 1 : 0);
