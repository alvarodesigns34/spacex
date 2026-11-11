#!/usr/bin/env node
// The full-quality contract (the user's rule of 8-11-2026: never lower the quality to gain speed,
// no automatic reduction), headless. Replaces tools/adaptive-check.mjs, which tested the adaptive
// controller that lowered the clouds' samples per ray and that this rule withdrew.
//  1. pickQuality always starts at `high`, whatever the device reports (a phone, a software
//     renderer, 4 GB of memory, a 144 Hz desktop); only ?quality= changes it.
//  2. The full tier drops no level of detail: a LODManager at its threshold keeps a far entry
//     detailed at 10 km (control: the medium threshold drops it there).
//  3. Nothing in the sources lowers the clouds' samples or the tier at run time: no adaptive
//     controller, no write to `clouds.steps` outside the clouds and the environment that sets them
//     once, no lathe stand-in for the Model Y's tyres. With nothing reading the frame times, the
//     result is the same at 60, 120 or 144 Hz.
// Exit code 1 on a failure.
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return next(new URL('../vendor/three/build/three.module.js', import.meta.url).href, context);
  if (specifier.startsWith('three/addons/')) return next(new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, context);
  return next(specifier, context);
} });

let failed = 0;
const report = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`); };

// A browser just big enough for the probe.
const device = { renderer: '', touch: false, memory: 16, threads: 16, dpr: 1, w: 1920, h: 1080 };
globalThis.window = { get devicePixelRatio() { return device.dpr; }, get innerWidth() { return device.w; }, get innerHeight() { return device.h; } };
globalThis.matchMedia = () => ({ matches: device.touch });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get hardwareConcurrency() { return device.threads; }, get deviceMemory() { return device.memory; } } });
const fakeRenderer = { getContext: () => ({ getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 1, UNMASKED_RENDERER_WEBGL: 2 }), getParameter: (k) => (k === 2 ? device.renderer : k === 1 ? '' : 16384), MAX_TEXTURE_SIZE: 3379 }) };

const { pickQuality } = await import('../src/core/quality.js');
const { LODManager } = await import('../src/core/lod.js');
const THREE = await import('three');

// 1.
const DEVICES = {
  'escritorio 144 Hz': { renderer: 'NVIDIA GeForce RTX 3070', touch: false, memory: 16, threads: 16, dpr: 1 },
  'teléfono': { renderer: 'Adreno (TM) 540', touch: true, memory: 4, threads: 4, dpr: 3 },
  'SwiftShader': { renderer: 'Google SwiftShader', touch: false, memory: 8, threads: 4, dpr: 1 },
  'portátil 4 GB': { renderer: 'Intel Iris', touch: false, memory: 4, threads: 8, dpr: 2 },
};
const got = [];
for (const [name, d] of Object.entries(DEVICES)) {
  Object.assign(device, d);
  const t = pickQuality(fakeRenderer);
  got.push(`${name}: ${t.name}${t.suggested !== t.name ? ` (la sonda sugería ${t.suggested})` : ''}`);
  if (t.name !== 'high' || t.forced) report(false, `nivel por defecto en ${name}`, t.name);
}
report(got.every(g => /: high/.test(g)), 'el nivel de partida es siempre el alto, sin bajada automática', got.join(' · '));
// The suggestion must still see what it saw before (it is reported in the technical panel).
Object.assign(device, DEVICES['teléfono']);
report(pickQuality(fakeRenderer).suggested === 'low', 'control: la sonda sigue reconociendo un teléfono débil (solo informa)');
Object.assign(device, DEVICES['escritorio 144 Hz']);
report(pickQuality(fakeRenderer, 'medium').name === 'medium' && pickQuality(fakeRenderer, 'low').forced, 'solo ?quality= cambia el nivel');
const high = pickQuality(fakeRenderer);
report(high.lodPixels === 0 && high.cloudSteps >= 32 && high.msaa >= 4 && high.shadowMap >= 8192,
  'el nivel alto: sin LOD, muestras de nubes, MSAA y sombras completos', `LOD ${high.lodPixels} · ${high.cloudSteps} pasos · MSAA ${high.msaa} · sombras ${high.shadowMap}`);

// 2.
const lodAt = (pixels) => {
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 1e6);
  const lod = new LODManager(camera, { pixels });
  const near = new THREE.Object3D(), far = new THREE.Object3D();
  lod.register({ name: 'x', at: (v) => v.set(0, 0, -10000), feature: 0.26, near: [near], far });
  const hide = new THREE.Object3D();
  lod.registerHidden('y', [hide], (v) => v.set(0, 0, -10000), 0.02);
  lod.update(); lod.update();
  return near.visible && !far.visible && hide.visible;
};
report(lodAt(high.lodPixels), 'nivel alto: una entrada de detalle a 10 km sigue con todo su detalle');
report(!lodAt(5), 'control: con el umbral del nivel medio esa entrada sí cae');

// 3.
// fileURLToPath, not .pathname: on Windows the latter is '/C:/…' with the non-ASCII still escaped.
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
walk(SRC);
const offenders = [];
for (const f of files) {
  const rel = f.slice(SRC.length);
  const code = readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  if (/core\/adaptive\.js|createAdaptive/.test(code)) offenders.push(`${rel}: controlador adaptativo`);
  if (/latheLod/.test(code)) offenders.push(`${rel}: sustituto de torno`);
  if (!/core\/(clouds|environment)\.js$/.test(rel) && /clouds\.steps\s*=[^=]/.test(code)) offenders.push(`${rel}: cambia los pasos de las nubes`);
}
report(offenders.length === 0, 'nadie baja en marcha las muestras de las nubes ni sustituye geometría (igual a 60, 120 o 144 Hz)', offenders.join(' · ') || `${files.length} módulos revisados`);
// Control: the same scan catches the line the adaptive controller used to write.
report(/clouds\.steps\s*=[^=]/.test('&& adaptive.sample(now - lastFrameAt, now / 1000)) env.clouds.steps = adaptive.value;'), 'control: el escaneo detecta la línea que escribía el controlador');

if (failed) { console.error(`\n${failed} comprobación(es) de la calidad completa fallan`); process.exit(1); }
console.log('\nCalidad completa: todo correcto');
