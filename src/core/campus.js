/**
 * Coastal campus around the exhibits. It is not a survey of Starbase and it must
 * not be read as one. Four kinds of geometry live here:
 *
 *  - observed infrastructure: none. SpaceX publishes no plan of the ground between
 *    the museum row and Pad 2, and none of these meshes claim to be that plan.
 *  - reconstruction from references: none in this file. The Pad 2 tower, mount,
 *    trench and tank farm are built in pad.js from cited and photogrammetric figures.
 *  - plausible environmental context: the salt-flat colour, low dunes and scrub,
 *    which match the coastal plain at Boca Chica in kind (flat, pale, sparse) and
 *    not in surveyed position.
 *  - non-structural dressing: the gravel terrace, the visitor road and its centre
 *    line, the drainage swale, and the three service trucks. They give scale.
 *    They are not roads, drains or vehicles that exist at those coordinates.
 *
 * Coordinates follow the exhibit row in main.js (z = 0, x = −153…163) and leave
 * Pad 2, at world (0, −185), on its own deck.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, mergeAll, mat4, boxUV } from '../geometry/utils.js';

function quad(x0, z0, x1, z1, y) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

/** One material for the whole apron. Colour is per vertex so the terrace, road,
 *  dashes and swale are a single draw instead of four. */
function painted(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * Parked service truck, axis along Z, wheels rolled about X. Museum furniture:
 * not a specific vehicle, and not flight hardware.
 */
function truckParts(x, z, yaw) {
  const body = [];
  const wheels = [];
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const wheelQ = yawQ.clone().multiply(rollQ);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const place = (list, geometry, lx, ly, lz, quat) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x + lx * c + lz * s, ly, z - lx * s + lz * c),
      quat,
      new THREE.Vector3(1, 1, 1),
    );
    list.push({ geometry, matrix: m });
  };
  place(body, new THREE.BoxGeometry(2.05, 0.7, 4.7), 0, 0.64, 0, yawQ);
  place(body, new THREE.BoxGeometry(1.85, 0.62, 1.55), 0, 1.22, -1.15, yawQ);
  place(body, new THREE.BoxGeometry(1.95, 0.22, 1.3), 0, 1.02, 1.25, yawQ);
  for (const [wx, wz] of [[1.02, 1.5], [-1.02, 1.5], [1.02, -1.5], [-1.02, -1.5]]) {
    place(wheels, new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), wx, 0.34, wz, wheelQ);
  }
  return { body, wheels };
}

/**
 * @param {import('three').Scene} scene
 * @param {Record<string, import('three').Material>} M
 */
export function dressCampus(scene, M) {
  const g = new THREE.Group();
  g.name = 'campus';
  g.userData.provenance = 'environmental-reconstruction';

  M.campusGround.polygonOffset = true;
  M.campusGround.polygonOffsetFactor = -2;
  M.campusGround.polygonOffsetUnits = -2;

  const apron = [
    painted(quad(-178, -18, 188, 20, 0.012), 0x8d8474),
    painted(quad(-186, 24, 196, 31.2, 0.02), 0x4a4e54),
    painted(quad(46, -150, 53, 31.2, 0.02), 0x4a4e54),
    painted(quad(-186, 31.2, 196, 32.4, 0.016), 0x3a332c),
  ];
  for (let x = -180; x < 190; x += 8) {
    const dash = new THREE.BoxGeometry(2.2, 0.008, 0.12);
    dash.applyMatrix4(mat4([x, 0.03, 27.6]));
    apron.push(painted(dash, 0xd7c36a));
  }
  g.add(mesh(mergeGeometries(apron, false), M.campusGround, {
    name: 'campus-apron', castShadow: false,
  }));

  // Low dunes, not crates. One flattened sphere, instanced, off the row and the pad.
  const duneGeo = new THREE.SphereGeometry(1, 14, 10);
  duneGeo.scale(1, 0.28, 1);
  const duneSpec = [
    [-210, 70, 18, 1.3],
    [40, 95, 14, 0.9],
    [210, 48, 16, 1.5],
    [-90, 120, 20, 1.0],
    [130, -90, 15, 1.2],
    [-170, -80, 13, 0.8],
    [250, -40, 22, 0.7],
    [-240, 20, 17, 1.1],
    [80, 160, 19, 0.85],
    [-40, -140, 12, 1.4],
  ].filter(([x, z]) => Math.hypot(x, z + 185) >= 140);
  const dunes = new THREE.InstancedMesh(duneGeo, M.berm, duneSpec.length);
  dunes.name = 'campus-berms';
  dunes.castShadow = false;
  dunes.receiveShadow = true;
  const dune = new THREE.Object3D();
  duneSpec.forEach(([x, z, radius, h], i) => {
    dune.position.set(x, 0.28 * h, z);
    dune.scale.set(radius, h, radius * 0.72);
    dune.updateMatrix();
    dunes.setMatrixAt(i, dune.matrix);
  });
  dunes.instanceMatrix.needsUpdate = true;
  g.add(dunes);

  // Salt-flat scrub. One cone, instanced, outside the terrace and the pad.
  const blades = [];
  for (const yaw of [0, 1.05, 2.1]) {
    const blade = new THREE.PlaneGeometry(0.42, 0.72);
    blade.translate(0, 0.36, 0);
    blade.rotateY(yaw);
    blades.push(blade);
  }
  const scrubGeo = mergeGeometries(blades, false);
  const spots = [];
  const scrubCount = 72;
  let seed = 17;
  let guard = 0;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
  while (spots.length < scrubCount * 3 && guard < 4000) {
    guard++;
    const x = -240 + rnd() * 500;
    const z = -80 + rnd() * 220;
    const onRow = z > -22 && z < 36 && x > -190 && x < 200;
    const onPad = Math.hypot(x, z + 185) < 150;
    if (onRow || onPad) continue;
    spots.push(x, z, rnd());
  }
  const scrub = new THREE.InstancedMesh(scrubGeo, M.scrub, spots.length / 3);
  scrub.name = 'campus-scrub';
  scrub.castShadow = false;
  scrub.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < spots.length; i += 3) {
    const s = 0.4 + spots[i + 2] * 1.8;
    dummy.position.set(spots[i], 0, spots[i + 1]);
    dummy.scale.set(s * (0.7 + spots[i + 2] * 0.6), 0.45 + spots[i + 2] * 1.35, s);
    dummy.rotation.y = spots[i + 2] * 6;
    dummy.updateMatrix();
    scrub.setMatrixAt(i / 3, dummy.matrix);
  }
  scrub.instanceMatrix.needsUpdate = true;
  g.add(scrub);

  // Three service trucks on the road shoulder. They are scale furniture.
  const bodies = [];
  const wheels = [];
  for (const [x, z, yaw] of [[-168, 34.4, 0], [172, 34.8, Math.PI], [62, 36.8, Math.PI / 2]]) {
    const t = truckParts(x, z, yaw);
    bodies.push(...t.body);
    wheels.push(...t.wheels);
  }
  g.add(mesh(boxUV(mergeAll(bodies)), M.service, { name: 'campus-trucks', castShadow: true }));
  g.add(mesh(boxUV(mergeAll(wheels)), M.boot, { name: 'campus-truck-wheels', castShadow: true }));

  scene.add(g);
  return g;
}
