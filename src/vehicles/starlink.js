/**
 * Starlink V2 Mini. Public figures: bus ≈4.1 m wide, ≈800 kg, two solar wings, ≈30 m span,
 * ≈116 m² total area, argon Hall thrusters, laser links, phased-array antennas (Spaceflight Now,
 * SpaceNews, FCC filings via press). No official drawing exists: bus thickness, antenna count,
 * laser-terminal and thruster placement are reconstructed from deployment imagery.
 * Local frame: bus centred at origin, nadir face = −Y, wings along ±X.
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';

const BUS_W = 2.7;   // along X (approx, derived)
const BUS_L = 4.1;   // along Z (press)
const BUS_T = 0.48;  // structural depth, approximate; the published figure is the 30 m span
// Sized so the deployed span is exactly the published 30 m: (30 − 2.7)/2 − 0.55 yoke.
const WING_L = 13.1;
const WING_W = 4.1;

export function buildStarlink(M) {
  const g = new THREE.Group();
  g.name = 'starlink';

  // ---- Bus ----
  const bus = new THREE.BoxGeometry(BUS_W, BUS_T, BUS_L, 1, 1, 1);
  g.add(mesh(bus, M.aluminum, { name: 'bus' }));
  // Zenith face: white multi-layer insulation with the usual gold-taped seams. Photographs
  // of a deployed V2 Mini show a mostly white blanket, not the gold of a deep-space bus.
  g.add(mesh(new THREE.BoxGeometry(BUS_W - 0.01, 0.02, BUS_L - 0.01), M.mliWhite, { position: [0, BUS_T / 2 + 0.011, 0] }));
  // Structural frame round the deck, and the ribs under the blanket. The zenith side is the
  // face a visitor standing beside the exhibit looks down on, and a bare white slab says
  // nothing about its size. The frame used to stand 3.5 cm ABOVE the blanket on all four
  // edges, which turned the flat-pack bus into an open tray with the blanket lying in the
  // bottom of it. A flat-pack satellite's deck is a panel whose edge closeouts run down the
  // sides; the rails are there now, flush with the top, and the blanket runs to the edge.
  {
    const frame = [];
    const RAIL_H = 0.06, RAIL_T = 0.022, top = BUS_T / 2 + 0.021;
    for (const s of [-1, 1]) {
      frame.push({ geometry: new THREE.BoxGeometry(RAIL_T, RAIL_H, BUS_L + 2 * RAIL_T), matrix: mat4([s * (BUS_W / 2 + RAIL_T / 2), top - RAIL_H / 2, 0]) });
      frame.push({ geometry: new THREE.BoxGeometry(BUS_W, RAIL_H, RAIL_T), matrix: mat4([0, top - RAIL_H / 2, s * (BUS_L / 2 + RAIL_T / 2)]) });
    }
    // Cross ribs, pressing through the blanket by a centimetre: the quilting, not a beam.
    for (const z of [-1.0, 0, 1.0]) {
      frame.push({ geometry: new THREE.BoxGeometry(BUS_W - 0.14, 0.014, 0.05), matrix: mat4([0, top + 0.004, z]) });
    }
    g.add(mesh(mergeAll(frame), M.alumDark, { name: 'bus-frame' }));
  }
  // Kapton tape over the blanket's seams: 25 mm of foil, not a structural member. At 50 mm
  // in a full grid it read as a set of brown beams laid across the deck and became the
  // loudest thing on the satellite.
  const tape = [];
  for (const z of [-1.62, 1.62]) tape.push({ geometry: new THREE.BoxGeometry(BUS_W - 0.2, 0.004, 0.025), matrix: mat4([0, BUS_T / 2 + 0.023, z]) });
  g.add(mesh(mergeAll(tape), M.goldKapton, { castShadow: false, name: 'bus-tape' }));
  // Avionics and propellant boxes on the zenith deck.
  {
    const boxes = [];
    for (const [x, z, w, l, h] of [[-0.85, -1.15, 0.5, 0.42, 0.16], [0.8, -0.3, 0.36, 0.6, 0.13], [-0.7, 1.3, 0.44, 0.5, 0.11]]) {
      boxes.push({ geometry: new THREE.BoxGeometry(w, h, l), matrix: mat4([x, BUS_T / 2 + 0.03 + h / 2, z]) });
    }
    g.add(mesh(mergeAll(boxes), M.mliWhite, { name: 'bus-avionics' }));
  }
  // Nadir face: dark radome/antenna deck
  g.add(mesh(new THREE.BoxGeometry(BUS_W - 0.06, 0.02, BUS_L - 0.06), M.blackMatte, { position: [0, -BUS_T / 2 - 0.01, 0] }));
  // Phased-array antennas (nadir): three large user-link arrays + two smaller gateway arrays (approx)
  const arrays = [];
  const big = [[0, -1.35], [0, 0], [0, 1.35]];
  for (const [x, z] of big) arrays.push({ geometry: new THREE.BoxGeometry(1.2, 0.06, 1.2), matrix: mat4([x, -BUS_T / 2 - 0.05, z]) });
  for (const [x, z] of [[-1.0, -1.7], [1.0, 1.7], [-1.0, 1.7], [1.0, -1.7]]) arrays.push({ geometry: new THREE.CylinderGeometry(0.28, 0.28, 0.08, 32), matrix: mat4([x, -BUS_T / 2 - 0.05, z]) });
  for (const [x, z] of [[-0.9, 0], [0.9, 0]]) arrays.push({ geometry: new THREE.BoxGeometry(0.55, 0.06, 0.9), matrix: mat4([x, -BUS_T / 2 - 0.05, z]) });
  g.add(mesh(mergeAll(arrays), M.blackGloss, { name: 'phased-arrays' }));
  // Antenna surface detail: fine grid of patch elements on the large arrays
  const patches = [];
  for (const [x, z] of big) for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    patches.push({ geometry: new THREE.BoxGeometry(0.11, 0.01, 0.11), matrix: mat4([x - 0.53 + i * 0.152, -BUS_T / 2 - 0.085, z - 0.53 + j * 0.152]) });
  }
  g.add(mesh(mergeAll(patches), M.alumDark, { castShadow: false, name: 'array-patches' }));
  // Radiator strips on the long edges of the bus, and the harness that ties the
  // arrays back to the avionics. Reconstructed from deployment imagery.
  const rads = [];
  for (const x of [-BUS_W / 2 + 0.08, BUS_W / 2 - 0.08]) {
    rads.push({ geometry: new THREE.BoxGeometry(0.06, 0.02, BUS_L - 0.4), matrix: mat4([x, BUS_T / 2 + 0.02, 0]) });
  }
  rads.push({ geometry: new THREE.CylinderGeometry(0.012, 0.012, BUS_L - 0.5, 6), matrix: mat4([0.4, -BUS_T / 2 - 0.04, 0], [Math.PI / 2, 0, 0]) });
  g.add(mesh(mergeAll(rads), M.radiator, { name: 'bus-radiators' }));

  // Laser inter-satellite link terminals (3): small gimballed turrets on the zenith side edges
  // Built as a gimbal rather than a ball on a stick: a fixed base, a yoke that rotates in
  // azimuth, and the optical head swinging in elevation between its arms. A sphere with a
  // lens glued to it is the single crudest thing on the satellite at close range.
  for (const [x, z, rot] of [[-1.05, -1.75, 0.6], [1.05, -1.75, -0.6], [0, 1.85, Math.PI]]) {
    const t = new THREE.Group();
    t.name = 'laser-terminal';
    t.add(mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.1, 24), M.alumDark, { position: [0, 0.05, 0] }));
    t.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), M.aluminum, { position: [0, 0.15, 0] }));
    // Yoke arms.
    for (const sx of [-1, 1]) {
      t.add(mesh(new THREE.BoxGeometry(0.05, 0.26, 0.14), M.aluminum, { position: [sx * 0.16, 0.3, 0] }));
    }
    t.add(mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.22, 24), M.alumDark, { position: [0, 0.36, 0], rotation: [0, 0, Math.PI / 2] }));
    t.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 20), M.blackMatte, { position: [0, 0.36, 0.14], rotation: [Math.PI / 2, 0, 0] }));
    t.add(mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.02, 20), M.lens, { position: [0, 0.36, 0.245], rotation: [Math.PI / 2, 0, 0] }));
    // Harness run down to the deck.
    t.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), M.blackMatte, { position: [0.1, 0.16, -0.14], rotation: [0.4, 0, 0] }));
    t.position.set(x, BUS_T / 2, z);
    t.rotation.y = rot;
    g.add(t);
  }
  // Star trackers (2) and GNSS patch. Each gets a mounting block: a baffle tube canted off
  // the deck with nothing under it reads as a tube someone dropped there.
  for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6]]) {
    const tilt = x > 0 ? -0.5 : 0.5;
    const st = new THREE.Group();
    st.name = 'star-tracker';
    st.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), M.alumDark, { position: [x, BUS_T / 2 + 0.05, z] }));
    st.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.32, 16), M.blackMatte, { position: [x, BUS_T / 2 + 0.22, z], rotation: [0.5, 0, tilt] }));
    st.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 16), M.lens, { position: [x + Math.sin(-tilt) * 0.15, BUS_T / 2 + 0.36, z + 0.08], rotation: [0.5, 0, tilt] }));
    g.add(st);
  }
  g.add(mesh(new THREE.BoxGeometry(0.25, 0.03, 0.25), M.aluminum, { position: [0, BUS_T / 2 + 0.03, -0.6], name: 'gnss-patch' }));
  // Argon Hall thruster on the −Z edge, firing along −Z. Built as the thing a Hall thruster
  // is: a short drum whose exit face is an annular discharge channel in white ceramic between
  // an inner and an outer magnetic pole, with the hollow cathode on the axis. It was a copper
  // doughnut on a dark disc. Size and mounting are reconstructed; the type is published.
  const thr = new THREE.Group();
  thr.name = 'hall-thruster';
  const face = -0.075;                                   // exit plane, local z
  thr.add(mesh(new THREE.CylinderGeometry(0.155, 0.165, 0.15, 36), M.darkMetal, { rotation: [Math.PI / 2, 0, 0] }));
  thr.add(mesh(new THREE.RingGeometry(0.068, 0.118, 40), M.radiator, { position: [0, 0, face - 0.002], rotation: [0, Math.PI, 0], name: 'hall-channel' }));
  thr.add(mesh(new THREE.TorusGeometry(0.136, 0.018, 8, 40), M.alumDark, { position: [0, 0, face - 0.004] }));
  thr.add(mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.012, 28), M.darkMetal, { position: [0, 0, face - 0.006], rotation: [Math.PI / 2, 0, 0] }));
  thr.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 14), M.aluminum, { position: [0, 0, face - 0.03], rotation: [Math.PI / 2, 0, 0], name: 'hall-cathode' }));
  thr.add(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.2), M.alumDark, { position: [0, 0, 0.15] }));
  thr.position.set(0, 0, -BUS_L / 2 - 0.12);
  g.add(thr);
  // No argon tank on the deck. A white dome stood there, next to the thruster label, and read
  // as the thruster itself; on a flat-pack bus the propellant vessel is inside the 0.48 m
  // structure with everything else, and nothing in the deployment imagery shows it outside.

  // ---- Solar wings (2) ----
  const panels = 6; // accordion-folded segments (approx)
  const segL = WING_L / panels;
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.name = s < 0 ? 'wing-left' : 'wing-right';
    // Yoke/boom from bus edge to the first panel
    wing.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.35), M.alumDark, { position: [s * 0.25, 0, 0] }));
    wing.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, WING_W - 0.4, 12), M.aluminum, { position: [s * 0.5, 0, 0], rotation: [Math.PI / 2, 0, 0] }));
    // Panels are separated by a real gap, not a butt joint. At 6 cm the segments merged into
    // one 13 m plane and the wing read as a single sheet of graph paper; the whole point of
    // an accordion array is that you can see it is an accordion.
    const GAP = 0.13;
    const hinges = [], backs = [];
    // Root pin where the accordion leaves the bus. Reconstructed mechanism.
    hinges.push({
      geometry: new THREE.CylinderGeometry(0.07, 0.07, 0.62, 10),
      matrix: mat4([s * 0.48, 0, 0], [Math.PI / 2, 0, 0]),
    });
    for (let i = 0; i < panels; i++) {
      const x = s * (0.55 + segL * (i + 0.5));
      wing.add(mesh(new THREE.BoxGeometry(segL - GAP, 0.028, WING_W - 0.06), M.solarStarlink, { position: [x, 0, 0], name: 'wing-panel' }));
      // Backside substrate, slightly larger and darker, so the wing has a front and a back.
      backs.push({ geometry: new THREE.BoxGeometry(segL - GAP + 0.03, 0.022, WING_W - 0.02), matrix: mat4([x, -0.026, 0]) });
      // Hinge line between segments: two knuckles and the pin between them, at each edge.
      if (i < panels - 1) {
        const hx = s * (0.55 + segL * (i + 1));
        hinges.push({ geometry: new THREE.CylinderGeometry(0.028, 0.028, WING_W - 0.1, 8), matrix: mat4([hx, 0, 0], [Math.PI / 2, 0, 0]) });
        for (const z of [-(WING_W / 2 - 0.35), 0, WING_W / 2 - 0.35]) {
          hinges.push({ geometry: new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10), matrix: mat4([hx, 0, z], [Math.PI / 2, 0, 0]) });
        }
      }
    }
    wing.add(mesh(mergeAll(backs), M.alumDark, { castShadow: false, name: 'wing-substrate' }));
    wing.add(mesh(mergeAll(hinges), M.aluminum, { name: 'wing-hinges' }));
    // Edge stiffener beams along the wing, and a longeron down its spine: a 13 m array with
    // nothing running the length of it looks like it would fold in half.
    const beams = [];
    for (const z of [-(WING_W / 2 - 0.02), WING_W / 2 - 0.02]) {
      beams.push({ geometry: new THREE.BoxGeometry(WING_L, 0.05, 0.04), matrix: mat4([s * (0.55 + WING_L / 2), 0, z]) });
    }
    beams.push({ geometry: new THREE.BoxGeometry(WING_L, 0.09, 0.07), matrix: mat4([s * (0.55 + WING_L / 2), -0.055, 0]) });
    wing.add(mesh(mergeAll(beams), M.aluminum, { name: 'wing-beams' }));
    wing.position.x = s * (BUS_W / 2);
    g.add(wing);
  }

  // ---- Level of detail --------------------------------------------------------------------
  // A 30 m span of which almost everything is centimetres thick. In the museum row the wings
  // are an edge-on line and the bus is a tile, and all of this was being drawn: 192 patch
  // elements 11 cm across, three gimballed laser turrets with their harness runs, two star
  // trackers, the avionics boxes, the frame ribs pressing through the blanket, the 25 mm tape
  // over the seams, the hinge knuckles at every panel joint and the substrate behind them.
  //
  // What stays is what the satellite IS from any distance: the bus, its blankets, the black
  // phased-array face and the wings themselves.
  const FINE = {
    'bus-frame': 0.03, 'bus-avionics': 0.09, 'bus-tape': 0.025, 'array-patches': 0.11,
    'laser-terminal': 0.045, 'star-tracker': 0.035, 'gnss-patch': 0.03,
    'wing-hinges': 0.03, 'wing-substrate': 0.06, 'wing-beams': 0.05,
    'bus-radiators': 0.04, 'hall-thruster': 0.04,
  };
  g.traverse((o) => { const f = FINE[o.name]; if (f) o.userData.lodFeature = f; });

  // How far the satellite stands above its mount, which for a spacecraft displayed lying flat
  // is the thickness of its bus. Not 4.1 m: that is BUS_L, the bus's long horizontal side, and
  // putting it here would claim a satellite standing four metres tall on the plinth.
  g.userData.height = BUS_T;
  g.userData.footprint = BUS_W + 2 * (0.55 + WING_L);
  g.userData.span = BUS_W + 2 * (0.55 + WING_L);
  g.userData.annotations = [
    { label: 'Bus (≈4.1 m wide)', position: [0, BUS_T + 0.4, 0] },
    { label: 'Phased-array antennas (nadir face)', position: [0, -0.7, 0] },
    { label: 'Inter-satellite laser terminal', position: [-1.05, 0.75, -1.75] },
    { label: 'Argon Hall thruster', position: [0, 0.1, -BUS_L / 2 - 0.9] },
    { label: `Solar wing · ≈${WING_L.toFixed(1)} m × ${WING_W.toFixed(1)} m`, position: [-(BUS_W / 2 + 0.55 + WING_L / 2), 0.4, 0] },
    { label: 'Star trackers', position: [0.6, 0.65, 0.6] },
  ];
  return g;
}
