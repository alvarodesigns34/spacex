/**
 * Kawasaki Ninja H2R (ZX1000Y), at 1:1, as Kawasaki photographed it: Mirror Coated Spark Black,
 * the green trellis frame, carbon cowl, wings and ducts.
 *
 * PROVENANCE
 *  - Every published figure is in data/h2r.js with its source (Kawasaki's specifications, MY2027).
 *  - The shapes are fitted to Kawasaki's studio photographs (left side, right side, right front
 *    three-quarter; reference only, not in the repository) through their calibrated cameras: both
 *    studio cameras were solved together (a bundle adjustment, ≈2 px rms) on the published
 *    wheelbase, tyre diameters and height, so that every feature seen in both — the side panel's
 *    bolts and tip, the frame's nodes, the wings' corners — has its width as well as its side-view
 *    position. Outlines are traced on the side photograph (≈ ±1 cm); widths ≈ ±1.5 cm.
 *  - Reconstructed (≈): the sections between the fitted lines, the engine's covers and internals
 *    as seen, the wheels' spokes and the callipers, the controls, the dash's face.
 *  - Kawasaki's own markings, by the visitor's request (the one exception to the centre's
 *    no-logos rule): "Kawasaki" on the tank, "Ninja" and "H2R" on the side panels, "brembo" on the
 *    callipers, drawn as type.
 *
 * Frame: x forward from the middle of the wheelbase, y up from the ground, z to the right. Groups
 * the ride animates: h2r-steer (about the steering axis), h2r-wheel-f-spin / h2r-wheel-r-spin,
 * h2r-swingarm (about the pivot); the dash's face redraws through its userData.draw.
 */
import * as THREE from 'three';
import { buildTank, buildSeatTail, buildFairing3 as buildFairing, buildDecals, PXY } from './h2rBody.js';
import { T, AXLE_F, AXLE_R, PIVOT, STEER_AXIS, STEER_GROUND, RR, RF, D2R, TAU, segMatrix, slab, loft, mergeAll, mesh, partMaterials, buildWheel, stylema, canvasTexture } from './h2rParts.js';

export { STEER_AXIS, AXLE_F, AXLE_R, PIVOT } from './h2rParts.js';

/** The top triple clamp's place along the fork from the front axle, m (its top face ≈0.98 m up). */
const TOP_CLAMP = 0.76;

export function buildH2r(M) {
  partMaterials(M);
  const root = new THREE.Group();
  root.name = 'h2r';
  // Mirror Coated Spark Black: a silver mirror layer under a smoked clear: dark where it faces the
  // shadows, bright silver where it catches the light (≈).
  M.h2rChrome ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-mirror-coat', color: 0xc3c8cd, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 });
  M.h2rVoid ??= new THREE.MeshStandardMaterial({ name: 'h2r-void', color: 0x0a0a0b, metalness: 0.2, roughness: 0.7 });
  M.h2rCarbon ??= carbonMaterial();
  M.h2rTail ??= new THREE.MeshStandardMaterial({ name: 'h2r-tail-lamp', color: 0x8a0d10, emissive: 0xc0141a, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.2 });
  M.h2rSeat ??= new THREE.MeshStandardMaterial({ name: 'h2r-seat', color: 0x151617, metalness: 0, roughness: 0.85 });
  const fairing = buildFairing(M), tank = buildTank(M);
  root.add(buildSteer(M), buildSwingarm(M), buildFrame(M), buildEngine(M), buildExhaust(M), tank, buildSeatTail(M), fairing, buildDetails(M));
  root.updateMatrixWorld(true);
  root.add(buildDecals(fairing.userData.panel, tank.getObjectByName('h2r-tank-top'), root.getObjectByName('h2r-tail')));
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

function bremboDecal() {
  const t = canvasTexture(512, 150, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#d0141c'; g.font = 'bold 128px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('brembo', w / 2, h / 2 + 6);
  });
  return t && new THREE.MeshStandardMaterial({ name: 'h2r-decal-brembo', map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5 });
}

