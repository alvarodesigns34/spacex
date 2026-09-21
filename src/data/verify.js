/**
 * Dimensional consistency check.
 *
 * The data sheet in specs.js publishes figures; the builders in vehicles/ turn numbers into
 * geometry. Nothing structurally stops the two from drifting apart, so this module measures
 * what was actually built — world-space bounding boxes of each exhibit's model — and compares
 * it against the declared height and footprint. It runs on demand (`window.__vc.verify()`)
 * and automatically when the page is loaded with `?verify`.
 */
import * as THREE from 'three';

const TOL = 0.02;   // 2 % — enough slack for antennas, pins and hinge fairings

/** Declared reference dimensions, keyed by vehicle id. Sources are cited in specs.js. */
export const EXPECTED = {
  falcon1: { height: 21.336, footprint: 1.6764, note: 'SpaceX Falcon 1 User Guide 2008, 70 ft × 5.5 ft' },
  starship: { height: 124, footprint: 9, note: 'Altura del apilado y diámetro (spacex.com)' },
  falcon9: { height: 70, footprint: 5.2, note: 'Altura total y diámetro de cofia (spacex.com)' },
  falconheavy: { height: 70, footprint: 12.2, note: 'Altura y anchura (spacex.com)' },
  dragon: { height: 8.1, footprint: 4, note: 'Altura con trunk y diámetro máximo (spacex.com)' },
  starlink: { height: null, footprint: 30, note: 'Envergadura desplegada (prensa)', tol: 0.06 },
  roadster: {
    height: 1.128, footprint: 3.947, breadth: 1.852, tol: 0.025, fromHull: true,
    note: 'Altura al techo del parabrisas, longitud y anchura de carrocería (publicado)',
  },
  // The engine stands are measured on the Raptor Vacuum, the tallest of the three: 4,4 m of
  // engine and a 2,3 m exit plane, both publicados en spacex.com. Se mide el tamaño del casco,
  // no su cota superior, porque el motor se apoya en una cuna a 0,34 m del suelo.
  engines: {
    height: 4.4, footprint: 2.3, tol: 0.02, fromHullSize: true,
    note: 'Raptor Vacuum: altura y diámetro de salida (spacex.com)',
  },
};

/**
 * Published part counts, checked against what the builders actually placed.
 *
 * A dimension that drifts shows up in a render; a count does not — nobody looks at a capsule
 * and sees twenty thrusters where the label beside it says sixteen, which is exactly what this
 * scene shipped until the count was measured. Each entry names a `userData` key the builders
 * set; the value is summed over the whole exhibit, so a vehicle that places its engines in
 * three rings still reports one number.
 */
export const COUNTS = {
  falcon1: [{ key: 'engineCount', want: 2, label: 'Merlin 1C + Kestrel (SpaceX 2008)' }],
  dragon: [
    { key: 'dracoCount', want: 16, label: 'Draco (spacex.com)' },
    { key: 'superDracoCount', want: 8, label: 'SuperDraco (spacex.com)' },
  ],
  // 33 Raptor on the booster plus 3 Raptor and 3 Raptor Vacuum on the ship (spacex.com).
  starship: [{ key: 'engineCount', want: 39, label: 'Raptor · 33 + 3 + 3 (spacex.com)' }],
  // Nine Merlin 1D on the first stage and one Merlin Vacuum on the second (spacex.com).
  falcon9: [{ key: 'engineCount', want: 10, label: 'Merlin · 9 + 1 MVac (spacex.com)' }],
  // Three nine-engine cores plus the second stage's MVac (spacex.com).
  falconheavy: [{ key: 'engineCount', want: 28, label: 'Merlin · 27 + 1 MVac (spacex.com)' }],
};

/** Sums a `userData` count over every descendant of a model. */
function countParts(model, key) {
  let n = 0;
  model.traverse((o) => { if (typeof o.userData?.[key] === 'number') n += o.userData[key]; });
  return n;
}

/**
 * Measures one model. `axisOnly` excludes parts that legitimately sit outside the reference
 * envelope (grid fins, flaps, pins) from the footprint check by measuring the named hull
 * meshes instead of the whole group.
 */
