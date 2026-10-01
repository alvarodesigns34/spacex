/**
 * Aerodynamic heating of the X-15's skin, from what was measured on it in flight: NASA TM X-1705
 * (Quinn and Olinger, 1969), heat-transfer measurements from 200 thermocouples on the Inconel X
 * skin on two quasi-steady flights, 2-22 (Mach 5.1, α 2.0°) and 2-28 (Mach 4.98, α 16.3°).
 *
 * Where: the bottom centre line of the fuselage (φ = 0, figure 4), the windward line and the
 * hottest, at the five thermocouples measured on both flights (table V). Each carries its own
 * skin, the heat-storage capacity ρ c τ the report tabulates.
 *
 * How, the report's own data reduction run forwards (its equations 1–5):
 *   ρ c τ dTw/dt = St · ρ∞V∞ · (H_R − H_w) − ε σ Tw⁴,   H_R = H∞ + η V∞²/2,
 * with the recovery factor η = 0.9 and the emissivity ε = 0.76 the report used. The Stanton
 * number at each point is the measured one, between the two flights by the angle of attack
 * (linear, held beyond them), each first brought to a common mass flux by the turbulent
 * flat-plate scaling St ∝ Re^−0.2 (≈: the report's Reynolds numbers differ by a factor of two,
 * and its own comparisons use that theory). Air's enthalpy has a specific heat rising with
 * temperature (≈ 1 % of tables up to 1 200 K). Conduction along the skin and to the structure,
 * and heating by the boundary layer's transition, are left out.
 */

/** Flight conditions of the two flights (TM X-1705 table I): Mach, α (deg), ρ∞V∞ (kg/m²·s). */
export const FLIGHTS = {
  '2-22': { mach: 5.1, alpha: 2.0, rhoV: 110.0 },
  '2-28': { mach: 4.98, alpha: 16.3, rhoV: 59.1 },
};

/**
 * Bottom centre line thermocouples (tables V, VII and VIII): x/l along the fuselage, skin heat
 * capacity ρcτ (J/m²·K) on each flight, and the Stanton number on each flight. The quasi-steady
 * wall temperature Tw (K) and heating rate (K/s) of flight 2-22 are kept for the check.
 */
export const BELLY = [
  { tc: 1, xl: 0.047, rct: [13780, 13970], st: [0.00140, 0.00452], tw22: 498, dTdt22: 8.06 },
  { tc: 10, xl: 0.125, rct: [7720, 7880], st: [0.00104, 0.00307], tw22: 543, dTdt22: 9.73 },
  { tc: 17, xl: 0.150, rct: [5660, 5760], st: [0.00085, 0.00246], tw22: 589, dTdt22: 9.67 },
  { tc: 24, xl: 0.200, rct: [5430, 5530], st: [0.00080, 0.00237], tw22: 590, dTdt22: 9.34 },
  { tc: 30, xl: 0.309, rct: [5230, 5310], st: [0.00037, 0.00146], tw22: 479, dTdt22: 5.50 },
];

export const RECOVERY = 0.9, EMISSIVITY = 0.76;
const SIGMA = 5.670374e-8;
const RHOV_REF = FLIGHTS['2-22'].rhoV;

/** Specific enthalpy of air, J/kg, from 0 K: cp = 1000 + 0.18 (T − 300) J/kg·K above 300 K (≈). */
export function enthalpy(T) {
  const d = Math.max(0, T - 300);
  return 1000 * T + 0.09 * d * d;
}
/** The temperature whose enthalpy is H (the inverse of enthalpy()). */
export function temperatureOf(H) {
  if (H <= 300000) return H / 1000;
  // 1000 T + 0.09 (T − 300)² = H, solved for T > 300.
  const a = 0.09, b = 1000 - 54, c = 8100 - H;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Stanton number at a thermocouple for angle of attack α (deg) and mass flux ρV (kg/m²·s). */
export function stanton(p, alpha, rhoV) {
  const [f1, f2] = [FLIGHTS['2-22'], FLIGHTS['2-28']];
  const s1 = p.st[0] * (f1.rhoV / RHOV_REF) ** 0.2, s2 = p.st[1] * (f2.rhoV / RHOV_REF) ** 0.2;
  const k = Math.min(1, Math.max(0, (alpha - f1.alpha) / (f2.alpha - f1.alpha)));
  return (s1 + (s2 - s1) * k) * (Math.max(rhoV, 1e-6) / RHOV_REF) ** -0.2;
}

/** Recovery temperature (K) for free-stream temperature T (K) and speed V (m/s). */
export function recoveryTemperature(T, V) { return temperatureOf(enthalpy(T) + RECOVERY * V * V / 2); }

/**
 * Net heating at one point, W/m², for a free stream { T, rho, V } at angle of attack alpha.
 */
export function heatFlux(p, Tw, { T, rho, V, alpha }) {
  const rhoV = rho * V;
  const conv = stanton(p, alpha, rhoV) * rhoV * (enthalpy(T) + RECOVERY * V * V / 2 - enthalpy(Tw));
  return conv - EMISSIVITY * SIGMA * Tw ** 4;
}

/** A skin state: every bottom-centre-line point at temperature T0 (K). */
export function makeSkin(T0 = 288) { return { T: BELLY.map(() => T0), peak: BELLY.map(() => T0) }; }

/**
 * Advances the skin by dt seconds in free stream { T, rho, V, alpha }. The skin's heat capacity
 * is flight 2-22's (the two flights differ by under 2 %). Integrated in steps of at most 0.5 s,
 * well inside the thinnest skin's time constant (≈ 25 s at these rates).
 */
export function heatStep(skin, free, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.5)), h = dt / n;
  for (let k = 0; k < n; k++) {
    BELLY.forEach((p, i) => {
      skin.T[i] += heatFlux(p, skin.T[i], free) / p.rct[0] * h;
      if (skin.T[i] > skin.peak[i]) skin.peak[i] = skin.T[i];
    });
  }
  return skin;
}