/** The steering: inverted fork on the published rake, the triple clamps, the front wheel and its brakes, the fender. */
function buildSteer(M) {
  const g = new THREE.Group();
  g.name = 'h2r-steer';
  const pivot = STEER_GROUND.clone().addScaledVector(STEER_AXIS, AXLE_F.y / STEER_AXIS.y);
  g.position.copy(pivot);
  const inner = new THREE.Group(); inner.position.copy(pivot).negate(); g.add(inner);
  const up = STEER_AXIS, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const along = (base, d) => base.clone().addScaledVector(up, d);
  const decal = bremboDecal();
  for (const side of [-1, 1]) {
    const base = AXLE_F.clone().setZ(side * 0.104);
    // Inner (lower) tube, 43 mm, from the axle bracket up into the outer tube.
    const tubeIn = new THREE.CylinderGeometry(0.0215, 0.0215, 0.36, 24); tubeIn.applyQuaternion(q);
    const pIn = along(base, 0.2); tubeIn.translate(pIn.x, pIn.y, pIn.z);
    inner.add(mesh(tubeIn, M.h2rForkInner, { name: 'h2r-fork-inner' }));
    // Outer (upper) tube, ≈56 mm, through both clamps and ≈3 cm proud of the top one (the
    // photographs without the fairing), its lower end chamfered.
    const prof = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.0255, 0), new THREE.Vector2(0.028, 0.012), new THREE.Vector2(0.028, 0.52), new THREE.Vector2(0.0255, 0.535), new THREE.Vector2(0, 0.535)];
    const tubeOut = new THREE.LatheGeometry(prof, 28); tubeOut.applyQuaternion(q);
    const pOut = along(base, 0.255); tubeOut.translate(pOut.x, pOut.y, pOut.z);
    // (Its outer tubes are bright, as in every photograph; the axle brackets stay black.)
    inner.add(mesh(tubeOut, M.h2rMachined, { name: 'h2r-fork-outer' }));
    const cap = new THREE.CylinderGeometry(0.019, 0.022, 0.016, 20); cap.applyQuaternion(q);
    const pCap = along(base, 0.795); cap.translate(pCap.x, pCap.y, pCap.z);
    M.h2rGreenAnod ??= new THREE.MeshStandardMaterial({ name: 'h2r-green-anodised', color: 0x1f9a2c, metalness: 0.8, roughness: 0.3 });
    inner.add(mesh(cap, M.h2rGreenAnod, { name: 'h2r-fork-cap' }));
    // The axle bracket, black, with the radial calliper mounts behind the leg.
    // (Its outline: round the axle, up along the leg, and back to the calliper's two radial bolts.)
    const br = slab([[-0.026, -0.026], [0.024, -0.024], [0.03, 0.02], [0.012, 0.09], [-0.022, 0.095], [-0.052, 0.05], [-0.098, 0.072], [-0.112, 0.05], [-0.07, -0.004], [-0.04, -0.03]], 0.026, 0.003, 2);
    br.translate(0, 0, -0.013);
    const brm = mesh(br, M.h2rFork, { name: 'h2r-axle-bracket' });
    brm.position.copy(base); brm.rotation.z = -(25.1 * D2R) * 0;
    inner.add(brm);
    // The Stylema on the disc, radially mounted behind and above the axle.
    const cal = stylema(M, side > 0 ? decal : decal);
    const a = 148 * D2R;          // ≈ its centre's angle from the forward horizontal (the side photograph)
    cal.position.set(AXLE_F.x + Math.cos(a) * 0.147, AXLE_F.y + Math.sin(a) * 0.147, side * 0.069);
    cal.rotation.z = a - Math.PI / 2;
    if (side < 0) cal.scale.z = -1;
    inner.add(cal);
  }
  // Triple clamps, machined aluminium (the photographs without the fairing), joining the legs at the steering head. The
  // top one sits on the head tube, above where the frame's upper rails meet it, the clip-ons
  // ≈4 cm under it (the photographs without the fairing).
  for (const [d, mat, h] of [[0.47, M.h2rAlu, 0.04], [TOP_CLAMP, M.h2rAlu, 0.024]]) {
    const c = slab([[-0.04, -0.13], [0.03, -0.13], [0.05, -0.105], [0.05, 0.105], [0.03, 0.13], [-0.04, 0.13], [-0.075, 0.05], [-0.075, -0.05]], h, 0.003);
    c.rotateX(-Math.PI / 2); c.translate(0, -h / 2, 0);
    const cm = mesh(c, mat, { name: 'h2r-triple-clamp' });
    cm.quaternion.copy(q);
    cm.position.copy(along(AXLE_F.clone(), d)).add(new THREE.Vector3(-0.028 * Math.cos(25.1 * D2R), -0.028 * Math.sin(25.1 * D2R), 0));
    inner.add(cm);
  }
  // The steering stem's nut on the top clamp, on the steering axis.
  { const top = STEER_GROUND.clone().addScaledVector(STEER_AXIS, (AXLE_F.y + TOP_CLAMP * STEER_AXIS.y - 0.028 * Math.sin(25.1 * D2R) + 0.012) / STEER_AXIS.y);
    const nut = new THREE.CylinderGeometry(0.019, 0.019, 0.014, 6); nut.applyQuaternion(q); nut.translate(top.x, top.y + 0.006, top.z);
    inner.add(mesh(nut, M.h2rSatin, { name: 'h2r-stem-nut' })); }
  // Clip-on bars below the top clamp, angled down and back to the grips (the side photograph: the
  // grip from ≈0.90 m up at the clamp to ≈0.82 m at the bar end); the levers, the master cylinders'
  // reservoirs (smoked amber), the switchgear.
  M.h2rRubber ??= new THREE.MeshStandardMaterial({ name: 'h2r-grip', color: 0x1a1b1c, metalness: 0, roughness: 0.9 });
  M.h2rAmber ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-reservoir', color: 0x6b4a1c, metalness: 0.1, roughness: 0.2, transmission: 0, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const root = new THREE.Vector3(...PXY(425, 292), s * 0.104), end = new THREE.Vector3(...PXY(472, 352), s * 0.355);
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 16).applyMatrix4(segMatrix(root, end, 0.011)), M.h2rSatin, { name: 'h2r-clip-on' }));
    const clamp = new THREE.CylinderGeometry(0.032, 0.032, 0.05, 20); clamp.applyMatrix4(segMatrix(root.clone().addScaledVector(STEER_AXIS, -0.025), root.clone().addScaledVector(STEER_AXIS, 0.025), 1));
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 20).applyMatrix4(segMatrix(root.clone().addScaledVector(STEER_AXIS, -0.025), root.clone().addScaledVector(STEER_AXIS, 0.025), 0.026)), M.h2rSatin, { name: 'h2r-clip-on-clamp' }));
    const gA = root.clone().lerp(end, 0.52), gB = end.clone();
    const grip = lathe([[0.0165, 0], [0.0175, 0.01], [0.0175, 0.12], [0.019, 0.125], [0.0, 0.13]], 20);
    grip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), gB.clone().sub(gA).normalize())); grip.translate(gA.x, gA.y, gA.z);
    inner.add(mesh(grip, M.h2rRubber, { name: 'h2r-grip' }));
    const endW = new THREE.CylinderGeometry(0.019, 0.019, 0.02, 16).applyMatrix4(segMatrix(gB, gB.clone().add(gB.clone().sub(gA).normalize().multiplyScalar(0.022)), 1));
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 16).applyMatrix4(segMatrix(gB, gB.clone().add(gB.clone().sub(gA).normalize().multiplyScalar(0.022)), 0.019)), M.h2rAlu, { name: 'h2r-bar-end' }));
    void clamp; void endW;
    // Switchgear housing at the grip's inner end, the lever ahead of the grip.
    const sw = new THREE.BoxGeometry(0.05, 0.045, 0.04); sw.translate(...gA.toArray());
    inner.add(mesh(sw, M.h2rSatin, { name: 'h2r-switchgear' }));
    // The lever: ahead of the grip and parallel to it, from its pivot by the switchgear.
    const dir = gB.clone().sub(gA).normalize(), fwd = new THREE.Vector3(1, -0.15, 0).normalize();
    const L0 = gA.clone().addScaledVector(fwd, 0.045), L1 = L0.clone().addScaledVector(dir, 0.16).addScaledVector(fwd, 0.012);
    inner.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 10).applyMatrix4(segMatrix(L0, L1, 0.0055)), M.h2rAlu, { name: 'h2r-lever' }));
    const piv = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12).applyMatrix4(new THREE.Matrix4().makeTranslation(L0.x, L0.y, L0.z));
    inner.add(mesh(piv, M.h2rSatin, { name: 'h2r-lever-pivot' }));
    const res = lathe([[0, 0], [0.019, 0], [0.02, 0.03], [0.022, 0.034], [0.022, 0.04], [0, 0.04]], 20);
    res.translate(...PXY(366, 285), s * 0.13);
    inner.add(mesh(res, M.h2rAmber, { name: 'h2r-reservoir' }));
  }
  // The front fender, black: a shell over the tyre's front and top with a beak (the side photograph).
  inner.add(buildFender(M));
  inner.add(buildWheel(M, 'f'));
  return g;
}

