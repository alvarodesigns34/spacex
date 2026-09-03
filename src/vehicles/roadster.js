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

function makeGrilleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111315';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#22252a';
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
//  Internal Material Factory
// -----------------------------------------------------------------------------------------
function createRoadsterMaterials(M) {
  // Midnight Cherry Red: Deep, rich cherry wine with metallic luster and high-gloss clearcoat
  const cherryRed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x560814),
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 0.98,
    clearcoatRoughness: 0.06,
    reflectivity: 0.90,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  });

  const blackTrim = new THREE.MeshStandardMaterial({
    color: 0x141517,
    metalness: 0.25,
    roughness: 0.65,
  });

  const chromeTrim = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.96,
    roughness: 0.10,
  });

  const tyreRubber = new THREE.MeshStandardMaterial({
    color: 0x18191c,
    metalness: 0.05,
    roughness: 0.90,
  });

  const brakeRotor = new THREE.MeshStandardMaterial({
    color: 0x8e9299,
    metalness: 0.88,
    roughness: 0.35,
  });

  const brakeCaliper = new THREE.MeshStandardMaterial({
    color: 0xc41424,
    metalness: 0.45,
    roughness: 0.32,
  });

  const windshieldGlass = new THREE.MeshPhysicalMaterial({
    color: 0xa0c0d8,
    transparent: true,
    opacity: 0.42,
    roughness: 0.04,
    metalness: 0.1,
    transmission: 0.75,
    ior: 1.52,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xf5f8ff,
    transparent: true,
    opacity: 0.60,
    roughness: 0.06,
    metalness: 0.12,
    transmission: 0.70,
    ior: 1.50,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const taillightRed = new THREE.MeshStandardMaterial({
    color: 0xdd0c18,
    emissive: 0x550308,
    roughness: 0.22,
    metalness: 0.3,
  });

  const starmanSuitWhite = new THREE.MeshStandardMaterial({
    color: 0xf4f5f8,
    roughness: 0.65,
    metalness: 0.08,
  });

  const starmanVisor = new THREE.MeshPhysicalMaterial({
    color: 0x090a0f,
    metalness: 0.95,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.4,
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

  const grilleMesh = new THREE.MeshStandardMaterial({
    map: makeGrilleTexture(),
    color: 0x111315,
    roughness: 0.85,
    metalness: 0.2,
  });

  return {
    cherryRed, blackTrim, chromeTrim, tyreRubber, brakeRotor, brakeCaliper,
    windshieldGlass, headlightLens, taillightRed, starmanSuitWhite, starmanVisor, quartzDisc, grilleMesh,
  };
}

// -----------------------------------------------------------------------------------------
//  Seamless Parametric Automotive Body: Complete Single Shell (Front to Rear)
// -----------------------------------------------------------------------------------------
function buildSeamlessBodyShell(mats, M) {
  const g = new THREE.Group();
  g.name = 'body-shell';

  const Nz = 52;
  const Ntheta = 36;
  const zMin = -1.95, zMax = 1.95;
  const positions = [];
  const uvs = [];
  const indices = [];

  function getWidth(z) {
    if (z > 1.70) {
      const t = (z - 1.70) / 0.25;
      return 0.72 * Math.sqrt(Math.max(0.01, 1 - t * t * 0.75));
    } else if (z > 0.60) {
      const t = (z - 1.176) / 0.50;
      return 0.77 + 0.065 * Math.exp(-t * t);
    } else if (z > -0.65) {
      // Coke-bottle waistline tuck
      const t = (z - -0.10) / 0.55;
      return 0.76 + 0.04 * (t * t);
    } else if (z > -1.60) {
      // Muscular rear haunches over rear wheels
      const t = (z - -1.176) / 0.48;
      return 0.79 + 0.075 * Math.exp(-t * t);
    } else {
      const t = (-1.60 - z) / 0.35;
      return 0.84 - 0.08 * t;
    }
  }

  function getCenterY(z) {
    if (z > 1.70) {
      const t = (z - 1.70) / 0.25;
      return 0.52 - 0.08 * t;
    } else if (z > 0.38) {
      const t = Math.max(0, Math.min(1, (z - 0.38) / 1.32));
      return 0.69 - 0.17 * Math.pow(t, 0.85);
    } else if (z > -0.68) {
      // Cockpit interior tub floor / tunnel line
      return 0.24;
    } else if (z > -1.60) {
      const t = (z - -0.68) / -0.92;
      return 0.85 - 0.04 * t;
    } else {
      const t = Math.max(0, Math.min(1, (-1.60 - z) / 0.35));
      return 0.81 + 0.08 * Math.pow(t, 1.3);
    }
  }

  function getFenderY(z) {
    if (z > 0.38) {
      const base = 0.69 - 0.17 * Math.pow(Math.max(0, (z - 0.38) / 1.32), 0.85);
      return base + 0.165 * Math.exp(-Math.pow((z - 1.176) / 0.46, 2));
    } else if (z > -0.68) {
      // Upper door sill curve
      const u = (z - -0.68) / 1.06;
      return 0.69 - 0.03 * Math.sin(u * Math.PI);
    } else if (z > -1.60) {
      const base = 0.85 - 0.04 * ((z - -0.68) / -0.92);
      return base + 0.085 * Math.exp(-Math.pow((z - -1.176) / 0.48, 2));
    } else {
      const t = Math.max(0, Math.min(1, (-1.60 - z) / 0.35));
      return (0.81 + 0.08 * Math.pow(t, 1.3)) + 0.02 * (1 - t);
    }
  }

  for (let i = 0; i < Nz; i++) {
    const u = i / (Nz - 1);
    const z = zMax - u * (zMax - zMin);
    const W = getWidth(z);
    const yCenter = getCenterY(z);
    const yFender = getFenderY(z);

    // Circular wheel arch cutouts
    const isFrontWheel = Math.abs(z - 1.176) < 0.36;
    const isRearWheel = Math.abs(z - -1.176) < 0.38;
    let archY = 0.16;
    if (isFrontWheel) {
      const dz = Math.abs(z - 1.176);
      archY = Math.max(0.16, 0.30 + Math.sqrt(Math.max(0, 0.35 * 0.35 - dz * dz)));
    } else if (isRearWheel) {
      const dz = Math.abs(z - -1.176);
      archY = Math.max(0.16, 0.315 + Math.sqrt(Math.max(0, 0.37 * 0.37 - dz * dz)));
    }

    const inCockpit = (z > -0.68 && z < 0.38);

    for (let j = 0; j < Ntheta; j++) {
      const v = j / (Ntheta - 1);
      const s = (v - 0.5) * 2;
      const absS = Math.abs(s);
      const sign = Math.sign(s);

      let x, y;
      if (inCockpit) {
        if (absS < 0.55) {
          // Open cockpit tub interior depression
          const t = absS / 0.55;
          x = s * W * 0.70;
          y = yCenter + 0.04 * (t * t);
        } else {
          // Continuous outer door sill and flank
          const t = (absS - 0.55) / 0.45;
          const xSill = sign * W * 0.75;
          const xOuter = sign * W;
          x = xSill * (1 - t) + xOuter * t;
          y = yFender * (1 - Math.pow(t, 1.3)) + 0.16 * Math.pow(t, 1.3);
        }
      } else {
        if (absS < 0.70) {
          // Hood or decklid top surface
          const t = absS / 0.70;
          x = s * W * 0.80;
          y = yCenter * (1 - Math.pow(t, 2.2)) + yFender * Math.pow(t, 2.2);

          // Twin hood heat extractor depressions on front hood
          if (z > 0.85 && z < 1.45 && Math.abs(absS - 0.32) < 0.14) {
            y -= 0.022 * (1 - Math.pow((absS - 0.32) / 0.14, 2));
          }
        } else {
          // Muscular fender curves down to wheel arches or rocker
          const t = (absS - 0.70) / 0.30;
          const xCrest = sign * W * 0.80;
          const xEdge = sign * W;
          x = xCrest * (1 - t) + xEdge * t;
          const targetY = (u < 0.12 || u > 0.88) ? (0.16 + Math.abs(u - 0.5) * 0.08) : archY;
          y = yFender * (1 - Math.pow(t, 1.4)) + targetY * Math.pow(t, 1.4);
        }
      }

      positions.push(x, y, z);
      uvs.push(v, u);
    }
  }

  for (let i = 0; i < Nz - 1; i++) {
    for (let j = 0; j < Ntheta - 1; j++) {
      const a = i * Ntheta + j;
      const b = (i + 1) * Ntheta + j;
      const c = (i + 1) * Ntheta + (j + 1);
      const d = i * Ntheta + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shellGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shellGeo.setIndex(indices);
  shellGeo.computeVertexNormals();

  g.add(mesh(shellGeo, mats.cherryRed, { name: 'body-paint' }));

  // Front lower air intake mouth (trapezoidal radiator grille)
  const grilleGeo = new THREE.BoxGeometry(0.84, 0.18, 0.14);
  g.add(mesh(grilleGeo, mats.grilleMesh, {
    position: [0, 0.24, 1.88],
    name: 'front-grille',
  }));

  // Front chin aerodynamic splitter
  const splitterPts = [
    [-0.72, 0.15, 1.68],
    [-0.45, 0.15, 1.94],
    [0.0, 0.15, 1.96],
    [0.45, 0.15, 1.94],
    [0.72, 0.15, 1.68],
  ];
  g.add(mesh(tube(splitterPts, 0.024, { tubular: 24, radial: 8 }), mats.blackTrim, { name: 'front-splitter' }));

  // Twin hood extraction vents (black mesh inserts)
  for (const s of [-1, 1]) {
    const ventGeo = new THREE.PlaneGeometry(0.18, 0.44);
    ventGeo.rotateX(-Math.PI / 2);
    const vent = mesh(ventGeo, mats.blackTrim, {
      position: [s * 0.24, 0.605, 1.12],
      rotation: [0.12, 0, 0],
      name: 'hood-vent-' + (s < 0 ? 'l' : 'r'),
    });
    g.add(vent);
  }

  // Rear vertical bumper fascia plate
  const fasciaGeo = new THREE.PlaneGeometry(1.54, 0.62, 16, 8);
  fasciaGeo.rotateY(Math.PI);
  const fascia = mesh(fasciaGeo, mats.cherryRed, {
    position: [0, 0.54, zMin],
    name: 'rear-fascia',
  });
  g.add(fascia);

  // Rear license plate recess
  const recessGeo = new THREE.BoxGeometry(0.56, 0.16, 0.04);
  g.add(mesh(recessGeo, mats.blackTrim, {
    position: [0, 0.48, zMin + 0.01],
    name: 'rear-license-recess',
  }));

  // Rear lower racing diffuser with vertical strakes
  const diffPlate = new THREE.BoxGeometry(1.48, 0.06, 0.42);
  g.add(mesh(diffPlate, mats.blackTrim, {
    position: [0, 0.19, zMin + 0.20],
    name: 'rear-diffuser-tray',
  }));

  for (let sx = -0.52; sx <= 0.52; sx += 0.26) {
    const strake = new THREE.BoxGeometry(0.018, 0.14, 0.38);
    g.add(mesh(strake, mats.blackTrim, {
      position: [sx, 0.16, zMin + 0.20],
      name: 'diffuser-strake',
    }));
  }

  // Exterior side mirrors
  for (const side of [-1, 1]) {
    const mirrorStem = tube([
      [side * 0.77, 0.70, 0.32],
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

    // Recessed door handle pulls
    const handleGeo = new THREE.BoxGeometry(0.015, 0.04, 0.12);
    g.add(mesh(handleGeo, mats.blackTrim, {
      position: [side * 0.785, 0.63, -0.10],
      name: `door-handle-${side < 0 ? 'left' : 'right'}`,
    }));
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Headlights: Swept Almond Projectors Recessed in Fender Curves
// -----------------------------------------------------------------------------------------
function buildHeadlights(mats, M) {
  const g = new THREE.Group();
  g.name = 'headlights';

  for (const s of [-1, 1]) {
    const hlGroup = new THREE.Group();
    hlGroup.name = `headlight-${s < 0 ? 'left' : 'right'}`;
    hlGroup.position.set(s * 0.54, 0.58, 1.70);
    hlGroup.rotation.set(-0.32, s * 0.24, -s * 0.12);

    // Chrome reflector bucket
    const bucket = new THREE.SphereGeometry(0.13, 20, 14, 0, Math.PI);
    bucket.scale(0.85, 0.55, 1.4);
    hlGroup.add(mesh(bucket, mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));

    // Dual LED projector lamps
    hlGroup.add(mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.06, 16), M.lens || mats.chromeTrim, {
      position: [-0.035, 0, 0.05],
      rotation: [Math.PI / 2, 0, 0],
    }));
    hlGroup.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 16), M.lens || mats.chromeTrim, {
      position: [0.035, 0, -0.05],
      rotation: [Math.PI / 2, 0, 0],
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
//  Taillights: Rocket-Style Protruding Round Circular LED Lamps
// -----------------------------------------------------------------------------------------
function buildTaillights(mats, M) {
  const g = new THREE.Group();
  g.name = 'taillights';

  for (const s of [-1, 1]) {
    for (let t = 0; t < 2; t++) {
      const tx = s * (0.42 + t * 0.20);
      const tl = new THREE.Group();
      tl.position.set(tx, 0.69, -1.952);

      // Chrome outer bezel ring
      tl.add(mesh(new THREE.TorusGeometry(0.064, 0.010, 8, 24), mats.chromeTrim));
      // Dark red lens body
      tl.add(mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.03, 24), mats.taillightRed, {
        rotation: [Math.PI / 2, 0, 0],
      }));
      // Inner clear reverse/indicator lamp
      tl.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.035, 16), mats.chromeTrim, {
        rotation: [Math.PI / 2, 0, 0],
      }));

      g.add(tl);
    }
  }

  return g;
}

// -----------------------------------------------------------------------------------------
//  Windshield & Structural Roll Hoop
// -----------------------------------------------------------------------------------------
function buildWindshieldAndRollHoop(mats, M) {
  const g = new THREE.Group();
  g.name = 'windshield-and-roll-hoop';

  // Raked A-pillars (slender composite frame)
  const aPillarLeft = tube([
    [-0.68, 0.70, 0.38],
    [-0.60, 0.94, 0.12],
    [-0.54, 1.127, -0.16],
  ], 0.024, { tubular: 16, radial: 8 });
  g.add(mesh(aPillarLeft, mats.blackTrim));

  const aPillarRight = tube([
    [0.68, 0.70, 0.38],
    [0.60, 0.94, 0.12],
    [0.54, 1.127, -0.16],
  ], 0.024, { tubular: 16, radial: 8 });
  g.add(mesh(aPillarRight, mats.blackTrim));

  // Upper windshield header rail
  const headerRail = tube([
    [-0.54, 1.127, -0.16],
    [0.0, 1.13, -0.15],
    [0.54, 1.127, -0.16],
  ], 0.022, { tubular: 16, radial: 8 });
  g.add(mesh(headerRail, mats.blackTrim));

  // Curved Panoramic Windshield Glass
  const wGeo = new THREE.PlaneGeometry(1.18, 0.62, 20, 12);
  const pos = wGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Cylindrical aerodynamic curve across width
    pos.setZ(i, -(x * x) * 0.14 - (y * y) * 0.04);
  }
  wGeo.computeVertexNormals();

  const wMesh = mesh(wGeo, mats.windshieldGlass, {
    position: [0, 0.91, 0.11],
    rotation: [-0.75, 0, 0],
    name: 'windshield-glass',
  });
  g.add(wMesh);

  // Structural Roll Hoop behind headrests
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

  return g;
}

// -----------------------------------------------------------------------------------------
//  3D Wheels & Brakes: Detailed Alloy Rims, Radial Tyres & Brembo Calipers
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

    // 1. Lathed Tyre with Rounded Shoulders and Realistic Tread
    const rimRadius = wc.r * 0.68;
    const tyreProfile = [
      { r: rimRadius, y: -wc.w / 2 },
      { r: wc.r * 0.94, y: -wc.w / 2 * 0.95 },
      { r: wc.r, y: -wc.w / 2 * 0.70 },
      { r: wc.r, y: wc.w / 2 * 0.70 },
      { r: wc.r * 0.94, y: wc.w / 2 * 0.95 },
      { r: rimRadius, y: wc.w / 2 },
    ];
    const tyreGeo = lathe(tyreProfile, { segments: 32 });
    tyreGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(tyreGeo, mats.tyreRubber, { name: 'tyre' }));

    // 2. Alloy Wheel Rim
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wc.w * 0.88, 24, 1, true);
    rimGeo.rotateZ(Math.PI / 2);
    wGroup.add(mesh(rimGeo, mats.chromeTrim, { name: 'rim-barrel' }));

    // 10-Spoke Alloy Face
    const spokeParts = [];
    const sx = isLeft ? -wc.w * 0.44 : wc.w * 0.44;
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * Math.PI * 2;
      spokeParts.push({
        geometry: new THREE.BoxGeometry(0.018, rimRadius * 0.84, 0.024),
        matrix: mat4([sx, Math.sin(ang) * rimRadius * 0.44, Math.cos(ang) * rimRadius * 0.44], [ang, 0, 0]),
      });
    }
    // Center Hub Cap
    spokeParts.push({
      geometry: new THREE.CylinderGeometry(0.046, 0.046, 0.02, 16),
      matrix: mat4([isLeft ? -wc.w * 0.46 : wc.w * 0.46, 0, 0], [0, 0, Math.PI / 2]),
    });
    wGroup.add(mesh(mergeAll(spokeParts), M.alumDark || mats.chromeTrim, { name: 'spokes' }));

    // 3. Ventilated Disc Brake Rotor & Red Brembo Caliper
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
//  Cockpit Interior, Sculpted Bucket Seats & Easter Eggs
// -----------------------------------------------------------------------------------------
function buildInterior(mats, M, texDontPanic, texPcb) {
  const g = new THREE.Group();
  g.name = 'interior';

  // Interior floor tub
  const floorGeo = new THREE.BoxGeometry(1.30, 0.04, 1.25);
  g.add(mesh(floorGeo, mats.blackTrim, { position: [0, 0.18, -0.15] }));

  // Center console / transmission tunnel
  const tunnelGeo = new THREE.BoxGeometry(0.18, 0.22, 1.10);
  g.add(mesh(tunnelGeo, mats.blackTrim, { position: [0, 0.30, -0.15] }));

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

    // Integrated headrest
    const headrest = new THREE.BoxGeometry(0.24, 0.18, 0.08);
    seat.add(mesh(headrest, mats.blackTrim, {
      position: [0, 0.88, -0.55],
      rotation: [-0.34, 0, 0],
    }));

    g.add(seat);
  }

  // Sculpted Dashboard
  const dashGroup = new THREE.Group();
  dashGroup.position.set(0, 0.66, 0.32);

  // Main contoured dashboard wing
  const dashBody = new THREE.BoxGeometry(1.28, 0.18, 0.28);
  dashGroup.add(mesh(dashBody, mats.blackTrim));

  // Instrument binnacle cowl (in front of driver at x = -0.35)
  const cowlGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.20, 16, 1, false, 0, Math.PI);
  cowlGeo.rotateX(Math.PI / 2);
  dashGroup.add(mesh(cowlGeo, mats.blackTrim, { position: [-0.35, 0.10, -0.02] }));

  // 4 Round aluminum air conditioning vents
  for (const vx of [-0.48, -0.20, 0.20, 0.48]) {
    dashGroup.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.015, 16), mats.chromeTrim, {
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
  // Center metallic horn boss
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), mats.chromeTrim, { rotation: [Math.PI / 2, 0, 0] }));
  // 3 Spokes with perforated lightening holes
  for (const ang of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
    wheelGroup.add(mesh(new THREE.BoxGeometry(0.13, 0.022, 0.008), mats.chromeTrim, {
      position: [Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0],
      rotation: [0, 0, ang],
    }));
  }
  // Steering column
  wheelGroup.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 12), mats.blackTrim, {
    position: [0, 0, 0.12],
    rotation: [Math.PI / 2, 0, 0],
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

  // Miniature red car body
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
//  Starman Mannequin: Organic Sculpted Spacesuit & Natural Driver Pose
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

  // 2. Legs: Bent naturally at knees towards the pedals
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const lx = sx + s * 0.11;
    // Thigh extending forward
    leg.add(mesh(new THREE.CylinderGeometry(0.070, 0.062, 0.42, 12), starmanSuitWhite, {
      position: [lx, 0.36, -0.05],
      rotation: [1.32, 0, 0],
    }));
    // Shin extending down to floor pedals
    leg.add(mesh(new THREE.CylinderGeometry(0.060, 0.052, 0.38, 12), starmanSuitWhite, {
      position: [lx, 0.22, 0.22],
      rotation: [0.42, 0, 0],
    }));
    // Flight boots
    leg.add(mesh(new THREE.BoxGeometry(0.09, 0.08, 0.20), blackTrim, {
      position: [lx, 0.20, 0.36],
      rotation: [0.15, 0, 0],
    }));
    g.add(leg);
  }

  // 3. Right Arm: Reaching forward to grip the steering wheel at 2 o'clock
  const rightArm = new THREE.Group();
  rightArm.name = 'right-arm-steering';
  // Upper arm
  rightArm.add(mesh(new THREE.CylinderGeometry(0.054, 0.046, 0.30, 12), starmanSuitWhite, {
    position: [sx + 0.14, 0.64, -0.14],
    rotation: [1.15, -0.22, -0.45],
  }));
  // Forearm reaching to rim
  rightArm.add(mesh(new THREE.CylinderGeometry(0.046, 0.040, 0.28, 12), starmanSuitWhite, {
    position: [sx + 0.06, 0.68, 0.02],
    rotation: [1.35, -0.35, -0.75],
  }));
  // Right glove gripping steering wheel
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
  // Shoulder extending to door
  leftArm.add(mesh(new THREE.CylinderGeometry(0.056, 0.050, 0.32, 12), starmanSuitWhite, {
    position: [sx - 0.20, 0.66, -0.22],
    rotation: [0.32, 0, 1.15],
  }));
  // Forearm resting flat along the upper door sill (x ≈ -0.78, y ≈ 0.73)
  leftArm.add(mesh(new THREE.CylinderGeometry(0.050, 0.044, 0.36, 12), starmanSuitWhite, {
    position: [sx - 0.44, 0.74, -0.10],
    rotation: [1.52, 0, 0.12],
  }));
  // Left glove draped forward
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

  // Continuous Seamless Parametric Body Components
  const bodyShell = buildSeamlessBodyShell(mats, M);
  const headlights = buildHeadlights(mats, M);
  const taillights = buildTaillights(mats, M);
  const glassAndHoop = buildWindshieldAndRollHoop(mats, M);

  // Mechanicals & Occupant
  const wheels = buildWheels(mats, M);
  const interior = buildInterior(mats, M, texDontPanic, texPcb);
  const starman = buildStarman(mats, M);
  const adapter = buildPayloadAdapter(mats, M);

  // Underbody composite plate
  const underbody = mesh(new THREE.BoxGeometry(1.64, 0.04, 3.82), mats.blackTrim, {
    position: [0, 0.14, 0],
    name: 'underbody-tray',
  });

  bodyShell.add(headlights);
  bodyShell.add(taillights);
  bodyShell.add(glassAndHoop);
  bodyShell.add(underbody);

  root.add(bodyShell);
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
