/**
 * The real ground beyond the centre's disc: the heights and the colour of the land round Boca
 * Chica and under the X-15's route, from public tiles (tools/terrain-fetch.mjs has the sources
 * and builds src/data/terrainTiles.js and the two atlases):
 *
 *   near  Web Mercator zoom 13, 8 × 8 tiles (≈35 km square) round the pad, ≈17 m a pixel and a
 *         height every ≈275 m;
 *   far   zoom 10, 10 × 9 tiles (≈350 × 320 km) from the Gulf to past the drop point 300 km
 *         north-west, ≈138 m a pixel and a height every ≈2.2 km.
 *
 * Ground only: the imagery is a photograph laid on the relief, nothing stands on it. Laid out
 * in the scene by the same azimuthal equidistant map about the pad that the X-15's flight and
 * the launch's globe use (x15Fly.js trackToScene, plume.js FlightEarth), and bent down round
 * the camera the way that globe is: a sphere of the Earth's radius whose top is under the
 * camera. It is shaded with the globe's light and its haze, so the two meet at its edge, and
 * the scene's fog takes over near the ground as it does on the disc. Inside the disc (its
 * radius times its ascent stretch) it is not drawn: the disc is the ground there.
 */
import * as THREE from 'three';
import { tileToGeo, geoToScene } from './geoMap.js';
import { TERRAIN_TILES } from '../data/terrainTiles.js';

const R_EARTH = 6371000;

function decodeHeights(b64) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dv = new DataView(bytes.buffer), out = new Float32Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = dv.getInt16(i * 2, true) / 10;
  return out;
}

