/**
 * Falcon 1, late Merlin 1C configuration, metres, nozzle exit datum y=0.
 * Published constraints come from the SpaceX Falcon 1 User's Guide Rev 7 (May 2008):
 * 21.336 m overall, 1.6764 m stage diameter, and a 1.54 m x 3.50 m aluminium
 * skin-and-stringer biconic fairing. Unpublished stations and exposed plumbing are
 * measured reconstructions from late-configuration photographs.
 */
import * as THREE from 'three';
import { lathe, mesh, tube, mat4, mergeAll } from '../geometry/utils.js';

const H = 21.336, R = 1.6764 / 2, FR = 1.54 / 2;
const AFT_BODY = 1.55, S1_TOP = 12.65, S2_BASE = 15.15, FAIRING_BASE = H - 3.50;

function cleanPole(g) {
  const p = g.attributes.position, source = g.index.array, out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < source.length; i += 3) {
    a.fromBufferAttribute(p, source[i]); b.fromBufferAttribute(p, source[i + 1]); c.fromBufferAttribute(p, source[i + 2]);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) out.push(source[i], source[i + 1], source[i + 2]);
  }
  g.setIndex(out); return g;
}
function own(base, name) { const m = base.clone(); m.name = `falcon1-${name}`; return m; }
function ring(root, material, radius, y, name, thickness = 0.012) {
  const o = mesh(new THREE.TorusGeometry(radius, thickness, 6, 80), material,
    { name, position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] });
  o.userData.lodFeature = thickness * 2; root.add(o); return o;
}
function strut(a, b, radius, material, name) {
  const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), d = q.clone().sub(p);
  const o = mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 10), material, { name });
  o.position.copy(p).add(q).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}
function nozzle(profile, outer, inner, name) {
  const inside = profile.map(p => ({ r: Math.max(0.012, p.r - 0.018), y: p.y + 0.004 })).reverse();
  const shell = mesh(lathe([...profile, ...inside, profile[0]], { segments: 96 }), outer, { name });
  shell.add(mesh(lathe(profile.map(p => ({ r: Math.max(0.01, p.r - 0.025), y: p.y + 0.008 })),
    { segments: 96, flip: true }), inner, { name: `${name}-inner` }));
  shell.userData.reconstruction = 'Photogrammetric contour; engine identity is documented.';
  for (const p of profile.slice(1, -2).filter((_, i) => i % 2 === 0)) ring(shell, outer, p.r + 0.004, p.y, `${name}-stiffener`, 0.009);
  return shell;
}

