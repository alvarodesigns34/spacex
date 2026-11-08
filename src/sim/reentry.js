/**
 * Re-entry chapter: Starship's return on flight 14, from half a minute before the entry
 * interface to the splash in the northern Pacific (reentryFlight.js has the trajectory and
 * its sources). The ship leaves the exhibit for the chapter and comes back to it after.
 *
 * What the chapter shows, and on what authority:
 *  - the times, the landing flip and the 3 → 2 → 1 engine sequence: SpaceX's flight 14
 *    timeline (cited);
 *  - speed, height and attitude: the solved model (≈), not telemetry;
 *  - the plasma: its strength follows the Sutton–Graves heating index of the same model; its
 *    colours (violet-pink high up, orange at the peak, on the windward belly and the flap
 *    edges, a glowing trail behind) are those of SpaceX's on-board re-entry views of flights
 *    6 to 14 (reference only, ≈);
 *  - the open ocean round the splash: generic, no coastline anywhere near.
 *
 * The scene is floating-origin: the ship stays over the scene's origin and the ocean, the
 * splash point and the globe move under it, so a ≈5 400 km glide keeps single-precision
 * vertices steady.
 */
import * as THREE from 'three';
import { Plume, Vapor, Glow, FlightEarth } from './plume.js';
import { RE, CHAPTER, MILESTONES_RE, reentryState, reentryPitchAt, reentryEnginesAt, heatingAt, toSplashAt, densityAt } from './reentryFlight.js';
import { sourceMaterial } from '../core/localProbes.js';
import { WAVES, OPEN_SEA_AMP, oceanGLSL, oceanPhases, openOceanHeight } from '../core/ocean.js';

