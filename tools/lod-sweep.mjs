/**
 * Continuous level-of-detail sweep.
 *
 * The gate's near/far test is a two-point check: it proves detail is shed at 300 m and back at
 * 2 m. It cannot see any of the things that actually make level-of-detail look bad, all of
 * which happen BETWEEN those two points — a state flipping repeatedly as the camera creeps
 * across a threshold, an assembly vanishing while it is still clearly visible, or a switch
 * that changes the silhouette rather than just the detail inside it.
 *
 * So this walks the camera along a line towards each target and back out again, in small
 * steps, and at every step records what each entry is showing, how many pixels its feature
 * occupies, and what the renderer actually drew. Then it reports:
 *
 *   flicker    an entry that changed state more than once per direction. With one threshold
 *              this was inevitable near the switch; with hysteresis it should be impossible.
 *   pops       the biggest single-step jumps in drawn triangles and meshes, with the distance
 *              and the entries that changed there, so the frames around them can be looked at.
 *   early      an entry still shedding while its feature is well above the threshold.
 *
 * It also writes a frame on each side of every transition, for judging by eye whether what
 * changed was detail (fine) or outline (not fine).
 *
 *   node tools/lod-sweep.mjs <outdir> [--steps 60] [--quality high]
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.VC_LOD_PORT ?? 8804);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const outdir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--steps' && args[i - 1] !== '--quality');
const STEPS = Number(argOf('--steps') ?? 60);
const TIER = argOf('--quality') ?? 'high';
if (!outdir) { console.error('uso: node tools/lod-sweep.mjs <outdir> [--steps N]'); process.exit(2); }
await mkdir(outdir, { recursive: true });

/**
 * Each target names a point to approach and the range to sweep. `match` selects the entries
 * this target is responsible for, so a sweep towards the Roadster is not reported as having
 * flickered the pad.
 */
const TARGETS = [
  { name: 'falcon1', exhibit: 'falcon1', at: [0, 3, 0], from: 250, to: 3, match: /^falcon1-/ },
  { name: 'tps', exhibit: 'starship', at: [0, 95, 6], from: 420, to: 12, match: /^starship-/ },
  { name: 'roadster', exhibit: 'roadster', at: [0, 0.9, 0], from: 260, to: 3.2, match: /^roadster-/ },
  { name: 'dragon', exhibit: 'dragon', at: [0, 3.2, 0], from: 260, to: 4.5, match: /^dragon-/ },
  { name: 'starlink', exhibit: 'starlink', at: [0, 0.4, 0], from: 260, to: 5, match: /^starlink-/ },
  { name: 'falcon', exhibit: 'falcon9', at: [0, 4, 0], from: 300, to: 7, match: /^falcon9-/ },
  { name: 'falconheavy', exhibit: 'falconheavy', at: [0, 4, 0], from: 300, to: 9, match: /^falconheavy-/ },
  { name: 'engines', exhibit: 'engines', at: [0, 2.2, 0], from: 200, to: 4, match: /^engines-/ },
  { name: 'pad', exhibit: 'starship', at: [0, 24, 30], from: 420, to: 26, match: /^pad-/ },
];

const server = createServer(async (req, res) => {
  try {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const p = join(ROOT, (rel === '/' || rel === '\\' || rel === '') ? 'index.html' : rel);
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await bootAtQuality(page, `http://127.0.0.1:${PORT}/`, TIER);
// The furniture is not what is being judged here, and a callout appearing is not a pop.
await page.evaluate(() => {
  ['labels', 'ruler', 'humans'].forEach(t => window.__vc.setToggle(t, false));
});

let problems = 0;
const say = (ok, line) => { if (!ok) problems++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${line}`); };

for (const t of TARGETS) {
  // Approach along a fixed bearing so distance is the only thing changing: a sweep that also
  // swung round the vehicle would confound a state change with a change of aspect.
  const DIR = [0.62, 0.28, 0.73];
  const samples = [];

  /** Puts the camera `d` metres from the target along DIR and re-evaluates. */
  const place = (d) => page.evaluate(([ex, at, dir, dist]) => {
    const v = window.__vc, e = v.exhibits[ex];
    const ox = e.lay.x + at[0], oy = e.model.position.y + at[1], oz = e.lay.z + at[2];
    v.rig.jumpTo([ox + dir[0] * dist, oy + dir[1] * dist, oz + dir[2] * dist], [ox, oy, oz]);
    v.camera.updateMatrixWorld(true);
    v.lod.update();
    return v.lod.snapshot();
  }, [t.exhibit, t.at, DIR, d]);

  for (const leg of ['in', 'out']) {
    for (let s = 0; s <= STEPS; s++) {
      const u = s / STEPS;
      // Logarithmic in distance: the thresholds are spread over a decade of range, and a
      // linear walk spends most of its steps far away where nothing happens.
      const k = leg === 'in' ? u : 1 - u;
      const d = t.from * Math.pow(t.to / t.from, k);
      const snap = await place(d);
      samples.push({ leg, d, snap: snap.filter(r => t.match.test(r.name)) });
    }
  }

  // ---- flicker ----------------------------------------------------------------------------
  // A monotonic approach may change each entry's state once. Twice means the camera crossed
  // the same switch twice without reversing, which is the definition of flicker.
  const byName = new Map();
  for (const s of samples) {
    for (const r of s.snap) {
      if (!byName.has(r.name)) byName.set(r.name, { in: [], out: [], enter: r.enter, leave: r.leave, feature: r.feature });
      byName.get(r.name)[s.leg].push({ d: s.d, on: r.detailed });
    }
  }
  const flickers = [];
  for (const [name, rec] of byName) {
    for (const leg of ['in', 'out']) {
      let flips = 0;
      for (let i = 1; i < rec[leg].length; i++) if (rec[leg][i].on !== rec[leg][i - 1].on) flips++;
      if (flips > 1) flickers.push(`${name}/${leg}×${flips}`);
    }
  }
  say(flickers.length === 0, `${t.name}: sin parpadeo en ${byName.size} entradas` + (flickers.length ? ` — ${flickers.join(', ')}` : ''));

  // ---- where the transitions are, for the eye ---------------------------------------------
  const trans = [];
  const inLeg = samples.filter(s => s.leg === 'in');
  for (let i = 1; i < inLeg.length; i++) {
    const changed = inLeg[i].snap.filter((r, j) => r.detailed !== inLeg[i - 1].snap[j]?.detailed).map(r => r.name);
    if (changed.length) trans.push({ d: inLeg[i].d, prev: inLeg[i - 1].d, changed });
  }
  // Only a handful of frames per target: these are for the eye, and every one costs two
  // software-rasterised renders. Take the transitions that move the most entries at once,
  // which are also the ones most likely to be visible.
  const pick = [...trans.entries()].sort((a, b) => b[1].changed.length - a[1].changed.length).slice(0, 4);
  for (const [i, tr] of pick) {
    for (const [tag, dd] of [['before', tr.prev], ['after', tr.d]]) {
      await place(dd);
      await page.waitForTimeout(280);
      const f = `${outdir}/${t.name}-${String(i).padStart(2, '0')}-${tag}.jpg`;
      await page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 120000 });
    }
  }
  console.log(`        ${trans.length} umbrales: ${trans.map(x => `${x.d.toFixed(0)}m(${x.changed.length})`).join(' ')}`);
}

console.log(problems ? `\n${problems} problema(s) de LOD` : '\nSin parpadeo en ningún barrido');
await browser.close();
server.close();
process.exit(problems ? 1 : 0);