function measure(model, hullNames) {
  const box = new THREE.Box3();
  const hull = new THREE.Box3();
  model.updateWorldMatrix(true, true);
  // Measure in the vehicle's own frame. Box3.expandByObject inflates the box of a rotated
  // object to the AABB of its rotated AABB, so measuring in world space would report a
  // 9 m cylinder as 12.7 m wide purely because the exhibit is turned on its mount.
  const toLocal = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const b = new THREE.Box3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.multiplyMatrices(toLocal, o.matrixWorld);
    b.copy(o.geometry.boundingBox).applyMatrix4(m);
    box.union(b);
    if (hullNames && hullNames.includes(o.name)) hull.union(b);
  });
  const size = box.getSize(new THREE.Vector3());
  const hullSize = hull.isEmpty() ? size : hull.getSize(new THREE.Vector3());
  return {
    height: size.y,
    width: Math.max(size.x, size.z),
    hullWidth: Math.max(hullSize.x, hullSize.z),
    // The short horizontal axis of the hull. For the rockets it is the same as hullWidth; for
    // the car it is the body width, which is the figure that was wrong by 12 cm.
    hullBreadth: Math.min(hullSize.x, hullSize.z),
    hullHeight: hullSize.y,
    // Top of the hull above the model origin. The rockets sit on their origin so the raw box
    // height is their height, but the Roadster carries flight hardware that hangs below the
    // tyres (the payload adapter) and stands above the car (the selfie booms), neither of
    // which is part of the 1,128 m envelope.
    hullTop: hull.isEmpty() ? box.max.y : hull.max.y,
    minY: box.min.y,
  };
}

const HULLS = {
  falcon1: ['falcon1-stage1', 'falcon1-stage2', 'falcon1-fairing'],
  starship: ['skirt', 'tanks', 'hull'],
  falcon9: ['stage1', 'interstage', 'stage2', 'fairing'],
  // The 12.2 m width is measured across the three tank barrels; the stowed landing legs of
  // the side boosters stand a little proud of that envelope.
  falconheavy: ['stage1'],
  dragon: ['capsule-wall', 'heatshield'],
  starlink: null,
  // body-shell is a Group, so measure() — which only looks at meshes — never saw it and the
  // check silently fell back to the whole model. body-paint is the actual painted hull.
  roadster: ['body-paint', 'windshield-surround', 'windshield-glass'],
  // Only the Raptor Vacuum: the row also holds a Raptor 3 and a Merlin, and the display
  // cradles are furniture.
  engines: ['rvac-bell', 'rvac-bell-inner', 'rvac-head'],
};

/**
 * Scene-integrity pass. The dimensional table above only proves the envelope is the right
 * size; it says nothing about whether the geometry inside it is well formed. These are the
 * failure modes that have actually bitten this project:
 *
 *  - a mesh whose material samples a texture but whose geometry carries no `uv`. Three.js
 *    derives tangent-space normals from screen-space derivatives of vUv, so a constant vUv
 *    makes them degenerate and the surface renders as black or blown-out garbage;
 *  - non-finite vertices, which silently stretch a triangle across the whole frame;
 *  - a geometry with no normals, which shades flat black under a physical material.
 */
