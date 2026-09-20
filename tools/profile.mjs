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
 */
import { createServer } from 'node:http';
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

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const path = join(ROOT, (rel === '/' || rel === '\\' || rel === '') ? 'index.html' : rel);
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));

// Force the tier rather than let the probe pick it: this runs on SwiftShader, which is
// correctly demoted to `low`, and a profile of the reduced scene would be measuring something
// nobody ships. `--quality` exists so the cheap tiers can be profiled on purpose.
const TIER = argOf('--quality') ?? 'high';
const t0 = Date.now();
await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);
const wallMs = Date.now() - t0;

/**
 * Scene census — the shared walk in census.mjs, which propagates visibility through parents
 * instead of asking each mesh its own local flag. renderer.info.render only reports what the
 * LAST frame drew, so it is read per situation below; these counts are process-wide.
 */
const census = await page.evaluate(sceneCensus, { perExhibit: true, startup: true });

/** Frame time and draw calls in one situation, after letting it settle. */
async function situation(name, setup, { frames = Number(argOf('--frames') ?? 18) } = {}) {
  await page.evaluate(setup);
  await page.waitForTimeout(900);
  const r = await page.evaluate((n) => new Promise((resolve) => {
    const v = window.__vc;
    const times = [];
    let peakCalls = 0, peakTris = 0;
    let left = n + 6;                 // the first few frames after a jump are not representative
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (left <= n) {
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
situations.push(await situation('starship-tps-far', () => window.__vc.jump('starship', 'site')));
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
situations.push(await situation('night-overview', () => { window.__vc.env.setSun(-8, 34); window.__vc.jump(null); }));
await page.evaluate(() => window.__vc.env.setSun(42, 34));
}

/** Garbage produced per frame, as a proxy for per-frame allocation in the hot path. */
const gc = await page.evaluate(() => new Promise((resolve) => {
  if (!performance.memory) { resolve(null); return; }
  const a = performance.memory.usedJSHeapSize;
  let n = 120;
  const tick = () => {
    if (--n <= 0) {
      resolve({ heapDeltaKBPerFrame: +(((performance.memory.usedJSHeapSize - a) / 1024) / 120).toFixed(2) });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));

const out = { wallStartupMs: wallMs, ...census, situations, gc };
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

await browser.close();
server.close();
