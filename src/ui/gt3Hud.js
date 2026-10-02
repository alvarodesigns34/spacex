/**
 * The Porsche's instruments while it drives, and the drive's controls. In the manner of the
 * 992's own cluster (≈, not a copy of it): a rev counter to 9,000 rpm with its shift light,
 * the gear in the middle, the speed in km/h; and the drive's own readouts — DRS, ABS,
 * PSM, the slide angle, the lateral g, the lap time.
 */
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const lapTime = (t) => (t === null || t === undefined ? '—' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);

export function createGt3Hud({ root, onEnd, onCamera, onRestart, onPause, onTraction, onSound }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'f16-hud gt3-hud hidden';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');

  const bar = document.createElement('section');
  bar.className = 'f16-bar gt3-bar hidden';
  bar.setAttribute('aria-label', 'Porsche 911 GT3 RS drive');
  bar.innerHTML = `
    <span class="eyebrow">Porsche 911 GT3 RS · 386 kW, seven-speed PDK, Porsche's published figures</span>
    <button type="button" class="f16-btn" id="gt3-cam" title="Camera: chase, driver, bonnet, trackside, your own orbit (C)">Chase <kbd>C</kbd></button>
    <button type="button" class="f16-btn" id="gt3-tc" aria-pressed="true" title="PSM (T): traction and stability control, on as on the road; off, the car is all yours">PSM <kbd>T</kbd></button>
    <button type="button" class="f16-btn" id="gt3-pause" aria-pressed="false" title="Pause (K)">Pause <kbd>K</kbd></button>
    <button type="button" class="f16-btn" id="gt3-sound" aria-pressed="false" title="Sound (M): the flat six, the tyres and the wind, synthesised; off until you turn it on">Sound <kbd>M</kbd></button>
    <button type="button" class="f16-btn" id="gt3-restart" title="Back to the skid pad (Enter)">Pad <kbd>Enter</kbd></button>
    <button type="button" class="f16-btn f16-end" id="gt3-end" title="Back to the exhibit (Esc)">End <kbd>Esc</kbd></button>
    <p class="f16-keys"><kbd>W</kbd> throttle · <kbd>S</kbd> brake, held when stopped: reverse · <kbd>A</kbd><kbd>D</kbd> steer · <kbd>Space</kbd> parking brake: tap it into a corner to drift, then throttle and counter-steer · <kbd>C</kbd> camera · <kbd>M</kbd> sound — the gearbox shifts by itself</p>
    <ul class="f16-msgs" id="gt3-msgs" aria-live="polite"></ul>
  `;
  root.appendChild(bar);
  const $ = (id) => bar.querySelector(id);
  $('#gt3-end').addEventListener('click', () => onEnd?.());
  $('#gt3-cam').addEventListener('click', () => onCamera?.());
  $('#gt3-restart').addEventListener('click', () => onRestart?.());
  $('#gt3-pause').addEventListener('click', () => onPause?.());
  $('#gt3-tc').addEventListener('click', () => onTraction?.());
  $('#gt3-sound').addEventListener('click', () => onSound?.());

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  let lastMsgs = '';
  function update(r) {
    if (!r) return;
    $('#gt3-cam').firstChild.textContent = `${r.camera[0].toUpperCase()}${r.camera.slice(1)} `;
    $('#gt3-tc').setAttribute('aria-pressed', String(!!r.tc));
    $('#gt3-pause').setAttribute('aria-pressed', String(!!r.paused));
    $('#gt3-sound').setAttribute('aria-pressed', String(!!r.sound));
    const m = r.messages.join('|');
    if (m !== lastMsgs) { lastMsgs = m; $('#gt3-msgs').innerHTML = r.messages.map(t => `<li>${t}</li>`).join(''); }
    draw(r);
  }

  function draw(r) {
    const W = window.innerWidth, H = window.innerHeight;
    g.clearRect(0, 0, W, H);
    // The cluster: bottom centre, a rev arc round the gear and the speed.
    const R = Math.min(96, W * 0.11), cx = W / 2, cy = H - R - 34;
    g.save();
    g.fillStyle = 'rgba(10, 12, 14, 0.55)';
    g.beginPath(); g.arc(cx, cy, R + 14, 0, Math.PI * 2); g.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, MAX = 9000;
    const at = (rpm) => a0 + (a1 - a0) * Math.min(1, rpm / MAX);
    // The scale, the red line from 8,800 and the needle's sweep.
    g.lineWidth = 7; g.lineCap = 'butt';
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    g.strokeStyle = 'rgba(230,40,40,0.75)'; g.beginPath(); g.arc(cx, cy, R, at(8800), a1); g.stroke();
    const shift = r.rpm > 8300;
    g.strokeStyle = shift ? 'rgba(255,70,60,0.95)' : 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(cx, cy, R, a0, at(r.rpm)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '600 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k <= 9; k++) {
      const a = at(k * 1000), x = cx + Math.cos(a) * (R - 16), y = cy + Math.sin(a) * (R - 16);
      g.fillText(String(k), x, y);
    }
    g.fillStyle = shift ? '#ff4a3c' : '#fff';
    g.font = `700 ${Math.round(R * 0.5)}px system-ui, sans-serif`;
    g.fillText(String(r.gear), cx, cy - R * 0.12);
    g.fillStyle = '#fff'; g.font = `600 ${Math.round(R * 0.22)}px system-ui, sans-serif`;
    g.fillText(`${fmt(Math.abs(r.kmh))} km/h`, cx, cy + R * 0.38);
    g.font = '500 11px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(`${fmt(r.rpm)} rpm`, cx, cy + R * 0.62);
    // The lamps: DRS, ABS, TC, parking brake.
    // PSM: lit while on; amber while it is working (braking a wheel), dimmed while it stands back for a drift.
    const lamps = [['DRS', r.drs, '#4ad07a'], ['ABS', r.abs, '#ffb340'], ['PSM', r.tc, r.esc ? '#ffb340' : r.drift ? '#7fbfff' : '#4aa8ff'], ['P', r.handbrake, '#ff4a3c']];
    lamps.forEach(([t, on, c], i) => {
      const x = cx - R - 70 + (i % 2) * 34, y = cy - 18 + Math.floor(i / 2) * 26;
      g.fillStyle = on ? c : 'rgba(255,255,255,0.18)';
      g.font = '700 12px system-ui, sans-serif';
      g.fillText(t, x, y);
    });
    // Right of the cluster: the slide, the g, the lap.
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '500 12px system-ui, sans-serif';
    const lx = cx + R + 26;
    g.fillText(`slide ${fmt(Math.abs(r.slide))}°`, lx, cy - 30);
    g.fillText(`${fmt(r.g, 2)} g`, lx, cy - 12);
    g.fillText(`lap ${lapTime(r.lap)}`, lx, cy + 8);
    g.fillText(`best ${lapTime(r.best)}`, lx, cy + 26);
    g.restore();
  }

  function show(on) {
    canvas.classList.toggle('hidden', !on);
    bar.classList.toggle('hidden', !on);
    if (!on) g.clearRect(0, 0, canvas.width, canvas.height);
  }
  return { update, show, element: bar };
}
