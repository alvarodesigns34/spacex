/**
 * Adaptive quality for the expensive effects, from the frame times actually observed.
 *
 * quality.js picks a tier once, from what the device says it is. A tier can still be too much for
 * one view (a full sky of cumulus over a weak GPU) and too little for another. This adjusts, live,
 * only the effects whose cost is a knob that changes nothing but their own fineness — today the
 * cumulus' samples per ray (clouds.js, a uniform: no recompile). Never geometry, never the level of
 * detail near the camera, never the tier itself: a hard scene lowers the clouds a notch, not the
 * whole centre.
 *
 * Rules, so it does not hunt:
 *  - The measure is the 95th percentile of the last `window` frame intervals, not the mean: what
 *    the eye sees as stutter is the slow frames.
 *  - Down one level when that p95 has stayed over budget × 1.2 for `downAfter` seconds. A single
 *    spike (a shader compiling, a texture uploading) does not last that long.
 *  - Up one level only after `upAfter` seconds well under budget (p95 < budget × 0.8). With vsync a
 *    frame cannot report its headroom, so going up is a trial: if it brings the slow frames back,
 *    the next try waits twice as long (up to `upMax`), so it settles instead of oscillating.
 *  - Intervals over 250 ms are not frames (a background tab, a stall, a dialog) and are ignored.
 *
 * Pure: time is passed in, so tools/adaptive-check.mjs drives it with made-up frame sequences.
 */
export function createAdaptive({ levels, start = 0, budgetMs = 1000 / 55, window = 90, downAfter = 3, upAfter = 12, upMax = 300 } = {}) {
  const buf = new Float64Array(window);
  let n = 0, head = 0, level = Math.min(Math.max(start, 0), levels.length - 1);
  let overSince = null, underSince = null, upWait = upAfter, lastUp = -Infinity;

  function p95() {
    if (n < Math.min(window, 20)) return null;
    const a = Array.from(buf.subarray(0, n)).sort((x, y) => x - y);
    return a[Math.min(n - 1, Math.floor(n * 0.95))];
  }

  return {
    get level() { return level; },
    get value() { return levels[level]; },
    get state() { return { level, value: levels[level], p95: p95(), upWait }; },
    /**
     * One frame interval, ms, at time `now`, s. Returns true when the level changed (the caller
     * applies `value`).
     */
    sample(dtMs, now) {
      if (!(dtMs > 0) || dtMs > 250) return false;
      buf[head] = dtMs; head = (head + 1) % window; n = Math.min(n + 1, window);
      const p = p95();
      if (p === null) return false;
      if (p > budgetMs * 1.2) {
        underSince = null;
        overSince ??= now;
        if (now - overSince >= downAfter && level < levels.length - 1) {
          // A step up that brought the slow frames straight back: wait longer before the next.
          if (now - lastUp < upWait + downAfter * 2) upWait = Math.min(upMax, upWait * 2);
          level++; overSince = null; n = 0; head = 0;
          return true;
        }
      } else if (p < budgetMs * 0.8) {
        overSince = null;
        underSince ??= now;
        if (now - underSince >= upWait && level > 0) {
          level--; underSince = null; lastUp = now; n = 0; head = 0;
          return true;
        }
      } else {
        overSince = null; underSince = null;
      }
      return false;
    },
  };
}
