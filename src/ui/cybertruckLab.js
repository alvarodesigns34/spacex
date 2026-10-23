/**
 * Cybertruck Lab: the Tesla Cybertruck Cyberbeast on its own, in a studio, away from the site.
 * The model is the Blender-built asset of the `cybertruck` repository, copied here by
 * tools/cybertruck-sync.mjs (assets/cybertruck/cybertruck.glb, with its size, SHA-256 and source
 * commit in cybertruck.json): 1:1, metres, glTF axes with +Y up and −Z forward, origin on the
 * ground at the middle of the wheelbase. Its meshes are Draco-compressed, so it is read with
 * three r170's DRACOLoader and the decoder in vendor/. Each of its 1,138 parts carries glTF
 * extras — system, staged explosion (explode_*), fidelity grade (V/R/A) and a Spanish label —
 * that the later phases of the Lab use; this one shows the truck as built.
 *
 * The Cybertruck is not part of the site: it is not in VEHICLES, not prefetched, and never
 * added to the site's scene, so the scene budget in tools/check.mjs does not see it. Nothing
 * is downloaded until the Lab is first opened. The Lab has its own scene, camera, lights,
 * environment map and composer and draws with the site's renderer while it is open (main.js
 * skips its own frame); the renderer state it changes is saved on opening and put back on
 * closing, so the site comes back exactly as it was left. Closing keeps the model in memory
 * (the owner's choice): opening again is instant.
 *
 * The Lab's interface is in English, like the site's; the parts' names are the asset's own,
 * in Spanish (the owner's choice, audit of 20-10-2026, §9).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const CYBERTRUCK_ASSET = new URL('../../assets/cybertruck/cybertruck.glb', import.meta.url);
/** What tools/cybertruck-sync.mjs recorded: the GLB's uncompressed size is the progress bar's total. */
export const CYBERTRUCK_RECORD = new URL('../../assets/cybertruck/cybertruck.json', import.meta.url);
const DRACO_PATH = new URL('../../vendor/three/examples/jsm/libs/draco/gltf/', import.meta.url).href;

/** Camera stations, from the cybertruck viewer (glTF axes: +Y up, the nose to −Z, the driver at −X). */
const VIEWS = [
  ['Front ¾', [-6.4, 2.1, -6.9], [0, 0.75, -0.1]],
  ['Side', [-10.5, 0.95, 0.15], [0, 0.85, 0.15]],
  ['Rear ¾', [6.2, 2.4, 7.4], [0, 0.8, 0.5]],
  ['Top', [0.001, 11.5, 0.15], [0, 0, 0.15]],
];
const FIDELITY = { V: 'Verified', R: 'Reconstructed', A: 'Approximate' };

const ease = (t) => t * t * (3 - 2 * t);

/**
 * The cybertruck viewer's material finishing (web/src/materials.js), by Blender material-name
 * prefix: the parameters glTF does not carry (environment intensity, glass thickness, the LEDs'
 * and screens' emission) on top of the exported maps, which are kept. Its random brushed-steel
 * fallback is not carried over: the GLB has had its own roughness maps since version 2 (audit, C13).
 */