function buildFender(M) {
  const R = RF + 0.014, secs = [];
  // Along the tyre from ≈40° ahead-up to ≈118° (behind the fork), each section a shallow arch over the tread.
  for (let i = 0; i <= 12; i++) {
    const a = (30 + (125 - 30) * i / 12) * D2R;
    const hw = 0.068 + 0.012 * Math.sin(Math.PI * i / 12);
    const sec = [];
    for (let k = 0; k <= 8; k++) {
      const u = -1 + 2 * k / 8, z = u * hw, lift = 0.016 * (1 - u * u);
      const r = R + lift;
      sec.push([AXLE_F.x + Math.cos(a) * r, AXLE_F.y + Math.sin(a) * r, z]);
    }
    secs.push(sec);
  }
  M.h2rBlack2 ??= M.h2rBlack.clone(); M.h2rBlack2.side = THREE.DoubleSide; M.h2rBlack2.name = 'h2r-black-2s';
  return mesh(loft(secs, { steps: 3 }), M.h2rBlack2, { name: 'h2r-fender' });
}

/** The single-sided swingarm, on the left: tall at the pivot, sweeping down to its ring round the hub. */
function buildSwingarm(M) {
  const g = new THREE.Group();
  g.name = 'h2r-swingarm';
  g.position.copy(PIVOT);
  const inner = new THREE.Group(); inner.position.copy(PIVOT).negate(); g.add(inner);
  // The arm, a black casting (traced on the side photograph): deep behind the pivot, its top falling
  // to the hub; on the left only, the wheel on its end.
  const st = [[722, 560, 650, -0.10, -0.165], [790, 548, 655, -0.11, -0.19], [870, 565, 660, -0.12, -0.2], [950, 595, 668, -0.125, -0.2], [1005, 612, 676, -0.13, -0.195]];
  const secs = st.map(([u, v0, v1, zi, zo]) => {
    const A = PXY(u, v0), B = PXY(u, v1);
    return [[A[0], A[1], zi], [A[0], A[1], zo + 0.02], [A[0], A[1] - 0.02, zo], [B[0], B[1] + 0.02, zo], [B[0], B[1], zo + 0.02], [B[0], B[1], zi]];
  });
  M.h2rSatin2 ??= M.h2rSatin.clone(); M.h2rSatin2.side = THREE.DoubleSide; M.h2rSatin2.name = 'h2r-satin-black-2s';
  inner.add(mesh(loft(secs, { steps: 4, creaseDeg: 40 }), M.h2rSatin2, { name: 'h2r-swingarm-beam' }));
  // The chain guard over the top run, and the hugger over the tyre.
  const cg = slab([PXY(895, 546), PXY(1090, 548), PXY(1080, 556), PXY(905, 558)], 0.07, 0.002); cg.translate(0, 0, -0.145);
  inner.add(mesh(cg, M.h2rSatin, { name: 'h2r-chain-guard' }));
  // The hugger: a black blade over the tyre's top front, off the arm (the side photograph).
  const hugS = [];
  for (let i = 0; i <= 10; i++) { const a = (62 + 50 * i / 10) * D2R, r = RR + 0.014; hugS.push([[AXLE_R.x + Math.cos(a) * r, AXLE_R.y + Math.sin(a) * r, -0.1], [AXLE_R.x + Math.cos(a) * (r + 0.006), AXLE_R.y + Math.sin(a) * (r + 0.006), 0.0], [AXLE_R.x + Math.cos(a) * r, AXLE_R.y + Math.sin(a) * r, 0.1]]); }
  inner.add(mesh(loft(hugS, { steps: 2 }), M.h2rSatin2, { name: 'h2r-hugger' }));
  // The chain, from the gearbox sprocket to the wheel's.
  const front = T(-790, 362, -0.105), back = AXLE_R.clone().setZ(-0.105);
  const r0 = 0.046, r1 = 0.106, pts = [];
  const dir = new THREE.Vector3().subVectors(back, front).normalize(), nrm = new THREE.Vector3(-dir.y, dir.x, 0);
  const arc = (c, r, a0, a1) => { for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; pts.push(c.clone().addScaledVector(dir, Math.cos(a) * r).addScaledVector(nrm, Math.sin(a) * r)); } };
  arc(front, r0, Math.PI / 2, Math.PI * 1.5); arc(back, r1, -Math.PI / 2, Math.PI / 2);
  inner.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.0055, 6, true), M.h2rChain, { name: 'h2r-chain' }));
  inner.add(buildWheel(M, 'r'));
  // The rear calliper under the swingarm, on the disc.
  const rc = stylema(M, null); rc.scale.set(0.75, 0.75, 0.75); rc.position.set(AXLE_R.x + 0.02, AXLE_R.y - 0.105, 0.075); rc.rotation.z = Math.PI;
  inner.add(rc);
  return g;
}

