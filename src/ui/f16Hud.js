/**
 * The F-16's head-up display, drawn over the scene while it flies, and the flight's controls.
 *
 * The symbology is the F-16's in kind (≈: the layout of the block 15's HUD, not a copy of its
 * drawings): a flight-path marker where the airplane is going, a pitch ladder every 5° that is
 * conformal with the world from the cockpit (solid above the horizon, dashed below), the
 * calibrated airspeed on the left and the barometric altitude on the right, the heading along the
 * top, and the load factor, Mach and α at the left. Outside the cockpit the same numbers sit in a
 * box in the top right corner, with the ladder drawn round the box's centre. Green, as the HUD's own phosphor is.
 */
import * as THREE from 'three';

const GREEN = 'rgba(80, 255, 140, 0.95)', DIM = 'rgba(80, 255, 140, 0.55)';
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

export function createF16Hud({ root, onEnd, onCamera, onRestart, onPause, onAssist }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'f16-hud hidden';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');

  const bar = document.createElement('section');
  bar.className = 'f16-bar hidden';
  bar.setAttribute('aria-label', 'F-16 flight');
  bar.innerHTML = `
    <span class="eyebrow">F-16A Block 15 · flight model from NASA wind-tunnel data</span>
    <button type="button" class="f16-btn" id="f16-cam" title="Camera: chase, cockpit, tower, your own orbit (C)">Chase <kbd>C</kbd></button>
    <button type="button" class="f16-btn" id="f16-assist" aria-pressed="true" title="Simple controls (W S power, ↑ ↓ climb, A D turn, G gear); off gives every control of the airplane">Simple</button>
    <button type="button" class="f16-btn" id="f16-pause" aria-pressed="false" title="Pause (K)">Pause <kbd>K</kbd></button>
    <button type="button" class="f16-btn" id="f16-restart" title="Back to the runway's threshold (Enter)">Runway <kbd>Enter</kbd></button>
    <button type="button" class="f16-btn f16-end" id="f16-end" title="Back to the exhibit (Esc)">End <kbd>Esc</kbd></button>
    <p class="f16-keys f16-easy"><kbd>W</kbd><kbd>S</kbd> power (hold W to take off) · <kbd>↑</kbd><kbd>↓</kbd> climb, descend · <kbd>A</kbd><kbd>D</kbd> turn (<kbd>Shift</kbd> harder) · <kbd>G</kbd> gear: it holds 150 kt and flares for you · <kbd>C</kbd> camera</p>
    <p class="f16-keys f16-full"><kbd>W</kbd><kbd>S</kbd> stick fore/aft (<kbd>Shift</kbd> full) · <kbd>A</kbd><kbd>D</kbd> roll · <kbd>Q</kbd><kbd>E</kbd> rudder and nose wheel · <kbd>R</kbd><kbd>F</kbd> throttle · <kbd>Space</kbd> brakes · <kbd>B</kbd> speed brakes · <kbd>G</kbd> gear</p>
    <ul class="f16-msgs" id="f16-msgs" aria-live="polite"></ul>
    <div class="f16-result hidden" id="f16-result" role="status"></div>
  `;
  root.appendChild(bar);
  const $ = (id) => bar.querySelector(id);
  $('#f16-end').addEventListener('click', () => onEnd?.());
  $('#f16-cam').addEventListener('click', () => onCamera?.());
  $('#f16-restart').addEventListener('click', () => onRestart?.());
  $('#f16-pause').addEventListener('click', () => onPause?.());
  $('#f16-assist').addEventListener('click', () => onAssist?.());

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const _p = new THREE.Vector3(), _d = new THREE.Vector3();
  /** Screen position of a world direction from the camera, or null behind it. */
  function screenOf(camera, dir) {
    _p.copy(camera.position).addScaledVector(dir, 1000).project(camera);
    if (_p.z > 1) return null;
    return [(_p.x + 1) / 2 * window.innerWidth, (1 - _p.y) / 2 * window.innerHeight];
  }

  let lastMsgs = '';
  function update(r, camera) {
    const W = window.innerWidth, H = window.innerHeight;
    g.clearRect(0, 0, W, H);
    if (!r) return;
    $('#f16-cam').firstChild.textContent = `${r.camera[0].toUpperCase()}${r.camera.slice(1)} `;
    $('#f16-pause').setAttribute('aria-pressed', String(!!r.paused));
    $('#f16-assist').setAttribute('aria-pressed', String(!!r.assist));
    bar.classList.toggle('is-assist', !!r.assist);
    const msgs = r.messages.join('|');
    if (msgs !== lastMsgs) { lastMsgs = msgs; $('#f16-msgs').innerHTML = r.messages.map(m => `<li>${m}</li>`).join(''); }
    const res = $('#f16-result');
    res.classList.toggle('hidden', !r.outcome);
    if (r.outcome) res.innerHTML = `<b>${r.outcome.kind === 'crash' ? 'Crash' : 'Landed'}</b> ${r.outcome.why} <span>Enter: back to the runway · Esc: back to the exhibit</span>`;

    const cockpit = r.camera === 'cockpit';
    g.save();
    g.strokeStyle = GREEN; g.fillStyle = GREEN; g.lineWidth = 1.6;
    g.font = '600 15px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    g.textBaseline = 'middle';
    // The field: the whole view from the cockpit; from outside, a box in the top right corner,
    // clear of the airplane at the centre of the view.
    const m = Math.min(W, H);
    const half = cockpit ? m * 0.36 : m * 0.16;
    const cx = cockpit ? W / 2 : W - half * 1.6 - 16, cy = cockpit ? H * 0.46 : half + 24;
    if (!cockpit) {
      g.fillStyle = 'rgba(0, 18, 8, 0.28)'; g.fillRect(cx - half * 1.45, cy - half, half * 2.9, half * 2);
      g.fillStyle = GREEN;
    }
    // Flight-path marker and pitch ladder.
    const V = r.velocity.length();
    let fpm = null;
    if (cockpit && V > 15) fpm = screenOf(camera, _d.copy(r.velocity).normalize());
    if (!cockpit) {
      // Outside: the marker at the box's centre, the ladder round it, turned with the bank.
      fpm = [cx, cy];
    }
    if (V > 15) {
      const pxPerDeg = cockpit ? null : half / 16;
      const pathPitch = Math.asin(THREE.MathUtils.clamp(r.velocity.y / V, -1, 1)) * 180 / Math.PI;
      const pathHdg = Math.atan2(r.velocity.z, r.velocity.x);
      for (let p = -85; p <= 85; p += 5) {
        let a, b;
        if (cockpit) {
          const dir = (pp, side) => {
            const pr = pp * Math.PI / 180, h = pathHdg + side;
            return _d.set(Math.cos(pr) * Math.cos(h), Math.sin(pr), Math.cos(pr) * Math.sin(h));
          };
          a = screenOf(camera, dir(p, -0.06)); b = screenOf(camera, dir(p, 0.06));
          if (!a || !b) continue;
        } else {
          const off = (p - pathPitch) * pxPerDeg;
          if (Math.abs(off) > half * 0.95) continue;
          const rr = -r.roll * Math.PI / 180, cos = Math.cos(rr), sin = Math.sin(rr), w = half * 0.32;
          const mx = cx + sin * off, my = cy - cos * off;
          a = [mx - cos * w, my - sin * w]; b = [mx + cos * w, my + sin * w];
        }
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const ux = (b[0] - a[0]), uy = (b[1] - a[1]), len = Math.hypot(ux, uy) || 1;
        const gap = Math.min(len * 0.22, 40);
        g.setLineDash(p < 0 ? [7, 5] : []);
        g.strokeStyle = p === 0 ? GREEN : DIM;
        g.lineWidth = p === 0 ? 2 : 1.4;
        const nx = ux / len, ny = uy / len;
        g.beginPath();
        if (p === 0) { g.moveTo(a[0] - nx * len, a[1] - ny * len); g.lineTo(mx - nx * gap, my - ny * gap); g.moveTo(mx + nx * gap, my + ny * gap); g.lineTo(b[0] + nx * len, b[1] + ny * len); }
        else { g.moveTo(a[0], a[1]); g.lineTo(mx - nx * gap, my - ny * gap); g.moveTo(mx + nx * gap, my + ny * gap); g.lineTo(b[0], b[1]); }
        g.stroke();
        if (p !== 0) {
          g.setLineDash([]); g.fillStyle = DIM;
          g.font = '500 12px ui-monospace, Menlo, Consolas, monospace';
          g.fillText(String(Math.abs(p)), b[0] + 6, b[1]);
          g.font = '600 15px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
          g.fillStyle = GREEN;
        }
      }
      g.setLineDash([]); g.strokeStyle = GREEN; g.lineWidth = 1.8;
      if (fpm) {
        const [x, y] = fpm;
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2);
        g.moveTo(x - 7, y); g.lineTo(x - 20, y); g.moveTo(x + 7, y); g.lineTo(x + 20, y); g.moveTo(x, y - 7); g.lineTo(x, y - 14);
        g.stroke();
      }
    }
    // Airspeed (KCAS) on the left, altitude (feet) on the right, heading on top.
    const box = (x, y, text, align) => {
      g.font = '700 17px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      const w = g.measureText(text).width + 14;
      g.strokeRect(align === 'right' ? x - w : x, y - 13, w, 26);
      g.textAlign = 'left'; g.fillText(text, (align === 'right' ? x - w : x) + 7, y);
    };
    box(cx - half * 1.38, cy, fmt(r.kcas), 'left');
    box(cx + half * 1.38, cy, fmt(Math.round(r.altFt / 10) * 10), 'right');
    g.font = '600 15px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.fillText(String(Math.round(r.heading / 1) % 360).padStart(3, '0'), cx, cy - half * 0.92);
    g.beginPath(); g.moveTo(cx, cy - half * 0.92 + 11); g.lineTo(cx, cy - half * 0.92 + 18); g.stroke();
    g.textAlign = 'left';
    const lx = cx - half * 1.38, ly = cy + half * 0.25;
    g.fillText(`G ${fmt(r.nz, 1)}`, lx, ly);
    g.fillText(`M ${fmt(r.mach, 2)}`, lx, ly + 20);
    g.fillText(`α ${fmt(r.alpha, 1)}`, lx, ly + 40);
    const rx = cx + half * 1.38;
    g.textAlign = 'right';
    g.fillText(`${r.vsFpm >= 0 ? '+' : ''}${fmt(Math.round(r.vsFpm / 10) * 10)} FPM`, rx, cy + 26);
    g.fillText(`R ${fmt(r.aglFt)}`, rx, cy + 46);
    const pwr = r.power >= 50 ? `AB ${fmt((r.power - 50) * 2)}%` : `PWR ${fmt(r.power * 2)}%`;
    g.fillText(pwr, rx, ly + 40);
    // Configuration and warnings, bottom centre.
    g.textAlign = 'center';
    const cfg = [];
    if (r.gear > 0.98) cfg.push('GEAR'); else if (r.gear > 0.02) cfg.push('GEAR ↕');
    if (r.speedBrake > 0.05) cfg.push('SPD BRK');
    if (r.brake && r.wow) cfg.push('BRAKES');
    if (r.paused) cfg.push('PAUSED');
    // On the ground at idle, the one thing to do next, in the middle of the view.
    if (r.wow && r.throttle < 0.05 && !r.outcome) {
      g.font = '700 18px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      g.fillStyle = 'rgba(255, 210, 60, 0.95)';
      g.fillText(r.assist ? 'PRESS W TO TAKE OFF' : 'HOLD R FOR THROTTLE · S TO ROTATE AT 135 KT', W / 2, H * 0.3);
      g.font = '600 15px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      g.fillStyle = GREEN;
    }
    g.fillText(cfg.join('  ·  '), cx, cy + half * 0.92);
    const warn = [];
    if (!r.wow && r.gear < 0.98 && r.aglFt < 500 && r.vsFpm < -200) warn.push('GEAR');
    if (r.alpha > 22 && !r.wow) warn.push('AOA');
    if (!r.wow && r.aglFt < 200 && r.vsFpm < -2500) warn.push('PULL UP');
    if (warn.length) {
      g.font = '800 20px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      g.fillStyle = 'rgba(255, 210, 60, 0.95)';
      g.fillText(warn.join('  '), cx, cy + half * 0.62);
    }
    g.restore();
  }

  return {
    show(on) {
      canvas.classList.toggle('hidden', !on);
      bar.classList.toggle('hidden', !on);
      if (!on) g.clearRect(0, 0, canvas.width, canvas.height);
    },
    update,
  };
}
