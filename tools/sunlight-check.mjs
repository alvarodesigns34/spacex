#!/usr/bin/env node
// The colour of direct sunlight (src/core/sunlight.js), headless: the published constants it is
// built from, the air mass, and that the light it gives reddens as the Sun gets low — the sunset
// that did not (audit of 8-11-2026, §35) — while the default 20° key stays near neutral.
import { TAU, airMass, transmittance, sunTint } from '../src/core/sunlight.js';

let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const f = (a) => a.map((x) => x.toFixed(3)).join(' ');

// Rayleigh at 550 nm, sea level: 0.0973 (Bodhaine et al. 1999, table 3: 0.09726 at 550 nm).
const ray550 = 0.008569 * 0.55 ** -4 * (1 + 0.0113 * 0.55 ** -2 + 0.00013 * 0.55 ** -4);
report(Math.abs(ray550 - 0.0973) < 5e-4 && TAU[0] < TAU[1] && TAU[1] < TAU[2], 'espesor óptico: Rayleigh a 550 nm 0,097 (Bodhaine 1999) y creciente hacia el azul', `R G B ${f(TAU)}`);
// Kasten–Young: 1 at the zenith, ≈2 at 30°, ≈38 at the horizon.
report(Math.abs(airMass(90) - 1) < 1e-3 && Math.abs(airMass(30) - 1.995) < 0.01 && Math.abs(airMass(0) - 37.9) < 0.3, 'masa de aire de Kasten-Young: 1 en el cenit, ≈2 a 30°, ≈38 en el horizonte', `${airMass(90).toFixed(3)} · ${airMass(30).toFixed(3)} · ${airMass(0).toFixed(1)}`);
// Every channel loses more as the Sun gets lower, blue fastest.
let mono = true;
for (let e = 4; e < 75; e += 1) { const a = transmittance(e), b = transmittance(e + 1); if (!(a.every((v, i) => v < b[i]) && a[2] / a[0] < b[2] / b[0])) mono = false; }
report(mono, 'la transmitancia cae al bajar el sol, el azul más deprisa (4°–75°)');
// The sunset reddens; the default stays near neutral; noon is daylight.
const s5 = sunTint(5), s20 = sunTint(20), s65 = sunTint(65);
report(s5[2] / s5[0] < 0.5 && s5[1] / s5[0] < 0.85, 'a 5° la luz es dorada-anaranjada (azul/rojo < 0,5)', f(s5));
report(s20[1] > 0.93 && s20[2] > 0.83, 'a 20°, el sol por defecto, casi neutra (la calibración de los materiales)', f(s20));
report(Math.min(...s65) > 0.96, 'a 65° luz de día, sin tinte', f(s65));
// Negative control: the old HSL ramp (environment.js before §35), computed here, fails the 5° test.
const hsl = (h, sat, l) => { const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q; const c = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [c(h + 1 / 3), c(h), c(h - 1 / 3)]; };
const oldRamp = (e) => { const t = Math.min(1, Math.max(0, e / 60)), w = (1 - t) ** 3.4; const c = hsl(0.09, 0.04 + 0.28 * w, 0.74 + 0.24 * t ** 0.55); return c.map((v) => v / c[0]); };
const o5 = oldRamp(5);
report(!(o5[2] / o5[0] < 0.5), 'control negativo: la rampa HSL antigua no se enrojece a 5° y esta prueba la rechazaría', f(o5));

if (failed) { console.error(`\n${failed} comprobación(es) de la luz del sol fallan`); process.exit(1); }
console.log('\nLuz del sol: todo correcto');
