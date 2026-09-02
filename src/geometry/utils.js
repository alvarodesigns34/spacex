/**
 * Geometry helpers shared by every vehicle builder.
 *
 * Conventions:
 *  - 1 world unit = 1 metre.
 *  - Vehicles are built along +Y (nose up), with y = 0 at the aft plane of the
 *    stage/skirt that rests on the display mount.
 *  - Lathe profiles are arrays of { r, y, sharp? }. Consecutive points are joined by
 *    straight segments and revolved around Y. A `sharp` point produces a hard crease.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3();

/**
 * Revolves a 2D profile around Y with analytic normals and metric UVs.
 * uv.x is measured in metres along the circumference at `rRef` (defaults to the max radius),
 * uv.y in metres along the profile. Materials therefore use `repeat = 1 / tileSizeInMetres`.
 */
export function lathe(profile, opts = {}) {
  const {
    segments = 96,
    phiStart = 0,
    phiLength = Math.PI * 2,
    uvMode = 'metric', // 'metric' | 'normalized'
    rRef = null,
    flip = false,
  } = opts;

  const n = profile.length;
  if (n < 2) throw new Error('lathe: profile needs at least two points');

  // Per-segment outward normals in the (r, y) plane and cumulative arc length.
  const segNormals = [];
  const cum = [0];
  for (let i = 0; i < n - 1; i++) {
    const dr = profile[i + 1].r - profile[i].r;
    const dy = profile[i + 1].y - profile[i].y;
    const len = Math.hypot(dr, dy) || 1e-6;
    segNormals.push([dy / len, -dr / len]);
    cum.push(cum[i] + len);
  }
  const total = cum[n - 1] || 1;
  const maxR = rRef ?? profile.reduce((m, p) => Math.max(m, p.r), 0);

  // Expand profile into rows (sharp points are duplicated with different normals).
  const rows = [];
  for (let i = 0; i < n; i++) {
    const p = profile[i];
    if (i === 0) rows.push({ r: p.r, y: p.y, n: segNormals[0], s: cum[i] });
    else if (i === n - 1) rows.push({ r: p.r, y: p.y, n: segNormals[n - 2], s: cum[i] });
    else if (p.sharp) {
      rows.push({ r: p.r, y: p.y, n: segNormals[i - 1], s: cum[i] });
      rows.push({ r: p.r, y: p.y, n: segNormals[i], s: cum[i] });
    } else {
      const a = segNormals[i - 1], b = segNormals[i];
      let nx = a[0] + b[0], ny = a[1] + b[1];
      const l = Math.hypot(nx, ny) || 1e-6;
      rows.push({ r: p.r, y: p.y, n: [nx / l, ny / l], s: cum[i] });
    }
  }

  const rowCount = rows.length;
  const cols = segments + 1;
  const positions = new Float32Array(rowCount * cols * 3);
  const normals = new Float32Array(rowCount * cols * 3);
  const uvs = new Float32Array(rowCount * cols * 2);
  const sign = flip ? -1 : 1;

  for (let j = 0; j < rowCount; j++) {
    const row = rows[j];
    for (let k = 0; k < cols; k++) {
      const t = k / segments;
      const phi = phiStart + phiLength * t;
      const sn = Math.sin(phi), cs = Math.cos(phi);
      const idx = (j * cols + k);
      positions[idx * 3 + 0] = row.r * sn;
      positions[idx * 3 + 1] = row.y;
      positions[idx * 3 + 2] = row.r * cs;
      normals[idx * 3 + 0] = sign * row.n[0] * sn;
      normals[idx * 3 + 1] = sign * row.n[1];
      normals[idx * 3 + 2] = sign * row.n[0] * cs;
      if (uvMode === 'metric') {
        uvs[idx * 2 + 0] = t * phiLength * maxR;
        uvs[idx * 2 + 1] = row.s;
      } else {
        uvs[idx * 2 + 0] = t;
        uvs[idx * 2 + 1] = row.s / total;
      }
    }
  }

  const indices = [];
  for (let j = 0; j < rowCount - 1; j++) {
    for (let k = 0; k < segments; k++) {
      const a = j * cols + k, b = a + 1, c = a + cols, d = c + 1;
      // counter-clockwise (front-facing) when seen from outside; `flip` faces inward
      if (flip) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  g.userData.profileLength = total;
  return g;
}

/**
 * Tangent-ogive nose profile from radius R at y0 up to y0 + L.
 *
 * `bluntR` gives the nose a spherically blunted tip (real nose cones are never sharp): the
 * ogive is truncated where its local slope matches a tangent sphere of that radius, and the
 * cap is emitted as a circular arc. Returns points ordered from the base upward.
 */
export function ogiveProfile(R, L, y0, steps = 24, bluntR = 0, power = 1.0) {
  const rho = (R * R + L * L) / (2 * R);          // ogive radius of curvature
  const pts = [];
  // Ogive radius as a function of the axial distance x measured from the base.
  const ogiveR = (x) => {
    const r = Math.sqrt(Math.max(0, rho * rho - x * x)) + R - rho;
    return power === 1 ? Math.max(r, 0) : Math.pow(Math.max(r, 0) / R, power) * R;
  };
  if (bluntR <= 0) {
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * L;
      pts.push({ r: i === steps ? 0 : ogiveR(x), y: y0 + x });
    }
    return pts;
  }
  // Spherically blunted tangent ogive. The standard construction is expressed with the axial
  // coordinate measured from the *sharp* tip, so convert each station back to the base-relative
  // coordinate this function works in.
  const xoTip = L - Math.sqrt(Math.max(0, (rho - bluntR) * (rho - bluntR) - (rho - R) * (rho - R)));
  const rT = (bluntR * (rho - R)) / (rho - bluntR);                    // radius at tangency
  const xtTip = xoTip - Math.sqrt(Math.max(0, bluntR * bluntR - rT * rT));
  const xT = L - xtTip;            // tangency station, from the base
  const xCentre = L - xoTip;       // centre of the spherical cap, from the base
  const xApex = xCentre + bluntR;  // where the blunted nose actually ends
  if (!(xT > 0 && xT < L && xApex > xT)) {                             // degenerate blunting
    return ogiveProfile(R, L, y0, steps, 0, power);
  }
  // Blunting shortens the cone; stretch it back so the tip lands exactly at y0 + L and the
  // vehicle keeps its published overall height (the shape error is a few per cent).
  const k = L / xApex;
  const bodySteps = Math.max(4, Math.round(steps * 0.78));
  for (let i = 0; i <= bodySteps; i++) {
    const x = (i / bodySteps) * xT;
    pts.push({ r: ogiveR(x), y: y0 + x * k });
  }
  const capSteps = Math.max(3, steps - bodySteps);
  const aT = Math.asin(Math.min(1, rT / bluntR));
  for (let i = 1; i <= capSteps; i++) {
    const a = aT * (1 - i / capSteps);
    pts.push({ r: bluntR * Math.sin(a), y: y0 + (xCentre + bluntR * Math.cos(a)) * k });
  }
  // Guard against a non-monotonic tail from numerical edge cases.
  for (let i = 1; i < pts.length; i++) if (pts[i].y <= pts[i - 1].y) pts[i].y = pts[i - 1].y + 1e-4;
  return pts;
}

/** Elliptical (spherical-cap-like) dome profile from radius R at y0 to apex at y0 + h. */
export function domeProfile(R, h, y0, steps = 16, direction = 1) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * Math.PI / 2;
    pts.push({ r: R * Math.cos(ang), y: y0 + direction * h * Math.sin(ang) });
  }
  return pts;
}

