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
 *   { name, jump:[id, preset] | pos+target | ortho | seek,
 *     sun, labels, ruler, humans, launch, wait }
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { sceneCensus, bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8801;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const TIER = argOf('--quality') ?? 'high';
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--quality');
const [outdir, manifest] = positional;
if (!outdir || !manifest) {
  console.error('uso: node tools/shot.mjs <outdir> <shots.json> [--quality high|medium|low]');
  process.exit(2);
}

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const p = join(ROOT, (rel === '/' || rel === '\\' || rel === '') ? 'index.html' : rel);
    const b = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const w = `${m.text()} ${m.location()?.url ?? ''}`;
  if (!/fonts\.(googleapis|gstatic)/.test(w)) console.log('CONSOLE', w);
});

const q = await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);
console.log(`quality ${q.name} (forced)`);

const shots = JSON.parse(await readFile(manifest, 'utf8'));
for (const s of shots) {
  await page.evaluate((s) => {
    const v = window.__vc;
    // Reset the state a previous shot may have left, so order cannot change a frame.
    if (s.seek === undefined) v.launch.reset(false);
    v.ortho(null);
    v.env.setSun(s.sun ?? 42, 34);
    v.setToggle('labels', s.labels ?? true);
    v.setToggle('ruler', s.ruler ?? true);
    v.setToggle('humans', s.humans ?? true);

    if (s.seek !== undefined) { v.launch.setSpeed(s.speed ?? 1); v.launch.seek(s.seek); }
    else if (s.ortho) v.ortho(s.ortho);
    else if (s.jump) v.jump(s.jump[0] ?? null, s.jump[1] ?? undefined);
    else v.rig.jumpTo(s.pos, s.target);
  }, s);
  await page.waitForTimeout(s.wait ?? 700);
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
