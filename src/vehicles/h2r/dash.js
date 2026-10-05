/** The instrument panel. */
import * as THREE from 'three';
import { slab, mesh } from './geometry.js';
import { PXY } from './photo.js';

/** The dash: housing and face; the face is a canvas texture the ride redraws (rpm, gear, speed, lean). */
export function buildDash(M) {
  const g = new THREE.Group(); g.name = 'h2r-dash';
  const P = (u, v, z = 0) => new THREE.Vector3(...PXY(u, v), z);
  // Above the top clamp, where the rider sees it over the clamp and the fork caps (≈5 cm higher
  // than first traced, which the raised clamp hid).
  const c = P(318, 282).add(new THREE.Vector3(0.01, 0.05, 0));
  g.position.copy(c);
  // Facing up and back towards the rider's eye (≈60° from vertical).
  g.rotation.set(0, -Math.PI / 2, 0); g.rotateX(-1.0);
  const housing = slab([[-0.1, -0.055], [0.1, -0.055], [0.11, 0.04], [0.06, 0.065], [-0.06, 0.065], [-0.11, 0.04]], 0.04, 0.006);
  housing.translate(0, 0, -0.045);
  g.add(mesh(housing, M.h2rSatin, { name: 'h2r-dash-housing' }));
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex = null;
  if (canvas) { canvas.width = 512; canvas.height = 256; tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ name: 'h2r-dash-face', map: tex, color: tex ? 0xffffff : 0x0a0c0e, toneMapped: false }));
  face.name = 'h2r-dash-face'; face.position.z = 0.002;
  g.add(face);
  const draw = (rpm = 0, gear = 'N', kmh = 0, lean = 0, aids = true) => {
    if (!canvas) return;
    const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    x.fillStyle = '#050607'; x.fillRect(0, 0, W, H);
    // Tachometer: 0–16 (×1,000 /min), red from 14.
    const cx = 128, cy = 132, R = 112, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, at = (r) => a0 + (a1 - a0) * Math.min(1, r / 16000);
    x.strokeStyle = '#30343a'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, R, a0, a1); x.stroke();
    x.strokeStyle = '#d0141c'; x.lineWidth = 8; x.beginPath(); x.arc(cx, cy, R - 6, at(14000), a1); x.stroke();
    x.fillStyle = '#e8eef2'; x.font = 'bold 20px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let k = 0; k <= 16; k += 2) { const a = at(k * 1000); x.fillText(String(k), cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); }
    x.strokeStyle = '#e8eef2'; x.lineWidth = 2;
    for (let k = 0; k <= 16; k++) { const a = at(k * 1000); x.beginPath(); x.moveTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); x.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); x.stroke(); }
    const an = at(rpm);
    x.strokeStyle = '#ff5a1e'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * (R - 10), cy + Math.sin(an) * (R - 10)); x.stroke();
    x.fillStyle = '#222'; x.beginPath(); x.arc(cx, cy, 12, 0, Math.PI * 2); x.fill();
    // LCD: speed, gear, lean, aids.
    x.fillStyle = '#9fb6c4'; x.fillRect(268, 24, 228, 208);
    x.fillStyle = '#0d1418'; x.font = 'bold 86px Arial'; x.textAlign = 'right'; x.fillText(String(Math.round(kmh)), 470, 110);
    x.font = 'bold 22px Arial'; x.fillText('km/h', 486, 160);
    x.textAlign = 'left'; x.font = 'bold 64px Arial'; x.fillText(String(gear), 284, 190);
    x.font = 'bold 20px Arial'; x.fillText('GEAR', 284, 140);
    x.fillText(`LEAN ${Math.round(Math.abs(lean))}°`, 360, 210);
    x.fillText(aids ? 'KTRC 2' : 'KTRC OFF', 284, 46);
    if (tex) tex.needsUpdate = true;
  };
  draw();
  g.userData.draw = draw;
  return g;
}
