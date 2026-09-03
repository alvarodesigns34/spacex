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
 *  - Finish: Midnight Cherry Red metallic car paint with deep clearcoat gloss.
 *  - Configuration: Open cockpit (hardtop roof removed for flight).
 *  - Passenger: Starman mannequin in authentic SpaceX IVA flight spacesuit.
 *    Pose: Left arm resting comfortably on the door sill, right hand on the Momo steering wheel.
 *  - Documented Easter Eggs:
 *      1. Center touchscreen displaying "DON'T PANIC!" (Hitchhiker's Guide to the Galaxy).
 *      2. 1:64 scale Hot Wheels miniature Roadster with micro-Starman on the dashboard pad.
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
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, mergeAll, mat4, tube, lathe } from '../geometry/utils.js';

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
//  Parametric Surface Generator with Analytic Normal & Metric UV Generation
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
//  Continuous Master Profile Functions for the Vehicle Hull
// -----------------------------------------------------------------------------------------
function getBodyHalfWidth(z) {
  if (z >= 1.70) {
    const t = (z - 1.70) / (1.975 - 1.70);
    return 0.74 * Math.sqrt(Math.max(0.01, 1.0 - t * t));
  } else if (z >= 1.176) {
    const t = (z - 1.176) / (1.70 - 1.176);
    return 0.780 * (1.0 - t) + 0.740 * t;
  } else if (z >= 0.40) {
    const t = (z - 0.40) / (1.176 - 0.40);
    return 0.755 * (1.0 - t) + 0.780 * t;
  } else if (z >= -0.66) {
    const t = (z - -0.66) / (0.40 - -0.66);
    const waist = 0.025 * Math.sin(t * Math.PI);
    return (0.790 * (1.0 - t) + 0.755 * t) - waist;
  } else if (z >= -1.176) {
    const t = (z - -1.176) / (-0.66 - -1.176);
    return 0.864 * (1.0 - t) + 0.790 * t; // max half-width 0.864 m -> 1.728 m width
  } else if (z >= -1.75) {
    const t = (z - -1.75) / (-1.176 - -1.75);
    return 0.770 * (1.0 - t) + 0.864 * t;
  } else {
    const t = (z - -1.975) / (-1.75 - -1.975);
    return 0.680 * (1.0 - t) + 0.770 * t;
  }
}

function getYCenter(z) {
  if (z >= 1.82) {
    const t = (z - 1.82) / (1.975 - 1.82);
    return 0.46 * (1.0 - t) + 0.32 * t; // Curves smoothly down to low nose tip
  } else if (z >= 1.176) {
    const t = (z - 1.176) / (1.82 - 1.176);
    return 0.585 * (1.0 - t) + 0.46 * t;
  } else if (z >= 0.40) {
    const t = (z - 0.40) / (1.176 - 0.40);
    return 0.665 * (1.0 - t) + 0.585 * t;
  } else if (z >= -0.66) {
    const t = (z - -0.66) / (0.40 - -0.66);
    return 0.745 * (1.0 - t) + 0.665 * t;
  } else if (z >= -1.65) {
    const t = (z - -1.65) / (-0.66 - -1.65);
    return 0.785 * (1.0 - t) + 0.745 * t;
  } else if (z >= -1.92) {
    const t = (z - -1.92) / (-1.65 - -1.92);
    return 0.835 * (1.0 - t) + 0.785 * t; // Ducktail crest
  } else {
    const t = (z - -1.975) / (-1.92 - -1.975);
    return 0.28 * (1.0 - t) + 0.835 * t; // Drops down rear Kamm fascia
  }
}

function getYCrown(z) {
  if (z >= 1.82) {
    const t = (z - 1.82) / (1.975 - 1.82);
    return 0.48 * (1.0 - t) + 0.34 * t;
  }
  if (z <= -1.92) {
    const t = (z - -1.975) / (-1.92 - -1.975);
    return 0.30 * (1.0 - t) + 0.835 * t;
  }
  const dzF = Math.abs(z - 1.176);
  const fenderHump = 0.115 * Math.exp(-Math.pow(dzF / 0.38, 2));
  const dzR = Math.abs(z - -1.176);
  const haunchHump = 0.085 * Math.exp(-Math.pow(dzR / 0.42, 2));
  return getYCenter(z) + fenderHump + haunchHump + 0.015;
}

/**
 * Perfectly continuous wheel arch profile avoiding any vertex step jumps!
 */
function getWheelArchY(z) {
  const yRocker = 0.14; // baseline rocker panel height

  // Front wheel arch cutout: center z = 1.176, wheel radius 0.30 m
  const dzF = Math.abs(z - 1.176);
  const rHorizF = 0.36; // arch horizontal radius
  const peakF = 0.635; // top of front wheel arch opening
  if (dzF < rHorizF) {
    const t = dzF / rHorizF;
    const archCurve = Math.sqrt(Math.max(0, 1.0 - t * t));
    return yRocker + (peakF - yRocker) * archCurve;
  }

  // Rear wheel arch cutout: center z = -1.176, wheel radius 0.317 m
  const dzR = Math.abs(z - -1.176);
  const rHorizR = 0.38; // arch horizontal radius
  const peakR = 0.665; // top of rear wheel arch opening
  if (dzR < rHorizR) {
    const t = dzR / rHorizR;
    const archCurve = Math.sqrt(Math.max(0, 1.0 - t * t));
    return yRocker + (peakR - yRocker) * archCurve;
  }

  // Front chin taper
  if (z > 1.70) {
    const t = (z - 1.70) / (1.975 - 1.70);
    return yRocker + 0.08 * t;
  }

  // Rear diffuser rise
  if (z < -1.75) {
    const t = (-1.75 - z) / (-1.75 - -1.975);
    return yRocker + 0.12 * t;
  }

  return yRocker;
}

/**
 * Master continuous surface evaluator across the vehicle body width.
 * s ranges from -1 (left lower rocker/arch) to +1 (right lower rocker/arch).
 */
function evalBodyPoint(z, s) {
  const absS = Math.abs(s);
  const sign = s < 0 ? -1 : 1;
  const W = getBodyHalfWidth(z);
  const yCen = getYCenter(z);
  const yCrn = getYCrown(z);
  const yRoc = getWheelArchY(z);
  const sCrest = 0.55;

  let x, y;
  if (absS <= sCrest) {
    const t = absS / sCrest;
    x = sign * (t * W * 0.88);
    // Smooth C2 quintic polynomial blend
    const blend = t * t * t * (t * (t * 6 - 15) + 10);
    y = yCen + (yCrn - yCen) * blend;

    // 1. Dual recessed hood extractor scoops molded directly into the hood surface
    if (z > 1.04 && z < 1.38) {
      const fz = 1.0 - Math.pow((z - 1.21) / 0.17, 2);
      if (fz > 0) {
        // Centered at s = ±0.28 (x ≈ ±0.22 m)
        const ds = Math.abs(absS - 0.28);
        if (ds < 0.12) {
          const fs = 1.0 - Math.pow(ds / 0.12, 2);
          const depression = 0.026 * fz * fz * fs * fs;
          y -= depression;
        }
      }
    }

    // 2. Smooth aerodynamic twin humps behind headrests on rear deck
    if (z > -1.35 && z < -0.68) {
      const fz = 1.0 - Math.pow((z - -0.96) / 0.32, 2);
      if (fz > 0) {
        const fx = Math.exp(-Math.pow((absS - 0.28) / 0.10, 2));
        y += 0.040 * fz * fz * fx;
      }
    }
  } else {
    const t = (absS - sCrest) / (1.0 - sCrest);
    const swell = Math.sin(t * Math.PI) * 0.08 * W;
    x = sign * (W * 0.88 + (W - W * 0.88) * t + swell);
    const blend = Math.pow(t, 1.4);
    y = yCrn - (yCrn - yRoc) * blend;
  }

  return { x, y, z };
}

