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

const { heardAt, BOOM_T, Q_PEAK, dynamicPressureAt } = await import('../src/sim/reentrySound.js');
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
    const d = Math.hypot(s.s - s0 - cam.x, s.h - cam.y, cam.z);
    worst = Math.max(worst, Math.abs(h.tau + d / 343 - t));
  }
}
report(worst < 2e-3, 'el sonido llega cuando debe: τ + d(τ)/343 = t, cámaras a 50 m–3 km', `error máx. ${(worst * 1000).toFixed(2)} ms`);

// 2. A camera on the ship hears it at once; one 3.43 km away, ten seconds late (the ship nearly still).
const onShip = heardAt(RE.splash + 10, { x: 0, y: reentryState(RE.splash + 10).h, z: 0 });
const far = heardAt(RE.splash + 10, { x: 0, y: 0, z: 3430 });
report(Math.abs(onShip.tau - (RE.splash + 10)) < 1e-3 && Math.abs(far.tau - (RE.splash + 10 - 10)) < 0.05,
  'a bordo se oye a la vez; a 3,43 km, diez segundos después', `retrasos ${(RE.splash + 10 - onShip.tau).toFixed(3)} s y ${(RE.splash + 10 - far.tau).toFixed(2)} s`);

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
