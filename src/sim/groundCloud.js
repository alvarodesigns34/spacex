/**
 * The launch's ground cloud: the steam, deluge spray and dust out of the flame trench, and the puff
 * atlas it is drawn with (shared with the vapour). Moved out of plume.js unchanged on 9-11-2026
 * (audit M15: plume.js mixed four systems in 1 600 lines); plume.js re-exports GroundCloud.
 */
import * as THREE from 'three';
import { HASH_GLSL } from '../core/hashGLSL.js';
import { fbm } from '../materials/textures.js';

const _sunDir = new THREE.Vector3(), _inv = new THREE.Matrix4();

// -----------------------------------------------------------------------------------------
//  Ground cloud
// -----------------------------------------------------------------------------------------
/**
 * Sixteen cloud puffs in a 4 × 4 atlas, each a different cluster of lobes with a cauliflower
 * edge. With four variants, drawn a thousand times, the launch cloud read as a repeating
 * cartoon: the same four outlines turning over each other. A real steam cloud's outline
 * breaks into rounded turrets at every scale — the Flight 12 liftoff photographs from Pad 2
 * show towers built of hundreds of small ones — so each puff here is a main mass, a ring of
 * mid-sized lobes and a crowd of small ones, with fractal noise pushing the edge in and out
 * below that. Variants differ in how many lobes they have, where, and how lopsided they are.
 * RGB is a tangent-space normal from the density, A the density itself.
 */
