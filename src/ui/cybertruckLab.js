/**
 * Cybertruck Lab: the Tesla Cybertruck Cyberbeast on its own, in a studio, away from the site.
 * The model is the Blender-built asset of the `cybertruck` repository, copied here by
 * tools/cybertruck-sync.mjs (assets/cybertruck/cybertruck.glb, with its size, SHA-256 and source
 * commit in cybertruck.json): 1:1, metres, glTF axes with +Y up and −Z forward, origin on the
 * ground at the middle of the wheelbase. Its meshes are Draco-compressed, so it is read with
 * three r170's DRACOLoader and the decoder in vendor/. Each of its 1,138 parts carries glTF
 * extras: system, staged explosion (explode_dir in Blender's axes, explode_dist, explode_stage,
 * explode_group), fidelity grade (V/R/A) and a Spanish label and note; the root carries the
 * stages' windows.
 *
 * What it does is the cybertruck viewer's (web/src/main.js), rebuilt for the centre: a staged
 * exploded view that is a pure function of its parameter (no drift however often it moves),
 * picking with a data card, isolate, hide and frame, systems and a searchable parts list, three
 * floors, two lighting settings and a planar reflection on the high tier (ui/cybertruckStudio.js).
 *
 * The Cybertruck is not part of the site: it is not in VEHICLES, not prefetched, and never added
 * to the site's scene, so the scene budget in tools/check.mjs does not see it. Nothing is
 * downloaded until the Lab is first opened. The Lab has its own scene, camera, lights,
 * environment maps and composer and draws with the site's renderer while it is open (main.js
 * skips its own frame), and only when something changed; the renderer state it changes is saved
 * on opening and put back on closing, so the site comes back exactly as it was left. Closing
 * keeps the model in memory (the owner's choice): opening again is instant.
 *
 * The Lab's interface is in English, like the site's; the parts' names and notes are the
 * asset's own, in Spanish (the owner's choice, audit of 20-10-2026, §9).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ENVIRONMENTS, environmentMaps, createFloors, createFloorReflector, finishMaterial } from './cybertruckStudio.js';
import { CT_FIGURES, CT_SOURCES, CT_SYSTEMS, CT_STAGES, CT_FIDELITY, CT_SUSPENSION, CT_OPENINGS } from '../data/cybertruck.js';
import { buildHumanCrowd } from '../vehicles/common.js';
import { fireflyClampPass } from '../core/fireflyClamp.js';

export const CYBERTRUCK_ASSET = new URL('../../assets/cybertruck/cybertruck.glb', import.meta.url);
/** What tools/cybertruck-sync.mjs recorded: the GLB's uncompressed size is the progress bar's total. */
export const CYBERTRUCK_RECORD = new URL('../../assets/cybertruck/cybertruck.json', import.meta.url);
const DRACO_PATH = new URL('../../vendor/three/examples/jsm/libs/draco/gltf/', import.meta.url).href;

/** Camera stations, from the cybertruck viewer (glTF axes: +Y up, the nose to −Z, the driver at −X). */
export const VIEWS = {
  front34: { label: 'Front ¾', pos: [-6.4, 2.1, -6.9], target: [0, 0.75, -0.1] },
  rear34: { label: 'Rear ¾', pos: [6.2, 2.4, 7.4], target: [0, 0.8, 0.5] },
  side: { label: 'Side', pos: [-10.5, 0.95, 0.15], target: [0, 0.85, 0.15] },
  top: { label: 'Top', pos: [0.001, 11.5, 0.15], target: [0, 0, 0.15] },
  interior: { label: 'Interior', pos: [0.40, 1.22, -0.36], target: [-0.34, 1.00, -1.05], fov: 72 },
  under: { label: 'Underside', pos: [-3.4, -1.1, -4.8], target: [0, 0.35, -0.2], below: true },
  exploded: { label: 'Exploded', pos: [-9.0, 5.2, -8.6], target: [0, 0.8, 0.2] },
};
const FLOORS = { glass: 'Glass', opaque: 'Opaque', hidden: 'Hidden' };
const AMP = { min: 0.6, max: 2.4, init: 1.5 };     // the viewer's amplitude range and default
const PLAY_SECONDS = 4;                            // 0 → 100 % when animating, as in the viewer
const HIGHLIGHT = new THREE.Color(0xff8a3d);

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (t) => t * t * (3 - 2 * t);
// Blender (+X right, +Y forward, +Z up) → glTF (+X, +Y up, −Z forward): explode_dir is in Blender's axes.
const b2g = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
/** For the search: lower case and without accents, so "suspension" finds "Suspensión". */
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mm = (m) => `${(m * 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} mm`;

/** Per-viewer conveniences only (floor, light, reflection); a blocked storage is not an error. */
const pref = {
  get: (k) => { try { return localStorage.getItem(`ct-lab-${k}`); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(`ct-lab-${k}`, v); } catch { /* storage unavailable */ } },
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * @param renderer the site's renderer, shared (one WebGL context)
 * @param quality  the site's tier (core/quality.js): shadow resolution, MSAA, anisotropy and the reflection follow it
 * @param M        the site's material library, for the 1.80 m scale figure (the centre's own)
 * @param onExit   called after closing, once the renderer is back as the site left it
 */
