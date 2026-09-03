/**
 * Exhaust plumes and the ground cloud.
 *
 * What is modelled, and why it looks the way it does:
 *
 *  - A methalox Raptor plume is nearly transparent. What the camera sees is the bright,
 *    over-expanded shock structure near the nozzle and a much fainter, wider envelope of
 *    afterburning around it, not the opaque orange column a kerosene engine gives.
 *  - The shape is set by ambient pressure. At sea level the exhaust is over-expanded, so it
 *    is short, narrow, and shows a train of Mach diamonds where the shocks reflect. As the
 *    ambient pressure falls the flow no longer has anything to push against and the plume
 *    balloons into a wide, smooth bell many times the vehicle's diameter. Getting that
 *    transition right is the single detail that separates a launch that reads as real from
 *    one that does not, so the geometry is driven by p(h)/p0 rather than by a timeline.
 *  - The barometric ratio uses the standard exponential approximation p/p0 = exp(-h/H) with
 *    a scale height H = 7 500 m; below ~30 km that is within a few per cent of the standard
 *    atmosphere, which is well inside what any of this can claim.
 *
 * Everything here is additive and writes no depth, so plumes never occlude the vehicle.
 */
import * as THREE from 'three';

const SCALE_HEIGHT = 7500;
/** Ambient pressure as a fraction of sea level. */
export const pressureRatio = (h) => Math.exp(-Math.max(h, 0) / SCALE_HEIGHT);

