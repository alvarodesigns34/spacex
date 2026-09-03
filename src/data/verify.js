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
  starship: { height: 124, footprint: 9, note: 'Altura del apilado y diámetro (spacex.com)' },
  falcon9: { height: 70, footprint: 5.2, note: 'Altura total y diámetro de cofia (spacex.com)' },
  falconheavy: { height: 70, footprint: 12.2, note: 'Altura y anchura (spacex.com)' },
  dragon: { height: 8.1, footprint: 4, note: 'Altura con trunk y diámetro máximo (spacex.com)' },
  starlink: { height: null, footprint: 30, note: 'Envergadura desplegada (prensa)', tol: 0.06 },
  roadster: { height: null, footprint: 3.95, note: 'Longitud total de carrocería (documentado)', tol: 0.04 },
};

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
    minY: box.min.y,
  };
}

const HULLS = {
  starship: ['skirt', 'tanks', 'hull'],
  falcon9: ['stage1', 'interstage', 'stage2', 'fairing'],
  // The 12.2 m width is measured across the three tank barrels; the stowed landing legs of
  // the side boosters stand a little proud of that envelope.
  falconheavy: ['stage1'],
  dragon: ['capsule-wall', 'heatshield'],
  starlink: null,
  roadster: ['body-shell', 'body-paint'],
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
    const slots = TEX_SLOTS.filter(k => mats.some(m => m && m[k]));
    if (slots.length && !g.attributes.uv) {
      issues.push({ mesh: label, problem: `usa ${slots.join(', ')} sin atributo uv`, severity: 'error' });
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
    check('altura', m.height, exp.height);
    check('envergadura / diámetro', HULLS[id] ? m.hullWidth : m.width, exp.footprint);
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
  if (ground) {
    ground.updateMatrixWorld(true);
    _box.setFromObject(ground);
    const padY = _box.max.y - complex.position.y;
    add('padY', padY);
    // The trench floor is the ground group's lowest slab top; measure it from the clad floor.
    add('trenchDepth', padY - 0.8);
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
