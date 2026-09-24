/**
 * Distance-driven detail, for the whole centre rather than one heat shield.
 *
 * The scene is 1:1, so the same object is legitimately looked at from 300 m and from 2 m, and
 * the right amount of geometry for one is the wrong amount for the other. The existing rule
 * was written for Starship's tiles — 13,132 hexagons that stop resolving past a couple of
 * pixels each and past that only add sparkle — and it works, but it was the only one, so
 * every other vehicle carried all of its detail at every distance: a 247-mesh Roadster with a
 * stitched interior and a Hot Wheels car on the dash, drawn in full while it was eight pixels
 * tall in the overview.
 *
 * WHAT THIS IS NOT. It is not a mesh simplifier and it does not build alternate models. It
 * asks one question per registered entry — how big is this thing on screen right now? — and
 * uses the answer to switch between states the builders already produced, or simply to stop
 * drawing detail nobody can see. That keeps every close view exactly as it is.
 *
 * Two kinds of entry:
 *
 *   swap   { near: [objects], far: object }  — the pair Starship's shield already publishes
 *   hide   { objects, feature }              — detail that vanishes below a pixel threshold
 *
 * `feature` is the real-world size of the smallest thing the entry is drawing, in metres, so
 * the threshold means the same thing everywhere: "drop this when its detail is smaller than
 * N pixels". A 0.26 m tile and a 0.02 m panel gap then behave consistently without either
 * carrying a hand-tuned distance.
 *
 * TWO THINGS THE FIRST VERSION GOT WRONG, both of which this fixes.
 *
 * DISTANCE WAS MEASURED TO ONE POINT PER VEHICLE — the middle of its hull. On a 3.9 m car
 * that is a rounding error. On a 124 m Starship it is the whole problem: standing two metres
 * from the Raptors puts the camera 60 m from the anchor, so every entry on that vehicle was
 * told its detail was thirty times smaller than it is, and the engine bay shed detail while
 * being stared at from arm's length. Each entry carries its own bounds now and the distance
 * is to the nearest point of them, which is the distance the eye is actually judging.
 *
 * AND THE SWITCH HAD ONE THRESHOLD, so a camera resting near it flipped state on the noise in
 * its own position: detail appearing and vanishing several times a second. Entering and
 * leaving are separate thresholds now, far enough apart that no realistic drift crosses both.
 */
import * as THREE from 'three';

/**
 * Hide-only entries are held to a lower threshold than swaps. A swap trades one drawing for
 * another (tiles for a shell), and doing it early costs nothing the eye can tell. Hiding
 * removes something, and what a builder registers is its THINNEST dimension: a 2 cm seam or
 * a 3 cm frame rail metres long. A line one pixel wide is still plainly a line, so at the
 * swap threshold (3.5 px) every vehicle lost its seams, frames, hinges and fittings in its
 * own overview — Starlink 17 of 18, Falcon 9 all 10. They now stay until about a pixel.
 */
const HIDE_FACTOR = 0.3;

export class LODManager {
  /**
   * @param camera the rendering camera
   * @param pixels how few pixels a feature may occupy before it stops being drawn; comes from
   *               the quality tier, so a weak device sheds detail sooner
   * @param hysteresis how much smaller a feature must get to be dropped than it had to be to
   *               be picked up, as a fraction. 0.3 means detail appears at `pixels` and does
   *               not disappear until it has shrunk to 0.7 × `pixels`.
   */
  constructor(camera, { pixels = 3.5, hysteresis = 0.3 } = {}) {
    this.camera = camera;
    this.pixels = pixels;
    this.hysteresis = hysteresis;
    this.entries = [];
    this._names = new Map();
    this._c = new THREE.Vector3();
    this._box = new THREE.Box3();
    this._p = new THREE.Vector3();
  }

  /**
   * @param spec.at       () => THREE.Vector3-like, where the thing is right now (a flying
   *                      vehicle is not where its exhibit stands). Used when no bounds are
   *                      given, and as the fallback when bounds cannot be computed.
   * @param spec.bounds   optional Object3D whose world bounding box measures this entry's
   *                      distance. Prefer it: it is what makes a subsystem of a 124 m vehicle
   *                      judged on its own size rather than on its parent's midpoint.
   * @param spec.feature  metres; the size of the detail this entry exists to draw
   * @param spec.near     objects visible only when the detail resolves
   * @param spec.far      an optional stand-in shown when it does not
   * @param spec.bias     multiplies the threshold for this entry; > 1 sheds sooner
   */
  register(spec) {
    // Repeated hardware (four legs, three Falcon cores, several tank rings) may share a
    // scene name. Diagnostics and pin() need an unambiguous entry, not the first sibling.
    const baseName = spec.name ?? '(lod)';
    let name = baseName, suffix = 2;
    while (this.entries.some(entry => entry.name === name)) name = `${baseName}#${suffix++}`;
    const e = {
      at: spec.at, bounds: spec.bounds ?? null,
      feature: spec.feature ?? 0.26,
      near: spec.near ?? [], far: spec.far ?? null,
      bias: spec.bias ?? 1,
      name,
      // Tracked explicitly rather than inferred from visibility: inferring it silently
      // no-ops on the first evaluation, when both halves are still visible.
      state: null,
      px: 0,
      // The bounds are measured once, in the LOCAL frame of the object that carries them, and
      // re-projected through its live world matrix each update. Calling setFromObject every
      // frame on a group of ninety meshes would cost more than the draw calls it saves; a
      // local box plus a matrix is eight points.
      local: null, holder: null,
    };
    if (e.bounds) {
      e.bounds.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(e.bounds.matrixWorld).invert();
      const b = new THREE.Box3().setFromObject(e.bounds);
      if (!b.isEmpty()) { e.local = b.applyMatrix4(inv); e.holder = e.bounds; }
    }
    // Names have to be unique, because they are how an entry is addressed: `pin` looks one up
    // and `snapshot` is read back by name. They were not — a Falcon Heavy carries twelve leg
    // latches and the Roadster two headlight bowls, each registered separately and all sharing
    // the mesh's name. Twelve series under one label read as one entry changing state twelve
    // times, which is indistinguishable from flicker, and the continuous sweep duly reported
    // flicker on every part that is repeated.
    if (this._names.has(e.name)) {
      const n = this._names.get(e.name) + 1;
      this._names.set(e.name, n);
      e.name = `${e.name}#${n}`;
    } else {
      this._names.set(e.name, 1);
    }
    this.entries.push(e);
    return e;
  }

