/**
 * SpaceX Vehicle Center — entry point.
 * Scene units are metres. Vehicles are built procedurally from the figures in data/specs.js.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createAO } from './core/ao.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { createMaterials } from './materials/library.js';
import { createEnvironment } from './core/environment.js';
import { dressCampus } from './core/campus.js';
import { CameraRig } from './core/cameraRig.js';
import { ViewState } from './core/viewState.js';
import { pickQuality, applyQuality } from './core/quality.js';
import { LODManager } from './core/lod.js';
import { createHUD } from './ui/hud.js';
import { VEHICLES } from './data/specs.js';
import { buildStarship } from './vehicles/starship.js';
import { buildFalcon9, buildFalconHeavy } from './vehicles/falcon.js';
import { buildFalcon1 } from './vehicles/falcon1.js';
import { buildDragon } from './vehicles/dragon.js';
import { buildStarlink } from './vehicles/starlink.js';
import { buildRoadster } from './vehicles/roadster.js';
import { buildEngineHall } from './vehicles/enginehall.js';
import { buildOrbitalBackdrop } from './core/backdrop.js';
import { buildMount, buildPedestal, buildHumanCrowd } from './vehicles/common.js';
import { seeded } from './geometry/utils.js';
import { buildLaunchComplex, PAD } from './vehicles/pad.js';
import { verifyExhibits, verifyScene, verifyPad, verifyInterfaces } from './data/verify.js';
import { createLaunch } from './sim/launch.js';

// Exhibit layout (world X, metres). Mount heights are presentation choices.
// `yaw` turns an exhibit on its mount. Starship is asymmetric — heat shield on the belly,
// bare steel on the lee side — and facing its belly straight at the default camera shows
// nothing but the black shield. Turning it puts the tile line across the vehicle, which is
// how it is almost always photographed and how the two finishes read against each other.
// The seven museum exhibits stand in a row on z = 0. Starship does not: it sits on a launch
// complex of its own, set back behind the row, because a 144,5 m tower and a flame trench do
// not belong in a line of display mounts and because the launch sequence needs the room.
// `people` is declared per exhibit rather than inferred. It used to fall through to a generic
// branch that read lay.mountRadius, which Engine Row does not have — undefined + 3.5 is NaN,
// and three visitors were being planted at (NaN, 0, NaN). Inferring "is there a plinth?" from
// a radius that only some layouts carry is the kind of thing that breaks the next time an
// exhibit is added, so the layout says it outright.
const LAYOUT = {
  // Falcon 1 is the small historical bookend of the row, immediately outside Falcon 9.
  falcon1: { x: -153, z: 0, mount: 1.6, mountRadius: 3.1, inner: 1.0, clampRadius: 0.8382, people: [[4, 0, 2, 0.5], [-4, 0, 2, -0.5]] },
  falcon9: {
    x: -135, z: 0, mount: 6.5, mountRadius: 6.5, inner: 3.1, clampRadius: 1.85,
    people: [[10, 0, 2, 0.5], [8.5, 0, -4, -2.0], [-9.5, 0, 3, 2.2]],
  },
  falconheavy: {
    x: -62, z: 0, mount: 6.5, mountRadius: 11.5, inner: 7.2, clampRadius: 1.85,
    people: [[15, 0, 2, 0.5], [13.5, 0, -4, -2.0], [-14.5, 0, 3, 2.2]],
  },
  starship: {
    x: 0, z: -185, mount: PAD.deckTop, yaw: 129.6, pad: true,
    people: [[26, PAD.padY, 16, 0.8], [30, PAD.padY, -10, -1.6], [-19, PAD.padY, 24, 2.4]],
  },
  dragon: { x: 18, z: 0, mount: 1.6, people: [[3.4, 0, 1.6, 0.6], [-2.8, 0, 2.6, -0.8]] },
  starlink: { x: 78, z: 0, mount: 6.2, people: [[3.2, 0, 2.4, 0.4], [-2.6, 0, 3.0, -1.2]] },
  roadster: { x: 118, z: 0, mount: 1.4, yaw: 25, people: [[2.8, 0, 1.8, 0.5], [-2.8, 0, 1.2, -1.8]] },
  engines: {
    x: 163, z: 0, mount: 0, yaw: -12,
    people: [[3.4, 0, 2.6, 0.4], [-5.8, 0, 2.2, -1.4], [1.2, 0, -3.0, 2.6]],
  },
};
// Recomposed when the Roadster became the sixth exhibit: the old frame was centred on x = -14
// and the car sat at the right-hand edge, so the first thing a visitor saw did not contain it.
// Recomposed again when Engine Row became the seventh exhibit at x = 163: the row now spans
// nearly 300 m, so the frame has to sit further back and centre on the middle of it.
const OVERVIEW = { pos: [3, 72, 330], target: [-1, 39, -68] };

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
  falcon1: 0.8382,
  starship: 4.5, falcon9: 1.9, falconheavy: 1.9, dragon: 2.0, starlink: 0, roadster: 1.0,
  engines: [[-4.15, 0, 0.50, 2.6], [-1.75, 0, 0.70, 3.4], [1.55, 0, 1.20, 4.9]],
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
  camera.position.set(...OVERVIEW.pos);

  const rig = new CameraRig(camera, canvas);
  rig.target.set(...OVERVIEW.target);
  // Detail is a function of how big something is on screen, so the manager needs the camera
  // and the tier's pixel threshold; entries are registered as each exhibit is built.
  const lod = new LODManager(camera, { pixels: quality.lodPixels });

  // ---- HUD ----
  let sunRaf = 0, pendingSun = 42;
  const hud = createHUD({
    vehicles: VEHICLES,
    onSelect: (id) => select(id),
    onPreset: (id, presetId) => goPreset(id, presetId),
    onToggle: (name, value) => setToggle(name, value),
    onMode: () => toggleMode(),
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
    onLaunchAbort: () => launch?.reset(),
    onLaunchSpeed: (k) => launch?.setSpeed(k),
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
  const { M } = createMaterials((name, frac) => hud.setProgress(`Generating materials · ${name}`, 0.05 + frac * 0.2));
  timings.materials = performance.now() - t0;
  hud.setProgress('Lighting and environment…', 0.25);
  await nextFrame();
  const env = createEnvironment(renderer, scene, M, quality);
  dressCampus(scene, M);

  // ---- Post-processing (MSAA render target + subtle bloom) ----
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
    starship: [buildStarship, 'Starship and Super Heavy · 18,000 instanced tiles…'],
    falcon9: [buildFalcon9, 'Falcon 9…'],
    falconheavy: [buildFalconHeavy, 'Falcon Heavy…'],
    dragon: [buildDragon, 'Dragon…'],
    starlink: [buildStarlink, 'Starlink V2 Mini…'],
    roadster: [buildRoadster, 'Tesla Roadster and Starman…'],
    engines: [buildEngineHall, 'Raptor 3, Raptor Vacuum and Merlin 1D…'],
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
      // cradle: four supports under the trunk rim
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), M.mount);
        s.position.set(Math.sin(a) * 1.55, lay.mount + 0.3, Math.cos(a) * 1.55);
        s.castShadow = s.receiveShadow = true;
        ped.add(s);
      }
      group.add(ped);
      model.position.y = lay.mount + 0.6;
      env.addStation(lay.x, lay.z, 5);
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
      group.add(buildMount(M, { radius: lay.mountRadius, inner: lay.inner, height: lay.mount, clampRadius: lay.clampRadius,
        clamps: ['falconheavy', 'falcon1'].includes(v.id) ? 0 : 4 }));
      model.position.y = lay.mount;
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
    exhibits[v.id] = { group, model, data: v, lay, occluders, labels: null, lod: null, hullTop: lay.mount + (model.userData.height ?? v.height) };

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
    // shield does, swapping 13,500 instanced hexagons for one textured shell — or it may
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
    if (lay.mountRadius) {
      crowd.push({
        x: lay.x + lay.mountRadius - 1.2, y: lay.mount, z: lay.z + 1.5, ry: 2.4, suit: 'white',
      });
    }

    // height ruler
    // height ruler (span ruler for Starlink, laid along X in front of the wings)
    const ruler = buildRuler(M, v.id === 'starlink' ? 30 : v.height, v.id);
    if (v.id === 'starlink') {
      ruler.rotation.z = -Math.PI / 2;
      ruler.position.set(lay.x - 15, model.position.y - 1.2, lay.z + 4.2);
    } else {
      const off = v.id === 'starship' ? 22 : v.id === 'falconheavy' ? 12 : v.id === 'falcon9' ? 8 : 4.2;
      ruler.position.set(lay.x + off, model.position.y, lay.z);
    }
    ruler.visible = false;
    rulers.add(ruler);
    exhibits[v.id].ruler = ruler;
  }

  // Every figure in the centre, as one mesh per material. Built here rather than inside the
  // loop because merging only pays once all the placements are known.
  humans.add(buildHumanCrowd(M, crowd));

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

  // ---- Launch sequence ----
  const launch = createLaunch({
    scene, exhibits, complex, env, rig, camera, quality,
    onStart: () => enforce(view.claim('launch')),
    onState: (st) => hud.setMission(st.running ? st : null),
    onFinish: () => goPreset('starship', 'site'),
  });
  launch.setVisibilityHook((flying) => view.setFlying(flying));

  hud.setProgress('Compiling shaders…', 0.95);
  await nextFrame();
  renderer.compile(scene, camera);
  composer.render();
  await nextFrame();
  hud.hideLoading();
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
  let orbitalMounted = false, backdrop = null;
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

  function toggleLaunch() {
    if (launch.running) { launch.reset(); return; }
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
    if (!id) { rig.flyTo(OVERVIEW.pos, OVERVIEW.target, 2.0); return; }
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
      rig.jumpTo(OVERVIEW.pos, OVERVIEW.target);
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
  const TOUR = [
    ['starship', 'site', 7], ['starship', 'engines', 5], ['starship', 'tiles', 5],
    ['starship', 'flaps', 5], ['starship', 'trench', 5],
    ['falcon9', 'overview', 5], ['falcon9', 'octaweb', 4], ['falcon9', 'interstage', 4],
    ['falconheavy', 'overview', 5], ['falconheavy', 'engines', 4],
    ['dragon', 'overview', 5], ['dragon', 'superdraco', 4], ['dragon', 'trunk', 4],
    ['starlink', 'overview', 5], ['starlink', 'antennas', 4],
    ['roadster', 'overview', 5], ['roadster', 'detail', 4], ['roadster', 'starman', 4],
    ['roadster', 'earth', 6],
    ['engines', 'overview', 5], ['engines', 'rvac', 4],
    ['falcon1', 'overview', 5], ['falcon1', 'cutaway', 5],
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
    const [id, preset, hold] = TOUR[tourAt];
    jump(id, preset, 'tour');
    hud.setTour({ step: tourAt + 1, total: TOUR.length });
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

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= String(VEHICLES.length)) select(VEHICLES[Number(k) - 1].id);
    else if (k === '0') select(null);
    else if (k === 'f') toggleMode();
    else if (k === 'g') toggleLaunch();
    else if (k === 'p') toggleTour();
    else if (k === 'l') setToggle('labels', !state.labels);
    else if (k === 'r') setToggle('ruler', !state.ruler);
    else if (k === 't') hud.toggleSheet();
    else if (k === 'h') hud.showHelp(document.getElementById('help').classList.contains('hidden'));
    else if (k === 'escape') hud.showHelp(false);
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h); labelRenderer.setSize(w, h);
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

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    rig.update(dt);
    launch.update(dt);
    // The sky is a finite box; centring it on the viewer is what lets it survive an ascent.
    env.followCamera(camera);
    const target = rig.mode === 'fly' ? tmp.copy(camera.position).addScaledVector(camera.getWorldDirection(_fwd), 25) : rig.target;
    const dist = rig.mode === 'fly' ? 25 : rig.distance;
    // Depth precision goes as near/d², and a fixed 0.15 m near plane left ~0.6 m of depth
    // resolution at the 400 m overview: slabs, road paint, trench armour and the waterline
    // shimmered against what they sit on. The near plane now follows the orbit distance —
    // 0.6 % of it, 0.1 m to 2 m — which is ~13× the precision in the overview and nothing
    // lost close up. The launch sequence sets its own planes, so it is left alone.
    if (!launch.state.running && camera.far < 20000) {
      const near = THREE.MathUtils.clamp(dist * 0.006, 0.1, 2.0);
      if (Math.abs(near - camera.near) > 1e-3) { camera.near = near; camera.updateProjectionMatrix(); }
    }
    env.updateShadow(target, dist);
    // scale bar: metres per pixel at the target distance
    const fovH = THREE.MathUtils.degToRad(camera.fov);
    const mpp = (2 * dist * Math.tan(fovH / 2)) / window.innerHeight;
    hud.setScale(mpp, dist);
    // Off above the pad (launch chase and orbit): the far plane opens up and nothing is close.
    ao?.update(dist, camera.far < 20000 && !view.orbital && renderPass.camera === camera);
    updateLabelOcclusion();
    lod.update();
    composer.render();
    labelRenderer.render(scene, camera);
    settleLabels();
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
    M, scene, camera, rig, exhibits, complex, launch, select, goPreset, jump, renderer, env,
    setToggle, timings, verify, spaceState, lightState, ortho, startTour, stopTour,
    claimUserControl, tourRunToEnd, toggleMode,
    // Exposed so a tool can render a frame and read it back in the same task, before the
    // drawing buffer is presented and cleared. Comparing the two states of a level-of-detail
    // swap from one camera is the only way to measure whether the switch is visible, and it
    // cannot be done from outside the page.
    composer,
    // The state machine itself, so the gate can assert on transitions rather than on the
    // scene's reaction to them.
    view, viewState: () => view.snapshot(),
    quality, lod, ao,
    get tourAt() { return tourAt; },
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
