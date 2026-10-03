/**
 * What a crash throws about, shared by the drive and the flight: sparks off scraped metal,
 * fragments of bodywork and glass, the fireball and its smoke when an airplane's fuel goes up,
 * dust, and the water a heavy body throws up hitting it: fine spray and the heavier sheets. Points on ballistic paths: each kind
 * has its colour, its size and how it grows, the gravity and the drag it feels, and how long it
 * lives; fire and sparks add light, the rest is drawn over what is behind it. Sizes, speeds and
 * lifetimes are ≈ (the look of such things filmed, not a combustion or fracture model).
 */
import * as THREE from 'three';

const KINDS = {
  spark:  { add: true,  col: [1.0, 0.72, 0.32], size: [0.04, 0.03], grow: 0,    g: 1,     drag: 0.6, life: [0.35, 0.8], alpha: 1 },
  ember:  { add: true,  col: [1.0, 0.45, 0.12], size: [0.10, 0.08], grow: -0.2, g: 0.15,  drag: 1.2, life: [1.5, 3.0], alpha: 0.9 },
  fire:   { add: true,  col: [1.0, 0.55, 0.18], size: [2.2, 2.0],  grow: 2.2,  g: -0.35, drag: 1.8, life: [0.8, 1.8], alpha: 0.85 },
  smoke:  { add: false, col: [0.10, 0.10, 0.10], size: [2.0, 1.5], grow: 1.6,  g: -0.25, drag: 0.5, life: [6, 12],    alpha: 0.55 },
  dust:   { add: false, col: [0.55, 0.50, 0.42], size: [0.3, 0.3], grow: 1.0,  g: -0.02, drag: 1.5, life: [1.5, 3],   alpha: 0.18 },
  debris: { add: false, col: [0.08, 0.08, 0.09], size: [0.07, 0.10], grow: 0,  g: 1,     drag: 0.1, life: [3, 6],     alpha: 1, ground: true },
  paint:  { add: false, col: [0.85, 0.86, 0.88], size: [0.06, 0.08], grow: 0,  g: 1,     drag: 0.15, life: [3, 6],    alpha: 1, ground: true },
  glass:  { add: false, col: [0.75, 0.82, 0.85], size: [0.025, 0.03], grow: 0, g: 1,     drag: 0.2, life: [2, 4],     alpha: 0.8, ground: true },
  spray:  { add: false, col: [0.90, 0.93, 0.95], size: [0.10, 0.14], grow: 0.5, g: 1,     drag: 0.9, life: [1.0, 2.6], alpha: 0.85, water: true },
  splash: { add: false, col: [0.86, 0.90, 0.93], size: [0.5, 0.6],  grow: 1.6,  g: 1,     drag: 0.5, life: [1.2, 3.0], alpha: 0.45, water: true },
  mist:   { add: false, col: [0.90, 0.92, 0.94], size: [4.0, 3.0], grow: 1.5,  g: -0.02, drag: 1.0, life: [3, 7],     alpha: 0.3 },
};

function system(scene, max, additive, name) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    name, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
      void main() { vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * scale / max(0.5, -mv.z), 1.0, 512.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.18, r)); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.name = name; points.frustumCulled = false; points.renderOrder = 4; points.visible = false;
  scene.add(points);
  return { pos, col, size, alpha, geo, points, max, next: 0, live: new Uint8Array(max), vel: new Float32Array(max * 3), age: new Float32Array(max), life: new Float32Array(max), kind: new Array(max), s0: new Float32Array(max), floor: new Float32Array(max) };
}

/**
 * createEffects(scene) → { burst(kind, at, n, { vel, spread, up, floor }), update(dt), clear() }.
 * `at` a world point; `vel` the emitter's own velocity (inherited, ≈ half), `spread` the speed
 * of the scatter, `up` an upward kick; `floor` the height the ground-landing kinds stop at.
 */
export function createEffects(scene) {
  const S = { add: system(scene, 1500, true, 'fx-light'), norm: system(scene, 2500, false, 'fx-matter') };
  const rnd = (a, b) => a + (b - a) * Math.random();
  function burst(kind, at, n, { vel = null, spread = 3, up = 2, floor = -Infinity } = {}) {
    const K = KINDS[kind], P = K.add ? S.add : S.norm;
    for (let k = 0; k < n; k++) {
      const i = P.next; P.next = (P.next + 1) % P.max;
      // Isotropic scatter, flattened a little, with the upward kick.
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), sp = spread * Math.cbrt(Math.random());
      P.pos.set([at.x, at.y, at.z], i * 3);
      P.vel.set([(vel?.x ?? 0) * 0.5 + sp * Math.sin(ph) * Math.cos(th), (vel?.y ?? 0) * 0.5 + sp * Math.abs(Math.cos(ph)) * 0.7 + up * Math.random(), (vel?.z ?? 0) * 0.5 + sp * Math.sin(ph) * Math.sin(th)], i * 3);
      P.age[i] = 0; P.life[i] = rnd(...K.life); P.kind[i] = K; P.live[i] = 1;
      P.s0[i] = K.size[0] + K.size[1] * Math.random(); P.floor[i] = floor;
      const j = 0.85 + 0.3 * Math.random();
      P.col.set([K.col[0] * j, K.col[1] * j, K.col[2] * j], i * 3);
    }
    P.points.visible = true;
  }
  function step(P, dt) {
    let any = false;
    for (let i = 0; i < P.max; i++) {
      if (!P.live[i]) continue;
      const K = P.kind[i];
      P.age[i] += dt;
      const t = P.age[i] / P.life[i];
      if (t >= 1) { P.live[i] = 0; P.alpha[i] = 0; continue; }
      any = true;
      const o = i * 3, k = Math.exp(-K.drag * dt);
      P.vel[o] *= k; P.vel[o + 2] *= k; P.vel[o + 1] = P.vel[o + 1] * k - 9.81 * K.g * dt;
      P.pos[o] += P.vel[o] * dt; P.pos[o + 1] += P.vel[o + 1] * dt; P.pos[o + 2] += P.vel[o + 2] * dt;
      if (P.pos[o + 1] < P.floor[i]) {
        if (K.water) { P.live[i] = 0; P.alpha[i] = 0; continue; }
        // Fragments come to rest on the ground; sparks bounce once and die there.
        P.pos[o + 1] = P.floor[i]; P.vel[o + 1] = K.ground ? 0 : -P.vel[o + 1] * 0.3; P.vel[o] *= 0.4; P.vel[o + 2] *= 0.4;
      }
      P.size[i] = P.s0[i] * Math.max(0.05, 1 + K.grow * Math.sqrt(t) * 3);
      // Fire: yellow-white to dark red as it burns out.
      if (K === KINDS.fire) { P.col[o + 1] = K.col[1] * (1 - 0.7 * t); P.col[o + 2] = K.col[2] * (1 - t); }
      P.alpha[i] = K.alpha * Math.min(1, P.age[i] * 10) * (K.ground ? 1 - Math.max(0, t - 0.8) * 5 : 1 - t);
    }
    P.points.visible = any;
    for (const a of ['position', 'color', 'size', 'alpha']) P.geo.attributes[a].needsUpdate = true;
  }
  return {
    burst,
    update(dt) { if (dt > 0) { step(S.add, dt); step(S.norm, dt); } },
    clear() { for (const P of [S.add, S.norm]) { P.live.fill(0); P.alpha.fill(0); P.points.visible = false; } },
  };
}
