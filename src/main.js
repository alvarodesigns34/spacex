/**
 * SpaceX Vehicle Center — entry point.
 * Scene units are metres. Vehicles are built procedurally from the figures in data/specs.js.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createAO } from './core/ao.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { createMaterials, WAVE_TIME } from './materials/library.js';
import { createEnvironment } from './core/environment.js';
import { dressCampus } from './core/campus.js';
import { CameraRig } from './core/cameraRig.js';
import { ViewState } from './core/viewState.js';
import { pickQuality, applyQuality } from './core/quality.js';
import { LODManager } from './core/lod.js';
import { createHUD } from './ui/hud.js';
import { VEHICLES } from './data/specs.js';
import { buildStarship, STACK_YAW_DEG, BOOSTER_AFT } from './vehicles/starship.js';
import { buildFalcon9, buildFalconHeavy } from './vehicles/falcon.js';
import { buildFalcon1, buildFalcon1GroundEquipment } from './vehicles/falcon1.js';
import { buildDragon } from './vehicles/dragon.js';
import { buildStarlink } from './vehicles/starlink.js';
import { buildRoadster } from './vehicles/roadster.js';
import { buildEngineHall } from './vehicles/enginehall.js';
import { buildF16 } from './vehicles/f16.js';
import { buildGt3rs } from './vehicles/gt3rs.js';
import { buildH2r } from './vehicles/h2r.js';
import { buildRunway, runwaySurface } from './core/runway.js';
import { buildCircuit, circuitSurface } from './core/circuit.js';
import { SKIDPAD, toWorld as circuitToWorld } from './core/circuitPlan.js';
import { createF16Fly } from './sim/f16Fly.js';
import { createF16Hud } from './ui/f16Hud.js';
import { createGt3Drive } from './sim/gt3Drive.js';
import { createH2rRide } from './sim/h2rRide.js';
import { createH2rHud } from './ui/h2rHud.js';
import { createGt3Hud } from './ui/gt3Hud.js';
import { groundSample } from './core/environment.js';
import { f16Ground } from './core/f16Ground.js';
import { waterAt } from './core/water.js';
import { buildColliders, CELL } from './core/colliders.js';
import { RUNWAY, fromRunway, toRunway } from './core/terrain.js';
import { buildOrbitalBackdrop } from './core/backdrop.js';
import { buildLaunchMount, buildPedestal, buildHumanCrowd } from './vehicles/common.js';
import { seeded, mergeAll } from './geometry/utils.js';
import { terrainHeight } from './core/terrain.js';
import { buildLaunchComplex, PAD, towerToPad } from './vehicles/pad.js';
import { verifyExhibits, verifyScene, verifyPad, verifyInterfaces } from './data/verify.js';
import { createLaunch, EVENTS, MILESTONES, ENGINE_LAYOUT, altitudeAt, boosterAltAt } from './sim/launch.js';
import { createMissionClock } from './sim/missionClock.js';
import { createLaunchSound } from './sim/sound.js';
import { createReentry } from './sim/reentry.js';
import { CHAPTER as REENTRY_CHAPTER, MILESTONES_RE, reentryAltAt } from './sim/reentryFlight.js';

// Exhibit layout (world X, metres). Mount heights are presentation choices.
// `yaw` turns an exhibit on its mount. Starship is asymmetric — heat shield on the belly,
// bare steel on the lee side — and facing its belly straight at the default camera shows
// nothing but the black shield. Turning it puts the tile line across the vehicle, which is
// how it is almost always photographed and how the two finishes read against each other.
// The seven museum exhibits stand in a row on z = 0. Starship does not: it sits on a launch
// complex of its own, set back behind the row, because a ≈149,5 m tower and a flame trench do
// not belong in a line of display mounts and because the launch sequence needs the room.
// `people` is declared per exhibit rather than inferred. It used to fall through to a generic
// branch that read lay.mountRadius, which Engine Row does not have — undefined + 3.5 is NaN,
// and three visitors were being planted at (NaN, 0, NaN). Inferring "is there a plinth?" from
// a radius that only some layouts carry is the kind of thing that breaks the next time an
// exhibit is added, so the layout says it outright.
const LAYOUT = {
  // Falcon 1 is the small historical bookend of the row, immediately outside Falcon 9.
  // The Falcons stand on launch mounts (common.js, buildLaunchMount): `mount` is the deck
  // height, `lift` how far above it the nozzle exits hang when the vehicle sits on its clamps.
  falcon1: {
    x: -153, z: 0, mount: 2.0, lift: 0.3, mountRadius: 3.1, people: [[4.2, 0, 2, 0.5], [-4.2, 0, 2, -0.5]],
    launchMount: {
      halfX: 3.1, halfZ: 3.1, tunnelHalf: 0.9, tunnelH: 1.05, opening: { hx: 0.6, hz: 0.6 },
      // Bearing on the stage's aft ring, which Figure 2-5 of the 2008 guide labels as the
      // launch-mount interface: station 133.3 in, 2.72 m above the nozzle exit, r ≈ 0.75 m. The
      // Merlin and its thrust frame hang free inside the four clamp pedestals.
      cores: [{ x: 0, z: 0, r: 0.75, seatY: 0.3 + 2.718, scale: 0.5, clamps: [1, 3, 5, 7].map(i => i * Math.PI / 4) }],
    },
  },
  falcon9: {
    x: -135, z: 0, mount: 6.5, lift: 0.35, mountRadius: 6.5,
    people: [[10, 0, 2, 0.5], [8.5, 0, -4, -2.0], [-9.5, 0, 3, 2.2]],
    launchMount: {
      halfX: 6.5, halfZ: 6.5, tunnelHalf: 2.6, tunnelH: 4.2, opening: { hx: 1.95, hz: 1.95 },
      cores: [{ x: 0, z: 0, r: 1.83, seatY: 0.35 + 1.0, clamps: [0, 1, 2, 3].map(i => i * Math.PI / 2), tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] }],
    },
  },
  falconheavy: {
    x: -62, z: 0, mount: 6.5, lift: 0.35, mountRadius: 10,
    people: [[15, 0, 2, 0.5], [13.5, 0, -4, -2.0], [-14.5, 0, 3, 2.2]],
    launchMount: {
      halfX: 10, halfZ: 7, tunnelHalf: 7, tunnelH: 4.2, opening: { hx: 6.2, hz: 1.95 },
      cores: [
        { x: 0, z: 0, r: 1.83, seatY: 1.35, clamps: [0, Math.PI], tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] },
        { x: -4.27, z: 0, r: 1.83, seatY: 1.35, clamps: [0, Math.PI, Math.PI * 1.5], tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] },
        { x: 4.27, z: 0, r: 1.83, seatY: 1.35, clamps: [0, Math.PI / 2, Math.PI], tsm: [Math.PI * 7 / 8, Math.PI * 9 / 8] },
      ],
    },
  },
  starship: {
    // The stack's origin is the engines' exit plane; the deck carries the thrust ring's edge,
    // BOOSTER_AFT above it, with the 33 Raptors hanging down into the mount's throat.
    x: 0, z: -185, mount: PAD.deckTop - BOOSTER_AFT, yaw: STACK_YAW_DEG, pad: true,
    people: [[26, PAD.padY, 16, 0.8], [30, PAD.padY, -10, -1.6], [-19, PAD.padY, 24, 2.4]],
  },
  dragon: { x: 18, z: 0, mount: 1.6, people: [[3.4, 0, 1.6, 0.6], [-2.8, 0, 2.6, -0.8]] },
  starlink: { x: 78, z: 0, mount: 6.2, people: [[3.2, 0, 2.4, 0.4], [-2.6, 0, 3.0, -1.2]] },
  // Figures stand clear of every authored view: at [2.8, 1.8] one was 2.7 m in front of the
  // Roadster's overview camera, a hard hat cut off by the bottom of the frame (another
  // filled the left of the Selfie Cam view, 6 m out), and at
  // [3.4, 2.6] another filled the right third of the RVac close-up.
  roadster: { x: 118, z: 0, mount: 1.4, yaw: 25, people: [[5.3, 0, 1.4, 0.5], [-6.3, 0, -1.7, -1.8]] },
  engines: {
    x: 163, z: 0, mount: 0, yaw: -12,
    people: [[4.8, 0, -2.8, -0.6], [-5.8, 0, 2.2, -1.4], [1.2, 0, -3.0, 2.6]],
  },
  // The F-16 stands on its own runway (terrain.js RUNWAY), as Starship stands on its pad: lined
  // up on runway 28's threshold (the east end, next to the site), 40 m in, ready to roll. Not in the row (`remote`): the row's
  // lecterns and its overview leave it out.
  f16: (() => {
    // People are placed by world offsets; each stands on the pavement where it falls.
    const a = RUNWAY.length / 2 - 40 - 7.52, [x, z] = fromRunway(a, 0);
    const person = (dx, dz, ry) => [dx, runwaySurface(...toRunway(x + dx, z + dz)), dz, ry];
    return { x, z, mount: runwaySurface(a, 0), yaw: 180 - RUNWAY.angleDeg, remote: true, people: [person(3.5, 6.5, 0.6), person(-8.0, -6.0, -2.2)] };
  })(),
  // The Porsche waits on its skid pad (core/circuitPlan.js), beside the circuit's main straight:
  // at the pad's north end, nose to the south along its 160 m, with the lane to the circuit on
  // its right. Not in the row either.
  gt3rs: (() => {
    const [x, z] = circuitToWorld(SKIDPAD.u0 + 18, (SKIDPAD.v0 + SKIDPAD.v1) / 2);
    return { x, z, mount: circuitSurface(x, z)?.y ?? 0.06, yaw: -90, remote: true, people: [[-6.0, 0.06, -3.4, 0.9], [5.5, 0.06, -5.0, -2.0]] };
  })(),
  // The Ninja H2R beside it, 4.5 m to the car's left and a metre ahead, facing the same way.
  h2r: (() => {
    const [x, z] = circuitToWorld(SKIDPAD.u0 + 19, (SKIDPAD.v0 + SKIDPAD.v1) / 2 - 4.5);
    return { x, z, mount: circuitSurface(x, z)?.y ?? 0.06, yaw: -90, remote: true, people: [] };
  })(),
};
// Recomposed when the Roadster became the sixth exhibit: the old frame was centred on x = -14
// and the car sat at the right-hand edge, so the first thing a visitor saw did not contain it.
// Recomposed again when Engine Row became the seventh exhibit at x = 163: the row now spans
// nearly 300 m, so the frame has to sit further back and centre on the middle of it.
const OVERVIEW = { pos: [3, 72, 330], target: [-1, 39, -68] };
/**
 * The overview for the window actually open. The authored frame spans the row for a landscape
 * window; on a phone held upright the horizontal field of view is a third of that, and the
 * overview showed the pad and a quarter of the row under a title promising eight exhibits.
 * The camera backs off along its own line of sight until the row's ends (plus a margin) fit
 * the horizontal field of view, and never comes closer than authored.
 */
// Half the row's width about the camera's line: Falcon 1's mount at x ≈ −159 to Engine Row's
// cradles at ≈ +166 m, seen from x = 3. At 1440 × 900 with the rail showing that is exactly the
// authored frame, so a desktop window keeps it.
const ROW_HALF = 166;
function overviewFor(aspect, fovDeg = 42) {
  const [px, py, pz] = OVERVIEW.pos, [tx, ty, tz] = OVERVIEW.target;
  const d0 = Math.hypot(px - tx, py - ty, pz - tz);
  const tanH = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * aspect;
  // The camera's distance to the row (z = 0) is tz + (pz − tz)·k along the scaled line of sight.
  const need = ROW_HALF / tanH;
  const k = THREE.MathUtils.clamp((need - tz) / (pz - tz), 1, 3.4);
  const pos = [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k];
  return { pos, target: OVERVIEW.target, scale: k, d: d0 * k };
}

// Cylinders used to hide annotations that sit behind a vehicle. CSS2D labels always draw on
// top of the scene, so without this the far-side callouts read as if they were in front.
//
// A number is one cylinder of that radius on the exhibit's axis, which is what a rocket is.
// Engine Row is not: it is three separate engines standing side by side over nine metres, and
// a single cylinder at the origin would both hide labels nothing is in front of and fail to
// hide the ones behind the vacuum bell. It gets one cylinder per stand, given as [x, z, r, top]
// in the exhibit's own frame — each with its own height, because a 2.9 m Raptor must not
// occlude to the 4.8 m of the vacuum engine standing next to it. Starlink is a flat panel and
// needs none.
const OCCLUDER = {
  falcon1: 0.8402,
  starship: 4.5, falcon9: 1.9, falconheavy: 1.9, dragon: 2.0, starlink: 0, roadster: 1.0,
  engines: [[-4.15, 0, 0.50, 2.6], [-1.75, 0, 0.70, 3.4], [1.55, 0, 1.20, 4.9]],
  // The F-16 along its own X: the fuselage as a chain of cylinders, a wing and a stabilator each
  // side, the fin. Also the walking visitor's obstacles.
  f16: [[5.8, 0, 0.6, 2.2], [3.2, 0, 0.9, 3.0], [0.6, 0, 1.0, 2.2], [-2.2, 0, 1.0, 2.4], [-5.0, 0, 1.0, 2.6], [-6.5, 0, 0.9, 5.0],
    [-1.6, 2.6, 1.6, 2.0], [-1.6, -2.6, 1.6, 2.0], [-6.2, 1.9, 0.9, 2.0], [-6.2, -1.9, 0.9, 2.0]],
  // The car along its own X: three cylinders from the nose to the wing.
  gt3rs: [[1.4, 0, 0.95, 1.0], [0, 0, 0.95, 1.3], [-1.5, 0, 0.95, 1.33]],
  // The bike along its own X: front wheel and cowl, the tank, the tail.
  h2r: [[0.6, 0, 0.42, 1.16], [-0.1, 0, 0.3, 1.02], [-0.75, 0, 0.3, 1.02]],
};