// ---- The trellis --------------------------------------------------------------------------------
const LS = (u, v) => [(237.5 - u) * 1.8, 295 + (647.5 - v) * 1.8];   // side-photograph pixel → traced mm
/**
 * The green trellis (Kawasaki's photograph of it alone; nodes on the side photograph, their
 * widths triangulated with the three-quarter one): the head tube on the steering axis; on each
 * side an upper rail sweeping back from the head and down into the rear leg, a lower rail from the
 * head's foot to the leg's top, a diagonal between them, the rear leg's chain of bosses down to the
 * swingarm pivot, and the hangers to the front of the engine; cross tubes behind the head and
 * between the legs.
 */
function buildFrame(M) {
  M.h2rGreen ??= new THREE.MeshPhysicalMaterial({ name: 'h2r-frame-green', color: 0x229a35, metalness: 0.2, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 });
  const g = new THREE.Group(); g.name = 'h2r-frame';
  const P = (u, v, z) => { const [x, y] = LS(u, v); return T(x, y, z); };
  const headTop = STEER_GROUND.clone().addScaledVector(STEER_AXIS, 0.94 / STEER_AXIS.y), headBot = STEER_GROUND.clone().addScaledVector(STEER_AXIS, 0.80 / STEER_AXIS.y);
  const tubes = [], bosses = [];
  const R = 0.0135;
  for (const s of [-1, 1]) {
    const A = P(727, 436, s * 0.137), Mid = P(729, 511, s * 0.184), L = P(731, 574, s * 0.193), Pv = P(716, 628, s * 0.19);
    const B = P(580, 437, s * 0.205), J = P(685, 414, s * 0.15), U1 = P(530, 352, s * 0.13);
    const hT = headTop.clone().add(new THREE.Vector3(-0.02, -0.01, s * 0.045)), hB = headBot.clone().add(new THREE.Vector3(-0.02, 0, s * 0.05));
    // Upper rail: from the head's top, out and back, curving down to the leg's top.
    tubes.push([[hT, P(440, 330, s * 0.085), U1, P(630, 395, s * 0.135), A], R]);
    // Lower rail: from the head's foot, out round the cylinder head, to the junction on the upper rail.
    tubes.push([[hB, P(455, 398, s * 0.16), B, J], R]);
    // Diagonal and the short brace.
    tubes.push([[U1, B], R * 0.92]);
    tubes.push([[P(600, 375, s * 0.14), P(640, 425, s * 0.18)], R * 0.85]);
    // The rear leg's chain of bosses, down to the pivot plate.
    tubes.push([[A, Mid], R]); tubes.push([[Mid, L], R]); tubes.push([[L, Pv], R]);
    tubes.push([[B, Mid], R * 0.9]);
    // Hanger to the front of the engine, from the head's foot down to the cylinder head's mount.
    tubes.push([[hB, P(420, 470, s * 0.17)], R]);
    for (const n of [A, Mid, L, Pv, B, P(420, 470, s * 0.17)]) bosses.push(n);
  }
  // Cross tubes: behind the head, and between the legs' tops.
  tubes.push([[P(500, 345, -0.11), P(500, 345, 0.11)], R * 0.9]);
  tubes.push([[P(727, 436, -0.137), P(727, 436, 0.137)], R]);
  const items = [], cyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
  for (const [pts, r] of tubes) {
    if (pts.length === 2) items.push({ geometry: cyl, matrix: segMatrix(pts[0], pts[1], r) });
    else items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 48, r, 14) });
  }
  for (const b of bosses) {
    const c = new THREE.CylinderGeometry(0.021, 0.021, 0.04, 20); c.rotateX(Math.PI / 2); c.translate(b.x, b.y, b.z);
    items.push({ geometry: c });
  }
  // The head tube on the steering axis.
  // (From just over the bottom clamp to just under the top one: it no longer stands through the
  // top clamp, where the rider saw its green end as a disc.)
  items.push({ geometry: new THREE.CylinderGeometry(1, 1, 1, 24), matrix: segMatrix(headBot.clone().addScaledVector(STEER_AXIS, -0.045), headTop.clone().addScaledVector(STEER_AXIS, 0.005), 0.03) });
  g.add(mesh(mergeAll(items), M.h2rGreen, { name: 'h2r-trellis' }));
  return g;
}

