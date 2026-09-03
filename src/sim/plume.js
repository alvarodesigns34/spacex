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
    float a = uAlpha * pow(safeAxis, uFalloff) * pow(safeFace, 0.7) * uOpacity;
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
  constructor({ radius, seaLevelLength = 10.5, name = 'plume' }) {
    this.radius = radius;
    this.baseLength = seaLevelLength * radius;
    this.group = new THREE.Group();
    this.group.name = name;
    this.group.visible = false;

    // Bright shock core, then the wide envelope of afterburning around it.
    this.core = coneLayer({ hot: 0xfffaea, warm: 0xffa442, cool: 0x5b7bd6, alpha: 0.95, falloff: 1.2 });
    this.shroud = coneLayer({ hot: 0xffdcb0, warm: 0xd68038, cool: 0x2b3a70, alpha: 0.38, falloff: 1.8 });
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

  // Multi-lobed organic cumulus core: provides true billowing clumps rather than flat circles
  const lobes = [
    { x: 0.0, y: 0.0, r: 0.50, w: 1.0 },
    { x: -0.22, y: -0.14, r: 0.38, w: 0.88 },
    { x: 0.24, y: -0.12, r: 0.36, w: 0.85 },
    { x: 0.20, y: 0.18, r: 0.35, w: 0.82 },
    { x: -0.19, y: 0.20, r: 0.36, w: 0.80 },
    { x: 0.02, y: 0.26, r: 0.33, w: 0.76 },
    { x: -0.04, y: -0.26, r: 0.34, w: 0.78 },
    { x: 0.30, y: 0.02, r: 0.32, w: 0.72 },
  ];

  const dens = new Float32Array(size * size);
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
        if (dist < lb.r) {
          const lAlpha = 1.0 - dist / lb.r;
          d += lb.w * (lAlpha * lAlpha * (3.0 - 2.0 * lAlpha));
        }
      }
      d = Math.min(1.0, d);

      // Multi-scale harmonic billow noise for fine steam filament turbulence
      const a1 = Math.sin(x * 0.10 + Math.cos(y * 0.08) * 2.2);
      const a2 = Math.sin(y * 0.16 + Math.cos(x * 0.13) * 1.8);
      const a3 = Math.sin((x + y) * 0.22);
      const noise = 0.80 + 0.12 * a1 + 0.06 * a2 + 0.02 * a3;

      const edge = Math.max(0.0, 1.0 - r);
      dens[y * size + x] = Math.min(1.0, Math.max(0.0, d * noise * Math.pow(edge, 1.2)));
    }
  }

  // Pre-bake tangent normal map (R, G, B) and volumetric density (A)
  for (let y = 0; y < size; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(size - 1, y + 1);
    for (let x = 0; x < size; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(size - 1, x + 1);
      const dVal = dens[y * size + x];
      const dx = (dens[y * size + x1] - dens[y * size + x0]) * 3.5;
      const dy = (dens[y1 * size + x] - dens[y0 * size + x]) * 3.5;
      const len = Math.hypot(dx, dy, 1.0);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1.0 / len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(nz * 255);
      data[idx + 3] = Math.round(Math.min(1.0, dVal * 2.2) * 255);
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
  varying float vRot;
  uniform float uFlame;

  void main() {
    vUv = uv;
    vRot = aRot;
    vec3 c = (modelViewMatrix * vec4(aOffset, 1.0)).xyz;
    float s = sin(aRot), k = cos(aRot);
    vec2 q = vec2(position.x * k - position.y * s, position.x * s + position.y * k) * aSize;

    // Soft camera fade so nearby puffs never clip into the near frustum
    vAlpha = aAlpha * smoothstep(1.5, 16.0, -c.z);

    // Fire illumination: intense strictly near the two bidirectional trench mouths (|Z| ~ 44m, Y < 18m)
    float dFlame = length(vec3(aOffset.x * 2.0, max(0.0, aOffset.y - 3.0) * 2.2, max(0.0, abs(aOffset.z) - 38.0) * 0.9));
    float heightFade = smoothstep(24.0, 2.0, aOffset.y);
    vFire = uFlame * smoothstep(52.0, 5.0, dFlame) * heightFade;

    gl_Position = projectionMatrix * vec4(c + vec3(q, 0.0), 1.0);
  }`;

const CLOUD_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunColor;
  uniform vec3 uShadowColor;
  uniform vec3 uFireColor;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vFire;
  varying float vRot;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float a = tex.a * vAlpha;
    if (a < 0.003) discard;

    // Unpack normal map from RG channels
    vec2 rawNorm = tex.rg * 2.0 - 1.0;
    float nz = tex.b;

    // Rotate normal by billow rotation vRot
    float s = sin(vRot), k = cos(vRot);
    vec2 rotatedNorm = vec2(rawNorm.x * k - rawNorm.y * s, rawNorm.x * s + rawNorm.y * k);
    vec3 normView = normalize(vec3(rotatedNorm, nz));

    // Directional sunlight diffuse with wrap-around lighting for translucent water droplets
    float NdotL = dot(normView, uSunDir);
    float wrap = clamp((NdotL + 0.45) / 1.45, 0.0, 1.0);

    // Ambient skylight in crevice shadows to bright direct sunlight on outer lobes
    vec3 steam = mix(uShadowColor, uSunColor, wrap);

    // Warm incandescent amber/golden fire illumination from the 33 Raptors hitting the trench
    vec3 fireGlow = uFireColor * (1.15 + 0.35 * wrap);
    vec3 col = mix(steam, fireGlow, clamp(vFire * 1.15, 0.0, 1.0));

    // Extra incandescence right at the mouths
    col += uFireColor * (vFire * vFire * 0.45);

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

const _sunDir = new THREE.Vector3();

/**
 * The steam, deluge spray and dust that leaves the flame trench.
 * Bidirectional: exhausted strictly along the trench axis (±Z).
 */
export class GroundCloud {
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
        uSunColor: { value: new THREE.Color(0xffffff) },
        uShadowColor: { value: new THREE.Color(0x8294a6) },
        uFireColor: { value: new THREE.Color(0xff9922) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
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

  /** Spawns `n` puffs from one of the trench mouths. */
  emit(n, origin, dir, speed, spread) {
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
      this.vel[j] = (r() - 0.5) * speed * 0.32;
      this.vel[j + 1] = dir[1] * s + r() * speed * 0.22 + 2.5;
      this.vel[j + 2] = dir[2] * s + (r() - 0.5) * speed * 0.12;

      this.age[i] = 0;
      this.life[i] = 8 + r() * 12;
      this.size[i] = 14 + r() * 10;
      this.rot[i] = r() * Math.PI * 2;
      this.rotSpeed[i] = (r() - 0.5) * 0.35;
    }
  }

  update(dt, camera, sun) {
    if (camera && sun) {
      if (sun.target) {
        _sunDir.subVectors(sun.position, sun.target.position).normalize();
      } else {
        _sunDir.copy(sun.position).normalize();
      }
      _sunDir.transformDirection(camera.matrixWorldInverse);
      this.points.material.uniforms.uSunDir.value.copy(_sunDir);
    }
    const { pos, vel, age, life, size, alpha, rot, rotSpeed } = this;
    for (let i = 0; i < this.count; i++) {
      if (age[i] >= life[i]) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      age[i] += dt;
      if (age[i] >= life[i]) { alpha[i] = 0; size[i] = 0; continue; }
      const j = i * 3;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;

      // Keep puffs above ground surface
      if (pos[j + 1] < 1.2) pos[j + 1] = 1.2;

      // Ground friction and aerodynamic deceleration
      const kH = Math.exp(-dt * 0.58);
      vel[j] *= kH; vel[j + 2] *= kH;
      // Thermal buoyancy: hot steam mushrooms up into the sky
      vel[j + 1] = vel[j + 1] * Math.exp(-dt * 0.45) + 3.6 * dt;

      rot[i] += rotSpeed[i] * dt;

      const u = age[i] / life[i];
      // Massive billowing expansion: starts at 14 m, rolls into 90-135 m thunderhead plumes
      size[i] = (14.0 + u * 85.0) * (1.0 + (i % 5) * 0.18);
      // High volumetric density with smooth atmospheric decay
      const fadeIn = Math.min(1.0, u * 8.0);
      const fadeOut = Math.pow(Math.max(0.0, 1.0 - u), 1.3);
      alpha[i] = 0.92 * fadeIn * fadeOut;
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
