/**
 * The haze lit by a low sun (audit of 8-11-2026, §36). The scene's fog is one colour all round,
 * so with the Sun a few degrees up the horizon under it was the same blue-grey as the horizon
 * behind the camera, and a sunset read only by its shadows. Aerosol scatters sunlight forward:
 * the haze looking towards a low sun is brighter and takes the beam's colour (sunlight.js), the
 * haze looking away does not. Here the fog colour gains a forward lobe towards the Sun:
 *
 *   fog = fogColor + tint · max(0, v·s)^LOBE
 *
 * with v the direction from the camera to the fragment and s the Sun's, both in view space, and
 * `tint` the difference between the sunlit haze (the beam's colour at the haze's brightness,
 * HAZE_GAIN brighter) and the plain fog, faded in as the Sun gets low (below ≈25°). The cos⁶
 * lobe is a cheap stand-in chosen to look like the forward peak of aerosol scattering (a
 * Henyey–Greenstein phase of g ≈ 0.7 is the usual figure); it is NOT that function — its width
 * and fall-off differ — and LOBE, HAZE_GAIN and the 25° fade are set by eye. A visual approximation
 * with physical ingredients, not a radiative-transfer result (external audit 8-11, finding 09). One patch of three.js's own fog chunks, so every material's haze
 * changes together — no seam between the materials that have it and those that do not.
 *
 * The two uniforms are shared by reference (Float32Arrays are not cloned per material by
 * three.js, unlike Vector3), so one write a frame reaches every program. A material whose program
 * does not carry them (a ShaderMaterial with fog) reads zero: no lobe, the plain fog as before.
 */
import * as THREE from 'three';
import { TAU } from './sunlight.js';

export const FOG_SUN = { dir: new Float32Array([0, 1, 0]), tint: new Float32Array(3) };
export const LOBE = 6, HAZE_GAIN = 1.5;
let installed = false;

/** Patches the fog chunks and adds the shared uniforms to every built-in shader. Once, before any compile. */
export function installFogSun() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  // Every replacement must find its line: a three.js update that rewords a chunk would otherwise
  // drop the lobe silently (external audit 8-11, finding 10). It throws at start-up instead.
  const patch = (name, from, to) => {
    const next = C[name].replace(from, to);
    if (next === C[name]) throw new Error(`fogSun: three.js chunk ${name} no longer has the line it patches`);
    C[name] = next;
  };
  patch('fog_pars_vertex', 'varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying vec3 vFogDir;');
  patch('fog_vertex', 'vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z;\n\tvFogDir = mvPosition.xyz;');
  patch('fog_pars_fragment', 'uniform vec3 fogColor;', 'uniform vec3 fogColor;\n\tuniform vec3 fogSunDir;\n\tuniform vec3 fogSunTint;\n\tvarying vec3 vFogDir;');
  // Per wavelength (9-11-2026, block 3): the haze hides each channel by its own optical depth, the
  // sun's (sunlight.js TAU: Rayleigh + aerosol at 650/550/450 nm) relative to green, so with distance
  // blue goes first, as aerial perspective does. fogFactor is green's; the others follow
  // 1 − (1 − f)^k. A one-layer stand-in for a sky-and-aerial-perspective model, not one (≈).
  const k = TAU.map((t) => (t / TAU[1]).toFixed(4));
  patch('fog_fragment', 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
    `vec3 fogLit = fogColor + fogSunTint * pow( max( dot( normalize( vFogDir ), fogSunDir ), 0.0 ), ${LOBE.toFixed(1)} );
\tvec3 fogF = 1.0 - pow( vec3( 1.0 - clamp( fogFactor, 0.0, 1.0 ) ), vec3( ${k[0]}, ${k[1]}, ${k[2]} ) );
\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogLit, fogF );`);
  for (const name of Object.keys(THREE.ShaderLib)) {
    const u = THREE.ShaderLib[name].uniforms;
    if (u && u.fogColor) { u.fogSunDir = { value: FOG_SUN.dir }; u.fogSunTint = { value: FOG_SUN.tint }; }
  }
}

const _d = new THREE.Vector3();
/**
 * The lobe's tint for a Sun `elevDeg` up whose beam is `tintRGB` (sunlight.js), over a fog of
 * colour `fog` (linear): the sunlit haze minus the plain one, faded in below 25°. Pure.
 */
export function lobeTint(elevDeg, tintRGB, fog) {
  const low = THREE.MathUtils.smoothstep(25 - elevDeg, 0, 21);   // 0 at 25°, 1 at 4°
  const L = 0.2126 * fog.r + 0.7152 * fog.g + 0.0722 * fog.b;
  const lt = 0.2126 * tintRGB[0] + 0.7152 * tintRGB[1] + 0.0722 * tintRGB[2];
  const want = tintRGB.map((c) => c / lt * L * HAZE_GAIN);
  return [want[0] - fog.r, want[1] - fog.g, want[2] - fog.b].map((v) => v * low);
}
/** Per frame: the Sun's direction in the camera's view space, and the lobe's tint. */
export function updateFogSun(camera, sunDir, elevDeg, tintRGB, fog) {
  _d.copy(sunDir).transformDirection(camera.matrixWorldInverse);
  FOG_SUN.dir[0] = _d.x; FOG_SUN.dir[1] = _d.y; FOG_SUN.dir[2] = _d.z;
  const t = lobeTint(elevDeg, tintRGB, fog);
  FOG_SUN.tint[0] = t[0]; FOG_SUN.tint[1] = t[1]; FOG_SUN.tint[2] = t[2];
}
