/**
 * Performance and scene-budget profile.
 *
 * `check.mjs` proves the scene is correct; this says what it costs. It reports the numbers a
 * regression would show up in — start-up split by phase, triangles, draw calls, materials,
 * textures and their estimated GPU bytes, and frame time in the three situations that behave
 * differently: the wide overview, a close-up, and the launch with plumes and a ground cloud.
 *
 * Emits JSON on stdout so a run can be diffed against a baseline. `--json <path>` also writes
 * it to a file; `--baseline <path>` compares against one and prints the deltas.
 *
 * Usage: node tools/profile.mjs [--json out.json] [--baseline base.json]
 * Short diagnostic: --frames 3 --gcframes 3 --only overview,starship-tps-near
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { sceneCensus, bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8803;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const positiveInt = (flag, fallback) => {
  const value = Number(argOf(flag) ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
};
const sampleFrames = positiveInt('--frames', 18);
const gcFrames = positiveInt('--gcframes', 120);
const selected = argOf('--only')?.split(',');

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));

try {
// Force the tier rather than let the probe pick it: this runs on SwiftShader, which is
// correctly demoted to `low`, and a profile of the reduced scene would be measuring something
// nobody ships. `--quality` exists so the cheap tiers can be profiled on purpose.
const TIER = argOf('--quality') ?? 'high';
const t0 = Date.now();
await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);
const wallMs = Date.now() - t0;

// EffectComposer renders several scenes per frame. With the default autoReset, the last
// fullscreen pass overwrites the scene's cost with one triangle and one draw call. Reset
// BEFORE the main renderer.render invocation (thus before shadows), then accumulate all
// shadow, main-scene and postprocessing passes. Environment-map setup runs before this
// boundary and is deliberately excluded. No application rendering behavior is changed.
const rendererDetails = await page.evaluate(() => {
  const v = window.__vc, renderer = v.renderer;
  renderer.info.autoReset = false;
  const originalRender = renderer.render;
  renderer.render = function (scene, camera) {
    if (scene === v.scene) this.info.reset();
    return originalRender.call(this, scene, camera);
  };
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    name: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    counterScope: 'Per frame: shadow maps + main scene + postprocessing; excludes environment-map generation',
    timingNote: 'Software SwiftShader rasterization; frame timings do not establish hardware GPU performance.',
  };
});

/**
 * Scene census — the shared walk in census.mjs, which propagates visibility through parents
 * instead of asking each mesh its own local flag. renderer.info.render only reports what the
 * LAST frame drew, so it is read per situation below; these counts are process-wide.
 */
const census = await page.evaluate(sceneCensus, { perExhibit: true, startup: true });

