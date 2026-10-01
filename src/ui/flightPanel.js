/**
 * The X-15 flight's instruments, as a panel over the scene (the cockpit itself is phase 5): an
 * attitude indicator, the air data, the engine and propellant, the configuration, the runway's
 * distance and bearing, and the controls. Imperial units first, as the airplane's own gauges
 * read (knots, feet, pounds), with the metric alongside where it helps.
 */
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

export function createFlightPanel({ root, onStart, onEnd, onCamera }) {
  const el = document.createElement('section');
  el.className = 'x15-panel hidden';
  el.setAttribute('aria-label', 'X-15 flight instruments');
  el.innerHTML = `
    <div class="x15-top">
      <span class="eyebrow">X-15 #1 · 56-6670 · flight model from NASA flight data</span>
      <span class="x15-clock" id="x15-clock">T+0:00</span>
      <button type="button" class="x15-btn" id="x15-cam" title="Camera: chase, cockpit, tower, your own orbit (C)">Chase <kbd>C</kbd></button>
      <button type="button" class="x15-btn x15-end" id="x15-end" title="Back to the exhibit (Esc)">End <kbd>Esc</kbd></button>
    </div>
    <div class="x15-body">
      <canvas class="x15-adi" id="x15-adi" width="224" height="224" aria-label="Attitude indicator"></canvas>
      <dl class="x15-air">
        <div><dt>Mach</dt><dd id="x15-mach">—</dd></div>
        <div><dt>KEAS</dt><dd id="x15-keas">—</dd></div>
        <div><dt>Altitude</dt><dd id="x15-alt">—</dd></div>
        <div><dt>Vertical</dt><dd id="x15-vs">—</dd></div>
        <div><dt>α · β</dt><dd id="x15-ab">—</dd></div>
        <div><dt>Load</dt><dd id="x15-nz">—</dd></div>
        <div><dt>q̄</dt><dd id="x15-q">—</dd></div>
        <div><dt>Heading</dt><dd id="x15-hdg">—</dd></div>
      </dl>
      <dl class="x15-sys">
        <div><dt>XLR99</dt><dd id="x15-eng">off</dd></div>
        <div class="x15-bar"><span id="x15-thr"></span></div>
        <div><dt>Propellant</dt><dd id="x15-prop">—</dd></div>
        <div><dt>Stabilizer</dt><dd id="x15-dh">—</dd></div>
        <div><dt>Config</dt><dd id="x15-cfg">—</dd></div>
        <div><dt>Runway 13</dt><dd id="x15-rw">—</dd></div>
      </dl>
    </div>
    <ul class="x15-msgs" id="x15-msgs" aria-live="polite"></ul>
    <p class="x15-keys"><kbd>W</kbd><kbd>S</kbd> pitch · <kbd>A</kbd><kbd>D</kbd> roll · <kbd>Q</kbd><kbd>E</kbd> rudder · <kbd>I</kbd> engine · <kbd>R</kbd><kbd>F</kbd> throttle · <kbd>Space</kbd> jets · <kbd>G</kbd> gear · <kbd>H</kbd> all the controls</p>
    <div class="x15-result hidden" id="x15-result" role="status"></div>
  `;
  root.appendChild(el);

  const chooser = document.createElement('div');
  chooser.className = 'x15-chooser hidden';
  chooser.setAttribute('role', 'dialog');
  chooser.setAttribute('aria-label', 'Fly the X-15');
  chooser.innerHTML = `
    <div class="eyebrow">Fly the X-15</div>
    <p>The exhibit's airplane, on a six-degree-of-freedom model built from NASA's flight-measured aerodynamics. Land it on runway 13, north-west of the site.</p>
    <button type="button" class="x15-btn x15-go" data-s="drop">B-52 drop · 45,000 ft · Mach 0.8 <small>full propellant, 300 km uprange</small></button>
    <button type="button" class="x15-btn x15-go" data-s="approach">Approach · 9 km · 30 km out <small>propellant gone, glide in (≈ set-up)</small></button>
    <button type="button" class="x15-btn" data-s="">Cancel</button>
  `;
  root.appendChild(chooser);
  chooser.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    chooser.classList.add('hidden');
    if (b.dataset.s) onStart?.(b.dataset.s);
  });

  const $ = (id) => el.querySelector(id);
  $('#x15-end').addEventListener('click', () => onEnd?.());
  $('#x15-cam').addEventListener('click', () => onCamera?.());
  const adi = $('#x15-adi'), g = adi.getContext('2d');

  function drawADI(pitch, roll) {
    const W = adi.width, H = adi.height, cx = W / 2, cy = H / 2, R = W / 2 - 4, ppd = W / 56;
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.translate(cx, cy);
    g.rotate(-roll * Math.PI / 180);
    const y0 = pitch * ppd;
    g.fillStyle = '#3d6f9e'; g.fillRect(-W, -2 * H + y0, 2 * W, 2 * H);
    g.fillStyle = '#6b5236'; g.fillRect(-W, y0, 2 * W, 2 * H);
    g.strokeStyle = '#f2efe8'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-W, y0); g.lineTo(W, y0); g.stroke();
    g.lineWidth = 1; g.fillStyle = '#f2efe8'; g.font = `${Math.round(W / 16)}px "IBM Plex Mono", monospace`; g.textAlign = 'left';
    for (let p = -90; p <= 90; p += 5) {
      if (p === 0) continue;
      const y = y0 - p * ppd;
      if (Math.abs(y) > H) continue;
      const w = p % 10 === 0 ? 26 : 12;
      g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke();
      if (p % 10 === 0) g.fillText(String(p), w + 4, y + 3);
    }
    g.restore();
    // Fixed airplane symbol and bank scale.
    g.strokeStyle = '#d7a24a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - W * 0.22, cy); g.lineTo(cx - W * 0.07, cy); g.lineTo(cx, cy + W * 0.045); g.lineTo(cx + W * 0.07, cy); g.lineTo(cx + W * 0.22, cy); g.stroke();
    g.strokeStyle = 'rgba(236,233,226,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(-roll * Math.PI / 180);
    g.fillStyle = '#f2efe8'; g.beginPath(); g.moveTo(0, -R + 2); g.lineTo(-6, -R + 12); g.lineTo(6, -R + 12); g.closePath(); g.fill();
    g.restore();
  }

  let lastResult = null;
  function update(r) {
    const m = Math.floor(r.t / 60), s = Math.floor(r.t % 60);
    $('#x15-clock').textContent = `T+${m}:${String(s).padStart(2, '0')}${r.paused && !r.outcome ? ' · paused' : ''}`;
    $('#x15-mach').textContent = fmt(r.mach, 2);
    $('#x15-keas').textContent = `${fmt(r.keas)} kt`;
    $('#x15-alt').textContent = `${fmt(r.altitudeFt)} ft`;
    $('#x15-vs').textContent = `${fmt(r.vsFpm)} ft/min`;
    $('#x15-ab').textContent = `${fmt(r.alpha, 1)}° · ${fmt(r.beta, 1)}°`;
    $('#x15-nz').textContent = `${fmt(r.nz, 1)} g`;
    $('#x15-q').textContent = `${fmt(r.qbarPsf)} psf`;
    $('#x15-hdg').textContent = `${fmt(r.heading)}°`;
    $('#x15-eng').textContent = r.engine ? `${fmt(r.throttle * 100)} %` : 'off';
    $('#x15-thr').style.width = `${r.engine ? r.throttle * 100 : 0}%`;
    $('#x15-prop').textContent = `${fmt(r.propellantLb)} lb${r.burnLeft != null ? ` · ${fmt(r.burnLeft)} s` : ''}`;
    $('#x15-dh').textContent = `${fmt(r.dh, 1)}° · trim ${fmt(r.trim, 1)}°`;
    $('#x15-cfg').textContent = [r.sas ? 'SAS' : 'SAS off', r.rcs ? 'JETS' : null, r.speedBrake ? 'brakes' : null, r.flaps ? 'flaps' : null, r.gear ? 'gear down' : 'gear up'].filter(Boolean).join(' · ');
    const rw = r.runway;
    $('#x15-rw').textContent = `${fmt(Math.abs(rw.distKm), 1)} km · ${fmt(rw.bearing)}°`;
    $('#x15-cam').firstChild.textContent = `${r.camera[0].toUpperCase()}${r.camera.slice(1)} `;
    drawADI(r.pitch, r.roll);
    const list = $('#x15-msgs');
    const html = r.messages.map(t => `<li>${t}</li>`).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
    const res = $('#x15-result');
    if (r.outcome && r.outcome !== lastResult) {
      lastResult = r.outcome;
      const o = r.outcome, td = o.touchdown;
      const lines = [];
      if (o.kind === 'stopped') {
        lines.push(`<b>${o.stop?.onRunway ? 'Stopped on runway 13' : 'Stopped off the runway'}</b>`);
        if (td) lines.push(`Touchdown ${fmt(td.sink / 0.3048, 1)} ft/s at ${fmt(td.speedKt)} kt, α ${fmt(td.alpha, 1)}°, ${fmt(td.fromThreshold)} m past the threshold, ${fmt(Math.abs(td.offCentre))} m ${td.offCentre >= 0 ? 'right' : 'left'} of the centre line.`);
        if (o.stop) lines.push(`Slid to a stop ${fmt(o.stop.fromThreshold)} m down the runway. Flight time ${Math.floor(o.t / 60)} min ${Math.round(o.t % 60)} s.`);
      } else {
        lines.push('<b>Crash</b>');
        lines.push(o.why);
      }
      res.innerHTML = `${lines.map(l => `<p>${l}</p>`).join('')}<div class="x15-result-btns"><button type="button" class="x15-btn" data-again="drop">Fly the drop again</button><button type="button" class="x15-btn" data-again="approach">Approach</button><button type="button" class="x15-btn" data-again="">Back to the exhibit</button></div>`;
      res.classList.remove('hidden');
    } else if (!r.outcome && lastResult) {
      lastResult = null;
      res.classList.add('hidden');
    }
  }
  el.querySelector('#x15-result').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.again) onStart?.(b.dataset.again); else onEnd?.();
  });

  return {
    show(on) {
      el.classList.toggle('hidden', !on);
      root.classList.toggle('is-x15', !!on);
      if (!on) { lastResult = null; el.querySelector('#x15-result').classList.add('hidden'); }
    },
    choose(on = true) { chooser.classList.toggle('hidden', !on); if (on) chooser.querySelector('.x15-go')?.focus(); },
    get choosing() { return !chooser.classList.contains('hidden'); },
    update,
  };
}
