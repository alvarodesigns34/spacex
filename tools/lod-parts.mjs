/**
 * Do the Blender cars shed their small parts without the picture changing?
 *
 * `vehicles/lodParts.js` marks every part of the Porsche, the H2R and the Model Y whose whole box
 * is under 0.45 m, and the level-of-detail manager stops drawing each once it is about a pixel
 * across. This measures what that costs in the image, per car, from one camera with every other
 * entry of the scene held detailed:
 *
 *   · close (4 m): nothing may be hidden;
 *   · mid (60 m) and far (400 m): the picture with the parts shed against the picture with all of
 *     them drawn — the share of pixels that change by 3/255 or more must stay under 0.02 %
 *     (≈50 pixels of the 640 × 400 frame); at 400 m every marked part must be hidden, and the
 *     draw calls of the whole frame must fall.
 *
 * Negative control: hiding the same parts by hand at 12 m, where they are large on screen, is a
 * change the measurement must see — more than three times the limit — or the limit would prove nothing.
 *
 *   node tools/lod-parts.mjs [--quality high]
 *
 * Part of `npm run check`. Reading the canvas back needs the render and the read in the same task
 * (the drawing buffer is cleared once presented), so it all runs inside the page, as lod-pop does.
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8816;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const MAX_CHANGED_PCT = 0.02;

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let failed = 0;
const report = (ok, name, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

try {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, argOf('--quality') ?? 'high');

  const rows = await page.evaluate(async () => {
    const v = window.__vc;
    ['labels', 'ruler', 'humans'].forEach(t => v.setToggle(t, false));
    v.renderer.info.autoReset = false;
    const cv = document.createElement('canvas');
    cv.width = v.renderer.domElement.width; cv.height = v.renderer.domElement.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      v.renderer.info.reset();
      v.composer.render();
      const calls = v.renderer.info.render.calls;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(v.renderer.domElement, 0, 0);
      return { px: ctx.getImageData(0, 0, cv.width, cv.height).data, calls };
    };
    const changed = (A, B) => {
      let n = 0;
      for (let i = 0; i < A.length; i += 4) {
        const la = A[i] * 0.299 + A[i + 1] * 0.587 + A[i + 2] * 0.114, lb = B[i] * 0.299 + B[i + 1] * 0.587 + B[i + 2] * 0.114;
        if (Math.abs(la - lb) >= 3) n++;
      }
      return n;
    };
    const rows = [];
    for (const id of ['gt3rs', 'h2r', 'modely']) {
      const e = v.exhibits[id];
      const mine = v.lod.entries.filter(x => x.name.startsWith(`${id}-`) && !x.far && x.near.length === 1 && x.near[0].isMesh && x.near[0].userData.lodFeature);
      const cx = e.lay.x, cz = e.lay.z, cy = e.model.position.y + 0.7;
      for (const d of [4, 60, 400]) {
        const dir = [0.62, 0.22, 0.75], n = Math.hypot(...dir);
        v.rig.jumpTo([cx + dir[0] / n * d, cy + dir[1] / n * d, cz + dir[2] / n * d], [cx, cy, cz]);
        v.camera.updateMatrixWorld(true);
        // Everything else in the scene held detailed, so only this car's entries differ between the two pictures.
        for (const x of v.lod.entries) { x.pinned = true; x.state = true; for (const o of x.near) o.visible = true; if (x.far) x.far.visible = false; }
        const A = grab();
        for (const x of mine) x.pinned = null;
        v.lod.update(); v.lod.update();
        const hidden = mine.filter(x => !x.near[0].visible).length;
        const B = grab();
        rows.push({ id, d, marked: mine.length, hidden, callsAll: A.calls, callsShed: B.calls, changedPx: changed(A.px, B.px), total: A.px.length / 4 });
        for (const x of mine) { x.pinned = true; x.state = true; x.near[0].visible = true; }
      }
      // Control: at 12 m, where the car fills a good part of the frame, hide every marked part by
      // hand. The manager would never do it from there, and the same measurement must see it.
      v.rig.jumpTo([cx + 0.62 / 0.99 * 12, cy + 2.6, cz + 0.75 / 0.99 * 12], [cx, cy, cz]);
      v.camera.updateMatrixWorld(true);
      for (const x of v.lod.entries) { x.pinned = true; x.state = true; for (const o of x.near) o.visible = true; if (x.far) x.far.visible = false; }
      const A = grab();
      for (const x of mine) x.near[0].visible = false;
      const B = grab();
      for (const x of mine) x.near[0].visible = true;
      rows.push({ id, d: 'control', changedPx: changed(A.px, B.px), total: A.px.length / 4, hiddenByHand: mine.length });
    }
    return rows;
  });

  for (const r of rows) {
    if (r.d === 'control') {
      const pct = 100 * r.changedPx / r.total;
      report(pct > 3 * MAX_CHANGED_PCT, `${r.id}: control negativo: ocultar a mano sus ${r.hiddenByHand} piezas pequeñas a 12 m sí se ve`, `${r.changedPx} px (${pct.toFixed(3)} %) cuando el límite es ${MAX_CHANGED_PCT} %`);
      continue;
    }
    const pct = 100 * r.changedPx / r.total;
    let ok = pct <= MAX_CHANGED_PCT, extra = '';
    if (r.d === 4) { ok = ok && r.hidden === 0; extra = `${r.hidden} ocultas`; }
    if (r.d === 400) { ok = ok && r.hidden === r.marked && r.callsShed < r.callsAll; extra = `${r.hidden} de ${r.marked} ocultas · llamadas de dibujo ${r.callsAll} → ${r.callsShed}`; }
    if (r.d === 60) extra = `${r.hidden} de ${r.marked} ocultas · llamadas ${r.callsAll} → ${r.callsShed}`;
    report(ok, `${r.id} a ${r.d} m`, `${r.changedPx} px cambian (${pct.toFixed(4)} %) · ${extra}`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} comprobaciones fallan` : '\nPiezas pequeñas de los coches: se ocultan sin que la imagen cambie');
process.exit(failed ? 1 : 0);
