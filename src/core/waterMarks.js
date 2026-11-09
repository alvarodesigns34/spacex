/**
 * What a vehicle leaves on the water's surface: foam where it churns the water and rings that run
 * out from where it struck, lying on the moving sea and fading (9-11-2026, external audit of 8-11,
 * priority 4). Until then a car or the bike running into the sea threw droplets (gt3Drive.js
 * createSpray) and nothing stayed on the water: no wake behind it, no ring where it went in.
 *
 * Each mark is one flat quad of an instanced mesh, kept at the sea's height under its centre every
 * frame (`surfaceAt`, the same surface the physics reads: core/water.js and core/ocean.js), so it
 * rides the swell. Two kinds:
 *  - foam: a ragged white patch, a few metres, that spreads slowly and thins over several seconds;
 *  - ring: the crest of a ripple running out at `speed` m/s, thinning as it widens.
 * Sizes, speeds and lives are chosen to look right (≈): a ripple of a few metres' wavelength runs at
 * ≈1.5–3 m/s in deep water (c = √(gλ/2π)); foam from a breaking wave lasts seconds to tens of seconds.
 *
 * `splashInto` is the entry: droplets thrown up in a crown and out ahead in proportion to the speed
 * (with the spray pool the vehicle already has), a ring and a foam patch scaled by the speed and
 * the width that went in. It is a look, not a fluid simulation.
 */
import * as THREE from 'three';

const FOAM = 0, RING = 1;

