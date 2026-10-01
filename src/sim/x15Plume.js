/**
 * The XLR99's exhaust: anhydrous ammonia burnt with liquid oxygen, a flame that is nearly
 * transparent by day — in the NASA photographs of the X-15 under power (reference only, none in
 * the repository) a faint salmon-to-orange jet with a row of bright shock diamonds near the
 * ground, and a wide, pale, short-lived glow high up.
 *
 * Its shape follows the jet's own gas dynamics, with the nozzle's figures (39.3 in exit and
 * 57,000 lbf from SP-60, the thrust taken as the vacuum's as the flight model takes it; the
 * 9.8 area ratio of data/x15.js) and an assumed ratio of specific heats γ = 1.22 for the
 * products (≈):
 *  - the exit pressure p_e: isentropic expansion at the area ratio, with the chamber pressure
 *    the vacuum thrust gives through the thrust coefficient (≈ 1.8 MPa or 267 psia, and
 *    22 kPa or 3.2 psia);
 *  - against the air's pressure p_a the jet expands (p_e > p_a) or pinches (p_e < p_a) to the
 *    fully expanded Mach number M_j and diameter D_j of an ideal nozzle at that pressure ratio;
 *  - the shock cells are spaced L ≈ 1.22 D_j √(M_j² − 1) (Pack, 1950: the classic estimate
 *    for an imperfectly expanded supersonic jet), and a Mach disk's bright band ends each cell.
 * The colours, the brightness and the length over which the diamonds fade are this
 * simulation's, judged against those photographs (≈). Above ≈30 km the jet's diameter grows
 * past anything the camera can frame and it is drawn as a wide, faint cone.
 */
import * as THREE from 'three';
import { X15 } from '../data/x15.js';
import { XLR99 } from '../data/x15Aero.js';

const GAMMA = 1.22;
const LBF = 4.4482216;
const g1 = (GAMMA - 1) / 2, gx = GAMMA / (GAMMA - 1);