export function verifyScene(root, { log = true } = {}) {
  const issues = [];
  const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
  const seen = new Set();
  root.traverse((o) => {
    if (!o.isMesh || seen.has(o.geometry.uuid + o.material.uuid)) return;
    seen.add(o.geometry.uuid + o.material.uuid);
    const g = o.geometry;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const label = o.name || `${o.parent?.name || '?'}/${o.type}`;
    // Car paint rendered DoubleSide doubles fill and fights the shadow pass, and is a sign
    // the hull is being patched over rather than built closed. The body is built as closed
    // panels, so this must stay FrontSide.
    if (o.name === 'body-paint' && mats.some(m => m && m.side === THREE.DoubleSide)) {
      // Reported in the same shape as every other finding: this one used to be a bare string,
      // so when it fired the gate failed with "undefined: undefined" and lost the diagnosis.
      issues.push({ mesh: label, problem: 'la pintura de carrocería está en DoubleSide', severity: 'error' });
    }
    const slots = TEX_SLOTS.filter(k => mats.some(m => m && m[k]));
    if (slots.length && !g.attributes.uv) {
      issues.push({ mesh: label, problem: `usa ${slots.join(', ')} sin atributo uv`, severity: 'error' });
    } else if (slots.length && g.attributes.uv) {
      // An attribute full of zeros is not a UV map. mergeAll() fabricates one so that
      // mergeGeometries() will not throw on a mixed batch, and a constant vUv is the same
      // failure this check was written to catch: flat sampling, degenerate tangents, and a
      // surface that shades as one colour. Ask whether the coordinates actually vary.
      const uv = g.attributes.uv;
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      const step = Math.max(1, Math.floor(uv.count / 512));
      for (let i = 0; i < uv.count; i += step) {
        const u = uv.getX(i), v = uv.getY(i);
        if (u < minU) minU = u; if (u > maxU) maxU = u;
        if (v < minV) minV = v; if (v > maxV) maxV = v;
      }
      if (maxU - minU < 1e-6 && maxV - minV < 1e-6) {
        issues.push({ mesh: label, problem: `usa ${slots.join(', ')} con uv constante`, severity: 'error' });
      } else {
        // Texel density. UVs that vary are still wrong if they vary at the wrong RATE, and
        // this project has two authoring conventions: metric UVs against maps that set
        // repeat = 1/tileSize, and normalised UVs against maps that wrap once. Mixing them is
        // invisible in code and ruinous on screen — the apron disc emitted CircleGeometry's
        // 0..1 UVs against a 48 m terrain tile, so one repeat covered five kilometres and the
        // ground rendered as flat grey in every wide shot for as long as it existed.
        //
        // toTexture records the tile size it was authored for, so the question can be asked
        // precisely: does a metre of this surface carry about as much texture as the map
        // expects? The bound is deliberately loose — a factor of twelve either way — because
        // the surface is measured by its bounding box, which under-reads a curved panel.
        const tex = mats.map(m => m && TEX_SLOTS.map(k => m[k]).find(Boolean)).find(Boolean);
        const want = tex?.userData?.tileSize;
        if (want) {
          g.computeBoundingBox();
          const bb = g.boundingBox;
          const world = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z)
            * Math.max(o.scale.x, o.scale.y, o.scale.z);
          const repeats = Math.max((maxU - minU) * Math.abs(tex.repeat.x), (maxV - minV) * Math.abs(tex.repeat.y));
          const perRepeat = repeats > 1e-9 ? world / repeats : Infinity;
          const ratio = perRepeat / want;
          if (world > 0.25 && (ratio > 12 || ratio < 1 / 12)) {
            issues.push({
              mesh: label,
              problem: `uv a escala equivocada: ${perRepeat.toFixed(3)} m por repetición sobre ${world.toFixed(1)} m, y el mapa se creó para ${want} m`,
              severity: 'error',
            });
          }
        }

        // Degenerate UV ISLANDS. The two checks above both ask about the geometry as a whole:
        // do the coordinates vary at all, and do they vary at roughly the right rate. Neither
        // can see a patch of triangles inside an otherwise well-mapped geometry whose UV area
        // is zero — and that is what was actually there. The Roadster's body panels carry real
        // metric UVs, but the end caps, edge flanges, tail panels, fascias, lamp apertures and
        // taillight pockets merged into the same `body-paint` batch were each handed an
        // all-zeros uv attribute so that mergeGeometries() would not throw on a mixed batch.
        // The merged attribute varies, so both checks passed, while 21,644 of that mesh's
        // 127,470 triangles — one in six — sampled a single texel of the paint's normal,
        // roughness and flake maps and read as flat plastic against the panels beside them.
        //
        // Measured per triangle, sampled rather than exhaustive: a 127 k-triangle body does
        // not need every face inspected to notice that a sixth of it is flat.
        const pos = g.attributes.position, idx = g.index;
        if (pos) {
          const n = idx ? idx.count : pos.count;
          const stride = Math.max(3, 3 * Math.floor(n / 3 / 4000));   // ≤ ~4000 triangles
          let tested = 0, degenerate = 0;
          for (let i = 0; i + 2 < n; i += stride) {
            const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
            // Skip triangles that are degenerate in 3D too: those carry no surface either way.
            const e1x = pos.getX(b) - pos.getX(a), e1y = pos.getY(b) - pos.getY(a), e1z = pos.getZ(b) - pos.getZ(a);
            const e2x = pos.getX(c) - pos.getX(a), e2y = pos.getY(c) - pos.getY(a), e2z = pos.getZ(c) - pos.getZ(a);
            const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
            if (Math.hypot(cx, cy, cz) < 1e-9) continue;
            tested++;
            const u1 = uv.getX(b) - uv.getX(a), v1 = uv.getY(b) - uv.getY(a);
            const u2 = uv.getX(c) - uv.getX(a), v2 = uv.getY(c) - uv.getY(a);
            if (Math.abs(u1 * v2 - u2 * v1) < 1e-10) degenerate++;
          }
          // 2 % of a batch is a cap ring or a seam strip and is not worth a build failure;
          // a twentieth of the surface sampling one texel is a mapping that was never written.
          const share = tested ? degenerate / tested : 0;
          if (tested >= 40 && share > 0.05) {
            issues.push({
              mesh: label,
              problem: `${(share * 100).toFixed(0)} % de los triángulos con área UV nula (islas sin mapear dentro de una geometría mapeada)`,
              severity: 'error',
            });
          }
        }
      }
    }
    if (!g.attributes.normal) {
      issues.push({ mesh: label, problem: 'geometría sin normales', severity: 'error' });
    }
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i))) {
        issues.push({ mesh: label, problem: `vértice no finito (índice ${i})`, severity: 'error' });
        break;
      }
    }
  });

  // Where an object was PUT, not just what it is made of. Every finding above is about
  // geometry, which is why three visitor figures could stand at (NaN, 0, NaN) for a week: the
  // layout arithmetic read a radius the exhibit did not have, and no vertex was ever wrong.
  root.traverse((o) => {
    const p = o.position, q = o.quaternion, sc = o.scale;
    const bad = ![p.x, p.y, p.z, q.x, q.y, q.z, q.w, sc.x, sc.y, sc.z].every(Number.isFinite);
    if (bad) {
      issues.push({
        mesh: o.name || `${o.parent?.name || '?'}/${o.type}`,
        problem: `transformada no finita (${p.x}, ${p.y}, ${p.z})`,
        severity: 'error',
      });
    }
  });
  if (log) {
    /* eslint-disable no-console */
    console.groupCollapsed(`%cIntegridad de la escena — ${issues.length ? `${issues.length} problema(s)` : 'sin problemas'}`,
      `color:${issues.length ? '#e07a5f' : '#7fb069'};font-weight:600`);
    if (issues.length) console.table(issues); else console.log('Todas las mallas tienen uv, normales y vértices finitos.');
    console.groupEnd();
    /* eslint-enable no-console */
  }
  return issues;
}