export function cylinderShell(r, y0, y1, opts = {}) {
  return lathe([{ r, y: y0 }, { r, y: y1 }], opts);
}

/** Builds a tube along a poly-line (smoothed with Catmull-Rom). */
export function tube(points, radius, opts = {}) {
  const { tubular = 32, radial = 10, closed = false, tension = 0.5, type = 'catmullrom' } = opts;
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, type, tension);
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}

/** Merges a list of geometries after baking their transforms. */
export function mergeAll(items) {
  if (!items.length) return new THREE.BufferGeometry();
  const geos = items.map(it => {
    const g = it.geometry.clone();
    if (it.matrix) g.applyMatrix4(it.matrix);
    // strip attributes that would prevent merging
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    g.clearGroups();
    // mergeGeometries needs a consistent indexing scheme; extrusions are non-indexed.
    return g.index ? g.toNonIndexed() : g;
  });
  return mergeGeometries(geos, false);
}

export function mat4(position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  m.compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale));
  return m;
}

/**
 * Tile solid for the thermal protection system: a pointy-top hexagon in local XY, extruded
 * along +Z (the surface normal), with a chamfered top edge and **no bottom face** — tiles are
 * always seated against a hull, so the back face is never visible. 28 triangles instead of the
 * ~48 an ExtrudeGeometry bevel costs, and the chamfer gives the edge a specular catch.
 */
