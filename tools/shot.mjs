/**
 * Screenshot helper — the renderer the documentation is allowed to show.
 *
 *   node tools/shot.mjs <outdir> <shots.json> [--quality high|medium|low]
 *
 * It forces `?quality=high` and refuses to run if the page did not come up at that tier. This
 * is not a detail: Playwright drives Chromium through SwiftShader, `quality.js` correctly
 * identifies a software rasteriser and correctly demotes it to the cheap tier, and every
 * screenshot in the README was therefore being taken at half the pixel ratio, a quarter of
 * the shadow map, with bloom off, detail shedding early and a third of the ground cloud. The
 * pictures were honest about a tier nobody looks at and dishonest about the project.
 *
 * Each shot also declares the whole state it wants rather than inheriting whatever the
 * previous shot left behind, so a manifest reordered or run alone produces the same frames:
 *
 *   { name, jump:[id, preset] (+ pos+target to reframe) | pos+target | ortho | seek,
 *     sun, labels, ruler, humans, launch, wait }
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { sceneCensus, bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.VC_SHOT_PORT ?? 8801);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const TIER = argOf('--quality') ?? 'high';
const sunArg = args.find(a => a.startsWith('--sun='));
const SUN = Number(sunArg ? sunArg.slice('--sun='.length) : (argOf('--sun') ?? 18));
if (!Number.isFinite(SUN)) {
  console.error('--sun debe ser un número (elevación en grados). Por defecto 18.');
  process.exit(2);
}
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--quality' && args[i - 1] !== '--sun');
const [outdir, manifest] = positional;
if (!outdir || !manifest) {
  console.error('uso: node tools/shot.mjs <outdir> <shots.json> [--quality high|medium|low] [--sun 18]');
  process.exit(2);
}

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const VW = Number(process.env.VC_SHOT_W ?? 1600);
const VH = Number(process.env.VC_SHOT_H ?? 900);
const page = await (await browser.newContext({ viewport: { width: VW, height: VH } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const w = `${m.text()} ${m.location()?.url ?? ''}`;
  if (!/fonts\.(googleapis|gstatic)/.test(w)) console.log('CONSOLE', w);
});

const q = await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);
console.log(`quality ${q.name} (forced) · sun ${SUN}° unless a shot overrides it`);

const shots = JSON.parse(await readFile(manifest, 'utf8'));
for (const s of shots) {
  if (s.viewport) await page.setViewportSize({ width: s.viewport[0], height: s.viewport[1] });
  await page.evaluate(({ s, sun }) => {
    const v = window.__vc;
    document.getElementById('hud').style.display = s.hud === false ? 'none' : '';
    // First-visit tips belong to a visitor's first seconds, not to a documentation frame.
    if (!s.coach) v.hud?.hideCoach?.();
    else { try { localStorage.removeItem('vc-coach-seen-1'); } catch { /* storage unavailable */ } v.hud?.showCoach?.(0); }
    // Reset the state a previous shot may have left, so order cannot change a frame.
    if (s.seek === undefined) v.launch.reset(false);
    v.ortho(null);
    v.env.setSun(s.sun ?? sun, 34);
    v.setToggle('labels', s.labels ?? true);
    v.setToggle('ruler', s.ruler ?? true);
    v.setToggle('humans', s.humans ?? true);
    const hudEl = document.getElementById('hud');
    hudEl.classList.remove('is-clean');
    hudEl.querySelectorAll('.is-open').forEach(n => n.classList.remove('is-open'));
    const sheet = document.getElementById('sheet');
    if (s.sheet === 'open' && sheet.classList.contains('collapsed')) document.getElementById('sheet-toggle').click();
    else if (s.sheet === 'closed' && !sheet.classList.contains('collapsed')) document.getElementById('sheet-toggle').click();

    if (s.seek !== undefined) {
      v.launch.setSpeed(s.speed ?? 1);
      v.launch.seek(s.seek);
      v.__shotSpeed = v.launch.state.speed;
      v.launch.setSpeed(0);
    }
    else if (s.ortho) v.ortho(s.ortho);
    else if (s.jump) {
      v.jump(s.jump[0] ?? null, s.jump[1] ?? undefined);
      // A free camera on a selected exhibit: the HUD names the vehicle, the frame is custom.
      if (s.pos) v.rig.jumpTo(s.pos, s.target);
    }
    else v.rig.jumpTo(s.pos, s.target);
  }, { s, sun: SUN });
  for (const sel of s.clicks ?? []) await page.click(sel);
  // SwiftShader can take seconds per frame. A fixed delay captures half-drawn
  // type and a HUD that has not finished layout. Wait for fonts, two presented
  // frames, then a stable HUD rectangle.
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    await frame();
    const sig = () => {
      const root = document.getElementById('hud');
      if (!root || root.style.display === 'none') return 'off';
      return [...root.children].map((el) => {
        const r = el.getBoundingClientRect();
        if (getComputedStyle(el).display === 'none') return '';
        return `${r.x.toFixed(0)},${r.y.toFixed(0)},${r.width.toFixed(0)},${r.height.toFixed(0)}`;
      }).join(';');
    };
    let prev = sig();
    for (let i = 0; i < 4; i++) {
      await frame();
      await frame();
      const now = sig();
      if (now === prev) break;
      prev = now;
    }
    const hud = document.getElementById('hud');
    if (hud && hud.style.display !== 'none') {
      const title = (document.getElementById('hud-title')?.textContent || '').trim();
      if (title.length < 2) throw new Error('HUD title empty');
      const mission = document.getElementById('mission');
      if (mission && !mission.classList.contains('hidden')) {
        const clock = (document.getElementById('mission-clock')?.textContent || '').trim();
        if (!/^T[+\u2212-]?\d/.test(clock)) throw new Error(`mission clock incomplete: ${clock}`);
      }
    }
  });
  await page.evaluate(() => {
    const v = window.__vc;
    if (v.__shotSpeed != null) { v.launch.setSpeed(v.__shotSpeed); v.__shotSpeed = null; }
  });
  const jpg = s.name.endsWith('.jpg');
  await page.screenshot({
    path: `${outdir}/${jpg ? s.name : `${s.name}.png`}`,
    timeout: 180000,
    ...(jpg ? { type: 'jpeg', quality: 88 } : {}),
  });
  console.log('shot', s.name);
}

const stats = await page.evaluate(sceneCensus, {});
console.log(JSON.stringify({
  quality: stats.quality, meshes: stats.meshes, drawnMeshes: stats.drawnMeshes,
  tris: stats.tris, drawnTris: stats.drawnTris, textures: stats.textures,
}));

await browser.close();
server.close();
