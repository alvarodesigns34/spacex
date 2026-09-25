/**
 * Lighting, sky, ground and the image-based environment used for reflections.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mesh, mergeAll, mat4, chunkedInstances } from '../geometry/utils.js';
import { noise2 } from '../materials/textures.js';
import { createClouds } from './clouds.js';

/**
 * The Gulf shore. Starbase stands on the coast at Boca Chica, and the plain runs out into a
 * beach and the sea; every wide view here ended instead in the same flat khaki to the horizon.
 * This is a PLAUSIBLE shore, not a survey: a gently wandering line with the water about 450 m
 * beyond the pad's mount (world z) — the launch site stands "a few hundred yards" off Boca Chica
 * Beach, and the old 1.1 km put a kilometre of plain between them. A dry beach, a wet margin,
 * and the ground sloping away under the water surface.
 * @returns the shore's world z at world x
 */
export function shoreZ(x) {
  return -670 + 0.22 * x + 46 * (noise2(x / 280 + 3.1, 7.7) - 0.5) + 18 * (noise2(x / 90, 1.3) - 0.5);
}

/** Disc in the XY plane (rotated flat later) with a large-scale coastal tint. */
function coastalDisc(radius, rings, segs) {
  const count = 1 + rings * (segs + 1);
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  const shore = new Float32Array(count * 2);     // [dry sand, wet sand], read by the terrain shader
  const idx = [];
  let k = 0;
  const push = (x, y) => {
    pos[k * 3] = x;
    pos[k * 3 + 1] = y;
    // Local y is world −z once the disc is laid flat; local z becomes height.
    const past = shoreZ(x) - -y;                 // metres seaward of the shoreline
    pos[k * 3 + 2] = past > 0 ? -9 * THREE.MathUtils.smoothstep(past, 0, 180) : 0.35 * THREE.MathUtils.smoothstep(-past, 0, 60) * (1 - THREE.MathUtils.smoothstep(-past, 60, 160));
    const broad = noise2(x / 110, y / 110);
    const patch = noise2(x / 42 + 19, y / 42 - 7);
    const salt = Math.max(0, broad - 0.46);
    const damp = Math.max(0, 0.4 - patch);
    let m = 1 + salt * 0.26 - damp * 0.2 + (noise2(x / 16 + 4, y / 16) - 0.5) * 0.05;
    // Beach, measured from where the water actually is. The sea surface sits 0.9 m down, and
    // the ground only reaches that depth ~35 m seaward of shoreZ, so a beach keyed to shoreZ
    // itself left 35 m of grassy slope running down into the water. `wl` is metres from the
    // real waterline (negative inland): dry sand for ~90 m, a wet margin at the water, and
    // sand under the shallows.
    const wl = past - WATERLINE;
    const dry = THREE.MathUtils.smoothstep(wl, -105, -70) * (1 - THREE.MathUtils.smoothstep(wl, -20, -8));
    const wet = THREE.MathUtils.smoothstep(wl, -20, -6);
    shore[k * 2] = dry;
    shore[k * 2 + 1] = wet;
    col[k * 3] = m * (1 + salt * 0.04);
    col[k * 3 + 1] = m;
    col[k * 3 + 2] = m * (1 - salt * 0.05);
    uv[k * 2] = x;
    uv[k * 2 + 1] = y;
    return k++;
  };
  const center = push(0, 0);
  let prev = null;
  for (let j = 1; j <= rings; j++) {
    const rad = radius * (j / rings) ** 1.4;
    const row = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      row.push(push(Math.cos(a) * rad, Math.sin(a) * rad));
    }
    if (j === 1) {
      for (let i = 0; i < segs; i++) idx.push(center, row[i], row[i + 1]);
    } else {
      for (let i = 0; i < segs; i++) idx.push(prev[i], row[i], row[i + 1], prev[i], row[i + 1], prev[i + 1]);
    }
    prev = row;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aShore', new THREE.BufferAttribute(shore, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Metres seaward of shoreZ at which the ground drops to the 0.9 m-deep sea surface. */
const WATERLINE = 35.3;

/** Radius of the apron disc at ground level, before the ascent stretches it. */
const GROUND_R = 2500;

/**
 * The Gulf graded by distance offshore, from the ISS photographs of this coast (NASA,
 * iss072e220043) and any view from the beach: surf breaking in two or three white lines over
 * the bar, a band of sandy, green-grey shallow water a few hundred metres wide, then the
 * darker open water. The sea was one flat slate tint right up to the sand. Colours are
 * plausible, not measured; the wave normals and the reflected sky do the rest.
 */
function seaMaterial(base) {
  const m = base.clone();
  m.name = 'sea';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSea;\nvarying float vSea;\nvarying vec2 vSeaXY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSea = aSea;\nvSeaXY = position.xy;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vSea;
varying vec2 vSeaXY;
float seaHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float seaNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(seaHash(i), seaHash(i + vec2(1, 0)), u.x), mix(seaHash(i + vec2(0, 1)), seaHash(i + vec2(1, 1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float d = max(vSea, 0.0);
    // Linear body tints: churned sandy green in the surf, green-grey over the shelf, then the
    // open Gulf's own colour (the material's).
    vec3 surfWater = vec3(0.20, 0.22, 0.17), shelf = vec3(0.075, 0.13, 0.12);
    vec3 body = mix(surfWater, shelf, smoothstep(10.0, 70.0, d));
    body = mix(body, diffuseColor.rgb, smoothstep(150.0, 700.0, d));
    diffuseColor.rgb = body;
    // Surf: broken white lines over the inner and outer bars, never a solid ribbon.
    float along = vSeaXY.x;
    float brk = seaNoise(vec2(along / 14.0, 3.0)) * 0.6 + seaNoise(vec2(along / 4.0, 9.0)) * 0.4;
    float l1 = 1.0 - smoothstep(0.0, 2.2, abs(d - 3.0));
    float l2 = (1.0 - smoothstep(0.0, 3.0, abs(d - 18.0 - 3.0 * seaNoise(vec2(along / 60.0, 1.0))))) * smoothstep(0.45, 0.7, brk);
    float l3 = (1.0 - smoothstep(0.0, 4.0, abs(d - 42.0 - 6.0 * seaNoise(vec2(along / 90.0, 5.0))))) * smoothstep(0.6, 0.8, brk);
    float foam = clamp(l1 * 0.9 + l2 * 0.75 + l3 * 0.5, 0.0, 1.0) * (0.75 + 0.25 * seaNoise(vSeaXY / 2.5));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.80, 0.80), foam);
    vSeaFoam = foam;
  }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.85, vSeaFoam);`)
      .replace('void main() {', 'float vSeaFoam = 0.0;\nvoid main() {');
  };
  m.customProgramCacheKey = () => 'vc-sea-1';
  return m;
}

export function createEnvironment(renderer, scene, M, quality = {}) {
  const sunDir = new THREE.Vector3();

  // --- Sky (physical atmosphere shader) ---
  const sky = new Sky();
  // Big enough that the camera stays inside it at any altitude the launch reaches; the
  // shader only uses direction, so the box is re-centred on the camera every frame.
  sky.scale.setScalar(400000);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.8;
  su.rayleigh.value = 1.15;
  su.mieCoefficient.value = 0.0016;
  su.mieDirectionalG.value = 0.86;
  // The atmosphere shader applies its own tone curve, so pulling its scattering to zero
  // still leaves a grey-blue field rather than space. Fading the whole sky out over a black
  // background is the honest way to reach a black sky at altitude.
  const skyFade = { value: 1 };
  sky.material.transparent = true;
  sky.material.depthWrite = false;
  sky.material.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = skyFade;
    sh.fragmentShader = `uniform float uFade;\n${sh.fragmentShader}`
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor, uFade );');
  };
  scene.background = new THREE.Color(0x03050b);
  sky.renderOrder = -2;          // drawn first; the cloud layer goes over it
  scene.add(sky);
  const clouds = createClouds(scene);

  // --- Environment map for reflections: a private scene with the same sky + a ground disc ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(60);
  envScene.add(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshBasicMaterial({ color: 0x4c4842 }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -0.4;
  envScene.add(envGround);
  let envRT = null;

  // --- Lights ---
  const sun = new THREE.DirectionalLight(0xfff2e0, 3.2);
  sun.castShadow = true;
  // Shadow resolution is a tier decision: one map covers the whole apron, so its cost scales
  // with nothing the viewer controls and a phone cannot afford 4096².
  const SHADOW_MAP = quality.shadowMap ?? 4096;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.032;
  sun.shadow.radius = 1.25;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd4ee, 0x6b6660, 0.45);
  scene.add(hemi);

  // --- Ground: coastal plain terrain ---
  // CircleGeometry emits UVs normalised over the whole disc: (x/r + 1)/2. Every material in
  // this project is keyed to metres and sets repeat = 1/tileSize, so a 48 m terrain tile was
  // being stretched across the full 5 km - one texel per twenty metres, which is why the apron
  // read as featureless grey in every wide shot. Rewriting the UVs in metres puts the texture
  // back on its intended scale; the disc is rotated flat afterwards, so x/y of the flat
  // geometry are the ground plane.
  // Denser than the old 28 × 72: the beach is tens of metres wide, and 100 m cells a kilometre
  // out would smear it into a blur or miss it.
  const groundGeo = coastalDisc(GROUND_R, 64, 180);
  const ground = new THREE.Mesh(groundGeo, M.terrain || M.concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // The sea: a water surface over the seaward part of the disc, just below the beach. Laid in
  // the ground's own frame so it stretches with it on the ascent. The land under it falls to
  // nine metres down within 180 m of the waterline, which keeps the two surfaces far enough
  // apart for the depth buffer a couple of kilometres out.
  {
    // A strip that follows the coast, rows at growing distances from the waterline, instead
    // of one polygon triangulated into kilometre-long slivers: every vertex carries its exact
    // distance offshore (aSea), so the shallow shelf and the surf can be graded by it. Rows
    // past the edge of the disc are pulled back onto the circle.
    const SEA_ROWS = [-5, 0, 4, 9, 15, 22, 30, 40, 55, 75, 100, 140, 200, 300, 450, 700, 1000, 1500, 2200, 3200, 4600];
    const xs = [];
    for (let x = -GROUND_R; x <= GROUND_R; x += 20) xs.push(x);
    const wpos = [], wsea = [], widx = [];
    for (const d of SEA_ROWS) for (const x of xs) {
      let px = x, py = -shoreZ(x) + WATERLINE + d;
      const r = Math.hypot(px, py);
      if (r > GROUND_R) { px *= GROUND_R / r; py *= GROUND_R / r; }
      wpos.push(px, py, -0.9); wsea.push(d);
    }
    const nx = xs.length;
    for (let j = 0; j < SEA_ROWS.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a0 = j * nx + i, b0 = a0 + nx;
      // Counter-clockwise seen from above (+z here), by construction: x grows along a row and
      // the rows run seaward in +y. A check on one vertex's normal is not enough — the rows
      // pulled onto the disc's edge make degenerate triangles there, and it guessed wrong.
      widx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
    }
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    waterGeo.setAttribute('aSea', new THREE.Float32BufferAttribute(wsea, 1));
    waterGeo.setIndex(widx);
    // A flat sea: every normal is straight up, degenerate edge triangles included.
    const wn = new Float32Array(wpos.length);
    for (let i = 2; i < wn.length; i += 3) wn[i] = 1;
    waterGeo.setAttribute('normal', new THREE.BufferAttribute(wn, 3));
    // Metric UVs for the wave normals.
    const wp = waterGeo.attributes.position, wuv = new Float32Array(wp.count * 2);
    for (let i = 0; i < wp.count; i++) { wuv[i * 2] = wp.getX(i); wuv[i * 2 + 1] = wp.getY(i); }
    waterGeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
    const water = new THREE.Mesh(waterGeo, seaMaterial(M.water ?? new THREE.MeshStandardMaterial({ color: 0x2f5160, roughness: 0.15 })));
    water.name = 'sea';
    water.receiveShadow = false;
    ground.add(water);

    // Foredune. Behind every beach on this coast — and in photographs of Starbase from the
    // beach — the plain does not run flat into the sand: a ridge of wind-built dunes a few
    // metres high, held by beach grass, stands between them, broken by blowouts. The ground
    // disc is far too coarse there (≈40 m cells) to carry it, so it is its own strip following
    // the waterline, laid on the ground's own height function and sunk a little into it at
    // both edges. Drawn with the terrain material: same grain, same landscape noise; its
    // seaward face is flagged as dry sand for the shader, its crest and back are grassy.
    // Height, width and spacing are plausible for a Gulf foredune, not a survey.
    const groundHeight = (past) => (past > 0 ? -9 * THREE.MathUtils.smoothstep(past, 0, 180)
      : 0.35 * THREE.MathUtils.smoothstep(-past, 0, 60) * (1 - THREE.MathUtils.smoothstep(-past, 60, 160)));
    const DUNE_C = -125, HALF = 36, ROWS = 24, STEP = 5;
    const duneH = (x) => {
      const h = 2.2 + 3.4 * noise2(x / 140 + 2.2, 4.4) + 1.3 * noise2(x / 37, 8.8);
      const blow = THREE.MathUtils.smoothstep(noise2(x / 260 + 9.1, 1.7), 0.18, 0.34);   // blowouts
      return h * blow;
    };
    // Across-dune profile, 0..1: steeper to seaward (d > 0), a long gentle back slope.
    // A main ridge and a lower, older one behind it, the way a foredune system builds up.
    const ridge = (d, w) => {
      const t = d > 0 ? d / (w * 0.7) : -d / w;
      return t >= 1 ? 0 : Math.pow(Math.cos(t * Math.PI / 2), 1.6);
    };
    const bump = (d) => Math.max(ridge(d - 8, 22), 0.45 * ridge(d + 20, 14));
    const dpos = [], dcol = [], duv = [], dshore = [], didx = [];
    const tufts = [];
    let cols = 0;
    for (let x = -GROUND_R; x <= GROUND_R; x += STEP) {
      const zc = shoreZ(x) + 35.3 - DUNE_C;           // world z of the crest line
      if (Math.hypot(x, zc) > GROUND_R - 60) { if (cols) break; continue; }
      const H = duneH(x);
      for (let r = 0; r <= ROWS; r++) {
        const d = -HALF + (2 * HALF * r) / ROWS;       // + is seaward
        const wz = zc - d;
        const past = shoreZ(x) - wz;
        // Sunk 0.35 m at the edges, so the strip meets the coarse ground under its surface.
        const h = groundHeight(past) + H * bump(d) - 0.35 * (1 - THREE.MathUtils.smoothstep(bump(d), 0, 0.12));
        dpos.push(x, -wz, h);
        duv.push(x, wz * -1);
        const lift = 1 + 0.12 * bump(d);
        dcol.push(lift, lift, lift * 0.97);
        dshore.push(d > 4 ? THREE.MathUtils.smoothstep(d, 4, 16) : 0, 0);
      }
      // Beach grass on the crest and the back slope, thinning towards the edges.
      for (let k = 0; k < 11; k++) {
        const n = noise2(x * 0.37 + k * 13.1, 3.3 + k);
        const d = -HALF * 0.9 + noise2(x * 0.61 + k * 5.3, 9.9 + k) * HALF * 1.6;
        if (bump(d) * H < 0.6 || d > 16) continue;
        const wz = zc - d + (noise2(x * 0.9, k * 7.7) - 0.5) * 3;
        tufts.push([x + (noise2(x * 0.5, k) - 0.5) * STEP, -wz, groundHeight(shoreZ(x) - wz) + H * bump(d) - 0.1, 0.6 + n]);
      }
      cols++;
    }
    const RW = ROWS + 1;
    for (let i = 0; i < cols - 1; i++) {
      for (let r = 0; r < ROWS; r++) {
        const a = i * RW + r, b = (i + 1) * RW + r;
        didx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const duneGeo = new THREE.BufferGeometry();
    duneGeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
    duneGeo.setAttribute('uv', new THREE.Float32BufferAttribute(duv, 2));
    duneGeo.setAttribute('color', new THREE.Float32BufferAttribute(dcol, 3));
    duneGeo.setAttribute('aShore', new THREE.Float32BufferAttribute(dshore, 2));
    duneGeo.setIndex(didx);
    duneGeo.computeVertexNormals();
    // Faces point up (+local z) given this winding; flip if the first normal came out down.
    if (duneGeo.attributes.normal.getZ(0) < 0) {
      const idx = duneGeo.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      duneGeo.computeVertexNormals();
    }
    const dune = new THREE.Mesh(duneGeo, M.terrain || M.concrete);
    dune.name = 'foredune';
    dune.receiveShadow = true;
    ground.add(dune);

    // Not on the low tier: some hundred thousand triangles of grass a phone does not need.
    if (tufts.length && M.duneGrass && quality.name !== 'low') {
      // A clump of blades, not a cone: nine thin spikes leaning out from one root, which is
      // what a tussock of sea oats is at the distance anyone sees it from.
      const blades = [];
      for (let b = 0; b < 9; b++) {
        const a = (b / 9) * Math.PI * 2 + b * 0.7, lean = 0.25 + 0.2 * ((b * 37) % 5) / 5;
        const len = 0.55 + 0.35 * ((b * 53) % 7) / 7;
        const g = new THREE.ConeGeometry(0.05, len, 3, 1, true);
        g.translate(0, len / 2, 0);
        g.rotateZ(lean); g.rotateY(a);
        g.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
        blades.push({ geometry: g });
      }
      const tuft = mergeAll(blades);
      tuft.rotateX(Math.PI / 2);                      // the clump's +y onto the ground's up (+z)
      const dm = new THREE.Object3D();
      const placements = tufts.map(([x, y, z, s]) => {
        dm.position.set(x, y, z);
        dm.scale.set(1.6 * s, 1.6 * s, 1.3 * s * (0.8 + 0.5 * s));
        dm.rotation.set(0, 0, s * 9);
        dm.updateMatrix();
        // Binned on the ground's own plane (its local x/y; z is up in this frame).
        return { x, z: y, matrix: dm.matrix.clone() };
      });
      // 4,6 km of dune in 150 m chunks: culled when off screen, thinned with distance.
      ground.add(chunkedInstances(tuft, M.duneGrass, placements, { cell: 150, name: 'dune-grass', feature: 1.0 }));
    }

  }
  // The terrain material is the ground's alone, so its repeat can be driven from here.
  const groundMaps = [ground.material.map, ground.material.roughnessMap, ground.material.normalMap].filter(Boolean);
  const baseRepeat = groundMaps[0] ? groundMaps[0].repeat.clone() : new THREE.Vector2(1, 1);

  // Painted apron markings (subtle): a wide dark band and station lines under each exhibit.
  const markingMat = new THREE.MeshStandardMaterial({ color: 0xd9c25a, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const markings = new THREE.Group();
  markings.name = 'markings';
  scene.add(markings);
  function addStation(x, z, radius) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.18, radius, 96), markingMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.01, z); ring.receiveShadow = true;
    markings.add(ring);
  }

  // --- No night ------------------------------------------------------------------------
  // The Sun control used to run below the horizon into a night mode lit by display
  // floodlights. It did not hold together: the light came from masts nobody noticed by day,
  // switched on out of nothing as the slider went down, and lit the centre like a car park.
  // The centre is a daylight exhibit now. The control stops a few degrees above the horizon,
  // where the light is at its warmest and the shadows at their longest, and never gets dark.
  const SUN_MIN = 4, SUN_MAX = 75;

  const fog = new THREE.FogExp2(0xc5cdd6, 0.00027);
  scene.fog = fog;
  const GROUND_FOG = 0.00027;
  let nightK = 0;

  /** Keeps the sky centred on the viewer. Cheap, and the only way it survives an ascent. */
  function followCamera(camera) {
    sky.position.copy(camera.position); clouds.follow(camera);
  }

  // ---- One place composes the atmosphere ------------------------------------------------
  // Three things thin, darken or colour the air: the sun's elevation (day to night), the
  // camera's altitude (ground to space), and the orbital view. They used to write the same
  // uniforms from three functions, in whatever order they happened to be called, and the
  // composition was wrong: setAltitude() reassigned fog.density from the ground constant with
  // no night factor, so the launch — which calls it every frame — pulled daytime fog back over
  // a night scene, and reset()'s setAltitude(0) left day fog under lit floodlights.
  //
  // Now the three are inputs, and this function is the only writer. It is pure in the sense
  // that matters: called twice with the same inputs it produces the same scene.
  const air = { elev: 42, azim: 34, altitude: 0 };
  const SKY_GROUND = { turbidity: 2.8, rayleigh: 1.15, mie: 0.0016 };
  const _nightHemi = new THREE.Color(0x2c3d5e), _nightFog = new THREE.Color(0x070a12);

  /** @param rebuildProbe regenerate the PMREM. Costly: only when the sun itself moved. */
  function applyAtmosphere({ rebuildProbe = false } = {}) {
    const { elev, azim, altitude: h } = air;

    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(azim);
    sunDir.setFromSphericalCoords(1, phi, theta);
    su.sunPosition.value.copy(sunDir);

    // Night blend: starts a few degrees above the horizon, complete a few below it.
    // Always 0 now that the sun cannot set; kept as an input so the blend below stays one formula.
    nightK = THREE.MathUtils.clamp((SUN_MIN - elev) / 15, 0, 1);
    const n = nightK * nightK * (3 - 2 * nightK);
    // Altitude blend: fully thin by ~26 km.
    const k = THREE.MathUtils.clamp(h / 26000, 0, 1);
    const j = 1 - Math.pow(1 - k, 2.2);

    // Colour temperature vs elevation. Direct sunlight only turns strongly orange within a few
    // degrees of the horizon; an over-saturated sun tints bare metal at working elevations.
    const t = THREE.MathUtils.clamp(elev / 60, 0, 1);
    // Orange only very near the horizon. At the 18° inspection elevation the key
    // stays neutral enough that steel, paint and aluminium separate by roughness.
    const warmth = Math.pow(1 - t, 3.4);
    sun.color.setHSL(0.09, 0.04 + 0.28 * warmth, THREE.MathUtils.lerp(0.74, 0.98, Math.pow(t, 0.55)));
    // Key against fill. With the sky probe almost as strong as the sun, the side of a vehicle
    // turned away from the light barely darkened and every view read flat and hazy; in the
    // photographs of the site the sun cuts hard. Sun up ~12 %, probe down ~22 %, below.
    const daylight = THREE.MathUtils.lerp(1.35, 2.8, Math.pow(t, 0.55));
    sun.intensity = daylight * ((1 - n) + 0.012 * n);
    hemi.color.setHSL(0.58, 0.22 - 0.08 * warmth, 0.58 + 0.06 * t).lerp(_nightHemi, n);
    hemi.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.22, 0.36, t), 0.04, n) * (1 - j * 0.9);
    fog.color.setHSL(0.58, 0.24 + 0.14 * warmth, THREE.MathUtils.lerp(0.48, 0.66, t)).lerp(_nightFog, n);

    // Scattering: the two blends multiply. Everything is computed from the ground constants,
    // never read back out of the uniforms — reading and multiplying compounds on every call.
    const nightSky = {
      turbidity: SKY_GROUND.turbidity * (1 - n * 0.55),
      rayleigh: SKY_GROUND.rayleigh * (1 - n * 0.45),
      mie: SKY_GROUND.mie,
    };
    su.turbidity.value = nightSky.turbidity * (1 - j * 0.97);
    su.rayleigh.value = nightSky.rayleigh * (1 - j * 0.985);
    su.mieCoefficient.value = nightSky.mie * (1 - j * 0.9);
    fog.density = GROUND_FOG * 0.75 * (1 + n * 1.6) * (1 - THREE.MathUtils.clamp(h / 9000, 0, 1));
    skyFade.value = (1 - n * 0.86) * (1 - j * 0.94);

    clouds.update(sunDir, n, h, !inSpace);

    // Stretch the apron so there is still a surface under the vehicle on the way up. Scaling
    // the mesh scales its metric UVs with it, which would smear one 48 m tile over 1.6 km at
    // full stretch; counter-scaling the repeat keeps the texel density fixed in world space,
    // so the ground coarsens in the frame rather than dissolving.
    // From 9 km the launch sequence's curved Earth takes over (FlightEarth, plume.js); a
    // stretched flat disc would stand proud of its curvature as a dark band across the
    // horizon, so the stretch is handed back over the same 9-20 km as the globe fades in.
    const gs = 1 + (THREE.MathUtils.clamp(1 + h / 900, 1, 34) - 1) * (1 - THREE.MathUtils.smoothstep(h, 9000, 20000));
    if (ground.scale.x !== gs) {
      ground.scale.setScalar(gs);
      for (const t of groundMaps) t.repeat.set(baseRepeat.x * gs, baseRepeat.y * gs);
    }

    scene.environmentIntensity = THREE.MathUtils.lerp(0.82, 1.45, n) * (1 - j * 0.55);

    if (rebuildProbe) {
      // The probe is the sky at ground level for this sun, so chrome and clearcoat go dark
      // with the scene; it deliberately ignores the altitude thinning, which changes every
      // frame of an ascent and would cost a full PMREM pass each time.
      envSky.material.uniforms.sunPosition.value.copy(sunDir);
      envSky.material.uniforms.turbidity.value = nightSky.turbidity;
      envSky.material.uniforms.rayleigh.value = nightSky.rayleigh;
      envSky.material.uniforms.mieCoefficient.value = nightSky.mie;
      envSky.material.uniforms.mieDirectionalG.value = su.mieDirectionalG.value;
      envGround.material.color.setScalar(THREE.MathUtils.lerp(0.30, 0.02, n));
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene, 0.02);
      scene.environment = envRT.texture;
    }
  }

  function setAltitude(h) { air.altitude = h; applyAtmosphere(); }

  /**
   * Moving the Sun changes two things at very different prices. The sky uniforms, the light
   * directions, the fog and the exposure are a handful of writes. The reflection probe is a
   * full PMREM pass over a private scene — and the slider fires on every input event, so
   * dragging it from noon to midnight asked for a hundred of them, one per pixel of travel.
   *
   * The cheap half runs on every input, so the sky and the shadows track the control exactly.
   * The probe is rebuilt at most `PROBE_MS` apart while the control is moving, and once more
   * when it stops, so what is left on screen is always the probe for the sun that is actually
   * set. Reflections lag a fraction of a second behind the sky during a drag, which is not
   * visible; a full pass per event is.
   */
  const PROBE_MS = 130;
  let probeAt = 0, probeTimer = 0;
  function setSun(elevationDeg, azimuthDeg, { immediate = false } = {}) {
    air.elev = THREE.MathUtils.clamp(elevationDeg, SUN_MIN, SUN_MAX);
    air.azim = azimuthDeg;
    const now = performance.now();
    const due = immediate || (now - probeAt) >= PROBE_MS;
    applyAtmosphere({ rebuildProbe: due });
    if (due) { probeAt = now; clearTimeout(probeTimer); probeTimer = 0; return; }
    // Always settle on the real thing: the last event of a drag is usually inside the window,
    // and without this the session would keep a probe for a sun position nobody chose.
    clearTimeout(probeTimer);
    probeTimer = setTimeout(() => {
      probeTimer = 0; probeAt = performance.now();
      applyAtmosphere({ rebuildProbe: true });
    }, PROBE_MS);
  }

  /**
   * Takes the ground away for the Roadster's orbital view. The atmosphere is still thinned by
   * altitude, but the apron is still there, and in space a grey slab across the frame is worse
   * than no backdrop at all. Reversible: setSpace(false) restores the ground, its markings, the
   * sky and the fog exactly, which is what the check asserts after entering and leaving.
   */
  let inSpace = false;
  function setSpace(on) {
    if (on === inSpace) return;
    inSpace = !!on;
    ground.visible = !inSpace;
    markings.visible = !inSpace;
    sky.visible = !inSpace;
    scene.fog = inSpace ? null : fog;
    applyAtmosphere();
  }

  const _tmp = new THREE.Vector3();
  const _lx = new THREE.Vector3(), _ly = new THREE.Vector3(), _snap = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  /**
   * Fits the sun's shadow frustum to what the camera is looking at, without making shadows
   * crawl. The frustum used to follow the orbit target continuously and resize with every
   * notch of zoom, so each shadow-map texel landed somewhere slightly different every frame
   * and every shadow edge in the scene shimmered while the camera moved. Now the size moves
   * in ×1.2 steps (it changes a handful of times across the whole zoom range, not per frame)
   * and the centre is snapped to the texel grid in the light's own frame, so a texel always
   * covers the same patch of ground while the size holds.
   */
  function updateShadow(target, distance) {
    // Down to a 12 m square for close-ups. The floor was a 36 m square, which at 4096² is a
    // 9 mm texel: from a metre and a half, the roll bar's and the seat's shadows stepped across
    // Starman's suit in visible stairs.
    const raw = THREE.MathUtils.clamp(distance * 1.25 + 4, 6, 340);
    const size = Math.min(340, 6 * Math.pow(1.2, Math.ceil(Math.log(raw / 6) / Math.log(1.2))));
    const cam = sun.shadow.camera;
    if (cam.right !== size) {
      cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
    // The light camera's axes, as lookAt builds them: x = up × toward-sun, y = toward-sun × x.
    _lx.crossVectors(_up, sunDir);
    if (_lx.lengthSq() < 1e-8) _lx.set(1, 0, 0);
    _lx.normalize();
    _ly.crossVectors(sunDir, _lx).normalize();
    const texel = (2 * size) / sun.shadow.mapSize.x;
    const px = target.dot(_lx), py = target.dot(_ly);
    _snap.copy(target)
      .addScaledVector(_lx, Math.round(px / texel) * texel - px)
      .addScaledVector(_ly, Math.round(py / texel) * texel - py);
    sun.target.position.copy(_snap);
    _tmp.copy(sunDir).multiplyScalar(500).add(_snap);
    sun.position.copy(_tmp);
    sun.target.updateMatrixWorld();
  }

  // Azimuth is chosen so the exhibits are lit from the side the default views look from,
  // raked about 35° off the camera axis for modelling rather than flat frontal light.
  setSun(42, 34, { immediate: true });

  return {
    sun, sky, hemi, ground, setSun, setAltitude, setSpace, followCamera, updateShadow, addStation,
    SUN_MIN, SUN_MAX, get night() { return nightK; },
    get inSpace() { return inSpace; }, get sunDir() { return sunDir; },
  };
}