let _puffTex = null;
/** Built once and shared by the ground cloud and the vapour: it is the most expensive texture here. */
export function puffTexture() { return (_puffTex ??= buildPuffTexture()); }
function buildPuffTexture() {
  // 256 px a cell since 8-11-2026 (192 before): the turrets' edges stay sharp in a close shot.
  const cell = 256, cells = 4, size = cell * cells;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const rng = (() => { let x = 0x9e3779b9; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  // A height field, not a density: each lobe is a spherical cap, and the lobes are joined by a
  // soft maximum, so the puff is a cluster of rounded domes with creases between them — the way
  // a cumulus billow is lit. It used to be the density itself, summed until it saturated, with
  // its edges sharpened: a flat plateau with bevelled rims, which the lighting drew as a dish,
  // and isolated small discs around it that read as bubbles. Close up, the launch cloud looked
  // pitted like foam. Normals are the true gradient of the caps (height in the same units as
  // x and y), so a lobe shades as a dome from its lit top to its dark underside.
  const H = new Float32Array(cell * cell), A = new Float32Array(cell * cell);
  const K = 0.035;                               // softness of the crease between two lobes
  for (let v = 0; v < cells * cells; v++) {
    const ox = (v % cells) * cell, oy = Math.floor(v / cells) * cell;
    const lean = (rng() - 0.5) * 0.14;
    // The main mass is itself a lopsided cluster of three or four domes, not one: seen from a
    // few hundred metres, where the small turrets fall under a pixel, a single big dome was all
    // that was left of each puff, and the launch cloud read as a heap of balls.
    const lobes = [{ x: lean, y: -0.06, r: 0.27 + rng() * 0.04 }];
    const cores = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < cores; k++) {
      const a = (k / cores) * Math.PI * 2 + rng() * 1.2;
      lobes.push({ x: lean + Math.cos(a) * (0.13 + rng() * 0.08), y: -0.04 + Math.sin(a) * (0.09 + rng() * 0.07), r: 0.19 + rng() * 0.07 });
    }
    const nCore = lobes.length;
    // Mid lobes round the main mass, and small ones on the rims of those: every turret is
    // attached to something, weighted to the upper, sunlit side where a puff boils.
    const mid = 6 + Math.floor(rng() * 5);
    for (let k = 0; k < mid; k++) {
      const a = rng() * Math.PI * 2, p0 = lobes[Math.floor(rng() * nCore)];
      const r = 0.13 + rng() * 0.11, d = p0.r * (0.7 + rng() * 0.4);
      const x = p0.x + Math.cos(a) * d, y = p0.y + Math.sin(a) * d * 0.9 + 0.03;
      if (Math.hypot(x, y) + r > 0.95) continue;               // keep inside the cell
      lobes.push({ x, y, r });
    }
    const small = 12 + Math.floor(rng() * 12);
    for (let k = 0; k < small; k++) {
      const par = lobes[1 + Math.floor(rng() * (lobes.length - 1))];
      let a = rng() * Math.PI * 2;
      if (Math.sin(a) < -0.3 && rng() < 0.65) a = -a;          // mostly on the upper rims
      const r = 0.06 + rng() * 0.07, d = par.r * (0.75 + rng() * 0.2);
      const x = par.x + Math.cos(a) * d, y = par.y + Math.sin(a) * d;
      if (Math.hypot(x, y) + r > 0.93) continue;               // keep inside the cell
      lobes.push({ x, y, r });
    }
    const seed = v * 37.1;
    for (let y = 0; y < cell; y++) {
      // Canvas y runs down; the puff is built with +y up so "top" means the sunlit side.
      const ny = -(y - cell / 2) / (cell / 2);
      for (let x = 0; x < cell; x++) {
        const nx0 = (x - cell / 2) / (cell / 2);
        // The point is pushed about by a two-scale fractal warp before the lobes are measured, so
        // no outline is an arc of a circle (8-11-2026: the round lobes, repeated a thousand times,
        // were the cartoon the user saw); the creases between lobes wander the same way.
        const wx = fbm(nx0 * 3.3 + seed, ny * 3.3 - seed * 0.7, 4, 2.0, 0.5) - 0.5, wy = fbm(nx0 * 3.3 - seed * 1.3, ny * 3.3 + seed, 4, 2.0, 0.5) - 0.5;
        const nx = nx0 + 0.11 * wx + 0.035 * (fbm(nx0 * 11 + seed, ny * 11, 3, 2.0, 0.5) - 0.5);
        const nyw = ny + 0.11 * wy + 0.035 * (fbm(nx0 * 11, ny * 11 - seed, 3, 2.0, 0.5) - 0.5);
        let sum = 0, any = false;
        for (const lb of lobes) {
          const q2 = ((nx - lb.x) ** 2 + (nyw - lb.y) ** 2) / (lb.r * lb.r);
          if (q2 < 1) { sum += Math.exp(lb.r * Math.sqrt(1 - q2) / K); any = true; }
        }
        let h = any ? K * Math.log(sum) : 0;
        // Fine billowing on the surface, a few per cent of the height.
        if (h > 0) h += 0.018 * (fbm(nx * 9 + seed, ny * 9 - seed, 4, 2.0, 0.5) - 0.5) * Math.min(1, h / 0.05);
        H[y * cell + x] = Math.max(0, h);
        // Density follows the thickness of the dome, so a puff is opaque through its middle
        // and thins towards its outline, and the small turrets (a tenth of the cell high) stay
        // half transparent — the lit-through fringe of a real billow. A low-frequency field
        // frays it, so erosion (which raises a threshold with age) shrinks the outline raggedly
        // without opening holes in the middle.
        // A wider ramp than before 8-11-2026 (0.2): the outline of a billow is a soft, lit-through
        // fringe a few per cent of the puff deep, not a cut-out edge.
        const fray = 0.62 + 0.76 * fbm(nx * 3.1 - seed, ny * 3.1 + seed, 4, 2.0, 0.5);
        A[y * cell + x] = THREE.MathUtils.clamp(THREE.MathUtils.smoothstep(h, 0.0, 0.27) * Math.min(1, fray + 0.2), 0, 1);
      }
    }
    const px = 2 / cell;                         // one pixel in the puff's own units
    for (let y = 0; y < cell; y++) {
      const y0 = Math.max(0, y - 1), y1 = Math.min(cell - 1, y + 1);
      for (let x = 0; x < cell; x++) {
        const x0 = Math.max(0, x - 1), x1 = Math.min(cell - 1, x + 1);
        // The relief is flattened for the shading (×0.6): a full spherical cap shaded each lobe
        // like a ball; a lower one keeps the creases and the lit tops without the sphere.
        // (×0.45 since 8-11-2026: at 0.6 every lobe still shaded as its own ball.)
        const dx = 0.45 * (H[y * cell + x1] - H[y * cell + x0]) / ((x1 - x0) * px);
        const dy = -0.45 * (H[y1 * cell + x] - H[y0 * cell + x]) / ((y1 - y0) * px);   // +y up
        const g = Math.min(Math.hypot(dx, dy), 6);                // cap the rim's slope
        const sc = g > 0 ? g / Math.hypot(dx, dy) : 0;
        const nxv = -dx * sc, nyv = -dy * sc, len = Math.hypot(nxv, nyv, 1);
        const i = ((oy + y) * size + ox + x) * 4;
        data[i] = Math.round((nxv / len * 0.5 + 0.5) * 255);
        // +y up, as the quad's uv and the flipped canvas both run. The old encoding stored the
        // vertical component negated: every lobe was lit from below, which reads as a dent.
        data[i + 1] = Math.round((nyv / len * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round(255 / len);
        data[i + 3] = Math.round(A[y * cell + x] * 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/**
 * Picks one of the atlas's sixteen puffs per instance, by a hash of the instance rather than
 * its slot order: the ring buffer hands out consecutive slots, and `id % n` laid the variants
 * out in sequence along each jet. A margin keeps mipmaps from bleeding between cells.
 */
export const ATLAS_UV = /* glsl */`
  ${HASH_GLSL}
  float puffHash(float n) { return hk11(n * 1.618 + 4.1414); }
  vec2 atlasUv(vec2 uv, int id) {
    float k = floor(puffHash(float(id)) * 16.0);
    return (vec2(mod(k, 4.0), floor(k / 4.0)) + 0.02 + uv * 0.96) * 0.25;
  }`;

const CLOUD_VERT = /* glsl */`
  ${ATLAS_UV}
  attribute vec3 aOffset;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  attribute vec3 aExtra;          // age fraction, kind (0 steam, 1 dust), aspect
  attribute float aSunT;          // sunlight reaching the puff through the cloud (selfShadow)
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vAlpha;
  varying float vFire;
  varying float vRot;
  varying float vShade;
  varying float vDust;
  varying float vAge;
  varying float vGround;
  varying float vVar;
  varying vec3 vWorld;
  varying float vSunT;
  uniform float uFlame;
  // The ground a puff can sink into, in world metres: grade, and the Pad 2 plateau (5 m over
  // the trench's 0,8 m floor, the 2,5 m berm and its 1:3 embankment; pad.js). The cloud writes
  // no depth and the ground does, so a puff crossing it was cut along a hard line; fading the
  // part of each puff within a few metres of the surface softens that line into a base.
  uniform vec2 uPad;
  float groundUnder(vec2 w) {
    vec2 l = abs(w - uPad);
    if (l.x < 64.0 && l.y < 46.0) return l.x < 11.0 ? 0.8 : 5.0;
    if (l.x < 74.0 && l.y < 52.0) return 2.5;
    float d = length(max(l - vec2(74.0, 52.0), 0.0));
    return 2.5 * (1.0 - smoothstep(0.0, 7.5, d));
  }

  ${HASH_GLSL}
  void main() {
    vUv = atlasUv(uv, gl_InstanceID);
    vLocal = uv;
    vRot = aRot;
    // Each puff a little lighter or darker, thicker or thinner than the next (≈ ±8 %): sixteen
    // atlas cells repeated with one shade read as copies.
    vVar = hk11(float(gl_InstanceID) * 2.414 + 1.7);
    vAge = aExtra.x;
    vDust = aExtra.y;
    // Self-shadowing a billboard cannot compute: the lower a puff sits in the mass, the more
    // cloud there is between it and the sky, so the base of a launch cloud is a darker grey
    // under sunlit turrets — the contrast that makes the Flight 12 clouds read as towers.
    // Softer since 9-11-2026: the light through the mass is now computed (aSunT); this keeps only the
    // sky's darker underside.
    vShade = mix(0.62, 1.06, smoothstep(4.0, 90.0, aOffset.y + aSize * 0.3));
    vSunT = aSunT;
    vec3 c = (modelViewMatrix * vec4(aOffset, 1.0)).xyz;
    float s = sin(aRot), k = cos(aRot);
    // Aspect, area-preserving: steam a little taller than wide, dust spread flat.
    vec2 p = position.xy * vec2(sqrt(aExtra.z), 1.0 / sqrt(aExtra.z));
    vec2 q = vec2(p.x * k - p.y * s, p.x * s + p.y * k) * aSize;
    // This corner's height over the ground under it, in units of the puff's size: the camera's
    // right and up axes in world space are the rows of the view matrix.
    vec3 wc = (modelMatrix * vec4(aOffset, 1.0)).xyz
      + vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * q.x
      + vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * q.y;
    vGround = (wc.y - groundUnder(wc.xz)) / max(aSize, 1.0);
    vWorld = wc;

    // Soft camera fade so nearby puffs never clip into the near frustum
    vAlpha = aAlpha * smoothstep(1.5, 16.0, -c.z);

    // The plume lights the whole near side of the cloud, not only the mouths: in photographs of
    // a Starship liftoff the lower cloud glows yellow-orange for a couple of hundred metres.
    float dFlame = length(vec3(aOffset.x * 1.2, max(0.0, aOffset.y - 3.0) * 1.1, max(0.0, abs(aOffset.z) - 38.0) * 0.55));
    float heightFade = 1.0 - smoothstep(6.0, 70.0, aOffset.y);
    vFire = uFlame * (1.0 - smoothstep(10.0, 160.0, dFlame)) * heightFade;

    gl_Position = projectionMatrix * vec4(c + vec3(q, 0.0), 1.0);
  }`;

const CLOUD_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunColor;
  uniform vec3 uShadowColor;
  uniform vec3 uFireColor;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vAlpha;
  varying float vFire;
  varying float vRot;
  varying float vShade;
  varying float vDust;
  varying float vAge;
  varying float vGround;
  varying float vVar;
  varying float vSunT;
  varying vec3 vWorld;

  // A density field in world space, shared by every puff that overlaps a point (9-11-2026): the
  // puffs' own outlines repeated sixteen atlas cells, and stacked they read as a heap of copies.
  // Modulated by one field, overlapping puffs thin and thicken together — one body of vapour with
  // its own denser cores and thinner lanes, a few tens of metres across (≈).
  ${HASH_GLSL}
  float cH(vec3 p) { return hk13(p); }
  float cN(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(cH(i), cH(i + vec3(1, 0, 0)), f.x), mix(cH(i + vec3(0, 1, 0)), cH(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(cH(i + vec3(0, 0, 1)), cH(i + vec3(1, 0, 1)), f.x), mix(cH(i + vec3(0, 1, 1)), cH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float cField(vec3 p) { return cN(p) * 0.55 + cN(p * 2.3 + 7.1) * 0.3 + cN(p * 5.1 - 3.3) * 0.15; }

  void main() {
    // Boiling: the puff's own texture is pushed about inside its cell as it ages (the age, not a
    // clock, so a seek shows the same frame), so a puff's surface turns over while it lives instead
    // of sliding by as a fixed picture.
    vec2 cell0 = vUv - vLocal * 0.24;
    vec2 wob = vec2(cN(vec3(vLocal * 3.0, vAge * 2.2 + vVar * 9.0)), cN(vec3(vLocal * 3.0 + 5.3, vAge * 2.2 - vVar * 7.0))) - 0.5;
    vec4 tex = texture2D(uMap, cell0 + clamp(vLocal + wob * 0.05, 0.0, 1.0) * 0.24);
    // The edge is eaten away as the puff ages: the density threshold rises, so the thin
    // turrets go first and the puff frays into wisps, instead of every outline fading evenly.
    float th = 0.02 + 0.28 * pow(vAge, 2.5);
    float dens = smoothstep(th, th + 0.42, tex.a);
    // Where the dome's surface turns away from the eye (its normal lies in the screen plane)
    // the puff is seen through its thinnest part: fading it there turns the hard cut-out
    // outline of each billow into a soft, lit-through edge, as vapour looks against the sky.
    dens *= mix(0.5, 1.0, smoothstep(0.18, 0.62, tex.b));
    // Soft contact: the lowest tenth of a puff's size fades into the ground it touches.
    dens *= smoothstep(-0.02, 0.12, vGround);
    // The shared field, drifting up slowly with the puff's age: denser cores, thinner lanes.
    float field = cField(vWorld / 26.0 + vec3(0.0, -vAge * 0.8, 0.0));
    dens *= mix(0.5, 1.3, smoothstep(0.2, 0.8, field));
    float a = dens * vAlpha * (0.84 + 0.16 * vVar);
    if (a < 0.003) discard;

    vec2 rawNorm = tex.rg * 2.0 - 1.0;
    float nz = tex.b;
    float s = sin(vRot), k = cos(vRot);
    vec2 rotatedNorm = vec2(rawNorm.x * k - rawNorm.y * s, rawNorm.x * s + rawNorm.y * k);
    vec3 normView = normalize(vec3(rotatedNorm, nz));

    // Wrapped diffuse for a translucent mass.
    float NdotL = dot(normView, uSunDir);
    float wrap = clamp((NdotL + 0.25) / 1.25, 0.0, 1.0);
    // Part of a puff's light is the mass's, not its own surface's: light scattered through the
    // cloud evens out the shading between neighbouring lobes (≈ 30 %), so the mass reads as one
    // body of vapour lit from one side instead of a heap of separately shaded balls.
    wrap = mix(wrap, 0.35 + 0.5 * clamp(uSunDir.y * 0.5 + 0.5, 0.0, 1.0), 0.3);
    // The thin fringe of a puff is lit through, not shaded: its normal is steep there, and
    // taking it at face value drew a dark pen line round every turret.
    wrap = mix(0.8, wrap, smoothstep(0.08, 0.55, tex.a));
    // Underside of each puff darker than its top, within the puff as well as across the mass.
    float under = mix(0.72, 1.0, smoothstep(0.15, 0.75, vLocal.y));

    // Where the shared field is thick the vapour shades itself a little (≈ self-shadowing inside
    // the mass), where it is thin the light comes through.
    float selfShade = mix(1.06, 0.84, smoothstep(0.35, 0.85, field));
    // The direct sun only as much as reaches the puff through the rest of the cloud (aSunT).
    float sunLit = wrap * wrap * (3.0 - 2.0 * wrap) * mix(0.12, 1.0, vSunT);
    vec3 steam = mix(uShadowColor, uSunColor, sunLit) * vShade * under * (0.93 + 0.12 * vVar) * selfShade;
    // Dust: the brown haze the blast raises off the pad and the flats, which in the Flight 12
    // photographs spreads low between and under the two white steam towers. Duller, browner,
    // and less lit by the sun (it is optically thin: the sky shows through it).
    vec3 dust = mix(vec3(0.34, 0.29, 0.24), vec3(0.72, 0.62, 0.5), wrap) * mix(0.85, 1.0, vShade);
    vec3 base = mix(steam, dust, vDust);

    // Lit by the plume in HDR, graded so the cloud goes from orange low down to its own
    // sunlit colour above, as in photographs, instead of one saturated wall. The glow keeps the
    // puff's own modelling (its turrets and shadowed folds) and is strongest on its underside,
    // which faces the fire: a flat tint replacing the shading drew uniform salmon balls.
    float below = 1.0 - smoothstep(0.15, 0.85, vLocal.y);
    // The fire lights the puff from below whatever the Sun does, so the glow's modelling is the
    // puff's normal against the fire's direction (down, ≈ in view space), not the Sun's wrap: with
    // the Sun overhead the sides of the puffs are unlit, and the glow scaled by the Sun's light
    // went a dull, dark brown — smoke from a fuel fire, not lit steam (audit of 8-11-2026, §37).
    float fireWrap = clamp((0.6 - normView.y) / 1.6, 0.0, 1.0);
    vec3 fireGlow = uFireColor * (0.8 + 0.5 * fireWrap) * vShade * under * 1.35;
    float fireMix = clamp(vFire * vFire * 1.1, 0.0, 0.8) * mix(0.55, 1.0, below);
    vec3 col = mix(base, fireGlow, fireMix);
    col += uFireColor * (vFire * vFire * vFire * 0.6) * mix(0.35, 1.0, below) * vShade;

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;


/**
 * The steam, deluge spray and dust that leaves the flame trench.
 * Bidirectional: exhausted strictly along the trench axis (±Z).
 */
export class GroundCloud {
  /**
   * @param count how many puffs live in the ring buffer. Comes from the quality tier: the
   *              cloud is transparent, overlapping and full-screen at liftoff, which is the
   *              most fill-rate-expensive thing in the scene and the first thing a weak
   *              device should be spending less on.
   */
  constructor({ count = 860, rng = Math.random } = {}) {
    this.count = count;
    this.rng = rng;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.rot = new Float32Array(count);
    this.rotSpeed = new Float32Array(count);
    // Per-puff expansion, so one cloud can carry both a trench thunderhead and the much
    // smaller steam boiling off the deck.
    this.grow = new Float32Array(count);
    this.base = new Float32Array(count);
    // Per puff, drawn at emission and fixed for its life: a size factor (the old
    // `(i % 5) * 0.18` gave every fifth slot the same size, a pattern the eye picks up along a
    // jet), an opacity, and what it is made of — 0 steam, 1 dust.
    this.sizeK = new Float32Array(count);
    this.opac = new Float32Array(count);
    this.kind = new Float32Array(count);
    // Shader inputs that change: age fraction, kind, and the puff's aspect (width/height).
    this.extra = new Float32Array(count * 3);
    // Sunlight reaching each puff through the rest of the cloud (selfShadow below), 0..1.
    this.sunT = new Float32Array(count).fill(1);
    this._sunL = new THREE.Vector3(0.4, 0.7, 0.5).normalize();
    this.next = 0;
    this.live = 0;

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0,
    ]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]), 3));
    geo.setIndex([0, 2, 1, 2, 3, 1]);
    this.aOffset = new THREE.InstancedBufferAttribute(this.pos, 3);
    this.aSize = new THREE.InstancedBufferAttribute(this.size, 1);
    this.aAlpha = new THREE.InstancedBufferAttribute(this.alpha, 1);
    this.aRot = new THREE.InstancedBufferAttribute(this.rot, 1);
    geo.setAttribute('aOffset', this.aOffset);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aRot', this.aRot);
    this.aExtra = new THREE.InstancedBufferAttribute(this.extra, 3);
    geo.setAttribute('aExtra', this.aExtra);
    this.aSunT = new THREE.InstancedBufferAttribute(this.sunT, 1);
    geo.setAttribute('aSunT', this.aSunT);
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.map = puffTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.map },
        // Steam, not dust: the deluge turns the trench cloud into water vapour, sunlit white with
        // cool grey hollows. The old tan pair made it read as a sandstorm.
        uSunColor: { value: new THREE.Color(0xfbf9f4) },
        // The steam's unlit side, lit by the sky alone: ≈27 % of the sunlit side (a clear sky's
        // diffuse light on a vertical face against the direct beam, ≈), a little blue. It was a
        // warm 14 %, which against the light turned the steam under the fire's glow brown (§37).
        uShadowColor: { value: new THREE.Color(0x8b8d93) },
        uFireColor: { value: new THREE.Color(0xff8a2a) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
        uFlame: { value: 0.0 },
        uPad: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
      transparent: true, depthWrite: false, side: THREE.FrontSide,
    });
    this.points = new THREE.Mesh(geo, mat);
    this.points.name = 'ground-cloud';
    this.points.frustumCulled = false;
    // Before the plumes, not after. Neither writes depth, so whichever draws last wins where
    // they overlap: drawn after, puffs BEHIND the column painted over it and the 33 Raptors
    // vanished into their own steam from T+0 to T+10. Drawn first, the additive column adds on
    // top, which is also what the eye sees — a flame glowing through the cloud round its base.
    this.points.renderOrder = 1;
    this.reset();
  }

  setFlame(intensity) {
    this.points.material.uniforms.uFlame.value = intensity;
  }

  /** World x, z of the pad centre, for the soft ground contact. */
  setPad(x, z) { this.points.material.uniforms.uPad.value.set(x, z); }

  reset(rng = this.rng) {
    this.rng = rng;
    for (let i = 0; i < this.count; i++) {
      this.age[i] = 1; this.life[i] = 1; this.alpha[i] = 0; this.size[i] = 0;
      this.pos[i * 3] = 0; this.pos[i * 3 + 1] = -9999; this.pos[i * 3 + 2] = 0;
      this.rotSpeed[i] = 0; this.grow[i] = 0; this.base[i] = 0;
      this.sizeK[i] = 1; this.opac[i] = 0; this.kind[i] = 0;
      this.extra[i * 3] = 1; this.extra[i * 3 + 1] = 0; this.extra[i * 3 + 2] = 1;
    }
    this.points.material.uniforms.uFlame.value = 0.0;
    this.next = 0;
    // One full upload to clear the buffers, then back to the live window.
    this.live = this.count;
    this.flush();
    this.live = 0;
    this.points.geometry.instanceCount = 0;
  }

  /**
   * Spawns `n` puffs from one source.
   *
   * `size0` and `grow` are per-source because the two things this cloud has to show are not
   * the same size. What leaves a trench mouth at a hundred metres a second is a thunderhead
   * that ends up a hundred metres across; what boils off the deck under the vehicle is
   * deluge water flashing to steam, and it stays much smaller and closer. Emitting both at
   * the trench's scale buried the entire 124 m stack at T+6.
   */
  emit(n, origin, dir, speed, spread, { size0 = 14, grow = 85, life0 = 8, lifeVar = 12, kind = 0 } = {}) {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.count;
      const j = i * 3;
      // Position across the 22 m wide trench mouth (X within ±10 m)
      this.pos[j] = origin[0] + (r() - 0.5) * spread;
      this.pos[j + 1] = Math.max(1.5, origin[1] + (r() - 0.3) * spread * 0.25);
      this.pos[j + 2] = origin[2] + (r() - 0.5) * 4.0;

      const s = speed * (0.65 + r() * 0.70);
      // Confined horizontal jet blast along trench axis Z with realistic lateral plume dispersion
      this.vel[j] = dir[0] * s + (r() - 0.5) * speed * 0.32;
      // Mostly along the ground: the jet leaves the trench flat and only the buoyancy of the
      // hot, wet mass lifts it, slowly, once it has slowed.
      this.vel[j + 1] = dir[1] * s + r() * speed * 0.08 + 1.5;
      this.vel[j + 2] = dir[2] * s + (r() - 0.5) * speed * 0.12;

      this.age[i] = 0;
      this.life[i] = life0 + r() * lifeVar;
      this.size[i] = size0 + r() * (size0 * 0.7);
      this.grow[i] = grow;
      this.base[i] = size0;
      // Nearly upright, not spun at random: each puff is built with its flat, shaded side down
      // and its turrets up, and rolling it over put turrets underneath and stood puffs on
      // their heads — part of what made the cloud read as tumbling cotton wool.
      this.rot[i] = (r() - 0.5) * 0.5;
      this.rotSpeed[i] = (r() - 0.5) * 0.08;
      this.sizeK[i] = 1.0 + r() * 0.6;
      // A third of the puffs are the mass's fringe: half to two-thirds the size and flung a little
      // wider and higher, so the outline the eye reads is made of lobes at several scales and not
      // of a row of equal balls (≈, from the Flight 12 liftoff photographs' turreted edges).
      if (r() < 0.35) {
        const k = 0.5 + r() * 0.2;
        this.size[i] *= k; this.base[i] *= k; this.sizeK[i] *= 0.8;
        this.vel[j] *= 1.25; this.vel[j + 1] += r() * speed * 0.06; this.vel[j + 2] *= 1.4;
      }
      this.kind[i] = kind;
      // Steam: mostly dense, some thin. Dust: a translucent haze, which is how the brown sheet
      // between the two trench clouds reads in the Flight 12 photographs.
      this.opac[i] = kind === 1 ? 0.3 + r() * 0.2 : 0.78 + r() * 0.2;
      // Width over height. Steam near round (stretched tall, puffs read as balloons); dust flat.
      this.extra[i * 3 + 2] = kind === 1 ? 1.5 + r() * 0.9 : 0.92 + r() * 0.3;
      if (i + 1 > (this.live ?? 0)) this.live = i + 1;
    }
  }

  /**
   * @param light false steps the puffs only: their light (selfShadow) and the upload depend on the
   *        state alone, so a caller stepping many ticks in a row (a seek, ×10) asks for them once,
   *        with finish(), instead of once per tick — a seek to T+40 was 1 200 shadow passes.
   */
  update(dt, camera, sun, light = true) {
    if (camera && sun) {
      if (sun.target) {
        _sunDir.subVectors(sun.position, sun.target.position).normalize();
      } else {
        _sunDir.copy(sun.position).normalize();
      }
      // In the cloud's own frame, for the self-shadowing below.
      this.points.updateWorldMatrix(true, false);
      this._sunL.copy(_sunDir).transformDirection(_inv.copy(this.points.matrixWorld).invert());
      _sunDir.transformDirection(camera.matrixWorldInverse);
      this.points.material.uniforms.uSunDir.value.copy(_sunDir);
    }
    const { pos, vel, age, life, size, alpha, rot, rotSpeed, grow, base, sizeK, opac, kind, extra } = this;
    // Highest slot holding a live puff. At the most expensive moment in the scene — liftoff,
    // where this cloud is transparent, overlapping and full-screen — the ring is mostly empty
    // for the first few seconds, and both the upload and the draw were paying for all 860
    // slots regardless. Neither the simulation nor `seek()` is affected: every slot is still
    // stepped, this only bounds what is sent and what is rasterised.
    let hi = -1;
    for (let i = 0; i < this.count; i++) {
      if (age[i] >= life[i]) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      age[i] += dt;
      if (age[i] >= life[i]) { alpha[i] = 0; size[i] = 0; continue; }
      // Counted only once it has survived this step. Counting it before the increment kept a
      // puff that died on the last tick inside the drawn range, so a seek (which ends with a
      // zero-length update) and a playback reaching the same instant drew different counts.
      hi = i;
      const j = i * 3;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;

      // Keep puffs above ground surface
      if (pos[j + 1] < 1.2) pos[j + 1] = 1.2;

      // Ground friction and aerodynamic deceleration
      // Drag on the jet, lighter than before so the cloud rolls out several hundred metres
      // along the ground as it does on film, instead of standing up in two columns.
      const dust = kind[i] === 1;
      const kH = Math.exp(-dt * (dust ? 0.3 : 0.42));
      vel[j] *= kH; vel[j + 2] *= kH;
      // Buoyancy: hot, wet steam rises as a whole over tens of seconds and builds into towers,
      // as the Flight 12 clouds do; dust is heavy and hugs the ground.
      vel[j + 1] = vel[j + 1] * Math.exp(-dt * 0.5) + (dust ? 0.25 : 2.5) * dt;
      // Turbulence: a smooth, deterministic field of position (so a seek replays it exactly),
      // stirring each puff sideways and up and down at a few tens of metres' scale. Without it
      // every puff flew a straight line from its trench mouth and the cloud moved as a block.
      const x = pos[j], y = pos[j + 1], z = pos[j + 2];
      const tu = 1.6 * dt;
      vel[j] += tu * (Math.sin(y * 0.047 + z * 0.021) + 0.6 * Math.sin(z * 0.083 + x * 0.03 + 1.7));
      vel[j + 1] += tu * 0.55 * (Math.sin(x * 0.061 + z * 0.037 + 0.4) + 0.5 * Math.sin(y * 0.09 + 2.1));
      vel[j + 2] += tu * (Math.cos(x * 0.052 + y * 0.029) + 0.6 * Math.cos(y * 0.071 + z * 0.018 + 0.9));

      rot[i] += rotSpeed[i] * dt;

      const u = age[i] / life[i];
      // Billowing expansion, at the rate this puff was emitted with, scaled by its own factor.
      size[i] = (base[i] + u * grow[i]) * sizeK[i];
      // Visible within the first second or so, while it is still small and inside the flame
      // it leaves the trench with: fading in over an eighth of a 20 s life, puffs turned up
      // fully grown a hundred metres out, and the cloud seemed to start from nothing.
      const fadeIn = Math.min(1.0, age[i] / 0.8);
      // Dense for most of its life, then thinning: a launch cloud stays a solid mass for tens
      // of seconds. Fading all the way from birth left the whole cloud a pale veil by T+20.
      // The shader also eats the edge away as the puff ages (aExtra.x), so it thins from the
      // outside in rather than fading evenly like a slide dissolve.
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(u, 0.6, 1.0);
      alpha[i] = opac[i] * fadeIn * fadeOut;
      extra[i * 3] = u;
      extra[i * 3 + 1] = kind[i];
    }
    this.live = hi + 1;
    if (light) this.finish();
  }

  /** The light through the cloud and the upload, for the state as it stands. */
  finish() {
    // The volume (cloudVolume.js) computes the light through the field itself; the per-puff pass
    // on the CPU is the cards' (lightOnCpu, set by whoever draws them).
    if (this.lightOnCpu !== false) this.selfShadow();
    this.flush();
  }

  /**
   * How much sunlight reaches each puff through the rest of the cloud (9-11-2026, block 3: until
   * then a puff's shade was a function of its height only, so a puff on the sunlit flank of the mass
   * and one buried behind it were lit alike). The live puffs' density is splatted into a coarse 3D
   * grid (12 m cells) in the cloud's frame, and from each puff a ray is marched towards the Sun
   * through it, Beer–Lambert: T = exp(−σ Σ ρ Δs). σ is chosen so ≈50 m of dense vapour leaves ≈5 %
   * (≈, not a measured extinction of a launch cloud). Deterministic: from the simulation's state only,
   * so a seek gives the same light.
   */
  selfShadow() {
    const { pos, size, alpha, kind, sunT } = this, n = this.live ?? 0;
    const C = 12, NX = 70, NY = 24, NZ = 70, OX = -NX * C / 2, OZ = -NZ * C / 2;
    const grid = (this._grid ??= new Float32Array(NX * NY * NZ));
    grid.fill(0);
    const cellV = C * C * C;
    for (let i = 0; i < n; i++) {
      if (!(alpha[i] > 0.01)) continue;
      const j = i * 3, r = Math.max(1, size[i] * 0.45);
      // A sphere's worth of vapour spread over the cells it covers, at its opacity; dust is thinner.
      const rho = alpha[i] * (kind[i] === 1 ? 0.5 : 1) * Math.min(1, (4.19 * r * r * r) / cellV);
      const cx = Math.floor((pos[j] - OX) / C), cy = Math.floor(pos[j + 1] / C), cz = Math.floor((pos[j + 2] - OZ) / C);
      const rc = Math.min(3, Math.floor(r / C));
      const w = rho / ((2 * rc + 1) ** 3);
      for (let dz = -rc; dz <= rc; dz++) for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
        const x = cx + dx, y = cy + dy, z = cz + dz;
        if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) continue;
        grid[(z * NY + y) * NX + x] += w;
      }
    }
    const sx = this._sunL.x, sy = this._sunL.y, sz = this._sunL.z, SIGMA = 0.06;
    for (let i = 0; i < n; i++) {
      if (!(alpha[i] > 0.01)) { sunT[i] = 1; continue; }
      const j = i * 3, r = Math.max(1, size[i] * 0.45);
      let tau = 0;
      // From the puff's sunward edge out, cell-sized steps, up to ≈300 m.
      for (let k = 0; k < 25; k++) {
        const d = r + (k + 0.5) * C;
        const x = Math.floor((pos[j] + sx * d - OX) / C), y = Math.floor((pos[j + 1] + sy * d) / C), z = Math.floor((pos[j + 2] + sz * d - OZ) / C);
        if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) break;
        tau += grid[(z * NY + y) * NX + x] * C;
      }
      sunT[i] = Math.exp(-SIGMA * tau);
    }
  }

  /**
   * Uploads and draws only the slots that hold something. `live` is a high-water mark rather
   * than a count, because the ring wraps and the live set is not contiguous from zero — but it
   * is always contained in [0, live), which is enough to bound both costs.
   */
  flush() {
    const n = this.live ?? this.count;
    for (const a of [this.aOffset, this.aSize, this.aAlpha, this.aRot, this.aExtra, this.aSunT]) {
      a.clearUpdateRanges();
      if (n > 0) a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
    this.points.geometry.instanceCount = n;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    // Not the map: puffTexture() is one texture shared by every cloud and the vapour.
  }
}
