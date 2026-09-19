/**
 * What the centre is currently showing, as one object with one set of rules.
 *
 * WHY THIS EXISTS
 *
 * Three things can drive the camera — the visitor, the guided tour and the launch sequence —
 * and four more things depend on which of them is driving: which exhibit is selected, which
 * view of it, whether the Roadster is on its plinth or in orbit, and whether the museum
 * furniture (callouts, rulers, scale figures) is showing at all.
 *
 * That was seven loose variables in main.js, each written from several places, and every
 * expensive bug in this project's history came out of the gaps between them: three visitors
 * planted at NaN because a layout branch read a radius that exhibit did not have; the tour's
 * timer re-framing the scene underneath a launch that owned the camera; the atmosphere left
 * in a night state with daytime fog because two functions wrote the same uniforms in whatever
 * order they were called; the preset tabs showing one view while the camera flew to another.
 *
 * None of those were hard to fix once found. All of them were invisible until someone looked.
 * So the state lives here instead, as a small machine with explicit transitions:
 *
 *   owner      'user' | 'tour' | 'launch'   — who is allowed to move the camera
 *   exhibit    id | null                    — null is the overview
 *   preset     id | null
 *   flying     boolean                      — the vehicle has left its mount
 *   toggles    { labels, ruler, humans }
 *
 * and three derived facts nothing else is allowed to compute for itself:
 *
 *   orbital    the Roadster is being shown as a payload, not as a museum piece
 *   site       this view belongs to the launch complex, not to the vehicle
 *   furniture  callouts, rulers and figures belong on screen
 *
 * Every transition goes through one of the methods below, each of which enforces the
 * invariants and then tells its subscribers once. Nothing reads the fields and acts on a
 * stale copy; nothing writes half a transition.
 */

/** The Roadster preset that swaps the museum for orbit. */
export const ORBITAL_VIEW = 'earth';

/**
 * Presets whose callouts read at close range only. Nine captions on a 3.9 m car at once
 * hides the car behind its own labels, which is what the overview shot was doing.
 */
export const NEAR_VIEWS = new Set(['starman', 'dontpanic', 'detail', 'selfie']);

export class ViewState {
  /**
   * @param {object} opts
   * @param {(p: object) => boolean} opts.isSiteView  does this {exhibit, preset} frame the pad?
   * @param {(id: string, preset: string) => string} opts.resolvePreset
   *        maps a requested preset to one the exhibit actually has, so a typo or a stale
   *        deep link cannot put the machine into a view that does not exist.
   */
  constructor({ isSiteView = () => false, resolvePreset = (_, p) => p } = {}) {
    this._isSiteView = isSiteView;
    this._resolvePreset = resolvePreset;
    this.owner = 'user';
    this.exhibit = null;
    this.preset = null;
    this.flying = false;
    this.toggles = { labels: true, ruler: true, humans: true };
    this._subs = [];
    this._depth = 0;
    this._dirty = false;
  }

  /** Called after every settled transition, with `this`. */
  subscribe(fn) { this._subs.push(fn); return () => { this._subs = this._subs.filter(f => f !== fn); }; }

  /**
   * Runs `fn` as one transition: subscribers see the finished state once, not each
   * intermediate step. Nested batches collapse into the outermost one.
   */
  _batch(fn) {
    this._depth++;
    try { fn(); } finally {
      this._depth--;
      if (this._depth === 0 && this._dirty) { this._dirty = false; for (const s of this._subs) s(this); }
    }
  }

  _changed() { if (this._depth === 0) { for (const s of this._subs) s(this); } else { this._dirty = true; } }

  // ---- Derived facts ---------------------------------------------------------------------

  /** The Roadster as a payload against Earth rather than a car on a plinth. */
  get orbital() { return this.exhibit === 'roadster' && this.preset === ORBITAL_VIEW && !this.flying; }

  /** This view is authored in the launch complex's frame, so the pad's callouts belong to it. */
  get site() { return this._isSiteView(this); }

  /** Museum furniture belongs on screen: not mid-flight, and not out in orbit. */
  get furniture() { return !this.flying && !this.orbital; }

  /** Close-range callouts are showing. */
  get near() { return NEAR_VIEWS.has(this.preset); }

  // ---- Transitions -----------------------------------------------------------------------

  /**
   * Hands the camera to `owner`. Returns what the caller must now stop, rather than reaching
   * into the tour and the launch from here: this module knows the rules, not the machinery.
   *
   * The visitor claiming the camera ends both automatic drivers. It does NOT end the launch
   * when the claim comes from dragging or scrolling — that courtesy belongs to
   * CameraRig.external and is deliberate, so it never reaches this method.
   */
  claim(owner) {
    const stop = { tour: this.owner === 'tour' && owner !== 'tour', launch: this.owner === 'launch' && owner !== 'launch' };
    this.owner = owner;
    return stop;
  }

  /** Selects an exhibit (or the overview, with `null`) at its opening view. */
  select(id, owner = 'user') {
    const stop = this.claim(owner);
    this._batch(() => {
      this.exhibit = id;
      this.preset = id ? this._resolvePreset(id, 'overview') : null;
      this._changed();
    });
    return stop;
  }

  /** Moves to another view of an exhibit, selecting it if it was not already selected. */
  goPreset(id, preset, owner = 'user') {
    const stop = this.claim(owner);
    this._batch(() => {
      this.exhibit = id;
      this.preset = this._resolvePreset(id, preset);
      this._changed();
    });
    return stop;
  }

  /** The vehicle has left (or returned to) its mount. */
  setFlying(on) {
    if (this.flying === !!on) return;
    this.flying = !!on;
    this._changed();
  }

  setToggle(name, value) {
    if (!(name in this.toggles) || this.toggles[name] === !!value) return;
    this.toggles[name] = !!value;
    this._changed();
  }

  /** A plain snapshot, for the headless gate and for debugging. */
  snapshot() {
    return {
      owner: this.owner, exhibit: this.exhibit, preset: this.preset, flying: this.flying,
      orbital: this.orbital, site: this.site, furniture: this.furniture,
      toggles: { ...this.toggles },
    };
  }
}
