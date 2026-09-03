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
import { buildMount, buildPedestal, buildHuman } from './vehicles/common.js';
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
};
const OVERVIEW = { pos: [-12, 74, 292], target: [-14, 50, -66] };

// Radius of the cylinder used to hide annotations that sit behind a vehicle. CSS2D labels
// always draw on top of the scene, so without this the far-side callouts read as if they
// were in front. Starlink is a flat panel and needs no occluder.
const OCCLUDER = { starship: 4.5, falcon9: 1.9, falconheavy: 1.9, dragon: 2.0, starlink: 0 };

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
  const hud = createHUD({
    vehicles: VEHICLES,
    onSelect: (id) => select(id),
    onPreset: (id, presetId) => goPreset(id, presetId),
    onToggle: (name, value) => setToggle(name, value),
    onMode: () => rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly'),
    onSun: (elev) => env.setSun(elev, 34),
    onReset: () => select(null),
    onLaunch: () => toggleLaunch(),
    onLaunchAbort: () => launch?.reset(),
    onLaunchSpeed: (k) => launch?.setSpeed(k),
  });
  rig.onModeChange = (m) => hud.setMode(m);
  hud.setMode('orbit');

  const timings = {};
  hud.setProgress('Generando materiales procedurales…', 0.05);
  await nextFrame();
  let t0 = performance.now();
  // Texture generation is the bulk of the start-up cost, so report it map by map.
  const { M } = createMaterials((name, frac) => hud.setProgress(`Generando materiales · ${name}`, 0.05 + frac * 0.2));
  timings.materials = performance.now() - t0;
  hud.setProgress('Iluminación y entorno…', 0.25);
  await nextFrame();
  const env = createEnvironment(renderer, scene, M);

  // ---- Post-processing (MSAA render target + subtle bloom) ----
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Exhibits ----
  const exhibits = {};
  const root = new THREE.Group();
  scene.add(root);

  const builders = [
    ['starship', 'Starship + Super Heavy', () => buildStarship(M, { lod: true })],
    ['falcon9', 'Falcon 9', () => buildFalcon9(M)],
    ['falconheavy', 'Falcon Heavy', () => buildFalconHeavy(M)],
    ['dragon', 'Dragon', () => buildDragon(M)],
    ['starlink', 'Starlink V2 Mini', () => buildStarlink(M)],
  ];

  for (let i = 0; i < builders.length; i++) {
    const [id, label, fn] = builders[i];
    hud.setProgress(`Construyendo ${label}…`, 0.35 + (i / builders.length) * 0.45);
    await nextFrame();
    t0 = performance.now();
    const model = fn();
    timings[id] = performance.now() - t0;
    const lay = LAYOUT[id];
    const group = new THREE.Group();
    group.name = `exhibit-${id}`;
    group.position.set(lay.x, 0, lay.z);

    // Starship sits on the orbital pad; museum vehicles sit on a concrete display mount.
    if (!lay.pad) {
      group.add(buildMount(M, lay.mount, lay.mountRadius, { innerRadius: lay.inner, clampRadius: lay.clampRadius }));
      group.add(buildPedestal(M, lay.mountRadius + 1.2, 0.45));
    }
    model.position.y = lay.mount;
    if (lay.yaw) model.rotation.y = THREE.MathUtils.degToRad(lay.yaw);
    group.add(model);

    // Annotations (CSS2D) and the invisible hull cylinder that keeps them from drawing through the vehicle.
    const labels = new THREE.Group();
    labels.name = `labels-${id}`;
    const annotations = model.userData?.annotations || [];
    for (const a of annotations) {
      const el = document.createElement('div');
      el.className = 'annotation';
      el.innerHTML = `<span class="ann-dot"></span><span class="ann-label">${a.label}</span>`;
      const obj = new CSS2DObject(el);
      obj.position.set(...a.position);
      labels.add(obj);
    }
    labels.position.y = lay.mount;
    if (lay.yaw) labels.rotation.y = THREE.MathUtils.degToRad(lay.yaw);
    group.add(labels);

    const spec = VEHICLES.find(v => v.id === id);
    const ruler = buildRuler(M, spec.height, id);
    ruler.position.set(spec.footprint * 0.6 + 1.2, 0, 0);
    group.add(ruler);

    const humans = buildHumanPair(M, spec.footprint * 0.6 + 3.0, lay.mount);
    group.add(humans);

    root.add(group);
    exhibits[id] = {
      model, group, labels, ruler, humans, spec, lay,
      hullTop: spec.height,
      occluder: OCCLUDER[id] || 0,
      lod: model.userData?.lod || null,
    };
    if (!lay.pad) env.addStation(lay.x, lay.z, lay.mountRadius + 2.5);
  }

  // ---- Launch complex (under Starship) ----
  hud.setProgress('Construyendo complejo de lanzamiento…', 0.88);
  await nextFrame();
  t0 = performance.now();
  const complex = buildLaunchComplex(M);
  complex.position.set(LAYOUT.starship.x, 0, LAYOUT.starship.z);
  scene.add(complex);
  timings.pad = performance.now() - t0;

  // Add the pad's own callouts to the Starship label set.
  const padLabels = new THREE.Group();
  padLabels.name = 'labels-pad';
  for (const a of complex.userData.annotations || []) {
    const el = document.createElement('div');
    el.className = 'annotation';
    el.innerHTML = `<span class="ann-dot"></span><span class="ann-label">${a.label}</span>`;
    const obj = new CSS2DObject(el);
    obj.position.set(...a.position);
    padLabels.add(obj);
  }
  complex.add(padLabels);
  exhibits.starship.padLabels = padLabels;

  // ---- Launch simulation ----
  const launch = createLaunch({
    scene,
    env,
    starship: exhibits.starship,
    complex,
    camera,
    rig,
    onState: (st) => hud.setLaunchState(st),
    onT: (t, mark) => hud.setLaunchT(t, mark),
    onTelemetry: (d) => hud.setTelemetry(d),
  });

  hud.setProgress('Finalizando escena…', 0.98);
  await nextFrame();
  hud.hideProgress();

  // ---- Interaction state ----
  const state = { labels: true, ruler: true, humans: true };
  let activePreset = null;

  function setToggle(name, val) {
    state[name] = val;
    hud.setToggle(name, val);
    for (const ex of Object.values(exhibits)) {
      if (name === 'labels' && ex.labels) ex.labels.visible = val && (active === null || active === ex.spec.id);
      if (name === 'labels' && ex.padLabels) ex.padLabels.visible = val && (active === null || active === 'starship');
      if (name === 'ruler') ex.ruler.visible = val && active === ex.spec.id;
      if (name === 'humans') ex.humans.visible = val;
    }
  }
  setToggle('labels', true);
  setToggle('ruler', false);
  setToggle('humans', true);

  function applyVisibility() {
    for (const [id, ex] of Object.entries(exhibits)) {
      const isA = active === null || active === id;
      ex.ruler.visible = state.ruler && active === id;
      if (ex.labels) ex.labels.visible = state.labels && isA;
      if (ex.padLabels) ex.padLabels.visible = state.labels && (active === null || active === 'starship');
    }
  }

  function worldPreset(vehicleId, presetId) {
    const ex = exhibits[vehicleId];
    const spec = ex.spec;
    const p = spec.presets.find(x => x.id === presetId) || spec.presets[0];
    const lay = ex.lay;
    // Standard exhibits frame presets relative to the vehicle's mount plane (x = lay.x,
    // y = lay.mount, z = lay.z). The launch pad presets use 'site' frame, which measures
    // from the ground under the mount (y = 0) so trench and tower cameras sit at true elevations.
    const oy = p.frame === 'site' ? 0 : lay.mount;
    return {
      pos: [lay.x + p.pos[0], oy + p.pos[1], lay.z + p.pos[2]],
      target: [lay.x + p.target[0], oy + p.target[1], lay.z + p.target[2]],
    };
  }

  function select(id) {
    // A running launch controls its own camera; selecting another vehicle terminates it.
    if (launch.active && id !== 'starship') launch.reset();
    if (active === id) return;
    active = id;
    activePreset = null;
    hud.setActive(id);
    applyVisibility();
    if (!id) {
      rig.flyTo(OVERVIEW.pos, OVERVIEW.target, 1.8);
      return;
    }
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
    if (k >= '1' && k <= '5') select(VEHICLES[Number(k) - 1].id);
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
    bloom.setSize(w, h);
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
      let hidden = false;
      obj.getWorldPosition(_lab);
      const dx = _lab.x - camera.position.x, dz = _lab.z - camera.position.z;
      const a = dx * dx + dz * dz;
      if (a > 1e-4) {
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
    const target = rig.mode === 'fly' ? tmp.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 25) : rig.target;
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
  window.__vc = { M, scene, camera, rig, exhibits, complex, launch, select, goPreset, jump, renderer, env, setToggle, timings, verify };
  const params = new URLSearchParams(location.search);
  if (params.has('verify')) verify();
  if (params.has('vehicle')) jump(params.get('vehicle'), params.get('preset') || 'overview');
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
  // Major ticks every 10 m, minor ticks every 5 m.
  for (let y = 0; y <= height; y += 5) {
    const isMajor = y % 10 === 0;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(isMajor ? 0.75 : 0.4, 0.04, 0.04), mat);
    tick.position.set(isMajor ? 0.35 : 0.2, y, 0);
    g.add(tick);
  }
  return g;
}

function buildHumanPair(M, offsetRadius, mountHeight) {
  const g = new THREE.Group();
  g.name = 'humans';
  // One at ground level (the reference for the whole exhibit) and one up on the mount so
  // there is a scale cue next to the engine bells and hold-down clamps.
  const h1 = buildHuman(M);
  h1.position.set(offsetRadius, 0, 0);
  g.add(h1);
  if (mountHeight > 3) {
    const h2 = buildHuman(M);
    h2.position.set(offsetRadius * 0.45, mountHeight, offsetRadius * 0.35);
    g.add(h2);
  }
  return g;
}

main().catch(err => {
  /* eslint-disable no-console */
  console.error('Fatal initialization error:', err);
  const card = document.querySelector('.loading-card');
  if (card) {
    card.innerHTML = `<div class="eyebrow" style="color:var(--danger)">Error al iniciar</div>
      <div class="loading-title">No se pudo cargar la simulación 3D</div>
      <div class="loading-text" style="color:var(--muted)">${err?.message || err}</div>`;
  }
});
