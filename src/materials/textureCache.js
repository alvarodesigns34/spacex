/**
 * The procedural textures, kept between visits (audit of 20-10-2026, M-FL2).
 *
 * Generating them is the longest stretch of the start-up — seconds of main thread on every visit
 * — and they are deterministic: the same code and parameters paint the same pixels. So each
 * step's result is stored once in the browser's Cache Storage, as lossless PNGs plus the
 * textures' own settings, and read back on the next visit instead of painted again.
 *
 *   · The key is a SHA-256 of the generators' and their parameters' source (textures.js and
 *     library.js): change one line of either and every entry is a miss, and the old caches are
 *     deleted. Nothing has to remember to bump a version.
 *   · A texture's settings (wrap, colour space, repeat, the anisotropy asked for, its tileSize)
 *     are taken when its generator returns, before anything else touches them (environment.js
 *     scales the ground maps' repeat later, and would otherwise apply twice).
 *   · A canvas shared between steps (the steel's normal map, under three steels) comes back as
 *     one texture, as it was.
 *   · The PNGs are encoded after the start-up, so a first visit pays nothing for them.
 *   · Anything it cannot store (a value that is not a texture, a number or a string; a texture
 *     whose image is not a canvas), a cache the browser does not offer (an insecure origin, a
 *     private window that refuses storage) or any error: the step is painted, as before.
 *
 * tools/texture-cache-check.mjs reads every texture back from the cache and compares it with a
 * freshly painted one, pixel for pixel.
 */
import * as THREE from 'three';
import { anisotropyLimit } from './textures.js';

const PREFIX = 'vc-textures-';
const SOURCES = ['./textures.js', './library.js'];
const PROPS = ['wrapS', 'wrapT', 'colorSpace', 'flipY', 'generateMipmaps', 'minFilter', 'magFilter'];

async function sha256(data) {
  const d = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** The cache for this version of the generators, or null where there is none to have. */
export async function openTextureCache() {
  try {
    if (!globalThis.caches || !globalThis.crypto?.subtle) return null;
    const texts = await Promise.all(SOURCES.map(s => fetch(new URL(s, import.meta.url), { cache: 'no-cache' }).then(r => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))));
    const version = (await sha256(texts.join('\u0000'))).slice(0, 16);
    const name = PREFIX + version;
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== name) await caches.delete(k);
    const cache = await caches.open(name);
    return { cache, version, byCanvas: new Map(), byBlob: new Map(), pending: [], stats: { hits: 0, misses: 0, saved: 0, skipped: 0 } };
  } catch {
    return null;
  }
}

const url = (tc, path) => `https://textures.invalid/${tc.version}/${path}`;
const isPlain = (v) => v === null || ['number', 'string', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every(x => typeof x === 'number'));

/** A step's result as it can be stored: plain values as they are, textures as a canvas and their settings. */
function describe(result, canvases) {
  if (!result || typeof result !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (isPlain(v)) { out[k] = { plain: v }; continue; }
    if (!v?.isTexture || !(v.image instanceof HTMLCanvasElement || (globalThis.OffscreenCanvas && v.image instanceof OffscreenCanvas))) return null;
    let id = canvases.get(v.image);
    if (id === undefined) { id = canvases.size; canvases.set(v.image, id); }
    const t = { canvas: id, repeat: v.repeat.toArray(), offset: v.offset.toArray(), userData: { ...v.userData } };
    for (const p of PROPS) t[p] = v[p];
    out[k] = { texture: t };
  }
  return out;
}

/** Read a step back; null on a miss. */
export async function loadStep(tc, name) {
  try {
    const res = await tc.cache.match(url(tc, `${name}.json`));
    if (!res) { tc.stats.misses++; return null; }
    const entry = await res.json();
    const canvases = [];
    for (const blobKey of entry.canvases) {
      let c = tc.byBlob.get(blobKey);
      if (!c) {
        const blob = await (await tc.cache.match(url(tc, `${blobKey}.png`)))?.blob();
        if (!blob) { tc.stats.misses++; return null; }
        const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close?.();
        tc.byBlob.set(blobKey, c);
      }
      canvases.push(c);
    }
    const out = {}, made = new Map();
    for (const [k, v] of Object.entries(entry.values)) {
      if ('plain' in v) { out[k] = v.plain; continue; }
      const d = v.texture, canvas = canvases[d.canvas];
      // One texture per canvas and settings, so a texture shared within a step stays shared.
      const sig = `${d.canvas}|${JSON.stringify(d)}`;
      let t = made.get(sig) ?? tc.byCanvas.get(canvas)?.get(sig);
      if (!t) {
        t = new THREE.CanvasTexture(canvas);
        for (const p of PROPS) t[p] = d[p];
        t.repeat.fromArray(d.repeat); t.offset.fromArray(d.offset);
        t.userData = { ...d.userData };
        t.anisotropy = Math.min(d.userData.anisotropyAsked ?? 8, anisotropyLimit());
        t.needsUpdate = true;
        if (!tc.byCanvas.has(canvas)) tc.byCanvas.set(canvas, new Map());
        tc.byCanvas.get(canvas).set(sig, t);
      }
      made.set(sig, t);
      out[k] = t;
    }
    tc.stats.hits++;
    return out;
  } catch {
    tc.stats.misses++;
    return null;
  }
}

/** Note a freshly painted step for saving; its settings are taken now, its pixels encoded later. */
export function noteStep(tc, name, result) {
  const canvases = new Map();
  const values = describe(result, canvases);
  if (!values) { tc.stats.skipped++; return; }
  tc.pending.push({ name, values, canvases: [...canvases.keys()] });
}

const toBlob = (c) => (c.convertToBlob ? c.convertToBlob({ type: 'image/png' }) : new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/png')));

/** Encode and store everything noted. Run it after the start-up; it never throws. */
export async function savePending(tc) {
  const keys = new Map();               // canvas → its blob key, so a shared canvas is stored once
  for (const step of tc.pending.splice(0)) {
    try {
      const blobKeys = [];
      for (const c of step.canvases) {
        let k = keys.get(c);
        if (!k) {
          const blob = await toBlob(c);
          k = (await sha256(await blob.arrayBuffer())).slice(0, 24);
          await tc.cache.put(url(tc, `${k}.png`), new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
          keys.set(c, k);
        }
        blobKeys.push(k);
      }
      const entry = { canvases: blobKeys, values: step.values };
      await tc.cache.put(url(tc, `${step.name}.json`), new Response(JSON.stringify(entry), { headers: { 'Content-Type': 'application/json' } }));
      tc.stats.saved++;
    } catch { /* storage full or refused: the next visit paints this step again */ }
  }
}
