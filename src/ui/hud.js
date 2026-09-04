/**
 * HUD: vehicle rail, data sheet, view presets, scale bar and controls.
 * Pure DOM; the 3D layer talks to it through the returned API.
 */
import { SOURCES, SOURCE_LABEL } from '../data/specs.js';

const fmtHeight = (h) => `${h >= 10 ? Math.round(h) : h} m`;

export function createHUD({ vehicles, onSelect, onPreset, onToggle, onMode, onSun, onReset, onLaunch, onLaunchAbort, onLaunchSpeed }) {
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

    <div class="presets" id="presets" role="tablist" aria-label="Views"></div>

    <div class="tools">
      <label class="tool"><input type="checkbox" id="tg-labels" checked> Labels <kbd>L</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-ruler" checked> Ruler <kbd>R</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-humans" checked> 1.80 m figures</label>
      <label class="tool tool-sun">Sun <input type="range" id="sun" min="6" max="75" value="42" step="1"></label>
      <button class="tool tool-btn tool-launch" id="launch-btn" title="Starship launch sequence from Pad 2 (G)">Starship · Launch <kbd>G</kbd></button>
      <button class="tool tool-btn" id="mode-btn" title="Switch camera mode (F)">Orbit <kbd>F</kbd></button>
      <button class="tool tool-btn" id="help-btn" title="Help (H)">Help <kbd>H</kbd></button>
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
      <div class="mission-foot">
        <div class="mission-speeds" id="mission-speeds">
          <button data-k="1" class="active">×1</button><button data-k="2">×2</button><button data-k="5">×5</button><button data-k="10">×10</button>
        </div>
        <button class="mission-abort" id="mission-abort">End</button>
      </div>
      <p class="mission-note">Milestones follow the published flight timeline (T+0:02 liftoff · 1:02 Max-Q · 2:32 MECO · 2:40 hot-staging). The altitude and speed curve between them is a reconstruction.</p>
    </div>

    <div class="scale" id="scale">
      <div class="scale-bar"><span id="scale-label">10 m</span></div>
      <div class="scale-info" id="scale-info"></div>
    </div>

    <div class="help hidden" id="help" role="dialog" aria-modal="true" aria-label="Help and keyboard shortcuts">
      <div class="help-card">
        <div class="eyebrow">Controls</div>
        <table>
          <tr><td>Drag</td><td>orbit · <em>wheel</em> zoom · <em>right button</em> pan</td></tr>
          <tr><td><kbd>F</kbd></td><td>free flight: <kbd>W A S D</kbd> move · <kbd>Q</kbd>/<kbd>E</kbd> (or <kbd>C</kbd>/<kbd>space</kbd>) down/up · drag to look · <kbd>Shift</kbd> ×4 · <kbd>Ctrl</kbd> ×0.2 · wheel adjusts speed</td></tr>
          <tr><td><kbd>1</kbd>–<kbd>6</kbd></td><td>select vehicle</td></tr>
          <tr><td><kbd>L</kbd> <kbd>R</kbd> <kbd>T</kbd></td><td>labels · ruler · data sheet</td></tr>
          <tr><td><kbd>0</kbd></td><td>overview of the centre</td></tr>
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
    b.addEventListener('click', () => onSelect(v.id));
    rail.appendChild(b);
  });
  const overview = document.createElement('button');
  overview.className = 'rail-item rail-overview';
  overview.setAttribute('role', 'tab');
  overview.setAttribute('aria-selected', 'true');
  overview.innerHTML = `<span class="rail-index">0</span><span class="rail-name">Overview</span><span class="rail-h">all</span>`;
  overview.addEventListener('click', () => onReset());
  rail.appendChild(overview);

  // ---- sheet ----
  const sheet = root.querySelector('#sheet');
  const el = (id) => root.querySelector(id);
  root.querySelector('#sheet-toggle').addEventListener('click', () => toggleSheet());
  function toggleSheet(force) {
    const collapsed = force ?? !sheet.classList.contains('collapsed');
    sheet.classList.toggle('collapsed', collapsed);
    root.querySelector('#sheet-toggle').textContent = collapsed ? '+' : '–';
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
      dd.innerHTML = `<span class="val">${s.value}</span>${chip}`;
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
      b.addEventListener('click', () => { onPreset(v.id, pr.id); p.querySelectorAll('.preset').forEach(x => x.classList.remove('active')); b.classList.add('active'); });
      p.appendChild(b);
    });
  }

  function setActive(id) {
    rail.querySelectorAll('.rail-item').forEach(b => {
      const on = b.dataset.id === id || (!id && b.classList.contains('rail-overview'));
      b.classList.toggle('active', b.dataset.id === id);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const v = vehicles.find(x => x.id === id);
    if (v) { renderSheet(v); sheet.classList.remove('hidden'); el('#presets').classList.remove('hidden'); }
    else {
      el('#hud-title').textContent = 'Overview';
      el('#hud-subtitle').textContent = `${vehicles.length} vehicles at 1:1 scale`;
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
  const help = el('#help');
  el('#help-btn').addEventListener('click', () => help.classList.toggle('hidden'));
  el('#help-close').addEventListener('click', () => help.classList.add('hidden'));

  // ---- Mission panel ----
  const mission = el('#mission');
  const launchBtn = el('#launch-btn');
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

  return { setActive, setMode, setScale, setProgress, hideLoading, toggleSheet, toggle, setMission, showHelp: (s) => help.classList.toggle('hidden', !s) };
}
