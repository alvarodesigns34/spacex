/**
 * The Roadster's procedural textures (the cockpit displays and circuit board, the grille mesh,
 * the badge, the lamp lenses, the paint's flakes, the tyres, the instrument dials), moved out
 * of roadster.js unchanged (8-11-2026, refactor §36). Each draws on a canvas at load time.
 *
 * Four times the pixels on each side since 9-11-2026 (audit M9): the lettering, the dials, the
 * circuit board, the badge and the tyres' tread drawn at 512 px read soft in the Roadster's close
 * views (≈1 cm a pixel on the dash). The drawings are the same — the 2D canvases scale their
 * context, the tyre's noise and relief are rescaled to the finer grid.
 */
const HI = 4;
/** A canvas HI× the size, its context scaled so the drawing code keeps its 1× coordinates. */
function hiCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * HI; c.height = h * HI;
  const ctx = c.getContext('2d');
  ctx.scale(HI, HI);
  return { c, ctx };
}
import * as THREE from 'three';
import { anisotropyLimit } from '../materials/textures.js';
import { canvas, shade, fbm, noise2, heightToNormal, toTexture } from '../materials/textures.js';

export function makeDontPanicTexture() {
  const { c, ctx } = hiCanvas(512, 256);

  // Deep space obsidian background
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 512, 256);

  // High-tech bezel accent line
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);

  // Top header banner
  ctx.font = '600 15px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('SPACEX  ·  FALCON HEAVY 001  ·  STARMAN', 256, 44);

  // "DON'T PANIC!" headline centered with generous padding (completely unclipped!)
  ctx.font = '900 34px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("DON'T PANIC!", 256, 114);

  // Sub-status telemetry
  ctx.font = '700 15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('ORBIT: HELIOCENTRIC MARS CROSSING', 256, 166);

  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('APHELION: 1.67 AU  ·  PERIHELION: 0.98 AU', 256, 202);

  // Subtle CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 512, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, anisotropyLimit());
  return tex;
}

export function makePcbTexture() {
  const { c, ctx } = hiCanvas(512, 256);
  ctx.fillStyle = '#0b2b17';
  ctx.fillRect(0, 0, 512, 256);

  // Gold circuit traces
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = 20; y < 240; y += 32) {
    ctx.moveTo(16, y);
    ctx.lineTo(84, y);
    ctx.lineTo(124, y + 14);
    ctx.lineTo(210, y + 14);
    ctx.moveTo(300, y);
    ctx.lineTo(380, y);
    ctx.lineTo(420, y - 12);
    ctx.lineTo(496, y - 12);
  }
  ctx.stroke();

  // IC contact pads
  ctx.fillStyle = '#c5a028';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(36 + i * 16, 18, 9, 14);
    ctx.fillRect(36 + i * 16, 50, 9, 14);
    ctx.fillRect(380 + i * 11, 186, 7, 12);
  }

  // Silk screen inscription: "Made on Earth by humans"
  ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Made on Earth by humans', 256, 136);

  ctx.font = '15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#f0d775';
  ctx.fillText('TESLA ROADSTER · STARMAN AVIONICS PCB', 256, 172);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, anisotropyLimit());
  return tex;
}

