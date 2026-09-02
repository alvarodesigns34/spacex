/**
 * Procedural texture generation (Canvas 2D). Everything is generated at start-up so the
 * project needs no binary assets and every surface can be tuned in code.
 *
 * All textures are authored in metric tiles: `tileSize` is the physical size (m) covered by
 * one repeat, so materials set `repeat = 1 / tileSize` and geometry emits UVs in metres.
 */
import * as THREE from 'three';
import { seeded } from '../geometry/utils.js';

const rng = seeded(20260902);

// ---------- value-noise ----------
const LAT = 256;
const lattice = new Float32Array(LAT * LAT);
for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
function lat(ix, iy) { return lattice[((iy & (LAT - 1)) * LAT) + (ix & (LAT - 1))]; }
function smooth(t) { return t * t * (3 - 2 * t); }
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export function fbm(x, y, oct = 4, lac = 2.1, gain = 0.5) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
  return s / norm;
}

const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- canvas helpers ----------
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Runs fn(x, y, u, v) -> [r,g,b] (0..255) for every pixel. */
export function shade(c, fn) {
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data;
  const w = c.width, h = c.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rgb = fn(x, y, x / w, y / h);
      const i = (y * w + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Height (grayscale canvas) -> tangent-space normal map canvas, tileable. */
export function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function toTexture(c, { srgb = false, tileSize = null, tileSizeU = null, wrap = THREE.RepeatWrapping, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = wrap;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  if (tileSize) t.repeat.set(1 / (tileSizeU ?? tileSize), 1 / tileSize);
  t.needsUpdate = true;
  return t;
}

// =====================================================================================
//  STAINLESS STEEL (Starship / Super Heavy) — one ring (1.83 m) per tile, weld seam on top.
// =====================================================================================
let _steelNormal = null;
export function makeSteel({ size = 768, ring = 1.83, heat = 0, soot = 0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  // Roll-forming leaves fine circumferential brushing; column-based streaks + fine grain.
  // Brushing runs fine and high-frequency: anything low-frequency here would tile visibly
  // around the circumference.
  const colStreak = new Float32Array(size);
  for (let x = 0; x < size; x++) colStreak[x] = fbm(x * 0.55, 3.7, 2) * 0.45 + fbm(x * 1.9, 11.1, 2) * 0.55;
  // Ring weld at v = 0.5 (one ring per tile) with its heat-affected zone, and the vertical
  // seam where two plates of a ring meet — the hull is rolled from plates, and photographs
  // show both weld directions clearly.
  const bead = new Float32Array(size);
  const haz = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    bead[y] = Math.exp(-Math.pow((v - 0.5) * size / 3.0, 2));
    haz[y] = Math.exp(-Math.pow((v - 0.5) * size / 11.0, 2));
  }
  const vseam = new Float32Array(size);
  const vhaz = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const u = x / size;
    vseam[x] = Math.exp(-Math.pow((u - 0.5) * size / 2.6, 2));
    vhaz[x] = Math.exp(-Math.pow((u - 0.5) * size / 9.0, 2));
    // Plates are slightly dished between welds; the shading falls off towards each seam.
    vhaz[x] += 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 2);
  }
  shade(map, (x, y, u, v) => {
    const streak = (colStreak[x] - 0.5) * 0.16;
    const grain = (noise2(x * 0.6, y * 0.6) - 0.5) * 0.045;
    const blotch = (fbm(u * 6 + 7, v * 9 + 3, 4) - 0.5) * 0.05;
    // Mill-finish stainless is bright; the map is mostly reflectance modulation.
    // Mill-finish stainless photographs as a matte mid grey, not a mirror.
    let base = 0.70 + streak * 0.7 + grain + blotch - vhaz[x] * 0.045;
    let r = base, g = base, b = base;
    // Heat-affected zone next to each weld runs slightly straw/blue.
    const hazMix = haz[y] * (0.35 + 0.65 * fbm(u * 6 + 2, v * 4, 3));
    r = lerp(r, base * 0.97, hazMix); g = lerp(g, base * 0.93, hazMix); b = lerp(b, base * 0.88, hazMix);
    if (heat > 0) {
      const heatMix = heat * (0.5 + 0.5 * fbm(u * 7 + 1, v * 5 + 9, 4));
      r = lerp(r, base * 0.90, heatMix); g = lerp(g, base * 0.76, heatMix); b = lerp(b, base * 0.60, heatMix);
      // Weld/flame discolouration on stainless runs straw → light blue; keep it subtle so it
      // reads as tempering rather than as paint.
      const blue = Math.max(0, fbm(u * 6 + 4, v * 6 + 2, 3) - 0.58) * heat * 1.1;
      r = lerp(r, base * 0.72, blue); g = lerp(g, base * 0.76, blue); b = lerp(b, base * 0.86, blue);
    }
    if (soot > 0) {
      const sm = soot * (0.35 + 0.65 * fbm(u * 5 + 11, v * 8, 4));
      r *= (1 - sm * 0.72); g *= (1 - sm * 0.72); b *= (1 - sm * 0.70);
    }
    const dark = bead[y] * 0.28 + vseam[x] * 0.22;
    return [clamp(r * (1 - dark) * 255), clamp(g * (1 - dark) * 255), clamp(b * (1 - dark) * 255)];
  });
  shade(rough, (x, y, u, v) => {
    // Bright mill finish: low roughness on the panels, rough at the weld and where it is
    // sooted or heat-tinted, which is what makes the ring seams read at a distance.
    const base = 0.34 + (colStreak[x] - 0.5) * 0.08 + (fbm(u * 7, v * 10, 3) - 0.5) * 0.08
      + bead[y] * 0.36 + haz[y] * 0.10 + vseam[x] * 0.32 + vhaz[x] * 0.06 + heat * 0.16 + soot * 0.34;
    const g = clamp(base * 255);
    return [g, g, g];
  });
  if (!_steelNormal) {
    const height = canvas(size, size);
    shade(height, (x, y, u, v) => {
      // Bead proud of the sheet, plus a shallow dish either side from weld shrinkage.
      const h = 0.5 + bead[y] * 0.40 - haz[y] * 0.10 + vseam[x] * 0.34 - vhaz[x] * 0.07
        + (noise2(x * 0.6, y * 0.6) - 0.5) * 0.05 + (fbm(u * 1.5, v * 16, 2) - 0.5) * 0.05;
      const g = clamp(h * 255);
      return [g, g, g];
    });
    _steelNormal = toTexture(heightToNormal(height, 1.8), { tileSize: ring, tileSizeU: ring * 4 });
  }
  const U = ring * 4;
  return {
    map: toTexture(map, { srgb: true, tileSize: ring, tileSizeU: U }),
    roughnessMap: toTexture(rough, { tileSize: ring, tileSizeU: U }),
    normalMap: _steelNormal,
    tileSize: ring,
  };
}

// =====================================================================================
//  FALCON first-stage full-body texture (unwrapped: u = around, v = height fraction).
//  Includes friction-stir-weld panel lines, soot streaks from a flown booster and markings.
// =====================================================================================
export function makeFalconBody({ w = 1024, h = 2048, height = 41.2, name = 'FALCON 9', flown = true } = {}) {
  const map = canvas(w, h);
  const rough = canvas(Math.round(w / 2), Math.round(h / 2));
  const circumference = Math.PI * 3.7;
  // Panel (barrel section) lines every ~2.4 m in height, plus 4 longitudinal welds (approximation).
  const panelPitch = 2.4 / height;
  const sootBand = (v) => flown ? Math.max(0, 1 - v * 1.9) : 0;     // darker near the base (v=0)
  shade(map, (x, y, u, v) => {
    const vv = 1 - v; // canvas y=0 is the top of the stage
    let base = 0.93 + (fbm(u * 24, vv * 60, 3) - 0.5) * 0.05;
    // soot: streaks following the airflow (vertical), stronger at the base and on one side
    const streak = fbm(u * 60 + 5, vv * 3, 4);
    const sBand = sootBand(vv);
    const s = flown ? (sBand * (0.35 + 0.65 * streak) * 0.55 + Math.max(0, fbm(u * 8, vv * 6 + 2, 3) - 0.55) * 0.35) : 0;
    let r = base * (1 - s * 0.85), g = base * (1 - s * 0.85), b = base * (1 - s * 0.8);
    // panel lines
    const pl = Math.abs(((vv / panelPitch) % 1) - 0.5) < 0.004 ? 0.08 : 0;
    const ll = Math.abs(((u * 4) % 1) - 0.5) < 0.0015 ? 0.06 : 0;
    r -= pl + ll; g -= pl + ll; b -= pl + ll;
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const vv = 1 - v;
    const s = sootBand(vv) * fbm(u * 60 + 5, vv * 3, 4);
    const g = clamp((0.38 + (fbm(u * 30, vv * 80, 3) - 0.5) * 0.15 + s * 0.4) * 255);
    return [g, g, g];
  });
  // Markings: vehicle name reads top-to-bottom along the stage.
  const ctx = map.getContext('2d');
  ctx.save();
  ctx.translate(w * 0.115, h * 0.20);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#111114';
  ctx.font = `600 ${Math.round(w * 0.075)}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(w * 0.012)}px`;
  ctx.fillText(name, 0, 0);
  ctx.restore();
  // Secondary wordmark on the opposite side.
  ctx.save();
  ctx.translate(w * 0.615, h * 0.20);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#111114';
  ctx.font = `600 ${Math.round(w * 0.05)}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(w * 0.02)}px`;
  ctx.fillText('SPACEX', 0, 0);
  ctx.restore();
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: toTexture(rough, { wrap: THREE.ClampToEdgeWrapping }),
  };
}

