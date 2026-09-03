/**
 * Tesla Roadster — Starman.
 *
 * PROVENANCE & HISTORICAL SPECIFICATIONS:
 *  - Vehicle: Original First-Generation Tesla Roadster (2008 / 2.5 Sport edition),
 *    personal car of Elon Musk, launched as mass simulator payload on the maiden flight
 *    of SpaceX Falcon Heavy on 6 February 2018 from Launch Complex 39A (KSC).
 *  - Dimensions (Gen 1 Tesla Roadster documented specifications):
 *      Overall length:  3.946 m (declared 3.95 m)
 *      Wheelbase:       2.352 m
 *      Overall width:   1.727 m (body) / 1.873 m (with mirrors)
 *      Overall height:  1.127 m (declared 1.13 m)
 *      Front track:     1.455 m, Rear track: 1.490 m
 *      Wheel sizes:     Front 175/55 R16 (ø 0.60 m), Rear 225/45 R17 (ø 0.63 m)
 *  - Finish: Midnight Cherry Red metallic car paint with deep tinted clearcoat.
 *  - Configuration: Open cockpit (hardtop roof removed for flight).
 *  - Passenger: Starman mannequin in authentic white/black SpaceX IVA flight spacesuit.
 *    Pose: Left arm resting comfortably on the door sill, right hand on the steering wheel.
 *  - Documented Easter Eggs:
 *      1. Center touchscreen displaying "DON'T PANIC!" (Hitchhiker's Guide to the Galaxy).
 *      2. 1:64 scale Hot Wheels miniature Roadster with micro-Starman on the dashboard.
 *      3. Circuit board (PCB) engraved with "Made on Earth by humans".
 *      4. Arch Mission Foundation 5D quartz optical disc carrying Asimov's Foundation trilogy.
 *  - Payload Equipment:
 *      Falcon Heavy Payload Attach Fitting (PAF) carbon-composite truss adapter and
 *      three tubular carbon-fiber selfie camera boom arms.
 *
 * Local frame: Y=0 at tyre contact plane, +Y up, vehicle nose pointing along +Z,
 * driver side on -X (left-hand drive).
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4, boxUV, tube } from '../geometry/utils.js';

// ---- Dimensions -------------------------------------------------------------------------
export const ROADSTER_SPECS = {
  length: 3.95,       // total bumper-to-bumper length
  width: 1.73,        // body width
  widthMirrors: 1.87, // width including exterior mirrors
  height: 1.13,       // ground to top of windshield header / roll bar
  wheelbase: 2.352,   // distance between front and rear axle centers
  trackFront: 1.455,
  trackRear: 1.490,
  rideHeight: 0.13,   // ground clearance
  wheelRadiusFront: 0.30,
  wheelRadiusRear: 0.315,
};

// -----------------------------------------------------------------------------------------
//  Procedural Textures for In-Cockpit & Structural Displays
// -----------------------------------------------------------------------------------------
function makeDontPanicTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#06070a';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle bezel frame
  ctx.strokeStyle = '#2b3648';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 236);

  // Header
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#899bb5';
  ctx.textAlign = 'center';
  ctx.fillText('SPACEX  ·  FALCON HEAVY 001', 256, 46);

  // "DON'T PANIC!" typography
  ctx.font = '900 66px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("DON'T PANIC!", 256, 136);

  // Status subtitle
  ctx.font = '600 20px monospace';
  ctx.fillStyle = '#e03a3e';
  ctx.fillText('PAYLOAD STATUS: HELIOCENTRIC ORBIT', 256, 186);

  // CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 512, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function makePcbTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  // Classic dark green circuit board substrate
  ctx.fillStyle = '#0e3a22';
  ctx.fillRect(0, 0, 512, 256);

  // Gold copper traces
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = 24; y < 240; y += 36) {
    ctx.moveTo(12, y);
    ctx.lineTo(84, y);
    ctx.lineTo(120, y + 16);
    ctx.lineTo(210, y + 16);
    ctx.moveTo(310, y);
    ctx.lineTo(390, y);
    ctx.lineTo(430, y - 14);
    ctx.lineTo(500, y - 14);
  }
  ctx.stroke();

  // Integrated circuit pads
  ctx.fillStyle = '#c5a028';
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(40 + i * 16, 20, 9, 14);
    ctx.fillRect(40 + i * 16, 52, 9, 14);
    ctx.fillRect(390 + i * 11, 190, 7, 12);
  }

  // Silk screen inscription: "Made on Earth by humans"
  ctx.font = 'bold 32px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Made on Earth by humans', 256, 138);

  ctx.font = '16px monospace';
  ctx.fillStyle = '#f0d775';
  ctx.fillText('TESLA ROADSTER · STARMAN AVIONICS PCB', 256, 174);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// -----------------------------------------------------------------------------------------
//  Internal Material Factory
// -----------------------------------------------------------------------------------------
function createRoadsterMaterials(M) {
  // Midnight Cherry Red: Deep, rich cherry wine with metallic luster and high-gloss clearcoat
  const cherryRed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x560814),
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 0.96,
    clearcoatRoughness: 0.08,
    reflectivity: 0.88,
    envMapIntensity: 1.35,
  });

  const blackTrim = new THREE.MeshStandardMaterial({
    color: 0x161719,
    metalness: 0.2,
    roughness: 0.65,
  });

  const chromeTrim = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.95,
    roughness: 0.12,
  });

  const tyreRubber = new THREE.MeshStandardMaterial({
    color: 0x18191c,
    metalness: 0.05,
    roughness: 0.92,
  });

  const brakeRotor = new THREE.MeshStandardMaterial({
    color: 0x8e9299,
    metalness: 0.88,
    roughness: 0.38,
  });

  const brakeCaliper = new THREE.MeshStandardMaterial({
    color: 0xc41424,
    metalness: 0.45,
    roughness: 0.35,
  });

  const windshieldGlass = new THREE.MeshPhysicalMaterial({
    color: 0xa8c2d4,
    transparent: true,
    opacity: 0.38,
    roughness: 0.06,
    metalness: 0.1,
    transmission: 0.72,
    ior: 1.52,
    depthWrite: false,
  });

  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xf5f8ff,
    transparent: true,
    opacity: 0.55,
    roughness: 0.08,
    metalness: 0.15,
    depthWrite: false,
  });

  const taillightRed = new THREE.MeshStandardMaterial({
    color: 0xcc0c18,
    emissive: 0x440206,
    roughness: 0.25,
    metalness: 0.3,
  });

  const starmanSuitWhite = new THREE.MeshStandardMaterial({
    color: 0xf3f4f7,
    roughness: 0.68,
    metalness: 0.06,
  });

  const starmanVisor = new THREE.MeshPhysicalMaterial({
    color: 0x0a0b10,
    metalness: 0.94,
    roughness: 0.09,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.2,
  });

  const quartzDisc = new THREE.MeshPhysicalMaterial({
    color: 0xddeef8,
    transparent: true,
    opacity: 0.82,
    roughness: 0.05,
    metalness: 0.25,
    transmission: 0.85,
    ior: 1.46,
    depthWrite: false,
  });

  return {
    cherryRed, blackTrim, chromeTrim, tyreRubber, brakeRotor, brakeCaliper,
    windshieldGlass, headlightLens, taillightRed, starmanSuitWhite, starmanVisor, quartzDisc,
  };
}

// -----------------------------------------------------------------------------------------
//  Roadster Body Shell, Aero Contours & Exterior
// -----------------------------------------------------------------------------------------
function buildBody(mats, M) {
  const g = new THREE.Group();
  g.name = 'body-shell';

  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const block = (x0, x1, y0, y1, z0, z1) => ({
    geometry: B(x1 - x0, y1 - y0, z1 - z0),
    matrix: mat4([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]),
  });

  const redParts = [];
  const blackParts = [];
  const chromeParts = [];

  // Main lower tub sides & floor pan
  redParts.push(block(-0.84, 0.84, 0.14, 0.42, -1.92, 1.94));
  // Underbody aerodynamic tray (dark composite)
  blackParts.push(block(-0.83, 0.83, 0.12, 0.15, -1.95, 1.95));

  // Front nose & fascia
  redParts.push(block(-0.76, 0.76, 0.18, 0.44, 1.70, 1.97));
  redParts.push(block(-0.68, 0.68, 0.44, 0.54, 1.62, 1.92));
  // Lower front air intake grille (trapezoidal radiator mouth)
  blackParts.push(block(-0.52, 0.52, 0.16, 0.32, 1.90, 1.975));

  // Front Hood sloping upwards towards windshield cowl
  redParts.push(block(-0.72, 0.72, 0.48, 0.63, 0.50, 1.62));
  // Twin extraction vents on hood
  for (const s of [-1, 1]) {
    blackParts.push(block(s * 0.18 - 0.14, s * 0.18 + 0.14, 0.61, 0.64, 0.85, 1.35));
  }

  // Front muscular wheel arches / fenders
  for (const s of [-1, 1]) {
    redParts.push(block(s * 0.68, s * 0.86, 0.32, 0.66, 0.75, 1.58));
  }

  // Cockpit side sills & doors
  for (const s of [-1, 1]) {
    redParts.push(block(s * 0.70, s * 0.855, 0.22, 0.72, -0.65, 0.48));
    // Door handle recesses
    blackParts.push(block(s * 0.83 - 0.03, s * 0.855 + 0.01, 0.62, 0.67, -0.22, -0.06));
    // Side view mirrors
    redParts.push(block(s * 0.85, s * 0.935, 0.70, 0.81, 0.28, 0.44));
    chromeParts.push(block(s * 0.86, s * 0.93, 0.71, 0.80, 0.29, 0.32));
  }

  // Rear fenders / haunches (wider than front, housing wide 225 tyres)
  for (const s of [-1, 1]) {
    redParts.push(block(s * 0.68, s * 0.865, 0.34, 0.78, -1.65, -0.65));
    // Cooling air intake vents behind doors
    blackParts.push(block(s * 0.81, s * 0.86, 0.32, 0.58, -0.74, -0.62));
  }

  // Rear decklid & trunk
  redParts.push(block(-0.74, 0.74, 0.65, 0.85, -1.75, -0.75));
  // Integrated ducktail rear spoiler lip at the trailing edge
  redParts.push(block(-0.78, 0.78, 0.80, 0.92, -1.97, -1.72));

  // Rear lower aerodynamic diffuser with vertical fins
  blackParts.push(block(-0.76, 0.76, 0.16, 0.36, -1.975, -1.68));
  for (let df = -0.55; df <= 0.55; df += 0.22) {
    blackParts.push(block(df - 0.015, df + 0.015, 0.14, 0.38, -1.98, -1.70));
  }

  // Windshield frame & A-pillars (swept back)
  redParts.push(block(-0.68, 0.68, 1.05, 1.127, -0.22, -0.12));
  for (const s of [-1, 1]) {
    redParts.push({
      geometry: B(0.06, 0.68, 0.06),
      matrix: mat4([s * 0.66, 0.86, 0.12], [-0.72, 0, -s * 0.18]),
    });
  }

  // Structural roll hoop / roll bar behind the cockpit headrests
  blackParts.push(block(-0.64, 0.64, 0.84, 1.05, -0.68, -0.58));
  for (const s of [-1, 1]) {
    blackParts.push({
      geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.38, 16),
      matrix: mat4([s * 0.35, 0.96, -0.63]),
    });
  }

  g.add(mesh(boxUV(mergeAll(redParts)), mats.cherryRed, { name: 'body-paint' }));
  g.add(mesh(boxUV(mergeAll(blackParts)), mats.blackTrim, { name: 'body-trim' }));
  g.add(mesh(boxUV(mergeAll(chromeParts)), mats.chromeTrim));

  // Curved Windshield Glass (raked at ≈ 55°)
  const glassGeo = new THREE.PlaneGeometry(1.24, 0.64, 16, 8);
  // Curve glass slightly across width
  const gPos = glassGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i);
    gPos.setZ(i, gPos.getZ(i) - (x * x) * 0.18);
  }
  glassGeo.computeVertexNormals();
  const glassMesh = mesh(glassGeo, mats.windshieldGlass, {
    position: [0, 0.88, 0.15],
    rotation: [-0.74, 0, 0],
    name: 'windshield',
  });
  g.add(glassMesh);

  // Headlights: twin projector elements housed under clear aerodynamic lenses
  for (const s of [-1, 1]) {
    const hlGroup = new THREE.Group();
    hlGroup.name = `headlight-${s < 0 ? 'left' : 'right'}`;
    hlGroup.position.set(s * 0.54, 0.55, 1.72);
    hlGroup.rotation.set(-0.35, s * 0.22, 0);

    // Chrome reflective bowl
    hlGroup.add(mesh(new THREE.BoxGeometry(0.24, 0.12, 0.28), mats.chromeTrim));
    // Twin projector lamps
    hlGroup.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 16), M.lens || mats.chromeTrim, { position: [-0.05, 0, 0.08], rotation: [Math.PI / 2, 0, 0] }));
    hlGroup.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), M.lens || mats.chromeTrim, { position: [0.05, 0, 0.08], rotation: [Math.PI / 2, 0, 0] }));
    // Clear outer lens
    hlGroup.add(mesh(new THREE.BoxGeometry(0.26, 0.13, 0.04), mats.headlightLens, { position: [0, 0, 0.15] }));
    g.add(hlGroup);
  }

  // Taillights: Lotus/Tesla Gen 1 signature twin round circular red lights on each side
  for (const s of [-1, 1]) {
    for (let t = 0; t < 2; t++) {
      const tx = s * (0.42 + t * 0.18);
      const tl = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 24), mats.taillightRed, {
        position: [tx, 0.70, -1.95],
        rotation: [Math.PI / 2, 0, 0],
        name: `taillight-${s < 0 ? 'l' : 'r'}-${t}`,
      });
      g.add(tl);
    }
  }

  // Tesla front emblem badge
  const badge = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16), mats.chromeTrim, {
    position: [0, 0.48, 1.88],
    rotation: [0.35, 0, 0],
    name: 'tesla-emblem',
  });
  g.add(badge);

  return g;
}

// -----------------------------------------------------------------------------------------
//  Wheels, Tyres, Alloy Rims & Brake Assemblies
// -----------------------------------------------------------------------------------------
function buildWheels(mats, M) {
  const g = new THREE.Group();
  g.name = 'wheels';

  const { wheelbase, trackFront, trackRear, wheelRadiusFront, wheelRadiusRear } = ROADSTER_SPECS;
  const wheelConfigs = [
    { name: 'wheel-fl', x: -trackFront / 2, y: wheelRadiusFront, z: wheelbase / 2, r: wheelRadiusFront, w: 0.18 },
    { name: 'wheel-fr', x: trackFront / 2, y: wheelRadiusFront, z: wheelbase / 2, r: wheelRadiusFront, w: 0.18 },
    { name: 'wheel-rl', x: -trackRear / 2, y: wheelRadiusRear, z: -wheelbase / 2, r: wheelRadiusRear, w: 0.23 },
    { name: 'wheel-rr', x: trackRear / 2, y: wheelRadiusRear, z: -wheelbase / 2, r: wheelRadiusRear, w: 0.23 },
  ];

  for (const wc of wheelConfigs) {
    const wGroup = new THREE.Group();
    wGroup.name = wc.name;
    wGroup.position.set(wc.x, wc.y, wc.z);

    const isLeft = wc.x < 0;

    // 1. Rubber Tyre (outer radius, tread, sidewalls)
    const tyreGeo = new THREE.CylinderGeometry(wc.r, wc.r, wc.w, 32, 1, false);
    tyreGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(tyreGeo, mats.tyreRubber, { name: 'tyre' }));

    // 2. Alloy Wheel Rim
    const rimRadius = wc.r * 0.68;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wc.w * 0.92, 24, 1, false);
    rimGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rimGeo, M.aluminum || mats.chromeTrim, { name: 'rim-barrel' }));

    // 10-Spoke Alloy Face
    const spokeParts = [];
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * Math.PI * 2;
      const sx = (isLeft ? -wc.w * 0.46 : wc.w * 0.46);
      spokeParts.push({
        geometry: new THREE.BoxGeometry(0.024, rimRadius * 0.88, 0.025),
        matrix: mat4([sx, Math.sin(ang) * rimRadius * 0.44, Math.cos(ang) * rimRadius * 0.44], [ang, 0, 0]),
      });
    }
    // Center Hub Cap
    spokeParts.push({
      geometry: new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16),
      matrix: mat4([isLeft ? -wc.w * 0.48 : wc.w * 0.48, 0, 0], [0, 0, Math.PI / 2]),
    });
    wGroup.add(mesh(mergeAll(spokeParts), M.alumDark || mats.chromeTrim, { name: 'spokes' }));

    // 3. Ventilated Disc Brake Rotor & Red Caliper
    const discRadius = rimRadius * 0.76;
    const rotorGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.02, 24);
    rotorGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rotorGeo, mats.brakeRotor, { position: [isLeft ? -wc.w * 0.15 : wc.w * 0.15, 0, 0] }));

    const caliperGeo = new THREE.BoxGeometry(0.06, 0.12, 0.08);
    wGroup.add(mesh(caliperGeo, mats.brakeCaliper, {
      position: [isLeft ? -wc.w * 0.15 : wc.w * 0.15, discRadius * 0.65, 0.05],
      name: 'brake-caliper',
    }));

    g.add(wGroup);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Cockpit Interior, Dashboard, "DON'T PANIC!" & Easter Eggs
// -----------------------------------------------------------------------------------------
function buildInterior(mats, M, texDontPanic, texPcb) {
  const g = new THREE.Group();
  g.name = 'interior';

  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const block = (x0, x1, y0, y1, z0, z1) => ({
    geometry: B(x1 - x0, y1 - y0, z1 - z0),
    matrix: mat4([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]),
  });

  const trim = [];
  const alloy = [];

  // Cockpit floor & tunnel
  trim.push(block(-0.68, 0.68, 0.18, 0.22, -0.80, 0.55));
  // Center console / transmission tunnel (housing gear selector buttons & handbrake)
  trim.push(block(-0.14, 0.14, 0.22, 0.44, -0.65, 0.42));
  alloy.push(block(-0.06, 0.06, 0.44, 0.46, -0.25, 0.25));

  // Sport Bucket Seats (driver on -X, passenger on +X)
  for (const s of [-1, 1]) {
    const seatGroup = new THREE.Group();
    seatGroup.name = `seat-${s < 0 ? 'driver' : 'passenger'}`;
    const sx = s * 0.35;
    // Lower cushion
    seatGroup.add(mesh(new THREE.BoxGeometry(0.44, 0.14, 0.48), mats.blackTrim, { position: [sx, 0.28, -0.22] }));
    // Seat backrest reclined at ≈ 20°
    const backGeo = new THREE.BoxGeometry(0.42, 0.62, 0.12);
    seatGroup.add(mesh(backGeo, mats.blackTrim, {
      position: [sx, 0.62, -0.46],
      rotation: [-0.32, 0, 0],
    }));
    // Integrated headrest
    seatGroup.add(mesh(new THREE.BoxGeometry(0.25, 0.20, 0.10), mats.blackTrim, {
      position: [sx, 0.94, -0.56],
      rotation: [-0.32, 0, 0],
    }));
    g.add(seatGroup);
  }

  // Dashboard Structure (flowing Lotus/Tesla Gen 1 sculpted dash)
  trim.push(block(-0.66, 0.66, 0.56, 0.76, 0.18, 0.46));
  // Driver instrument binnacle cowl
  trim.push(block(-0.52, -0.18, 0.74, 0.86, 0.12, 0.38));
  // AC vents (round aluminum bezels)
  for (const vx of [-0.48, -0.22, 0.22, 0.48]) {
    alloy.push({
      geometry: new THREE.CylinderGeometry(0.032, 0.032, 0.015, 16),
      matrix: mat4([vx, 0.71, 0.38], [Math.PI / 2, 0, 0]),
    });
  }

  g.add(mesh(boxUV(mergeAll(trim)), mats.blackTrim, { name: 'interior-trim' }));
  g.add(mesh(boxUV(mergeAll(alloy)), M.aluminum || mats.chromeTrim));

  // Steering Wheel (Momo 3-spoke sport wheel, placed in front of driver at X = -0.35)
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'steering-wheel';
  wheelGroup.position.set(-0.35, 0.72, 0.12);
  wheelGroup.rotation.set(-0.55, 0, 0); // tilted towards driver

  // Outer leather rim (ø 0.34 m)
  wheelGroup.add(mesh(new THREE.TorusGeometry(0.165, 0.018, 12, 32), mats.blackTrim));
  // Center hub & 3 spokes
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));
  for (const ang of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
    wheelGroup.add(mesh(new THREE.BoxGeometry(0.14, 0.024, 0.008), mats.chromeTrim, {
      position: [Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0],
      rotation: [0, 0, ang],
    }));
  }
  g.add(wheelGroup);

  // ---- Easter Egg 1: "DON'T PANIC!" Center Screen ---------------------------------------
  const screenMesh = mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshBasicMaterial({
    map: texDontPanic,
    side: THREE.DoubleSide,
  }), {
    position: [0.0, 0.62, 0.34],
    rotation: [0.35, 0, 0],
    name: 'screen-dont-panic',
  });
  g.add(screenMesh);

  // ---- Easter Egg 2: 1:64 Scale Hot Wheels Roadster on Dashboard -------------------------
  const hwGroup = new THREE.Group();
  hwGroup.name = 'hot-wheels-easter-egg';
  hwGroup.position.set(0.08, 0.765, 0.28);
  hwGroup.rotation.set(-0.18, 0.24, 0);

  // Tiny red diecast car body (approx 6 cm long)
  hwGroup.add(mesh(new THREE.BoxGeometry(0.028, 0.014, 0.062), mats.cherryRed));
  // Tiny wheels
  for (const hx of [-0.014, 0.014]) for (const hz of [-0.018, 0.018]) {
    hwGroup.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8), mats.blackTrim, {
      position: [hx, -0.004, hz],
      rotation: [0, 0, Math.PI / 2],
    }));
  }
  // Tiny white micro-Starman seated inside
  hwGroup.add(mesh(new THREE.SphereGeometry(0.0045, 8, 8), mats.starmanSuitWhite, { position: [-0.005, 0.011, -0.004] }));
  g.add(hwGroup);

  // ---- Easter Egg 3: Arch Mission 5D Optical Quartz Disc ---------------------------------
  const disc = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.006, 24), mats.quartzDisc, {
    position: [0.35, 0.36, -0.15],
    rotation: [0, 0.35, 0],
    name: 'arch-5d-foundation-disc',
  });
  g.add(disc);

  // ---- Easter Egg 4: "Made on Earth by humans" Circuit Board -----------------------------
  // Positioned securely in the chassis service deck under the front compartment
  const pcbMesh = mesh(new THREE.PlaneGeometry(0.36, 0.18), new THREE.MeshStandardMaterial({
    map: texPcb,
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
  }), {
    position: [0.0, 0.24, 1.15],
    rotation: [-Math.PI / 2, 0, 0],
    name: 'pcb-made-on-earth',
  });
  g.add(pcbMesh);

  return g;
}

// -----------------------------------------------------------------------------------------
//  Starman Mannequin & SpaceX IVA Flight Suit
// -----------------------------------------------------------------------------------------
function buildStarman(mats, M) {
  const g = new THREE.Group();
  g.name = 'starman';

  const { starmanSuitWhite, starmanVisor, blackTrim } = mats;
  const sx = -0.35; // centered in the driver seat

  // 1. Torso (tilted back comfortably against seat rest)
  const torso = new THREE.Group();
  torso.position.set(sx, 0.58, -0.28);
  torso.rotation.set(-0.28, 0, 0);

  // White chest & back
  torso.add(mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.44, 16), starmanSuitWhite, { name: 'suit-chest' }));
  // Dark aerodynamic rib accents along the sides
  for (const s of [-1, 1]) {
    torso.add(mesh(new THREE.BoxGeometry(0.04, 0.38, 0.08), blackTrim, { position: [s * 0.16, 0, 0] }));
  }
  g.add(torso);

  // 2. Legs & Boots (seated ergonomically with knees raised towards pedals)
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const lx = sx + s * 0.11;
    // Thigh extending forward and slightly down
    leg.add(mesh(new THREE.CylinderGeometry(0.072, 0.065, 0.42, 12), starmanSuitWhite, {
      position: [lx, 0.36, -0.05],
      rotation: [1.32, 0, 0],
    }));
    // Lower leg extending down towards floor pedals
    leg.add(mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.38, 12), starmanSuitWhite, {
      position: [lx, 0.22, 0.22],
      rotation: [0.42, 0, 0],
    }));
    // Black flight boots
    leg.add(mesh(new THREE.BoxGeometry(0.09, 0.08, 0.20), blackTrim, {
      position: [lx, 0.20, 0.36],
      rotation: [0.15, 0, 0],
    }));
    g.add(leg);
  }

  // 3. Right Arm (reaching forward to hold the steering wheel at the 2 o'clock position)
  const rightArm = new THREE.Group();
  rightArm.name = 'right-arm-steering';
  // Upper arm extending forward
  rightArm.add(mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.30, 12), starmanSuitWhite, {
    position: [sx + 0.14, 0.64, -0.14],
    rotation: [1.15, -0.22, -0.45],
  }));
  // Forearm reaching to steering rim
  rightArm.add(mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.28, 12), starmanSuitWhite, {
    position: [sx + 0.06, 0.68, 0.02],
    rotation: [1.35, -0.35, -0.75],
  }));
  // Right glove gripping the wheel rim
  rightArm.add(mesh(new THREE.SphereGeometry(0.046, 12, 10), starmanSuitWhite, {
    position: [-0.22, 0.78, 0.10],
  }));
  rightArm.add(mesh(new THREE.BoxGeometry(0.05, 0.035, 0.06), blackTrim, {
    position: [-0.21, 0.78, 0.10],
  }));
  g.add(rightArm);

  // 4. Left Arm (THE ICONIC STARMAN POSE: resting casually on top of driver door sill)
  const leftArm = new THREE.Group();
  leftArm.name = 'left-arm-door-sill';
  // Upper arm extending left towards the door
  leftArm.add(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.32, 12), starmanSuitWhite, {
    position: [sx - 0.20, 0.66, -0.22],
    rotation: [0.32, 0, 1.15],
  }));
  // Forearm and elbow resting flat on the upper door sill (X ≈ -0.80, Y ≈ 0.75)
  leftArm.add(mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.36, 12), starmanSuitWhite, {
    position: [sx - 0.44, 0.75, -0.10],
    rotation: [1.52, 0, 0.12],
  }));
  // Left glove resting forward on the sill
  leftArm.add(mesh(new THREE.SphereGeometry(0.048, 12, 10), starmanSuitWhite, {
    position: [sx - 0.45, 0.75, 0.10],
  }));
  leftArm.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), blackTrim, {
    position: [sx - 0.45, 0.76, 0.10],
  }));
  g.add(leftArm);

  // 5. SpaceX Flight Helmet (gloss white shell with aerodynamic chin taper and smoked visor)
  const headGroup = new THREE.Group();
  headGroup.name = 'spacex-helmet';
  headGroup.position.set(sx, 0.88, -0.32);
  headGroup.rotation.set(-0.12, 0.15, 0); // head angled slightly towards the road/space

  // Helmet shell
  headGroup.add(mesh(new THREE.SphereGeometry(0.14, 24, 20), starmanSuitWhite));
  // Chin piece taper
  headGroup.add(mesh(new THREE.BoxGeometry(0.12, 0.09, 0.10), starmanSuitWhite, {
    position: [0, -0.06, 0.08],
    rotation: [-0.35, 0, 0],
  }));
  // Neck ring collar
  headGroup.add(mesh(new THREE.TorusGeometry(0.095, 0.022, 10, 24), blackTrim, {
    position: [0, -0.11, 0],
    rotation: [Math.PI / 2, 0, 0],
  }));
  // Smoked glossy reflective visor (no human face underneath)
  headGroup.add(mesh(new THREE.SphereGeometry(0.118, 24, 16, 0, Math.PI, 0, Math.PI * 0.65), starmanVisor, {
    position: [0, -0.01, 0.05],
    rotation: [-0.18, 0, 0],
    name: 'helmet-visor',
  }));
  g.add(headGroup);

  return g;
}

// -----------------------------------------------------------------------------------------
//  Falcon Heavy Payload Adapter & Selfie Camera Booms
// -----------------------------------------------------------------------------------------
function buildPayloadAdapter(mats, M) {
  const g = new THREE.Group();
  g.name = 'payload-adapter';

  const carbon = M.carbon || mats.blackTrim;
  const metal = M.alumDark || mats.chromeTrim;

  // 1. Conical Payload Attach Fitting (PAF) Ring Structure below the car
  // Sits below the car at Y from 0.08 down to -0.65 m
  const pafCone = [];
  pafCone.push({
    geometry: new THREE.CylinderGeometry(0.78, 1.25, 0.65, 32, 1, true),
    matrix: mat4([0, -0.22, 0]),
  });
  // Upper and lower reinforcement rings
  pafCone.push({
    geometry: new THREE.TorusGeometry(0.78, 0.04, 8, 32),
    matrix: mat4([0, 0.10, 0], [Math.PI / 2, 0, 0]),
  });
  pafCone.push({
    geometry: new THREE.TorusGeometry(1.25, 0.055, 8, 32),
    matrix: mat4([0, -0.54, 0], [Math.PI / 2, 0, 0]),
  });
  g.add(mesh(mergeAll(pafCone), carbon, { name: 'paf-cone' }));

  // 2. Tubular Carbon-Fiber Support Truss Struts tying chassis pickup points to the PAF
  const struts = [];
  const corners = [
    [-0.65, 0.16, 1.15],
    [0.65, 0.16, 1.15],
    [-0.68, 0.16, -1.15],
    [0.68, 0.16, -1.15],
  ];
  for (const [cx, cy, cz] of corners) {
    struts.push({
      geometry: tube([[cx, cy, cz], [cx * 0.65, -0.15, cz * 0.55], [cx * 0.45, -0.48, cz * 0.35]], 0.038, { tubular: 16, radial: 8 }),
    });
  }
  g.add(mesh(mergeAll(struts), metal, { name: 'chassis-support-struts' }));

  // 3. Three Carbon-Fiber Selfie Camera Booms (as flown on 6 Feb 2018)
  const booms = [];

  // (A) Front Selfie Boom: extends ahead of the front bumper and curves up, pointing at Starman
  const frontBoomPts = [
    [0.25, 0.22, 1.85],
    [0.45, 0.45, 2.45],
    [0.55, 0.85, 3.10],
  ];
  booms.push({ geometry: tube(frontBoomPts, 0.024, { tubular: 24, radial: 8 }) });

  // Camera A housing & lens
  const camA = new THREE.Group();
  camA.name = 'selfie-cam-front';
  camA.position.set(0.55, 0.85, 3.10);
  camA.lookAt(-0.35, 0.90, -0.2); // aim directly at Starman
  camA.add(mesh(new THREE.BoxGeometry(0.10, 0.08, 0.14), carbon));
  camA.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16), M.lens || mats.chromeTrim, { position: [0, 0, 0.08], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camA);

  // (B) Right Lateral Selfie Boom: extends to starboard, framing the car with Earth in the background
  const sideBoomPts = [
    [0.82, 0.35, -0.20],
    [1.35, 0.65, -0.10],
    [1.75, 1.05, 0.15],
  ];
  booms.push({ geometry: tube(sideBoomPts, 0.022, { tubular: 24, radial: 8 }) });

  const camB = new THREE.Group();
  camB.name = 'selfie-cam-side';
  camB.position.set(1.75, 1.05, 0.15);
  camB.lookAt(-0.20, 0.75, 0.0);
  camB.add(mesh(new THREE.BoxGeometry(0.09, 0.08, 0.12), carbon));
  camB.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 16), M.lens || mats.chromeTrim, { position: [0, 0, 0.07], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camB);

  // (C) Rear Over-the-Shoulder Boom: extends from rear decklid looking past Starman towards space
  const rearBoomPts = [
    [-0.25, 0.85, -1.25],
    [-0.38, 1.15, -1.65],
    [-0.45, 1.35, -2.10],
  ];
  booms.push({ geometry: tube(rearBoomPts, 0.020, { tubular: 20, radial: 8 }) });

  const camC = new THREE.Group();
  camC.name = 'selfie-cam-rear';
  camC.position.set(-0.45, 1.35, -2.10);
  camC.lookAt(-0.35, 0.85, 0.8);
  camC.add(mesh(new THREE.BoxGeometry(0.09, 0.07, 0.12), carbon));
  camC.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16), M.lens || mats.chromeTrim, { position: [0, 0, 0.07], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camC);

  g.add(mesh(mergeAll(booms), carbon, { name: 'camera-boom-tubes' }));

  return g;
}

// =========================================================================================
//  Main Builder Export
// =========================================================================================
export function buildRoadster(M) {
  const root = new THREE.Group();
  root.name = 'roadster';

  const texDontPanic = makeDontPanicTexture();
  const texPcb = makePcbTexture();
  const mats = createRoadsterMaterials(M);

  const body = buildBody(mats, M);
  const wheels = buildWheels(mats, M);
  const interior = buildInterior(mats, M, texDontPanic, texPcb);
  const starman = buildStarman(mats, M);
  const adapter = buildPayloadAdapter(mats, M);

  root.add(body);
  root.add(wheels);
  root.add(interior);
  root.add(starman);
  root.add(adapter);

  // Hull name definition for verification measuring
  // Matches HULLS.roadster in verify.js
  root.userData.height = ROADSTER_SPECS.height;
  root.userData.footprint = ROADSTER_SPECS.length;
  root.userData.length = ROADSTER_SPECS.length;
  root.userData.width = ROADSTER_SPECS.width;

  root.userData.parts = {
    body,
    wheels,
    interior,
    starman,
    adapter,
  };

  root.userData.annotations = [
    { label: 'Starman · Maniquí con traje espacial SpaceX IVA', position: [-0.35, 0.95, -0.2] },
    { label: '«DON\'T PANIC!» · Pantalla del salpicadero', position: [0.0, 0.68, 0.35] },
    { label: 'Miniatura Hot Wheels 1:64 con micro-Starman', position: [0.08, 0.82, 0.28] },
    { label: 'Tesla Roadster 2008 · Pintura Midnight Cherry Red', position: [0.72, 0.65, 0.8] },
    { label: 'Cámara selfie en mástil de fibra de carbono', position: [0.55, 0.95, 3.10] },
    { label: 'Adaptador de carga útil (PAF) de Falcon Heavy', position: [0.0, -0.22, 0.0] },
    { label: '«Made on Earth by humans» · Placa de circuito', position: [0.0, 0.28, 1.15] },
    { label: 'Archivo 5D Arch Mission · Trilogía Fundación', position: [0.35, 0.42, -0.15] },
  ];

  return root;
}
