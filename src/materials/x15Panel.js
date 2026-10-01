/**
 * The X-15 #1's instrument panel as the flight manual draws it (T.O. 1X-15-1, figure 1-2, the
 * panel numbered FS-493 with its side wings): every instrument, light box and switch in its
 * place, drawn on a canvas that the flight redraws live. The working instruments are the
 * manual's own: airspeed (3), altimeter (2), angle of attack (4), accelerometer (5), attitude
 * (6), azimuth (7), vertical velocity (9), inertial height (10), inertial speed (13),
 * rate of roll (48), fuel quantity (53), chamber pressure (51) and the clock (44). Dial scales
 * are read off the figure; where the figure does not show one (the inertial instruments' full
 * range, the fuel gauge's units) it is this simulation's (≈). There is no Mach meter on
 * this panel; the instruments panel over the scene still gives it.
 *
 * Layout coordinates are the figure's, in pixels of a 1500-pixel-wide rendering of the page
 * (≈0.756 mm a pixel, scaled so the altimeter's case is the standard 3⅛ in instrument: ≈).
 */
import * as THREE from 'three';

/** Panel extent in figure pixels and metres per pixel. */
export const PANEL = { x0: 296, x1: 1464, y0: 136, y1: 776, mpp: 0.0794 / 105, centreX: 820 };

/** The panel's outline: the domed main panel and its two lower side wings (figure 1-2). */
const OUTLINE = [
  [300, 500], [410, 500], [410, 300], [455, 240], [520, 192], [600, 162], [700, 146], [820, 140], [940, 145],
  [1040, 160], [1120, 190], [1180, 228], [1212, 262], [1212, 430], [1460, 430], [1460, 745], [1212, 745],
  [1212, 622], [410, 622], [410, 770], [300, 770],
];

const SCALE = 1.7;   // canvas pixels per figure pixel
const W = Math.round((PANEL.x1 - PANEL.x0) * SCALE), H = Math.round((PANEL.y1 - PANEL.y0) * SCALE);
const X = (x) => (x - PANEL.x0) * SCALE, Y = (y) => (y - PANEL.y0) * SCALE, R = (r) => r * SCALE;

/** Decorative instruments (needles at rest), [x, y, r, label]. */
const STATIC_DIALS = [
  [925, 545, 47, 'SYS 1 HYD'], [1110, 492, 34, 'PRESS'], [1170, 488, 30, 'HYD'], [1088, 575, 40, 'CABIN'],
  [1147, 575, 40, 'He'], [975, 560, 32, 'APU'], [1030, 558, 32, 'H2O2'], [1035, 497, 34, 'TEMP'], [970, 498, 34, 'TEMP'],
  [1110, 377, 52, 'VOLTS AC'], [1000, 377, 52, 'VOLTS AC'], [488, 445, 38, 'H2O2'], [462, 515, 38, 'PSI'],
  [520, 512, 38, 'PSI'], [462, 578, 38, 'PSI'], [520, 580, 38, 'PSI'], [605, 532, 38, 'MANIF'], [805, 565, 47, 'LOX BRG TEMP'],
];
/** Warning and caution light boxes, [x, y, w, label]. */
const LIGHTS = [
  [470, 268, 62, 'ENGINE'], [470, 284, 62, 'IGN READY'], [470, 300, 62, 'NO DROP'], [470, 316, 62, 'IDLE END'],
  [470, 332, 62, 'VALVE MAL'], [470, 348, 62, 'ST 2 IGN MAL'], [470, 364, 62, 'PUMP O SPD'], [470, 380, 62, 'VIB MAL'], [470, 396, 62, 'FIRE'],
  [1010, 165, 72, 'RAS OUT'], [1005, 338, 70, 'GEN OUT'], [1145, 338, 70, 'GEN OUT'], [950, 438, 68, 'H2O2 HOT'],
  [950, 455, 68, 'APU COMP HOT'], [950, 472, 68, 'H2O2 LOW'], [1115, 438, 68, 'H2O2 HOT'], [1115, 455, 68, 'APU COMP HOT'],
  [1115, 472, 68, 'H2O2 LOW'], [612, 492, 92, 'FUEL LINE LOW'], [700, 492, 90, 'H2O2 COMP HOT'], [360, 548, 90, 'LDG GR RELEASE'],
];
/** Toggle switches, [x, y]. */
const SWITCHES = [
  [530, 445], [568, 445], [604, 445], [640, 445], [738, 445], [1072, 412], [1102, 412], [1004, 447], [1057, 447],
  [880, 452], [1218, 452], [1238, 692], [1275, 692], [1300, 690], [1336, 690], [1360, 690], [338, 690], [358, 690], [378, 690],
];

