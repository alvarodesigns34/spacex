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

// Dwell of the tour's first stop, in ms. The stop test has to outlast it to mean anything.
const TOUR_FIRST_HOLD_MS = 7000;

let failures = 0;
const report = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  // ?quality=high, always. The tier probe demotes a software rasteriser to the cheapest
  // settings, and CI runs on SwiftShader — without this the gate would be measuring a reduced
  // scene and reporting it as the one visitors get.
  await page.goto(`http://127.0.0.1:${PORT}/index.html?quality=high`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__vc && !document.getElementById('loading'), null, { timeout: 300000 });

  const { dimensions, pad, interfaces, scene } = await page.evaluate(() => window.__vc.verify());
  for (const d of dimensions) {
    report(d.ok, `${d.vehicle} · ${d.label}`, `declarado ${d.declared}, construido ${d.built} (${d.errorPct} %)`);
  }
  for (const d of pad) {
    report(d.ok, `pad · ${d.part}`, `declarado ${d.declared} (${d.origen}), construido ${d.built} (${d.errorPct} %)`);
  }
  // Where two independently built subsystems have to meet. Each of these was wrong.
  for (const d of interfaces) report(d.ok, `interfaz · ${d.interface}`, d.detail);
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

  // The gate must be looking at the scene a visitor with a real GPU gets. If ?quality= is
  // ever dropped or the forcing breaks, every dimensional row above silently starts measuring
  // a reduced scene — and would keep passing, because the reduced scene is self-consistent.
  {
    const q = await page.evaluate(() => {
      const v = window.__vc;
      return { name: v.quality.name, forced: v.quality.forced, shadow: v.env.sun.shadow.mapSize.x, lod: v.lod.pixels };
    });
    report(q.name === 'high' && q.forced && q.shadow === 4096,
      'la comprobación corre con la calidad completa',
      `nivel ${q.name}${q.forced ? ' (forzado)' : ''}, sombras ${q.shadow}, lod ${q.lod} px`);
  }

  // ---- The state machine's own invariants ------------------------------------------------
  // What the centre is showing is one object now (core/viewState.js) rather than seven loose
  // flags, so the rules can be asserted directly instead of inferred from the scene's
  // reaction to them. Each of these held only by convention before, and each was broken at
  // least once: the tour ran on under a launch, the preset tabs disagreed with the camera,
  // a typo'd deep link left the machine in a view that did not exist.
  {
    const S = () => page.evaluate(() => window.__vc.viewState());

    // A requested view an exhibit does not have must resolve to one it does.
    await page.evaluate(() => window.__vc.jump('dragon', 'no-such-view'));
    const resolved = await S();
    report(resolved.exhibit === 'dragon' && resolved.preset === 'overview',
      'una vista inexistente cae en la primera del expositor', `quedó en ${resolved.preset}`);

    // Orbital is derived, never set: it is true for exactly one exhibit, one view, on the
    // ground. Asserting the derivation stops anyone reintroducing it as a flag.
    await page.evaluate(() => window.__vc.jump('roadster', 'earth'));
    const orb = await S();
    await page.evaluate(() => window.__vc.jump('roadster', 'detail'));
    const notOrb = await S();
    report(orb.orbital && !orb.furniture && !notOrb.orbital && notOrb.furniture,
      'la vista orbital se deduce del expositor y la vista',
      `earth ${orb.orbital}/mobiliario ${orb.furniture} · detail ${notOrb.orbital}/mobiliario ${notOrb.furniture}`);

    // Ownership. Each of the three drivers must displace the other two.
    await page.evaluate(() => { window.__vc.stopTour(); window.__vc.launch.reset(false); window.__vc.jump(null); });
    await page.evaluate(() => window.__vc.startTour());
    const owned = await S();
    await page.evaluate(() => window.__vc.launch.start());
    const stolen = await S();
    await page.evaluate(() => window.__vc.select('dragon'));
    const back = await S();
    report(owned.owner === 'tour' && stolen.owner === 'launch' && back.owner === 'user',
      'el dueño de la cámara pasa de visita a lanzamiento a visitante',
      `${owned.owner} -> ${stolen.owner} -> ${back.owner}`);
    await page.evaluate(() => { window.__vc.stopTour(); window.__vc.launch.reset(false); });

    // Churn: twenty view changes back to back must leave one coherent state, not a mixture.
    await page.evaluate(() => {
      const v = window.__vc;
      const ids = Object.keys(v.exhibits);
      for (let i = 0; i < 20; i++) {
        const id = ids[i % ids.length];
        const ps = v.exhibits[id].data.presets;
        v.jump(id, ps[i % ps.length].id);
      }
      v.jump('starlink', 'bus');
    });
    const churn = await S();
    const churnHud = await page.evaluate(() => ({
      rail: document.querySelector('.rail-item.active')?.dataset.id ?? null,
      preset: document.querySelector('.preset.active')?.dataset.preset ?? null,
    }));
    report(churn.exhibit === 'starlink' && churn.preset === 'bus'
      && churnHud.rail === 'starlink' && churnHud.preset === 'bus' && !churn.orbital,
      'veinte cambios de vista seguidos dejan un estado coherente',
      `estado ${churn.exhibit}/${churn.preset} · interfaz ${churnHud.rail}/${churnHud.preset}`);
    await page.evaluate(() => window.__vc.jump(null));
  }

  // Scripted views must keep the selected exhibit and view tab in sync.
  {
    await page.evaluate(() => window.__vc.jump('roadster', 'earth'));
    report(await page.locator('.preset.active').getAttribute('data-preset') === 'earth',
      'la pestaña coincide con la vista orbital');
    await page.evaluate(() => window.__vc.goPreset('starship', 'site'));
    report(await page.locator('.rail-item.active').getAttribute('data-id') === 'starship'
      && await page.locator('.preset.active').getAttribute('data-preset') === 'site'
      && !(await page.evaluate(() => window.__vc.spaceState().space)),
      'cambiar de expositor por preset restaura el entorno y la selección');
    await page.evaluate(() => window.__vc.jump(null));
  }

  // Both entry points for free flight must interrupt the guided tour.
  for (const via of ['button', 'keyboard']) {
    await page.evaluate(() => window.__vc.startTour());
    if (via === 'button') await page.click('#mode-btn');
    else await page.keyboard.press('f');
    const result = await page.evaluate(() => ({ mode: window.__vc.rig.mode, tour: window.__vc.tourAt }));
    report(result.mode === 'fly' && result.tour === -1, `vuelo libre detiene la visita (${via})`);
    await page.evaluate(() => { window.__vc.stopTour(); window.__vc.jump(null); });
  }

  // Releasing a scripted shot in free flight preserves its orientation and does not
  // wake a stale framing transition or enable OrbitControls alongside free flight.
  {
    const result = await page.evaluate(() => {
      const v = window.__vc;
      v.rig.setMode('fly');
      v.launch.seek(62);
      const before = v.camera.quaternion.clone();
      v.rig.releaseExternal();
      v.rig.update(0);
      const same = 1 - Math.abs(before.dot(v.camera.quaternion)) < 1e-9;
      const orbitDisabled = !v.rig.orbit.enabled;
      v.launch.reset(false);
      v.jump(null);
      v.select('falcon9');
      v.launch.start();
      v.rig.releaseExternal();
      const noTransition = !v.rig.transition;
      v.launch.reset(false);
      v.jump(null);
      return same && orbitDisabled && noTransition;
    });
    report(result, 'recuperar la cámara conserva el plano sin controles incompatibles');
    await page.evaluate(() => { window.__vc.startTour(); window.__vc.launch.seek(-10); });
    report(await page.evaluate(() => window.__vc.tourAt === -1 && window.__vc.launch.running),
      'seek también detiene la visita guiada');
    await page.evaluate(() => { window.__vc.stopTour(); window.__vc.launch.reset(false); window.__vc.jump(null); });
  }

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

  // ---- Guided tour ---------------------------------------------------------------------
  // The tour drives the same jump() a visitor drives, so the risk is not that it moves the
  // camera badly but that it never stops: a stray timer keeps re-framing the scene under
  // whatever the visitor does next.
  {
    await page.evaluate(() => window.__vc.startTour());
    const started = await page.evaluate(() => window.__vc.tourAt);
    await page.evaluate(() => window.__vc.stopTour());
    const stopped = await page.evaluate(() => window.__vc.tourAt);
    // Wait past the first stop's dwell. Anything shorter proves nothing: a surviving timer
    // would not have fired yet, and the assertion would pass on a tour that never stops.
    const before = await page.evaluate(() => window.__vc.camera.position.toArray());
    await page.waitForTimeout(TOUR_FIRST_HOLD_MS + 800);
    const after = await page.evaluate(() => window.__vc.camera.position.toArray());
    const still = before.every((v, i) => Math.abs(v - after[i]) < 1e-6);
    const idle = await page.evaluate(() => window.__vc.tourAt);
    const ok = started === 0 && stopped === -1 && still && idle === -1;
    report(ok, 'la visita guiada arranca y se detiene de verdad',
      ok ? 'primer alto encuadrado, y al pararla no queda ningún temporizador moviendo la cámara'
        : `arranque ${started} · parada ${stopped} · cámara quieta ${still} · inactiva ${idle === -1}`);
    await page.evaluate(() => window.__vc.jump(null));
  }

  // ---- The tour and the launch cannot both be driving --------------------------------------
  // Each was tested alone. The combination was not, and it was broken in one direction: the
  // tour reset the launch, the launch did not stop the tour, so its timer went on switching
  // exhibit and preset underneath a sequence that owned the camera.
  {
    const state = () => page.evaluate(() => ({ tour: window.__vc.tourAt, launch: window.__vc.launch.running }));
    const clear = () => page.evaluate(() => { window.__vc.stopTour(); window.__vc.launch.reset(false); });

    await clear();
    await page.evaluate(() => window.__vc.startTour());
    await page.evaluate(() => window.__vc.launch.start());
    const launchWins = await state();

    await clear();
    await page.evaluate(() => window.__vc.launch.start());
    await page.evaluate(() => window.__vc.startTour());
    const tourWins = await state();

    await clear();
    await page.evaluate(() => window.__vc.startTour());
    await page.evaluate(() => window.__vc.select(null));
    const selectWins = await state();
    await clear();

    const ok = launchWins.tour === -1 && launchWins.launch
      && tourWins.tour >= 0 && !tourWins.launch
      && selectWins.tour === -1 && !selectWins.launch;
    report(ok, 'la visita y el lanzamiento no conducen a la vez',
      ok ? 'arrancar uno detiene al otro, y elegir un vehículo detiene a los dos'
        : `lanzamiento sobre visita ${JSON.stringify(launchWins)} · visita sobre lanzamiento ${JSON.stringify(tourWins)} · selección ${JSON.stringify(selectWins)}`);
    await page.evaluate(() => window.__vc.jump(null));
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
    // Night and altitude have to compose. setAltitude() runs every frame of the launch and
    // used to reassign fog.density from the ground constant with no night factor, so flying at
    // night pulled daytime fog back over the scene and reset()'s setAltitude(0) left it there
    // under lit floodlights.
    const read2 = (deg, alt) => page.evaluate(([d, a]) => {
      window.__vc.env.setSun(d, 34); window.__vc.env.setAltitude(a);
      return window.__vc.lightState();
    }, [deg, alt]);
    const nightGround = await read2(-8, 0);
    await read2(-8, 12000);
    const nightBack = await read2(-8, 0);
    const dayGround = await read2(42, 0);
    const composes = Math.abs(nightGround.fog - nightBack.fog) < 1e-9
      && nightGround.fog > dayGround.fog * 2
      && nightBack.night > 0.85;
    report(composes, 'la niebla de noche sobrevive a un vuelo',
      composes ? `densidad ${dayGround.fog} de día, ${nightGround.fog} de noche, y vuelve a ${nightBack.fog} tras subir a 12 km`
        : `día ${dayGround.fog} · noche ${nightGround.fog} · tras el vuelo ${nightBack.fog} · nightK ${nightBack.night}`);

    await page.evaluate(() => { window.__vc.env.setSun(42, 34); window.__vc.env.setAltitude(0); });
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
      // One `flight` key, not two. The duplicate that used to sit at the bottom of this object
      // was the same shadowing mistake as the old `booster` pair — harmless only because both
      // spellings happened to read the same object.
      flight: [...f.position.toArray(), f.rotation.z],
      ship: v.scene.getObjectByName('ship').position.y,
      // Two different facts about the booster, under two different keys. They used to share
      // the name `booster`, so the second silently replaced the first and the transform — the
      // post-staging drift this reset is supposed to undo — was never compared at all.
      boosterXform: [
        v.scene.getObjectByName('superheavy').position.x,
        v.scene.getObjectByName('superheavy').rotation.z,
        ...v.exhibits.starship.boosterFlight.position.toArray(),
        v.exhibits.starship.boosterFlight.rotation.z,
      ],
      qd: parts.qdArm.rotation.y,
      chop: [parts.chopsticks.position.y, ...parts.chopsticks.children.filter(c => c.name.startsWith('arm-')).map(a => a.rotation.y)],
      boosterParent: v.scene.getObjectByName('superheavy').parent.name,
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

  // Up to staging the panel follows the stack, and its altitude and speed can only rise. After
  // staging it follows the booster home, which is the whole point of the second half of the
  // sequence, so monotonicity is asserted on the ascent only and the return gets its own test.
  const ASCENT_END = 158;
  const times = [-10, -1, 2, 8, 20, 62, 110, 152, 156, 161, 175, 210, 275, 340, 396, 412, 420];
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
    if (t <= ASCENT_END && (r.alt < lastAlt - 1e-6 || r.vel < lastVel - 1e-6)) monotonic = false;
    if (t <= ASCENT_END) { lastAlt = r.alt; lastVel = r.vel; }
  }
  report(badT.length === 0, `${times.length} instantes de la secuencia`,
    badT.length ? `inválidos: ${badT.join(', ')}` : 'transformadas finitas y cámara sobre la explanada');
  report(monotonic, 'perfil de ascenso monótono', monotonic ? 'altitud y velocidad no retroceden' : 'la curva retrocede');

  // ---- Booster return and catch ---------------------------------------------------------
  // The second half of the sequence flies the booster back to the tower. Three things have to
  // hold: it goes up before it comes down, it ends at the pad rather than downrange, and the
  // arms actually close on it — an animation that leaves the booster in the air beside open
  // arms is the failure mode worth catching.
  {
    const at = (t) => page.evaluate((tt) => {
      const v = window.__vc;
      v.launch.seek(tt);
      const b = v.exhibits.starship.boosterFlight;
      const chop = v.complex.userData.parts.chopsticks;
      const arms = chop.children.filter(c => c.name.startsWith('arm-')).map(a => +a.rotation.y.toFixed(4));
      return { x: b.position.x, y: b.position.y, chop: chop.position.y, arms };
    }, t);
    const apogee = await at(272);
    const mid = await at(340);
    const caught = await at(415);
    const rose = apogee.y > 90000 && apogee.x > 60000;
    const home = Math.abs(caught.x) < 60 && caught.y < 60;
    const closed = caught.arms.every(a => Math.abs(a) < 0.16) && caught.chop > 80;
    const descending = mid.y < apogee.y && Math.abs(mid.x) < Math.abs(apogee.x);
    const ok = rose && home && closed && descending;
    report(ok, 'el propulsor vuelve y la torre lo atrapa',
      ok ? `apogeo ${Math.round(apogee.y / 1000)} km a ${Math.round(apogee.x / 1000)} km, atrapado a ${caught.x.toFixed(1)} m del eje con los brazos cerrados`
        : `sube ${rose} · desciende ${descending} · vuelve ${home} · brazos ${closed} · ${JSON.stringify({ apogee, mid, caught })}`);

    // ...and it catches it BY THE PINS. "chop > 80" only says the carriage went up; it passed
    // happily while the arms closed 6,8 m below the hardware, around the methane tank. Measure
    // the pin's world height against the carriage's load pads instead.
    const grip = await page.evaluate((tt) => {
      const v = window.__vc;
      v.launch.seek(tt);
      // Searched from the scene, not from ex.model: by the catch the booster has been
      // re-parented out of the exhibit group into its own flight group.
      const p = v.scene.getObjectByName('catch-pin');
      const chop = v.complex.userData.parts.chopsticks;
      if (!p) return null;
      v.scene.updateMatrixWorld(true);
      // World translation straight out of the matrix, so this needs no THREE in page scope.
      return { pin: p.matrixWorld.elements[13], carriage: chop.matrixWorld.elements[13] };
    }, 415);
    if (grip) {
      const off = grip.pin - grip.carriage;
      report(Math.abs(off) <= 1.6, 'los brazos cierran a la altura de los pines',
        `pin a ${grip.pin.toFixed(2)} m, carro a ${grip.carriage.toFixed(2)} m (desfase ${off.toFixed(2)} m)`);
    } else {
      report(false, 'los brazos cierran a la altura de los pines', 'no se encontró la malla catch-pin');
    }
  }

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