  /**
   * Convenience for a whole group or mesh that simply stops being drawn when it is too
   * small. Works on Groups as well as Meshes: an Object3D with visible = false skips its
   * whole subtree, so one flag can retire a 90-mesh interior.
   */
  registerHidden(name, objects, at, feature, bias = 1, bounds = null) {
    return this.register({ name, at, feature, near: objects, far: null, bias, bounds });
  }

  /** Metres per pixel at unit distance, for the current camera and viewport. */
  _mpp() {
    return (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / window.innerHeight;
  }

  /** How many pixels `feature` metres occupies at `point`, for the current camera. */
  pixelsAt(point, feature) {
    const d = this.camera.position.distanceTo(point);
    return d > 1e-6 ? feature / (d * this._mpp()) : Infinity;
  }

  /**
   * Distance from the camera to the nearest point of this entry — its own bounds when it has
   * them, its anchor otherwise.
   *
   * `clampPoint` against the box is what makes a close-up of one end of a long object read as
   * close: the camera at the engines is 2 m from the engine bay's box and 60 m from the middle
   * of the hull, and only the first of those is the number the eye is using.
   */
  _distance(e) {
    if (e.local && e.holder) {
      this._box.copy(e.local).applyMatrix4(e.holder.matrixWorld);
      if (!this._box.isEmpty()) {
        this._box.clampPoint(this.camera.position, this._p);
        return this.camera.position.distanceTo(this._p);
      }
    }
    const p = e.at ? (e.at(this._c) ?? this._c) : this._c;
    return this.camera.position.distanceTo(p);
  }

  /**
   * Holds one entry in a state regardless of distance, or releases it with `null`.
   *
   * For comparing the two states of a swap from the SAME camera, which is the only way to see
   * whether a switch is visible: forcing `visible` by hand does not work, because the frame
   * loop re-evaluates every entry and puts it straight back.
   */
  pin(name, state = null) {
    const e = this.entries.find(x => x.name === name);
    if (!e) return false;
    e.pinned = state;
    if (state !== null) {
      e.state = state;
      for (const o of e.near) o.visible = state;
      if (e.far) e.far.visible = !state;
    }
    return true;
  }

  /** Re-evaluates every entry. One box transform and one compare each, no allocation. */
  update() {
    const mpp = this._mpp();
    for (const e of this.entries) {
      if (e.pinned !== null && e.pinned !== undefined) continue;
      const d = this._distance(e);
      const px = d > 1e-6 ? e.feature / (d * mpp) : Infinity;
      e.px = px;
      const enter = this.pixels * (e.far ? 1 : HIDE_FACTOR) * e.bias;
      const leave = enter * (1 - this.hysteresis);
      // Between the two thresholds, whatever it is showing is what it keeps showing. That band
      // is the whole point: a camera parked near the switch drifts by centimetres every frame,
      // and with one threshold that drift was enough to make the detail blink.
      const detailed = e.state === null ? px > enter
        : (e.state ? px > leave : px > enter);
      if (e.state === detailed) continue;
      e.state = detailed;
      for (const o of e.near) o.visible = detailed;
      if (e.far) e.far.visible = !detailed;
    }
  }

  /**
   * Forces every entry to its detailed state and stops tracking. Used before measuring: the
   * dimensional gate has to see the geometry the builders produced, not whichever half of it
   * the camera happened to be close enough for.
   */
  forceDetailed() {
    for (const e of this.entries) {
      e.state = true;
      for (const o of e.near) o.visible = true;
      if (e.far) e.far.visible = false;
    }
  }

  /** What each entry is currently showing, for the gate. */
  snapshot() {
    return this.entries.map(e => {
      const enter = this.pixels * (e.far ? 1 : HIDE_FACTOR), leave = enter * (1 - this.hysteresis);
      return {
      name: e.name, detailed: e.state,
      px: +e.px.toFixed(2), feature: e.feature,
      enter: +(enter * e.bias).toFixed(2), leave: +(leave * e.bias).toFixed(2),
      bounded: !!e.local,
      };
    });
  }
}
