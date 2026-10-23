/**
 * The texture cache (src/materials/textureCache.js) gives back exactly what the generators
 * paint. In Chromium, one browser profile, two visits:
 *
 *   1. the first paints every texture and stores them after the start-up;
 *   2. the second reads every one of them from the cache (no step painted), and then each step is
 *      painted again here and compared with what came from the cache: every pixel of every
 *      canvas, and every setting (wrap, colour space, repeat, offset, tileSize, anisotropy asked);
 *      a canvas shared between textures is still shared.
 *
 * It also reports the start-up's materials time on both visits, and runs a negative control: a
 * cached canvas altered by one pixel must fail the comparison.
 *
 *   node tools/texture-cache-check.mjs
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8819;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

try {
  const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // ?texcache: under automation the cache is off unless asked for (main.js).
  const url = `http://127.0.0.1:${PORT}/?texcache`;

  // ---- Visit 1: paint and store.
  await bootAtQuality(page, url, 'low');
  const first = await page.evaluate(async () => {
    const C = window.__vc.textureCache;
    await C.saving;
    return { stats: { ...C.last?.stats }, steps: C.steps.length, ms: window.__vc.timings.materials };
  });
  report(first.stats.misses === first.steps && first.stats.saved + first.stats.skipped === first.steps && first.stats.saved > 0,
    'primera visita: pinta cada textura y las guarda tras el arranque', JSON.stringify(first));

  // ---- Visit 2: everything from the cache, then compared with a fresh painting.
  await bootAtQuality(page, url, 'low');
  const second = await page.evaluate(async () => {
    const C = window.__vc.textureCache, T = C.textures;
    const out = { stats: { ...C.last.stats }, ms: window.__vc.timings.materials, compared: 0, pixels: 0, diffs: [], shared: true };
    const pixels = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const settings = (t) => JSON.stringify([t.wrapS, t.wrapT, t.colorSpace, t.flipY, t.repeat.toArray(), t.offset.toArray(), t.userData.tileSize, t.userData.tileSizeU, t.userData.anisotropyAsked, t.anisotropy]);
    for (const [key, fn] of C.steps) {
      const fresh = fn(), cached = T[key];
      for (const [k, v] of Object.entries(fresh)) {
        const c = cached[k];
        if (!v?.isTexture) { if (JSON.stringify(v) !== JSON.stringify(c)) out.diffs.push(`${key}.${k}: valor`); continue; }
        if (!c?.isTexture) { out.diffs.push(`${key}.${k}: falta`); continue; }
        if (settings(v) !== settings(c)) out.diffs.push(`${key}.${k}: ajustes ${settings(c)} ≠ ${settings(v)}`);
        const a = pixels(v.image), b = pixels(c.image);
        let n = a.length === b.length ? 0 : -1;
        if (n === 0) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
        if (n) out.diffs.push(`${key}.${k}: ${n < 0 ? 'tamaño' : `${n} valores`}`);
        out.compared++; out.pixels += a.length / 4;
      }
    }
    // The steel's normal map is one canvas under the three steels, as when painted.
    out.shared = T.steel.normalMap.image === T.steelSkirt.normalMap.image && T.steel.normalMap.image === T.steelWarm.normalMap.image;
    // Negative control: one value changed in a cached canvas must show.
    const c = T.concrete.map.image, ctx = c.getContext('2d', { willReadFrequently: true }), d = ctx.getImageData(0, 0, 1, 1);
    d.data[0] = (d.data[0] + 7) % 256; ctx.putImageData(d, 0, 0);
    const fresh = C.steps.find(s => s[0] === 'concrete')[1]().map.image;
    const a = pixels(fresh), b = pixels(c);
    let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    out.control = n;
    return out;
  });
  report(second.stats.hits === first.steps && second.stats.misses === 0, 'segunda visita: todas las texturas salen de la caché, ninguna se pinta', JSON.stringify(second.stats));
  report(!second.diffs.length && second.compared > 30, 'cada textura de la caché es, píxel a píxel y ajuste a ajuste, la que pinta su generador',
    second.diffs.length ? second.diffs.slice(0, 4).join(' | ') : `${second.compared} texturas · ${(second.pixels / 1e6).toFixed(1)} M píxeles`);
  report(second.shared, 'un lienzo compartido sigue compartido (las normales del acero, bajo los tres aceros)');
  report(second.control > 0, 'control negativo: un valor cambiado en un lienzo de la caché se detecta', `${second.control} valor`);
  report(true, 'tiempo de los materiales en el arranque', `primera visita ${(first.ms / 1000).toFixed(1)} s · segunda ${(second.ms / 1000).toFixed(1)} s (SwiftShader: compara, no da la cifra de una máquina real)`);
  report(!errors.length, 'consola sin errores', errors.slice(0, 3).join(' | '));
} catch (e) {
  report(false, 'la prueba terminó', e.message.split('\n')[0]);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
