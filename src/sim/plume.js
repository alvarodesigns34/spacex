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
import { fbm } from '../materials/textures.js';

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
  uniform float uAlpha, uFalloff, uDiamond, uOpacity, uDiamondN, uTime, uGain, uOcclude;
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
    a = clamp(a, 0.0, 1.0);
    // Premultiplied: the colour is light the flame emits, the alpha is how much of what is
    // behind it the flame hides. With uOcclude 0 this is plain additive blending.
    gl_FragColor = vec4(c * shock * throat * uGain * a, a * uOcclude);
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
      uOcclude: { value: 0 },
    },
    vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    // Emission plus a share of occlusion (see uOcclude): purely additive, a sea-level plume
    // over a bright sky could only lift it, and 33 Raptors read as a pale pink streak.
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
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

    // Bright shock core, then the wide envelope of afterburning around it.
    // The core ends in a dull orange, not blue: mixed with the warm band a blue tail went
    // lavender-pink, and no photograph of a Raptor landing burn shows a pink flame.
    // Golden-white at the engines to orange down the column, as the liftoff photographs show
    // it; the old brown-pink tail went lavender over a blue sky.
    // Warm and tail went further to yellow: under ACES at the scene's exposure the old 0xffb84a
    // column came out salmon-pink, where every liftoff photograph has it yellow-white.
    this.core = coneLayer({ hot: 0xfff6e0, warm: 0xffd98a, cool: 0xffa24a, alpha: 0.98, falloff: 0.6 });
    this.shroud = coneLayer({ hot: 0xffe0b0, warm: 0xc8762e, cool: 0x4a4038, alpha: 0.36, falloff: 1.05 });
    // Outer density: soot and cooled exhaust. Wide, dim, and gone once the flow is
    // a vacuum bell. It does not write depth, so the vehicle stays visible through it.
    this.veil = coneLayer({ hot: 0xffe2c0, warm: 0x8a5a32, cool: 0x5c564e, alpha: 0.18, falloff: 1.2 });
    // The core is an emitter, not a tint: a sea-level Raptor column photographs saturated white
    // against a bright sky, and at 1.0 an additive layer over a pale sky only lifted it to a
    // pinkish cream. In HDR it clips to white and blooms, as in the photographs.
    this.core.material.uniforms.uGain.value = 3.4;
    this.shroud.material.uniforms.uGain.value = 1.5;
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
    // The group stays visible and only the cones hide: the light has to be in the scene all
    // the time, at zero when the engines are off. How many lights a scene has is part of
    // every lit material's shader, so a light that appeared with the group at ignition made
    // all of them recompile at once — 25 programs, a stall at the moment of liftoff.
    for (const layer of [this.core, this.shroud, this.veil]) layer.visible = on;
    if (!on) { this.light.intensity = 0; return; }
    const p = pressureRatio(altitude);
    // Over-expanded and stubby at the pad; wide and long once there is nothing to push back.
    // At 60 km a booster's plume is a translucent bell several hundred metres long and many
    // times its own width (flight footage from the ascent's last minute).
    const stretch = 1 + 4.2 * (1 - p);
    const t = 0.5 + 0.5 * throttle;
    const r = this.radius * spread;
    // Length follows the lit radius less than width does: fewer engines make a thinner column
    // before they make a shorter one.
    const len = this.baseLength * (0.55 + 0.45 * spread);
    // The merged column leaves the cluster a little wider than the cluster: 33 jets side by
    // side, each opening out as it leaves its bell.
    const rc = r * 0.98;
    this.core.scale.set(rc, len * stretch * t, rc);
    const rs = r * 1.55;
    this.shroud.scale.set(rs, len * stretch * 1.45 * t, rs);
    const rv = r * (1.7 + 1.4 * (1 - p));
    this.veil.scale.set(rv, len * stretch * 1.7 * t, rv);
    this.veil.material.uniforms.uSpread.value = 1 + 6.5 * (1 - p);
    this.veil.material.uniforms.uOpacity.value = 0.15 + 0.85 * p;
    for (const layer of [this.core, this.shroud, this.veil]) layer.material.uniforms.uTime.value = this.time;
    this.core.material.uniforms.uSpread.value = 1 + 2.4 * (1 - p);
    this.shroud.material.uniforms.uSpread.value = 1 + 6.4 * (1 - p);
    this.core.material.uniforms.uDiamond.value = 2.15 * p;
    // Node spacing follows the expansion: tight, repeated cells while the flow is squeezed
    // back by sea-level pressure, stretching out and dying as the atmosphere thins.
    this.core.material.uniforms.uDiamondN.value = 6.0 + 14.0 * p;
    // Dense and bright in the lower atmosphere, where the exhaust is still optically thick.
    this.core.material.uniforms.uOpacity.value = 0.78 + 0.22 * p;
    // Optically thick low down, where it hides the sky behind it; a thin glow in vacuum.
    this.core.material.uniforms.uOcclude.value = 0.62 * p;
    // Brightest where the exhaust is optically thick: at sea level the column clips to white
    // against the sky; in vacuum the same gain would turn a faint bell into a searchlight.
    this.core.material.uniforms.uGain.value = 3.4 + 3.6 * p;
    this.shroud.material.uniforms.uGain.value = 1.5 + 0.9 * p;
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
      // measured in the cluster's mean exit radius. A jet hangs down −Y unless `direction`
      // points it elsewhere (the hot-stage vents blow out sideways).
      const q = e.direction
        ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...e.direction).normalize())
        : new THREE.Quaternion();
      m.compose(new THREE.Vector3(...e.position), q, new THREE.Vector3(e.radius, 1, e.radius));
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
//  Fireball glow
// -----------------------------------------------------------------------------------------
/**
 * A camera-facing burst of light: the fireball where the ship's six engines light inside the
 * vented ring at hot-staging, before the gap opens. The flame through the vents is jets; what
 * the long lenses on the ground see is one blinding ball round the interstage, turbulent at its
 * edge, that swells for a second and fades as the stages part. HDR and additive, so it blooms.
 */
