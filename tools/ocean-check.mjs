#!/usr/bin/env node
// The sea's swell (src/core/ocean.js), headless: the invariants of its waves, the inversion the
// physics uses to read the height under a point, and how far the drawn surface (the moving
// patch's mesh, with the waves its spacing cannot carry left out and linear between vertices)
// is from the surface the physics reads, by distance from the camera. Exit code 1 on a failure.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const O = await import('../src/core/ocean.js');
const { waterAt } = await import('../src/core/water.js');
const { f16Ground } = await import('../src/core/f16Ground.js');
const { fromCoast, shoreZ } = await import('../src/core/terrain.js');

let failed = 0;
const report = (ok, what, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const fmt = (v, d = 3) => v.toFixed(d).replace('.', ',');

// 1. The waves themselves.
report(O.HS > 0.7 && O.HS < 1.2, 'altura significativa del mar abierto ≈0,9 m (≈, elegida, no medida)', `Hs = ${fmt(O.HS, 2)} m`);
let envMax = 0;
for (let d = -50; d < 2000; d += 0.5) envMax = Math.max(envMax, O.envelope(d));
const fold = O.WAVES.reduce((s, w) => s + w.q * w.k * w.a, 0) * envMax;
report(fold < 1, 'ninguna ola se pliega sobre sí misma (Σ Q·k·a < 1, con el máximo de la costa)', `Σ = ${fmt(fold)}`);
report(O.WAVES.every(w => Math.abs(w.omega - Math.sqrt(O.G * w.k)) < 1e-12), 'dispersión de aguas profundas ω = √(g·k)',
  O.WAVES.map(w => `${w.lambda} m: ${fmt(2 * Math.PI / w.omega, 1)} s`).join(' · '));
report(O.WAVES.every(w => Math.abs(Math.hypot(w.dx, w.dz) - 1) < 1e-12), 'direcciones unitarias');

// 2. Near the shore: nothing at the swash, a continuous envelope.
report(O.envelope(2) === 0 && O.envelope(-30) === 0, 'sin oleaje en la orilla ni tierra adentro');
let jump = 0;
for (let d = -10; d < 1000; d += 0.05) jump = Math.max(jump, Math.abs(O.envelope(d + 0.05) - O.envelope(d)));
report(jump < 0.01, 'la envolvente costera es continua', `salto máximo en 5 cm: ${fmt(jump, 4)}`);
report(Math.abs(O.envelope(1500) - 1) < 1e-6, 'mar abierto a escala 1');

// The sampled shore against the exact one (the table both sides read).
let shoreErr = 0;
for (let u = -12000; u < 12000; u += 1.7) {
  const [x, z] = fromCoast(u, shoreZ(u) - O.WATERLINE);
  shoreErr = Math.max(shoreErr, Math.abs(O.offshore(x, z)));
}
report(shoreErr < 0.1, 'la costa muestreada coincide con la de terrain.js', `error máximo ${fmt(shoreErr)} m`);

// 3. The physics' inversion: the height under the point a wave carried there.
const pts = [];
for (let i = 0; i < 400; i++) {
  const u = -3000 + (i * 6007) % 6000, w = shoreZ(u) - O.WATERLINE - 5 - ((i * 7919) % 1500);
  pts.push(fromCoast(u, w));
}
let invErr = 0, convErr = 0;
const d = {};
for (const [i, [x0, z0]] of pts.entries()) {
  const t = 3.7 * i;
  O.displace(x0, z0, t, d);
  const h = O.oceanHeight(x0 + d.x, z0 + d.z, t);
  invErr = Math.max(invErr, Math.abs(h - d.y));
  convErr = Math.max(convErr, Math.abs(O.oceanHeight(x0, z0, t, 4) - O.oceanHeight(x0, z0, t, 12)));
}
report(invErr < 1e-3, 'la altura bajo un punto (inversión de Gerstner) cuadra con la superficie', `error máximo ${fmt(invErr * 1000, 3)} mm`);
report(convErr < 1e-3, 'cuatro iteraciones bastan (frente a doce)', `diferencia ${fmt(convErr * 1000, 3)} mm`);

// 4. Continuity in time, including over the phase reduction, and far into a session.
let maxRate = 0;
const vmax = O.WAVES.reduce((s, w) => s + w.a * w.omega, 0) * envMax;
for (const t0 of [0, 1000, 86400 * 3 + 0.123]) for (const [x, z] of pts.slice(0, 60)) {
  const r = Math.abs(O.oceanHeight(x, z, t0 + 1 / 60) - O.oceanHeight(x, z, t0)) * 60;
  maxRate = Math.max(maxRate, r);
}
report(maxRate <= vmax * 1.05, 'sin saltos en el tiempo, tampoco tras días de sesión', `velocidad vertical máx. ${fmt(maxRate, 2)} m/s ≤ ${fmt(vmax, 2)}`);
const ph = O.oceanPhases(1e7);
report([...ph].every(p => p >= 0 && p < 2 * Math.PI), 'fases reducidas a [0, 2π) en doble precisión');

// 5. What the vehicles read is the swell.
const [sx, sz] = fromCoast(0, shoreZ(0) - O.WATERLINE - 200);
O.OCEAN_CLOCK.value = 12.5;
const wa = waterAt(sx, sz), fg = f16Ground(sx, sz);
const expect = O.SEA_LEVEL + O.oceanHeight(sx, sz, 12.5);
report(wa?.kind === 'sea' && Math.abs(wa.surface - expect) < 1e-9, 'waterAt da la superficie con oleaje', `${fmt(wa?.surface ?? NaN)} m`);
report(fg.water && Math.abs(fg.h - expect) < 1e-9, 'el suelo del F-16 sobre el mar es la misma superficie');
O.OCEAN_CLOCK.value = 0;

// 6. Drawn against read. The patch's vertices at distance r are max(0.6, r·2π/256) apart (high
// tier) and drop the waves shorter than about 4–8 spacings; between vertices the GPU draws a
// straight line. Measured along lines through sea points, by distance from the camera.
const table = [];
// Where a vehicle is driven, ridden or flown (its camera a few to forty metres off) the two agree
// to a centimetre; farther out the bound is what the mesh leaves out: the amplitudes of the
// waves its spacing filters, plus that centimetre.
for (const r of [5, 20, 40, 100, 300]) {
  const sp = Math.max(0.6, r * 2 * Math.PI / 256);
  const tol = r <= 40 ? 0.01 : 0.01 + envMax * O.WAVES.reduce((s, w) => s + w.a * (1 - O.waveFilter(w.lambda, sp)), 0);
  let worst = 0;
  for (const [i, [x, z]] of pts.slice(0, 120).entries()) {
    const t = 1.3 * i;
    for (const [dx, dz] of [[1, 0], [0, 1], [0.7071, 0.7071]]) {
      // Two neighbouring vertices of the drawn mesh, and its straight line between them at the middle.
      const a = O.displace(x, z, t, {}, sp), b = O.displace(x + dx * sp, z + dz * sp, t, {}, sp);
      const mx = (x + a.x + x + dx * sp + b.x) / 2, mz = (z + a.z + z + dz * sp + b.z) / 2, my = (a.y + b.y) / 2;
      worst = Math.max(worst, Math.abs(my - O.oceanHeight(mx, mz, t)));
    }
  }
  table.push(`${r} m: ${fmt(worst * 100, 1)} cm`);
  report(worst < tol, `dibujo y física coinciden a ${r} m de la cámara`, `máx. ${fmt(worst * 100, 1)} cm (tolerancia ${fmt(tol * 100, 1)} cm)`);
}

console.log(`\nOleaje: Hs ${fmt(O.HS, 2)} m · ${O.WAVES.length} olas · dibujo frente a física: ${table.join(' · ')}`);
if (failed) { console.error(`${failed} comprobación(es) fallida(s)`); process.exit(1); }
