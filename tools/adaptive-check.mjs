#!/usr/bin/env node
// The adaptive quality controller (src/core/adaptive.js), headless: driven with made-up frame-time
// sequences, it must step down under sustained load, ignore isolated spikes and stalls, step back
// up when there is room, and settle instead of oscillating when going up brings the load back.
// Exit code 1 on a failure.
const { createAdaptive } = await import('../src/core/adaptive.js');

let failed = 0;
const report = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`); };
const LEVELS = [32, 24, 16, 10];

/** Runs `seconds` of frames whose interval (ms) is f(t, level); returns the level changes. */
function run(a, seconds, f, t0 = 0) {
  const changes = [];
  let t = t0;
  while (t < t0 + seconds) {
    const dt = f(t, a.level);
    t += dt / 1000;
    if (a.sample(dt, t)) changes.push({ t: +t.toFixed(2), level: a.level });
  }
  return { changes, t };
}

{
  const a = createAdaptive({ levels: LEVELS });
  const r = run(a, 60, () => 16.7);
  report(r.changes.length === 0 && a.level === 0, 'a steady 60 fps changes nothing', JSON.stringify(r.changes));
}
{
  const a = createAdaptive({ levels: LEVELS });
  // A 200 ms hitch every 5 s (a shader compiling): the p95 of 90 frames moves, but not for 3 s.
  const r = run(a, 60, (t) => ((t % 5) < 0.02 ? 200 : 16.7));
  report(r.changes.length === 0, 'isolated spikes do not lower anything', JSON.stringify(r.changes));
}
{
  const a = createAdaptive({ levels: LEVELS });
  const r = run(a, 30, () => 600);
  report(r.changes.length === 0, 'stalls over 250 ms (a background tab) are not frames', JSON.stringify(r.changes));
}
{
  const a = createAdaptive({ levels: LEVELS });
  // Cost proportional to the level's samples: 32 → 30 ms, 24 → 24, 16 → 18, 10 → 13.5.
  const cost = (lv) => 6 + LEVELS[lv] * 0.75;
  const r = run(a, 40, (t, lv) => cost(lv));
  report(a.level > 0 && cost(a.level) <= 1000 / 55 * 1.2, 'sustained load steps down until the frames fit', `${JSON.stringify(r.changes)} → ${LEVELS[a.level]} samples, ${cost(a.level)} ms`);
  report(r.changes.every((c, i) => i === 0 || c.t - r.changes[i - 1].t >= 3), 'at most one step per 3 s', JSON.stringify(r.changes));
}
{
  const a = createAdaptive({ levels: LEVELS });
  run(a, 20, () => 40);                                  // heavy scene: down to the bottom
  const low = a.level;
  const r = run(a, 60, () => 10, 20);                    // light again: back up
  report(low === LEVELS.length - 1 && a.level === 0, 'steps back up when the frames have room', `${low} → ${a.level}, ${JSON.stringify(r.changes)}`);
}
{
  const a = createAdaptive({ levels: LEVELS });
  // At level 0 the frame is over budget, at level 1 comfortably under: the trap where a naive
  // controller goes up and down every few seconds for ever.
  const r = run(a, 600, (t, lv) => (lv === 0 ? 26 : 12));
  const upT = r.changes.filter((c, i) => i > 0 && c.level < r.changes[i - 1].level).map(c => c.t);
  const gaps = upT.slice(1).map((t, i) => t - upT[i]);
  report(upT.length <= 5 && gaps.length >= 2 && gaps.at(-1) >= 3 * gaps[0], 'settles: each failed step up waits twice as long (≤ 5 trials in 10 min, gaps growing)',
    `${r.changes.length} changes, steps up at ${upT.map(t => t.toFixed(0)).join(', ')} s, wait now ${a.state.upWait} s`);
}
{
  const a = createAdaptive({ levels: LEVELS, start: 1 });
  report(a.value === 24, 'starts where it is told');
}
if (failed) { console.error(`${failed} comprobación(es) fallida(s)`); process.exit(1); }
