#!/usr/bin/env node
// The re-entry sound's physics, headless (sim/reentrySound.js): when a sound made by the ship
// reaches a camera (the emission time solves τ + d(τ)/c = t), the boom's emission time, and
// the dynamic pressure that sets the flow noise. The synthesis itself is by ear (≈) and is not
// tested here; what decides when and how loud something is heard is.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { heardAt, BOOM_T, Q_PEAK, dynamicPressureAt, TAU_MIN, travelTime, solveEmission } = await import('../src/sim/reentrySound.js');
const { RE, reentryState } = await import('../src/sim/reentryFlight.js');
const { soundSpeedAt } = await import('../src/sim/launch.js');

let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 1. The emission time: τ + d(τ)/c = t, for cameras near and far, through the landing burn.
let worst = 0;
for (const t of [RE.landingBurn - 30, RE.landingBurn + 2, RE.flip + 5, RE.splash - 1]) {
  for (const cam of [{ x: 30, y: 20, z: 40 }, { x: 1500, y: 2, z: -800 }, { x: -200, y: 3000, z: 0 }]) {
    const h = heardAt(t, cam);
    const s = reentryState(h.tau), s0 = reentryState(t).s;
    worst = Math.max(worst, Math.abs(h.tau + travelTime(s.s - s0, s.h, cam) - t));
  }
}
report(worst < 2e-3, 'el sonido llega cuando debe: τ + tiempo de viaje(τ) = t, con c(h) de la atmósfera estándar, cámaras a 50 m–3 km', `error máx. ${(worst * 1000).toFixed(2)} ms`);

// 1b. Hypersonic, supersonic and through Mach 1 (external audit 8-11, finding 02: the old
// fixed-point iteration returned τ ≈ −1,7 × 10¹⁷ s at entry + 300 s). Every answer is either a
// root with a residual under 0,1 ms inside [TAU_MIN, t], or "not heard yet", which must then be
// true: no emission on the span may already have arrived (checked by brute force, 0,05 s steps).
{
  const times = [RE.entry + 10, RE.entry + 300, RE.entry + 700, BOOM_T - 60, BOOM_T, RE.transonic, RE.subsonic, RE.landingBurn];
  const cams = [{ x: 0, y: 2, z: 1000 }, { x: 0, y: 2, z: 30000 }, { x: 80000, y: 2, z: 0 }, { x: -50000, y: 2, z: 5000 }, { x: 0, y: 9000, z: 200 }, { x: 300, y: 40000, z: 0 }];
  let bad = 0, roots = 0, silent = 0, worstR = 0, detail = '';
  for (const t of times) for (const cam of cams) {
    const h = heardAt(t, cam);
    const s0 = reentryState(t).s;
    const g = (tau) => { const s = reentryState(tau); return tau + travelTime(s.s - s0, s.h, cam) - t; };
    if (h.heard) {
      roots++;
      const r = Math.abs(g(h.tau));
      worstR = Math.max(worstR, r);
      // The latest root: nothing between it and t has arrived already.
      let later = false;
      for (let tau = h.tau + 0.05; tau <= t; tau += 0.05) if (g(tau) <= 0) { later = true; break; }
      if (!(Number.isFinite(h.tau) && h.tau >= TAU_MIN && h.tau <= t && r < 1e-4 && Number.isFinite(h.d)) || later) { bad++; detail ||= `t=${t} cam=${JSON.stringify(cam)} τ=${h.tau}`; }
    } else {
      silent++;
      let arrived = false;
      for (let tau = TAU_MIN; tau <= t; tau += 0.05) if (g(tau) <= 0) { arrived = true; break; }
      if (arrived || h.d !== Infinity) { bad++; detail ||= `t=${t} cam=${JSON.stringify(cam)}: dice que no se oye y sí llegó`; }
    }
  }
  report(bad === 0 && roots > 0 && silent > 0, 'retardo con la nave hipersónica, supersónica y en Mach 1: raíz más reciente o «aún no llega», nunca divergente',
    `${roots} raíces (residuo máx. ${(worstR * 1000).toFixed(3)} ms) · ${silent} casos sin llegar${detail ? ' · ' + detail : ''}`);
  // Negative control: the audit's case under the old iteration must be caught by the same test.
  const old = (t, cam) => { const s0 = reentryState(t).s; let tau = t; for (let k = 0; k < 12; k++) { const s = reentryState(tau); tau = t - Math.hypot(s.s - s0 - cam.x, s.h - cam.y, cam.z) / 343; } return tau; };   // the 8-11 code, as it was
  const o = old(RE.entry + 300, { x: 0, y: 2, z: 1000 });
  report(!(o >= TAU_MIN), 'control negativo: la iteración antigua diverge en el caso de la auditoría', `τ = ${o.toExponential(2)} s`);
}

