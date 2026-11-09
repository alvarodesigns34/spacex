/**
 * Exhaust plumes and the ground cloud (the curved Earth under the flight is in flightEarth.js).
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
import { HASH_GLSL } from '../core/hashGLSL.js';
import * as THREE from 'three';
import { fbm } from '../materials/textures.js';
import { DOWNWIND } from '../core/wind.js';
import { GroundCloud, puffTexture, ATLAS_UV } from './groundCloud.js';
export { GroundCloud };

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
  varying float vAng;
  void main() {
    float v = 1.0 - uv.y;                      // 0 at the nozzle plane, 1 at the tail
    vAxis = v;
    vRad = length(position.xz);
    vAng = atan(position.z, position.x);
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
  uniform float uLen, uRad, uP, uRag;
  varying float vAxis;
  varying float vFace;
  varying float vRad;
  varying float vAng;
  // Value noise in three dimensions, cheap and deterministic (no texture, no wall clock).
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // Black-body colour (linear RGB, largest channel 1) of soot at temperature T, K: a fit to the
  // Planck locus (Tanner Helland's, ≈ within a few per cent over 1 000–6 000 K), brought to linear.
  vec3 blackbody(float T) {
    float t = T / 100.0;
    float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332048), 0.0, 1.0);
    float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0) : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
    vec3 c = pow(vec3(r, g, b), vec3(2.2));
    return c / max(max(c.r, c.g), max(c.b, 1e-4));
  }
  void main() {
    float v = clamp(vAxis, 0.0, 1.0);
    vec3 c = v < 0.35 ? mix(uHot, uWarm, v / 0.35) : mix(uWarm, uCool, (v - 0.35) / 0.65);
    // The hue of glowing soot from a temperature falling down the column and out from the axis
    // (9-11-2026, block 3: the ramp was three colours picked by eye): ≈2 700 K near the exit to
    // ≈1 300 K in the tail, ≈ — the afterburning layer's temperature is not published for Raptor.
    // The ramp keeps the brightness; in thin air (uP → 0) the soot glow gives way to the ramp.
    {
      float T = mix(2700.0, 1300.0, pow(v, 0.7)) * (1.0 - 0.22 * clamp(vRad, 0.0, 1.0));
      vec3 bb = blackbody(T);
      const vec3 Y = vec3(0.2126, 0.7152, 0.0722);
      c = mix(c, bb * dot(c, Y) / max(dot(bb, Y), 1e-3), 0.6 * clamp(uP, 0.0, 1.0));
    }
    // Shock diamonds sit on the axis. A sine along v alone paints stripes down the
    // cone; gating it by radius turns each node into a disc that fades outward.
    float node = pow(max(abs(sin(v * uDiamondN)), 1e-4), 16.0);
    node *= smoothstep(0.48, 0.02, vRad);
    float shock = 1.0 + uDiamond * node * (1.0 - v * 0.5);
    // Turbulence of the mixing layer, in metres and carried downstream with the flow: eddies a
    // few metres across at the pad that grow as the exhaust expands at altitude. It replaces a
    // pair of sines, which painted regular bands on a smooth cone — the tell of a drawn plume.
    // Sampled on the circle (cos, sin of the angle) so there is no seam round the axis.
    float scale = mix(0.12, 0.35, uP) / max(1.0, uRad * 0.25);
    vec3 q = vec3(cos(vAng) * uRad * vRad, sin(vAng) * uRad * vRad, v * uLen) * scale;
    q.z -= uTime * mix(4.0, 9.0, uP);
    float n = 0.55 * vnoise(q) + 0.3 * vnoise(q * 2.03 + 7.1) + 0.15 * vnoise(q * 4.1 - 3.3);
    float shear = smoothstep(0.12, 0.9, vRad);
    // Brightness flickers with the eddies, more out in the shear layer and down the column.
    c *= 1.0 + (n - 0.5) * (0.35 + 0.5 * shear) * smoothstep(0.02, 0.3, v);
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
    // A ragged outline: towards the edge and the tail the envelope is torn by the eddies
    // instead of fading on a clean conical surface.
    float edge = (1.0 - safeFace) * 0.9 + v * 0.55;
    a *= mix(1.0, smoothstep(0.1, 0.6, n + 0.45 - edge * uRag), smoothstep(0.05, 0.25, v));
    // In near vacuum the bell is lit mostly at its boundary, where a line of sight crosses the
    // most of the thin shocked layer: the limb-brightened jellyfish of high-altitude footage,
    // not a solid cone.
    a *= mix(1.0, 0.35 + 1.6 * pow(1.0 - safeFace, 1.5), (1.0 - uP) * 0.7);
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
      uLen: { value: 10 }, uRad: { value: 1 }, uP: { value: 1 }, uRag: { value: 1 },
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
  constructor({ radius, seaLevelLength = 10.5, name = 'plume', fireCount = 150 }) {
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
    // Out of the air the colours change as well as the shape: the orange of a sea-level column
    // is the afterburning of its fuel-rich edge in the air, and in vacuum there is none. What is
    // left is a white core and a faint, cold halo — the blue-white of methalox exhaust seen in
    // the upper-stage views, not an orange flame hanging in black sky.
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    this.palette = [this.core, this.shroud].map((layer, i) => {
      const u = layer.material.uniforms;
      return {
        u, sl: [u.uHot.value.clone(), u.uWarm.value.clone(), u.uCool.value.clone()],
        // Azure, not periwinkle: with as much red as green the halo read lavender under ACES.
        vac: i === 0 ? [lin(0xfbfdff), lin(0xdde9ff), lin(0x8fb2e6)] : [lin(0xe6f0ff), lin(0x82a2d6), lin(0x2e4668)],
      };
    });
    this.group.add(this.veil, this.shroud, this.core);
    this.time = 0;
    // The fire itself: turbulent flame sprites down the bright part of the column, over the
    // cones. The cones give the column its continuous glow and its shocks; the sprites give it
    // an outline that tears and flickers.
    let x = 0x2545f491 ^ Math.round(radius * 1000);
    const rng = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.fire = new Fire({ emitters: [{ at: [0, 0, 0], dir: [0, -1, 0], count: fireCount }], rng, name: `${name}-fire` });
    this.group.add(this.fire.mesh);

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
   * @param {number} [perEngine] throttle of each running engine, which sets the length
   */
  setThrottle(throttle, altitude, spread = 1, perEngine = throttle, maxLength = Infinity) {
    const on = throttle > 0.001;
    // The group stays visible and only the cones hide: the light has to be in the scene all
    // the time, at zero when the engines are off. How many lights a scene has is part of
    // every lit material's shader, so a light that appeared with the group at ignition made
    // all of them recompile at once — 25 programs, a stall at the moment of liftoff.
    for (const layer of [this.core, this.shroud, this.veil]) layer.visible = on;
    if (!on) { this.light.intensity = 0; this.fire.set({ intensity: 0 }); return; }
    const p = pressureRatio(altitude);
    // Over-expanded and stubby at the pad; wide and long once there is nothing to push back.
    // At 60 km a booster's plume is a translucent bell several hundred metres long and many
    // times its own width (flight footage from the ascent's last minute).
    const stretch = 1 + 4.2 * (1 - p);
    // Length goes with each engine's own throttle, not the cluster's: the centre three on the
    // landing approach each run near full power and throw a column ~50 m long (flight 5 catch
    // photograph), where 9 % of the cluster's thrust made a 29 m stub.
    const t = 0.5 + 0.5 * perEngine;
    const r = this.radius * spread;
    // Length follows the lit radius less than width does: fewer engines make a thinner column
    // before they make a shorter one.
    const len = this.baseLength * (0.55 + 0.45 * spread);
    // The merged column leaves the cluster a little wider than the cluster: 33 jets side by
    // side, each opening out as it leaves its bell.
    const rc = r * 0.98;
    // The bright core is the dense flow just behind the nozzles; in vacuum it does not run on
    // for a hundred metres with the envelope — it is the envelope that balloons.
    this.core.scale.set(rc, len * (1 + 1.6 * (1 - p)) * t, rc);
    const rs = r * 1.55;
    this.shroud.scale.set(rs, len * stretch * 1.45 * t, rs);
    const rv = r * (1.7 + 1.4 * (1 - p));
    this.veil.scale.set(rv, len * stretch * 1.7 * t, rv);
    // Something in the way (the booster's dome, at hot-staging): the exhaust cannot run on
    // through it, so no layer reaches past it. What it does instead is the impingement fan the
    // sequence draws round the dome.
    this.veil.material.uniforms.uSpread.value = 1 + 6.5 * (1 - p);
    this.veil.material.uniforms.uOpacity.value = 0.15 + 0.85 * p;
    for (const layer of [this.core, this.shroud, this.veil]) layer.material.uniforms.uTime.value = this.time;
    this.core.material.uniforms.uSpread.value = 1 + 2.4 * (1 - p);
    this.shroud.material.uniforms.uSpread.value = 1 + 6.4 * (1 - p);
    if (maxLength < Infinity) for (const layer of [this.core, this.shroud, this.veil]) {
      // Cut short, the plume keeps the width it has that far from the nozzle rather than
      // blooming to its full vacuum width within a few metres: a clipped bell drew a disc.
      const full = layer.scale.y;
      if (full > maxLength) {
        layer.scale.y = maxLength;
        const u = layer.material.uniforms.uSpread;
        u.value = 1 + (u.value - 1) * (maxLength / full);
      }
    }
    // The turbulence works in metres, so each layer is told its own size and the air pressure.
    for (const layer of [this.core, this.shroud, this.veil]) {
      const u = layer.material.uniforms;
      u.uLen.value = layer.scale.y; u.uRad.value = layer.scale.x; u.uP.value = p;
    }
    // The core is torn least (it is the dense, fast part); the veil most.
    this.core.material.uniforms.uRag.value = 0.55;
    this.shroud.material.uniforms.uRag.value = 1.0;
    this.veil.material.uniforms.uRag.value = 1.25;
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
    // Thin in vacuum. It used to grow towards 1 as the air thinned, and at hot-staging the
    // ship's envelope drew as an opaque orange petal wrapped round the booster; a methalox
    // plume out of the air is a faint, wide glow round a short bright core.
    this.shroud.material.uniforms.uOpacity.value = 0.3 + 0.36 * p;
    // Fire down the bright part of the column. Low in the atmosphere the mixing layer is what
    // burns (the fuel-rich exhaust meeting air), and it is turbulent and ragged; in near vacuum
    // there is no air to burn in and the plume is a smooth glow, so the flame thins out to a
    // trace of structure in the core. Lengths follow the core, clipped like it.
    {
      const coreLen = this.core.scale.y;
      const len = Math.min(coreLen * (1.25 + 0.35 * p), this.shroud.scale.y * 0.85);
      const tailR = rs * (1.25 + 2.2 * (1 - p));
      this.fire.set({
        // Out of the air there is nothing for the fuel-rich edge to burn in: by a few tens of
        // kilometres the flame is a trace, and a vacuum bell stays a smooth, faint glow.
        intensity: (0.04 + 0.96 * Math.sqrt(p)) * (0.65 + 0.35 * perEngine),
        life: 0.42 + 0.3 * (1 - p), len, drag: 0,
        r0: rc * 0.7, widen: Math.max(0, tailR - rc * 0.7) / Math.max(len, 1),
        size0: r * 1.0, grow: r * (2.2 + 2.5 * (1 - p)), stretch: 2.4, wander: r * 0.8,
        gain: 1.8 + 1.6 * p, occlude: 0.22 * p, smoke: 0, maxLen: maxLength,
      });
    }
    // Colour with the air (see the constructor): sea-level orange through to vacuum blue-white,
    // most of the change in the last few percent of an atmosphere.
    {
      const k = Math.sqrt(p);
      for (const { u, sl, vac } of this.palette) {
        u.uHot.value.lerpColors(vac[0], sl[0], k);
        u.uWarm.value.lerpColors(vac[1], sl[1], k);
        u.uCool.value.lerpColors(vac[2], sl[2], k);
      }
    }
    // 8,240 tf lights the pad. The old value lit a room.
    this.light.intensity = 4200 * throttle * (0.35 + 0.65 * p);
    this.light.distance = 260 + 420 * (1 - p);
    // The light belongs in the column, not at the nozzle: at the nozzle it lit the engine
    // bay and nothing else, and the deck below stayed in shadow through liftoff.
    this.light.position.y = -this.baseLength * 0.22 * (1 + 3.4 * (1 - p)) * t;
  }

  /** Mission clock, in seconds. Turbulence is a function of this, not of wall time. */
  setTime(t) { this.time = t; this.fire.setTime(t); }

  dispose() {
    for (const m of [this.core, this.shroud, this.veil]) { m.geometry.dispose(); m.material.dispose(); }
    this.fire.dispose();
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
  uniform float uLength, uSpread, uP, uTurb, uTime;
  varying float vAxis, vFace, vRad, vAz, vSeed;
  ${HASH_GLSL}
  void main() {
    float v = -position.y;                              // 0 at the exit plane, 1 at the tail
    vAxis = v;
    vRad = length(position.xz);
    vAz = atan(position.z, position.x);
    vSeed = hk11(float(gl_InstanceID) * 1.618 + 0.37);
    // Over-expanded at sea level: the jet necks in after the exit before it spreads. At
    // altitude it opens straight away.
    float neck = 1.0 - 0.18 * uP * sin(3.14159 * clamp(v * 1.6, 0.0, 1.0));
    float w = neck * mix(1.0, uSpread, smoothstep(0.1, 1.0, v));
    // Turbulent jets (the hot-stage vents, the trench fire) are ragged tongues rather than
    // cones: each flickers in length on its own clock, and its outline wobbles along it.
    float len = uLength * (1.0 + uTurb * (0.35 * sin(uTime * (7.0 + 5.0 * vSeed) + vSeed * 40.0) - 0.15 + 0.3 * vSeed));
    w *= 1.0 + uTurb * 0.25 * v * sin(vAz * 3.0 + v * 9.0 - uTime * 11.0 + vSeed * 20.0);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position.x * w, position.y * len, position.z * w, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * vec3(normal.x, 0.0, normal.z) + vec3(1e-5));
    vFace = clamp(abs(dot(n, normalize(-mv.xyz))), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;
const JET_FRAG = /* glsl */`
  uniform vec3 uHot, uWarm, uTail;
  uniform float uOpacity, uP, uTime, uGain, uTurb;
  varying float vAxis, vFace, vRad, vAz, vSeed;
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
    // Turbulent jets break into streaks and eddies towards the tail instead of one smooth sheet:
    // what read as a flat orange petal round the interstage at hot-staging.
    if (uTurb > 0.0) {
      float streak = 0.5 + 0.5 * sin(vAz * 5.0 + v * 14.0 - uTime * 23.0 + vSeed * 31.0);
      float eddy = 0.5 + 0.5 * sin(v * 26.0 - uTime * 17.0 + vAz * 2.0 + vSeed * 9.0);
      a *= mix(1.0, (0.25 + 0.75 * streak) * (0.55 + 0.45 * eddy), uTurb * smoothstep(0.08, 0.5, v));
      a *= 1.0 - uTurb * 0.35 * smoothstep(0.4, 1.0, v);
    }
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
  constructor({ engines, seaLevelLength = 11, name = 'engine-jets', turbulence = 0 }) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 16, true);
    geo.translate(0, -0.5, 0);
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uHot: { value: lin(0xfff4dc) }, uWarm: { value: lin(0xffb259) }, uTail: { value: lin(0xff6a2e) },
        uLength: { value: 1 }, uSpread: { value: 1 }, uP: { value: 1 },
        uOpacity: { value: 1 }, uTime: { value: 0 }, uGain: { value: 1.25 }, uTurb: { value: turbulence },
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
  setState(throttle, altitude, lit, maxLength = Infinity) {
    const on = throttle > 0.01 && lit > 0;
    this.mesh.visible = on;
    if (!on) return;
    this.mesh.count = Math.min(this.total, Math.max(0, Math.round(lit)));
    const p = pressureRatio(altitude);
    const u = this.material.uniforms;
    u.uP.value = p;
    // Short and tight at the pad, long and open once the air thins.
    u.uLength.value = Math.min(maxLength, this.meanR * this.seaLevelLength * (1 + 2.2 * (1 - p)) * (0.6 + 0.4 * throttle));
    u.uSpread.value = 1.15 + 2.4 * (1 - p);
    u.uOpacity.value = (0.55 + 0.45 * throttle) * 0.7;
  }

  setTime(t) { this.material.uniforms.uTime.value = t; }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

// -----------------------------------------------------------------------------------------
//  Fire
// -----------------------------------------------------------------------------------------
/**
 * Flame as fire looks: a stream of camera-facing flame sprites, each one a turbulent blob that
 * is carried downstream, grows, cools from white through yellow and orange to a dull red, and is
 * eaten away from its edge as it cools, so the outline of the whole breaks into tongues that
 * lick out and vanish. A smooth cone, however it is shaded, has one outline that moves only
 * as a whole; fire has hundreds, each on its own clock — that is what reads as fire.
 *
 * Deterministic in mission time like the vapour: every sprite's age is the mission clock modulo
 * its own life, from a fixed phase, so a seek lands on the same frame as playback and a pause
 * freezes the flame. Nothing is simulated on the CPU; the sequence sets a few uniforms.
 *
 * The texture is a 4 × 4 atlas of flame cells: R a density with a fractal, warped edge and
 * brighter pockets inside it, G a finer noise used to fray the edge as the sprite ages.
 */
let _fireTex = null;
function fireTexture() {
  if (_fireTex) return _fireTex;
  const cell = 128, cells = 4, size = cell * cells;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let v = 0; v < cells * cells; v++) {
    const ox = (v % cells) * cell, oy = Math.floor(v / cells) * cell, seed = 13.7 * v + 3.1;
    for (let y = 0; y < cell; y++) {
      const ny = (y - cell / 2) / (cell / 2);
      for (let x = 0; x < cell; x++) {
        const nx = (x - cell / 2) / (cell / 2);
        // Domain warp: the radius is looked up through a displaced point, which turns a round
        // blob into lobes and curls instead of a disc with a noisy rim.
        const wx = nx + 0.45 * (fbm(nx * 1.7 + seed, ny * 1.7 - seed, 3) - 0.5);
        const wy = ny + 0.45 * (fbm(nx * 1.7 - seed * 0.7, ny * 1.7 + seed * 1.3, 3) - 0.5);
        const r = Math.hypot(wx, wy);
        const body = 1 - THREE.MathUtils.smoothstep(r, 0.25, 0.92);
        const pockets = 0.55 + 0.9 * (fbm(nx * 3.2 + seed * 2.1, ny * 3.2 - seed, 4) - 0.5) * 1.6;
        const dens = THREE.MathUtils.clamp(body * pockets * 1.25, 0, 1);
        const fine = fbm(nx * 7.5 - seed, ny * 7.5 + seed * 0.3, 3);
        // Kept inside the cell, so mipmaps do not bleed between neighbours.
        const edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(nx), Math.abs(ny)), 0.86, 0.98);
        const i = ((oy + y) * size + ox + x) * 4;
        d[i] = Math.round(dens * edge * 255);
        d[i + 1] = Math.round(THREE.MathUtils.clamp(fine, 0, 1) * 255);
        d[i + 2] = 0;
        d[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  _fireTex = new THREE.CanvasTexture(c);
  _fireTex.colorSpace = THREE.NoColorSpace;
  _fireTex.needsUpdate = true;
  return _fireTex;
}

// Its own copy of the atlas lookup: ATLAS_UV is declared further down, with the cloud.
const FIRE_VERT = /* glsl */`
  ${HASH_GLSL}
  float fireHash(float n) { return hk11(n * 1.618 + 4.1414); }
  vec2 atlasUv(vec2 uv, int id) {
    float k = floor(fireHash(float(id)) * 16.0);
    return (vec2(mod(k, 4.0), floor(k / 4.0)) + 0.02 + uv * 0.96) * 0.25;
  }
  attribute vec3 aOrigin;
  attribute vec3 aDir;
  attribute vec4 aSeed;      // phase, azimuth, radial share, size factor
  attribute vec3 aWander;    // a sprite's own drift off the mean flow, unit-ish
  uniform float uTime, uLife, uLen, uDrag, uR0, uWiden, uSize0, uGrow, uRise, uStretch, uWanderM, uMaxLen, uIntensity;
  uniform vec3 uUp;
  varying vec2 vUv;
  varying float vAge, vFade, vHeat;
  void main() {
    vUv = atlasUv(uv, gl_InstanceID);
    float life = uLife * (0.75 + 0.5 * fract(aSeed.x * 7.13));
    float a = fract(uTime / life + aSeed.x);
    vAge = a;
    // Distance along the jet: linear for a plume (uDrag 0), slowing for a jet that has hit
    // something and is spreading out (the trench mouths, the deck).
    float s = uDrag > 0.001 ? uLen * (1.0 - exp(-uDrag * a)) / (1.0 - exp(-uDrag)) : uLen * a;
    vec3 dir = normalize(aDir);
    vec3 ref = abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 b1 = normalize(cross(dir, ref)), b2 = cross(dir, b1);
    float rad = aSeed.z * (uR0 + uWiden * s);
    float az = aSeed.y + a * 1.3 * (aSeed.w - 1.0);
    vec3 p = aOrigin + dir * s + (cos(az) * b1 + sin(az) * b2) * rad
      + aWander * uWanderM * a + uUp * uRise * a * a;
    float size = (uSize0 + uGrow * a) * aSeed.w;
    // Fade in over the first few per cent (a sprite is born inside the flame, not on its edge),
    // out over the last third, and gone past an obstruction.
    vFade = smoothstep(0.0, 0.06, a) * (1.0 - smoothstep(0.62, 1.0, a)) * step(s, uMaxLen) * uIntensity;
    // Hot at the source and in the middle of the jet; the outer sprites and the old ones cool.
    vHeat = clamp(pow(1.0 - a, 1.4) * (1.15 - 0.5 * aSeed.z), 0.0, 1.0);
    vec3 c = (modelViewMatrix * vec4(p, 1.0)).xyz;
    // Stretched along the flow as the eye sees it: a tongue, not a ball.
    vec2 fv = (modelViewMatrix * vec4(dir, 0.0)).xy;
    float fl = length(fv);
    vec2 ax = fl > 1e-3 ? fv / fl : vec2(0.0, 1.0);
    float st = 1.0 + (uStretch - 1.0) * fl;
    vec2 q = position.xy * size;
    q = vec2(ax.y, -ax.x) * q.x + ax * q.y * st;
    vFade *= smoothstep(1.0, 6.0, -c.z);
    gl_Position = projectionMatrix * vec4(c + vec3(q, 0.0), 1.0);
  }`;
const FIRE_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uGain, uSmoke, uOcclude;
  uniform vec3 uSmokeColor;
  varying vec2 vUv;
  varying float vAge, vFade, vHeat;
  // Black-body-ish ramp for a flame seen by a camera: white-yellow, yellow, orange, deep red.
  vec3 ramp(float h) {
    vec3 c = mix(vec3(0.3, 0.03, 0.005), vec3(1.0, 0.26, 0.03), smoothstep(0.0, 0.35, h));
    c = mix(c, vec3(1.0, 0.55, 0.12), smoothstep(0.3, 0.62, h));
    return mix(c, vec3(1.0, 0.9, 0.66), smoothstep(0.62, 0.97, h));
  }
  void main() {
    vec4 t = texture2D(uMap, vUv);
    // Eaten from the edge as it cools: the threshold rises with age, and the fine noise frays
    // the boundary, so an old sprite breaks into wisps rather than fading as a disc.
    float th = mix(0.08, 0.62, vAge);
    float d = t.r * (0.6 + 0.8 * t.g);
    float f = smoothstep(th, th + 0.14, d) * vFade;
    if (f < 0.003) discard;
    float h = vHeat * (0.55 + 0.6 * t.r);
    vec3 fire = ramp(h) * uGain * (0.2 + 1.9 * h * h);
    // What the flame turns into once it has burnt out: smoke that hides what is behind it.
    float smoke = uSmoke * smoothstep(0.35, 0.9, vAge);
    float a = f * (uOcclude * (1.0 - vAge) + smoke);
    gl_FragColor = vec4(fire * f * (1.0 - smoke) + uSmokeColor * smoke * f, clamp(a, 0.0, 1.0));
  }`;

export class Fire {
  /**
   * @param {object} o
   * @param {Array<{at:number[], dir:number[], count:number}>} o.emitters sources in the
   *   parent's frame; each emits along its own direction
   * @param {function} o.rng seeded, so the layout is the same on every load
   */
  constructor({ emitters, rng, name = 'fire', gain = 3, smoke = 0, smokeColor = 0x6b645c, occlude = 0.15 }) {
    const n = emitters.reduce((s, e) => s + e.count, 0);
    const origin = new Float32Array(n * 3), dir = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4), wander = new Float32Array(n * 3);
    let i = 0;
    for (const e of emitters) {
      for (let k = 0; k < e.count; k++, i++) {
        origin.set(e.at, i * 3);
        dir.set(e.dir, i * 3);
        seed.set([k / e.count + rng() * (0.7 / e.count), rng() * Math.PI * 2, Math.sqrt(rng()), 0.7 + 0.6 * rng()], i * 4);
        wander.set([rng() - 0.5, rng() - 0.5, rng() - 0.5], i * 3);
      }
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    geo.setIndex([0, 2, 1, 2, 3, 1]);
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
    geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    geo.setAttribute('aWander', new THREE.InstancedBufferAttribute(wander, 3));
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: fireTexture() }, uTime: { value: 0 }, uLife: { value: 0.5 }, uLen: { value: 10 },
        uDrag: { value: 0 }, uR0: { value: 1 }, uWiden: { value: 0.1 }, uSize0: { value: 2 }, uGrow: { value: 4 },
        uRise: { value: 0 }, uStretch: { value: 1.6 }, uWanderM: { value: 0 }, uMaxLen: { value: 1e9 },
        uIntensity: { value: 0 }, uUp: { value: new THREE.Vector3(0, 1, 0) },
        uGain: { value: gain }, uSmoke: { value: smoke }, uOcclude: { value: occlude },
        uSmokeColor: { value: new THREE.Color(smokeColor) },
      },
      vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG,
      transparent: true, depthWrite: false,
      // Premultiplied, as the plume cones: emitted light plus a share of occlusion.
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    // With the plume cones: after the cloud, so the flame glows through its own steam.
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  /**
   * Shape and strength, all in the parent's frame and in metres.
   * @param {object} o  intensity 0 hides it; life (s) of one sprite; len, how far a sprite
   *   travels in that life; drag, how quickly it slows (0 none); r0 and widen, the radius at the
   *   source and its growth per metre travelled; size0 and grow, a sprite's size at birth and
   *   its growth over its life; rise, buoyant lift over its life along `up`; stretch along the
   *   flow; wander, each sprite's own drift; maxLen, where something stops the flow.
   */
  set(o) {
    const u = this.material.uniforms;
    const on = (o.intensity ?? 0) > 0.002;
    this.mesh.visible = on;
    if (!on) return;
    for (const [k, name] of [['intensity', 'uIntensity'], ['life', 'uLife'], ['len', 'uLen'], ['drag', 'uDrag'],
      ['r0', 'uR0'], ['widen', 'uWiden'], ['size0', 'uSize0'], ['grow', 'uGrow'], ['rise', 'uRise'],
      ['stretch', 'uStretch'], ['wander', 'uWanderM'], ['gain', 'uGain'], ['smoke', 'uSmoke'], ['occlude', 'uOcclude']]) {
      if (o[k] !== undefined) u[name].value = o[k];
    }
    u.uMaxLen.value = o.maxLen ?? 1e9;
    if (o.up) u.uUp.value.copy(o.up);
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
  uniform float uIntensity, uTime, uRagged;
  varying vec2 vUv;
  void main() {
    float r = length(vUv) * 2.0;
    float a = atan(vUv.y, vUv.x);
    // Ragged edge: lobes that turn with time, so the ball boils rather than sits as a disc.
    // uRagged scales them: the hot-staging ball boils (1); the re-entry's glow round the hull is
    // a smooth bloom of light (0), where the same lobes drew a red starburst behind the ship.
    float edge = 0.78 + uRagged * (0.1 * sin(a * 7.0 + uTime * 5.0) + 0.07 * sin(a * 13.0 - uTime * 8.0));
    float k = 1.0 - smoothstep(0.0, edge, r);
    float core = exp(-r * r * 9.0);
    vec3 c = mix(uEdge, uColor, clamp(core * 1.4, 0.0, 1.0)) * (k * k + 2.5 * core);
    float i = uIntensity * k;
    if (i < 0.002) discard;
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }`;

export class Glow {
  constructor({ color = 0xfff1d6, edge = 0xff7a26, name = 'glow', ragged = 1 } = {}) {
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: lin(color) }, uEdge: { value: lin(edge) }, uIntensity: { value: 0 }, uSize: { value: 1 }, uTime: { value: 0 }, uRagged: { value: ragged } },
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

const _sunDir = new THREE.Vector3(), _inv = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _w = new THREE.Vector3(), _up = new THREE.Vector3();

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
  uniform float uTime, uTau, uOpacity, uFadeIn;
  uniform vec3 uAccel;
  // Optional moving source: where the emitter was at each moment, (t0, t1, samples). A puff
  // starts from wherever the source was when it was born and is left behind in the air.
  uniform sampler2D uPath;
  uniform vec3 uPathT;
  varying vec2 vUv;
  varying float vAlpha, vRot, vGround;
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
  vec3 pathAt(float t) {
    float u = clamp((t - uPathT.x) / (uPathT.y - uPathT.x), 0.0, 1.0) * (uPathT.z - 1.0);
    float i = floor(u);
    vec3 a = texture2D(uPath, vec2((i + 0.5) / uPathT.z, 0.5)).xyz;
    vec3 b = texture2D(uPath, vec2((min(i + 1.0, uPathT.z - 1.0) + 0.5) / uPathT.z, 0.5)).xyz;
    return mix(a, b, u - i);
  }
  void main() {
    vUv = atlasUv(uv, gl_InstanceID);
    float life = aParams.y;
    float age = mod(uTime - aWindow.x + aParams.x * life, life);
    float born = uTime - age;
    float on = step(aWindow.x, born) * step(born, aWindow.y);
    float k = age / life;
    // Launched fast, slowed by drag, then carried by buoyancy / sinking and the wind.
    vec3 p = aOrigin + aVel * uTau * (1.0 - exp(-age / uTau)) + 0.5 * uAccel * age * age;
    if (uPathT.z > 0.5) p += pathAt(born);
    float size = aParams.z + aParams.w * age;
    vAlpha = on * uOpacity * smoothstep(0.0, uFadeIn, k) * (1.0 - smoothstep(0.45, 1.0, k));
    vRot = aParams.x * 6.2832 + age * 0.35 * (aParams.x - 0.5);
    vec3 c = (modelViewMatrix * vec4(p, 1.0)).xyz;
    float s = sin(vRot), q = cos(vRot);
    vec2 d = vec2(position.x * q - position.y * s, position.x * s + position.y * q) * size;
    vec3 wc = (modelMatrix * vec4(p, 1.0)).xyz
      + vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * d.x
      + vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * d.y;
    vGround = (wc.y - groundUnder(wc.xz)) / max(size, 0.5);
    vAlpha *= smoothstep(1.0, 8.0, -c.z);
    gl_Position = projectionMatrix * vec4(c + vec3(d, 0.0), 1.0);
  }`;
const VAPOR_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunDir, uSun, uShade;
  varying vec2 vUv;
  varying float vAlpha, vRot, vGround;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    // Soft outline (the dome's thin edge) and soft contact with the ground, as for the cloud.
    float a = t.a * vAlpha * mix(0.45, 1.0, smoothstep(0.18, 0.62, t.b)) * smoothstep(-0.02, 0.15, vGround);
    if (a < 0.004) discard;
    // Softer relief than the trench cloud: venting vapour is thin, and full-strength normals
    // outlined every translucent puff where they overlap.
    vec2 n2 = (t.rg * 2.0 - 1.0) * 0.7;
    float s = sin(vRot), k = cos(vRot);
    vec3 n = normalize(vec3(n2.x * k - n2.y * s, n2.x * s + n2.y * k, max(t.b, 0.2)));
    float wrap = clamp((dot(n, uSunDir) + 0.5) / 1.5, 0.0, 1.0);
    wrap = mix(0.82, wrap, smoothstep(0.08, 0.55, t.a));
    gl_FragColor = vec4(mix(uShade, uSun, wrap), clamp(a, 0.0, 1.0));
  }`;

let _vaporMap = null, _noPath = null, _sprayMap = null;
/**
 * The water-spray atlas rendered in Blender (blender/spray/build.py → assets/spray/spray-atlas.png):
 * sixteen clusters of droplets, streaks and torn sheets in the vapour atlas's encoding (RGB the
 * normal, A the coverage). For water thrown up: the steam puffs' cauliflower domes drew it as cotton.
 */
export function sprayTexture() {
  if (_sprayMap) return _sprayMap;
  _sprayMap = new THREE.TextureLoader().load(new URL('../../assets/spray/spray-atlas.png', import.meta.url).href);
  _sprayMap.colorSpace = THREE.NoColorSpace;
  _sprayMap.anisotropy = 4;
  return _sprayMap;
}
/** xyz samples as a one-row float texture, read unfiltered and interpolated in the shader. */
function pathTexture(points) {
  const n = points.length / 3, data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) data.set([points[i * 3], points[i * 3 + 1], points[i * 3 + 2], 1], i * 4);
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
export class Vapor {
  /**
   * @param {object} o
   * @param {Array} o.emitters [{ at:[x,y,z], dir:[x,y,z], speed, spread, count, life, size, grow, window:[t0,t1] }]
   * @param {number[]} o.accel constant acceleration (buoyancy, sinking, wind), m/s²
   * @param {object} [o.path] a moving source, { t0, t1, points: Float32Array of xyz samples
   *   evenly spaced over [t0, t1] }: each puff is emitted relative to where it was then
   * @param {number[]} [o.colors] sunlit and shaded colour, for smoke that is not white
   * @param {THREE.Texture} [o.map] an atlas in the vapour's encoding instead of the puffs' (water spray)
   * @param {number} [o.fadeIn] share of a puff's life it takes to fade in (a trail wants it
   *   visible from the moment it leaves the source)
   */
  constructor({ emitters, rng, accel = [0.6, -0.4, 0.2], tau = 1.2, opacity = 0.55, name = 'vapor', path = null, colors = [0xf6f6f4, 0x959ba4], fadeIn = 0.1, pad = null, map = null }) {
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
        // `map`: another atlas in the same encoding (the water spray's, sprayTexture).
        uMap: { value: map ?? _vaporMap }, uTime: { value: -1e4 }, uTau: { value: tau }, uOpacity: { value: opacity }, uFadeIn: { value: fadeIn },
        uAccel: { value: new THREE.Vector3(...accel) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
        uSun: { value: new THREE.Color(colors[0]) }, uShade: { value: new THREE.Color(colors[1]) },
        uPath: { value: path ? pathTexture(path.points) : (_noPath ??= pathTexture(new Float32Array(3))) },
        uPathT: { value: new THREE.Vector3(path?.t0 ?? 0, path?.t1 ?? 1, path ? path.points.length / 3 : 0) },
        uPad: { value: new THREE.Vector2(pad?.[0] ?? 0, pad?.[1] ?? 0) },
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
    // The horizontal part of the drift is the wind's (core/wind.js): the same strength as given,
    // turned downwind, in whatever frame the puffs hang in (a turned pad, a tilting booster).
    // Before, each vapour drifted its own way, south-east on the pad, into the sea breeze.
    this.drift = Math.hypot(accel[0], accel[2]);
    this.rise = accel[1];
  }

  /** Mission time; hidden outright when no emitter can have a live puff. */
  update(t, camera, sun) {
    this.material.uniforms.uTime.value = t;
    this.mesh.visible = this.windows.some(([a, b]) => t >= a && t <= b + this.maxLife);
    if (this.mesh.visible && this.drift > 0 && this.mesh.parent) {
      this.mesh.parent.getWorldQuaternion(_q).invert();
      _w.set(DOWNWIND.x, 0, DOWNWIND.z).applyQuaternion(_q);
      _up.set(0, 1, 0).applyQuaternion(_q);
      this.material.uniforms.uAccel.value.copy(_w).multiplyScalar(this.drift).addScaledVector(_up, this.rise);
    }
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

// The Earth below, for the high part of the flight (flightEarth.js), re-exported.
export { FlightEarth } from './flightEarth.js';
