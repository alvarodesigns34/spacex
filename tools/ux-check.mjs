/** Responsive and modal interaction regression gate. Medium rendering, DPR 2.
 * Screenshots/report are written outside the repository to ../ux-after.
 * Run: node tools/ux-check.mjs
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, '..', 'ux-after');
const PORT = 8807;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(staticHandler(ROOT, TYPES));
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
  const selectors = ['.hud-header', '.sheet', '.rail', '.tools', '.presets', '.mission', '.coach'];
  const boxes = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect();
    if (!r || !r.width || !r.height || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
    boxes[selector] = { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }
  const outside = Object.entries(boxes).filter(([, r]) => r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map(([s]) => s);
  const pairs = [['.hud-header', '.sheet'], ['.rail', '.tools'], ['.rail', '.presets'], ['.tools', '.presets'], ['.mission', '.tools'], ['.mission', '.rail'], ['.mission', '.sheet'],
    ['.coach', '.hud-header'], ['.coach', '.sheet'], ['.coach', '.rail'], ['.coach', '.tools'], ['.coach', '.presets']];
  const overlap = pairs.filter(([a, b]) => {
    const p = boxes[a], q = boxes[b];
    return p && q && Math.min(p.right, q.right) - Math.max(p.x, q.x) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.y, q.y) > 1;
  });
  return { boxes, outside, overlap };
});
// A DPR-2 frame of a wide view in software rendering can take longer than Playwright's 30 s
// default on a shared runner; the check is about layout, not frame time (profile-check is).
const SHOT_MS = 120000;
// The same holds for clicks: Playwright waits for the target to be stable over two animation
// frames, and the first frames after the 1920×1080 → 390×844 resize are that slow. On the
// runner the dock click took 29.6 s in a passing run and timed out at 30 s in the next.
page.setDefaultTimeout(SHOT_MS);
try {
  console.log('Loading once at medium quality, DPR 2');
  await page.goto(`http://127.0.0.1:${PORT}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__vc && !document.getElementById('loading'), null, { timeout: 300000 });
  report(await page.evaluate(() => window.__vc.quality.name === 'medium' && devicePixelRatio === 2), 'Explicit medium quality and DPR 2');
  // The first-visit tips are measured at every size like the rest of the HUD: shown, and
  // held (no timer), so an overlap cannot hide behind their 20 s fade.
  await page.evaluate(() => { try { localStorage.removeItem('vc-coach-seen-1'); } catch {} window.__vc.hud.showCoach(0); });
  const sizes = [[360, 800], [390, 844], [430, 932], [768, 1024], [844, 390], [1024, 768], [1366, 768], [1440, 900], [1920, 1080]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      window.__vc.launch.reset(false); window.__vc.jump('falcon1', 'overview');
      if (!document.getElementById('sheet').classList.contains('collapsed')) document.getElementById('sheet-toggle').click();
    });
    await page.waitForTimeout(180);
    let r = await bounds();
    report(!r.outside.length && !r.overlap.length, `${width}x${height} exhibit controls`, r);
    if ([390, 844, 1366].includes(width)) await page.screenshot({ path: join(OUT, `exhibit-${width}x${height}.jpg`), type: 'jpeg', quality: 82, timeout: SHOT_MS });
    await page.evaluate(() => window.__vc.launch.seek(6));
    // ResizeObserver publishes the panel's measured height after layout; wait for that
    // real condition instead of assuming a 180 ms software-rendered frame has completed.
    await page.waitForFunction(() => Math.abs(
      Number.parseFloat(document.getElementById('hud').style.getPropertyValue('--mission-height'))
      - document.getElementById('mission').getBoundingClientRect().height) < 1, null, { timeout: 30000 });
    r = await bounds();
    report(!r.outside.length && !r.overlap.length, `${width}x${height} launch controls`, r);
    if ([390, 844].includes(width)) await page.screenshot({ path: join(OUT, `launch-${width}x${height}.jpg`), type: 'jpeg', quality: 82, timeout: SHOT_MS });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__vc.launch.reset(false); window.__vc.jump('falcon1', 'overview'); });
  await page.click('#dock-vehicles');
  const panel = await page.evaluate(() => {
    const rail = document.querySelector('.rail');
    const box = rail.getBoundingClientRect();
    const kids = [...rail.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && (r.right > box.right + 1 || r.left < box.left - 1);
    }).map((el) => el.className);
    return {
      scrollWidth: rail.scrollWidth, clientWidth: rail.clientWidth, scrollLeft: rail.scrollLeft, kids,
    };
  });
  report(panel.scrollWidth <= panel.clientWidth + 1 && panel.scrollLeft === 0 && panel.kids.length === 0,
    '390 vehicle panel content does not overflow horizontally', panel);
  await page.click('.rail-item');
  report(await page.evaluate(() => !document.querySelector('.rail').classList.contains('is-open')),
    'Selecting a vehicle closes the mobile dock');
  await page.click('#dock-views');
  await page.click('.preset');
  report(await page.evaluate(() => !document.querySelector('#presets').classList.contains('is-open')),
    'Selecting a view closes the mobile dock');
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
  // The dock checks above leave a phone viewport, where Help lives inside a closed panel.
  await page.setViewportSize({ width: 1920, height: 1080 });
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

  // Keyboard toggles fire once per press: a held G used to start and stop the launch on every
  // auto-repeat, and the browser's own Ctrl+L / Ctrl+R flipped the labels and the ruler.
  const toggles = () => page.evaluate(() => ({ run: window.__vc.launch.running, ...window.__vc.viewState().toggles }));
  const t0 = await toggles();
  await page.keyboard.down('g');
  for (let i = 0; i < 3; i++) await page.keyboard.down('g');
  await page.keyboard.up('g');
  await page.keyboard.press('Control+l');
  const t1 = await toggles();
  report(t1.run === !t0.run && t1.labels === t0.labels, 'Held G toggles the launch once; Ctrl+L leaves the labels alone', { t0, t1 });
  await page.keyboard.press('g');
  // Space is "up" in free flight, and after clicking the mode button it also pressed that
  // button, dropping the visitor straight back to orbit.
  await page.click('#mode-btn');
  await page.keyboard.down(' ');
  await page.waitForTimeout(200);
  await page.keyboard.up(' ');
  report(await page.evaluate(() => window.__vc.rig.mode === 'fly'), 'Space in free flight does not press the focused mode button');
  await page.evaluate(() => window.__vc.rig.setMode('orbit'));

  // Accessible selection state. The vehicle rail and the view bar announced themselves as tab
  // lists without behaving as tabs, and the speed buttons carried no state at all. Read from
  // the accessibility tree (Playwright's role queries), not from classes.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { const v = window.__vc; v.launch.reset(false); v.jump('falcon9', 'interstage'); });
  await page.waitForTimeout(300);
  const pressed = async (group) => page.getByRole('group', { name: group }).getByRole('button', { pressed: true }).allInnerTexts();
  const a11y = { vehicles: await pressed('Vehicles'), views: await pressed('Views') };
  // Speed, with a real click on the ×5 button of a running sequence.
  await page.evaluate(() => window.__vc.launch.start());
  await page.getByRole('group', { name: 'Playback speed' }).getByRole('button', { name: 'Speed ×5' }).click();
  await page.waitForFunction(() => window.__vc.launch.state.speed === 5 && document.querySelector('#mission-speeds [aria-pressed="true"]')?.dataset.k === '5', null, { timeout: 60000 }).catch(() => {});
  a11y.speed = await pressed('Playback speed');
  a11y.tabs = await page.locator('[role="tab"], [role="tablist"]').count();
  report(a11y.vehicles.length === 1 && /Falcon 9/.test(a11y.vehicles[0]) && a11y.views.length === 1 && /grid fins/i.test(a11y.views[0])
    && a11y.speed.length === 1 && a11y.speed[0].includes('×5') && a11y.tabs === 0,
    'Vehicle, view and speed each expose exactly one pressed button; no fake tabs', a11y);

  // Contrast and size, measured. Every visible text in the HUD against its real background:
  // translucent panels are composited over WHITE, the worst the scene can put behind them (a
  // bright sky, a cloud). AA: 4.5:1, or 3:1 for large text. Telemetry and the composite-demo
  // notice must also be at least 11 px. The old palette is put back as the negative control.
  const contrast = () => page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const over = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
    const fails = [], small = [];
    let checked = 0;
    for (const el of document.querySelectorAll('#hud *')) {
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.closest('[aria-hidden="true"], .hidden, kbd')) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || r.bottom < 0 || r.top > innerHeight) continue;
      let hiddenAnc = false;
      for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) { hiddenAnc = true; break; } }
      if (hiddenAnc) continue;
      const chain = [];
      for (let a = el; a && a !== document.body; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c.a > 0) chain.push(c); }
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      for (const c of chain.reverse()) bg = over(c, bg);
      const fg = over(parse(cs.color), bg);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
      checked++;
      const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} «${el.textContent.trim().slice(0, 24)}»`;
      if (ratio < (large ? 3 : 4.5)) fails.push(`${name} ${ratio.toFixed(2)}:1`);
      if (el.closest('.mission') && px < 11) small.push(`${name} ${px.toFixed(1)} px`);
    }
    return { checked, fails, small };
  });
  const contrastSizes = [[390, 844], [834, 1112], [1440, 900]];
  for (const [w, h] of contrastSizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { const s = document.getElementById('sheet'); if (s.classList.contains('collapsed')) document.getElementById('sheet-toggle').click(); });
    await page.waitForTimeout(300);
    const c = await contrast();
    report(c.checked > 20 && !c.fails.length && !c.small.length, `${w}x${h} HUD text meets AA contrast over a white sky, telemetry ≥ 11 px`,
      { checked: c.checked, fails: c.fails.slice(0, 6), small: c.small.slice(0, 6) });
  }
  const oldPalette = await page.addStyleTag({ content: ':root { --surface-solid: rgba(18, 20, 24, 0.72) !important; --ink-muted: #a09c94 !important; --ink-faint: #6c6963 !important; } .mt-row i { font-size: 0.62rem !important; }' });
  const oldC = await contrast();
  report(oldC.fails.length > 0 && oldC.small.length > 0, 'Negative control rejects the old faint palette and 9 px telemetry',
    { fails: oldC.fails.length, small: oldC.small.length });
  await oldPalette.evaluate(el => el.remove());
  await page.evaluate(() => {
    const v = window.__vc; v.launch.reset(false); v.jump('falcon1', 'overview');
    // Leave the exhibit and the collapsed sheet as the negative control below expects them.
    if (!document.getElementById('sheet').classList.contains('collapsed')) document.getElementById('sheet-toggle').click();
  });

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
