/** Responsive and modal interaction regression gate. Medium rendering, DPR 2.
 * Screenshots/report are written outside the repository to ../ux-after.
 * Run: node tools/ux-check.mjs
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, '..', 'ux-after');
const PORT = 8807;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const path = join(ROOT, ['/', '\\', ''].includes(rel) ? 'index.html' : rel);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404).end('not found'); }
});
await mkdir(OUT, { recursive: true });
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const results = [];
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const report = (ok, label, detail) => {
  results.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
};
const bounds = () => page.evaluate(() => {
  const selectors = ['.hud-header', '.sheet', '.rail', '.tools', '.presets', '.mission'];
  const boxes = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect();
    if (!r || !r.width || !r.height || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
    boxes[selector] = { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }
  const outside = Object.entries(boxes).filter(([, r]) => r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map(([s]) => s);
  const pairs = [['.hud-header', '.sheet'], ['.rail', '.tools'], ['.rail', '.presets'], ['.tools', '.presets'], ['.mission', '.tools'], ['.mission', '.rail'], ['.mission', '.sheet']];
  const overlap = pairs.filter(([a, b]) => {
    const p = boxes[a], q = boxes[b];
    return p && q && Math.min(p.right, q.right) - Math.max(p.x, q.x) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.y, q.y) > 1;
  });
  return { boxes, outside, overlap };
});
try {
  console.log('Loading once at medium quality, DPR 2');
  await page.goto(`http://127.0.0.1:${PORT}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__vc && !document.getElementById('loading'), null, { timeout: 300000 });
  report(await page.evaluate(() => window.__vc.quality.name === 'medium' && devicePixelRatio === 2), 'Explicit medium quality and DPR 2');
  const sizes = [[390, 844], [844, 390], [768, 1024], [1366, 768], [1920, 1080]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      window.__vc.launch.reset(false); window.__vc.jump('falcon1', 'overview');
      if (!document.getElementById('sheet').classList.contains('collapsed')) document.getElementById('sheet-toggle').click();
    });
    await page.waitForTimeout(180);
    let r = await bounds();
    report(!r.outside.length && !r.overlap.length, `${width}x${height} exhibit controls`, r);
    if ([390, 844, 1366].includes(width)) await page.screenshot({ path: join(OUT, `exhibit-${width}x${height}.jpg`), type: 'jpeg', quality: 82 });
    await page.evaluate(() => window.__vc.launch.seek(6));
    // ResizeObserver publishes the panel's measured height after layout; wait for that
    // real condition instead of assuming a 180 ms software-rendered frame has completed.
    await page.waitForFunction(() => Math.abs(
      Number.parseFloat(document.getElementById('hud').style.getPropertyValue('--mission-height'))
      - document.getElementById('mission').getBoundingClientRect().height) < 1, null, { timeout: 30000 });
    r = await bounds();
    report(!r.outside.length && !r.overlap.length, `${width}x${height} launch controls`, r);
    if ([390, 844].includes(width)) await page.screenshot({ path: join(OUT, `launch-${width}x${height}.jpg`), type: 'jpeg', quality: 82 });
  }
  await page.evaluate(() => { window.__vc.launch.reset(false); window.__vc.jump('falcon1', 'overview'); });
  const cutaway = await page.evaluate(() => {
    const v = window.__vc, model = v.exhibits.falcon1.model;
    const shell = model.getObjectByName('falcon1-closed-shell');
    const interior = model.getObjectByName('falcon1-reconstructed-interior');
    const initial = shell.visible && !interior.visible;
    v.jump('falcon1', 'cutaway'); v.lod.update();
    const open = !shell.visible && interior.visible && shell.children.length > 0;
    v.jump('dragon', 'overview'); v.lod.update();
    const restored = shell.visible && !interior.visible;
    v.jump('falcon1', 'overview');
    return { initial, open, restored, shellChildren: shell.children.length };
  });
  report(cutaway.initial && cutaway.open && cutaway.restored, 'Falcon 1 cutaway shell group hides and restores across exhibits', cutaway);

  // Fly mode makes W a real movement key; help must block the camera controller too.
  await page.evaluate(() => { window.__vc.jump('falcon1', 'overview'); window.__vc.rig.setMode('fly'); });
  await page.click('#help-btn');
  const modalSnapshot = () => page.evaluate(() => ({
    view: window.__vc.viewState(), launch: window.__vc.launch.running,
    tour: window.__vc.tourAt, camera: window.__vc.camera.position.toArray(),
  }));
  const before = await modalSnapshot();
  for (const key of ['g', 'p', '8']) await page.keyboard.press(key);
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  const after = await modalSnapshot();
  report(JSON.stringify(before) === JSON.stringify(after), 'Help blocks G/P/8/W without changing state or camera', { before, after });
  await page.keyboard.press('Tab');
  report(await page.evaluate(() => document.getElementById('help').contains(document.activeElement)), 'Help traps Tab focus');
  await page.keyboard.press('Escape');
  report(await page.evaluate(() => document.getElementById('help').classList.contains('hidden') && document.activeElement.id === 'help-btn'), 'Escape restores Help button focus');
  await page.evaluate(() => window.__vc.rig.setMode('orbit'));

  // Negative control: recreate the old narrow, oversized header overlapping the sheet.
  await page.setViewportSize({ width: 390, height: 844 });
  const sabotage = await page.addStyleTag({ content: '.hud-header { width: 340px !important; max-width: none !important; } .sheet.collapsed { top: 12px !important; right: 12px !important; }' });
  const broken = await bounds();
  report(broken.overlap.some(p => p.includes('.hud-header') && p.includes('.sheet')), 'Negative control rejects old narrow header/sheet overlap', broken.overlap);
  await sabotage.evaluate(el => el.remove());
  report(!errors.length, 'No uncaught application errors', errors);
} catch (e) { report(false, 'UX check exception', e.stack); }
finally {
  await writeFile(join(OUT, 'report.json'), JSON.stringify({ quality: 'medium', deviceScaleFactor: 2, results }, null, 2));
  await browser.close(); server.close();
}
process.exitCode = results.some(r => !r.ok) ? 1 : 0;