function merlin1C(root, A) {
  const e = new THREE.Group(); e.name = 'falcon1-merlin1c'; e.userData.engineCount = 1;
  e.userData.reconstruction = 'External plumbing and support geometry reconstructed from Merlin 1C photographs.';
  const bell = [{ r: .43, y: 0 }, { r: .425, y: .09 }, { r: .38, y: .26 }, { r: .31, y: .48 },
    { r: .225, y: .72 }, { r: .145, y: .92 }, { r: .115, y: 1.08 }, { r: .145, y: 1.18 }];
  e.add(nozzle(bell, A.merlinBell, A.bellInner, 'falcon1-merlin1c-bell'));
  e.add(mesh(new THREE.CylinderGeometry(.155, .13, .36, 32), A.chamber,
    { name: 'falcon1-merlin1c-chamber', position: [0, 1.34, 0] }));
  ring(e, A.metal, .17, 1.17, 'falcon1-merlin1c-throat-flange', .018);
  ring(e, A.metal, .19, 1.50, 'falcon1-merlin1c-injector-flange', .018);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    e.add(strut([Math.sin(a) * .19, 1.43, Math.cos(a) * .19], [Math.sin(a) * .61, 1.61, Math.cos(a) * .61],
      .022, A.metal, 'falcon1-merlin1c-thrust-leg'));
  }
  ring(e, A.metal, .62, 1.61, 'falcon1-merlin1c-thrust-ring', .026);
  e.add(mesh(new THREE.SphereGeometry(.19, 24, 16), A.metal,
    { name: 'falcon1-merlin1c-turbopump', position: [.32, 1.42, .03], scale: [1, .76, .82] }));
  e.add(mesh(new THREE.CylinderGeometry(.12, .15, .30, 18), A.darkMetal,
    { name: 'falcon1-merlin1c-gas-generator', position: [-.27, 1.40, -.05], rotation: [0, 0, -.28] }));
  const feeds = [
    [[-.52, 1.62, .12], [-.42, 1.54, .10], [-.22, 1.38, .05], [-.12, 1.25, .02]],
    [[.50, 1.62, -.12], [.45, 1.52, -.08], [.30, 1.42, -.01], [.15, 1.28, .02]],
    [[.02, 1.65, .48], [.08, 1.52, .37], [.16, 1.36, .24], [.12, 1.22, .12]],
  ];
  feeds.forEach((points, i) => {
    const line = mesh(tube(points, i === 2 ? .035 : .048, { tubular: 30, radial: 10 }),
      i === 1 ? A.pipeDark : A.metal, { name: 'falcon1-merlin1c-feed-line' });
    line.userData.lodFeature = i === 2 ? .07 : .096; e.add(line);
  });
  const exhaust = mesh(tube([[-.28, 1.38, -.04], [-.42, 1.18, -.02], [-.50, .86, 0], [-.50, .54, 0]],
    .052, { tubular: 28, radial: 10 }), A.pipeDark, { name: 'falcon1-merlin1c-turbine-exhaust' });
  exhaust.userData.lodFeature = .10; e.add(exhaust);
  e.add(mesh(new THREE.CylinderGeometry(.09, .055, .22, 18, 1, true), A.pipeDark,
    { name: 'falcon1-merlin1c-exhaust-nozzle', position: [-.50, .44, 0] }));
  // Thrust structure the chamber bolts to, and the fuel-pump volute opposite the ox pump.
  // Both are the photographed Merlin 1C arrangement; exact clocking is approximate.
  e.add(mesh(new THREE.CylinderGeometry(.22, .22, .06, 24), A.metal,
    { name: 'falcon1-merlin1c-thrust-plate', position: [0, 1.62, 0] }));
  e.add(mesh(new THREE.SphereGeometry(.11, 16, 12), A.darkMetal,
    { name: 'falcon1-merlin1c-fuel-pump', position: [-.08, 1.48, .28], scale: [1, .7, .85] }));
  root.add(e);
}

function kestrel(root, A, y) {
  const e = new THREE.Group(); e.name = 'falcon1-kestrel2'; e.position.y = y; e.userData.engineCount = 1;
  e.userData.reconstruction = 'External Kestrel envelope reconstructed; pressure-fed cycle is documented.';
  const bell = [{ r: .47, y: 0 }, { r: .46, y: .12 }, { r: .40, y: .32 }, { r: .31, y: .57 },
    { r: .20, y: .80 }, { r: .105, y: 1.02 }, { r: .115, y: 1.12 }];
  e.add(nozzle(bell, A.kestrelBell, A.bellInner, 'falcon1-kestrel2-bell'));
  e.add(mesh(new THREE.CylinderGeometry(.125, .105, .28, 24), A.chamber,
    { name: 'falcon1-kestrel2-chamber', position: [0, 1.25, 0] }));
  ring(e, A.metal, .145, 1.10, 'falcon1-kestrel2-throat-flange', .014);
  for (const s of [-1, 1]) e.add(mesh(tube([[s * .42, 1.62, 0], [s * .32, 1.50, .02],
    [s * .20, 1.34, .03], [s * .11, 1.27, .02]], .038, { tubular: 24, radial: 9 }),
  A.metal, { name: 'falcon1-kestrel2-pressure-feed' }));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    e.add(strut([Math.sin(a) * .13, 1.35, Math.cos(a) * .13], [Math.sin(a) * .58, 1.72, Math.cos(a) * .58],
      .019, A.metal, 'falcon1-kestrel2-thrust-leg'));
  }
  root.add(e);
}

