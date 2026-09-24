/**
 * HUD: vehicle rail, data sheet, view presets, scale bar and controls.
 * Pure DOM; the 3D layer talks to it through the returned API.
 */
import { SOURCES, SOURCE_LABEL } from '../data/specs.js';

const fmtHeight = (h) => `${h >= 10 ? Math.round(h) : h} m`;
const THREE_DEG20 = Math.PI / 9;

export function createHUD({ vehicles, onSelect, onPreset, onToggle, onMode, onSun, onReset, onLaunch, onLaunchAbort, onLaunchSpeed, onTour, onHelp }) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <header class="hud-header">
      <div class="eyebrow">SpaceX Vehicle Center</div>
      <h1 class="title" id="hud-title">—</h1>
      <div class="subtitle" id="hud-subtitle"></div>
    </header>

    <div class="rail" id="rail" role="tablist" aria-label="Vehicles"></div>

    <aside class="sheet" id="sheet" aria-label="Data sheet">
      <div class="sheet-head">
        <span class="eyebrow">Data sheet</span>
        <button class="icon-btn" id="sheet-toggle" title="Collapse sheet (T)" aria-label="Collapse sheet">–</button>
      </div>
      <p class="summary" id="sheet-summary"></p>
      <dl class="specs" id="sheet-specs"></dl>
      <details class="approx" id="sheet-approx">
        <summary>Approximated elements</summary>
        <ul id="sheet-approx-list"></ul>
      </details>
      <div class="sources">
        <span class="eyebrow">Sources</span>
        <ul id="sheet-sources"></ul>
      </div>
    </aside>

    <nav class="minimap" id="minimap" aria-label="Site map"></nav>

    <div class="presets" id="presets" role="tablist" aria-label="Views"></div>

    <div class="tools">
      <label class="tool"><input type="checkbox" id="tg-labels" checked> Labels <kbd>L</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-ruler" checked> Ruler <kbd>R</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-humans" checked> 1.80 m figures</label>
      <label class="tool tool-sun">Sun <input type="range" id="sun" min="4" max="75" value="42" step="1" title="Sun elevation, from low evening light to midday"></label>
      <button class="tool tool-btn tool-launch" id="launch-btn" title="Starship launch sequence from Pad 2 (G)">Starship · Launch <kbd>G</kbd></button>
      <button class="tool tool-btn" id="tour-btn" title="Guided tour of the centre (P)">Tour <kbd>P</kbd></button>
      <button class="tool tool-btn" id="mode-btn" title="Switch camera mode (F)">Orbit <kbd>F</kbd></button>
      <button class="tool tool-btn" id="clean-btn" type="button" aria-pressed="false" title="Hide the interface">Clean scene</button>
      <button class="tool tool-btn" id="help-btn" title="Help (H)">Help <kbd>H</kbd></button>
    </div>

    <div class="dock" id="dock">
      <button type="button" class="dock-btn" id="dock-vehicles" aria-expanded="false" aria-controls="rail">Vehicles</button>
      <button type="button" class="dock-btn" id="dock-views" aria-expanded="false" aria-controls="presets">Views</button>
      <button type="button" class="dock-btn" id="dock-tools" aria-expanded="false">Tools</button>
      <button type="button" class="dock-btn" id="dock-clean" aria-pressed="false">Clean</button>
    </div>

    <div class="mission hidden" id="mission">
      <div class="mission-head">
        <span class="mission-clock" id="mission-clock">T−00:00:12</span>
        <span class="mission-phase" id="mission-phase">Countdown</span>
      </div>
      <div class="mission-telemetry">
        <div><span>Altitude</span><b id="m-alt">0 m</b></div>
        <div><span>Speed</span><b id="m-vel">0 km/h</b></div>
        <div><span>Downrange</span><b id="m-down">0 m</b></div>
        <div><span>Thrust</span><b id="m-thr">0 %</b></div>
      </div>
      <figure class="mission-plot" aria-label="Altitude profile of the flight">
        <svg id="mission-plot" viewBox="0 0 400 74" preserveAspectRatio="none"></svg>
        <figcaption><span class="mp-ship">Ship</span><span class="mp-booster">Booster</span><span class="mp-scale">altitude, square-root scale</span></figcaption>
      </figure>
      <div class="mission-foot">
        <div class="mission-speeds" id="mission-speeds">
          <button data-k="1" class="active">×1</button><button data-k="2">×2</button><button data-k="5">×5</button><button data-k="10">×10</button>
        </div>
        <button class="mission-abort" id="mission-abort">End</button>
      </div>
      <details class="mission-note"><summary>Composite demonstration · sources and limits</summary><p><b>Not a reconstruction of one flight.</b> The vehicle and the pad are the V3 / Pad 2 configuration that debuted on flight 12 (22 May 2026), but that flight did <i>not</i> attempt a catch: booster 19 was sent to the Gulf and its landing burn failed to relight. So the ascent milestones are flight 7's (liftoff T+0:02 · Max-Q 1:02 · MECO 2:32 · hot-staging 2:40) and the return milestones are flight 5's, the flight on which a booster was first caught (boostback 2:45–3:41, landing burn 6:30, caught 6:54). Everything between the milestones — the speed curve, the gravity turn, the separation speed and the whole return trajectory — is authored.</p></details>
    </div>

    <div class="scale" id="scale">
      <div class="scale-bar"><span id="scale-label">10 m</span></div>
      <div class="scale-info" id="scale-info"></div>
    </div>

    <div class="help hidden" id="help" role="dialog" aria-modal="true" aria-label="Help and keyboard shortcuts">
      <div class="help-card">
        <div class="eyebrow">Controls</div>
        <table>
          <tr><td>Drag</td><td>orbit · <em>wheel</em> zoom towards the cursor · <em>right button</em> pan</td></tr>
          <tr><td>Double-click</td><td>orbit around the point you clicked</td></tr>
          <tr><td><kbd>F</kbd></td><td>free flight: <kbd>W A S D</kbd> move · <kbd>Q</kbd>/<kbd>E</kbd> (or <kbd>C</kbd>/<kbd>space</kbd>) down/up · drag to look · <kbd>Shift</kbd> ×4 · <kbd>Ctrl</kbd> ×0.2 · wheel adjusts speed</td></tr>
          <tr><td><kbd>1</kbd>–<kbd>${vehicles.length}</kbd></td><td>select exhibit</td></tr>
          <tr><td><kbd>L</kbd> <kbd>R</kbd> <kbd>T</kbd></td><td>labels · ruler · data sheet</td></tr>
          <tr><td><kbd>0</kbd></td><td>overview of the centre</td></tr>
          <tr><td><kbd>P</kbd></td><td>guided tour — the camera walks the centre stop by stop; any drag, scroll or click ends it</td></tr>
          <tr><td><kbd>G</kbd></td><td>Starship launch sequence · during the countdown and ascent, dragging or scrolling hands the camera back to you without stopping it</td></tr>
        </table>
        <p class="help-note">1:1 scale — one scene unit is one metre. Figures marked <span class="chip chip-approx">≈</span> have no exact published value and were reconstructed from imagery.</p>
        <button class="btn" id="help-close">Close</button>
      </div>
    </div>
  `;

  // ---- rail ----
  const rail = root.querySelector('#rail');
  vehicles.forEach((v, i) => {
    const b = document.createElement('button');
    b.className = 'rail-item';
    b.dataset.id = v.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', 'false');
    b.innerHTML = `<span class="rail-index">${i + 1}</span><span class="rail-name">${v.name}</span><span class="rail-h">${fmtHeight(v.id === 'starlink' ? 30 : v.height)}${v.id === 'starlink' ? ' <small>span</small>' : ''}</span>`;
    b.addEventListener('click', () => { closeDock(); onSelect(v.id); });
    rail.appendChild(b);
  });
  const overview = document.createElement('button');
  overview.className = 'rail-item rail-overview';
  overview.setAttribute('role', 'tab');
  overview.setAttribute('aria-selected', 'true');
  overview.innerHTML = `<span class="rail-index">0</span><span class="rail-name">Overview</span><span class="rail-h">all</span>`;
  overview.addEventListener('click', () => { closeDock(); onReset(); });
  rail.appendChild(overview);

  // ---- sheet ----
  const sheet = root.querySelector('#sheet');
  const el = (id) => root.querySelector(id);
  root.querySelector('#sheet-toggle').addEventListener('click', () => toggleSheet());
  function toggleSheet(force) {
    const collapsed = force ?? !sheet.classList.contains('collapsed');
    sheet.classList.toggle('collapsed', collapsed);
    root.querySelector('#sheet-toggle').textContent = collapsed ? '+' : '–';
    root.querySelector('#sheet-toggle').setAttribute('aria-expanded', String(!collapsed));
    root.querySelector('#sheet-toggle').setAttribute('aria-label', collapsed ? 'Expand data sheet' : 'Collapse data sheet');
  }

  function renderSheet(v) {
    el('#hud-title').textContent = v.name;
    el('#hud-subtitle').textContent = v.subtitle;
    el('#sheet-summary').textContent = v.summary;
    const dl = el('#sheet-specs');
    dl.innerHTML = '';
    for (const s of v.specs) {
      const dt = document.createElement('dt');
      dt.textContent = s.label;
      const dd = document.createElement('dd');
      const chip = s.approx ? `<span class="chip chip-approx" title="Approximate: no exact published figure">≈</span>` : `<span class="chip chip-src" title="${SOURCES[s.ref]?.label ?? ''}">${SOURCE_LABEL[s.source]}</span>`;
      // Keep a number and its unit together: "397 s" was breaking with the "s" alone on the
      // next line.
      const val = String(s.value).replace(/(\d) (?=(s|m|kg|kN|km|tf|t|N|MN|AU|°|%)\b)/g, '$1\u00a0');
      dd.innerHTML = `<span class="val">${val}</span>${chip}`;
      dl.append(dt, dd);
    }
    const ul = el('#sheet-approx-list');
    ul.innerHTML = v.approximations.map(a => `<li>${a}</li>`).join('');
    el('#sheet-sources').innerHTML = v.sources.map(k => `<li><a href="${SOURCES[k].url}" target="_blank" rel="noopener">${SOURCES[k].label}</a></li>`).join('');
    // presets
    const p = el('#presets');
    p.innerHTML = '';
    v.presets.forEach((pr, i) => {
      const b = document.createElement('button');
      b.className = 'preset' + (i === 0 ? ' active' : '');
      b.textContent = pr.label;
      b.dataset.preset = pr.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === 0));
      b.addEventListener('click', () => { closeDock(); onPreset(v.id, pr.id); });
      p.appendChild(b);
    });
  }

  function setPreset(id) {
    closeDock();
    root.querySelectorAll('.preset').forEach(b => {
      const active = b.dataset.preset === id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
  }

  function setActive(id) {
    closeDock();
    rail.querySelectorAll('.rail-item').forEach(b => {
      // `on` already accounts for the overview item, which has no dataset.id; toggling on the
      // raw comparison instead meant aria-selected said "selected" while nothing was painted,
      // so the overview row never highlighted and the two states disagreed.
      const on = b.dataset.id === id || (!id && b.classList.contains('rail-overview'));
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    setMapActive(id);
    const v = vehicles.find(x => x.id === id);
    if (v) { renderSheet(v); sheet.classList.remove('hidden'); el('#presets').classList.remove('hidden'); }
    else {
      el('#hud-title').textContent = 'Overview';
      el('#hud-subtitle').textContent = `${vehicles.length} exhibits at 1:1 scale`;
      sheet.classList.add('hidden');
      el('#presets').classList.add('hidden');
    }
  }

  // ---- tools ----
  el('#tg-labels').addEventListener('change', (e) => onToggle('labels', e.target.checked));
  el('#tg-ruler').addEventListener('change', (e) => onToggle('ruler', e.target.checked));
  el('#tg-humans').addEventListener('change', (e) => onToggle('humans', e.target.checked));
  el('#sun').addEventListener('input', (e) => onSun(Number(e.target.value)));
  el('#mode-btn').addEventListener('click', () => onMode());
  const tourBtn = el('#tour-btn');
  tourBtn.addEventListener('click', () => onTour?.());
  /** null ends the tour; otherwise {step, total} lights the button and shows progress. */
  function setTour(st) {
    tourBtn.classList.toggle('is-live', !!st);
    tourBtn.innerHTML = st ? `Tour ${st.step}/${st.total} <kbd>P</kbd>` : 'Tour <kbd>P</kbd>';
  }
  // ---- Help dialog -----------------------------------------------------------------------
  // It declares aria-modal, so it has to behave like one: focus moves into it when it opens,
  // Tab cannot leave it while it is up, and closing returns focus to whatever opened it.
  // Without that, Tab walked straight out through the overlay onto the rail underneath and a
  // keyboard user was operating controls they could not see.
  const help = el('#help');
  const helpBtn = el('#help-btn');
  let helpOpener = null;
  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function showHelp(on) {
    const wasOpen = !help.classList.contains('hidden');
    if (on === wasOpen) return;
    help.classList.toggle('hidden', !on);
    onHelp?.(on);
    if (on) {
      helpOpener = document.activeElement;
      help.querySelector('#help-close')?.focus();
    } else {
      (helpOpener instanceof HTMLElement ? helpOpener : helpBtn).focus();
      helpOpener = null;
    }
  }
  help.addEventListener('keydown', (e) => {
    // A modal owns keyboard input, including the camera's W/A/S/D and launch shortcuts.
    // Keep keyup bubbling so keys held before opening cannot become stuck.
    e.stopPropagation();
    if (e.key === 'Escape') { showHelp(false); return; }
    if (e.key !== 'Tab') return;
    const items = [...help.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Clicking the scrim closes it, which is what every dialog on the web does.
  help.addEventListener('pointerdown', (e) => { if (e.target === help) showHelp(false); });
  helpBtn.addEventListener('click', () => showHelp(help.classList.contains('hidden')));
  el('#help-close').addEventListener('click', () => showHelp(false));

  // The sheet is a drawer. It starts closed on every viewport so it does not cover
  // the vehicle; T or the header button opens it. Narrow screens keep it closed.
  const compact = window.matchMedia('(max-width: 820px), (max-height: 600px)');
  toggleSheet(true);
  compact.addEventListener('change', e => { if (e.matches) toggleSheet(true); });

  const dockMap = {
    vehicles: [root.querySelector('#dock-vehicles'), rail],
    views: [root.querySelector('#dock-views'), root.querySelector('#presets')],
    tools: [root.querySelector('#dock-tools'), root.querySelector('.tools')],
  };
  function closeDock() {
    for (const [btn, panel] of Object.values(dockMap)) {
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }
  for (const [btn, panel] of Object.values(dockMap)) {
    btn.addEventListener('click', () => {
      const open = !panel.classList.contains('is-open');
      closeDock();
      if (open) {
        panel.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }
  const cleanBtn = root.querySelector('#clean-btn');
  const dockClean = root.querySelector('#dock-clean');
  function setClean(on) {
    root.classList.toggle('is-clean', on);
    cleanBtn.setAttribute('aria-pressed', String(on));
    dockClean.setAttribute('aria-pressed', String(on));
    if (on) closeDock();
  }
  cleanBtn.addEventListener('click', () => setClean(!root.classList.contains('is-clean')));
  dockClean.addEventListener('click', () => setClean(!root.classList.contains('is-clean')));

  // ---- Mission panel ----
  const mission = el('#mission');
  const launchBtn = el('#launch-btn');
  new ResizeObserver(() => root.style.setProperty('--mission-height', `${mission.getBoundingClientRect().height}px`)).observe(mission);
  const mClock = el('#mission-clock'), mPhase = el('#mission-phase');
  const mAlt = el('#m-alt'), mVel = el('#m-vel'), mDown = el('#m-down'), mThr = el('#m-thr');
  const speeds = [...root.querySelectorAll('#mission-speeds button')];
  launchBtn.addEventListener('click', () => onLaunch?.());
  el('#mission-abort').addEventListener('click', () => onLaunchAbort?.());
  // The buttons only ask; which one is lit is read back from the simulation in setMission,
  // so the panel cannot claim a multiplier the clock is not actually using.
  for (const b of speeds) b.addEventListener('click', () => onLaunchSpeed?.(Number(b.dataset.k)));
  const clockText = (t) => {
    const a = Math.abs(t);
    return `T${t < 0 ? '−' : '+'}00:${String(Math.floor(a / 60)).padStart(2, '0')}:${String(Math.floor(a % 60)).padStart(2, '0')}`;
  };
  const dist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);
  // ---- Flight profile plot ----
  // The whole flight at a glance: the ship's climb, the booster's return, the milestones as
  // ticks and a cursor at the current instant. Altitude on a square-root scale, so the
  // booster's 96 km arc and the pad-level catch both read beside a ship heading for orbit.
  const plot = el('#mission-plot');
  let plotSpan = null;
  const PLOT_NS = 'http://www.w3.org/2000/svg';
  function setTrajectory({ t0, t1, ship, booster, events }) {
    plotSpan = { t0, t1 };
    const top = Math.max(...ship.map(p => p[1]), ...booster.map(p => p[1]));
    const X = (t) => ((t - t0) / (t1 - t0)) * 400;
    const Y = (h) => 70 - Math.sqrt(Math.max(0, h) / top) * 64;
    const path = (pts) => pts.map(([t, h], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(h).toFixed(1)}`).join('');
    plot.innerHTML = '';
    for (const [t, label] of events) {
      const l = document.createElementNS(PLOT_NS, 'line');
      l.setAttribute('x1', X(t)); l.setAttribute('x2', X(t)); l.setAttribute('y1', 2); l.setAttribute('y2', 72);
      l.setAttribute('class', 'mp-tick');
      const tt = document.createElementNS(PLOT_NS, 'title'); tt.textContent = label; l.appendChild(tt);
      plot.appendChild(l);
    }
    for (const [pts, cls] of [[booster, 'mp-line-booster'], [ship, 'mp-line-ship']]) {
      const p = document.createElementNS(PLOT_NS, 'path');
      p.setAttribute('d', path(pts)); p.setAttribute('class', cls);
      plot.appendChild(p);
    }
    const c = document.createElementNS(PLOT_NS, 'line');
    c.setAttribute('y1', 0); c.setAttribute('y2', 74); c.setAttribute('class', 'mp-cursor'); c.id = 'mp-cursor';
    plot.appendChild(c);
  }
  /** Called every frame while a sequence runs; null puts the panel away. */
  function setMission(st) {
    if (!st) {
      mission.classList.add('hidden');
      document.body.classList.remove('is-flying');
      launchBtn.classList.remove('is-live');
      return;
    }
    mission.classList.remove('hidden');
    document.body.classList.add('is-flying');
    launchBtn.classList.add('is-live');
    mClock.textContent = clockText(st.t);
    mPhase.textContent = st.phase;
    mAlt.textContent = dist(st.altitude);
    mVel.textContent = `${Math.round(st.velocity * 3.6).toLocaleString('en-US')} km/h`;
    mDown.textContent = dist(st.downrange);
    mThr.textContent = `${Math.round(st.throttle * 100)} %`;
    for (const b of speeds) b.classList.toggle('active', Number(b.dataset.k) === st.speed);
    const cur = plotSpan && plot.querySelector('#mp-cursor');
    if (cur) {
      const x = Math.max(0, Math.min(400, ((st.t - plotSpan.t0) / (plotSpan.t1 - plotSpan.t0)) * 400));
      cur.setAttribute('x1', x); cur.setAttribute('x2', x);
    }
  }

  function setMode(mode) {
    el('#mode-btn').innerHTML = (mode === 'fly' ? 'Free flight' : 'Orbit') + ' <kbd>F</kbd>';
    root.classList.toggle('fly', mode === 'fly');
  }

  const scaleLabel = el('#scale-label');
  const scaleBar = root.querySelector('.scale-bar');
  const scaleInfo = el('#scale-info');
  function setScale(metresPerPixel, distance) {
    // choose a "nice" length that fits in ~90-220 px
    const candidates = [0.5, 1, 2, 5, 10, 20, 50, 100];
    let best = 10;
    for (const c of candidates) { const px = c / metresPerPixel; if (px >= 90) { best = c; break; } best = c; }
    const px = Math.min(best / metresPerPixel, 320);
    scaleBar.style.width = `${px.toFixed(0)}px`;
    scaleLabel.textContent = best < 1 ? `${best * 100} cm` : `${best} m`;
    scaleInfo.textContent = `distance to target ${distance < 10 ? distance.toFixed(1) : Math.round(distance)} m`;
  }

  // ---- Site map ----------------------------------------------------------------------
  // A plan of the centre, in metres, with the exhibits as numbered stops and the camera as a
  // wedge pointing where it looks. In a site 370 m across the camera is often somewhere the
  // viewer cannot name; the map answers "where am I, and where is the thing I want", and a
  // stop on it is one click from its exhibit. Built once from the scene, updated per frame.
  const map = el('#minimap');
  const SVGNS = 'http://www.w3.org/2000/svg';
  let mapCam = null, mapBounds = null, mapLast = '';
  function setMap({ bounds, rects, stops }) {
    mapBounds = bounds;
    const [x0, z0, x1, z1] = bounds;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `${x0} ${z0} ${x1 - x0} ${z1 - z0}`);
    svg.setAttribute('role', 'group');
    const k = (x1 - x0) / 196;               // metres per CSS pixel, for strokes and type
    for (const r of rects) {
      const e = document.createElementNS(SVGNS, 'rect');
      e.setAttribute('x', r.x0); e.setAttribute('y', r.z0);
      e.setAttribute('width', r.x1 - r.x0); e.setAttribute('height', r.z1 - r.z0);
      e.setAttribute('rx', 2 * k);
      e.setAttribute('class', `map-${r.kind}`);
      svg.appendChild(e);
    }
    // Stops closer than a marker's width along the row are staggered above it, so two
    // numbers never print on top of each other (Falcon 1 stands 18 m from Falcon 9).
    const R = 6.5 * k;
    const placed = [];
    for (const st of [...stops].sort((a, b) => a.x - b.x)) {
      let z = st.z;
      while (placed.some(p => Math.hypot(p.x - st.x, p.z - z) < R * 2.3)) z -= R * 2.3;
      placed.push({ ...st, z });
    }
    for (const st of placed) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'map-stop');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `${st.n} · ${st.name}`);
      g.dataset.id = st.id;
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', st.x); c.setAttribute('cy', st.z); c.setAttribute('r', R);
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', st.x); t.setAttribute('y', st.z); t.setAttribute('font-size', 8.5 * k);
      t.textContent = st.n;
      const title = document.createElementNS(SVGNS, 'title');
      title.textContent = st.name;
      g.append(title, c, t);
      const go = () => { closeDock(); onSelect(st.id); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      svg.appendChild(g);
    }
    mapCam = document.createElementNS(SVGNS, 'path');
    // A 40° wedge, 18 px long, drawn pointing along +x and turned per frame.
    const L = 18 * k, ax = Math.cos(THREE_DEG20) * L, az = Math.sin(THREE_DEG20) * L;
    mapCam.setAttribute('d', `M0 0 L${ax} ${-az} A${L} ${L} 0 0 1 ${ax} ${az} Z`);
    mapCam.setAttribute('class', 'map-camera');
    svg.appendChild(mapCam);
    map.replaceChildren(svg);
  }
  /** Camera position and look direction in the ground plane. Outside the plan it rides the edge. */
  function setMapCamera(x, z, dx, dz) {
    if (!mapCam) return;
    const [x0, z0, x1, z1] = mapBounds;
    const cx = Math.min(x1, Math.max(x0, x)), cz = Math.min(z1, Math.max(z0, z));
    const deg = Math.atan2(dz, dx) * 180 / Math.PI;
    const key = `${cx.toFixed(1)},${cz.toFixed(1)},${deg.toFixed(0)}`;
    if (key === mapLast) return;
    mapLast = key;
    mapCam.setAttribute('transform', `translate(${cx} ${cz}) rotate(${deg})`);
  }
  function setMapActive(id) {
    map.querySelectorAll('.map-stop').forEach(g => g.classList.toggle('active', g.dataset.id === id));
  }

  const loading = document.getElementById('loading');
  function setProgress(text, frac) {
    loading.querySelector('.loading-text').textContent = text;
    loading.querySelector('.loading-fill').style.transform = `scaleX(${Math.max(0.02, frac)})`;
  }
  function hideLoading() { loading.classList.add('done'); setTimeout(() => loading.remove(), 700); }

  function toggle(name, value) {
    const map = { labels: '#tg-labels', ruler: '#tg-ruler', humans: '#tg-humans' };
    if (map[name]) el(map[name]).checked = value;
  }

  return { setActive, setPreset, setMode, setScale, setProgress, hideLoading, toggleSheet, toggle, setMission, setTrajectory, setTour, showHelp, setMap, setMapCamera };
}