// =====================================================================================
//  GENERIC WHITE PAINT (second stage, fairing, Dragon) with faint panel structure.
// =====================================================================================
export function makeWhitePaint({ size = 512, tile = 2.0, grid = 0, tone = 0.94, dirt = 0.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const hd = new Float32Array(size * size);
  shade(map, (x, y, u, v) => {
    let base = tone + (fbm(u * 12, v * 12, 3) - 0.5) * 0.04;
    let line = 0;
    if (grid > 0) {
      const gu = Math.abs(((u * grid) % 1) - 0.5) < 0.006 ? 1 : 0;
      const gv = Math.abs(((v * grid) % 1) - 0.5) < 0.006 ? 1 : 0;
      line = Math.max(gu, gv);
    }
    hd[y * size + x] = 0.5 - line * 0.4;
    const d = dirt * Math.max(0, fbm(u * 5 + 3, v * 5 + 7, 4) - 0.5) * 0.5;
    const c = clamp((base - line * 0.10 - d) * 255);
    return [c, c, clamp((base - line * 0.10 - d * 0.9) * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.42 + (fbm(u * 20, v * 20, 3) - 0.5) * 0.18) * 255); return [g, g, g]; });
  shade(height, (x, y) => { const g = clamp(hd[y * size + x] * 255); return [g, g, g]; });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 1.2), { tileSize: tile }),
    tileSize: tile,
  };
}