export function createWaterMarks(scene, surfaceAt, max = 256) {
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  const aKind = new Float32Array(max), aFade = new Float32Array(max), aSeed = new Float32Array(max), aWidth = new Float32Array(max);
  geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(aKind, 1));
  geo.setAttribute('aFade', new THREE.InstancedBufferAttribute(aFade, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  geo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(aWidth, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    name: 'water-marks', transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */`
      attribute float aKind, aFade, aSeed, aWidth;
      varying vec2 vP; varying float vKind, vFade, vSeed, vWidth;
      void main() {
        vP = position.xz; vKind = aKind; vFade = aFade; vSeed = aSeed; vWidth = aWidth;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vP; varying float vKind, vFade, vSeed, vWidth;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { return 0.5 * n(p) + 0.28 * n(p * 2.1 + 3.7) + 0.14 * n(p * 4.3 - 1.9) + 0.08 * n(p * 8.9 + 5.3); }
      void main() {
        float r = length(vP);
        if (r > 1.0) discard;
        vec2 q = vP * 3.0 + vSeed * 17.0;
        float a;
        if (vKind < 0.5) {
          // Foam: a patch broken into streaks and holes, ragged at its edge, thinning as it fades.
          // Mostly holes: white lace and streaks over the water, not a sheet (a wide, soft band of
          // overlapping patches read as mist on the first try).
          float f = fbm(q) * 0.6 + fbm(q * 3.1) * 0.4;
          float lace = smoothstep(0.42, 0.62, fbm(q * 7.3 + 11.0));
          a = smoothstep(1.0, 0.5, r + 0.35 * (f - 0.5)) * smoothstep(0.56, 0.74, f) * (0.35 + 0.65 * lace);
        } else {
          // A ring: the crest, a band vWidth wide (as a fraction of the radius), broken by noise.
          float d = (r - (1.0 - vWidth)) / vWidth;
          a = exp(-d * d * 3.0) * (0.55 + 0.45 * fbm(vec2(atan(vP.y, vP.x) * 6.0, vSeed * 9.0)));
        }
        a *= vFade;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.88, 0.92, 0.94, a * 0.75);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.name = 'water-marks';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.count = 0;
  scene.add(mesh);

  const m = Array.from({ length: max }, () => ({ live: false, kind: FOAM, x: 0, z: 0, r: 1, grow: 0, life: 1, age: 0, op: 1, rot: 0 }));
  let next = 0, used = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  function add(kind, x, z, r, grow, life, op) {
    const i = next; next = (next + 1) % max; used = Math.max(used, next === 0 ? max : next);
    Object.assign(m[i], { live: true, kind, x, z, r, grow, life, age: 0, op, rot: Math.random() * Math.PI * 2 });
    aKind[i] = kind; aSeed[i] = Math.random();
    geo.attributes.aKind.needsUpdate = true; geo.attributes.aSeed.needsUpdate = true;
  }

  return {
    mesh,
    /** A foam patch r m across at (x, z), spreading `grow` m/s, gone after `life` s. */
    foam(x, z, r, { grow = 0.15, life = 8, opacity = 0.8 } = {}) { add(FOAM, x, z, r, grow, life, opacity); },
    /** A ripple ring from (x, z), starting at r m and running out at `speed` m/s for `life` s. */
    ring(x, z, r, { speed = 2, life = 6, opacity = 0.6 } = {}) { add(RING, x, z, r, speed, life, opacity); },
    update(dt) {
      mesh.count = used;
      for (let i = 0; i < used; i++) {
        const k = m[i];
        if (!k.live) { aFade[i] = 0; _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); continue; }
        k.age += dt;
        if (k.age >= k.life) { k.live = false; aFade[i] = 0; continue; }
        const r = k.r + k.grow * k.age, u = k.age / k.life;
        // Foam fades in over a fraction of a second and out over its life; a ring thins as it widens.
        aFade[i] = k.op * Math.min(1, k.age / 0.15) * (k.kind === FOAM ? (1 - u) ** 1.5 : (1 - u) ** 2);
        aWidth[i] = k.kind === RING ? Math.min(0.5, 0.6 / Math.max(r, 0.6)) : 0;
        const y = surfaceAt(k.x, k.z);
        if (y === null || y === undefined) { aFade[i] = 0; continue; }
        _p.set(k.x, y + 0.02, k.z); _q.setFromAxisAngle(_up, k.rot); _s.set(r, 1, r);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      mesh.instanceMatrix.needsUpdate = true;
      geo.attributes.aFade.needsUpdate = true;
      geo.attributes.aWidth.needsUpdate = true;
    },
    clear() { for (const k of m) k.live = false; for (let i = 0; i < max; i++) aFade[i] = 0; geo.attributes.aFade.needsUpdate = true; used = 0; next = 0; mesh.count = 0; },
    get live() { return m.reduce((n, k) => n + (k.live ? 1 : 0), 0); },
  };
}

/**
 * A vehicle going into the water at `speed` m/s along (dx, dz), `width` m wide, at (x, z) where the
 * surface is at `surf`: a crown of droplets and sheets thrown up and ahead (the vehicle's own spray
 * pool, `spray.emit(x, y, z, vx, vy, vz, surface, big)`), a ring and a foam patch.
 */
export function splashInto({ spray, marks, x, z, surf, speed, width = 2, dx = 1, dz = 0 }) {
  const v = Math.max(0, speed);
  if (v < 1) return 0;
  const n = Math.round(Math.min(500, 30 + v * width * 6));
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, out = (0.15 + 0.45 * Math.random()) * v * 0.35;
    const up = (0.35 + 0.65 * Math.random()) * Math.min(14, 1.5 + v * 0.45);
    const fwd = (0.2 + 0.6 * Math.random()) * v * 0.45;
    spray?.emit(x + (Math.random() - 0.5) * width, surf + 0.05, z + (Math.random() - 0.5) * width,
      dx * fwd + Math.cos(a) * out, up, dz * fwd + Math.sin(a) * out, surf, Math.random() < 0.25 ? 1 : 0);
  }
  const s = Math.min(3, 0.6 + v / 15);
  marks?.ring(x, z, width * 0.6, { speed: 1.5 + v * 0.06, life: 7, opacity: 0.55 * Math.min(1, 0.4 + v / 20) });
  marks?.ring(x, z, width * 0.4, { speed: 1.0 + v * 0.03, life: 9, opacity: 0.4 * Math.min(1, 0.4 + v / 20) });
  marks?.foam(x + dx * width * 0.3, z + dz * width * 0.3, width * s, { grow: 0.25, life: 12, opacity: 0.9 });
  return n;
}
