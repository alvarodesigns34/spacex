/**
 * The technical panel (key I) and ?perf / ?perf=log, moved out of main.js unchanged (8-11-2026,
 * refactor §36 of docs/auditoria-2026-11-08-encargo-maestro.md): what they read is passed in.
 */
export function createTechPanel({ renderer, camera, env, quality, params, jump, toggleCybertruck, ctLab }) {
  // ---- ?perf: frame-rate meter for real hardware ----
  // The gate runs on a software rasteriser whose milliseconds say nothing about a GPU, so the
  // only way to know what a visitor gets is to measure on their machine. With ?perf in the URL
  // a small readout shows frames per second, the mean and 95th-percentile frame time over the
  // last two seconds, draw calls and triangles for the whole frame (every composer pass), the
  // quality tier and the GPU the browser reports. Nothing is measured without the flag.
  // Key I opens the same meter as a technical panel at any time (and closes it), with a second
  // line of the state that sets the cost and the picture: camera, field of view, Sun, exposure
  // compensation, the clouds' samples per ray, and the real drawing buffer (pixels, pixel ratio, MSAA)
  // with the LOD threshold, so the full-quality state can be checked rather than assumed.
  const makePerf = () => {
    const box = document.createElement('div');
    box.className = 'perf-meter';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    renderer.info.autoReset = false;
    const times = [];
    let last = performance.now(), shown = 0;
    const out = { fps: 0, mean: 0, p95: 0, calls: 0, tris: 0 };
    return {
      out,
      begin() { renderer.info.reset(); },
      end() {
        const now = performance.now();
        times.push(now - last); last = now;
        // Always the last frame, even one longer than the window: a frame over 2 s (a software
        // renderer) emptied it, and the readout threw on an undefined p95.
        while (times.length > 1 && (times.length > 240 || times.reduce((a, b) => a + b, 0) > 2000)) times.shift();
        out.calls = renderer.info.render.calls; out.tris = renderer.info.render.triangles;
        if (now - shown < 500) return;
        shown = now;
        const sorted = [...times].sort((a, b) => a - b);
        out.mean = times.reduce((a, b) => a + b, 0) / times.length;
        out.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        out.fps = 1000 / out.mean;
        const cp = camera.position, sa = env.sunAngles;
        box.textContent = `${out.fps.toFixed(0)} fps · ${out.mean.toFixed(1)} ms (p95 ${out.p95.toFixed(1)}) · ${out.calls} calls · ${(out.tris / 1e6).toFixed(2)} M tris · ${quality.name}${quality.forced ? ' (forced)' : ''} · ${quality.probe?.renderer || 'GPU not reported'}`
          + `\ncamera ${cp.x.toFixed(0)}, ${cp.y.toFixed(1)}, ${cp.z.toFixed(0)} m · FOV ${camera.fov.toFixed(0)}° · Sun ${sa.elev.toFixed(0)}° / ${(((sa.azim % 360) + 360) % 360).toFixed(0)}° · ${env.exposureBias ? `${env.exposureBias > 0 ? '+' : ''}${env.exposureBias.toFixed(1)} EV · ` : ''}clouds ${env.clouds.mode}${env.clouds.mode === 'volume' ? ` ${env.clouds.steps} steps` : ''}`
          + `\nbuffer ${renderer.domElement.width}×${renderer.domElement.height} (×${renderer.getPixelRatio()}) · MSAA ${quality.msaa}× · LOD ${quality.lodPixels > 0 ? `drops under ${quality.lodPixels} px` : 'off (full detail)'}${quality.suggested && quality.suggested !== quality.name ? ` · probe would suggest ${quality.suggested}, not applied` : ''}`;
      },
      dispose() { box.remove(); renderer.info.autoReset = true; },
    };
  };
  let perf = params.has('perf') ? makePerf() : null;
  function toggleTechnical() {
    if (perf) { perf.dispose(); perf = null; } else perf = makePerf();
  }

  // ---- ?perf=log: a fixed measurement on real hardware (audit M-FL8) ----
  // The same views every time, so two machines or two versions can be compared: each is jumped
  // to, left to settle, then measured over the meter's two-second window. The Cybertruck Lab is
  // measured with its exploded view animating (at rest it draws nothing). The figures end in a
  // panel as JSON, to copy or download and paste into the README; nothing is sent anywhere.
  if (perf && params.get('perf') === 'log') {
    const VIEWS_LOG = [[null], ['starship', 'site'], ['starship', 'engines'], ['falcon9', 'overview'], ['roadster', 'detail'],
      ['engines', 'overview'], ['f16', 'overview'], ['gt3rs', 'overview'], ['h2r', 'overview'], ['modely', 'overview']];
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    (async () => {
      while (document.getElementById('loading')) await wait(500);
      await wait(4000);
      const rows = [];
      const sample = async (id) => { await wait(2500); const o = perf.out; rows.push({ view: id, fps: +o.fps.toFixed(1), meanMs: +o.mean.toFixed(2), p95Ms: +o.p95.toFixed(2), calls: o.calls, triangles: o.tris }); };
      for (const [id, preset] of VIEWS_LOG) { jump(id, preset); await sample(id ? `${id}/${preset}` : 'overview'); }
      toggleCybertruck();
      while (!ctLab.loaded) await wait(500);
      ctLab.setPlaying(true);
      await sample('cybertruck-lab/exploding');
      ctLab.setPlaying(false); ctLab.close();
      const report = {
        date: new Date().toISOString(), userAgent: navigator.userAgent, gpu: quality.probe?.renderer || 'not reported',
        quality: quality.name, forced: !!quality.forced, devicePixelRatio: window.devicePixelRatio,
        viewport: [window.innerWidth, window.innerHeight], views: rows,
      };
      const json = JSON.stringify(report, null, 2);
      console.log(json);
      const box = document.createElement('div');
      box.className = 'perf-log';
      box.innerHTML = '<b>Performance log</b><textarea readonly></textarea><div><button type="button" class="tool tool-btn" data-act="copy">Copy</button> <a class="tool tool-btn" download="vehicle-center-perf.json">Download</a> <button type="button" class="tool tool-btn" data-act="close">Close</button></div>';
      box.querySelector('textarea').value = json;
      box.querySelector('a').href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      box.querySelector('[data-act="copy"]').addEventListener('click', () => navigator.clipboard?.writeText(json));
      box.querySelector('[data-act="close"]').addEventListener('click', () => box.remove());
      document.body.appendChild(box);
      window.__vc.perfLog = report;
    })();
  }

  return {
    /** The meter while it is shown (begin/end around a frame, out), else null. */
    get perf() { return perf; },
    toggle: toggleTechnical,
  };
}