// =====================================================================================
//  CARBON COMPOSITE (interstage, landing legs, fairing inside)
// =====================================================================================
export function makeCarbon({ size = 512, tile = 0.6 } = {}) {
  const map = canvas(size, size);
  const height = canvas(size, size);
  const rough = canvas(size, size);
  const cells = 48;
  shade(map, (x, y, u, v) => {
    const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
    const weave = ((cx + cy) % 2) ? 0.16 : 0.11;
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const strand = ((cx + cy) % 2) ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
    const c = clamp((weave + strand * 0.05 + (noise2(x * 0.8, y * 0.8) - 0.5) * 0.03) * 255);
    return [c, c, c + 2];
  });
  shade(height, (x, y, u, v) => {
    const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const strand = ((cx + cy) % 2) ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
    const g = clamp((0.4 + strand * 0.3) * 255);
    return [g, g, g];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.36 + (fbm(u * 10, v * 10, 2) - 0.5) * 0.1) * 255); return [g, g, g]; });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 0.8), { tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    tileSize: tile,
  };
}

// =====================================================================================
//  SOLAR CELLS
// =====================================================================================
export function makeSolar({ size = 512, tile = 1.0, cell = 0.125, tint = [0.13, 0.18, 0.34] } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const cells = tile / cell;
  shade(map, (x, y, u, v) => {
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const border = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97) ? 1 : 0;
    const bus = (Math.abs(fx - 0.5) < 0.012 || Math.abs(fx - 0.25) < 0.006 || Math.abs(fx - 0.75) < 0.006) ? 0.5 : 0;
    const n = (fbm(u * 30, v * 30, 2) - 0.5) * 0.06;
    const iri = fbm(u * 3 + 5, v * 3 + 2, 2);
    let r = tint[0] + n + iri * 0.06, g = tint[1] + n + iri * 0.05, b = tint[2] + n + iri * 0.02;
    if (border) { r = 0.72; g = 0.72; b = 0.70; }
    if (bus) { r = lerp(r, 0.75, bus); g = lerp(g, 0.75, bus); b = lerp(b, 0.72, bus); }
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const border = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97) ? 1 : 0;
    const g = clamp((border ? 0.5 : 0.18 + (fbm(u * 20, v * 20, 2) - 0.5) * 0.08) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const fx = (u * cells) % 1, fy = (v * cells) % 1;
    const border = (fx < 0.03 || fx > 0.97 || fy < 0.03 || fy > 0.97) ? 1 : 0;
    const g = clamp((border ? 0.3 : 0.6) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile }),
    roughnessMap: toTexture(rough, { tileSize: tile }),
    normalMap: toTexture(heightToNormal(height, 0.6), { tileSize: tile }),
    tileSize: tile,
  };
}