export function verifyExhibits(exhibits, { log = true } = {}) {
  const rows = [];
  for (const [id, ex] of Object.entries(exhibits)) {
    for (const c of COUNTS[id] ?? []) {
      const got = countParts(ex.model, c.key);
      rows.push({
        vehicle: id, label: c.label, declared: c.want, built: got,
        errorPct: c.want ? +(((got - c.want) / c.want) * 100).toFixed(2) : 0, ok: got === c.want,
      });
    }
    const exp = EXPECTED[id];
    if (!exp) continue;
    const m = measure(ex.model, HULLS[id]);
    const tol = exp.tol ?? TOL;
    const check = (label, got, want) => {
      if (want == null || !isFinite(got)) return;
      const err = (got - want) / want;
      rows.push({
        vehicle: id, label, declared: want, built: +got.toFixed(3),
        errorPct: +(err * 100).toFixed(2), ok: Math.abs(err) <= tol,
      });
    };
    // Height is measured from the model's own origin, which every builder places at the aft
    // plane, so the raw bounding-box height is the vehicle height.
    check('altura', exp.fromHullSize ? m.hullHeight : exp.fromHull ? m.hullTop : m.height, exp.height);
    check('envergadura / diámetro', HULLS[id] ? m.hullWidth : m.width, exp.footprint);
    check('anchura de carrocería', m.hullBreadth, exp.breadth);
  }
  if (log) {
    const bad = rows.filter(r => !r.ok);
    /* eslint-disable no-console */
    console.groupCollapsed(`%cVerificación dimensional — ${bad.length ? `${bad.length} discrepancia(s)` : 'todo dentro de tolerancia'}`,
      `color:${bad.length ? '#e07a5f' : '#7fb069'};font-weight:600`);
    console.table(rows);
    console.groupEnd();
    /* eslint-enable no-console */
  }
  return rows;
}

