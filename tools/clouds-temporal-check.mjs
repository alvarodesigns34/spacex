/**
 * The cumulus marched over frames (core/cloudsTemporal.js), in the software renderer the gate uses.
 *
 * Visitors get the temporal march; the other checks run without it (they compare single frames), so
 * this one turns it on (?cloudtaa) with the automation's short march and checks:
 *   1. it runs: the dome draws the resolved picture, a share of the pixels is marched each frame,
 *      and no frame throws;
 *   2. it converges to the same sky: with the camera still, after a full cycle of the 4 × 4 order the
 *      resolved sky matches the per-pixel march (the dome as it was before 11-11-2026) to within the
 *      dither both carry — mean and 99th-percentile difference over the sky;
 *   3. it follows the camera: turned by a few degrees, the clouds move with the view (the reprojection),
 *      not with the screen — the turned frame matches the per-pixel march of the turned view, not the
 *      frame before the turn.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8811;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 300 } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed++; };

try {
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/?cloudtaa`, 'high');
  const r = await page.evaluate(async () => {
    const vc = window.__vc, clouds = vc.env.clouds;
    const frames = (n) => new Promise(res => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    // The sky band of a grabbed frame, as grey levels.
    const sky = async () => {
      const url = await vc.grab();
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, Math.floor(img.height * 0.3)).data;
      const out = new Float32Array(d.length / 4);
      for (let i = 0; i < out.length; i++) out[i] = (d[4 * i] + d[4 * i + 1] + d[4 * i + 2]) / 3;
      return out;
    };
    const diff = (a, b) => {
      const e = Array.from(a, (v, i) => Math.abs(v - b[i])).sort((x, y) => x - y);
      return { mean: e.reduce((s, v) => s + v, 0) / e.length, p99: e[Math.floor(e.length * 0.99)] };
    };
    // Look up into the clouds, the camera held still.
    vc.rig.setMode?.('orbit');
    vc.camera.position.set(0, 30, 300); vc.camera.lookAt(0, 900, -1200); vc.camera.updateMatrixWorld();
    vc.rig.external = true;
    await frames(3);
    const t = clouds.temporal;
    const m0 = t?.stats.marched ?? 0;
    clouds.temporalOn = true;
    await frames(40);
    const res = { has: !!t, marched: (t?.stats.marched ?? 0) - m0, material: clouds.mesh.material.name };
    const still = await sky();
    clouds.temporalOn = false; await frames(3);
    const perPixel = await sky();
    res.still = diff(still, perPixel);
    res.skyLevel = still.reduce((s, v) => s + v, 0) / still.length;
    // Turn the view by ≈4°: the temporal frame right after the turn, against the per-pixel march of
    // the turned view and against the frame before the turn.
    clouds.temporalOn = true; await frames(40);
    const before = await sky();
    vc.camera.rotateY(0.07); vc.camera.updateMatrixWorld();
    await frames(2);
    const turned = await sky();
    clouds.temporalOn = false; await frames(3);
    const turnedRef = await sky();
    res.turnedVsRef = diff(turned, turnedRef);
    res.turnedVsBefore = diff(turned, before);
    // A change of Sun with the camera still: after one round of the 16 the whole picture is the new
    // light's (it used to keep half the old one in 15 pixels of every 16).
    clouds.temporalOn = true; await frames(40);
    const { elev: sun0, azim: az0 } = vc.env.sunAngles ?? {};
    if (typeof vc.env.setSun === 'function' && Number.isFinite(sun0)) {
      vc.env.setSun(sun0 > 30 ? 8 : 55, az0, { immediate: true }); await frames(22);
      const relit = await sky();
      res.relightingLeft = t.relighting;
      clouds.temporalOn = false; await frames(3);
      const relitRef = await sky();
      res.relit = diff(relit, relitRef);
      res.relitVsOld = diff(relit, turned);
      vc.env.setSun(sun0, az0, { immediate: true }); await frames(3);
    }
    // No pixel of the stored distance is infinite or NaN (1e5 did not fit a 16-bit float).
    res.errors = [...vc.frameErrors.keys()];
    return res;
  });
  console.log(JSON.stringify(r));
  ok(r.has, 'the temporal march exists with ?cloudtaa');
  ok(r.marched >= 30, `a share of the clouds is marched every frame (${r.marched} in 40 frames)`);
  ok(r.skyLevel > 20, `the frame shows sky (${r.skyLevel.toFixed(0)} mean grey)`);
  ok(r.still.mean < 4 && r.still.p99 < 24, `still camera: the same sky as the per-pixel march (mean ${r.still.mean.toFixed(2)}, p99 ${r.still.p99})`);
  ok(r.turnedVsRef.mean < r.turnedVsBefore.mean, `turned camera: the clouds follow the view (vs turned reference ${r.turnedVsRef.mean.toFixed(2)}, vs the frame before ${r.turnedVsBefore.mean.toFixed(2)})`);
  ok(r.turnedVsRef.mean < 6, `turned camera: close to the per-pixel march of the new view (mean ${r.turnedVsRef.mean.toFixed(2)})`);
  if (r.relit) {
    ok(r.relightingLeft === 0, 'a change of Sun: the replacing round is over after 22 frames');
    ok(r.relit.mean < 4 && r.relit.p99 < 24, `a change of Sun: the whole sky is the new light's after one round (mean ${r.relit.mean.toFixed(2)}, p99 ${r.relit.p99}; against the old light ${r.relitVsOld.mean.toFixed(2)})`);
  } else ok(false, 'a change of Sun could not be driven (env.setSun / env.sunAngles)');
  ok(r.errors.length === 0, `no frame errors${r.errors.length ? ': ' + r.errors.join('; ') : ''}`);
} finally {
  await browser.close();
  server.close();
}
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('clouds-temporal-check: all good');
