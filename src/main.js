/**
 * SpaceX Vehicle Center — entry point.
 * Scene units are metres. Vehicles are built procedurally from the figures in data/specs.js.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { createMaterials } from './materials/library.js';
import { createEnvironment } from './core/environment.js';
import { CameraRig } from './core/cameraRig.js';
import { createHUD } from './ui/hud.js';
import { VEHICLES } from './data/specs.js';
import { buildStarship } from './vehicles/starship.js';
import { buildFalcon9, buildFalconHeavy } from './vehicles/falcon.js';
import { buildDragon } from './vehicles/dragon.js';
import { buildStarlink } from './vehicles/starlink.js';
import { buildRoadster } from './vehicles/roadster.js';
import { buildOrbitalBackdrop } from './core/backdrop.js';
import { buildMount, buildPedestal, buildHuman } from './vehicles/common.js';
import { seeded } from './geometry/utils.js';
import { buildLaunchComplex, PAD } from './vehicles/pad.js';
import { verifyExhibits, verifyScene, verifyPad } from './data/verify.js';
import { createLaunch } from './sim/launch.js';

// Exhibit layout (world X, metres). Mount heights are presentation choices.
// `yaw` turns an exhibit on its mount. Starship is asymmetric — heat shield on the belly,
// bare steel on the lee side — and facing its belly straight at the default camera shows
// nothing but the black shield. Turning it puts the tile line across the vehicle, which is
// how it is almost always photographed and how the two finishes read against each other.
// The four museum vehicles stand in a row on z = 0. Starship does not: it sits on a launch
// complex of its own, set back behind the row, because a 144,5 m tower and a flame trench do
// not belong in a line of display mounts and because the launch sequence needs the room.
const LAYOUT = {
  falcon9: { x: -135, z: 0, mount: 6.5, mountRadius: 6.5, inner: 3.1, clampRadius: 1.85 },
  falconheavy: { x: -62, z: 0, mount: 6.5, mountRadius: 11.5, inner: 7.2, clampRadius: 1.85 },
  starship: { x: 0, z: -185, mount: PAD.deckTop, yaw: 129.6, pad: true },
  dragon: { x: 18, z: 0, mount: 1.6 },
  starlink: { x: 78, z: 0, mount: 6.2 },
  roadster: { x: 118, z: 0, mount: 1.4, yaw: 25 },
};
// Recomposed when the Roadster became the sixth exhibit: the old frame was centred on x = -14
// and the car sat at the right-hand edge, so the first thing a visitor saw did not contain it.
const OVERVIEW = { pos: [-22, 58, 266], target: [-28, 44, -70] };

// Radius of the cylinder used to hide annotations that sit behind a vehicle. CSS2D labels
// always draw on top of the scene, so without this the far-side callouts read as if they
// were in front. Starlink is a flat panel and needs no occluder.
const OCCLUDER = { starship: 4.5, falcon9: 1.9, falconheavy: 1.9, dragon: 2.0, starlink: 0, roadster: 1.0 };

const nextFrame = () => new Promise(r => requestAnimationFrame(r));

async function main() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
  labelRenderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.15, 9000);
  camera.position.set(...OVERVIEW.pos);

  const rig = new CameraRig(camera, canvas);
  rig.target.set(...OVERVIEW.target);

  // ---- HUD ----
  let active = null;
  let sunRaf = 0, pendingSun = 42;
  const hud = createHUD({
    vehicles: VEHICLES,
    onSelect: (id) => select(id),
    onPreset: (id, presetId) => goPreset(id, presetId),
    onToggle: (name, value) => setToggle(name, value),
    onMode: () => rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly'),
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
  const env = createEnvironment(renderer, scene, M);

  // ---- Post-processing (MSAA render target + subtle bloom) ----
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.6, 0.92);
  composer.addPass(bloom);
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
  const rulers = new THREE.Group(); rulers.name = 'rulers'; scene.add(rulers);

  const builders = {
    starship: [buildStarship, 'Starship and Super Heavy · 18,000 instanced tiles…'],
    falcon9: [buildFalcon9, 'Falcon 9…'],
    falconheavy: [buildFalconHeavy, 'Falcon Heavy…'],
    dragon: [buildDragon, 'Dragon…'],
    starlink: [buildStarlink, 'Starlink V2 Mini…'],
    roadster: [buildRoadster, 'Tesla Roadster and Starman…'],
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
      const ped = buildPedestal(M, { radius: 1.6, height: 0.6, post: lay.mount - 0.6 - 0.11 });
      group.add(ped);
      model.position.y = lay.mount;
      model.rotation.y = 0;
      env.addStation(lay.x, lay.z, 16);
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
      group.add(buildMount(M, { radius: lay.mountRadius, inner: lay.inner, height: lay.mount, clampRadius: lay.clampRadius, clamps: v.id === 'falconheavy' ? 0 : 4 }));
      model.position.y = lay.mount;
      env.addStation(lay.x, lay.z, lay.mountRadius + 1.5);
    }
    const yaw = THREE.MathUtils.degToRad(lay.yaw ?? 0);
    model.rotation.y = yaw;
    group.add(model);
    group.position.set(lay.x, 0, lay.z);
    scene.add(group);
    exhibits[v.id] = { group, model, data: v, lay, occluder: OCCLUDER[v.id] ?? 0, labels: null, lod: null, hullTop: lay.mount + (model.userData.height ?? v.height) };

    // annotations
    const lg = new THREE.Group(); lg.name = `labels-${v.id}`; lg.visible = false;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (const a of model.userData.annotations ?? []) {
      const div = document.createElement('div');
      div.className = 'label';
      div.innerHTML = `<span class="label-dot"></span><span class="label-text">${a.label}</span>`;
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
        div.innerHTML = `<span class="label-dot"></span><span class="label-text">${a.label}</span>`;
        const obj = new CSS2DObject(div);
        obj.position.set(lay.x + a.position[0], a.position[1], lay.z + a.position[2]);
        pg.add(obj);
      }
      labels.add(pg);
      exhibits[v.id].padLabels = pg;
    }
    // Vehicles may publish a near/far pair for detail that is only worth drawing up close.
    let lod = null;
    model.traverse(o => { if (o.userData && o.userData.lod) lod = o.userData.lod; });
    exhibits[v.id].lod = lod;

    // scale figures
    const baseY = 0;
    const people = v.id === 'starlink' ? [[3.2, 0, 2.4, 0.4], [-2.6, 0, 3.0, -1.2]]
      : v.id === 'dragon' ? [[3.4, 0, 1.6, 0.6], [-2.8, 0, 2.6, -0.8]]
      : v.id === 'roadster' ? [[2.8, 0, 1.8, 0.5], [-2.8, 0, 1.2, -1.8]]
      : lay.pad ? [[26, PAD.padY, 16, 0.8], [30, PAD.padY, -10, -1.6], [-19, PAD.padY, 24, 2.4]]
      : [[lay.mountRadius + 3.5, 0, 2, 0.5], [lay.mountRadius + 2, 0, -4, -2.0], [-(lay.mountRadius + 3), 0, 3, 2.2]];
    for (const [px, py, pz, ry] of people) {
      const h = buildHuman(M, { suit: humanSuit() > 0.5 ? 'white' : 'dark' });
      h.position.set(lay.x + px, baseY + py, lay.z + pz);
      h.rotation.y = ry;
      humans.add(h);
    }
    // person on the mount deck for the big vehicles
    if (lay.mountRadius) {
      const h = buildHuman(M, { suit: 'white' });
      h.position.set(lay.x + lay.mountRadius - 1.2, lay.mount, lay.z + 1.5);
      h.rotation.y = 2.4;
      humans.add(h);
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

  // ---- Launch sequence ----
  const launch = createLaunch({
    scene, exhibits, complex, env, rig, camera,
    onState: (st) => hud.setMission(st.running ? st : null),
    onFinish: () => goPreset('starship', 'site'),
  });
  launch.setVisibilityHook((flying) => { launchFlying = flying; applyVisibility(); });

  hud.setProgress('Compiling shaders…', 0.95);
  await nextFrame();
  renderer.compile(scene, camera);
  composer.render();
  await nextFrame();
  hud.hideLoading();
  hud.setActive(null);

  // ---- Interaction ----
  const state = { labels: true, ruler: true, humans: true };
  let launchFlying = false;
  let activePreset = null;
  // Views authored in the site frame are the ones the pad callouts belong to.
  const SITE_VIEWS = new Set(VEHICLES.flatMap(v => (v.presets ?? []).filter(p => p.frame === 'site').map(p => p.id)));
  function setToggle(name, value) {
    state[name] = value;
    applyVisibility();
    hud.toggle(name, value);
  }
  // The Roadster is a museum piece in the row and a payload in the orbital view, never both:
  // plinth or payload adapter, ground or Earth. Entering the view swaps the presentation and
  // leaving it swaps back — env.setAltitude(0) restores sky, fog, ambient and ground exactly,
  // which is what the check asserts after walking every preset.
  const ORBITAL_VIEW = 'earth';
  let orbital = false, backdrop = null;
  function setOrbital(on) {
    if (on === orbital) return;
    orbital = on;
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

  function applyVisibility() {
    // Callouts, rulers and the scale figures are museum furniture: they belong on a vehicle
    // standing on its mount, not on one that has left it.
    const site = SITE_VIEWS.has(activePreset);
    setOrbital(active === 'roadster' && activePreset === ORBITAL_VIEW && !launchFlying);
    for (const [id, ex] of Object.entries(exhibits)) {
      const on = id === active && !launchFlying;
      const lg = labels.getObjectByName(`labels-${id}`);
      lg.visible = on && state.labels && !(ex.padLabels && site);
      // Callouts carry the range they read at. Showing all nine on a 3,9 m car at once hides
      // the car behind its own captions, which is what the overview shot was doing.
      const near = new Set(['starman', 'dontpanic', 'detail', 'selfie']);
      for (const o of lg.children) {
        const sc = o.userData.scope ?? 'all';
        o.visible = sc === 'all'
          || (sc === 'near' && near.has(activePreset))
          || (sc === 'orbital' && orbital);
      }
      if (ex.padLabels) ex.padLabels.visible = on && state.labels && site;
      ex.ruler.visible = on && state.ruler && !site && !(id === 'roadster' && orbital);
    }
    humans.visible = state.humans && !launchFlying && !orbital;
  }

  function toggleLaunch() {
    if (launch.running) { launch.reset(); return; }
    active = 'starship';
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
  function select(id) {
    // Picking a vehicle is a request to look at the museum, so it ends a running sequence
    // rather than fighting it for the camera.
    if (launch.running) launch.reset(false);
    active = id;
    hud.setActive(id);
    activePreset = 'overview';
    applyVisibility();
    if (!id) { rig.flyTo(OVERVIEW.pos, OVERVIEW.target, 2.0); return; }
    const w = worldPreset(id, 'overview');
    rig.flyTo(w.pos, w.target, 1.9);
  }
  function goPreset(id, presetId) {
    activePreset = presetId;
    applyVisibility();
    const w = worldPreset(id, presetId);
    rig.flyTo(w.pos, w.target, 1.5);
  }
  function jump(id, presetId) {
    if (!id) { active = null; activePreset = null; hud.setActive(null); applyVisibility(); rig.jumpTo(OVERVIEW.pos, OVERVIEW.target); return; }
    active = id; activePreset = presetId ?? 'overview'; hud.setActive(id); applyVisibility();
    const w = worldPreset(id, presetId ?? 'overview');
    rig.jumpTo(w.pos, w.target);
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= String(VEHICLES.length)) select(VEHICLES[Number(k) - 1].id);
    else if (k === '0') select(null);
    else if (k === 'f') rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly');
    else if (k === 'g') toggleLaunch();
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
    if (!active || !state.labels) return;
    const ex = exhibits[active];
    const lg = ex.labels;
    if (!lg || !lg.visible) return;
    const rr = ex.occluder;
    if (rr <= 0) return;
    const ax = ex.lay.x, az = ex.lay.z;
    const cx = camera.position.x - ax, cz = camera.position.z - az;
    for (const obj of lg.children) {
      obj.getWorldPosition(_lab);
      // Callouts that sit essentially on the vehicle's axis (nose tip, engine centreline)
      // are never meaningfully hidden by it, and the constant-radius cylinder is a poor
      // model of the hull up in the nose, so leave them alone.
      const lx = _lab.x - ax, lz = _lab.z - az;
      const dx = lx - cx, dz = lz - cz;                          // camera → label
      const a = dx * dx + dz * dz;
      let hidden = false;
      if (a > 1e-6 && lx * lx + lz * lz > rr * rr * 0.9) {
        // Segment/cylinder intersection in the horizontal plane. Both roots matter: the near
        // one catches a label on the far side seen from outside, the far one catches a label
        // outside the hull seen from inside it (looking up into the engine bay, say).
        const b = 2 * (cx * dx + cz * dz);
        const c = cx * cx + cz * cz - rr * rr;
        const disc = b * b - 4 * a * c;
        if (disc > 0) {
          const sq = Math.sqrt(disc);
          const dy = _lab.y - camera.position.y;
          for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
            if (t <= 0.02 || t >= 0.98) continue;
            // Only count the hit if the hull actually spans that height.
            const hy = camera.position.y + dy * t - ex.group.position.y;
            if (hy > 0 && hy < ex.hullTop) { hidden = true; break; }
          }
        }
      }
      if (obj.element.classList.contains('is-occluded') !== hidden) {
        obj.element.classList.toggle('is-occluded', hidden);
      }
    }
  }

  // Swaps the heat shield between instanced tiles and a textured shell. A 0.26 m tile stops
  // resolving at roughly a couple of pixels; past that the instances only add sparkle.
  const _lodC = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  function updateLOD() {
    const mpp = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / window.innerHeight;
    for (const ex of Object.values(exhibits)) {
      if (!ex.lod) continue;
      // A vehicle that has left its mount is measured from where it actually is.
      const f = ex.flight;
      _lodC.set(ex.lay.x + (f ? f.position.x : 0), ex.hullTop * 0.5 + (f ? f.position.y : 0), ex.lay.z);
      const px = 0.26 / (camera.position.distanceTo(_lodC) * mpp);
      const near = px > 3.5;
      // Track the state explicitly: inferring it from the far group's visibility silently
      // no-ops on the first evaluation, when both halves are still visible.
      if (ex.lod.state === near) continue;
      ex.lod.state = near;
      ex.lod.far.visible = !near;
      for (const o of ex.lod.near) o.visible = near;
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
    env.updateShadow(target, dist);
    // scale bar: metres per pixel at the target distance
    const fovH = THREE.MathUtils.degToRad(camera.fov);
    const mpp = (2 * dist * Math.tan(fovH / 2)) / window.innerHeight;
    hud.setScale(mpp, dist);
    updateLabelOcclusion();
    updateLOD();
    composer.render();
    labelRenderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  // expose for debugging / automated checks
  // Measuring a vehicle in mid-flight would measure the wrong thing, so verification always
  // puts the sequence back on the pad first.
  const verify = () => {
    launch.reset(false);
    return { dimensions: verifyExhibits(exhibits), pad: verifyPad(complex), scene: verifyScene(scene) };
  };
    // Exposed for the headless check: the orbital view is a global scene change, so the gate
  // has to be able to see that leaving it puts everything back.
  const spaceState = () => ({
    space: env.inSpace,
    ground: env.ground.visible,
    fog: !!scene.fog,
    backdrop: !!backdrop && backdrop.visible,
    pedestal: !!roadsterPedestal && roadsterPedestal.visible,
    adapter: !!exhibits.roadster?.model.getObjectByName('payload-adapter')?.visible,
  });
  window.__vc = { M, scene, camera, rig, exhibits, complex, launch, select, goPreset, jump, renderer, env, setToggle, timings, verify, spaceState };
  const params = new URLSearchParams(location.search);
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
