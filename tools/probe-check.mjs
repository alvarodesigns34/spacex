#!/usr/bin/env node
// The reflection probe's ground (environment.js probeGround), headless: what each direction under
// the horizon reflects. The Gulf must lie east of the site, the land west of it, the site's grey
// close in, and every colour must be a finite, plausible radiance. Exit code 1 on a failure.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

const { probeGround, PROBE_H, PROBE_C } = await import('../src/core/environment.js');
const { offshore } = await import('../src/core/ocean.js');
const { SHORE_NORMAL_AZ } = await import('../src/core/terrain.js');

let failed = 0;
const report = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`); };
const g = probeGround(), pos = g.geometry.attributes.position, col = g.geometry.attributes.color;
const k = PROBE_H / 0.4;

let finite = true, maxC = 0;
for (let i = 0; i < col.count * 3; i++) { const c = col.array[i]; if (!Number.isFinite(c) || c < 0) finite = false; maxC = Math.max(maxC, c); }
report(finite && maxC < 1.2, 'colores finitos y de radiancia plausible', `máximo ${maxC.toFixed(2)}`);

// The vertex nearest a bearing (true °) and a real distance, and what lies there.
const at = (bearing, D) => {
  const th = (bearing - 100.8) * Math.PI / 180, dx = Math.cos(th), dz = Math.sin(th);
  let best = -1, bd = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * k, z = pos.getZ(i) * k, d = Math.hypot(x - dx * D, z - dz * D);
    if (d < bd) { bd = d; best = i; }
  }
  return { c: [col.getX(best), col.getY(best), col.getZ(best)], wx: PROBE_C[0] + pos.getX(best) * k, wz: PROBE_C[1] + pos.getZ(best) * k };
};
const blueish = (c) => c[2] > c[0];
const sea = at(SHORE_NORMAL_AZ, 1500), land = at(SHORE_NORMAL_AZ + 180, 1500), site = at(0, 40);
report(offshore(sea.wx, sea.wz) > 0 && blueish(sea.c), 'hacia el mar (≈85°, 1,5 km) refleja el Golfo', sea.c.map(v => v.toFixed(2)).join(' '));
report(offshore(land.wx, land.wz) < 0 && !blueish(land.c), 'tierra adentro (≈265°) refleja tierra', land.c.map(v => v.toFixed(2)).join(' '));
report(Math.abs(site.c[0] - site.c[2]) < 1e-6 && Math.abs(site.c[0] - 0.30) < 0.01, 'junto a la fila, el gris del recinto (el del disco anterior)', site.c[0].toFixed(3));
if (failed) { console.error(`${failed} comprobación(es) fallida(s)`); process.exit(1); }
