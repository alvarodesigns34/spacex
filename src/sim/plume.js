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
  varying float vRad;
  void main() {
    float v = 1.0 - uv.y;                      // 0 at the nozzle plane, 1 at the tail
    vAxis = v;
    vRad = length(position.xz);
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
  uniform float uAlpha, uFalloff, uDiamond, uOpacity, uDiamondN, uTime, uGain;
  varying float vAxis;
  varying float vFace;
  varying float vRad;
  void main() {
    float v = clamp(vAxis, 0.0, 1.0);
    vec3 c = v < 0.35 ? mix(uHot, uWarm, v / 0.35) : mix(uWarm, uCool, (v - 0.35) / 0.65);
    // Shock diamonds sit on the axis. A sine along v alone paints stripes down the
    // cone; gating it by radius turns each node into a disc that fades outward.
    float node = pow(max(abs(sin(v * uDiamondN)), 1e-4), 16.0);
    node *= smoothstep(0.48, 0.02, vRad);
    float shock = 1.0 + uDiamond * node * (1.0 - v * 0.5);
    // Shear-layer billow, stronger off the axis so the column is not a stack of stripes.
    float shear = smoothstep(0.12, 0.9, vRad);
    float turb = 1.0
      + shear * 0.18 * sin(v * 15.0 + vRad * 8.0 + uTime * 2.2)
      + shear * 0.10 * sin(v * 37.0 - vRad * 21.0 + uTime * 4.7);
    c *= turb;
    float core = exp(-vRad * vRad * 3.6) * exp(-v * 1.45);
    c = mix(c, uHot, clamp(core * 0.75, 0.0, 1.0));
    // The throat itself is the brightest thing in the scene: a short, near-white region right
    // at the exit plane that the rest of the column falls away from.
    float throat = 1.0 + 2.6 * exp(-v * 16.0) * exp(-vRad * vRad * 5.5);
    float safeFace = max(vFace, 1e-4);
    float safeAxis = max(1.0 - v, 1e-4);
    // A gentle falloff. At 1.2 the column was down to nothing within a fifth of its length and
    // discarded the rest, so 33 Raptors rendered as a 7 m pilot light hanging under a 72 m
    // booster — the single reason the launch did not read as powerful.
    float a = uAlpha * pow(safeAxis, uFalloff) * pow(safeFace, 0.62) * uOpacity;
    a *= 1.0 + 0.45 * node;
    // Deterministic billow. uTime is mission time, so a seek reproduces the same frame.
    a *= 1.0 + 0.07 * sin(v * 46.0 + uTime * 6.0) * smoothstep(0.08, 0.35, v);
    if (a < 0.0015 || a != a) discard;
    gl_FragColor = vec4(c * shock * throat * uGain, clamp(a, 0.0, 1.0));
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
      uDiamond: { value: 0 }, uDiamondN: { value: 14.14 },
      uOpacity: { value: 1 }, uSpread: { value: 1 }, uTime: { value: 0 }, uGain: { value: 1 },
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
    // The core ends in a dull orange, not blue: mixed with the warm band a blue tail went
    // lavender-pink, and no photograph of a Raptor landing burn shows a pink flame.
    this.core = coneLayer({ hot: 0xfffaea, warm: 0xffa442, cool: 0xb4643a, alpha: 0.98, falloff: 0.55 });
    this.shroud = coneLayer({ hot: 0xffe0b0, warm: 0xa86830, cool: 0x3d4038, alpha: 0.36, falloff: 1.05 });
    // Outer density: soot and cooled exhaust. Wide, dim, and gone once the flow is
    // a vacuum bell. It does not write depth, so the vehicle stays visible through it.
    this.veil = coneLayer({ hot: 0xffe2c0, warm: 0x8a5a32, cool: 0x5c564e, alpha: 0.18, falloff: 1.2 });
    // The core is an emitter, not a tint: a sea-level Raptor column photographs saturated white
    // against a bright sky, and at 1.0 an additive layer over a pale sky only lifted it to a
    // pinkish cream. In HDR it clips to white and blooms, as in the photographs.
    this.core.material.uniforms.uGain.value = 2.6;
    this.shroud.material.uniforms.uGain.value = 1.4;
    this.group.add(this.veil, this.shroud, this.core);
    this.time = 0;

    // The plume is by far the brightest thing in the scene; it has to light the pad.
    this.light = new THREE.PointLight(0xffb066, 0, 260, 2);
    this.light.name = `${name}-light`;
    this.group.add(this.light);

    this.setThrottle(0, 0);
  }

  /**
   * @param {number} throttle 0..1 of rated thrust
   * @param {number} altitude metres, which sets how far the exhaust is allowed to expand
   * @param {number} [spread] the lit engines' share of the cluster radius: 1 with every
   *   engine running, less when only an inner ring is lit, so a shutdown to the centre three
   *   narrows the column instead of only dimming it
   */
  setThrottle(throttle, altitude, spread = 1) {
    const on = throttle > 0.001;
    this.group.visible = on;
    if (!on) { this.light.intensity = 0; return; }
    const p = pressureRatio(altitude);
    // Over-expanded and stubby at the pad; wide and long once there is nothing to push back.
    const stretch = 1 + 3.4 * (1 - p);
    const t = 0.5 + 0.5 * throttle;
    const r = this.radius * spread;
    // Length follows the lit radius less than width does: fewer engines make a thinner column
    // before they make a shorter one.
    const len = this.baseLength * (0.55 + 0.45 * spread);
    const rc = r * 0.82;
    this.core.scale.set(rc, len * stretch * t, rc);
    const rs = r * 1.34;
    this.shroud.scale.set(rs, len * stretch * 1.45 * t, rs);
    const rv = r * (1.7 + 1.4 * (1 - p));
    this.veil.scale.set(rv, len * stretch * 1.7 * t, rv);
    this.veil.material.uniforms.uSpread.value = 1 + 6.5 * (1 - p);
    this.veil.material.uniforms.uOpacity.value = 0.15 + 0.85 * p;
    for (const layer of [this.core, this.shroud, this.veil]) layer.material.uniforms.uTime.value = this.time;
    this.core.material.uniforms.uSpread.value = 1 + 2.4 * (1 - p);
    this.shroud.material.uniforms.uSpread.value = 1 + 5.2 * (1 - p);
    this.core.material.uniforms.uDiamond.value = 2.15 * p;
    // Node spacing follows the expansion: tight, repeated cells while the flow is squeezed
    // back by sea-level pressure, stretching out and dying as the atmosphere thins.
    this.core.material.uniforms.uDiamondN.value = 6.0 + 14.0 * p;
    // Dense and bright in the lower atmosphere, where the exhaust is still optically thick.
    this.core.material.uniforms.uOpacity.value = 0.78 + 0.22 * p;
    this.shroud.material.uniforms.uOpacity.value = 0.66 + 0.34 * (1 - p);
    // 8,240 tf lights the pad. The old value lit a room.
    this.light.intensity = 4200 * throttle * (0.35 + 0.65 * p);
    this.light.distance = 260 + 420 * (1 - p);
    // The light belongs in the column, not at the nozzle: at the nozzle it lit the engine
    // bay and nothing else, and the deck below stayed in shadow through liftoff.
    this.light.position.y = -this.baseLength * 0.22 * (1 + 3.4 * (1 - p)) * t;
  }

  /** Mission clock, in seconds. Turbulence is a function of this, not of wall time. */
  setTime(t) { this.time = t; }

  dispose() {
    for (const m of [this.core, this.shroud, this.veil]) { m.geometry.dispose(); m.material.dispose(); }
  }
}

