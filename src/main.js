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
import { verifyExhibits, verifyScene } from './data/verify.js';

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
  starship: { x: 0, z: -185, mount: 9, mountRadius: 10.5, inner: 6.9, clampRadius: 4.5, yaw: 132 },
  dragon: { x: 18, z: 0, mount: 1.6 },
  starlink: { x: 78, z: 0, mount: 6.2 },
};
const OVERVIEW = { pos: [-30, 78, 300], target: [-28, 48, -55] };

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
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.6, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Vehicles ----
  const exhibits = {};
  const labels = new THREE.Group(); labels.name = 'labels'; scene.add(labels);
  const humans = new THREE.Group(); humans.name = 'humans'; scene.add(humans);
  const rulers = new THREE.Group(); rulers.name = 'rulers'; scene.add(rulers);

  const builders = {
    starship: [buildStarship, 'Starship y Super Heavy · 18 000 losetas instanciadas…'],
    falcon9: [buildFalcon9, 'Falcon 9…'],
    falconheavy: [buildFalconHeavy, 'Falcon Heavy…'],
    dragon: [buildDragon, 'Dragon…'],
    starlink: [buildStarlink, 'Starlink V2 Mini…'],
  };
  let step = 0;
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
      const [ax, ay, az] = a.position;
      obj.position.set(lay.x + ax * cy + az * sy, model.position.y + ay, lay.z - ax * sy + az * cy);
      lg.add(obj);
    }
    labels.add(lg);
    exhibits[v.id].labels = lg;
    // Vehicles may publish a near/far pair for detail that is only worth drawing up close.
    let lod = null;
    model.traverse(o => { if (o.userData && o.userData.lod) lod = o.userData.lod; });
    exhibits[v.id].lod = lod;

    // scale figures
    const baseY = 0;
    const people = v.id === 'starlink' ? [[3.2, 0, 2.4, 0.4], [-2.6, 0, 3.0, -1.2]] : v.id === 'dragon' ? [[3.4, 0, 1.6, 0.6], [-2.8, 0, 2.6, -0.8]] : [[lay.mountRadius + 3.5, 0, 2, 0.5], [lay.mountRadius + 2, 0, -4, -2.0], [-(lay.mountRadius + 3), 0, 3, 2.2]];
    for (const [px, py, pz, ry] of people) {
      const h = buildHuman(M, { suit: Math.random() > 0.5 ? 'white' : 'dark' });
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
      const off = v.id === 'starship' ? 14 : v.id === 'falconheavy' ? 12 : v.id === 'falcon9' ? 8 : 4.2;
      ruler.position.set(lay.x + off, model.position.y, lay.z);
    }
    ruler.visible = false;
    rulers.add(ruler);
    exhibits[v.id].ruler = ruler;
  }

  hud.setProgress('Compilando shaders…', 0.95);
  await nextFrame();
  renderer.compile(scene, camera);
  composer.render();
  await nextFrame();
  hud.hideLoading();
  hud.setActive(null);

  // ---- Interaction ----
  const state = { labels: true, ruler: true, humans: true };
  function setToggle(name, value) {
    state[name] = value;
    if (name === 'humans') humans.visible = value;
    applyVisibility();
    hud.toggle(name, value);
  }
  function applyVisibility() {
    for (const [id, ex] of Object.entries(exhibits)) {
      const on = id === active;
      labels.getObjectByName(`labels-${id}`).visible = on && state.labels;
      ex.ruler.visible = on && state.ruler;
    }
  }
  function worldPreset(id, presetId) {
    const ex = exhibits[id];
    const p = ex.data.presets.find(x => x.id === presetId) ?? ex.data.presets[0];
    const o = new THREE.Vector3(ex.lay.x, ex.model.position.y, ex.lay.z);
    // Views are authored in the vehicle's own frame, so they turn with it.
    const yaw = THREE.MathUtils.degToRad(ex.lay.yaw ?? 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const put = ([x, y, z]) => [o.x + x * cy + z * sy, o.y + y, o.z - x * sy + z * cy];
    return { pos: put(p.pos), target: put(p.target) };
  }
  function select(id) {
    active = id;
    hud.setActive(id);
    applyVisibility();
    if (!id) { rig.flyTo(OVERVIEW.pos, OVERVIEW.target, 2.0); return; }
    const w = worldPreset(id, 'overview');
    rig.flyTo(w.pos, w.target, 1.9);
  }
  function goPreset(id, presetId) {
    const w = worldPreset(id, presetId);
    rig.flyTo(w.pos, w.target, 1.5);
  }
  function jump(id, presetId) {
    if (!id) { active = null; hud.setActive(null); applyVisibility(); rig.jumpTo(OVERVIEW.pos, OVERVIEW.target); return; }
    active = id; hud.setActive(id); applyVisibility();
    const w = worldPreset(id, presetId ?? 'overview');
    rig.jumpTo(w.pos, w.target);
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') select(VEHICLES[Number(k) - 1].id);
    else if (k === '0') select(null);
    else if (k === 'f') rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly');
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
  function updateLOD() {
    const mpp = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / window.innerHeight;
    for (const ex of Object.values(exhibits)) {
      if (!ex.lod) continue;
      _lodC.set(ex.lay.x, ex.hullTop * 0.5, ex.lay.z);
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
  const verify = () => ({ dimensions: verifyExhibits(exhibits), scene: verifyScene(scene) });
  window.__vc = { M, scene, camera, rig, exhibits, select, goPreset, jump, renderer, env, setToggle, timings, verify };
  if (new URLSearchParams(location.search).has('verify')) verify();
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
  top.textContent = `${String(height).replace('.', ',')} m`;
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
