/**
 * GPU benchmark on the machine this runs on, in the installed Chrome with its real GPU (not the
 * software renderer the checks use). Opens a visible window, boots the centre with ?gpu, walks a
 * fixed set of views and prints, per view, the frame rate, the GPU and CPU time per frame and the
 * GPU time per pass (core/gpuProfiler.js).
 *
 * The page is not told it is automated (--disable-blink-features=AutomationControlled), so it runs
 * exactly as a visitor's: full cloud march, still AA, cloud shadows, texture cache.
 *
 * Usage: node tools/gpu-bench.mjs [--q "off=ao&pr=1"] [--q ...] [--views overview,starship/site]
 *        [--objects] [--launch] [--json out.json] [--width 3440 --height 1440]
 * Each --q is one configuration (a query string added to ?gpu); none = the default scene.
 */
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8807;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream',
};
const args = process.argv.slice(2);
const all = (f) => args.flatMap((a, i) => a === f ? [args[i + 1]] : []);
const one = (f, d) => all(f)[0] ?? d;
const configs = all('--q'); if (!configs.length) configs.push('');
const VIEWS = (one('--views', 'overview,starship/site,starship/engines,falcon9/overview,roadster/detail,f16/overview,gt3rs/overview,modely/overview')).split(',');
const W = Number(one('--width', 3440)), H = Number(one('--height', 1440));
const objects = args.includes('--objects');
const settle = Number(one('--settle', 2500)), measure = Number(one('--measure', 3000));

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--disable-blink-features=AutomationControlled', `--window-size=${W},${H}`, '--window-position=0,0',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const out = [];
try {
  for (const q of configs) {
    const ctx = await browser.newContext({ viewport: null });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('PAGEERROR', e.message));
    const url = `http://127.0.0.1:${PORT}/?gpu${objects ? '=objects' : ''}${q ? '&' + q : ''}`;
    const t0 = Date.now();
    await page.goto(url);
    await page.waitForFunction(() => window.__vc && !document.getElementById('loading'), null, { timeout: 600000 });
    const boot = (Date.now() - t0) / 1000;
    await page.waitForTimeout(5000);
    const env = await page.evaluate(() => ({ dpr: devicePixelRatio, css: [innerWidth, innerHeight], buffer: [window.__vc.renderer.domElement.width, window.__vc.renderer.domElement.height],
      gpu: window.__vc.quality.probe?.renderer, timer: window.__vc.gpu?.supported }));
    console.error(`\n[${q || 'default'}] boot ${boot.toFixed(1)} s`, JSON.stringify(env));
    const phases = await page.evaluate(() => Object.entries(window.__vc.timings ?? {}).filter(([, v]) => typeof v === 'number').sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(' · '));
    console.error(`  boot phases: ${phases}`);
    const rows = [];
    const ev = one('--eval', null);
    if (ev) await page.evaluate(ev);
    const shots = one('--shots', null);
    const sample = async (name) => {
      await page.waitForTimeout(settle);
      if (shots) {
        const tag = (q || 'default').replace(/[^a-z0-9=]+/gi, '_');
        await page.screenshot({ path: `${shots}/${tag}__${name.replace(/\W+/g, '_')}.png` });
      }
      const r = await page.evaluate(async (ms) => {
        window.__vc.gpu.reset();
        let n = 0; const t = performance.now();
        await new Promise(res => { const f = () => { n++; if (performance.now() - t < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        const fps = n / ((performance.now() - t) / 1000);
        return { fps: +fps.toFixed(1), ...window.__vc.gpu.report(), calls: window.__vc.renderer.info.render.calls };
      }, measure);
      rows.push({ view: name, ...r });
      const top = Object.entries(r.parts).slice(0, 7).map(([k, v]) => `${k} ${v}`).join(' · ');
      console.error(`  ${name.padEnd(20)} ${String(r.fps).padStart(6)} fps  gpu ${r.gpuMs} (p95 ${r.gpuP95})  cpu ${r.cpuMs}  | ${top}`);
    };
    for (const v of VIEWS) {
      const [id, preset] = v === 'overview' ? [null, null] : v.split('/');
      await page.evaluate(([id, preset]) => window.__vc.jump(id, preset), [id, preset]);
      await sample(v);
    }
    if (args.includes('--launch')) {
      await page.evaluate(() => { window.__vc.jump('starship', 'site'); });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__vc.launch.start?.());
      for (const t of [8, 20, 40]) { await page.waitForTimeout(t === 8 ? 6000 : 12000); await sample(`launch@~${t}s`); }
    }
    out.push({ config: q || 'default', boot, env, rows });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
const json = one('--json', null);
if (json) await writeFile(json, JSON.stringify(out, null, 2));