/** Area ratio A/A* at Mach M. */
function areaRatio(M) {
  return (1 / M) * ((1 + g1 * M * M) / (1 + g1)) ** ((GAMMA + 1) / (2 * (GAMMA - 1)));
}
/** Supersonic Mach number at area ratio e (bisection). */
function machAt(e) {
  let lo = 1, hi = 20;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (areaRatio(m) < e) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const pRatio = (M) => (1 + g1 * M * M) ** -gx;   // p / p0

const RE = X15.xlr99.exitDiameter / 2, EPS = X15.xlr99.areaRatio;
const AE = Math.PI * RE * RE, AT = AE / EPS;
const ME = machAt(EPS), PE_PC = pRatio(ME);
// Vacuum thrust coefficient: momentum plus the exit's pressure term.
const CF_VAC = Math.sqrt(2 * GAMMA * GAMMA / (GAMMA - 1) * (2 / (GAMMA + 1)) ** ((GAMMA + 1) / (GAMMA - 1)) * (1 - PE_PC ** (1 / gx))) + PE_PC * EPS;
export const XLR99_JET = {
  gamma: GAMMA, exitMach: ME,
  pc: XLR99.thrustLbf * LBF / (CF_VAC * AT),
  get pe() { return this.pc * PE_PC; },
};

/**
 * The jet at throttle and ambient pressure pa (Pa): fully expanded Mach number and diameter,
 * shock-cell spacing, all in metres.
 */
export function jetShape(throttle, pa) {
  const pc = XLR99_JET.pc * throttle;
  const ratio = pc / Math.max(pa, 1);
  // Fully expanded to pa: p0/pa = (1 + g1 Mj²)^gx.
  const Mj = Math.sqrt(Math.max(1e-6, (ratio ** (1 / gx) - 1) / g1));
  const Dj = 2 * Math.sqrt(AT * areaRatio(Math.max(Mj, 1.0001)) / Math.PI);
  const cell = 1.22 * Dj * Math.sqrt(Math.max(Mj * Mj - 1, 0.05));
  return { Mj, Dj, cell, pe: XLR99_JET.pe * throttle, underexpanded: XLR99_JET.pe * throttle > pa };
}

const VERT = /* glsl */`
  uniform float uRe, uRj, uCell, uLen, uTime;
  varying float vX, vEdge;
  varying vec3 vN, vV;
  void main() {
    // A unit tube along −X: x from 0 at the exit to uLen, its radius the jet's boundary.
    float x = position.x * uLen;
    float settle = smoothstep(0.0, uCell * 0.55, x);
    float ripple = 1.0 - 0.12 * (0.5 + 0.5 * cos(6.2831853 * (x / uCell - 0.82))) * exp(-x / (5.0 * uCell));
    float r = mix(uRe, uRj, settle) * ripple + 0.02 * x;    // a mixing layer spreading at ≈1.1°
    vec3 p = vec3(-x, position.y * r, position.z * r);
    vX = x;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * vec3(0.0, position.y, position.z));
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG = /* glsl */`
  uniform float uCell, uLen, uGain, uDiamonds, uTime;
  varying float vX, vEdge;
  varying vec3 vN, vV;
  void main() {
    // How squarely the tube is seen: 1 on the jet's axis, 0 at its edge. The light the eye
    // collects goes as the path through the gas; a Mach disk is a lens across the core, so
    // its glow is drawn towards the axis.
    float c0 = abs(dot(normalize(vN), normalize(vV)));
    float path = sqrt(c0);
    float core = pow(c0, 3.0);
    float fade = pow(clamp(1.0 - vX / uLen, 0.0, 1.0), 1.6);
    float phase = vX / uCell;
    float disk = pow(0.5 + 0.5 * cos(6.2831853 * (phase - 0.82)), 18.0) * exp(-phase / 4.5) * uDiamonds;
    float flick = 0.9 + 0.1 * sin(uTime * 37.0 + vX * 3.1) * sin(uTime * 23.0 - vX * 1.7);
    vec3 body = vec3(1.0, 0.4, 0.17) * 0.2;           // the salmon to orange of the ammonia flame
    vec3 bright = vec3(1.0, 0.7, 0.4) * 4.0;          // the diamonds
    vec3 c = (body * path * (0.3 + 0.7 * exp(-vX / (3.0 * uCell))) + bright * disk * core) * fade * flick * uGain;
    gl_FragColor = vec4(c, 1.0);
  }`;

/** @returns {{ group, update(throttle, pa, t) }} attached at the nozzle's exit (−X aft). */
export function buildX15Plume() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 40, 96, true);
  geo.rotateZ(Math.PI / 2);          // axis along X
  geo.translate(0.5, 0, 0);          // 0 … 1 along +X; the shader runs it aft
  const uniforms = {
    uRe: { value: 0.5 }, uRj: { value: 0.5 }, uCell: { value: 2 }, uLen: { value: 20 },
    uGain: { value: 0 }, uDiamonds: { value: 1 }, uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'x15-plume', uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'x15-plume';
  m.frustumCulled = false;
  m.renderOrder = 5;
  m.visible = false;
  const group = new THREE.Group();
  group.name = 'x15-plume-root';
  group.add(m);
  uniforms.uRe.value = RE;

  function update(throttle, pa, t) {
    m.visible = throttle > 0.01;
    if (!m.visible) return null;
    const j = jetShape(throttle, pa);
    // Framable sizes: past ≈30 km the jet balloons to tens of metres and more (≈).
    const rj = Math.min(j.Dj / 2, 18), cell = Math.min(j.cell, 40);
    uniforms.uRj.value = rj;
    uniforms.uCell.value = cell;
    uniforms.uLen.value = Math.min(9 * cell + 6, 140);
    // Bright in dense air, where the exhaust burns on and the diamonds stand out; a faint glow
    // in near vacuum (≈).
    const dense = Math.min(1, (pa / 101325) ** 0.35);
    uniforms.uGain.value = throttle * (0.18 + 0.82 * dense);
    uniforms.uDiamonds.value = Math.min(1, 0.2 + dense * 1.4);
    uniforms.uTime.value = t;
    return j;
  }
  return { group, mesh: m, update };
}
