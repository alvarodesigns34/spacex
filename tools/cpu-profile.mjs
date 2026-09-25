/**
 * Start-up CPU profile: where the seconds before the first frame go.
 *
 * `profile.mjs` reports the phases the page times itself (materials, each exhibit, the site);
 * this goes one level down. It records a V8 CPU profile over the whole boot through the
 * DevTools protocol and reports self time by function and by source file, so a slow phase
 * can be traced to the code that makes it slow rather than guessed at.
 *
 * SwiftShader is software rasterisation: shader compilation and draw submission are CPU
 * work here and would not be on a GPU. The geometry and texture builders measured below are
 * CPU work on every machine, which is why they are the ones worth reading.
 *
 * Usage: node tools/cpu-profile.mjs [--quality high|medium|low] [--top 30] [--json out.json]
 */
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8807;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const TIER = argOf('--quality') ?? 'high';
const TOP = Number(argOf('--top') ?? 30);

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);
  const wall = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const timings = await page.evaluate(() => window.__vc.timings ?? null);

  // Self time per node from the samples.
  const dt = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  }
  const byFn = new Map(), byFile = new Map();
  for (const n of profile.nodes) {
    const ms = dt.get(n.id) ?? 0;
    if (!ms) continue;
    const f = n.callFrame;
    const file = f.url ? f.url.replace(/^.*?\/(src|vendor)\//, '$1/') : `(${f.functionName || 'native'})`;
    const key = `${f.functionName || '(anonymous)'} · ${file}:${f.lineNumber + 1}`;
    byFn.set(key, (byFn.get(key) ?? 0) + ms);
    byFile.set(file, (byFile.get(file) ?? 0) + ms);
  }
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([k, v]) => [k, +v.toFixed(1)]);
  const out = { tier: TIER, wallMs: wall, timings, files: top(byFile), functions: top(byFn) };
  const json = argOf('--json');
  if (json) await writeFile(json, JSON.stringify(out, null, 2));
  console.log(`tier ${TIER} · boot ${wall} ms`);
  console.log('page timings', JSON.stringify(timings));
  console.log('\nself time by file (ms)');
  for (const [k, v] of out.files) console.log(`${String(v).padStart(8)}  ${k}`);
  console.log('\nself time by function (ms)');
  for (const [k, v] of out.functions) console.log(`${String(v).padStart(8)}  ${k}`);
} finally {
  await browser.close();
  server.close();
}
