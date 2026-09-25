/**
 * Falcon 1, late Merlin 1C configuration, metres, nozzle exit datum y=0.
 *
 * Every station below is read off the manufacturer's own dimensioned drawing: Figure 2-5,
 * "Falcon 1 launch vehicle layout and coordinate system", in the SpaceX Falcon 1 User's Guide
 * Rev 7 (May 2008), whose stations are in inches from a datum just below the engine. Labelled
 * on the drawing: gimbal axis 100.00, fairing separation plane 756.36, payload mounting plane
 * 768.03, fairing slope changes 817.20 and 847.32, tip 891.83; stage Ø66.16, fairing Ø60.00.
 * Read off it at a measured 2.90 px/in (the labelled stations land within 0.3 in of their
 * lines): nozzle exit 26.3, throat 60, chamber head 84, aft end of the stage 133, tank barrel
 * 154, first-stage tank top / interstage 524, stage separation 648.8, Kestrel exit 556.5,
 * throat 610, upper-stage tank 653–739. y = (station − 26.3) × 0.0254.
 *
 * That makes the vehicle 865.5 in = 21.98 m from nozzle exit to tip, not the 70 ft (21.34 m)
 * of the same guide's summary table. The drawing wins here because it is dimensioned and
 * self-consistent: Figure 2-1 gives the fairing as 3.5 m [136 in] above the separation plane,
 * and 756.36 + 136 = 892.4, the drawing's tip. The table's 70 ft is a rounded figure.
 * Plumbing and small hardware remain reconstructions from late-configuration photographs.
 */
import * as THREE from 'three';
import { lathe, mesh, tube, mat4, mergeAll, boxUV } from '../geometry/utils.js';