/**
 * Declared dimensions of the launch complex. SpaceX publishes none of these, so they are
 * either cited from reporting (the tower height and the arm length) or reconstructed from
 * imagery against the booster's known 9 m diameter — see the provenance note at the head of
 * vehicles/pad.js. Repeating them here is deliberate: the point of the check is to catch the
 * built geometry drifting away from the figure the interface shows, which is the only sense
 * in which a reconstruction can be held to "correct".
 */
export const EXPECTED_PAD = {
  towerH: { value: 144.5, label: 'torre · altura sobre la explanada', cited: true },
  armLen: { value: 36, label: 'brazo de captura · longitud', cited: true },
  deckTop: { value: 18, label: 'mesa · cota de la cubierta' },
  padY: { value: 9, label: 'explanada · cota' },
  trenchDepth: { value: 8.2, label: 'zanja de llamas · profundidad' },
  clamps: { value: 20, label: 'pinzas de sujeción', cited: true },
};

// =========================================================================================
//  Interfaces: where two independently built subsystems have to meet
// =========================================================================================
/**
 * The dimensional table catches a vehicle drifting away from its own published envelope. It
 * cannot catch two subsystems drifting away from EACH OTHER, and that is where this project's
 * expensive mistakes have lived: a launch mount whose throat was cut 43 cm inside the engine
 * bells it is meant to clear, twenty hold-down clamps closing six centimetres short of the
 * hull, a tower carriage stopping seven metres under the pins it is supposed to catch. Each
 * number was defensible on its own and wrong against its neighbour.
 *
 * Everything below is measured off built geometry in world space, never recomputed from the
 * constants that produced it.
 */

/** Largest distance from the vertical axis reached by anything under `root`, in world XZ. */
function maxRadius(root, origin) {
  let best = 0;
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    // An InstancedMesh's vertices are its prototype's; each instance places a copy.
    const instances = o.isInstancedMesh ? o.count : 1;
    const im = new THREE.Matrix4();
    for (let k = 0; k < instances; k++) {
      const m = o.isInstancedMesh
        ? new THREE.Matrix4().multiplyMatrices(o.matrixWorld, o.getMatrixAt(k, im) ?? im)
        : o.matrixWorld;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        best = Math.max(best, Math.hypot(v.x - origin.x, v.z - origin.z));
      }
    }
  });
  return best;
}

/** Smallest distance from the vertical axis reached by anything under `root`, in world XZ. */
function minRadius(root, origin) {
  let best = Infinity;
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      best = Math.min(best, Math.hypot(v.x - origin.x, v.z - origin.z));
    }
  });
  return best;
}

/**
 * @param exhibits the built exhibit map
 * @param complex  the launch complex, or null
 * @returns rows of { interface, a, b, rule, ok, detail }
 */
