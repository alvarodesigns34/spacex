/**
 * How visible is a level-of-detail switch?
 *
 * The sweep tool finds WHERE the switches are and proves they do not flicker. This measures
 * the thing that actually matters about each one: how much the picture changes when it fires.
 * A switch that swaps geometry nobody can resolve should change almost nothing; a switch that
 * changes the tone of a surface, or its outline, shows up here as a large number — and did.
 *
 * The comparison has to be made from ONE camera with the state pinned, which is why it runs
 * inside the page: from outside, the frame loop re-evaluates the manager between screenshots
 * and both pictures come back in whatever state the distance implies.
 *
 * Reading the canvas back needs the render and the read in the same task, before the drawing
 * buffer is presented, so the page renders explicitly through `__vc.composer` and copies the
 * canvas into a 2D context immediately.
 *
 *   node tools/lod-pop.mjs [--quality high]
 *
 * Part of `npm run check`. It also fails if the scene registers a swap this file has no
 * camera for — a new swap cannot slip in unmeasured — and it runs one negative control: the
 * far picture of the first swap brightened by a third must be caught.
 *
 * Reports, per switch, at its own threshold distance:
 *   changed   share of pixels that differ at all
 *   mean|Δ|   average luminance change over those pixels, 0-255
 *   outline   share of pixels where one state drew the vehicle and the other drew sky
 */
import { createServer } from 'node:http';
import { staticHandler } from './static.mjs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8805;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

/** Each swap, with a camera bearing that puts the affected surface across the frame. */
const CASES = [
  { entry: 'starship-tps', exhibit: 'starship', at: [0, 95, 0], dir: [0.36, 0.11, 0.93] },
  // The Roadster's paint: 162 k triangles near, ≈3 k far, swept from the same surface.
  { entry: 'roadster-body', exhibit: 'roadster', at: [0, 0.6, 0], dir: [0.62, 0.3, 0.72] },
];

const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, argOf('--quality') ?? 'high');
await page.evaluate(() => ['labels', 'ruler', 'humans'].forEach(t => window.__vc.setToggle(t, false)));

let worst = 0;
let failed = 0;
// Coverage: every swap the scene registers must have a case here.
const swaps = await page.evaluate(() => window.__vc.lod.entries.filter(e => e.far).map(e => e.name));
const missing = swaps.filter(n => !CASES.some(c => c.entry === n));
console.log(`${missing.length ? ' FAIL ' : '  ok  '} cada intercambio de detalle tiene su encuadre — ${swaps.length} registrados${missing.length ? `, sin encuadre: ${missing.join(', ')}` : ''}`);
if (missing.length) failed++;

const measure = (c, mutate = false) => page.evaluate(([c, mutate]) => {
    const v = window.__vc;
    const e = v.exhibits[c.exhibit];
    const ox = e.lay.x + c.at[0], oy = e.model.position.y + c.at[1], oz = e.lay.z + c.at[2];
    const entry = v.lod.entries.find(x => x.name === c.entry);
    if (!entry) return { error: `no entry ${c.entry}` };

    // Stand at the switch's own threshold: the distance at which a feature of this entry is
    // exactly `enter` pixels. That is where the change happens, so that is where to judge it.
    const mpp = (2 * Math.tan((v.camera.fov * Math.PI / 180) / 2)) / window.innerHeight;
    const d = entry.feature / (v.lod.pixels * entry.bias * mpp);
    v.rig.jumpTo([ox + c.dir[0] * d, oy + c.dir[1] * d, oz + c.dir[2] * d], [ox, oy, oz]);
    v.camera.updateMatrixWorld(true);

    const cv = document.createElement('canvas');
    cv.width = v.renderer.domElement.width; cv.height = v.renderer.domElement.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = (det) => {
      v.lod.pin(c.entry, det);
      // Render and read in the same task: the drawing buffer is cleared once presented.
      v.composer.render();
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(v.renderer.domElement, 0, 0);
      return ctx.getImageData(0, 0, cv.width, cv.height).data;
    };
    // The negative control brightens the far picture by a third, the kind of mismatch between
    // the two states that reads as the whole surface flashing when the switch fires.
    const farMats = [];
    if (mutate) {
      entry.far.traverse(o => { if (o.material?.color) { farMats.push([o.material, o.material.color.clone()]); o.material.color.multiplyScalar(1.33); } });
    }
    const A = grab(false), B = grab(true);
    for (const [m, col] of farMats) m.color.copy(col);
    v.lod.pin(c.entry, null);

    let changed = 0, sum = 0, outline = 0, signed = 0;
    const n = A.length / 4;
    for (let i = 0; i < A.length; i += 4) {
      const la = (A[i] * 0.299 + A[i + 1] * 0.587 + A[i + 2] * 0.114);
      const lb = (B[i] * 0.299 + B[i + 1] * 0.587 + B[i + 2] * 0.114);
      const dl = Math.abs(la - lb);
      if (dl < 3) continue;
      changed++; sum += dl; signed += (lb - la);
      // One state drew geometry where the other drew nothing: a change of outline, which is
      // the one kind of pop that is never acceptable at any distance.
      if (A[i + 3] !== B[i + 3]) outline++;
    }
    return {
      d: +d.toFixed(1), n,
      changedPct: +(100 * changed / n).toFixed(2),
      meanDelta: +(sum / Math.max(changed, 1)).toFixed(1),
      signedDelta: +(signed / Math.max(changed, 1)).toFixed(1),
      outlinePct: +(100 * outline / n).toFixed(3),
    };
  }, [c, mutate]);

for (const c of CASES) {
  const r = await measure(c);
  if (r.error) { console.log(` FAIL  ${c.entry}: ${r.error}`); failed++; continue; }
  // What a visitor SEES as a pop is the surface changing tone or shape, not its fine pattern
  // changing phase. A mosaic swapped for a baked picture of the same mosaic will always differ
  // pixel by pixel — that is the point of it — so |Δ| is reported and the gate is on the two
  // things that read as a switch: the mean SIGNED change, which is the whole surface getting
  // lighter or darker at once, and any change of outline at all.
  const ok = Math.abs(r.signedDelta) <= 6 && r.outlinePct <= 0.05;
  if (!ok) failed++;
  worst = Math.max(worst, Math.abs(r.signedDelta));
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${c.entry} a ${r.d} m — ${r.changedPct} % de píxeles cambian, `
    + `|Δ| medio ${r.meanDelta}/255 (detalle ${r.signedDelta > 0 ? 'más claro' : 'más oscuro'} en ${Math.abs(r.signedDelta)}), silueta ${r.outlinePct} %`);
}

// Negative control: the same measurement must reject a far picture a third too bright.
{
  const r = await measure(CASES[0], true);
  const caught = !r.error && (Math.abs(r.signedDelta) > 6 || r.outlinePct > 0.05);
  console.log(`${caught ? '  ok  ' : ' FAIL '} control negativo: mosaico lejano un 33 % más claro — Δ con signo ${r.signedDelta}/255`);
  if (!caught) failed++;
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
