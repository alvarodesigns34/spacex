/**
 * Headless validation gate.
 *
 * Serves the site, loads it in Chromium and runs the checks the app exposes on
 * `window.__vc.verify()`:
 *   - dimensional: every built model measured against its published envelope;
 *   - integrity:   every mesh checked for uv/normals/finite vertices.
 * It also walks every authored camera view, because a preset that frames the wrong station
 * or produces a non-finite camera is a regression the other two cannot see.
 *
 * Exits non-zero on any failure, so it can gate a deployment.
 *
 * Usage: node tools/check.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8799;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const path = join(ROOT, (rel === '/' || rel === '\\' || rel === '') ? 'index.html' : rel);
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

const consoleErrors = [];
page.on('pageerror', e => consoleErrors.push(`uncaught: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  // The resource URL lives on location(), not in the message text, so both have to be
  // checked: web fonts are a progressive enhancement and are blocked on some CI networks.
  const where = `${m.text()} ${m.location()?.url ?? ''}`;
  if (/fonts\.(googleapis|gstatic)/.test(where)) return;
  consoleErrors.push(where.trim());
});

let failures = 0;
const report = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__vc && !document.getElementById('loading'), null, { timeout: 300000 });

  const { dimensions, pad, scene } = await page.evaluate(() => window.__vc.verify());
  for (const d of dimensions) {
    report(d.ok, `${d.vehicle} · ${d.label}`, `declarado ${d.declared}, construido ${d.built} (${d.errorPct} %)`);
  }
  for (const d of pad) {
    report(d.ok, `pad · ${d.part}`, `declarado ${d.declared} (${d.origen}), construido ${d.built} (${d.errorPct} %)`);
  }
  report(scene.length === 0, 'integridad de la escena',
    scene.length ? scene.map(i => `${i.mesh}: ${i.problem}`).join('; ') : 'uv, normales y vértices correctos');

  // Every authored view must produce a finite camera that stays above the apron.
  const presets = await page.evaluate(() => Object.fromEntries(
    Object.entries(window.__vc.exhibits).map(([id, e]) => [id, e.data.presets.map(p => p.id)])));
  let bad = [];
  for (const [id, list] of Object.entries(presets)) {
    for (const pr of list) {
      await page.evaluate(([i, q]) => window.__vc.jump(i, q), [id, pr]);
      const c = await page.evaluate(() => window.__vc.camera.position.toArray());
      if (!c.every(Number.isFinite) || c[1] < 0.2) bad.push(`${id}/${pr}`);
    }
  }
  report(bad.length === 0, `${Object.values(presets).flat().length} vistas`, bad.length ? `inválidas: ${bad.join(', ')}` : 'todas válidas');

  // ---- Orbital view leaves nothing behind -----------------------------------------------
  // The Roadster's "Tierra al fondo" view swaps the whole presentation: plinth away, payload
  // adapter in, ground, sky and fog off, Earth backdrop on. A one-way switch would leave every
  // other exhibit floating in a black void, so leaving the view has to put it all back.
  // Asserted against absolute expected states, not against a snapshot taken beforehand: the
  // view walk above already passes through this preset, so a "before" reading is not
  // trustworthy — a one-way switch would have contaminated it and the comparison would pass.
  {
    const GROUND = { space: false, ground: true, fog: true, backdrop: false, pedestal: true, adapter: false };
    const SPACE = { space: true, ground: false, fog: false, backdrop: true, pedestal: false, adapter: true };
    const eq = (a, b) => Object.keys(b).every(k => a[k] === b[k]);
    await page.evaluate(() => window.__vc.jump('starship', 'overview'));
    const before = await page.evaluate(() => window.__vc.spaceState());
    await page.evaluate(() => window.__vc.jump('roadster', 'earth'));
    const during = await page.evaluate(() => window.__vc.spaceState());
    await page.evaluate(() => window.__vc.jump('starship', 'overview'));
    const after = await page.evaluate(() => window.__vc.spaceState());
    const ok = eq(before, GROUND) && eq(during, SPACE) && eq(after, GROUND);
    report(ok, 'la vista orbital se monta y se desmonta',
      ok ? 'peana, adaptador, suelo, niebla y cielo entran y vuelven a su sitio'
        : `antes ${JSON.stringify(before)} · dentro ${JSON.stringify(during)} · después ${JSON.stringify(after)}`);
  }

  // ---- Day and night -------------------------------------------------------------------
  // The sun control now runs below the horizon and blends the whole centre into night. Two
  // things have to hold: the blend must be a pure function of the slider (an earlier version
  // read the sky uniforms back and multiplied them, so every call darkened the sky further),
  // and coming back up must restore the day exactly.
  {
    const read = (deg) => page.evaluate((d) => { window.__vc.env.setSun(d, 34); return window.__vc.lightState(); }, deg);
    const day1 = await read(42);
    const nightA = await read(-8);
    const nightB = await read(-8);
    const day2 = await read(42);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const pure = same(nightA, nightB);
    const restored = same(day1, day2);
    const darker = nightA.night > 0.85 && nightA.sun < day1.sun * 0.1 && nightA.sky < day1.sky;
    report(pure && restored && darker, 'el ciclo día/noche es reversible y no se acumula',
      pure && restored && darker
        ? `noche ${nightA.night}, sol ${day1.sun} -> ${nightA.sun}, cielo ${day1.sky} -> ${nightA.sky}`
        : `puro ${pure} · restaura ${restored} · oscurece ${darker} · ${JSON.stringify({ day1, nightA, nightB, day2 })}`);
    await page.evaluate(() => window.__vc.env.setSun(42, 34));
  }

  // ---- Launch sequence -----------------------------------------------------------------
  // The sequence has to be checkable, which is why seek() reproduces the full state for a
  // mission time rather than only advancing. Every milestone must leave finite transforms
  // and a camera above the apron, the profile must never run backwards, and putting the
  // sequence away must leave the scene byte-for-byte as it was found.
  const snapshot = () => page.evaluate(() => {
    const v = window.__vc;
    const f = v.exhibits.starship.flight;
    const parts = v.complex.userData.parts;
    return JSON.stringify({
      flight: [...f.position.toArray(), f.rotation.z],
      ship: v.scene.getObjectByName('ship').position.y,
      booster: [v.scene.getObjectByName('superheavy').position.x, v.scene.getObjectByName('superheavy').rotation.z],
      qd: parts.qdArm.rotation.y,
      clamps: parts.holddowns.children.map(c => c.position.toArray()),
      camera: [v.camera.near, v.camera.far],
      fog: v.scene.fog.density,
      shadows: v.env.sun.castShadow,
    });
  });
  const before = await snapshot();

  // The button is the only way a visitor starts this, so exercise it rather than the API.
  await page.click('#launch-btn');
  const armed = await page.evaluate(() => {
    const st = window.__vc.launch.state;
    return { running: st.running, t: st.t, panel: !document.getElementById('mission').classList.contains('hidden') };
  });
  report(armed.running && armed.panel && armed.t < 0, 'el botón arranca la secuencia',
    `reloj en ${armed.t.toFixed(0)} s, panel ${armed.panel ? 'visible' : 'oculto'}`);

  const times = [-10, -1, 2, 8, 20, 62, 110, 152, 161, 175, 194];
  const badT = [];
  let lastAlt = -1, lastVel = -1, monotonic = true;
  for (const t of times) {
    const r = await page.evaluate((tt) => {
      const v = window.__vc;
      v.launch.seek(tt);
      const f = v.exhibits.starship.flight;
      const st = v.launch.state;
      const nums = [...f.position.toArray(), f.rotation.z, ...v.camera.position.toArray(), st.altitude, st.velocity, st.throttle];
      return { finite: nums.every(Number.isFinite), camY: v.camera.position.y, alt: st.altitude, vel: st.velocity };
    }, t);
    if (!r.finite || r.camY < 0.2) badT.push(`t=${t}`);
    if (r.alt < lastAlt - 1e-6 || r.vel < lastVel - 1e-6) monotonic = false;
    lastAlt = r.alt; lastVel = r.vel;
  }
  report(badT.length === 0, `${times.length} instantes de la secuencia`,
    badT.length ? `inválidos: ${badT.join(', ')}` : 'transformadas finitas y cámara sobre la explanada');
  report(monotonic, 'perfil de ascenso monótono', monotonic ? 'altitud y velocidad no retroceden' : 'la curva retrocede');

  await page.evaluate(() => window.__vc.launch.reset(false));
  const after = await snapshot();
  report(before === after, 'la secuencia deja la escena como la encontró',
    before === after ? 'vehículo, brazo, pinzas, cámara y niebla restaurados' : 'estado residual tras reset()');

  // The clock multiplier is a property of a run. Left behind, the next launch ran at ×10
  // while the panel showed ×1.
  const speed = await page.evaluate(() => {
    const v = window.__vc;
    v.launch.setSpeed(10);
    v.launch.seek(20);
    const during = v.launch.state.speed;
    v.launch.reset(false);
    return { during, after: v.launch.state.speed };
  });
  report(speed.during === 10 && speed.after === 1, 'el multiplicador de tiempo vuelve a ×1',
    `durante la secuencia ×${speed.during}, tras terminarla ×${speed.after}`);

  report(consoleErrors.length === 0, 'consola limpia', consoleErrors.slice(0, 5).join(' | '));
} catch (err) {
  report(false, 'carga de la aplicación', err.message);
} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : '\nTodas las comprobaciones pasan');
process.exit(failures ? 1 : 0);
