/**
 * The Tesla Cybertruck Cyberbeast (US range, 2026) of the Cybertruck Lab: the figures it shows
 * with their source, and the labels of the asset's systems and explosion stages.
 *
 * The model is the Blender reconstruction of the `cybertruck` repository (version 4.2). Its
 * overall dimensions are Tesla's; the shape of every part is reconstructed from the manuals and
 * photographs, and each part says so in its own fidelity grade (V verified, R reconstructed,
 * A approximate). Grades of the figures as in the rest of the centre (data/figures.js): A is a
 * published primary figure.
 *
 * `model` is what that repository's validation measured on the built model
 * (docs/validation-results.json, version 4.2); the Lab measures length, width and height again
 * on the decoded asset and tools/cybertruck-lab-check.mjs holds them to ±0.5 %, the tolerance of
 * a grade-A figure.
 */
export const CT_SOURCES = {
  ct_manual: {
    label: "Tesla — Cybertruck Owner's Manual, “Dimensions, Weights, and Cargo Capacity”",
    // tesla.com answers 403 to tools; this is Tesla's own mirror of the same page.
    url: 'https://www.tesla.cn/ownersmanual/cybertruck/en_us/GUID-12A976DD-EB60-431B-AFF1-5A37E95006DB.html',
  },
  ct_repo: {
    label: 'alvarodesigns34/cybertruck — the Blender model and its validation (version 4.2)',
    url: 'https://github.com/alvarodesigns34/cybertruck',
  },
};

/** Published figures, metres, grade A (Tesla's manual adds: "Values are approximate. Dimensions can vary depending on a vehicle's options"). */
export const CT_FIGURES = [
  { id: 'length', label: 'Overall length', value: 5.6829, model: 5.6849, src: 'ct_manual', grade: 'A' },
  { id: 'widthMirrors', label: 'Width, mirrors out', value: 2.4133, model: 2.4133, src: 'ct_manual', grade: 'A' },
  { id: 'widthFolded', label: 'Width, mirrors folded', value: 2.2007, model: null, src: 'ct_manual', grade: 'A' },
  // The model's body is 50 mm wider than this (documented in the cybertruck repository): the
  // flanks are reconstructed, not measured, and the mirrors are what was fitted to Tesla's width.
  { id: 'widthBody', label: 'Width, without mirrors', value: 2.0316, model: 2.0817, src: 'ct_manual', grade: 'A', approx: 'the model is 50 mm wider: its flanks are reconstructed' },
  { id: 'height', label: 'Height, suspension at Medium', value: 1.7938, model: 1.7967, src: 'ct_manual', grade: 'A' },
  { id: 'wheelbase', label: 'Wheelbase', value: 3.6350, model: 3.6350, src: 'ct_manual', grade: 'A' },
  { id: 'track', label: 'Track, front and rear', value: 1.7720, model: 1.7720, src: 'ct_manual', grade: 'A' },
  { id: 'overhangF', label: 'Front overhang', value: 0.8783, model: 0.8805, src: 'ct_manual', grade: 'A' },
  { id: 'overhangR', label: 'Rear overhang', value: 1.1696, model: 1.1694, src: 'ct_manual', grade: 'A' },
  { id: 'clearance', label: 'Ground clearance at Medium', value: 0.2570, model: 0.2566, src: 'ct_manual', grade: 'A' },
];

/** The asset's `system` extras, in the order the Lab lists them. */
export const CT_SYSTEMS = {
  EXTERIOR_PANELS: 'Exterior panels',
  DOORS_AND_HATCHES: 'Doors and hatches',
  GLASS_AND_MIRRORS: 'Glass and mirrors',
  LIGHTING: 'Lighting',
  BODY_STRUCTURE: 'Body structure',
  CARGO_BED: 'Cargo bed',
  FRONT_WHEELS_AND_BRAKES: 'Front wheels and brakes',
  REAR_WHEELS_AND_BRAKES: 'Rear wheels and brakes',
  FRONT_SUSPENSION: 'Front suspension',
  REAR_SUSPENSION: 'Rear suspension',
  STEERING: 'Steering',
  BATTERY_ASSEMBLY: 'Battery and high voltage',
  DRIVE_UNITS: 'Drive units',
  UNDERBODY: 'Underbody and subframes',
  INTERIOR_DASHBOARD: 'Dashboard',
  INTERIOR_CONTROLS: 'Controls and screens',
  INTERIOR_SEATS: 'Seats and belts',
  INTERIOR_DOORS: 'Door panels',
  INTERIOR_TRIM: 'Interior trim',
  BODY_FASTENERS: 'Cameras, sensors and hardware',
};

/** The asset's explosion stages (`explode_stage`); their windows are in the root's extras. */
export const CT_STAGES = {
  1: 'Panels and openings',
  2: 'Interior',
  3: 'Structure and underbody',
  4: 'Suspension and wheels',
  5: 'Battery and drivetrain',
  6: 'Small parts',
};

export const CT_FIDELITY = {
  V: { label: 'Verified', note: 'Backed by official documentation (dimensions or specification).' },
  R: { label: 'Reconstructed', note: 'Reconstructed from official views and consistent photographs.' },
  A: { label: 'Approximate', note: 'A reasoned interpretation: the exact geometry is not publicly documented.' },
};