function glass(m, color, transmission, thickness = 0.005) {
  m.color = new THREE.Color(color);
  m.metalness = 0;
  m.roughness = Math.min(m.roughness ?? 0.03, 0.05);
  m.transmission = transmission;
  m.ior = 1.52;
  m.thickness = thickness;
  m.transparent = false;
  m.envMapIntensity = 1.2;
  m.specularIntensity = 1.0;
}
const FINISH = [
  ['CT_Stainless_Steel', (m) => { m.metalness = 1.0; if (!m.anisotropy) m.anisotropy = 0.55; m.envMapIntensity = 1.15; }],
  ['CT_Glass_Windshield', (m) => glass(m, 0xdfe7e5, 0.92, 0.0055)],
  ['CT_Glass_Side', (m) => glass(m, 0x8a9294, 0.80, 0.004)],
  ['CT_Glass_Roof', (m) => glass(m, 0x23272a, 0.55, 0.006)],
  ['CT_Lens_Clear', (m) => glass(m, 0xffffff, 0.9, 0.003)],
  ['CT_Lens_Red', (m) => { glass(m, 0xc8100c, 0.6, 0.003); m.attenuationColor = new THREE.Color(0xff1a10); }],
  ['CT_Lens_Smoked', (m) => glass(m, 0x1c1c1e, 0.5, 0.003)],
  ['CT_Mirror_Glass', (m) => { m.metalness = 1; m.roughness = 0.03; m.color.setRGB(0.92, 0.92, 0.92); }],
  ['CT_LED_White', (m) => { m.emissive = new THREE.Color(0xfff6ea); m.emissiveIntensity = 4.0; }],
  ['CT_LED_Red', (m) => { m.emissive = new THREE.Color(0xff1408); m.emissiveIntensity = 3.0; }],
  ['CT_LED_Amber', (m) => { m.emissive = new THREE.Color(0xff7a10); m.emissiveIntensity = 2.0; }],
  ['CT_Screen', (m) => {
    m.color.setRGB(0.01, 0.012, 0.016); m.roughness = 0.08; m.metalness = 0;
    m.emissive = new THREE.Color(0x1d2836); m.emissiveIntensity = 0.9; m.clearcoat = 1;
  }],
  ['CT_Upholstery', (m) => { m.sheenRoughness = 0.6; m.envMapIntensity = 0.8; }],
  ['CT_Headliner', (m) => { m.sheenRoughness = 0.8; m.envMapIntensity = 0.7; }],
  ['CT_Carpet', (m) => { m.sheenRoughness = 0.9; m.envMapIntensity = 0.6; }],
  ['CT_Tire', (m) => { m.envMapIntensity = 0.7; }],
  ['CT_Aluminium', (m) => { m.envMapIntensity = 1.05; }],
];
/** Every material as a MeshPhysicalMaterial with its finish; each source material is done once. */
function finishMaterial(mat, cache, maxAnisotropy) {
  if (!mat) return mat;
  let m = cache.get(mat);
  if (m) return m;
  m = mat;
  if (!m.isMeshPhysicalMaterial) {
    m = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, mat);
    m.name = mat.name;
    mat.dispose();
  }
  FINISH.find(([prefix]) => m.name?.startsWith(prefix))?.[1](m);
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) m[k].anisotropy = Math.max(m[k].anisotropy, Math.min(8, maxAnisotropy));
  m.needsUpdate = true;
  cache.set(mat, m);
  return m;
}

/** The panel helper of the viewer's studio: a flat light source that faces `look`. */
function emissive(color, k) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  m.color.multiplyScalar(k);            // above 1: the PMREM works in floating point (HDR)
  return m;
}

/**
 * The cybertruck viewer's "Studio" (web/src/lighting.js), unchanged: a dark room with long
 * softboxes on the ceiling and the sides, which draw long, sharp highlights along the
 * stainless steel's facets, a key box and a cold backlight. Procedural: no image is shipped.
 */
function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  const panel = (w, h, pos, look, mat) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.set(...pos); p.lookAt(new THREE.Vector3(...look)); s.add(p);
  };
  const room = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 36), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.BackSide }));
  room.position.y = 7; s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: 0x15171a }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.95; s.add(floor);
  // Three ceiling strips along the truck (glTF Z) and one across.
  for (const x of [-3.2, 0, 3.2]) panel(1.1, 18, [x, 13.5, 0], [x, 0, 0], emissive(0xffffff, 5.5));
  panel(14, 0.9, [0, 13.4, -6], [0, 0, -6], emissive(0xfff6ec, 3.5));
  // Upright strips on both sides: the long lines on the slanted faces.
  for (const z of [-5, 1, 7]) {
    panel(0.8, 7, [-16, 4.5, z], [0, 4.5, z], emissive(0xf3f6ff, 3.2));
    panel(0.8, 7, [16, 4.5, z], [0, 4.5, z], emissive(0xfff4ea, 2.4));
  }
  // Key box (front three-quarter, driver's side) and a cold backlight.
  panel(7, 4.5, [-11, 6, -12], [0, 1, 0], emissive(0xffffff, 4.0));
  panel(9, 3, [8, 5, 14], [0, 1, 0], emissive(0xdde8ff, 2.2));
  // A faint horizon band, which separates the lower edge of the panels from the floor.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 17.5, 0.6, 64, 1, true), emissive(0x9aa3ad, 0.9));
  band.position.y = 0.6; s.add(band);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.015).texture;
  pmrem.dispose();
  s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

