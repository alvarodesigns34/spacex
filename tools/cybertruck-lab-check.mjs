/**
 * The Cybertruck Lab in the real centre, in Chromium: it stays out of the site until it is
 * opened, opens with its button and with U, loads its asset once (over a server that gzips the
 * GLB as GitHub Pages does, so Content-Length is the compressed size) with a progress bar that
 * never passes 100 %, shows the 1,138 parts at their published size, keeps the site's keys to
 * itself, costs nothing at rest, ends a running sequence before opening, and gives the site back
 * as it was left: the view state, the camera and the renderer's settings.
 *
 *   node tools/cybertruck-lab-check.mjs [--quality low|medium|high]
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8816;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};
const args = process.argv.slice(2);
const TIER = args.includes('--quality') ? args[args.indexOf('--quality') + 1] : 'low';
const T = 120000;              // the runner's plazos: a software frame of the full site can take seconds

// GitHub Pages sends the Cybertruck's GLB gzipped, with the compressed Content-Length (audit, I4).
const GLB = '/assets/cybertruck/cybertruck.glb';
const gz = gzipSync(readFileSync(new URL('..' + GLB, import.meta.url)));
const files = staticHandler(ROOT, TYPES);
const server = createServer((req, res) => {
  if (req.url.split('?')[0] !== GLB) return files(req, res);
  res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
  res.end(gz);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.setDefaultTimeout(T);
  const errors = [], glbRequests = [], dracoRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => {
    const u = new URL(r.url()).pathname;
    if (u === GLB) glbRequests.push(u);
    if (u.includes('/libs/draco/')) dracoRequests.push(u);
  });
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);

  // ---- Before opening: nothing of the Cybertruck in the site.
  const site0 = await page.evaluate(() => {
    const v = window.__vc;
    return { inScene: !!v.scene.getObjectByName('cybertruck'), labDom: !!document.getElementById('cybertruck-lab'), button: !!document.getElementById('cybertruck-btn') };
  });
  report(!glbRequests.length && !dracoRequests.length && !site0.inScene && !site0.labDom, 'antes de abrir el Lab, el centro no ha pedido el GLB ni el decodificador y no tiene el Cybertruck',
    `${glbRequests.length} peticiones del GLB · ${dracoRequests.length} de Draco · en la escena: ${site0.inScene}`);
  report(site0.button, 'el botón «Cybertruck · Lab» está en la barra de herramientas');

  // What has to come back as it was.
  const snapshot = () => page.evaluate(() => {
    const v = window.__vc, r = v.renderer;
    return {
      view: JSON.stringify(v.viewState()),
      cam: [...v.camera.position.toArray(), ...v.camera.quaternion.toArray()].map(x => x.toFixed(6)).join(' '),
      renderer: JSON.stringify({ tm: r.toneMapping, exp: r.toneMappingExposure, auto: r.shadowMap.autoUpdate, reset: r.info.autoReset, rt: r.getRenderTarget()?.uuid ?? null }),
      children: v.scene.children.length,
    };
  });
  // The camera of the site settles first (its opening flight).
  await page.waitForFunction(() => { const v = window.__vc; const p = v.camera.position; const k = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`; const same = k === window.__ctlLast; window.__ctlLast = k; return same; }, null, { polling: 1000 });
  const before = await snapshot();

  // The bar's highest value, watched from the first byte.
  await page.evaluate(() => {
    window.__ctlMaxBar = 0;
    new MutationObserver(() => {
      const f = document.querySelector('#cybertruck-lab .loading-fill');
      const m = /scaleX\(([\d.]+)\)/.exec(f?.style.transform ?? '');
      if (m) window.__ctlMaxBar = Math.max(window.__ctlMaxBar, Number(m[1]));
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });
  });

  // ---- Open with the button.
  const t0 = Date.now();
  await page.click('#cybertruck-btn', { timeout: T });
  const shown = await page.evaluate(() => ({
    lab: !document.getElementById('cybertruck-lab').classList.contains('hidden'),
    hud: getComputedStyle(document.getElementById('hud')).display,
    focus: document.activeElement?.classList.contains('ctl-back'),
    tm: window.__vc.renderer.toneMapping,
  }));
  report(shown.lab && shown.hud === 'none' && shown.focus, 'el botón abre el Lab: tapa el centro, oculta su HUD y pone el foco en «← Back»', JSON.stringify(shown));
  await page.waitForFunction(() => window.__vc.ctLab.loaded || /could not be loaded/.test(document.querySelector('#cybertruck-lab .loading-text')?.textContent ?? ''), null, { timeout: 600000, polling: 500 });
  const lab = await page.evaluate(() => {
    const L = window.__vc.ctLab;
    return { loaded: L.loaded, stats: L.stats, requests: L.requests, progressMax: L.progressMax, bar: window.__ctlMaxBar,
      text: document.querySelector('#cybertruck-lab .ctl-sub').textContent, tm: window.__vc.renderer.toneMapping,
      loading: !document.querySelector('#cybertruck-lab .ctl-loading').classList.contains('hidden') };
  });
  report(lab.loaded && !lab.loading, 'el GLB carga y se decodifica con el Draco de vendor/', `${((Date.now() - t0) / 1000).toFixed(1)} s · ${lab.stats?.meshes} mallas · ${((lab.stats?.triangles ?? 0) / 1e6).toFixed(2)} M triángulos`);
  // The condition is really there: by Content-Length, the bar would have read glb/gz (the 136 % of C1).
  const raw = readFileSync(new URL('..' + GLB, import.meta.url)).length;
  report(glbRequests.length === 1 && lab.requests === 1 && gz.length < raw, 'una sola petición del GLB, servido con gzip y Content-Length comprimido (como Pages)',
    `${glbRequests.length} peticiones · ${(gz.length / 1e6).toFixed(2)} MB enviados de ${(raw / 1e6).toFixed(2)} MB: por Content-Length la barra habría llegado al ${(raw / gz.length * 100).toFixed(0)} %`);
  // The download fills up to 90 % of the bar and decoding takes it to 92 %; nothing goes past that.
  report(lab.bar >= 0.9 - 1e-9 && lab.bar <= 0.92 + 1e-9 && lab.progressMax > 0.999 && lab.progressMax <= 1 + 1e-9, 'la barra de progreso llega al final de la descarga y nunca pasa del 100 % (bytes descomprimidos sobre el tamaño anotado)',
    `bytes recibidos / tamaño anotado = ${lab.progressMax?.toFixed(4)} · barra como mucho al ${(lab.bar * 100).toFixed(1)} %`);
  report(lab.stats?.parts === 1138 && lab.stats.fidelity.V === 20 && lab.stats.fidelity.R === 881 && lab.stats.fidelity.A === 237,
    'las 1.138 piezas, con su fidelidad (Verificado 20 · Reconstruido 881 · Aproximado 237)', lab.text);
  report(lab.tm === 6, 'mientras está abierto, el renderer dibuja con AgX (como el visor y los renders de Blender)', `toneMapping ${lab.tm}`);

  // The truck at its published size (owner's manual, grade A: ±0.5 %): measured on the decoded vertices.
  const dims = await page.evaluate(async () => {
    const THREE = await import('three');
    const box = new THREE.Box3().setFromObject(window.__vc.ctLab.truck, true);
    const s = box.getSize(new THREE.Vector3());
    return { L: s.z, W: s.x, H: s.y, minY: box.min.y };
  });
  const near = (v, ref) => Math.abs(v / ref - 1) <= 0.005;
  report(near(dims.L, 5.6829) && near(dims.W, 2.4133) && near(dims.H, 1.7938) && dims.minY > -0.01,
    'mide lo que publica Tesla: 5,683 m de largo, 2,413 m de ancho con espejos, 1,794 m de alto en «Medium», sobre el suelo',
    `${dims.L.toFixed(4)} × ${dims.W.toFixed(4)} × ${dims.H.toFixed(4)} m, lo más bajo a ${(dims.minY * 1000).toFixed(1)} mm`);

  // ---- The site's keys stay out: G would launch Starship, L would hide the labels.
  const labels0 = await page.evaluate(() => window.__vc.viewState().toggles.labels);
  await page.keyboard.press('KeyG');
  await page.keyboard.press('KeyL');
  const keys = await page.evaluate(() => ({ launch: window.__vc.launch.running, labels: window.__vc.viewState().toggles.labels, active: window.__vc.ctLab.active }));
  report(!keys.launch && keys.labels === labels0 && keys.active, 'las teclas del centro no le llegan con el Lab abierto (G no lanza, L no cambia las etiquetas)', JSON.stringify(keys));

  // ---- At rest it draws nothing.
  const idle = await page.evaluate(async () => {
    const L = window.__vc.ctLab;
    const frames = (n) => new Promise((res) => { let k = 0; const t = () => (++k >= n ? res() : requestAnimationFrame(t)); requestAnimationFrame(t); });
    for (let i = 0; i < 60; i++) { const f = L.frames; await frames(4); if (L.frames === f) break; }
    const f0 = L.frames; await frames(20);
    return { drawn: L.frames - f0 };
  });
  report(idle.drawn === 0, 'en reposo el Lab no dibuja (dibujo bajo demanda)', `${idle.drawn} fotogramas dibujados en 20`);
  // A view button moves the camera and draws again.
  const moved = await page.evaluate(async () => {
    const L = window.__vc.ctLab, f0 = L.frames, p0 = L.camera.position.clone();
    document.querySelectorAll('#cybertruck-lab .ctl-views button')[1].click();
    for (let i = 0; i < 200 && L.camera.position.distanceTo(p0) < 1; i++) await new Promise(r => requestAnimationFrame(r));
    return { d: L.camera.position.distanceTo(p0), drawn: L.frames - f0 };
  });
  report(moved.d > 1 && moved.drawn > 0, 'una vista predefinida mueve la cámara y vuelve a dibujar', `${moved.d.toFixed(2)} m · ${moved.drawn} fotogramas`);

  // ---- Phase 3: the exploded view, a pure function of its parameter.
  const ex = await page.evaluate(async () => {
    const L = window.__vc.ctLab, THREE = await import('three');
    const frames = (n) => new Promise((res) => { let k = 0; const t = () => (++k >= n ? res() : requestAnimationFrame(t)); requestAnimationFrame(t); });
    const fromBase = () => L.parts.reduce((m, p) => Math.max(m, p.obj.position.distanceTo(p.base)), 0);
    const out = { exploding: L.parts.length, windows: Object.keys(L.windows).length };
    L.setExplode(1); await frames(2);
    out.at1 = fromBase();
    // Wholly below the ground at full explosion, default amplitude (the reason for the glass floor, audit C15).
    L.truck.updateMatrixWorld(true);
    out.below = [...L.comps.values()].filter(o => { const b = new THREE.Box3().setFromObject(o); return !b.isEmpty() && b.max.y < 0; }).length;
    for (const k of [0.37, 0.81, 0.12, 0.37]) { L.setExplode(k); await frames(1); }
    out.dev = L.deviation();
    L.setExplode(0); await frames(2);
    out.at0 = fromBase();
    // A masked stage stays assembled.
    L.state.stageMask[6] = false; L.setExplode(1);
    out.masked = L.parts.filter(p => p.stage === 6).reduce((m, p) => Math.max(m, p.obj.position.distanceTo(p.base)), 0);
    out.unmasked = L.parts.filter(p => p.stage === 1).reduce((m, p) => Math.max(m, p.obj.position.distanceTo(p.base)), 0);
    L.state.stageMask[6] = true; L.setExplode(0); await frames(2);
    out.floor = L.state.floor;
    return out;
  });
  report(ex.exploding === 1138 && ex.windows === 6 && ex.at1 > 1 && ex.at0 === 0 && ex.dev === 0,
    'vista explosionada: las 1.138 piezas se separan por sus 6 etapas y vuelven exactamente a su sitio (función pura del parámetro)',
    `al 100 % la más lejana a ${ex.at1.toFixed(2)} m · desviación tras 0,37→0,81→0,12→0,37: ${ex.dev} m · al 0 %: ${ex.at0} m`);
  report(ex.masked === 0 && ex.unmasked > 0.3, 'una etapa desmarcada se queda montada al explosionar', `etapa 6 a ${ex.masked} m · etapa 1 hasta ${ex.unmasked.toFixed(2)} m`);
  report(ex.below > 50 && ex.floor === 'glass', 'al 100 % hay piezas enteras bajo el suelo, y por eso el suelo de partida es el de cristal', `${ex.below} piezas bajo el suelo · suelo «${ex.floor}»`);

  // ---- One system only (M-CT7.2), and the guide from a part's assembled place (M-CT7.3).
  const one = await page.evaluate(async () => {
    const L = window.__vc.ctLab, out = {};
    const moved = (sys, yes) => L.parts.filter(p => (p.obj.userData.system === sys) === yes).reduce((m, p) => Math.max(m, p.obj.position.distanceTo(p.base)), 0);
    L.setExplodeSystem('DRIVE_UNITS'); L.setExplode(1);
    out.mine = moved('DRIVE_UNITS', true); out.others = moved('DRIVE_UNITS', false);
    out.select = document.querySelector('#cybertruck-lab .ctl-sys-select').value;
    const part = L.parts.find(p => p.obj.userData.system === 'DRIVE_UNITS' && p.dist > 0.3).obj.name;
    L.select(part);
    const g = L.scene.getObjectByName('cybertruck-lab-guide');
    out.guide = !!g?.visible; out.guideLen = g ? g.geometry.attributes.position.array.slice(0, 3).map((v, i) => v - g.geometry.attributes.position.array[3 + i]).reduce((a, b) => a + b * b, 0) ** 0.5 : 0;
    L.select(null); out.guideOff = !g?.visible;
    L.assemble();
    for (let i = 0; i < 300 && (L.state.explode > 0 || L.state.explodeSystem); i++) await new Promise(r => requestAnimationFrame(r));
    out.after = { explode: L.state.explode, system: L.state.explodeSystem, dev: L.deviation() };
    return out;
  });
  report(one.mine > 0.3 && one.others === 0 && one.select === 'DRIVE_UNITS' && one.guide && one.guideLen > 0.3 && one.guideOff && one.after.explode === 0 && one.after.system === null && one.after.dev === 0,
    'explosión de un solo sistema: separa sus piezas y deja el resto montado; la línea guía une la pieza con su sitio; «Assemble» recoge y vuelve a todos', JSON.stringify(one));

  // ---- Picking with the mouse, the card, isolate, hide, systems and the search.
  const target = await page.evaluate(async () => {
    const L = window.__vc.ctLab, THREE = await import('three');
    L.goView('side');
    for (let i = 0; i < 300; i++) { await new Promise(r => requestAnimationFrame(r)); if (L.camera.position.distanceTo(new THREE.Vector3(...L.VIEWS.side.pos)) < 1e-3) break; }
    // The middle of the front door's outer skin, projected to the screen.
    const name = [...L.comps.keys()].find(n => /^EXT_Door_FL_Outer$/.test(n)) ?? [...L.comps.keys()].find(n => /Door_FL/.test(n));
    const c = new THREE.Box3().setFromObject(L.comps.get(name)).getCenter(new THREE.Vector3()).project(L.camera);
    return { name, x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight };
  });
  await page.mouse.click(target.x, target.y);
  const picked = await page.evaluate(() => {
    const L = window.__vc.ctLab, s = L.state.selected;
    return { name: s?.name ?? null, label: s?.userData.label_es ?? null, card: !document.querySelector('#cybertruck-lab .ctl-info').classList.contains('hidden'), title: document.querySelector('#cybertruck-lab .ctl-info-title').textContent };
  });
  report(!!picked.name && picked.card && picked.title === picked.label && /puerta|door/i.test(`${picked.name} ${picked.label}`),
    'un clic sobre la puerta delantera la selecciona y abre su ficha, con su nombre en español', `${picked.name} · «${picked.label}» (apuntado a ${target.name})`);
  const vis = await page.evaluate(() => {
    const L = window.__vc.ctLab, shown = () => [...L.comps.values()].filter(o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }).length;
    const name = L.state.selected.name, out = { all: shown() };
    document.querySelector('#cybertruck-lab [data-act="isolate"]').click();
    out.isolated = shown();
    out.isoOk = [...L.comps.values()].filter(o => o.visible).every(o => { const n = L.comps.get(name); let a = false; n.traverse(c => { if (c === o) a = true; }); for (let p = n; p; p = p.parent) if (p === o) a = true; return a; });
    L.showAll(); out.back = shown();
    L.toggleSystem('DRIVE_UNITS');
    out.chip = document.querySelector('#cybertruck-lab .ctl-chip[data-sys="DRIVE_UNITS"]').getAttribute('aria-pressed');
    out.driveShown = [...L.comps.values()].filter(o => o.userData.system === 'DRIVE_UNITS' && o.visible).length;
    out.rowsHidden = document.querySelectorAll('#cybertruck-lab .ctl-item.is-hidden').length;
    L.showAll();
    out.chipBack = document.querySelector('#cybertruck-lab .ctl-chip[data-sys="DRIVE_UNITS"]').getAttribute('aria-pressed');
    L.setPartVisible(name, false); out.hiddenOne = shown(); L.showAll();
    L.filterTree('suspension');
    const rows = [...document.querySelectorAll('#cybertruck-lab .ctl-item')];
    out.found = rows.filter(r => !r.classList.contains('hidden')).length;
    out.foundOk = rows.filter(r => !r.classList.contains('hidden')).every(r => r.dataset.search.includes('suspension'));
    L.filterTree('');
    out.rows = rows.length;
    return out;
  });
  report(vis.isolated < vis.all && vis.isolated >= 1 && vis.isoOk && vis.back === vis.all, 'aislar deja solo la pieza (con su conjunto) y «Show all» lo devuelve todo', `${vis.all} → ${vis.isolated} → ${vis.back} piezas a la vista`);
  report(vis.chip === 'false' && vis.driveShown === 0 && vis.rowsHidden > 0 && vis.chipBack === 'true' && vis.hiddenOne === vis.all - 1,
    'ocultar un sistema apaga su chip, sus piezas y sus filas de la lista; ocultar una pieza quita solo esa', `unidades motrices: chip ${vis.chip} → ${vis.chipBack}, ${vis.rowsHidden} filas tachadas · una pieza: ${vis.all} → ${vis.hiddenOne}`);
  report(vis.rows === 1138 && vis.found > 5 && vis.foundOk, 'la lista tiene las 1.138 piezas y la búsqueda encuentra «suspension» sin tilde (Suspensión)', `${vis.found} filas`);

  // ---- Floors, light and the reflection (built only on the high tier).
  const scn = await page.evaluate(() => {
    const L = window.__vc.ctLab, r = window.__vc.renderer, f = L.floors, out = {};
    L.setFloor('opaque'); out.opaque = [f.ground.visible, f.glass.visible, L.controls.maxPolarAngle < Math.PI / 2];
    L.setFloor('hidden'); out.hidden = [f.ground.visible, f.glass.visible, f.grid.visible, L.controls.maxPolarAngle];
    L.setFloor('glass'); out.glass = [f.ground.visible, f.glass.visible, f.catcher.visible];
    L.setEnvironment('exterior'); out.exterior = r.toneMappingExposure;
    out.reflector = !!L.reflector; out.tier = window.__vc.quality.name;
    return out;
  });
  report(scn.opaque.join() === 'true,false,true' && scn.hidden.slice(0, 3).join() === 'false,false,false' && scn.hidden[3] === Math.PI && scn.glass.join() === 'false,true,true',
    'los tres suelos: opaco (sin bajar la cámara del suelo), oculto (se puede mirar desde abajo) y de cristal con su sombra de contacto', JSON.stringify(scn));
  report(Math.abs(scn.exterior - 0.72) < 1e-9 && scn.reflector === (scn.tier === 'high'), 'la luz «Exterior» lleva su exposición (0,72); el reflejo plano solo existe en calidad alta', `exposición ${scn.exterior} · reflejo ${scn.reflector} en calidad ${scn.tier}`);

  // ---- Openings, the scale figure, the bloom and the suspension table.
  const more = await page.evaluate(async () => {
    const L = window.__vc.ctLab, THREE = await import('three');
    const ang = (o) => 2 * Math.acos(Math.min(1, Math.abs(o.quaternion.w))) * 180 / Math.PI;
    L.setOpening('doors', true); L.setOpening('tailgate', true); L.setOpening('frunk', true);
    for (let i = 0; i < 400 && Object.values(L.openings).some(o => o.k < 1); i++) await new Promise(r => requestAnimationFrame(r));
    const fl = L.truck.getObjectByName('DOOR_FL'), fr = L.truck.getObjectByName('DOOR_FR');
    // The left door's rear edge goes out to −x, the right one's to +x.
    const tip = (d) => new THREE.Vector3(0, 0, 1).applyQuaternion(d.quaternion).x;
    const out = { door: ang(fl), frunk: ang(L.truck.getObjectByName('EXT_Frunk_Lid')), tail: ang(L.truck.getObjectByName('EXT_Tailgate')), left: tip(fl), right: tip(fr) };
    for (const k of Object.keys(L.openings)) L.setOpening(k, false);
    for (let i = 0; i < 400 && Object.values(L.openings).some(o => o.k > 0); i++) await new Promise(r => requestAnimationFrame(r));
    out.closed = Math.max(ang(fl), ang(fr));
    const f = L.figure;
    if (f) { const b = new THREE.Box3(); f.traverse(o => { if (o.isMesh && o.name === 'human-batch') b.expandByObject(o); }); out.figureTop = b.max.y; out.figureMinY = b.min.y; }
    // Fully exploded at the widest amplitude, no part's box reaches the figure's (a 0.6 m column).
    if (f) {
      const col = new THREE.Box3(); f.traverse(o => { if (o.isMesh && o.name === 'human-batch') col.expandByObject(o); });
      col.expandByVector(new THREE.Vector3(0.1, 0, 0.1));
      const amp = L.state.amp; L.state.amp = 2.4; L.setExplode(1); L.truck.updateMatrixWorld(true);
      out.figureHits = [...L.comps.values()].filter(o => o.isMesh && new THREE.Box3().setFromObject(o).intersectsBox(col)).map(o => o.name);
      L.state.amp = amp; L.setExplode(0);
    }
    out.suspension = [...document.querySelectorAll('#cybertruck-lab [data-pane="data"] .ctl-table')][1]?.querySelectorAll('tr').length - 1;
    return out;
  });
  report(Math.abs(more.door - 65) < 0.5 && Math.abs(more.frunk - 55) < 0.5 && Math.abs(more.tail - 90) < 0.5 && more.left < -0.5 && more.right > 0.5 && more.closed < 1e-6,
    'aperturas: puertas ≈65° hacia fuera a cada lado, frunk ≈55° y portón 90°, y vuelven a cerrar', JSON.stringify(more));
  report(Math.abs(more.figureTop - 1.80) < 0.02 && Math.abs(more.figureMinY) < 0.02 && more.figureHits?.length === 0, 'la figura de escala mide 1,80 m desde el suelo que pisa y ninguna pieza la alcanza explosionada al máximo', `coronilla a ${more.figureTop?.toFixed(3)} m, pies a ${(more.figureMinY * 1000).toFixed(0)} mm · piezas que la tocan: ${more.figureHits?.join(', ') || 'ninguna'}`);
  report(more.suspension === 6, 'la pestaña Data lista las seis alturas de la suspensión del manual', `${more.suspension} filas`);

  // ---- Space animates; Esc goes one layer at a time.
  await page.evaluate(() => document.querySelector('#cybertruck-lab .ctl-back').blur());
  await page.keyboard.press('Space');
  const playing = await page.evaluate(async () => { const L = window.__vc.ctLab; const e0 = L.state.explode; for (let i = 0; i < 300 && L.state.explode === e0; i++) await new Promise(r => requestAnimationFrame(r)); return { on: L.state.playing, moved: L.state.explode > e0 }; });
  await page.keyboard.press('Space');
  const stopped = await page.evaluate(() => window.__vc.ctLab.state.playing);
  report(playing.on && playing.moved && !stopped, 'la barra espaciadora anima la explosión y la para', JSON.stringify({ ...playing, stopped }));
  await page.evaluate(() => { const L = window.__vc.ctLab; L.setExplode(0); L.select([...L.comps.keys()][0]); });
  await page.keyboard.press('Escape');
  const layer = await page.evaluate(() => ({ active: window.__vc.ctLab.active, selected: !!window.__vc.ctLab.state.selected }));
  report(layer.active && !layer.selected, 'Esc con una pieza seleccionada la suelta sin cerrar el Lab', JSON.stringify(layer));

  // ---- Esc goes back, and the site is as it was.
  await page.keyboard.press('Escape');
  const after = await snapshot();
  const back = await page.evaluate(() => ({
    lab: !document.getElementById('cybertruck-lab').classList.contains('hidden'),
    hud: getComputedStyle(document.getElementById('hud')).display,
    focus: document.activeElement?.id, inScene: !!window.__vc.scene.getObjectByName('cybertruck'),
  }));
  report(!back.lab && back.hud !== 'none' && back.focus === 'cybertruck-btn', 'Esc vuelve al centro y devuelve el foco al botón', JSON.stringify(back));
  report(after.view === before.view && after.cam === before.cam && after.children === before.children && !back.inScene,
    'el centro vuelve como estaba: el estado de la vista, la cámara y la escena (sin el Cybertruck)', after.view === before.view ? `cámara ${after.cam === before.cam ? 'igual' : 'distinta'}` : `${before.view} → ${after.view}`);
  report(after.renderer === before.renderer, 'el renderer vuelve con sus ajustes (tono, exposición, sombras, contadores, destino)', after.renderer);
  const drawsAgain = await page.evaluate(async () => {
    const r = window.__vc.renderer, f = r.info.render.frame;
    for (let i = 0; i < 30 && r.info.render.frame === f; i++) await new Promise(res => requestAnimationFrame(res));
    return r.info.render.frame - f;
  });
  report(drawsAgain > 0, 'el bucle del centro vuelve a dibujar', `${drawsAgain} llamadas de dibujo nuevas`);

  // ---- U opens it again, at once (the model is kept), and U closes it.
  await page.keyboard.press('KeyU');
  const again = await page.evaluate(() => ({ active: window.__vc.ctLab.active, loaded: window.__vc.ctLab.loaded, loading: !document.querySelector('#cybertruck-lab .ctl-loading').classList.contains('hidden') }));
  report(again.active && again.loaded && !again.loading && glbRequests.length === 1, 'U lo vuelve a abrir al instante: el modelo se conserva y no se pide otra vez', `${glbRequests.length} peticiones`);
  const env2 = await page.evaluate(() => { const L = window.__vc.ctLab, e = { env: L.state.env, exp: window.__vc.renderer.toneMappingExposure }; L.setEnvironment('studio'); return e; });
  report(env2.env === 'exterior' && Math.abs(env2.exp - 0.72) < 1e-9, 'al reabrirlo conserva la luz elegida y su exposición (la del centro se restauró al salir)', JSON.stringify(env2));
  await page.keyboard.press('KeyU');
  report(!(await page.evaluate(() => window.__vc.ctLab.active)), 'U lo cierra');

  // ---- A running sequence is ended first, and the Lab says so.
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__vc.launch.running, null, { timeout: T });
  await page.keyboard.press('KeyU');
  const seqd = await page.evaluate(() => ({ launch: window.__vc.launch.running, active: window.__vc.ctLab.active, note: document.querySelector('#cybertruck-lab .ctl-note').textContent, hidden: document.querySelector('#cybertruck-lab .ctl-note').classList.contains('hidden') }));
  report(!seqd.launch && seqd.active && !seqd.hidden && /Starship launch/.test(seqd.note), 'con el lanzamiento en marcha, U lo termina, abre el Lab y lo dice', seqd.note);
  await page.keyboard.press('Escape');
  const owner = await page.evaluate(() => ({ active: window.__vc.ctLab.active, launch: window.__vc.launch.running, owner: window.__vc.viewState().owner }));
  report(!owner.active && !owner.launch && owner.owner === 'user', 'al volver, la cámara es del visitante y el lanzamiento no sigue', JSON.stringify(owner));

  report(!errors.length, 'consola sin errores', errors.slice(0, 3).join(' | '));
} catch (e) {
  report(false, 'la prueba del Lab terminó', e.message.split('\n')[0]);
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} comprobaciones fallan` : '\nTodas las comprobaciones del Cybertruck Lab pasan');
process.exit(failed ? 1 : 0);
