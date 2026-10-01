/**
 * Builds the real terrain beyond the ground disc (src/core/realTerrain.js) from public tiles:
 *
 *   elevation  AWS Terrain Tiles, Terrarium encoding (Mapzen / Linux Foundation open data: USGS
 *              3DEP and NED in the United States, SRTM and others elsewhere, ETOPO1 offshore)
 *              https://registry.opendata.aws/terrain-tiles/
 *   imagery    EOxCloudless 2016, Sentinel-2 cloudless by EOX IT Services GmbH (contains
 *              modified Copernicus Sentinel data 2016), CC BY 4.0, https://cloudless.eox.at
 *
 * Two regions of Web Mercator tiles: NEAR, zoom 13 (≈17 m a pixel at 26° N), 8 × 8 tiles round
 * the pad; FAR, zoom 10 (≈138 m), 10 × 9 tiles under the X-15's route from the drop point
 * 300 km north-west. Writes src/assets/terrain/{near,far}.jpg (one atlas each) and
 * src/data/terrainTiles.js (the height grids, decimetres, base64 Int16).
 *
 *   node tools/terrain-fetch.mjs
 *
 * Downloads are cached in .cache/terrain (not committed); the tile servers are asked politely,
 * one tile at a time, with a plain user agent.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache/terrain');
const UA = 'Mozilla/5.0 (research script)';
const STEP = 16;   // height samples per tile edge (16 cells of a 256-pixel tile)

export const REGIONS = {
  near: { z: 13, x0: 1881, y0: 3479, nx: 8, ny: 8 },
  far: { z: 10, x0: 228, y0: 428, nx: 10, ny: 9 },
};
const DEM = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const IMG = (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;

async function cached(url, file) {
  const path = join(CACHE, file);
  if (existsSync(path)) return readFileSync(path);
  mkdirSync(dirname(path), { recursive: true });
  for (let k = 0; ; k++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(path, buf);
      return buf;
    } catch (e) {
      if (k === 3) throw new Error(`${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000 * 2 ** k));
    }
  }
}

/** Decodes an 8-bit RGB, non-interlaced PNG (what Terrarium tiles are) to metres. */
function terrarium(buf) {
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 2 || data[12] !== 0) throw new Error('not an 8-bit RGB PNG');
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), bpp = 3, stride = w * bpp;
  const px = new Uint8Array(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0, b = y ? px[dst + i - stride] : 0, c = i >= bpp && y ? px[dst + i - stride - bpp] : 0;
      let v = raw[src + i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + i] = v & 255;
    }
  }
  const m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = px[i * 3] * 256 + px[i * 3 + 1] + px[i * 3 + 2] / 256 - 32768;
  return m;
}

const out = {};
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [name, R] of Object.entries(REGIONS)) {
  const W = R.nx * STEP + 1, H = R.ny * STEP + 1;
  const grid = new Int16Array(W * H);
  const tiles = [];
  for (let j = 0; j < R.ny; j++) {
    for (let i = 0; i < R.nx; i++) {
      const x = R.x0 + i, y = R.y0 + j;
      const dem = terrarium(await cached(DEM(R.z, x, y), `dem/${R.z}/${x}_${y}.png`));
      tiles.push({ i, j, b64: (await cached(IMG(R.z, x, y), `s2/${R.z}/${x}_${y}.jpg`)).toString('base64') });
      // Each sample is the mean over its 16 × 16-pixel cell centred on it (within this tile),
      // the sea floor held at the surface: bathymetry is not ground.
      for (let b = 0; b <= STEP; b++) {
        for (let a = 0; a <= STEP; a++) {
          if ((a === STEP && i < R.nx - 1) || (b === STEP && j < R.ny - 1)) continue;
          let s = 0, n = 0;
          for (let v = b * 16 - 8; v < b * 16 + 8; v++) {
            for (let u = a * 16 - 8; u < a * 16 + 8; u++) {
              if (u < 0 || v < 0 || u > 255 || v > 255) continue;
              s += Math.max(0, dem[v * 256 + u]); n++;
            }
          }
          grid[(j * STEP + b) * W + i * STEP + a] = Math.round(s / n * 10);
        }
      }
    }
  }
  // The atlas: the tiles side by side, re-encoded once.
  const jpg = await page.evaluate(async ({ tiles, nx, ny }) => {
    const c = document.createElement('canvas');
    c.width = nx * 256; c.height = ny * 256;
    const g = c.getContext('2d');
    for (const t of tiles) {
      const im = new Image();
      im.src = `data:image/jpeg;base64,${t.b64}`;
      await im.decode();
      g.drawImage(im, t.i * 256, t.j * 256);
    }
    return c.toDataURL('image/jpeg', 0.86).split(',')[1];
  }, { tiles, nx: R.nx, ny: R.ny });
  mkdirSync(join(ROOT, 'src/assets/terrain'), { recursive: true });
  writeFileSync(join(ROOT, `src/assets/terrain/${name}.jpg`), Buffer.from(jpg, 'base64'));
  out[name] = { ...R, step: STEP, heights: Buffer.from(grid.buffer).toString('base64') };
  console.log(name, `${R.nx * 256}×${R.ny * 256}`, `heights ${W}×${H}`, `${Math.min(...grid) / 10}–${Math.max(...grid) / 10} m`);
}
await browser.close();

const body = Object.entries(out).map(([k, r]) =>
  `  ${k}: { z: ${r.z}, x0: ${r.x0}, y0: ${r.y0}, nx: ${r.nx}, ny: ${r.ny}, step: ${r.step},\n    heights: '${r.heights}' },`).join('\n');
writeFileSync(join(ROOT, 'src/data/terrainTiles.js'), `/**
 * Generated by tools/terrain-fetch.mjs: do not edit. Web Mercator tile regions of the real
 * terrain (src/core/realTerrain.js) and their height grids: (nx·step + 1) × (ny·step + 1)
 * samples, row by row from the north-west corner, little-endian Int16 decimetres above sea
 * level, base64. Heights are AWS Terrain Tiles (Terrarium), the sea floor held at zero.
 */
export const TERRAIN_TILES = {
${body}
};
`);
