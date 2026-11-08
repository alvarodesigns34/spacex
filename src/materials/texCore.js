/**
 * The tools every procedural texture is built with (value noise, canvases, height → normal,
 * CanvasTexture with metric tiling), moved out of textures.js unchanged (8-11-2026, refactor
 * §36); textures.js re-exports them. The noise lattice is filled from the same seeded sequence
 * as before, so every texture is the same pixel for pixel.
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
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

export const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

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

/**
 * Height (grayscale canvas) -> tangent-space normal map canvas, tileable. The heights are read
 * once into a float array and the wrap is resolved per row and column, not per sample: the
 * old version went through a closure with two modulos and a Math.hypot for each of four
 * samples a pixel, and was the single largest cost of building the materials.
 */
export function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0, n = w * h; i < n; i++) H[i] = sd[i * 4] / 255;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const row = y * w, up = ((y + h - 1) % h) * w, dn = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xl = x === 0 ? w - 1 : x - 1, xr = x === w - 1 ? 0 : x + 1;
      const nx = -(H[row + xr] - H[row + xl]) * strength;
      const ny = (H[dn + x] - H[up + x]) * strength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (row + x) * 4;
      d[i] = (nx * inv * 0.5 + 0.5) * 255; d[i + 1] = (ny * inv * 0.5 + 0.5) * 255; d[i + 2] = (inv * 0.5 + 0.5) * 255; d[i + 3] = 255;
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
  // What was asked before the device's limit: the texture cache (textureCache.js) clamps it
  // again to the limit of the machine that reads it back.
  t.userData.anisotropyAsked = anisotropy;
  t.needsUpdate = true;
  return t;
}
