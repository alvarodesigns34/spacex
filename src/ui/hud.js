/**
 * HUD: vehicle rail, data sheet, view presets, scale bar and controls.
 * Pure DOM; the 3D layer talks to it through the returned API.
 */
import { SOURCES, SOURCE_LABEL } from '../data/specs.js';

const fmtHeight = (h) => (h >= 10 ? `${Math.round(h)} m` : `${String(h).replace('.', ',')} m`);

export function createHUD({ vehicles, onSelect, onPreset, onToggle, onMode, onSun, onReset, onLaunch, onLaunchAbort, onLaunchSpeed }) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <header class="hud-header">
      <div class="eyebrow">SpaceX Vehicle Center</div>
      <h1 class="title" id="hud-title">—</h1>
      <div class="subtitle" id="hud-subtitle"></div>
    </header>

    <nav class="rail" id="rail" aria-label="Vehículos"></nav>

    <aside class="sheet" id="sheet" aria-label="Ficha técnica">
      <div class="sheet-head">
        <span class="eyebrow">Ficha técnica</span>
        <button class="icon-btn" id="sheet-toggle" title="Plegar ficha (T)" aria-label="Plegar ficha">–</button>
      </div>
      <p class="summary" id="sheet-summary"></p>
      <dl class="specs" id="sheet-specs"></dl>
      <details class="approx" id="sheet-approx">
        <summary>Elementos aproximados</summary>
        <ul id="sheet-approx-list"></ul>
      </details>
      <div class="sources">
        <span class="eyebrow">Fuentes</span>
        <ul id="sheet-sources"></ul>
      </div>
    </aside>

    <div class="presets" id="presets" role="tablist" aria-label="Vistas"></div>

    <div class="tools">
      <label class="tool"><input type="checkbox" id="tg-labels" checked> Etiquetas <kbd>L</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-ruler" checked> Regla <kbd>R</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-humans" checked> Figuras 1,80 m</label>
      <label class="tool tool-sun">Sol <input type="range" id="sun" min="6" max="75" value="42" step="1"></label>
      <button class="tool tool-btn tool-launch" id="launch-btn" title="Secuencia de lanzamiento de Starship (G)">Lanzamiento <kbd>G</kbd></button>
      <button class="tool tool-btn" id="mode-btn" title="Cambiar modo de cámara (F)">Órbita <kbd>F</kbd></button>
      <button class="tool tool-btn" id="help-btn" title="Ayuda (H)">Ayuda <kbd>H</kbd></button>
    </div>

    <div class="mission hidden" id="mission">
      <div class="mission-head">
        <span class="mission-clock" id="mission-clock">T−00:00:12</span>
        <span class="mission-phase" id="mission-phase">Cuenta atrás</span>
      </div>
      <div class="mission-telemetry">
        <div><span>Altitud</span><b id="m-alt">0 m</b></div>
        <div><span>Velocidad</span><b id="m-vel">0 km/h</b></div>
        <div><span>Distancia</span><b id="m-down">0 m</b></div>
        <div><span>Empuje</span><b id="m-thr">0 %</b></div>
      </div>
      <div class="mission-foot">
        <div class="mission-speeds" id="mission-speeds">
          <button data-k="1" class="active">×1</button><button data-k="2">×2</button><button data-k="5">×5</button><button data-k="10">×10</button>
        </div>
        <button class="mission-abort" id="mission-abort">Terminar</button>
      </div>
      <p class="mission-note">Hitos según la cronología publicada del vuelo (T+0:02 despegue · 1:02 Max-Q · 2:32 MECO · 2:40 separación en caliente). La curva de altitud y velocidad entre ellos es una reconstrucción.</p>
    </div>

    <div class="scale" id="scale">
      <div class="scale-bar"><span id="scale-label">10 m</span></div>
      <div class="scale-info" id="scale-info"></div>
    </div>

    <div class="help hidden" id="help">
      <div class="help-card">
        <div class="eyebrow">Controles</div>
        <table>
          <tr><td>Arrastrar</td><td>orbitar · <em>rueda</em> acercar · <em>botón derecho</em> desplazar</td></tr>
          <tr><td><kbd>F</kbd></td><td>vuelo libre: <kbd>W A S D</kbd> mover · <kbd>Q</kbd>/<kbd>E</kbd> bajar/subir · arrastrar para mirar · <kbd>Shift</kbd> ×4 · <kbd>Ctrl</kbd> ×0,2 · rueda ajusta la velocidad</td></tr>
          <tr><td><kbd>1</kbd>–<kbd>6</kbd></td><td>seleccionar vehículo</td></tr>
          <tr><td><kbd>L</kbd> <kbd>R</kbd> <kbd>T</kbd></td><td>etiquetas · regla · ficha</td></tr>
          <tr><td><kbd>0</kbd></td><td>vista general del centro</td></tr>
          <tr><td><kbd>G</kbd></td><td>secuencia de lanzamiento de Starship · durante la cuenta y el ascenso, arrastrar o girar la rueda devuelve el control de la cámara sin detenerla</td></tr>
        </table>
        <p class="help-note">Escala 1:1 — cada unidad de la escena es un metro. Las cifras marcadas <span class="chip chip-approx">≈</span> no tienen valor público exacto y se han reconstruido a partir de imágenes.</p>
        <button class="btn" id="help-close">Cerrar</button>
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
    b.innerHTML = `<span class="rail-index">${i + 1}</span><span class="rail-name">${v.name}</span><span class="rail-h">${fmtHeight(v.id === 'starlink' ? 30 : v.height)}${v.id === 'starlink' ? ' <small>env.</small>' : ''}</span>`;
    b.addEventListener('click', () => onSelect(v.id));
    rail.appendChild(b);
  });
  const overview = document.createElement('button');
  overview.className = 'rail-item rail-overview';
  overview.innerHTML = `<span class="rail-index">0</span><span class="rail-name">Vista general</span><span class="rail-h">todos</span>`;
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
      const chip = s.approx ? `<span class="chip chip-approx" title="Aproximado: sin cifra pública exacta">≈</span>` : `<span class="chip chip-src" title="${SOURCES[s.ref]?.label ?? ''}">${SOURCE_LABEL[s.source]}</span>`;
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
    rail.querySelectorAll('.rail-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    const v = vehicles.find(x => x.id === id);
    if (v) { renderSheet(v); sheet.classList.remove('hidden'); el('#presets').classList.remove('hidden'); }
    else {
      el('#hud-title').textContent = 'Vista general';
      el('#hud-subtitle').textContent = `${vehicles.length} vehículos a escala 1:1`;
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
  const dist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1).replace('.', ',')} km`);
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
    mVel.textContent = `${Math.round(st.velocity * 3.6).toLocaleString('es-ES')} km/h`;
    mDown.textContent = dist(st.downrange);
    mThr.textContent = `${Math.round(st.throttle * 100)} %`;
    for (const b of speeds) b.classList.toggle('active', Number(b.dataset.k) === st.speed);
  }

  function setMode(mode) {
    el('#mode-btn').innerHTML = (mode === 'fly' ? 'Vuelo libre' : 'Órbita') + ' <kbd>F</kbd>';
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
    scaleInfo.textContent = `distancia al objetivo ${distance < 10 ? distance.toFixed(1).replace('.', ',') : Math.round(distance)} m`;
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