// 2. A camera on the ship hears it at once; one 3.43 km away at sea level, after the travel time
// through 15 °C air (USSA sea level, c = 340.3 m/s): 10.08 s, not the 10.00 of a 343 m/s constant.
const onShip = heardAt(RE.splash + 10, { x: 0, y: reentryState(RE.splash + 10).h, z: 0 });
const far = heardAt(RE.splash + 10, { x: 0, y: 0, z: 3430 });
const expect = 3430 / soundSpeedAt(0);
report(Math.abs(onShip.tau - (RE.splash + 10)) < 1e-3 && Math.abs((RE.splash + 10 - far.tau) - expect) < 0.05,
  'a bordo se oye a la vez; a 3,43 km, tras el tiempo de viaje a 340,3 m/s', `retrasos ${(RE.splash + 10 - onShip.tau).toFixed(3)} s y ${(RE.splash + 10 - far.tau).toFixed(2)} s (esperado ${expect.toFixed(2)} s)`);

// 2b. The solver on trajectories with a closed form (audit of 9-11-2026, M14: the checks above use
// the module's own geometry). A source in straight, level flight at speed u, uniform sound speed c:
// c(t − τ) = |p(τ) − cam| is a quadratic in τ; the latest root ≤ t, or none (outside the Mach cone).
{
  const c = 340;
  let bad = 0, n = 0, silent = 0, detail = '';
  for (const u of [-680, -250, 120, 300, 680, 1000]) {
    for (const cam of [{ x: 0, y: 0, z: 400 }, { x: 3000, y: 0, z: 200 }, { x: -2500, y: 0, z: 1500 }, { x: 8000, y: 0, z: 100 }]) {
      const x0 = -2000, y0 = 3000, t = 20;
      const at = (tau) => ({ x: x0 + u * tau, y: y0 });
      const got = solveEmission(t, cam, at, { tMin: -200, vMax: Math.abs(u), cMin: c, travel: (x, y, k) => Math.hypot(x - k.x, y - k.y, k.z) / c });
      const dx = x0 - cam.x, D2 = (y0 - cam.y) ** 2 + cam.z ** 2;
      const A = c * c - u * u, B = -2 * c * c * t - 2 * u * dx, C = c * c * t * t - dx * dx - D2;
      const disc = B * B - 4 * A * C;
      const roots = disc < 0 ? [] : [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)].filter(r => r <= t + 1e-9 && r >= -200);
      const want = roots.length ? Math.max(...roots) : null;
      n++;
      if (want === null) { silent++; if (got.heard) { bad++; detail ||= `u=${u} cam=${JSON.stringify(cam)}: oye sin raíz`; } }
      else if (!got.heard || Math.abs(got.tau - want) > 2e-3) { bad++; detail ||= `u=${u} cam=${JSON.stringify(cam)}: τ ${got.tau} frente a ${want}`; }
    }
  }
  report(bad === 0 && silent > 0, 'resolutor frente a la solución cerrada de una fuente en vuelo recto (subsónica y supersónica, dentro y fuera del cono de Mach)', `${n} casos, ${silent} sin llegada${detail ? ' · ' + detail : ''}`);
}

// 3. The boom: made above Mach 1.2, before the cited transonic call, and the ship below Mach 1.2 after it.
const mach = (t) => { const s = reentryState(t); return Math.hypot(s.vx, s.vh) / soundSpeedAt(s.h); };
report(mach(BOOM_T) > 1.2 && mach(BOOM_T + 0.25) <= 1.2 && BOOM_T < RE.transonic,
  'estampido: último instante por encima de Mach 1,2, antes del transónico citado',
  `T+${(BOOM_T / 3600 | 0)}:${String((BOOM_T % 3600) / 60 | 0).padStart(2, '0')}:${(BOOM_T % 60).toFixed(1).padStart(4, '0')} · Mach ${mach(BOOM_T).toFixed(2)} a ${(reentryState(BOOM_T).h / 1000).toFixed(1)} km`);

// 4. Flow noise: next to nothing at the entry interface, its peak inside the glide, in Pa.
const qEntry = dynamicPressureAt(RE.entry);
report(qEntry < 0.01 * Q_PEAK.q && Q_PEAK.t > RE.entry && Q_PEAK.t < RE.landingBurn && Q_PEAK.q > 1e3 && Q_PEAK.q < 1e5,
  'el ruido del flujo sigue la presión dinámica: casi nula en la interfaz, con su máximo en el planeo',
  `interfaz ${qEntry.toFixed(1)} Pa · máx. ${(Q_PEAK.q / 1000).toFixed(1)} kPa a T+${(Q_PEAK.t / 3600 | 0)}:${String((Q_PEAK.t % 3600) / 60 | 0).padStart(2, '0')}:${String(Math.round(Q_PEAK.t % 60)).padStart(2, '0')} · ${(reentryState(Q_PEAK.t).h / 1000).toFixed(1)} km`);

if (failed) { console.error(`\n${failed} comprobación(es) del sonido de la reentrada fallan`); process.exit(1); }
console.log('\nSonido de la reentrada: todo correcto');
