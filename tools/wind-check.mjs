#!/usr/bin/env node
// The site's wind (src/core/wind.js), headless: the log-law profile and its 10 m value, where it
// blows from, the gusts' statistics against the surface layer's usual ratios, the frozen
// turbulence carried downwind at the mean speed; and what in the scene follows it — the runway's
// windsock pointing downwind and lifting with the speed, the pad's vapour drifting downwind.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const THREE = await import('three');
const { WIND, DOWNWIND, meanSpeed, windAt } = await import('../src/core/wind.js');
const { buildRunway } = await import('../src/core/runway.js');

let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const R2D = 180 / Math.PI;
const bearing = (x, z) => ((100.8 + Math.atan2(z, x) * R2D) % 360 + 360) % 360;

{
  const u10 = meanSpeed(10), u2 = meanSpeed(2), u100 = meanSpeed(100), u1k = meanSpeed(1000);
  const logLaw = Math.abs(u2 / u10 - Math.log(2 / WIND.z0) / Math.log(10 / WIND.z0)) < 1e-9;
  report(Math.abs(u10 - 6.2) < 1e-9 && logLaw && u100 > u10 && u1k === meanSpeed(WIND.top),
    'perfil del viento: 6,2 m/s a 10 m (NOAA, Brownsville), ley logarítmica sobre terreno abierto, constante sobre la capa superficial',
    `2 m ${u2.toFixed(2)} · 10 m ${u10.toFixed(2)} · 100 m ${u100.toFixed(2)} · 1000 m ${u1k.toFixed(2)} m/s`);
  const toward = bearing(DOWNWIND.x, DOWNWIND.z);
  report(Math.abs(toward - 337.5) < 1e-6, 'dirección: sopla del SSE (157,5°), hacia 337,5°', `hacia ${toward.toFixed(2)}°`);
}
{
  // An hour at a point 10 m up: the mean along the wind and the spread of each component.
  const w = { x: 0, y: 0, z: 0 };
  let n = 0, su = 0, suu = 0, sv = 0, svv = 0, sw = 0, sww = 0;
  for (let t = 0; t < 3600; t += 0.5) {
    windAt(120, 10, -340, t, w);
    const u = w.x * DOWNWIND.x + w.z * DOWNWIND.z, v = -w.x * DOWNWIND.z + w.z * DOWNWIND.x;
    n++; su += u; suu += u * u; sv += v; svv += v * v; sw += w.y; sww += w.y * w.y;
  }
  const mu = su / n, sdu = Math.sqrt(suu / n - mu * mu), sdv = Math.sqrt(svv / n - (sv / n) ** 2), sdw = Math.sqrt(sww / n - (sw / n) ** 2);
  report(Math.abs(mu / 6.2 - 1) < 0.05 && Math.abs(sdu / mu - 0.15) < 0.04 && Math.abs(sdv / sdu - 0.75) < 0.2 && Math.abs(sdw / sdu - 0.5) < 0.15,
    'ráfagas: media del viento y desviaciones de la capa superficial (σu ≈ 15 %, σv ≈ 0,75 σu, σw ≈ 0,5 σu)',
    `media ${mu.toFixed(2)} m/s · σu ${(sdu / mu * 100).toFixed(1)} % · σv/σu ${(sdv / sdu).toFixed(2)} · σw/σu ${(sdw / sdu).toFixed(2)}`);
  // Frozen turbulence: what blows at a point now blows 50 m downwind 50/U s later.
  const a = windAt(0, 10, 0, 100, {}), U = meanSpeed(10), dt = 50 / U, b = windAt(50 * DOWNWIND.x, 10, 50 * DOWNWIND.z, 100 + dt, {});
  report(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9, 'la turbulencia viaja con el viento: la ráfaga de un punto llega 50 m a sotavento 50/U s después', `diferencia ${Math.hypot(a.x - b.x, a.z - b.z).toExponential(1)} m/s`);
}
{
  // The windsock: built as the scene builds it (any material will do), turned to the wind by its
  // tick: its sock (the frame's −x) points downwind of the wind at its mast, within the lag, and
  // stands nearly straight out in the breeze.
  const M = new Proxy({}, { get: (o, k) => (o[k] ??= new THREE.MeshStandardMaterial({ name: String(k) })) });
  const scene = new THREE.Scene();
  scene.add(buildRunway(M));
  const sock = scene.getObjectByName('runway-windsock'), frame = scene.getObjectByName('runway-windsock-frame');
  for (let t = 0; t <= 30; t += 1 / 30) sock.userData.tick(t);
  scene.updateMatrixWorld(true);
  const tip = new THREE.Vector3(-1, 0, 0).transformDirection(frame.matrixWorld);
  const p = new THREE.Vector3(); sock.getWorldPosition(p);
  const w = windAt(p.x, 5, p.z, 30, {});
  const off = Math.abs(((bearing(tip.x, tip.z) - bearing(w.x, w.z)) + 540) % 360 - 180), droop = Math.asin(-tip.y) * R2D;
  report(off < 15 && droop > 0 && droop < 25, 'la manga de viento apunta a sotavento del viento del sitio y casi horizontal con la brisa',
    `apunta a ${bearing(tip.x, tip.z).toFixed(0)}° con el viento hacia ${bearing(w.x, w.z).toFixed(0)}° (${off.toFixed(1)}°) · ${droop.toFixed(1)}° bajo la horizontal con ${Math.hypot(w.x, w.z).toFixed(1)} m/s`);
}
{
  // The pad's vapour drifts downwind: a Vapor's drift, whatever the frame it hangs in. (Its puff
  // texture is drawn on a canvas: a stand-in that draws nothing, headless.)
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} })
    : k === 'getImageData' || k === 'createImageData' ? (...a) => ({ data: new Uint8ClampedArray((a.length > 2 ? a[2] * a[3] : a[0] * a[1]) * 4) }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
  const { Vapor } = await import('../src/sim/plume.js');
  const ok = [];
  for (const yaw of [0, 1.1, -2.3]) {
    const parent = new THREE.Group(); parent.rotation.y = yaw; parent.updateMatrixWorld(true);
    const v = new Vapor({ emitters: [{ at: [0, 0, 0], dir: [0, 1, 0], speed: 1, spread: 0.1, count: 4, life: 5, size: 1, grow: 1, window: [0, 10] }], rng: Math.random, accel: [0.7, -0.45, 0.3] });
    parent.add(v.mesh);
    v.update(1);
    const a = v.material.uniforms.uAccel.value.clone().transformDirection(parent.matrixWorld);
    ok.push(Math.abs(((bearing(a.x, a.z) - 337.5) + 540) % 360 - 180));
  }
  report(ok.every(d => d < 1), 'el vapor de la plataforma deriva a sotavento (antes, hacia el sureste, contra la brisa del mar)', ok.map(d => `${d.toFixed(2)}°`).join(' · '));
}

console.log(failed ? `\n${failed} fallo(s) en el viento` : '\nViento: todo correcto');
process.exit(failed ? 1 : 0);
