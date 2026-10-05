/**
 * The Ninja H2R's materials and the textures drawn for them: the running gear's, the carbon's
 * twill, the titanium's heat tint, the radiator's core, the ducts' mesh, the decals' type.
 */
import * as THREE from 'three';
import { canvasTexture } from './geometry.js';

export function partMaterials(M) {
  if (M.h2rTyre) return;
  M.h2rTyre = new THREE.MeshStandardMaterial({ name: 'h2r-tyre', color: 0x18191a, metalness: 0, roughness: 0.78 });
  M.h2rRim = new THREE.MeshPhysicalMaterial({ name: 'h2r-rim', color: 0x0b0b0c, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.h2rMachined = new THREE.MeshStandardMaterial({ name: 'h2r-machined', color: 0xd9dcdf, metalness: 1, roughness: 0.18 });
  M.h2rRimStripe = new THREE.MeshStandardMaterial({ name: 'h2r-rim-stripe', color: 0x3fae3a, metalness: 0.3, roughness: 0.35 });
  // The discs: ground steel, drilled in the geometry; the faces' fine circular grinding (detail.js).
  M.h2rDiscF = new THREE.MeshStandardMaterial({ name: 'h2r-disc', color: 0xb9bbbd, metalness: 0.92, roughness: 0.3 });
  M.h2rDiscR = M.h2rDiscF;
  // The slicks' sidewalls: a deeper, satin black than the scuffed tread.
  M.h2rTyreWall = new THREE.MeshStandardMaterial({ name: 'h2r-tyre-wall', color: 0x0e0f10, metalness: 0, roughness: 0.6 });
  // The sprocket: dark anodised aluminium (the left rear photograph).
  M.h2rSprocket = new THREE.MeshStandardMaterial({ name: 'h2r-sprocket', color: 0x2a2b2e, metalness: 0.75, roughness: 0.4 });
  M.h2rCaliper = new THREE.MeshStandardMaterial({ name: 'h2r-calliper', color: 0x8e9196, metalness: 0.75, roughness: 0.42 });
  M.h2rPad = new THREE.MeshStandardMaterial({ name: 'h2r-pad', color: 0x9a6a3a, metalness: 0.6, roughness: 0.5 });
  M.h2rFork = new THREE.MeshPhysicalMaterial({ name: 'h2r-fork', color: 0x101112, metalness: 0.7, roughness: 0.18, clearcoat: 1 });
  M.h2rForkInner = new THREE.MeshStandardMaterial({ name: 'h2r-fork-inner', color: 0x2a2b2d, metalness: 0.9, roughness: 0.12 });
  M.h2rBlack = new THREE.MeshPhysicalMaterial({ name: 'h2r-black', color: 0x0a0b0c, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  M.h2rSatin = new THREE.MeshStandardMaterial({ name: 'h2r-satin-black', color: 0x141517, metalness: 0.45, roughness: 0.55 });
  M.h2rAlu = new THREE.MeshStandardMaterial({ name: 'h2r-aluminium', color: 0xc9ccd0, metalness: 0.95, roughness: 0.3 });
  M.h2rChain = new THREE.MeshStandardMaterial({ name: 'h2r-chain', color: 0x5a5b5d, metalness: 0.85, roughness: 0.45 });
  M.h2rGold = new THREE.MeshStandardMaterial({ name: 'h2r-gold', color: 0xc8941e, metalness: 0.95, roughness: 0.3 });
}

export function carbonMaterial() {
  const t = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = '#121315'; g.fillRect(0, 0, w, w);
    const s = w / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const k = (i + j) % 4 < 2;
      const grd = k ? g.createLinearGradient(i * s, 0, i * s + s, 0) : g.createLinearGradient(0, j * s, 0, j * s + s);
      grd.addColorStop(0, '#16171a'); grd.addColorStop(0.5, k ? '#3c3f45' : '#2a2c31'); grd.addColorStop(1, '#16171a');
      g.fillStyle = grd; g.fillRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1);
    }
  });
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); }
  return new THREE.MeshPhysicalMaterial({ name: 'h2r-carbon', color: 0xffffff, map: t, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04 });
}

/** The heat tint along a header (u from the port to the collector), ≈ from the photographs. */
export function heatTint() {
  const t = canvasTexture(512, 8, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    for (const [s, c] of [[0, '#d8c08a'], [0.1, '#c9a35e'], [0.2, '#9a6a8a'], [0.3, '#5a62a8'], [0.42, '#4b7fc0'], [0.55, '#7a5aa0'], [0.66, '#b0884e'], [0.8, '#a8813f'], [1, '#c6a670']]) grd.addColorStop(s, c);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  if (t) { t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; }
  return t;
}

export function radiatorTexture() {
  const t = canvasTexture(128, 128, (g, w) => {
    g.fillStyle = '#121314'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#2b2d30'; g.lineWidth = 1;
    for (let i = 0; i < w; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); }
    g.strokeStyle = '#1d1e20'; for (let j = 0; j < w; j += 10) { g.beginPath(); g.moveTo(0, j); g.lineTo(w, j); g.stroke(); }
  });
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); }
  return t;
}


export function meshTexture() {
  const t = canvasTexture(64, 64, (x, w) => {
    x.fillStyle = '#060708'; x.fillRect(0, 0, w, w);
    x.strokeStyle = '#2a2d31'; x.lineWidth = 2;
    for (let i = -w; i < 2 * w; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + w, w); x.stroke(); x.beginPath(); x.moveTo(i + w, 0); x.lineTo(i, w); x.stroke(); }
  });
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); }
  return t;
}

export const twoSided = (M, key, base, name) => { if (!M[key]) { M[key] = base.clone(); M[key].side = THREE.DoubleSide; M[key].name = name; } return M[key]; };