const IN = 0.0254, EXIT = 26.3;
const st = (inches) => (inches - EXIT) * IN;          // drawing station → model height
const H = st(891.83), R = 66.16 * IN / 2, FR = 60.0 * IN / 2;
const AFT_BODY = st(133.3), TANK_BARREL = st(153.8), S1_TOP = st(524), S2_BASE = st(648.8), FAIRING_BASE = st(756.36);
const GIMBAL = st(100);

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
  e.userData.reconstruction = 'Envelope from the guide\'s Figure 2-5 (exit Ø≈34.8 in, throat Ø≈14 in at station 60, chamber head 84, gimbal 100); plumbing reconstructed from Merlin 1C photographs.';
  // Bell to the throat, then the regeneratively cooled chamber (Ø≈19 in) up to the injector.
  const bell = [{ r: .435, y: 0 }, { r: .43, y: .09 }, { r: .39, y: .26 }, { r: .32, y: .47 },
    { r: .245, y: .68 }, { r: .195, y: .81 }, { r: .178, y: st(60) }, { r: .205, y: .94 }, { r: .24, y: 1.02 }];
  e.add(nozzle(bell, A.merlinBell, A.bellInner, 'falcon1-merlin1c-bell'));
  const head = st(84);
  e.add(mesh(lathe([{ r: .24, y: 1.0 }, { r: .24, y: head - .06 }, { r: .21, y: head }, { r: .12, y: head + .06 }, { r: 0, y: head + .08 }], { segments: 48 }),
    A.chamber, { name: 'falcon1-merlin1c-chamber' }));
  ring(e, A.metal, .2, st(60) + .02, 'falcon1-merlin1c-throat-flange', .018);
  ring(e, A.metal, .255, head - .07, 'falcon1-merlin1c-injector-flange', .02);
  // Gimbal block from the injector up to the gimbal axis (station 100), and the cross on it.
  e.add(mesh(new THREE.CylinderGeometry(.1, .13, GIMBAL - head, 20), A.metal,
    { name: 'falcon1-merlin1c-gimbal-block', position: [0, (GIMBAL + head) / 2, 0] }));
  e.add(mesh(new THREE.CylinderGeometry(.22, .22, .06, 24), A.metal,
    { name: 'falcon1-merlin1c-thrust-plate', position: [0, GIMBAL, 0] }));
  // The open conical thrust frame of Figure 2-5: struts from the gimbal out to the stage's aft
  // ring (station 133), which is also where the vehicle sits on its launch mount.
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    e.add(strut([Math.sin(a) * .16, GIMBAL + .02, Math.cos(a) * .16], [Math.sin(a) * (R - .07), AFT_BODY + .02, Math.cos(a) * (R - .07)],
      .028, A.metal, 'falcon1-merlin1c-thrust-leg'));
  }
  ring(e, A.metal, R - .07, AFT_BODY + .02, 'falcon1-merlin1c-thrust-ring', .035);
  // Turbopump with its horizontal axis beside the chamber, gas generator opposite, and the
  // turbine exhaust duct down the side of the bell.
  e.add(mesh(new THREE.CylinderGeometry(.16, .16, .42, 24), A.metal,
    { name: 'falcon1-merlin1c-turbopump', position: [.38, 1.18, .04], rotation: [0, 0, Math.PI / 2] }));
  e.add(mesh(new THREE.SphereGeometry(.13, 16, 12), A.darkMetal,
    { name: 'falcon1-merlin1c-fuel-pump', position: [.62, 1.18, .04], scale: [.7, 1, 1] }));
  e.add(mesh(new THREE.CylinderGeometry(.12, .15, .30, 18), A.darkMetal,
    { name: 'falcon1-merlin1c-gas-generator', position: [-.30, 1.24, -.05], rotation: [0, 0, -.28] }));
  const feeds = [
    [[-.5, AFT_BODY - .02, .12], [-.46, 2.1, .1], [-.3, 1.5, .06], [-.14, 1.36, .02]],
    [[.5, AFT_BODY - .02, -.12], [.5, 2.1, -.1], [.52, 1.55, -.02], [.48, 1.3, .03]],
    [[.02, AFT_BODY - .02, .5], [.1, 2.0, .4], [.26, 1.5, .2], [.36, 1.32, .08]],
  ];
  feeds.forEach((points, i) => {
    const line = mesh(tube(points, i === 2 ? .035 : .052, { tubular: 30, radial: 10 }),
      i === 1 ? A.pipeDark : A.metal, { name: 'falcon1-merlin1c-feed-line' });
    line.userData.lodFeature = i === 2 ? .07 : .1; e.add(line);
  });
  const exhaust = mesh(tube([[-.3, 1.2, -.04], [-.44, 1.0, -.02], [-.52, .72, 0], [-.52, .45, 0]],
    .055, { tubular: 28, radial: 10 }), A.pipeDark, { name: 'falcon1-merlin1c-turbine-exhaust' });
  exhaust.userData.lodFeature = .11; e.add(exhaust);
  e.add(mesh(new THREE.CylinderGeometry(.09, .058, .22, 18, 1, true), A.pipeDark,
    { name: 'falcon1-merlin1c-exhaust-nozzle', position: [-.52, .35, 0] }));
  root.add(e);
}