/** Frame time and draw calls in one situation, after letting it settle. */
async function situation(name, setup, { frames = sampleFrames } = {}) {
  if (selected && !selected.includes(name)) return null;
  await page.evaluate(setup);
  await page.waitForTimeout(900);
  const r = await page.evaluate((n) => new Promise((resolve, reject) => {
    const v = window.__vc;
    const times = [];
    let peakCalls = 0, peakTris = 0;
    let left = n + 6;                 // the first few frames after a jump are not representative
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (left <= n) {
        if (v.renderer.info.autoReset || v.renderer.info.render.calls <= 1 || v.renderer.info.render.triangles <= 1) {
          reject(new Error('Invalid frame counters: main-scene costs were reset or not rendered'));
          return;
        }
        times.push(now - last);
        peakCalls = Math.max(peakCalls, v.renderer.info.render.calls);
        peakTris = Math.max(peakTris, v.renderer.info.render.triangles);
      }
      last = now;
      if (--left <= 0) {
        times.sort((a, b) => a - b);
        resolve({
          medianMs: +times[times.length >> 1].toFixed(2),
          p90Ms: +times[Math.floor(times.length * 0.9)].toFixed(2),
          calls: peakCalls, drawnTris: peakTris,
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), frames);
  return { name, ...r };
}

const situations = [];
if (!args.includes('--census-only')) {
situations.push(await situation('overview', () => window.__vc.jump(null)));
situations.push(await situation('starship-site', () => window.__vc.jump('starship', 'site')));
situations.push(await situation('starship-engines', () => window.__vc.jump('starship', 'engines')));
situations.push(await situation('starship-tps-near', () => window.__vc.jump('starship', 'tiles')));
situations.push(await situation('starship-tps-far', () => {
  // Far enough that the shield is on its baked shell, framed on the same barrel.
  const v = window.__vc, e = v.exhibits.starship;
  const oy = e.model.position.y + 95;
  v.rig.jumpTo([e.lay.x + 55, oy + 18, e.lay.z + 140], [e.lay.x, oy, e.lay.z]);
}));
situations.push(await situation('pad-site', () => window.__vc.jump('starship', 'site')));
situations.push(await situation('roadster-detail', () => window.__vc.jump('roadster', 'detail')));
situations.push(await situation('roadster-far', () => window.__vc.jump(null)));
situations.push(await situation('dragon-detail', () => window.__vc.jump('dragon', 'superdraco')));
situations.push(await situation('starlink-bus', () => window.__vc.jump('starlink', 'bus')));
situations.push(await situation('falconheavy', () => window.__vc.jump('falconheavy', 'overview')));
situations.push(await situation('engines-row', () => window.__vc.jump('engines', 'overview')));
situations.push(await situation('launch-liftoff', () => { window.__vc.launch.seek(6); }));
situations.push(await situation('launch-maxq', () => { window.__vc.launch.seek(62); }));
situations.push(await situation('launch-catch', () => { window.__vc.launch.seek(410); }));
await page.evaluate(() => window.__vc.launch.reset(false));
situations.push(await situation('low-sun-overview', () => { window.__vc.env.setSun(6, 34); window.__vc.jump(null); }));
await page.evaluate(() => window.__vc.env.setSun(42, 34));
}

/** Garbage produced per frame, as a proxy for per-frame allocation in the hot path. */
const gc = await page.evaluate((frames) => new Promise((resolve) => {
  if (!performance.memory) { resolve(null); return; }
  const a = performance.memory.usedJSHeapSize;
  let n = frames;
  const tick = () => {
    if (--n <= 0) {
      resolve({ frames, heapDeltaKBPerFrame: +(((performance.memory.usedJSHeapSize - a) / 1024) / frames).toFixed(2) });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), gcFrames);

const out = { wallStartupMs: wallMs, ...census, renderer: rendererDetails, sampleFrames, situations: situations.filter(Boolean), gc };
if (selected && !args.includes('--census-only')) {
  const unknown = selected.filter(name => !out.situations.some(s => s.name === name));
  if (unknown.length) throw new Error(`Unknown situation(s): ${unknown.join(', ')}`);
}
console.log(JSON.stringify(out, null, 2));

const jsonPath = argOf('--json');
if (jsonPath) await writeFile(jsonPath, JSON.stringify(out, null, 2));

const basePath = argOf('--baseline');
if (basePath) {
  const base = JSON.parse(await readFile(basePath, 'utf8'));
  const pct = (a, b) => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : 'n/a');
  console.error('\n--- vs baseline ---');
  for (const k of ['wallStartupMs', 'tris', 'drawnTris', 'meshes', 'drawnMeshes', 'vertices',
    'bufferMB', 'materials', 'textures', 'textureMB']) {
    console.error(`  ${k.padEnd(16)} ${base[k]} -> ${out[k]}  (${pct(out[k], base[k])})`);
  }
  for (const s of out.situations) {
    const b = base.situations?.find(x => x.name === s.name);
    if (!b) continue;
    console.error(`  ${s.name.padEnd(18)} ${b.medianMs}ms/${b.calls} calls -> ${s.medianMs}ms/${s.calls} calls`);
  }
}

} finally {
  await browser.close();
  server.close();
}