// =====================================================================================
//  CONCRETE APRON (ground) with expansion joints.
// =====================================================================================
export function makeConcrete({ size = 768, tile = 12.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const joints = 2; // joints per tile => 6 m slabs
  shade(map, (x, y, u, v) => {
    const n = fbm(u * 6 + 2, v * 6 + 9, 5);
    const fine = (noise2(x * 0.9, y * 0.9) - 0.5) * 0.06;
    const stain = Math.max(0, fbm(u * 2.2 + 8, v * 2.2 + 1, 4) - 0.52) * 0.5;
    const ju = Math.abs(((u * joints) % 1) - 0.5) < 0.004 ? 1 : 0;
    const jv = Math.abs(((v * joints) % 1) - 0.5) < 0.004 ? 1 : 0;
    let c = 0.40 + (n - 0.5) * 0.18 + fine - stain;
    if (ju || jv) c *= 0.55;
    return [clamp(c * 1.035 * 255), clamp(c * 255), clamp(c * 0.93 * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.82 + (fbm(u * 12, v * 12, 3) - 0.5) * 0.2) * 255); return [g, g, g]; });
  shade(height, (x, y, u, v) => {
    const ju = Math.abs(((u * joints) % 1) - 0.5) < 0.004 ? 1 : 0;
    const jv = Math.abs(((v * joints) % 1) - 0.5) < 0.004 ? 1 : 0;
    const g = clamp((0.5 + (fbm(u * 24, v * 24, 3) - 0.5) * 0.3 - (ju || jv ? 0.4 : 0)) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 1.0), { tileSize: tile, anisotropy: 16 }),
    tileSize: tile,
  };
}

// =====================================================================================
//  MULTI-LAYER INSULATION FOIL (crinkled)
// =====================================================================================
export function makeFoil({ size = 256, tile = 0.5 } = {}) {
  const map = canvas(size, size);
  const height = canvas(size, size);
  shade(height, (x, y, u, v) => {
    const c = fbm(u * 18, v * 18, 5, 2.4, 0.55);
    const crease = Math.abs(fbm(u * 9 + 3, v * 9 + 1, 3) - 0.5) * 2;
    const g = clamp((c * 0.7 + crease * 0.3) * 255);
    return [g, g, g];
  });
  shade(map, (x, y, u, v) => {
    const c = 0.85 + (fbm(u * 18, v * 18, 4) - 0.5) * 0.2;
    return [clamp(c * 255), clamp(c * 0.78 * 255), clamp(c * 0.42 * 255)];
  });
  return { map: toTexture(map, { srgb: true, tileSize: tile }), normalMap: toTexture(heightToNormal(height, 3.0), { tileSize: tile }), tileSize: tile };
}

// =====================================================================================
//  PICA-X style ablative heat shield (Dragon): dark, matte, tiled in sectors.
// =====================================================================================
export function makePica({ size = 512 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  // polar tile pattern: 12 sectors x 4 rings around the centre of the texture.
  const polar = (u, v) => {
    const dx = u - 0.5, dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
    return [r, a];
  };
  shade(map, (x, y, u, v) => {
    const [r, a] = polar(u, v);
    const ring = Math.floor(r * 4), sec = Math.floor(a * 12 + ring * 0.5);
    const fr = (r * 4) % 1, fa = (a * 12 + ring * 0.5) % 1;
    const gap = (fr < 0.03 || fa < 0.02) ? 1 : 0;
    const tileTone = 0.30 + ((sec * 7 + ring * 3) % 5) * 0.02;
    const char = fbm(u * 10, v * 10, 4) * 0.08;
    let c = tileTone + char;
    if (gap) c *= 0.5;
    return [clamp(c * 255), clamp(c * 0.86 * 255), clamp(c * 0.72 * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.88 + (fbm(u * 16, v * 16, 3) - 0.5) * 0.1) * 255); return [g, g, g]; });
  shade(height, (x, y, u, v) => {
    const [r, a] = polar(u, v);
    const ring = Math.floor(r * 4);
    const fr = (r * 4) % 1, fa = (a * 12 + ring * 0.5) % 1;
    const gap = (fr < 0.03 || fa < 0.02) ? 1 : 0;
    const g = clamp((0.55 - gap * 0.35 + (fbm(u * 40, v * 40, 3) - 0.5) * 0.1) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: toTexture(rough, { wrap: THREE.ClampToEdgeWrapping }),
    normalMap: toTexture(heightToNormal(height, 1.5), { wrap: THREE.ClampToEdgeWrapping }),
  };
}

// =====================================================================================
//  DARK ALLOY (engine bells) — vertical gradient with heat discolouration bands.
// =====================================================================================
export function makeEngineBell({ size = 384, copper = 0.5 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  shade(map, (x, y, u, v) => {
    // v = 0 at the exit plane, 1 at the throat/chamber
    const streak = (fbm(u * 40, v * 3, 3) - 0.5) * 0.08;
    const band = fbm(u * 2, v * 9 + 3, 3);
    let r = 0.36 + streak, g = 0.34 + streak, b = 0.33 + streak;
    const heat = Math.max(0, 0.6 - Math.abs(v - 0.25) * 2) * copper;
    r = lerp(r, 0.55, heat * band); g = lerp(g, 0.32, heat * band); b = lerp(b, 0.22, heat * band);
    const blue = Math.max(0, 0.5 - Math.abs(v - 0.55) * 3) * copper * 0.7;
    r = lerp(r, 0.25, blue * (1 - band)); g = lerp(g, 0.28, blue * (1 - band)); b = lerp(b, 0.40, blue * (1 - band));
    // cooling channel ribs (regenerative cooling tubes)
    const rib = Math.sin(u * Math.PI * 2 * 90) * 0.5 + 0.5;
    const ribMix = 0.05 * (1 - v * 0.5);
    r += (rib - 0.5) * ribMix; g += (rib - 0.5) * ribMix; b += (rib - 0.5) * ribMix;
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.42 + (fbm(u * 12, v * 12, 3) - 0.5) * 0.2 + (1 - v) * 0.1) * 255); return [g, g, g]; });
  return { map: toTexture(map, { srgb: true, wrap: THREE.RepeatWrapping }), roughnessMap: toTexture(rough) };
}

// =====================================================================================
//  GRID (used on mount surfaces / small technical panels)
// =====================================================================================
export function makeGreyMetal({ size = 256, tile = 1.0, tone = 0.5 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  shade(map, (x, y, u, v) => {
    const c = tone + (fbm(u * 8, v * 8, 4) - 0.5) * 0.14 + (noise2(x * 0.7, y * 0.7) - 0.5) * 0.04;
    return [clamp(c * 255), clamp(c * 255), clamp(c * 1.02 * 255)];
  });
  shade(rough, (x, y, u, v) => { const g = clamp((0.55 + (fbm(u * 10, v * 10, 3) - 0.5) * 0.25) * 255); return [g, g, g]; });
  return { map: toTexture(map, { srgb: true, tileSize: tile }), roughnessMap: toTexture(rough, { tileSize: tile }), tileSize: tile };
}
