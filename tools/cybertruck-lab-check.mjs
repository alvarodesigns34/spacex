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