/** One region's mesh: a vertex per height sample, in scene coordinates about the pad. */
function regionGeometry(R, padX, padZ) {
  const W = R.nx * R.step + 1, H = R.ny * R.step + 1;
  const h = decodeHeights(R.heights);
  const pos = new Float32Array(W * H * 3), uv = new Float32Array(W * H * 2);
  for (let b = 0; b < H; b++) {
    for (let a = 0; a < W; a++) {
      const k = b * W + a;
      const [lat, lon] = tileToGeo(R.x0 + a / R.step, R.y0 + b / R.step, R.z);
      const [dx, dz] = geoToScene(lat, lon);
      pos[k * 3] = padX + dx; pos[k * 3 + 1] = h[k]; pos[k * 3 + 2] = padZ + dz;
      uv[k * 2] = a / (W - 1); uv[k * 2 + 1] = 1 - b / (H - 1);
    }
  }
  const idx = [];
  for (let b = 0; b < H - 1; b++) {
    for (let a = 0; a < W - 1; a++) {
      const p = b * W + a, q = p + W;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const VERT = /* glsl */`
  #include <fog_pars_vertex>
  uniform vec2 uCam;
  varying vec2 vUv;
  varying vec3 vW, vNrm;
  void main() {
    vec3 p = position;
    // The globe's surface under the camera: a sphere of the Earth's radius whose top is at the
    // camera's foot, so the drop at ρ is ρ² / (R + √(R² − ρ²)).
    vec2 d = p.xz - uCam;
    float r2 = dot(d, d);
    p.y -= r2 / (${R_EARTH.toFixed(1)} + sqrt(max(${(R_EARTH * R_EARTH).toExponential(6)} - r2, 0.0)));
    vW = p;
    vNrm = normal;
    vUv = uv;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */`
  #include <fog_pars_fragment>
  uniform sampler2D uMap;
  uniform float uLoaded, uHole, uEdge, uOpacity;
  uniform vec2 uCam;
  uniform vec3 uSun, uCamPos;
  uniform vec4 uCut;   // the near region's box in this one's uv (empty for the near region)
  varying vec2 vUv;
  varying vec3 vW, vNrm;
  void main() {
    if (length(vW.xz) < uHole) discard;
    if (vUv.x > uCut.x && vUv.x < uCut.z && vUv.y > uCut.y && vUv.y < uCut.w) discard;
    // Fades out over its outer edge, onto the globe.
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float a = uEdge > 0.0 ? smoothstep(0.0, uEdge, edge) : 1.0;
    vec3 alb = uLoaded > 0.5 ? texture2D(uMap, vUv).rgb : vec3(0.16, 0.17, 0.11);
    // The globe's light (plume.js EARTH_FRAG): the land a little brighter than the mosaic's.
    vec3 n = normalize(vNrm);
    float diff = max(dot(n, uSun), 0.0);
    vec3 c = alb * 1.25 * (0.08 + 1.1 * diff);
    // And its haze, for the air below the camera; nothing at the ground, where the fog is.
    vec3 up = normalize(vec3(vW.x - uCam.x, vW.y + ${R_EARTH.toFixed(1)}, vW.z - uCam.y));
    vec3 v = normalize(uCamPos - vW);
    float mu = clamp(dot(up, v), 0.0, 1.0);
    float tau = 0.35 * (1.0 - exp(-max(uCamPos.y, 0.0) / 8500.0));
    float haze = 1.0 - exp(-tau / max(mu, 0.035));
    vec3 air = vec3(0.52, 0.66, 0.88) * mix(0.34, 1.0, smoothstep(0.35, 0.03, mu));
    c = mix(c, air * (0.3 + 0.9 * diff), haze);
    gl_FragColor = vec4(c, a * uOpacity);
    #include <fog_fragment>
  }`;

/**
 * @param {object} o
 * @param {number} o.padX, o.padZ  the pad in the scene, where the map is anchored
 * @returns {{ group, update(camera, sunDir, { hole, visible }) }}
 */
export function buildRealTerrain({ padX, padZ }) {
  const group = new THREE.Group();
  group.name = 'real-terrain';
  const regions = {};
  for (const [name, R] of Object.entries(TERRAIN_TILES)) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uMap: { value: null }, uLoaded: { value: 0 }, uHole: { value: 0 }, uEdge: { value: 0 }, uOpacity: { value: 1 },
      uCam: { value: new THREE.Vector2() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uCamPos: { value: new THREE.Vector3() },
      uCut: { value: new THREE.Vector4(2, 2, -2, -2) },
    }]);
    const far = name === 'far';
    const mat = new THREE.ShaderMaterial({
      name: `real-terrain-${name}`, uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true,
      transparent: far, depthWrite: true,
      // Its sea sits just above the globe's (0.3 m in the flight, 40 m in the launch): pulled
      // forward in depth so the globe never shows through it at a distance.
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    if (far) uniforms.uEdge.value = 0.05;
    const m = new THREE.Mesh(regionGeometry(R, padX, padZ), mat);
    m.name = `real-terrain-${name}`;
    m.frustumCulled = false;   // bent in the vertex shader: its bounding sphere is the flat one
    m.renderOrder = far ? 0 : -2;
    group.add(m);
    regions[name] = { R, m, uniforms };
    if (typeof Image !== 'undefined') {
      new THREE.TextureLoader().load(new URL(`../assets/terrain/${name}.jpg`, import.meta.url).href, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.name = `real-terrain-${name}`;
        uniforms.uMap.value = tex;
        uniforms.uLoaded.value = 1;
      });
    }
  }
  // The far region leaves out what the near one covers.
  if (regions.near && regions.far) {
    const N = regions.near.R, F = regions.far.R, k = 2 ** (N.z - F.z);
    const u0 = (N.x0 / k - F.x0) / F.nx, u1 = ((N.x0 + N.nx) / k - F.x0) / F.nx;
    const v0 = 1 - ((N.y0 + N.ny) / k - F.y0) / F.ny, v1 = 1 - (N.y0 / k - F.y0) / F.ny;
    regions.far.uniforms.uCut.value.set(u0, v0, u1, v1);
  }

  function update(camera, sunDir, { hole = 0, visible = true } = {}) {
    group.visible = visible;
    if (!visible) return;
    for (const { uniforms: u } of Object.values(regions)) {
      u.uCam.value.set(camera.position.x, camera.position.z);
      u.uCamPos.value.copy(camera.position);
      if (sunDir) u.uSun.value.copy(sunDir);
      u.uHole.value = hole;
    }
  }
  // Where the terrain is fully drawn, past the far region's fading edge: the globe leaves it to
  // the terrain (FlightEarth.setCut).
  const F = TERRAIN_TILES.far, inset = 0.06;
  const [latN, lonW] = tileToGeo(F.x0 + inset * F.nx, F.y0 + inset * F.ny, F.z);
  const [latS, lonE] = tileToGeo(F.x0 + (1 - inset) * F.nx, F.y0 + (1 - inset) * F.ny, F.z);
  const cover = [lonW, latS, lonE, latN];
  return { group, update, regions, cover, get visible() { return group.visible; } };
}
