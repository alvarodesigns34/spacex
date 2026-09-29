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
 * splash point and the globe move under it, so a 5 700 km glide keeps single-precision
 * vertices steady.
 */
import * as THREE from 'three';
import { Plume, Vapor, Glow, FlightEarth } from './plume.js';
import { RE, CHAPTER, MILESTONES_RE, reentryState, reentryPitchAt, reentryEnginesAt, heatingAt, toSplashAt, densityAt } from './reentryFlight.js';

// ---- Plasma ------------------------------------------------------------------------------
const PLASMA_VERT = /* glsl */`
  varying vec3 vN, vV, vL;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
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
    float along = pow(clamp(vUv.y, 0.0, 1.0), 1.6) * (1.0 - smoothstep(0.86, 1.0, vUv.y));   // edges in order: GLSL leaves smoothstep(a > b) undefined
    // A glowing column, not a pipe: bright where the eye looks through most of it, fading to
    // nothing at its silhouette.
    float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
    float turb = 0.55 + 0.9 * n2(vec2(vUv.x * 7.0, vUv.y * 22.0 - uTime * 6.0));
    vec3 col = mix(uCool, uHot, smoothstep(0.3, 1.0, uHeat) * (0.4 + vUv.y * 0.6));
    gl_FragColor = vec4(col * along * edge * turb * uHeat * 0.9, 1.0);
  }`;