// -----------------------------------------------------------------------------------------
//  Plume cone
// -----------------------------------------------------------------------------------------
const PLUME_VERT = /* glsl */`
  uniform float uSpread;
  varying float vAxis;
  varying float vFace;
  void main() {
    float v = 1.0 - uv.y;                      // 0 at the nozzle plane, 1 at the tail
    vAxis = v;
    // The plume leaves the nozzle at the nozzle's own radius and only then blooms, so the
    // bloom is a profile along the axis rather than a fixed cone angle. A fixed cone would
    // put a wide disc right at the engines, which is what a stock cone gets wrong.
    float w = mix(1.0, uSpread, smoothstep(0.0, 0.45, v)) * (1.0 - 0.4 * smoothstep(0.7, 1.0, v));
    vec3 p = vec3(position.x * w, position.y, position.z * w);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 norm = normalMatrix * vec3(normal.x, normal.y / max(uSpread, 1.0), normal.z);
    vec3 n = length(norm) > 1e-4 ? normalize(norm) : vec3(0.0, 1.0, 0.0);
    float mvLen = length(mv.xyz);
    vec3 viewDir = mvLen > 1e-4 ? -mv.xyz / mvLen : vec3(0.0, 0.0, 1.0);
    // A plume is a volume, not a shell. Weighting by how squarely the surface faces the
    // camera approximates the path length a ray takes through it: brightest through the
    // middle, falling to nothing at the silhouette. Without this the cone shows a hard
    // bright rim, which is the single thing that makes a rendered plume look like a cone.
    vFace = clamp(abs(dot(n, viewDir)), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;
const PLUME_FRAG = /* glsl */`
  uniform vec3 uHot, uWarm, uCool;
  uniform float uAlpha, uFalloff, uDiamond, uOpacity;
  varying float vAxis;
  varying float vFace;
  void main() {
    float v = clamp(vAxis, 0.0, 1.0);
    vec3 c = v < 0.35 ? mix(uHot, uWarm, v / 0.35) : mix(uWarm, uCool, (v - 0.35) / 0.65);
    // Shock train: only meaningful while the flow is over-expanded, so uDiamond is driven
    // by ambient pressure at run time.
    float shock = 1.0 + uDiamond * pow(max(abs(sin(v * 14.14)), 1e-4), 6.0) * (1.0 - v);
    float safeFace = max(vFace, 1e-4);
    float safeAxis = max(1.0 - v, 1e-4);
    float a = uAlpha * pow(safeAxis, uFalloff) * pow(safeFace, 1.4) * uOpacity;
    if (a < 0.002 || a != a) discard;
    gl_FragColor = vec4(c * shock, clamp(a, 0.0, 1.0));
  }`;

/**
 * One layer of a plume: a unit tube hanging from the nozzle plane down −Y, whose radial
 * profile is shaped in the vertex shader so the same geometry serves both the stubby
 * sea-level plume and the ballooned vacuum one.
 */
function coneLayer({ hot, warm, cool, alpha, falloff }) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 34, 26, true);
  g.translate(0, -0.5, 0);
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: lin(hot) }, uWarm: { value: lin(warm) }, uCool: { value: lin(cool) },
      uAlpha: { value: alpha }, uFalloff: { value: falloff },
      uDiamond: { value: 0 }, uOpacity: { value: 1 }, uSpread: { value: 1 },
    },
    vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

/**
 * A plume attached to one engine cluster. `radius` is the radius of the cluster's exit
 * plane: the individual nozzles merge into a single column within a couple of metres, so one
 * cone per cluster is both cheaper and closer to what a photograph shows than 33 cones.
 */
export class Plume {
  constructor({ radius, seaLevelLength = 6.0, name = 'plume' }) {
    this.radius = radius;
    this.baseLength = seaLevelLength * radius;
    this.group = new THREE.Group();
    this.group.name = name;
    this.group.visible = false;

    // Bright shock core, then the faint wide envelope of afterburning around it.
    this.core = coneLayer({ hot: 0xfff6ea, warm: 0xffa851, cool: 0x5b7bd6, alpha: 0.85, falloff: 1.7 });
    this.shroud = coneLayer({ hot: 0xffdcb0, warm: 0xc9803f, cool: 0x2b3a70, alpha: 0.26, falloff: 2.5 });
    this.group.add(this.shroud, this.core);

    // The plume is by far the brightest thing in the scene; it has to light the pad.
    this.light = new THREE.PointLight(0xffb066, 0, 260, 2);
    this.light.name = `${name}-light`;
    this.group.add(this.light);

    this.setThrottle(0, 0);
  }

  /**
   * @param {number} throttle 0..1 of rated thrust
   * @param {number} altitude metres, which sets how far the exhaust is allowed to expand
   */
  setThrottle(throttle, altitude) {
    const on = throttle > 0.001;
    this.group.visible = on;
    if (!on) { this.light.intensity = 0; return; }
    const p = pressureRatio(altitude);
    // Over-expanded and stubby at the pad; wide and long once there is nothing to push back.
    const stretch = 1 + 3.4 * (1 - p);
    const t = 0.5 + 0.5 * throttle;
    const rc = this.radius * 0.82;
    this.core.scale.set(rc, this.baseLength * stretch * t, rc);
    const rs = this.radius * 1.04;
    this.shroud.scale.set(rs, this.baseLength * stretch * 1.3 * t, rs);
    this.core.material.uniforms.uSpread.value = 1 + 2.4 * (1 - p);
    this.shroud.material.uniforms.uSpread.value = 1 + 5.2 * (1 - p);
    this.core.material.uniforms.uDiamond.value = 0.75 * p;
    this.core.material.uniforms.uOpacity.value = 0.45 + 0.55 * p;
    this.shroud.material.uniforms.uOpacity.value = 0.5 + 0.5 * (1 - p);
    this.light.intensity = 900 * throttle * (0.35 + 0.65 * p);
    this.light.distance = 120 + 260 * (1 - p);
  }

  dispose() {
    for (const m of [this.core, this.shroud]) { m.geometry.dispose(); m.material.dispose(); }
  }
}

// -----------------------------------------------------------------------------------------
//  Ground cloud
// -----------------------------------------------------------------------------------------
function puffTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const half = size / 2;

  // Multi-lobed cumulus core: gives non-spherical, organic clump structure
  const lobes = [
    { x: 0, y: 0, r: 0.48, w: 1.0 },
    { x: -0.16, y: -0.12, r: 0.38, w: 0.85 },
    { x: 0.18, y: -0.14, r: 0.36, w: 0.80 },
    { x: 0.20, y: 0.15, r: 0.34, w: 0.75 },
    { x: -0.18, y: 0.16, r: 0.35, w: 0.78 },
    { x: 0.02, y: 0.22, r: 0.32, w: 0.70 },
  ];

  for (let y = 0; y < size; y++) {
    const ny = (y - half) / half;
    for (let x = 0; x < size; x++) {
      const nx = (x - half) / half;
      const r = Math.hypot(nx, ny);
      if (r >= 1.0) continue;

      let d = 0;
      for (let k = 0; k < lobes.length; k++) {
        const lb = lobes[k];
        const dist = Math.hypot(nx - lb.x, ny - lb.y);
        const lAlpha = Math.max(0, 1 - dist / lb.r);
        d += lb.w * (lAlpha * lAlpha * (3 - 2 * lAlpha));
      }
      d = Math.min(1.0, d);

      // Multi-frequency harmonic billow noise for fibrous steam wisps
      const a1 = Math.sin(x * 0.12 + Math.cos(y * 0.09) * 2.0);
      const a2 = Math.sin(y * 0.18 + Math.cos(x * 0.15) * 1.5);
      const a3 = Math.sin((x + y) * 0.25);
      const noise = 0.78 + 0.14 * a1 + 0.08 * a2 + 0.04 * a3;

      // Soft rim falloff: smooth erosion near edge
      const edge = Math.max(0, 1 - r);
      const alpha = Math.min(1, Math.max(0, d * noise * Math.pow(edge, 1.4)));
      const coreDensity = Math.round(210 + 45 * Math.max(0, 1 - r * 1.2));

      const idx = (y * size + x) * 4;
      data[idx] = coreDensity;
      data[idx + 1] = coreDensity;
      data[idx + 2] = coreDensity;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const CLOUD_VERT = /* glsl */`
  attribute vec3 aOffset;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vFire;
  uniform float uFlame;
  void main() {
    vUv = uv;
    vec3 c = (modelViewMatrix * vec4(aOffset, 1.0)).xyz;
    float s = sin(aRot), k = cos(aRot);
    vec2 q = vec2(position.x * k - position.y * s, position.x * s + position.y * k) * aSize;
    // Fade out smoothly if approaching near plane or camera position
    vAlpha = aAlpha * smoothstep(1.0, 14.0, -c.z);
    // Fire illumination is intense near the flame trench deflectors and pad base (Y < 18m):
    float dFlame = length(vec3(aOffset.x * 1.5, max(0.0, aOffset.y - 4.0) * 2.2, aOffset.z * 0.6));
    float heightFade = smoothstep(22.0, 2.0, aOffset.y);
    vFire = uFlame * smoothstep(65.0, 8.0, dFlame) * heightFade;
    gl_Position = projectionMatrix * vec4(c + vec3(q, 0.0), 1.0);
  }`;

const CLOUD_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform vec3 uFireColor;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vFire;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float a = tex.a * vAlpha;
    if (a < 0.003) discard;
    // Clean daylight water steam with internal density shading
    float dens = tex.r / 255.0;
    vec3 steam = uColor * (0.88 + 0.12 * dens);
    // Warm incandescent amber/golden fire illumination from below
    vec3 fireGlow = uFireColor * (1.1 + 0.4 * dens);
    vec3 col = mix(steam, fireGlow, clamp(vFire * 0.85, 0.0, 1.0));
    gl_FragColor = vec4(col, a);
  }`;