// -----------------------------------------------------------------------------------------
//  Procedural Textures for In-Cockpit Displays & Circuitry
// -----------------------------------------------------------------------------------------
function makeDontPanicTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Deep space obsidian background
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 512, 256);

  // High-tech bezel accent line
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);

  // Top header banner
  ctx.font = '600 15px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('SPACEX  ·  FALCON HEAVY 001  ·  STARMAN', 256, 44);

  // "DON'T PANIC!" headline centered with generous padding (completely unclipped!)
  ctx.font = '900 34px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("DON'T PANIC!", 256, 114);

  // Sub-status telemetry
  ctx.font = '700 15px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('ORBIT: HELIOCENTRIC MARS CROSSING', 256, 166);

  ctx.font = '500 13px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('APHELION: 1.67 AU  ·  PERIHELION: 0.98 AU', 256, 202);

  // Subtle CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
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
  ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
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
  ctx.fillStyle = '#0a0c0f';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1c2027';
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
  tex.repeat.set(6, 4);
  return tex;
}

function makeLicensePlateTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, 256, 128);

  // California red script header
  ctx.fillStyle = '#c8102e';
  ctx.font = 'italic bold 22px "Brush Script MT", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('California', 128, 28);

  // "STARMAN" embossed dark navy blue plate letters
  ctx.fillStyle = '#0f244a';
  ctx.font = '900 44px "Arial Black", Impact, sans-serif';
  ctx.fillText('STARMAN', 128, 82);

  // Registration stickers
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(16, 14, 28, 20);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(212, 14, 28, 20);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// -----------------------------------------------------------------------------------------
//  Material Factory
// -----------------------------------------------------------------------------------------
function createRoadsterMaterials(M) {
  // Midnight Cherry Red: Deep, lustrous ruby metallic with clearcoat gloss
  const cherryRed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x6a0c18),
    metalness: 0.88,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.95,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
  });

  const blackTrim = new THREE.MeshStandardMaterial({
    color: 0x121417,
    metalness: 0.22,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  const satinBlack = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    metalness: 0.35,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });

  const carbonFiber = new THREE.MeshStandardMaterial({
    color: 0x141618,
    roughness: 0.36,
    metalness: 0.45,
  });

  const chromeTrim = new THREE.MeshStandardMaterial({
    color: 0xf4f6fa,
    metalness: 0.98,
    roughness: 0.08,
    envMapIntensity: 2.2,
  });

  const tyreRubber = new THREE.MeshStandardMaterial({
    color: 0x151619,
    metalness: 0.05,
    roughness: 0.90,
  });

  const brakeRotor = new THREE.MeshStandardMaterial({
    color: 0x92969c,
    metalness: 0.92,
    roughness: 0.26,
  });

  const brakeCaliper = new THREE.MeshStandardMaterial({
    color: 0xcc0e1d,
    metalness: 0.42,
    roughness: 0.20,
  });

  const amberReflector = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.25,
    roughness: 0.20,
    emissive: 0x4a2a00,
  });

  const windshieldGlass = new THREE.MeshPhysicalMaterial({
    color: 0xd4e6f4,
    transparent: true,
    opacity: 0.32,
    roughness: 0.02,
    metalness: 0.08,
    transmission: 0.88,
    ior: 1.52,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xf8faff,
    transparent: true,
    opacity: 0.50,
    roughness: 0.02,
    metalness: 0.10,
    transmission: 0.90,
    ior: 1.50,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const taillightRed = new THREE.MeshStandardMaterial({
    color: 0xe00814,
    emissive: 0x660408,
    roughness: 0.18,
    metalness: 0.30,
  });

  const starmanSuitWhite = new THREE.MeshStandardMaterial({
    color: 0xf6f7fb,
    roughness: 0.42,
    metalness: 0.10,
    side: THREE.DoubleSide,
  });

  const starmanSuitGraphite = new THREE.MeshStandardMaterial({
    color: 0x1c1e23,
    roughness: 0.52,
    metalness: 0.25,
  });

  const starmanVisor = new THREE.MeshPhysicalMaterial({
    color: 0x050608,
    metalness: 0.98,
    roughness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 3.2,
    side: THREE.DoubleSide,
  });

  const quartzDisc = new THREE.MeshPhysicalMaterial({
    color: 0xe8f4fc,
    transparent: true,
    opacity: 0.88,
    roughness: 0.02,
    metalness: 0.18,
    transmission: 0.92,
    ior: 1.46,
    depthWrite: false,
  });

  const grilleMesh = new THREE.MeshStandardMaterial({
    map: makeGrilleTexture(),
    color: 0x121418,
    roughness: 0.85,
    metalness: 0.20,
    side: THREE.DoubleSide,
  });

  return {
    cherryRed, blackTrim, satinBlack, carbonFiber, chromeTrim, tyreRubber, brakeRotor, brakeCaliper,
    amberReflector, windshieldGlass, headlightLens, taillightRed, starmanSuitWhite, starmanSuitGraphite,
    starmanVisor, quartzDisc, grilleMesh,
  };
}

// -----------------------------------------------------------------------------------------
//  CAD-Grade Body Shell: Watertight, Zero-Hole Master Surfaces
// -----------------------------------------------------------------------------------------
function buildBodyShell(mats, M) {
  const g = new THREE.Group();
  g.name = 'body-shell';

  const zNose = 1.975;
  const zCowl = 0.40;
  const zBulkhead = -0.66;
  const zRearFascia = -1.975;

  const NvMaster = 41; // index 0..9 (left flank s in [-1, -0.55]), 9..31 (center), 31..40 (right flank s in [0.55, 1])

  // 1. FRONT CLAMSHELL (Nose prow, hood, front fenders, wheel arches, windshield cowl)
  const frontClamGeo = createParametricSurface(46, NvMaster, (u, v) => {
    const z = zCowl + u * (zNose - zCowl);
    const s = (v - 0.5) * 2;
    return evalBodyPoint(z, s);
  });

  // 2. SIDE FLANKS & DOORS (Continuous outer flank skin from s = ±0.55 to s = ±1.0)
  // Evaluates the exact same mathematical grid points as front & rear clamshells for zero-tolerance welding!
  const NdoorCols = 10;
  function createDoorGeometry(side) {
    return createParametricSurface(32, NdoorCols, (u, v) => {
      const z = zCowl + u * (zBulkhead - zCowl);
      const colIdx = Math.round(v * (NdoorCols - 1));
      let s;
      if (side > 0) {
        // Right flank: colIdx 0 -> s = 0.55 (sill rim), colIdx 9 -> s = 1.0 (rocker)
        s = (31 + colIdx) / 20 - 1;
      } else {
        // Left flank: colIdx 0 -> s = -0.55 (sill rim), colIdx 9 -> s = -1.0 (rocker)
        s = (9 - colIdx) / 20 - 1;
      }
      return evalBodyPoint(z, s);
    }, side < 0);
  }

  const leftDoorGeo = createDoorGeometry(-1);
  const rightDoorGeo = createDoorGeometry(1);

  // 3. REAR CLAMSHELL (Muscular haunches, speedster humps, rear decklid, integrated ducktail & Kamm fascia)
  const rearClamGeo = createParametricSurface(46, NvMaster, (u, v) => {
    const z = zBulkhead + u * (zRearFascia - zBulkhead);
    const s = (v - 0.5) * 2;
    return evalBodyPoint(z, s);
  }, true);

  // Merge outer body panels into ONE seamless, welded master mesh
  const rawMasterGeo = mergeAll([
    { geometry: frontClamGeo },
    { geometry: leftDoorGeo },
    { geometry: rightDoorGeo },
    { geometry: rearClamGeo },
  ]);

  // Weld boundary vertices within 6 mm to guarantee a seamless watertight solid
  const weldedBodyPaintGeo = mergeVertices(rawMasterGeo, 0.006);
  weldedBodyPaintGeo.computeVertexNormals();

  g.add(mesh(weldedBodyPaintGeo, mats.cherryRed, { name: 'body-paint' }));

  // 4. WATERTIGHT COCKPIT TUB (Floor, Firewall, Tunnel, Bulkhead, Inner Door Panels)
  const cockpitTubGeo = createParametricSurface(34, 30, (u, v) => {
    const z = zCowl + u * (zBulkhead - zCowl);
    const s = (v - 0.5) * 2;
    const absS = Math.abs(s);
    const x = s * 0.54;

    const yCowlRim = getYCenter(zCowl);
    const yBulkheadRim = getYCenter(zBulkhead);
    const ySillRim = getYCenter(z);

    let y;
    if (u < 0.16) {
      const tf = u / 0.16;
      y = yCowlRim * (1.0 - tf) + 0.16 * tf;
    } else if (u > 0.84) {
      const tb = (u - 0.84) / 0.16;
      y = 0.16 * (1.0 - tb) + yBulkheadRim * tb;
    } else {
      y = 0.16;
      if (absS < 0.22) {
        const tt = 1.0 - Math.pow(absS / 0.22, 2);
        y += 0.12 * tt;
      }
      if (absS > 0.70) {
        const ts = (absS - 0.70) / 0.30;
        y += (ySillRim - 0.16) * Math.pow(ts, 1.4);
      }
    }

    return { x, y, z };
  }, true);

  g.add(mesh(cockpitTubGeo, mats.blackTrim, { name: 'cockpit-tub' }));

  // 5. WATERTIGHT ENCLOSED WHEEL ARCH LINER TUBS & INNER BULKHEADS
  const wheelLinerParts = [];
  // Front liners (z = 1.176, r = 0.36)
  for (const s of [-1, 1]) {
    const xOut = s * 0.78;
    const xIn = s * 0.44;
    const linerCurv = lathe([
      { r: 0.36, y: xOut },
      { r: 0.36, y: xIn },
      { r: 0.0, y: xIn },
    ], { segments: 32, phiStart: 0, phiLength: Math.PI });
    linerCurv.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    linerCurv.rotateY(Math.PI / 2);
    wheelLinerParts.push({
      geometry: linerCurv,
      matrix: mat4([0, 0.30, 1.176]),
    });
    // Vertical front splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.36, 0.48, 0.02),
      matrix: mat4([s * 0.61, 0.35, 1.176 + 0.36]),
    });
    // Vertical rear splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.36, 0.48, 0.02),
      matrix: mat4([s * 0.61, 0.35, 1.176 - 0.36]),
    });
    // Inboard splash shield bulkhead preventing light leaks
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.02, 0.48, 0.88),
      matrix: mat4([s * 0.44, 0.35, 1.176]),
    });
  }
  // Rear liners (z = -1.176, r = 0.38)
  for (const s of [-1, 1]) {
    const xOut = s * 0.86;
    const xIn = s * 0.44;
    const linerCurv = lathe([
      { r: 0.38, y: xOut },
      { r: 0.38, y: xIn },
      { r: 0.0, y: xIn },
    ], { segments: 32, phiStart: 0, phiLength: Math.PI });
    linerCurv.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    linerCurv.rotateY(Math.PI / 2);
    wheelLinerParts.push({
      geometry: linerCurv,
      matrix: mat4([0, 0.317, -1.176]),
    });
    // Vertical front splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.42, 0.50, 0.02),
      matrix: mat4([s * 0.65, 0.36, -1.176 + 0.38]),
    });
    // Vertical rear splash shield
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.42, 0.50, 0.02),
      matrix: mat4([s * 0.65, 0.36, -1.176 - 0.38]),
    });
    // Inboard splash shield bulkhead
    wheelLinerParts.push({
      geometry: new THREE.BoxGeometry(0.02, 0.50, 0.92),
      matrix: mat4([s * 0.44, 0.36, -1.176]),
    });
  }
  g.add(mesh(mergeAll(wheelLinerParts), mats.satinBlack, { name: 'wheel-well-liners' }));

  // 6. UNDERBODY AERO PAN (Full-length flat belly tray from chin to diffuser)
  const bellyPan = new THREE.BoxGeometry(1.48, 0.025, 3.88);
  g.add(mesh(bellyPan, mats.blackTrim, { position: [0, 0.138, 0], name: 'underbody-belly-pan' }));

  // Longitudinal battery cooling strakes along the underbody tray
  for (let i = -0.48; i <= 0.48; i += 0.24) {
    g.add(mesh(new THREE.BoxGeometry(0.015, 0.025, 2.20), mats.satinBlack, {
      position: [i, 0.125, 0.0],
      name: 'battery-cooling-strake',
    }));
  }

  // Aluminum chassis subframe crossmembers (front and rear)
  g.add(mesh(new THREE.BoxGeometry(1.30, 0.04, 0.12), M.aluminum || mats.chromeTrim, {
    position: [0, 0.135, 1.176],
    name: 'front-subframe-crossmember',
  }));
  g.add(mesh(new THREE.BoxGeometry(1.30, 0.04, 0.12), M.aluminum || mats.chromeTrim, {
    position: [0, 0.135, -1.176],
    name: 'rear-subframe-crossmember',
  }));

  // Front chin aerodynamic racing splitter with tie-rod struts
  const splitterPts = [
    [-0.72, 0.15, 1.70],
    [-0.50, 0.15, 1.94],
    [0.0, 0.15, 1.97],
    [0.50, 0.15, 1.94],
    [0.72, 0.15, 1.70],
  ];
  g.add(mesh(tube(splitterPts, 0.024, { tubular: 24, radial: 8 }), mats.blackTrim, { name: 'front-splitter' }));
  for (const sx of [-0.28, 0.28]) {
    g.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8), mats.chromeTrim, {
      position: [sx, 0.21, 1.92],
      rotation: [0.35, 0, 0],
    }));
  }

  // Front lower radiator intake mouth & aluminum cooling matrix
  const grilleMouth = new THREE.BoxGeometry(0.78, 0.15, 0.12);
  g.add(mesh(grilleMouth, mats.grilleMesh, {
    position: [0, 0.24, 1.85],
    name: 'front-grille-mouth',
  }));
  const radiatorCore = new THREE.BoxGeometry(0.72, 0.13, 0.02);
  g.add(mesh(radiatorCore, M.aluminum || mats.chromeTrim, {
    position: [0, 0.24, 1.79],
    name: 'radiator-cooling-core',
  }));

  // ---------------------------------------------------------------------------------------
  //  DUAL RECESSED HOOD EXTRACTOR SCOOPS (Fine dark mesh flush in molded depression)
  // ---------------------------------------------------------------------------------------
  for (const s of [-1, 1]) {
    const ventGroup = new THREE.Group();
    ventGroup.name = `hood-extractor-vent-${s < 0 ? 'left' : 'right'}`;
    // Sits flush inside the recessed depression formed by evalBodyPoint
    const hoodY = getYCenter(1.21) - 0.016;
    ventGroup.position.set(s * 0.22, hoodY, 1.21);
    ventGroup.rotation.set(-0.16, s * 0.04, s * 0.02);

    // Honeycomb mesh grille lining the bottom of the recessed scoop
    const meshPlate = new THREE.PlaneGeometry(0.09, 0.18);
    meshPlate.rotateX(-Math.PI / 2 + 0.14);
    ventGroup.add(mesh(meshPlate, mats.grilleMesh, { position: [0, 0.001, 0] }));

    // Thin, flush composite bezel rim framing the scoop aperture
    const rimPts = [
      [-0.048, 0.004, -0.090],
      [-0.044, 0.004, 0.075],
      [-0.024, 0.004, 0.095],
      [0.0, 0.004, 0.100],
      [0.024, 0.004, 0.095],
      [0.044, 0.004, 0.075],
      [0.048, 0.004, -0.090],
      [0.0, 0.004, -0.095],
      [-0.048, 0.004, -0.090],
    ];
    ventGroup.add(mesh(tube(rimPts, 0.0022, { tubular: 24, radial: 6 }), mats.blackTrim));

    g.add(ventGroup);
  }

  // Chrome Tesla nose crest medallion
  const emblem = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16);
  g.add(mesh(emblem, mats.chromeTrim, {
    position: [0, 0.38, 1.92],
    rotation: [0.65, 0, 0],
    name: 'tesla-nose-emblem',
  }));

  // Rear aerodynamic racing diffuser with 4 vertical strakes
  const diffPlate = new THREE.BoxGeometry(1.42, 0.05, 0.42);
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

  // Rear recessed license plate cavity with "STARMAN" plate
  const recessGeo = new THREE.BoxGeometry(0.54, 0.16, 0.04);
  g.add(mesh(recessGeo, mats.blackTrim, {
    position: [0, 0.48, -1.96],
    name: 'rear-license-recess',
  }));
  const texPlate = makeLicensePlateTexture();
  const plateMesh = mesh(new THREE.PlaneGeometry(0.34, 0.11), new THREE.MeshStandardMaterial({
    map: texPlate,
    roughness: 0.3,
    metalness: 0.1,
  }), {
    name: 'rear-license-plate',
  });
  plateMesh.position.set(0, 0.48, -1.975);
  plateMesh.rotateY(Math.PI);
  g.add(plateMesh);

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

  // ---------------------------------------------------------------------------------------
  //  AERODYNAMIC EXTERIOR MIRRORS (Sculpted organic teardrop shells on swept stems)
  // ---------------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const mirrorStem = tube([
      [side * 0.73, 0.69, 0.32],
      [side * 0.81, 0.72, 0.32],
      [side * 0.84, 0.73, 0.33],
    ], 0.013, { tubular: 14, radial: 8 });
    g.add(mesh(mirrorStem, mats.blackTrim));

    const mirrorHousing = new THREE.Group();
    mirrorHousing.position.set(side * 0.85, 0.73, 0.33);
    mirrorHousing.rotation.set(-0.10, side * 0.18, -0.05);

    // Sculpted organic aerodynamic mirror housing shell in Midnight Cherry Red
    const mBody = new THREE.SphereGeometry(0.055, 18, 14);
    mBody.scale(1.20, 0.70, 0.80);
    mirrorHousing.add(mesh(mBody, mats.cherryRed));

    // Black perimeter bezel ring
    mirrorHousing.add(mesh(new THREE.TorusGeometry(0.046, 0.005, 8, 20), mats.blackTrim, {
      position: [side * -0.028, 0, 0],
      rotation: [0, Math.PI / 2, 0],
    }));

    // Reflective chrome mirror glass
    const mGlass = new THREE.PlaneGeometry(0.092, 0.062);
    mGlass.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    mirrorHousing.add(mesh(mGlass, mats.chromeTrim, { position: [side * -0.030, 0, 0] }));

    g.add(mirrorHousing);

    // Recessed flush door handles
    const handleGeo = new THREE.BoxGeometry(0.015, 0.036, 0.11);
    g.add(mesh(handleGeo, mats.blackTrim, {
      position: [side * 0.75, 0.64, -0.10],
      name: `door-handle-${side < 0 ? 'left' : 'right'}`,
    }));

    // Side air intake scoops in front of rear wheels
    const scoopGeo = new THREE.BoxGeometry(0.02, 0.08, 0.14);
    g.add(mesh(scoopGeo, mats.blackTrim, {
      position: [side * 0.76, 0.38, -0.58],
      name: `side-air-scoop-${side < 0 ? 'left' : 'right'}`,
    }));
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Headlights: Organic Teardrop Aerodynamic Polycarbonate Projector Clusters
// -----------------------------------------------------------------------------------------
function buildHeadlights(mats, M) {
  const g = new THREE.Group();
  g.name = 'headlights';

  for (const s of [-1, 1]) {
    const hlGroup = new THREE.Group();
    hlGroup.name = `headlight-${s < 0 ? 'left' : 'right'}`;

    // Bedded flush on the front fender crown surface at z = 1.50
    const ptHL = evalBodyPoint(1.50, s * 0.46);
    hlGroup.position.set(ptHL.x, ptHL.y - 0.008, ptHL.z);
    hlGroup.rotation.set(-0.20, s * 0.06, -s * 0.16);

    // 1. Organic almond / teardrop perimeter gasket path
    const almondPts = [];
    const Npts = 28;
    for (let i = 0; i <= Npts; i++) {
      const a = (i / Npts) * Math.PI * 2;
      const lx = 0.036 * Math.sin(a);
      const taper = 1.0 + 0.22 * Math.cos(a);
      const lz = 0.095 * Math.cos(a) * taper;
      const ly = 0.002 * (1.0 - Math.pow(lx / 0.036, 2));
      almondPts.push([lx, ly, lz]);
    }

    // Black perimeter weatherstrip rubber sealing bezel flush with fender paint
    hlGroup.add(mesh(tube(almondPts, 0.0020, { tubular: 28, radial: 6 }), mats.blackTrim));

    // 3. Dual bi-xenon projector lamps with chrome rings & clear glass lenses
    // Forward low-beam projector (z = +0.036)
    const pLow = new THREE.Group();
    pLow.position.set(0, 0.004, 0.036);
    pLow.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 16), mats.chromeTrim));
    pLow.add(mesh(new THREE.TorusGeometry(0.015, 0.0018, 8, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0], position: [0, 0.003, 0] }));
    pLow.add(mesh(new THREE.SphereGeometry(0.013, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.headlightLens, {
      position: [0, 0.003, 0],
      rotation: [-Math.PI / 2, 0, 0],
    }));
    hlGroup.add(pLow);

    // Rearward high-beam projector bowl (z = -0.032)
    const pHigh = new THREE.Group();
    pHigh.position.set(0, 0.004, -0.032);
    pHigh.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 16), mats.chromeTrim));
    pHigh.add(mesh(new THREE.TorusGeometry(0.013, 0.0016, 8, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0], position: [0, 0.003, 0] }));
    pHigh.add(mesh(new THREE.SphereGeometry(0.011, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.headlightLens, {
      position: [0, 0.003, 0],
      rotation: [-Math.PI / 2, 0, 0],
    }));
    hlGroup.add(pHigh);

    // 4. Amber corner indicator reflector strip
    hlGroup.add(mesh(new THREE.BoxGeometry(0.005, 0.003, 0.055), mats.amberReflector, {
      position: [s * 0.022, 0.004, -0.010],
    }));

    // 5. Polycarbonate outer lens blister with organic curvature flush with fender
    const lensGeo = createParametricSurface(14, 14, (u, v) => {
      const su = (u - 0.5) * 2;
      const sv = (v - 0.5) * 2;
      const taper = 1.0 + 0.22 * Math.cos(su * Math.PI * 0.5);
      const lx = sv * 0.034 * Math.sqrt(Math.max(0.04, 1.0 - su * su * 0.70));
      const lz = su * 0.092 * taper;
      const r2 = su * su + sv * sv;
      const ly = 0.003 + 0.005 * Math.sqrt(Math.max(0, 1.0 - Math.min(0.98, r2 * 0.72)));
      return { x: lx, y: ly, z: lz };
    });
    hlGroup.add(mesh(lensGeo, mats.headlightLens, { name: 'outer-lens' }));

    g.add(hlGroup);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Taillights: Lotus/Tesla Circular LED Jewel Lamps
// -----------------------------------------------------------------------------------------
function buildTaillights(mats, M) {
  const g = new THREE.Group();
  g.name = 'taillights';

  for (const s of [-1, 1]) {
    for (let t = 0; t < 2; t++) {
      const tx = s * (0.42 + t * 0.18);
      const tl = new THREE.Group();
      tl.position.set(tx, 0.69, -1.962);

      // Chrome outer bezel ring
      tl.add(mesh(new THREE.TorusGeometry(0.058, 0.008, 8, 24), mats.chromeTrim));
      // Red jewel LED lens
      tl.add(mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.022, 24), mats.taillightRed, {
        rotation: [Math.PI / 2, 0, 0],
      }));
      // Inner reverse / turn indicator lens
      tl.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.028, 16), mats.chromeTrim, {
        rotation: [Math.PI / 2, 0, 0],
      }));

      g.add(tl);
    }
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Windshield, Sleek A-Pillars, Ceramic Frit, Rearview Mirror & Targa Roll Hoop
// -----------------------------------------------------------------------------------------
function buildWindshieldAndRollHoop(mats, M) {
  const g = new THREE.Group();
  g.name = 'windshield-and-roll-hoop';

  // 1. SLEEK MOLDED A-PILLARS (Aerodynamic cross-section merging cleanly into cowl & header)
  const aPillarLeft = tube([
    [-0.64, 0.69, 0.38],
    [-0.58, 0.94, 0.10],
    [-0.52, 1.128, -0.16],
  ], 0.022, { tubular: 18, radial: 10 });
  g.add(mesh(aPillarLeft, mats.blackTrim));

  const aPillarRight = tube([
    [0.64, 0.69, 0.38],
    [0.58, 0.94, 0.10],
    [0.52, 1.128, -0.16],
  ], 0.022, { tubular: 18, radial: 10 });
  g.add(mesh(aPillarRight, mats.blackTrim));

  // Upper windshield header rail
  const headerRail = tube([
    [-0.52, 1.128, -0.16],
    [0.0, 1.130, -0.16],
    [0.52, 1.128, -0.16],
  ], 0.020, { tubular: 18, radial: 10 });
  g.add(mesh(headerRail, mats.blackTrim));

  // Lower cowl base frame sealing the bottom of the glass
  const cowlRail = tube([
    [-0.64, 0.69, 0.38],
    [0.0, 0.70, 0.38],
    [0.64, 0.69, 0.38],
  ], 0.016, { tubular: 18, radial: 8 });
  g.add(mesh(cowlRail, mats.blackTrim));

  // Interior rearview mirror mounted on header rail with articulated ball mount
  const rvm = new THREE.Group();
  rvm.position.set(0, 1.08, -0.15);
  rvm.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.035, 8), mats.blackTrim, { rotation: [0.35, 0, 0] }));
  rvm.add(mesh(new THREE.BoxGeometry(0.14, 0.045, 0.016), mats.blackTrim, { position: [0, -0.022, 0.012] }));
  rvm.add(mesh(new THREE.PlaneGeometry(0.13, 0.038), mats.chromeTrim, { position: [0, -0.022, 0.003], rotation: [0, Math.PI, 0] }));
  g.add(rvm);

  // Single aerodynamic wiper blade parked horizontally at cowl
  const wiper = tube([
    [-0.46, 0.71, 0.37],
    [0.12, 0.72, 0.35],
  ], 0.007, { tubular: 14, radial: 6 });
  g.add(mesh(wiper, mats.blackTrim, { name: 'windshield-wiper' }));

  // 2. CURVED PANORAMIC WINDSHIELD GLASS (Double aerodynamic curvature)
  const wGeo = new THREE.PlaneGeometry(1.18, 0.62, 28, 20);
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

  // 3. AUTHENTIC CERAMIC FRIT BORDER (Smooth perimeter shading & rearview mirror sunshade)
  const fritParts = [
    { geometry: new THREE.BoxGeometry(1.16, 0.045, 0.006), matrix: mat4([0, -0.28, 0]) },
    { geometry: new THREE.BoxGeometry(1.16, 0.036, 0.006), matrix: mat4([0, 0.28, 0]) },
    { geometry: new THREE.BoxGeometry(0.038, 0.58, 0.006), matrix: mat4([-0.56, 0, 0]) },
    { geometry: new THREE.BoxGeometry(0.038, 0.58, 0.006), matrix: mat4([0.56, 0, 0]) },
    { geometry: new THREE.BoxGeometry(0.20, 0.08, 0.006), matrix: mat4([0, 0.23, 0]) },
  ];
  const fritMesh = mesh(mergeAll(fritParts), mats.satinBlack, {
    position: [0, 0.91, 0.11],
    rotation: [-0.75, 0, 0],
    name: 'windshield-ceramic-frit',
  });
  g.add(fritMesh);

  // 4. AUTHENTIC LOTUS/TESLA STRUCTURAL TARGA ROLL HOOP (Smooth rounded arch, sturdy B-pillar)
  const targaHoopPts = [
    [-0.46, 0.74, -0.66],
    [-0.46, 0.96, -0.66],
    [-0.40, 1.05, -0.66],
    [-0.20, 1.07, -0.66],
    [0.0, 1.07, -0.66],
    [0.20, 1.07, -0.66],
    [0.40, 1.05, -0.66],
    [0.46, 0.96, -0.66],
    [0.46, 0.74, -0.66],
  ];
  const rollHoop = tube(targaHoopPts, 0.028, { tubular: 32, radial: 12 });
  g.add(mesh(rollHoop, mats.blackTrim, { name: 'roll-hoop' }));

  // Integrated high-mounted 3rd brake light strip (CHMSL) in center of roll hoop
  const chmsl = new THREE.BoxGeometry(0.18, 0.022, 0.016);
  g.add(mesh(chmsl, mats.taillightRed, {
    position: [0, 1.07, -0.655],
    name: 'chmsl-brake-light',
  }));

  // Lower rear cockpit bulkhead panel sealing the space behind the seats
  const rearBulkhead = new THREE.BoxGeometry(0.96, 0.32, 0.04);
  g.add(mesh(rearBulkhead, mats.satinBlack, {
    position: [0, 0.72, -0.66],
    name: 'rear-bulkhead-panel',
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
    susp.push({
      geometry: tube([[0, 0.10, 0], [inboardX, 0.14, 0.12], [inboardX, 0.14, -0.12], [0, 0.10, 0]], 0.014, { tubular: 16, radial: 6 }),
    });
    susp.push({
      geometry: tube([[0, -0.12, 0], [inboardX, -0.10, 0.14], [inboardX, -0.10, -0.14], [0, -0.12, 0]], 0.016, { tubular: 16, radial: 6 }),
    });
    susp.push({
      geometry: tube([[0, 0.0, 0.12], [inboardX, 0.02, 0.14]], 0.012, { tubular: 8, radial: 6 }),
    });
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
      { r: wc.r, y: -wc.w / 2 * 0.70 },
      { r: wc.r * 0.94, y: -wc.w / 2 * 0.95 },
      { r: rimRadius, y: wc.w / 2 },
    ];
    const tyreGeo = lathe(tyreProfile, { segments: 36 });
    tyreGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(tyreGeo, mats.tyreRubber, { name: 'tyre' }));

    // 3. Forged Alloy Wheel Rim Barrel
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wc.w * 0.88, 28, 1, true);
    rimGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rimGeo, mats.chromeTrim, { name: 'rim-barrel' }));

    // 10 Sculpted Curved Spokes with Machined Face
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

    // 4. Ventilated Disc Brake Rotor with Central Mounting Hat
    const discRadius = rimRadius * 0.78;
    const rotorGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.018, 24);
    rotorGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rotorGeo, mats.brakeRotor, { position: [isLeft ? -wc.w * 0.12 : wc.w * 0.12, 0, 0] }));

    // Rotor central aluminum hat
    const hatGeo = new THREE.CylinderGeometry(discRadius * 0.45, discRadius * 0.45, 0.022, 16);
    hatGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(hatGeo, M.alumDark || mats.blackTrim, { position: [isLeft ? -wc.w * 0.13 : wc.w * 0.13, 0, 0] }));

    // Sculpted Brembo Monobloc Brake Caliper (Mounted at upper rear quadrant of rotor)
    const caliperGroup = new THREE.Group();
    caliperGroup.name = 'brake-caliper';
    const calX = isLeft ? -wc.w * 0.12 : wc.w * 0.12;
    const calAngle = -0.42;
    caliperGroup.position.set(calX, discRadius * 0.68, -discRadius * 0.42);
    caliperGroup.rotation.set(calAngle, 0, 0);

    // Sculpted curved caliper bridge body
    const calBody = new THREE.BoxGeometry(0.042, 0.052, 0.118);
    caliperGroup.add(mesh(calBody, mats.brakeCaliper));

    // Dual piston cylindrical bosses on outer face
    for (const pz of [-0.028, 0.028]) {
      caliperGroup.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 14), mats.brakeCaliper, {
        position: [isLeft ? -0.023 : 0.023, 0, pz],
        rotation: [0, 0, Math.PI / 2],
      }));
    }
    // Stainless pad retaining spring clip on outer bridge
    caliperGroup.add(mesh(new THREE.BoxGeometry(0.020, 0.008, 0.06), mats.chromeTrim, {
      position: [0, 0.028, 0],
    }));
    // Bleeder fitting on top
    caliperGroup.add(mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.012, 8), mats.chromeTrim, {
      position: [0, 0.032, -0.02],
    }));

    wGroup.add(caliperGroup);

    g.add(wGroup);
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Lotus Elise / Tesla Roadster Sport Bucket Seat
// -----------------------------------------------------------------------------------------
function buildBucketSeat(s, mats, M) {
  const seat = new THREE.Group();
  seat.name = `seat-${s < 0 ? 'driver' : 'passenger'}`;
  seat.position.set(s * 0.34, 0, 0);

  // 1. Rigid lightweight carbon-composite outer bucket shell with anatomical taper
  const shellGroup = new THREE.Group();
  // Sculpted back shell
  const backShell = new THREE.BoxGeometry(0.38, 0.64, 0.025);
  shellGroup.add(mesh(backShell, mats.carbonFiber || mats.satinBlack, {
    position: [0, 0.54, -0.46],
    rotation: [-0.34, 0, 0],
  }));
  // Bottom seat pan shell
  const bottomShell = new THREE.BoxGeometry(0.38, 0.03, 0.42);
  shellGroup.add(mesh(bottomShell, mats.carbonFiber || mats.satinBlack, {
    position: [0, 0.17, -0.20],
  }));
  seat.add(shellGroup);

  // 2. Contoured ergonomic seat cushion with elevated thigh side bolsters
  const cushion = new THREE.BoxGeometry(0.30, 0.08, 0.38);
  seat.add(mesh(cushion, mats.blackTrim, { position: [0, 0.22, -0.20] }));
  for (const bs of [-1, 1]) {
    // Sculpted thigh support bolster
    const bolster = new THREE.BoxGeometry(0.05, 0.07, 0.36);
    seat.add(mesh(bolster, mats.satinBlack, {
      position: [bs * 0.15, 0.25, -0.20],
    }));
  }

  // 3. Ergonomically reclined backrest with lateral rib support wings
  const backrest = new THREE.BoxGeometry(0.28, 0.50, 0.06);
  seat.add(mesh(backrest, mats.blackTrim, {
    position: [0, 0.54, -0.44],
    rotation: [-0.34, 0, 0],
  }));
  for (const bs of [-1, 1]) {
    // Sculpted lateral torso support wing
    const wing = new THREE.BoxGeometry(0.05, 0.42, 0.10);
    seat.add(mesh(wing, mats.satinBlack, {
      position: [bs * 0.15, 0.50, -0.41],
      rotation: [-0.34, 0, 0],
    }));
  }

  // 4. Integrated headrest with authentic twin racing harness pass-through slots
  const headrest = new THREE.BoxGeometry(0.22, 0.16, 0.06);
  seat.add(mesh(headrest, mats.blackTrim, {
    position: [0, 0.83, -0.53],
    rotation: [-0.34, 0, 0],
  }));

  // Dual harness pass-through cutouts with black composite bezel surrounds
  for (const hx of [-0.055, 0.055]) {
    const slotBezel = new THREE.TorusGeometry(0.022, 0.0045, 8, 16);
    slotBezel.scale(0.8, 1.4, 1.0);
    seat.add(mesh(slotBezel, mats.blackTrim, {
      position: [hx, 0.77, -0.510],
      rotation: [-0.34, 0, 0],
    }));
    // Recessed dark void inside slot
    seat.add(mesh(new THREE.BoxGeometry(0.032, 0.055, 0.03), mats.satinBlack, {
      position: [hx, 0.77, -0.515],
      rotation: [-0.34, 0, 0],
    }));
  }

  return seat;
}

