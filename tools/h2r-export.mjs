/**
 * Exports the Ninja H2R's code-built parts (src/vehicles/h2r/) to glTF, the starting point the
 * Blender build (blender/h2r/build.py) imports and refines. It runs the builder in a headless
 * browser (its canvas-drawn decals and emblem need one) and writes
 * blender/h2r/source/code-parts.glb. The runtime detail shaders (materials/detail.js) are not
 * exported: the Blender build gives the surfaces their own textures.
 * Run: node tools/h2r-export.mjs
 */
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { staticHandler } from './static.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = new URL('../blender/h2r/source/code-parts.glb', import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  // A bare page with the project's import map: the builder alone, not the whole centre.
  await page.route(`${base}/_h2r-export.html`, r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><script type="importmap">{"imports":{"three":"./vendor/three/build/three.module.js","three/addons/":"./vendor/three/examples/jsm/"}}</script>` }));
  await page.goto(`${base}/_h2r-export.html`);
  const b64 = await page.evaluate(async () => {
    const { buildH2r } = await import('./src/vehicles/h2r/index.js');
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const root = buildH2r({});
    root.updateMatrixWorld(true);
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 2048 });
    const bytes = new Uint8Array(glb);
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  await mkdir(new URL('.', OUT), { recursive: true });
  const buf = Buffer.from(b64, 'base64');
  await writeFile(OUT, buf);
  console.log(`blender/h2r/source/code-parts.glb: ${(buf.length / 1e6).toFixed(1)} MB`);
} finally {
  await browser.close();
  server.close();
}