function tank(root, material, radius, bottom, top, name) {
  const dome = Math.min(radius * .42, (top - bottom) * .22), profile = [];
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; profile.push({ r: radius * Math.sin(a), y: bottom + dome * (1 - Math.cos(a)) }); }
  profile.push({ r: radius, y: top - dome });
  for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 2; profile.push({ r: radius * Math.cos(a), y: top - dome + dome * Math.sin(a) }); }
  const o = mesh(cleanPole(lathe(profile, { segments: 64 })), material, { name });
  o.userData.reconstruction = 'Representative tank volume; unpublished dome stations are approximate.'; root.add(o);
}
const fairingProfile = () => [
  { r: FR, y: FAIRING_BASE, sharp: true }, { r: FR, y: FAIRING_BASE + 1.48, sharp: true },
  { r: .52, y: FAIRING_BASE + 2.24, sharp: true }, { r: .19, y: FAIRING_BASE + 3.18 },
  { r: .10, y: H - .11 }, { r: 0, y: H },
];

export function buildFalcon1(M) {
  const root = new THREE.Group(); root.name = 'falcon1';
  const A = {
    stage1: own(M.falcon1Stage1 ?? M.whiteFresh, 'first-stage-paint'),
    upper: own(M.whiteFresh, 'upper-stage-paint'), fairing: own(M.whitePanel ?? M.whiteFresh, 'fairing-paint'),
    interstage: own(M.falcon1Interstage ?? M.blackMatte, 'interstage-panels'),
    dark: own(M.blackMatte, 'dark'), pipeDark: own(M.darkMetal, 'plumbing-dark'),
    metal: own(M.aluminum, 'aluminium'), darkMetal: own(M.alumDark, 'dark-aluminium'),
    tank: own(M.aluminum, 'tank-shell'), chamber: own(M.aluminum, 'engine-chamber'),
    merlinBell: own(M.bellCool, 'merlin1c-bell'), kestrelBell: own(M.bellCool, 'kestrel2-bell'),
    bellInner: own(M.bellInner ?? M.blackMatte, 'bell-inner'),
  };
  A.merlinBell.color.setHex(0xaaa39a); A.kestrelBell.color.setHex(0x77736e);
  A.stage1.color.setHex(0xf3f1eb); A.upper.color.setHex(0xeeece7); A.fairing.color.setHex(0xf0eee8);
  A.tank.color.setHex(0xc5c7c8); A.tank.roughness = .58;

  root.add(mesh(lathe([{ r: .61, y: 1.18, sharp: true }, { r: .73, y: 1.40 },
    { r: R, y: AFT_BODY, sharp: true }, { r: R, y: S1_TOP, sharp: true }],
  { segments: 128, uvMode: 'normalized' }), A.stage1, { name: 'falcon1-stage1' }));
  root.add(mesh(lathe([{ r: R, y: S1_TOP }, { r: R, y: S2_BASE }],
    { segments: 112, uvMode: 'normalized' }), A.interstage, { name: 'falcon1-interstage' }));
  root.add(mesh(lathe([{ r: R, y: S2_BASE, sharp: true }, { r: R, y: FAIRING_BASE - .30, sharp: true },
    { r: FR, y: FAIRING_BASE, sharp: true }], { segments: 112 }), A.upper, { name: 'falcon1-stage2' }));
  const fairing = fairingProfile();
  root.add(mesh(cleanPole(lathe(fairing, { segments: 128 })), A.fairing, { name: 'falcon1-fairing' }));
  merlin1C(root, A); kestrel(root, A, S1_TOP + .10);

  [AFT_BODY, S1_TOP, S1_TOP + .10, S2_BASE, FAIRING_BASE - .30, FAIRING_BASE].forEach(y =>
    ring(root, A.metal, y >= FAIRING_BASE ? FR : R + .002, y, 'falcon1-structural-joint', .010));
  [[FAIRING_BASE + 1.48, FR], [FAIRING_BASE + 2.24, .52]].forEach(([y, r]) =>
    ring(root, A.metal, r + .004, y, 'falcon1-fairing-frame', .008));

  const raceway = mesh(new THREE.CapsuleGeometry(.055, 10.15, 6, 12), A.upper,
    { name: 'falcon1-raceway', position: [0, 7.05, R + .035] });
  raceway.scale.set(.72, 1, .48); raceway.userData.lodFeature = .08; root.add(raceway);
  for (const side of [-1, 1]) {
    const seam = mesh(tube(fairing.map(p => [0, p.y, side * (p.r + .006)]), .006,
      { tubular: 36, radial: 6, type: 'centripetal' }), A.dark, { name: 'falcon1-fairing-split-line' });
    seam.userData.lodFeature = .012; root.add(seam);
  }
  const port = mesh(new THREE.CircleGeometry(.10, 32), A.darkMetal,
    { name: 'falcon1-fairing-access', position: [0, FAIRING_BASE + .72, FR + .008] });
  port.userData.lodFeature = .20; root.add(port);

  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, pod = new THREE.Group();
    pod.name = 'falcon1-upper-stage-rcs'; pod.position.set(Math.sin(a) * (R + .01), FAIRING_BASE - .50, Math.cos(a) * (R + .01));
    pod.rotation.y = a; pod.add(mesh(new THREE.ConeGeometry(.045, .13, 12, 1, true), A.darkMetal,
      { rotation: [Math.PI / 2 + THREE.MathUtils.degToRad(20), 0, 0] }));
    pod.userData.reconstruction = 'RCS clocking and envelope reconstructed; 20 degree forward cant documented.'; root.add(pod);
  }

  const interior = new THREE.Group(); interior.name = 'falcon1-reconstructed-interior';
  interior.userData.reconstruction = 'Educational upper-stage tank, feed and thrust structure reconstruction.';
  // Retain the rear half of the stage in the cutaway so the tanks and thrust structure remain
  // visibly installed in an airframe rather than reading as an exploded diagram.
  // The retained half is real skin, not a glass tube. The cut face is open so the
  // tanks, feeds and frames read as hardware installed in the airframe.
  interior.add(mesh(lathe([{ r: R - .018, y: S1_TOP + .08 }, { r: R - .018, y: S2_BASE }],
    { segments: 64, phiStart: Math.PI * .75, phiLength: Math.PI }), A.upper,
  { name: 'falcon1-cutaway-interstage-shell' }));
  interior.add(mesh(lathe([{ r: R - .02, y: S2_BASE }, { r: R - .02, y: FAIRING_BASE - .30 }],
    { segments: 64, phiStart: Math.PI * .75, phiLength: Math.PI }), A.upper,
  { name: 'falcon1-cutaway-rear-shell' }));
  for (const y of [S1_TOP + .10, S2_BASE, S2_BASE + 1.04]) {
    const frame = mesh(new THREE.TorusGeometry(R - .045, .018, 6, 48, Math.PI), A.metal,
      { name: 'falcon1-cutaway-frame', position: [0, y, 0], rotation: [Math.PI / 2, 0, Math.PI * .75] });
    frame.userData.lodFeature = .036; interior.add(frame);
  }
  tank(interior, A.tank, R - .075, S2_BASE + .14, S2_BASE + 1.02, 'falcon1-upper-rp1-tank');
  tank(interior, A.tank, R - .075, S2_BASE + 1.06, FAIRING_BASE - .38, 'falcon1-upper-lox-tank');
  ring(interior, A.metal, R - .068, S2_BASE + 1.04, 'falcon1-upper-common-bulkhead', .018);
  interior.add(mesh(new THREE.CircleGeometry(R - .09, 40), A.tank,
    { name: 'falcon1-upper-bulkhead-web', position: [0, S2_BASE + 1.04, 0], rotation: [Math.PI / 2, 0, 0] }));
  const longerons = [];
  // Lips along the two cut edges, so the opening reads as a wall with thickness.
  for (const a of [Math.PI * 0.75, Math.PI * 1.75]) {
    longerons.push({
      geometry: new THREE.BoxGeometry(0.045, FAIRING_BASE - S2_BASE - 0.2, 0.06),
      matrix: mat4([Math.sin(a) * (R - 0.03), (S2_BASE + FAIRING_BASE) / 2, Math.cos(a) * (R - 0.03)], [0, a, 0]),
    });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    longerons.push({
      geometry: new THREE.BoxGeometry(0.02, FAIRING_BASE - S2_BASE - 0.7, 0.04),
      matrix: mat4([Math.sin(a) * (R - 0.05), (S2_BASE + FAIRING_BASE) / 2 - 0.2, Math.cos(a) * (R - 0.05)], [0, a, 0]),
    });
  }
  interior.add(mesh(mergeAll(longerons), A.metal, { name: 'falcon1-upper-longerons' }));
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    interior.add(strut([Math.sin(a) * .18, S1_TOP + 1.55, Math.cos(a) * .18],
      [Math.sin(a) * (R - .09), S2_BASE + .14, Math.cos(a) * (R - .09)], .018, A.metal, 'falcon1-kestrel-thrust-frame'));
  }
  for (const s of [-1, 1]) interior.add(mesh(tube([[s * .42, S2_BASE + 1.9, 0], [s * .43, S2_BASE + .9, 0],
    [s * .34, S2_BASE + .2, 0], [s * .18, S2_BASE - .05, 0]], .027, { tubular: 28, radial: 8 }),
  A.metal, { name: 'falcon1-upper-stage-feed-line' }));
  root.add(interior);

  const closed = new THREE.Group(); closed.name = 'falcon1-closed-shell';
  for (const o of [...root.children].filter(o => ['falcon1-interstage', 'falcon1-stage2', 'falcon1-fairing',
    'falcon1-fairing-split-line', 'falcon1-fairing-access', 'falcon1-upper-stage-rcs'].includes(o.name)
    || (o.name === 'falcon1-structural-joint' && o.position.y >= S1_TOP))) closed.add(o);
  root.add(closed); interior.add(root.getObjectByName('falcon1-kestrel2')); interior.visible = false;

  root.userData.height = H;
  root.userData.stations = { aftBody: AFT_BODY, firstStageTop: S1_TOP, secondStageBase: S2_BASE,
    fairingBase: FAIRING_BASE, fairingHeight: H - FAIRING_BASE };
  root.userData.cutaway = { shell: ['falcon1-closed-shell'], interior: 'falcon1-reconstructed-interior',
    label: 'Educational reconstruction: upper tanks, feed lines and Kestrel support; unpublished stations are approximate.' };
  root.userData.annotations = [
    { label: 'Merlin 1C · pump-fed engine', position: [.38, .76, .48] },
    { label: 'First-stage tank · 402 in published length', position: [0, 7.0, R + .15] },
    { label: 'Stage separation · bolts and pneumatic pushers', position: [0, S1_TOP + .10, R + .15] },
    { label: 'Kestrel 2 · pressure-fed and restartable', position: [0, 13.55, R + .15] },
    { label: 'Aluminium-lithium upper stage', position: [0, 16.35, R + .15] },
    { label: 'Biconic fairing · 1.54 m × 3.50 m', position: [0, 19.40, FR + .15] },
  ];
  return root;
}