function kestrel(root, A, y) {
  const e = new THREE.Group(); e.name = 'falcon1-kestrel2'; e.position.y = y; e.userData.engineCount = 1;
  e.userData.reconstruction = 'Envelope from the guide\'s Figure 2-5 (exit Ø≈44 in at station 556.5, throat at 610, chamber to ≈632); pressure-fed cycle documented, fittings reconstructed.';
  const thr = st(610) - st(556.5), top = st(632) - st(556.5);
  const bell = [{ r: .56, y: 0 }, { r: .55, y: .15 }, { r: .48, y: .42 }, { r: .37, y: .75 },
    { r: .24, y: 1.05 }, { r: .145, y: thr - .1 }, { r: .12, y: thr }, { r: .13, y: thr + .07 }];
  e.add(nozzle(bell, A.kestrelBell, A.bellInner, 'falcon1-kestrel2-bell'));
  e.add(mesh(new THREE.CylinderGeometry(.15, .13, top - thr - .07, 24), A.chamber,
    { name: 'falcon1-kestrel2-chamber', position: [0, (top + thr + .07) / 2, 0] }));
  ring(e, A.metal, .145, thr + .02, 'falcon1-kestrel2-throat-flange', .014);
  for (const s of [-1, 1]) e.add(mesh(tube([[s * .42, top + .2, 0], [s * .32, top + .05, .02],
    [s * .2, top - .15, .03], [s * .13, top - .25, .02]], .038, { tubular: 24, radial: 9 }),
  A.metal, { name: 'falcon1-kestrel2-pressure-feed' }));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    e.add(strut([Math.sin(a) * .15, top - .2, Math.cos(a) * .15], [Math.sin(a) * .6, top + .15, Math.cos(a) * .6],
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
// Biconic: cylinder to 817.20, a shallow cone to 847.32 (Ø49.4 in there, read off the
// drawing), then the steep cone to a small rounded tip at 891.83.
const fairingProfile = () => [
  { r: FR, y: FAIRING_BASE, sharp: true }, { r: FR, y: st(817.2), sharp: true },
  { r: 49.4 * IN / 2, y: st(847.32), sharp: true }, { r: 15.0 * IN / 2, y: st(882.5) },
  { r: 7.0 * IN / 2, y: st(889.6) }, { r: 0, y: H },
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

  // The stage ends at a short skirt with a rounded lip round the tank's aft dome (Figure 2-5,
  // stations 133–154). There is no boat-tail: the engine and its thrust frame hang below it.
  root.add(mesh(lathe([{ r: R - .09, y: AFT_BODY, sharp: true }, { r: R - .035, y: AFT_BODY + .07 },
    { r: R, y: AFT_BODY + .22 }, { r: R, y: S1_TOP, sharp: true }],
  { segments: 128, uvMode: 'normalized' }), A.stage1, { name: 'falcon1-stage1' }));
  const dome = own(M.alumDark, 'aft-dome'); dome.side = THREE.DoubleSide;
  root.add(mesh(lathe([{ r: R - .09, y: AFT_BODY }, { r: .62, y: AFT_BODY + .2 }, { r: .36, y: AFT_BODY + .36 },
    { r: .001, y: AFT_BODY + .42 }], { segments: 64 }), dome, { name: 'falcon1-aft-dome' }));
  // Frame lines on the first-stage tank where the drawing shows them (stations 314 and the
  // run 379–472 at 13.3 in pitch).
  for (const station of [314.3, 379.4, 392.7, 406.0, 419.1, 432.5, 445.6, 458.9, 472.3]) ring(root, A.metal, R + .002, st(station), 'falcon1-tank-frame', .005);
  root.add(mesh(lathe([{ r: R, y: S1_TOP }, { r: R, y: S2_BASE }],
    { segments: 112, uvMode: 'normalized' }), A.interstage, { name: 'falcon1-interstage' }));
  root.add(mesh(lathe([{ r: R, y: S2_BASE, sharp: true }, { r: R, y: FAIRING_BASE - .30, sharp: true },
    { r: FR, y: FAIRING_BASE, sharp: true }], { segments: 112 }), A.upper, { name: 'falcon1-stage2' }));
  const fairing = fairingProfile();
  root.add(mesh(cleanPole(lathe(fairing, { segments: 128 })), A.fairing, { name: 'falcon1-fairing' }));
  merlin1C(root, A); kestrel(root, A, st(556.5));

  [AFT_BODY, S1_TOP, S1_TOP + .10, S2_BASE, FAIRING_BASE - .30, FAIRING_BASE].forEach(y =>
    ring(root, A.metal, y >= FAIRING_BASE ? FR : R + .002, y, 'falcon1-structural-joint', .010));
  [[st(817.2), FR], [st(847.32), 49.4 * IN / 2]].forEach(([y, r]) =>
    ring(root, A.metal, r + .004, y, 'falcon1-fairing-frame', .008));

  const raceway = mesh(new THREE.CapsuleGeometry(.055, S1_TOP - TANK_BARREL - .3, 6, 12), A.upper,
    { name: 'falcon1-raceway', position: [0, (S1_TOP + TANK_BARREL) / 2, R + .035] });
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
  for (const y of [S1_TOP + .10, S2_BASE, S2_BASE + .9]) {
    const frame = mesh(new THREE.TorusGeometry(R - .045, .018, 6, 48, Math.PI), A.metal,
      { name: 'falcon1-cutaway-frame', position: [0, y, 0], rotation: [Math.PI / 2, 0, Math.PI * .75] });
    frame.userData.lodFeature = .036; interior.add(frame);
  }
  // Upper-stage tank from station 653 to 739, common bulkhead near 684 (Figure 2-5).
  tank(interior, A.tank, R - .075, st(653), st(684) - .02, 'falcon1-upper-rp1-tank');
  tank(interior, A.tank, R - .075, st(684) + .02, st(739), 'falcon1-upper-lox-tank');
  ring(interior, A.metal, R - .068, st(684), 'falcon1-upper-common-bulkhead', .018);
  interior.add(mesh(new THREE.CircleGeometry(R - .09, 40), A.tank,
    { name: 'falcon1-upper-bulkhead-web', position: [0, st(684), 0], rotation: [Math.PI / 2, 0, 0] }));
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
  // Frames, straps and a manifold so the tanks are built into the retained
  // half. The cut face stays open; the hardware crosses from skin to tank.
  {
    const installed = [];
    for (let k = 0; k < 5; k++) {
      const y = S2_BASE + 0.28 + k * ((FAIRING_BASE - S2_BASE - 0.7) / 4);
      installed.push({
        geometry: new THREE.TorusGeometry(R - 0.05, 0.016, 5, 28, Math.PI),
        matrix: mat4([0, y, 0], [Math.PI / 2, 0, Math.PI * 0.75]),
      });
    }
    const up = new THREE.Vector3(0, 1, 0);
    for (const y of [S2_BASE + 0.55, S2_BASE + 2.15]) {
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 0.9 + (i / 4) * Math.PI * 0.7;
        const tankR = R - 0.16;
        const skinR = R - 0.05;
        const radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const q = new THREE.Quaternion().setFromUnitVectors(up, radial);
        installed.push({
          geometry: new THREE.CylinderGeometry(0.012, 0.012, skinR - tankR, 6),
          matrix: new THREE.Matrix4().compose(
            new THREE.Vector3(Math.sin(a) * (tankR + skinR) / 2, y, Math.cos(a) * (tankR + skinR) / 2),
            q, new THREE.Vector3(1, 1, 1),
          ),
        });
      }
    }
    // Valve on the common bulkhead and a cable tray down the retained wall.
    installed.push({
      geometry: new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12),
      matrix: mat4([0.12, st(684) + 0.08, 0.08]),
    });
    installed.push({
      geometry: new THREE.BoxGeometry(0.035, FAIRING_BASE - S2_BASE - 1.1, 0.028),
      matrix: mat4([0, (S2_BASE + FAIRING_BASE) / 2 - 0.15, -(R - 0.07)]),
    });
    interior.add(mesh(mergeAll(installed), A.darkMetal, { name: 'falcon1-cutaway-install' }));
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    interior.add(strut([Math.sin(a) * .18, st(632) + .1, Math.cos(a) * .18],
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
    { label: 'Stage separation · bolts and pneumatic pushers', position: [0, S2_BASE, R + .15] },
    { label: 'Kestrel 2 · pressure-fed and restartable (inside the interstage)', position: [0, st(590), R + .15] },
    { label: 'Aluminium-lithium upper stage', position: [0, st(700), R + .15] },
    { label: 'Biconic fairing · Ø1.52 m (60 in) × 3.44 m', position: [0, st(800), FR + .15] },
    { label: 'Open thrust frame · gimbal at station 100', position: [.5, (GIMBAL + AFT_BODY) / 2, .5] },
  ];
  return root;
}

/**
 * Ground equipment Falcon 1 stood in on Omelek, as the flight-4/5 pad photographs show it: an
 * erector strongback behind the vehicle whose cradle arms wrap the stage, and a separate lattice
 * umbilical tower carrying the upper-stage umbilical down to the vehicle in a slack loop.
 * Everything here is reconstructed from those photographs: section sizes, stations and the
 * tower height are approximate; nothing about them is published. Model frame (nozzle exit at
 * y = 0); `deckY` is the launch-mount deck the equipment stands on.
 */
export function buildFalcon1GroundEquipment(M, { deckY = -0.3 } = {}) {
  const g = new THREE.Group(); g.name = 'falcon1-ground-equipment';
  g.userData.reconstruction = 'Erector and umbilical tower reconstructed from Omelek photographs; dimensions approximate.';
  const paint = new THREE.MeshStandardMaterial({ name: 'falcon1-gse-white', color: 0xe4e3de, roughness: 0.62, metalness: 0.08 });
  const beam = (a, b, w, d = w) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A);
    return { geometry: new THREE.BoxGeometry(w, dir.length(), d), matrix: new THREE.Matrix4().compose(
      A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
      new THREE.Vector3(1, 1, 1)) };
  };
  const parts = [], dark = [];

  // Erector strongback: a 1.0 × 0.8 m box truss behind the vehicle, hinged at the deck.
  const z0 = -(R + 0.7), z1 = -(R + 1.5), top = 18.2;
  for (const x of [-0.5, 0.5]) for (const z of [z0, z1]) parts.push(beam([x, deckY + 0.5, z], [x, top, z], 0.12));
  for (let y = deckY + 0.5, i = 0; y < top; y += 1.0, i++) {
    const y2 = Math.min(top, y + 1.0);
    for (const z of [z0, z1]) {
      parts.push(beam([-0.5, y, z], [0.5, y, z], 0.07));
      parts.push(beam([i % 2 ? -0.5 : 0.5, y, z], [i % 2 ? 0.5 : -0.5, y2, z], 0.05));
    }
    for (const x of [-0.5, 0.5]) {
      parts.push(beam([x, y, z0], [x, y, z1], 0.07));
      parts.push(beam([x, y, i % 2 ? z0 : z1], [x, y2, i % 2 ? z1 : z0], 0.05));
    }
  }
  parts.push(beam([-0.5, top, z0], [0.5, top, z0], 0.12), beam([-0.5, top, z1], [0.5, top, z1], 0.12));
  // Hinge: two lugs and a pin on a base plate at the foot of the strongback.
  dark.push({ geometry: new THREE.BoxGeometry(1.5, 0.12, 1.3), matrix: mat4([0, deckY + 0.06, (z0 + z1) / 2]) });
  for (const x of [-0.62, 0.62]) dark.push({ geometry: new THREE.BoxGeometry(0.1, 0.5, 0.5), matrix: mat4([x, deckY + 0.3, (z0 + z1) / 2]) });
  dark.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 1.36, 12), matrix: mat4([0, deckY + 0.38, (z0 + z1) / 2], [0, 0, Math.PI / 2]) });

  // Cradle arms: a half ring round the back of the stage, braced to the strongback, with pads.
  for (const y of [6.6, 13.2]) {
    const ring = new THREE.TorusGeometry(R + 0.07, 0.05, 6, 36, Math.PI);
    ring.rotateX(-Math.PI / 2);
    parts.push({ geometry: ring, matrix: mat4([0, y, 0]) });
    for (const s of [-1, 1]) parts.push(beam([s * (R + 0.07), y, 0], [s * 0.5, y, z0], 0.1));
    parts.push(beam([0, y, -(R + 0.07)], [0, y, z0], 0.1));
    for (const a of [-0.9, 0, 0.9]) dark.push({ geometry: new THREE.BoxGeometry(0.18, 0.2, 0.04),
      matrix: mat4([Math.sin(Math.PI + a) * (R + 0.025), y, Math.cos(Math.PI + a) * (R + 0.025)], [0, a, 0]) });
  }

  // Umbilical tower: a triangular lattice mast at the back corner of the deck, with a boom.
  const tx = -2.1, tz = -2.1, tH = 20.0, side = 0.9;
  const corners = [0, 1, 2].map(i => {
    const a = i / 3 * Math.PI * 2 + Math.PI / 4;
    return [tx + Math.sin(a) * side / Math.sqrt(3), tz + Math.cos(a) * side / Math.sqrt(3)];
  });
  for (const [x, z] of corners) parts.push(beam([x, deckY, z], [x, tH, z], 0.09));
  for (let y = deckY + 0.9, i = 0; y < tH; y += 0.9, i++) {
    for (let k = 0; k < 3; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 3];
      parts.push(beam([ax, y, az], [bx, y, bz], 0.045));
      parts.push(beam(i % 2 ? [ax, y, az] : [bx, y, bz], i % 2 ? [bx, Math.min(tH, y + 0.9), bz] : [ax, Math.min(tH, y + 0.9), az], 0.035));
    }
  }
  // Boom reaching toward the vehicle, and its stay.
  const toward = new THREE.Vector2(-tx, -tz).normalize();
  const boomEnd = [tx + toward.x * 1.5, tH - 0.3, tz + toward.y * 1.5];
  parts.push(beam([tx, tH - 0.3, tz], boomEnd, 0.12));
  parts.push(beam([tx, tH - 1.8, tz], boomEnd, 0.06));

  // Umbilicals: the upper-stage line hangs from the boom in a slack loop into its plate on the
  // stage; a lighter line from the tower's mid-height runs to the first stage.
  const az = Math.atan2(tx, tz), sx = Math.sin(az), sz = Math.cos(az);
  const plateA = [sx * (R + 0.05), 17.0, sz * (R + 0.05)], plateB = [sx * (R + 0.05), 11.4, sz * (R + 0.05)];
  dark.push({ geometry: new THREE.BoxGeometry(0.34, 0.42, 0.08), matrix: mat4(plateA, [0, az, 0]) });
  dark.push({ geometry: new THREE.BoxGeometry(0.26, 0.3, 0.07), matrix: mat4(plateB, [0, az, 0]) });
  const hoses = [
    mesh(tube([boomEnd, [boomEnd[0] + toward.x * 0.1, tH - 2.2, boomEnd[2] + toward.y * 0.1],
      [(boomEnd[0] + plateA[0]) / 2, 15.9, (boomEnd[2] + plateA[2]) / 2],
      [plateA[0] + sx * 0.3, 16.7, plateA[2] + sz * 0.3], plateA], 0.075, { tubular: 48, radial: 10 }), M.blackMatte, { name: 'falcon1-umbilical-upper', castShadow: false }),
    mesh(tube([[tx + toward.x * 0.4, 12.5, tz + toward.y * 0.4],
      [(tx + plateB[0]) / 2, 10.6, (tz + plateB[2]) / 2], [plateB[0] + sx * 0.25, 11.2, plateB[2] + sz * 0.25], plateB], 0.045,
    { tubular: 36, radial: 8 }), M.blackMatte, { name: 'falcon1-umbilical-lower', castShadow: false }),
  ];
  g.add(mesh(mergeAll(parts), paint, { name: 'falcon1-erector-and-tower' }));
  g.add(mesh(boxUV(mergeAll(dark)), M.darkMetal ?? M.blackMatte, { name: 'falcon1-gse-fittings' }));
  for (const h of hoses) g.add(h);
  return g;
}
