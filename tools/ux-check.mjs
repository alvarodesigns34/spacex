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
    await page.waitForFunction(() => Math.abs(
      Number.parseFloat(document.getElementById('hud').style.getPropertyValue('--mission-height'))
      - document.getElementById('mission').getBoundingClientRect().height) < 1, null, { timeout: 30000 });
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
  const mid = -40 + 0.5 * (436 + 40);
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
      const v = window.__vc; const g = v.__ground(730, 340);
      v.rig.groundAt = sabotage ? () => 0 : v.__ground;
      if (v.rig.mode !== 'fly') v.toggleMode();
      v.camera.position.set(730, g + 3, 340); v.rig.look.pitch = -0.3;
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
    for (const t of [159.0, 159.6, 160.0, 160.3]) {
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

  // A lost and restored WebGL context keeps the lighting (the reflection probe is rebuilt).
  await page.setViewportSize({ width: 960, height: 540 });
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
