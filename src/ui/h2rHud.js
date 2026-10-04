/**
 * The Ninja H2R's instruments while it is ridden, and the ride's controls: a rev counter to
 * 15,000 rpm (≈ not a copy of the bike's own display), the gear, the speed; the lean angle on
 * its own arc, as on-board television shows it, and the wheelie's pitch; the aids' lamp, the ram
 * air, the limiter. Beside them the same live telemetry as the Porsche's — speed, throttle and
 * brake traces and the friction circle — and the readings as text for a screen reader.
 */
import { createTelemetryList } from './telemetryList.js';
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const lapTime = (t) => (t === null || t === undefined ? '—' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);

export function createH2rHud({ root, onEnd, onCamera, onRestart, onPickUp, onPause, onTraction, onSound }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'f16-hud gt3-hud h2r-hud hidden';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');

  const bar = document.createElement('section');
  bar.className = 'f16-bar gt3-bar h2r-bar hidden';
  bar.setAttribute('aria-label', 'Kawasaki Ninja H2R ride');
  bar.innerHTML = `
    <span class="eyebrow">Kawasaki Ninja H2R · 228 kW supercharged, six speeds, Kawasaki's published figures</span>
    <button type="button" class="f16-btn" id="h2r-cam" title="Camera: the rider's eyes, chase, trackside, your own orbit (C)">Rider <kbd>C</kbd></button>
    <button type="button" class="f16-btn" id="h2r-tc" aria-pressed="true" title="Aids (T): cornering ABS, traction, wheelie and rear-lift control; off, the brakes and the wheelies are yours. The lean limit is always on">Aids <kbd>T</kbd></button>
    <button type="button" class="f16-btn" id="h2r-pause" aria-pressed="false" title="Pause (K)">Pause <kbd>K</kbd></button>
    <button type="button" class="f16-btn" id="h2r-sound" aria-pressed="false" title="Sound (M): the four, the supercharger and the wind, synthesised; off until you turn it on">Sound <kbd>M</kbd></button>
    <button type="button" class="f16-btn" id="h2r-pickup" title="Pick the bike up where it lies, upright (R)">Pick up <kbd>R</kbd></button>
    <button type="button" class="f16-btn" id="h2r-restart" title="Back to the skid pad (Enter)">Pad <kbd>Enter</kbd></button>
    <button type="button" class="f16-btn f16-end" id="h2r-end" title="Back to the exhibit (Esc)">End <kbd>Esc</kbd></button>
    <p class="f16-keys"><kbd>W</kbd> throttle · <kbd>S</kbd> brake · <kbd>A</kbd><kbd>D</kbd> lean: the bike counter-steers into it · <kbd>Space</kbd> rear brake · <kbd>Q</kbd><kbd>E</kbd> gear down / up (manual from the first press) · <kbd>G</kbd> automatic again · <kbd>T</kbd> aids · <kbd>C</kbd> camera · <kbd>M</kbd> sound · <kbd>R</kbd> pick it up</p>
    <ul class="f16-msgs" id="h2r-msgs" aria-live="polite"></ul>
  `;
  root.appendChild(bar);
  const telemetry = createTelemetryList(bar, 'Ninja H2R telemetry', [
    ['speed', 'Speed'], ['gear', 'Gear'], ['rpm', 'Engine'], ['lean', 'Lean angle'], ['pitch', 'Wheelie'], ['g', 'Acceleration'], ['aids', 'Aids'], ['lap', 'Lap'], ['best', 'Best lap'],
  ]);
  // The traces: one sample every 50 ms over the last 20 s, in a ring.
  const N = 400, hist = { kmh: new Float32Array(N), thr: new Float32Array(N), brk: new Float32Array(N), gx: new Float32Array(N), gy: new Float32Array(N) };
  let head = 0, count = 0, lastSample = -Infinity;
  const $ = (id) => bar.querySelector(id);
  $('#h2r-end').addEventListener('click', () => onEnd?.());
  $('#h2r-cam').addEventListener('click', () => onCamera?.());
  $('#h2r-restart').addEventListener('click', () => onRestart?.());
  $('#h2r-pickup').addEventListener('click', () => onPickUp?.());
  $('#h2r-pause').addEventListener('click', () => onPause?.());
  $('#h2r-tc').addEventListener('click', () => onTraction?.());
  $('#h2r-sound').addEventListener('click', () => onSound?.());

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
    // Sampled on the simulation's clock, so a slow frame does not stretch the traces.
    if (r.t < lastSample) { count = 0; lastSample = -Infinity; }   // a reset: start the traces again
    if (r.t - lastSample >= 0.05) {
      lastSample = r.t;
      hist.kmh[head] = Math.abs(r.kmh); hist.thr[head] = r.throttle; hist.brk[head] = r.brake;
      hist.gx[head] = r.gLong ?? 0; hist.gy[head] = r.gLat ?? 0;
      head = (head + 1) % N; count = Math.min(N, count + 1);
    }
    telemetry.update({
      speed: `${fmt(Math.abs(r.kmh))} km/h`, gear: String(r.gear), rpm: `${fmt(r.rpm)} rpm`, g: `${fmt(r.g, 2)} g`,
      lean: `${fmt(Math.abs(r.lean))} degrees ${r.lean > 0.5 ? 'right' : r.lean < -0.5 ? 'left' : ''}`.trim(), pitch: r.pitch > 0.5 ? `${fmt(r.pitch)} degrees, front up` : r.pitch < -0.5 ? `${fmt(-r.pitch)} degrees, rear up` : 'both wheels down',
      aids: [r.aids ? 'aids on' : 'aids off', r.limiter && 'on the limiter', r.down && 'down'].filter(Boolean).join(', '),
      lap: lapTime(r.lap), best: lapTime(r.best),
    });
    $('#h2r-cam').firstChild.textContent = `${r.camera[0].toUpperCase()}${r.camera.slice(1)} `;
    $('#h2r-tc').setAttribute('aria-pressed', String(!!r.aids));
    $('#h2r-pause').setAttribute('aria-pressed', String(!!r.paused));
    $('#h2r-sound').setAttribute('aria-pressed', String(!!r.sound));
    const m = r.messages.join('|');
    if (m !== lastMsgs) { lastMsgs = m; $('#h2r-msgs').innerHTML = r.messages.map(t => `<li>${t}</li>`).join(''); }
    draw(r);
  }

  function draw(r) {
    const W = window.innerWidth, H = window.innerHeight;
    g.clearRect(0, 0, W, H);
    // The cluster: bottom centre, a rev arc round the gear and the speed.
    // Above the drive's bar, which sits at the bottom centre too.
    const barTop = bar.classList.contains('hidden') ? H : bar.getBoundingClientRect().top;
    // From the driver's seat the car's own cluster shows the revs, the gear and the speed: this
    // one moves to the bottom right corner, smaller, out of the windscreen's way.
    const cab = r.camera === 'rider';
    const R = cab ? Math.min(54, W * 0.07) : Math.min(96, W * 0.11);
    const cx = cab ? W - R - 130 : W / 2, cy = Math.min(H - R - 34, barTop - R - 30);
    g.save();
    g.fillStyle = 'rgba(10, 12, 14, 0.55)';
    g.beginPath(); g.arc(cx, cy, R + 14, 0, Math.PI * 2); g.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, MAX = 15000;
    const at = (rpm) => a0 + (a1 - a0) * Math.min(1, rpm / MAX);
    // The scale, the red line from 8,800 and the needle's sweep.
    g.lineWidth = 7; g.lineCap = 'butt';
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    g.strokeStyle = 'rgba(230,40,40,0.75)'; g.beginPath(); g.arc(cx, cy, R, at(14000), a1); g.stroke();
    const shift = r.rpm > 13800;
    g.strokeStyle = shift ? 'rgba(255,70,60,0.95)' : 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(cx, cy, R, a0, at(r.rpm)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '600 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k <= 15; k += 3) {
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
    // The lamps: the aids, the wheelie, ram air, the limiter; the aids at work (ABS, TC) and the
    // lean held at its limit.
    const lamps = [['AIDS', r.aids, '#4aa8ff'], ['WHL', r.wheelie || r.stoppie, '#ffb340'], ['RAM', r.ram > 0.5, '#4ad07a'], ['LIM', r.limiter, '#ff4a3c'],
      ['ABS', r.abs, '#ffb340'], ['TC', r.tc, '#ffb340'], ['LEAN', r.leanHeld, '#ffb340']];
    lamps.forEach(([t, on, c], i) => {
      const x = cx - R - 70 + (i % 2) * 38, y = cy - 18 + Math.floor(i / 2) * 26;
      g.fillStyle = on ? c : 'rgba(255,255,255,0.18)';
      g.font = '700 12px system-ui, sans-serif';
      g.fillText(t, x, y);
    });
    // The lean: a half-dial over the cluster, the bike's line in it, the angle in degrees.
    {
      const ly = cy - R - 34, LR = R * 0.62;
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, ly, LR, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      // Ticks at the lean limit on either side: what the tyres hold here, or the lock slow.
      if (r.leanCap > 0) {
        g.strokeStyle = 'rgba(255,179,64,0.85)'; g.lineWidth = 2;
        for (const sd of [-1, 1]) {
          const t = -Math.PI / 2 + sd * r.leanCap / 57.3;
          g.beginPath(); g.moveTo(cx + Math.cos(t) * (LR - 7), ly + Math.sin(t) * (LR - 7)); g.lineTo(cx + Math.cos(t) * (LR + 7), ly + Math.sin(t) * (LR + 7)); g.stroke();
        }
      }
      const a = -Math.PI / 2 + (r.lean || 0) / 57.3;
      g.strokeStyle = r.leanHeld ? '#ffb340' : '#fff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, ly); g.lineTo(cx + Math.cos(a) * LR, ly + Math.sin(a) * LR); g.stroke();
      g.fillStyle = '#fff'; g.font = `700 ${Math.round(R * 0.2)}px system-ui, sans-serif`;
      g.fillText(`${fmt(Math.abs(r.lean))}°`, cx, ly + 12);
    }
    // Right of the cluster: the wheelie, the g, the lap.
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '500 12px system-ui, sans-serif';
    const lx = cx + R + 26;
    g.fillText(`pitch ${fmt(r.pitch)}°`, lx, cy - 30);
    g.fillText(`${fmt(r.g, 2)} g`, lx, cy - 12);
    g.fillText(`lap ${lapTime(r.lap)}`, lx, cy + 8);
    g.fillText(`best ${lapTime(r.best)}`, lx, cy + 26);
    g.restore();
    if (W >= 900 && count > 2) drawTelemetry(24, Math.min(H * 0.52, barTop - 180));
  }
  /** The traces (speed, throttle, brake) and the friction circle, at (x0, y0). */
  function drawTelemetry(x0, y0) {
    const w = 250, h = 120, gg = 120;
    g.save();
    g.fillStyle = 'rgba(10, 12, 14, 0.5)';
    g.fillRect(x0, y0, w + gg + 30, h + 24);
    g.font = '600 10px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
    // The legend in the traces' own colours.
    let lx = x0 + 8;
    for (const [t, c] of [['LAST 20 s · ', 'rgba(255,255,255,0.6)'], ['SPEED', '#fff'], [' · ', 'rgba(255,255,255,0.6)'], ['THROTTLE', '#4ad07a'], [' · ', 'rgba(255,255,255,0.6)'], ['BRAKE', '#ff4a3c']]) {
      g.fillStyle = c; g.fillText(t, lx, y0 + 6); lx += g.measureText(t).width;
    }
    const px = (k) => x0 + 8 + (w - 16) * k / (N - 1), top = y0 + 20, bot = y0 + h + 14;
    const trace = (arr, max, color, width) => {
      g.strokeStyle = color; g.lineWidth = width; g.beginPath();
      for (let k = 0; k < count; k++) {
        const i = (head - count + k + N) % N, x = px(N - count + k), y = bot - (bot - top) * Math.min(1, arr[i] / max);
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    };
    trace(hist.thr, 1, 'rgba(74, 208, 122, 0.85)', 1.5);
    trace(hist.brk, 1, 'rgba(255, 74, 60, 0.85)', 1.5);
    trace(hist.kmh, Math.max(100, ...Array.from(hist.kmh)) * 1.05, 'rgba(255, 255, 255, 0.95)', 2);
    // The friction circle: ±1.5 g, braking at the top as on a race engineer's plot.
    const cx = x0 + w + 15 + gg / 2, cy = y0 + 14 + h / 2, R = gg / 2 - 4, G = 1.5;
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
    for (const f of [1 / 1.5, 1]) { g.beginPath(); g.arc(cx, cy, R * f, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('g-g', cx - R, y0 + 6);
    const at = (i) => [cx - R * Math.max(-1, Math.min(1, hist.gy[i] / G)), cy + R * Math.max(-1, Math.min(1, hist.gx[i] / G))];
    for (let k = Math.max(0, count - 60); k < count; k++) {
      const i = (head - count + k + N) % N, [x, y] = at(i);
      g.fillStyle = `rgba(255, 210, 60, ${0.15 + 0.6 * (k - count + 60) / 60})`;
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const [x, y] = at((head - 1 + N) % N);
    g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function show(on) {
    canvas.classList.toggle('hidden', !on);
    bar.classList.toggle('hidden', !on);
    if (!on) g.clearRect(0, 0, canvas.width, canvas.height);
  }
  return { update, show, element: bar };
}