const WAKE_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vN, vV;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vN = mat3(modelMatrix) * normal;
    vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
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
      if (!o.isMesh || o.material !== M.steelFlap || /hinge/.test(o.name)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      b.copy(o.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(inv, o.matrixWorld));
      const c = b.getCenter(new THREE.Vector3());
      const side = Math.sign(c.x) || 1;
      flaps.push(new THREE.Vector3(side > 0 ? b.max.x : b.min.x, c.y, c.z));
    });
    flaps.sort((a, b2) => a.y - b2.y || a.x - b2.x);
    flapTrails.forEach((ft, i) => { if (flaps[i]) ft.tip.copy(flaps[i]); ft.ok = !!flaps[i]; });
  }
  const glow = new Glow({ color: 0xffd2a8, edge: 0xff6a2a, name: 'reentry-glow' });
  holder.add(glow.mesh);
  // No lights of its own: a light appearing with the chapter changes every lit material's
  // shader and recompiles them all at once (the stall the launch avoids, launch.js). The heat
  // shows as emissive on the ship's own materials instead (setHeatGlow).

  // The heat itself, on the ship: the windward tiles and the flaps glow orange as the plasma
  // heats them — the dull glow of the flap edges and the belly in SpaceX's on-board views.
  // Emissive on the ship's own materials (they are the ship's alone), restored afterwards.
  const heatMats = [M.tile, M.tpsShell, M.tileUnder, M.steelFlap].filter(Boolean)
    .map(m => ({ m, color: m.emissive.clone(), intensity: m.emissiveIntensity, k: m === M.steelFlap ? 0.9 : 1.5 }));
  const HEAT_COLOR = new THREE.Color(0xff5e1f);
  function setHeatGlow(h) {
    for (const e of heatMats) {
      if (h > 0.01) { e.m.emissive.copy(HEAT_COLOR); e.m.emissiveIntensity = h * h * e.k; }
      else { e.m.emissive.copy(e.color); e.m.emissiveIntensity = e.intensity; }
    }
  }

  // The landing burn: the three sea-level Raptors, then two, then one.
  const plume = new Plume({ radius: 1.6, name: 'reentry-plume', fireCount: 90 });
  plume.group.remove(plume.light);
  mount.add(plume.group);

  // The ocean round the splash point, and the steam and spray there.
  const ocean = new THREE.Group();
  ocean.name = 'reentry-ocean';
  root.add(ocean);
  {
    // 300 km across: below 15 km its edge is far out in the haze.
    const g = new THREE.CircleGeometry(300000, 128);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
    // Open ocean: deep blue, the Gulf's wave normals at a gentler slope. The coast's sea
    // material grades by distance offshore (an attribute this disc has no use for).
    const mat = new THREE.MeshStandardMaterial({ name: 'reentry-ocean', color: 0x0f3550, roughness: 0.12, metalness: 0, normalMap: M.water?.normalMap ?? null, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.9 });
    const sea = new THREE.Mesh(g, mat);
    sea.rotation.x = -Math.PI / 2;
    sea.name = 'reentry-sea';
    sea.receiveShadow = false;
    ocean.add(sea);
  }
  let seed = 0x5eed;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const spray = new Vapor({
    name: 'reentry-spray', rng, accel: [0.8, -0.2, 0.3], tau: 1.1, opacity: 0.5,
    emitters: [
      // Exhaust on the water: a spreading skirt of steam and spray under the last metres.
      { at: [0, 0.5, 0], dir: [0, 0.35, 0], speed: 18, spread: 1.0, count: 220, life: 9, size: 16, grow: 7, jitter: 6, window: [RE.twoEngines + 3, RE.splash + 1] },
      // The splash itself.
      { at: [0, 0.5, 0], dir: [0, 1, 0], speed: 22, spread: 0.7, count: 120, life: 6, size: 11, grow: 5, jitter: 4, window: [RE.splash - 0.4, RE.splash + 1.2] },
    ],
  });
  ocean.add(spray.mesh);
  // A ring of foam spreading from where the ship came down (≈).
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color: 0xe8eef2, transparent: true, opacity: 0, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.05;
  foam.name = 'reentry-foam';
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
      const names = new Set(['campus', 'markings']);
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
    holder.position.set(0, s.h + COM * up + (t >= RE.splash ? -0.6 * Math.min(1, (t - RE.splash) / 3) : 0), 0);
    // Where the splash point is, relative to the ship.
    const ahead = toSplashAt(t);
    ocean.position.set(ahead, 0, 0);
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
    holder.updateMatrixWorld(true);
    for (const ft of flapTrails) {
      ft.mesh.visible = ft.ok && heat > 0.02;
      if (!ft.mesh.visible) continue;
      ft.mesh.position.copy(ft.tip);
      mount.localToWorld(ft.mesh.position);
      _t.copy(ft.mesh.position).add(_v);
      ft.mesh.lookAt(_t);
      ft.mesh.scale.set(0.4 + 1.4 * heat, 0.4 + 1.4 * heat, 30 + 160 * heat);
    }
    glow.set(state.follow === 'onboard' || shotFor(t) === 'onboard' ? 0 : heat * 2.2, 30 + 40 * heat, t);
    setHeatGlow(heat);

    // Landing burn.
    const alt = s.h;
    plume.setTime?.(t);
    plume.setThrottle(lit ? 0.75 : 0, alt, lit === 3 ? 1 : lit === 2 ? 0.8 : 0.5, lit ? 0.75 : 0);
    spray.update(t, camera, env.sun);
    const fu = t > RE.splash ? Math.min(1, (t - RE.splash) / 20) : 0;
    foam.visible = fu > 0;
    foam.scale.setScalar(12 + 110 * fu);
    foam.material.opacity = 0.55 * (1 - fu);

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
    placeCamera(t, s);
  }

  // ---- Cameras -----------------------------------------------------------------------------
  // Director: the on-board view of the aft flap through the plasma (as on SpaceX's webcasts),
  // a chase from outside as it slows, alongside through the belly flop, and a buoy on the water
  // for the landing. 'onboard' and 'chase' hold one shot for the whole chapter.
  const _c = new THREE.Vector3(), _l = new THREE.Vector3();
  function shotFor(t) {
    if (state.follow !== 'director') return state.follow;
    if (t < RE.entry + 540) return 'onboard';
    if (t < RE.subsonic + 20) return 'chase';
    if (t < RE.landingBurn - 45) return 'side';
    return 'buoy';
  }
  function placeCamera(t, s) {
    holder.updateMatrixWorld(true);
    const shot = shotFor(t);
    if (shot === 'onboard') {
      // On the leeward hull, looking aft along the side at the aft flap (≈ placement).
      _c.set(-5.8, 30, -5.2); mount.localToWorld(_c);
      _l.set(-8.5, 5, 0.5); mount.localToWorld(_l);
    } else if (shot === 'chase') {
      _v.set(s.vx, s.vh, 0).normalize();
      _c.copy(holder.position).addScaledVector(_v, -160).add(_t.set(0, 40, 70));
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
    hideSite(true);
    root.visible = true;
    rig.external = true;
    visibilityHook?.(true);
    Object.assign(state, { running: true, paused: false, speed: 10, follow: 'director' });
    apply(CHAPTER.start);
    onState(state);
  }

  function reset(returnCamera = true, completed = false) {
    if (!state.running) return;
    state.running = false;
    plume.setThrottle(0, 0);
    setHeatGlow(0);
    spray.hide?.();
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
    if (state.paused) { placeCamera(state.t, reentryState(state.t)); return; }
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
    setFollow: (w) => { state.follow = w; if (state.running) apply(state.t); onState(state); },
  };
}