const GLOW_VERT = /* glsl */`
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv - 0.5;
    vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * vec4(c.xyz + vec3(position.xy * uSize, 0.0), 1.0);
  }`;
const GLOW_FRAG = /* glsl */`
  uniform vec3 uColor, uEdge;
  uniform float uIntensity, uTime;
  varying vec2 vUv;
  void main() {
    float r = length(vUv) * 2.0;
    float a = atan(vUv.y, vUv.x);
    // Ragged edge: lobes that turn with time, so the ball boils rather than sits as a disc.
    float edge = 0.78 + 0.1 * sin(a * 7.0 + uTime * 5.0) + 0.07 * sin(a * 13.0 - uTime * 8.0);
    float k = 1.0 - smoothstep(0.0, edge, r);
    float core = exp(-r * r * 9.0);
    vec3 c = mix(uEdge, uColor, clamp(core * 1.4, 0.0, 1.0)) * (k * k + 2.5 * core);
    float i = uIntensity * k;
    if (i < 0.002) discard;
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }`;

export class Glow {
  constructor({ color = 0xfff1d6, edge = 0xff7a26, name = 'glow' } = {}) {
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: lin(color) }, uEdge: { value: lin(edge) }, uIntensity: { value: 0 }, uSize: { value: 1 }, uTime: { value: 0 } },
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** @param intensity HDR multiplier, 0 hides it  @param size metres across  @param t mission s */
  set(intensity, size, t) {
    this.mesh.visible = intensity > 0.002;
    this.material.uniforms.uIntensity.value = intensity;
    this.material.uniforms.uSize.value = size;
    this.material.uniforms.uTime.value = t;
  }
}

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
function puffTexture() { return (_puffTex ??= buildPuffTexture()); }
function buildPuffTexture() {
  const cell = 192, cells = 4, size = cell * cells;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const rng = (() => { let x = 0x9e3779b9; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const dens = new Float32Array(cell * cell);
  // The relief the normals come from: the density before its edge is sharpened, blurred. Taken
  // from the sharpened density, every contour became a steep step and the shading drew a dark
  // crease along each one.
  const relief = new Float32Array(cell * cell), tmp = new Float32Array(cell * cell);
  for (let v = 0; v < cells * cells; v++) {
    const ox = (v % cells) * cell, oy = Math.floor(v / cells) * cell;
    // A main mass, off centre by a little, then mid lobes and small turrets, weighted to the
    // upper half (the sunlit top of a puff is where it boils; underneath it is flatter).
    const lean = (rng() - 0.5) * 0.16;
    const lobes = [{ x: lean, y: 0.0, r: 0.4 + rng() * 0.06, w: 0.85 }];
    const mid = 9 + Math.floor(rng() * 6);
    for (let k = 0; k < mid; k++) {
      const a = rng() * Math.PI * 2, d = 0.26 + rng() * 0.24;
      lobes.push({ x: Math.cos(a) * d + lean, y: Math.sin(a) * d * 0.9 + 0.04, r: 0.2 + rng() * 0.14, w: 0.8 + rng() * 0.3 });
    }
    const small = 10 + Math.floor(rng() * 14);
    for (let k = 0; k < small; k++) {
      const a = rng() * Math.PI * 2, d = 0.44 + rng() * 0.26;
      // Turrets cluster on the upper edge.
      const yy = Math.sin(a) * d;
      if (yy < -0.2 && rng() < 0.6) continue;
      lobes.push({ x: Math.cos(a) * d * 0.95 + lean, y: yy, r: 0.07 + rng() * 0.08, w: 0.8 + rng() * 0.3 });
    }
    const seed = v * 37.1;
    for (let y = 0; y < cell; y++) {
      // Canvas y runs down; the puff is built with +y up so "top" means the sunlit side.
      const ny = -(y - cell / 2) / (cell / 2);
      for (let x = 0; x < cell; x++) {
        const nx = (x - cell / 2) / (cell / 2);
        const r = Math.hypot(nx, ny);
        let d = 0;
        for (const lb of lobes) {
          const q = Math.hypot(nx - lb.x, ny - lb.y) / lb.r;
          if (q < 1) { const t = 1 - q; d += lb.w * t * t * (3 - 2 * t); }
        }
        // Turrets below the lobe scale: fractal noise at two frequencies.
        const turb = (fbm(nx * 4.2 + seed, ny * 4.2 - seed, 5, 2.1, 0.55) - 0.5)
          + 0.25 * (fbm(nx * 11 - seed, ny * 11 + seed, 3, 2.0, 0.5) - 0.5);
        d = d * 1.2 + turb * 0.8;
        const edge = 1 - THREE.MathUtils.smoothstep(r, 0.82, 0.99);
        dens[y * cell + x] = THREE.MathUtils.clamp(THREE.MathUtils.smoothstep(d, 0.12, 0.5) * edge, 0, 1);
        relief[y * cell + x] = THREE.MathUtils.clamp(d, 0, 1.4) * edge;
      }
    }
    // Two box-blur passes (±3 px), separable.
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        let a = 0, n = 0;
        for (let k = -3; k <= 3; k++) { const xx = x + k; if (xx >= 0 && xx < cell) { a += relief[y * cell + xx]; n++; } }
        tmp[y * cell + x] = a / n;
      }
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        let a = 0, n = 0;
        for (let k = -3; k <= 3; k++) { const yy = y + k; if (yy >= 0 && yy < cell) { a += tmp[yy * cell + x]; n++; } }
        relief[y * cell + x] = a / n;
      }
    }
    for (let y = 0; y < cell; y++) {
      const y0 = Math.max(0, y - 2), y1 = Math.min(cell - 1, y + 2);
      for (let x = 0; x < cell; x++) {
        const x0 = Math.max(0, x - 2), x1 = Math.min(cell - 1, x + 2);
        const dx = (relief[y * cell + x1] - relief[y * cell + x0]) * 3.0;
        const dy = (relief[y1 * cell + x] - relief[y0 * cell + x]) * 3.0;
        const len = Math.hypot(dx, dy, 1);
        const i = ((oy + y) * size + ox + x) * 4;
        data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
        data[i + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round(255 / len);
        data[i + 3] = Math.round(dens[y * cell + x] * 255);
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
const ATLAS_UV = /* glsl */`
  float puffHash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
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
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vAlpha;
  varying float vFire;
  varying float vRot;
  varying float vShade;
  varying float vDust;
  varying float vAge;
  uniform float uFlame;

  void main() {
    vUv = atlasUv(uv, gl_InstanceID);
    vLocal = uv;
    vRot = aRot;
    vAge = aExtra.x;
    vDust = aExtra.y;
    // Self-shadowing a billboard cannot compute: the lower a puff sits in the mass, the more
    // cloud there is between it and the sky, so the base of a launch cloud is a darker grey
    // under sunlit turrets — the contrast that makes the Flight 12 clouds read as towers.
    vShade = mix(0.42, 1.08, smoothstep(4.0, 90.0, aOffset.y + aSize * 0.3));
    vec3 c = (modelViewMatrix * vec4(aOffset, 1.0)).xyz;
    float s = sin(aRot), k = cos(aRot);
    // Aspect, area-preserving: steam a little taller than wide, dust spread flat.
    vec2 p = position.xy * vec2(sqrt(aExtra.z), 1.0 / sqrt(aExtra.z));
    vec2 q = vec2(p.x * k - p.y * s, p.x * s + p.y * k) * aSize;

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

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    // The edge is eaten away as the puff ages: the density threshold rises, so the thin
    // turrets go first and the puff frays into wisps, instead of every outline fading evenly.
    float th = 0.02 + 0.28 * pow(vAge, 2.5);
    float dens = smoothstep(th, th + 0.42, tex.a);
    float a = dens * vAlpha;
    if (a < 0.003) discard;

    vec2 rawNorm = tex.rg * 2.0 - 1.0;
    float nz = tex.b;
    float s = sin(vRot), k = cos(vRot);
    vec2 rotatedNorm = vec2(rawNorm.x * k - rawNorm.y * s, rawNorm.x * s + rawNorm.y * k);
    vec3 normView = normalize(vec3(rotatedNorm, nz));

    // Wrapped diffuse for a translucent mass.
    float NdotL = dot(normView, uSunDir);
    float wrap = clamp((NdotL + 0.25) / 1.25, 0.0, 1.0);
    // The thin fringe of a puff is lit through, not shaded: its normal is steep there, and
    // taking it at face value drew a dark pen line round every turret.
    wrap = mix(0.8, wrap, smoothstep(0.08, 0.55, tex.a));
    // Underside of each puff darker than its top, within the puff as well as across the mass.
    float under = mix(0.72, 1.0, smoothstep(0.15, 0.75, vLocal.y));

    vec3 steam = mix(uShadowColor, uSunColor, wrap * wrap * (3.0 - 2.0 * wrap)) * vShade * under;
    // Dust: the brown haze the blast raises off the pad and the flats, which in the Flight 12
    // photographs spreads low between and under the two white steam towers. Duller, browner,
    // and less lit by the sun (it is optically thin: the sky shows through it).
    vec3 dust = mix(vec3(0.34, 0.29, 0.24), vec3(0.72, 0.62, 0.5), wrap) * mix(0.85, 1.0, vShade);
    vec3 base = mix(steam, dust, vDust);

    // Lit by the plume in HDR, graded so the cloud goes from orange low down to its own
    // sunlit colour above, as in photographs, instead of one saturated wall.
    vec3 fireGlow = uFireColor * (1.25 + 0.4 * wrap);
    vec3 col = mix(base, fireGlow, clamp(vFire * vFire * 1.2, 0.0, 1.0));
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
    // Per puff, drawn at emission and fixed for its life: a size factor (the old
    // `(i % 5) * 0.18` gave every fifth slot the same size, a pattern the eye picks up along a
    // jet), an opacity, and what it is made of — 0 steam, 1 dust.
    this.sizeK = new Float32Array(count);
    this.opac = new Float32Array(count);
    this.kind = new Float32Array(count);
    // Shader inputs that change: age fraction, kind, and the puff's aspect (width/height).
    this.extra = new Float32Array(count * 3);
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
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.map = puffTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.map },
        // Steam, not dust: the deluge turns the trench cloud into water vapour, sunlit white with
        // cool grey hollows. The old tan pair made it read as a sandstorm.
        uSunColor: { value: new THREE.Color(0xfbf9f4) },
        uShadowColor: { value: new THREE.Color(0x67635c) },
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
      this.kind[i] = kind;
      // Steam: mostly dense, some thin. Dust: a translucent haze, which is how the brown sheet
      // between the two trench clouds reads in the Flight 12 photographs.
      this.opac[i] = kind === 1 ? 0.3 + r() * 0.2 : 0.78 + r() * 0.2;
      // Width over height. Steam near round (stretched tall, puffs read as balloons); dust flat.
      this.extra[i * 3 + 2] = kind === 1 ? 1.5 + r() * 0.9 : 0.92 + r() * 0.3;
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
      const fadeIn = Math.min(1.0, u * 8.0);
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
    this.flush();
  }

  /**
   * Uploads and draws only the slots that hold something. `live` is a high-water mark rather
   * than a count, because the ring wraps and the live set is not contiguous from zero — but it
   * is always contained in [0, live), which is enough to bound both costs.
   */
  flush() {
    const n = this.live ?? this.count;
    for (const a of [this.aOffset, this.aSize, this.aAlpha, this.aRot, this.aExtra]) {
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
  ${ATLAS_UV}
  attribute vec3 aOrigin;
  attribute vec3 aVel;
  attribute vec4 aParams;   // phase 0..1, life s, start size m, growth m/s
  attribute vec2 aWindow;   // emitter active from, to (mission s)
  uniform float uTime, uTau, uOpacity;
  uniform vec3 uAccel;
  varying vec2 vUv;
  varying float vAlpha, vRot;
  void main() {
    vUv = atlasUv(uv, gl_InstanceID);
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
    wrap = mix(0.82, wrap, smoothstep(0.08, 0.55, t.a));
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
    // Under the plumes, like the ground cloud: the deluge spray round the engines would
    // otherwise paint over the jets it surrounds.
    this.mesh.renderOrder = 1;
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

// -----------------------------------------------------------------------------------------
//  The Earth below, for the high part of the flight
// -----------------------------------------------------------------------------------------
/**
 * Above a few kilometres the 5 km ground disc is a coin under the vehicle and the frame was
 * dark navy to the edges. From 80 km the horizon is 1 000 km away and dips 9° below level: a
 * curved, sunlit Earth with a blue limb over it, which is what every onboard view shows.
 * This is that: a sphere of the Earth's real radius under the camera, with generic ocean,
 * land and cloud from 3D noise on the sphere — illustrative, like the Roadster's orbital
 * backdrop, not a map — lit by the scene's sun, hazing to sky-blue towards the horizon, and
 * a limb shell of scattered light round it. Faded in from 9 to 20 km.
 */
const EARTH_R = 6371000;
const EARTH_VERT = /* glsl */`
  uniform vec3 uCentre;
  varying vec3 vN, vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(w.xyz - uCentre);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const EARTH_FRAG = /* glsl */`
  uniform vec3 uSun, uCam, uCentre;
  uniform float uOpacity;
  varying vec3 vN, vW;
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.07; a *= 0.5; } return s; }
  void main() {
    vec3 n = normalize(vN);
    float land = fbm3(n * 9.0 + 3.1) - 0.56;
    float cloud = smoothstep(0.52, 0.72, fbm3(n * 22.0 + vec3(7.0, 1.0, 4.0)));
    vec3 ocean = vec3(0.02, 0.09, 0.2);
    vec3 ground = mix(vec3(0.16, 0.18, 0.1), vec3(0.34, 0.3, 0.2), fbm3(n * 40.0));
    vec3 c = land > 0.0 ? ground : ocean;
    c = mix(c, vec3(0.86, 0.88, 0.9), cloud * 0.85);
    float diff = max(dot(n, uSun), 0.0);
    c *= 0.08 + 1.1 * diff;
    // Haze from the air between the camera and the ground: a plane-parallel air mass, the
    // vertical optical depth (≈0,35 for a clear coastal sky, scaled by the share of the
    // atmosphere below the camera, 8,5 km scale height) over the cosine of the view angle.
    // Towards the horizon the path is hundreds of kilometres of air and the ground vanishes
    // into it, as it does in every photograph from altitude; straight down it is a veil.
    vec3 v = normalize(uCam - vW);
    float mu = clamp(dot(n, v), 0.0, 1.0);
    float camH = max(length(uCam - uCentre) - ${EARTH_R.toFixed(1)}, 0.0);
    float tau = 0.35 * (1.0 - exp(-camH / 8500.0));
    float haze = 1.0 - exp(-tau / max(mu, 0.035));
    c = mix(c, vec3(0.52, 0.66, 0.88) * (0.3 + 0.9 * diff), haze);
    gl_FragColor = vec4(c, uOpacity);
  }`;
const LIMB_FRAG = /* glsl */`
  uniform vec3 uCam, uCentre, uSun;
  uniform float uOpacity;
  varying vec3 vN, vW;
  // Analytic limb: the glow along each view ray goes as the air column at the ray's closest
  // approach to the Earth, exp(-(r_min - R) / H). That is a thin bright band hugging the
  // horizon from any altitude, whatever the shell's tessellation. Rays that hit the ground
  // are the globe's; here they fade out just below the tangent.
  void main() {
    vec3 o = uCam - uCentre;
    vec3 d = normalize(vW - uCam);
    float tc = dot(-o, d);
    float rmin = tc > 0.0 ? length(cross(o, d)) : length(o);
    float hmin = rmin - ${EARTH_R.toFixed(1)};
    // Two layers: the dense bright line (H ≈ 7 km) and the fainter blue that climbs a few
    // tens of kilometres above it in every photograph from these altitudes.
    float hp = max(hmin, 0.0);
    float a = (0.85 * exp(-hp / 7000.0) + 0.4 * exp(-hp / 30000.0)) * smoothstep(-6000.0, 0.0, hmin);
    vec3 p = normalize(o + d * max(tc, 0.0));
    float lit = smoothstep(-0.25, 0.3, dot(p, uSun));
    a *= lit * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(mix(vec3(0.3, 0.5, 1.0), vec3(0.78, 0.88, 1.0), clamp(a, 0.0, 1.0)) * a * 1.1, a);
  }`;

/**
 * The visible part of the Earth as a cap around the point under the camera, out to 25° of
 * arc — past the horizon from any altitude the sequence reaches (14° at 200 km). A plain
 * 192 × 96 sphere put 208 km facets across the view, 850 m below the true surface at their
 * middles: from 24 km the horizon was a jagged polygon edge. Here the rings close in
 * quadratically towards the nadir, 0,05–0,1° apart where the horizon falls, so the chord sag
 * at the silhouette is a few metres.
 */
function earthCap(rings = 200, segments = 192, maxDeg = 25) {
  const pos = [], idx = [];
  const tMax = THREE.MathUtils.degToRad(maxDeg);
  pos.push(0, EARTH_R, 0);
  for (let i = 1; i <= rings; i++) {
    const th = tMax * (i / rings) ** 2, y = EARTH_R * Math.cos(th), r = EARTH_R * Math.sin(th);
    for (let j = 0; j < segments; j++) { const a = (j / segments) * Math.PI * 2; pos.push(r * Math.cos(a), y, r * Math.sin(a)); }
  }
  for (let j = 0; j < segments; j++) idx.push(0, 1 + ((j + 1) % segments), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments, b0 = 1 + i * segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      idx.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class FlightEarth {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'flight-earth';
    this.group.visible = false;
    const uni = {
      uCentre: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uOpacity: { value: 0 },
    };
    this.u = uni;
    this.earth = new THREE.Mesh(earthCap(),
      new THREE.ShaderMaterial({ uniforms: uni, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, transparent: true, depthWrite: true }));
    this.earth.name = 'flight-earth-globe';
    // The limb is worked out per view ray (LIMB_FRAG), so its geometry only has to cover the
    // screen: a 150 km sphere round the camera, always inside the far plane. A shell at the
    // top of the atmosphere was 1 100 km away along the horizon from 24 km up, past the far
    // plane, which cut it along a faceted line that read as a dark ridge above the horizon.
    this.limb = new THREE.Mesh(new THREE.SphereGeometry(150000, 64, 32),
      new THREE.ShaderMaterial({ uniforms: uni, vertexShader: EARTH_VERT, fragmentShader: LIMB_FRAG,
        transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    this.limb.name = 'flight-earth-limb';
    for (const m of [this.earth, this.limb]) { m.frustumCulled = false; m.renderOrder = -1; this.group.add(m); }
  }

  /** Follows the camera over the ground; fades in with the camera's altitude. */
  update(camera, sunDir, altitude) {
    const k = THREE.MathUtils.smoothstep(altitude, 9000, 20000);
    this.group.visible = k > 0.001;
    if (!this.group.visible) return;
    // Centred under the camera, its top 40 m below the pad so the ground disc stays in front.
    this.group.position.set(camera.position.x, -EARTH_R - 40, camera.position.z);
    this.u.uCentre.value.copy(this.group.position);
    this.limb.position.set(0, camera.position.y - this.group.position.y, 0);
    this.u.uCam.value.copy(camera.position);
    if (sunDir) this.u.uSun.value.copy(sunDir);
    this.u.uOpacity.value = k;
  }

  hide() { this.group.visible = false; }
}
