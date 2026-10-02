/** Desktop layout and modal interaction regression gate. Medium rendering, DPR 1.
 * (Phones and tablets were retired on 28 Sep 2026: the simulation is designed for a desktop.)
 * Screenshots/report are written outside the repository to ../ux-after.
 * Run: node tools/ux-check.mjs
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const results = [];
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const report = (ok, label, detail) => {
  results.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
};
const bounds = () => page.evaluate(() => {
  const selectors = ['.hud-header', '.sheet', '.rail', '.tools', '.presets', '.mission', '.coach', '.tour-card'];
  const boxes = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect();
    if (!r || !r.width || !r.height || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
    boxes[selector] = { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }
  const outside = Object.entries(boxes).filter(([, r]) => r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map(([s]) => s);
  const pairs = [['.hud-header', '.sheet'], ['.rail', '.tools'], ['.rail', '.presets'], ['.tools', '.presets'], ['.mission', '.tools'], ['.mission', '.rail'], ['.mission', '.sheet'],
    ['.coach', '.hud-header'], ['.coach', '.sheet'], ['.coach', '.rail'], ['.coach', '.tools'], ['.coach', '.presets'],
    ['.tour-card', '.hud-header'], ['.tour-card', '.sheet'], ['.tour-card', '.rail'], ['.tour-card', '.tools'], ['.tour-card', '.presets']];
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
// frames, and the first frames after a resize are that slow. On the runner one click took
// 29.6 s in a passing run and timed out at 30 s in the next.
page.setDefaultTimeout(SHOT_MS);
try {
  console.log('Loading once at medium quality, DPR 1');
  await page.goto(`http://127.0.0.1:${PORT}/?quality=medium`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__vc && !document.getElementById('loading'), null, { timeout: 300000 });
  report(await page.evaluate(() => window.__vc.quality.name === 'medium' && devicePixelRatio === 1), 'Explicit medium quality and DPR 1');
  // The first-visit tips are measured at every size like the rest of the HUD: shown, and
  // held (no timer), so an overlap cannot hide behind their 20 s fade.
  await page.evaluate(() => { try { localStorage.removeItem('vc-coach-seen-1'); } catch {} window.__vc.hud.showCoach(0); });
  const sizes = [[1024, 768], [1280, 800], [1366, 768], [1440, 900], [1920, 1080]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      window.__vc.launch.reset(false); window.__vc.jump('falcon1', 'overview');
      if (!document.getElementById('sheet').classList.contains('collapsed')) document.getElementById('sheet-toggle').click();
    });
    await page.waitForTimeout(180);
    let r = await bounds();
    report(!r.outside.length && !r.overlap.length, `${width}x${height} exhibit controls`, r);
    if (width === 1366) await page.screenshot({ path: join(OUT, `exhibit-${width}x${height}.jpg`), type: 'jpeg', quality: 82, timeout: SHOT_MS });
    await page.evaluate(() => window.__vc.launch.seek(6));
    // ResizeObserver publishes the panel's measured height after layout; wait for that
    // real condition instead of assuming a 180 ms software-rendered frame has completed.
    // 60 s like the file's other frame-bound waits: the first launch frame at 1024 × 768 is
    // the slowest of the run, and one runner took over 30 s for it (1 Oct 2026).
    await page.waitForFunction(() => Math.abs(
      Number.parseFloat(document.getElementById('hud').style.getPropertyValue('--mission-height'))
      - document.getElementById('mission').getBoundingClientRect().height) < 1, null, { timeout: 60000 });
    r = await bounds();
    report(!r.outside.length && !r.overlap.length, `${width}x${height} launch controls`, r);
    if (width === 1366) await page.screenshot({ path: join(OUT, `launch-${width}x${height}.jpg`), type: 'jpeg', quality: 82, timeout: SHOT_MS });
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
  // After dragging the Sun slider the focus stays on it, and the handler ignored every INPUT, so
  // all the shortcuts went dead until a click elsewhere. A range input does not type.
  await page.focus('#sun').catch(() => {});
  const lab0 = await toggles();
  await page.keyboard.press('l');
  const lab1 = await toggles();
  await page.keyboard.press('l');
  report(await page.evaluate(() => document.activeElement?.id === 'sun') && lab1.labels === !lab0.labels, 'Shortcuts still work with the Sun slider focused', { before: lab0.labels, after: lab1.labels });
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
  // Read at once: the state must change with the click, not a frame later.
  a11y.speed = await pressed('Playback speed');
  a11y.applied = await page.evaluate(() => window.__vc.launch.state.speed);
  a11y.tabs = await page.locator('[role="tab"], [role="tablist"]').count();
  report(a11y.vehicles.length === 1 && /Falcon 9/.test(a11y.vehicles[0]) && a11y.views.length === 1 && /grid fins/i.test(a11y.views[0])
    && a11y.speed.length === 1 && a11y.speed[0].includes('×5') && a11y.applied === 5 && a11y.tabs === 0,
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
  const contrastSizes = [[1024, 768], [1440, 900], [1920, 1080]];
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

  // Negative control: an oversized header running into the sheet must be caught.
  await page.setViewportSize({ width: 1024, height: 768 });
  const sabotage = await page.addStyleTag({ content: '.hud-header { width: 900px !important; max-width: none !important; }' });
  const broken = await bounds();
  report(broken.overlap.some(p => p.includes('.hud-header') && p.includes('.sheet')), 'Negative control rejects old narrow header/sheet overlap', broken.overlap);
  await sabotage.evaluate(el => el.remove());

  // ---- Round of 28 Sep 2026 -------------------------------------------------------------
  // Everything below is driven by real keys and clicks where a visitor would use them.
  await page.setViewportSize({ width: 1440, height: 900 });
  const settle = (ms = 400) => page.evaluate(async (ms) => { const f = () => new Promise(r => requestAnimationFrame(r)); await f(); await new Promise(r => setTimeout(r, ms)); await f(); }, ms);

  // Mission transport: pause, slow motion, seek on the profile, milestone keys, restart.
  await page.evaluate(() => { const v = window.__vc; v.launch.reset(false); v.jump('starship', 'overview'); document.activeElement?.blur?.(); });
  await page.keyboard.press('g');
  await page.waitForFunction(() => window.__vc.launch.running);
  await page.click('#mission-pause');
  const p0 = await page.evaluate(() => window.__vc.launch.state.t);
  await page.waitForTimeout(1500);
  const paused = await page.evaluate(() => ({ t: window.__vc.launch.state.t, p: window.__vc.launch.state.paused, pressed: document.getElementById('mission-pause').getAttribute('aria-pressed') }));
  report(paused.p && paused.pressed === 'true' && paused.t === p0, 'Pause holds the mission clock and says so', { p0, paused });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('k');
  // Software frames take seconds at this size: wait for the clock to move, not a fixed delay.
  await page.waitForFunction((p0) => window.__vc.launch.state.t > p0, p0, { timeout: 60000 }).catch(() => {});
  const resumed = await page.evaluate(() => ({ t: window.__vc.launch.state.t, p: window.__vc.launch.state.paused }));
  report(!resumed.p && resumed.t > p0, 'K resumes the clock', { p0, resumed });
  await page.click('#mission-speeds button[data-k="0.25"]');
  report(await page.evaluate(() => window.__vc.launch.state.speed === 0.25 && document.querySelector('#mission-speeds button[data-k="0.25"]').getAttribute('aria-pressed') === 'true'), 'Slow motion ×¼ is applied and pressed');
  const box = await page.locator('#mission-plot').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForFunction(() => window.__vc.launch.state.t > 150, null, { timeout: 60000 }).catch(() => {});
  const seekT = await page.evaluate(() => window.__vc.launch.state.t);
  const ev = await page.evaluate(async () => { const { EVENTS } = await import('/src/sim/launch.js'); return EVENTS; });
  const mid = ev.start + 0.5 * (ev.end - ev.start);
  report(Math.abs(seekT - mid) < 4, 'A click on the flight profile jumps the mission there', { seekT, want: mid });
  await page.evaluate(() => { window.__vc.launch.setPaused(true); document.activeElement?.blur?.(); });
  await page.keyboard.press('ArrowRight');
  const step = await page.evaluate(() => ({ t: window.__vc.launch.state.t, next: window.__vc.hud.milestoneStep(window.__vc.launch.state.t - 1, 1) }));
  report(Math.abs(step.t - step.next) < 1e-6 && step.t > seekT, '→ jumps to the next milestone', step);
  await page.click('#mission-restart');
  await page.waitForTimeout(300);
  report(await page.evaluate(() => window.__vc.launch.state.t < -38 && !window.__vc.launch.state.paused), 'Restart goes back to T−40 and runs');
  const tour0 = await bounds();
  report(!tour0.outside.length && !tour0.overlap.length, '1440x900 launch controls with the transport row', tour0);
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('g');
  await page.waitForFunction(() => !window.__vc.launch.running);

  // Hidden tab: the audio context is suspended, and resumed on return.
  await page.evaluate(() => { const v = window.__vc; v.launch.reset(false); v.launch.start(); });
  await page.evaluate(() => { const b = document.getElementById('mission-sound'); if (b.getAttribute('aria-pressed') !== 'true') b.click(); });
  await page.waitForTimeout(500);
  const audio = await page.evaluate(async () => {
    const v = window.__vc, st = () => v.sound.contextState;
    const set = (hidden) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); document.dispatchEvent(new Event('visibilitychange')); };
    const before = st();
    set(true); await new Promise(r => setTimeout(r, 400)); const hidden = st();
    set(false); await new Promise(r => setTimeout(r, 400)); const shown = st();
    delete document.hidden;
    document.getElementById('mission-sound').click();
    v.launch.reset(false);
    return { before, hidden, shown };
  });
  report(audio.hidden === 'suspended' && audio.shown === 'running', 'Sound is suspended while the tab is hidden and resumes on return', audio);

  // Free flight: the floor is the ground, not a flat 0,4 m (a loma rises ~7 m here).
  await page.evaluate(() => { window.__vc.__ground = window.__vc.rig.groundAt; });
  const measureFly = async (sabotage) => {
    const g = await page.evaluate((sabotage) => {
      const v = window.__vc; const g = v.__ground(-760, 200);
      v.rig.groundAt = sabotage ? () => 0 : v.__ground;
      if (v.rig.mode !== 'fly') v.toggleMode();
      v.camera.position.set(-760, g + 3, 200); v.rig.look.pitch = -0.3;
      document.activeElement?.blur?.();
      return g;
    }, sabotage);
    // The key is held for real; the rig is stepped here, because a software frame advances the
    // view by at most 0,05 s and a wall-clock wait would move the camera a few centimetres.
    await page.keyboard.down('q');
    await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__vc.rig.update(0.05); });
    await page.keyboard.up('q');
    const y = await page.evaluate(() => { const v = window.__vc; const y = v.camera.position.y; v.rig.groundAt = v.__ground; return y; });
    return { g, y };
  };
  const flyOk = await measureFly(false);
  report(flyOk.g > 3 && flyOk.y >= flyOk.g + 0.39, 'Free flight stops at the ground over a loma', flyOk);
  const flyBad = await measureFly(true);
  await page.evaluate(() => { const v = window.__vc; if (v.rig.mode === 'fly') v.toggleMode(); });
  report(flyBad.y < flyBad.g, 'Negative control: a flat floor sinks into the loma', flyBad);

  // Riding the launch: take the camera with a real drag, let the mission run on, and the
  // vehicle is still in frame at the same distance. Negative control: with the ride switched
  // off (follow 'none', the pre-28-09 behaviour), the same run leaves the rocket behind.
  const ride = async (sabotage) => {
    await page.evaluate(() => { const v = window.__vc; v.launch.reset(false); v.launch.start(); v.launch.seek(30); v.launch.setSpeed(0); });
    await settle();
    const c = await page.locator('#scene').boundingBox();
    await page.mouse.move(c.x + c.width * 0.6, c.y + c.height * 0.5);
    await page.mouse.down(); await page.mouse.move(c.x + c.width * 0.66, c.y + c.height * 0.48, { steps: 4 }); await page.mouse.up();
    return page.evaluate(async (sabotage) => {
      const v = window.__vc; const THREE = await import('three');
      if (sabotage) v.launch.state.follow = 'none';
      const ship = v.exhibits.starship.model.getObjectByName('ship');
      const where = () => { v.scene.updateMatrixWorld(true); const p = ship.getWorldPosition(new THREE.Vector3()); return { d: p.distanceTo(v.camera.position), ndc: p.clone().project(v.camera) }; };
      v.launch.setSpeed(1);
      const w0 = where();
      for (let i = 0; i < 40; i++) v.launch.update(0.5);     // 20 s of mission, 30 → 50 km/h … 1 400 km/h
      v.camera.updateMatrixWorld();
      const w1 = where();
      const director = v.launch.state.director;
      v.launch.reset(false);
      return { director, d0: +w0.d.toFixed(0), d1: +w1.d.toFixed(0), x: +w1.ndc.x.toFixed(2), y: +w1.ndc.y.toFixed(2), inFrame: Math.abs(w1.ndc.x) < 1 && Math.abs(w1.ndc.y) < 1 && w1.ndc.z < 1 };
    }, sabotage);
  };
  const rideOk = await ride(false);
  report(!rideOk.director && rideOk.inFrame && Math.abs(rideOk.d1 - rideOk.d0) < 0.2 * rideOk.d0 + 30, 'A dragged camera rides with the rocket: still in frame, same distance, 20 s on', rideOk);
  const rideBad = await ride(true);
  report(!rideBad.inFrame || rideBad.d1 > 3 * rideBad.d0, 'Negative control: without the ride the rocket leaves the camera behind', rideBad);
  // C cycles the launch camera: director → riding the booster → riding the ship → director.
  const cams = await page.evaluate(async () => {
    const v = window.__vc; v.launch.reset(false); v.launch.start(); v.launch.seek(200); v.launch.setSpeed(0);
    const seen = [];
    const read = () => (v.launch.state.director ? 'director' : v.launch.state.follow);
    seen.push(read());
    for (let i = 0; i < 3; i++) { document.activeElement?.blur?.(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC' })); seen.push(read()); }
    const label = document.getElementById('mission-cam').textContent;
    v.launch.reset(false);
    return { seen, label };
  });
  report(cams.seen.join(',') === 'director,booster,ship,director', 'C cycles director → booster → ship → director', cams);

  // Hot staging: the ship's plume and jets stop at the booster's dome while it is in the way,
  // instead of running on through the booster; the unclipped plume would have reached past it.
  const hs = await page.evaluate(async () => {
    const v = window.__vc; const THREE = await import('three');
    const model = v.exhibits.starship.model, ship = model.getObjectByName('ship'), booster = model.getObjectByName('superheavy');
    const plume = v.scene.getObjectByName('plume-ship');
    const rows = [];
    const { EVENTS } = await import('/src/sim/launch.js');
    for (const t of [-1, -0.4, 0, 0.3].map(d => EVENTS.separation + d)) {
      v.launch.seek(t); v.scene.updateMatrixWorld(true);
      const exit = ship.localToWorld(new THREE.Vector3()), stack = v.exhibits.starship.model.userData.stations?.booster?.ringTop ?? 70.47;
      const dome = booster.localToWorld(new THREE.Vector3(0, stack + 0.9, 0));
      const reach = Math.max(...plume.children.filter(c => c.isMesh).map(c => c.scale.y));
      const down = ship.localToWorld(new THREE.Vector3(0, -1, 0)).sub(exit).normalize();
      const inPath = dome.clone().sub(exit).normalize().dot(down) > Math.cos(THREE.MathUtils.degToRad(22));
      rows.push({ t, gap: +exit.distanceTo(dome).toFixed(1), reach: +reach.toFixed(1), inPath });
    }
    v.launch.reset(false);
    return rows;
  });
  report(hs.filter(r => r.inPath).length >= 3 && hs.every(r => !r.inPath || r.reach <= r.gap + 0.01), 'Hot staging: the ship plume stops at the booster dome while it is in the way', hs);

  // Walking: eye height over the ground, moving on W, stopped by an exhibit's footprint.
  await page.evaluate(() => { const v = window.__vc; v.jump('falcon9', 'overview'); document.activeElement?.blur?.(); });
  await page.keyboard.press('v');
  const w0 = await page.evaluate(() => { const v = window.__vc, p = v.camera.position; return { mode: v.rig.mode, eye: p.y - v.rig.groundAt(p.x, p.z), x: p.x, z: p.z }; });
  const fov = await page.evaluate(() => window.__vc.camera.fov);
  report(w0.mode === 'walk' && Math.abs(w0.eye - 1.7) < 0.05 && fov === 60, 'V walks at 1.7 m eye height with a 60° field of view', { ...w0, fov });
  // The wheel sets the pace, and says so.
  const box1 = await page.locator('#scene').boundingBox();
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
  const pace0 = await page.evaluate(() => window.__vc.rig.walkSpeed);
  await page.mouse.wheel(0, -120); await page.mouse.wheel(0, -120);
  const pace = await page.evaluate(() => ({ v: window.__vc.rig.walkSpeed, note: document.getElementById('callout').textContent }));
  report(pace.v > pace0 && /Walking pace/.test(pace.note), 'The wheel raises the walking pace and shows it', { pace0, ...pace });
  await page.evaluate(() => { window.__vc.rig.walkLevel = 1; });
  await page.evaluate(() => { const v = window.__vc; v.camera.position.set(-135, 1.7, 30); v.rig.look.yaw = 0; v.rig.look.pitch = 0; });
  await page.keyboard.down('w'); await page.keyboard.down('Shift');
  await page.evaluate(() => { for (let i = 0; i < 250; i++) window.__vc.rig.update(0.05); });
  await page.keyboard.up('Shift'); await page.keyboard.up('w');
  const w1 = await page.evaluate(() => { const v = window.__vc, p = v.camera.position; return { z: p.z, x: p.x, eye: p.y - v.rig.groundAt(p.x, p.z), r: Math.hypot(p.x + 135, p.z) }; });
  report(w1.z < 29 && w1.r >= 9.2 && Math.abs(w1.eye - 1.7) < 0.1, 'Walking moves on W and stops at the Falcon 9 mount', w1);
  await page.keyboard.press('v');
  report(await page.evaluate(() => window.__vc.rig.mode === 'orbit' && window.__vc.camera.fov === 42), 'V again returns to orbit, at 42°');

  // The fence: walking at it from the pad side, the visitor slides along it and stays out.
  await page.evaluate(() => { const v = window.__vc; v.toggleWalk(); v.camera.position.set(0, 1.7, -40); v.rig.look.yaw = Math.PI; v.rig.look.pitch = 0; document.activeElement?.blur?.(); });
  await page.keyboard.down('w');
  await page.evaluate(() => { for (let i = 0; i < 200; i++) window.__vc.rig.update(0.05); });
  await page.keyboard.up('w');
  const fz = await page.evaluate(() => window.__vc.camera.position.z);
  report(fz < -18.2, 'Walking into the site fence stops at it', { z: fz });
  // A double-click on the Dragon from the pad side walks there through the fence gate.
  const trip = await page.evaluate(async () => {
    const v = window.__vc; const THREE = await import('three');
    v.camera.position.set(-20, 6.7, -150); v.rig.look.yaw = 0; v.rig.update(0.05);
    const d = v.exhibits.dragon.lay;
    const hit = { point: new THREE.Vector3(d.x, 4, d.z), object: v.scene.getObjectByName('exhibit-dragon') };
    v.walkRouteFor(hit);
    let nearGate = Infinity, steps = 0;
    while (v.rig.travel && steps++ < 4000) {
      v.rig.update(0.05);
      const p = v.camera.position;
      if (Math.abs(p.z + 18) < 1.5) nearGate = Math.min(nearGate, Math.abs(p.x - 49.5));
    }
    const p = v.camera.position;
    const out = { steps, nearGate: +nearGate.toFixed(1), dist: +Math.hypot(p.x - d.x, p.z - d.z).toFixed(1), eye: +(p.y - v.rig.groundAt(p.x, p.z)).toFixed(2) };
    v.toggleWalk();
    return out;
  });
  report(trip.steps < 4000 && trip.nearGate < 4 && trip.dist > 3 && trip.dist < 12 && Math.abs(trip.eye - 1.7) < 0.05, 'Double-click walks to the Dragon through the fence gate', trip);

  // The same trip from a real double-click, standing three metres from the fence: from there
  // every line of sight to the Dragon passes through the wire, and the pick used to stop on it
  // — the trip went out of the gate and back round to the far face of the fence, and stuck.
  // Negative control: with the fence renamed, so the pick no longer looks through it, the trip
  // must fail the same way the report described.
  const clickTrip = async (seeThrough) => {
    const at = await page.evaluate(async (seeThrough) => {
      const v = window.__vc; const THREE = await import('three');
      if (v.rig.mode !== 'walk') v.toggleWalk();
      const fence = []; v.scene.getObjectByName('campus').traverse(o => { if (/^site-fence/.test(o.name)) fence.push(o); });
      if (!seeThrough) for (const o of fence) o.name = 'x-' + o.name;
      const d = v.exhibits.dragon.lay;
      v.camera.position.set(d.x + 6, 1.7, -21);
      const aim = new THREE.Vector3(d.x, 3, d.z);
      v.rig.look.yaw = Math.atan2(-(aim.x - v.camera.position.x), -(aim.z - v.camera.position.z));
      v.rig.look.pitch = 0; v.rig.update(0.05); v.camera.updateMatrixWorld();
      const ndc = aim.clone().project(v.camera);
      const r = v.renderer.domElement.getBoundingClientRect();
      // Precondition: the first solid thing along that ray is the fence.
      const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), v.camera);
      const first = rc.intersectObjects(v.scene.children, true).find(h => h.object.isMesh && !h.object.material?.transparent);
      return { x: r.left + (ndc.x + 1) / 2 * r.width, y: r.top + (1 - ndc.y) / 2 * r.height, first: first?.object.name ?? null };
    }, seeThrough);
    await page.mouse.dblclick(at.x, at.y);
    const out = await page.evaluate(() => {
      const v = window.__vc, d = v.exhibits.dragon.lay;
      let steps = 0;
      while (v.rig.travel && steps++ < 4000) v.rig.update(0.05);
      const p = v.camera.position;
      return { steps, x: +p.x.toFixed(1), z: +p.z.toFixed(1), dist: +Math.hypot(p.x - d.x, p.z - d.z).toFixed(1) };
    });
    await page.evaluate(() => {
      const v = window.__vc;
      v.scene.getObjectByName('campus').traverse(o => { if (/^x-site-fence/.test(o.name)) o.name = o.name.slice(2); });
      if (v.rig.mode === 'walk') v.toggleWalk();
    });
    return { ...out, first: at.first };
  };
  const through = await clickTrip(true);
  report(/site-fence/.test(through.first ?? '') && through.steps < 4000 && through.dist < 12 && through.z > -18,
    'Double-clicking the Dragon through the fence walks up to the Dragon', through);
  const stuck = await clickTrip(false);
  report(!(stuck.dist < 12 && stuck.z > -18), 'Negative control: a pick that stops on the fence does not reach the Dragon', stuck);

  // Guided tour: a caption with its source, clear of the rest of the HUD.
  for (const [w, h] of [[1440, 900], [1024, 768], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { const v = window.__vc; if (v.tourAt >= 0) v.claimUserControl(); v.startTour(); });
    await settle();
    const card = await page.evaluate(() => ({ shown: !document.getElementById('tour-card').classList.contains('hidden'), text: document.getElementById('tour-text').textContent, src: document.getElementById('tour-src').textContent }));
    const tb = await bounds();
    report(card.shown && card.text.length > 40 && /^Source: /.test(card.src) && !tb.outside.length && !tb.overlap.length, `${w}x${h} guided tour caption with its source, no overlap`, { card, overlap: tb.overlap, outside: tb.outside });
    await page.evaluate(() => window.__vc.claimUserControl());
  }
  report(await page.evaluate(() => document.getElementById('tour-card').classList.contains('hidden')), 'Ending the tour puts its caption away');

  // The mission panel folds to the clock and the controls, and unfolds again.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { window.__vc.hud.hideCoach(); window.__vc.launch.seek(6); });
  await settle();
  const fold0 = await page.evaluate(() => document.getElementById('mission').getBoundingClientRect().height);
  await page.click('#mission-fold'); await settle();
  const fold1 = await page.evaluate(() => ({ compact: document.getElementById('mission').classList.contains('is-compact'), h: document.getElementById('mission').getBoundingClientRect().height }));
  await page.click('#mission-fold'); await settle();
  const fold2 = await page.evaluate(() => document.getElementById('mission').getBoundingClientRect().height);
  report(fold1.compact && fold1.h < fold0 * 0.6 && Math.abs(fold2 - fold0) < 2, 'The mission panel folds and unfolds', { fold0, fold1, fold2 });
  await page.evaluate(() => window.__vc.launch.reset(false));

  // A tall window (a portrait monitor): the overview takes in the whole row. Every exhibit
  // projects inside the frame; the landscape frame, the negative control, leaves some out.
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.waitForFunction(() => window.innerWidth === 900 && window.innerHeight === 1200);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await settle();
  await page.evaluate(() => window.__vc.jump(null));
  await settle();
  const fit = await page.evaluate(async () => {
    const v = window.__vc; const THREE = await import('three');
    // Inside the part of the canvas the rail leaves free. project() already works in the
    // rendered canvas (the view offset is in the projection matrix), so the free part runs from
    // the rail's width, `shift` pixels in, to the right edge.
    const inside = () => Object.values(v.exhibits).filter(ex => ex.lay.z === 0).map(ex => {
      const p = new THREE.Vector3(ex.lay.x, 4, ex.lay.z).project(v.camera);
      const shift = v.camera.view?.enabled ? v.camera.view.fullWidth - innerWidth : 0;
      return p.x >= -1 + 2 * shift / innerWidth && p.x <= 1 && Math.abs(p.y) <= 1;
    });
    v.camera.updateMatrixWorld(); const now = inside();
    const o = v.overviewFor(1.6); v.rig.jumpTo(o.pos, o.target); v.camera.updateMatrixWorld();
    const old = inside();
    v.jump(null);
    return { now: now.filter(Boolean).length, old: old.filter(Boolean).length, total: now.length };
  });
  report(fit.now === fit.total, '900x1200 overview frames every exhibit in the row', fit);
  report(fit.old < fit.total, 'Negative control: the landscape overview in a tall window leaves exhibits out', fit);

  // ---- Re-entry chapter (audit of 30 Sep 2026) --------------------------------------------
  // Started from the walk, with real keys; the sky and the ocean follow the camera after a
  // paused jump; a drag hands the camera over and it rides on the ship; G and a vehicle key
  // end it and put everything back.
  {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { const v = window.__vc; v.launch.reset(false); v.reentry.reset(false); v.jump('starship', 'overview'); });
    await settle(600);
    const base = await page.evaluate(() => { const v = window.__vc; return { far: v.camera.far, tile: v.M.tile.emissiveIntensity, flap: v.M.steelFlap.emissiveIntensity, kind: document.querySelector('.mission-kind').textContent }; });
    await page.evaluate(() => { window.__vc.rig.setMode('walk'); document.activeElement?.blur?.(); });
    await page.keyboard.press('x');
    await page.waitForFunction(() => window.__vc.reentry.running);
    const started = await page.evaluate(() => { const v = window.__vc; return { mode: v.rig.mode, fov: v.camera.fov, live: document.getElementById('reentry-btn').classList.contains('is-live'), launchLive: document.getElementById('launch-btn').classList.contains('is-live') }; });
    report(started.mode === 'orbit' && started.fov === 42 && started.live && !started.launchLive, 'X from the walk: the chapter runs on the orbit camera, Reentry lit', started);

    // Paused, one jump from entry to the splash: the ocean, the planes and the sky are those of
    // where the camera now is, not where it was.
    const consistent = () => page.evaluate(() => {
      const v = window.__vc, y = v.camera.position.y;
      return { y: Math.round(y), ocean: v.scene.getObjectByName('reentry-ocean').visible, near: v.camera.near, ok: v.scene.getObjectByName('reentry-ocean').visible === (y < 15000) && v.camera.near === (y > 20000 ? 2 : 0.5) };
    });
    await page.evaluate(() => { const v = window.__vc; v.reentry.setPaused(true); v.reentry.seek(34150); v.reentry.seek(35440); });
    const jumped = await consistent();
    await settle(800);
    const held = await consistent();
    report(jumped.ok && held.ok && jumped.y < 100, 'A paused jump to the splash brings the ocean and the low sky with it', { jumped, held });
    await page.evaluate(() => { window.__vc.camera.position.y = 120000; });
    const stale = await consistent();
    report(!stale.ok, 'Negative control: a camera moved without the chapter re-applying reads as inconsistent', stale);
    await page.evaluate(() => window.__vc.reentry.seek(35440));
    // The launch's reset with nothing launched (a shot, a key) must not tell the view the vehicle
    // is back on its mount while the re-entry runs: the pad's callouts came back over the Pacific.
    const kept = await page.evaluate(() => { const v = window.__vc; v.launch.reset(false); return { flying: v.view.flying, running: v.reentry.running, pad: v.scene.getObjectByName('labels-pad').visible }; });
    report(kept.flying && kept.running && !kept.pad, 'A launch reset during the re-entry keeps the vehicle flying and the pad callouts away', kept);

    // A drag takes the camera: the scripted shot stops writing it and the orbit rides the ship.
    await page.evaluate(() => { const v = window.__vc; v.reentry.setFollow('director'); v.reentry.seek(35000); v.reentry.setSpeed(1); v.reentry.setPaused(false); });
    const canvas = await page.locator('canvas').first().boundingBox();
    await page.mouse.move(canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.4, { steps: 10 });
    await page.mouse.up();
    // The orbit keeps turning for a while after the release (damping), so what is measured is
    // what riding means: the orbit's centre on the ship, at an unchanged distance, as it falls.
    const offset = () => page.evaluate(() => { const v = window.__vc, h = v.scene.getObjectByName('reentry-ship').position; return { t: v.reentry.state.t, y: Math.round(h.y), dist: v.camera.position.distanceTo(h), centre: v.rig.target.distanceTo(h), external: v.rig.external, cam: document.getElementById('mission-cam').textContent }; });
    const o1 = await offset();
    await page.waitForFunction((t) => window.__vc.reentry.state.t > t + 1.5, o1.t, { timeout: 60000 }).catch(() => {});
    const o2 = await offset();
    const drift = Math.abs(o2.dist - o1.dist);
    // Under 1 000 m: the orbit's 1 600 m ceiling was what a ride starting late clamped to.
    // Falling: at least 25 m/s, a third of the ship's ≈58 m/s there. A fixed 100 m failed on a
    // slow runner that measured 1.7 s apart and saw the ship fall exactly 100 m.
    report(!o1.external && o1.dist < 1000 && drift < 0.5 && o2.centre < 0.5 && o2.y < o1.y - 25 * (o2.t - o1.t) && o2.t > o1.t + 1 && /riding/.test(o2.cam), 'A drag in the re-entry hands over the camera, which rides on the falling ship', { o1, o2, drift });
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('c');
    report(await page.evaluate(() => window.__vc.rig.external && window.__vc.reentry.state.follow === 'onboard'), 'C takes the camera back for the next shot');

    // G while it runs, then G again: the launch hands back the planes the visitor had.
    await page.keyboard.press('g');
    await page.waitForFunction(() => window.__vc.launch.running && !window.__vc.reentry.running);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('g');
    await page.waitForFunction(() => !window.__vc.launch.running);
    await settle(400);
    const afterG = await page.evaluate(() => ({ far: window.__vc.camera.far }));
    report(afterG.far === base.far, 'G during the re-entry, then G: the far plane is the visitor\'s again', { base: base.far, after: afterG.far });

    // A vehicle key during the chapter ends it and restores the ship, its materials and the panel.
    await page.keyboard.press('x');
    await page.waitForFunction(() => window.__vc.reentry.running);
    await page.evaluate(() => { const v = window.__vc; v.reentry.setSpeed(0); v.reentry.seek(34400); document.activeElement?.blur?.(); });
    await page.keyboard.press('3');
    await page.waitForFunction(() => !window.__vc.reentry.running, null, { timeout: 30000 }).catch(() => {});
    const back = await page.evaluate(() => {
      const v = window.__vc, ship = v.exhibits.starship.model.getObjectByName('ship');
      const hidden = v.scene.children.filter(o => (o.name.startsWith('exhibit-') || o.name === 'campus' || o === v.complex) && !o.visible).map(o => o.name);
      return { running: v.reentry.running, inExhibit: !!v.exhibits.starship.model.getObjectById(ship.id), root: v.scene.getObjectByName('reentry').visible, hidden, tile: v.M.tile.emissiveIntensity, flap: v.M.steelFlap.emissiveIntensity, kind: document.querySelector('.mission-kind').textContent };
    });
    report(!back.running && back.inExhibit && !back.root && !back.hidden.length && back.tile === base.tile && back.flap === base.flap && back.kind === base.kind,
      'A vehicle key ends the re-entry: ship home, site shown, heat glow off, the launch\'s panel text back', back);
  }

  // A lost and restored WebGL context keeps the lighting (the reflection probe is rebuilt).
  await page.setViewportSize({ width: 960, height: 540 });
  // ---- The F-16's flight: from the runway, in this same scene, and back to the exhibit ----
  {
    await page.evaluate(() => { window.__vc.jump('f16', 'overview'); });
    await page.waitForTimeout(1500);
    const base = await page.evaluate(() => {
      const v = window.__vc, air = v.scene.getObjectByName('f16-airframe'), p = new v.camera.position.constructor();
      air.getWorldPosition(p);
      return { pos: p.toArray().map(x => +x.toFixed(3)), children: v.scene.children.length, ground: v.env.ground.visible, fov: v.camera.fov };
    });
    await page.keyboard.press('j');
    await page.waitForTimeout(600);
    const started = await page.evaluate(() => {
      const v = window.__vc, F = v.f16fly, s = F.sim.state;
      return {
        running: F.running, wow: s.wow, cls: document.getElementById('hud').classList.contains('is-f16'),
        hud: !document.querySelector('.f16-hud').classList.contains('hidden'),
        onRunway: F.state.readout && Math.abs(F.state.readout.runway.across) < 1 && F.state.readout.runway.along < 120,
        children: v.scene.children.length, ground: v.env.ground.visible, crashed: !!s.crashed,
      };
    });
    report(started.running && started.wow && started.cls && started.hud && started.onRunway && started.ground && !started.crashed,
      'J starts the F-16 on runway 28, on its wheels, with the HUD, in the same scene', started);
    // The exhibit's shortcuts are the flight's while it runs: 2 must not pick the Falcon 1.
    await page.keyboard.press('2');
    await page.waitForTimeout(200);
    report(await page.evaluate(() => window.__vc.f16fly.running && window.__vc.viewState().exhibit === 'f16'), 'While flying, the number keys do not leave the airplane');
    // At idle the engine pushes harder than the tyres roll: the parking brake holds it until the throttle moves.
    const p0 = await page.evaluate(() => window.__vc.f16fly.sim.state.pos.toArray());
    await page.waitForTimeout(2000);
    const held = await page.evaluate((p0) => { const p = window.__vc.f16fly.sim.state.pos; return { moved: Math.hypot(p.x - p0[0], p.z - p0[2]), brake: window.__vc.f16fly.pilot.parking }; }, p0);
    report(held.moved < 0.05 && held.brake, 'The parking brake holds the F-16 on the threshold at idle', held);
    // The flight runs on wall time, not on the view's step clamped to 0.05 s, which slowed it down
    // under 20 fps. The software renderer here draws a frame every few seconds, so what is asserted
    // is the step each frame hands the flight: its real interval, up to 0.5 s.
    const clock = await page.evaluate(async () => {
      const F = window.__vc.f16fly, s = F.sim.state, orig = F.update, seen = [];
      let last = null;
      F.update = (dt) => { const now = performance.now(); if (last !== null) seen.push({ dt, gap: (now - last) / 1000 }); last = now; return orig(dt); };
      const w0 = performance.now();
      while (seen.length < 2 && performance.now() - w0 < 40000) await new Promise(r => setTimeout(r, 200));
      F.update = orig;
      const t0 = s.t; F.update(0.3);
      return { frames: seen.map(x => ({ dt: +x.dt.toFixed(3), gap: +x.gap.toFixed(3) })), step: +(s.t - t0).toFixed(3) };
    });
    const ok = clock.frames.length >= 2 && clock.frames.every(f => Math.abs(f.dt - Math.min(f.gap, 0.5)) < 0.05 + 0.1 * f.gap);
    report(ok && Math.abs(clock.step - 0.3) < 1e-6, 'The flight keeps wall time: each frame hands it its real interval', clock);
    // The simple controls: W held from the threshold (as in the car) opens the throttle and it
    // takes off, climbs and raises the gear by itself, never nosing into the runway; D banks and
    // let go the wings come level; ↓ held towards the ground and Auto-GCAS pulls it out.
    const easy = await page.evaluate(() => {
      const F = window.__vc.f16fly, s = F.sim.state;
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code.slice(-1).toLowerCase(), bubbles: true }));
      const fly = (sec) => { for (let k = 0; k < sec * 30 && !s.crashed; k++) F.update(1 / 30); };
      key('keydown', 'KeyW'); fly(40); key('keyup', 'KeyW');
      const up = { alt: s.agl, gear: F.pilot.gearDown, crashed: s.crashed?.what ?? null };
      key('keydown', 'KeyD'); fly(1.2); const banked = F.state.readout.roll;
      key('keyup', 'KeyD'); fly(4); const level = F.state.readout.roll;
      key('keydown', 'ArrowDown'); fly(30); key('keyup', 'ArrowDown'); fly(10);
      const dive = { crashed: s.crashed?.what ?? null, gcas: F.state.messages.some(m => m.text.includes('GCAS')) || F.state.readout.messages.some(m => m.includes('GCAS')) };
      F.restart();
      return { ...up, banked: +banked.toFixed(1), level: +level.toFixed(1), dive, assist: F.state.assist };
    });
    report(easy.assist && easy.alt > 150 && !easy.gear && !easy.crashed && Math.abs(easy.banked) > 40 && Math.abs(easy.level) < 10 && !easy.dive.crashed,
      'Simple controls: W held takes off and climbs out, D banks and the wings level when let go, a dive at the ground is pulled out', easy);
    // A take-off on the flight model, flown in real time steps by a scripted pilot.
    const flown = await page.evaluate(async () => {
      const v = window.__vc, F = v.f16fly, s = F.sim.state, P = F.pilot;
      F.state.manual = true; P.brake = 0; P.throttle = 1;
      let lift = null;
      for (let k = 0; k < 40 * 30; k++) {
        P.pitch = s.tas > 69 && !lift ? 0.8 : lift ? 0.15 : 0;
        F.update(1 / 30);
        if (!lift && !s.wow && s.agl > 2) lift = { kt: s.tas / 0.514444, t: s.t };
        if (s.pos.y > 400) break;
      }
      F.state.manual = false;
      return { lift, alt: s.pos.y, crashed: s.crashed, outer: v.env.outer.visible, far: v.camera.far, hud: F.state.readout.altFt };
    });
    report(!!flown.lift && !flown.crashed && flown.alt > 300 && flown.outer && flown.far >= 60000,
      'The F-16 takes off in afterburner and climbs out over the same world', flown);
    // The guide opened over the flight owns the keyboard (audit of 2 Oct 2026, H24): Shift+Tab
    // stays inside it, Escape closes the guide and leaves the flight running, and a key held
    // when it opened does not stay held.
    {
      // On the threshold, idle and parked: W held would open the throttle and roll it.
      await page.evaluate(() => window.__vc.f16fly.restart());
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true })));
      await page.keyboard.press('h');
      await page.waitForTimeout(400);
      const open = await page.evaluate(() => !document.getElementById('help').classList.contains('hidden'));
      await page.keyboard.down('Shift');
      for (let k = 0; k < 3; k++) await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      const inHelp = await page.evaluate(() => document.getElementById('help').contains(document.activeElement));
      const held = await page.evaluate(() => { for (let k = 0; k < 30; k++) window.__vc.f16fly.update(1 / 30); return window.__vc.f16fly.pilot.throttle; });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ helpOpen: !document.getElementById('help').classList.contains('hidden'), running: window.__vc.f16fly.running }));
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })));
      report(open && inHelp && !after.helpOpen && after.running && held < 0.5,
        'With the guide open over the flight, Shift+Tab stays in it, Esc closes the guide and not the flight, and W held is let go', { open, inHelp, held, ...after });
    }
    // A gamepad flies the simple controls too (H23): before, they never read it. The right
    // trigger is the throttle, as W: from the threshold the airplane rolls.
    {
      const pad = await page.evaluate(() => {
        const F = window.__vc.f16fly, s = F.sim.state;
        F.restart();
        const g = { connected: true, index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 7, value: i === 7 ? 1 : 0 })) };
        Object.defineProperty(navigator, 'getGamepads', { value: () => [g], configurable: true });
        for (let k = 0; k < 4 * 30; k++) F.update(1 / 30);
        const r = { assist: F.state.assist, throttle: +F.pilot.throttle.toFixed(2), parking: F.pilot.parking, kt: +(s.tas / 0.514444).toFixed(1) };
        g.axes[0] = 0.8;
        for (let k = 0; k < 15; k++) F.update(1 / 30);
        r.steer = +F.pilot.roll.toFixed(2);
        delete navigator.getGamepads;
        F.restart();
        return r;
      });
      report(pad.assist && pad.throttle > 0.5 && !pad.parking && pad.kt > 5 && pad.steer > 0.3,
        'A gamepad drives the simple controls: RT opens the throttle and it rolls, the stick steers on the ground', pad);
    }
    await page.keyboard.press('c');
    await page.waitForTimeout(200);
    report(await page.evaluate(() => window.__vc.f16fly.state.camera === 'cockpit'), 'C goes to the cockpit');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);
    const back = await page.evaluate(() => {
      const v = window.__vc, air = v.scene.getObjectByName('f16-airframe'), p = new v.camera.position.constructor();
      air.getWorldPosition(p);
      return { running: v.f16fly.running, pos: p.toArray().map(x => +x.toFixed(3)), children: v.scene.children.length, cls: document.getElementById('hud').classList.contains('is-f16'), fov: v.camera.fov, external: v.rig.external };
    });
    const same = back.pos.every((x, i) => Math.abs(x - base.pos[i]) < 0.01);
    report(!back.running && same && back.children === base.children && !back.cls && back.fov === base.fov && !back.external,
      'Esc puts the F-16 back on its spot and gives the camera back', { base, back });
  }
  // ---- The Porsche's drive: from its skid pad, in this same scene, and back to the exhibit ----
  {
    await page.evaluate(() => { window.__vc.jump('gt3rs', 'overview'); });
    await page.waitForTimeout(1500);
    const base = await page.evaluate(() => {
      const v = window.__vc, car = v.scene.getObjectByName('gt3rs'), p = new v.camera.position.constructor();
      car.getWorldPosition(p);
      return { pos: p.toArray().map(x => +x.toFixed(3)), children: v.scene.children.length, fov: v.camera.fov };
    });
    await page.keyboard.press('b');
    await page.waitForTimeout(600);
    const started = await page.evaluate(() => {
      const v = window.__vc, D = v.gt3drive, s = D.sim.state;
      return {
        running: D.running, cls: document.getElementById('hud').classList.contains('is-gt3'),
        hud: !document.querySelector('.gt3-hud').classList.contains('hidden'),
        onPad: D.sim.state.surface.every(k => k === 'pad'), speed: s.u, children: v.scene.children.length,
      };
    });
    report(started.running && started.cls && started.hud && started.onPad && Math.abs(started.speed) < 0.1,
      'B starts the Porsche on its skid pad, at rest, with its instruments, in the same scene', started);
    // W pulls away, the gearbox shifts by itself; A with the throttle on turns it without the
    // tail coming round (PSM on); Space tapped with A starts a drift that the throttle holds and
    // the tyres lay marks on the pad; S stops it.
    const drive = await page.evaluate(() => {
      const D = window.__vc.gt3drive, s = D.sim.state;
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code.slice(-1).toLowerCase(), bubbles: true }));
      const run = (codes, sec) => { for (const c of codes) key('keydown', c); for (let k = 0; k < sec * 30; k++) D.update(1 / 30); for (const c of codes) key('keyup', c); };
      run(['KeyW'], 2.2);
      const fast = { kmh: s.u * 3.6, gear: s.gear };
      let grip = 0;
      for (const c of ['KeyW', 'KeyA']) key('keydown', c);
      for (let k = 0; k < 1.2 * 30; k++) { D.update(1 / 30); grip = Math.max(grip, Math.abs(D.state.readout.slide)); }
      key('keyup', 'KeyW');
      run(['Space'], 0.35);
      let slide = 0;
      key('keydown', 'KeyW');
      for (let k = 0; k < 1.2 * 30; k++) { D.update(1 / 30); slide = Math.max(slide, Math.abs(D.state.readout.slide)); }
      for (const c of ['KeyW', 'KeyA']) key('keyup', c);
      const slid = { grip, slide, marks: D.marks.count };
      // S brakes it to a stop (held on, it would then go into reverse, as it should).
      let stopped = false;
      key('keydown', 'KeyS');
      for (let k = 0; k < 4 * 30 && !stopped; k++) { D.update(1 / 30); stopped = Math.hypot(s.u, s.v) < 1; }
      key('keyup', 'KeyS');
      return { ...fast, ...slid, stopped, finite: [s.x, s.z, s.psi].every(Number.isFinite) };
    });
    report(drive.kmh > 50 && drive.gear >= 2 && drive.grip < 8 && drive.slide > 15 && drive.marks > 20 && drive.stopped && drive.finite,
      'W pulls away and shifts, W with A turns without sliding, Space with A drifts and leaves tyre marks, S stops it', drive);
    // The guide opened over the drive owns the keyboard (audit of 2 Oct 2026, H24): Shift+Tab
    // stays inside it, Escape closes the guide and leaves the drive running, and a key held
    // when it opened does not stay held.
    {
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true })));
      await page.keyboard.press('h');
      await page.waitForTimeout(400);
      const open = await page.evaluate(() => !document.getElementById('help').classList.contains('hidden'));
      await page.keyboard.down('Shift');
      for (let k = 0; k < 3; k++) await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      const inHelp = await page.evaluate(() => document.getElementById('help').contains(document.activeElement));
      const held = await page.evaluate(() => { for (let k = 0; k < 30; k++) window.__vc.gt3drive.update(1 / 30); return window.__vc.gt3drive.driver.throttle; });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ helpOpen: !document.getElementById('help').classList.contains('hidden'), running: window.__vc.gt3drive.running }));
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })));
      report(open && inHelp && !after.helpOpen && after.running && held < 0.5,
        'With the guide open over the drive, Shift+Tab stays in it, Esc closes the guide and not the drive, and W held is let go', { open, inHelp, held, ...after });
    }
    await page.keyboard.press('c');
    await page.waitForTimeout(200);
    report(await page.evaluate(() => window.__vc.gt3drive.state.camera === 'driver'), 'C goes to the driver\'s seat');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);
    const back = await page.evaluate(() => {
      const v = window.__vc, car = v.scene.getObjectByName('gt3rs'), p = new v.camera.position.constructor();
      car.getWorldPosition(p);
      return { running: v.gt3drive.running, pos: p.toArray().map(x => +x.toFixed(3)), children: v.scene.children.length, cls: document.getElementById('hud').classList.contains('is-gt3'), fov: v.camera.fov, external: v.rig.external };
    });
    const same = back.pos.every((x, i) => Math.abs(x - base.pos[i]) < 0.01);
    report(!back.running && same && back.children === base.children && !back.cls && back.fov === base.fov && !back.external,
      'Esc puts the Porsche back on its spot and gives the camera back', { base, back });
  }
  const lumaAfterRestore = (sabotage) => page.evaluate(async (sabotage) => {
    const v = window.__vc; const c = v.renderer.domElement;
    v.jump('falcon9', 'overview');
    const luma = () => {
      v.camera.updateMatrixWorld(); v.composer.render();
      const t = document.createElement('canvas'); t.width = 96; t.height = 54;
      const g = t.getContext('2d'); g.drawImage(c, 0, 0, 96, 54); const d = g.getImageData(0, 36, 96, 18).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return s / (d.length / 4);
    };
    const before = luma();
    if (sabotage) c.removeEventListener('webglcontextrestored', v.onContextRestored);
    const ext = v.renderer.getContext().getExtension('WEBGL_lose_context');
    ext.loseContext(); await new Promise(r => setTimeout(r, 1200));
    ext.restoreContext(); await new Promise(r => setTimeout(r, 3000));
    const after = luma();
    if (sabotage) { c.addEventListener('webglcontextrestored', v.onContextRestored); v.env.rebuildProbe(); }
    return { before: +before.toFixed(1), after: +after.toFixed(1) };
  }, sabotage);
  const ctxOk = await lumaAfterRestore(false);
  report(Math.abs(ctxOk.after - ctxOk.before) < 0.08 * ctxOk.before, 'A restored WebGL context keeps the ground lit', ctxOk);
  const ctxBad = await lumaAfterRestore(true);
  report(ctxBad.after < 0.8 * ctxBad.before, 'Negative control: without the probe rebuild the ground goes dark', ctxBad);
  report(!errors.length, 'No uncaught application errors', errors);
} catch (e) { report(false, 'UX check exception', e.stack); }
finally {
  await writeFile(join(OUT, 'report.json'), JSON.stringify({ quality: 'medium', deviceScaleFactor: 2, results }, null, 2));
  await browser.close(); server.close();
}
process.exitCode = results.some(r => !r.ok) ? 1 : 0;
