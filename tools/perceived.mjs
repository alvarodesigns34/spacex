/**
 * Perceived performance: what a visitor waits for, rather than what a frame costs.
 *
 *   · time to the first painted scene frame and to interaction (the loading card gone);
 *   · long tasks (> 50 ms) on the main thread during start-up — each is a stretch in which
 *     the page cannot repaint the progress bar or answer input — and the longest of them;
 *   · JS heap after start-up;
 *   · switching exhibits: from the click to the camera settled, and the worst frame gap
 *     in between (a hitch shows up here, not in an average).
 *
 * Runs in headless Chromium on SwiftShader, which rasterises on the CPU: absolute numbers
 * are not a GPU device's. Use it to compare two builds on the same machine.
 *
 * Usage: node tools/perceived.mjs [--quality high|medium|low] [--json out.json]
 */
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8809;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const TIER = argOf('--quality') ?? 'high';

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  // Installed before any page script: long tasks and the moment the card goes.
  await page.addInitScript(() => {
    window.__perf = { long: [], cardGone: null, firstFrame: null };
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push([Math.round(e.startTime), Math.round(e.duration)]); })
        .observe({ type: 'longtask', buffered: true });
    } catch { /* not supported */ }
    const watch = () => {
      const card = document.getElementById('loading');
      if (!card && window.__perf.cardGone === null) window.__perf.cardGone = performance.now();
      if (window.__vc && window.__perf.firstFrame === null) window.__perf.firstFrame = performance.now();
      if (window.__perf.cardGone === null) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/?quality=${TIER}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__perf?.cardGone !== null, null, { timeout: 180000 });
  const wall = Date.now() - t0;
  const boot = await page.evaluate(() => {
    const p = window.__perf;
    const long = p.long.filter(([s]) => s <= p.cardGone);
    return {
      interactiveMs: Math.round(p.cardGone), firstSceneMs: Math.round(p.firstFrame ?? 0),
      longTasks: long.length, longTaskMs: long.reduce((a, [, d]) => a + d, 0),
      longestTaskMs: long.reduce((a, [, d]) => Math.max(a, d), 0),
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    };
  });
  // Exhibit switches: time from jump() to the rig settling, and the worst frame gap.
  const switches = [];
  for (const id of ['starship', 'roadster', 'falcon9', 'starlink', null]) {
    const r = await page.evaluate((target) => new Promise((resolve) => {
      const v = window.__vc;
      const start = performance.now();
      let last = start, worst = 0, still = 0;
      const prev = v.camera.position.clone();
      v.jump(target);
      const tick = () => {
        const now = performance.now();
        worst = Math.max(worst, now - last); last = now;
        const moved = v.camera.position.distanceTo(prev);
        prev.copy(v.camera.position);
        still = moved < 1e-3 ? still + 1 : 0;
        if (still >= 3 || now - start > 60000) { resolve({ settleMs: Math.round(now - start), worstFrameMs: Math.round(worst) }); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), id);
    switches.push({ to: id ?? 'overview', ...r });
  }
  const out = { tier: TIER, wallMs: wall, ...boot, switches, note: 'SwiftShader (CPU rasteriser): compare builds, not devices.' };
  console.log(JSON.stringify(out, null, 2));
  const json = argOf('--json');
  if (json) await writeFile(json, JSON.stringify(out, null, 2));
} finally {
  await browser.close();
  server.close();
}
