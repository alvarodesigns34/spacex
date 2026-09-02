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
  model.traverse((o) => {
    if (!o.isMesh) return;
    box.expandByObject(o);
    if (hullNames && hullNames.includes(o.name)) hull.expandByObject(o);
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
