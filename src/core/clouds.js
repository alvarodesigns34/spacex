/**
 * Fair-weather cumulus over the coastal plain.
 *
 * Every wide shot had a sky that was a pure gradient: the Sky shader models scattering and
 * nothing else, so a 124 m vehicle stood against a flat blue-grey card. Boca Chica's sky on a
 * launch day is rarely empty — scattered low cumulus off the Gulf is the norm — and a cloud
 * field is also the cue the eye uses to read the height of the stack against the sky.
 *
 * The layer is a single dome that follows the camera, shaded per pixel. Two ways, one cloud field:
 *
 *  - 'volume' (since 8 November 2026; the high and medium tiers): each view ray is marched
 *    through a slab of air from the cloud base, 1.4 km up, to 2.6 km (≈: fair-weather cumulus are
 *    a few hundred metres to a kilometre or so deep). The density is the same 2D cover as the
 *    flat layer, given a body: a flat base, a top that rises where the cover is thickest (the
 *    middle of a cloud), and edges eaten by a 3D noise so they billow instead of being cut out.
 *    Light: Beer–Lambert extinction along the ray and a few samples towards the Sun for the
 *    shadow a cloud casts on itself, a two-lobed Henyey–Greenstein phase (the bright rim when a
 *    cloud stands between the eye and the Sun) and the "powder" darkening of thin edges facing
 *    away from it. An aircraft can climb into the slab, through it and look down on it.
 *  - 'layer' (the low tier, and what there was before): the ray meets a flat plane at the base
 *    and the same cover is shaded as a sheet. It fades away as the camera climbs to the base.
 *
 * Steps per ray are a tier decision (quality.js cloudSteps): the march is the cost, paid on the
 * sky pixels only. It is scenery, not data: no cloud here is a real cloud, and the depth, the
 * densities and the optical constants are chosen to look like cumulus, not measured (≈).
 */
import { HASH_GLSL } from './hashGLSL.js';
import * as THREE from 'three';
import { sunTint } from './sunlight.js';
import { createCloudTemporal } from './cloudsTemporal.js';
import { CLOUD_FAR } from './cloudConstants.js';

const BASE = 1400;     // cloud base above the ground, m
const TOP = 2600;      // highest cloud tops, m (≈)
const RADIUS = 4200;   // dome radius; inside the camera's far plane

/** The cover, in the shader's words, shared by the two ways of drawing it. */
export const COVER_GLSL = /* glsl */`
  float h(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p, int oct) {
    float s = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { if (i >= oct) break; s += a * n(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return s;
  }
  // The cover at a point of the plane: big cells and the detail on them (the flat layer's own).
  float coverAt(vec2 p, int oct) { return fbm(p / 2600.0, oct) * 0.72 + fbm(p / 640.0 + 3.1, oct) * 0.38; }`;

const LAYER_MAIN = /* glsl */`
  void main() {
    vec3 d = normalize(vDir);
    if (d.y < 0.012) discard;
    vec2 p = d.xz / d.y * ${BASE.toFixed(1)};           // where the ray meets the cloud base
    float detail = fbm(p / 640.0 + 3.1, 5);
    float c = fbm(p / 2600.0, 5) * 0.72 + detail * 0.38;
    float cover = smoothstep(uCover, uCover + 0.07, c);
    if (cover < 0.004) discard;
    // Thicker in the middle of a cloud: brighter tops towards the sun, grey flat bases.
    float thick = smoothstep(uCover, uCover + 0.34, c);
    vec2 toSun = normalize(uSun.xz + 1e-4);
    float lit = clamp(0.55 + 0.9 * (fbm((p + toSun * 260.0) / 640.0 + 3.1, 5) - detail) * -1.0 + 0.35 * uSun.y, 0.0, 1.0);
    vec3 col = mix(uShade, uSunColor, mix(0.45, 1.0, lit) * (1.0 - 0.30 * thick));
    float silver = pow(max(dot(d, normalize(uSun)), 0.0), 18.0) * (1.0 - thick);
    col += uSunColor * silver * 0.6;
    col *= mix(0.08, 1.0, uLight);
    // Into the haze near the horizon: far clouds are low-contrast and then gone.
    float horizon = smoothstep(0.04, 0.26, d.y);
    gl_FragColor = vec4(col, cover * horizon * uFade * 0.92);
  }`;