// ---- The engine ------------------------------------------------------------------------------------
/** A side profile in the side photograph's pixels, extruded across the bike between z0 and z1. */
function blockPx(profile, z0, z1, bevel = 0.008) {
  const pts = profile.map(([u, v]) => PXY(u, v));
  const g = slab(pts, Math.max(0.001, z1 - z0 - 2 * bevel), bevel, 2);
  g.translate(0, 0, z0 + bevel);
  return g;
}
function lathe(points, segs = 48) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs); }
/** A round engine cover: a shallow dome with a stepped rim, its axis across the bike, facing out. */
function cover(u, v, z, r, depth, side) {
  const g = lathe([[0, depth], [r * 0.55, depth * 0.96], [r * 0.85, depth * 0.8], [r * 0.95, depth * 0.55], [r, depth * 0.45], [r * 1.04, 0.004], [r * 1.04, 0]], 56);
  g.rotateX(side * Math.PI / 2);
  const [x, y] = PXY(u, v);
  g.translate(x, y, z);
  return g;
}
/**
 * The supercharged 998 cm³ four (traced on both side photographs, LS and the right side mirrored;
 * its shape out of the bike from Kawasaki's photographs of it): the crankcase with the generator
 * and sprocket covers on the left, the clutch and pickup covers on the right, the cylinders and head
 * leaning forward, the sump, the aluminium intake chamber on top, and the supercharger behind the
 * cylinders on the left, red, fed by the ram-air duct.
 */