const nextFrame = () => new Promise(r => requestAnimationFrame(r));

/**
 * Without WebGL 2 the WebGLRenderer constructor throws, the loading card freezes on
 * "Starting…" and the only explanation is in the console. The <noscript> covers a browser with
 * scripting off; this covers the commoner case of scripting on and no WebGL 2 — an old
 * browser, a locked-down machine, or hardware acceleration switched off, which is a setting
 * the visitor can go and change if someone tells them that is what is wrong.
 */
function reportNoWebGL2() {
  const card = document.querySelector('#loading .loading-card');
  if (!card) return;
  card.querySelector('.loading-title').textContent = 'This experience needs WebGL 2';
  card.querySelector('.loading-track')?.remove();
  card.querySelector('.loading-text').textContent =
    'Your browser did not provide a WebGL 2 context. Enabling hardware acceleration in the '
    + 'browser settings, or opening the page in an up-to-date Chrome, Edge, Firefox or Safari, '
    + 'is usually enough.';
}

async function main() {
  const canvas = document.getElementById('scene');
  // Probed on a throwaway canvas: the first getContext on a canvas is the one whose attributes
  // stick, so testing on the real one would silently drop powerPreference below.
  if (!document.createElement('canvas').getContext('webgl2')) { reportNoWebGL2(); return; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // What this machine can afford, decided once from what it reports rather than from its
  // user-agent string. ?quality=low|medium|high forces a tier, which is how a tier you do not
  // own gets tested — and how the headless gate stays on the full scene, since a reduced one
  // would be checking geometry the viewer never sees.
  const params = new URLSearchParams(location.search);
  const quality = pickQuality(renderer, params.get('quality'));
  applyQuality(renderer, quality);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
  labelRenderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.15, 9000);
  camera.position.set(...overviewFor(window.innerWidth / window.innerHeight).pos);
  let walkRoute = () => ({ route: [], look: null });
  // Where the overview last put the camera, so a resize can tell whether the visitor moved.
  let lastOverview = camera.position.clone();

  const rig = new CameraRig(camera, canvas);
  rig.target.set(...OVERVIEW.target);
  // Detail is a function of how big something is on screen, so the manager needs the camera
  // and the tier's pixel threshold; entries are registered as each exhibit is built.
  const lod = new LODManager(camera, { pixels: quality.lodPixels });

  // ---- HUD ----
  let sunRaf = 0, pendingSun = 20;
  let sound = null;
  const hud = createHUD({
    vehicles: VEHICLES,
    onSelect: (id) => select(id),
    onPreset: (id, presetId) => goPreset(id, presetId),
    onToggle: (name, value) => setToggle(name, value),
    onMode: () => toggleMode(),
    onWalk: () => toggleWalk(),
    onTour: () => toggleTour(),
    onHelp: () => { rig.keys.clear(); rig.velocity.set(0, 0, 0); },
    // setSun regenerates the PMREM environment map, which is far too expensive to do on every
    // pointermove the range input fires. Coalesce to one regeneration per frame while dragging.
    onSun: (elev) => {
      pendingSun = elev;
      if (sunRaf) return;
      sunRaf = requestAnimationFrame(() => { sunRaf = 0; env.setSun(pendingSun, 34); });
    },
    onReset: () => select(null),
    onLaunch: () => toggleLaunch(),
    onReentry: () => toggleReentry(),
    onFly: () => toggleFly(),
    onDrive: () => toggleDrive(),
    onRide: () => toggleRide(),
    // The panel drives whichever sequence is playing: the launch, or the re-entry chapter.
    onLaunchAbort: () => seq()?.reset(),
    onLaunchSpeed: (k) => seq()?.setSpeed(k),
    onLaunchPause: (on) => seq()?.setPaused(on),
    onLaunchSeek: (t) => { if (seq()?.running) seq().seek(t); },
    onLaunchRestart: () => { const a = seq(); if (!a?.running) return; a.setPaused(false); a.seek(a === launch ? EVENTS.start : REENTRY_CHAPTER.start); },
    onLaunchCamera: () => cycleLaunchCamera(),
    onLaunchSound: (on) => sound?.setEnabled(on),
  });
  rig.onModeChange = (m) => hud.setMode(m);
  hud.setMode('orbit');

  const timings = {};
  hud.setProgress('Generating procedural materials…', 0.05);
  await nextFrame();
  let t0 = performance.now();
  // Texture generation is the bulk of the start-up cost, so report it map by map.
  // The Falcon wordmarks are painted into a Canvas during createMaterials and baked into a
  // texture for the session. Without waiting, whichever face happened to be resolved at that
  // instant is the one that ships — and the headless check ignores font errors, so it never
  // showed up there.
  if (document.fonts?.ready) await document.fonts.ready;
  const { M } = await createMaterials((name, frac) => hud.setProgress(`Generating materials · ${name}`, 0.05 + frac * 0.2), nextFrame);
  timings.materials = performance.now() - t0;
  hud.setProgress('Lighting and environment…', 0.25);
  await nextFrame();
  const env = createEnvironment(renderer, scene, M, quality);
  dressCampus(scene, M, { stops: Object.values(LAYOUT).filter(l => !l.pad && !l.remote).map(l => l.x), quality: quality.name });
  scene.add(buildRunway(M));
  scene.add(buildCircuit(M));

  // ---- Post-processing (MSAA render target + subtle bloom) ----
  // No stencil. It was added for the scale figures' shadow and made every frame resolve a
  // multisampled depth-stencil buffer, which several drivers (ANGLE on Direct3D 11 among them)
  // have no fast path for: the whole scene fell to about 10 fps on real hardware while the
  // software renderer the checks use measured no difference. The shadow uses depth instead.
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: quality.msaa, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // Contact shadow in the creases the sun does not reach; before bloom, so it acts on light.
  const ao = quality.ao ? createAO(scene, camera, window.innerWidth, window.innerHeight) : null;
  if (ao) composer.addPass(ao.pass);
  // Bloom is the first thing a weak machine gives up: it costs a full-resolution blur chain
  // and the scene reads correctly without it.
  const bloom = quality.bloom
    ? new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.6, 0.92)
    : null;
  // Firefly clamp ahead of the bloom. A thin, curved, polished part — a weld ring, a rail, a
  // tube — always has a pixel somewhere that mirrors the sun straight into the lens, and in
  // HDR that one pixel can be hundreds of times white. The bloom's mip chain spread it into a
  // bright square hanging beside the booster on its way home. The clamp scales any pixel down
  // to a peak of 12, far above where ACES has already saturated to white, so the image is
  // unchanged and only the bloom stops blowing single pixels up into blocks.
  if (bloom) {
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uPeak: { value: 12.0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uPeak; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float m = max(max(c.r, c.g), c.b);
          gl_FragColor = vec4(m > uPeak ? c.rgb * (uPeak / m) : c.rgb, c.a);
        }`,
    }));
  }
  if (bloom) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // The render target above is sized in CSS pixels, which is what EffectComposer stores as its
  // width — so on a device with devicePixelRatio > 1 the scene was rendering into a 1x buffer
  // and being upscaled, while the passes were already sized at DPR. One setSize with the CSS
  // size reconciles both, since the composer captured the renderer's pixel ratio on
  // construction and multiplies by it internally.
  composer.setSize(window.innerWidth, window.innerHeight);

  // ---- Vehicles ----
  const exhibits = {};
  const labels = new THREE.Group(); labels.name = 'labels'; scene.add(labels);
  const humans = new THREE.Group(); humans.name = 'humans'; scene.add(humans);
  // Where every scale figure stands, filled by the exhibit loop and built in one go after it.
  const crowd = [];
  const rulers = new THREE.Group(); rulers.name = 'rulers'; scene.add(rulers);

  const builders = {
    falcon1: [buildFalcon1, 'Falcon 1 · historical exhibit…'],
    starship: [buildStarship, 'Starship and Super Heavy · 13,267 instanced tiles…'],
    falcon9: [buildFalcon9, 'Falcon 9…'],
    falconheavy: [buildFalconHeavy, 'Falcon Heavy…'],
    dragon: [buildDragon, 'Dragon…'],
    starlink: [buildStarlink, 'Starlink V2 Mini…'],
    roadster: [buildRoadster, 'Tesla Roadster and Starman…'],
    engines: [buildEngineHall, 'Raptor 3, Raptor Vacuum and Merlin 1D…'],
    f16: [buildF16, 'F-16A Fighting Falcon…'],
    gt3rs: [buildGt3rs, 'Porsche 911 GT3 RS…'],
    h2r: [buildH2r, 'Kawasaki Ninja H2R…'],
  };
  let step = 0;
  let complex = null;
  let roadsterPedestal = null;
  // Suit colour was Math.random(), so no two loads matched and the committed screenshots could
  // not be reproduced. seeded() already exists for exactly this.
  const humanSuit = seeded(20180206);
  for (const v of VEHICLES) {
    const [fn, msg] = builders[v.id];
    hud.setProgress(msg, 0.3 + (step++ / VEHICLES.length) * 0.6);
    await nextFrame();
    const lay = LAYOUT[v.id];
    const group = new THREE.Group();
    group.name = `exhibit-${v.id}`;
    t0 = performance.now();
    const model = fn(M);
    timings[v.id] = performance.now() - t0;
    if (v.id === 'starlink') {
      // Starlink is presented on a slim post with the bus centred at the mount height.
      const ped = buildPedestal(M, { radius: 0.62, height: 0.35, post: lay.mount - 0.35 - 0.08 });
      group.add(ped);
      model.position.y = lay.mount;
      model.rotation.y = 0;
      env.addStation(lay.x, lay.z, 6);
    } else if (v.id === 'dragon') {
      const ped = buildPedestal(M, { radius: 2.3, height: lay.mount });
      // Cradle: the trunk stands on a conical adapter the way it stands on the second stage —
      // a steel frustum from the 3.66 m trunk base down to the plinth, a bolted interface ring
      // at the top and a foot ring at the bottom. Proportions reconstructed. It replaces four
      // square posts that read as crates stacked under the spacecraft.
      {
        const H = 0.6, rTop = 1.8, rBot = 1.35, y0 = lay.mount;
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, H, 64, 1, true), M.mount);
        cone.position.y = y0 + H / 2;
        const ringTop = new THREE.Mesh(new THREE.TorusGeometry(rTop, 0.045, 8, 96), M.alumDark ?? M.mount);
        ringTop.rotation.x = Math.PI / 2; ringTop.position.y = y0 + H - 0.03;
        const ringBot = new THREE.Mesh(new THREE.TorusGeometry(rBot + 0.02, 0.06, 8, 96), M.mount);
        ringBot.rotation.x = Math.PI / 2; ringBot.position.y = y0 + 0.05;
        const bolts = [];
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          bolts.push({ geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.05, 6), matrix: new THREE.Matrix4().makeTranslation(Math.sin(a) * (rTop + 0.02), y0 + H - 0.075, Math.cos(a) * (rTop + 0.02)) });
        }
        const boltMesh = new THREE.Mesh(mergeAll(bolts), M.alumDark ?? M.mount);
        boltMesh.userData.lodFeature = 0.036;
        for (const m of [cone, ringTop, ringBot, boltMesh]) { m.castShadow = m.receiveShadow = true; ped.add(m); }
      }
      group.add(ped);
      model.position.y = lay.mount + 0.6;
      env.addStation(lay.x, lay.z, 5);
    } else if (v.id === 'f16' || v.id === 'gt3rs' || v.id === 'h2r') {
      // On its wheels on its own pavement, no plinth and no apron ring.
      model.position.y = lay.mount;
    } else if (v.id === 'engines') {
      // No plinth: the engines stand on the apron on their own cradles, which is what makes
      // the 4.4 m of a Raptor Vacuum land next to a visitor rather than above one.
      env.addStation(lay.x, lay.z, 8);
    } else if (v.id === 'roadster') {
      const ped = buildPedestal(M, { radius: 2.5, height: lay.mount });
      roadsterPedestal = ped;
      group.add(ped);
      model.position.y = lay.mount;
      env.addStation(lay.x, lay.z, 6);
    } else if (lay.pad) {
      // Starship stands on the real thing: the launch mount spanning the flame trench, with
      // the tower alongside. No display furniture, and no apron ring — the pad has its own.
      complex = buildLaunchComplex(M);
      group.add(complex);
      model.position.y = lay.mount;
    } else {
      group.add(buildLaunchMount(M, { deck: lay.mount, ...lay.launchMount }));
      model.position.y = lay.mount + lay.lift;
      if (v.id === 'falcon1') {
        const gse = buildFalcon1GroundEquipment(M, { deckY: -lay.lift });
        gse.position.y = model.position.y;
        group.add(gse);
      }
      env.addStation(lay.x, lay.z, lay.mountRadius + 1.5);
    }
    const yaw = THREE.MathUtils.degToRad(lay.yaw ?? 0);
    model.rotation.y = yaw;
    group.add(model);
    group.position.set(lay.x, 0, lay.z);
    scene.add(group);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // Occluders are declared in the exhibit's own frame and stored turned into the world's,
    // because the occlusion test works on world-axis offsets from the exhibit origin — the
    // same frame the label positions below are put into.
    const occSpec = OCCLUDER[v.id] ?? 0;
    const occluders = typeof occSpec === 'number'
      ? (occSpec > 0 ? [[0, 0, occSpec]] : [])
      : occSpec.map(([ox, oz, r, top]) => [ox * cy + oz * sy, -ox * sy + oz * cy, r, top]);
    exhibits[v.id] = { group, model, data: v, lay, occluders, labels: null, lod: null, hullTop: model.position.y + (model.userData.height ?? v.height) };

    // annotations
    const lg = new THREE.Group(); lg.name = `labels-${v.id}`; lg.visible = false;
    for (const a of model.userData.annotations ?? []) {
      const div = document.createElement('div');
      div.className = 'label';
      div.innerHTML = `<span class="label-dot"></span><span class="label-leader"></span><span class="label-text">${a.label}</span>`;
      const obj = new CSS2DObject(div);
      obj.userData.scope = a.scope ?? 'all';
      const [ax, ay, az] = a.position;
      obj.position.set(lay.x + ax * cy + az * sy, model.position.y + ay, lay.z - ax * sy + az * cy);
      lg.add(obj);
    }
    labels.add(lg);
    exhibits[v.id].labels = lg;
    if (complex && v.id === 'starship') {
      // Pad callouts live in the complex frame, which does not turn with the vehicle, and
      // in a group of their own: twenty callouts at once buries the thing they point at, so
      // the vehicle set and the pad set take turns depending on which view is up.
      const pg = new THREE.Group(); pg.name = 'labels-pad'; pg.visible = false;
      for (const a of complex.userData.annotations) {
        const div = document.createElement('div');
        div.className = 'label';
        div.innerHTML = `<span class="label-dot"></span><span class="label-leader"></span><span class="label-text">${a.label}</span>`;
        const obj = new CSS2DObject(div);
        obj.position.set(lay.x + a.position[0], a.position[1], lay.z + a.position[2]);
        pg.add(obj);
      }
      labels.add(pg);
      exhibits[v.id].padLabels = pg;
    }
    // ---- Level of detail ------------------------------------------------------------
    // Two ways a vehicle takes part. A builder may publish a near/far PAIR — Starship's heat
    // shield does, swapping 13,267 instanced hexagons for one textured shell — or it may
    // simply name groups that stop being worth drawing below a pixel threshold. Both are
    // registered against the exhibit's live position, because a vehicle in flight is not
    // where its mount is.
    const here = (out) => {
      const f = exhibits[v.id].flight;
      return out.set(lay.x + (f ? f.position.x : 0),
        exhibits[v.id].hullTop * 0.5 + (f ? f.position.y : 0), lay.z);
    };
    // EVERY pair, not the last one found. The traverse used to assign into a single variable,
    // so a vehicle publishing two swaps registered one of them — which happened to be harmless
    // only because Starship's heat shield was the sole publisher.
    const pairs = [];
    model.traverse(o => { if (o.userData?.lod) pairs.push([o, o.userData.lod]); });
    for (const [owner, pair] of pairs) {
      lod.register({
        name: `${v.id}-${pair.name ?? owner.name ?? 'swap'}`,
        at: here, bounds: owner,
        feature: pair.feature ?? 0.26, bias: pair.bias ?? 1,
        near: pair.near, far: pair.far,
      });
    }
    // Detail groups a builder has marked as small. `lodFeature` is the size of the smallest
    // thing the group draws, so the same threshold means the same thing on a 2 cm panel gap
    // and a 26 cm tile. Each is measured against ITS OWN bounds: on a 124 m vehicle the
    // midpoint of the hull is nowhere near most of what hangs off it.
    const small = [];
    model.traverse((o) => { if (o.userData?.lodFeature) small.push(o); });
    for (const o of small) {
      lod.registerHidden(`${v.id}-${o.name || 'detail'}`, [o], here,
        o.userData.lodFeature, o.userData.lodBias ?? 1, o);
    }

    // Scale figures. Collected rather than built here: every figure in the centre is merged
    // into one mesh per material once the loop is done, which turns 99 draw calls into five.
    const baseY = 0;
    for (const [px, py, pz, ry] of lay.people ?? []) {
      crowd.push({
        x: lay.x + px, y: baseY + py, z: lay.z + pz, ry,
        suit: humanSuit() > 0.5 ? 'white' : 'dark',
      });
    }
    // person on the mount deck for the big vehicles
    if (lay.mountRadius >= 6) {
      // Their shadow stays on the deck: clipped to its plan, it does not hang off the edge.
      const lm = lay.launchMount ?? { halfX: lay.mountRadius, halfZ: lay.mountRadius };
      crowd.push({
        x: lay.x + lay.mountRadius - 1.2, y: lay.mount, z: lay.z + 1.5, ry: 2.4, suit: 'white',
        clip: [lay.x - lm.halfX, lay.x + lm.halfX, lay.z - lm.halfZ, lay.z + lm.halfZ],
      });
    }

    // height ruler
    // height ruler (span ruler for Starlink, laid along X in front of the wings)
    const ruler = buildRuler(M, v.id === 'starlink' ? v.footprint : v.height, v.id);
    if (v.id === 'starlink') {
      ruler.rotation.z = -Math.PI / 2;
      ruler.position.set(lay.x - 15, model.position.y - 1.2, lay.z + 4.2);
    } else {
      const off = v.id === 'starship' ? 22 : v.id === 'falconheavy' ? 12 : v.id === 'falcon9' ? 8 : v.id === 'falcon1' ? 5 : 4.2;
      ruler.position.set(lay.x + off, model.position.y, lay.z);
    }
    ruler.visible = false;
    rulers.add(ruler);
    exhibits[v.id].ruler = ruler;
  }

  // Every figure in the centre, as one mesh per material. Built here rather than inside the
  // loop because merging only pays once all the placements are known.
  humans.add(buildHumanCrowd(M, crowd, { sunDir: env.sunDir }));

  // The launch complex is not an exhibit, so the loop above never reached it — and it is the
  // largest single object in the scene, drawn in most Starship views from a hundred metres or
  // more. Its fine hardware is registered the same way, against its own bounds.
  if (complex) {
    const padSmall = [];
    complex.traverse((o) => { if (o.userData?.lodFeature) padSmall.push(o); });
    for (const o of padSmall) {
      lod.registerHidden(`pad-${o.name || 'detail'}`, [o], null,
        o.userData.lodFeature, o.userData.lodBias ?? 1, o);
    }
  }

  // The ground and the campus dressing register theirs the same way: the chunked grass
  // fields (chunkedInstances) and the fence, whose flag was set and never read.
  for (const root of [scene.getObjectByName('campus'), env.ground]) {
    root?.traverse((o) => {
      if (o.userData?.lodFeature) lod.registerHidden(`site-${o.name || 'detail'}`, [o], null, o.userData.lodFeature, o.userData.lodBias ?? 1, o);
    });
  }

  // ---- Launch sequence ----
  const launch = createLaunch({
    scene, exhibits, complex, env, rig, camera, quality,
    // However the sequence is started — the button, G, the API or a seek — the centre is
    // showing Starship while it runs. Only the button path used to select it, so a launch
    // started any other way flew under an "Overview" header with the overview's rail lit.
    onStart: () => {
      if (reentry?.running) reentry.reset(false);
      if (view.exhibit !== 'starship') { enforce(view.select('starship', 'launch')); syncHud(); }
      enforce(view.claim('launch'));
      hud.setMissionText(null);
      showLaunchTrajectory();
    },
    onState: (st) => hud.setMission(st.running ? st : null),
    // The sequence ends with the booster in the arms, seven minutes in; the ship's flight goes
    // on for most of an hour, and a visitor watching the ship vanish deserves to know that.
    onFinish: (completed) => {
      goPreset('starship', 'site');
      if (completed) hud.notice('The ship flies on: on flight 14 it reached orbit, deployed its payload and came back nine and a half hours in, splashing down in the Pacific. Press X to watch its re-entry.', 9000);
    },
  });
  // Whichever sequence reports, the vehicle has left its mount while either runs: the launch's
  // reset, called with nothing launched, used to clear it under a running re-entry and bring the
  // pad's callouts back over the Pacific (found in the October 2026 review).
  const sequences = {};   // the re-entry, once it is made below
  const anyFlying = (flying) => flying || !!launch.running || !!sequences.reentry?.running || !!sequences.f16?.running || !!sequences.gt3?.running || !!sequences.h2r?.running;
  launch.setVisibilityHook((flying) => view.setFlying(anyFlying(flying)));
  // Opt-in engine sound. Assigned here, after the HUD that toggles it, hence `let` above.
  sound = createLaunchSound({ launch, camera });
  const samples = (f, a, b) => Array.from({ length: 220 }, (_, i) => { const t = a + (b - a) * i / 219; return [t, f(t)]; });
  function showLaunchTrajectory() {
    hud.setTrajectory({
      t0: EVENTS.start, t1: EVENTS.end,
      ship: samples(altitudeAt, EVENTS.start, EVENTS.end),
      booster: samples(boosterAltAt, EVENTS.separation, EVENTS.end),
      events: MILESTONES.map(m => [m.t, m.label]),
      engines: ENGINE_LAYOUT,
    });
  }
  showLaunchTrajectory();

  // ---- Re-entry chapter ----
  // Flight 14's ship coming home: entry, plasma, the belly flop, the flip and the splash in the
  // northern Pacific, on SpaceX's own timeline (reentry.js, reentryFlight.js).
  const REENTRY_TEXT = {
    kind: 'Flight 14 re-entry (SpaceX timeline) · northern Pacific · trajectory computed, not telemetry',
    note: '<summary>Flight 14 re-entry · sources and limits</summary><p><b>Every time on this clock is SpaceX\'s own</b>, from its published flight 14 timeline (28 September 2026): orbit insertion T+25:17–25:36 · deorbit burn T+8:52:37–8:52:48 · entry T+9:28:56 · transonic 9:47:29 · subsonic 9:48:07 · landing burn 9:50:11 · landing flip 9:50:13 · three to two engines 9:50:21 · two to one 9:50:28 · splashdown 9:50:30, in the northern Pacific. The state at entry is <i>derived</i> (sim/mission.js): the ship\'s cutoff state from the integrated ascent, on an assumed circular 200 km orbit, coasts to the 11 s deorbit burn on one 250 tf Raptor, and Kepler\'s equation carries it down to 120 km at ≈7.78 km/s, −1.3°, ≈262 t; that chain reaches the interface ≈22 min before the cited time, which the clock keeps. The glide is <i>integrated</i> over a spherical Earth, with the lift banked whenever all of it would make the ship climb (≈; no bank profile is published), and its drag, lift-to-drag ratio and belly-flop drag are <i>solved</i> so it goes through Mach 1 and Mach 0.8 at the transonic and subsonic calls and reaches the landing burn at the height a smooth 19 s burn needs. Speeds and heights are the model\'s, not telemetry; the ≈60° angle of attack, the plasma colours and the camera positions are read off SpaceX\'s on-board views, approximately. The ocean and the clouds are generic.</p>',
  };
  const reentry = createReentry({
    scene, exhibits, complex, env, rig, camera, M,
    onStart: () => {
      if (launch.running) launch.reset(false);
      if (view.exhibit !== 'starship') { enforce(view.select('starship', 'launch')); syncHud(); }
      enforce(view.claim('launch'));
      hud.setMissionText(REENTRY_TEXT);
      hud.setTrajectory({
        t0: REENTRY_CHAPTER.start, t1: REENTRY_CHAPTER.end,
        ship: samples(reentryAltAt, REENTRY_CHAPTER.start, REENTRY_CHAPTER.end), booster: [],
        events: MILESTONES_RE.map(m => [m.t, m.label]),
      });
    },
    // However the chapter ends (its end, End, G, a vehicle picked, the tour), the panel goes
    // back to the launch's text and profile.
    onState: (st) => { hud.setMission(st.running ? st : null); if (!st.running) { hud.setMissionText(null); showLaunchTrajectory(); } },
    onFinish: (completed) => {
      goPreset('starship', 'overview');
      if (completed) hud.notice('Flight 14\'s ship splashed down on target in the northern Pacific, nine hours and fifty minutes after liftoff.', 8000);
    },
    visibilityHook: (flying) => view.setFlying(anyFlying(flying)),
  });
  sequences.reentry = reentry;

  // ---- The F-16 in flight ----
  // The exhibit's airplane leaves its spot on runway 28 and flies on the flight model
  // (sim/f16Flight.js) in this same scene; the HUD and the flight's bar are ui/f16Hud.js.
  // The ground under it is the one drawn: the runway's pavement, the terrain's height
  // function with the beach and the sea, and past the disc the curvature's drop.
  const hudRoot = document.getElementById('hud');
  const f16Hud = createF16Hud({
    root: hudRoot,
    onEnd: () => f16fly.reset(),
    onCamera: () => f16fly.cycleCamera(),
    onRestart: () => f16fly.restart(),
    onPause: () => f16fly.setPaused(!f16fly.state.paused),
    onAssist: () => f16fly.setAssist(!f16fly.state.assist),
  });
  // What the F-16 can fly into (core/colliders.js): the scene's solid geometry, roofs and decks
  // included, built once when it first flies, the airplane itself left out.
  let f16Grid = null;
  const f16fly = createF16Fly({
    scene, exhibit: exhibits.f16, env, rig, camera, ground: f16Ground, hud: f16Hud,
    solid: (a, b) => f16Grid?.hits(a, b) ?? false,
    onStart: () => {
      if (!f16Grid) f16Grid = buildColliders(scene, { exclude: [exhibits.f16.model], level: true });
      if (launch.running) launch.reset(false);
      if (reentry.running) reentry.reset(false);
      if (view.exhibit !== 'f16') { enforce(view.select('f16', 'launch')); syncHud(); }
      enforce(view.claim('launch'));
      hudRoot.classList.add('is-f16');
    },
    onFinish: () => { hudRoot.classList.remove('is-f16'); goPreset('f16', 'overview'); },
    visibilityHook: (flying) => { view.setFlying(anyFlying(flying)); if (!flying) hudRoot.classList.remove('is-f16'); },
  });
  sequences.f16 = f16fly;
  function toggleFly() {
    if (f16fly.running) { f16fly.reset(); return; }
    if (sequences.gt3?.running) sequences.gt3.reset(false);
    if (sequences.h2r?.running) sequences.h2r.reset(false);
    f16fly.start();
  }

  // ---- The Porsche on the road ----
  // The exhibit's car leaves its skid pad and drives on its vehicle model (sim/gt3Car.js), in
  // this same scene; the instruments and the drive's bar are ui/gt3Hud.js. What each tyre
  // stands on: the circuit's surfaces (core/circuit.js), the runway's pavement, else the
  // plain's ground, grass and sand, with the sea as a hard stop of a kind.
  // The pad's two concrete levels and the 1:3 earth embankment round them (pad.js), with the
  // flame trench 4 m down between them: for the car, and the free cameras below.
  const P0 = exhibits.starship.lay, TW = PAD.trenchHalfW, RUN = PAD.bermY * 3;
  const padGround = (x, z) => {
    const lx = Math.abs(x - P0.x), lz = Math.abs(z - P0.z);
    if (lx < 64 && lz < 46) return lx < TW ? PAD.trenchFloorY : PAD.padY;
    if (lx < 74 && lz < 52) return PAD.bermY;
    const d = Math.hypot(Math.max(0, lx - 74), Math.max(0, lz - 52));
    return d < RUN ? PAD.bermY * (1 - THREE.MathUtils.smoothstep(d, 0, RUN)) : -Infinity;
  };
  const gt3Ground = (x, z) => {
    const c = circuitSurface(x, z);
    if (c) {
      const grip = { track: 1, pad: 1, verge: 0.97, kerb: 0.9, gravel: 0.45 }[c.kind] ?? 1;
      return { h: c.y, mu: grip, roll: c.kind === 'gravel' ? 0.22 : 0, kind: c.kind };
    }
    const [a, rc] = toRunway(x, z);
    const pave = runwaySurface(a, rc);
    if (pave > 0.01) return { h: pave, mu: 0.95, roll: 0, kind: 'runway' };
    const pad = padGround(x, z);
    if (pad > -Infinity) {
      const slab = Math.abs(x - P0.x) < 64 && Math.abs(z - P0.z) < 46;   // the concrete, else the embankment's earth
      return { h: Math.max(pad, terrainHeight(x, z)), mu: slab ? 0.9 : 0.55, roll: slab ? 0 : 0.06, kind: slab ? 'pad' : 'grass' };
    }
    // The plain: dry grass and silt (≈ μ 0.55, a soft surface's drag); under water its bed, the
    // sea's sand or the pools' and channels' mud (core/water.js), with the water's surface.
    const h = groundSample(x, -z).h, w = waterAt(x, z);
    if (w) return w.kind === 'sea' ? { h, mu: 0.5, roll: 0.25, kind: 'sand', water: w.surface } : { h, mu: 0.4, roll: 0.15, kind: 'mud', water: w.surface };
    return { h, mu: 0.55, roll: 0.06, kind: 'grass' };
  };
  // What the car can hit: everything solid in the scene (core/colliders.js: its triangles laid
  // into quarter-metre cells, built once when the drive starts, the car itself left out), as
  // small circles where something stands more than 12 cm above the ground under it and below
  // the car's roof; and the other exhibits, as their occluders. Gathered round the car, again
  // whenever it has moved half a metre.
  let gt3Grid = null, near = null, nearKey = '';
  const cellGround = new Map();
  const gt3Obstacles = (x, z) => {
    const key = `${Math.round(x * 2)},${Math.round(z * 2)}`;
    if (key === nearKey && near) return near;
    nearKey = key;
    const out = [];
    for (const [id, ex] of Object.entries(exhibits)) {
      if (id === 'gt3rs') continue;
      for (const [ox, oz, r] of ex.occluders) {
        const cx = ex.lay.x + ox, cz = ex.lay.z + oz;
        if (Math.abs(cx - x) < r + 4 && Math.abs(cz - z) < r + 4) out.push({ x: cx, z: cz, r });
      }
    }
    gt3Grid?.query(x - 3.4, z - 3.4, x + 3.4, z + 3.4, (cx, cz, lo, hi) => {
      const k = `${cx},${cz}`;
      let h = cellGround.get(k);
      if (h === undefined) { h = gt3Ground(cx, cz).h; cellGround.set(k, h); }
      if (hi > h + 0.12 && lo < h + 1.25) out.push({ x: cx, z: cz, r: CELL * 0.75 });
    });
    near = out;
    return out;
  };
  const gt3Hud = createGt3Hud({
    root: hudRoot,
    onEnd: () => gt3drive.reset(),
    onCamera: () => gt3drive.cycleCamera(),
    onRestart: () => gt3drive.restart(),
    onPause: () => gt3drive.setPaused(!gt3drive.state.paused),
    onTraction: () => gt3drive.setTraction(!gt3drive.sim.state.tc),
    onSound: () => gt3drive.setSound(!gt3drive.sound.enabled),
  });
  const gt3drive = createGt3Drive({
    scene, exhibit: exhibits.gt3rs, env, rig, camera, ground: gt3Ground, obstacles: gt3Obstacles, hud: gt3Hud,
    // Where it waits: its own spot on the skid pad, nose to the east.
    home: () => ({ x: exhibits.gt3rs.lay.x, z: exhibits.gt3rs.lay.z, psi: THREE.MathUtils.degToRad(exhibits.gt3rs.lay.yaw ?? 0) }),
    onStart: () => {
      // The scene's solid geometry, once, without the car (it moves).
      if (!gt3Grid) { gt3Grid = buildColliders(scene, { exclude: [exhibits.gt3rs.model], maxY: 30 }); near = null; nearKey = ''; }
      if (launch.running) launch.reset(false);
      if (reentry.running) reentry.reset(false);
      if (f16fly.running) f16fly.reset(false);
      if (sequences.h2r?.running) sequences.h2r.reset(false);
      if (view.exhibit !== 'gt3rs') { enforce(view.select('gt3rs', 'launch')); syncHud(); }
      enforce(view.claim('launch'));
      hudRoot.classList.add('is-gt3');
    },
    onFinish: () => { hudRoot.classList.remove('is-gt3'); goPreset('gt3rs', 'overview'); },
    visibilityHook: (driving) => { view.setFlying(anyFlying(driving)); if (!driving) hudRoot.classList.remove('is-gt3'); },
  });
  sequences.gt3 = gt3drive;
  function toggleDrive() {
    if (gt3drive.running) { gt3drive.reset(); return; }
    gt3drive.start();
  }
  // ---- The Ninja H2R ----
  // The same ground and the same solid scene as the car's, without the bike itself (it moves);
  // the car is something the bike can hit.
  let h2rGrid = null, h2rNear = null, h2rKey = '';
  const h2rObstacles = (x, z) => {
    const key = `${Math.round(x * 2)},${Math.round(z * 2)}`;
    if (key === h2rKey && h2rNear) return h2rNear;
    h2rKey = key;
    const out = [];
    for (const [id, ex] of Object.entries(exhibits)) {
      if (id === 'h2r') continue;
      for (const [ox, oz, r] of ex.occluders) {
        const cx = ex.lay.x + ox, cz = ex.lay.z + oz;
        if (Math.abs(cx - x) < r + 4 && Math.abs(cz - z) < r + 4) out.push({ x: cx, z: cz, r });
      }
    }
    h2rGrid?.query(x - 3, z - 3, x + 3, z + 3, (cx, cz, lo, hi) => {
      const k = `${cx},${cz}`;
      let h = cellGround.get(k);
      if (h === undefined) { h = gt3Ground(cx, cz).h; cellGround.set(k, h); }
      if (hi > h + 0.15 && lo < h + 1.1) out.push({ x: cx, z: cz, r: CELL * 0.75 });
    });
    h2rNear = out;
    return out;
  };
  const h2rHud = createH2rHud({
    root: hudRoot,
    onEnd: () => h2rRide.reset(),
    onCamera: () => h2rRide.cycleCamera(),
    onRestart: () => h2rRide.restart(),
    onPause: () => h2rRide.setPaused(!h2rRide.state.paused),
    onTraction: () => h2rRide.setAids(!h2rRide.sim.state.aids),
    onSound: () => h2rRide.setSound(!h2rRide.sound.enabled),
  });
  const h2rRide = createH2rRide({
    scene, exhibit: exhibits.h2r, rig, camera, ground: gt3Ground, obstacles: h2rObstacles, hud: h2rHud, M,
    home: () => ({ x: exhibits.h2r.lay.x, z: exhibits.h2r.lay.z, psi: THREE.MathUtils.degToRad(exhibits.h2r.lay.yaw ?? 0) }),
    onStart: () => {
      if (!h2rGrid) { h2rGrid = buildColliders(scene, { exclude: [exhibits.h2r.model], maxY: 30 }); h2rNear = null; h2rKey = ''; }
      if (launch.running) launch.reset(false);
      if (reentry.running) reentry.reset(false);
      if (f16fly.running) f16fly.reset(false);
      if (gt3drive.running) gt3drive.reset(false);
      if (view.exhibit !== 'h2r') { enforce(view.select('h2r', 'launch')); syncHud(); }
      enforce(view.claim('launch'));
      hudRoot.classList.add('is-gt3');
    },
    onFinish: () => { hudRoot.classList.remove('is-gt3'); goPreset('h2r', 'overview'); },
    visibilityHook: (riding) => { view.setFlying(anyFlying(riding)); if (!riding) hudRoot.classList.remove('is-gt3'); },
  });
  sequences.h2r = h2rRide;
  function toggleRide() {
    if (h2rRide.running) { h2rRide.reset(); return; }
    h2rRide.start();
  }
  function seq() { return reentry?.running ? reentry : launch; }

  hud.setProgress('Compiling shaders…', 0.95);
  await nextFrame();
  performance.mark('vc:compile');
  // Warm-up, one part of the scene at a time — each exhibit, the pad, the ground — with a
  // frame between parts so the progress bar keeps moving. The profile (tools/perceived.mjs)
  // showed that precompiling programs was not where the time went: the FIRST RENDER was one
  // ~12 s task in software rendering, because it is where every texture and vertex buffer is
  // uploaded, the shadow pass's depth programs are built and any program whose state differs
  // from the precompiled one is rebuilt — all at once, with the page frozen. Rendering the
  // real scene into a 1 × 1 target with only one part visible (and nothing culled) does that
  // same work for that part, with the lights and shadows it will actually be drawn with.
  {
    // Hidden top-level parts too: the curved Earth under the flight is a scene child that stays
    // hidden until 9 km up, and left out here it compiled its two programs at T+62.
    const parts = scene.children.filter(o => !o.isLight);
    const shown = parts.map(p => p.visible);
    const warmRT = new THREE.WebGLRenderTarget(1, 1);
    const culled = [];
    scene.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    const prevTarget = renderer.getRenderTarget();
    for (let i = 0; i < parts.length; i++) {
      for (const p of parts) p.visible = p === parts[i];
      // Everything under this part is drawn, not only what shows at rest: the launch
      // effects (plumes, engine jets, vapour, the ground cloud, the curved Earth) and the
      // detail the LOD is holding back. Hidden, they were compiled the first time they
      // appeared — 27 programs at the moment of ignition, a stall right at liftoff.
      const hidden = [];
      parts[i].traverse(o => { if (!o.visible && o !== parts[i]) { hidden.push(o); o.visible = true; } });
      renderer.setRenderTarget(warmRT);
      renderer.render(scene, camera);
      for (const o of hidden) o.visible = false;
      hud.setProgress('Preparing the scene…', 0.95 + 0.05 * (i + 1) / parts.length);
      await nextFrame();
    }
    parts.forEach((p, i) => { p.visible = shown[i]; });
    for (const o of culled) o.frustumCulled = true;
    renderer.setRenderTarget(prevTarget);
    warmRT.dispose();
  }
  performance.mark('vc:first-render');
  composer.render();
  performance.mark('vc:first-render-done');
  await nextFrame();
  // Site plan for the HUD map, read off the built scene rather than restated: the apron and
  // the pad's parts by their world bounds (the complex is not rotated), the stops from the
  // same layout table that placed the exhibits.
  {
    const rects = [];
    const _b = new THREE.Box3();
    const addRect = (obj, kind) => {
      if (!obj) return;
      _b.setFromObject(obj);
      rects.push({ kind, x0: _b.min.x, z0: _b.min.z, x1: _b.max.x, z1: _b.max.z });
    };
    rects.push(...(scene.getObjectByName('campus')?.userData.plan ?? []));
    for (const [name, kind] of [['pad-ground', 'pad'], ['deluge-slab', 'plant'], ['pad-farm', 'plant'], ['olit', 'tower']]) {
      addRect(complex?.getObjectByName(name), kind);
    }
    const stops = VEHICLES.map((v, i) => ({ id: v.id, name: v.name, n: i + 1, x: exhibits[v.id].lay.x, z: exhibits[v.id].lay.z }));
    const xs = [...rects.flatMap(r => [r.x0, r.x1]), ...stops.map(p => p.x)];
    const zs = [...rects.flatMap(r => [r.z0, r.z1]), ...stops.map(p => p.z)];
    const m = 14;
    hud.setMap({ bounds: [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m], rects, stops });
  }
  hud.hideLoading();
  hud.showCoach();
  hud.setActive(null);

  // ---- Interaction ----
  // One object holds what the centre is showing, and one function reacts to it. Everything
  // that used to be a loose flag — which exhibit, which view, who owns the camera, is the
  // vehicle flying, is the Roadster in orbit, is the furniture up — is a field or a derived
  // property of ViewState now, so a transition cannot be half-applied. See core/viewState.js
  // for why: every costly bug in this project lived in the gaps between those flags.
  //
  // `site` and the preset resolver are injected rather than imported, because only main.js
  // knows the exhibit catalogue.
  const SITE_VIEWS = new Set(VEHICLES.flatMap(v => (v.presets ?? []).filter(p => p.frame === 'site').map(p => p.id)));
  const view = new ViewState({
    isSiteView: (v) => SITE_VIEWS.has(v.preset),
    // A requested view that the exhibit does not have falls back to its first, so a typo in a
    // deep link or a stale tour entry cannot put the machine into a view that does not exist.
    resolvePreset: (id, want) => {
      const list = exhibits[id]?.data.presets ?? [];
      return list.find(p => p.id === want)?.id ?? list[0]?.id ?? null;
    },
  });
  // The rig releases a scripted shot on its own, from its own pointer and wheel handlers. This
  // is how the state machine finds out, so the two can never disagree about who is driving.
  rig.onExternalRelease = () => { view.claim('user'); };
  // Read-only aliases kept for the many places below that only look at the state.
  const state = view.toggles;
  function setToggle(name, value) {
    view.setToggle(name, value);
    hud.toggle(name, value);
  }
  // The Roadster is a museum piece in the row and a payload in the orbital view, never both:
  // plinth or payload adapter, ground or Earth. Entering the view swaps the presentation and
  // leaving it swaps back — env.setAltitude(0) restores sky, fog, ambient and ground exactly,
  // which is what the check asserts after walking every preset.
  let orbitalMounted = false, backdrop = null, orbitHidden = [];
  function setOrbital(on) {
    if (on === orbitalMounted) return;
    orbitalMounted = on;
    const ex = exhibits.roadster;
    ex?.model.userData.setOrbital?.(on);
    if (roadsterPedestal) roadsterPedestal.visible = !on;
    if (on && !backdrop && ex) {
      // Placed ahead of and below the car in its own frame, which is where the orbital view
      // looks. Built on first use so the museum path does not pay for it.
      const yaw = THREE.MathUtils.degToRad(ex.lay.yaw ?? 0);
      const lx = 900, lz = 3100, ly = -1150;
      backdrop = buildOrbitalBackdrop(
        new THREE.Vector3(ex.lay.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), ly,
          ex.lay.z - lx * Math.sin(yaw) + lz * Math.cos(yaw)), 1750);
      scene.add(backdrop);
    }
    if (backdrop) backdrop.visible = on;
    // In orbit the car is alone. env.setSpace takes away the ground, the road markings and the
    // sky, but the museum apron, its scrub, the service trucks and the other seven exhibits
    // are separate groups, and they stayed: the "In orbit" view showed the Roadster parked on
    // a concrete floor with bushes, 30 km up, with Earth behind it.
    if (on) {
      orbitHidden = scene.children.filter(o => o.visible
        && (o.name === 'campus' || (o.name.startsWith('exhibit-') && o.name !== 'exhibit-roadster')));
      for (const o of orbitHidden) o.visible = false;
    } else {
      for (const o of orbitHidden) o.visible = true;
      orbitHidden = [];
    }
    env.setAltitude(on ? 30000 : 0);
    env.setSpace(on);
  }

  /**
   * The one place the scene is brought into line with the state. Subscribed to ViewState, so
   * it runs once per settled transition rather than being remembered at each call site — the
   * forgetting is what used to leave the preset tabs and the camera disagreeing.
   */
  function applyVisibility() {
    // Callouts, rulers and the scale figures are museum furniture: they belong on a vehicle
    // standing on its mount, not on one that has left it.
    const { site, orbital, near, flying, toggles } = { ...view.snapshot(), toggles: view.toggles, near: view.near };
    setOrbital(orbital);
    // The site map means nothing 30 km up.
    document.body.classList.toggle('is-orbital', !!orbital);
    for (const [id, ex] of Object.entries(exhibits)) {
      const on = id === view.exhibit && !flying;
      const cut = ex.model.userData.cutaway;
      if (cut) {
        const open = on && view.preset === 'cutaway';
        for (const name of cut.shell) ex.model.getObjectByName(name).visible = !open;
        ex.model.getObjectByName(cut.interior).visible = open;
      }
      const lg = labels.getObjectByName(`labels-${id}`);
      lg.visible = on && toggles.labels && !(ex.padLabels && site);
      // Callouts carry the range they read at. Showing all nine on a 3,9 m car at once hides
      // the car behind its own captions, which is what the overview shot was doing.
      for (const o of lg.children) {
        const sc = o.userData.scope ?? 'all';
        o.visible = sc === 'all' || (sc === 'near' && near) || (sc === 'orbital' && orbital);
      }
      // The engine-bay camera sits inside the mount. Pad callouts (tower, arms)
      // project onto the bells from there, so that one preset keeps the vehicle
      // labels off and the pad labels off.
      if (ex.padLabels) ex.padLabels.visible = on && toggles.labels && site && view.preset !== 'engines';
      ex.ruler.visible = on && toggles.ruler && !site && !(id === 'roadster' && orbital);
    }
    humans.visible = toggles.humans && view.furniture;
  }
  view.subscribe(applyVisibility);

  /**
   * The one route by which the visitor takes the camera back.
   *
   * There were several before, and each knew about a different subset of the machinery, so the
   * logical state and the rig disagreed in exactly the cases nobody tested. `stopTour` cleared
   * the timer and the HUD but never claimed the camera, so a drag during the tour left
   * `owner === 'tour'` with no tour running; the tour's own last step called `stopTour()` and
   * then jumped as `'tour'`, so finishing the tour normally left it owning the camera for the
   * rest of the session; and `CameraRig.takeOver()`, which fires on every pointerdown and
   * wheel inside the canvas, released the external driver without telling the state machine
   * anything at all.
   *
   * Nothing visible broke, which is why it survived: the *scene* was right because
   * `applyVisibility` keys off exhibit and flying, not off owner. What was wrong was every
   * decision made by asking who owns the camera — so `claim('user')` reported no transition
   * and cancelled nothing.
   *
   * @param {boolean} endLaunch  true when the visitor asked for something incompatible with
   *        the sequence (free flight, the tour, picking a vehicle). A plain drag or scroll
   *        does NOT end the launch: the rig hands over the camera and the rocket flies on.
   */
  function claimUserControl({ endLaunch = false } = {}) {
    rig.takeOver();
    stopTour();
    const stop = view.claim('user');
    if (stop.tour) stopTour();
    if (endLaunch && launch.running) launch.reset(false);
  }

  // Free flight during a launch is deliberate — flying alongside the rocket is one of the
  // things the sequence is for — so F takes the camera without ending the sequence.
  function toggleMode() {
    claimUserControl();
    rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly');
  }
  // Walking at eye height is the one view that shows what 1:1 means: a 70 m rocket from where a
  // visitor stands. V toggles it; a double-click walks to the point clicked.
  function toggleWalk() {
    claimUserControl();
    rig.setMode(rig.mode === 'walk' ? 'orbit' : 'walk');
  }

  /**
   * Broadcast shots → your own orbit riding with the booster → riding with the ship → back.
   * Riding keeps the orbit's centre on the vehicle as it moves (launch.js, followCamera), so
   * the camera can be turned freely, paused and resumed without losing the rocket.
   */
  function cycleLaunchCamera() {
    if (reentry.running) {
      if (rig.mode !== 'orbit') rig.setMode('orbit');
      enforce(view.claim('launch'));
      const order = ['director', 'onboard', 'chase'];
      reentry.setFollow(order[(order.indexOf(reentry.state.follow) + 1) % order.length]);
      return;
    }
    if (!launch.running) return;
    const st = launch.state;
    const next = st.director ? 'booster' : st.follow === 'booster' ? 'ship' : 'director';
    if (next === 'director') {
      if (rig.mode !== 'orbit') rig.setMode('orbit');
      enforce(view.claim('launch'));
      rig.external = true;
      launch.setFollow('director');
    } else {
      claimUserControl();
      if (rig.mode !== 'orbit') rig.setMode('orbit');
      launch.setFollow(next);
    }
  }

  function toggleReentry() {
    if (reentry.running) { reentry.reset(); return; }
    view.select('starship', 'launch');
    hud.setActive('starship');
    reentry.start();
  }
  function toggleLaunch() {
    if (launch.running) { launch.reset(); return; }
    // A visitor who turned the sound on last time gets it again; this is a click or a key
    // press, which is what lets the page start audio.
    if (hud.soundWanted() && !sound.enabled) sound.setEnabled(true);
    view.select('starship', 'launch');
    hud.setActive('starship');
    launch.start();
  }
  function worldPreset(id, presetId) {
    const ex = exhibits[id];
    const p = ex.data.presets.find(x => x.id === presetId) ?? ex.data.presets[0];
    const o = new THREE.Vector3(ex.lay.x, ex.model.position.y, ex.lay.z);
    // Views are authored in the vehicle's own frame, so they turn with it.
    const yaw = THREE.MathUtils.degToRad(ex.lay.yaw ?? 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // Views of the launch complex are authored in the site frame, which does not turn with
    // the vehicle and is measured from grade rather than from the deck.
    const put = p.frame === 'site'
      ? ([x, y, z]) => [o.x + x, y, o.z + z]
      : ([x, y, z]) => [o.x + x * cy + z * sy, o.y + y, o.z - x * sy + z * cy];
    return { pos: put(p.pos), target: put(p.target) };
  }
  /**
   * Carries out whatever the state machine says a change of camera owner has to stop. The
   * machine decides the rule; this knows where the tour's timer and the launch sequence live.
   *
   * Three things can drive the camera — the visitor, the tour and the launch — and they used
   * to cancel each other only in some directions: starting the tour reset the launch, but
   * starting the launch left the tour's timer running, so it went on re-framing the scene
   * under a sequence that owned the camera and then dropped the viewer at the overview with
   * the rocket still in flight.
   */
  function enforce(stop) {
    if (stop?.tour) stopTour();
    if (stop?.launch && launch.running) launch.reset(false);
    // The re-entry chapter holds the camera under the same owner as the launch: picking a
    // vehicle or starting the tour left it running under them (audit, 30-09).
    if (stop?.launch && reentry?.running) reentry.reset(false);
    // The F-16's flight holds the camera under the same owner, and stops the same way.
    if (stop?.launch && sequences.f16?.running) sequences.f16.reset(false);
    if (stop?.launch && sequences.gt3?.running) sequences.gt3.reset(false);
    if (stop?.launch && sequences.h2r?.running) sequences.h2r.reset(false);
  }

  /** Brings the HUD into line with the state, after the scene has been. */
  function syncHud() {
    hud.setActive(view.exhibit);
    if (view.preset) hud.setPreset(view.preset);
  }

  function select(id) {
    // Picking a vehicle is a request to look at the museum, so it ends whatever was driving.
    enforce(view.select(id, 'user'));
    syncHud();
    if (!id) { const o = overviewFor(freeAspect(), camera.fov); rig.flyTo(o.pos, o.target, 2.0); lastOverview = new THREE.Vector3(...o.pos); return; }
    const w = worldPreset(id, view.preset);
    rig.flyTo(w.pos, w.target, 1.9);
  }
  function goPreset(id, presetId, owner = 'user') {
    enforce(view.goPreset(id, presetId, owner));
    syncHud();
    const w = worldPreset(id, view.preset);
    rig.flyTo(w.pos, w.target, 1.5);
  }
  /** @param owner who is asking; the tour passes 'tour' so it does not cancel itself. */
  function jump(id, presetId, owner = 'user') {
    if (!id) {
      enforce(view.select(null, owner));
      syncHud();
      const o = overviewFor(freeAspect(), camera.fov);
      rig.jumpTo(o.pos, o.target);
      lastOverview = new THREE.Vector3(...o.pos);
      return;
    }
    enforce(view.goPreset(id, presetId ?? 'overview', owner));
    syncHud();
    const w = worldPreset(id, view.preset);
    rig.jumpTo(w.pos, w.target);
  }
  // ---- Guided tour ----------------------------------------------------------------------
  // A museum has a route through it. This one walks every exhibit, stopping where the authored
  // views already point, and hands the camera straight back the moment the visitor touches it —
  // the same courtesy the launch sequence extends.
  // Each stop says one thing worth knowing about what is on screen, and where it comes from.
  // Every figure here is one the data sheet already carries with that source; an estimate or a
  // reconstruction says so.
  const TOUR = [
    ['starship', 'site', 8, 'Pad 2 at Starbase, rebuilt at 1:1: a square, water-cooled launch mount with 20 hold-down clamps over a bidirectional flame trench, and catch arms of ≈26 m. The tower is ≈480 ft with a 10 ft lightning rod, the FAA\'s planning figure.', 'nsf_pad2'],
    ['starship', 'engines', 6, '33 Raptor 3 hang in the open below Super Heavy\'s thrust ring. Each Raptor 3 is 1.3 m across, 2.9 m tall and gives 250 tf.', 'spacex_starship'],
    ['starship', 'tiles', 6, 'The real ship carries about 18,000 hexagonal tiles; 13,267 are modelled here, each 0.26 m across the flats.', 'wiki_starship'],
    ['starship', 'flaps', 6, 'Two forward flaps on the leeward side and two aft flaps steer the ship back through the atmosphere. On V3 each aft flap has one actuator with three motors.', 'spacex_v3'],
    ['starship', 'trench', 6, 'The flame trench: a concrete bathtub lined with stainless steel, open at both ends, with a deflector of steel pipes in the middle. Its 22 m width and 4.2 m depth are reconstructed.', 'nsf_pad2'],
    ['falcon9', 'overview', 6, 'Falcon 9 Block 5: 70 m tall and 3.66 m across (12 ft), nine Merlin 1D on the first stage and one Merlin Vacuum above.', 'spacex_f9'],
    ['falcon9', 'octaweb', 5, 'The Octaweb: eight Merlin 1D round a centre engine, 845 kN each at sea level.', 'wiki_merlin'],
    ['falcon9', 'interstage', 5, 'The black interstage carries the four titanium grid fins at its base and the pneumatic pushers that separate the stages.', 'wiki_f9b5'],
    ['falconheavy', 'overview', 6, 'Falcon Heavy: three first-stage cores, 27 Merlins, 12.2 m wide and 70 m tall.', 'spacex_fh'],
    ['falconheavy', 'engines', 5, '27 Merlin 1D: 22,819 kN together at sea level.', 'spacex_fh'],
    ['dragon', 'overview', 6, 'Crew Dragon: 8.1 m with its trunk and 4 m across the heat shield; up to seven crew, four on space-station missions.', 'spacex_dragon'],
    ['dragon', 'superdraco', 5, 'Eight SuperDraco escape engines in four pairs, 71 kN each. The two windows sit either side of the hatch.', 'spacex_dragon'],
    ['dragon', 'trunk', 5, 'The trunk is half solar array and half radiator, and is jettisoned before re-entry.', 'nasa_ccp_presskit'],
    ['starlink', 'overview', 6, 'Starlink V2 Mini: two solar wings of 52.5 m² each, about 30 m tip to tip.', 'teslarati_v2mini'],
    ['starlink', 'antennas', 5, 'The Earth-facing side of the bus, where the phased-array antennas are.', null],
    ['roadster', 'overview', 6, 'Tesla Roadster, first generation: 3.946 m long and 1.851 m across the mirrors. It flew on the first Falcon Heavy on 6 February 2018.', 'tesla_roadster_sm'],
    ['roadster', 'detail', 5, 'An 871 mm front overhang and a 2,351 mm wheelbase, from Tesla\'s own service manual.', 'tesla_roadster_sm'],
    ['roadster', 'starman', 5, 'Starman: a mannequin in a SpaceX pressure suit, at the wheel.', 'wiki_roadster'],
    ['roadster', 'earth', 7, 'In orbit, on its payload adapter. The Earth behind it is illustrative, not a map.', 'spacex_fh_demo'],
    ['engines', 'overview', 6, 'Raptor 3, Raptor Vacuum and Merlin 1D side by side, all at 1:1.', 'spacex_starship'],
    ['engines', 'raptor', 5, 'Raptor 3: 1.3 m across, 2.9 m tall, 250 tf. Its plumbing is folded into the housings: a charcoal bell, the chamber rings, the manifold disc and the turbopump block.', 'spacex_starship'],
    ['engines', 'rvac', 5, 'Raptor Vacuum: a 2.3 m exit, 4.4 m tall, 275 tf. Its extension is cooled by radiating heat away.', 'spacex_starship'],
    ['falcon1', 'overview', 6, 'Falcon 1, 2008 configuration: 21.98 m from nozzle exit to tip and 1.681 m across, from the dimensioned drawing in its 2008 user\'s guide.', 'spacex_falcon1_2008'],
    ['falcon1', 'cutaway', 6, 'An educational cutaway of the second stage, with its pressure-fed Kestrel engine inside the interstage.', 'spacex_falcon1_2008'],
    ['gt3rs', 'overview', 6, 'Porsche 911 GT3 RS (992), 2023: 4.572 m long, 1.900 m wide and 1.322 m tall to the rear wing\'s upper edge, which stands above the roof.', 'porsche_techdata'],
    ['gt3rs', 'side', 5, 'Behind the rear axle, a naturally aspirated flat six of 3,996 cm³: 386 kW (525 PS) at 8,500 rpm, 9,000 rpm maximum. Press B to drive it.', 'porsche_techdata'],
    ['gt3rs', 'rear', 5, 'The swan-neck wing, with the first DRS on a production Porsche: 409 kg of downforce at 200 km/h and 860 kg at 285 km/h.', 'porsche_presskit'],
    ['gt3rs', 'wheel', 5, 'Centre-lock wheels on 275/35 ZR 20 tyres in front and 335/30 ZR 21 behind; 408 × 36 mm cast iron discs with six-piston callipers.', 'porsche_techdata'],
    ['h2r', 'overview', 6, 'Kawasaki Ninja H2R, 2027: 2.070 m long, 0.850 m wide across its carbon wings, 1.160 m tall; 216 kg ready to ride. Closed-course only.', 'kawasaki_h2r'],
    ['h2r', 'engine', 5, 'A supercharged 998 cm³ inline four in a green steel trellis: 228 kW at 14,000 rpm, 240 kW with ram air, 165 Nm at 12,500 rpm. Press N to ride it.', 'kawasaki_h2r'],
  ];
  let tourAt = -1, tourTimer = 0;

  function tourStep() {
    tourAt++;
    if (tourAt >= TOUR.length) {
      // Finishing the tour has to hand the camera back, not just stop the timer. Returning to
      // the overview as 'tour' left the machine believing a tour that no longer existed owned
      // the camera, so the next thing the visitor did reported no change of owner.
      stopTour();
      jump(null, undefined, 'user');
      return;
    }
    const [id, preset, hold, text, src] = TOUR[tourAt];
    jump(id, preset, 'tour');
    hud.setTour({ step: tourAt + 1, total: TOUR.length, name: exhibits[id].data.name, text, src });
    tourTimer = window.setTimeout(tourStep, hold * 1000);
  }
  function startTour() {
    if (tourAt >= 0) return;
    enforce(view.claim('tour'));
    tourAt = -1;
    tourStep();
  }
  function stopTour() {
    if (tourAt < 0) return;
    clearTimeout(tourTimer);
    tourAt = -1;
    hud.setTour(null);
    // A tour that has stopped cannot still own the camera. The guard is what keeps this from
    // fighting `enforce`: when the launch takes over, the machine is already on 'launch' by
    // the time this runs to clear the timer, and claiming 'user' here would take the camera
    // straight back off the sequence that had just been handed it.
    if (view.owner === 'tour') view.claim('user');
  }
  const toggleTour = () => (tourAt >= 0 ? claimUserControl() : startTour());
  /**
   * Runs the tour's LAST step now, for the gate. Not a shortcut round the code it is testing:
   * it drops the timer onto the final index and lets the real `tourStep` take the real
   * end-of-tour branch, because waiting out fourteen stops at four to six seconds each is not
   * something a build can do and "the tour ends" is exactly where the owner went stale.
   */
  function tourRunToEnd() {
    if (tourAt < 0) return;
    clearTimeout(tourTimer);
    tourAt = TOUR.length - 1;
    tourStep();
  }
  // Any attempt to drive the camera ends the tour rather than fighting it — and takes
  // ownership with it, which is the part that used to be missed. The rig's own takeOver()
  // fires on the same events and releases the scripted shot; this is what tells the state
  // machine that it did.
  for (const ev of ['pointerdown', 'wheel']) {
    canvas.addEventListener(ev, () => claimUserControl(), { passive: true });
  }

  // Double-click re-centres the orbit on the surface under the cursor, the way every model
  // viewer works. Only solid, drawn geometry counts: the sky dome, the cloud shell, point
  // clouds, lines and anything hidden (or inside a hidden group) are skipped.
  const _pick = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const shown = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
  canvas.addEventListener('dblclick', (e) => {
    if (rig.mode === 'fly' || renderPass.camera !== camera) return;
    const r = canvas.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _pick.setFromCamera(_ndc, camera);
    _pick.far = 2500;
    // Walking, the site fence is see-through in both senses: what the visitor aims at through
    // the wire is what lies behind it. Stopping the ray on the mesh put the destination on the
    // fence line itself, just over it, and the trip went out through the gate and back round
    // to the far face of the wire, where it stuck.
    const seeThrough = (o) => rig.mode === 'walk' && /^site-fence/.test(o.name ?? '');
    const hit = _pick.intersectObjects(scene.children, true).find(h =>
      (h.object.isMesh || h.object.isInstancedMesh) && shown(h.object) && !seeThrough(h.object)
      && !h.object.material?.transparent && h.object.material?.depthWrite !== false);
    if (!hit) return;
    if (rig.mode === 'walk') { const r = walkRoute(hit); rig.travelTo(r.route, r.look); return; }
    claimUserControl();
    rig.focusOn(hit.point);
  });

  // Text fields keep their keys; a range input (the Sun slider) only wants the arrows, and after
  // dragging it the focus stayed on it and every shortcut (G, F, P, L…) went dead until a click
  // elsewhere.
  const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
  window.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    // Every key here is a toggle. Held down, the auto-repeat started and stopped the launch
    // over and over; with a modifier it is the browser's shortcut (Ctrl+L, Ctrl+R), not ours,
    // and both used to flip the labels or the ruler on the way.
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    // The digits 1–9 pick the first nine exhibits. As strings, '5' <= '10' is false, so with ten
    // exhibits a string comparison would have switched off every key from 2 to 9.
    if (/^[1-9]$/.test(k) && Number(k) <= VEHICLES.length) select(VEHICLES[Number(k) - 1].id);
    else if (k === '0') select(null);
    else if (k === 'c' && (launch.running || reentry.running) && rig.mode === 'orbit') cycleLaunchCamera();
    else if (k === 'x') toggleReentry();
    else if (k === 'j') toggleFly();
    else if (k === 'b') toggleDrive();
    else if (k === 'n') toggleRide();
    else if (k === 'f') toggleMode();
    else if (k === 'v') toggleWalk();
    else if (k === 'g') toggleLaunch();
    else if (k === 'p') toggleTour();
    else if (k === 'l') setToggle('labels', !state.labels);
    else if (k === 'r') setToggle('ruler', !state.ruler);
    else if (k === 't') hud.toggleSheet();
    else if (k === 'h' || k === '?') hud.showHelp(document.getElementById('help').classList.contains('hidden'));
    else if (k === 'escape') hud.showHelp(false);
    // Mission transport, only while the sequence runs. Space is free flight's "up", and on a
    // focused button it is the button's own click, so it pauses only outside both.
    else if (seq().running && (k === 'k' || (k === ' ' && rig.mode !== 'fly' && e.target.tagName !== 'BUTTON'))) {
      e.preventDefault();
      seq().setPaused(!seq().state.paused);
    } else if (seq().running && rig.mode === 'orbit' && (k === 'arrowleft' || k === 'arrowright')) {
      const t = hud.milestoneStep(seq().state.t, k === 'arrowright' ? 1 : -1);
      if (t !== null) { e.preventDefault(); seq().seek(t); }
    }
  });

  // ---- Ground for the free cameras ----
  // What a visitor stands on: the terrain function the ground mesh itself is built from, and
  // the pad's two concrete levels with the 1:3 earth embankment round them (pad.js). Analytic,
  // so it costs nothing per frame and cannot disagree with a raycast against a hidden mesh.
  {
    const P = exhibits.starship.lay;
    rig.groundAt = (x, z) => Math.max(terrainHeight(x, z), padGround(x, z), 0);
    // Where a walking visitor cannot go: the mounts and plinths, the launch mount and the tower
    // base. Circles round each footprint, a little generous.
    const obs = [];
    for (const [id, lay] of Object.entries(LAYOUT)) {
      if (lay.pad) {
        const [tx, , tz] = towerToPad([PAD.towerX - 3, 0, 0]);
        obs.push([lay.x, lay.z, 18], [lay.x + tx, lay.z + tz, 12]);
      } else if (lay.launchMount) {
        obs.push([lay.x, lay.z, Math.hypot(lay.launchMount.halfX, lay.launchMount.halfZ) + 0.6]);
      } else if (Array.isArray(OCCLUDER[id])) {
        const yaw = THREE.MathUtils.degToRad(lay.yaw ?? 0);
        for (const [ox, oz, r] of OCCLUDER[id]) obs.push([lay.x + ox * Math.cos(yaw) + oz * Math.sin(yaw), lay.z - ox * Math.sin(yaw) + oz * Math.cos(yaw), r + 0.5]);
      } else if (id === 'dragon') obs.push([lay.x, lay.z, 3.0]);
      else if (id === 'roadster') obs.push([lay.x, lay.z, 3.1]);
      else if (id === 'starlink') obs.push([lay.x, lay.z, 1.2]);
    }
    rig.obstacles = obs;
    // Walls a walker goes round: the site fence (open at the service-road gate and along the
    // road) and the flame trench's rim, a 4,2 m drop with nothing to climb out by.
    const fence = scene.getObjectByName('campus')?.userData.fence ?? [];
    const tx = PAD.trenchHalfW, tz = 46;
    rig.walls = [...fence,
      [P.x - tx, P.z - tz, P.x - tx, P.z + tz], [P.x + tx, P.z - tz, P.x + tx, P.z + tz],
      [P.x - tx, P.z - tz, P.x + tx, P.z - tz], [P.x - tx, P.z + tz, P.x + tx, P.z + tz]];
    rig.onWalkSpeed = (v) => hud.notice(`Walking pace · ${v < 10 ? v.toFixed(1) : Math.round(v)} m/s`);
    /**
     * Where a double-click in walk mode takes the visitor, and by which way. An exhibit is
     * walked up to — to the edge of its footprint plus a few metres, on the side the visitor is
     * coming from, facing the point clicked — and anything else is walked to directly. A trip
     * that would cross the site fence goes through the gate on the service road instead of
     * stopping at the wire, which is what the walk used to do.
     */
    walkRoute = (hit) => {
      let id = null;
      for (let o = hit.object; o; o = o.parent) { const m = /^exhibit-(.+)$/.exec(o.name ?? ''); if (m) { id = m[1]; break; } }
      const c = camera.position;
      let dest = [hit.point.x, hit.point.z];
      if (id) {
        const lay = LAYOUT[id];
        const circ = obs.filter(([ox, oz, r]) => Math.hypot(hit.point.x - ox, hit.point.z - oz) <= r + 0.5)
          .sort((a, b) => a[2] - b[2])[0] ?? [lay.x, lay.z, 2];
        const [ox, oz, r] = circ;
        const dx = c.x - ox, dz = c.z - oz, d = Math.hypot(dx, dz) || 1;
        const stand = r + Math.min(12, 3 + r * 0.25);
        dest = [ox + dx / d * stand, oz + dz / d * stand];
      }
      // No destination on a wall: a point within a metre of one (ground clicked at the foot of
      // the fence or the trench rim) moves a metre clear of it, on the side it was clicked.
      for (const [x0, z0, x1, z1] of rig.walls) {
        const ex = x1 - x0, ez = z1 - z0, L2 = ex * ex + ez * ez || 1;
        const u = Math.max(0, Math.min(1, ((dest[0] - x0) * ex + (dest[1] - z0) * ez) / L2));
        const qx = x0 + ex * u, qz = z0 + ez * u;
        const d = Math.hypot(dest[0] - qx, dest[1] - qz);
        if (d >= 1) continue;
        // Away from the nearest point, or — exactly on the line — to the side the visitor is on.
        let nx = dest[0] - qx, nz = dest[1] - qz;
        if (d < 1e-3) { nx = -ez; nz = ex; if (nx * (c.x - x0) + nz * (c.z - z0) < 0) { nx = -nx; nz = -nz; } }
        const n = Math.hypot(nx, nz) || 1;
        dest = [qx + nx / n, qz + nz / n];
      }
      const route = [];
      const crosses = (w, x0, z0, x1, z1) => { const keep = rig.walls; rig.walls = [w]; const r = rig._crossesWall(x0, z0, x1, z1); rig.walls = keep; return r; };
      // The rear fence runs along z = −18 with its gate on the service road; the sides run
      // from it to the road at z = 20, open at their front ends. Crossing the rear line
      // anywhere but the gate goes through the gate; crossing a side goes round its end.
      if (fence.length >= 4) {
        const gate = [(fence[0][2] + fence[1][0]) / 2, fence[0][1]];
        const rear = crosses(fence[0], c.x, c.z, dest[0], dest[1]) || crosses(fence[1], c.x, c.z, dest[0], dest[1]);
        const side = fence.slice(2).find(w => crosses(w, c.x, c.z, dest[0], dest[1]));
        if (rear) {
          const inside = c.z > gate[1];
          route.push([gate[0], gate[1] + (inside ? 6 : -6)], [gate[0], gate[1] + (inside ? -6 : 6)]);
        } else if (side) {
          route.push([side[2] + Math.sign(c.x - side[2]) * 4, side[3] + 4], [side[2] - Math.sign(c.x - side[2]) * 4, side[3] + 4]);
        }
      }
      route.push(dest);
      return { route, look: hit.point };
    };
  }

  // A lost and restored context comes back without the reflection probe (a render target has
  // no source to re-upload), which darkened the whole ground by half. Named so the gate can
  // take it away and prove that its own test notices.
  function onContextRestored() { env.rebuildProbe(); }
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h); labelRenderer.setSize(w, h);
  });

  // The frame is centred on the part of the screen the HUD leaves free. On a desktop the
  // vehicle rail takes the left 256 px, and a view centred on the whole window put its left
  // quarter behind it — in the overview, Falcon 1 and Falcon 9 were entirely under the list.
  // setViewOffset shifts the projection centre without moving the camera, so picking, labels
  // and depth all follow; with no rail (phones, clean scene, flight) there is no shift.
  let viewShift = -1, shiftTick = 0;
  const railEl = document.getElementById('rail');
  function updateViewShift() {
    // Layout reads force a style pass; the rail only moves on resize or a HUD toggle, so a
    // look every twelfth frame is plenty (a resize resets the cache and is seen at once).
    if (viewShift >= 0 && (shiftTick++ % 12) !== 0) return;
    const w = window.innerWidth, h = window.innerHeight;
    const r = railEl?.getBoundingClientRect();
    const shown = r && r.width > 0 && getComputedStyle(railEl).display !== 'none'
      && getComputedStyle(document.getElementById('hud')).visibility !== 'hidden'
      && !document.getElementById('hud').classList.contains('is-clean') && !view.orbital
      && r.height < h * 0.8;
    const shift = shown ? Math.round(r.right + 12) : 0;
    if (shift === viewShift) return;
    viewShift = shift;
    if (shift) camera.setViewOffset(w + shift, h, 0, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { viewShift = -1; });
  // The shape of the part of the window the scene is framed in: right of the vehicle rail when
  // it is showing (setViewOffset centres the projection there). camera.aspect is not it — with
  // a view offset three.js sets it to the virtual, wider frame's.
  function freeAspect() {
    updateViewShift();
    return (window.innerWidth - Math.max(0, viewShift)) / window.innerHeight;
  }
  // Turning a phone while looking at the overview re-frames it for the new shape, as long as
  // the camera is still where the overview put it (a visitor who has moved keeps their view).
  window.addEventListener('resize', () => {
    if (view.exhibit || rig.mode !== 'orbit' || launch.running || !lastOverview) return;
    if (camera.position.distanceTo(lastOverview) > 1) return;
    const o = overviewFor(freeAspect(), camera.fov);
    rig.jumpTo(o.pos, o.target);
    lastOverview = new THREE.Vector3(...o.pos);
  });

  // ---- Loop ----
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  // Hides annotations whose line of sight to the camera passes through the vehicle body.
  const _lab = new THREE.Vector3();
  function updateLabelOcclusion() {
    if (!view.exhibit || !view.toggles.labels) return;
    const ex = exhibits[view.exhibit];
    const lg = ex.labels;
    if (!lg || !lg.visible) return;
    if (!ex.occluders.length) return;
    const ax = ex.lay.x, az = ex.lay.z;
    const camX = camera.position.x - ax, camZ = camera.position.z - az;
    for (const obj of lg.children) {
      obj.getWorldPosition(_lab);
      const lx = _lab.x - ax, lz = _lab.z - az;
      const dx = lx - camX, dz = lz - camZ;                      // camera → label
      const a = dx * dx + dz * dz;
      let hidden = false;
      if (a > 1e-6) for (const [ox, oz, rr, oTop] of ex.occluders) {
        // Recentred on this cylinder. Callouts that sit essentially on its axis (nose tip,
        // engine centreline) are never meaningfully hidden by it, and a constant-radius
        // cylinder is a poor model of the hull up in the nose, so leave them alone.
        const cx = camX - ox, cz = camZ - oz;
        const px = lx - ox, pz = lz - oz;
        if (px * px + pz * pz <= rr * rr * 0.9) continue;
        // Segment/cylinder intersection in the horizontal plane. Both roots matter: the near
        // one catches a label on the far side seen from outside, the far one catches a label
        // outside the hull seen from inside it (looking up into the engine bay, say).
        const b = 2 * (cx * dx + cz * dz);
        const c = cx * cx + cz * cz - rr * rr;
        const disc = b * b - 4 * a * c;
        if (disc <= 0) continue;
        const sq = Math.sqrt(disc);
        const dy = _lab.y - camera.position.y;
        for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
          if (t <= 0.02 || t >= 0.98) continue;
          // Only count the hit if the hull actually spans that height.
          const hy = camera.position.y + dy * t - ex.group.position.y;
          if (hy > 0 && hy < (oTop ?? ex.hullTop)) { hidden = true; break; }
        }
        if (hidden) break;
      }
      if (obj.element.classList.contains('is-occluded') !== hidden) {
        obj.element.classList.toggle('is-occluded', hidden);
      }
    }
  }

  const _fwd = new THREE.Vector3();

  /**
   * Screen-space label budget and a vertical nudge when two callouts overlap.
   * The dot stays on the anchor; only the text moves. Occluded callouts stay
   * faint and do not take a slot.
   */
  function settleLabels() {
    const root = document.getElementById('labels');
    if (!root) return;
    const cap = window.innerWidth < 520 ? 4 : window.innerWidth < 900 ? 6 : 8;
    const items = [];
    for (const el of root.querySelectorAll('.label')) {
      const text = el.querySelector('.label-text');
      const leader = el.querySelector('.label-leader');
      if (text) text.style.transform = '';
      if (leader) leader.style.transform = '';
      el.classList.remove('is-culled');
      if (el.classList.contains('is-occluded')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cx = r.x + r.width / 2 - window.innerWidth / 2;
      const cy = r.y + r.height / 2 - window.innerHeight / 2;
      items.push({ el, text, leader: el.querySelector('.label-leader'), r, d: cx * cx + cy * cy });
    }
    items.sort((a, b) => a.d - b.d);
    for (let i = cap; i < items.length; i++) items[i].el.classList.add('is-culled');
    const live = items.filter(it => !it.el.classList.contains('is-culled'));
    live.sort((a, b) => a.r.top - b.r.top);
    const placed = [];
    for (const it of live) {
      let shift = 0;
      const box = () => ({ left: it.r.left, right: it.r.right, top: it.r.top + shift, bottom: it.r.bottom + shift });
      for (let guard = 0; guard < 6; guard++) {
        const b = box();
        const hit = placed.find(p => b.left < p.right - 2 && b.right > p.left + 2 && b.top < p.bottom - 2 && b.bottom > p.top + 2);
        if (!hit) break;
        shift += (hit.bottom - b.top) + 4;
      }
      const dy = `translateY(${shift.toFixed(1)}px)`;
      if (shift) {
        if (it.text) it.text.style.transform = dy;
        if (it.leader) it.leader.style.transform = dy;
      }
      placed.push(box());
    }
  }

  // The view steps at most 0,05 s a frame; the mission keeps wall time (missionClock.js).
  const missionClock = createMissionClock();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    clock.getDelta();            // drop the hidden gap from the next frame's delta…
    missionClock.discard();      // …and from the mission, even if rAF already ran
  });
  // ---- ?perf: frame-rate meter for real hardware ----
  // The gate runs on a software rasteriser whose milliseconds say nothing about a GPU, so the
  // only way to know what a visitor gets is to measure on their machine. With ?perf in the URL
  // a small readout shows frames per second, the mean and 95th-percentile frame time over the
  // last two seconds, draw calls and triangles for the whole frame (every composer pass), the
  // quality tier and the GPU the browser reports. Nothing is measured without the flag.
  const perf = params.has('perf') ? (() => {
    const box = document.createElement('div');
    box.className = 'perf-meter';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    renderer.info.autoReset = false;
    const times = [];
    let last = performance.now(), shown = 0;
    const out = { fps: 0, mean: 0, p95: 0, calls: 0, tris: 0 };
    return {
      out,
      begin() { renderer.info.reset(); },
      end() {
        const now = performance.now();
        times.push(now - last); last = now;
        while (times.length > 240 || times.reduce((a, b) => a + b, 0) > 2000) times.shift();
        out.calls = renderer.info.render.calls; out.tris = renderer.info.render.triangles;
        if (now - shown < 500) return;
        shown = now;
        const sorted = [...times].sort((a, b) => a - b);
        out.mean = times.reduce((a, b) => a + b, 0) / times.length;
        out.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        out.fps = 1000 / out.mean;
        box.textContent = `${out.fps.toFixed(0)} fps · ${out.mean.toFixed(1)} ms (p95 ${out.p95.toFixed(1)}) · ${out.calls} calls · ${(out.tris / 1e6).toFixed(2)} M tris · ${quality.name}${quality.forced ? ' (forced)' : ''} · ${quality.probe?.renderer || 'GPU not reported'}`;
      },
    };
  })() : null;

  function frame() {
    perf?.begin();
    const steps = missionClock.step(clock.getDelta());
    const dt = steps.view;
    rig.update(dt);
    launch.update(steps.mission);
    reentry.update(steps.mission);
    // Wall time, like the launch: on the view's clamped step the flight ran in slow motion
    // under 20 fps (at 10 fps, at half speed).
    f16fly.update(steps.mission);
    gt3drive.update(steps.mission);
    h2rRide.update(steps.mission);
    sound?.update();
    // Water keeps moving whatever the camera or the launch is doing.
    WAVE_TIME.value += dt;
    // The sky is a finite box; centring it on the viewer is what lets it survive an ascent.
    env.followCamera(camera);
    // The ground past the disc (outerGround.js): not under the launch's stretched disc and globe,
    // nor the re-entry's Pacific.
    env.outer.visible = !env.inSpace && !launch.running && !reentry.running;
    const free = rig.mode !== 'orbit';
    const target = free ? tmp.copy(camera.position).addScaledVector(camera.getWorldDirection(_fwd), rig.mode === 'walk' ? 12 : 25) : rig.target;
    const dist = free ? (rig.mode === 'walk' ? 12 : 25) : rig.distance;
    // Depth precision goes as near/d², and a fixed 0.15 m near plane left ~0.6 m of depth
    // resolution at the 400 m overview: slabs, road paint, trench armour and the waterline
    // shimmered against what they sit on. The near plane now follows the orbit distance —
    // 0.6 % of it, 0.1 m to 2 m — which is ~13× the precision in the overview and nothing
    // lost close up. The launch sequence sets its own planes, so it is left alone.
    if (!launch.state.running && camera.far < 20000) {
      const near = THREE.MathUtils.clamp(dist * 0.006, 0.1, 2.0);
      if (Math.abs(near - camera.near) > 1e-3) { camera.near = near; camera.updateProjectionMatrix(); }
    }
    updateViewShift();
    env.updateShadow(target, dist);
    // scale bar: metres per pixel at the target distance
    const fovH = THREE.MathUtils.degToRad(camera.fov);
    const mpp = (2 * dist * Math.tan(fovH / 2)) / window.innerHeight;
    hud.setScale(mpp, dist);
    camera.getWorldDirection(_fwd);
    hud.setMapCamera(camera.position.x, camera.position.z, _fwd.x, _fwd.z);
    // Off above the pad (launch chase and orbit): the far plane opens up and nothing is close.
    // Off for the whole launch sequence too: the steam, vapour and ground cloud write no depth,
    // so the occlusion of the ground BEHIND them was multiplied over them, and the cloud wore a
    // band across it wherever the horizon fell.
    ao?.update(dist, camera.far < 20000 && !view.orbital && renderPass.camera === camera && !launch.running);
    updateLabelOcclusion();
    lod.update();
    composer.render();
    labelRenderer.render(scene, camera);
    settleLabels();
    perf?.end();
    requestAnimationFrame(frame);
  }
  frame();

  // expose for debugging / automated checks
  // Measuring a vehicle in mid-flight would measure the wrong thing, so verification always
  // puts the sequence back on the pad first.
  /**
   * @param opts.forceDetail  normally true: measure the geometry the builders produced, never
   *        whichever half of it the camera happened to be close enough for. The gate passes
   *        false to prove the stronger property — that no measurement READS the level-of-detail
   *        state at all, so that running it against a shed scene gives the same answer. With
   *        the forcing left on, both runs see the same visible scene and a measurement that
   *        did depend on visibility would go unnoticed.
   */
  const verify = ({ forceDetail = true } = {}) => {
    launch.reset(false);
    reentry.reset(false);
    if (forceDetail) lod.forceDetailed();
    return {
      dimensions: verifyExhibits(exhibits),
      pad: verifyPad(complex),
      interfaces: verifyInterfaces(exhibits, complex),
      scene: verifyScene(scene),
    };
  };
    // Exposed for the headless check: the orbital view is a global scene change, so the gate
  // has to be able to see that leaving it puts everything back.
  // Exposed for the headless check: the atmosphere has to be a pure function of the slider,
  // not something that accumulates. An earlier version read the sky uniforms back and
  // multiplied them, so every drag of the slider made the sky darker than the one before.
  const lightState = () => ({
    night: +env.night.toFixed(4),
    sun: +env.sun.intensity.toFixed(4),
    hemi: +env.hemi.intensity.toFixed(4),
    fog: scene.fog ? +scene.fog.density.toFixed(8) : null,
    sky: +env.sky.material.uniforms.rayleigh.value.toFixed(4),
  });

  const spaceState = () => ({
    space: env.inSpace,
    ground: env.ground.visible,
    fog: !!scene.fog,
    backdrop: !!backdrop && backdrop.visible,
    pedestal: !!roadsterPedestal && roadsterPedestal.visible,
    adapter: !!exhibits.roadster?.model.getObjectByName('payload-adapter')?.visible,
  });
  // Orthographic elevation, for the headless tools only: an exhibit framed by an orthographic
  // camera at a known world size, so a rendered profile and a photograph of the real vehicle
  // can be measured with the same ruler instead of compared by eye.
  const _oc = new THREE.Vector3(), _ot = new THREE.Vector3(), _ou = new THREE.Vector3();
  function ortho(spec) {
    const hudEl = document.getElementById('hud'), labelEl = document.getElementById('labels');
    if (!spec) {
      renderPass.camera = camera;
      hudEl.style.visibility = ''; labelEl.style.visibility = '';
      return;
    }
    const ex = exhibits[spec.vehicle ?? 'roadster'];
    if (!ex) return;
    const size = spec.size ?? 4.4;
    const aspect = window.innerWidth / window.innerHeight;
    const c = new THREE.OrthographicCamera(
      -size * aspect / 2, size * aspect / 2, size / 2, -size / 2, 0.01, 400);
    const y = spec.y ?? 0.58, d = 60;
    const axis = spec.axis ?? 'side';
    _ot.set(0, y, 0);
    if (axis === 'side') { _oc.set(d, y, 0); _ou.set(0, 1, 0); }
    else if (axis === 'front') { _oc.set(0, y, d); _ou.set(0, 1, 0); }
    else if (axis === 'rear') { _oc.set(0, y, -d); _ou.set(0, 1, 0); }
    else if (axis === 'q34') { _oc.set(d * 0.72, y + d * 0.30, d * 0.62); _ou.set(0, 1, 0); }
    else if (axis === 'r34') { _oc.set(d * 0.70, y + d * 0.28, -d * 0.64); _ou.set(0, 1, 0); }
    else { _oc.set(0, y + d, 0); _ou.set(0, 0, 1); }
    ex.model.localToWorld(_oc);
    ex.model.localToWorld(_ot);
    c.up.copy(_ou).applyQuaternion(ex.model.getWorldQuaternion(new THREE.Quaternion()));
    c.position.copy(_oc);
    c.lookAt(_ot);
    c.updateProjectionMatrix();
    renderPass.camera = c;
    hudEl.style.visibility = 'hidden'; labelEl.style.visibility = 'hidden';
  }

  window.__vc = {
    M, scene, camera, rig, exhibits, complex, launch, reentry, f16fly, gt3drive, h2rRide, select, goPreset, jump, renderer, env,
    setToggle, timings, verify, spaceState, lightState, ortho, startTour, stopTour,
    claimUserControl, tourRunToEnd, toggleMode, toggleWalk,
    walkRouteFor: (hit) => { const r = walkRoute(hit); rig.travelTo(r.route, r.look); return r; },
    // Exposed so a tool can render a frame and read it back in the same task, before the
    // drawing buffer is presented and cleared. Comparing the two states of a level-of-detail
    // swap from one camera is the only way to measure whether the switch is visible, and it
    // cannot be done from outside the page.
    composer,
    // The state machine itself, so the gate can assert on transitions rather than on the
    // scene's reaction to them.
    view, viewState: () => view.snapshot(), overviewFor,
    quality, lod, ao, hud, onContextRestored, get perf() { return perf?.out ?? null; }, get sound() { return sound; },
    get tourAt() { return tourAt; }, TOUR,
  };
  if (params.has('verify')) verify();
  if (params.has('vehicle')) {
    // Unvalidated, a typo here threw inside worldPreset after the loading card was gone: black
    // screen, error only in the console. Fall back to the overview instead.
    const want = params.get('vehicle');
    const v = VEHICLES.find(x => x.id === want?.toLowerCase());
    if (!v) {
      console.warn(`?vehicle=${want} matches no vehicle; showing the overview instead.`);
      jump(null);
    } else {
      const wantP = params.get('preset');
      const preset = v.presets?.some(x => x.id === wantP) ? wantP : 'overview';
      jump(v.id, preset);
    }
  }
  if (params.has('autolaunch')) {
    select('starship');
    const t = parseFloat(params.get('t') || '0');
    if (params.has('seek')) launch.seek(t);
    else launch.start();
  }
}

function buildRuler(M, height, id) {
  const g = new THREE.Group();
  g.name = `ruler-${id}`;
  const mat = new THREE.MeshStandardMaterial({ color: 0xd7a24a, roughness: 0.6, metalness: 0.2 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height, 8), mat);
  pole.position.y = height / 2;
  g.add(pole);
  const stepM = height > 40 ? 10 : height > 12 ? 5 : 1;
  for (let y = 0; y <= height + 0.001; y += stepM) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(height > 40 ? 1.6 : 0.5, 0.06, 0.06), mat);
    tick.position.set(0, y, 0);
    g.add(tick);
    // The total is printed at the top already; a tick label that lands on (or within a step
    // of) the top printed "70 m" twice, one over the other.
    if (height - y < stepM * 0.6 && y > 0) continue;
    const div = document.createElement('div');
    div.className = 'ruler-label';
    div.textContent = `${y} m`;
    const o = new CSS2DObject(div);
    o.position.set(height > 40 ? 1.2 : 0.45, y, 0);
    g.add(o);
  }
  // top marker with the total height
  const top = document.createElement('div');
  top.className = 'ruler-label ruler-top';
  top.textContent = `${height} m`;
  const o = new CSS2DObject(top);
  o.position.set(0, height + (height > 40 ? 2.5 : 0.6), 0);
  g.add(o);
  return g;
}

main().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  if (l) { l.querySelector('.loading-text').textContent = `Error: ${err.message}`; l.classList.add('error'); }
});
