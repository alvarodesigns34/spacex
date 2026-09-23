/**
 * Fair-weather cumulus over the coastal plain.
 *
 * Every wide shot had a sky that was a pure gradient: the Sky shader models scattering and
 * nothing else, so a 124 m vehicle stood against a flat blue-grey card. Boca Chica's sky on a
 * launch day is rarely empty — scattered low cumulus off the Gulf is the norm — and a cloud
 * field is also the cue the eye uses to read the height of the stack against the sky.
 *
 * The layer is a single dome that follows the camera, shaded per pixel: each view ray is
 * intersected with a flat cloud base 1.4 km up, and a few octaves of value noise over that
 * plane give the cover. Lit from the sun's side, flat-bottomed and darker underneath, fading
 * into the haze towards the horizon and away entirely with altitude, so it never sits in front
 * of anything. It is scenery, not data: no cloud here is a real cloud.
 */
import * as THREE from 'three';

const BASE = 1400;     // cloud base above the ground, m
const RADIUS = 4200;   // dome radius; inside the camera's far plane

export function createClouds(scene) {
  const uniforms = {
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uLight: { value: 1 },          // 1 by day, towards 0 at night
    uFade: { value: 1 },           // altitude and orbital fade
    uCover: { value: 0.53 },
    uSunColor: { value: new THREE.Color(1, 0.97, 0.92) },
    uShade: { value: new THREE.Color(0.66, 0.70, 0.77) },
  };
  const material = new THREE.ShaderMaterial({
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
      float h(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
      float n(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 5; i++) { s += a * n(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
        return s;
      }
      void main() {
        vec3 d = normalize(vDir);
        if (d.y < 0.012) discard;
        vec2 p = d.xz / d.y * ${BASE.toFixed(1)};           // where the ray meets the cloud base
        float base = fbm(p / 2600.0);
        float detail = fbm(p / 640.0 + 3.1);
        float c = base * 0.72 + detail * 0.38;
        float cover = smoothstep(uCover, uCover + 0.07, c);
        if (cover < 0.004) discard;
        // Thicker in the middle of a cloud: brighter tops towards the sun, grey flat bases.
        float thick = smoothstep(uCover, uCover + 0.34, c);
        vec2 toSun = normalize(uSun.xz + 1e-4);
        float lit = clamp(0.55 + 0.9 * (fbm((p + toSun * 260.0) / 640.0 + 3.1) - detail) * -1.0 + 0.35 * uSun.y, 0.0, 1.0);
        vec3 col = mix(uShade, uSunColor, mix(0.45, 1.0, lit) * (1.0 - 0.30 * thick));
        float silver = pow(max(dot(d, normalize(uSun)), 0.0), 18.0) * (1.0 - thick);
        col += uSunColor * silver * 0.6;
        col *= mix(0.08, 1.0, uLight);
        // Into the haze near the horizon: far clouds are low-contrast and then gone.
        float horizon = smoothstep(0.04, 0.26, d.y);
        gl_FragColor = vec4(col, cover * horizon * uFade * 0.92);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 24), material);
  dome.name = 'clouds';
  dome.frustumCulled = false;
  dome.renderOrder = -1;        // after the sky dome, before everything else
  scene.add(dome);

  return {
    mesh: dome,
    follow(camera) { dome.position.copy(camera.position); },
    /** @param sunDir unit vector; night 0..1; altitude m; visible false in the orbital view */
    update(sunDir, night, altitude, visible = true) {
      uniforms.uSun.value.copy(sunDir);
      uniforms.uLight.value = 1 - night;
      const warm = Math.pow(1 - THREE.MathUtils.clamp(sunDir.y / 0.5, 0, 1), 3);
      uniforms.uSunColor.value.setRGB(1, 0.97 - 0.12 * warm, 0.92 - 0.25 * warm);
      // A layer 1.4 km up cannot be seen from below once the camera has climbed through it.
      uniforms.uFade.value = (1 - THREE.MathUtils.smoothstep(altitude, 700, BASE)) * (1 - night * 0.9);
      dome.visible = visible && uniforms.uFade.value > 0.01;
    },
  };
}