function buildEngine(M) {
  M.h2rEngine ??= new THREE.MeshStandardMaterial({ name: 'h2r-engine', color: 0x232427, metalness: 0.6, roughness: 0.48 });
  M.h2rCaseGrey ??= new THREE.MeshStandardMaterial({ name: 'h2r-case-grey', color: 0x55585d, metalness: 0.5, roughness: 0.6 });
  M.h2rRedAnod ??= new THREE.MeshStandardMaterial({ name: 'h2r-red-anodised', color: 0x8c1d12, metalness: 0.7, roughness: 0.35 });
  M.h2rPlenum ??= new THREE.MeshStandardMaterial({ name: 'h2r-intake-chamber', color: 0xbfc3c8, metalness: 0.9, roughness: 0.32 });
  // The cylinder block, head and sump are bare cast aluminium, light; the covers charcoal (the
  // right-side photograph and those with the fairing off).
  M.h2rCast ??= new THREE.MeshStandardMaterial({ name: 'h2r-cast-aluminium', color: 0xa9adb2, metalness: 0.75, roughness: 0.5 });
  const g = new THREE.Group(); g.name = 'h2r-engine';
  const dark = [], grey = [], bright = [], cast = [];
  // Crankcase and gearbox.
  dark.push({ geometry: blockPx([[498, 520], [497, 598], [510, 638], [540, 658], [600, 662], [690, 658], [718, 640], [726, 560], [722, 505], [650, 490], [560, 492]], -0.15, 0.15, 0.012) });
  // Cylinders and head, leaning forward, under the duct and the intake chamber.
  cast.push({ geometry: blockPx([[498, 525], [474, 440], [470, 405], [500, 390], [565, 392], [610, 430], [640, 500]], -0.18, 0.18, 0.012) });
  // The sump (cast) under the crankcase.
  cast.push({ geometry: blockPx([[583, 657], [690, 652], [684, 712], [640, 725], [600, 722], [588, 690]], -0.085, 0.085, 0.006) });
  // Covers: generator and sprocket on the left; on the right the clutch cover, a charcoal ring
  // (r ≈0.092 m) round a raised dished disc (r ≈0.063 m) centred at (−0.025, 0.484) m, and the
  // pickup cover (r ≈0.03 m) at (0.115, 0.44) m (the right-side photograph through its camera).
  dark.push({ geometry: cover(583, 578, -0.15, 0.072, 0.03, -1) });
  dark.push({ geometry: cover(673, 573, -0.15, 0.058, 0.024, -1) });
  dark.push({ geometry: cover(654.6, 538.7, 0.15, 0.092, 0.035, 1) });
  grey.push({ geometry: cover(654.6, 538.7, 0.18, 0.063, 0.018, 1) });
  grey.push({ geometry: cover(576.3, 563.3, 0.15, 0.03, 0.016, 1) });
  for (const [u, v, z, r, n] of [[583, 578, -0.154, 0.08, 10], [673, 573, -0.154, 0.065, 8], [654.6, 538.7, 0.154, 0.1, 14], [576.3, 563.3, 0.154, 0.036, 4]]) {
    const [x, y] = PXY(u, v);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + 0.2, b = new THREE.CylinderGeometry(0.0055, 0.0055, 0.012, 6); b.rotateX(Math.PI / 2);
      b.translate(x + Math.cos(a) * r, y + Math.sin(a) * r, z); bright.push({ geometry: b });
    }
  }
  // The oil filler cap on the clutch cover's top front, its red ring, at (0.076, 0.547) m.
  { const cap = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 32); cap.rotateX(Math.PI / 2); cap.translate(0.076, 0.547, 0.165); bright.push({ geometry: cap }); }
  // The round black plate in its cast housing on the head's right side, at (−0.05, 0.653) m.
  { const h = new THREE.CylinderGeometry(0.045, 0.048, 0.03, 40); h.rotateX(Math.PI / 2); h.translate(-0.05, 0.653, 0.135); cast.push({ geometry: h }); }
  g.add(mesh(mergeAll(dark), M.h2rEngine, { name: 'h2r-engine-cases' }));
  g.add(mesh(mergeAll(grey), M.h2rCaseGrey, { name: 'h2r-engine-covers' }));
  g.add(mesh(mergeAll(cast), M.h2rCast, { name: 'h2r-engine-castings' }));
  g.add(mesh(mergeAll(bright), M.h2rSatin, { name: 'h2r-engine-bolts' }));
  { const ring = new THREE.TorusGeometry(0.016, 0.003, 8, 32); ring.translate(0.076, 0.547, 0.176); g.add(mesh(ring, M.h2rRedAnod, { name: 'h2r-filler-ring' })); }
  { const p = new THREE.CylinderGeometry(0.028, 0.028, 0.004, 40); p.rotateX(Math.PI / 2); p.translate(-0.05, 0.653, 0.151); g.add(mesh(p, M.h2rSatin, { name: 'h2r-head-plate' })); }
  // The intake chamber over the head, aluminium, under the tank.
  g.add(mesh(blockPx([[470, 398], [482, 362], [560, 336], [650, 350], [665, 395], [600, 412], [520, 410]], -0.15, 0.15, 0.02), M.h2rPlenum, { name: 'h2r-intake-chamber' }));
  // The supercharger, behind the cylinders on the left: the impeller's scroll housing.
  const [sx, sy] = PXY(672, 470), scz = -0.07;
  const vol = lathe([[0.0, -0.04], [0.06, -0.04], [0.072, -0.026], [0.075, 0.0], [0.072, 0.026], [0.06, 0.04], [0.0, 0.04]], 40);
  vol.rotateX(Math.PI / 2); vol.translate(sx, sy, scz);
  g.add(mesh(vol, M.h2rRedAnod, { name: 'h2r-supercharger' }));
  g.add(buildDuct(M));
  return g;
}

/**
 * The ram-air duct, carbon: from the nose's central intake back along the left side under the
 * panel (the side photograph shows its last 0.4 m, 7 cm tall), to the supercharger's inlet.
 */
