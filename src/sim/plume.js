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
    vec3 n = normalize(normalMatrix * vec3(normal.x, normal.y / max(uSpread, 1.0), normal.z));
    // A plume is a volume, not a shell. Weighting by how squarely the surface faces the
    // camera approximates the path length a ray takes through it: brightest through the
    // middle, falling to nothing at the silhouette. Without this the cone shows a hard
    // bright rim, which is the single thing that makes a rendered plume look like a cone.
    vFace = abs(dot(n, normalize(-mv.xyz)));
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
    float shock = 1.0 + uDiamond * pow(abs(sin(v * 14.14)), 6.0) * (1.0 - v);
    float a = uAlpha * pow(1.0 - v, uFalloff) * pow(vFace, 1.4) * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(c * shock, a);
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
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  for (let j = 0; j < 128; j++) {
    for (let i = 0; i < 128; i++) {
      const dx = (i - 63.5) / 63.5, dy = (j - 63.5) / 63.5;
      const r = Math.hypot(dx, dy);
      // Soft-edged blob with a little internal structure so a cluster does not read as
      // a field of identical circles.
      const n = 0.82 + 0.18 * Math.sin(i * 0.42) * Math.cos(j * 0.37);
      const a = Math.max(0, 1 - r) ** 2.1 * n;
      const k = (j * 128 + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const CLOUD_VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (420.0 / max(-mv.z, 1.0));
    gl_Position = projectionMatrix * mv;
  }`;
const CLOUD_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

/**
 * The steam and dust that leaves the flame trench. Deterministic: the same seed produces the
 * same cloud on every run, which is what lets the headless check compare frames at all.
 */
export class GroundCloud {
  constructor({ count = 3600, rng = Math.random } = {}) {
    this.count = count;
    this.rng = rng;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.next = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.map = puffTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.map },
        // The composer renders linear and converts at the end, so the tint goes in linear.
        uColor: { value: new THREE.Color(0xe6e3da).convertSRGBToLinear() },
      },
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.name = 'ground-cloud';
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.reset();
  }

  reset() {
    for (let i = 0; i < this.count; i++) {
      this.age[i] = 1; this.life[i] = 1; this.alpha[i] = 0; this.size[i] = 0;
      this.pos[i * 3 + 1] = -9999;
    }
    this.next = 0;
    this.flush();
  }

  /** Spawns `n` puffs from one of the trench mouths, blown outward along its axis. */
  emit(n, origin, dir, speed, spread) {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.count;
      const j = i * 3;
      this.pos[j] = origin[0] + (r() - 0.5) * spread;
      this.pos[j + 1] = origin[1] + r() * spread * 0.35;
      this.pos[j + 2] = origin[2] + (r() - 0.5) * spread;
      const s = speed * (0.45 + r() * 0.9);
      this.vel[j] = dir[0] * s + (r() - 0.5) * speed * 0.45;
      this.vel[j + 1] = dir[1] * s + r() * speed * 0.35 + 2.5;
      this.vel[j + 2] = dir[2] * s + (r() - 0.5) * speed * 0.45;
      this.age[i] = 0;
      this.life[i] = 7 + r() * 9;
      this.size[i] = 12 + r() * 26;
    }
  }

  update(dt) {
    const { pos, vel, age, life, size, alpha } = this;
    for (let i = 0; i < this.count; i++) {
      if (age[i] >= life[i]) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      age[i] += dt;
      const j = i * 3;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      // Drag plus a little buoyancy: steam rises as it slows.
      const k = Math.exp(-dt * 0.55);
      vel[j] *= k; vel[j + 2] *= k;
      vel[j + 1] = vel[j + 1] * k + 3.4 * dt;
      const u = age[i] / life[i];
      size[i] = (12 + u * 74) * (1 + i % 3 * 0.2);
      alpha[i] = 0.62 * Math.min(1, u * 7) * (1 - u) ** 1.35;
    }
    this.flush();
  }

  flush() {
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aSize.needsUpdate = true;
    this.points.geometry.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.map.dispose();
  }
}
