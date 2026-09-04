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
    this.orbit.maxDistance = 1200;
    this.minHeight = 0.35;   // apron clearance, enforced through maxPolarAngle each frame
    this.orbit.zoomSpeed = 0.9;
    this.orbit.rotateSpeed = 0.7;
    this.orbit.screenSpacePanning = true;

    this.keys = new Set();
    this.look = { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 };
    this.flySpeed = 14;      // m/s base
    this.velocity = new THREE.Vector3();
    this.transition = null;
    this.onModeChange = null;
    // While something else is driving the camera (the launch sequence), the rig steps aside
    // completely. The first pointer or wheel input hands control straight back, so a viewer
    // is never locked out of a shot they want to leave.
    this.external = false;
    this.onExternalRelease = null;

    this._onKeyDown = (e) => { if (e.target.tagName === 'INPUT') return; this.keys.add(e.code); };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onPointerDown = (e) => { this.releaseExternal(); if (this.mode !== 'fly') return; this.look.dragging = true; this.look.lastX = e.clientX; this.look.lastY = e.clientY; dom.setPointerCapture?.(e.pointerId); };
    this._onPointerUp = () => { this.look.dragging = false; };
    this._onPointerMove = (e) => {
      if (this.mode !== 'fly' || !this.look.dragging) return;
      const dx = e.clientX - this.look.lastX, dy = e.clientY - this.look.lastY;
      this.look.lastX = e.clientX; this.look.lastY = e.clientY;
      this.look.yaw -= dx * 0.0022;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 0.0022, -1.45, 1.45);
    };
    this._onWheel = (e) => {
      this.releaseExternal();
      if (this.mode !== 'fly') return;
      this.flySpeed = THREE.MathUtils.clamp(this.flySpeed * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 200);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    dom.addEventListener('pointerdown', this._onPointerDown);
    dom.addEventListener('pointerup', this._onPointerUp);
    dom.addEventListener('pointermove', this._onPointerMove);
    dom.addEventListener('wheel', this._onWheel, { passive: true });
  }

  get target() { return this.orbit.target; }
  get distance() { return this.camera.position.distanceTo(this.orbit.target); }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'fly') {
      if (this.transition) { this.transition.resolve(); this.transition = null; }
      this.orbit.enabled = false;
      // derive yaw/pitch from the current view direction
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.look.yaw = Math.atan2(-dir.x, -dir.z);
      this.look.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    } else {
      // keep the orbit target ahead of the camera
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const d = Math.max(this.distance, 5);
      this.orbit.target.copy(this.camera.position).addScaledVector(dir, Math.min(d, 60));
      this.orbit.enabled = true;
      this.applyPolarLimit();
      this.orbit.update();
    }
    this.onModeChange?.(mode);
  }

  flyTo(position, target, duration = 1.7) {
    // prefers-reduced-motion only killed CSS transitions; a 1,7 s camera sweep across a 300 m
    // scene is the strongest motion the page produces, so honour the setting here too.
    if (REDUCED_MOTION?.matches) { this.jumpTo(position, target); return Promise.resolve(); }
    const from = this.camera.position.clone();
    const fromT = this.orbit.target.clone();
    const to = new THREE.Vector3(...position);
    const toT = new THREE.Vector3(...target);
    if (this.mode === 'fly') this.setMode('orbit');
    return new Promise((resolve) => {
      this.transition = { from, fromT, to, toT, start: performance.now(), duration, resolve };
    });
  }

  jumpTo(position, target) {
    this.transition = null;
    if (this.mode === 'fly') this.setMode('orbit');
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

  /** Hands the camera back to the viewer, from wherever the scripted shot had left it. */
  releaseExternal() {
    if (!this.external) return;
    this.external = false;
    this.orbit.enabled = true;
    this.applyPolarLimit();
    this.orbit.update();
    this.onExternalRelease?.();
  }

  update(dt) {
    if (this.external) { this.orbit.enabled = false; return; }
    if (this.transition) {
      const tr = this.transition;
      const t = (performance.now() - tr.start) / (tr.duration * 1000);
      const k = easeInOut(Math.min(t, 1));
      this.camera.position.lerpVectors(tr.from, tr.to, k);
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

    // ---- free-fly ----
    const cam = this.camera;
    cam.rotation.set(this.look.pitch, this.look.yaw, 0, 'YXZ');
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    const wish = new THREE.Vector3();
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
    if (cam.position.y < 0.4) cam.position.y = 0.4;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    // The pointer and wheel handlers were never removed, so a disposed rig kept steering.
    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    this.dom.removeEventListener('pointerup', this._onPointerUp);
    this.dom.removeEventListener('pointermove', this._onPointerMove);
    this.dom.removeEventListener('wheel', this._onWheel);
    this.orbit.dispose();
  }
}
