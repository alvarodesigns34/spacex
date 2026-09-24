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

  // Tints over the concrete map (whose mean is a mid grey): slab, asphalt, swale, paint.
  // The same rectangles, as a plan, for the HUD's site map.
  g.userData.plan = [
    { kind: 'apron', x0: -178, z0: -18, x1: 188, z1: 20 },
    { kind: 'road', x0: -186, z0: 24, x1: 196, z1: 31.2 },
    { kind: 'road', x0: 46, z0: -120, x1: 53, z1: 31.2 },
    { kind: 'road', x0: 36, z0: -121, x1: 63, z1: -109 },
  ];
  const apron = [
    painted(quad(-178, -18, 188, 20, 0.012), 0xe2dccf),
    // Asphalt tint a touch warm: a neutral grey under the blue skylight read as navy.
    painted(quad(-186, 24, 196, 31.2, 0.02), 0x7b7872),
    // The access road runs to the toe of the pad's embankment and ends in a turning apron
    // there. It used to carry on to z = −150 and vanish under the berm into the pad.
    painted(quad(46, -120, 53, 31.2, 0.02), 0x7b7872),
    painted(quad(36, -121, 63, -109, 0.021), 0x7b7872),
    painted(quad(-186, 31.2, 196, 32.4, 0.016), 0x5a5046),
  ];
  for (let x = -180; x < 190; x += 8) {
    // Flat paint, not an 8 mm box: the box's sides carried no area in a ground-plane mapping.
    const dash = quad(x - 1.1, 27.54, x + 1.1, 27.66, 0.03);
    apron.push(painted(dash, 0xfff0a0));
  }
  // Metric UVs in the ground plane, as every map in the project expects.
  for (const geo of apron) {
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = -p.getZ(i); }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  g.add(mesh(mergeGeometries(apron, false), M.campusGround, {
    name: 'campus-apron', castShadow: false,
  }));

  // Low dunes. They were flattened spheres standing on their bottom pole: the widest part of
  // each sat a third of a metre ABOVE the ground with a dark lip under it, in a flat khaki of
  // its own, so every dune read as a coin laid on the plain. A dune rises out of the ground
  // it is made of. These are raised-cosine mounds whose edge is tangent to the plain and sunk
  // a few centimetres into it, built in world space with metric UVs and drawn with the
  // terrain's own material — same grain, same landscape noise — so the only thing that marks
  // one is its shape in the light, plus a slight sandy lift on the crest carried in vertex
  // colour and fading to exactly the plain's value at the rim. Ten mounds, one draw.
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
  const RINGS = 9, SEGS = 28, SINK = 0.04;
  const duneParts = [];
  duneSpec.forEach(([cx, cz, radius, h], d) => {
    const n = 1 + RINGS * SEGS;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    const idx = [];
    // A slightly irregular rim, so ten mounds are not ten copies of one ellipse.
    const wob = (a) => 1 + 0.12 * Math.sin(a * 3 + d * 1.7) + 0.06 * Math.sin(a * 5 - d);
    const put = (k, x, z, t) => {
      // Raised cosine: flat on top, tangent to the plain at the rim, then sunk a little so
      // the rim cannot z-fight the ground it grows out of.
      const y = h * 0.62 * (0.5 + 0.5 * Math.cos(Math.PI * t)) - SINK;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = x; uv[k * 2 + 1] = -z;
      const lift = 1 + 0.07 * (1 - t) * (1 - t);
      col[k * 3] = lift; col[k * 3 + 1] = lift * 0.99; col[k * 3 + 2] = lift * 0.95;
    };
    put(0, cx, cz, 0);
    for (let j = 1; j <= RINGS; j++) {
      const t = j / RINGS;
      for (let i = 0; i < SEGS; i++) {
        const a = (i / SEGS) * Math.PI * 2;
        const w = wob(a);
        put(1 + (j - 1) * SEGS + i, cx + Math.cos(a) * radius * t * w, cz + Math.sin(a) * radius * 0.72 * t * w, t);
      }
    }
    for (let i = 0; i < SEGS; i++) idx.push(0, 1 + ((i + 1) % SEGS), 1 + i);
    for (let j = 1; j < RINGS; j++) {
      const a0 = 1 + (j - 1) * SEGS, b0 = 1 + j * SEGS;
      for (let i = 0; i < SEGS; i++) {
        const i1 = (i + 1) % SEGS;
        idx.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    // Normals while still indexed, so the mound shades smoothly; after de-indexing each
    // triangle would get its own normal and the dune would come out faceted.
    geo.computeVertexNormals();
    duneParts.push(geo.toNonIndexed());
  });
  if (duneParts.length) {
    const duneGeo = mergeGeometries(duneParts, false);
    g.add(mesh(duneGeo, M.terrain, { name: 'campus-berms', castShadow: false }));
  }

  // Salt-flat scrub: low, rounded clumps of coastal brush, instanced. They were three crossed
  // 0.4 × 0.7 m planes, which from any distance read as bright green posts standing on the
  // plain. A clump is a lumpy, flattened dome, olive-brown, wider than it is tall, sitting
  // down in the ground, and lit from the sky above rather than as a flat card.
  const scrubGeo = (() => {
    const geo = new THREE.IcosahedronGeometry(0.5, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.22 * Math.sin(x * 9.1 + z * 4.3) * Math.cos(y * 7.7 - x * 3.1) + 0.12 * Math.sin(z * 13.0 + y * 5.0);
      p.setXYZ(i, x * k, Math.max(-0.12, y * 0.62 * k), z * k);
    }
    geo.translate(0, 0.06, 0);
    geo.computeVertexNormals();
    return geo;
  })();
  const spots = [];
  const scrubCount = 140;
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
    const s = 0.6 + spots[i + 2] * 1.9;
    dummy.position.set(spots[i], 0, spots[i + 1]);
    dummy.scale.set(s * (0.8 + spots[i + 2] * 0.5), s * (0.55 + spots[i + 2] * 0.35), s);
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