function buildDuct(M) {
  M.h2rCarbon ??= carbonMaterial();
  const P = (u, v, z) => new THREE.Vector3(...PXY(u, v), z);
  const path = new THREE.CatmullRomCurve3([P(150, 372, 0), P(220, 395, -0.08), P(330, 425, -0.17), P(430, 452, -0.19), P(540, 468, -0.18), P(640, 482, -0.15), P(672, 478, -0.12)], false, 'centripetal');
  const secs = [], N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = path.getPoint(t), tan = path.getTangent(t);
    const side = new THREE.Vector3(0, 1, 0).cross(tan).normalize(), up = tan.clone().cross(side).normalize();
    const h = 0.03 + 0.008 * Math.sin(Math.PI * t), w = 0.03 + 0.012 * t;
    const sec = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU, c = Math.cos(a), sn = Math.sin(a), e = 0.55;
      sec.push(p.clone().addScaledVector(side, Math.sign(c) * Math.abs(c) ** e * w).addScaledVector(up, Math.sign(sn) * Math.abs(sn) ** e * h).toArray());
    }
    sec.push(sec[0]);
    secs.push(sec);
  }
  return mesh(loft(secs, { steps: 2, creaseDeg: 60 }), M.h2rCarbon, { name: 'h2r-ram-air-duct' });
}
function carbonMaterial() {
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

/**
 * The exhaust (both side photographs): four titanium headers out of the head's front, down past the
 * engine's front and back under it into the collector, and the silencer rising along the right side
 * to its large round end can behind the footpeg.
 */
function buildExhaust(M) {
  // The headers' titanium has the bronze-gold heat tint of the photographs; the silencer is polished.
  M.h2rTi ??= new THREE.MeshStandardMaterial({ name: 'h2r-titanium', color: 0xb38d58, metalness: 1, roughness: 0.25 });
  const P = (u, v, z) => new THREE.Vector3(...PXY(u, v), z);
  const g = new THREE.Group(); g.name = 'h2r-exhaust';
  const items = [];
  for (let i = 0; i < 4; i++) {
    const z = -0.078 + i * 0.052, k = i - 1.5;
    const pts = [P(492, 500, z * 0.95), P(470 - k * 2, 560, z), P(463 - k * 3, 640, z * 1.05), P(478 - k * 4, 700 - k * 3, z), P(520, 716 - k * 5, z * 0.7), P(620, 712 - k * 4, z * 0.45), P(720, 702, z * 0.2), P(752, 696, z * 0.1)];
    items.push({ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 70, 0.0165, 14) });
  }
  g.add(mesh(mergeAll(items), M.h2rTi, { name: 'h2r-headers' }));
  // Collector into the silencer, out to the right and rising.
  const A = P(752, 696, 0.04), B = P(790, 676, 0.12), C = P(935, 575, 0.175);
  const col = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P(700, 703, 0), A, B]), 20, 0.034, 14);
  g.add(mesh(col, M.h2rTi, { name: 'h2r-collector' }));
  const L = B.distanceTo(C), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(B).normalize());
  const can = lathe([[0.034, 0], [0.042, L * 0.2], [0.05, L * 0.55], [0.058, L * 0.85], [0.06, L * 0.97], [0.064, L], [0.054, L + 0.003], [0.0, L + 0.003]], 36);
  can.applyQuaternion(q); can.translate(B.x, B.y, B.z);
  g.add(mesh(can, M.h2rMachined, { name: 'h2r-silencer' }));
  return g;
}

/**
 * The rest (the photographs): the instrument panel behind the screen, the radiator and the lower
 * side slats, the rearsets, the Öhlins shock's gold reservoir, the rear hugger and chain guard.
 */
