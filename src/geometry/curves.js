/**
 * Monotone cubic interpolation, pure (no three.js): moved out of geometry/utils.js on 9-11-2026 so
 * the trajectory model can use it without the geometry library (external audit 8-11, finding 14).
 * utils.js re-exports both.
 */
/** Tangents for a monotone cubic through (xs, ys). */
export function monotoneSlopes(xs, ys) {
  const n = xs.length, d = new Array(n - 1), m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = Math.hypot(a, b);
    if (h > 3) { m[i] = (3 / h) * a * d[i]; m[i + 1] = (3 / h) * b * d[i]; }
  }
  return m;
}

/** Evaluates the cubic Hermite through (xs, ys) with tangents ms, clamped outside the range. */
export function hermite(xs, ys, ms, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * ms[i]
    + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * ms[i + 1];
}