export function createCybertruckLab({ renderer, quality, M = null, onExit }) {
  const lab = { active: false, loaded: false, loading: false, requests: 0, stats: null, frames: 0 };
  const state = {
    explode: 0, amp: AMP.init, stageMask: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
    playing: false, playDir: 1, selected: null, isolated: null, explodeSystem: null,
    hiddenSystems: new Set(), hiddenParts: new Set(),
    floor: FLOORS[pref.get('floor')] ? pref.get('floor') : 'glass',
    env: ENVIRONMENTS[pref.get('env')] ? pref.get('env') : 'studio',
    reflections: pref.get('refl') !== 'off',
    figure: pref.get('figure') !== 'off',
  };
  // Openings: progress 0…1 towards a target, eased; the nodes are bound once the model is in.
  const openings = Object.fromEntries(Object.entries(CT_OPENINGS).map(([k, o]) => [k, { ...o, k: 0, target: 0, items: [] }]));
  let figure = null;
  const sunDir = new THREE.Vector3();
  let windows = {};
  const parts = [];                   // the exploding parts: { obj, base, dir, dist, stage }
  const comps = new Map();            // every part by node name
  const rows = new Map();             // name → its row in the parts list
  const chips = new Map();            // system → its chip
  const highlights = new Map();       // source material → its highlight copy (shared, audit C12)
  let root = null, stage = null, ui = null;
  let scene = null, camera = null, controls = null, composer = null, rt = null, key = null, hemi = null;
  let floors = null, reflector = null, envMaps = null;
  let truck = null;
  let camTween = null, explodeTween = null, noteTimer = 0;
  let dirty = true, shadowDirty = true;
  let saved = null;

  // ---- DOM ----
  function buildDom() {
    root = el('div');
    root.id = 'cybertruck-lab';
    root.className = 'hidden';
    root.innerHTML = `
      <div class="ctl-stage" role="img" aria-label="Tesla Cybertruck: 3D view. Drag to orbit, scroll to zoom, right-drag to pan, click a part to pick it"></div>
      <header class="ctl-head">
        <button class="tool tool-btn ctl-back" type="button" title="Back to the vehicle centre (Esc)">← Back</button>
        <div class="ctl-title">
          <div class="eyebrow">Cybertruck Lab</div>
          <div class="ctl-name">Tesla Cybertruck Cyberbeast</div>
          <div class="ctl-sub">1:1 Blender model</div>
        </div>
      </header>
      <div class="ctl-note hidden" role="status" aria-live="polite"></div>
      <aside class="ctl-panel" aria-label="Systems, parts and data">
        <div class="ctl-tabs" role="group" aria-label="Panel">
          <button type="button" class="ctl-tab" data-tab="systems" aria-pressed="true">Systems</button>
          <button type="button" class="ctl-tab" data-tab="parts" aria-pressed="false">Parts <span class="ctl-count"></span></button>
          <button type="button" class="ctl-tab" data-tab="data" aria-pressed="false">Data</button>
        </div>
        <section class="ctl-pane" data-pane="systems">
          <div class="ctl-pane-head"><span>Click a system to hide or show it.</span><button type="button" class="ctl-link" data-act="showall">Show all</button></div>
          <div class="ctl-systems"></div>
        </section>
        <section class="ctl-pane hidden" data-pane="parts">
          <input class="ctl-search" type="search" placeholder="Search parts (Spanish names)…" aria-label="Search parts">
          <div class="ctl-tree"></div>
        </section>
        <section class="ctl-pane hidden" data-pane="data"></section>
      </aside>
      <div class="ctl-info hidden" role="region" aria-label="Selected part">
        <div class="ctl-info-top"><span class="ctl-pill"></span><button type="button" class="ctl-x" data-act="deselect" aria-label="Close the part's card">×</button></div>
        <h3 class="ctl-info-title"></h3>
        <div class="ctl-info-name"></div>
        <dl class="ctl-info-dl"><dt>System</dt><dd data-f="system"></dd><dt>Group</dt><dd data-f="group"></dd><dt>Stage</dt><dd data-f="stage"></dd></dl>
        <p class="ctl-info-note"></p>
        <div class="ctl-info-acts">
          <button type="button" class="tool tool-btn" data-act="isolate" title="Show only this part">Isolate</button>
          <button type="button" class="tool tool-btn" data-act="hide" title="Hide this part">Hide</button>
          <button type="button" class="tool tool-btn" data-act="frame" title="Frame this part (F)">Frame <kbd>F</kbd></button>
        </div>
      </div>
      <div class="ctl-dock" aria-label="Views and exploded view">
        <nav class="ctl-views" aria-label="Views"></nav>
        <div class="ctl-dock-row">
          <label class="ctl-explode"><span>Exploded view</span><output>0 %</output>
            <input type="range" min="0" max="100" step="1" value="0" aria-label="Explosion"></label>
          <button type="button" class="tool tool-btn ctl-play" aria-pressed="false" title="Animate the explosion (space)">Play <kbd>Space</kbd></button>
          <button type="button" class="tool tool-btn" data-act="assemble" title="Assemble: no explosion, everything shown">Assemble</button>
          <select class="ctl-sys-select" aria-label="Which systems the explosion separates" title="Separate every system, or only one"><option value="">All systems</option></select>
          <button type="button" class="tool tool-btn ctl-scene-btn" aria-expanded="false" title="Floor, light, reflection and amplitude">Scene</button>
        </div>
        <div class="ctl-stages" role="group" aria-label="Stages: click one to keep it assembled"></div>
        <div class="ctl-status" aria-live="off"></div>
      </div>
      <div class="ctl-pop hidden" role="dialog" aria-label="Scene settings">
        <div class="ctl-pop-row"><span>Floor</span><div class="ctl-seg" data-seg="floor"></div></div>
        <div class="ctl-pop-row"><span>Light</span><div class="ctl-seg" data-seg="env"></div></div>
        <div class="ctl-pop-row" data-row="refl"><span>Reflection</span><div class="ctl-seg" data-seg="refl"></div></div>
        <div class="ctl-pop-row"><span>Openings</span><div class="ctl-seg ctl-toggles" data-seg="open" title="Tesla publishes no opening angles: the doors' (65°) and the frunk's (55°) are approximate; the tailgate drops level"></div></div>
        <div class="ctl-pop-row" data-row="figure"><span>1.80 m figure</span><div class="ctl-seg" data-seg="figure"></div></div>
        <label class="ctl-pop-row"><span>Amplitude</span><input type="range" class="ctl-amp" min="${AMP.min}" max="${AMP.max}" step="0.05" value="${AMP.init}" aria-label="Explosion amplitude"><output class="ctl-amp-out"></output></label>
      </div>
      <div class="ctl-loading" role="status" aria-live="polite">
        <div class="loading-card">
          <div class="eyebrow">Cybertruck Lab</div>
          <div class="loading-title">Loading the Cybertruck at 1:1</div>
          <div class="loading-track"><div class="loading-fill"></div></div>
          <div class="loading-text">Downloading the model…</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);
    stage = q('.ctl-stage');
    ui = {
      views: q('.ctl-views'), sub: q('.ctl-sub'), note: q('.ctl-note'), back: q('.ctl-back'),
      loading: q('.ctl-loading'), fill: q('.ctl-loading .loading-fill'), text: q('.ctl-loading .loading-text'),
      systems: q('.ctl-systems'), tree: q('.ctl-tree'), search: q('.ctl-search'), count: q('.ctl-count'), data: q('[data-pane="data"]'),
      info: q('.ctl-info'), slider: q('.ctl-explode input'), out: q('.ctl-explode output'), play: q('.ctl-play'),
      stages: q('.ctl-stages'), status: q('.ctl-status'), pop: q('.ctl-pop'), sceneBtn: q('.ctl-scene-btn'),
      amp: q('.ctl-amp'), ampOut: q('.ctl-amp-out'), sysSelect: q('.ctl-sys-select'),
    };
    ui.sysSelect.addEventListener('change', () => setExplodeSystem(ui.sysSelect.value || null));
    ui.back.addEventListener('click', () => lab.close());
    for (const [id, v] of Object.entries(VIEWS)) {
      const b = el('button', 'tool tool-btn', v.label);
      b.type = 'button'; b.dataset.view = id;
      b.addEventListener('click', () => goView(id));
      ui.views.appendChild(b);
    }
    for (const t of root.querySelectorAll('.ctl-tab')) t.addEventListener('click', () => setTab(t.dataset.tab));
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'showall') showAll();
      else if (act === 'deselect') select(null);
      else if (act === 'isolate' && state.selected) isolate(state.selected.name);
      else if (act === 'hide' && state.selected) { const n = state.selected.name; select(null); setPartVisible(n, false); }
      else if (act === 'frame' && state.selected) frame(state.selected);
      else if (act === 'assemble') assemble();
    });
    ui.slider.addEventListener('input', () => { setPlaying(false); explodeTween = null; setExplode(ui.slider.value / 100); stepBack(); });
    ui.play.addEventListener('click', () => setPlaying(!state.playing));
    ui.search.addEventListener('input', () => filterTree(ui.search.value));
    ui.sceneBtn.addEventListener('click', () => setPopover(ui.pop.classList.contains('hidden')));
    ui.amp.addEventListener('input', () => { state.amp = Number(ui.amp.value); syncAmp(); applyExplode(); });
    for (const [k, l] of Object.entries(CT_STAGES)) {
      const b = el('button', 'ctl-stage-chip');
      b.type = 'button'; b.dataset.stage = k; b.setAttribute('aria-pressed', 'true');
      b.title = `${l}: click to keep this stage assembled`;
      b.append(el('b', '', k), el('span', '', l));
      b.addEventListener('click', () => { state.stageMask[k] = !state.stageMask[k]; applyExplode(); });
      ui.stages.appendChild(b);
    }
    segment('floor', FLOORS, (v) => setFloor(v));
    segment('env', Object.fromEntries(Object.entries(ENVIRONMENTS).map(([k, e]) => [k, e.label])), (v) => setEnvironment(v));
    segment('refl', { on: 'On', off: 'Off' }, (v) => setReflections(v === 'on'));
    segment('open', Object.fromEntries(Object.entries(CT_OPENINGS).map(([k, o]) => [k, `${o.label}${o.approx ? ' ≈' : ''}`])), (v) => setOpening(v, openings[v].target === 0));
    segment('figure', { on: 'On', off: 'Off' }, (v) => setFigure(v === 'on'));
    if (!M) q('[data-row="figure"]').classList.add('hidden');
    // The reflection draws the whole truck again: only offered where the tier builds it.
    if (quality.name !== 'high') q('[data-row="refl"]').classList.add('hidden');
    syncAmp();
    // A click that did not drag picks the part under it.
    let down = null;
    stage.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; camTween = null; setPopover(false); });
    stage.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) pick(e.clientX, e.clientY);
      down = null;
    });
  }

  function segment(name, options, on) {
    const seg = root.querySelector(`[data-seg="${name}"]`);
    for (const [v, label] of Object.entries(options)) {
      const b = el('button', 'ctl-seg-btn', label);
      b.type = 'button'; b.dataset.value = v; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => on(v));
      seg.appendChild(b);
    }
  }
  function markSegment(name, value) {
    for (const b of root.querySelectorAll(`[data-seg="${name}"] .ctl-seg-btn`)) b.setAttribute('aria-pressed', String(b.dataset.value === value));
  }
  function setTab(tab) {
    for (const t of root.querySelectorAll('.ctl-tab')) t.setAttribute('aria-pressed', String(t.dataset.tab === tab));
    for (const p of root.querySelectorAll('.ctl-pane')) p.classList.toggle('hidden', p.dataset.pane !== tab);
    if (tab === 'parts') ui.search.focus({ preventScroll: true });
  }
  function setPopover(open) {
    ui.pop.classList.toggle('hidden', !open);
    ui.sceneBtn.setAttribute('aria-expanded', String(open));
  }
  function syncAmp() { ui.ampOut.textContent = `${state.amp.toFixed(2)}×`; }

  // ---- Scene ----
  function buildScene() {
    scene = new THREE.Scene();
    envMaps = environmentMaps(renderer);
    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 200);
    camera.position.set(...VIEWS.front34.pos);
    controls = new OrbitControls(camera, stage);
    controls.target.set(...VIEWS.front34.target);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.4; controls.maxDistance = 30;
    controls.screenSpacePanning = true;
    controls.addEventListener('change', () => { dirty = true; });

    key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.castShadow = quality.shadows;
    key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    // Room for the exploded truck: the farthest part, at full amplitude, stays inside ±6.5 m.
    Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
    hemi = new THREE.HemisphereLight(0xdfe6ee, 0x1a1c20, 0.25);
    scene.add(key, hemi);
    floors = createFloors(scene);
    // The centre's own 1.80 m figure (vehicles/common.js), beside the driver's doors and clear of
    // them opened or exploded: it is how the site shows scale, and here it makes the truck's 1.79 m
    // height and 5.68 m length readable (audit M-CT8).
    if (M) {
      // Beside the cargo bed, behind the rear wheel and out of the doors' way: no part reaches it even fully exploded at the
      // widest amplitude (2.4×; checked in tools/cybertruck-lab-check.mjs).
      figure = buildHumanCrowd(M, [{ x: -3.8, y: 0, z: 2.8, ry: Math.PI / 2, suit: 'white' }], { sunDir });
      figure.name = 'cybertruck-lab-figure';
      scene.add(figure);
    }
    if (quality.name === 'high') { reflector = createFloorReflector(14, Math.min(window.devicePixelRatio, 2) * 0.5); scene.add(reflector); }

    // As the site's: a multisampled half-float target (MSAA by tier) and one output pass, which
    // applies the tone mapping set on opening.
    rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: quality.msaa, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    // The site's bloom, by tier and with its firefly clamp ahead, so the light bar and the LEDs
    // glow as they do in the photographs (audit M-CT5); the same settings as the centre's.
    if (quality.bloom) {
      composer.addPass(fireflyClampPass());
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.6, 0.92));
    }
    composer.addPass(new OutputPass());
    setFloor(state.floor); setReflections(state.reflections); setFigure(state.figure);
  }

  function setEnvironment(name) {
    const e = ENVIRONMENTS[name] ?? ENVIRONMENTS.studio;
    state.env = ENVIRONMENTS[name] ? name : 'studio';
    scene.environment = envMaps[state.env];
    scene.environmentIntensity = e.envIntensity;
    scene.background = new THREE.Color(e.background);
    scene.fog = new THREE.Fog(...e.fog);
    renderer.toneMappingExposure = e.exposure;
    key.color.set(e.key.color); key.intensity = e.key.intensity; key.position.set(...e.key.pos);
    sunDir.copy(key.position).normalize();        // the figure's shadow follows the key light
    hemi.intensity = e.hemi;
    floors.set(state.floor, state.env);
    root.dataset.env = state.env;
    markSegment('env', state.env);
    pref.set('env', state.env);
    shadowDirty = dirty = true;
  }
  function setFloor(mode) {
    state.floor = FLOORS[mode] ? mode : 'glass';
    floors.set(state.floor, state.env);
    // With the floor see-through or hidden the camera can go round underneath, as in the viewer.
    controls.maxPolarAngle = state.floor === 'opaque' ? Math.PI * 0.495 : Math.PI;
    updateReflector();
    markSegment('floor', state.floor);
    pref.set('floor', state.floor);
    shadowDirty = dirty = true;
  }
  function setReflections(on) {
    state.reflections = !!on;
    updateReflector();
    markSegment('refl', state.reflections ? 'on' : 'off');
    pref.set('refl', state.reflections ? 'on' : 'off');
    dirty = true;
  }
  function setFigure(on) {
    state.figure = !!on && !!figure;
    if (figure) figure.visible = state.figure;
    markSegment('figure', state.figure ? 'on' : 'off');
    pref.set('figure', on ? 'on' : 'off');
    dirty = true;
  }

  // ---- Openings: doors, frunk and tailgate about the asset's hinges (audit M-CT4) ----
  const _oq = new THREE.Quaternion();
  function bindOpenings() {
    for (const o of Object.values(openings)) {
      o.items = o.nodes.map(n => truck.getObjectByName(n)).filter(Boolean).map(node => ({
        node, q0: node.quaternion.clone(), axis: new THREE.Vector3(...o.axis),
        // Left doors (x < 0) turn the other way from the right ones, so all four open outwards.
        sign: o.axis[1] ? Math.sign(node.position.x) || 1 : 1,
      }));
    }
  }
  function applyOpening(o) {
    for (const it of o.items) {
      _oq.setFromAxisAngle(it.axis, THREE.MathUtils.degToRad(o.deg) * it.sign * ease(o.k));
      it.node.quaternion.copy(it.q0).multiply(_oq);
    }
  }
  function setOpening(name, open) {
    const o = openings[name];
    if (!o) return;
    o.target = open ? 1 : 0;
    for (const b of root.querySelectorAll(`[data-seg="open"] [data-value="${name}"]`)) b.setAttribute('aria-pressed', String(!!open));
    dirty = true;
  }
  function stepOpenings(step) {
    for (const o of Object.values(openings)) {
      if (o.k === o.target || !o.items.length) continue;
      o.k = o.target > o.k ? Math.min(o.target, o.k + step / 0.9) : Math.max(o.target, o.k - step / 0.9);
      applyOpening(o);
      shadowDirty = dirty = true;
    }
  }

  function updateReflector() {
    if (!reflector) return;
    reflector.visible = state.reflections && state.floor !== 'hidden';
    reflector.setStrength(state.floor === 'glass' ? 0.24 : 0.14);
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
    windows = {};                     // from CYBERTRUCK_ROOT's extras, met in the traversal
    const fid = { V: 0, R: 0, A: 0 };
    let meshes = 0, tris = 0;
    const finished = new Map();
    truck.traverse((o) => {
      const ud = o.userData;
      if (ud?.explode_stage_windows) windows = ud.explode_stage_windows;
      if (ud?.label_es) {
        comps.set(o.name, o);
        if (fid[ud.fidelity] !== undefined) fid[ud.fidelity]++;
        if (ud.explode_dir && ud.explode_dist) {
          parts.push({ obj: o, base: o.position.clone(), dir: b2g(ud.explode_dir).normalize(), dist: Number(ud.explode_dist), stage: Number(ud.explode_stage) || 1 });
        }
      }
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
    truck.updateMatrixWorld(true);
    // Measured on the decoded vertices, assembled: what the data card shows next to Tesla's figures.
    const size = new THREE.Box3().setFromObject(truck, true).getSize(new THREE.Vector3());
    lab.stats = { parts: comps.size, exploding: parts.length, meshes, triangles: Math.round(tris), fidelity: fid, size: { length: size.z, width: size.x, height: size.y } };
    ui.sub.textContent = `1:1 Blender model · ${comps.size.toLocaleString('en-GB')} parts · ${CT_FIDELITY.V.label} ${fid.V} · ${CT_FIDELITY.R.label} ${fid.R} · ${CT_FIDELITY.A.label} ${fid.A}`;
    bindOpenings();
    buildLists();
    buildData();
    applyExplode();
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

  // ---- Lists: systems, parts and the data card ----
  function buildLists() {
    const bySystem = new Map();
    for (const o of comps.values()) {
      const s = o.userData.system || 'OTHER';
      if (!bySystem.has(s)) bySystem.set(s, []);
      bySystem.get(s).push(o);
    }
    const order = Object.keys(CT_SYSTEMS);
    const systems = [...bySystem.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    systems.forEach((sys, i) => {
      const list = bySystem.get(sys);
      const chip = el('button', 'ctl-chip');
      chip.type = 'button'; chip.setAttribute('aria-pressed', 'true'); chip.dataset.sys = sys;
      // One hue per system, round the colour wheel, as in the viewer.
      chip.style.setProperty('--c', `hsl(${Math.round((i * 360) / systems.length + 18) % 360} 72% 62%)`);
      chip.append(el('span', 'ctl-dot'), el('span', '', CT_SYSTEMS[sys] ?? sys), el('small', '', String(list.length)));
      chip.addEventListener('click', () => toggleSystem(sys));
      ui.systems.appendChild(chip); chips.set(sys, chip);
      const opt = el('option', '', `Only ${CT_SYSTEMS[sys] ?? sys}`);
      opt.value = sys; ui.sysSelect.appendChild(opt);

      const det = el('details', 'ctl-group');
      const sum = el('summary');
      sum.append(el('span', '', CT_SYSTEMS[sys] ?? sys), el('span', 'ctl-n', String(list.length)));
      det.appendChild(sum);
      list.sort((a, b) => a.userData.label_es.localeCompare(b.userData.label_es, 'es'));
      for (const o of list) {
        const row = el('div', 'ctl-item');
        row.dataset.search = fold(`${o.name} ${o.userData.label_es}`);
        const name = el('button', 'ctl-item-name', o.userData.label_es);
        name.type = 'button'; name.title = o.name;
        name.addEventListener('click', () => { select(o.name); frame(o); });
        const f = el('span', `ctl-fid fid-${o.userData.fidelity}`, o.userData.fidelity);
        f.title = CT_FIDELITY[o.userData.fidelity]?.label ?? '';
        const eye = el('button', 'ctl-eye', '◉');
        eye.type = 'button'; eye.setAttribute('aria-pressed', 'true');
        eye.setAttribute('aria-label', `Show or hide ${o.userData.label_es}`);
        eye.addEventListener('click', () => setPartVisible(o.name, state.hiddenParts.has(o.name)));
        row.append(name, f, eye);
        det.appendChild(row); rows.set(o.name, row);
      }
      ui.tree.appendChild(det);
    });
    ui.count.textContent = comps.size.toLocaleString('en-GB');
  }

  function filterTree(text) {
    const q = fold(text.trim());
    for (const det of ui.tree.children) {
      let any = false;
      for (const row of det.querySelectorAll('.ctl-item')) {
        const ok = !q || row.dataset.search.includes(q);
        row.classList.toggle('hidden', !ok);
        any ||= ok;
      }
      det.classList.toggle('hidden', !any);
      if (q) det.open = any;
    }
  }

  function buildData() {
    const pane = ui.data;
    pane.append(el('p', 'ctl-data-lead', "Tesla's published figures (owner's manual, grade A) next to the model's. The manual adds that values are approximate and vary with options."));
    const table = el('table', 'ctl-table');
    const head = el('tr');
    for (const h of ['', 'Tesla', 'Model', 'Δ']) head.appendChild(el('th', '', h));
    table.appendChild(head);
    const measured = { length: lab.stats.size.length, widthMirrors: lab.stats.size.width, height: lab.stats.size.height };
    for (const f of CT_FIGURES) {
      const tr = el('tr');
      const m = measured[f.id] ?? f.model;
      tr.append(el('td', '', f.label), el('td', 'num', `${f.value.toFixed(3)} m`),
        el('td', 'num', m === null ? '—' : `${f.approx ? '≈ ' : ''}${m.toFixed(3)} m`),
        el('td', 'num', m === null ? '' : `${m - f.value >= 0 ? '+' : '−'}${mm(Math.abs(m - f.value))}`));
      if (f.approx) tr.title = f.approx;
      if (measured[f.id] !== undefined) tr.classList.add('is-measured');
      table.appendChild(tr);
    }
    pane.appendChild(table);
    pane.append(el('p', 'ctl-data-note', 'Length, width and height of the model are measured here on the decoded mesh; the others come from the model\'s own validation in Blender. ≈ the body width: the model is 50 mm wider, its flanks being reconstructed.'));
    const fid = el('div', 'ctl-fid-row');
    for (const [k, f] of Object.entries(CT_FIDELITY)) {
      const b = el('div', `ctl-fid-box fid-${k}`);
      b.append(el('b', '', String(lab.stats.fidelity[k])), el('span', '', f.label));
      b.title = f.note;
      fid.appendChild(b);
    }
    pane.appendChild(fid);
    pane.append(el('h4', 'ctl-data-h', 'Air suspension (Premium AWD and Cyberbeast)'));
    const susp = el('table', 'ctl-table');
    const sh = el('tr');
    for (const h of ['Setting', 'Height', 'Clearance']) sh.appendChild(el('th', '', h));
    susp.appendChild(sh);
    for (const r of CT_SUSPENSION) {
      const tr = el('tr');
      tr.append(el('td', '', r.model ? `${r.label} (the model)` : r.label), el('td', 'num', `${r.height.toFixed(3)} m`), el('td', 'num', `${r.clearance.toFixed(3)} m`));
      if (r.model) tr.classList.add('is-measured');
      susp.appendChild(tr);
    }
    pane.appendChild(susp);
    pane.append(el('p', 'ctl-data-note', "Tesla's six settings, from the same page of the manual. The model is built at Medium; moving it to the others needs the suspension's arms articulated, so it is not done here."));
    const src = el('ul', 'ctl-sources');
    for (const s of Object.values(CT_SOURCES)) {
      const li = el('li'), a = el('a', '', s.label);
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
      li.appendChild(a); src.appendChild(li);
    }
    pane.appendChild(src);
  }

  // ---- Explosion: position = base + direction · distance · amplitude · smoothstep(stage window) ----
  // A pure function of the parameter: moving the slider back and forth accumulates no error.
  function applyExplode() {
    const e = state.explode;
    for (const p of parts) {
      const [a, b] = windows[p.stage] ?? [0, 1];
      const k = moves(p) ? smoothstep(a, b, e) * p.dist * state.amp : 0;
      p.obj.position.copy(p.base).addScaledVector(p.dir, k);
    }
    updateGuide();
    const pct = Math.round(e * 100);
    ui.slider.value = String(pct);
    ui.out.textContent = `${pct} %`;
    ui.slider.style.setProperty('--p', `${e * 100}%`);
    for (const c of ui.stages.children) {
      const s = c.dataset.stage, [a, b] = windows[s] ?? [0, 1];
      c.style.setProperty('--k', state.stageMask[s] ? smoothstep(a, b, e).toFixed(3) : 0);
      c.setAttribute('aria-pressed', String(state.stageMask[s]));
      c.classList.toggle('is-on', state.stageMask[s] && e > a);
    }
    status();
    shadowDirty = dirty = true;
  }
  /** Whether a part takes part in the explosion: its stage is on and, in the one-system mode, it is of that system. */
  const moves = (p) => state.stageMask[p.stage] && (!state.explodeSystem || p.obj.userData.system === state.explodeSystem);
  function setExplode(k) { state.explode = THREE.MathUtils.clamp(k, 0, 1); applyExplode(); }
  /** Explode every system (null) or only one: the rest stays assembled round it (audit M-CT7.2). */
  function setExplodeSystem(sys) {
    state.explodeSystem = sys && CT_SYSTEMS[sys] ? sys : null;
    ui.sysSelect.value = state.explodeSystem ?? '';
    applyExplode();
  }

  // ---- A guide from the selected part's assembled place to where it is, while exploded (M-CT7.3) ----
  let guide = null;
  function updateGuide() {
    if (!scene) return;
    if (!guide) {
      guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineDashedMaterial({ color: 0xff8a3d, dashSize: 0.06, gapSize: 0.04, depthTest: false, transparent: true, opacity: 0.9 }));
      guide.renderOrder = 10; guide.frustumCulled = false; guide.name = 'cybertruck-lab-guide';
      scene.add(guide);
    }
    const p = state.selected && parts.find(x => x.obj === state.selected);
    if (p) p.obj.parent.updateMatrixWorld(true);
    const from = p ? p.obj.parent.localToWorld(p.base.clone()) : null;
    const to = p ? p.obj.parent.localToWorld(p.obj.position.clone()) : null;
    guide.visible = !!p && from.distanceTo(to) > 0.01;
    if (!guide.visible) return;
    guide.geometry.setFromPoints([from, to]);
    guide.computeLineDistances();
  }
  function explodeTo(target, seconds = 0.9) { explodeTween = { t: 0, d: seconds, from: state.explode, to: target }; dirty = true; }
  function setPlaying(on) {
    state.playing = on;
    if (on) { state.playDir = state.explode >= 1 ? -1 : 1; explodeTween = null; stepBack(); }
    ui.play.setAttribute('aria-pressed', String(on));
    ui.play.firstChild.textContent = on ? 'Pause ' : 'Play ';
    dirty = true;
  }
  /** The exploded truck is two or three times the truck: step back if the camera is close (the Audi Lab's rule). */
  function stepBack() {
    if (state.isolated || camTween) return;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.length() < 11) flyTo(dir.setLength(12).add(controls.target).toArray(), controls.target.toArray(), 0.8);
  }
  // The one-system mode ends once assembled: ending it first would throw every system out for a frame.
  function assemble() { setPlaying(false); showAll(); explodeTo(0); explodeTween.onDone = () => setExplodeSystem(null); }

  function status() {
    const pct = Math.round(state.explode * 100);
    const active = Object.entries(windows).filter(([s, [a]]) => state.explode > a && state.stageMask[s]).map(([s]) => s);
    const sel = state.selected ? state.selected.userData.label_es : '—';
    ui.status.textContent = `${pct === 0 ? 'Assembled' : pct === 100 ? 'Fully exploded' : `Exploded ${pct} %`} · active stages: ${active.length ? active.join(', ') : 'none'} · selected: ${sel}`;
  }

  // ---- Visibility: one rule, from three sets, so the chips, the list and the scene agree (audit C11) ----
  function applyVisibility() {
    const keep = new Set();
    if (state.isolated) {
      const iso = comps.get(state.isolated);
      for (let p = iso; p; p = p.parent) keep.add(p);
      iso?.traverse((o) => keep.add(o));
    }
    for (const [name, o] of comps) {
      o.visible = !state.hiddenParts.has(name) && !state.hiddenSystems.has(o.userData.system) && (!state.isolated || keep.has(o));
    }
    for (const [name, row] of rows) {
      let shown = true;
      for (let p = comps.get(name); p && p !== truck; p = p.parent) if (!p.visible) { shown = false; break; }
      row.classList.toggle('is-hidden', !shown);
      row.querySelector('.ctl-eye').setAttribute('aria-pressed', String(!state.hiddenParts.has(name)));
    }
    for (const [sys, chip] of chips) chip.setAttribute('aria-pressed', String(!state.hiddenSystems.has(sys)));
    if (state.selected && !state.selected.visible) select(null);
    shadowDirty = dirty = true;
  }
  function toggleSystem(sys) {
    if (state.hiddenSystems.has(sys)) state.hiddenSystems.delete(sys); else state.hiddenSystems.add(sys);
    state.isolated = null;
    applyVisibility();
  }
  function setPartVisible(name, on) {
    if (on) state.hiddenParts.delete(name); else state.hiddenParts.add(name);
    applyVisibility();
  }
  function isolate(name) {
    state.isolated = comps.has(name) ? name : null;
    applyVisibility();
    if (state.isolated) frame(comps.get(name));
  }
  function showAll() {
    state.isolated = null; state.hiddenParts.clear(); state.hiddenSystems.clear();
    applyVisibility();
  }

  // ---- Selection ----
  function highlight(obj, on) {
    obj.traverse((m) => {
      if (!m.isMesh) return;
      if (on && !m.userData.ctlOrig) {
        m.userData.ctlOrig = m.material;
        m.material = [].concat(m.material).map((src) => {
          let h = highlights.get(src);
          if (!h) { h = src.clone(); h.emissive = HIGHLIGHT.clone(); h.emissiveIntensity = 0.35; highlights.set(src, h); }
          return h;
        });
        if (!Array.isArray(m.userData.ctlOrig)) m.material = m.material[0];
      } else if (!on && m.userData.ctlOrig) {
        m.material = m.userData.ctlOrig;
        delete m.userData.ctlOrig;
      }
    });
  }
  function select(name) {
    const obj = name ? comps.get(name) ?? null : null;
    if (state.selected) { highlight(state.selected, false); rows.get(state.selected.name)?.classList.remove('is-selected'); }
    state.selected = obj;
    if (obj) {
      highlight(obj, true);
      const ud = obj.userData, f = CT_FIDELITY[ud.fidelity];
      const pill = ui.info.querySelector('.ctl-pill');
      pill.textContent = f?.label ?? 'Unclassified'; pill.className = `ctl-pill fid-${ud.fidelity}`;
      ui.info.querySelector('.ctl-info-title').textContent = ud.label_es;
      ui.info.querySelector('.ctl-info-name').textContent = obj.name;
      ui.info.querySelector('[data-f="system"]').textContent = CT_SYSTEMS[ud.system] ?? ud.system ?? '—';
      ui.info.querySelector('[data-f="group"]').textContent = ud.explode_group ?? '—';
      ui.info.querySelector('[data-f="stage"]').textContent = ud.explode_stage ? `${ud.explode_stage} · ${CT_STAGES[ud.explode_stage]}` : '—';
      ui.info.querySelector('.ctl-info-note').textContent = ud.note_es ?? f?.note ?? '';
      ui.info.classList.remove('hidden');
      const row = rows.get(obj.name);
      if (row) { row.classList.add('is-selected'); row.closest('details').open = true; row.scrollIntoView({ block: 'nearest' }); }
    } else ui.info.classList.add('hidden');
    updateGuide();
    status();
    dirty = true;
  }
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function shownChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function pick(x, y) {
    if (!truck) return;
    const r = stage.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(truck, true).find(h => shownChain(h.object));
    let c = hit?.object ?? null;
    while (c && !c.userData?.label_es) c = c.parent;
    select(c?.name ?? null);
  }

  // ---- Camera ----
  function flyTo(pos, target, seconds = 0.9, fov = camera.fov) {
    camTween = { t: 0, d: seconds, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target), f0: camera.fov, f1: fov };
    dirty = true;
  }
  function goView(id) {
    const v = VIEWS[id];
    if (!v) return;
    // The underside is seen through the floor.
    if (v.below && state.floor === 'opaque') setFloor('glass');
    const p = new THREE.Vector3(...v.pos), t = new THREE.Vector3(...v.target);
    // A tall window: step back so the truck still fits across (the viewer's rule).
    if (!v.fov && camera.aspect < 1.3) p.sub(t).multiplyScalar(Math.pow(1.3 / camera.aspect, 0.85)).add(t);
    flyTo(p.toArray(), t.toArray(), 0.9, v.fov ?? 38);
    for (const b of ui.views.children) b.classList.toggle('is-active', b.dataset.view === id);
  }
  function frame(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.25, box.getSize(new THREE.Vector3()).length() * 0.9);
    const dir = camera.position.clone().sub(controls.target).normalize();
    flyTo(c.clone().addScaledVector(dir, r * 1.6).toArray(), c.toArray(), 0.7, camera.fov);
  }
  const resetView = () => goView(state.explode > 0.3 ? 'exploded' : 'front34');

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
      if (camTween.f0 !== camTween.f1) { camera.fov = camTween.f0 + (camTween.f1 - camTween.f0) * k; camera.updateProjectionMatrix(); }
      if (camTween.t >= 1) camTween = null;
      dirty = true;
    }
    if (explodeTween) {
      explodeTween.t = Math.min(1, explodeTween.t + step / explodeTween.d);
      setExplode(explodeTween.from + (explodeTween.to - explodeTween.from) * ease(explodeTween.t));
      if (explodeTween.t >= 1) { const done = explodeTween.onDone; explodeTween = null; done?.(); }
    } else if (state.playing && truck) {
      let e = state.explode + state.playDir * step / PLAY_SECONDS;
      if (e >= 1 || e <= 0) { e = THREE.MathUtils.clamp(e, 0, 1); state.playDir *= -1; }
      setExplode(e);
    }
    stepOpenings(step);
    controls.update();          // damping: keeps raising 'change' while the orbit settles
    if (!dirty) return;
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    composer.render();
    lab.frames++;
    dirty = false;
  };

  /**
   * The panel on the right and the dock below cover part of the canvas: the centre of projection
   * moves to the middle of what is left, as the site does under its list (setViewOffset), so a
   * view frames the truck in the free part of the screen. The camera does not move, and picking
   * and every projection stay consistent.
   */
  function frameFreeArea(w, h) {
    const panel = root.querySelector('.ctl-panel').getBoundingClientRect();
    const dock = root.querySelector('.ctl-dock').getBoundingClientRect();
    const right = panel.width ? panel.left : w, bottom = dock.height ? dock.top : h;
    camera.setViewOffset(w, h, Math.round(w / 2 - right / 2), Math.round(h / 2 - bottom / 2), w, h);
  }

  function resize() {
    if (!scene) return;
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    frameFreeArea(w, h);
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    reflector?.resize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    dirty = true;
  }

  const onKey = (e) => {
    // The site's shortcuts (G launches Starship, J flies the F-16…) and its camera keys stay
    // out of the Lab. A text field (the parts search) keeps its keys: the site ignores them too.
    const t = e.target;
    if (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox')) {
      if (e.type === 'keydown' && e.key === 'Escape') { t.blur(); e.stopImmediatePropagation(); }
      return;
    }
    e.stopImmediatePropagation();
    if (e.type !== 'keydown' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      // One layer at a time: the settings, an isolation, a selection, then the Lab itself.
      if (!ui.pop.classList.contains('hidden')) setPopover(false);
      else if (state.isolated) showAll();
      else if (state.selected) select(null);
      else lab.close();
    } else if (k === 'u') lab.close();
    else if (k === 'r') resetView();
    else if (k === 'f' && state.selected) frame(state.selected);
    else if (k === ' ' && truck && t.tagName !== 'BUTTON') { e.preventDefault(); setPlaying(!state.playing); }
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
    renderer.shadowMap.autoUpdate = false;
    document.body.classList.add('cybertruck-lab-open');
    root.classList.remove('hidden');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('resize', resize);
    if (!scene) buildScene();
    setEnvironment(state.env);              // also the exposure, which the site had changed back
    resize(); shadowDirty = dirty = true;
    note(ended);
    ui.back.focus();
    if (!lab.loaded && !lab.loading) load();
  };

  lab.close = () => {
    if (!lab.active) return;
    lab.active = false;
    camTween = null; explodeTween = null;
    if (state.playing) setPlaying(false);
    setPopover(false);
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

  /** The largest distance of any part from where the model put it: 0 when assembled, whatever came before. */
  lab.deviation = () => parts.reduce((m, p) => {
    const [a, b] = windows[p.stage] ?? [0, 1];
    const want = p.base.clone().addScaledVector(p.dir, moves(p) ? smoothstep(a, b, state.explode) * p.dist * state.amp : 0);
    return Math.max(m, p.obj.position.distanceTo(want));
  }, 0);

  // For the checks and the console.
  Object.assign(lab, {
    flyTo, goView, resetView, setExplode, setExplodeSystem, explodeTo, setPlaying, assemble, select, isolate, showAll, setPartVisible,
    toggleSystem, setFloor, setEnvironment, setReflections, setOpening, setFigure, filterTree, frame, VIEWS, state, parts, comps, openings,
  });
  Object.defineProperties(lab, {
    camera: { get: () => camera }, controls: { get: () => controls }, scene: { get: () => scene }, truck: { get: () => truck },
    reflector: { get: () => reflector }, floors: { get: () => floors }, windows: { get: () => windows }, figure: { get: () => figure },
  });
  return lab;
}
