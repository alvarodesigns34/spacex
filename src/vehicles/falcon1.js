/**
 * Falcon 1, late Merlin 1C configuration, metres, engine exit datum y=0.
 * SpaceX Falcon 1 User's Guide Rev 7 (May 2008), Table 2-1 and §2.1.1.4:
 * 70 ft overall, 5.5 ft tanks, 1.54 m aluminium biconic fairing. The proposed
 * Falcon 1e's larger ogive is deliberately not used. See data/falcon1.js sources.
 * Stations and engine hardware below are documented reconstructions. These are
 * separate geometries, never scaled Merlin 1D / MVac assets from Falcon 9.
 */
import * as THREE from 'three';
import { lathe, mesh, boxUV } from '../geometry/utils.js';

const H = 21.336, R = 1.6764 / 2, FR = 1.54 / 2;
const ENGINE_TOP = 1.8, TANK_TOP = 12.6, S2_BASE = 14.3, FAIRING_BASE = 17.8;

/** A revolved axis point has one empty triangle per segment; omit those faces. */
function withoutPoleTriangles(geometry) {
  const position = geometry.attributes.position, source = geometry.index.array, indices = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < source.length; i += 3) {
    a.fromBufferAttribute(position, source[i]);
    b.fromBufferAttribute(position, source[i + 1]);
    c.fromBufferAttribute(position, source[i + 2]);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) indices.push(source[i], source[i + 1], source[i + 2]);
  }
  geometry.setIndex(indices);
  return geometry;
}

function own(base, name) {
  const material = base.clone();
  material.name = `falcon1-${name}`;
  return material;
}

function ring(root, material, radius, y, name, thickness = 0.018) {
  const part = mesh(new THREE.TorusGeometry(radius, thickness, 6, 64), material,
    { name, position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] });
  part.userData.lodFeature = thickness * 2;
  root.add(part);
}

/** Hollow nozzle with a continuous rolled lip and inward-facing inner surface. */
function nozzle(profile, material, name) {
  const inner = profile.map(p => ({ r: Math.max(0.01, p.r - 0.014), y: p.y })).reverse();
  const bell = mesh(lathe([...profile, ...inner, profile[0]], { segments: 72 }), material, { name });
  bell.userData.reconstruction = 'Contour and dimensions are approximate; engine identity is documented.';
  return bell;
}

function addEngine(root, A, { kestrel = false, y = 0 } = {}) {
  const engine = new THREE.Group();
  engine.name = kestrel ? 'falcon1-kestrel2' : 'falcon1-merlin1c';
  engine.position.y = y;
  engine.userData.engineCount = 1;
  engine.userData.reconstruction = 'Representative hardware; not a manufacturing model.';
  const profile = kestrel
    ? [{ r: 0.48, y: 0 }, { r: 0.43, y: 0.15 }, { r: 0.31, y: 0.42 }, { r: 0.16, y: 0.76 }, { r: 0.085, y: 0.9 }, { r: 0.12, y: 1.03 }]
    : [{ r: 0.43, y: 0 }, { r: 0.39, y: 0.12 }, { r: 0.31, y: 0.34 }, { r: 0.21, y: 0.6 }, { r: 0.12, y: 0.84 }, { r: 0.15, y: 1.03 }, { r: 0.17, y: 1.21 }];
  engine.add(nozzle(profile, kestrel ? A.kestrelBell : A.bell, `${engine.name}-bell`));
  const top = kestrel ? 1.03 : 1.21;
  engine.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.23, 24), A.metal,
    { position: [0, top + 0.1, 0], name: `${engine.name}-injector` }));
  ring(engine, A.metal, 0.17, top, `${engine.name}-flange`);
  if (!kestrel) {
    // A single pump housing and offset turbine exhaust distinguish the 1C assembly.
    // Their relative positions are illustrative; no decorative plumbing forest.
    engine.add(mesh(new THREE.SphereGeometry(0.21, 20, 12), A.metal,
      { name: 'falcon1-merlin1c-pump', position: [0.32, 1.38, 0] }));
    const exhaust = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.93, 16, 1, true), A.dark,
      { name: 'falcon1-merlin1c-exhaust', position: [0.52, 0.79, 0] });
    exhaust.userData.lodFeature = 0.17;
    engine.add(exhaust);
  }
  // Two simple propellant feeds; Kestrel has no turbopump.
  for (const sign of [-1, 1]) {
    const feed = mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.4, 10), A.metal,
      { name: `${engine.name}-feed`, position: [sign * 0.2, top + 0.18, 0] });
    feed.userData.lodFeature = 0.086;
    engine.add(feed);
  }
  root.add(engine);
}

function tank(root, material, radius, bottom, top, name) {
  // Closed empty tanks, exposed only if a visitor hides the exterior.
  const dome = Math.min(0.5, (top - bottom) * 0.2);
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * Math.PI / 2;
    profile.push({ r: radius * Math.sin(a), y: bottom + dome * (1 - Math.cos(a)) });
  }
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * Math.PI / 2;
    profile.push({ r: radius * Math.cos(a), y: top - dome + dome * Math.sin(a) });
  }
  const part = mesh(withoutPoleTriangles(lathe(profile, { segments: 48 })), material, { name });
  part.userData.reconstruction = 'Representative empty tank volume; dome stations are approximate.';
  root.add(part);
}

