#!/usr/bin/env node
// The colour of direct sunlight (src/core/sunlight.js), headless: the published constants it is
// built from, the air mass, and that the light it gives reddens as the Sun gets low — the sunset
// that did not (audit of 8-11-2026, §35) — while the default 20° key stays near neutral.
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  return next(specifier, context);
} });
const { TAU, airMass, transmittance, sunTint } = await import('../src/core/sunlight.js');
const { lobeTint, installFogSun } = await import('../src/core/fogSun.js');
const THREE = await import('three');

let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const f = (a) => a.map((x) => x.toFixed(3)).join(' ');

// Rayleigh, checked on the production values (TAU less the aerosol term), not on a copy of the
// formula: against Bodhaine et al. 1999's own fit (J. Atmos. Ocean. Tech. 16, eq. 30, sea level,
// 1013.25 hPa), a different paper and form from the Hansen & Travis formula the code uses, at the
// three wavelengths (external audit 8-11, finding 09).
{
  const bodhaine = (l) => 0.0021520 * (1.0455996 - 341.29061 * l ** -2 - 0.90230850 * l ** 2) / (1 + 0.0027059889 * l ** -2 - 85.968563 * l ** 2);
  const L = [0.65, 0.55, 0.45], ray = TAU.map((t, i) => t - 0.05 * L[i] ** -1.3);
  const err = ray.map((r, i) => Math.abs(r / bodhaine(L[i]) - 1));
  report(Math.max(...err) < 0.015 && TAU[0] < TAU[1] && TAU[1] < TAU[2], 'espesor óptico de Rayleigh del código frente a Bodhaine 1999 (ec. 30) a 650, 550 y 450 nm, y creciente hacia el azul',
    `${ray.map((r) => r.toFixed(4)).join(' ')} frente a ${L.map((l) => bodhaine(l).toFixed(4)).join(' ')} · error máx. ${(Math.max(...err) * 100).toFixed(2)} %`);
  // Control: a λ⁻³ law, a plausible slip, is caught.
  report(Math.abs(0.008569 * 0.45 ** -3 / bodhaine(0.45) - 1) > 0.015, 'control negativo: una ley en λ⁻³ no pasaría');
}
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

// The haze's lobe towards a low Sun (fogSun.js): nothing at 25° and above, warm and brighter at 5°.
const fog = new THREE.Color().setHSL(0.58, 0.3, 0.5);
const l30 = lobeTint(30, sunTint(30), fog), l5 = lobeTint(5, sunTint(5), fog);
const at5 = [fog.r + l5[0], fog.g + l5[1], fog.b + l5[2]];
report(l30.every((v) => v === 0) && at5[0] > fog.r * 1.3 && at5[0] / at5[2] > 1.2, 'niebla hacia el sol: sin lóbulo por encima de 25°, cálida y más clara a 5°', `a 5°, niebla ${f([fog.r, fog.g, fog.b])} → ${f(at5)}`);
// The chunk patch: three.js's fog fragment still has the line it replaces, and the patch is applied.
installFogSun();
report(THREE.ShaderChunk.fog_fragment.includes('fogLit') && THREE.ShaderChunk.fog_vertex.includes('vFogDir') && THREE.ShaderLib.physical.uniforms.fogSunTint?.value instanceof Float32Array,
  'el parche entra en los fragmentos de niebla de three.js y comparte sus uniformes por referencia');

// Shared, not just present (finding 10): the uniforms each material gets (three.js clones the
// ShaderLib's per material, as here) must be the same Float32Array, so one write reaches both;
// and a chunk that no longer carries the patched line must throw, not pass silently.
{
  const { FOG_SUN } = await import('../src/core/fogSun.js');
  const a = THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), b = THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms);
  FOG_SUN.tint[0] = 0.125;
  report(a.fogSunTint.value === FOG_SUN.tint && b.fogSunTint.value === FOG_SUN.tint && b.fogSunTint.value[0] === 0.125 && a.fogSunDir.value === b.fogSunDir.value,
    'dos materiales distintos leen el mismo uniforme: una escritura llega a ambos', `${a.fogSunTint.value === FOG_SUN.tint} ${b.fogSunTint?.value === FOG_SUN.tint} ${b.fogSunTint?.value?.[0]}`);
  FOG_SUN.tint[0] = 0;
  const src = (await import('node:fs')).readFileSync(new URL('../src/core/fogSun.js', import.meta.url), 'utf8');
  report(/if \(next === C\[name\]\) throw/.test(src) && (src.match(/patch\('fog_/g) ?? []).length === 4, 'cada reemplazo del parche falla en voz alta si three.js cambia el fragmento (4 reemplazos vigilados)');
}

if (failed) { console.error(`\n${failed} comprobación(es) de la luz del sol fallan`); process.exit(1); }
console.log('\nLuz del sol: todo correcto');
