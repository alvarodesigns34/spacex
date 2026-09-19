/**
 * Distance-driven detail, for the whole centre rather than one heat shield.
 *
 * The scene is 1:1, so the same object is legitimately looked at from 300 m and from 2 m, and
 * the right amount of geometry for one is the wrong amount for the other. The existing rule
 * was written for Starship's tiles — 13,500 hexagons that stop resolving past a couple of
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
 */
import * as THREE from 'three';

export class LODManager {
  /**
   * @param camera the rendering camera
   * @param pixels how few pixels a feature may occupy before it stops being drawn; comes from
   *               the quality tier, so a weak device sheds detail sooner
   */
  constructor(camera, { pixels = 3.5 } = {}) {
    this.camera = camera;
    this.pixels = pixels;
    this.entries = [];
    this._c = new THREE.Vector3();
    this._box = new THREE.Box3();
  }

  /**
   * @param spec.at       () => THREE.Vector3-like, where the thing is right now (a flying
   *                      vehicle is not where its exhibit stands)
   * @param spec.feature  metres; the size of the detail this entry exists to draw
   * @param spec.near     objects visible only when the detail resolves
   * @param spec.far      an optional stand-in shown when it does not
   * @param spec.bias     multiplies the threshold for this entry; > 1 sheds sooner
   */
  register(spec) {
    const e = {
      at: spec.at, feature: spec.feature ?? 0.26,
      near: spec.near ?? [], far: spec.far ?? null,
      bias: spec.bias ?? 1,
      name: spec.name ?? '(lod)',
      // Tracked explicitly rather than inferred from visibility: inferring it silently
      // no-ops on the first evaluation, when both halves are still visible.
      state: null,
    };
    this.entries.push(e);
    return e;
  }

  /** Convenience for a whole group that simply stops being drawn when it is too small. */
  registerHidden(name, objects, at, feature, bias = 1) {
    return this.register({ name, at, feature, near: objects, far: null, bias });
  }

  /** How many pixels `feature` metres occupies at `point`, for the current camera. */
  pixelsAt(point, feature) {
    const mpp = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / window.innerHeight;
    const d = this.camera.position.distanceTo(point);
    return d > 1e-6 ? feature / (d * mpp) : Infinity;
  }

  /** Re-evaluates every entry. Cheap: one distance and one compare each, no allocation. */
  update() {
    const mpp = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / window.innerHeight;
    for (const e of this.entries) {
      const p = e.at(this._c) ?? this._c;
      const d = this.camera.position.distanceTo(p);
      const px = d > 1e-6 ? e.feature / (d * mpp) : Infinity;
      const detailed = px > this.pixels * e.bias;
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
    return this.entries.map(e => ({ name: e.name, detailed: e.state }));
  }
}