export function verifyInterfaces(exhibits, complex, { log = true } = {}) {
  const rows = [];
  const add = (name, ok, detail) => rows.push({ interface: name, ok, detail });
  const ex = exhibits?.starship;
  if (!ex || !complex) return rows;

  const origin = new THREE.Vector3();
  complex.getWorldPosition(origin);

  const booster = ex.model.getObjectByName('superheavy');
  const engines = booster?.getObjectByName('engines');
  const seat = complex.getObjectByName('table-seat');
  const throatMesh = complex.getObjectByName('table-throat') ?? seat;
  const skirt = booster?.getObjectByName('skirt');
  const holds = complex.getObjectByName('holddowns');

  // 1. The exhaust has to fit through the hole cut for it.
  if (engines && throatMesh) {
    const bells = maxRadius(engines, origin);
    const throat = minRadius(throatMesh, origin);
    add('engine bells clear the mount throat', throat >= bells,
      `campanas hasta ${bells.toFixed(2)} m, garganta ${throat.toFixed(2)} m`);
  }
  // 1b. The annular seat has to sit under the skirt, not around a hole larger than the hull.
  if (skirt && seat) {
    const hull = maxRadius(skirt, origin);
    const lip = minRadius(seat, origin);
    add('the booster seats on the deck lip', lip < hull - 0.03,
      `faldón ${hull.toFixed(2)} m, labio ${lip.toFixed(2)} m`);
  }
  // 2. The clamps have to reach the hull they hold down — not nearly reach it.
  if (skirt && holds) {
    const hull = maxRadius(skirt, origin);
    const reach = minRadius(holds, origin);
    const gap = reach - hull;
    add('hold-down clamps meet the skirt', gap >= -0.05 && gap <= 0.08,
      `faldón ${hull.toFixed(2)} m, pinzas hasta ${reach.toFixed(2)} m (holgura ${(gap * 100).toFixed(0)} mm)`);
  }
  // 3. The booster has to stand ON the deck, not in it or above it.
  if (skirt && seat) {
    skirt.updateWorldMatrix(true, true);
    const sb = new THREE.Box3().setFromObject(skirt);
    seat.updateWorldMatrix(true, true);
    const tb = new THREE.Box3().setFromObject(seat);
    const step = sb.min.y - tb.max.y;
    add('the booster seats on the deck', Math.abs(step) <= 0.35,
      `base del faldón ${sb.min.y.toFixed(2)} m, cota del asiento ${tb.max.y.toFixed(2)} m`);
  }
  // 4. The heat shield's backing layer must not stand past the tiles it backs.
  //
  // The tile field's angular half-width depends on height — a little over half the
  // circumference on the barrel, widening across the nose. The backing was a lathe, and a
  // lathe spans the same angle at every height, so cutting it at the WIDEST value the tile
  // field ever reaches left fifteen degrees of bare black backing standing past the last
  // column of tiles for the whole length of the barrel: a 1.2 m stripe up each side of the
  // ship, in every view of the windward face, invisible to a check that measured the ship's
  // envelope rather than the relationship between two of its parts.
  //
  // Measured where it went wrong — on the barrel, well below where the nose starts widening.
  {
    const ship = ex.model.getObjectByName('ship');
    const tiles = ship?.getObjectByName('tps');
    const backing = ship?.getObjectByName('tps-backing');
    if (tiles && backing) {
      // The quantity that went wrong is an ANGLE, so measure the angle: how far round from the
      // windward centreline (+Z) each part reaches, counting only what sits on the hull. A
      // radius filter is what keeps the flaps out of it — their tiles stand a couple of metres
      // proud of the barrel and would otherwise report a tile line far wider than the hull's,
      // which is exactly the kind of false pass that lets a defect through.
      const HULL_R = 4.5;
      const halfAngle = (obj, y0, y1) => {
        let half = 0;
        const onHull = (x, y, z) => {
          if (y < y0 || y > y1) return;
          const r = Math.hypot(x, z);
          if (Math.abs(r - HULL_R) > 0.6) return;
          half = Math.max(half, Math.abs(Math.atan2(x, z)));
        };
        if (obj.isInstancedMesh) {
          const m = new THREE.Matrix4(), v = new THREE.Vector3();
          for (let i = 0; i < obj.count; i++) {
            obj.getMatrixAt(i, m);
            v.setFromMatrixPosition(m);
            onHull(v.x, v.y, v.z);
          }
        } else {
          const pos = obj.geometry?.attributes?.position;
          for (let i = 0; pos && i < pos.count; i++) onHull(pos.getX(i), pos.getY(i), pos.getZ(i));
        }
        return half;
      };
      const [y0, y1] = [6, 24];                      // barrel, clear of the nose transition
      const deg = (r) => THREE.MathUtils.radToDeg(r);
      const tileHalf = halfAngle(tiles, y0, y1);
      const backHalf = halfAngle(backing, y0, y1);
      // A tile centred on the edge of the window overhangs by its circumradius, so the backing
      // is entitled to that much and no more: 0.152 m at a 4.5 m radius is about 2°. Allow 4°.
      const over = deg(backHalf - tileHalf);
      add('TPS backing stays under the tiles', over <= 4 && tileHalf > 0,
        `entre ${y0} y ${y1} m: losetas hasta ±${deg(tileHalf).toFixed(1)}°, respaldo hasta ±${deg(backHalf).toFixed(1)}° (sobresale ${over.toFixed(1)}°)`);
    }
  }
  // 5. Catch pins have to sit on the axis the chopsticks close on. Height was already
  // gated; azimuth was not, and with the exhibit yawed 129.6° the pins sat ~40° off the
  // load pads. After yaw, pad ±Z is the arm plane (tower at −X).
  {
    const pins = [];
    ex.model.traverse((o) => { if (o.name === 'catch-pin') pins.push(o); });
    if (pins.length) {
      ex.model.updateWorldMatrix(true, true);
      const v = new THREE.Vector3();
      const aligned = pins.every((p) => {
        p.getWorldPosition(v);
        const dx = v.x - origin.x, dz = v.z - origin.z;
        const r = Math.hypot(dx, dz);
        return r > 4 && Math.abs(dx) < r * 0.30;
      });
      add('catch pins face the chopsticks', pins.length === 2 && aligned,
        `${pins.length} pines; ${aligned ? 'sobre el eje ±Z de la torre' : 'desfasados en azimut respecto a los brazos'}`);
    }
  }

  if (log) {
    const bad = rows.filter(r => !r.ok);
    /* eslint-disable no-console */
    console.groupCollapsed(`%cInterfaces vehículo/instalación — ${bad.length ? `${bad.length} discrepancia(s)` : 'todo encaja'}`,
      `color:${bad.length ? '#e07a5f' : '#7fb069'};font-weight:600`);
    console.table(rows);
    console.groupEnd();
    /* eslint-enable no-console */
  }
  return rows;
}