// -----------------------------------------------------------------------------------------
//  Engine jets
// -----------------------------------------------------------------------------------------
/**
 * One short jet per engine, hanging from its own exit plane, instanced. The cluster column
 * (Plume) is what a wide shot shows; this is what a close one does. Every photograph of a
 * Starship liftoff taken near the pad shows the engines as individual bright jets for the
 * first few metres, each with its own train of Mach diamonds, before they merge. Without them
 * the base of the booster sat over a single glow.
 *
 * Instances are ordered by lighting group (centre 3, then the inner 10, then the outer 20), so
 * "which engines are running" is just the draw count.
 */
const JET_VERT = /* glsl */`
  uniform float uLength, uSpread, uP;
  varying float vAxis, vFace, vRad;
  void main() {
    float v = -position.y;                              // 0 at the exit plane, 1 at the tail
    vAxis = v;
    vRad = length(position.xz);
    // Over-expanded at sea level: the jet necks in after the exit before it spreads. At
    // altitude it opens straight away.
    float neck = 1.0 - 0.18 * uP * sin(3.14159 * clamp(v * 1.6, 0.0, 1.0));
    float w = neck * mix(1.0, uSpread, smoothstep(0.1, 1.0, v));
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position.x * w, position.y * uLength, position.z * w, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * vec3(normal.x, 0.0, normal.z) + vec3(1e-5));
    vFace = clamp(abs(dot(n, normalize(-mv.xyz))), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;
const JET_FRAG = /* glsl */`
  uniform vec3 uHot, uWarm, uTail;
  uniform float uOpacity, uP, uTime, uGain;
  varying float vAxis, vFace, vRad;
  void main() {
    float v = clamp(vAxis, 0.0, 1.0);
    vec3 c = v < 0.3 ? mix(uHot, uWarm, v / 0.3) : mix(uWarm, uTail, (v - 0.3) / 0.7);
    // Mach diamonds: bright nodes on the axis, spaced along the jet, only where the ambient
    // pressure is there to reflect the shocks.
    float node = pow(max(abs(sin(v * 3.14159 * 4.5)), 1e-4), 14.0) * smoothstep(0.7, 0.05, vRad) * uP;
    c *= 1.0 + 2.2 * node * (1.0 - v);
    float a = uOpacity * pow(max(1.0 - v, 1e-4), 1.35) * pow(max(vFace, 1e-4), 0.8);
    a *= 1.0 + 0.6 * node;
    a *= 1.0 + 0.08 * sin(v * 40.0 + uTime * 9.0);
    // Near-white where it leaves the bell.
    c *= 1.0 + 1.8 * exp(-v * 9.0);
    if (a < 0.002) discard;
    gl_FragColor = vec4(c * uGain, clamp(a, 0.0, 1.0));
  }`;

export class EngineJets {
  /**
   * @param {object} o
   * @param {Array<{position:number[], radius:number}>} o.engines exit planes, in lighting order
   * @param {number} o.seaLevelLength jet length at sea level, in exit radii
   */
  constructor({ engines, seaLevelLength = 11, name = 'engine-jets' }) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 16, true);
    geo.translate(0, -0.5, 0);
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uHot: { value: lin(0xfff4dc) }, uWarm: { value: lin(0xffb259) }, uTail: { value: lin(0xff6a2e) },
        uLength: { value: 1 }, uSpread: { value: 1 }, uP: { value: 1 },
        uOpacity: { value: 1 }, uTime: { value: 0 }, uGain: { value: 1.25 },
      },
      vertexShader: JET_VERT, fragmentShader: JET_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, engines.length);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.meanR = engines.reduce((s, e) => s + e.radius, 0) / engines.length;
    const m = new THREE.Matrix4();
    engines.forEach((e, i) => {
      // Unit length along the jet; the shader stretches it, so all jets share one length
      // measured in the cluster's mean exit radius.
      m.compose(new THREE.Vector3(...e.position), new THREE.Quaternion(), new THREE.Vector3(e.radius, 1, e.radius));
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.seaLevelLength = seaLevelLength;
    this.total = engines.length;
    this.setState(0, 0, 0);
  }

  /**
   * @param {number} throttle 0..1 per engine
   * @param {number} altitude m
   * @param {number} lit how many engines, in lighting order, are running
   */
  setState(throttle, altitude, lit) {
    const on = throttle > 0.01 && lit > 0;
    this.mesh.visible = on;
    if (!on) return;
    this.mesh.count = Math.min(this.total, Math.max(0, Math.round(lit)));
    const p = pressureRatio(altitude);
    const u = this.material.uniforms;
    u.uP.value = p;
    // Short and tight at the pad, long and open once the air thins.
    u.uLength.value = this.meanR * this.seaLevelLength * (1 + 2.2 * (1 - p)) * (0.6 + 0.4 * throttle);
    u.uSpread.value = 1.15 + 2.4 * (1 - p);
    u.uOpacity.value = (0.55 + 0.45 * throttle) * 0.7;
  }

  setTime(t) { this.material.uniforms.uTime.value = t; }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
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
    // Lit by the plume in HDR, so the near side of the cloud glows past white and blooms the
    // way it does in photographs of the liftoff, instead of settling on beige.
    // Graded, not flat: the glow falls off with vFire squared, so the cloud goes from lit
    // orange low down to its own sunlit grey-white above, as in photographs, instead of one
    // saturated yellow wall.
    vec3 fireGlow = uFireColor * (1.25 + 0.4 * wrap);
    vec3 col = mix(steam, fireGlow, clamp(vFire * vFire * 1.2, 0.0, 1.0));
    col += uFireColor * (vFire * vFire * vFire * 0.9);

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

const _sunDir = new THREE.Vector3();

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
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.map = puffTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.map },
        // Steam, not dust: the deluge turns the trench cloud into water vapour, sunlit white with
        // cool grey hollows. The old tan pair made it read as a sandstorm.
        uSunColor: { value: new THREE.Color(0xf2f0ec) },
        uShadowColor: { value: new THREE.Color(0x8c9199) },
        uFireColor: { value: new THREE.Color(0xff8a2a) },
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

  reset(rng = this.rng) {
    this.rng = rng;
    for (let i = 0; i < this.count; i++) {
      this.age[i] = 1; this.life[i] = 1; this.alpha[i] = 0; this.size[i] = 0;
      this.pos[i * 3] = 0; this.pos[i * 3 + 1] = -9999; this.pos[i * 3 + 2] = 0;
      this.rotSpeed[i] = 0; this.grow[i] = 0; this.base[i] = 0;
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
  emit(n, origin, dir, speed, spread, { size0 = 14, grow = 85, life0 = 8, lifeVar = 12 } = {}) {
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
      this.vel[j + 1] = dir[1] * s + r() * speed * 0.22 + 2.5;
      this.vel[j + 2] = dir[2] * s + (r() - 0.5) * speed * 0.12;

      this.age[i] = 0;
      this.life[i] = life0 + r() * lifeVar;
      this.size[i] = size0 + r() * (size0 * 0.7);
      this.grow[i] = grow;
      this.base[i] = size0;
      this.rot[i] = r() * Math.PI * 2;
      this.rotSpeed[i] = (r() - 0.5) * 0.35;
      if (i + 1 > (this.live ?? 0)) this.live = i + 1;
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
    const { pos, vel, age, life, size, alpha, rot, rotSpeed, grow, base } = this;
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
      const kH = Math.exp(-dt * 0.58);
      vel[j] *= kH; vel[j + 2] *= kH;
      // Thermal buoyancy: hot steam mushrooms up into the sky
      vel[j + 1] = vel[j + 1] * Math.exp(-dt * 0.45) + 5.2 * dt;

      rot[i] += rotSpeed[i] * dt;

      const u = age[i] / life[i];
      // Billowing expansion, at the rate this puff was emitted with.
      size[i] = (base[i] + u * grow[i]) * (1.0 + (i % 5) * 0.18);
      // High volumetric density with smooth atmospheric decay
      const fadeIn = Math.min(1.0, u * 8.0);
      const fadeOut = Math.pow(Math.max(0.0, 1.0 - u), 1.3);
      alpha[i] = 0.88 * fadeIn * fadeOut;
    }
    this.live = hi + 1;
    this.flush();
  }

  /**
   * Uploads and draws only the slots that hold something. `live` is a high-water mark rather
   * than a count, because the ring wraps and the live set is not contiguous from zero — but it
   * is always contained in [0, live), which is enough to bound both costs.
   */
  flush() {
    const n = this.live ?? this.count;
    for (const a of [this.aOffset, this.aSize, this.aAlpha, this.aRot]) {
      a.clearUpdateRanges();
      if (n > 0) a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
    this.points.geometry.instanceCount = n;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.map.dispose();
  }
}

// -----------------------------------------------------------------------------------------
//  Vapour: cryogenic venting, deluge spray
// -----------------------------------------------------------------------------------------
/**
 * White vapour that is a function of mission time alone, so a seek lands on the same frame as
 * playback. Each puff belongs to an emitter with an active window; its age is the time since
 * it was (re)spawned on a fixed cycle, and it only shows if its spawn time fell inside the
 * window. Covers what the pad does with no fire involved:
 *  - boil-off venting from the loaded vehicle in the terminal count — the white plumes that
 *    stream off a fuelled Starship and sink along its sides, because the vapour is colder
 *    and denser than the air;
 *  - the deluge: water driven up through the mount's steel plate at ignition, flashed to
 *    spray and steam round the engines;
 *  - venting from the booster once it is back on the arms.
 */
const VAPOR_VERT = /* glsl */`
  attribute vec3 aOrigin;
  attribute vec3 aVel;
  attribute vec4 aParams;   // phase 0..1, life s, start size m, growth m/s
  attribute vec2 aWindow;   // emitter active from, to (mission s)
  uniform float uTime, uTau, uOpacity;
  uniform vec3 uAccel;
  varying vec2 vUv;
  varying float vAlpha, vRot;
  void main() {
    vUv = uv;
    float life = aParams.y;
    float age = mod(uTime - aWindow.x + aParams.x * life, life);
    float born = uTime - age;
    float on = step(aWindow.x, born) * step(born, aWindow.y);
    float k = age / life;
    // Launched fast, slowed by drag, then carried by buoyancy / sinking and the wind.
    vec3 p = aOrigin + aVel * uTau * (1.0 - exp(-age / uTau)) + 0.5 * uAccel * age * age;
    float size = aParams.z + aParams.w * age;
    vAlpha = on * uOpacity * smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.45, 1.0, k));
    vRot = aParams.x * 6.2832 + age * 0.35 * (aParams.x - 0.5);
    vec3 c = (modelViewMatrix * vec4(p, 1.0)).xyz;
    float s = sin(vRot), q = cos(vRot);
    vec2 d = vec2(position.x * q - position.y * s, position.x * s + position.y * q) * size;
    vAlpha *= smoothstep(1.0, 8.0, -c.z);
    gl_Position = projectionMatrix * vec4(c + vec3(d, 0.0), 1.0);
  }`;
const VAPOR_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunDir, uSun, uShade;
  varying vec2 vUv;
  varying float vAlpha, vRot;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float a = t.a * vAlpha;
    if (a < 0.004) discard;
    vec2 n2 = t.rg * 2.0 - 1.0;
    float s = sin(vRot), k = cos(vRot);
    vec3 n = normalize(vec3(n2.x * k - n2.y * s, n2.x * s + n2.y * k, max(t.b, 0.2)));
    float wrap = clamp((dot(n, uSunDir) + 0.5) / 1.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(uShade, uSun, wrap), clamp(a, 0.0, 1.0));
  }`;