// ---- Plasma ------------------------------------------------------------------------------
const PLASMA_VERT = /* glsl */`
  varying vec3 vN, vV, vL;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    // World normal through the inverse transpose: the sheath is scaled unevenly (1,25 × 1 × 1,05).
    vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
    vV = normalize(cameraPosition - w.xyz);
    vL = position;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const PLASMA_FRAG = /* glsl */`
  uniform float uHeat, uTime, uLen;
  uniform vec3 uFlow, uCool, uHot;
  varying vec3 vN, vV, vL;
  float h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    // Brightest where the shell faces into the flow (the windward belly), and at the rim.
    // Interpolated normals are not unit length: normalise, and clamp before pow(), whose
    // result for a negative base is NaN, which the bloom spreads into black blocks.
    vec3 n = normalize(vN), v = normalize(vV);
    float face = clamp(dot(n, -uFlow), 0.0, 1.0);
    float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 2.2);
    float flick = 0.65 + 0.7 * n3(vL * 0.18 + vec3(0.0, uTime * 9.0, uTime * 3.0));
    float streak = 0.6 + 0.8 * n3(vec3(vL.x * 0.4, vL.y * 0.05 - uTime * 14.0, vL.z * 0.4));
    // Only the windward side burns: the lee side of the sheath, between an on-board camera and
    // the hull, stays clear, and the glow shows at the windward silhouette.
    float k = pow(face, 1.4) * (0.5 + 1.2 * rim) * flick * streak;
    vec3 col = mix(uCool, uHot, smoothstep(0.25, 0.9, uHeat));
    gl_FragColor = vec4(col * k * uHeat * 1.1, 1.0);
  }`;
const WAKE_FRAG = /* glsl */`
  uniform float uHeat, uTime;
  uniform vec3 uCool, uHot;
  varying vec2 vUv;
  varying vec3 vN, vV;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    // vUv.y: 1 at the ship, 0 at the tail; vUv.x round the cone.
    // Falls away exponentially behind the ship rather than ending at the cone's base.
    float along = (exp(-3.2 * (1.0 - clamp(vUv.y, 0.0, 1.0))) - 0.04) * (1.0 - smoothstep(0.86, 1.0, vUv.y));   // edges in order: GLSL leaves smoothstep(a > b) undefined
    // A glowing column, not a pipe: bright where the eye looks through most of it, fading to
    // nothing at its silhouette. The silhouette is pushed in and out by eddies carried down the
    // trail, so it frays instead of drawing the cone's two straight edges against the sky.
    float eddy = n2(vec2(vUv.x * 5.0, vUv.y * 9.0 - uTime * 4.0)) * 0.6 + n2(vec2(vUv.x * 13.0 + 3.1, vUv.y * 27.0 - uTime * 11.0)) * 0.4;
    float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    float edge = smoothstep(0.08, 0.85, facing + (eddy - 0.5) * 0.55) * facing;
    float turb = 0.45 + 1.1 * (n2(vec2(vUv.x * 7.0, vUv.y * 22.0 - uTime * 6.0)) * 0.6 + eddy * 0.4);
    vec3 col = mix(uCool, uHot, smoothstep(0.3, 1.0, uHeat) * (0.4 + vUv.y * 0.6));
    gl_FragColor = vec4(col * along * edge * turb * uHeat * 0.9, 1.0);
  }`;
const WAKE_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vN, vV;
  void main() {
    vUv = uv;
    // In view space, with the normal matrix: the cone is scaled very unevenly (tens of metres
    // across, kilometres long), and mat3(modelMatrix) bent its normals towards the axis, so its
    // silhouette never turned edge-on and the trail ended in two hard straight lines.
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalMatrix * normal;
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;

const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

export function createReentry({ scene, exhibits, complex, env, rig, camera, M, onStart = () => {}, onState = () => {}, onFinish = () => {}, visibilityHook = null }) {
  const ship = exhibits.starship.model.getObjectByName('ship');
  const root = new THREE.Group();
  root.name = 'reentry';
  root.visible = false;
  scene.add(root);

  // The ship pivots about its centre of mass, ≈40 % up its 52 m (≈), not about its engines.
  const SHIP_H = 52.12, COM = 0.4 * SHIP_H;
  const holder = new THREE.Group();            // at the centre of mass, turned to the attitude
  holder.name = 'reentry-ship';
  root.add(holder);
  const mount = new THREE.Group();             // the ship's own frame, engines at its origin
  mount.position.y = -COM;
  holder.add(mount);

  // Plasma sheath round the hull and a glowing trail behind it.
  const plasmaU = {
    uHeat: { value: 0 }, uTime: { value: 0 }, uLen: { value: SHIP_H },
    uFlow: { value: new THREE.Vector3(1, 0, 0) }, uCool: { value: lin(0xb45cff) }, uHot: { value: lin(0xff8a3a) },
  };
  const plasmaMat = new THREE.ShaderMaterial({ uniforms: plasmaU, vertexShader: PLASMA_VERT, fragmentShader: PLASMA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
  const sheath = new THREE.Mesh(new THREE.CapsuleGeometry(6.2, SHIP_H - 6, 8, 32), plasmaMat);
  sheath.name = 'reentry-plasma';
  sheath.position.set(0, SHIP_H / 2 - 1, 1.2);
  sheath.scale.set(1.25, 1, 1.05);            // the flaps stand out ±9,5 m either side
  sheath.renderOrder = 5;
  mount.add(sheath);
  const wakeU = { uHeat: { value: 0 }, uTime: { value: 0 }, uCool: { value: lin(0xc070ff) }, uHot: { value: lin(0xff7a2a) } };
  const wakeGeo = new THREE.CylinderGeometry(0.5, 1.3, 1, 32, 12, true);
  wakeGeo.translate(0, -0.5, 0);               // from the ship (y = 0) back along −Y
  wakeGeo.rotateX(Math.PI / 2);                // −Y → +Z: lookAt points −Z at the target
  const wake = new THREE.Mesh(wakeGeo, new THREE.ShaderMaterial({ uniforms: wakeU, vertexShader: WAKE_VERT, fragmentShader: WAKE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide }));
  wake.name = 'reentry-wake';
  wake.renderOrder = 5;
  root.add(wake);
  // Plasma streaming off the four flap tips, the brightest thing in the on-board views: a
  // thinner trail of the same kind from each tip. Tips are found on the model at start.
  const flapTrails = [0, 1, 2, 3].map((i) => {
    const m = new THREE.Mesh(wakeGeo, new THREE.ShaderMaterial({ uniforms: wakeU, vertexShader: WAKE_VERT, fragmentShader: WAKE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.name = `reentry-flap-trail-${i}`;
    m.renderOrder = 6;
    m.visible = false;
    root.add(m);
    return { mesh: m, tip: new THREE.Vector3() };
  });
  function findFlapTips() {
    const flaps = [];
    ship.updateMatrixWorld(true);
    const inv = ship.matrixWorld.clone().invert(), b = new THREE.Box3(), mm = new THREE.Matrix4();
    ship.traverse((o) => {
      if (!o.isMesh || sourceMaterial(o.material) !== M.steelFlap || /hinge/.test(o.name)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      b.copy(o.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(inv, o.matrixWorld));
      const c = b.getCenter(new THREE.Vector3());
      const side = Math.sign(c.x) || 1;
      flaps.push(new THREE.Vector3(side > 0 ? b.max.x : b.min.x, c.y, c.z));
    });
    flaps.sort((a, b2) => a.y - b2.y || a.x - b2.x);
    flapTrails.forEach((ft, i) => { if (flaps[i]) ft.tip.copy(flaps[i]); ft.ok = !!flaps[i]; });
  }
  const glow = new Glow({ color: 0xffd2a8, edge: 0xff6a2a, name: 'reentry-glow', ragged: 0 });
  holder.add(glow.mesh);
  // No lights of its own: a light appearing with the chapter changes every lit material's
  // shader and recompiles them all at once (the stall the launch avoids, launch.js). The heat
  // shows as emissive on the ship's own materials instead (setHeatGlow).

  // The heat itself, on the ship: the windward tiles and the flaps glow orange as the plasma
  // heats them — the dull glow of the flap edges and the belly in SpaceX's on-board views.
  // Emissive on the ship's own materials (they are the ship's alone), restored afterwards. They
  // are gathered off the ship at each start, not taken from M: the local reflection probe gives
  // the ship private copies (localProbes.js), and lighting M's originals lit nothing it wears.
  const HEAT_SOURCES = new Set([M.tile, M.tpsShell, M.tileUnder, M.steelFlap].filter(Boolean));
  let heatMats = [];
  function collectHeatMats() {
    const seen = new Set();
    ship.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const src = sourceMaterial(m);
        if (!HEAT_SOURCES.has(src) || seen.has(m)) continue;
        seen.add(m);
        const flap = src === M.steelFlap;
        heatMats.push({ m, color: m.emissive.clone(), intensity: m.emissiveIntensity, flap, k: flap ? 0.35 : 1.5 });
      }
    });
  }
  const HEAT_COLOR = new THREE.Color(0xff5e1f);
  // The flaps' steel glows a duller, deeper red than the tiles: at 0.9 the whole flap went a
  // flat, saturated orange from on board, which read as paint rather than hot metal.
  const FLAP_HEAT = new THREE.Color(0xc7401c);
  function setHeatGlow(h) {
    for (const e of heatMats) {
      if (h > 0.01) { e.m.emissive.copy(e.flap ? FLAP_HEAT : HEAT_COLOR); e.m.emissiveIntensity = h * h * e.k; }
      else { e.m.emissive.copy(e.color); e.m.emissiveIntensity = e.intensity; }
    }
  }

  // The landing burn: the three sea-level Raptors, then two, then one.
  const plume = new Plume({ radius: 1.6, name: 'reentry-plume', fireCount: 90 });
  plume.group.remove(plume.light);
  mount.add(plume.group);

  // The ocean round the splash point, and the steam and spray there.
  const ocean = new THREE.Group();
  const _seaC = new THREE.Vector3();
  ocean.name = 'reentry-ocean';
  root.add(ocean);
  // The open sea moves (8-11-2026; until then a flat disc with drifting normal maps, so the ship
  // came down on a sheet of glass): the coast's six Gerstner waves (core/ocean.js) with no coast and
  // OPEN_SEA_AMP (≈ Hs 1.6 m, chosen), on a polar grid that follows the camera, 3 km across, in the
  // ocean's own frame — fixed to the water, so the splash point stays where it is in it — and the
  // splash's own waves on top: a ring running out from where the ship came down and a second from
  // the hull's slap (≈: the ring's speed is the foam's, a wave packet ≈1.3 m high fading over tens
  // of seconds; not measured). The flat 300 km disc beyond it gives way inside the grid. The foam
  // rides the same surface, and the hull floats on it.
  const SEA_R = 3000, SEA_NS = 256;
  const seaU = {
    uOceanPhase: { value: new Float32Array(WAVES.length) }, uCenter: { value: new THREE.Vector2() },
    uSeaR: { value: SEA_R }, uSeaSeg: { value: (2 * Math.PI) / SEA_NS }, uImpactAge: { value: -1 }, uSlapAge: { value: -1 },
  };
  const IMPACT_GLSL = /* glsl */`