export const VOLUME_FN = /* glsl */`
  uniform int uSteps;
  uniform float uJit;
  ${HASH_GLSL}
  float h3(float k) { return hk11(k); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float k = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(mix(mix(h3(k), h3(k + 1.0), f.x), mix(h3(k + 57.0), h3(k + 58.0), f.x), f.y),
               mix(mix(h3(k + 113.0), h3(k + 114.0), f.x), mix(h3(k + 170.0), h3(k + 171.0), f.x), f.y), f.z);
  }
  const float B = ${BASE.toFixed(1)}, T = ${TOP.toFixed(1)}, SIGMA = 0.035;
  // Height of a cloud's top, as a fraction of the slab, where the cover is c: tall in the middle of
  // a cloud, low at its edge, steep sides and a broad, domed top (a cone read as a range of peaks).
  float topAt(float c) { return 0.18 + 0.82 * sqrt(smoothstep(0.0, 0.9, smoothstep(uCover, uCover + 0.34, c))); }
  // Density 0..1 at a world point. c: the cover there (passed in, it is the dear part).
  float density(vec3 p, float c) {
    float hf = (p.y - B) / (T - B);
    float top = topAt(c);
    float body = smoothstep(uCover, uCover + 0.07, c) * smoothstep(0.0, 0.05, hf) * (1.0 - smoothstep(top * 0.55, top, hf));
    if (body <= 0.0) return 0.0;
    float e = n3(p / 340.0) * 0.38 + n3(p / 150.0 + 5.0) * 0.32 + n3(p / 60.0 + 17.0) * 0.2 + n3(p / 24.0 + 31.0) * 0.1;
    return clamp(body * 1.4 - (1.0 - e) * (0.5 + 0.6 * hf), 0.0, 1.0);
  }
  float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
  // One view ray through the slab: premultiplied colour and coverage (what the dome blends), and
  // the distance of the first cloud met (hitOut, CLOUD_FAR when none). frag: the pixel, for the dither.
  vec4 cloudMarch(vec3 o, vec3 d, vec2 frag, float jitAdd, out float hitOut) {
    hitOut = ${CLOUD_FAR.toFixed(1)};
    // The stretch of the ray inside the slab.
    float t0, t1;
    if (o.y < B) { if (d.y <= 0.004) return vec4(0.0); t0 = (B - o.y) / d.y; t1 = (T - o.y) / d.y; }
    else if (o.y > T) { if (d.y >= -0.004) return vec4(0.0); t0 = (T - o.y) / d.y; t1 = (B - o.y) / d.y; }
    else { t0 = 0.0; t1 = d.y > 0.004 ? (T - o.y) / d.y : d.y < -0.004 ? (B - o.y) / d.y : 40000.0; }
    if (t0 > 40000.0) return vec4(0.0);
    t1 = min(t1, t0 + 16000.0);
    // Two step lengths (8-11-2026; before, the slab was cut into uSteps equal steps, up to 500 m
    // long near the horizon, with a white-noise offset per pixel: the grain the user saw). Empty
    // air is crossed in long steps that read only the 2D cover; where the cover can hold a cloud
    // the march backs up one long step and goes on in short ones, ≈ 1/5 000 of the distance
    // (a fraction of a pixel's footprint), 18 to 70 m, until eight short steps in a row find no
    // cloud. The offset is interleaved gradient noise, a low-discrepancy pattern: what is left of
    // the sampling error is a fine, even dither instead of clumps. uSteps caps the iterations.
    // Plus a golden-ratio step per still frame (uJit, core/stillAA.js): the accumulation then averages
    // the dither away; with the camera moving uJit holds at 0 and the pattern does not crawl.
    float jit = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715))) + jitAdd);
    vec3 sun = normalize(uSun);
    float mu = dot(d, sun);
    float phase = mix(hg(mu, 0.55), hg(mu, -0.2), 0.3);
    float Tr = 1.0, hit = -1.0;
    vec3 L = vec3(0.0);
    float fine0 = clamp(t0 * 0.0002, 18.0, 70.0);
    float t = t0 + jit * fine0 * 5.0;
    int fineLeft = 0;
    // A loop bound by a uniform: the compiler cannot unroll it (unrolled, the march took a
    // software renderer minutes to compile), and the count can change without a recompile.
    for (int i = 0; i < uSteps; i++) {
      if (t > t1) break;
      float dtF = clamp(t * 0.0002, 18.0, 70.0);
      float dtC = dtF * 5.0;
      vec3 p = o + d * t;
      float hfP = (p.y - B) / (T - B);
      if (fineLeft == 0) {
        // Long step: only the cover (three octaves, with a margin) and the height a cloud there
        // can reach, so no cloud is stepped over and the air above the tops is crossed fast.
        float cc = coverAt(p.xz, 3);
        if (cc > uCover - 0.05 && hfP < topAt(cc + 0.05) + 0.06) { fineLeft = 8; t = max(t0, t - dtC) + jit * dtF; continue; }
        t += dtC;
        continue;
      }
      float c = coverAt(p.xz, 5);
      float k = c > uCover ? density(p, c) : 0.0;
      if (k > 0.001) {
        fineLeft = 8;
        if (hit < 0.0) hit = t;
        // Towards the Sun: the cloud's own shadow, five samples out to ≈ 1 km, the first close
        // (the lit skin of a cloud is a few tens of metres deep).
        float ls = 0.0;
        for (int j = 1; j <= 5; j++) {
          float s = 40.0 * float(j * j);
          vec3 q = p + sun * s;
          ls += density(q, coverAt(q.xz, 3)) * 40.0 * float(j * 2 - 1);
        }
        float hf = (p.y - B) / (T - B);
        // Beer for the direct light, with a softer second term for the light scattered forward
        // through the cloud (a thick cloud is not black inside: multiple scattering, ≈).
        float trans = max(exp(-SIGMA * ls * 0.9), 0.25 * exp(-SIGMA * ls * 0.2));
        float direct = trans * phase * (1.0 - exp(-k * 6.0));
        vec3 S = uSunColor * direct * 1.35 + uShade * (0.30 + 0.35 * hf);
        float a = 1.0 - exp(-SIGMA * k * dtF);
        L += Tr * a * S;
        Tr *= 1.0 - a;
        if (Tr < 0.01) break;
      } else {
        // Out of reach of any cloud (thin cover, or above the tops there): back to long steps.
        fineLeft = c < uCover - 0.05 || hfP > topAt(c + 0.05) + 0.06 ? 0 : fineLeft - 1;
      }
      t += dtF;
    }
    float alpha = 1.0 - Tr;
    if (alpha < 0.004) return vec4(0.0);
    vec3 col = L / alpha * mix(0.08, 1.0, uLight);
    // Aerial perspective: far clouds sink into the haze.
    float haze = exp(-max(hit, 0.0) / 26000.0);
    hitOut = max(hit, 0.0);
    // Fade the last 15 km before the 40 km cut instead of stopping there (audit of 9-11-2026, M5):
    // with the haze leaving ≈20 % of a cloud at 40 km, the cut drew an edge a couple of degrees over
    // the horizon.
    float a = alpha * haze * uFade * (1.0 - smoothstep(25000.0, 40000.0, t0));
    return vec4(col * a, a);
  }`;