const _box = new THREE.Box3();
/**
 * Span of a mesh along one axis of its OWN geometry. Box3.setFromObject is world-axis
 * aligned, so a member that is swung out on its hinge measures short by its cosine — which
 * is a property of the measurement, not of the part.
 */
function geoSpan(obj, axis = 'x') {
  let span = 0;
  obj.traverse((o) => {
    if (!o.geometry) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    span = Math.max(span, b.max[axis] - b.min[axis]);
  });
  return span;
}

/**
 * Measures the built launch complex against EXPECTED_PAD. Everything is read off the actual
 * geometry rather than the constants that produced it, so an extrusion offset or a units slip
 * shows up here — exactly the class of bug that once buried the vehicle inside the deck.
 */
export function verifyPad(complex, { log = true } = {}) {
  const rows = [];
  if (!complex) return rows;
  const add = (key, got) => {
    const exp = EXPECTED_PAD[key];
    if (!exp || !isFinite(got)) return;
    const err = (got - exp.value) / exp.value;
    rows.push({
      part: exp.label, declared: exp.value, built: +got.toFixed(3),
      origen: exp.cited ? 'prensa' : 'reconstruido',
      errorPct: +(err * 100).toFixed(2), ok: Math.abs(err) <= TOL,
    });
  };

  const olit = complex.getObjectByName('olit');
  if (olit) {
    // The tower's declared height is measured from the pad surface it stands on, not grade.
    olit.updateMatrixWorld(true);
    _box.setFromObject(olit);
    add('towerH', _box.max.y - (complex.position.y + EXPECTED_PAD.padY.value));
  }
  const arm = complex.getObjectByName('arm-north');
  if (arm) add('armLen', geoSpan(arm, 'x'));

  const seat = complex.getObjectByName('table-seat');
  if (seat) { seat.updateMatrixWorld(true); _box.setFromObject(seat); add('deckTop', _box.max.y - complex.position.y); }

  const ground = complex.getObjectByName('pad-ground');
  let padY = NaN;
  if (ground) {
    ground.updateMatrixWorld(true);
    _box.setFromObject(ground);
    padY = _box.max.y - complex.position.y;
    add('padY', padY);
  }
  // This used to be padY - 0.8, which is the same arithmetic the builder does: a regression
  // that left the trench 2 m deep would have passed. Measure the clad floor instead.
  const armor = complex.getObjectByName('trench-armor');
  if (armor && isFinite(padY)) {
    armor.updateMatrixWorld(true);
    _box.setFromObject(armor);
    add('trenchDepth', padY - (_box.min.y - complex.position.y));
  }
  const holds = complex.getObjectByName('holddowns');
  if (holds) add('clamps', holds.children.length);

  if (log) {
    const bad = rows.filter(r => !r.ok);
    /* eslint-disable no-console */
    console.groupCollapsed(`%cComplejo de lanzamiento — ${bad.length ? `${bad.length} discrepancia(s)` : 'todo dentro de tolerancia'}`,
      `color:${bad.length ? '#e07a5f' : '#7fb069'};font-weight:600`);
    console.table(rows);
    console.groupEnd();
    /* eslint-enable no-console */
  }
  return rows;
}
