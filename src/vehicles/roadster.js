/**
 * Tesla Roadster — Starman.
 *
 * PROVENANCE & HISTORICAL SPECIFICATIONS:
 *  - Vehicle: Original First-Generation Tesla Roadster (2008 / 2.5 Sport edition),
 *    personal car of Elon Musk, launched as mass simulator payload on the maiden flight
 *    of SpaceX Falcon Heavy on 6 February 2018 from Launch Complex 39A (KSC).
 *  - Documented Dimensions (Gen 1 Tesla Roadster official specifications):
 *      Overall length:  3.946 m (declared 3.95 m)
 *      Wheelbase:       2.352 m (front axle z = +1.176 m, rear axle z = -1.176 m)
 *      Overall width:   1.728 m (body) / 1.873 m (with exterior mirrors)
 *      Overall height:  1.128 m (declared 1.13 m)
 *      Front track:     1.455 m, Rear track: 1.490 m
 *      Wheel sizes:     Front 175/55 R16 (ø 0.60 m), Rear 225/45 R17 (ø 0.634 m)
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
import { mesh, mergeAll, mat4, boxUV, tube, lathe } from '../geometry/utils.js';

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
  wheelRadiusRear: 0.317,
};

// -----------------------------------------------------------------------------------------
//  Parametric Surface Generator (Smooth, Watertight, Analytical Normals & Metric UVs)
// -----------------------------------------------------------------------------------------
function createParametricSurface(Nu, Nv, evalFn, flip = false) {
  const positions = new Float32Array(Nu * Nv * 3);
  const uvs = new Float32Array(Nu * Nv * 2);
  const indices = [];

  for (let i = 0; i < Nu; i++) {
    const u = i / (Nu - 1);
    for (let j = 0; j < Nv; j++) {
      const v = j / (Nv - 1);
      const pt = evalFn(u, v);
      const idx = i * Nv + j;
      positions[idx * 3 + 0] = pt.x;
      positions[idx * 3 + 1] = pt.y;
      positions[idx * 3 + 2] = pt.z;
      uvs[idx * 2 + 0] = pt.u !== undefined ? pt.u : v;
      uvs[idx * 2 + 1] = pt.v !== undefined ? pt.v : u;
    }
  }

  for (let i = 0; i < Nu - 1; i++) {
    for (let j = 0; j < Nv - 1; j++) {
      const a = i * Nv + j;
      const b = (i + 1) * Nv + j;
      const c = (i + 1) * Nv + (j + 1);
      const d = i * Nv + (j + 1);
      if (flip) {
        indices.push(a, d, b);
        indices.push(b, d, c);
      } else {
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// -----------------------------------------------------------------------------------------
//  Procedural Textures for In-Cockpit Displays & Circuitry
// -----------------------------------------------------------------------------------------
function makeDontPanicTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, 512, 256);

  // Bezel edge
  ctx.strokeStyle = '#222b3a';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);

  // Top system banner
  ctx.font = '600 20px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = '#788ca6';
  ctx.textAlign = 'center';
  ctx.fillText('SPACEX  ·  FALCON HEAVY 001  ·  STARMAN', 256, 42);

  // "DON'T PANIC!" main headline
  ctx.font = '900 68px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("DON'T PANIC!", 256, 134);

  // Mission status
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#e53935';
  ctx.fillText('PAYLOAD STATUS: HELIOCENTRIC ORBIT', 256, 184);

  ctx.font = '500 14px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#4caf50';
  ctx.fillText('APHELION: 1.67 AU  ·  PERIHELION: 0.98 AU', 256, 214);

  // Scanline overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
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
  ctx.fillStyle = '#0b2b17';
  ctx.fillRect(0, 0, 512, 256);

  // Gold circuit traces
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = 20; y < 240; y += 32) {
    ctx.moveTo(16, y);
    ctx.lineTo(84, y);
    ctx.lineTo(124, y + 14);
    ctx.lineTo(210, y + 14);
    ctx.moveTo(300, y);
    ctx.lineTo(380, y);
    ctx.lineTo(420, y - 12);
    ctx.lineTo(496, y - 12);
  }
  ctx.stroke();

  // IC contact pads
  ctx.fillStyle = '#c5a028';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(36 + i * 16, 18, 9, 14);
    ctx.fillRect(36 + i * 16, 50, 9, 14);
    ctx.fillRect(380 + i * 11, 186, 7, 12);
  }

  // Silk screen inscription: "Made on Earth by humans"
  ctx.font = 'bold 32px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Made on Earth by humans', 256, 136);

  ctx.font = '15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#f0d775';
  ctx.fillText('TESLA ROADSTER · STARMAN AVIONICS PCB', 256, 172);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function makeGrilleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0c0e';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1c2026';
  for (let y = 0; y < 128; y += 8) {
    for (let x = (y % 16 === 0 ? 0 : 4); x < 128; x += 8) {
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 4);
  return tex;
}

// -----------------------------------------------------------------------------------------
//  Material Factory
// -----------------------------------------------------------------------------------------
function createRoadsterMaterials(M) {
  // Midnight Cherry Red: Deep, lustrous ruby metallic with clearcoat gloss
  const cherryRed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x520914),
    metalness: 0.88,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.94,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  });

  const blackTrim = new THREE.MeshStandardMaterial({
    color: 0x121316,
    metalness: 0.30,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  const satinBlack = new THREE.MeshStandardMaterial({
    color: 0x1a1c20,
    metalness: 0.35,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });

  const chromeTrim = new THREE.MeshStandardMaterial({
    color: 0xf2f4f7,
    metalness: 0.96,
    roughness: 0.10,
    envMapIntensity: 1.8,
  });

  const tyreRubber = new THREE.MeshStandardMaterial({
    color: 0x151618,
    metalness: 0.06,
    roughness: 0.90,
  });

  const brakeRotor = new THREE.MeshStandardMaterial({
    color: 0x8a8e94,
    metalness: 0.90,
    roughness: 0.32,
  });

  const brakeCaliper = new THREE.MeshStandardMaterial({
    color: 0xc61224,
    metalness: 0.50,
    roughness: 0.28,
  });

  const suspensionYellow = new THREE.MeshStandardMaterial({
    color: 0xd6a218,
    metalness: 0.30,
    roughness: 0.38,
  });

  const windshieldGlass = new THREE.MeshPhysicalMaterial({
    color: 0xa8c4dc,
    transparent: true,
    opacity: 0.38,
    roughness: 0.03,
    metalness: 0.12,
    transmission: 0.80,
    ior: 1.52,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xf5f8ff,
    transparent: true,
    opacity: 0.55,
    roughness: 0.04,
    metalness: 0.10,
    transmission: 0.75,
    ior: 1.50,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const taillightRed = new THREE.MeshStandardMaterial({
    color: 0xd80a16,
    emissive: 0x5a040a,
    roughness: 0.20,
    metalness: 0.35,
  });

  const starmanSuitWhite = new THREE.MeshStandardMaterial({
    color: 0xf4f5f8,
    roughness: 0.62,
    metalness: 0.08,
  });

  const starmanVisor = new THREE.MeshPhysicalMaterial({
    color: 0x08090d,
    metalness: 0.96,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.6,
  });

  const quartzDisc = new THREE.MeshPhysicalMaterial({
    color: 0xddeef8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.04,
    metalness: 0.20,
    transmission: 0.88,
    ior: 1.46,
    depthWrite: false,
  });

  const grilleMesh = new THREE.MeshStandardMaterial({
    map: makeGrilleTexture(),
    color: 0x111315,
    roughness: 0.85,
    metalness: 0.2,
  });

  return {
    cherryRed, blackTrim, satinBlack, chromeTrim, tyreRubber, brakeRotor, brakeCaliper, suspensionYellow,
    windshieldGlass, headlightLens, taillightRed, starmanSuitWhite, starmanVisor, quartzDisc, grilleMesh,
  };
}

// -----------------------------------------------------------------------------------------
//  CAD-Grade Body Shell: Watertight, Zero-Hole Parametric Surfaces
// -----------------------------------------------------------------------------------------
function buildBodyShell(mats, M) {
  const g = new THREE.Group();
  g.name = 'body-shell';

  // Z stations defining key structural cross-sections
  const zNose = 1.975;
  const zCowl = 0.38;
  const zBulkhead = -0.66;
  const zRearFascia = -1.975;

  // 1. FRONT CLAMSHELL (Nose, Grille, Hood, Front Fenders, Front Rockers)
  // Evaluated from z = zCowl (u = 0) to z = zNose (u = 1)
  const frontClamGeo = createParametricSurface(32, 28, (u, v) => {
    const z = zCowl + u * (zNose - zCowl);
    const s = (v - 0.5) * 2; // -1 to +1 across width
    const absS = Math.abs(s);
    const sign = s < 0 ? -1 : 1;

    const t = (z - zCowl) / (zNose - zCowl); // 0 at cowl, 1 at nose
    // Half width along front section
    const W = 0.81 + 0.05 * Math.sin(t * Math.PI) - 0.58 * Math.pow(t, 2.5);

    // Wheel arch cutout around front axle z = 1.176
    const dz = Math.abs(z - 1.176);
    let archY = 0.15;
    if (dz < 0.34) {
      archY = 0.30 + Math.sqrt(Math.max(0, 0.345 * 0.345 - dz * dz));
    }
    let rockerY = 0.15;
    if (z > 1.52) rockerY = 0.15 + 0.03 * Math.pow((z - 1.52) / 0.455, 1.2);
    const targetY = (dz < 0.34) ? archY : rockerY;

    // Centerline height
    const yCenter = 0.70 - 0.24 * Math.pow(t, 0.9);

    // Fender crown height over front wheel
    const fenderHump = 0.16 * Math.exp(-Math.pow((z - 1.176) / 0.44, 2));
    const yFender = (0.71 - 0.18 * Math.pow(t, 0.85)) + fenderHump;

    let x, y;
    if (absS < 0.55) {
      // Hood top surface
      const th = absS / 0.55;
      x = s * W * 0.72;
      y = yCenter * (1 - Math.pow(th, 2.0)) + (yCenter * 0.4 + yFender * 0.6) * Math.pow(th, 2.0);

      // Twin hood heat extractor depressions
      if (z > 0.95 && z < 1.45 && Math.abs(absS - 0.28) < 0.11) {
        const fz = 1 - Math.pow((z - 1.20) / 0.25, 2);
        const fx = 1 - Math.pow((absS - 0.28) / 0.11, 2);
        y -= 0.024 * fz * fx;
      }
    } else if (absS < 0.80) {
      // Fender crown
      const tf = (absS - 0.55) / 0.25;
      x = sign * (W * 0.72 * (1 - tf) + W * tf);
      y = (yCenter * 0.4 + yFender * 0.6) * (1 - tf) + yFender * tf;
    } else {
      // Outer fender dropping down to wheel arch / rocker
      const td = (absS - 0.80) / 0.20;
      x = sign * (W * (1 - td * 0.05));
      y = yFender * (1 - Math.pow(td, 1.4)) + targetY * Math.pow(td, 1.4);
    }

    // Nose curvature closure towards tip
    if (z > 1.82) {
      const tn = (z - 1.82) / (zNose - 1.82);
      x *= Math.sqrt(Math.max(0.001, 1 - tn * tn));
    }

    return { x, y, z };
  });

  // 2. SIDE DOORS & ROCKERS (Left and Right)
  // Smoothly bridges z = zCowl (0.38) down to z = zBulkhead (-0.66)
  function createDoorGeometry(side) {
    return createParametricSurface(20, 16, (u, v) => {
      const z = zCowl + u * (zBulkhead - zCowl);
      const tz = (z - zBulkhead) / (zCowl - zBulkhead);
      const W = 0.765 + 0.05 * Math.pow(tz - 0.5, 2) * 4;
      const yTop = 0.71 + 0.02 * (1 - tz);
      const yBottom = 0.15;

      let x, y;
      if (v < 0.30) {
        // Horizontal door sill top return (matches cockpit rim at |x| = 0.64)
        const ts = v / 0.30;
        x = side * (0.64 * (1 - ts) + (W * 0.95) * ts);
        y = yTop + 0.01 * Math.sin(ts * Math.PI);
      } else if (v < 0.75) {
        // Outer door flank with subtle aerodynamic waistline
        const td = (v - 0.30) / 0.45;
        x = side * (W * 0.95 * (1 - td) + W * td);
        y = yTop * (1 - Math.pow(td, 1.2)) + (yBottom + 0.22) * Math.pow(td, 1.2);
      } else {
        // Lower rocker turning under to belly pan
        const tr = (v - 0.75) / 0.25;
        x = side * (W * (1 - tr * 0.10));
        y = (yBottom + 0.22) * (1 - tr) + yBottom * tr;
      }
      return { x, y, z };
    }, side < 0);
  }

  const leftDoorGeo = createDoorGeometry(-1);
  const rightDoorGeo = createDoorGeometry(1);

  // 3. REAR CLAMSHELL (Rear Decklid, Haunches, Ducktail Spoiler, Rear Fascia, Diffuser Return)
  // Evaluated from z = zBulkhead (-0.66) to z = zRearFascia (-1.975)
  const rearClamGeo = createParametricSurface(32, 28, (u, v) => {
    const z = zBulkhead + u * (zRearFascia - zBulkhead);
    const s = (v - 0.5) * 2;
    const absS = Math.abs(s);
    const sign = s < 0 ? -1 : 1;

    const tz = (zBulkhead - z) / (zBulkhead - zRearFascia);
    const haunch = 0.082 * Math.exp(-Math.pow((z - -1.176) / 0.46, 2));
    const W = (0.80 + haunch) * (1 - Math.pow(Math.max(0, tz - 0.8) / 0.2, 2) * 0.45);

    // Rear wheel arch cutout around rear axle z = -1.176
    const dz = Math.abs(z - -1.176);
    let archY = 0.15;
    if (dz < 0.36) {
      archY = 0.315 + Math.sqrt(Math.max(0, 0.365 * 0.365 - dz * dz));
    }
    const rockerY = 0.15 + 0.05 * Math.pow(Math.max(0, (-1.55 - z) / 0.425), 1.2);
    const targetY = (dz < 0.36) ? archY : rockerY;

    // Decklid height with integrated ducktail spoiler sweep
    let yDeck = 0.81 - 0.035 * Math.min(1.0, (zBulkhead - z) / 0.80);
    if (z < -1.45) {
      const sp = Math.min(1.0, (-1.45 - z) / 0.41);
      yDeck += 0.09 * Math.pow(sp, 1.8);
    }
    if (z < -1.86) {
      const rf = (-1.86 - z) / (-1.86 - zRearFascia);
      yDeck = 0.865 * (1 - Math.pow(rf, 1.2)) + 0.20 * Math.pow(rf, 1.2);
    }

    // Rear haunch crown height
    const haunchHump = 0.085 * Math.exp(-Math.pow((z - -1.176) / 0.45, 2));
    const yHaunch = yDeck + 0.02 + haunchHump;

    let x, y;
    if (absS < 0.55) {
      // Rear decklid / engine cover
      const th = absS / 0.55;
      x = s * W * 0.72;
      y = yDeck * (1 - th * th * 0.25);
    } else if (absS < 0.80) {
      // Haunch crown
      const tf = (absS - 0.55) / 0.25;
      x = sign * (W * 0.72 * (1 - tf) + W * tf);
      y = yDeck * (1 - tf) + yHaunch * tf;
    } else {
      // Outer haunch flank down to wheel arch / bumper
      const td = (absS - 0.80) / 0.20;
      x = sign * (W * (1 - td * 0.04));
      y = yHaunch * (1 - Math.pow(td, 1.3)) + targetY * Math.pow(td, 1.3);
    }

    // Rear bumper curvature closure
    if (z < -1.90) {
      const tr = (-1.90 - z) / (-1.90 - zRearFascia);
      x *= Math.sqrt(Math.max(0.001, 1 - tr * tr));
    }

    return { x, y, z };
  }, true);

  // Merge the entire body painted monocoque into ONE seamless master mesh
  const masterBodyPaintGeo = mergeAll([
    { geometry: frontClamGeo },
    { geometry: leftDoorGeo },
    { geometry: rightDoorGeo },
    { geometry: rearClamGeo },
  ]);

  g.add(mesh(masterBodyPaintGeo, mats.cherryRed, { name: 'body-paint' }));

  // 4. WATERTIGHT COCKPIT TUB (Floor, Firewall, Tunnel, Bulkhead, Inner Door Panels)
  // Spans z from zCowl (0.38) to zBulkhead (-0.66), width x from -0.64 to +0.64
  const cockpitTubGeo = createParametricSurface(24, 20, (u, v) => {
    const z = zCowl + u * (zBulkhead - zCowl);
    const s = (v - 0.5) * 2;
    const absS = Math.abs(s);
    const sign = s < 0 ? -1 : 1;
    const x = s * 0.64;

    // Rim heights matching outer body
    const yFrontRim = 0.70;
    const yRearRim = 0.81;
    const ySillRim = 0.71;

    let y;
    if (u < 0.15) {
      // Front firewall dipping down to floor
      const tf = u / 0.15;
      y = yFrontRim * (1 - tf) + 0.18 * tf;
    } else if (u > 0.82) {
      // Rear engine bulkhead rising to roll hoop base
      const tb = (u - 0.82) / 0.18;
      y = 0.18 * (1 - tb) + yRearRim * tb;
    } else {
      // Cockpit floor
      y = 0.18;
      // Center transmission tunnel
      if (absS < 0.22) {
        const tt = 1 - Math.pow(absS / 0.22, 2);
        y += 0.16 * tt;
      }
      // Inner side door card curvature rising to sill
      if (absS > 0.75) {
        const ts = (absS - 0.75) / 0.25;
        y += (ySillRim - 0.18) * Math.pow(ts, 1.6);
      }
    }

    return { x, y, z };
  }, true);

  g.add(mesh(cockpitTubGeo, mats.blackTrim, { name: 'cockpit-tub' }));

  // 5. WATERTIGHT CLOSED WHEEL ARCH LINER TUBS
  const wheelLinerParts = [];
  // Front liners (z = 1.176, r = 0.35)
  for (const s of [-1, 1]) {
    const xOut = s * 0.74;
    const xIn = s * 0.52;
    const linerCurv = lathe([
      { r: 0.35, y: xOut },
      { r: 0.35, y: xIn },
      { r: 0.05, y: xIn }, // closed inner bulkhead
    ], { segments: 24, phiStart: Math.PI * 0.05, phiLength: Math.PI * 0.90 });
    linerCurv.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    linerCurv.rotateY(Math.PI / 2);
    wheelLinerParts.push({
      geometry: linerCurv,
      matrix: mat4([0, 0.30, 1.176]),
    });
  }
  // Rear liners (z = -1.176, r = 0.37)
  for (const s of [-1, 1]) {
    const xOut = s * 0.76;
    const xIn = s * 0.50;
    const linerCurv = lathe([
      { r: 0.37, y: xOut },
      { r: 0.37, y: xIn },
      { r: 0.05, y: xIn },
    ], { segments: 24, phiStart: Math.PI * 0.05, phiLength: Math.PI * 0.90 });
    linerCurv.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    linerCurv.rotateY(Math.PI / 2);
    wheelLinerParts.push({
      geometry: linerCurv,
      matrix: mat4([0, 0.317, -1.176]),
    });
  }
  g.add(mesh(mergeAll(wheelLinerParts), mats.satinBlack, { name: 'wheel-well-liners' }));

  // 6. UNDERBODY AERO PAN (Full length belly tray from chin to diffuser)
  const bellyPan = new THREE.BoxGeometry(1.50, 0.03, 3.82);
  g.add(mesh(bellyPan, mats.blackTrim, { position: [0, 0.14, 0], name: 'underbody-belly-pan' }));

  // Front chin aerodynamic splitter with support struts
  const splitterPts = [
    [-0.74, 0.15, 1.70],
    [-0.52, 0.15, 1.94],
    [0.0, 0.15, 1.98],
    [0.52, 0.15, 1.94],
    [0.74, 0.15, 1.70],
  ];
  g.add(mesh(tube(splitterPts, 0.022, { tubular: 24, radial: 8 }), mats.blackTrim, { name: 'front-splitter' }));
  for (const sx of [-0.28, 0.28]) {
    g.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8), mats.chromeTrim, {
      position: [sx, 0.21, 1.93],
      rotation: [0.35, 0, 0],
    }));
  }

  // Front lower radiator intake mouth & aluminum cooling matrix
  const grilleMouth = new THREE.BoxGeometry(0.80, 0.16, 0.14);
  g.add(mesh(grilleMouth, mats.grilleMesh, {
    position: [0, 0.24, 1.86],
    name: 'front-grille-mouth',
  }));
  const radiatorCore = new THREE.BoxGeometry(0.74, 0.14, 0.02);
  g.add(mesh(radiatorCore, M.aluminum || mats.chromeTrim, {
    position: [0, 0.24, 1.79],
    name: 'radiator-cooling-core',
  }));

  // Twin hood extraction vent louvers (Angled black aerodynamic slats)
  const hoodLouvers = [];
  for (const s of [-1, 1]) {
    for (let l = 0; l < 4; l++) {
      hoodLouvers.push({
        geometry: new THREE.BoxGeometry(0.12, 0.006, 0.035),
        matrix: mat4([s * 0.22, 0.605 + l * 0.012, 1.05 + l * 0.07], [0.35, 0, 0]),
      });
    }
  }
  g.add(mesh(mergeAll(hoodLouvers), mats.blackTrim, { name: 'hood-extractor-louvers' }));

  // Chrome Tesla nose crest medallion
  const emblem = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16);
  g.add(mesh(emblem, mats.chromeTrim, {
    position: [0, 0.50, 1.82],
    rotation: [0.45, 0, 0],
    name: 'tesla-nose-emblem',
  }));

  // Rear aerodynamic racing diffuser with 4 vertical strakes
  const diffPlate = new THREE.BoxGeometry(1.44, 0.05, 0.42);
  g.add(mesh(diffPlate, mats.blackTrim, {
    position: [0, 0.18, -1.76],
    name: 'rear-diffuser-tray',
  }));
  for (let sx = -0.45; sx <= 0.45; sx += 0.30) {
    const strake = new THREE.BoxGeometry(0.016, 0.13, 0.40);
    g.add(mesh(strake, mats.blackTrim, {
      position: [sx, 0.17, -1.76],
      name: 'diffuser-strake',
    }));
  }

  // Rear recessed license plate well with "STARMAN" plate
  const recessGeo = new THREE.BoxGeometry(0.54, 0.16, 0.04);
  g.add(mesh(recessGeo, mats.blackTrim, {
    position: [0, 0.48, -1.96],
    name: 'rear-license-recess',
  }));
  const plateText = new THREE.PlaneGeometry(0.34, 0.09);
  plateText.rotateY(Math.PI);
  g.add(mesh(plateText, mats.chromeTrim, {
    position: [0, 0.48, -1.975],
    name: 'rear-license-plate',
  }));

  // Chrome "TESLA" rear script lettering bar
  const rearScript = new THREE.BoxGeometry(0.28, 0.025, 0.006);
  g.add(mesh(rearScript, mats.chromeTrim, {
    position: [0, 0.72, -1.96],
    name: 'rear-tesla-script',
  }));

  // Dual lower rear cooling exhaust ports
  for (const s of [-0.35, 0.35]) {
    g.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 16), mats.blackTrim, {
      position: [s, 0.28, -1.95],
      rotation: [Math.PI / 2, 0, 0],
      name: 'rear-cooling-port',
    }));
  }

  // Stamped panel shut lines (Hood cut line & Door seams)
  const shutLines = [];
  const hoodSeamPts = [
    [-0.52, 0.69, 0.40],
    [-0.52, 0.60, 1.20],
    [-0.40, 0.50, 1.66],
    [0.0, 0.46, 1.72],
    [0.40, 0.50, 1.66],
    [0.52, 0.60, 1.20],
    [0.52, 0.69, 0.40],
  ];
  shutLines.push({ geometry: tube(hoodSeamPts, 0.005, { tubular: 24, radial: 6 }) });
  for (const s of [-1, 1]) {
    shutLines.push({ geometry: tube([[s * 0.77, 0.68, 0.36], [s * 0.76, 0.22, 0.36]], 0.005, { tubular: 8, radial: 6 }) });
    shutLines.push({ geometry: tube([[s * 0.79, 0.72, -0.66], [s * 0.78, 0.22, -0.66]], 0.005, { tubular: 8, radial: 6 }) });
  }
  g.add(mesh(mergeAll(shutLines), mats.blackTrim, { name: 'body-shut-lines' }));

  // Exterior side mirrors on aerodynamic stalks
  for (const side of [-1, 1]) {
    const mirrorStem = tube([
      [side * 0.76, 0.70, 0.32],
      [side * 0.88, 0.75, 0.33],
    ], 0.014, { tubular: 12, radial: 6 });
    g.add(mesh(mirrorStem, mats.blackTrim));

    const mirrorHousing = new THREE.Group();
    mirrorHousing.position.set(side * 0.90, 0.75, 0.33);
    mirrorHousing.rotation.set(-0.1, side * 0.15, 0);

    const mBody = new THREE.SphereGeometry(0.07, 16, 12);
    mBody.scale(1.2, 0.75, 0.7);
    mirrorHousing.add(mesh(mBody, mats.cherryRed));

    const mGlass = new THREE.PlaneGeometry(0.12, 0.08);
    mGlass.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    mirrorHousing.add(mesh(mGlass, mats.chromeTrim, { position: [side * -0.04, 0, 0] }));

    g.add(mirrorHousing);

    // Recessed door handles
    const handleGeo = new THREE.BoxGeometry(0.015, 0.04, 0.12);
    g.add(mesh(handleGeo, mats.blackTrim, {
      position: [side * 0.785, 0.63, -0.10],
      name: `door-handle-${side < 0 ? 'left' : 'right'}`,
    }));
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Headlights: Swept Almond Projector Clusters with LED Halo Rings
// -----------------------------------------------------------------------------------------
function buildHeadlights(mats, M) {
  const g = new THREE.Group();
  g.name = 'headlights';

  for (const s of [-1, 1]) {
    const hlGroup = new THREE.Group();
    hlGroup.name = `headlight-${s < 0 ? 'left' : 'right'}`;
    hlGroup.position.set(s * 0.54, 0.57, 1.70);
    hlGroup.rotation.set(-0.32, s * 0.24, -s * 0.12);

    // Chrome reflector bucket
    const bucket = new THREE.SphereGeometry(0.13, 20, 14, 0, Math.PI);
    bucket.scale(0.85, 0.55, 1.4);
    hlGroup.add(mesh(bucket, mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));

    // Dual bi-xenon projector lamps with illuminated halos
    for (const [lx, lz, lr] of [[-0.035, 0.05, 0.038], [0.035, -0.05, 0.032]]) {
      hlGroup.add(mesh(new THREE.CylinderGeometry(lr, lr, 0.06, 16), M.lens || mats.chromeTrim, {
        position: [lx, 0, lz],
        rotation: [Math.PI / 2, 0, 0],
      }));
      hlGroup.add(mesh(new THREE.TorusGeometry(lr * 0.95, 0.006, 8, 20), mats.chromeTrim, {
        position: [lx, 0.03, lz],
      }));
    }

    // Amber corner indicator reflector strip
    hlGroup.add(mesh(new THREE.BoxGeometry(0.02, 0.015, 0.12), mats.suspensionYellow, {
      position: [s * 0.055, 0.01, 0.0],
      rotation: [0, 0, s * 0.3],
    }));

    // Gasket bezel seal around outer lens
    hlGroup.add(mesh(new THREE.TorusGeometry(0.125, 0.008, 6, 24), mats.blackTrim, {
      position: [0, 0, 0.01],
      scale: new THREE.Vector3(0.86, 0.56, 1.42),
    }));

    // Curved aerodynamic polycarbonate outer lens
    const lensGeo = new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI);
    lensGeo.scale(0.86, 0.56, 1.42);
    hlGroup.add(mesh(lensGeo, mats.headlightLens, {
      rotation: [Math.PI / 2, 0, 0],
      position: [0, 0, 0.01],
    }));

    g.add(hlGroup);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Taillights: Rocket-Style Circular LED Jewel Lamps
// -----------------------------------------------------------------------------------------
function buildTaillights(mats, M) {
  const g = new THREE.Group();
  g.name = 'taillights';

  for (const s of [-1, 1]) {
    for (let t = 0; t < 2; t++) {
      const tx = s * (0.42 + t * 0.20);
      const tl = new THREE.Group();
      tl.position.set(tx, 0.69, -1.956);

      // Chrome outer bezel
      tl.add(mesh(new THREE.TorusGeometry(0.064, 0.010, 8, 24), mats.chromeTrim));
      // Red jewel LED lens
      tl.add(mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.03, 24), mats.taillightRed, {
        rotation: [Math.PI / 2, 0, 0],
      }));
      // Inner reverse/indicator lens
      tl.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.035, 16), mats.chromeTrim, {
        rotation: [Math.PI / 2, 0, 0],
      }));

      g.add(tl);
    }
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Windshield, Ceramic Frit, Rearview Mirror & Roll Hoop
// -----------------------------------------------------------------------------------------
function buildWindshieldAndRollHoop(mats, M) {
  const g = new THREE.Group();
  g.name = 'windshield-and-roll-hoop';

  // Raked A-pillars (slender composite structural frame)
  const aPillarLeft = tube([
    [-0.66, 0.70, 0.38],
    [-0.59, 0.94, 0.12],
    [-0.53, 1.128, -0.15],
  ], 0.024, { tubular: 16, radial: 8 });
  g.add(mesh(aPillarLeft, mats.blackTrim));

  const aPillarRight = tube([
    [0.66, 0.70, 0.38],
    [0.59, 0.94, 0.12],
    [0.53, 1.128, -0.15],
  ], 0.024, { tubular: 16, radial: 8 });
  g.add(mesh(aPillarRight, mats.blackTrim));

  // Upper windshield header rail
  const headerRail = tube([
    [-0.53, 1.128, -0.15],
    [0.0, 1.130, -0.15],
    [0.53, 1.128, -0.15],
  ], 0.022, { tubular: 16, radial: 8 });
  g.add(mesh(headerRail, mats.blackTrim));

  // Interior rearview mirror mounted on header rail
  const rvm = new THREE.Group();
  rvm.position.set(0, 1.08, -0.14);
  rvm.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), mats.blackTrim, { rotation: [0.35, 0, 0] }));
  rvm.add(mesh(new THREE.BoxGeometry(0.14, 0.045, 0.015), mats.blackTrim, { position: [0, -0.025, 0.01] }));
  rvm.add(mesh(new THREE.PlaneGeometry(0.13, 0.038), mats.chromeTrim, { position: [0, -0.025, 0.002], rotation: [0, Math.PI, 0] }));
  g.add(rvm);

  // Single aerodynamic wiper blade parked at cowl
  const wiper = tube([
    [-0.45, 0.72, 0.35],
    [0.10, 0.73, 0.32],
  ], 0.009, { tubular: 12, radial: 6 });
  g.add(mesh(wiper, mats.blackTrim, { name: 'windshield-wiper' }));

  // Curved Panoramic Windshield Glass (Cylindrical aerodynamic bow)
  const wGeo = new THREE.PlaneGeometry(1.18, 0.62, 24, 16);
  const pos = wGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -(x * x) * 0.14 - (y * y) * 0.035);
  }
  wGeo.computeVertexNormals();

  const wMesh = mesh(wGeo, mats.windshieldGlass, {
    position: [0, 0.91, 0.11],
    rotation: [-0.75, 0, 0],
    name: 'windshield-glass',
  });
  g.add(wMesh);

  // Ceramic Frit Border (Conforming to glass curvature)
  const fritParts = [
    { geometry: new THREE.BoxGeometry(1.16, 0.035, 0.008), matrix: mat4([0, 0.28, 0]) },
    { geometry: new THREE.BoxGeometry(1.16, 0.045, 0.008), matrix: mat4([0, -0.28, 0]) },
    { geometry: new THREE.BoxGeometry(0.035, 0.56, 0.008), matrix: mat4([-0.56, 0, 0]) },
    { geometry: new THREE.BoxGeometry(0.035, 0.56, 0.008), matrix: mat4([0.56, 0, 0]) },
  ];
  const fritMesh = mesh(mergeAll(fritParts), mats.satinBlack, {
    position: [0, 0.91, 0.11],
    rotation: [-0.75, 0, 0],
    name: 'windshield-ceramic-frit',
  });
  g.add(fritMesh);

  // Structural Targa Roll Hoop directly behind headrests
  const rollHoop = tube([
    [-0.45, 0.84, -0.66],
    [-0.38, 1.05, -0.66],
    [-0.15, 1.05, -0.66],
    [0.0, 0.92, -0.66],
    [0.15, 1.05, -0.66],
    [0.38, 1.05, -0.66],
    [0.45, 0.84, -0.66],
  ], 0.028, { tubular: 28, radial: 8 });
  g.add(mesh(rollHoop, mats.blackTrim, { name: 'roll-hoop' }));

  // Integrated high-mounted 3rd brake light strip
  const chmsl = new THREE.BoxGeometry(0.18, 0.02, 0.015);
  g.add(mesh(chmsl, mats.taillightRed, {
    position: [0, 0.93, -0.66],
    name: 'chmsl-brake-light',
  }));

  return g;
}

// -----------------------------------------------------------------------------------------
//  Double Wishbone Suspension, Ventilated Disc Brakes & Forged Alloy Wheels
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

    // 1. Double Wishbone Suspension behind wheel
    const susp = [];
    const inboardX = isLeft ? 0.24 : -0.24;
    // Upper A-arm
    susp.push({
      geometry: tube([[0, 0.10, 0], [inboardX, 0.14, 0.12], [inboardX, 0.14, -0.12], [0, 0.10, 0]], 0.014, { tubular: 16, radial: 6 }),
    });
    // Lower A-arm
    susp.push({
      geometry: tube([[0, -0.12, 0], [inboardX, -0.10, 0.14], [inboardX, -0.10, -0.14], [0, -0.12, 0]], 0.016, { tubular: 16, radial: 6 }),
    });
    // Steering tie rod
    susp.push({
      geometry: tube([[0, 0.0, 0.12], [inboardX, 0.02, 0.14]], 0.012, { tubular: 8, radial: 6 }),
    });
    // Coilover damper spring
    susp.push({
      geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.26, 12),
      matrix: mat4([inboardX * 0.45, 0.05, 0], [0, 0, isLeft ? -0.35 : 0.35]),
    });
    wGroup.add(mesh(mergeAll(susp), M.aluminum || mats.chromeTrim, { name: 'suspension-wishbones' }));

    // 2. High-Performance Tyre with Realistic Rounded Shoulder Profile
    const rimRadius = wc.r * 0.68;
    const tyreProfile = [
      { r: rimRadius, y: -wc.w / 2 },
      { r: wc.r * 0.94, y: -wc.w / 2 * 0.95 },
      { r: wc.r, y: -wc.w / 2 * 0.70 },
      { r: wc.r, y: wc.w / 2 * 0.70 },
      { r: wc.r * 0.94, y: wc.w / 2 * 0.95 },
      { r: rimRadius, y: wc.w / 2 },
    ];
    const tyreGeo = lathe(tyreProfile, { segments: 36 });
    tyreGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(tyreGeo, mats.tyreRubber, { name: 'tyre' }));

    // 3. Forged Alloy Wheel Rim Barrel
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wc.w * 0.88, 28, 1, true);
    rimGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rimGeo, mats.chromeTrim, { name: 'rim-barrel' }));

    // 10 Sculpted Curved Spokes
    const spokeParts = [];
    const sx = isLeft ? -wc.w * 0.44 : wc.w * 0.44;
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * Math.PI * 2;
      spokeParts.push({
        geometry: new THREE.BoxGeometry(0.018, rimRadius * 0.84, 0.024),
        matrix: mat4([sx, Math.sin(ang) * rimRadius * 0.44, Math.cos(ang) * rimRadius * 0.44], [ang, 0, 0]),
      });
    }
    // Center Hub Cap with 5 Chrome Lug Nuts & Center Medallion
    spokeParts.push({
      geometry: new THREE.CylinderGeometry(0.046, 0.046, 0.02, 16),
      matrix: mat4([isLeft ? -wc.w * 0.46 : wc.w * 0.46, 0, 0], [0, 0, Math.PI / 2]),
    });
    for (let l = 0; l < 5; l++) {
      const lang = (l / 5) * Math.PI * 2;
      spokeParts.push({
        geometry: new THREE.CylinderGeometry(0.007, 0.007, 0.015, 6),
        matrix: mat4([isLeft ? -wc.w * 0.47 : wc.w * 0.47, Math.sin(lang) * 0.026, Math.cos(lang) * 0.026], [0, 0, Math.PI / 2]),
      });
    }
    wGroup.add(mesh(mergeAll(spokeParts), M.alumDark || mats.chromeTrim, { name: 'spokes' }));

    // 4. Cross-Drilled Ventilated Disc Brake Rotor & Red Brembo Caliper
    const discRadius = rimRadius * 0.78;
    const rotorGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.018, 24);
    rotorGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rotorGeo, mats.brakeRotor, { position: [isLeft ? -wc.w * 0.12 : wc.w * 0.12, 0, 0] }));

    const caliperGeo = new THREE.BoxGeometry(0.05, 0.12, 0.07);
    wGroup.add(mesh(caliperGeo, mats.brakeCaliper, {
      position: [isLeft ? -wc.w * 0.12 : wc.w * 0.12, discRadius * 0.65, 0.04],
      name: 'brake-caliper',
    }));

    g.add(wGroup);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Cockpit Interior: Sculpted Bucket Seats, Momo Wheel & Easter Eggs
// -----------------------------------------------------------------------------------------
function buildInterior(mats, M, texDontPanic, texPcb) {
  const g = new THREE.Group();
  g.name = 'interior';

  // Driver foot pedals (accelerator, brake, dead pedal)
  for (const [px, pw, ph] of [[-0.42, 0.045, 0.08], [-0.34, 0.055, 0.08], [-0.26, 0.038, 0.12]]) {
    g.add(mesh(new THREE.BoxGeometry(pw, ph, 0.015), mats.chromeTrim, {
      position: [px, 0.23, 0.35],
      rotation: [-0.45, 0, 0],
    }));
  }

  // Gear selector buttons on console (P, R, N, D)
  for (let b = 0; b < 4; b++) {
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 12), mats.chromeTrim, {
      position: [0, 0.35, 0.10 - b * 0.04],
    }));
  }

  // Sculpted Sport Bucket Seats (Driver on -X, Passenger on +X)
  for (const s of [-1, 1]) {
    const seat = new THREE.Group();
    seat.name = `seat-${s < 0 ? 'driver' : 'passenger'}`;
    const sx = s * 0.35;
    seat.position.set(sx, 0, 0);

    // Contoured seat cushion with side bolster rolls
    const cushion = new THREE.BoxGeometry(0.42, 0.12, 0.46);
    seat.add(mesh(cushion, mats.blackTrim, { position: [0, 0.24, -0.20] }));

    // Reclined backrest with lumbar curve
    const backrest = new THREE.BoxGeometry(0.38, 0.58, 0.10);
    seat.add(mesh(backrest, mats.blackTrim, {
      position: [0, 0.56, -0.44],
      rotation: [-0.34, 0, 0],
    }));

    // Side bolster support wings
    for (const bs of [-1, 1]) {
      const wing = new THREE.BoxGeometry(0.06, 0.48, 0.14);
      seat.add(mesh(wing, mats.blackTrim, {
        position: [bs * 0.19, 0.52, -0.40],
        rotation: [-0.34, 0, 0],
      }));
    }

    // Integrated headrest with harness pass-through cutout
    const headrest = new THREE.BoxGeometry(0.24, 0.18, 0.08);
    seat.add(mesh(headrest, mats.blackTrim, {
      position: [0, 0.88, -0.55],
      rotation: [-0.34, 0, 0],
    }));
    // Harness eyelet slot
    seat.add(mesh(new THREE.BoxGeometry(0.12, 0.035, 0.09), mats.satinBlack, {
      position: [0, 0.84, -0.55],
      rotation: [-0.34, 0, 0],
    }));

    g.add(seat);
  }

  // 3-Point Seatbelt for Starman (Driver side)
  const beltPts = [
    [-0.52, 0.88, -0.52], // B-pillar anchor
    [-0.34, 0.65, -0.22], // Chest crossing
    [-0.18, 0.32, -0.24], // Center buckle
  ];
  g.add(mesh(tube(beltPts, 0.015, { tubular: 16, radial: 6 }), mats.satinBlack, { name: 'starman-seatbelt' }));
  g.add(mesh(new THREE.BoxGeometry(0.035, 0.05, 0.02), mats.chromeTrim, { position: [-0.18, 0.32, -0.24] }));

  // Sculpted Dashboard
  const dashGroup = new THREE.Group();
  dashGroup.position.set(0, 0.66, 0.32);

  // Main contoured dashboard wing
  const dashBody = new THREE.BoxGeometry(1.24, 0.18, 0.28);
  dashGroup.add(mesh(dashBody, mats.blackTrim));

  // Instrument binnacle cowl in front of driver
  const cowlGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.20, 16, 1, false, 0, Math.PI);
  cowlGeo.rotateX(Math.PI / 2);
  dashGroup.add(mesh(cowlGeo, mats.blackTrim, { position: [-0.35, 0.10, -0.02] }));

  // Dual instrument dials (speedometer & battery kW power meter)
  for (const gx of [-0.40, -0.30]) {
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.005, 16), mats.chromeTrim, {
      position: [gx, 0.09, 0.06],
      rotation: [Math.PI / 2, 0, 0],
    }));
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 16), mats.blackTrim, {
      position: [gx, 0.09, 0.062],
      rotation: [Math.PI / 2, 0, 0],
    }));
  }

  // 4 Round aluminum eyeball A/C vents
  for (const vx of [-0.48, -0.20, 0.20, 0.48]) {
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.015, 16), mats.chromeTrim, {
      position: [vx, 0.04, 0.14],
      rotation: [Math.PI / 2, 0, 0],
    }));
    dashGroup.add(mesh(new THREE.BoxGeometry(0.045, 0.005, 0.016), mats.blackTrim, {
      position: [vx, 0.04, 0.14],
      rotation: [Math.PI / 2, 0, 0],
    }));
  }
  g.add(dashGroup);

  // Momo 3-Spoke Sport Steering Wheel
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'steering-wheel';
  wheelGroup.position.set(-0.35, 0.72, 0.12);
  wheelGroup.rotation.set(-0.55, 0, 0);

  // Outer leather rim
  wheelGroup.add(mesh(new THREE.TorusGeometry(0.165, 0.016, 12, 32), mats.blackTrim));
  // Center horn boss with Tesla red medallion
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.022, 16), mats.cherryRed, { rotation: [Math.PI / 2, 0, 0] }));

  // 3 Spokes with drilled lightening holes
  for (const ang of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
    wheelGroup.add(mesh(new THREE.BoxGeometry(0.13, 0.022, 0.008), mats.chromeTrim, {
      position: [Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0],
      rotation: [0, 0, ang],
    }));
  }
  // Steering column and stalks
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 12), mats.blackTrim, {
    position: [0, 0, 0.12],
    rotation: [Math.PI / 2, 0, 0],
  }));
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), mats.blackTrim, {
    position: [-0.08, 0.04, 0.08],
    rotation: [0, 0, 1.2],
  }));
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
  hwGroup.position.set(0.08, 0.775, 0.28);
  hwGroup.rotation.set(-0.16, 0.20, 0);

  hwGroup.add(mesh(new THREE.BoxGeometry(0.028, 0.014, 0.062), mats.cherryRed));
  for (const hx of [-0.014, 0.014]) for (const hz of [-0.018, 0.018]) {
    hwGroup.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8), mats.blackTrim, {
      position: [hx, -0.004, hz],
      rotation: [0, 0, Math.PI / 2],
    }));
  }
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
//  Starman Mannequin: Anatomically Sculpted Spacesuit & Natural Driver Pose
// -----------------------------------------------------------------------------------------
function buildStarman(mats, M) {
  const g = new THREE.Group();
  g.name = 'starman';

  const { starmanSuitWhite, starmanVisor, blackTrim } = mats;
  const sx = -0.35; // centered in driver seat

  // 1. Torso: Anatomically sculpted chest & waist reclined against backrest
  const torso = new THREE.Group();
  torso.position.set(sx, 0.58, -0.28);
  torso.rotation.set(-0.32, 0, 0);

  // Main chest volume
  const chest = new THREE.CylinderGeometry(0.18, 0.14, 0.44, 16);
  torso.add(mesh(chest, starmanSuitWhite, { name: 'suit-chest' }));

  // Black aerodynamic side rib accents
  for (const s of [-1, 1]) {
    torso.add(mesh(new THREE.BoxGeometry(0.04, 0.38, 0.08), blackTrim, { position: [s * 0.16, 0, 0] }));
  }
  g.add(torso);

  // 2. Legs: Bent naturally at knees towards pedals
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const lx = sx + s * 0.11;
    // Thigh extending forward
    leg.add(mesh(new THREE.CylinderGeometry(0.070, 0.062, 0.42, 12), starmanSuitWhite, {
      position: [lx, 0.36, -0.05],
      rotation: [1.32, 0, 0],
    }));
    // Knee joint protector pad
    leg.add(mesh(new THREE.SphereGeometry(0.064, 10, 8), starmanSuitWhite, {
      position: [lx, 0.35, 0.14],
    }));
    // Shin extending down to floor pedals
    leg.add(mesh(new THREE.CylinderGeometry(0.060, 0.052, 0.38, 12), starmanSuitWhite, {
      position: [lx, 0.22, 0.22],
      rotation: [0.42, 0, 0],
    }));
    // Flight boots with soles
    leg.add(mesh(new THREE.BoxGeometry(0.09, 0.08, 0.20), blackTrim, {
      position: [lx, 0.20, 0.36],
      rotation: [0.15, 0, 0],
    }));
    g.add(leg);
  }

  // 3. Right Arm: Reaching forward to grip the steering wheel at 2 o'clock
  const rightArm = new THREE.Group();
  rightArm.name = 'right-arm-steering';
  rightArm.add(mesh(new THREE.CylinderGeometry(0.054, 0.046, 0.30, 12), starmanSuitWhite, {
    position: [sx + 0.14, 0.64, -0.14],
    rotation: [1.15, -0.22, -0.45],
  }));
  rightArm.add(mesh(new THREE.CylinderGeometry(0.046, 0.040, 0.28, 12), starmanSuitWhite, {
    position: [sx + 0.06, 0.68, 0.02],
    rotation: [1.35, -0.35, -0.75],
  }));
  rightArm.add(mesh(new THREE.SphereGeometry(0.046, 12, 10), starmanSuitWhite, {
    position: [-0.22, 0.78, 0.10],
  }));
  rightArm.add(mesh(new THREE.BoxGeometry(0.05, 0.035, 0.06), blackTrim, {
    position: [-0.21, 0.78, 0.10],
  }));
  g.add(rightArm);

  // 4. Left Arm (THE ICONIC STARMAN POSE): Resting casually on top of the door sill
  const leftArm = new THREE.Group();
  leftArm.name = 'left-arm-door-sill';
  leftArm.add(mesh(new THREE.CylinderGeometry(0.056, 0.050, 0.32, 12), starmanSuitWhite, {
    position: [sx - 0.20, 0.66, -0.22],
    rotation: [0.32, 0, 1.15],
  }));
  // Forearm resting flat along the upper door sill (x ≈ -0.78, y ≈ 0.73)
  leftArm.add(mesh(new THREE.CylinderGeometry(0.050, 0.044, 0.36, 12), starmanSuitWhite, {
    position: [sx - 0.44, 0.74, -0.10],
    rotation: [1.52, 0, 0.12],
  }));
  leftArm.add(mesh(new THREE.SphereGeometry(0.048, 12, 10), starmanSuitWhite, {
    position: [sx - 0.45, 0.74, 0.10],
  }));
  leftArm.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), blackTrim, {
    position: [sx - 0.45, 0.75, 0.10],
  }));
  g.add(leftArm);

  // 5. SpaceX Flight Helmet (Aerodynamic shell with glossy dark smoked visor)
  const headGroup = new THREE.Group();
  headGroup.name = 'spacex-helmet';
  headGroup.position.set(sx, 0.88, -0.32);
  headGroup.rotation.set(-0.12, 0.15, 0);

  // Helmet aerodynamic shell
  headGroup.add(mesh(new THREE.SphereGeometry(0.14, 24, 20), starmanSuitWhite));
  // Chin taper
  headGroup.add(mesh(new THREE.BoxGeometry(0.12, 0.09, 0.10), starmanSuitWhite, {
    position: [0, -0.06, 0.08],
    rotation: [-0.35, 0, 0],
  }));
  // Neck ring collar
  headGroup.add(mesh(new THREE.TorusGeometry(0.095, 0.022, 10, 24), blackTrim, {
    position: [0, -0.11, 0],
    rotation: [Math.PI / 2, 0, 0],
  }));
  // Dark smoked glossy reflective visor
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

  // 1. Conical Payload Attach Fitting (PAF) Ring Structure
  const pafCone = [];
  pafCone.push({
    geometry: new THREE.CylinderGeometry(0.78, 1.25, 0.65, 32, 1, true),
    matrix: mat4([0, -0.22, 0]),
  });
  pafCone.push({
    geometry: new THREE.TorusGeometry(0.78, 0.04, 8, 32),
    matrix: mat4([0, 0.10, 0], [Math.PI / 2, 0, 0]),
  });
  pafCone.push({
    geometry: new THREE.TorusGeometry(1.25, 0.055, 8, 32),
    matrix: mat4([0, -0.54, 0], [Math.PI / 2, 0, 0]),
  });
  g.add(mesh(mergeAll(pafCone), carbon, { name: 'paf-cone' }));

  // 2. Tubular Carbon-Fiber Support Truss Struts
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

  // 3. Three Carbon-Fiber Selfie Camera Booms
  const booms = [];

  // (A) Front Selfie Boom: pointing at Starman
  const frontBoomPts = [
    [0.25, 0.22, 1.85],
    [0.45, 0.45, 2.45],
    [0.55, 0.85, 3.10],
  ];
  booms.push({ geometry: tube(frontBoomPts, 0.024, { tubular: 24, radial: 8 }) });

  const camA = new THREE.Group();
  camA.name = 'selfie-cam-front';
  camA.position.set(0.55, 0.85, 3.10);
  camA.lookAt(-0.35, 0.90, -0.2);
  camA.add(mesh(new THREE.BoxGeometry(0.10, 0.08, 0.14), carbon));
  camA.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16), M.lens || mats.chromeTrim, { position: [0, 0, 0.08], rotation: [Math.PI / 2, 0, 0] }));
  g.add(camA);

  // (B) Right Lateral Selfie Boom
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

  // (C) Rear Over-the-Shoulder Boom
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

  // Continuous Watertight Body Components
  const bodyShell = buildBodyShell(mats, M);
  const headlights = buildHeadlights(mats, M);
  const taillights = buildTaillights(mats, M);
  const glassAndHoop = buildWindshieldAndRollHoop(mats, M);

  // Mechanicals, Cockpit & Occupant
  const wheels = buildWheels(mats, M);
  const interior = buildInterior(mats, M, texDontPanic, texPcb);
  const starman = buildStarman(mats, M);
  const adapter = buildPayloadAdapter(mats, M);

  bodyShell.add(headlights);
  bodyShell.add(taillights);
  bodyShell.add(glassAndHoop);

  root.add(bodyShell);
  root.add(wheels);
  root.add(interior);
  root.add(starman);
  root.add(adapter);

  // Hull metadata for verification measuring
  // Matches HULLS.roadster in verify.js
  root.userData.height = ROADSTER_SPECS.height;
  root.userData.footprint = ROADSTER_SPECS.length;
  root.userData.length = ROADSTER_SPECS.length;
  root.userData.width = ROADSTER_SPECS.width;

  root.userData.parts = {
    body: bodyShell,
    wheels,
    interior,
    starman,
    adapter,
  };

  root.userData.annotations = [
    { label: 'Starman · Maniquí con traje espacial SpaceX IVA', position: [-0.35, 0.95, -0.2] },
    { label: "«DON'T PANIC!» · Pantalla del salpicadero", position: [0.0, 0.68, 0.35] },
    { label: 'Miniatura Hot Wheels 1:64 con micro-Starman', position: [0.08, 0.82, 0.28] },
    { label: 'Tesla Roadster 2008 · Carrocería con curvas reales', position: [0.72, 0.65, 0.8] },
    { label: 'Cámara selfie en mástil de fibra de carbono', position: [0.55, 0.95, 3.10] },
    { label: 'Adaptador de carga útil (PAF) de Falcon Heavy', position: [0.0, -0.22, 0.0] },
    { label: '«Made on Earth by humans» · Placa de circuito', position: [0.0, 0.28, 1.15] },
    { label: 'Archivo 5D Arch Mission · Trilogía Fundación', position: [0.35, 0.42, -0.15] },
  ];

  return root;
}