export function makeGrilleTexture() {
  const { c, ctx } = hiCanvas(128, 128);
  ctx.fillStyle = '#0a0c0f';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1c2027';
  for (let y = 0; y < 128; y += 8) {
    for (let x = (y % 16 === 0 ? 0 : 4); x < 128; x += 8) {
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

/**
 * The Tesla T, drawn rather than approximated with a chrome cylinder. Alpha-cut so the shield
 * sits proud of the disc behind it. No other marking is added anywhere on the car.
 */
export function makeEmblemTexture() {
  const { c, ctx: x } = hiCanvas(256, 256);
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = '#e9edf2';
  // Crossbar with the tapered ends the mark has.
  x.beginPath();
  x.moveTo(66, 74); x.lineTo(190, 74); x.lineTo(178, 100); x.lineTo(78, 100); x.closePath();
  x.fill();
  // Stem, narrowing to the point.
  x.beginPath();
  x.moveTo(114, 104); x.lineTo(142, 104); x.lineTo(134, 196); x.lineTo(122, 196); x.closePath();
  x.fill();
  // Shoulder hooks either side of the stem.
  x.beginPath();
  x.moveTo(66, 68); x.lineTo(96, 56); x.lineTo(104, 68); x.closePath();
  x.moveTo(190, 68); x.lineTo(160, 56); x.lineTo(152, 68); x.closePath();
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// -----------------------------------------------------------------------------------------
//  Material Factory
// -----------------------------------------------------------------------------------------
/**
 * Paint flake. Automotive metallic is a dielectric lacquer with aluminium flake suspended in
 * the base coat, under a clear coat — not a metal. Modelling it as metal (which is what
 * metalness: 0.88 does) makes the diffuse term vanish and the sun eats the colour, which is
 * why the previous car read as anodised black in daylight. The flake belongs in a fine
 * roughness/normal perturbation instead; at ~2 cm tile it is invisible up close and gives the
 * clear coat something to break up.
 */
/** Prism grid of a clear tail lens: a colour map and the normal map of its facets. */
export function makeLensMaps() {
  const CELL = 8;
  // Each cell a low pyramid: brightest in the middle, dark along the cell edges.
  const pyramid = (x, y) => 0.5 - Math.max(Math.abs((x % CELL) / CELL - 0.5), Math.abs((y % CELL) / CELL - 0.5));
  const height = canvas(128, 128);
  shade(height, (x, y) => { const v = pyramid(x, y) * 510; return [v, v, v]; });
  const colour = canvas(128, 128);
  shade(colour, (x, y) => { const v = 188 + 64 * pyramid(x, y); return [v, v, v + 4]; });
  return { map: toTexture(colour, { srgb: true }), normalMap: toTexture(heightToNormal(height, 3.0)) };
}

export function makeFlakeMaps() {
  const c = canvas(256, 256);
  shade(c, (x, y) => {
    const n = fbm(x * 0.55, y * 0.55, 4, 2.3, 0.55);
    const sparkle = Math.pow(Math.max(0, noise2(x * 1.9 + 11, y * 1.9 - 7)), 6);
    const v = 128 + n * 26 + sparkle * 90;
    return [v, v, v];
  });
  return {
    normalMap: toTexture(heightToNormal(c, 0.55), { tileSize: 0.02 }),
    roughnessMap: toTexture(c, { tileSize: 0.02 }),
  };
}

/** Tread blocks and sidewall lettering relief for the tyres. */
export function makeTyreMaps() {
  const c = canvas(512 * HI, 128 * HI);
  shade(c, (px, py, u, v) => {
    const x = px / HI, y = py / HI;   // the 1× grid the pattern was drawn on
    // v across the section: 0..0.24 and 0.76..1 are sidewall, the middle is the tread.
    const shoulder = Math.min(v, 1 - v);
    if (shoulder < 0.24) {
      const rib = Math.sin(u * Math.PI * 2 * 46) * 0.5 + 0.5;
      const band = shoulder > 0.15 && shoulder < 0.21 ? rib * 34 : 0;
      return [96 + band + fbm(x * 0.4, y * 0.4, 3) * 8, 96 + band, 96 + band];
    }
    const g = (u * 512) % 42;
    const lat = Math.abs(shoulder - 0.5) * 2;
    const groove = g < 5 || Math.abs(g - 21 - lat * 9) < 4 ? 0 : 1;
    const circ = Math.abs(shoulder - 0.36) < 0.022 || Math.abs(shoulder - 0.64) < 0.022 ? 0 : 1;
    const v2 = 62 + groove * circ * 88 + fbm(x * 0.7, y * 0.7, 3) * 10;
    return [v2, v2, v2];
  });
  // The relief per pixel is HI× smaller on the finer grid: the strength is HI× to keep the slope.
  return { normalMap: toTexture(heightToNormal(c, 2.6 * HI), { tileSize: 1 }) };
}


/** Speedometer and power-meter faces: one texture, two dials, rather than blank discs. */
export function makeDialTexture() {
  const { c, ctx: x } = hiCanvas(512, 256);
  x.fillStyle = '#0d0f12'; x.fillRect(0, 0, 512, 256);
  for (const [cx, major, label] of [[128, 20, 'km/h'], [384, 10, 'kW']]) {
    x.strokeStyle = '#c8cdd6'; x.fillStyle = '#c8cdd6';
    x.lineWidth = 2;
    for (let i = 0; i <= major * 2; i++) {
      const a = Math.PI * 0.75 + (i / (major * 2)) * Math.PI * 1.5;
      const big = i % 2 === 0;
      const r0 = big ? 76 : 84, r1 = 96;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
      x.lineTo(cx + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
      x.lineWidth = big ? 3 : 1.5;
      x.stroke();
    }
    x.font = '600 20px system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillText(label, cx, 176);
    // Needle, parked.
    x.strokeStyle = '#d8452f'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(cx, 128);
    x.lineTo(cx + Math.cos(Math.PI * 0.75) * 78, 128 + Math.sin(Math.PI * 0.75) * 78);
    x.stroke();
    x.fillStyle = '#2a2e35';
    x.beginPath(); x.arc(cx, 128, 9, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