let _vaporMap = null;
export class Vapor {
  /**
   * @param {object} o
   * @param {Array} o.emitters [{ at:[x,y,z], dir:[x,y,z], speed, spread, count, life, size, grow, window:[t0,t1] }]
   * @param {number[]} o.accel constant acceleration (buoyancy, sinking, wind), m/s²
   */
  constructor({ emitters, rng, accel = [0.6, -0.4, 0.2], tau = 1.2, opacity = 0.55, name = 'vapor' }) {
    const n = emitters.reduce((s, e) => s + e.count, 0);
    const origin = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    const params = new Float32Array(n * 4), win = new Float32Array(n * 2);
    let i = 0;
    const v = new THREE.Vector3();
    for (const e of emitters) {
      const dir = new THREE.Vector3(...e.dir).normalize();
      for (let k = 0; k < e.count; k++, i++) {
        const jitter = e.jitter ?? 0.3;
        origin.set([e.at[0] + (rng() - 0.5) * jitter, e.at[1] + (rng() - 0.5) * jitter, e.at[2] + (rng() - 0.5) * jitter], i * 3);
        v.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(2 * (e.spread ?? 0.4)).add(dir).normalize()
          .multiplyScalar(e.speed * (0.7 + 0.6 * rng()));
        vel.set([v.x, v.y, v.z], i * 3);
        params.set([k / e.count + rng() * (0.5 / e.count), e.life * (0.8 + 0.4 * rng()), e.size * (0.7 + 0.6 * rng()), e.grow * (0.7 + 0.6 * rng())], i * 4);
        win.set(e.window, i * 2);
      }
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    geo.setIndex([0, 2, 1, 2, 3, 1]);
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
    geo.setAttribute('aVel', new THREE.InstancedBufferAttribute(vel, 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
    geo.setAttribute('aWindow', new THREE.InstancedBufferAttribute(win, 2));
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    _vaporMap ??= puffTexture();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: _vaporMap }, uTime: { value: -1e4 }, uTau: { value: tau }, uOpacity: { value: opacity },
        uAccel: { value: new THREE.Vector3(...accel) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
        uSun: { value: new THREE.Color(0xf6f6f4) }, uShade: { value: new THREE.Color(0x959ba4) },
      },
      vertexShader: VAPOR_VERT, fragmentShader: VAPOR_FRAG,
      transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.windows = emitters.map(e => e.window);
    this.maxLife = Math.max(...emitters.map(e => e.life * 1.2));
  }

  /** Mission time; hidden outright when no emitter can have a live puff. */
  update(t, camera, sun) {
    this.material.uniforms.uTime.value = t;
    this.mesh.visible = this.windows.some(([a, b]) => t >= a && t <= b + this.maxLife);
    if (this.mesh.visible && camera && sun) {
      _sunDir.subVectors(sun.position, sun.target ? sun.target.position : _zero).normalize();
      this.material.uniforms.uSunDir.value.copy(_sunDir.transformDirection(camera.matrixWorldInverse));
    }
  }

  hide() { this.mesh.visible = false; }
}
const _zero = new THREE.Vector3();

// -----------------------------------------------------------------------------------------
//  Condensation collar (transonic / Max-Q)
// -----------------------------------------------------------------------------------------
/**
 * The white collar that forms round a launch vehicle through the transonic regime and Max-Q:
 * the pressure drop behind a shoulder condenses the humid air into a sheath of cloud that
 * trails back from it. On Starship it forms at the hot-stage ring and the ship's aft flaps.
 * A cone of translucent white, streaked along its length and flickering, trailing back from
 * `y` over `length` metres. Opacity is driven by the sequence; nothing here knows the clock.
 */
const COLLAR_VERT = /* glsl */`
  varying vec2 vUv;
  varying float vFace;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFace = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;
const COLLAR_FRAG = /* glsl */`
  uniform float uOpacity, uTime;
  varying vec2 vUv;
  varying float vFace;
  void main() {
    float v = vUv.y;                         // 1 at the shoulder, 0 at the tail
    // Soft, uneven sheath rather than speed lines: broad lobes round the circumference with a
    // little fine streaking along the flow.
    float lobes = 0.7 + 0.3 * sin(vUv.x * 18.85 + sin(vUv.x * 6.28 * 3.0) * 1.5 + uTime * 1.5);
    float streak = lobes * (0.85 + 0.15 * sin(vUv.x * 70.0 - uTime * 4.0 + v * 7.0));
    float a = uOpacity * pow(v, 1.3) * smoothstep(1.0, 0.92, v) * streak * (0.5 + 0.5 * vFace);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(0.97, 0.975, 0.98), clamp(a, 0.0, 1.0));
  }`;

export class CondensationCollar {
  constructor({ radius, spread = 7, length = 26, y = 0, name = 'condensation-collar' }) {
    const g = new THREE.CylinderGeometry(radius + 0.4, radius + spread, length, 64, 8, true);
    g.translate(0, y - length / 2, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: COLLAR_VERT, fragmentShader: COLLAR_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = name;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  set(opacity, t) {
    this.mesh.visible = opacity > 0.01;
    this.material.uniforms.uOpacity.value = opacity;
    this.material.uniforms.uTime.value = t;
  }
}
