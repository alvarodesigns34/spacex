/**
 * The curved Earth under the high part of a flight (the launch's ascent, the re-entry), moved
 * out of plume.js unchanged (8-11-2026, refactor §36); plume.js re-exports it.
 */
import * as THREE from 'three';
import { GULF, LAUNCH_SITE } from '../data/gulf.js';

/**
 * Above a few kilometres the 5 km ground disc is a coin under the vehicle and the frame was
 * dark navy to the edges. From 80 km the horizon is 1 000 km away and dips 9° below level: a
 * curved, sunlit Earth with a blue limb over it, which is what every onboard view shows.
 * This is that: a sphere of the Earth's real radius under the camera, lit by the scene's sun,
 * hazing to sky-blue towards the horizon, with a limb shell of scattered light round it, faded
 * in from 9 to 20 km. Its surface is the real one round Starbase: the Gulf of Mexico's
 * coastlines and NASA's Blue Marble colour (data/gulf.js), placed by carrying the pad's
 * geographic frame along the great circle to the point under the camera, with the scene's
 * downrange axis on the launch azimuth. The ship's plume points at Florida and Cuba as it
 * climbs over the Gulf. Clouds stay generic noise (weather is not a map), and so does the
 * surface outside the mapped box or until the picture has loaded.
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
  uniform float uOpacity, uMapped, uOcean;
  uniform mat3 uGeo;
  uniform sampler2D uColour, uLand;
  uniform vec4 uBox;   // lon0, lat0, lon span, lat span (radians)
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
    // Open ocean only, for the re-entry over the northern Pacific: no map there, and no
    // invented continents either.
    float land = uOcean > 0.5 ? -1.0 : fbm3(n * 9.0 + 3.1) - 0.56;
    float cloud = smoothstep(0.52, 0.72, fbm3(n * 22.0 + vec3(7.0, 1.0, 4.0)));
    vec3 ocean = vec3(0.02, 0.09, 0.2);
    vec3 ground = mix(vec3(0.16, 0.18, 0.1), vec3(0.34, 0.3, 0.2), fbm3(n * 40.0));
    vec3 c = land > 0.0 ? ground : ocean;
    float water = land > 0.0 ? 0.0 : 1.0;
    // The mapped surface: the point's latitude and longitude from the carried geographic frame.
    vec3 e = uGeo * n;
    vec2 uv = (vec2(atan(e.y, e.x), asin(clamp(e.z, -1.0, 1.0))) - uBox.xy) / uBox.zw;
    float inBox = uMapped * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    if (inBox > 0.0) {
      vec3 bm = texture2D(uColour, uv).rgb;
      float isLand = smoothstep(0.35, 0.65, texture2D(uLand, uv).r);
      // Deep water is one colour: the mosaic's open ocean is near-black with visible tile
      // seams. Only its shallow banks (Bahamas, Yucatán, Florida Keys) come through, by how far
      // their green rises over the deep water's.
      float shallow = smoothstep(0.006, 0.04, bm.g);
      vec3 sea = mix(vec3(0.010, 0.032, 0.085), bm * 2.4, shallow);
      c = mix(sea, bm * 2.1, isLand);
      water = 1.0 - isLand;
    }
    c = mix(c, vec3(0.86, 0.88, 0.9), cloud * 0.85);
    float diff = max(dot(n, uSun), 0.0);
    c *= 0.08 + 1.1 * diff;
    // Sun glint off open water, the bright patch in every photograph of the Gulf from orbit.
    vec3 vv = normalize(uCam - vW);
    float glint = pow(max(dot(normalize(uSun + vv), n), 0.0), 380.0) * water * (1.0 - cloud) * step(0.0, dot(n, uSun));
    c += vec3(1.0, 0.97, 0.9) * glint * 0.9;
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
    // The air's own light is dimmer looking down through one air mass than along the horizon,
    // where the path is long and the limb glows: at full sky brightness straight down the
    // veil turned the Gulf pale grey-blue, where every photograph from orbit has it navy.
    vec3 air = vec3(0.52, 0.66, 0.88) * mix(0.34, 1.0, smoothstep(0.35, 0.03, mu));
    c = mix(c, air * (0.3 + 0.9 * diff), haze);
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
  /** @param {object} [o] ocean: true draws open ocean everywhere and skips the Gulf map */
  constructor({ ocean = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'flight-earth';
    this.group.visible = false;
    const d2r = THREE.MathUtils.DEG2RAD;
    const uni = {
      uCentre: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uOpacity: { value: 0 },
      uGeo: { value: new THREE.Matrix3() }, uMapped: { value: 0 }, uOcean: { value: ocean ? 1 : 0 },
      uColour: { value: null }, uLand: { value: null },
      uBox: { value: new THREE.Vector4(GULF.lon0 * d2r, GULF.lat0 * d2r, (GULF.lon1 - GULF.lon0) * d2r, (GULF.lat1 - GULF.lat0) * d2r) },
    };
    this.u = uni;
    // The pad's frame in Earth-centred coordinates (x to 0° E on the equator, z to the north
    // pole): the scene's +X on the launch azimuth, +Y up, +Z = X × Y.
    const la = LAUNCH_SITE.lat * d2r, lo = LAUNCH_SITE.lon * d2r, az = LAUNCH_SITE.azimuthDeg * d2r;
    const east = new THREE.Vector3(-Math.sin(lo), Math.cos(lo), 0);
    const north = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la));
    const up = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
    const x = east.clone().multiplyScalar(Math.sin(az)).addScaledVector(north, Math.cos(az));
    this.padFrame = new THREE.Matrix4().makeBasis(x, up, x.clone().cross(up));
    this.origin = new THREE.Vector2();
    this._rot = new THREE.Matrix4();
    this._axis = new THREE.Vector3();
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

  /** The pad's position in the scene, where the geographic frame is anchored. */
  setOrigin(x, z) { this.origin.set(x, z); }

  /** Draws the land mask from the coastline rings and loads the colour mosaic, once. */
  loadMap() {
    if (this.u.uLand.value || this.noMap || this.u.uOcean.value > 0.5) return;
    const W = 2048, H = Math.round(W * (GULF.lat1 - GULF.lat0) / (GULF.lon1 - GULF.lon0));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext?.('2d');
    // Headless checks run the sequence under Node with a stand-in canvas: keep the generic surface.
    if (typeof g?.fillRect !== 'function' || typeof Image === 'undefined') { this.noMap = true; return; }
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const sx = W / ((GULF.lon1 - GULF.lon0) * GULF.q), sy = H / ((GULF.lat1 - GULF.lat0) * GULF.q);
    g.beginPath();
    for (const r of GULF.rings) {
      let px = r[0], py = r[1];
      g.moveTo(px * sx, H - py * sy);
      for (let i = 2; i < r.length; i += 2) { px += r[i]; py += r[i + 1]; g.lineTo(px * sx, H - py * sy); }
      g.closePath();
    }
    g.fillStyle = '#fff'; g.fill('evenodd');
    const land = new THREE.CanvasTexture(cv);
    land.name = 'flight-earth-land';
    this.u.uLand.value = land;
    new THREE.TextureLoader().load(new URL('../assets/earth/gulf-bmng.jpg', import.meta.url).href, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.name = 'flight-earth-colour';
      this.u.uColour.value = tex;
      this.u.uMapped.value = 1;
    });
  }

  /** Follows the camera over the ground; fades in with the camera's altitude. */
  update(camera, sunDir, altitude) {
    const k = THREE.MathUtils.smoothstep(altitude, 9000, 20000);
    this.group.visible = k > 0.001;
    if (!this.group.visible) return;
    this.loadMap();
    // Carry the pad's frame along the great circle to the point under the camera: a turn of
    // (ground distance / R) about the axis at right angles to the way the camera has gone.
    const dx = camera.position.x - this.origin.x, dz = camera.position.z - this.origin.y;
    const d = Math.hypot(dx, dz);
    this._rot.identity();
    if (d > 1) {
      this._axis.set(dz / d, 0, -dx / d).transformDirection(this.padFrame);
      this._rot.makeRotationAxis(this._axis, d / EARTH_R);
    }
    this.u.uGeo.value.setFromMatrix4(this._rot.multiply(this.padFrame));
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