// -----------------------------------------------------------------------------------------
//  Cockpit Interior: Sculpted Dashboard, Waterfall Console & Easter Eggs
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

  // Lotus Elise / Tesla Roadster Sport Bucket Seats
  g.add(buildBucketSeat(-1, mats, M)); // Driver seat
  g.add(buildBucketSeat(1, mats, M));  // Passenger seat

  // 3-Point Seatbelt for Starman (Driver side)
  const beltPts = [
    [-0.48, 0.88, -0.62], // B-pillar / roll hoop anchor
    [-0.34, 0.65, -0.22], // Chest crossing
    [-0.18, 0.32, -0.24], // Center buckle
  ];
  g.add(mesh(tube(beltPts, 0.015, { tubular: 16, radial: 6 }), mats.satinBlack, { name: 'starman-seatbelt' }));
  g.add(mesh(new THREE.BoxGeometry(0.035, 0.05, 0.02), mats.chromeTrim, { position: [-0.18, 0.32, -0.24] }));

  // ---------------------------------------------------------------------------------------
  //  SCULPTED AUTOMOTIVE DASHBOARD & WATERFALL CENTER CONSOLE
  // ---------------------------------------------------------------------------------------
  const dashGroup = new THREE.Group();
  dashGroup.name = 'dashboard-assembly';

  // 1. Full-width dashboard main beam spanning door to door, sealing cowl & firewall
  const dashTopper = new THREE.BoxGeometry(1.06, 0.08, 0.18);
  dashGroup.add(mesh(dashTopper, mats.blackTrim, { position: [0, 0.68, 0.38] }));

  // Lower knee bolster fascia
  const lowerFascia = new THREE.BoxGeometry(1.04, 0.12, 0.10);
  dashGroup.add(mesh(lowerFascia, mats.satinBlack, { position: [0, 0.57, 0.38] }));

  // Driver side instrument binnacle cowl hood
  const cowlGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.16, 20, 1, false, 0, Math.PI);
  cowlGeo.rotateX(Math.PI / 2);
  dashGroup.add(mesh(cowlGeo, mats.blackTrim, { position: [-0.34, 0.72, 0.30] }));

  // Dual analog instrument dials (speedometer & battery kW power meter)
  for (const gx of [-0.39, -0.29]) {
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 16), mats.chromeTrim, {
      position: [gx, 0.70, 0.288],
      rotation: [-0.35, 0, 0],
    }));
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.009, 16), mats.satinBlack, {
      position: [gx, 0.70, 0.290],
      rotation: [-0.35, 0, 0],
    }));
  }

  // 4 Round aluminum eyeball A/C vents with chrome trim rings
  for (const vx of [-0.48, -0.15, 0.15, 0.48]) {
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.015, 16), mats.chromeTrim, {
      position: [vx, 0.67, 0.33],
      rotation: [-0.35, 0, 0],
    }));
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16), mats.satinBlack, {
      position: [vx, 0.67, 0.332],
      rotation: [-0.35, 0, 0],
    }));
  }

  // 2. WATERFALL CENTER CONSOLE (Flows behind display down to floor tunnel)
  const consoleGroup = new THREE.Group();
  consoleGroup.name = 'waterfall-center-console';

  // Center stack body sitting strictly BEHIND the screen (at z = 0.34)
  const stackBody = new THREE.BoxGeometry(0.24, 0.22, 0.08);
  consoleGroup.add(mesh(stackBody, mats.blackTrim, {
    position: [0, 0.48, 0.34],
    rotation: [-0.35, 0, 0],
  }));

  // Lower console slope carrying push-button gear selectors (P, R, N, D)
  const lowerSlope = new THREE.BoxGeometry(0.20, 0.20, 0.06);
  consoleGroup.add(mesh(lowerSlope, mats.satinBlack, {
    position: [0, 0.34, 0.22],
    rotation: [-0.75, 0, 0],
  }));

  for (let b = 0; b < 4; b++) {
    consoleGroup.add(mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.008, 12), mats.chromeTrim, {
      position: [0, 0.36 - b * 0.030, 0.24 - b * 0.020],
      rotation: [-0.75, 0, 0],
    }));
  }

  // Central transmission tunnel running back between seats
  const tunnelBody = new THREE.BoxGeometry(0.18, 0.10, 0.55);
  consoleGroup.add(mesh(tunnelBody, mats.blackTrim, {
    position: [0, 0.21, -0.02],
  }));

  // Handbrake lever on tunnel
  const handbrake = tube([
    [-0.05, 0.24, -0.06],
    [-0.05, 0.31, 0.04],
  ], 0.010, { tubular: 8, radial: 6 });
  consoleGroup.add(mesh(handbrake, mats.satinBlack));
  consoleGroup.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.015, 8), mats.chromeTrim, {
    position: [-0.05, 0.315, 0.045],
    rotation: [0.8, 0, 0],
  }));

  dashGroup.add(consoleGroup);
  g.add(dashGroup);

  // 3. Momo 3-Spoke Sport Steering Wheel
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'steering-wheel';
  wheelGroup.position.set(-0.34, 0.69, 0.16);
  wheelGroup.rotation.set(-0.45, 0, 0);

  // Outer thick leather rim
  wheelGroup.add(mesh(new THREE.TorusGeometry(0.155, 0.015, 12, 32), mats.blackTrim));
  // Center horn boss with red Tesla medallion
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 16), mats.cherryRed, { rotation: [Math.PI / 2, 0, 0] }));

  // 3 Spokes with drilled lightening holes
  for (const ang of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
    wheelGroup.add(mesh(new THREE.BoxGeometry(0.12, 0.020, 0.008), mats.chromeTrim, {
      position: [Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0],
      rotation: [0, 0, ang],
    }));
  }
  // Steering column and stalks
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 12), mats.blackTrim, {
    position: [0, 0, 0.10],
    rotation: [Math.PI / 2, 0, 0],
  }));
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), mats.blackTrim, {
    position: [-0.08, 0.04, 0.06],
    rotation: [0, 0, 1.2],
  }));
  g.add(wheelGroup);

  // ---- Easter Egg 1: "DON'T PANIC!" Center Screen ---------------------------------------
  // Cleanly embedded into center console stack, perfectly facing backward toward camera and driver!
  const screenUnit = new THREE.Group();
  screenUnit.name = 'screen-dont-panic';
  screenUnit.position.set(0.0, 0.58, 0.27);
  // Facing toward driver/camera (facing along -Z, tilted up towards +Y, turned slightly toward driver)
  screenUnit.rotation.set(-0.35, Math.PI - 0.20, 0.0);

  // Touchscreen display panel with "DON'T PANIC!" texture (facing the camera!)
  const screenPanel = mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({
    map: texDontPanic,
    side: THREE.FrontSide,
  }), {
    position: [0, 0, 0.006],
  });
  screenUnit.add(screenPanel);

  // Carbon fiber display bezel frame sitting BEHIND the screen away from camera
  screenUnit.add(mesh(new THREE.BoxGeometry(0.24, 0.14, 0.010), mats.carbonFiber || mats.satinBlack, {
    position: [0, 0, -0.001],
  }));

  g.add(screenUnit);

  // ---- Easter Egg 2: 1:64 Scale Hot Wheels Roadster on Dashboard Pad ---------------------
  const hwGroup = new THREE.Group();
  hwGroup.name = 'hot-wheels-easter-egg';
  hwGroup.position.set(0.12, 0.725, 0.34);
  hwGroup.rotation.set(-0.14, 0.10, 0);

  // Miniature sports car body
  const hwBody = new THREE.BoxGeometry(0.034, 0.013, 0.072);
  hwGroup.add(mesh(hwBody, mats.cherryRed));
  // Tiny windshield
  const hwGlass = new THREE.BoxGeometry(0.028, 0.009, 0.020);
  hwGroup.add(mesh(hwGlass, mats.windshieldGlass, { position: [0, 0.009, 0.006], rotation: [-0.4, 0, 0] }));
  // 4 Micro chrome wheels
  for (const hx of [-0.018, 0.018]) for (const hz of [-0.022, 0.022]) {
    hwGroup.add(mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.004, 8), mats.chromeTrim, {
      position: [hx, -0.004, hz],
      rotation: [0, 0, Math.PI / 2],
    }));
  }
  // Micro-Starman figure in driver seat
  hwGroup.add(mesh(new THREE.SphereGeometry(0.0044, 8, 8), mats.starmanSuitWhite, { position: [-0.006, 0.011, -0.004] }));
  g.add(hwGroup);

  // ---- Easter Egg 3: Arch Mission 5D Optical Quartz Disc ---------------------------------
  const disc = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.006, 24), mats.quartzDisc, {
    position: [0.32, 0.36, -0.15],
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
//  Starman Mannequin: Authentic SpaceX IVA Flight Spacesuit & Unified Aerodynamic Helmet
// -----------------------------------------------------------------------------------------
function buildStarman(mats, M) {
  const g = new THREE.Group();
  g.name = 'starman';

  const { starmanSuitWhite, starmanSuitGraphite, starmanVisor, blackTrim } = mats;
  const sx = -0.34; // centered in driver seat

  // 1. Torso: Tailored SpaceX IVA suit chest reclined against backrest
  const torso = new THREE.Group();
  torso.position.set(sx, 0.56, -0.28);
  torso.rotation.set(-0.32, 0, 0);

  // Main white chest shell
  const chest = new THREE.CylinderGeometry(0.18, 0.14, 0.44, 16);
  torso.add(mesh(chest, starmanSuitWhite, { name: 'suit-chest' }));

  // Graphite aerodynamic side rib articulation inserts
  for (const s of [-1, 1]) {
    torso.add(mesh(new THREE.BoxGeometry(0.04, 0.38, 0.08), starmanSuitGraphite, { position: [s * 0.16, 0, 0] }));
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

  // 3. Right Arm: Reaching towards steering wheel rim at 10-11 o'clock
  const rightArm = new THREE.Group();
  rightArm.name = 'right-arm-steering';
  // Bicep angling forward towards wheel
  rightArm.add(mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.26, 12), starmanSuitWhite, {
    position: [sx + 0.06, 0.64, -0.16],
    rotation: [0.95, -0.15, -0.32],
  }));
  // Forearm reaching to top left of steering wheel rim
  rightArm.add(mesh(new THREE.CylinderGeometry(0.044, 0.040, 0.24, 12), starmanSuitWhite, {
    position: [sx + 0.01, 0.71, -0.02],
    rotation: [1.25, -0.22, -0.42],
  }));
  // Gloved hand gripping steering wheel rim at 11 o'clock
  rightArm.add(mesh(new THREE.SphereGeometry(0.042, 12, 10), starmanSuitWhite, {
    position: [-0.34, 0.76, 0.10],
  }));
  rightArm.add(mesh(new THREE.BoxGeometry(0.044, 0.032, 0.055), blackTrim, {
    position: [-0.34, 0.76, 0.10],
  }));
  g.add(rightArm);

  // 4. Left Arm (THE ICONIC STARMAN POSE): Resting naturally and solidly on top of the door sill
  const leftArm = new THREE.Group();
  leftArm.name = 'left-arm-door-sill';
  // Upper arm extending down and out to sill
  leftArm.add(mesh(new THREE.CylinderGeometry(0.054, 0.048, 0.24, 12), starmanSuitWhite, {
    position: [sx - 0.15, 0.66, -0.18],
    rotation: [0.35, 0, 0.95],
  }));
  // Forearm resting solidly along the upper door sill (x ≈ -0.58, y ≈ 0.725)
  leftArm.add(mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.26, 12), starmanSuitWhite, {
    position: [-0.58, 0.725, 0.00],
    rotation: [Math.PI / 2, 0, 0],
  }));
  // Left gloved hand relaxed over door sill
  leftArm.add(mesh(new THREE.SphereGeometry(0.042, 12, 10), starmanSuitWhite, {
    position: [-0.58, 0.72, 0.14],
  }));
  leftArm.add(mesh(new THREE.BoxGeometry(0.046, 0.030, 0.06), blackTrim, {
    position: [-0.58, 0.72, 0.14],
  }));
  g.add(leftArm);

  // ---------------------------------------------------------------------------------------
  //  5. SPACEX IVA FLIGHT HELMET: ONE Unified, Solid Aerodynamic Composite Shell
  // ---------------------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.name = 'spacex-helmet';
  headGroup.position.set(sx, 0.88, -0.30);
  // Turned comfortably toward the driver window / door camera for the iconic photo angle
  headGroup.rotation.set(0.06, 0.35, -0.04);

  // (A) Unified white composite helmet outer shell:
  // Cranial dome covering top and back of head
  const cranialDome = new THREE.SphereGeometry(0.120, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
  cranialDome.scale(0.86, 1.02, 1.06);
  headGroup.add(mesh(cranialDome, starmanSuitWhite, { position: [0, 0.015, -0.01] }));

  // Rear neck cowl & jaw wrap (covering back and sides, leaving front aperture open for visor)
  const rearWrap = new THREE.CylinderGeometry(0.102, 0.090, 0.12, 24, 1, true, Math.PI * 0.28, Math.PI * 1.44);
  headGroup.add(mesh(rearWrap, starmanSuitWhite, { position: [0, -0.04, -0.01] }));

  // Aerodynamic forward chin bar across the bottom of the face aperture
  const chinBar = new THREE.BoxGeometry(0.14, 0.038, 0.07);
  headGroup.add(mesh(chinBar, starmanSuitWhite, { position: [0, -0.075, 0.07], rotation: [0.24, 0, 0] }));

  // (B) Anodized graphite neck collar lock ring
  headGroup.add(mesh(new THREE.TorusGeometry(0.088, 0.014, 12, 28), blackTrim, {
    position: [0, -0.098, 0],
    rotation: [Math.PI / 2, 0, 0],
    name: 'helmet-neck-ring',
  }));

  // (C) Smooth convex panoramic obsidian black smoked visor (flush with face aperture)
  const visorMesh = mesh(new THREE.SphereGeometry(0.118, 24, 18, -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.24, Math.PI * 0.46), starmanVisor, {
    position: [0, 0.012, 0.024],
    name: 'helmet-visor',
  });
  visorMesh.scale.set(0.86, 0.65, 0.98);
  headGroup.add(visorMesh);

  // (D) Clean black rubber seal gasket framing the visor opening flush with composite shell
  const gasketPts = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rx = 0.074 * Math.cos(a);
    const ry = 0.054 * Math.sin(a) + 0.012;
    const rz = 0.072 + 0.014 * Math.cos(a);
    gasketPts.push([rx, ry, rz]);
  }
  headGroup.add(mesh(tube(gasketPts, 0.0035, { tubular: 28, radial: 6 }), blackTrim, {
    name: 'helmet-visor-gasket',
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

  const carbon = mats.carbonFiber || mats.blackTrim;
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
  camA.lookAt(-0.34, 0.90, -0.2);
  camA.add(mesh(new THREE.BoxGeometry(0.10, 0.08, 0.14), carbon));
  camA.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16), mats.chromeTrim, { position: [0, 0, 0.08], rotation: [Math.PI / 2, 0, 0] }));
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
  camB.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 16), mats.chromeTrim, { position: [0, 0, 0.07], rotation: [Math.PI / 2, 0, 0] }));
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
  camC.lookAt(-0.34, 0.85, 0.8);
  camC.add(mesh(new THREE.BoxGeometry(0.09, 0.07, 0.12), carbon));
  camC.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16), mats.chromeTrim, { position: [0, 0, 0.07], rotation: [Math.PI / 2, 0, 0] }));
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
    { label: 'Starman · Maniquí con traje espacial SpaceX IVA', position: [-0.34, 0.95, -0.2] },
    { label: "«DON'T PANIC!» · Pantalla del salpicadero", position: [0.0, 0.62, 0.32] },
    { label: 'Miniatura Hot Wheels 1:64 con micro-Starman', position: [0.12, 0.73, 0.32] },
    { label: 'Tesla Roadster 2008 · Carrocería con curvas reales', position: [0.72, 0.65, 0.8] },
    { label: 'Cámara selfie en mástil de fibra de carbono', position: [0.55, 0.95, 3.10] },
    { label: 'Adaptador de carga útil (PAF) de Falcon Heavy', position: [0.0, -0.22, 0.0] },
    { label: '«Made on Earth by humans» · Placa de circuito', position: [0.0, 0.28, 1.15] },
    { label: 'Archivo 5D Arch Mission · Trilogía Fundación', position: [0.32, 0.42, -0.15] },
  ];

  return root;
}