function buildDetails(M) {
  M.h2rLcd ??= new THREE.MeshStandardMaterial({ name: 'h2r-lcd', color: 0x0a0d10, metalness: 0.2, roughness: 0.15, emissive: 0x0b1820, emissiveIntensity: 0.6 });
  M.h2rRadiator ??= new THREE.MeshStandardMaterial({ name: 'h2r-radiator', color: 0x141516, metalness: 0.4, roughness: 0.7, map: radiatorTexture() });
  const g = new THREE.Group(); g.name = 'h2r-details';
  const P = (u, v, z = 0) => new THREE.Vector3(...PXY(u, v), z);
  // The instrument panel behind the screen (the H2's: an analogue tachometer and an LCD), facing
  // the rider; its face is drawn live by the ride (userData.draw).
  g.add(buildDash(M));
  // The Öhlins steering damper across the front of the top clamp (the detail photograph).
  { const A = P(405, 268, -0.12), B = P(405, 268, 0.12);
    g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 20).applyMatrix4(segMatrix(A, B, 0.016)), M.h2rSatin, { name: 'h2r-steering-damper' }));
    const ring = new THREE.TorusGeometry(0.016, 0.003, 8, 24); ring.rotateY(Math.PI / 2); ring.translate(A.x, A.y, -0.06); g.add(mesh(ring, M.h2rGold, { name: 'h2r-damper-ring' })); }
  // The radiator, behind the side panels, ahead of the engine.
  { const r = new THREE.BoxGeometry(0.05, 0.3, 0.42); const m = mesh(r, M.h2rRadiator, { name: 'h2r-radiator' }); m.position.copy(P(440, 500)); m.rotation.z = 0.2; g.add(m); }
  // The radiator's side shrouds, mirror-coated and bolted, between the engine's front and the lower
  // cowl (the right-side photograph through its calibrated camera: from (0.112, 0.611) m at the top
  // rear to the lower cowl at x 0.388 m, down to ≈0.48 m, 0.215–0.24 m out), with a ridge along the
  // top. (They replace three carbon blades that are not on the bike.)
  {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const out = [V(0.112, 0.611, 0.215), V(0.388, 0.618, 0.24), V(0.388, 0.495, 0.24), V(0.22, 0.476, 0.215)];
    const ridge = [V(0.127, 0.592, 0.228), V(0.373, 0.600, 0.25)];
    const pos = [], tri = (a, b, c) => pos.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    tri(out[0], ridge[0], ridge[1]); tri(out[0], ridge[1], out[1]);
    tri(ridge[0], out[3], out[2]); tri(ridge[0], out[2], ridge[1]);
    let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const L = geo.clone(); L.scale(1, 1, -1); const ix = L.attributes.position;
    for (let i = 0; i < ix.count; i += 3) { const t = [ix.getX(i + 1), ix.getY(i + 1), ix.getZ(i + 1)]; ix.setXYZ(i + 1, ix.getX(i + 2), ix.getY(i + 2), ix.getZ(i + 2)); ix.setXYZ(i + 2, ...t); }
    L.computeVertexNormals();
    M.h2rChrome2 ??= Object.assign(M.h2rChrome.clone(), { side: THREE.DoubleSide, name: 'h2r-mirror-coat-2s' });
    g.add(mesh(mergeAll([{ geometry: geo }, { geometry: L }]), M.h2rChrome2, { name: 'h2r-radiator-shroud' }));
    for (const s of [-1, 1]) { const b = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12); b.rotateX(Math.PI / 2); b.translate(0.252, 0.535, s * 0.229); g.add(mesh(b, M.h2rAlu, { name: 'h2r-shroud-bolt' })); }
  }
  // Rearsets: aluminium heel plates and pegs (the side photograph), the right one with the brake pedal.
  for (const s of [-1, 1]) {
    const plate = slab([PXY(742, 598), PXY(762, 560), PXY(826, 574), PXY(834, 610), PXY(800, 628), PXY(748, 626)], 0.008, 0.002);
    const m = mesh(plate, M.h2rAlu, { name: 'h2r-heel-plate' }); m.position.z = s * 0.205 - 0.004; g.add(m);
    const peg = new THREE.CylinderGeometry(0.011, 0.011, 0.075, 12); peg.rotateX(Math.PI / 2); peg.translate(...PXY(800, 604), s * 0.215);
    g.add(mesh(peg, M.h2rAlu, { name: 'h2r-footpeg' }));
    const knurl = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12); knurl.rotateX(Math.PI / 2); knurl.translate(...PXY(800, 604), s * 0.225);
    g.add(mesh(knurl, M.h2rGold, { name: 'h2r-peg-knurl' }));
  }
  // The Öhlins shock's gold reservoir and its black preload knob, under the seat inside the side
  // cover (it does not show in the right-side photograph).
  { const c = new THREE.CylinderGeometry(0.02, 0.02, 0.09, 20); c.rotateZ(Math.PI / 2); c.translate(...PXY(860, 438), 0.0); g.add(mesh(c, M.h2rGold, { name: 'h2r-shock-reservoir' }));
    const k = new THREE.CylinderGeometry(0.022, 0.022, 0.035, 20); k.rotateZ(Math.PI / 2); k.translate(...PXY(820, 438), 0.0); g.add(mesh(k, M.h2rSatin, { name: 'h2r-shock-knob' })); }
  // On the right, under the tail: the dark panel of the rear hugger and the subframe's side, between
  // the tail and the tyre (the right-side photograph through its camera: x −0.52 to −0.22 m, 0.46 to
  // 0.64 m up, a blade slanting down to the heel plate, ≈0.10 m out). The left side is the swingarm's
  // and the chain's.
  { const pl = slab([[-0.523, 0.643], [-0.374, 0.639], [-0.218, 0.483], [-0.366, 0.458]], 0.004, 0.001); pl.translate(0, 0, 0.098);
    M.h2rSatin2 ??= Object.assign(M.h2rSatin.clone(), { side: THREE.DoubleSide, name: 'h2r-satin-black-2s' });
    g.add(mesh(pl, M.h2rSatin2, { name: 'h2r-rear-hugger-panel' })); }
  return g;
}
function radiatorTexture() {
  const t = canvasTexture(128, 128, (g, w) => {
    g.fillStyle = '#121314'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#2b2d30'; g.lineWidth = 1;
    for (let i = 0; i < w; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); }
    g.strokeStyle = '#1d1e20'; for (let j = 0; j < w; j += 10) { g.beginPath(); g.moveTo(0, j); g.lineTo(w, j); g.stroke(); }
  });
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); }
  return t;
}

/** The dash: housing and face; the face is a canvas texture the ride redraws (rpm, gear, speed, lean). */
function buildDash(M) {
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
