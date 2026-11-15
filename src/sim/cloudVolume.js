/**
 * The ignition cloud as one volume of vapour (13-11-2026).
 *
 * Until now the cloud was drawn as what it is simulated as: up to 1 600 puffs, each a camera-facing
 * card with a painted outline (groundCloud.js). However good the card, a heap of cards is not a
 * volume: they cross the ground and the tower along straight lines, they blend in the order of
 * their slots and not of their depth, seen from inside they are sheets, and the plume was added
 * over all of them whatever stood in front of it. Both external audits of 13-11-2026 name it as
 * the first thing to replace.
 *
 * The simulation stays (the puffs, their emission, their drift: deterministic, so a seek lands on
 * the same cloud). What changes is what is drawn:
 *
 *  1. density: every tick the live puffs are splatted, as soft ellipsoids, into a 3D texture in
 *     the cloud's own frame — 6 m cells over 960 × 384 × 1 152 m (x, up, along the trench). Steam
 *     in one channel, dust in the other. On the GPU: one instanced draw per layer, the same
 *     instance buffers the cards used. Overlapping puffs add up to one continuous field.
 *  2. light: into a second, half-resolution volume, for every cell the sunlight that reaches it
 *     through the rest of the cloud (Beer–Lambert along the Sun's direction, as selfShadow() did on
 *     the CPU for each puff, now for the field) and the same towards the fire in the trench.
 *  3. the picture: a pass after the scene's. Each pixel's ray is marched through the box, between
 *     the camera and whatever solid thing the scene drew there (its depth buffer): extinction and
 *     in-scattered light accumulated front to back,
 *         T ← T · exp(−σ ρ Δs),   L ← L + T · S · (1 − exp(−σ ρ Δs)).
 *     The density read is the smooth field eroded by a 3D noise that moves with the vapour, which
 *     gives the billows below the grid's 6 m. The scene behind is dimmed by T.
 *
 * So the vapour meets the ground, the tower and the vehicle where they are, with no line; it is
 * the same from every side and from inside; and what is behind dense vapour — the plume too — is
 * hidden by it. The plume's own layers are drawn after it, each fragment dimmed by the vapour
 * between it and the eye (plumeMedia below), so a flame in front of the cloud stays in front.
 *
 * ≈ throughout: σ, the albedos and the erosion are chosen to look like the Flight 12 liftoff
 * photographs, as the cards' were; nothing here is a measured property of a launch cloud.
 *
 * Cost is bounded by the box on screen and by the opacity: a ray stops at 1 % transmittance, and
 * dense steam gets there in a few tens of metres. Not measured on a real GPU yet (this was written
 * in a software renderer): ?gpu reports it as its own pass, 'cloud volume'; ?off=cloudvolume gives
 * the cards back to compare.
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { HASH_GLSL } from '../core/hashGLSL.js';
import { sunTint } from '../core/sunlight.js';

/** The layer of what is drawn after the vapour during a launch (addMedia). */
export const MEDIA_LAYER = 1;
export const CELL = 6;
export const GRID = { nx: 160, ny: 64, nz: 192 };
const SIZE = new THREE.Vector3(GRID.nx * CELL, GRID.ny * CELL, GRID.nz * CELL);
// The box in the cloud's frame: centred on the pad in x and z, from the ground up.
const BOX_MIN = new THREE.Vector3(-SIZE.x / 2, 0, -SIZE.z / 2);
const SIGMA = 0.06;      // extinction of dense steam, 1/m: ≈ 50 m of it leaves 5 % (as selfShadow's)
const NOISE_N = 64;


const BOX_GLSL = /* glsl */`
  const vec3 BOX_MIN = vec3(${BOX_MIN.x.toFixed(1)}, ${BOX_MIN.y.toFixed(1)}, ${BOX_MIN.z.toFixed(1)});
  const vec3 BOX_SIZE = vec3(${SIZE.x.toFixed(1)}, ${SIZE.y.toFixed(1)}, ${SIZE.z.toFixed(1)});
  const float SIGMA = ${SIGMA.toFixed(3)};
  // What the eye's ray meets: steam is far denser to look at than the light's reach through it
  // suggests (that light is scattered on, the view's is lost).
  const float SIGMA_V = 0.16;`;

/**
 * A tileable 3D noise, drawn once on the GPU: R a few octaves of value noise, G and B billows
 * (Worley). 16-bit: the cloud's surface is a level of it, and 8 bits drew that surface in terraces.
 */