uniform float uImpactAge, uSlapAge;
// A wave packet of height A at distance d from its source, age a (s): out at ≈5 m/s, spreading.
float vcPacket(float d, float a, float A) {
  float rf = 4.0 + 5.0 * a, w = 3.0 + 0.45 * a, q = (d - rf) / w;
  return A * exp(-a / 14.0) * exp(-q * q) * cos((d - rf) * 0.55);
}
float vcImpactH(vec2 p) {
  float h = 0.0;
  if (uImpactAge > 0.0) h += vcPacket(length(p), uImpactAge, 1.3);
  // The hull, 0–52 m along +x where it fell: a line source.
  if (uSlapAge > 0.0) h += vcPacket(length(vec2(p.x - clamp(p.x, 0.0, 52.0), p.y)), uSlapAge, 1.0);
  return h;
}
vec2 vcImpactG(vec2 p) {
  const float e = 0.4;
  return vec2(vcImpactH(p + vec2(e, 0.0)) - vcImpactH(p - vec2(e, 0.0)), vcImpactH(p + vec2(0.0, e)) - vcImpactH(p - vec2(0.0, e))) / (2.0 * e);
}`;
  const OPEN_GLSL = oceanGLSL({ open: true });
  {
    // 300 km across: below 15 km its edge is far out in the haze.
    const g = new THREE.CircleGeometry(300000, 128);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
    // Open ocean: deep blue, the Gulf's wave normals at a gentler slope. The coast's sea
    // material grades by distance offshore (an attribute this disc has no use for).
    const mat = new THREE.MeshStandardMaterial({ name: 'reentry-ocean', color: 0x0f3550, roughness: 0.12, metalness: 0, normalMap: M.water?.normalMap ?? null, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.9 });
    const waves = mat.clone();
    waves.name = 'reentry-ocean-waves';
    // The flat disc: nothing inside the moving grid.
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uCenter: seaU.uCenter, uSeaR: seaU.uSeaR });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSeaO;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaO = vec2(position.x, -position.y);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vSeaO;\nuniform vec2 uCenter; uniform float uSeaR;')
        .replace('void main() {', 'void main() {\n  if (length(vSeaO - uCenter) < uSeaR * 0.995) discard;');
    };
    mat.customProgramCacheKey = () => 'reentry-sea-flat';
    const sea = new THREE.Mesh(g, mat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.05;
    sea.name = 'reentry-sea';
    sea.receiveShadow = false;
    ocean.add(sea);

    // The moving grid: rings 0.5 m apart under the camera, as long radially as they are wide further out.
    const seg = (2 * Math.PI) / SEA_NS, rings = [];
    for (let r = 0.5; r < SEA_R; r += Math.max(0.5, r * seg)) rings.push(r);
    rings.push(SEA_R);
    const pp = new Float32Array((1 + rings.length * SEA_NS) * 3), idx = [];
    rings.forEach((r, j) => { for (let i = 0; i < SEA_NS; i++) { const k = 1 + j * SEA_NS + i, a = i * seg; pp[k * 3] = Math.cos(a) * r; pp[k * 3 + 2] = Math.sin(a) * r; } });
    for (let i = 0; i < SEA_NS; i++) idx.push(0, 1 + ((i + 1) % SEA_NS), 1 + i);
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < SEA_NS; i++) {
      const a0 = 1 + j * SEA_NS + i, a1 = 1 + j * SEA_NS + ((i + 1) % SEA_NS), b0 = a0 + SEA_NS, b1 = a1 + SEA_NS;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const nn = new Float32Array(pp.length);
    for (let i = 1; i < nn.length; i += 3) nn[i] = 1;
    gg.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    const guv = new Float32Array((pp.length / 3) * 2);
    for (let i = 0; i < pp.length / 3; i++) { guv[i * 2] = pp[i * 3]; guv[i * 2 + 1] = -pp[i * 3 + 2]; }
    gg.setAttribute('uv', new THREE.BufferAttribute(guv, 2));
    gg.setIndex(idx);
    gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SEA_R + 5);
    waves.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, seaU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
uniform vec2 uCenter;
uniform float uSeaR, uSeaSeg;
${OPEN_GLSL}
${IMPACT_GLSL}`)
        .replace('#include <beginnormal_vertex>', `
  vec2 vcP = position.xz + uCenter;
  float vcR = length(position.xz);
  float vcFade = 1.0 - smoothstep(uSeaR * 0.55, uSeaR * 0.9, vcR);
  vec3 vcN;
  vec3 vcO = vcOcean(vcP, max(0.5, vcR * uSeaSeg), ${OPEN_SEA_AMP.toFixed(2)} * vcFade, vcN);
  vcO.y += vcImpactH(vcP) * vcFade;
  vec2 vcG = vcImpactG(vcP) * vcFade;
  vec3 objectNormal = normalize(vcN + vec3(-vcG.x, 0.0, -vcG.y));`)
        .replace('#include <begin_vertex>', `
  vec3 transformed = position + vcO;
#ifdef USE_NORMALMAP
  vNormalMapUv = (normalMapTransform * vec3(vcP.x, -vcP.y, 1.0)).xy;
#endif`);
    };
    waves.customProgramCacheKey = () => 'reentry-sea-waves';
    const grid = new THREE.Mesh(gg, waves);
    grid.name = 'reentry-sea-waves';
    grid.frustumCulled = false;
    grid.receiveShadow = false;
    grid.userData.rings = rings.length;
    ocean.add(grid);
    seaU.grid = grid;
  }
  // The hull comes down flat on the water (reentryPitchAt: it topples from T+1,5 s for 5 s).
  const SLAP = RE.splash + 6.5;
  let seed = 0x5eed;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const spray = new Vapor({
    name: 'reentry-spray', rng, accel: [0.8, -0.2, 0.3], tau: 1.1, opacity: 0.5,
    emitters: [
      // Exhaust on the water: a spreading skirt of steam and spray under the last metres.
      { at: [0, 0.5, 0], dir: [0, 0.35, 0], speed: 18, spread: 1.0, count: 220, life: 9, size: 16, grow: 7, jitter: 6, window: [RE.twoEngines + 3, RE.splash + 1] },
      // The splash itself.
      { at: [0, 0.5, 0], dir: [0, 1, 0], speed: 22, spread: 0.7, count: 120, life: 6, size: 11, grow: 5, jitter: 4, window: [RE.splash - 0.4, RE.splash + 1.2] },
      // The hull slapping down: the mist off its sheets of water hangs along it.
      { at: [26, 1, 0], dir: [0, 1, 0], speed: 7, spread: 1.0, count: 90, life: 8, size: 12, grow: 4, jitter: 40, window: [SLAP, SLAP + 0.8] },
    ],
  });
  ocean.add(spray.mesh);
  // The water itself, thrown up and falling back under gravity (the steam above drifts; this
  // does not): droplets and sheets on ballistic paths, a little air drag. Three moments, ≈ as
  // filmed on the splashdowns (the sizes and speeds are not measured):
  //  - the engine's jet on the surface in the last ≈45 m: a skirt of water blown out flat and
  //    low all round, heavier as it comes down (one Raptor, ≈2 MN at sea level);
  //  - touching down at a walking pace: a ring of water round the base;
  //  - toppling (reentryFlight.js): the hull falls about its base and comes down flat at
  //    T+6,5 s, its tip at ≈30 m/s (0,6 rad/s × 52 m). Each stretch of hull throws up water
  //    in proportion to its own speed, so the sheets stand highest towards the nose.
  const lane = [6, 14, 22, 30, 38, 46].map(x => ({
    at: [x, 0.5, 0], dir: [0, 1, 0], speed: 4 + 0.36 * x, spread: 0.55, count: 700, life: 2 + 0.07 * x,
    size: 3.0, grow: 3.0, jitter: 9, window: [SLAP - 0.1 + 0.003 * (46 - x), SLAP + 0.35],
  }));
  const water = new Vapor({
    name: 'reentry-water', rng, accel: [0, -9.81, 0], tau: 6, opacity: 0.6, fadeIn: 0.02, colors: [0xf4f8fa, 0x6c8293],
    emitters: [
      { at: [0, 0.4, 0], dir: [0, 0.3, 0], speed: 16, spread: 2.2, count: 900, life: 2.0, size: 3.0, grow: 3.0, jitter: 8, window: [RE.splash - 6, RE.splash - 3] },
      { at: [0, 0.4, 0], dir: [0, 0.3, 0], speed: 24, spread: 2.2, count: 1800, life: 2.4, size: 3.5, grow: 3.5, jitter: 9, window: [RE.splash - 3, RE.splash] },
      { at: [0, 0.4, 0], dir: [0, 1, 0], speed: 9, spread: 0.6, count: 700, life: 2.0, size: 2.5, grow: 2.5, jitter: 10, window: [RE.splash - 0.2, RE.splash + 0.4] },
      ...lane,
    ],
  });
  ocean.add(water.mesh);
  // The churned water where it came down: white water round the base, a ring running out
  // from it, and a long patch of foam where the hull fell; streaked by noise and thinning as
  // it spreads (≈). Drawn on the sea, 300 m across.
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 240, 240), new THREE.ShaderMaterial({
    name: 'reentry-foam', transparent: true, depthWrite: false,
    uniforms: {
      uAge: { value: 0 }, uSlap: { value: SLAP - RE.splash + 4 },   // age from 4 s before the splash, when the jet reaches the water
      uOceanPhase: seaU.uOceanPhase, uImpactAge: seaU.uImpactAge, uSlapAge: seaU.uSlapAge,
    },
    // On the moving surface (the plane lies in x, y; the ocean's frame is x, −y): the foam rides
    // the swell and the splash's rings instead of cutting through them as a flat sheet.
    vertexShader: `varying vec2 vP;
      ${OPEN_GLSL}
      ${IMPACT_GLSL}
      void main() {
        vP = position.xy;
        vec2 p = vec2(position.x, -position.y);
        vec3 n;
        vec3 o = vcOcean(p, 0.0, ${OPEN_SEA_AMP.toFixed(2)}, n);
        o.y += vcImpactH(p);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(o.x, -o.z, o.y + 0.06), 1.0);
      }`,
    fragmentShader: `
      uniform float uAge, uSlap; varying vec2 vP;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { return 0.5 * n(p) + 0.3 * n(p * 2.3 + 7.1) + 0.2 * n(p * 5.1 - 3.7); }
      void main() {
        // vP: x along the hull (+x, where it falls), y across it.
        float d = length(vP), a = uAge;
        float streak = fbm(vP * 0.22 + vec2(a * 0.05, 0.0)) * fbm(vP * 0.9 - vec2(0.0, a * 0.08));
        float R = 9.0 + 2.2 * a;
        float churn = (1.0 - smoothstep(0.55 * R, R, d)) * (1.0 - smoothstep(18.0, 40.0, a));
        float rf = 10.0 + 5.0 * a, q = (d - rf) / (2.0 + 0.25 * a), ring = exp(-q * q) * 0.55 * (1.0 - smoothstep(6.0, 22.0, a));
        float s = a - uSlap, hull = 0.0;
        if (s > 0.0) {
          float w = 7.0 + 1.6 * s, along = smoothstep(-6.0, 2.0, vP.x) * (1.0 - smoothstep(50.0, 58.0 + s, vP.x));
          hull = along * (1.0 - smoothstep(0.5 * w, w, abs(vP.y))) * (1.0 - smoothstep(10.0, 18.0, s));
        }
        float alpha = clamp((churn + ring + hull) * smoothstep(0.25, 0.7, streak + 0.25), 0.0, 1.0) * 0.8;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(0.90, 0.94, 0.96, alpha);
      }`,
  }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0;
  foam.name = 'reentry-foam';
  foam.visible = false;
  ocean.add(foam);

  // The Earth under the whole thing: open ocean (the northern Pacific), no map.
  const earth = new FlightEarth({ ocean: true });
  root.add(earth.group);

  const state = {
    running: false, paused: false, t: CHAPTER.start, speed: 10, follow: 'director', chapter: 'reentry',
    phase: 'Coasting to entry', next: null, ship: { altitude: 0, velocity: 0, lit: 0 }, booster: null,
  };
  const saved = { parent: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), near: 0, far: 0 };
  let hidden = [];

  function hideSite(on) {
    if (on) {
      // The site, the F-16's runway and the Porsche's circuit: none of it is in the Pacific.
      const names = new Set(['campus', 'markings', 'runway-complex', 'circuit']);
      hidden = scene.children.filter(o => o !== root && o.visible && (names.has(o.name) || o.name.startsWith('exhibit-') || o === complex || o === env.ground));
    }
    for (const o of hidden) o.visible = !on;
    if (!on) hidden = [];
  }

  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(0, 0, -1), _m = new THREE.Matrix4();
  const phaseAt = (t) => (t < RE.entry ? 'Coasting to entry'
    : t < RE.entry + 90 ? 'Entry interface · plasma building'
    : t < RE.transonic - 120 ? 'Re-entry · belly first'
    : t < RE.transonic ? 'Slowing through the stratosphere'
    : t < RE.subsonic ? 'Transonic'
    : t < RE.landingBurn ? 'Belly flop · falling flat'
    : t < RE.flip + 3 ? 'Landing burn · flip'
    : t < RE.splash ? 'Landing burn'
    : 'Splashdown · northern Pacific');

  /** Puts everything at mission time t. */
  function apply(t) {
    state.t = t;
    const s = reentryState(t);
    const pitch = reentryPitchAt(t);
    const lit = reentryEnginesAt(t);
    // Attitude: nose along (cos θ, sin θ) in the trajectory plane (+X forward), belly into
    // the flow, i.e. (sin θ, −cos θ).
    _n.set(Math.cos(pitch), Math.sin(pitch), 0);
    _b.set(Math.sin(pitch), -Math.cos(pitch), 0);
    _m.makeBasis(_x, _n, _b);
    holder.quaternion.setFromRotationMatrix(_m);
    // Standing on its engines at the end, the ship's base, not its centre, is at the height.
    const up = Math.max(0, Math.sin(pitch));
    // Toppling in the water it turns about its base, which stays where it splashed.
    // Where the splash point is, relative to the ship.
    const ahead = toSplashAt(t);
    // Once down it floats on the swell: its base rides the open sea's height there (≈, a hull
    // this long would average the short waves; no buoyancy is modelled).
    const bob = t >= RE.splash ? openOceanHeight(-ahead, 0, t) * Math.min(1, (t - RE.splash) / 2) : 0;
    holder.position.set(t > RE.splash ? COM * Math.cos(pitch) : 0, s.h + COM * up + (t >= RE.splash ? -0.6 * Math.min(1, (t - RE.splash) / 3) : 0) + bob, 0);
    ocean.position.set(ahead, 0, 0);
    holder.updateMatrixWorld(true);

    // The camera next — the shot list, or the visitor's own orbit riding on the ship — so the
    // sky, the ocean and the planes below follow wherever it actually is. They used to be set
    // from the camera of the frame before: after a jump (the profile, ←/→, Restart) the first
    // frame was wrong, and paused it stayed wrong — a splash under a black sky with no ocean.
    if (rig.external) { placeCamera(t, s); holdOrbitOnShip(); }
    else if (rig.mode === 'orbit' && !rig.transition) ride();
    else ridePrev = null;
    ocean.visible = camera.position.y < 15000;

    // Plasma.
    const heat = heatingAt(t);
    plasmaU.uHeat.value = heat; plasmaU.uTime.value = t;
    wakeU.uHeat.value = heat; wakeU.uTime.value = t;
    sheath.visible = heat > 0.01;
    // The flow, in world space: the air comes at the ship along the reverse of its velocity.
    _v.set(s.vx, s.vh, 0).normalize();
    plasmaU.uFlow.value.copy(_v).negate();
    wake.visible = heat > 0.01;
    if (wake.visible) {
      const len = 60 + 1400 * heat;
      // From just behind the ship, so a camera riding on it is never inside the cone.
      wake.position.copy(holder.position).addScaledVector(_v, -28);
      // The cone runs along the mesh's −Z: point +Z forward so it trails behind.
      _t.copy(holder.position).add(_v);
      wake.lookAt(_t);
      wake.scale.set(9 + 26 * heat, 9 + 26 * heat, len);
    }
    // The halo is for the outside shots: from on board it would fill the frame.
    for (const ft of flapTrails) {
      ft.mesh.visible = ft.ok && heat > 0.02;
      if (!ft.mesh.visible) continue;
      ft.mesh.position.copy(ft.tip);
      mount.localToWorld(ft.mesh.position);
      _t.copy(ft.mesh.position).add(_v);
      ft.mesh.lookAt(_t);
      ft.mesh.scale.set(0.4 + 1.4 * heat, 0.4 + 1.4 * heat, 30 + 160 * heat);
    }
    glow.set(rig.external && shotFor(t) === 'onboard' ? 0 : heat * 2.2, 30 + 40 * heat, t);
    setHeatGlow(heat);

    // Landing burn.
    const alt = s.h;
    plume.setTime?.(t);
    plume.setThrottle(lit ? 0.75 : 0, alt, lit === 3 ? 1 : lit === 2 ? 0.8 : 0.5, lit ? 0.75 : 0);
    spray.update(t, camera, env.sun);
    water.update(t, camera, env.sun);
    // The sea: the waves at mission time (seek and pause see the same sea), the grid round the
    // camera in the ocean's frame, the splash's rings by their age.
    oceanPhases(t, seaU.uOceanPhase.value);
    ocean.updateWorldMatrix(true, false);
    ocean.worldToLocal(_seaC.copy(camera.position));
    seaU.uCenter.value.set(_seaC.x, _seaC.z);
    seaU.grid.position.set(_seaC.x, 0, _seaC.z);
    seaU.uImpactAge.value = t - RE.splash;
    seaU.uSlapAge.value = t - SLAP;
    foam.visible = t > RE.splash - 4;
    foam.material.uniforms.uAge.value = t - RE.splash + 4;

    // Sky, fog and the globe for the camera's height.
    const camAlt = Math.max(0, camera.position.y);
    env.setAltitude(camAlt);
    earth.update(camera, env.sunDir, camAlt);
    camera.near = camAlt > 20000 ? 2 : 0.5;
    camera.far = Math.max(90000, Math.sqrt(2 * 6371000 * Math.max(camAlt, 1)) * 1.3 + 60000);
    camera.updateProjectionMatrix();

    Object.assign(state.ship, { altitude: alt, velocity: Math.hypot(s.vx, s.vh), lit });
    state.phase = phaseAt(t);
    state.next = MILESTONES_RE.find(m => m.t > t) ?? null;
    state.heat = heat;
    state.density = densityAt(alt);
    // Director only while the shot list has the camera; otherwise the visitor's orbit rides on.
    state.director = !!rig.external && state.follow === 'director';
    state.riding = !rig.external;
  }

  // ---- Cameras -----------------------------------------------------------------------------
  // Dragging or turning the wheel hands the camera to the visitor (cameraRig), as in the launch:
  // the orbit's centre then rides on the ship, so it can be turned round and paused without
  // losing it. The shot list used to go on writing the camera, and fought the orbit controls.
  let ridePrev = null;
  // While the shot list has the camera, the orbit's centre is kept on the ship, so the hand-over
  // carries on from the last scripted frame. Starting the ride from the first free frame lost
  // however far the ship fell in between — kilometres, on a slow frame high up.
  function holdOrbitOnShip() {
    rig.target.copy(holder.position);
    if (ridePrev) ridePrev.copy(holder.position); else ridePrev = holder.position.clone();
  }
  function ride() {
    if (!ridePrev) { holdOrbitOnShip(); return; }
    _t.subVectors(holder.position, ridePrev);
    camera.position.add(_t);
    rig.target.add(_t);
    ridePrev.copy(holder.position);
  }
  // Director: the on-board view of the aft flap through the plasma (as on SpaceX's webcasts),
  // a chase from outside as it slows, alongside through the belly flop, and a buoy on the water
  // for the landing. 'onboard' and 'chase' hold one shot for the whole chapter.
  const _c = new THREE.Vector3(), _l = new THREE.Vector3();
  const CHASE_DIP = THREE.MathUtils.degToRad(12);
  function shotFor(t) {
    if (state.follow !== 'director') return state.follow;
    if (t < RE.entry + 540) return 'onboard';
    if (t < RE.subsonic + 20) return 'chase';
    if (t < RE.landingBurn - 45) return 'side';
    return 'buoy';
  }
  function placeCamera(t, s) {
    const shot = shotFor(t);
    if (shot === 'onboard') {
      // On the leeward hull, looking aft along the side at the aft flap (≈ placement).
      _c.set(-5.8, 30, -5.2); mount.localToWorld(_c);
      _l.set(-8.5, 5, 0.5); mount.localToWorld(_l);
    } else if (shot === 'chase') {
      // Behind along the velocity, but never looking down more than CHASE_DIP: below Mach 1 the
      // path steepens towards the vertical, and a chase along it looked straight down at the
      // open ocean, a featureless blue with no horizon from 16 to 27 km.
      const dip = Math.max(Math.atan2(s.vh, Math.max(1e-3, s.vx)), -CHASE_DIP);
      _v.set(Math.cos(dip), Math.sin(dip), 0);
      _c.copy(holder.position).addScaledVector(_v, -160).add(_t.set(0, 20, 70));
      _l.copy(holder.position);
    } else if (shot === 'side') {
      _c.copy(holder.position).add(_t.set(-60, 25, 170));
      _l.copy(holder.position);
    } else {
      // A buoy 400 m off the splash point, a few metres above the swell.
      _c.set(ocean.position.x - 260, 3.5, 320);
      _l.copy(holder.position).setY(Math.max(holder.position.y * 0.6, 20));
      if (t > RE.splash) _l.set(ocean.position.x, 18, 0);
    }
    camera.position.copy(_c);
    camera.lookAt(_l);
  }

  // ---- Public API --------------------------------------------------------------------------
  function start() {
    if (state.running) return;
    onStart();
    saved.parent = ship.parent;
    saved.position.copy(ship.position);
    saved.quaternion.copy(ship.quaternion);
    saved.near = camera.near; saved.far = camera.far;
    mount.add(ship);
    ship.position.set(0, 0, 0);
    ship.quaternion.identity();
    holder.updateMatrixWorld(true);
    findFlapTips();
    heatMats = []; collectHeatMats();
    hideSite(true);
    root.visible = true;
    // The chapter's shots are framed for the orbit camera's field of view: started from the walk
    // it ran at the walk's 60° with the Walk button lit. Free flight, at the orbit's field of
    // view, is left as it is, as in the launch.
    if (rig.mode === 'walk') rig.setMode('orbit');
    rig.external = true;
    ridePrev = null;
    visibilityHook?.(true);
    Object.assign(state, { running: true, paused: false, speed: 10, follow: 'director' });
    apply(CHAPTER.start);
    onState(state);
  }

  function reset(returnCamera = true, completed = false) {
    if (!state.running) return;
    state.running = false;
    ridePrev = null;
    plume.setThrottle(0, 0);
    setHeatGlow(0);
    spray.hide?.();
    water.hide();
    saved.parent.add(ship);
    ship.position.copy(saved.position);
    ship.quaternion.copy(saved.quaternion);
    root.visible = false;
    earth.hide();
    hideSite(false);
    env.setAltitude(0);
    camera.near = saved.near; camera.far = saved.far;
    camera.updateProjectionMatrix();
    rig.releaseExternal();
    visibilityHook?.(false);
    onState(state);
    if (returnCamera) onFinish(completed);
  }

  function seek(t) {
    if (!state.running) start();
    apply(Math.min(CHAPTER.end, Math.max(CHAPTER.start, t)));
    onState(state);
  }

  function update(dt) {
    if (!state.running) return;
    // Visibility can be re-asserted by the view state (labels, toggles): keep the site hidden.
    for (const o of hidden) o.visible = false;
    if (state.paused) { apply(state.t); onState(state); return; }
    const t = state.t + dt * state.speed;
    if (t >= CHAPTER.end) { reset(true, true); return; }
    apply(t);
    onState(state);
  }

  return {
    get state() { return state; },
    get running() { return state.running; },
    events: { start: CHAPTER.start, end: CHAPTER.end, ...RE },
    milestones: MILESTONES_RE,
    start, reset, seek, update,
    setSpeed: (k) => { state.speed = k; },
    setPaused: (on) => { if (!state.running) return; state.paused = !!on; onState(state); },
    // Choosing a camera takes it back from the visitor's orbit for the shot list.
    setFollow: (w) => { state.follow = w; if (state.running) { rig.external = true; apply(state.t); } onState(state); },
  };
}