// The dome marching every pixel itself: what the reflection probes' cube cameras see (and the
// whole view before the temporal march of core/cloudsTemporal.js).
const VOLUME_MAIN = VOLUME_FN + /* glsl */`
  uniform mat4 projectionMatrix;
  void main() {
    vec3 d = normalize(vDir);
    float hit;
    vec4 c = cloudMarch(cameraPosition, d, gl_FragCoord.xy, uJit, hit);
    if (c.a < 0.004) discard;
    // At the depth of the first cloud met, not on the far plane: from above, the ground under a
    // cloud is behind it, and an aircraft in front of one stays in front.
    vec4 clip = projectionMatrix * viewMatrix * vec4(cameraPosition + d * hit, 1.0);
    gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(c.rgb / c.a, c.a);
  }`;

// The cover again, under names of its own, for lit materials' shaders (cloud shadows, below).
const SHADOW_COVER_GLSL = COVER_GLSL
  .replace(/\bh\(/g, 'csH(').replace(/\bn\(/g, 'csN(').replace(/\bfbm\(/g, 'csFbm(').replace(/\bcoverAt\(/g, 'csCover(');

/**
 * @param o.mode  'volume' or 'layer' (see the header)
 * @param o.steps samples per ray in 'volume'
 */
export function createClouds(scene, { mode = 'volume', steps = 32, temporal = false } = {}) {
  const uniforms = {
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uLight: { value: 1 },          // 1 by day, towards 0 at night
    uFade: { value: 1 },           // altitude and orbital fade
    uCover: { value: 0.53 },
    uSunColor: { value: new THREE.Color(1, 0.97, 0.92) },
    uShade: { value: new THREE.Color(0.66, 0.70, 0.77) },
    uSteps: { value: Math.max(1, steps) },
    uJit: { value: 0 },
  };
  const make = (m) => new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;                       // on the far plane: behind everything
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uSunColor, uShade;
      uniform float uLight, uFade, uCover;
      varying vec3 vDir;
      ${COVER_GLSL}
      ${m === 'volume' ? VOLUME_MAIN : LAYER_MAIN}`,
  });
  const materials = { volume: make('volume'), layer: make('layer') };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 24), materials[mode === 'layer' ? 'layer' : 'volume']);
  dome.name = 'clouds';
  dome.frustumCulled = false;
  dome.renderOrder = -1;        // after the sky dome, before everything else
  scene.add(dome);
  let current = mode === 'layer' ? 'layer' : 'volume';

  // The main view's clouds marched over frames (core/cloudsTemporal.js); the dome then only draws
  // the resolved picture, at the depth of its clouds. The per-pixel dome stays for the probes.
  const temporalMarch = temporal ? createCloudTemporal(uniforms) : null;
  const screenU = { uCloudC: { value: null }, uCloudD: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } };
  const screen = new THREE.ShaderMaterial({
    name: 'clouds-resolved',
    uniforms: screenU,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uCloudC, uCloudD;
      uniform vec2 uRes;
      uniform mat4 projectionMatrix;
      varying vec3 vDir;
      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        vec4 c = texture2D(uCloudC, uv);
        if (c.a < 0.004) discard;
        vec4 clip = projectionMatrix * viewMatrix * vec4(cameraPosition + normalize(vDir) * texture2D(uCloudD, uv).r, 1.0);
        gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = c;
      }`,
  });
  let onScreen = false;

  // Cloud shadows on what the Sun lights. A point's direct light is dimmed by the cover where its
  // ray to the Sun crosses the layer (≈ 1.7 km, low in the slab): the same cover the clouds are
  // drawn with, so each shadow lies under its own cloud. Patched into lit materials' shaders
  // (applyShadow), chained after their own onBeforeCompile and keyed apart in three's program
  // cache. ≈ 85 % of the direct light at most under a thick cloud (the rest scatters through), and
  // 15 % of the sky's diffuse light.
  let shadowsOn = true, shadowFade = 0;
  const shadowU = { uCsSun: { value: new THREE.Vector3(0, 1, 0) }, uCsFade: { value: 0 }, uCover: uniforms.uCover };
  function applyShadow(material) {
    if (!material?.isMeshStandardMaterial || material.userData.cloudShadow) return;
    const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey();
    material.userData.cloudShadow = true;
    material.onBeforeCompile = function (sh, r) {
      prev.call(this, sh, r);
      // A shader that writes its own vertex projection (the dune grass) is left alone.
      if (!sh.vertexShader.includes('#include <project_vertex>')) return;
      Object.assign(sh.uniforms, shadowU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCsW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvCsW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vCsW;
uniform vec3 uCsSun;
uniform float uCsFade, uCover;
${SHADOW_COVER_GLSL}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  if (uCsFade > 0.01 && uCsSun.y > 0.02) {
    vec2 csQ = vCsW.xz + uCsSun.xz * ((1700.0 - vCsW.y) / uCsSun.y);
    // The same cover as the march (four octaves: with three it covered 38 % of the sky against
    // the drawn 51 %), and the same onset of the cloud's body (+0.07), deepening with its thickness.
    float csC = csCover(csQ, 4);
    // Faded in as the Sun climbs from 1.1° to 4.6° (audit of 9-11-2026, M6: it switched off at 2.9°,
    // a visible jump in a sunset).
    float csK = smoothstep(uCover, uCover + 0.07, csC) * (0.55 + 0.45 * smoothstep(uCover, uCover + 0.25, csC)) * uCsFade * smoothstep(0.02, 0.08, uCsSun.y);
    reflectedLight.directDiffuse *= 1.0 - 0.85 * csK;
    reflectedLight.directSpecular *= 1.0 - 0.85 * csK;
    // Under a cloud part of the sky's own light is gone too (the cloud is where blue sky was).
    reflectedLight.indirectDiffuse *= 1.0 - 0.15 * csK;
  }`);
    };
    material.customProgramCacheKey = () => `${prevKey}|cs1`;
    material.needsUpdate = true;
  }

  return {
    mesh: dome,
    get mode() { return current; },
    applyShadow,
    /** Cloud shadows on or off (console: __vc.env.clouds.shadows = false, to compare). */
    get shadows() { return shadowsOn; },
    set shadows(v) { shadowsOn = !!v; shadowU.uCsFade.value = shadowsOn ? shadowFade : 0; },
    /** Switch between the two ways (console: __vc.env.clouds.setMode('layer')). */
    setMode(m) { current = m === 'layer' ? 'layer' : 'volume'; dome.material = materials[current]; temporalMarch?.invalidate(); },
    /** The temporal march (core/cloudsTemporal.js), or null where every pixel is marched. */
    get temporal() { return temporalMarch; },
    /** False draws the main view per pixel again, as before 11-11-2026 (console, to compare). */
    temporalOn: !!temporalMarch,
    /**
     * Before the main view's scene pass, with its camera unjittered: march this frame's pixels and
     * have the dome draw the resolved picture. endMain() after the pass gives the dome back to the
     * probes' cube cameras.
     */
    beginMain(renderer, camera, mark = null) {
      if (!temporalMarch || !this.temporalOn || current !== 'volume' || !dome.visible) { temporalMarch?.invalidate(); return; }
      temporalMarch.render(renderer, camera, mark);
      screenU.uCloudC.value = temporalMarch.color; screenU.uCloudD.value = temporalMarch.dist;
      screenU.uRes.value.copy(temporalMarch.resolution);
      dome.material = screen; onScreen = true;
    },
    endMain() { if (onScreen) { dome.material = materials[current]; onScreen = false; } },
    /** Samples per ray in 'volume', changed live (no recompile). */
    /** The still-frame counter of core/stillAA.js: steps the march's offset by the golden ratio. */
    set stillFrame(n) { uniforms.uJit.value = (n * 0.6180339887) % 1; },
    get steps() { return uniforms.uSteps.value; },
    set steps(n) { uniforms.uSteps.value = Math.max(1, Math.round(n)); },
    follow(camera) { dome.position.copy(camera.position); },
    /**
     * @param sunDir unit vector; night 0..1; altitude m; visible false in the orbital view;
     * @param flight an aircraft flies (the F-16): the volume can be entered and seen from above
     */
    update(sunDir, night, altitude, visible = true, flight = false) {
      uniforms.uSun.value.copy(sunDir);
      uniforms.uLight.value = 1 - night;
      // The same sunlight as the scene's (sunlight.js), not a warmth ramp of its own.
      uniforms.uSunColor.value.setRGB(...sunTint(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1)))));
      // A flat layer 1.4 km up cannot be seen from below once the camera has climbed through
      // it; the volume can, in flight. The launch keeps the old fade (its camera and its
      // stretched ground are not a flight's).
      const climb = current === 'volume' && flight
        ? 1 - THREE.MathUtils.smoothstep(altitude, 15000, 25000)
        : 1 - THREE.MathUtils.smoothstep(altitude, 700, BASE);
      uniforms.uFade.value = climb * (1 - night * 0.9);
      dome.visible = visible && uniforms.uFade.value > 0.01;
      shadowU.uCsSun.value.copy(sunDir).normalize();
      // Only while the clouds are drawn, and as they fade with height.
      shadowFade = dome.visible ? climb * (1 - night) : 0;
      shadowU.uCsFade.value = shadowsOn ? shadowFade : 0;
    },
  };
}
