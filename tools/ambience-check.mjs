#!/usr/bin/env node
// The ambient sound's levels (src/sim/ambience.js), headless: the surf loud at the waterline and
// falling away inland and out at sea, swelling and easing with each crest of the swell (never
// silent between them), the wind quiet in a calm and rising with speed. Exit code 1 on a failure.
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });
const { surfLevel, windLevel } = await import('../src/sim/ambience.js');

let failed = 0;
const report = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`); };
const peak = (d) => Math.max(...Array.from({ length: 64 }, (_, i) => surfLevel(d, i / 64 * 2 * Math.PI)));
const low = (d) => Math.min(...Array.from({ length: 64 }, (_, i) => surfLevel(d, i / 64 * 2 * Math.PI)));
report(peak(0) > 0.95 && peak(10) > 0.95, 'the surf is loudest at the waterline', `${peak(0).toFixed(2)}`);
report(peak(-300) < 0.12 && peak(-300) > peak(-1000), 'and falls away inland (at the exhibits, ≈300 m, a distant roar)', `300 m ${peak(-300).toFixed(3)} · 1 km ${peak(-1000).toFixed(3)}`);
report(low(0) > 0.4 && low(0) < 0.6 * peak(0), 'each crest swells it; between them it eases, never silent', `${low(0).toFixed(2)} – ${peak(0).toFixed(2)}`);
let mono = true; for (let v = 0; v < 40; v += 0.5) if (windLevel(v + 0.5).level < windLevel(v).level || windLevel(v + 0.5).freq < windLevel(v).freq) mono = false;
report(mono, 'wind louder and brighter with speed');
report(windLevel(0).level === 0 && windLevel(6.2).level < 0.15 && windLevel(30).level === 1, 'calm is silent, the site\'s 6 m/s a rustle, a gale saturates', `6,2 m/s → ${windLevel(6.2).level.toFixed(3)}`);
// The launch complex's reflections (audioBus.js): echoes then a short tail, mixed in by distance.
const { impulseResponse, spaceMix } = await import('../src/sim/audioBus.js');
const SR = 48000, [L] = impulseResponse(SR);
const energy = (a, b) => { let e = 0; for (let i = Math.floor(a * SR); i < Math.min(L.length, Math.floor(b * SR)); i++) e += L[i] * L[i]; return e; };
const early = energy(0, 0.1), late = energy(0.8, 1.0);
report(10 * Math.log10(late / early) < -25, 'the tail dies away (energy at 0,8–1,0 s ≥ 25 dB under the first 0,1 s)', `${(10 * Math.log10(late / early)).toFixed(1)} dB`);
report(Math.abs(L[Math.round(0.09 * SR)]) > 0.3, 'the first echo (the tower, ≈90 ms) stands out of the tail');
let monoD = true; for (let d = 0; d < 800; d += 5) if (spaceMix(d + 5) > spaceMix(d)) monoD = false;
report(monoD && spaceMix(30) === 1 && spaceMix(700) === 0, 'reflections strongest at the pad, gone ≈600 m away', `100 m ${spaceMix(100).toFixed(2)} · 300 m ${spaceMix(300).toFixed(2)}`);
if (failed) { console.error(`${failed} comprobación(es) fallida(s)`); process.exit(1); }