export function hexPrism(circumradius, thickness, chamfer = 0.022) {
  const c = Math.min(circumradius * chamfer, thickness * 0.6);
  const rings = [
    { r: circumradius - c, z: thickness, n: [0, 0, 1] },        // top face
    { r: circumradius - c, z: thickness, n: null },             // chamfer top (own normal)
    { r: circumradius, z: thickness - c, n: null },             // chamfer bottom
    { r: circumradius, z: thickness - c, n: null },             // side top
    { r: circumradius, z: 0, n: null },                         // side bottom
  ];
  const N = 6;
  const pos = [], nor = [], uv = [], idx = [];
  const ang = (i) => Math.PI / 6 + (i / N) * Math.PI * 2;
  // Ring vertices (N+1 columns so the seam has distinct UVs).
  for (let ri = 0; ri < rings.length; ri++) {
    const R = rings[ri];
    for (let i = 0; i <= N; i++) {
      const a = ang(i % N);
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(R.r * ca, R.r * sa, R.z);
      if (ri === 0) nor.push(0, 0, 1);
      else if (ri <= 2) { const l = Math.SQRT1_2; nor.push(ca * l, sa * l, l); }  // chamfer ≈45°
      else nor.push(ca, sa, 0);
      uv.push(0.5 + 0.5 * ca, 0.5 + 0.5 * sa);
    }
  }
  const row = N + 1;
  // Top face fan (4 triangles) using ring 0.
  for (let i = 1; i < N - 1; i++) idx.push(0, i, i + 1);
  // Chamfer band (ring 1 → 2) and side band (ring 3 → 4).
  for (const [a, b] of [[1, 2], [3, 4]]) {
    for (let i = 0; i < N; i++) {
      const p0 = a * row + i, p1 = p0 + 1, p2 = b * row + i, p3 = p2 + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Samples a lathe profile: returns radius and outward (r,y) normal at height y.
 */
export function profileAt(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1];
    if ((y >= Math.min(a.y, b.y)) && (y <= Math.max(a.y, b.y)) && a.y !== b.y) {
      const t = (y - a.y) / (b.y - a.y);
      const r = a.r + (b.r - a.r) * t;
      const dr = b.r - a.r, dy = b.y - a.y;
      const l = Math.hypot(dr, dy) || 1e-6;
      return { r, nr: dy / l, ny: -dr / l };
    }
  }
  return null;
}

/**
 * Places instanced hex tiles on a surface of revolution between y0..y1.
 *
 * Coverage is an angular window centred on `phiCenter`; its half-width may vary with height
 * (`phiHalf` accepts a number or a function of y) so the heat shield can taper and then wrap
 * fully around the nose, as it does on the real vehicle. Tiles are seated `seat` metres into
 * the hull so only the exposed part reads. Returns the next free instance index.
 */
export function tileSurfaceOfRevolution(mesh, profile, opts) {
  const {
    y0, y1, phiCenter = 0, phiHalf = Math.PI / 2, circumradius, startIndex = 0,
    colorJitter = 0.018, patchAmount = 0.022, patchScale = 2.4, base = new THREE.Color(0x41424a), rowOffsetY = 0, maskFn = null,
    rng = Math.random, gap = 1.012, seat = 0.010, minRadius = null,
  } = opts;
  const halfAt = typeof phiHalf === 'function' ? phiHalf : () => phiHalf;
  const w = Math.sqrt(3) * circumradius * gap;        // flat-to-flat pitch (column spacing)
  const dy = 1.5 * circumradius * gap;                // row pitch for a pointy-top hex grid
  const rMin = minRadius ?? circumradius * 0.9;
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(0, 0, 1);
  const color = new THREE.Color();
  let i = startIndex;
  let row = 0;
  for (let y = y0 + rowOffsetY; y <= y1; y += dy, row++) {
    const p = profileAt(profile, y);
    if (!p || p.r < rMin) continue;
    const half = halfAt(y);
    if (half <= 0) continue;
    const full = half >= Math.PI - 1e-6;
    const dphi = w / p.r;
    // Always fit a whole number of columns into the arc. Letting the pitch float makes the
    // column phase drift row to row, which on a cone spirals the tiles into scales.
    const span = full ? Math.PI * 2 : 2 * half;
    const count = Math.max(full ? 3 : 1, Math.round(span / dphi));
    const step = span / count;
    const offset = (row % 2) * 0.5;
    for (let k = 0; k < count; k++) {
      const phi = full
        ? phiCenter + step * (k + offset)
        : phiCenter - half + step * (k + 0.5 + offset * 0.5);
      if (!full && phi > phiCenter + half - step * 0.25) continue;
      if (maskFn && !maskFn(y, phi)) continue;
      if (i >= mesh.count) return i;
      const sn = Math.sin(phi), cs = Math.cos(phi);
      const nx = p.nr * sn, ny = p.ny, nz = p.nr * cs;
      _v.set(nx, ny, nz).normalize();
      dummy.position.set(p.r * sn - _v.x * seat, y - _v.y * seat, p.r * cs - _v.z * seat);
      dummy.up.copy(Math.abs(_v.y) > 0.98 ? alt : up);
      dummy.lookAt(dummy.position.x + _v.x, dummy.position.y + _v.y, dummy.position.z + _v.z);
      dummy.rotateZ((rng() - 0.5) * 0.018);           // manufacturing scatter
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Tone varies in patches across the hull (batches of tiles, wear, replacements) with
      // only a trace of per-tile scatter; pure per-tile noise reads as fish scales.
      const patch = patchNoise(phi * p.r * patchScale, y * patchScale) - 0.5;
      color.copy(base).offsetHSL(0, 0, patch * patchAmount + (rng() - 0.5) * colorJitter);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  return i;
}

/**
 * Places hex tiles over a planar polygon (in the XY plane of `matrix`), local +Z being the
 * tile normal. `polygon` is an array of [x, y]. `inset` keeps tiles clear of the outline so
 * the flap's machined edge stays bare, as it is on the vehicle.
 */
export function tilePolygon(mesh, polygon, matrix, opts) {
  const {
    circumradius, startIndex = 0, colorJitter = 0.018, patchAmount = 0.022, patchScale = 2.4,
    base = new THREE.Color(0x41424a), rng = Math.random, gap = 1.012, inset = 0, flip = false,
  } = opts;
  const w = Math.sqrt(3) * circumradius * gap;
  const dy = 1.5 * circumradius * gap;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const local = new THREE.Matrix4();
  let i = startIndex;
  let row = 0;
  for (let y = minY + circumradius; y <= maxY - circumradius * 0.5; y += dy, row++) {
    const off = (row % 2) * 0.5 * w;
    for (let x = minX + w * 0.5 + off; x <= maxX - w * 0.3; x += w) {
      if (!pointInPolygon(x, y, polygon, inset + circumradius * 0.8)) continue;
      if (i >= mesh.count) return i;
      dummy.position.set(x, y, 0);
      // `flip` turns each tile to face −Z. Rotating the frame instead would mirror the
      // polygon's Y axis and lay the whole patch out somewhere it does not belong.
      dummy.rotation.set(flip ? Math.PI : 0, 0, (rng() - 0.5) * 0.018);
      dummy.updateMatrix();
      local.multiplyMatrices(matrix, dummy.matrix);
      mesh.setMatrixAt(i, local);
      const patch = patchNoise(x * patchScale + 37, y * patchScale + 91) - 0.5;
      color.copy(base).offsetHSL(0, 0, patch * patchAmount + (rng() - 0.5) * colorJitter);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  return i;
}

export function pointInPolygon(x, y, poly, margin = 0) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  if (!inside || margin <= 0) return inside;
  // Reject points closer than `margin` to any edge.
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const dx = xj - xi, dy = yj - yi;
    const l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / l2));
    if (Math.hypot(x - (xi + t * dx), y - (yi + t * dy)) < margin) return false;
  }
  return true;
}

/**
 * Smooth 2D value noise on a 256-cell lattice, used to give instanced detail a tone that
 * varies in patches rather than as per-element white noise. Returns roughly 0..1.
 */
const _LAT = 256;
const _lat = (() => {
  let a = 0x9e3779b9;
  const t = new Float32Array(_LAT * _LAT);
  for (let i = 0; i < t.length; i++) {
    a ^= a << 13; a ^= a >>> 17; a ^= a << 5; a >>>= 0;
    t[i] = a / 4294967296;
  }
  return t;
})();
export function patchNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (i, j) => _lat[((j & (_LAT - 1)) * _LAT) + (i & (_LAT - 1))];
  const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** Deterministic PRNG (mulberry32) so procedural detail is stable between reloads. */
export function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Extrudes a 2D outline (array of [x,y]) into a plate of given thickness centred on z=0. */
export function plate(outline, thickness, bevel = 0) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/**
 * Aerodynamic control surface: the planform `outline` (local XY) lofted into a solid with a
 * rounded edge all round and a thickness that tapers across the span, which is what gives a
 * Starship flap its wing-like read instead of the slab a plain extrusion produces.
 *
 * `taper(x)` returns a 0..1 thickness multiplier for the local x coordinate; by default the
 * surface keeps full thickness at the root and thins to 45% at the outboard tip.
 */
export function aeroPlate(outline, thickness, opts = {}) {
  const {
    edge = thickness * 0.42,      // radius of the rounded edge
    segments = 4,
    taper = null,
  } = opts;
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const core = Math.max(thickness - edge * 2, thickness * 0.15);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core, bevelEnabled: true, bevelThickness: (thickness - core) / 2,
    bevelSize: edge, bevelSegments: segments, steps: 1, curveSegments: 1,
  });
  g.translate(0, 0, -core / 2);
  if (taper) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * taper(pos.getX(i), pos.getY(i)));
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** Linear taper helper for aeroPlate: full thickness at x0, `endScale` at x1. */
export function spanTaper(x0, x1, endScale = 0.45) {
  const d = (x1 - x0) || 1;
  return (x) => {
    const t = Math.max(0, Math.min(1, (x - x0) / d));
    return 1 - (1 - endScale) * t * t;
  };
}

/** Convenience: mesh with shadows enabled. */
export function mesh(geometry, material, opts = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.castShadow ?? true;
  m.receiveShadow = opts.receiveShadow ?? true;
  if (opts.name) m.name = opts.name;
  if (opts.position) m.position.set(...opts.position);
  if (opts.rotation) m.rotation.set(...opts.rotation);
  return m;
}

/** Radial array helper: calls fn(angle, index) n times. */
export function radial(n, fn, offset = 0) {
  for (let i = 0; i < n; i++) fn(offset + (i / n) * Math.PI * 2, i);
}
