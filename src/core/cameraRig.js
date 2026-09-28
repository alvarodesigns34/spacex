/**
 * Camera rig: orbit mode (OrbitControls) and free-fly mode (WASD/QE + mouse look),
 * plus eased transitions between framed views.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const REDUCED_MOTION = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'orbit';
    this.orbit = new OrbitControls(camera, dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.07;
    this.orbit.minDistance = 0.6;
    this.orbit.maxDistance = 1600;
    this.minHeight = 0.35;   // apron clearance, enforced through maxPolarAngle each frame
    this.orbit.zoomSpeed = 0.9;
    this.orbit.rotateSpeed = 0.7;
    this.orbit.screenSpacePanning = true;
    // The wheel zooms towards whatever is under the cursor, not towards an orbit target that
    // may be 300 m away behind it: in a centre this size, zooming to the target meant zooming
    // past everything you were pointing at.
    this.orbit.zoomToCursor = true;

    this.keys = new Set();
    this.look = { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 };
    this.flySpeed = 14;      // m/s base
    // Walking: a visitor's eye height and pace, on the same ground the scene is built on.
    // groundAt(x, z) and obstacles ([x, z, r] circles the visitor cannot walk into) are
    // supplied by main.js, which knows the terrain, the pad and the exhibits.
    this.eyeHeight = 1.7;
    // Walking pace, stepped with the wheel: a stroll, a brisk walk, a jog, a bicycle, a cart.
    // The site is 400 m across, so a real 1,4 m/s is right for looking and wrong for getting
    // anywhere. Shift doubles whichever is set.
    this.walkSpeeds = [1.4, 3, 6, 12, 25];
    this.walkLevel = 1;
    this.onWalkSpeed = null;
    this.groundAt = () => 0;
    this.obstacles = [];
    this.walls = [];         // [x0, z0, x1, z1] segments a walker cannot cross (the site fence)
    this.travel = null;      // a double-click trip: waypoints walked at a travelling pace
    // The eye's field of view when walking. At the orbit's 42° (vertical) everything next to
    // you is squeezed as through a long lens and a 124 m rocket stops towering; ~60° vertical
    // (≈ 90° across a 16:9 screen) is what reads as standing there.
    this.walkFov = 60;
    this.baseFov = camera.fov;
    this.velocity = new THREE.Vector3();
    this.transition = null;
    this.onModeChange = null;
    // While something else is driving the camera (the launch sequence), the rig steps aside
    // completely. The first pointer or wheel input hands control straight back, so a viewer
    // is never locked out of a shot they want to leave.
    this.external = false;
    this.onExternalRelease = null;
    // Scratch vectors for the free-flight integrator and the two mode switches, which also
    // built a Vector3 each time they were called.
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    // In free flight the movement keys belong to the flight. Space is "up", and it is also
    // what a browser uses to press the focused button: after clicking "Free flight" the
    // focus stays on that button, so rising pressed it and dropped straight back to orbit.
    const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyC', 'Space']);
    // Text fields keep their keys; the Sun slider (a range input) does not type, so flying on
    // after touching it must still work.
    const typing = (t) => t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range');
    const claim = (e) => { if (this.mode !== 'orbit' && FLY_KEYS.has(e.code) && !typing(e.target)) e.preventDefault(); };
    this._onKeyDown = (e) => { if (typing(e.target)) return; claim(e); this.keys.add(e.code); if (FLY_KEYS.has(e.code)) this.travel = null; };
    this._onKeyUp = (e) => { claim(e); this.keys.delete(e.code); };
    // A keyup that lands on another window never reaches us, so the key stays in the set and
    // the camera flies on by itself when the tab comes back. Alt-Tab away mid-flight and the
    // scene had drifted off into the distance by the time you returned.
    this._onBlur = () => { this.keys.clear(); this.velocity.set(0, 0, 0); this.look.dragging = false; };
    // Touching the controls cancels a scripted sweep as well as releasing an external driver.
    // Without the cancel, update() kept lerping towards the old target for the rest of the
    // 1.5-2 s flight and overwrote the drag every frame — the rig promises "the first input
    // hands control back", and on the most-used path in the page it did not keep that promise.
    this._onPointerDown = (e) => { this.takeOver(); if (this.mode === 'orbit') return; this.look.dragging = true; this.look.lastX = e.clientX; this.look.lastY = e.clientY; dom.setPointerCapture?.(e.pointerId); };
    this._onPointerUp = () => { this.look.dragging = false; };
    this._onPointerMove = (e) => {
      if (this.mode === 'orbit' || !this.look.dragging) return;
      const dx = e.clientX - this.look.lastX, dy = e.clientY - this.look.lastY;
      this.look.lastX = e.clientX; this.look.lastY = e.clientY;
      this.look.yaw -= dx * 0.0022;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 0.0022, -1.45, 1.45);
    };
    this._onWheel = (e) => {
      this.takeOver();
      if (this.mode === 'walk') {
        this.walkLevel = THREE.MathUtils.clamp(this.walkLevel + (e.deltaY > 0 ? -1 : 1), 0, this.walkSpeeds.length - 1);
        this.onWalkSpeed?.(this.walkSpeed);
        return;
      }
      if (this.mode !== 'fly') return;
      this.flySpeed = THREE.MathUtils.clamp(this.flySpeed * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 200);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    dom.addEventListener('pointerdown', this._onPointerDown);
    dom.addEventListener('pointerup', this._onPointerUp);
    dom.addEventListener('pointermove', this._onPointerMove);
    dom.addEventListener('wheel', this._onWheel, { passive: true });
  }

  get target() { return this.orbit.target; }
  get walkSpeed() { return this.walkSpeeds[this.walkLevel]; }
  get distance() { return this.camera.position.distanceTo(this.orbit.target); }

  setMode(mode) {
    if (mode === this.mode) return;
    this.releaseExternal();
    this.keys.clear();
    this.velocity.set(0, 0, 0);
    this.travel = null;
    const from = this.mode;
    this.mode = mode;
    const fov = mode === 'walk' ? this.walkFov : this.baseFov;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    if (mode === 'walk' && from === 'orbit') {
      // Step down onto the ground in front of what the orbit was looking at: back from the
      // target towards the camera, far enough to take it in, at eye height, facing it.
      this._endTransition();
      const t = this.orbit.target, c = this.camera.position;
      const dx = c.x - t.x, dz = c.z - t.z, h = Math.hypot(dx, dz) || 1;
      const back = THREE.MathUtils.clamp(this.distance * 0.6, 8, 40);
      let x = t.x + (dx / h) * back, z = t.z + (dz / h) * back;
      [x, z] = this._clear(x, z);
      c.set(x, this.groundAt(x, z) + this.eyeHeight, z);
      this.camera.lookAt(t.x, Math.max(t.y, c.y), t.z);
    }
    if (mode === 'fly' || mode === 'walk') {
      this._endTransition();
      this.orbit.enabled = false;
      // derive yaw/pitch from the current view direction
      const dir = this._dir;
      this.camera.getWorldDirection(dir);
      this.look.yaw = Math.atan2(-dir.x, -dir.z);
      this.look.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      if (mode === 'walk') {
        const p = this.camera.position;
        p.y = this.groundAt(p.x, p.z) + this.eyeHeight;
      }
    } else {
      // keep the orbit target ahead of the camera
      const dir = this._dir;
      this.camera.getWorldDirection(dir);
      const d = Math.max(this.distance, 5);
      this.orbit.target.copy(this.camera.position).addScaledVector(dir, Math.min(d, 60));
      this.orbit.enabled = true;
      this.applyPolarLimit();
      this.orbit.update();
    }
    this.onModeChange?.(mode);
  }

  /**
   * Ends whatever sweep is in flight. The promise a flyTo handed out has to settle even when
   * the sweep is cut short — the guided tour awaits it, and a superseded flight that never
   * resolved left that await pending for the rest of the session, so a tour interrupted by a
   * click could not be restarted.
   */
  _endTransition() {
    if (!this.transition) return;
    const tr = this.transition;
    this.transition = null;
    tr.resolve();
  }

  /** Pushes a ground point out of every obstacle circle it falls inside. */
  _clear(x, z) {
    for (const [ox, oz, r] of this.obstacles) {
      const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
      if (d < r) { const k = d > 1e-6 ? r / d : 1; x = ox + (d > 1e-6 ? dx : r) * k; z = oz + (d > 1e-6 ? dz * k : 0); }
    }
    return [x, z];
  }

  /** True if the step from (x0, z0) to (x1, z1) crosses one of the walls. */
  _crossesWall(x0, z0, x1, z1) {
    const cross = (ax, az, bx, bz) => ax * bz - az * bx;
    for (const [a, b, c, d] of this.walls) {
      const rx = x1 - x0, rz = z1 - z0, sx = c - a, sz = d - b;
      const den = cross(rx, rz, sx, sz);
      if (Math.abs(den) < 1e-9) continue;
      const qx = a - x0, qz = b - z0;
      const u = cross(qx, qz, sx, sz) / den, v = cross(qx, qz, rx, rz) / den;
      if (u >= 0 && u <= 1 && v >= -0.02 && v <= 1.02) return true;
    }
    return false;
  }

  /** Distance from (x, z) to the nearest wall. */
  _wallDistance(x, z) {
    let best = Infinity;
    for (const [a, b, c, d] of this.walls) {
      const sx = c - a, sz = d - b, l2 = sx * sx + sz * sz;
      const u = l2 > 0 ? THREE.MathUtils.clamp(((x - a) * sx + (z - b) * sz) / l2, 0, 1) : 0;
      best = Math.min(best, Math.hypot(x - (a + sx * u), z - (b + sz * u)));
    }
    return best;
  }

  /** Can a walker step from (x0, z0) to (x1, z1)? Not through a wall, not closer to one than a
   *  body's half-width, not up a step taller than a kerb. */
  _canStep(x0, z0, x1, z1) {
    if (this._crossesWall(x0, z0, x1, z1)) return false;
    const d1 = this._wallDistance(x1, z1);
    if (d1 < 0.35 && d1 < this._wallDistance(x0, z0)) return false;
    return this.groundAt(x1, z1) - this.groundAt(x0, z0) <= 0.6;
  }

  /**
   * A double-click trip in walk mode: along the waypoints at a travelling pace (fast enough to
   * cross the site in a few seconds, eased in and out), eyes at 1,7 m over the ground the whole
   * way, and turning to face `look` at the end. The route is main.js's, which knows the fence
   * gate; the trip itself does not stop at walls, it is the way the visitor asked to go.
   */
  travelTo(waypoints, look) {
    if (this.mode !== 'walk' || !waypoints.length) return;
    const pts = [new THREE.Vector2(this.camera.position.x, this.camera.position.z), ...waypoints.map(([x, z]) => new THREE.Vector2(x, z))];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    if (len < 0.3) return;
    const speed = THREE.MathUtils.clamp(len / 4, Math.max(4, this.walkSpeed * 2), 60);
    this.travel = { pts, len, s: 0, speed, look: look ? new THREE.Vector3(look.x, look.y, look.z) : null, yaw0: this.look.yaw, pitch0: this.look.pitch };
  }

  flyTo(position, target, duration = 1.7) {
    // prefers-reduced-motion only killed CSS transitions; a 1,7 s camera sweep across a 300 m
    // scene is the strongest motion the page produces, so honour the setting here too.
    if (REDUCED_MOTION?.matches) { this.jumpTo(position, target); return Promise.resolve(); }
    const from = this.camera.position.clone();
    const fromT = this.orbit.target.clone();
    const to = new THREE.Vector3(...position);
    const toT = new THREE.Vector3(...target);
    if (this.mode !== 'orbit') this.setMode('orbit');
    this._endTransition();
    return new Promise((resolve) => {
      // (setMode above restores the orbit's field of view when leaving a walk.)
      // A straight line between two framings cut through whatever stood between them — the
      // tower, most often, on the way from the row to the pad. Long moves now rise on an arc
      // that peaks mid-flight, higher the further they go; short reframings stay straight.
      const span = from.distanceTo(to);
      const lift = span > 30 ? Math.min(span * 0.18, 90) : 0;
      this.transition = { from, fromT, to, toT, lift, start: performance.now(), duration, resolve };
    });
  }

  /**
   * Re-centres the orbit on a point in the scene: the camera keeps its bearing and closes to
   * half the distance to the point (never nearer than 2 m, never further than it already is).
   */
  focusOn(point) {
    const p = new THREE.Vector3(point.x, point.y, point.z);
    const dir = p.clone().sub(this.camera.position);
    const d = dir.length();
    if (d < 1e-3) return Promise.resolve();
    const keep = THREE.MathUtils.clamp(d * 0.5, 2, Math.max(2, this.distance));
    const pos = p.clone().addScaledVector(dir.normalize(), -keep);
    return this.flyTo(pos.toArray(), p.toArray(), 0.9);
  }

  jumpTo(position, target) {
    this._endTransition();
    if (this.mode !== 'orbit') this.setMode('orbit');
    this.camera.position.set(...position);
    this.orbit.target.set(...target);
    this.applyPolarLimit();
    this.orbit.update();
  }

  /**
   * Keeps the camera above the apron by limiting the polar angle rather than clamping its
   * position afterwards, which would fight the controls' damping at the limit.
   *
   * The limit depends on the current target and distance, so it MUST be recomputed before
   * every `orbit.update()`: applying the previous frame's value to a freshly framed view
   * clamps the jump to the old geometry.
   */
  applyPolarLimit() {
    const d = this.distance;
    const cosMax = d > 1e-3 ? (this.minHeight - this.orbit.target.y) / d : -1;
    this.orbit.maxPolarAngle = Math.acos(THREE.MathUtils.clamp(cosMax, -1, 1));
  }

  /**
   * Hands the camera back to the viewer, from wherever the scripted shot had left it.
   *
   * `orbit.enabled` follows the MODE, not the fact of release: forcing it true here while the
   * rig was in free flight left OrbitControls and the fly integrator both writing
   * camera.position, and the viewer had to press F twice to get out.
   */
  releaseExternal() {
    if (!this.external) return;
    this.external = false;
    this._endTransition();
    this.orbit.enabled = this.mode === 'orbit';
    if (this.mode !== 'orbit') {
      // Free flight steers from yaw/pitch, so it has to adopt the direction the scripted shot
      // left the camera pointing. Without this the view snapped back to whatever the fly
      // integrator last believed the moment control came back.
      const dir = this._dir;
      this.camera.getWorldDirection(dir);
      this.look.yaw = Math.atan2(-dir.x, -dir.z);
      this.look.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      this.velocity.set(0, 0, 0);
      this.onExternalRelease?.();
      return;
    }
    this.applyPolarLimit();
    this.orbit.update();
    this.onExternalRelease?.();
  }

  /** Everything a direct input by the viewer cancels: a scripted shot and a framing sweep. */
  takeOver() {
    this.releaseExternal();
    this._endTransition();
  }

  update(dt) {
    if (this.external) { this.orbit.enabled = false; return; }
    if (this.transition) {
      const tr = this.transition;
      const t = (performance.now() - tr.start) / (tr.duration * 1000);
      const k = easeInOut(Math.min(t, 1));
      this.camera.position.lerpVectors(tr.from, tr.to, k);
      if (tr.lift) this.camera.position.y += tr.lift * Math.sin(Math.PI * k);
      this.orbit.target.lerpVectors(tr.fromT, tr.toT, k);
      this.applyPolarLimit();
      this.orbit.update();
      if (t >= 1) { this.transition = null; tr.resolve(); }
      return;
    }
    if (this.mode === 'orbit') {
      this.applyPolarLimit();
      this.orbit.update();
      return;
    }

    if (this.mode === 'walk') { this._walk(dt); return; }

    // ---- free-fly ----
    // Scratch vectors, not fresh ones. Four Vector3 per frame is a small allocation and an
    // unbounded one: free flight runs for as long as the visitor holds W, so it is a steady
    // drip of garbage in the one loop that never stops. Reused in place instead.
    const cam = this.camera;
    cam.rotation.set(this.look.pitch, this.look.yaw, 0, 'YXZ');
    const fwd = this._fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = this._right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = this._up.set(0, 1, 0);
    const wish = this._wish.set(0, 0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(fwd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(fwd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    if (this.keys.has('KeyE') || this.keys.has('Space')) wish.add(up);
    if (this.keys.has('KeyQ') || this.keys.has('KeyC')) wish.sub(up);
    let speed = this.flySpeed;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) speed *= 4;
    if (this.keys.has('ControlLeft') || this.keys.has('AltLeft')) speed *= 0.2;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    // critically damped-ish smoothing
    const a = 1 - Math.exp(-dt * 9);
    this.velocity.lerp(wish, a);
    cam.position.addScaledVector(this.velocity, dt);
    // The floor is the ground under the camera, not a flat 0,4 m: the lomas rise to ~7 m and
    // the pad to 5 m, and the camera used to fly straight through them.
    const floor = this.groundAt(cam.position.x, cam.position.z) + 0.4;
    if (cam.position.y < floor) cam.position.y = floor;
  }

  /** Walking: horizontal moves at a visitor's pace, eyes 1,7 m over whatever is underfoot. */
  _walk(dt) {
    const cam = this.camera;
    if (this.travel) { this._travel(dt); return; }
    cam.rotation.set(this.look.pitch, this.look.yaw, 0, 'YXZ');
    const fwd = this._fwd.set(-Math.sin(this.look.yaw), 0, -Math.cos(this.look.yaw));
    const right = this._right.set(Math.cos(this.look.yaw), 0, -Math.sin(this.look.yaw));
    const wish = this._wish.set(0, 0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(fwd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(fwd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    let speed = this.walkSpeed;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) speed *= 2;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    this.velocity.lerp(wish, 1 - Math.exp(-dt * 8));
    const p = cam.position;
    let nx = p.x + this.velocity.x * dt, nz = p.z + this.velocity.z * dt;
    [nx, nz] = this._clear(nx, nz);
    // Into a wall or up a step taller than a kerb (the pad's 2,5 m retaining faces): slide
    // along it rather than stopping dead, the way a walker follows a fence.
    if (!this._canStep(p.x, p.z, nx, nz)) {
      if (this._canStep(p.x, p.z, nx, p.z)) { nz = p.z; this.velocity.z = 0; }
      else if (this._canStep(p.x, p.z, p.x, nz)) { nx = p.x; this.velocity.x = 0; }
      else { nx = p.x; nz = p.z; this.velocity.set(0, 0, 0); }
    }
    p.x = nx; p.z = nz;
    const want = this.groundAt(p.x, p.z) + this.eyeHeight;
    // Stepping down is quick and stepping up quicker, so the eye never goes under the ground.
    p.y = want > p.y ? want : p.y + (want - p.y) * (1 - Math.exp(-dt * 10));
  }

  _travel(dt) {
    const tr = this.travel, cam = this.camera, p = cam.position;
    // Eased: a quarter of a second to get going and to stop, at the travelling pace between.
    const remain = tr.len - tr.s;
    const v = tr.speed * Math.min(1, (tr.s + 0.5) / 6, (remain + 0.3) / 6);
    tr.s = Math.min(tr.len, tr.s + Math.max(0.4, v) * dt);
    let s = tr.s, i = 1;
    while (i < tr.pts.length - 1 && s > tr.pts[i].distanceTo(tr.pts[i - 1])) { s -= tr.pts[i].distanceTo(tr.pts[i - 1]); i++; }
    const a = tr.pts[i - 1], b = tr.pts[i], seg = Math.max(1e-6, a.distanceTo(b)), k = Math.min(1, s / seg);
    p.x = a.x + (b.x - a.x) * k; p.z = a.y + (b.y - a.y) * k;
    p.y = this.groundAt(p.x, p.z) + this.eyeHeight;
    // Look where the path goes, and over the last stretch turn to what was clicked.
    const dx = b.x - a.x, dz = b.y - a.y;
    const pathYaw = Math.atan2(-dx, -dz);
    let yaw = pathYaw, pitch = 0;
    if (tr.look) {
      const lx = tr.look.x - p.x, lz = tr.look.z - p.z, lh = Math.hypot(lx, lz);
      const lookYaw = Math.atan2(-lx, -lz), lookPitch = Math.atan2(tr.look.y - p.y, Math.max(lh, 0.5));
      const w = THREE.MathUtils.smoothstep(tr.s / tr.len, 0.55, 1);
      const dyaw = Math.atan2(Math.sin(lookYaw - pathYaw), Math.cos(lookYaw - pathYaw));
      yaw = pathYaw + dyaw * w; pitch = THREE.MathUtils.clamp(lookPitch, -0.6, 1.2) * w;
    }
    const f = 1 - Math.exp(-dt * 6);
    this.look.yaw += Math.atan2(Math.sin(yaw - this.look.yaw), Math.cos(yaw - this.look.yaw)) * f;
    this.look.pitch += (pitch - this.look.pitch) * f;
    cam.rotation.set(this.look.pitch, this.look.yaw, 0, 'YXZ');
    this.velocity.set(0, 0, 0);
    if (tr.s >= tr.len) this.travel = null;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    if (this.transition) { this.transition.resolve(); this.transition = null; }
    // The pointer and wheel handlers were never removed, so a disposed rig kept steering.
    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    this.dom.removeEventListener('pointerup', this._onPointerUp);
    this.dom.removeEventListener('pointermove', this._onPointerMove);
    this.dom.removeEventListener('wheel', this._onWheel);
    this.orbit.dispose();
  }
}
