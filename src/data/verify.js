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
