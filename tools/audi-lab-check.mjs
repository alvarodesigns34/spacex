/**
 * The Audi Lab, end to end, in a browser: the site starts, the lab opens from its HUD button and
 * loads the asset, the exploded view moves every group and brings each one back exactly, parts
 * hide, isolate and come back, the doors open and shut, and the site is as it was on leaving.
 *
 *   node tools/audi-lab-check.mjs [--shots dir] [--channel chrome|msedge] [--swiftshader]
 *
 * By default it runs on the Chromium Playwright downloads, with the software renderer the other
 * checks use; `--channel chrome` runs it on the installed Chrome and the machine's own GPU,
 * which is also the way to get screenshots worth looking at (`--shots`).
 */
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const channel = arg('--channel'), shots = arg('--shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(staticHandler(fileURLToPath(new URL('..', import.meta.url)), TYPES));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const software = !channel || process.argv.includes('--swiftshader');
const browser = await chromium.launch({
  ...(channel ? { channel } : {}),
  args: software ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] : ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [], failed = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) failed.push(`${r.url()} ${r.status()}`); });

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
let n = 0;
const shot = async (name) => { if (!shots) return; mkdirSync(shots, { recursive: true }); await page.waitForTimeout(350); await page.screenshot({ path: join(shots, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
const settle = (ms = 1600) => page.waitForTimeout(ms);

let t0 = Date.now();
await page.goto(`${base}?quality=${arg('--quality') ?? 'medium'}`);
await page.waitForFunction(() => window.__vc && document.getElementById('loading')?.classList.contains('done') !== false && !document.querySelector('#loading:not(.done):not(.hidden)'), null, { timeout: 600000 }).catch(() => {});
await page.waitForFunction(() => !!window.__vc, null, { timeout: 600000 });
ok('the site starts', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
const requestedEarly = await page.evaluate(() => performance.getEntriesByType('resource').some(r => /assets\/audi\//.test(r.name)));
ok('the Audi asset is not on the start-up path', !requestedEarly);
await settle(800);
await shot('site-before');

ok('the HUD has the Audi Lab button', await page.locator('#audi-btn').isVisible());
t0 = Date.now();
await page.click('#audi-btn');
await page.waitForFunction(() => window.__vc.audiLab.loaded || /No se ha podido/.test(document.querySelector('#audi-lab .al-loading .loading-text')?.textContent ?? ''), null, { timeout: 600000 });
const info = await page.evaluate(() => { const l = window.__vc.audiLab; return { loaded: l.loaded, stats: l.stats, active: l.active, hud: getComputedStyle(document.getElementById('hud')).display }; });
ok('the lab opens and the asset loads', info.loaded && info.active, info.stats ? `${info.stats.seconds.toFixed(1)} s, ${info.stats.groups} groups, ${info.stats.meshes} meshes` : '');
ok('the site HUD is hidden in the lab', info.hud === 'none');
ok('the asset has its 45 assembly groups', info.stats?.groups === 45, String(info.stats?.groups));

// Scale and attitude: 4.31 m long along X, 1.97 m wide over the mirrors, 1.42 m to the roof (the
// aerial stands above it), on the floor (the tyres are modelled round, unloaded: they dip under it).
const dims = await page.evaluate(async () => {
  const THREE = await import('three');
  const b = new THREE.Box3().setFromObject(window.__vc.audiLab.car), s = b.getSize(new THREE.Vector3());
  let missing = 0, meshes = 0;
  window.__vc.audiLab.car.traverse(o => { if (o.isMesh) { meshes++; for (const m of [].concat(o.material)) if (!m || (m.map && !m.map.image)) missing++; } });
  return { size: s.toArray(), minY: b.min.y, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, missing, meshes };
});
ok('scale 1:1 and upright', Math.abs(dims.size[0] - 4.31) < 0.06 && dims.size[1] > 1.40 && dims.size[1] < 1.50 && dims.size[2] > 1.75 && dims.size[2] < 2.0 && Math.abs(dims.minY) < 0.03 && Math.abs(dims.cz) < 0.02,
  `${dims.size.map(v => v.toFixed(3)).join(' × ')} m, floor ${dims.minY.toFixed(3)}`);
ok('no material without its texture', dims.missing === 0, `${dims.meshes} meshes`);
await settle(1200);
await shot('lab-front34');

const poses = () => page.evaluate(() => [...window.__vc.audiLab.groups.values()].map(g => [...g.node.position.toArray(), ...g.node.quaternion.toArray(), g.node.visible ? 1 : 0]));
const home = await poses();
const dist = (a, b) => Math.max(...a.map((p, i) => Math.max(...p.map((v, j) => Math.abs(v - b[i][j])))));

for (const [i, name] of ['Lateral', '3/4 trasera', 'Superior'].entries()) {
  await page.click(`#audi-lab .al-views button:has-text("${name}")`);
  await settle(1300);
  await shot(`view-${i}`);
}
await page.click('#audi-lab .al-views button:has-text("3/4 delantera")');

// Exploded view: the slider, then all the way.
await page.locator('#audi-lab .al-explode input').fill('50'); await settle(1500);
await shot('explode-50');
await page.evaluate(() => window.__vc.audiLab.setExplode(1)); await settle(2200);
const out = await poses();
const movedCount = out.filter((p, i) => Math.hypot(p[0] - home[i][0], p[1] - home[i][1], p[2] - home[i][2]) > 0.05).length;
ok('the exploded view moves the groups', movedCount >= 40, `${movedCount} of ${out.length}`);
await shot('explode-100');
await page.click('#audi-lab .al-views button:has-text("Lateral")'); await settle(1300);
await shot('explode-100-side');
await page.click('#audi-lab .al-views button:has-text("3/4 delantera")');

// Hide, isolate, select and restore.
await page.evaluate(() => window.__vc.audiLab.isolate('motor')); await settle(1500);
const iso = await page.evaluate(() => [...window.__vc.audiLab.groups.values()].filter(g => g.node.visible).map(g => g.id));
ok('isolating shows one group only', iso.length === 1 && iso[0] === 'motor', iso.join(','));
await shot('isolate-motor');
await page.evaluate(() => window.__vc.audiLab.isolate('rueda_di')); await settle(1500);
await shot('isolate-wheel');
await page.evaluate(() => window.__vc.audiLab.isolate('salpicadero')); await settle(1500);
await shot('isolate-dash');
await page.evaluate(() => window.__vc.audiLab.showAll());
await page.evaluate(() => window.__vc.audiLab.setVisible('carroceria', false));
ok('a group hides', await page.evaluate(() => !window.__vc.audiLab.groups.get('carroceria').node.visible));

// Doors, bonnet, tailgate.
await page.evaluate(() => window.__vc.audiLab.assemble()); await settle(2200);
for (const b of await page.locator('#audi-lab .al-openings button').all()) await b.click();
await settle(1500);
const opened = await poses();
ok('doors, bonnet and tailgate open', opened.filter((p, i) => Math.abs(p[6] - home[i][6]) > 0.01).length === 6);
await shot('open-all');
await page.click('#audi-lab .al-views button:has-text("Motor")'); await settle(1500);
await shot('engine-bay');
await page.click('#audi-lab .al-views button:has-text("Interior")'); await settle(1500);
await shot('interior');

// Several rounds, then home: nothing may be left displaced.
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => { const l = window.__vc.audiLab; l.setExplode(1); l.isolate('porton'); }); await settle(500);
  await page.evaluate(() => { const l = window.__vc.audiLab; l.setExplode(0.3); l.showAll(); l.setOpen('capo', true); }); await settle(500);
}
await page.evaluate(() => window.__vc.audiLab.assemble()); await settle(2600);
const back = await poses();
ok('everything returns exactly to its place', dist(back, home) < 1e-6, `largest difference ${dist(back, home).toExponential(1)}`);

// Picking a part with the pointer.
await page.click('#audi-lab .al-views button:has-text("Lateral")'); await settle(1400);
await page.mouse.click(720, 430);
await settle(900);
const tag = await page.evaluate(() => document.querySelector('#audi-lab .al-tag:not(.hidden) b')?.textContent ?? null);
ok('clicking the car selects a part', !!tag, tag ?? '');
await shot('picked');

// Leaving: the site as it was.
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await settle(900);
const after = await page.evaluate(() => ({ active: window.__vc.audiLab.active, hud: getComputedStyle(document.getElementById('hud')).display, lab: document.getElementById('audi-lab').classList.contains('hidden') }));
ok('Escape leaves the lab and the site is back', !after.active && after.hud !== 'none' && after.lab);
await shot('site-after');
await page.keyboard.press('u'); await settle(900);
ok('U opens it again without reloading', await page.evaluate(() => window.__vc.audiLab.active && window.__vc.audiLab.loaded));
await page.keyboard.press('g'); await settle(300);
ok('the site keys stay out of the lab', await page.evaluate(() => window.__vc.audiLab.active));
await page.click('#audi-lab .al-back'); await settle(500);

ok('no JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
ok('no failed requests', failed.length === 0, failed.slice(0, 3).join(' | '));

await browser.close();
server.close();
const bad = results.filter(r => !r.pass);
console.log(bad.length ? `\n${bad.length} of ${results.length} failed` : `\nAudi Lab: ${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
