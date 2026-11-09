#!/usr/bin/env node
// The sky's cumulus (src/core/clouds.js), headless (audit of 9-11-2026, M13: until then no check
// touched them; tools/launch-regressions-check.mjs, once cloud-check.mjs, is the launch's).
//  1. The march's step schedule, read from the shader source and replayed in JS on the real cover:
//     inside cloud the steps stay 18–70 m, and the tier's iteration cap covers the 99th percentile
//     of rays from the ground, inside the layer and from above. A cap that runs out leaves the far
//     part of a ray unmarched: the specks the audit saw near the horizon.
//  2. Contracts the 9-11 fixes rely on: the 40 km cut is faded (M5), the cloud shadow ramps in as
//     the Sun rises (M6), the offset is low-discrepancy (no white noise), with negative controls.
// Exit code 1 on a failure.
import { readFileSync } from 'node:fs';

let failed = 0;
const report = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`); };
const src = readFileSync(new URL('../src/core/clouds.js', import.meta.url), 'utf8');
const q = readFileSync(new URL('../src/core/quality.js', import.meta.url), 'utf8');

const num = (re, what) => { const m = src.match(re); if (!m) { report(false, `se encuentra en clouds.js: ${what}`); return NaN; } return Number(m[1]); };
const BASE = num(/const BASE = (\d+)/, 'BASE'), TOP = num(/const TOP = (\d+)/, 'TOP');
const fine = src.match(/float dtF = clamp\(t \* ([\d.]+), ([\d.]+), ([\d.]+)\);/);
const coarseK = num(/float dtC = dtF \* ([\d.]+);/, 'dtC');
const cap = Number(q.match(/cloudSteps: (\d+),/)[1]);
report(!!fine && Number(fine[2]) >= 10 && Number(fine[3]) <= 70, 'dentro de la nube los pasos van de 18 a 70 m', fine ? `${fine[2]}–${fine[3]} m (${fine[1]} × distancia)` : 'no encontrado');
const [, K, MIN, MAX] = (fine ?? [0, 0, 0, 0]).map(Number);
const dtF = (t) => Math.min(MAX, Math.max(MIN, t * K));

// Replays the march on the real cover — the shader's hash, value noise and fbm, in JS — along 4 500
// rays from the ground, inside the layer and from above (seeded), counting iterations. Conservative:
// no early exit when the ray turns opaque, and anything under a cloud's top counts as cloud.
const fract = (x) => x - Math.floor(x);
const hh = (x, y) => { let px = fract(Math.fround(x * 233.34)), py = fract(Math.fround(y * 851.73)); const d = px * (px + 23.45) + py * (py + 23.45); px += d; py += d; return fract(px * py); };
const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hh(ix, iy), b = hh(ix + 1, iy), c = hh(ix, iy + 1), d = hh(ix + 1, iy + 1); return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy; };
const fbm = (x, y, oct) => { let s = 0, a = 0.5; for (let i = 0; i < oct; i++) { s += a * vn(x, y); const nx = 0.8 * x + 0.6 * y, ny = -0.6 * x + 0.8 * y; x = nx * 2.03 + 11.7; y = ny * 2.03 + 11.7; a *= 0.5; } return s; };
const coverAt = (x, z, oct) => fbm(x / 2600, z / 2600, oct) * 0.72 + fbm(x / 640 + 3.1, z / 640 + 3.1, oct) * 0.38;
const COVER = num(/uCover: \{ value: ([\d.]+) \}/, 'uCover');
const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const topAt = (c) => 0.18 + 0.82 * Math.sqrt(sm(0, 0.9, sm(COVER, COVER + 0.34, c)));
function march(o, d) {
  let t0, t1;
  if (o.y < BASE) { if (d.y <= 0.004) return 0; t0 = (BASE - o.y) / d.y; t1 = (TOP - o.y) / d.y; }
  else if (o.y > TOP) { if (d.y >= -0.004) return 0; t0 = (TOP - o.y) / d.y; t1 = (BASE - o.y) / d.y; }
  else { t0 = 0; t1 = d.y > 0.004 ? (TOP - o.y) / d.y : d.y < -0.004 ? (BASE - o.y) / d.y : 40000; }
  if (t0 > 40000) return 0;
  t1 = Math.min(t1, t0 + 16000);
  let t = t0 + 0.5 * MIN * coarseK, fineLeft = 0, it = 0;
  while (t <= t1) {
    it++;
    const dF = dtF(t), dC = dF * coarseK, px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t, hf = (py - BASE) / (TOP - BASE);
    if (fineLeft === 0) {
      const cc = coverAt(px, pz, 3);
      if (cc > COVER - 0.05 && hf < topAt(cc + 0.05) + 0.06) { fineLeft = 8; t = Math.max(t0, t - dC) + 0.5 * dF; continue; }
      t += dC; continue;
    }
    const c = coverAt(px, pz, 5);
    if (c > COVER && hf < topAt(c)) fineLeft = 8; else fineLeft = c < COVER - 0.05 || hf > topAt(c + 0.05) + 0.06 ? 0 : fineLeft - 1;
    t += dF;
  }
  return it;
}
const runs = [];
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const oy of [2, 1900, 3300]) for (let k = 0; k < 1500; k++) {
  const az = rnd() * Math.PI * 2, el = (oy < BASE ? 0.3 + rnd() * 30 : oy > TOP ? -(0.3 + rnd() * 30) : (rnd() - 0.5) * 60) * Math.PI / 180;
  runs.push(march({ x: (rnd() - 0.5) * 20000, y: oy, z: (rnd() - 0.5) * 20000 }, { x: Math.cos(el) * Math.cos(az), y: Math.sin(el), z: Math.cos(el) * Math.sin(az) }));
}
runs.sort((a, b) => a - b);
const pct = (p) => runs[Math.floor(p * (runs.length - 1))];
report(pct(0.99) <= cap, `el tope de iteraciones de la calidad alta (${cap}) cubre el percentil 99 de 4 500 rayos sobre la cobertura real`, `p50 ${pct(0.5)} · p90 ${pct(0.9)} · p99 ${pct(0.99)} · máx. ${runs[runs.length - 1]} · ${(runs.filter(x => x > cap).length / runs.length * 100).toFixed(1)} % por encima`);
// Control: the 256 of the first version would leave over a tenth of the rays cut short.
report(runs.filter(x => x > 256).length / runs.length > 0.1, 'control negativo: con el tope de 256 más de un 10 % de los rayos quedaría corto', `${(runs.filter(x => x > 256).length / runs.length * 100).toFixed(1)} %`);
report(coarseK >= 2 && coarseK <= 8, 'el paso largo del aire vacío es un múltiplo moderado del corto', `×${coarseK}`);

report(/1\.0 - smoothstep\(25000\.0, 40000\.0, t0\)/.test(src), 'el corte de 40 km se funde en los últimos 15 km (M5)');
report(/smoothstep\(0\.02, 0\.08, uCsSun\.y\)/.test(src) && !/uCsSun\.y > 0\.05\)/.test(src), 'la sombra de las nubes entra con rampa al subir el sol, sin salto a 2,9° (M6)');
report(/52\.9829189/.test(src) && !/h\(gl_FragCoord\.xy \* 0\.37/.test(src), 'el desfase por píxel es de baja discrepancia (gradiente entrelazado), no ruido blanco');
// Negative controls on the contracts: the old source must fail them.
const old = 'if (uCsFade > 0.01 && uCsSun.y > 0.05) { float dt = (t1 - t0) / float(uSteps); float t = t0 + dt * h(gl_FragCoord.xy * 0.37 + 0.13);';
report(/uCsSun\.y > 0\.05\)/.test(old) && /h\(gl_FragCoord\.xy \* 0\.37/.test(old), 'control negativo: el código del 8-11 por la mañana no pasaría los contratos');

if (failed) { console.error(`\n${failed} comprobación(es) de las nubes del cielo fallan`); process.exit(1); }
console.log('\nNubes del cielo: todo correcto');
