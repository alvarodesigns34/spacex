/**
 * Where a frame's GPU time goes, measured on the machine that runs it (?gpu, ?gpu=objects).
 *
 * Frame rate and draw calls say that a frame is slow, not why. This splits every frame into
 * consecutive segments, each timed by a GPU timer query (EXT_disjoint_timer_query_webgl2):
 *
 *   · the sun's shadow map (renderer.shadowMap.render),
 *   · each pass of the composer (the scene, AO, sea reflections, still AA, bloom, output),
 *   · with ?gpu=objects, inside the scene pass: each top-level group of the scene (the sky, the
 *     clouds, the sea, the terrain, each exhibit…), switched at the draws that change group.
 *
 * TIME_ELAPSED queries cannot nest, so the segments never overlap: one ends where the next begins,
 * and their sum is the frame's GPU time. Results arrive a few frames late; they are pooled and
 * averaged over a rolling window. The queries themselves cost a little (thousands per frame with
 * ?gpu=objects): read the per-object split for proportions, the plain ?gpu for totals.
 *
 * Without the extension (some browsers, privacy settings) it reports `supported: false` and only
 * the CPU side. Diagnostic only: nothing in the scene depends on it.
 */

const WINDOW = 120;

export function createGpuProfiler(renderer, scene, { objects = false } = {}) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const free = [];
  const pending = [];              // { q, label, frame }
  const sums = new Map();          // label → rolling array of ms per frame
  const cur = new Map();           // label → ms in the frame being assembled
  const frameGpu = [], frameCpu = [];
  let active = null, label = 'other', frameId = 0, cpu0 = 0;
  const open = new Map();          // frame id → { left: queries pending, parts: Map }
  let disjoint = 0;

  function begin(name) {
    if (!ext) return;
    if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; }
    label = name;
    const q = free.pop() ?? gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    active = { q, label: name, frame: frameId };
    const f = open.get(frameId); if (f) f.left++;
  }

  function collect() {
    if (!ext) return;
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      // The timings in flight are unreliable: drop them all.
      disjoint++;
      for (const p of pending) free.push(p.q);
      pending.length = 0; open.clear();
      return;
    }
    let i = 0;
    for (; i < pending.length; i++) {
      const p = pending[i];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ms = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
      free.push(p.q);
      const f = open.get(p.frame);
      if (!f) continue;
      f.parts.set(p.label, (f.parts.get(p.label) ?? 0) + ms);
      if (--f.left === 0 && f.closed) finish(p.frame, f);
    }
    pending.splice(0, i);
  }

  function finish(id, f) {
    open.delete(id);
    let total = 0;
    for (const [k, v] of f.parts) {
      total += v;
      let a = sums.get(k); if (!a) sums.set(k, a = []);
      a.push(v); if (a.length > WINDOW) a.shift();
    }
    // Labels absent this frame count as zero (a shadow redrawn one frame in ten averages to a tenth).
    for (const [k, a] of sums) if (!f.parts.has(k)) { a.push(0); if (a.length > WINDOW) a.shift(); }
    frameGpu.push(total); if (frameGpu.length > WINDOW) frameGpu.shift();
  }

  // --- hooks ---
  if (ext) {
    const sm = renderer.shadowMap, smRender = sm.render.bind(sm);
    sm.render = (...a) => { const back = label; begin('shadow map'); try { smRender(...a); } finally { begin(back); } };
  }
  /** Wraps every pass of a composer, named by pass.name or its class. */
  function watchComposer(composer) {
    if (!ext) return;
    for (const pass of composer.passes) {
      if (pass.__gpuWrapped) continue;
      pass.__gpuWrapped = true;
      const name = pass.name || pass.constructor.name.replace(/Pass$/, '') || 'pass';
      const r = pass.render.bind(pass);
      pass.render = (...a) => { begin(name === 'Render' ? 'scene' : name); try { r(...a); } finally { begin('other'); } };
    }
  }
  /** Per top-level group inside the scene pass: onBeforeRender marks the change of group. */
  function watchObjects() {
    if (!ext || !objects) return;
    const tag = (o, group) => {
      if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && !o.__gpuTag) {
        o.__gpuTag = group;
        const prev = o.onBeforeRender;
        o.onBeforeRender = function (...a) {
          // Only inside the scene pass (and its sub-labels), not in the shadow map, probes or AO.
          if (label.startsWith('scene') && label !== `scene · ${group}`) begin(`scene · ${group}`);
          return prev.apply(this, a);
        };
      }
      for (const c of o.children) tag(c, group);
    };
    for (const top of scene.children) tag(top, top.name || top.type);
  }

  return {
    supported: !!ext,
    watchComposer,
    watchObjects,
    /** Starts a segment of its own (until the next one), for work outside the composer. */
    mark(name) { begin(name); },
    frameStart() {
      cpu0 = performance.now();
      if (!ext) return;
      collect();
      frameId++;
      open.set(frameId, { left: 0, parts: new Map(), closed: false });
      begin('other');
    },
    frameEnd() {
      frameCpu.push(performance.now() - cpu0); if (frameCpu.length > WINDOW) frameCpu.shift();
      if (!ext) return;
      if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; }
      const f = open.get(frameId); if (f) { f.closed = true; if (f.left === 0) finish(frameId, f); }
      // Unbounded growth guard: a frame whose queries never resolve.
      for (const id of open.keys()) if (id < frameId - 30) open.delete(id);
      label = 'other';
    },
    /** Means over the rolling window, ms, largest first. */
    report() {
      const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
      const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
      const parts = [...sums].map(([k, a]) => [k, +mean(a).toFixed(3)]).filter(([, v]) => v >= 0.005).sort((a, b) => b[1] - a[1]);
      return {
        supported: !!ext,
        frames: frameGpu.length,
        gpuMs: +mean(frameGpu).toFixed(2), gpuP95: +pct(frameGpu, 0.95).toFixed(2),
        cpuMs: +mean(frameCpu).toFixed(2), cpuP95: +pct(frameCpu, 0.95).toFixed(2),
        disjoint,
        parts: Object.fromEntries(parts),
      };
    },
    reset() { sums.clear(); frameGpu.length = 0; frameCpu.length = 0; cur.clear(); },
  };
}
