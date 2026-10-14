/**
 * Exports a code-built vehicle to glTF, the starting point a Blender build (blender/<id>/)
 * imports and refines — the H2R's route (tools/h2r-export.mjs) for every other exhibit. It
 * runs the builder in a headless browser (the materials' textures are drawn in Canvas) with
 * the centre's own material library, and writes blender/<id>/source/code-parts.glb, which is
 * not committed. The runtime detail shaders are not exported: the Blender build gives the
 * surfaces their own textures.
 * Run: node tools/vehicle-export.mjs starship
 */
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';

// id → [module, builder export]
const BUILDERS = {
  starship: ['./src/vehicles/starship.js', 'buildStarship'],
  gt3rs: ['./src/vehicles/gt3rs.js', 'buildGt3rs'],
};

const id = process.argv[2];
if (!BUILDERS[id]) {
  console.error(`usage: node tools/vehicle-export.mjs <${Object.keys(BUILDERS).join('|')}>`);
  process.exit(2);
}
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = new URL(`../blender/${id}/source/code-parts.glb`, import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.route(`${base}/_vehicle-export.html`, r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel="stylesheet" href="vendor/fonts/plex.css"><script type="importmap">{"imports":{"three":"./vendor/three/build/three.module.js","three/addons/":"./vendor/three/examples/jsm/"}}</script>` }));
  await page.goto(`${base}/_vehicle-export.html`);
  const b64 = await page.evaluate(async ([mod, fn]) => {
    await document.fonts.load('16px "IBM Plex Sans"').catch(() => {});
    const { createMaterials } = await import('./src/materials/library.js');
    const { M } = await createMaterials();
    const build = (await import(mod))[fn];
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const root = build(M);
    root.updateMatrixWorld(true);
    // Every material keeps the library key it came from, so the Blender build (and the runtime
    // loader) can tell M.steelFlap from M.steelSkirt by name.
    const keys = new Map(Object.entries(M).filter(([, m]) => m?.isMaterial).map(([k, m]) => [m, k]));
    root.traverse(o => { for (const m of [].concat(o.material ?? [])) if (keys.has(m)) m.name = keys.get(m); });
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 2048 });
    const bytes = new Uint8Array(glb);
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, BUILDERS[id]);
  await mkdir(new URL('.', OUT), { recursive: true });
  const buf = Buffer.from(b64, 'base64');
  await writeFile(OUT, buf);
  console.log(`blender/${id}/source/code-parts.glb: ${(buf.length / 1e6).toFixed(1)} MB`);
} finally {
  await browser.close();
  server.close();
}