/**
 * The steam, deluge spray and dust that leaves the flame trench.
 * Deterministic: the same seed produces the same cloud on every run.
 */
export class GroundCloud {
  constructor({ count = 720, rng = Math.random } = {}) {
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
    this.next = 0;

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
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.map = puffTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.map },
        uColor: { value: new THREE.Color(0xf2efe9).convertSRGBToLinear() },
        uFireColor: { value: new THREE.Color(0xffb255).convertSRGBToLinear() },
        uFlame: { value: 0.0 },
      },
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
      transparent: true, depthWrite: false, side: THREE.FrontSide,
    });
    this.points = new THREE.Mesh(geo, mat);
    this.points.name = 'ground-cloud';
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.reset();
  }

  setFlame(intensity) {
    this.points.material.uniforms.uFlame.value = intensity;
  }

  reset() {
    for (let i = 0; i < this.count; i++) {
      this.age[i] = 1; this.life[i] = 1; this.alpha[i] = 0; this.size[i] = 0;
      this.pos[i * 3] = 0; this.pos[i * 3 + 1] = -9999; this.pos[i * 3 + 2] = 0;
      this.rotSpeed[i] = 0;
    }
    this.points.material.uniforms.uFlame.value = 0.0;
    this.next = 0;
    this.flush();
  }

  /** Spawns `n` puffs from one of the trench mouths or pad zones. */
  emit(n, origin, dir, speed, spread) {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.count;
      const j = i * 3;
      this.pos[j] = origin[0] + (r() - 0.5) * spread;
      this.pos[j + 1] = Math.max(1.2, origin[1] + (r() - 0.2) * spread * 0.3);
      this.pos[j + 2] = origin[2] + (r() - 0.5) * spread;
      const s = speed * (0.5 + r() * 0.85);
      this.vel[j] = dir[0] * s + (r() - 0.5) * speed * 0.4;
      this.vel[j + 1] = dir[1] * s + r() * speed * 0.28 + 2.0;
      this.vel[j + 2] = dir[2] * s + (r() - 0.5) * speed * 0.4;
      this.age[i] = 0;
      this.life[i] = 7 + r() * 11;
      this.size[i] = 7 + r() * 9;
      this.rot[i] = r() * Math.PI * 2;
      this.rotSpeed[i] = (r() - 0.5) * 0.32;
    }
  }

  update(dt) {
    const { pos, vel, age, life, size, alpha, rot, rotSpeed } = this;
    for (let i = 0; i < this.count; i++) {
      if (age[i] >= life[i]) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      age[i] += dt;
      if (age[i] >= life[i]) { alpha[i] = 0; size[i] = 0; continue; }
      const j = i * 3;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      // Keep puffs above the ground surface
      if (pos[j + 1] < 1.0) pos[j + 1] = 1.0;

      // Aerodynamic drag on horizontal motion + thermal buoyancy
      const k = Math.exp(-dt * 0.72);
      vel[j] *= k; vel[j + 2] *= k;
      vel[j + 1] = vel[j + 1] * k + 2.2 * dt;

      rot[i] += rotSpeed[i] * dt;

      const u = age[i] / life[i];
      // Billowing expansion from trench exit (8-16m) up to massive rolling cloud (48-80m)
      size[i] = (8 + u * 48) * (1 + (i % 4) * 0.2);
      // Smooth fade-in and long natural atmospheric decay
      const fadeIn = Math.min(1.0, u * 5.0);
      const fadeOut = Math.max(0.0, 1.0 - u);
      alpha[i] = 0.56 * fadeIn * Math.pow(fadeOut, 1.5);
    }
    this.flush();
  }

  flush() {
    this.aOffset.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aRot.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.map.dispose();
  }
}