export function buildFalcon1(M) {
  const root = new THREE.Group();
  root.name = 'falcon1';
  // Clone materials so per-exhibit inspection never changes another vehicle.
  const A = {
    paint: own(M.whiteFresh, 'paint'), dark: own(M.blackMatte, 'dark'),
    metal: own(M.aluminum, 'aluminium'), inner: own(M.alumDark, 'tank-interior'),
    bell: own(M.bellCool, 'merlin1c-bell'), kestrelBell: own(M.bellCool, 'kestrel2-bell'),
  };
  A.kestrelBell.color.setHex(0x88847d);
  root.add(mesh(lathe([{ r: R, y: 1.3 }, { r: R, y: TANK_TOP }], { segments: 96 }), A.paint, { name: 'falcon1-stage1' }));
  root.add(mesh(lathe([{ r: R, y: TANK_TOP }, { r: R, y: S2_BASE }], { segments: 96 }), A.dark, { name: 'falcon1-interstage' }));
  root.add(mesh(lathe([{ r: R, y: S2_BASE }, { r: R, y: FAIRING_BASE - 0.32 }, { r: FR, y: FAIRING_BASE }], { segments: 96 }), A.paint, { name: 'falcon1-stage2' }));
  const fairing = [{ r: FR, y: FAIRING_BASE }, { r: FR, y: 19.55, sharp: true },
    { r: 0.29, y: 20.9, sharp: true }, { r: 0, y: H }];
  root.add(mesh(withoutPoleTriangles(lathe(fairing, { segments: 96 })), A.paint, { name: 'falcon1-fairing' }));
  // Base skirt ends above the nozzle exit and leaves the single engine readable.
  root.add(mesh(lathe([{ r: R * 0.91, y: 0.86 }, { r: R, y: 1.3 }], { segments: 64 }), A.dark, { name: 'falcon1-aft-skirt' }));
  addEngine(root, A);
  addEngine(root, A, { kestrel: true, y: 12.86 });
  const interior = new THREE.Group();
  interior.name = 'falcon1-reconstructed-interior';
  interior.userData.reconstruction = 'Educational reconstruction of tank architecture and engine support.';
  tank(interior, A.inner, R - 0.065, 14.36, 15.65, 'falcon1-upper-rp1-tank');
  tank(interior, A.inner, R - 0.065, 15.65, 17.7, 'falcon1-upper-lox-tank');
  // Representative load path, shown only in this explicitly educational cutaway.
  // Tank skins are not floating detached from the engine thrust frame.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    interior.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 3.55, 8), A.metal,
      { name: 'falcon1-cutaway-longeron', position: [Math.sin(a) * (R - 0.04), 16.025, Math.cos(a) * (R - 0.04)] }));
  }
  const support = mesh(new THREE.ConeGeometry(0.75, 0.25, 32, 1, true), A.metal,
    { name: 'falcon1-kestrel-thrust-frame', position: [0, 14.18, 0], rotation: [Math.PI, 0, 0] });
  interior.add(support);
  root.add(interior);
  for (const y of [1.8, 5.6, TANK_TOP, S2_BASE, FAIRING_BASE]) ring(root, A.metal, y === FAIRING_BASE ? FR : R, y, 'falcon1-structural-joint');
  const raceway = mesh(boxUV(new THREE.BoxGeometry(0.11, 10.7, 0.065)), A.paint,
    { name: 'falcon1-raceway', position: [0, 7.15, R + 0.025] });
  root.add(raceway);
  // Fairing split and the published 0.2 m access port. No invented fastener grid.
  const seam = mesh(lathe(fairing.map(p => ({ ...p, r: p.r + 0.001 })),
    { segments: 1, phiStart: -0.002, phiLength: 0.004 }), A.dark, { name: 'falcon1-fairing-seam' });
  seam.userData.lodFeature = 0.015;
  root.add(seam);
  const port = mesh(new THREE.CircleGeometry(0.1, 24), A.metal,
    { name: 'falcon1-fairing-access', position: [0, 18.5, FR + 0.004] });
  port.userData.lodFeature = 0.2;
  root.add(port);
  // Hide the shell through a parent so its own LOD cannot turn it back on in the cutaway.
  const closedShell = new THREE.Group();
  closedShell.name = 'falcon1-closed-shell';
  for (const name of ['falcon1-interstage', 'falcon1-stage2', 'falcon1-fairing', 'falcon1-fairing-seam', 'falcon1-fairing-access']) {
    closedShell.add(root.getObjectByName(name));
  }
  root.add(closedShell);
  interior.add(root.getObjectByName('falcon1-kestrel2'));
  interior.visible = false;
  root.userData.height = H;
  root.userData.stations = { tankTop: TANK_TOP, s2Base: S2_BASE, fairingBase: FAIRING_BASE };
  // The app can hide these named shell nodes only while the cutaway preset is active.
  // All interior hardware already exists at its installed station, not in an exploded pose.
  root.userData.cutaway = {
    shell: ['falcon1-closed-shell'],
    interior: 'falcon1-reconstructed-interior',
    label: 'Educational reconstruction: upper tanks and Kestrel; approximate internal geometry.',
  };
  root.userData.annotations = [
    { label: 'Merlin 1C · single pump-fed engine', position: [0.35, 0.62, 0.52] },
    { label: 'RP-1 tank · reconstructed station', position: [0, 4.1, R + 0.15] },
    { label: 'LOX tank · reconstructed station', position: [0, 9, R + 0.15] },
    { label: 'Kestrel 2 inside interstage · pressure-fed', position: [0, 13.5, R + 0.15] },
    { label: 'Aluminium-lithium upper stage', position: [0, 16.3, R + 0.15] },
    { label: 'Biconic fairing · 1.54 m diameter', position: [0, 19, FR + 0.15] },
  ];
  return root;
}