function buildNoise(renderer) {
  const rt = new THREE.WebGL3DRenderTarget(NOISE_N, NOISE_N, NOISE_N, { format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false });
  const tx = rt.texture;
  tx.wrapS = tx.wrapT = tx.wrapR = THREE.RepeatWrapping;
  tx.minFilter = tx.magFilter = THREE.LinearFilter; tx.generateMipmaps = false;
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { uZ: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv; uniform float uZ;
      ${HASH_GLSL}
      // Value noise with a period (in cells), so the texture tiles.
      float vn(vec3 p, float per) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        #define H(o) hk13(mod(i + o, per) + 17.0)
        return mix(mix(mix(H(vec3(0, 0, 0)), H(vec3(1, 0, 0)), f.x), mix(H(vec3(0, 1, 0)), H(vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(H(vec3(0, 0, 1)), H(vec3(1, 0, 1)), f.x), mix(H(vec3(0, 1, 1)), H(vec3(1, 1, 1)), f.x), f.y), f.z);
        #undef H
      }
      // Worley: distance to the nearest of one feature point per cell, periodic.
      float wor(vec3 p, float per) {
        vec3 i = floor(p), f = fract(p); float d = 1.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
          vec3 o = vec3(x, y, z), c = mod(i + o, per);
          vec3 q = o + vec3(hk13(c + 3.1), hk13(c + 71.7), hk13(c + 139.3)) - f;
          d = min(d, dot(q, q));
        }
        return 1.0 - clamp(sqrt(d), 0.0, 1.0);
      }
      void main() {
        vec3 p = vec3(vUv, uZ);
        float v = vn(p * 4.0, 4.0) * 0.5 + vn(p * 8.0, 8.0) * 0.3 + vn(p * 16.0, 16.0) * 0.2;
        float w = wor(p * 4.0, 4.0) * 0.55 + wor(p * 8.0, 8.0) * 0.3 + wor(p * 16.0, 16.0) * 0.15;
        float w2 = wor(p * 12.0, 12.0) * 0.6 + wor(p * 24.0, 24.0) * 0.4;
        gl_FragColor = vec4(v, w, w2, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));
  const prev = renderer.getRenderTarget();
  try {
    for (let z = 0; z < NOISE_N; z++) {
      quad.material.uniforms.uZ.value = (z + 0.5) / NOISE_N;
      renderer.setRenderTarget(rt, z);
      quad.render(renderer);
    }
  } finally { renderer.setRenderTarget(prev); }
  quad.dispose();
  return rt;
}

/**
 * @param cloud the GroundCloud whose puffs it draws (their instance buffers are shared)
 */
export function createCloudVolume(cloud) {
  const density = new THREE.WebGL3DRenderTarget(GRID.nx, GRID.nz, GRID.ny, { format: THREE.RGFormat, type: THREE.HalfFloatType, depthBuffer: false });
  const light = new THREE.WebGL3DRenderTarget(GRID.nx / 2, GRID.nz / 2, GRID.ny / 2, { format: THREE.RGFormat, type: THREE.UnsignedByteType, depthBuffer: false });
  for (const t of [density.texture, light.texture]) {
    t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
  }
  let noise = null, vapourOn = false, mark = null;

  // ---- 1. The puffs into the density volume. Texture axes: s = x, t = z (the trench), r = up, so
  // a layer of the target is a horizontal slice and each puff a disc in it.
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 2, 1, 3]);
  for (const a of ['aOffset', 'aSize', 'aAlpha', 'aExtra']) geo.setAttribute(a, cloud.points.geometry.getAttribute(a));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const splat = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { uY: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aOffset; attribute float aSize; attribute float aAlpha; attribute vec3 aExtra;
      uniform float uY;
      varying vec3 vRel; varying vec3 vRad; varying vec2 vAmt;
      ${BOX_GLSL}
      void main() {
        // The card was aSize wide by its aspect; the vapour in it fills ≈ 0.45 of that (its atlas
        // cell's lobes), as selfShadow took it.
        float asp = max(aExtra.z, 0.2);
        float rh = max(aSize * 0.47 * sqrt(asp), ${(CELL * 0.9).toFixed(1)}), rv = max(aSize * 0.47 / sqrt(asp), ${(CELL * 0.9).toFixed(1)});
        vRad = vec3(rh, rv, rh);
        float dy = uY - aOffset.y;
        vec2 c = aOffset.xz + position.xy * rh;
        vRel = vec3(position.x * rh, dy, position.y * rh);
        float dust = aExtra.y;
        // Thinner as it ages (the card's edge was eaten away by its age): the puff's mass over a
        // growing volume. Dust is a haze.
        float amt = aAlpha * mix(1.0, 0.45, dust);
        vAmt = amt * vec2(1.0 - dust, dust);
        vec2 ndc = (c - BOX_MIN.xz) / BOX_SIZE.xz * 2.0 - 1.0;
        gl_Position = (abs(dy) < rv && aAlpha > 0.004) ? vec4(ndc, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vRel; varying vec3 vRad; varying vec2 vAmt;
      void main() {
        vec3 q = vRel / vRad;
        float k = 1.0 - dot(q, q);
        if (k <= 0.0) discard;
        // A hill of vapour, highest in the middle: the picture's pass cuts it at a level that the
        // noise moves, so the surface it draws billows in and out of this smooth one.
        gl_FragColor = vec4(vAmt * k, 0.0, 1.0);
      }`,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  }));
  splat.frustumCulled = false;
  const dummyCam = new THREE.Camera();

  // ---- 2. The light through it.
  const lightU = {
    uDens: { value: density.texture }, uZ: { value: 0 },
    uSunL: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
  };
  const lightQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: lightU,
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float; precision highp sampler3D;
      uniform sampler3D uDens; uniform float uZ; uniform vec3 uSunL;
      varying vec2 vUv;
      ${BOX_GLSL}
      float rho(vec3 p) {
        vec3 u = (p - BOX_MIN) / BOX_SIZE;
        if (any(lessThan(u, vec3(0.0))) || any(greaterThan(u, vec3(1.0)))) return 0.0;
        vec2 d = texture(uDens, u.xzy).rg;
        return smoothstep(0.1, 0.55, d.r) + min(d.g, 1.0) * 0.25;
      }
      void main() {
        vec3 p = BOX_MIN + vec3(vUv.x, uZ, vUv.y) * BOX_SIZE;
        // Towards the Sun: steps that lengthen, ≈ 400 m in all.
        float tau = 0.0, s = 4.0;
        for (int i = 0; i < 12; i++) {
          float ds = 6.0 + float(i) * 5.0;
          tau += rho(p + uSunL * (s + ds * 0.5)) * ds;
          s += ds;
        }
        // Towards the fire: the nearest point of the trench's lit stretch (its mouths are at z = ±44).
        vec3 f = vec3(0.0, 4.0, clamp(p.z, -44.0, 44.0));
        vec3 df = f - p; float lf = length(df); df /= max(lf, 1e-3);
        float tauF = 0.0;
        for (int i = 0; i < 8; i++) {
          float u = (float(i) + 0.5) / 8.0;
          tauF += rho(p + df * (lf * u)) * lf / 8.0;
        }
        gl_FragColor = vec4(exp(-SIGMA * 0.55 * tau), exp(-SIGMA * 0.5 * tauF), 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));

  const _inv = new THREE.Matrix4(), _sun = new THREE.Vector3(), _col = new THREE.Color();
  const _scissor = new THREE.Vector4(), _boxPt = new THREE.Vector3();
  let dirty = true, lastLive = -1;
  let prevDy0 = 0, prevDy1 = -1, hasLive = false;
  const liveMin = new THREE.Vector3(), liveMax = new THREE.Vector3();
  const boxMinBound = new THREE.Vector3(BOX_MIN.x, 0, BOX_MIN.z);
  const boxMaxBound = new THREE.Vector3(BOX_MIN.x + SIZE.x, SIZE.y, BOX_MIN.z + SIZE.z);

  function computeLiveBounds(n) {
    if (n <= 0) { hasLive = false; return; }
    const { pos, size, alpha, extra } = cloud;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    const minRad = CELL * 0.9;
    for (let i = 0; i < n; i++) {
      if (alpha[i] <= 0.004) continue;
      const j = i * 3;
      const asp = extra[j + 2] > 0.2 ? extra[j + 2] : 0.2;
      const sq = Math.sqrt(asp);
      const s = size[i] * 0.47;
      const rh = s * sq > minRad ? s * sq : minRad;
      const rv = s / sq > minRad ? s / sq : minRad;
      const px = pos[j], py = pos[j + 1], pz = pos[j + 2];
      if (px - rh < x0) x0 = px - rh;
      if (px + rh > x1) x1 = px + rh;
      if (py - rv < y0) y0 = py - rv;
      if (py + rv > y1) y1 = py + rv;
      if (pz - rh < z0) z0 = pz - rh;
      if (pz + rh > z1) z1 = pz + rh;
    }
    if (x0 > x1) { hasLive = false; return; }
    hasLive = true;
    liveMin.set(x0, y0, z0).clamp(boxMinBound, boxMaxBound);
    liveMax.set(x1, y1, z1).clamp(boxMinBound, boxMaxBound);
  }

  /** Draws the puffs' state into the two volumes. Called when the simulation has stepped. */
  function bake(renderer) {
    noise ??= buildNoise(renderer);
    const n = cloud.live ?? 0;
    computeLiveBounds(n);
    const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(_col);
    try {
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      let dy0 = 0, dy1 = -1;
      if (hasLive) {
        dy0 = Math.max(0, Math.floor(liveMin.y / CELL));
        dy1 = Math.min(GRID.ny - 1, Math.floor(liveMax.y / CELL));
      }
      // Clear any density slice that held puffs on the previous tick and is now outside [dy0, dy1].
      for (let y = prevDy0; y <= prevDy1; y++) {
        if (y >= dy0 && y <= dy1) continue;
        renderer.setRenderTarget(density, y);
        renderer.clear();
      }
      if (hasLive) {
        geo.instanceCount = n;
        for (let y = dy0; y <= dy1; y++) {
          splat.material.uniforms.uY.value = (y + 0.5) * CELL;
          renderer.setRenderTarget(density, y);
          renderer.render(splat, dummyCam);
        }
        // Light volume is 12 m/cell and only ever sampled inside density > 0 (+1 texel linear filter border).
        const pad = CELL * 2;
        const lStep = CELL * 2;
        const lx0 = Math.max(0, Math.floor((liveMin.x - pad - BOX_MIN.x) / lStep));
        const lx1 = Math.min(GRID.nx / 2 - 1, Math.floor((liveMax.x + pad - BOX_MIN.x) / lStep));
        const lz0 = Math.max(0, Math.floor((liveMin.z - pad - BOX_MIN.z) / lStep));
        const lz1 = Math.min(GRID.nz / 2 - 1, Math.floor((liveMax.z + pad - BOX_MIN.z) / lStep));
        const ly0 = Math.max(0, Math.floor((liveMin.y - pad) / lStep));
        const ly1 = Math.min(GRID.ny / 2 - 1, Math.floor((liveMax.y + pad) / lStep));
        light.scissorTest = true;
        light.scissor.set(lx0, lz0, lx1 - lx0 + 1, lz1 - lz0 + 1);
        for (let y = ly0; y <= ly1; y++) {
          lightU.uZ.value = (y + 0.5) / (GRID.ny / 2);
          renderer.setRenderTarget(light, y);
          lightQuad.render(renderer);
        }
      }
      prevDy0 = dy0; prevDy1 = dy1;
    } finally {
      light.scissorTest = false;
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAuto;
      renderer.setClearColor(_col, prevAlpha);
    }
    lastLive = n;
    dirty = false;
  }

  // ---- 3. The picture.
  const U = {
    tDiffuse: { value: null }, tDepth: { value: null },
    uDens: { value: density.texture }, uLight: { value: light.texture }, uNoise: { value: null },
    uInvVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    uOrigin: { value: new THREE.Vector3() },
    uLiveMin: { value: BOX_MIN.clone() }, uLiveMax: { value: BOX_MIN.clone().add(SIZE) },
    uSunL: lightU.uSunL, uSunColor: { value: new THREE.Color(1, 1, 1) }, uSkyColor: { value: new THREE.Color(0.27, 0.28, 0.31) },
    uFireColor: { value: new THREE.Color(0xff8a2a) }, uFlame: { value: 0 },
    uTime: { value: 0 }, uJit: { value: 0 }, uSteps: { value: 96 },
  };
  const VOLUME_GLSL = /* glsl */`
    precision highp sampler3D;
    uniform sampler3D uDens, uLight, uNoise;
    uniform vec3 uOrigin;
    uniform float uTime;
    ${BOX_GLSL}
    // Steam and dust at a point of the cloud's frame: the smooth field of the puffs, eaten into by
    // a noise that rises with the vapour (billows a few metres to a few tens of metres across).
    // hOut: how far inside the surface the point is, in the field's units (negative outside): a
    // smooth number to take a slope of, where the density itself is a step.
    vec2 vapour(vec3 p, out vec3 uvw, out float hOut) {
      hOut = -1.0;
      uvw = (p - BOX_MIN) / BOX_SIZE;
      vec2 d = texture(uDens, uvw.xzy).rg;
      float sum = d.r + d.g;
      if (sum < 0.02) return vec2(0.0);
      vec3 q = p / 170.0 + vec3(0.0, -uTime * 0.010, 0.0);
      vec4 n1 = texture(uNoise, q);
      vec4 n2 = texture(uNoise, q * 3.3 + vec3(0.31, -uTime * 0.016, 0.17));
      // Billows ≈ 40 m across carrying ones of ≈ 12 m and ≈ 4 m (Worley cells read as cauliflower).
      float billow = n1.g * 0.55 + n2.g * 0.28 + n2.b * 0.17;
      // The surface is where the puffs' smooth field crosses a level, and the noise moves the
      // level: a billow pushes the surface out, the hollow between two pulls it in — by up to a
      // third of a puff's radius. A thin, old puff (a low hill) is cut through to clear air first,
      // so the mass frays from its edges as it ages. Steam has a surface; dust is a haze without.
      float level = 0.06 + 0.66 * smoothstep(0.72, 0.38, billow);
      float steam = smoothstep(level, level + 0.14, sum) * (0.8 + 0.4 * n2.r);
      float dustK = d.g / sum;
      hOut = sum - level;
      float e = mix(steam, clamp(sum * 1.4, 0.0, 1.0) * (0.35 + 0.65 * billow), dustK);
      // Soft floor: the lowest metres thin into the ground instead of standing on it.
      e *= smoothstep(0.0, 2.5, p.y);
      return d / sum * e;
    }`;
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    name: 'cloud-volume',
    glslVersion: THREE.GLSL3,
    uniforms: U,
    vertexShader: /* glsl */`out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tDepth;
      uniform mat4 uInvVP;
      uniform vec3 uCam, uLiveMin, uLiveMax, uSunL, uSunColor, uSkyColor, uFireColor;
      uniform float uFlame, uJit;
      uniform int uSteps;
      in vec2 vUv;
      // The light the vapour sends to the eye and what it lets through of the scene behind it.
      layout(location = 0) out vec4 oLight;
      // Along the ray, where the vapour starts to hide what is behind it and where it has hidden
      // it as far as it will (m from the eye): what a flame at some depth needs to know.
      layout(location = 1) out vec4 oRange;
      ${VOLUME_GLSL}
      void main() {
        float z = texture(tDepth, vUv).r;
        vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
        vec3 hitW = w.xyz / w.w;
        vec3 o = uCam - uOrigin, d = hitW - uCam;
        float tScene = length(d); d /= tScene;
        if (z >= 1.0) tScene = 1e9;
        // The ray's stretch inside the live puffs' bounding box.
        vec3 inv = 1.0 / d, ta = (uLiveMin - o) * inv, tb = (uLiveMax - o) * inv;
        vec3 tmn = min(ta, tb), tmx = max(ta, tb);
        float t0 = max(max(tmn.x, tmn.y), max(tmn.z, 0.0)), t1 = min(min(tmx.x, tmx.y), min(tmx.z, tScene));
        oLight = vec4(0.0, 0.0, 0.0, 1.0); oRange = vec4(1e5, 1e5, 0.0, 1.0);
        if (t1 <= t0) return;
        float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uJit);
        // Steps a fraction of what a pixel covers at that distance, 2.5 m at least; longer where
        // there is nothing (the field is smooth over a cell, so nothing is stepped over).
        float T = 1.0; vec3 L = vec3(0.0);
        float mu = dot(d, uSunL);
        // Forward scattering towards the Sun (a bright rim against it), otherwise near even:
        // water droplets, many times scattered.
        float phase = 0.82 + 0.75 * pow(max(mu, 0.0), 6.0) + 0.1 * mu;
        float t = t0, len = t1 - t0;
        // Steps: a fraction of what a pixel covers at that distance and never over 4 m inside the
        // vapour; clear air between is crossed in longer ones (the field is smooth over a cell).
        float clear = clamp(len / float(uSteps), 5.0, 14.0);
        t += jit * clear;
        bool wasClear = true; float fineLeft = 0.0, dsPrev = 0.7, tIn = 1e5, tOut = 1e5;
        for (int i = 0; i < 320; i++) {
          if (t >= t1) break;
          vec3 p = o + d * t, uvw;
          float h1, h2;
          vec2 v = vapour(p, uvw, h1);
          float rho = v.x + v.y;
          // Met after a long step through clear air: the surface is somewhere in that step. Back
          // over it in short ones, so the surface is found to a metre or so, not to the long
          // step's length (which drew the dither as stripes on every edge).
          if (rho > 0.002 && wasClear) { t -= clear; wasClear = false; fineLeft = clear; dsPrev = max(0.7, t * 0.0025); t += jit * dsPrev; continue; }
          if (rho > 0.002) {
            // About a sixth of an optical depth a step: short in dense steam, where the picture
            // is made in a few metres, long through a thin haze, which needs no more.
            // And never much longer than the last: thin vapour at a surface is the start of thick, and a
            // long step from it went straight through the lit shell (seen as a moiré of the dither).
            float ds = clamp(0.16 / (SIGMA_V * rho * mix(1.0, 0.35, v.y / rho)), max(0.7, t * 0.0025), min(clear, dsPrev * 1.35));
            dsPrev = ds;
            vec2 lt = texture(uLight, uvw.xzy).rg;
            float dustK = v.y / rho;
            // The billow's own relief (the light volume's cells are too coarse to carry it): the
            // slope of the surface's depth towards the Sun. Deeper that way, the point is in a
            // fold's shade; shallower, on a lit flank.
            vec3 uvw2;
            vapour(p + uSunL * 6.0, uvw2, h2);
            float relief = mix(1.0, clamp(0.58 + (h1 - h2) * 2.4, 0.22, 1.0), 1.0 - dustK);
            float sunT = lt.r * relief;
            // Light scattered many times does not die as Beer says: a floor that falls slower.
            float direct = max(sunT, 0.2 * pow(lt.r, 0.3));
            float open = 0.5 + 0.5 * lt.r;
            vec3 albedo = mix(vec3(1.0), vec3(0.78, 0.68, 0.56), dustK);
            vec3 S = albedo * (uSunColor * direct * phase + uSkyColor * open);
            // The fire in the trench and under the vehicle lights the vapour round it.
            float dF = length(vec3(p.x * 1.2, max(0.0, p.y - 3.0) * 1.1, max(0.0, abs(p.z) - 38.0) * 0.55));
            float fire = uFlame * (1.0 - smoothstep(10.0, 170.0, dF)) * (1.0 - smoothstep(6.0, 80.0, p.y));
            S += albedo * uFireColor * (fire * fire * 2.4) * lt.g;
            float a = 1.0 - exp(-SIGMA_V * rho * mix(1.0, 0.35, dustK) * ds);
            L += T * a * S;
            if (T > 0.96 && T * (1.0 - a) <= 0.96) tIn = t;
            T *= 1.0 - a;
            tOut = t + ds;
            if (T < 0.01) { T = 0.0; break; }
            t += ds;
          } else if (fineLeft > 0.0) {
            float f = max(0.7, t * 0.0025);
            t += f; fineLeft -= f;
          } else {
            t += clear; wasClear = true;
          }
        }
        oLight = vec4(L, T);
        oRange = vec4(min(tIn, tOut), tOut, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));

  // ---- 4. What glows or drifts in and round the vapour: the plumes, the flames, the steam cards
  // of the vehicle. Drawn after the volume, each fragment dimmed by the vapour between it and the
  // eye — so a flame behind the cloud is hidden by it and one in front of it is not — and faded
  // where it meets something solid instead of being cut along a line (the depth is compared here,
  // softly, not by the depth test). Outside a launch they are drawn as they always were.
  const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  dummy.needsUpdate = true;
  const MU = {
    uMediaDepth: { value: dummy }, uMediaInvVP: U.uInvVP, uMediaCam: U.uCam, uMediaRes: { value: new THREE.Vector2(1, 1) },
    uMediaOn: { value: 0 }, uMediaVapour: { value: 0 }, uMediaRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uMediaRange: { value: dummy }, uMediaLight: { value: dummy },
  };
  const media = [];          // { object, material }
  let mediaOn = false, scene = null, viewCamera = null;
  function patchMedia(material) {
    if (!material?.isShaderMaterial || material.userData.media) return;
    material.userData.media = true;
    // Premultiplied layers (ONE, 1 − a) dim whole; the rest are scaled by their alpha.
    const premult = material.blending === THREE.CustomBlending && material.blendSrc === THREE.OneFactor;
    Object.assign(material.uniforms, MU);
    material.fragmentShader = material.fragmentShader.replace(/void\s+main\s*\(\s*\)/, 'void mediaMain()') + /* glsl */`
      uniform sampler2D uMediaDepth;
      uniform mat4 uMediaInvVP;
      uniform vec3 uMediaCam;
      uniform vec2 uMediaRes;
      uniform float uMediaOn, uMediaVapour;
      uniform vec4 uMediaRect;
      uniform sampler2D uMediaRange, uMediaLight;
      float mediaFactor() {
        if (uMediaOn < 0.5) return 1.0;
        vec2 uv = gl_FragCoord.xy / uMediaRes;
        float zs = texture(uMediaDepth, uv).r;
        if (gl_FragCoord.z >= zs) return 0.0;
        vec4 a = uMediaInvVP * vec4(uv * 2.0 - 1.0, gl_FragCoord.z * 2.0 - 1.0, 1.0);
        vec3 pf = a.xyz / a.w;
        float df = distance(pf, uMediaCam), k = 1.0;
        if (zs < 1.0) {
          vec4 b = uMediaInvVP * vec4(uv * 2.0 - 1.0, zs * 2.0 - 1.0, 1.0);
          // Faded over the last ≈ 2 % of its distance (0.3 to 3 m) before the surface behind it.
          k = smoothstep(0.0, clamp(df * 0.02, 0.3, 3.0), distance(b.xyz / b.w, uMediaCam) - df);
        }
        if (uMediaVapour > 0.5 && all(greaterThanEqual(uv, uMediaRect.xy)) && all(lessThan(uv, uMediaRect.zw))) {
          // The vapour between the eye and this fragment, from what the volume's pass found along
          // this pixel's ray: clear up to where it starts, as dark as it gets past where it ends.
          vec2 range = texture(uMediaRange, uv).rg;
          float through = texture(uMediaLight, uv).a;
          k *= mix(1.0, through, smoothstep(range.x, max(range.y, range.x + 1.0), df));
        }
        return k;
      }
      void main() {
        mediaMain();
        float mediaK = mediaFactor();
        ${premult ? 'gl_FragColor *= mediaK;' : 'gl_FragColor.a *= mediaK;'}
      }`;
    material.needsUpdate = true;
  }
  // In its own target a layer's alpha is what it hides of the scene, so the blend's alpha half has
  // to say that: a premultiplied layer's own alpha over what is there, an additive one nothing.
  function applyMode(m, on) {
    const mat = m.material;
    m.saved ??= { blending: mat.blending, blendSrc: mat.blendSrc, blendDst: mat.blendDst, blendSrcAlpha: mat.blendSrcAlpha, blendDstAlpha: mat.blendDstAlpha };
    m.object.layers.set(on ? MEDIA_LAYER : 0);
    mat.depthTest = !on;
    if (!on) { Object.assign(mat, m.saved); return; }
    if (m.saved.blending === THREE.AdditiveBlending) {
      Object.assign(mat, { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    } else if (m.saved.blending === THREE.CustomBlending && m.saved.blendSrc === THREE.OneFactor) {
      Object.assign(mat, { blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    }
  }
  function setMediaMode(on) {
    if (on === mediaOn) return;
    mediaOn = on;
    MU.uMediaOn.value = on ? 1 : 0;
    for (const m of media) applyMode(m, on);
    if (!on) MU.uMediaDepth.value = MU.uMediaRange.value = MU.uMediaLight.value = dummy;
  }
  const visibleInTree = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  // The march's own target: the vapour's light and transmittance, and the range above. Made when
  // a launch first needs it and let go when the sequence is over.
  let marchRT = null;
  let mediaRT = null;
  const composeU = {
    tDiffuse: U.tDiffuse, tVapour: { value: null }, uOn: { value: 0 },
    tMedia: { value: null }, uMedia: { value: 0 }, uRect: MU.uMediaRect,
  };
  const composeQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    name: 'cloud-volume-compose',
    uniforms: composeU,
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse, tVapour, tMedia; uniform float uOn, uMedia; uniform vec4 uRect; varying vec2 vUv;
      void main() {
        vec4 scene = texture2D(tDiffuse, vUv);
        // The scene through the vapour, plus the vapour's own light — or the scene as it is.
        bool inVap = uOn > 0.5 && all(greaterThanEqual(vUv, uRect.xy)) && all(lessThan(vUv, uRect.zw));
        vec4 v = inVap ? texture2D(tVapour, vUv) : vec4(0.0, 0.0, 0.0, 1.0);
        vec3 c = scene.rgb * v.a + v.rgb;
        // Then the plumes and the steam: their light, and what they hide of all that.
        if (uMedia > 0.5) { vec4 m = texture2D(tMedia, vUv); c = c * (1.0 - clamp(m.a, 0.0, 1.0)) + m.rgb; }
        gl_FragColor = vec4(c, scene.a);
      }`,
    depthTest: false, depthWrite: false,
  }));
  function mediaTarget(w, h) {
    if (mediaRT && mediaRT.width === w && mediaRT.height === h) return mediaRT;
    mediaRT?.dispose();
    mediaRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    mediaRT.texture.generateMipmaps = false;
    return mediaRT;
  }
  function marchTarget(w, h) {
    if (marchRT && marchRT.width === w && marchRT.height === h) return marchRT;
    marchRT?.dispose();
    marchRT = new THREE.WebGLRenderTarget(w, h, { count: 2, type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    for (const t of marchRT.textures) t.generateMipmaps = false;
    marchRT.textures[1].format = THREE.RGFormat; marchRT.textures[1].internalFormat = 'RG16F';
    return marchRT;
  }

  const vp = new THREE.Matrix4();
  function screenRectForLive(w, h) {
    if (!hasLive) return null;
    const pad = CELL * 2;
    const x0 = Math.max(BOX_MIN.x, liveMin.x - pad), x1 = Math.min(BOX_MIN.x + SIZE.x, liveMax.x + pad);
    const y0 = Math.max(0, liveMin.y - pad), y1 = Math.min(SIZE.y, liveMax.y + pad);
    const z0 = Math.max(BOX_MIN.z, liveMin.z - pad), z1 = Math.min(BOX_MIN.z + SIZE.z, liveMax.z + pad);
    U.uLiveMin.value.set(x0, y0, z0);
    U.uLiveMax.value.set(x1, y1, z1);
    const ox = U.uOrigin.value.x, oy = U.uOrigin.value.y, oz = U.uOrigin.value.z;
    const cx = U.uCam.value.x - ox, cy = U.uCam.value.y - oy, cz = U.uCam.value.z - oz;
    // Inside or straddling near plane: fall back to full screen.
    if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 && cz >= z0 && cz <= z1) return [0, 0, w, h];
    let u0 = 1, v0 = 1, u1 = 0, v1 = 0;
    const xs = [x0 + ox, x1 + ox], ys = [y0 + oy, y1 + oy], zs = [z0 + oz, z1 + oz];
    for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) for (let iz = 0; iz < 2; iz++) {
      _boxPt.set(xs[ix], ys[iy], zs[iz]);
      // transform manually with vp to preserve w
      const e = vp.elements;
      const cw = e[3] * _boxPt.x + e[7] * _boxPt.y + e[11] * _boxPt.z + e[15];
      if (cw <= 0.001) return [0, 0, w, h];
      const u = ((e[0] * _boxPt.x + e[4] * _boxPt.y + e[8] * _boxPt.z + e[12]) / cw) * 0.5 + 0.5;
      const v = ((e[1] * _boxPt.x + e[5] * _boxPt.y + e[9] * _boxPt.z + e[13]) / cw) * 0.5 + 0.5;
      if (u < u0) u0 = u; if (u > u1) u1 = u;
      if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const sx0 = Math.max(0, Math.floor(u0 * w)), sy0 = Math.max(0, Math.floor(v0 * h));
    const sx1 = Math.min(w, Math.ceil(u1 * w)), sy1 = Math.min(h, Math.ceil(v1 * h));
    if (sx1 <= sx0 || sy1 <= sy0) return null;
    return [sx0, sy0, sx1 - sx0, sy1 - sy0];
  }

  class CloudVolumePass extends Pass {
    constructor() { super(); this.needsSwap = true; this.enabled = false; this.name = 'cloud volume'; }
    render(renderer, writeBuffer, readBuffer) {
      if (dirty) bake(renderer);
      U.tDiffuse.value = readBuffer.texture;
      U.tDepth.value = readBuffer.depthTexture;
      U.uNoise.value = noise.texture;
      const target = this.renderToScreen ? null : writeBuffer;
      const rect = vapourOn ? screenRectForLive(readBuffer.width, readBuffer.height) : null;
      const drawVapour = vapourOn && !!rect;
      composeU.uOn.value = drawVapour ? 1 : 0;
      if (drawVapour) {
        const [sx, sy, sw, sh] = rect;
        MU.uMediaRect.value.set(sx / readBuffer.width, sy / readBuffer.height, (sx + sw) / readBuffer.width, (sy + sh) / readBuffer.height);
        const rt = marchTarget(readBuffer.width, readBuffer.height);
        rt.scissorTest = true;
        rt.scissor.set(sx, sy, sw, sh);
        try {
          renderer.setRenderTarget(rt);
          quad.render(renderer);
        } finally {
          rt.scissorTest = false;
        }
        composeU.tVapour.value = rt.textures[0];
        mark?.('cloud volume compose');
      } else {
        MU.uMediaRect.value.set(0, 0, 0, 0);
      }
      // What glows, on its own layer and into a target of its own, against the scene's depth as a
      // texture. (Not straight into the composer's buffer after the vapour: that buffer is
      // multisampled, and once it has been resolved its samples are thrown away — a second draw
      // into it would start from nothing on a real GPU.)
      const drawMedia = mediaOn && scene && viewCamera && media.some(m => visibleInTree(m.object));
      composeU.uMedia.value = drawMedia ? 1 : 0;
      if (drawMedia) {
        const mrt = mediaTarget(readBuffer.width, readBuffer.height);
        MU.uMediaDepth.value = readBuffer.depthTexture;
        MU.uMediaVapour.value = drawVapour ? 1 : 0;
        if (drawVapour) { MU.uMediaRange.value = marchRT.textures[1]; MU.uMediaLight.value = marchRT.textures[0]; }
        MU.uMediaRes.value.set(mrt.width, mrt.height);
        mark?.('plumes and steam');
        const mask = viewCamera.layers.mask, bg = scene.background;
        const sm = renderer.shadowMap, au = sm.autoUpdate, nu = sm.needsUpdate, ac = renderer.autoClear, ca = renderer.getClearAlpha();
        renderer.getClearColor(_col);
        try {
          viewCamera.layers.set(MEDIA_LAYER);
          scene.background = null;
          sm.autoUpdate = false; sm.needsUpdate = false;
          renderer.autoClear = true;
          renderer.setClearColor(0x000000, 0);
          renderer.setRenderTarget(mrt);
          renderer.render(scene, viewCamera);
        } finally {
          viewCamera.layers.mask = mask; scene.background = bg;
          sm.autoUpdate = au; sm.needsUpdate = nu; renderer.autoClear = ac;
          renderer.setClearColor(_col, ca);
          MU.uMediaDepth.value = MU.uMediaRange.value = MU.uMediaLight.value = dummy;
        }
        composeU.tMedia.value = mrt.texture;
        mark?.('cloud volume compose');
      }
      renderer.setRenderTarget(target);
      composeQuad.render(renderer);
    }
    dispose() { quad.dispose(); }
  }
  const pass = new CloudVolumePass();

  return {
    pass, density, light, GLSL: VOLUME_GLSL, uniforms: U, cards: cloud,
    /** The three shaders, for a tool to look at. */
    materials: { splat: splat.material, light: lightQuad.material, march: quad.material },
    get noise() { return noise; },
    /** The GPU profiler's mark (core/gpuProfiler.js), so the pass's parts are timed apart. */
    set mark(fn) { mark = fn; },
    /** Draws the noise again (a lost context). */
    rebuildNoise() { noise?.dispose(); noise = null; dirty = true; },
    /** The simulation stepped (or was reset): the volumes are redrawn before the next picture. */
    touch() { dirty = true; },
    /** Pre-compiles noise + all 4 volumetric shaders once during loading so ignition does not stall. */
    warmup(renderer) {
      noise ??= buildNoise(renderer);
      const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
      const prevScissor = renderer.getScissorTest();
      const warm1 = new THREE.WebGLRenderTarget(1, 1, { format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false });
      const warmMRT = new THREE.WebGLRenderTarget(1, 1, { count: 2, type: THREE.HalfFloatType, depthBuffer: false });
      try {
        renderer.autoClear = false;
        renderer.setScissorTest(false);
        geo.instanceCount = 0;
        renderer.setRenderTarget(warm1);
        renderer.render(splat, dummyCam);
        lightQuad.render(renderer);
        U.tDiffuse.value = dummy; U.tDepth.value = dummy; U.uNoise.value = noise.texture;
        renderer.setRenderTarget(warmMRT);
        quad.render(renderer);
        composeU.tDiffuse.value = dummy; composeU.tVapour.value = warmMRT.textures[0]; composeU.tMedia.value = dummy;
        composeU.uOn.value = 1; composeU.uMedia.value = 1;
        renderer.setRenderTarget(warm1);
        composeQuad.render(renderer);
      } finally {
        composeU.uOn.value = 0; composeU.uMedia.value = 0;
        composeU.tVapour.value = null; composeU.tMedia.value = null;
        U.tDiffuse.value = null; U.tDepth.value = null;
        renderer.setScissorTest(prevScissor);
        renderer.setRenderTarget(prevTarget);
        renderer.autoClear = prevAuto;
        warm1.dispose(); warmMRT.dispose();
      }
    },
    /**
     * Once a frame before the composer: whether there is anything to draw, the camera, the light.
     * @param sun the scene's directional light; elevDeg its elevation; time the mission clock (s)
     */
    update(camera, sun, elevDeg, time, on = true, launching = false) {
      const live = (cloud.live ?? 0) > 0;
      vapourOn = on && (live || (dirty && lastLive > 0));
      MU.uMediaVapour.value = vapourOn ? 1 : 0;
      setMediaMode(on && launching);
      viewCamera = camera;
      pass.enabled = vapourOn || mediaOn;
      // Nothing to march and no launch: the march's target is given back.
      if (!pass.enabled && (marchRT || mediaRT)) { marchRT?.dispose(); mediaRT?.dispose(); marchRT = mediaRT = null; }
      cloud.points.visible = !on;
      if (!pass.enabled) return;
      camera.updateMatrixWorld();
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      U.uInvVP.value.copy(vp).invert();
      U.uCam.value.setFromMatrixPosition(camera.matrixWorld);
      U.uTime.value = time;
      cloud.points.updateWorldMatrix(true, false);
      U.uOrigin.value.setFromMatrixPosition(cloud.points.matrixWorld);
      if (!vapourOn) return;
      if (sun.target) _sun.subVectors(sun.position, sun.target.position).normalize(); else _sun.copy(sun.position).normalize();
      U.uSunL.value.copy(_sun).transformDirection(_inv.copy(cloud.points.matrixWorld).invert());
      // The Sun's colour through the air at this elevation (core/sunlight.js), fading as it sets;
      // the sky's share is what a clear sky gives a face the Sun does not reach (≈ 27 %, bluish).
      const day = THREE.MathUtils.smoothstep(elevDeg, -4, 8);
      const [r, g, b] = sunTint(elevDeg);
      U.uSunColor.value.setRGB(r, g, b).multiplyScalar(0.98 * day);
      U.uSkyColor.value.setRGB(0.26, 0.275, 0.30).multiplyScalar(0.25 + 0.75 * day);
      U.uFlame.value = cloud.points.material.uniforms.uFlame.value;
    },
    /**
     * Hands over a plume, a flame or a steam effect (an object and what is under it): during a
     * launch it is drawn after the vapour, dimmed by what vapour is in front of it and faded into
     * what is behind it. Its shader materials are patched once.
     */
    addMedia(root, inScene) {
      scene = inScene ?? scene;
      root.traverse((o) => {
        if (!(o.isMesh || o.isPoints) || !o.material?.isShaderMaterial || media.some(m => m.object === o)) return;
        patchMedia(o.material);
        media.push({ object: o, material: o.material });
        if (mediaOn) applyMode(media[media.length - 1], true);
      });
    },
    set stillFrame(n) { U.uJit.value = (n * 0.6180339887) % 1; },
    dispose() { density.dispose(); light.dispose(); noise?.dispose(); splat.material.dispose(); geo.dispose(); lightQuad.dispose(); quad.dispose(); composeQuad.dispose(); marchRT?.dispose(); mediaRT?.dispose(); },
  };
}
