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
import { staticHandler } from './static.mjs';
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

const server = createServer(staticHandler(ROOT, TYPES));
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
  const lodNames = await page.evaluate(() => {
    const entries = window.__vc.lod.entries;
    const unique = () => new Set(entries.map(e => e.name)).size === entries.length;
    const good = unique(), saved = entries[1].name;
    entries[1].name = entries[0].name;
    const catchesDuplicate = !unique();
    entries[1].name = saved;
    return { good, catchesDuplicate };
  });
  report(lodNames.good && lodNames.catchesDuplicate, 'LOD: identificadores únicos; sabotaje de nombres duplicados detectado');
  const falcon1Row = await page.evaluate(() => {
    const f1 = window.__vc.exhibits.falcon1.lay, f9 = window.__vc.exhibits.falcon9.lay;
    return { aligned: f1.z === f9.z, atEnd: f1.x < f9.x, gap: +(f9.x - f1.x).toFixed(1) };
  });
  report(falcon1Row.aligned && falcon1Row.atEnd && falcon1Row.gap < 30,
    'Falcon 1 cierra la fila junto a Falcon 9', `alineado ${falcon1Row.aligned}, separación ${falcon1Row.gap} m`);
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

  // ---- Level of detail engages, and disengages -------------------------------------------
  // The manager is only worth having if it actually sheds work at range AND puts every bit of
  // it back up close. A rule that never fires costs nothing and saves nothing; one that never
  // reverses quietly removes a vehicle's interior from the exhibit it belongs to.
  {
    await page.evaluate(() => window.__vc.jump('roadster', 'detail'));
    const near = await page.evaluate(() => { window.__vc.lod.update(); return window.__vc.lod.snapshot(); });
    await page.evaluate(() => window.__vc.jump(null));
    const far = await page.evaluate(() => { window.__vc.lod.update(); return window.__vc.lod.snapshot(); });
    await page.evaluate(() => window.__vc.jump('roadster', 'detail'));
    const back = await page.evaluate(() => { window.__vc.lod.update(); return window.__vc.lod.snapshot(); });

    const find = (rows, n) => rows.find(r => r.name === n);
    const interiorNear = find(near, 'roadster-roadster-interior');
    const interiorFar = find(far, 'roadster-roadster-interior');
    const interiorBack = find(back, 'roadster-roadster-interior');
    const shedAtRange = far.filter(r => r.detailed === false).length;
    const allBackUp = back.every(r => r.detailed === true) || interiorBack?.detailed === true;
    const ok = !!interiorNear?.detailed && interiorFar?.detailed === false && !!allBackUp && shedAtRange > 0;
    report(ok, 'el detalle se retira con la distancia y vuelve al acercarse',
      ok ? `${shedAtRange} de ${far.length} grupos retirados en la vista general, todos de vuelta en primer plano`
        : `cerca ${JSON.stringify(interiorNear)} · lejos ${JSON.stringify(interiorFar)} · vuelta ${JSON.stringify(interiorBack)}`);
    await page.evaluate(() => { window.__vc.lod.forceDetailed(); window.__vc.jump(null); });
  }

  // ---- Detail must never change what is measured ------------------------------------------
  // Every dimensional row, every pad row and every interface row has to describe the geometry
  // the builders produced, whatever the camera happens to be close enough for. The measurement
  // is a property of the model; the level of detail is a property of the view, and the moment
  // one can move the other, a vehicle could shed the part being measured and pass.
  //
  // Asked the only way that settles it: run the whole verification from 300 m with the detail
  // shed, run it again from two metres with everything up, and require the two to be identical
  // character for character.
  {
    const run = async (setup, forceDetail) => {
      await page.evaluate(setup);
      await page.evaluate(() => window.__vc.lod.update());
      return page.evaluate((f) => {
        const r = window.__vc.verify({ forceDetail: f });
        const shed = window.__vc.lod.snapshot().filter(x => x.detailed === false).length;
        return { shed, v: JSON.stringify({ d: r.dimensions, p: r.pad, i: r.interfaces }) };
      }, forceDetail);
    };
    // From 300 m with the detail shed and the forcing turned OFF, against the same
    // verification run normally. Leaving the forcing on would have both runs looking at the
    // same visible scene, and a measurement that quietly consulted `visible` would pass.
    const shedRun = await run(() => window.__vc.jump(null), false);
    const fullRun = await run(() => window.__vc.jump('starship', 'engines'), true);
    report(shedRun.v === fullRun.v && shedRun.shed > 0,
      'el nivel de detalle no altera ninguna medición',
      `${shedRun.shed} grupos retirados y sin forzar detalle · medidas ${shedRun.v === fullRun.v ? 'idénticas' : 'DISTINTAS'}`);
    await page.evaluate(() => { window.__vc.lod.forceDetailed(); window.__vc.jump(null); });
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

    // Ownership, the harder half. The test above walks the three drivers displacing each other
    // through their own entry points, which always worked. What did not work was every route
    // by which the VISITOR takes the camera back — and none of them was covered, because the
    // scene looks identical either way: `applyVisibility` keys off exhibit and flying, never
    // off owner. The damage was to every decision made by asking who is driving.
    {
      const ownerAfter = async (fn) => {
        await page.evaluate(() => { window.__vc.stopTour(); window.__vc.launch.reset(false); window.__vc.jump(null); });
        await page.evaluate(() => window.__vc.startTour());
        await page.waitForTimeout(120);
        const during = (await S()).owner;
        await fn();
        await page.waitForTimeout(160);
        return { during, after: (await S()).owner, tour: await page.evaluate(() => window.__vc.tourAt) };
      };

      const ended = await ownerAfter(() => page.evaluate(() => window.__vc.tourRunToEnd()));
      const dragged = await ownerAfter(async () => {
        await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(820, 460); await page.mouse.up();
      });
      const wheeled = await ownerAfter(async () => { await page.mouse.move(800, 450); await page.mouse.wheel(0, -200); });
      const flew = await ownerAfter(() => page.evaluate(() => window.__vc.toggleMode()));
      await page.evaluate(() => window.__vc.toggleMode());       // back to orbit

      const good = (r) => r.during === 'tour' && r.after === 'user' && r.tour < 0;
      report([ended, dragged, wheeled, flew].every(good),
        'el visitante recupera la cámara por las cuatro rutas',
        `fin natural ${ended.after}/${ended.tour} · arrastre ${dragged.after}/${dragged.tour} · `
        + `rueda ${wheeled.after}/${wheeled.tour} · vuelo libre ${flew.after}/${flew.tour}`);

      // Dragging during a LAUNCH is the one case that must not stop what is driving: the rig
      // hands the camera over and the rocket goes on flying. The state has to say both.
      await page.evaluate(() => { window.__vc.stopTour(); window.__vc.launch.reset(false); window.__vc.launch.start(); });
      await page.waitForTimeout(120);
      const ownedByLaunch = (await S()).owner;
      await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(830, 470); await page.mouse.up();
      await page.waitForTimeout(160);
      const afterDrag = await S();
      const stillRunning = await page.evaluate(() => window.__vc.launch.running);
      report(ownedByLaunch === 'launch' && afterDrag.owner === 'user' && stillRunning,
        'arrastrar durante el lanzamiento toma la cámara sin detener la secuencia',
        `dueño ${ownedByLaunch} -> ${afterDrag.owner}, secuencia ${stillRunning ? 'sigue' : 'PARADA'}`);
      await page.evaluate(() => window.__vc.launch.reset(false));
      const afterEnd = (await S()).owner;
      report(afterEnd === 'user', 'terminar el lanzamiento deja la cámara al visitante', afterEnd);
      await page.evaluate(() => window.__vc.jump(null));
      // Let the sweep and OrbitControls' damping settle before handing the page to the next
      // block: an unsettled camera looks like a surviving tour timer to the test below.
      await page.waitForTimeout(2600);
    }

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
    // Let the framing sweep the first stop started finish before reading a position. The
    // question here is whether a TIMER survived, not whether the camera is frozen: sampling
    // mid-sweep compares two points on the same easing curve and reports movement that has
    // nothing to do with the tour. It passed only because the state this ran in happened to
    // make the first jump a no-op, so it failed the moment anything before it changed.
    await page.waitForFunction(() => {
      const p = window.__vc.camera.position;
      const last = window.__settle;
      window.__settle = [p.x, p.y, p.z];
      return !window.__vc.rig.transition && last
        && Math.abs(last[0] - p.x) < 1e-4 && Math.abs(last[1] - p.y) < 1e-4 && Math.abs(last[2] - p.z) < 1e-4;
    }, null, { timeout: 20000, polling: 250 });
    // Wait past the first stop's dwell. Anything shorter proves nothing: a surviving timer
    // would not have fired yet, and the assertion would pass on a tour that never stops.
    const before = await page.evaluate(() => window.__vc.camera.position.toArray());
    await page.waitForTimeout(TOUR_FIRST_HOLD_MS + 800);
    const after = await page.evaluate(() => window.__vc.camera.position.toArray());
    // A surviving tour timer RE-FRAMES the camera: the closest two stops on the route are
    // tens of metres apart, so that is what this has to detect. 1e-6 detected something else —
    // OrbitControls' damping bleeding a drag out over several seconds, which on CI's one-or-two
    // frames a second takes long enough to still be running when the window closes. Half a
    // metre is three orders of magnitude below any re-frame and well above the residue.
    const still = before.every((v, i) => Math.abs(v - after[i]) < 0.5);
    const idle = await page.evaluate(() => window.__vc.tourAt);
    const ok = started === 0 && stopped === -1 && still && idle === -1;
    report(ok, 'la visita guiada arranca y se detiene de verdad',
      ok ? 'primer alto encuadrado, y al pararla no queda ningún temporizador moviendo la cámara'
        : `arranque ${started} · parada ${stopped} · cámara quieta ${still} · inactiva ${idle === -1} · antes ${before.map(v=>v.toFixed(2))} después ${after.map(v=>v.toFixed(2))}`);
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

  // ---- Sun control: daylight only -----------------------------------------------------
  // The centre no longer has a night mode. Three things have to hold: the sun cannot be taken
  // below the control's floor (a script asking for −8° gets the floor, not darkness), the
  // atmosphere is a pure function of the slider (an earlier version read the sky uniforms back
  // and multiplied them, so every call darkened the sky further), and it survives a flight:
  // setAltitude() runs every frame of the launch and must hand the ground its own fog back.
  {
    const read = (deg, alt = 0) => page.evaluate(([d, a]) => {
      window.__vc.env.setSun(d, 34); window.__vc.env.setAltitude(a);
      return window.__vc.lightState();
    }, [deg, alt]);
    const day1 = await read(42);
    const lowA = await read(-8);
    const lowB = await read(-8);
    const floor = await page.evaluate(() => window.__vc.env.SUN_MIN);
    const atFloor = await read(floor);
    const day2 = await read(42);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const ok = same(lowA, lowB) && same(lowA, atFloor) && same(day1, day2)
      && lowA.night === 0 && lowA.sun > day1.sun * 0.3;
    report(ok, 'el sol no baja del horizonte y el ciclo es reversible',
      ok ? `suelo ${floor}°, sol ${day1.sun} -> ${lowA.sun}, sin noche`
        : JSON.stringify({ day1, lowA, lowB, atFloor, day2 }));
    const ground = await read(42, 0);
    await read(42, 12000);
    const back = await read(42, 0);
    const composes = Math.abs(ground.fog - back.fog) < 1e-12 && same(ground, back);
    report(composes, 'la atmósfera vuelve igual tras un vuelo',
      composes ? `niebla ${ground.fog} antes y después de subir a 12 km` : JSON.stringify({ ground, back }));
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
      boosterQds: (parts.boosterQds ?? []).map(q => q.position.toArray()),
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

  // ---- Transitions between modes ---------------------------------------------------------
  // Each mode was tested alone. The combinations were not, and the combinations are where
  // this project's bugs have actually lived: the tour running under a launch, the atmosphere
  // left in a night state with daytime fog, an orbital backdrop still up over a vehicle that
  // had gone back to its plinth. Each of these drives one full round trip and asserts the
  // scene came back to the state the museum starts in.
  {
    const clean = { space: false, ground: true, fog: true, backdrop: false, pedestal: true, adapter: false };
    const eq = (a, b) => Object.keys(b).every(k => a[k] === b[k]);
    const reset = () => page.evaluate(() => {
      const v = window.__vc;
      v.stopTour(); v.launch.reset(false); v.rig.setMode('orbit');
      v.env.setSun(42, 34); v.jump(null);
    });

    // Launch straight into free flight: the sequence owns the camera, and F takes it back.
    await reset();
    await page.evaluate(() => { window.__vc.launch.seek(40); window.__vc.rig.setMode('fly'); });
    const toFly = await page.evaluate(() => ({
      mode: window.__vc.rig.mode,
      orbitOff: !window.__vc.rig.orbit.enabled,
      external: window.__vc.rig.external,
      finite: window.__vc.camera.position.toArray().every(Number.isFinite),
    }));
    report(toFly.mode === 'fly' && toFly.orbitOff && !toFly.external && toFly.finite,
      'del lanzamiento al vuelo libre', JSON.stringify(toFly));

    // Orbital view straight into a launch, and back. The orbital view turns off the ground,
    // the sky and the fog; a launch starting from inside it must not inherit any of that.
    await reset();
    await page.evaluate(() => window.__vc.jump('roadster', 'earth'));
    await page.evaluate(() => window.__vc.launch.start());
    const duringLaunch = await page.evaluate(() => window.__vc.spaceState());
    await page.evaluate(() => { window.__vc.launch.reset(false); window.__vc.jump(null); });
    const afterLaunch = await page.evaluate(() => window.__vc.spaceState());
    report(!duringLaunch.space && eq(afterLaunch, clean),
      'de la vista orbital al lanzamiento y de vuelta',
      `durante ${JSON.stringify(duringLaunch)} · después ${JSON.stringify(afterLaunch)}`);

    // Low sun, a full flight, then reset. The atmosphere has three inputs and one writer; this
    // is the path that used to leave the wrong fog behind after a launch.
    await reset();
    await page.evaluate(() => window.__vc.env.setSun(6, 34));
    const lowBefore = await page.evaluate(() => window.__vc.lightState());
    await page.evaluate(() => window.__vc.launch.seek(120));
    await page.evaluate(() => window.__vc.launch.reset(false));
    const lowAfter = await page.evaluate(() => window.__vc.lightState());
    report(JSON.stringify(lowBefore) === JSON.stringify(lowAfter),
      'sol bajo, vuelo completo y reset devuelven la misma atmósfera',
      `antes ${JSON.stringify(lowBefore)} · después ${JSON.stringify(lowAfter)}`);
    await reset();

    // A resize in the middle of a framing sweep. The composer, the label renderer and the
    // camera all have to survive it, and the sweep has to finish where it was going.
    await page.evaluate(() => window.__vc.goPreset('dragon', 'nose'));
    await page.setViewportSize({ width: 900, height: 620 });
    await page.waitForTimeout(140);
    await page.setViewportSize({ width: 1280, height: 800 });
    // Waited for, not slept through. A framing sweep finishes inside the render loop, and on
    // the software rasteriser CI runs on that loop ticks once or twice a second — a fixed
    // 2.2 s wait passed on one machine and failed on the next for reasons that had nothing
    // to do with the resize.
    // Two conditions, not one. Waiting only for the sweep raced the resize: `setViewportSize`
    // resolves before the page's `resize` event is dispatched, so when the sweep had already
    // finished the first poll passed and the aspect was read from the OLD viewport — 1.452,
    // the 900×620 it had been resized to a moment earlier. The wait now includes the thing
    // being asserted, which also makes the assertion stronger: the app must actually update
    // the camera on resize, rather than happening to have done so before we looked.
    await page.waitForFunction(() => !window.__vc.rig.transition
      && Math.abs(window.__vc.camera.aspect - window.innerWidth / window.innerHeight) < 1e-6,
    null, { timeout: 30000 });
    const afterResize = await page.evaluate(() => ({
      finite: window.__vc.camera.position.toArray().every(Number.isFinite),
      aspect: +window.__vc.camera.aspect.toFixed(3),
      transition: !!window.__vc.rig.transition,
      preset: window.__vc.viewState().preset,
    }));
    report(afterResize.finite && Math.abs(afterResize.aspect - 1.6) < 0.01
      && !afterResize.transition && afterResize.preset === 'nose',
      'redimensionar durante una transición no la rompe', JSON.stringify(afterResize));
    await reset();
  }

  // ---- The help dialog behaves like a dialog ----------------------------------------------
  // It declares aria-modal, and until now Tab walked straight out of it onto the rail
  // underneath: a keyboard user was operating controls hidden behind an overlay.
  {
    await page.evaluate(() => window.__vc.jump(null));
    await page.click('#help-btn');
    const opened = await page.evaluate(() => document.activeElement?.id);
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => !!document.getElementById('help')?.contains(document.activeElement));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({
      hidden: document.getElementById('help').classList.contains('hidden'),
      focus: document.activeElement?.id,
    }));
    report(opened === 'help-close' && stillInside && closed.hidden && closed.focus === 'help-btn',
      'el diálogo de ayuda atrapa el foco y lo devuelve',
      `abre en ${opened} · tab dentro ${stillInside} · cierra en ${closed.focus}`);
  }

  // ---- Performance budget (reports, does not gate) ----------------------------------------
  // Machine-dependent numbers must not fail a build, but a change that doubles the scene
  // should be impossible to merge without noticing. These print every time and only fail on
  // a gross regression — the kind that means something is being built in a loop.
  {
    const budget = await page.evaluate(() => {
      const v = window.__vc;
      const mats = new Set(); let tris = 0, meshes = 0, visible = 0, drawnTris = 0;
      v.jump(null); v.lod.update();
      const count = (o, shown) => {
        // `traverse` does not stop at a hidden group, and a hidden group's children each
        // still carry visible === true, so counting them individually said 859 of 866 were
        // being drawn when the real figure was 705. Walk it properly.
        const on = shown && o.visible;
        if (o.isMesh || o.isInstancedMesh) {
          meshes++;
          const g = o.geometry;
          if (g?.attributes?.position) {
            const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
            const t = n * (o.isInstancedMesh ? o.count : 1);
            tris += t;
            if (on) { visible++; drawnTris += t; }
          }
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) mats.add(m);
        }
        for (const c of o.children) count(c, on);
      };
      count(v.scene, true);
      return {
        tris: Math.round(tris), drawnTris: Math.round(drawnTris), meshes, visible,
        materials: mats.size, textures: v.renderer.info.memory.textures,
      };
    });
    // Ceilings sit well clear of today's figures: they catch a doubling, not a drift.
    const LIMITS = { tris: 2_200_000, meshes: 1400, materials: 160, textures: 120 };
    const over = Object.entries(LIMITS).filter(([k, max]) => budget[k] > max);
    report(over.length === 0, 'presupuesto de escena',
      `${budget.tris.toLocaleString('es-ES')} triángulos construidos, ${budget.drawnTris.toLocaleString('es-ES')} dibujados `
      + `en la vista general · ${budget.meshes} mallas (${budget.visible} dibujadas) · `
      + `${budget.materials} materiales · ${budget.textures} texturas`
      + (over.length ? ` — POR ENCIMA: ${over.map(([k]) => k).join(', ')}` : ''));
  }

  // ---- The scale figures stay merged ------------------------------------------------------
  // Twenty-two people at four or five meshes each were 99 draw calls in the overview for
  // 13,286 triangles — more calls than the Starship, the pad and the Roadster together, for a
  // row of 1.80 m boxes. They are merged into one mesh per material, which is only safe
  // because they never move, never change material and cast no shadow. Any of those three
  // assumptions breaking would show up as this count climbing back, so it is asserted rather
  // than left as a comment: the figures are the easiest thing in the scene to regress by
  // adding one more person inside the exhibit loop.
  {
    const crowd = await page.evaluate(() => {
      const g = window.__vc.scene.getObjectByName('humans');
      let meshes = 0, casters = 0, tris = 0;
      g?.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        if (o.castShadow) casters++;
        const a = o.geometry?.index ? o.geometry.index.count : (o.geometry?.attributes?.position?.count ?? 0);
        tris += a / 3;
      });
      return { meshes, casters, tris: Math.round(tris) };
    });
    report(crowd.meshes > 0 && crowd.meshes <= 6 && crowd.casters === 0,
      'las figuras de escala siguen fusionadas',
      `${crowd.meshes} malla(s) para ${crowd.tris.toLocaleString('es-ES')} triángulos, ${crowd.casters} proyectan sombra`);
  }

  report(consoleErrors.length === 0, 'consola limpia', consoleErrors.slice(0, 5).join(' | '));
} catch (err) {
  report(false, 'carga de la aplicación', err.message);
} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : '\nTodas las comprobaciones pasan');
process.exit(failures ? 1 : 0);