function bezel(g, x, y, r) {
  g.fillStyle = '#16181a'; g.beginPath(); g.arc(X(x), Y(y), R(r + 5), 0, Math.PI * 2); g.fill();
  g.fillStyle = '#060707'; g.beginPath(); g.arc(X(x), Y(y), R(r), 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3b3e41'; g.lineWidth = R(1.6); g.beginPath(); g.arc(X(x), Y(y), R(r + 2), 0, Math.PI * 2); g.stroke();
  for (const a of [0.8, 2.35, 3.9, 5.5]) {   // the four mounting screws
    g.fillStyle = '#4b4e52'; g.beginPath(); g.arc(X(x + Math.cos(a) * (r + 10)), Y(y + Math.sin(a) * (r + 10)), R(2.4), 0, Math.PI * 2); g.fill();
  }
}
/** A dial: ticks at the given values on angles a(v) (degrees clockwise from the top), labels in white. */
function dial(g, x, y, r, { from, to, step, major, a, label, sub, fmt = (v) => String(v) }) {
  bezel(g, x, y, r);
  g.strokeStyle = '#e8e6df'; g.fillStyle = '#e8e6df';
  for (let v = from; v <= to + 1e-9; v += step) {
    const ang = (a(v) - 90) * Math.PI / 180, big = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const r0 = r * (big ? 0.8 : 0.88);
    g.lineWidth = R(big ? 1.6 : 0.9);
    g.beginPath(); g.moveTo(X(x + Math.cos(ang) * r0), Y(y + Math.sin(ang) * r0)); g.lineTo(X(x + Math.cos(ang) * r * 0.97), Y(y + Math.sin(ang) * r * 0.97)); g.stroke();
    if (big) {
      g.font = `600 ${R(r * 0.2)}px "IBM Plex Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(fmt(v), X(x + Math.cos(ang) * r * 0.62), Y(y + Math.sin(ang) * r * 0.62));
    }
  }
  if (label) { g.font = `600 ${R(r * 0.13)}px "IBM Plex Sans", Arial, sans-serif`; g.textAlign = 'center'; g.fillText(label, X(x), Y(y + r * 0.3)); }
  if (sub) { g.font = `${R(r * 0.1)}px "IBM Plex Sans", Arial, sans-serif`; g.fillText(sub, X(x), Y(y + r * 0.45)); }
}
function needle(g, x, y, r, angDeg, { len = 0.8, width = 2.4, color = '#f2efe6', tail = 0.18 } = {}) {
  const a = (angDeg - 90) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = R(width);
  g.beginPath(); g.moveTo(X(x - c * r * tail), Y(y - s * r * tail)); g.lineTo(X(x + c * r * len), Y(y + s * r * len)); g.stroke();
  g.fillStyle = '#2a2c2e'; g.beginPath(); g.arc(X(x), Y(y), R(r * 0.08), 0, Math.PI * 2); g.fill();
}

/** The scales of the working instruments, read off figure 1-2 (≈ where it says so above). */
const DIALS = {
  airspeed: { x: 575, y: 262, r: 58, from: 0, to: 9, step: 0.5, major: 1, a: (v) => v * 36, label: '100 KNOTS', sub: 'SUBSONIC' },
  altitude: { x: 565, y: 377, r: 56, from: 0, to: 9, step: 0.2, major: 1, a: (v) => v * 36, label: 'ALT', sub: 'FEET' },
  alpha: { x: 673, y: 322, r: 50, from: -10, to: 40, step: 5, major: 10, a: (v) => 120 - v * 3.5, label: 'ATTACK', sub: 'DEGREES', fmt: (v) => String(Math.abs(v)) },
  accel: { x: 668, y: 202, r: 52, from: -4, to: 12, step: 1, major: 2, a: (v) => v * 20, label: 'ACCELERATION', sub: 'G UNITS' },
  vvi: { x: 925, y: 320, r: 52, from: -6, to: 6, step: 1, major: 2, a: (v) => -90 + v * 12, label: 'INERTIAL CLIMB', sub: 'FT/SEC X100', fmt: (v) => String(Math.abs(v)) },
  height: { x: 930, y: 205, r: 50, from: 0, to: 9, step: 0.5, major: 1, a: (v) => v * 36, label: 'INERTIAL', sub: 'HEIGHT' },
  speed: { x: 1040, y: 250, r: 56, from: 0, to: 7, step: 0.25, major: 1, a: (v) => v * 360 / 8, label: 'INERTIAL SPEED', sub: 'FPS X1000' },
  roll: { x: 802, y: 455, r: 46, from: -200, to: 200, step: 25, major: 50, a: (v) => v * 0.65, label: 'ROLL', sub: 'DEG/SEC', fmt: (v) => String(Math.abs(v)) },
  fuel: { x: 683, y: 402, r: 33, from: 0, to: 10, step: 1, major: 2, a: (v) => -135 + v * 27, label: 'FUEL QTY' },
  chamber: { x: 700, y: 557, r: 46, from: 0, to: 10, step: 0.5, major: 1, a: (v) => -135 + v * 27, label: 'CHAMBER', sub: 'PSI X100' },
  clock: { x: 900, y: 572, r: 32, from: 1, to: 12, step: 1, major: 1, a: (v) => v * 30, label: '' },
};
const ADI = { x: 790, y: 318, r: 70 }, AZI = { x: 800, y: 190, r: 44 };

/** The fixed part of the panel, drawn once. */
function drawStatic() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#25272a';
  g.beginPath(); OUTLINE.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.fill();
  // Sub-panel outlines and the lighter frames round the flight group (as in the figure).
  g.strokeStyle = '#bdbab2'; g.lineWidth = R(1.4);
  g.strokeRect(X(518), Y(185), R(400), R(255));
  g.strokeRect(X(860), Y(410), R(352), R(212));
  for (const [x, y, r, label] of STATIC_DIALS) dial(g, x, y, r, { from: 0, to: 10, step: 1, major: 2, a: (v) => -135 + v * 27, label });
  for (const [x, y, w, label] of LIGHTS) {
    g.fillStyle = '#0b0c0d'; g.fillRect(X(x - w / 2), Y(y - 7), R(w), R(14));
    g.fillStyle = '#9a978f'; g.font = `600 ${R(8.5)}px "IBM Plex Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, X(x), Y(y));
  }
  for (const [x, y] of SWITCHES) {
    g.fillStyle = '#3a3c3f'; g.beginPath(); g.arc(X(x), Y(y), R(7), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9c6be'; g.fillRect(X(x - 2), Y(y - 12), R(4), R(12));
  }
  for (const d of Object.values(DIALS)) dial(g, d.x, d.y, d.r, d);
  // Attitude and azimuth cases (square, as drawn).
  g.fillStyle = '#121314'; g.fillRect(X(ADI.x - 95), Y(ADI.y - 92), R(190), R(184));
  g.fillRect(X(AZI.x - 52), Y(AZI.y - 52), R(104), R(104));
  return c;
}

/** Live: the moving needles, the attitude sphere, the azimuth card and the clock. */
function drawLive(g, r) {
  const D = DIALS;
  needle(g, D.airspeed.x, D.airspeed.y, D.airspeed.r, Math.min(r.kias ?? 0, 900) / 100 * 36);
  const alt = Math.max(0, r.altitudeFt ?? 0);
  needle(g, D.altitude.x, D.altitude.y, D.altitude.r, (alt % 10000) / 1000 * 36, { len: 0.82 });
  needle(g, D.altitude.x, D.altitude.y, D.altitude.r, (alt % 100000) / 10000 * 36, { len: 0.55, width: 4 });
  needle(g, D.altitude.x, D.altitude.y, D.altitude.r, Math.min(alt, 1e6) / 100000 * 36, { len: 0.35, width: 6, color: '#d8d4ca' });
  needle(g, D.alpha.x, D.alpha.y, D.alpha.r, D.alpha.a(Math.max(-10, Math.min(40, r.alpha ?? 0))));
  needle(g, D.accel.x, D.accel.y, D.accel.r, D.accel.a(Math.max(-4, Math.min(12, r.nz ?? 1))));
  needle(g, D.vvi.x, D.vvi.y, D.vvi.r, D.vvi.a(Math.max(-6, Math.min(6, (r.vsFpm ?? 0) / 60 / 100))));
  const h = Math.max(0, r.altitudeFt ?? 0);
  needle(g, D.height.x, D.height.y, D.height.r, (h % 100000) / 10000 * 36, { len: 0.8 });
  needle(g, D.height.x, D.height.y, D.height.r, Math.min(h, 1e6) / 100000 * 36, { len: 0.5, width: 4 });
  needle(g, D.speed.x, D.speed.y, D.speed.r, D.speed.a(Math.min(8, (r.ktas ?? 0) * 1.68781 / 1000)));
  needle(g, D.roll.x, D.roll.y, D.roll.r, D.roll.a(Math.max(-200, Math.min(200, r.rollRate ?? 0))));
  needle(g, D.fuel.x, D.fuel.y, D.fuel.r, D.fuel.a(10 * Math.max(0, Math.min(1, (r.propellantLb ?? 0) / 18000))));
  needle(g, D.chamber.x, D.chamber.y, D.chamber.r, D.chamber.a(r.engine ? 6 * (r.throttle ?? 0) : 0));
  const now = new Date(), hh = now.getHours() % 12 + now.getMinutes() / 60, mm = now.getMinutes() + now.getSeconds() / 60;
  needle(g, D.clock.x, D.clock.y, D.clock.r, hh * 30, { len: 0.5, width: 3 });
  needle(g, D.clock.x, D.clock.y, D.clock.r, mm * 6, { len: 0.8, width: 2 });

  // Attitude sphere: sky white and ground black as on the X-15's ball, a pitch ladder, banked.
  g.save();
  g.beginPath(); g.arc(X(ADI.x), Y(ADI.y), R(ADI.r), 0, Math.PI * 2); g.clip();
  g.translate(X(ADI.x), Y(ADI.y)); g.rotate(-(r.roll ?? 0) * Math.PI / 180);
  const ppd = R(ADI.r) / 45, y0 = (r.pitch ?? 0) * ppd;
  g.fillStyle = '#e9e6dc'; g.fillRect(-W, -2 * H + y0, 2 * W, 2 * H);
  g.fillStyle = '#1b1c1d'; g.fillRect(-W, y0, 2 * W, 2 * H);
  g.lineWidth = R(1.2);
  for (let p = -90; p <= 90; p += 10) {
    const y = y0 - p * ppd, w = R(p % 30 === 0 ? 34 : 18);
    g.strokeStyle = p > 0 ? '#2a2a2a' : '#d9d6cc';
    g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke();
  }
  g.restore();
  g.strokeStyle = '#e0a63c'; g.lineWidth = R(3);
  g.beginPath(); g.moveTo(X(ADI.x - 40), Y(ADI.y)); g.lineTo(X(ADI.x - 12), Y(ADI.y)); g.lineTo(X(ADI.x), Y(ADI.y + 7)); g.lineTo(X(ADI.x + 12), Y(ADI.y)); g.lineTo(X(ADI.x + 40), Y(ADI.y)); g.stroke();

  // Azimuth: a compass card turning under a fixed lubber line.
  g.save(); g.translate(X(AZI.x), Y(AZI.y)); g.rotate(-(r.heading ?? 0) * Math.PI / 180);
  g.fillStyle = '#060707'; g.beginPath(); g.arc(0, 0, R(AZI.r), 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e6df'; g.strokeStyle = '#e8e6df'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 10) {
    const a = d * Math.PI / 180, big = d % 30 === 0;
    g.lineWidth = R(big ? 1.4 : 0.8);
    g.beginPath(); g.moveTo(Math.sin(a) * R(AZI.r * (big ? 0.78 : 0.86)), -Math.cos(a) * R(AZI.r * (big ? 0.78 : 0.86))); g.lineTo(Math.sin(a) * R(AZI.r * 0.97), -Math.cos(a) * R(AZI.r * 0.97)); g.stroke();
    if (big) {
      g.save(); g.rotate(a); g.font = `600 ${R(9)}px "IBM Plex Sans", Arial, sans-serif`;
      g.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10), 0, -R(AZI.r * 0.6)); g.restore();
    }
  }
  g.restore();
  g.fillStyle = '#e0a63c'; g.beginPath(); g.moveTo(X(AZI.x), Y(AZI.y - AZI.r + 2)); g.lineTo(X(AZI.x - 5), Y(AZI.y - AZI.r + 12)); g.lineTo(X(AZI.x + 5), Y(AZI.y - AZI.r + 12)); g.fill();

  // The lights that mean something here: engine running, fire never.
  if (r.engine) {
    g.fillStyle = '#8fd16a'; g.font = `600 ${R(8.5)}px "IBM Plex Sans", Arial, sans-serif`; g.textAlign = 'center';
    g.fillText('IGN READY', X(470), Y(284));
  }
}

/**
 * The panel: a CanvasTexture of figure 1-2 and the material it is drawn with. In a browser
 * without a 2D canvas (the headless checks), a plain dark material.
 */
export function makeX15Panel() {
  const ok = typeof document !== 'undefined' && document.createElement?.('canvas')?.getContext?.('2d');
  if (!ok) return { material: new THREE.MeshStandardMaterial({ name: 'x15-panel', color: 0x25272a, roughness: 0.7 }), update() {} };
  const base = drawStatic();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  // At rest on the exhibit: every needle at zero, the sphere level, the clock running.
  drawLive(g, { nz: 1 });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.name = 'x15-panel';
  const material = new THREE.MeshStandardMaterial({ name: 'x15-panel', map: tex, transparent: false, alphaTest: 0.5, roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 });
  let last = 0;
  return {
    material,
    /** Redraws the live instruments from the flight's readout, at most ~30 times a second. */
    update(r) {
      const now = performance.now();
      if (now - last < 33) return;
      last = now;
      g.clearRect(0, 0, W, H);
      g.drawImage(base, 0, 0);
      drawLive(g, r);
      tex.needsUpdate = true;
    },
  };
}

/** Size of the panel in metres and the figure pixel → panel-plane mapping, for the builder. */
export const PANEL_SIZE = { width: (PANEL.x1 - PANEL.x0) * PANEL.mpp, height: (PANEL.y1 - PANEL.y0) * PANEL.mpp };