/** The viewer's studio floor: a dark radial gradient, drawn once (deterministic). */
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 10, 256, 256, 256);
  grd.addColorStop(0, '#2a2e34'); grd.addColorStop(0.55, '#16191d'); grd.addColorStop(1, '#0d0f12');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param renderer the site's renderer, shared (one WebGL context)
 * @param quality  the site's tier (core/quality.js): shadow resolution and MSAA follow it
 * @param onExit   called after closing, once the renderer is back as the site left it
 */
export function createCybertruckLab({ renderer, quality, onExit }) {
  const lab = { active: false, loaded: false, loading: false, requests: 0, stats: null };
  let root = null, stage = null, ui = null;
  let scene = null, camera = null, controls = null, composer = null, rt = null;
  let truck = null;
  let camTween = null, noteTimer = 0;
  let dirty = true, shadowDirty = true;
  let saved = null;

  // ---- DOM ----
  function buildDom() {
    root = document.createElement('div');
    root.id = 'cybertruck-lab';
    root.className = 'hidden';
    root.innerHTML = `
      <div class="ctl-stage" role="img" aria-label="Tesla Cybertruck: 3D view. Drag to orbit, scroll or pinch to zoom, right-drag to pan"></div>
      <header class="ctl-head">
        <button class="tool tool-btn ctl-back" type="button" title="Back to the vehicle centre (Esc)">← Back</button>
        <div class="ctl-title">
          <div class="eyebrow">Cybertruck Lab</div>
          <div class="ctl-name">Tesla Cybertruck Cyberbeast</div>
          <div class="ctl-sub">1:1 Blender model, as built</div>
        </div>
      </header>
      <nav class="ctl-views" aria-label="Views"></nav>
      <div class="ctl-note hidden" role="status" aria-live="polite"></div>
      <div class="ctl-loading" role="status" aria-live="polite">
        <div class="loading-card">
          <div class="eyebrow">Cybertruck Lab</div>
          <div class="loading-title">Loading the Cybertruck at 1:1</div>
          <div class="loading-track"><div class="loading-fill"></div></div>
          <div class="loading-text">Downloading the model…</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    stage = root.querySelector('.ctl-stage');
    ui = {
      views: root.querySelector('.ctl-views'), sub: root.querySelector('.ctl-sub'), note: root.querySelector('.ctl-note'),
      loading: root.querySelector('.ctl-loading'), fill: root.querySelector('.ctl-loading .loading-fill'),
      text: root.querySelector('.ctl-loading .loading-text'), back: root.querySelector('.ctl-back'),
    };
    ui.back.addEventListener('click', () => lab.close());
    for (const [name, pos, target] of VIEWS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool tool-btn'; b.textContent = name;
      b.addEventListener('click', () => flyTo(pos, target));
      ui.views.appendChild(b);
    }
    stage.addEventListener('pointerdown', () => { camTween = null; });
  }

  // ---- Scene ----
  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f12);
    // Nearer than the viewer's (22–60 m): its floor is usually the glass one, and this opaque disc's
    // far rim, 35–37 m from the default cameras, drew a hard horizon against the dark room.
    scene.fog = new THREE.Fog(0x0d0f12, 12, 30);
    scene.environment = studioEnvironment(renderer);
    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 200);
    camera.position.set(...VIEWS[0][1]);
    controls = new OrbitControls(camera, stage);
    controls.target.set(...VIEWS[0][2]);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.4; controls.maxDistance = 30;
    // Not under the floor: the floor is opaque in this phase (the glass floor comes with the
    // exploded view, which takes 124 parts below it).
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.screenSpacePanning = true;
    controls.addEventListener('change', () => { dirty = true; });

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-6, 9, -5);
    key.castShadow = quality.shadows;
    key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x1a1c20, 0.25));

    const floor = new THREE.Mesh(new THREE.CircleGeometry(26, 96),
      new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9, metalness: 0, envMapIntensity: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002; floor.receiveShadow = true;
    floor.name = 'cybertruck-lab-floor';
    scene.add(floor);

    // As the site's: a multisampled half-float target (MSAA by tier) and one output pass, which
    // applies the tone mapping set on opening.
    rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: quality.msaa, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
  }

  // ---- Asset ----
  /**
   * One request, read as a stream. The total is the size cybertruck-sync recorded, not
   * Content-Length: GitHub Pages sends the GLB gzipped, and Content-Length is then the
   * compressed size (9.2 of 12.5 MB) while the stream yields the decompressed bytes, which is
   * how the cybertruck viewer's bar reached 136 % (audit, C1/I4). Without the record the bar
   * shows megabytes only. Never a second request.
   */
  async function fetchAsset() {
    const record = fetch(CYBERTRUCK_RECORD).then(r => (r.ok ? r.json() : null)).catch(() => null);
    lab.requests++;
    const res = await fetch(CYBERTRUCK_ASSET);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = (await record)?.bytes ?? 0;
    if (!res.body) return res.arrayBuffer();
    const reader = res.body.getReader(), chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      const mb = `${(got / 1e6).toFixed(1)}${total ? ` / ${(total / 1e6).toFixed(1)}` : ''} MB`;
      if (total) ui.fill.style.transform = `scaleX(${(Math.min(1, got / total) * 0.9).toFixed(3)})`;
      ui.text.textContent = `Downloading the model… ${mb}`;
    }
    const data = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { data.set(c, o); o += c.length; }
    lab.progressMax = total ? got / total : null;
    return data.buffer;
  }

  function adopt(gltf) {
    truck = gltf.scene;
    truck.name = 'cybertruck';
    const fid = { V: 0, R: 0, A: 0 };
    let parts = 0, meshes = 0, tris = 0;
    const finished = new Map();
    truck.traverse((o) => {
      if (o.userData?.label_es) { parts++; if (fid[o.userData.fidelity] !== undefined) fid[o.userData.fidelity]++; }
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map(m => finishMaterial(m, finished, quality.anisotropy)) : finishMaterial(o.material, finished, quality.anisotropy);
      for (const m of [].concat(o.material)) {
        if (!m) continue;
        // Anisotropy needs tangents from UVs: the Audi Lab's turned faces without them drew black.
        if (m.anisotropy > 0 && !g.attributes.uv) m.anisotropy = 0;
        // Glass and lenses (transmission) cast no shadow, as in the viewer.
        if (m.transmission > 0) o.castShadow = false;
      }
    });
    scene.add(truck);
    lab.stats = { parts, meshes, triangles: Math.round(tris), fidelity: fid };
    ui.sub.textContent = `1:1 Blender model, as built · ${parts.toLocaleString('en-GB')} parts · ${FIDELITY.V} ${fid.V} · ${FIDELITY.R} ${fid.R} · ${FIDELITY.A} ${fid.A}`;
  }

  async function load() {
    lab.loading = true;
    try {
      const t0 = performance.now();
      const buf = await fetchAsset();
      ui.fill.style.transform = 'scaleX(0.92)'; ui.text.textContent = 'Decoding geometry and materials…';
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
      const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
      try {
        const gltf = await new GLTFLoader().setDRACOLoader(draco).parseAsync(buf, '');
        adopt(gltf);
      } finally { draco.dispose(); }
      lab.loaded = true;
      lab.stats.seconds = (performance.now() - t0) / 1000;
      ui.loading.classList.add('hidden');
      shadowDirty = dirty = true;
    } catch (e) {
      console.warn(`Cybertruck asset not loaded (${e.message})`);
      ui.fill.style.transform = 'scaleX(0)';
      ui.text.textContent = `The model could not be loaded (${e.message}). Go back and try again.`;
    } finally { lab.loading = false; }
  }

  // ---- Camera ----
  function flyTo(pos, target, seconds = 0.9) {
    camTween = { t: 0, d: seconds, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target) };
    dirty = true;
  }
  const resetView = () => flyTo(VIEWS[0][1], VIEWS[0][2]);

  /** A line at the top of the stage, for what the Lab did on opening (a sequence it ended). */
  function note(text, ms = 5000) {
    if (!ui) return;
    clearTimeout(noteTimer);
    ui.note.textContent = text;
    ui.note.classList.toggle('hidden', !text);
    if (text) noteTimer = window.setTimeout(() => ui.note.classList.add('hidden'), ms);
  }

  /** One frame of the Lab, drawn only when something changed: at rest it costs nothing. */
  lab.render = (dt) => {
    if (!lab.active || !scene) return;
    const step = Math.min(dt, 0.05);
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + step / camTween.d);
      const k = ease(camTween.t);
      camera.position.lerpVectors(camTween.p0, camTween.p1, k);
      controls.target.lerpVectors(camTween.t0, camTween.t1, k);
      if (camTween.t >= 1) camTween = null;
      dirty = true;
    }
    controls.update();          // damping: keeps raising 'change' while the orbit settles
    if (!dirty) return;
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    composer.render();
    lab.frames = (lab.frames ?? 0) + 1;
    dirty = false;
  };

  function resize() {
    if (!scene) return;
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    composer.setSize(w, h);
    dirty = true;
  }

  const onKey = (e) => {
    // The site's shortcuts (G launches Starship, J flies the F-16…) and its camera keys stay
    // out of the Lab; a text field would keep its keys, though the Lab has none yet.
    const t = e.target;
    if (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox')) return;
    e.stopImmediatePropagation();
    if (e.type !== 'keydown' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'u') lab.close();
    else if (k === 'r') resetView();
  };

  /** @param ended what the site ended to open the Lab, said in a line at the top ('' for nothing) */
  lab.open = (ended = '') => {
    if (lab.active) return;
    if (!root) buildDom();
    lab.active = true;
    saved = {
      toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
      autoUpdate: renderer.shadowMap.autoUpdate, autoReset: renderer.info.autoReset, target: renderer.getRenderTarget(),
    };
    // AgX, as the cybertruck viewer and its Blender renders, so the truck looks as it does there.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.autoUpdate = false;
    renderer.info.autoReset = true;
    document.body.classList.add('cybertruck-lab-open');
    root.classList.remove('hidden');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('resize', resize);
    if (!scene) buildScene();
    resize(); shadowDirty = dirty = true;
    note(ended);
    ui.back.focus();
    if (!lab.loaded && !lab.loading) load();
  };

  lab.close = () => {
    if (!lab.active) return;
    lab.active = false;
    camTween = null;
    renderer.toneMapping = saved.toneMapping;
    renderer.toneMappingExposure = saved.exposure;
    renderer.shadowMap.autoUpdate = saved.autoUpdate;
    renderer.info.autoReset = saved.autoReset;
    renderer.setRenderTarget(saved.target);
    document.body.classList.remove('cybertruck-lab-open');
    root.classList.add('hidden');
    note('');
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('resize', resize);
    onExit?.();
  };

  // For the checks and the console.
  Object.assign(lab, { flyTo, resetView, VIEWS });
  Object.defineProperties(lab, {
    camera: { get: () => camera }, controls: { get: () => controls }, scene: { get: () => scene }, truck: { get: () => truck },
  });
  return lab;
}
