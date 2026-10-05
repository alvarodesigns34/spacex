/**
 * The side photograph's calibration: its pixels to the model's metres, and the silhouette's top
 * traced on it.
 */
/** Side-photograph pixel → model metres (x forward from the wheelbase's middle, y up). */
// (The side camera, fitted with the three-quarter one to the published wheelbase, tyre sizes and
// height: ≈559 px/m, 82 m away; this is its inverse on the centre plane.)
export const PXY = (u, v) => [-0.0017884 * (u - 640.576) + -0.0000028 * (v - 809.183), 0.0000023 * (u - 640.576) + -0.0017895 * (v - 809.183)];

export const PX = (u, v = 400) => PXY(u, v)[0];

export const PY = (v, u = 600) => PXY(u, v)[1];

/** Linear interpolation in a [[u, value], …] table. */
export function lerpTable(t, u) {
  if (u <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (u <= t[i][0]) { const k = (u - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * k; }
  return t[t.length - 1][1];
}

/** The silhouette's top in the side photograph (v px), every 15 px of u (measured). */
const TOP = [[460, 290], [475, 280], [490, 271], [505, 264], [520, 257], [535, 254], [550, 254], [565, 245], [580, 244], [595, 243], [610, 243], [625, 244], [640, 245], [655, 253], [670, 263], [685, 274], [700, 286], [715, 298], [730, 314], [745, 336], [760, 345], [775, 348], [790, 348], [805, 348], [820, 346], [835, 344], [850, 342], [865, 338], [880, 335], [895, 302], [910, 286], [925, 276], [940, 271], [955, 252], [970, 247], [985, 246], [1000, 244], [1015, 243], [1030, 243], [1060, 243], [1090, 243], [1105, 244]];

export const topV = (u) => lerpTable(TOP, u);
