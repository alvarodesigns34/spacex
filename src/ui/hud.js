/**
 * HUD: vehicle rail, data sheet, view presets, scale bar and controls.
 * Pure DOM; the 3D layer talks to it through the returned API.
 */
import { SOURCES, SOURCE_LABEL } from '../data/specs.js';

const fmtHeight = (h) => `${h >= 10 ? Math.round(h) : h} m`;
const THREE_DEG20 = Math.PI / 9;

export function createHUD({ vehicles, onSelect, onPreset, onToggle, onMode, onWalk, onSun, onReset, onLaunch, onReentry, onFly, onLaunchAbort, onLaunchSpeed, onLaunchSound, onLaunchPause, onLaunchSeek, onLaunchRestart, onLaunchCamera, onTour, onHelp }) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <header class="hud-header">
      <div class="eyebrow">SpaceX Vehicle Center</div>
      <h1 class="title" id="hud-title">—</h1>
      <div class="subtitle" id="hud-subtitle"></div>
    </header>

    <div class="rail" id="rail" role="group" aria-label="Vehicles"></div>

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

    <div class="presets" id="presets" role="group" aria-label="Views"></div>

    <div class="tools">
      <label class="tool"><input type="checkbox" id="tg-labels" checked> Labels <kbd>L</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-ruler" checked> Ruler <kbd>R</kbd></label>
      <label class="tool"><input type="checkbox" id="tg-humans" checked> 1.80 m figures</label>
      <label class="tool tool-sun">Sun <input type="range" id="sun" min="4" max="75" value="20" step="1" title="Sun elevation, from low evening light to midday"></label>
      <button class="tool tool-btn tool-launch" id="launch-btn" title="Starship launch sequence from Pad 2 (G)">Starship · Launch <kbd>G</kbd></button>
      <button class="tool tool-btn" id="reentry-btn" title="Starship's re-entry and splashdown, on flight 14's timeline (X)">Reentry <kbd>X</kbd></button>
      <button class="tool tool-btn" id="fly-btn" title="Fly the X-15: a drop from the B-52 or an approach, landing on runway 13 (J)">X-15 · Fly <kbd>J</kbd></button>
      <button class="tool tool-btn" id="tour-btn" title="Guided tour of the centre (P)">Tour <kbd>P</kbd></button>
      <button class="tool tool-btn" id="mode-btn" title="Switch camera mode (F)">Orbit <kbd>F</kbd></button>
      <button class="tool tool-btn" id="walk-btn" type="button" aria-pressed="false" title="Walk the apron at eye height, 1.7 m (V)">Walk <kbd>V</kbd></button>
      <button class="tool tool-btn" id="clean-btn" type="button" aria-pressed="false" title="Hide the interface">Clean scene</button>
      <button class="tool tool-btn" id="help-btn" title="Quick guide: controls and shortcuts (H)">Guide <kbd>H</kbd></button>
    </div>

    <!-- The only way back from the clean scene. (This was a four-button dock for phones; the
         simulation is designed for a desktop computer and the phone layout was retired.) -->
    <div class="dock" id="dock">
      <button type="button" class="dock-btn" id="dock-clean" aria-pressed="false">Show interface</button>
    </div>

    <div class="mission hidden" id="mission">
      <div class="mission-head">
        <span class="mission-clock" id="mission-clock">T−00:00:40</span>
        <span class="mission-phase" id="mission-phase">Terminal count</span>
        <button type="button" class="icon-btn mission-fold" id="mission-fold" aria-expanded="true" aria-controls="mission" title="Fold the panel to the clock and the controls">–</button>
        <span class="mission-next" id="mission-next"></span>
      </div>
      <p class="mission-kind">Flight 14 timeline (V3, Pad 2, SpaceX) · ends in the tower's arms, which flight 14 did not · trajectories computed</p>
      <div class="mission-telemetry">
        <div class="mt-veh mt-booster">
          <svg class="mt-engines" id="mt-engines-booster" viewBox="-5 -5 10 10" aria-hidden="true"></svg>
          <div class="mt-read">
            <span class="mt-name">Super Heavy <em id="mb-lit"></em></span>
            <span class="mt-row"><i>Speed</i><b id="mb-vel">0 km/h</b></span>
            <span class="mt-row"><i>Altitude</i><b id="mb-alt">0 m</b></span>
          </div>
        </div>
        <div class="mt-veh mt-ship">
          <svg class="mt-engines" id="mt-engines-ship" viewBox="-5 -5 10 10" aria-hidden="true"></svg>
          <div class="mt-read">
            <span class="mt-name">Starship <em id="ms-lit"></em></span>
            <span class="mt-row"><i>Speed</i><b id="ms-vel">0 km/h</b></span>
            <span class="mt-row"><i>Altitude</i><b id="ms-alt">0 m</b></span>
          </div>
        </div>
      </div>
      <figure class="mission-plot" aria-label="Altitude profile of the flight · click to jump to that moment">
        <svg id="mission-plot" viewBox="0 0 400 74" preserveAspectRatio="none"><title>Click or drag to jump to that moment · ← → step between milestones</title></svg>
        <figcaption><span class="mp-ship">Ship</span><span class="mp-booster">Booster</span><span class="mp-scale">altitude, square-root scale</span></figcaption>
      </figure>
      <div class="mission-foot">
        <button type="button" class="mission-pause" id="mission-pause" aria-pressed="false" title="Pause the mission clock (K)">Pause <kbd>K</kbd></button>
        <div class="mission-speeds" id="mission-speeds" role="group" aria-label="Playback speed">
          <button type="button" data-k="0.25" aria-pressed="false" aria-label="Speed ×0.25, slow motion">×¼</button><button type="button" data-k="1" class="active" aria-pressed="true" aria-label="Speed ×1">×1</button><button type="button" data-k="2" aria-pressed="false" aria-label="Speed ×2">×2</button><button type="button" data-k="5" aria-pressed="false" aria-label="Speed ×5">×5</button><button type="button" data-k="10" aria-pressed="false" aria-label="Speed ×10">×10</button>
        </div>
        <button class="mission-sound" id="mission-sound" aria-pressed="false" title="Engine sound, delayed by distance at the speed of sound">Sound off</button>
        <button type="button" class="mission-cam" id="mission-cam" title="Camera: the broadcast shots, or your own orbit riding with the booster or the ship (C)">Camera · director <kbd>C</kbd></button>
        <button type="button" class="mission-restart" id="mission-restart" title="Back to T−40 and run again">Restart</button>
        <button class="mission-abort" id="mission-abort">End</button>
      </div>
      <details class="mission-note"><summary>Flight 14 timeline · sources and limits</summary><p><b>Every time on this clock is SpaceX's own</b>, from its published timeline of flight 14 (28 September 2026), the first orbital flight of the V3 vehicle and Pad 2 that the exhibit models: GO for launch T−0:30 · flame diverter T−0:17 · booster engine startup T−0:03 · liftoff T+0:00 · Max-Q 0:58 · MECO 2:20 · hot-staging 2:22 · boostback 2:27–3:07 · landing burn 6:36–7:01 · Starship engine cutoff 8:11. Flights 12 and 13 publish the same structure within seconds. <b>One thing is not flight 14's:</b> its booster was planned to splash down in the Gulf, and here the landing burn ends in the tower's arms; no V3 booster has been caught yet. Between the milestones, the ascent's speed curve and separation speed are authored; the gravity turn is solved so MECO comes at the ≈64 km Wikipedia gives. After separation the ship is <i>integrated</i> as a rocket from its published thrust and propellant, with assumed specific impulses; its steering and its non-propellant mass are solved so the burn ends at 8:11 level at 195 km and at the speed of the top of flight 12's published arc (apogee 195 km, perigee −7 km). The booster's return is <i>computed</i> with gravity, drag and two burns, solved so the cited times are met and it goes transonic five seconds before its landing burn, as flight 7's did. Engine counts follow SpaceX's summaries: five through hot-staging, all 33 for the boostback's high-thrust portion, then 13; 13 → 5 → 3 in the landing burn. Tower clear, supersonic, booster apogee and booster transonic are read off this model, not cited, and the panel marks their times ≈. No V3 telemetry (speed and height second by second) is published, so neither curve is flight data. The sound, when on, is synthesised: a rumble and crackle that reach the camera at 343 m/s.</p></details>
    </div>
    <div class="callout" id="callout" aria-live="polite"></div>

    <aside class="tour-card hidden" id="tour-card" aria-live="polite" aria-label="Guided tour">
      <div class="eyebrow" id="tour-step"></div>
      <p class="tour-text" id="tour-text"></p>
      <a class="tour-src" id="tour-src" target="_blank" rel="noopener"></a>
    </aside>

    <div class="scale" id="scale">
      <div class="scale-bar"><span id="scale-label">10 m</span></div>
      <div class="scale-info" id="scale-info"></div>
    </div>

    <div class="coach hidden" id="coach" role="note" aria-label="How to look around">
      <span class="coach-tip"><b>Drag</b> to orbit · <b>scroll</b> to zoom · <b>V</b> to walk</span>
      <span class="coach-tip"><b>1–${vehicles.length}</b> to visit an exhibit, then pick a view</span>
      <span class="coach-tip"><b>G</b> launches Starship · <b>H</b> opens the quick guide</span>
      <button type="button" class="coach-close" id="coach-close" aria-label="Dismiss these tips">×</button>
    </div>

    <div class="help hidden" id="help" role="dialog" aria-modal="true" aria-label="Quick guide: controls and keyboard shortcuts">
      <div class="help-card guide">
        <div class="guide-top">
          <div>
            <div class="eyebrow">Quick guide</div>
            <h2 class="guide-title">Getting around the Vehicle Center</h2>
          </div>
          <button class="btn" id="help-close">Close <kbd>Esc</kbd></button>
        </div>
        <ol class="guide-start" aria-label="First steps">
          <li><b>Pick a vehicle</b> in the list on the left, or press <kbd>1</kbd>–<kbd>${vehicles.length}</kbd>.</li>
          <li><b>Choose a view</b> in the bar at the bottom: engines, heat shield, tower…</li>
          <li><b>Press <kbd>G</kbd></b> to launch Starship, <kbd>X</kbd> for its re-entry, or <kbd>P</kbd> for a guided tour.</li>
        </ol>
        <div class="guide-grid">
          <section class="guide-sec" data-mode="orbit">
            <h3>Look around <span class="guide-here">you are here</span></h3>
            <dl>
              <dt>Drag</dt><dd>turn around the vehicle</dd>
              <dt>Wheel</dt><dd>zoom towards the cursor</dd>
              <dt>Right drag</dt><dd>slide sideways</dd>
              <dt>Double-click</dt><dd>turn around that point</dd>
            </dl>
          </section>
          <section class="guide-sec" data-mode="walk">
            <h3>Walk <kbd>V</kbd> <span class="guide-here">you are here</span></h3>
            <dl>
              <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>walk, at 1.7 m eye height</dd>
              <dt>Drag</dt><dd>look around</dd>
              <dt>Wheel · <kbd>Shift</kbd></dt><dd>walking pace · run</dd>
              <dt>Double-click</dt><dd>walk there, through the fence gate if needed</dd>
            </dl>
          </section>
          <section class="guide-sec" data-mode="fly">
            <h3>Fly <kbd>F</kbd> <span class="guide-here">you are here</span></h3>
            <dl>
              <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>move · drag to look</dd>
              <dt><kbd>Q</kbd> <kbd>E</kbd></dt><dd>down · up (also <kbd>C</kbd> · <kbd>space</kbd>)</dd>
              <dt><kbd>Shift</kbd> · <kbd>Ctrl</kbd></dt><dd>four times faster · slower</dd>
              <dt>Wheel</dt><dd>flying speed</dd>
            </dl>
          </section>
          <section class="guide-sec" data-mode="launch">
            <h3>Launch <kbd>G</kbd> <span class="guide-here">you are here</span></h3>
            <dl>
              <dt><kbd>K</kbd> · <kbd>space</kbd></dt><dd>pause · resume</dd>
              <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>previous · next milestone</dd>
              <dt><kbd>C</kbd></dt><dd>camera: broadcast shots, or ride with the booster or the ship</dd>
              <dt>Panel</dt><dd>×¼ to ×10 speed · click the flight profile to jump</dd>
              <dt><kbd>X</kbd></dt><dd>the ship's re-entry and splashdown, flight 14 (on-board, chase and buoy cameras)</dd>
            </dl>
          </section>
          <section class="guide-sec" data-mode="x15">
            <h3>Fly the X-15 <kbd>J</kbd> <span class="guide-here">you are here</span></h3>
            <dl>
              <dt><kbd>W</kbd><kbd>S</kbd> · <kbd>A</kbd><kbd>D</kbd> · <kbd>Q</kbd><kbd>E</kbd></dt><dd>pitch · roll · rudder (arrows too)</dd>
              <dt><kbd>I</kbd> · <kbd>R</kbd><kbd>F</kbd></dt><dd>XLR99 start/stop · throttle 50–100 %</dd>
              <dt><kbd>,</kbd><kbd>.</kbd> · hold <kbd>space</kbd></dt><dd>stabilizer trim · reaction jets</dd>
              <dt><kbd>B</kbd> <kbd>N</kbd> <kbd>G</kbd> <kbd>Y</kbd></dt><dd>speed brakes · flaps · gear (once) · dampers</dd>
              <dt><kbd>C</kbd> · <kbd>K</kbd> · <kbd>Esc</kbd></dt><dd>camera · pause · back to the exhibit</dd>
            </dl>
          </section>
          <section class="guide-sec">
            <h3>Exhibits</h3>
            <dl>
              <dt><kbd>1</kbd>–<kbd>${vehicles.length}</kbd> · <kbd>0</kbd></dt><dd>go to a vehicle · the whole centre</dd>
              <dt><kbd>P</kbd></dt><dd>guided tour; any drag or click ends it</dd>
              <dt><kbd>T</kbd></dt><dd>data sheet, with every source</dd>
            </dl>
          </section>
          <section class="guide-sec">
            <h3>On screen</h3>
            <dl>
              <dt><kbd>L</kbd> · <kbd>R</kbd></dt><dd>labels · 1:1 ruler</dd>
              <dt><kbd>H</kbd> · <kbd>?</kbd></dt><dd>this guide</dd>
              <dt>Clean scene</dt><dd>hide the interface; one button brings it back</dd>
            </dl>
          </section>
        </div>
        <p class="help-note">1:1 scale — one scene unit is one metre. Figures marked <span class="chip chip-approx">≈</span> have no exact published value and were reconstructed from imagery.</p>
      </div>
    </div>
    </div>
  `;

  // ---- rail ----
  const rail = root.querySelector('#rail');
  vehicles.forEach((v, i) => {
    const b = document.createElement('button');
    // Selection buttons, not tabs: these move the camera and swap the sheet, there is no tab
    // panel behind them and no arrow-key pattern, so role="tab" promised what they did not do.
    // aria-pressed says which one is chosen, the group's label says what the choice is.
    b.type = 'button';
    b.className = 'rail-item';
    b.dataset.id = v.id;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="rail-index">${i + 1}</span><span class="rail-name">${v.name}</span><span class="rail-h">${fmtHeight(v.id === 'starlink' ? v.footprint : v.height)}${v.id === 'starlink' ? ' <small>span</small>' : ''}</span>`;
    b.addEventListener('click', () => { onSelect(v.id); });
    rail.appendChild(b);
  });
  const overview = document.createElement('button');
  overview.type = 'button';
  overview.className = 'rail-item rail-overview';
  overview.setAttribute('aria-pressed', 'true');
  overview.innerHTML = `<span class="rail-index">0</span><span class="rail-name">Overview</span><span class="rail-h">all</span>`;
  overview.addEventListener('click', () => { onReset(); });
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
      b.type = 'button';
      b.dataset.preset = pr.id;
      b.setAttribute('aria-pressed', String(i === 0));
      b.addEventListener('click', () => { onPreset(v.id, pr.id); });
      p.appendChild(b);
    });
  }

  function setPreset(id) {
    root.querySelectorAll('.preset').forEach(b => {
      const active = b.dataset.preset === id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  function setActive(id) {
    rail.querySelectorAll('.rail-item').forEach(b => {
      // `on` already accounts for the overview item, which has no dataset.id; toggling on the
      // raw comparison instead meant the ARIA state said "selected" while nothing was painted,
      // so the overview row never highlighted and the two states disagreed.
      const on = b.dataset.id === id || (!id && b.classList.contains('rail-overview'));
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
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
  el('#walk-btn').addEventListener('click', () => onWalk?.());
  const tourBtn = el('#tour-btn');
  tourBtn.addEventListener('click', () => onTour?.());
  /** null ends the tour; otherwise {step, total} lights the button and shows progress. */
  const tourCard = el('#tour-card');
  function setTour(st) {
    tourBtn.classList.toggle('is-live', !!st);
    tourBtn.innerHTML = st ? `Tour ${st.step}/${st.total} <kbd>P</kbd>` : 'Tour <kbd>P</kbd>';
    tourCard.classList.toggle('hidden', !st?.text);
    document.body.classList.toggle('is-touring', !!st);
    if (!st?.text) return;
    hideCoach();
    el('#tour-step').textContent = `Tour · ${st.step} of ${st.total} · ${st.name ?? ''}`;
    el('#tour-text').textContent = st.text;
    const src = el('#tour-src'), ref = SOURCES[st.src];
    src.textContent = ref ? `Source: ${ref.label}` : '';
    if (ref) src.href = ref.url; else src.removeAttribute('href');
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

  // The sheet is a drawer. It starts closed so it does not cover the vehicle; T or the
  // header button opens it.
  toggleSheet(true);
  const cleanBtn = root.querySelector('#clean-btn');
  const dockClean = root.querySelector('#dock-clean');
  function setClean(on) {
    root.classList.toggle('is-clean', on);
    cleanBtn.setAttribute('aria-pressed', String(on));
    dockClean.setAttribute('aria-pressed', String(on));
  }
  cleanBtn.addEventListener('click', () => setClean(!root.classList.contains('is-clean')));
  dockClean.addEventListener('click', () => setClean(!root.classList.contains('is-clean')));

  // ---- Mission panel ----
  const mission = el('#mission');
  const launchBtn = el('#launch-btn');
  new ResizeObserver(() => root.style.setProperty('--mission-height', `${mission.getBoundingClientRect().height}px`)).observe(mission);
  const mClock = el('#mission-clock'), mPhase = el('#mission-phase'), mNext = el('#mission-next');
  const readout = {
    booster: { vel: el('#mb-vel'), alt: el('#mb-alt'), lit: el('#mb-lit'), dial: el('#mt-engines-booster'), dots: [], last: -1 },
    ship: { vel: el('#ms-vel'), alt: el('#ms-alt'), lit: el('#ms-lit'), dial: el('#mt-engines-ship'), dots: [], last: -1 },
  };
  const callout = el('#callout');
  const soundBtn = el('#mission-sound');
  const speeds = [...root.querySelectorAll('#mission-speeds button')];
  launchBtn.addEventListener('click', () => onLaunch?.());
  const reentryBtn = el('#reentry-btn');
  reentryBtn.addEventListener('click', () => onReentry?.());
  el('#fly-btn').addEventListener('click', () => onFly?.());
  el('#mission-abort').addEventListener('click', () => onLaunchAbort?.());
  el('#mission-restart').addEventListener('click', () => onLaunchRestart?.());
  const camBtn = el('#mission-cam');
  camBtn.addEventListener('click', () => onLaunchCamera?.());
  function showCamera(st) {
    const director = st.director ?? st.follow === 'director';
    // In the re-entry, once the visitor has dragged the camera it is their orbit riding on the ship.
    const label = st.chapter === 'reentry' ? (st.riding ? 'riding the ship' : { director: 'director', onboard: 'on board', chase: 'chase' }[st.follow] ?? st.follow)
      : director ? 'director' : st.follow === 'ship' ? 'riding the ship' : 'riding the booster';
    const html = `Camera · ${label} <kbd>C</kbd>`;
    if (camBtn.innerHTML !== html) camBtn.innerHTML = html;
    camBtn.classList.toggle('active', !director);
  }
  // The panel can fold down to the clock, the phase and the transport row. On a phone held
  // sideways it starts folded: expanded, it covered all but the top 70 px of an 844 × 390
  // screen and the rocket it describes.
  const foldBtn = el('#mission-fold');
  function foldMission(on) {
    mission.classList.toggle('is-compact', on);
    foldBtn.setAttribute('aria-expanded', String(!on));
    foldBtn.textContent = on ? '+' : '–';
    foldBtn.setAttribute('aria-label', on ? 'Expand the mission panel' : 'Fold the mission panel');
  }
  foldBtn.addEventListener('click', () => foldMission(!mission.classList.contains('is-compact')));
  foldMission(false);
  const pauseBtn = el('#mission-pause');
  pauseBtn.addEventListener('click', () => onLaunchPause?.(pauseBtn.getAttribute('aria-pressed') !== 'true'));
  function showPaused(on) {
    if (pauseBtn.getAttribute('aria-pressed') === String(on)) return;
    pauseBtn.setAttribute('aria-pressed', String(on));
    pauseBtn.classList.toggle('active', on);
    pauseBtn.innerHTML = `${on ? 'Resume' : 'Pause'} <kbd>K</kbd>`;
  }
  // Sound is opt-in: nothing plays until this is pressed, and the choice is remembered.
  function setSound(on) {
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    soundBtn.classList.toggle('active', on);
  }
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    setSound(on);
    try { localStorage.setItem('vc-sound-1', on ? '1' : '0'); } catch { /* storage unavailable */ }
    onLaunchSound?.(on);
  });
  const soundWanted = () => { try { return localStorage.getItem('vc-sound-1') === '1'; } catch { return false; } };
  setSound(soundWanted());

  /**
   * Engine dials, the way the webcast shows them: one circle per engine, seen from below,
   * lit in the order the engines start. Built once from the layout the simulation exports.
   */
  function setEngines(layout) {
    for (const [key, rings] of Object.entries(layout)) {
      const r = readout[key];
      if (!r) continue;
      const outer = Math.max(...rings.map(g => g.r + g.size));
      const k = 4.6 / outer;
      r.dial.innerHTML = '';
      r.dots = [];
      for (const g of rings) {
        for (let i = 0; i < g.n; i++) {
          const a = g.phase + (g.angles ? g.angles[i] : (i / g.n) * Math.PI * 2);
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', (Math.sin(a) * g.r * k).toFixed(2));
          c.setAttribute('cy', (Math.cos(a) * g.r * k).toFixed(2));
          c.setAttribute('r', (g.size * k * 0.92).toFixed(2));
          r.dial.appendChild(c);
          r.dots.push(c);
        }
      }
      r.last = -1;
    }
  }
  let lastT = null, calloutTimer = 0;
  /** A short note over the scene (walking pace and the like), the same banner as the milestones. */
  function notice(text, ms) { showCallout(text, ms); }
  function showCallout(text, ms = 3200) {
    callout.textContent = text;
    callout.classList.toggle('is-long', text.length > 60);
    callout.classList.add('is-on');
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => callout.classList.remove('is-on'), ms);
  }
  let milestones = [];
  // The buttons only ask; which one is lit is read back from the simulation in setMission,
  // so the panel cannot claim a multiplier the clock is not actually using.
  // The pressed state changes with the click, not on the next simulation frame: on a slow
  // device the button a visitor had just pressed was still announced as the old speed.
  const showSpeed = (k) => { for (const x of speeds) { const on = Number(x.dataset.k) === k; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); } };
  for (const b of speeds) b.addEventListener('click', () => { showSpeed(Number(b.dataset.k)); onLaunchSpeed?.(Number(b.dataset.k)); });
  const clockText = (t) => {
    const a = Math.abs(t);
    return `T${t < 0 ? '−' : '+'}${String(Math.floor(a / 3600)).padStart(2, '0')}:${String(Math.floor((a % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(a % 60)).padStart(2, '0')}`;
  };
  // The panel's caption and its sources note belong to the sequence running: the launch's by
  // default, the re-entry's while that chapter plays.
  const kindEl = mission.querySelector('.mission-kind'), noteEl = mission.querySelector('.mission-note');
  const launchText = { kind: kindEl.innerHTML, note: noteEl.innerHTML };
  function setMissionText(t) {
    kindEl.innerHTML = t?.kind ?? launchText.kind;
    noteEl.innerHTML = t?.note ?? launchText.note;
  }
  const dist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);
  // ---- Flight profile plot ----
  // The whole flight at a glance: the ship's climb, the booster's return, the milestones as
  // ticks and a cursor at the current instant. Altitude on a square-root scale, so the
  // booster's 96 km arc and the pad-level catch both read beside a ship heading for orbit.
  const plot = el('#mission-plot');
  let plotSpan = null;
  const PLOT_NS = 'http://www.w3.org/2000/svg';
  function setTrajectory({ t0, t1, ship, booster, events, engines }) {
    plotSpan = { t0, t1 };
    milestones = events;
    if (engines) setEngines(engines);
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
  // The profile is also the timeline: a click or a drag seeks the mission there. seek() is
  // deterministic (the cloud is re-simulated from ignition), so a jump lands on the frame the
  // playback would have reached. Drags are coalesced to one seek per animation frame.
  let seekRaf = 0, seekWant = null;
  const tAtPointer = (e) => {
    const r = plot.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
    return plotSpan ? plotSpan.t0 + u * (plotSpan.t1 - plotSpan.t0) : null;
  };
  const queueSeek = (t) => {
    if (t === null) return;
    seekWant = t;
    if (seekRaf) return;
    seekRaf = requestAnimationFrame(() => { seekRaf = 0; onLaunchSeek?.(seekWant); });
  };
  plot.addEventListener('pointerdown', (e) => { plot.setPointerCapture?.(e.pointerId); queueSeek(tAtPointer(e)); });
  plot.addEventListener('pointermove', (e) => { if (plot.hasPointerCapture?.(e.pointerId)) queueSeek(tAtPointer(e)); });
  /** The milestone before or after t, for the arrow keys. */
  function milestoneStep(t, dir) {
    const ts = milestones.map(m => m[0]);
    if (dir > 0) return ts.find(x => x > t + 0.5) ?? null;
    return [...ts].reverse().find(x => x < t - 0.5) ?? plotSpan?.t0 ?? null;
  }
  /** Called every frame while a sequence runs; null puts the panel away. */
  function setMission(st) {
    if (!st) {
      mission.classList.add('hidden');
      document.body.classList.remove('is-flying');
      launchBtn.classList.remove('is-live');
      reentryBtn.classList.remove('is-live');
      callout.classList.remove('is-on');
      lastT = null;
      return;
    }
    mission.classList.remove('hidden');
    const reentry = st.chapter === 'reentry';
    mission.classList.toggle('is-reentry', reentry);
    hideCoach();
    document.body.classList.add('is-flying');
    launchBtn.classList.toggle('is-live', !reentry);
    reentryBtn.classList.toggle('is-live', reentry);
    mClock.textContent = clockText(st.t);
    mPhase.textContent = st.phase;
    // "T+01:02", without the hours the main clock carries.
    const short = st.next && clockText(st.next.t);
    // A time read off the model (tower clear, supersonic, booster apogee, booster transonic) is
    // marked ≈, so it is not taken for a flight's published timeline.
    const est = st.next?.src === 'model' ? '≈' : '';
    // Without the hours while there are none; the re-entry runs nine and a half hours in.
    const nextTxt = short && (short.slice(2, 4) === '00' ? `${short.slice(0, 2)}${short.slice(5)}` : short);
    mNext.textContent = short ? `Next · ${st.next.label} ${est}${nextTxt}` : '';
    for (const key of ['booster', 'ship']) {
      const r = readout[key], v = st[key];
      if (!v) continue;
      r.vel.textContent = `${Math.round(v.velocity * 3.6).toLocaleString('en-US')} km/h`;
      r.alt.textContent = dist(v.altitude);
      if (v.lit !== r.last) {
        r.last = v.lit;
        r.dots.forEach((d, i) => d.classList.toggle('on', i < v.lit));
        r.lit.textContent = v.lit ? `${v.lit} lit` : '';
      }
    }
    // Callouts only on playback, as a milestone is crossed: a seek or a jump across the
    // timeline is not the moment an event happens. Playback steps reach 5 s of mission (a
    // 0,5 s frame at ×10, missionClock.js), so anything up to 6 s is still playback.
    if (lastT !== null && st.t > lastT && st.t - lastT <= 6) {
      const hit = milestones.filter(([t]) => t > lastT && t <= st.t).pop();
      if (hit) showCallout(hit[1]);
    }
    lastT = st.t;
    showPaused(!!st.paused);
    showCamera(st);
    for (const b of speeds) {
      const on = Number(b.dataset.k) === st.speed;
      b.classList.toggle('active', on);
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    }
    const cur = plotSpan && plot.querySelector('#mp-cursor');
    if (cur) {
      const x = Math.max(0, Math.min(400, ((st.t - plotSpan.t0) / (plotSpan.t1 - plotSpan.t0)) * 400));
      cur.setAttribute('x1', x); cur.setAttribute('x2', x);
    }
  }

  function setMode(mode) {
    el('#mode-btn').innerHTML = (mode === 'fly' ? 'Free flight' : 'Orbit') + ' <kbd>F</kbd>';
    root.classList.toggle('fly', mode === 'fly');
    root.classList.toggle('walk', mode === 'walk');
    el('#walk-btn').setAttribute('aria-pressed', String(mode === 'walk'));
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
      const go = () => { onSelect(st.id); };
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
  function hideLoading() {
    loading.classList.add('done'); setTimeout(() => loading.remove(), 700);
    // Desktop only: a phone, a tablet or a small window is told once, and can carry on.
    const small = window.innerWidth < 900 || window.innerHeight < 560 || matchMedia('(pointer: coarse)').matches;
    let seen = false;
    try { seen = localStorage.getItem('vc-desktop-note-1') === '1'; } catch { /* storage unavailable */ }
    if (!small || seen) return;
    const note = document.createElement('div');
    note.className = 'desktop-note';
    note.setAttribute('role', 'dialog');
    note.setAttribute('aria-label', 'Designed for desktop');
    note.innerHTML = '<b>Designed for a desktop computer.</b><br>The SpaceX Vehicle Center is built for a desktop or laptop with a keyboard, a mouse and a large screen. On this device the controls may not fit and the scene may run slowly.<br><button class="btn" type="button">Continue anyway</button>';
    note.querySelector('button').addEventListener('click', () => {
      note.remove();
      try { localStorage.setItem('vc-desktop-note-1', '1'); } catch { /* storage unavailable */ }
    });
    document.body.appendChild(note);
  }

  function toggle(name, value) {
    const map = { labels: '#tg-labels', ruler: '#tg-ruler', humans: '#tg-humans' };
    if (map[name]) el(map[name]).checked = value;
  }

  // ---- first-visit tips ----
  // Three lines for someone who has never used the page: how to move, how to reach the
  // exhibits, how to launch. They go at the first real interaction with the scene (a drag,
  // a wheel, a key) or after 20 s, and a visitor who has seen them does not see them again.
  // Storage is a convenience: in a private window it may throw, and then the tips simply
  // show once per visit.
  const coach = root.querySelector('#coach');
  const COACH_KEY = 'vc-coach-seen-1';
  let coachTimer = 0;
  const hideCoach = () => {
    if (coach.classList.contains('hidden')) return;
    coach.classList.add('hidden');
    clearTimeout(coachTimer);
    try { localStorage.setItem(COACH_KEY, '1'); } catch { /* storage unavailable */ }
    for (const [t, f] of coachListeners) window.removeEventListener(t, f, true);
  };
  const coachListeners = [];
  const showCoach = (ms = 20000) => {
    let seen = false;
    try { seen = localStorage.getItem(COACH_KEY) === '1'; } catch { /* storage unavailable */ }
    if (seen) return;
    coach.classList.remove('hidden');
    if (ms) coachTimer = setTimeout(hideCoach, ms);
    const onScene = (e) => { if (!coach.contains(e.target)) hideCoach(); };
    const onKey = (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey) hideCoach(); };
    coachListeners.push(['pointerdown', onScene], ['wheel', onScene], ['keydown', onKey]);
    for (const [t, f] of coachListeners) window.addEventListener(t, f, true);
  };
  root.querySelector('#coach-close').addEventListener('click', hideCoach);

  return { toggleSound: () => soundBtn.click(), setActive, setPreset, setMode, setScale, setProgress, hideLoading, toggleSheet, toggle, setMission, setMissionText, setTrajectory, setTour, showHelp, setMap, setMapCamera, showCoach, hideCoach, soundWanted, milestoneStep, notice };
}
