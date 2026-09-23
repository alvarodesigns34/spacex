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
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

/**
 * Ceiling on anisotropic filtering, set once from the quality tier and from what the hardware
 * actually offers.
 *
 * The tiers declared an `anisotropy` field from the day they were written and nothing read it:
 * every builder here asked for 8 or 16 outright, so the cheap tier paid the same per-sample
 * cost as the expensive one and the knob was decoration. Values passed below are requests now,
 * and this is the limit they are held to — which also stops the code asking a device for 16×
 * when it caps at 4 and silently getting something else.
 */
let ANISO_LIMIT = 8;
export function setAnisotropyLimit(n) { ANISO_LIMIT = Math.max(1, Math.floor(n) || 1); }
export function anisotropyLimit() { return ANISO_LIMIT; }

export function toTexture(c, { srgb = false, tileSize = null, tileSizeU = null, wrap = THREE.RepeatWrapping, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = wrap;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(anisotropy, ANISO_LIMIT);
  if (tileSize) t.repeat.set(1 / (tileSizeU ?? tileSize), 1 / tileSize);
  // Recorded so verify.js can ask the question that matters about a UV map: not "does it
  // vary?" but "does it vary at the rate this texture was authored for?". A map with a
  // tileSize expects metric UVs; one without expects a single normalised wrap. Mixing the two
  // is invisible in code and ruinous on screen — it is what left the 5 km apron untextured.
  t.userData.tileSize = tileSize ?? null;
  t.userData.tileSizeU = tileSize ? (tileSizeU ?? tileSize) : null;
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
    // Plate-to-plate variation. A Starship hull is rolled from sheet that does not all come
    // from the same coil, and the difference between neighbouring plates is clearly visible
    // in photographs — it is most of what stops a 70 m barrel reading as one extruded tube.
    // Keyed to the tile, so it varies by ring rather than washing across the whole vehicle.
    const plate = (fbm(u * 1.7 + 31, v * 1.3 + 17, 2) - 0.5) * 0.085;
    // Mill-finish stainless is bright; the map is mostly reflectance modulation.
    // Mill-finish stainless photographs as a matte mid grey, not a mirror.
    let base = 0.80 + streak * 0.7 + grain + blotch + plate - vhaz[x] * 0.04;
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
    const panel = (colStreak[x] - 0.5) * 0.05;
    // Ring welds read; the vertical plate seams are finer and, at 0.22, drew the hull as a
    // sheet of graph paper in every close view of the barrel.
    const dark = bead[y] * 0.20 + vseam[x] * 0.07;
    return [clamp((r + panel) * (1 - dark) * 255), clamp((g + panel) * (1 - dark) * 255), clamp((b + panel) * (1 - dark) * 255)];
  });
  shade(rough, (x, y, u, v) => {
    // Bright mill finish: low roughness on the panels, rough at the weld and where it is
    // sooted or heat-tinted, which is what makes the ring seams read at a distance.
    const base = 0.48 + (colStreak[x] - 0.5) * 0.08 + (fbm(u * 7, v * 10, 3) - 0.5) * 0.06
      + bead[y] * 0.36 + haz[y] * 0.10 + vseam[x] * 0.14 + vhaz[x] * 0.06 + heat * 0.16 + soot * 0.34;
    const g = clamp(base * 255);
    return [g, g, g];
  });
  if (!_steelNormal) {
    const height = canvas(size, size);
    shade(height, (x, y, u, v) => {
      // Bead proud of the sheet, plus a shallow dish either side from weld shrinkage.
      const h = 0.5 + bead[y] * 0.40 - haz[y] * 0.10 + vseam[x] * 0.12 - vhaz[x] * 0.07
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
  // Soot on a flight-proven booster, as photographed after landing (Commons, B1019 at LZ-1, and
  // any reused core on the pad): the whole stage is greyed by the entry and landing burns, in
  // streaks that run down the airflow, heaviest over the LOX tank near the top of the stage and
  // on the side that faced the plume, and lightest at the base. Where the stowed legs covered
  // the skin there is a clean white shadow of each leg. The old pattern put the soot at the
  // BASE and nowhere else, which is the one place photographs show the stage cleanest, and
  // left the exhibit reading as a new, unflown white tube.
  const legU = [0.125, 0.375, 0.625, 0.875];            // leg azimuths π/4 + kπ/2, as u
  const legTop = 9.6 / height, circ = Math.PI * 3.7;
  const legShadow = (u, vv) => {
    if (vv > legTop + 0.01) return 0;
    const t = Math.min(1, vv / legTop);
    const half = (0.56 - 0.47 * t) / circ;                // the leg fairing's own taper
    let m = 0;
    for (const lu of legU) {
      const d = Math.abs(((u - lu + 1.5) % 1) - 0.5);
      m = Math.max(m, 1 - smoothstep(half * 0.85, half * 1.25, d));
    }
    return m * (1 - smoothstep(legTop - 0.01, legTop + 0.01, vv));
  };
  const sootAt = (u, vv) => {
    if (!flown) return 0;
    const streak = fbm(u * 70 + 5, vv * 2.4, 4);                    // long vertical streaks
    const patch = fbm(u * 9 + 2, vv * 5 + 7, 3);
    const amount = 0.66 + 0.30 * smoothstep(0.22, 0.88, vv);        // heavier towards the top
    const windward = 0.88 + 0.16 * Math.cos(Math.PI * 2 * (u - 0.62));
    const s = amount * windward * (0.62 + 0.38 * streak) * (0.88 + 0.24 * patch);
    return Math.min(0.9, s) * (1 - 0.9 * legShadow(u, vv));
  };
  shade(map, (x, y, u, v) => {
    const vv = 1 - v; // canvas y=0 is the top of the stage
    let base = 0.93 + (fbm(u * 24, vv * 60, 3) - 0.5) * 0.05;
    const s = sootAt(u, vv);
    // Soot is a warm grey-brown, not neutral black.
    // Strong enough to survive the exposure: the stage is lit near white, and at 0.74 the
    // streaks came out as a faint tint. Photographs show a mid grey over most of the stage.
    let r = base * (1 - s * 0.9), g = base * (1 - s * 0.91), b = base * (1 - s * 0.88);
    // panel lines
    const pl = Math.abs(((vv / panelPitch) % 1) - 0.5) < 0.004 ? 0.08 : 0;
    const ll = Math.abs(((u * 4) % 1) - 0.5) < 0.0015 ? 0.06 : 0;
    r -= pl + ll; g -= pl + ll; b -= pl + ll;
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const vv = 1 - v;
    const s = sootAt(u, vv);
    const g = clamp((0.38 + (fbm(u * 30, vv * 80, 3) - 0.5) * 0.15 + s * 0.45) * 255);
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

/**
 * Falcon 1's exposed interstage was a dark, panel-built cylinder rather than a featureless
 * black band. This is a single normalized unwrap: broad composite/aluminium panels, lap seams
 * and restrained fastener rows. The pattern is intentionally low contrast so it survives at
 * the scale of a 1.68 m vehicle without turning into a checkerboard.
 */
export function makeFalcon1Interstage({ w = 768, h = 768 } = {}) {
  const map = canvas(w, h);
  const rough = canvas(w / 2, h / 2);
  shade(map, (x, y, u, v) => {
    const panel = (Math.floor(u * 8) + Math.floor(v * 3) * 3) % 5;
    const grain = (fbm(u * 22 + 5, v * 34 + 9, 4) - 0.5) * 0.055;
    const vertical = Math.min((u * 8) % 1, 1 - ((u * 8) % 1));
    const horizontal = Math.min((v * 3) % 1, 1 - ((v * 3) % 1));
    const seam = vertical < 0.010 || horizontal < 0.008;
    const fastenerPhase = ((u * 64 + 0.5) % 1);
    const nearBand = horizontal < 0.020;
    const rivet = nearBand && Math.abs(fastenerPhase - 0.5) < 0.08;
    let r = 0.105 + panel * 0.004 + grain;
    let g = 0.092 + panel * 0.003 + grain * 0.85;
    let b = 0.086 + panel * 0.002 + grain * 0.72;
    if (seam) { r *= 0.60; g *= 0.60; b *= 0.62; }
    if (rivet) { r += 0.20; g += 0.19; b += 0.18; }
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const vertical = Math.min((u * 8) % 1, 1 - ((u * 8) % 1));
    const horizontal = Math.min((v * 3) % 1, 1 - ((v * 3) % 1));
    const seam = vertical < 0.014 || horizontal < 0.012;
    const value = 0.63 + (fbm(u * 24, v * 30, 3) - 0.5) * 0.13 + (seam ? 0.18 : 0);
    const g = clamp(value * 255);
    return [g, g, g];
  });
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
//  THERMAL PROTECTION MOSAIC (distant level of detail for Starship's heat shield)
//
//  Thirteen thousand instanced hexagons of 0.26 m turn into sub-pixel noise as soon as the
//  vehicle is more than a few tens of metres away: the shield stops reading as a surface and
//  becomes a speckled smear with a frayed edge. This bakes the same mosaic into a tileable
//  map so the far view gets a clean panel, and the instanced tiles are kept for close range.
// =====================================================================================
export function makeTpsPattern({ size = 512, circumradius = 0.152, gap = 1.012, cols = 4, rows = 4 } = {}) {
  const w = Math.sqrt(3) * circumradius * gap;   // column pitch (flat to flat)
  const dy = 1.5 * circumradius * gap;           // row pitch
  const W = cols * w, H = rows * dy;             // physical size the texture covers
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const hash = (a, b) => {
    let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    return h / 4294967296;
  };
  // Nearest and second-nearest lattice centre give both the cell id and the seam distance.
  const cell = (x, y) => {
    let d1 = Infinity, d2 = Infinity, ca = 0, cb = 0;
    const r0 = Math.floor(y / dy);
    for (let rr = r0 - 1; rr <= r0 + 1; rr++) {
      const off = (((rr % 2) + 2) % 2) * w * 0.5;
      const c0 = Math.floor((x - off) / w);
      for (let cc = c0 - 1; cc <= c0 + 1; cc++) {
        const cx = cc * w + off, cy = rr * dy;
        const d = Math.hypot(x - cx, y - cy);
        if (d < d1) { d2 = d1; d1 = d; ca = cc; cb = rr; }
        else if (d < d2) d2 = d;
      }
    }
    return { d1, seam: d2 - d1, ca, cb };
  };
  const seamWidth = circumradius * 0.09;
  shade(map, (px, py, u, v) => {
    const { seam, ca, cb } = cell(u * W, v * H);
    const tone = 0.155 + (hash(ca, cb) - 0.5) * 0.05 + (fbm(u * 2.5, v * 2.5, 3) - 0.5) * 0.035;
    const g = Math.min(1, seam / seamWidth);            // 0 on the seam, 1 in the tile
    const c = tone * (0.42 + 0.58 * g);
    return [clamp(c * 246), clamp(c * 250), clamp(c * 262)];
  });
  shade(rough, (px, py, u, v) => {
    const { seam } = cell(u * W, v * H);
    const g = Math.min(1, seam / seamWidth);
    const c = clamp((0.80 + (1 - g) * 0.16) * 255);
    return [c, c, c];
  });
  shade(height, (px, py, u, v) => {
    const { seam } = cell(u * W, v * H);
    const g = Math.min(1, seam / seamWidth);
    const c = clamp((0.30 + g * 0.62) * 255);
    return [c, c, c];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: H, tileSizeU: W }),
    roughnessMap: toTexture(rough, { tileSize: H, tileSizeU: W }),
    normalMap: toTexture(heightToNormal(height, 0.8), { tileSize: H, tileSizeU: W }),
    tileSize: H,
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
    const fine = (noise2(x * 0.9, y * 0.9) - 0.5) * 0.05;
    const stain = Math.max(0, fbm(u * 2.2 + 8, v * 2.2 + 1, 4) - 0.52) * 0.4;
    const du = Math.abs(((u * joints) % 1) - 0.5);
    const dv = Math.abs(((v * joints) % 1) - 0.5);
    const jointDist = Math.min(du, dv);
    const joint = Math.max(0, 1 - jointDist / 0.008);
    const sealant = Math.max(0, 1 - jointDist / 0.0035);
    let c = 0.48 + (n - 0.5) * 0.14 + fine - stain * 0.5;
    c -= joint * 0.06 + sealant * 0.12;
    return [clamp(c * 1.025 * 255), clamp(c * 255), clamp(c * 0.95 * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const du = Math.abs(((u * joints) % 1) - 0.5);
    const dv = Math.abs(((v * joints) % 1) - 0.5);
    const jointDist = Math.min(du, dv);
    const sealant = Math.max(0, 1 - jointDist / 0.0035);
    const g = clamp((0.84 + (fbm(u * 12, v * 12, 3) - 0.5) * 0.15 - sealant * 0.25) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const du = Math.abs(((u * joints) % 1) - 0.5);
    const dv = Math.abs(((v * joints) % 1) - 0.5);
    const jointDist = Math.min(du, dv);
    const joint = Math.max(0, 1 - jointDist / 0.008);
    const sealant = Math.max(0, 1 - jointDist / 0.0035);
    const g = clamp((0.5 + (fbm(u * 24, v * 24, 3) - 0.5) * 0.18 - joint * 0.22 - sealant * 0.32) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 0.8), { tileSize: tile, anisotropy: 16 }),
    tileSize: tile,
  };
}

// =====================================================================================
//  GROUND TERRAIN (Boca Chica / Starbase coastal plain)
// =====================================================================================
export function makeGroundTerrain({ size = 768, tile = 96.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  // Coastal salt flat. Frequencies are integer multiples of the lattice period
  // (256) so the tile meets itself: a non-periodic fbm drew a seam every tile,
  // which read as a grid across the apron.
  const period = (u, v, cells, ox = 0, oy = 0) => noise2(u * cells + ox, v * cells + oy);
  shade(map, (x, y, u, v) => {
    const dune = period(u, v, 256, 4, 9);
    const clay = period(u, v, 512, 20, 3);
    const salt = Math.max(0, dune - 0.42);
    const damp = Math.max(0, 0.48 - clay);
    const scrub = Math.max(0, period(u, v, 256, 80, 15) - 0.64);
    // No large-scale term in the tile. There was one — sin(2u)·cos(3v), integer cycles so the
    // 96 m repeat met itself — and it was the loudest artefact in the project: a regular grid
    // of light and dark bands, 32 to 48 m apart, across every wide shot, reading as corrugated
    // sheet rather than as a salt flat. Anything periodic at landscape scale does that, however
    // it is dressed. Landscape-scale variation now comes from world-space noise in the terrain
    // material's shader (library.js), which has no period at all; the tile carries only the
    // grain, which is too fine to be seen repeating.
    // Warm enough to survive the sky. At 18° of sun about half the light on flat ground is blue
    // skylight (hemisphere + environment), and a neutral tan multiplied by it came out
    // grey-green; the albedo carries a little more red so the plain still reads as sand.
    let r = 0.70, g = 0.615, b = 0.455;
    r = lerp(r, 0.80, salt); g = lerp(g, 0.725, salt); b = lerp(b, 0.545, salt);
    // Damp ground on a tidal flat is darker SAND — grey-brown mud — not green; the green is the
    // sparse scrub, and only where it grows. With damp hollows tinted olive as well, the two
    // together averaged the whole plain to grey-green felt at any distance past a hundred metres,
    // where Boca Chica reads pale tan with scattered darker patches.
    r = lerp(r, 0.45, damp * 0.8); g = lerp(g, 0.42, damp * 0.8); b = lerp(b, 0.34, damp * 0.8);
    r = lerp(r, 0.36, scrub * 1.3); g = lerp(g, 0.41, scrub * 1.3); b = lerp(b, 0.25, scrub * 1.3);
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const g = clamp((0.9 + (period(u, v, 512) - 0.5) * 0.08) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const g = clamp((0.5 + (period(u, v, 256, 2, 6) - 0.5) * 0.2) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 1.1), { tileSize: tile, anisotropy: 16 }),
    tileSize: tile,
  };
}

// =====================================================================================
//  TRENCH REFRACTORY ARMOR (heat-scorched stainless steel flame deflector lining)
// =====================================================================================
export function makeTrenchArmor({ size = 512, tile = 8.0 } = {}) {
  const map = canvas(size, size);
  const rough = canvas(size, size);
  const height = canvas(size, size);
  const panels = 2;
  shade(map, (x, y, u, v) => {
    const streak = fbm(u * 24 + 4, v * 4 + 1, 4);
    const soot = Math.max(0, fbm(u * 5, v * 2, 3) - 0.42) * 0.55;
    const pu = Math.abs(((u * panels) % 1) - 0.5);
    const seam = pu < 0.008 ? 1 : 0;
    let base = 0.44 + (streak - 0.5) * 0.09 - soot * 0.35;
    let r = base * 0.96, g = base * 0.97, b = base * 1.02;
    const heat = Math.max(0, fbm(u * 8 + 2, v * 3 + 7, 3) - 0.5) * 0.22;
    r += heat * 0.12; g += heat * 0.05;
    if (seam) { r *= 0.55; g *= 0.55; b *= 0.55; }
    return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const g = clamp((0.46 + (fbm(u * 14, v * 14, 3) - 0.5) * 0.16) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const pu = Math.abs(((u * panels) % 1) - 0.5);
    const seam = pu < 0.008 ? 1 : 0;
    const g = clamp((0.5 + (fbm(u * 18, v * 18, 2) - 0.5) * 0.1 - seam * 0.28) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, tileSize: tile, anisotropy: 16 }),
    roughnessMap: toTexture(rough, { tileSize: tile, anisotropy: 16 }),
    normalMap: toTexture(heightToNormal(height, 1.3), { tileSize: tile, anisotropy: 16 }),
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
  // PICA-X: a phenolic-impregnated carbon ablator. The surface is a field of
  // small tiles with open pores and a char gradient (hotter toward the centre of
  // the shield), not a pie of twelve sectors and not a generic carbon weave.
  const cells = 18;
  shade(map, (x, y, u, v) => {
    const [rad] = polar(u, v);
    const cu = (u * cells) % 1, cv = (v * cells) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    const gap = Math.max(0, 1 - seam / 0.06);
    const pore = Math.max(0, fbm(u * 40, v * 40, 3) - 0.62);
    const tile = 0.16 + ((Math.floor(u * cells) * 5 + Math.floor(v * cells) * 3) % 7) * 0.012;
    const char = fbm(u * 3.5, v * 3.5, 3);
    // Centre of the cap chars darker; the rim, which sees less flux, stays browner.
    const heat = Math.max(0, 1 - rad * 1.15);
    let c = tile + (char - 0.5) * 0.05 - pore * 0.08 - gap * 0.07;
    c = lerp(c, c * 0.72, heat * 0.85);
    const warm = (1 - heat) * 0.18;
    return [clamp((c + warm) * 255), clamp((c + warm * 0.35) * 255), clamp(c * 0.86 * 255)];
  });
  shade(rough, (x, y, u, v) => {
    const cu = (u * cells) % 1, cv = (v * cells) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    const gap = Math.max(0, 1 - seam / 0.06);
    const g = clamp((0.9 - gap * 0.08 + (fbm(u * 20, v * 20, 2) - 0.5) * 0.06) * 255);
    return [g, g, g];
  });
  shade(height, (x, y, u, v) => {
    const cu = (u * cells) % 1, cv = (v * cells) % 1;
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    const gap = Math.max(0, 1 - seam / 0.07);
    const pore = fbm(u * 36, v * 36, 2);
    const g = clamp((0.62 - gap * 0.28 + (pore - 0.5) * 0.1) * 255);
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
  const height = canvas(size, size);
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
  shade(height, (x, y, u, v) => {
    // Regenerative channels as relief, so a raking sun picks them out of the metal
    // instead of a painted stripe. One wrap of the bell, matching the colour map.
    const rib = Math.sin(u * Math.PI * 2 * 64) * 0.5 + 0.5;
    const lip = Math.max(0, 1 - v * 10);
    // A few tenths of a millimetre of tube relief, not a corrugated sheet.
    const g = clamp((0.48 + rib * 0.14 * (1 - v * 0.45) + lip * 0.1) * 255);
    return [g, g, g];
  });
  return {
    map: toTexture(map, { srgb: true, wrap: THREE.RepeatWrapping }),
    roughnessMap: toTexture(rough),
    normalMap: toTexture(heightToNormal(height, 0.85), { wrap: THREE.RepeatWrapping }),
  };
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

/**
 * Wave normals for the sea beyond the beach. Tiles on the noise lattice's 256-cell period, so
 * the only scale available is the tile's: 256 cells over 420 m gives swell of a metre or two,
 * with a finer chop on top — what a gentle Gulf surface looks like from a kilometre away.
 */
export function makeWater({ size = 512, tile = 420 } = {}) {
  const height = canvas(size, size);
  shade(height, (x, y, u, v) => {
    const swell = noise2(u * 256 + 3, v * 256 * 0.5 + 9) * 0.6 + noise2(u * 512 + 11, v * 512 + 2) * 0.4;
    const g = Math.max(0, Math.min(255, swell * 255));
    return [g, g, g];
  });
  return { normalMap: toTexture(heightToNormal(height, 1.4), { tileSize: tile, anisotropy: 8 }), tileSize: tile };
}
