/**
 * Canonical figures: every dimension and count the centre checks, stated once, with where it
 * comes from.
 *
 * Before this module the same numbers lived in four places — the builders, the data sheet in
 * specs.js, the dimensional check in verify.js and the README — and nothing but care kept them
 * together. They drifted: the Falcon 1 row of the README gave 21.336 m while the model and the
 * check used 21.98 m; the Pad 2 sheet said the flame trench was 8.2 m deep for months after it
 * was rebuilt 4.2 m deep. Now verify.js takes its expectations from here, the data sheet takes
 * each exhibit's height and footprint from here, and tools/provenance-check.mjs fails the build
 * if a sheet row or the README table states a figure this module does not.
 *
 * GRADES say how a figure is known, and set how closely the built geometry must match it:
 *
 *   A  primary, published   the maker's own number (spacex.com, the Falcon user's guides,
 *                           Tesla's service manual)                                  ±0.5 %
 *   B  primary, measured    read off a primary photograph against a known dimension ±2 %
 *   C  secondary            an encyclopaedia or specialist press reporting a figure  ±1 %
 *   D  reconstructed        no figure exists; chosen to match the photographs, and
 *                           shown with ≈ wherever it is displayed                    ±3 %
 *
 * The tolerance is not the uncertainty of the figure — a Wikipedia number can be wrong by
 * more than 1 % — but how far the model may stray from the number it claims. A published
 * figure is held tightest because the interface shows it as fact; a reconstruction is held
 * loosely so that the check cannot present it as measured.
 *
 * Counts are exact whatever their grade.
 */

export const GRADES = {
  A: { label: 'primary, published', short: 'publicado', tol: 0.005 },
  B: { label: 'primary, measured on a photograph', short: 'fotogrametría', tol: 0.02 },
  C: { label: 'secondary', short: 'prensa', tol: 0.01 },
  D: { label: 'reconstructed', short: 'reconstruido', tol: 0.03 },
};

/**
 * Per exhibit: `height` and `footprint` are what the data sheet header shows and what
 * verify.js measures; `breadth` and `mirrors` are the Roadster's two widths. `readme` names
 * the figures its row of the README table must state.
 */
export const FIGURES = {
  starship: {
    height: { value: 124.05, grade: 'A', ref: 'spacex_starship', note: '407 ft: 236 ft of booster + 171 ft of ship' },
    footprint: { value: 9, grade: 'A', ref: 'spacex_starship', note: 'diameter' },
    readme: ['height'],
  },
  falcon1: {
    height: { value: 21.984, grade: 'A', ref: 'spacex_falcon1_2008', note: 'Figure 2-5: 865.5 in from nozzle exit to tip' },
    footprint: { value: 1.6805, grade: 'A', ref: 'spacex_falcon1_2008', note: 'Figure 2-5: Ø66.16 in' },
    readme: ['height', 'footprint'],
  },
  falcon9: {
    height: { value: 70, grade: 'A', ref: 'spacex_f9' },
    footprint: { value: 5.2, grade: 'A', ref: 'falcon_guide_2025', note: 'fairing diameter' },
    readme: ['height'],
  },
  falconheavy: {
    height: { value: 70, grade: 'A', ref: 'spacex_fh' },
    footprint: { value: 12.2, grade: 'A', ref: 'spacex_fh', note: 'width across the three cores' },
    readme: ['height', 'footprint'],
  },
  dragon: {
    height: { value: 8.1, grade: 'A', ref: 'spacex_dragon', note: 'with the trunk' },
    footprint: { value: 4, grade: 'A', ref: 'spacex_dragon', note: 'maximum diameter' },
    readme: ['height'],
  },
  starlink: {
    height: { value: 4.1, grade: 'C', ref: 'sfn_v2mini', note: 'bus width, shown in the sheet header; not measured', unchecked: true },
    footprint: { value: 30, grade: 'C', ref: 'sfn_v2mini', note: '≈30 m deployed span' },
    readme: ['footprint'],
  },
  roadster: {
    height: { value: 1.127, grade: 'A', ref: 'tesla_roadster_sm' },
    footprint: { value: 3.946, grade: 'A', ref: 'tesla_roadster_sm', note: 'overall length' },
    mirrors: { value: 1.851, grade: 'A', ref: 'tesla_roadster_sm', note: 'overall width including mirrors' },
    breadth: { value: 1.75, grade: 'D', note: 'body width without mirrors: not published; from the 1.485 m rear track on 225 tyres and the mirrors\' reach' },
    readme: ['footprint', 'mirrors', 'height'],
  },
  engines: {
    height: { value: 4.4, grade: 'A', ref: 'spacex_starship', note: 'Raptor Vacuum' },
    footprint: { value: 2.3, grade: 'A', ref: 'spacex_starship', note: 'Raptor Vacuum nozzle exit' },
    readme: ['height'],
  },
};

