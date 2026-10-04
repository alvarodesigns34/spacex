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
import { createTelemetryList } from './telemetryList.js';

const GREEN = 'rgba(80, 255, 140, 0.95)', DIM = 'rgba(80, 255, 140, 0.55)';
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

export function createF16Hud({ root, onEnd, onCamera, onRestart, onPause, onAssist, onSound }) {
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
    <button type="button" class="f16-btn" id="f16-sound" aria-pressed="false" title="Sound (M): the F100's fan, jet and afterburner, the air and the wheels, synthesised; off until you turn it on">Sound <kbd>M</kbd></button>
    <button type="button" class="f16-btn" id="f16-pause" aria-pressed="false" title="Pause (K)">Pause <kbd>K</kbd></button>
    <button type="button" class="f16-btn" id="f16-restart" title="Back to the runway's threshold (Enter)">Runway <kbd>Enter</kbd></button>
    <button type="button" class="f16-btn f16-end" id="f16-end" title="Back to the exhibit (Esc)">End <kbd>Esc</kbd></button>
    <p class="f16-keys f16-easy"><kbd>W</kbd><kbd>S</kbd> power (hold W to take off) · <kbd>↑</kbd><kbd>↓</kbd> climb, descend · <kbd>A</kbd><kbd>D</kbd> turn (<kbd>Shift</kbd> harder) · <kbd>G</kbd> gear: it holds 150 kt and flares for you · <kbd>C</kbd> camera · <kbd>M</kbd> sound</p>
    <p class="f16-keys f16-full"><kbd>W</kbd><kbd>S</kbd> stick fore/aft (<kbd>Shift</kbd> full) · <kbd>A</kbd><kbd>D</kbd> roll · <kbd>Q</kbd><kbd>E</kbd> rudder and nose wheel · <kbd>R</kbd><kbd>F</kbd> throttle · <kbd>Space</kbd> brakes · <kbd>B</kbd> speed brakes · <kbd>G</kbd> gear · <kbd>M</kbd> sound</p>
    <ul class="f16-msgs" id="f16-msgs" aria-live="polite"></ul>
    <div class="f16-result hidden" id="f16-result" role="status"></div>
  `;
  root.appendChild(bar);
  // The same numbers as text, for a screen reader (H25): the HUD is a canvas it cannot see.
  const telemetry = createTelemetryList(bar, 'F-16 telemetry', [
    ['cas', 'Calibrated airspeed'], ['mach', 'Mach'], ['alt', 'Altitude'], ['vs', 'Vertical speed'], ['hdg', 'Heading'],
    ['gs', 'Ground speed'], ['wind', 'Wind'], ['g', 'Load factor'], ['aoa', 'Angle of attack'], ['power', 'Engine'], ['fuel', 'Fuel'], ['gear', 'Gear'], ['data', 'Model'],
  ]);
  const $ = (id) => bar.querySelector(id);
  $('#f16-end').addEventListener('click', () => onEnd?.());
  $('#f16-cam').addEventListener('click', () => onCamera?.());
  $('#f16-restart').addEventListener('click', () => onRestart?.());
  $('#f16-pause').addEventListener('click', () => onPause?.());
  $('#f16-assist').addEventListener('click', () => onAssist?.());
  $('#f16-sound').addEventListener('click', () => onSound?.());

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
    if (r) telemetry.update({
      cas: `${fmt(r.kcas)} knots`, mach: fmt(r.mach, 2), alt: `${fmt(r.altFt)} feet`, vs: `${fmt(r.vsFpm)} feet per minute`,
      hdg: `${fmt(Math.round(r.heading) % 360)} degrees`, gs: `${fmt(r.gsKt)} knots`, wind: `from ${fmt(Math.round(r.windFrom) % 360)} degrees at ${fmt(r.windKt)} knots`, g: `${fmt(r.nz, 1)} g`, aoa: `${fmt(r.alpha, 1)} degrees`,
      power: `${fmt(r.power)} percent${r.ab ? ', afterburner' : ''}${r.flameout ? ', flamed out' : ''}`, fuel: `${fmt(r.fuel)} kg`,
      gear: r.gear > 0.98 ? 'down' : r.gear < 0.02 ? 'up' : 'moving', data: r.outside ? `extrapolated beyond the wind-tunnel data (${r.outside.join(', ')})` : 'within the wind-tunnel data',
    });
    const W = window.innerWidth, H = window.innerHeight;
    g.clearRect(0, 0, W, H);
    if (!r) return;
    $('#f16-cam').firstChild.textContent = `${r.camera[0].toUpperCase()}${r.camera.slice(1)} `;
    $('#f16-pause').setAttribute('aria-pressed', String(!!r.paused));
    $('#f16-assist').setAttribute('aria-pressed', String(!!r.assist));
    $('#f16-sound').setAttribute('aria-pressed', String(!!r.sound));
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
    // Runway 28: a caret under the heading at its bearing (±40° across), its distance; on
    // the final approach the glide path's and the centre line's deviations, as an ILS shows them.
    if (r.cue && !r.wow) {
      const q = r.cue, rel = ((q.bearing - r.heading + 540) % 360) - 180, hy = cy - half * 0.92;
      const px = cx + Math.max(-1, Math.min(1, rel / 40)) * half * 0.9;
      g.beginPath(); g.moveTo(px, hy + 21); g.lineTo(px - 6, hy + 30); g.lineTo(px + 6, hy + 30); g.closePath(); g.stroke();
      g.textAlign = 'right';
      g.fillText(`RWY ${q.name} ${fmt(q.distNm, 1)} NM`, cx + half * 1.38, cy + half * 0.25 + 60);
      g.textAlign = 'center';
      if (q.onFinal) {
        // ±2 dots: 150 ft above or below the path, 2.5° off the centre line.
        const gy = cy + Math.max(-2, Math.min(2, -q.gsDevFt / 75)) * half * 0.18, lx2 = cx + half * 1.1;
        g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(lx2 - 3, cy + k * half * 0.18); g.lineTo(lx2 + 3, cy + k * half * 0.18); } g.stroke();
        g.beginPath(); g.moveTo(lx2 - 8, gy); g.lineTo(lx2, gy - 6); g.lineTo(lx2 + 8, gy); g.lineTo(lx2, gy + 6); g.closePath(); g.stroke();
        const lxx = cx + Math.max(-2, Math.min(2, -q.locDeg / 1.25)) * half * 0.18, ly2 = cy + half * 1.0;
        g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(cx + k * half * 0.18, ly2 - 3); g.lineTo(cx + k * half * 0.18, ly2 + 3); } g.stroke();
        g.beginPath(); g.moveTo(lxx, ly2 - 8); g.lineTo(lxx + 6, ly2); g.lineTo(lxx, ly2 + 8); g.lineTo(lxx - 6, ly2); g.closePath(); g.stroke();
      }
      g.font = '600 15px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    }
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
    // The autothrottle's held speed (the simple controls).
    if (Number.isFinite(r.vHold)) { g.textAlign = 'left'; g.fillText(`A/T ${fmt(r.vHold)}`, lx, ly + 60); g.textAlign = 'right'; }
    // Ground speed, and the wind where the airplane is (from, true / knots), as the HUD's data block gives them (≈ its layout).
    if (Number.isFinite(r.gsKt)) g.fillText(`GS ${fmt(r.gsKt)}`, rx, ly + 60);
    if (Number.isFinite(r.windKt)) g.fillText(`W ${String(Math.round(r.windFrom) % 360).padStart(3, '0')}/${fmt(r.windKt)}`, rx, ly + 80);
    // Configuration and warnings, bottom centre.
    g.textAlign = 'center';
    const cfg = [];
    if (r.gear > 0.98) cfg.push('GEAR'); else if (r.gear > 0.02) cfg.push('GEAR ↕');
    if (r.speedBrake > 0.05) cfg.push('SPD BRK');
    if (r.brake && r.wow) cfg.push('BRAKES');
    if (r.paused) cfg.push('PAUSED');
    if (Number.isFinite(r.fuel)) cfg.push(`FUEL ${fmt(r.fuel)} KG`);
    // Beyond the wind-tunnel data the model is extrapolated (H16): say so, quietly.
    if (r.outside) cfg.push(`EXTRAPOLATED ${r.outside.join(' ')}`);
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
    if (r.flameout) warn.push('FLAMEOUT'); else if (r.fuel < 300) warn.push('FUEL');
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
