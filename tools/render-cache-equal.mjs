/**
 * Are the cached shadow map and the cached depth-and-normal buffer the ones a full redraw gives?
 *
 * `render-cache-check.mjs` proves, on a synthetic scene, when each cache asks for a redraw. This
 * proves the thing that matters, on the real centre: after each kind of change the page can go
 * through, what the caches leave standing is, byte for byte, what a redraw gives. Each case acts
 * (moves the camera, hides figures, turns the sun, flips a level-of-detail entry, moves a caster),
 * lets a few frames pass, and reads back
 *
 *   · the sun's shadow map, and
 *   · the ambient occlusion's normal buffer and its denoised result (which depend on the depth too),
 *
 * then asks for a full redraw of each by a route that does not go through the cache's own logic
 * (the renderer's `shadowMap.needsUpdate`; the pass told not to reuse its buffer for a few frames), lets frames pass
 * and reads them a second time. The one-second age limit is lifted for the run, so only the caches'
 * own signatures are on trial.
 *
 * The windsock is hidden while it reads, because it turns every frame and would make any two reads
 * differ in its few texels; its own rules are covered in `render-cache-check.mjs`.
 *
 *   node tools/render-cache-equal.mjs [--quality high]
 *
 * It needs the high tier, the only one with the ambient occlusion pass. It also counts how many of
 * the frames drew each thing, and runs a negative control: with both caches blind, a moved sun and
 * a moved camera must leave a stale shadow map and a stale buffer, and the comparison must see both.
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8814;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const TIER = argOf('--quality') ?? 'high';

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

try {
  const page = await (await browser.newContext({ viewport: { width: 480, height: 300 } })).newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);

  // Everything below runs in the page: frames are waited for there and the reads need no hand-off.
  const results = await page.evaluate(async () => {
    const v = window.__vc;
    const frames = (n) => new Promise((res) => { let k = 0; const t = () => (++k >= n ? res() : requestAnimationFrame(t)); requestAnimationFrame(t); });
    const sock = v.scene.getObjectByName('runway-windsock'); if (sock) sock.visible = false;
    const hasAO = !!v.gbufferCache;
    const pass = v.ao?.pass;
    const readRT = (rt) => {
      const w = rt.width, h = rt.height, T = rt.texture.type;
      const buf = T === 1016 ? new Uint16Array(w * h * 4) : T === 1015 ? new Float32Array(w * h * 4) : new Uint8Array(w * h * 4);
      v.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      return buf;
    };
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
    const covered = (a) => { let n = 0; const u = new Uint8Array(a.buffer); const first = u[0]; for (let i = 0; i < u.length; i++) if (u[i] !== first) n++; return n; };
    const still = async () => { for (let i = 0; i < 200; i++) { const p = v.camera.position.clone(); await frames(2); if (p.distanceTo(v.camera.position) < 1e-4) return; } };
    const cases = [];
    const compare = async (name, act, undo = null) => {
      const s0 = { ...v.shadowCache.stats }, g0 = hasAO ? { ...v.gbufferCache.stats } : null;
      await act();
      await still();
      await frames(4);
      const cShadow = readRT(v.env.sun.shadow.map);
      const cNormal = hasAO ? readRT(pass.normalRenderTarget) : null;
      const cAO = hasAO ? readRT(pass.pdRenderTarget) : null;
      const d = {
        frames: v.shadowCache.stats.frames - s0.frames, shadowDraws: v.shadowCache.stats.draws - s0.draws,
        gDraws: hasAO ? v.gbufferCache.stats.draws - g0.draws : 0,
      };
      // The references do not go through the caches' signatures.
      v.renderer.shadowMap.needsUpdate = true;
      const gp = hasAO ? v.gbufferCache.prepare : null;
      if (hasAO) v.gbufferCache.prepare = () => { pass.reuseGBuffer = false; };
      await frames(3);
      if (hasAO) v.gbufferCache.prepare = gp;
      const fShadow = readRT(v.env.sun.shadow.map);
      const fNormal = hasAO ? readRT(pass.normalRenderTarget) : null;
      const fAO = hasAO ? readRT(pass.pdRenderTarget) : null;
      cases.push({
        name, ...d,
        shadowDiff: diff(cShadow, fShadow), shadowCovered: covered(fShadow),
        normalDiff: hasAO ? diff(cNormal, fNormal) : 0, normalCovered: hasAO ? covered(fNormal) : 0,
        aoDiff: hasAO ? diff(cAO, fAO) : 0,
      });
      if (undo) { await undo(); await frames(2); }
    };
    const look = (id, d, h = 0.7) => {
      const e = v.exhibits[id]; const dir = [0.62, 0.22, 0.75], n = Math.hypot(...dir);
      const c = [e.lay.x, e.model.position.y + h, e.lay.z];
      v.rig.jumpTo([c[0] + dir[0] / n * d, c[1] + dir[1] / n * d, c[2] + dir[2] / n * d], c);
    };

    // Frames take seconds on the software rasteriser: the one-second age limit would redraw on every
    // one of them and hide whether the signatures alone are enough.
    v.shadowCache.stats.maxAgeMs = 1e12;
    if (hasAO) v.gbufferCache.stats.maxAgeMs = 1e12;
    await frames(6);
    await compare('escena quieta (vista general)', async () => {});
    await compare('la cámara salta junto al Roadster', async () => { look('roadster', 9, 0.9); });
    await compare('la cámara salta junto al Porsche', async () => { look('gt3rs', 14); });
    await compare('la cámara vuelve a la vista general', async () => { const o = v.overviewFor(window.innerWidth / window.innerHeight, v.camera.fov); v.rig.jumpTo(o.pos, o.target); });
    await compare('se ocultan las figuras de 1,80 m', async () => { v.setToggle('humans', false); }, async () => { v.setToggle('humans', true); });
    await compare('el Sol baja a 8°', async () => { v.env.setSun(8, 34, { immediate: true }); });
    await compare('el Sol sube a 55°', async () => { v.env.setSun(55, 80, { immediate: true }); }, async () => { v.env.setSun(20, 34, { immediate: true }); });
    const lodName = v.lod.entries.find(e => e.near.length && !e.far)?.name;
    if (lodName) {
      await compare(`un detalle del LOD (${lodName}) se oculta`, async () => { v.lod.pin(lodName, false); }, async () => { v.lod.pin(lodName, null); });
    }
    const roadster = v.exhibits.roadster?.model;
    if (roadster) {
      await compare('un expositor se desplaza 2 m', async () => { roadster.position.x += 2; }, async () => { roadster.position.x -= 2; });
    }

    // Negative control: caches that no longer look must leave stale pictures after the sun and the camera move.
    const sp = v.shadowCache.prepare, gp = v.gbufferCache?.prepare;
    v.shadowCache.prepare = () => {};
    if (hasAO) v.gbufferCache.prepare = () => { v.ao.pass.reuseGBuffer = true; };
    await compare('control negativo: cachés ciegas, el Sol y la cámara se mueven', async () => { v.env.setSun(40, 120, { immediate: true }); look('gt3rs', 30); });
    v.shadowCache.prepare = sp; if (hasAO) v.gbufferCache.prepare = gp;
    v.env.setSun(20, 34, { immediate: true });
    return { cases, hasAO };
  });

  report(results.hasAO === (TIER === 'high'), 'el pase de oclusión ambiental existe en la calidad pedida', `calidad ${TIER}`);
  for (const c of results.cases) {
    const control = c.name.startsWith('control negativo');
    const frames = `${c.frames} fotogramas · sombra ${c.shadowDraws} dibujos${results.hasAO ? ` · buffer ${c.gDraws} dibujos` : ''}`;
    if (control) {
      report(c.shadowDiff > 0, `${c.name}: el mapa de sombras viejo se detecta`, `${c.shadowDiff} bytes distintos`);
      if (results.hasAO) report(c.normalDiff > 0 && c.aoDiff > 0, `${c.name}: el buffer geométrico y la oclusión viejos se detectan`, `${c.normalDiff} bytes distintos en las normales, ${c.aoDiff} en la oclusión`);
      continue;
    }
    report(c.shadowDiff === 0 && c.shadowCovered > 0, `${c.name}: mapa de sombras idéntico`, `${c.shadowDiff} bytes distintos · ${frames}`);
    if (results.hasAO) report(c.normalDiff === 0 && c.aoDiff === 0 && c.normalCovered > 0, `${c.name}: buffer geométrico y oclusión idénticos`, `${c.normalDiff} bytes distintos en las normales, ${c.aoDiff} en la oclusión`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} comprobaciones fallan` : '\nMapa de sombras y buffer geométrico en caché: idénticos a los de un redibujo completo');
process.exit(failed ? 1 : 0);