/** Published part counts, checked exactly against what the builders place. */
export const COUNTS = {
  falcon1: [{ key: 'engineCount', want: 2, grade: 'A', ref: 'spacex_falcon1_2008', label: 'Merlin 1C + Kestrel (SpaceX 2008)' }],
  dragon: [
    { key: 'dracoCount', want: 16, grade: 'A', ref: 'spacex_dragon', label: 'Draco (spacex.com)' },
    { key: 'superDracoCount', want: 8, grade: 'A', ref: 'spacex_dragon', label: 'SuperDraco (spacex.com)' },
  ],
  // 33 Raptor on the booster plus 3 Raptor and 3 Raptor Vacuum on the ship.
  starship: [{ key: 'engineCount', want: 39, grade: 'A', ref: 'spacex_starship', label: 'Raptor · 33 + 3 + 3 (spacex.com)' }],
  // Nine Merlin 1D on the first stage and one Merlin Vacuum on the second.
  falcon9: [{ key: 'engineCount', want: 10, grade: 'A', ref: 'spacex_f9', label: 'Merlin · 9 + 1 MVac (spacex.com)' }],
  // Three nine-engine cores plus the second stage's MVac.
  falconheavy: [{ key: 'engineCount', want: 28, grade: 'A', ref: 'spacex_fh', label: 'Merlin · 27 + 1 MVac (spacex.com)' }],
};

/**
 * The launch complex. SpaceX publishes none of these: they are cited from reporting (grade C)
 * or reconstructed against the booster's 9 m (grade D) — see the provenance note at the head
 * of vehicles/pad.js. `sheet` names the data sheet row that states each one.
 */
export const PAD_FIGURES = {
  towerH: { value: 144.5, grade: 'C', ref: 'se_pad2', label: 'torre · altura sobre la explanada', sheet: 'Pad 2 · integration tower' },
  armLen: { value: 26, grade: 'C', ref: 'nsf_pad2', label: 'brazo de captura · longitud (≈36 del Pad 1 − 10)', sheet: 'Pad 2 · catch arms' },
  deckTop: { value: 18, grade: 'D', label: 'mesa · cota de la cubierta', sheet: 'Pad 2 · plan dimensions' },
  padY: { value: 5, grade: 'D', label: 'explanada · cota' },
  trenchDepth: { value: 4.2, grade: 'D', label: 'zanja de llamas · profundidad', sheet: 'Pad 2 · plan dimensions' },
  trenchWidth: { value: 22, grade: 'D', label: 'zanja de llamas · anchura (por fuera del revestimiento de 12 cm)', sheet: 'Pad 2 · plan dimensions' },
  mountWidth: { value: 26, grade: 'D', label: 'mesa · lado', sheet: 'Pad 2 · plan dimensions' },
  clamps: { value: 20, grade: 'C', ref: 'nsf_pad2', label: 'pinzas de sujeción', count: true, sheet: 'Pad 2 · launch mount' },
};

/** Tolerance for a figure: exact for counts, otherwise its grade's. */
export function toleranceOf(fig) {
  if (fig.count) return 0;
  return fig.tol ?? GRADES[fig.grade].tol;
}
