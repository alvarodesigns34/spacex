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

/** Tangent-ogive nose profile from radius R at y0 to a tip of radius `tipR` at y0 + L. */
export function ogiveProfile(R, L, y0, steps = 24, tipR = 0.0, power = 1.0) {
  const pts = [];
  // Ogive radius of curvature
  const rho = (R * R + L * L) / (2 * R);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * L; // distance along axis from base
    let r = Math.sqrt(Math.max(0, rho * rho - x * x)) + R - rho;
    r = Math.max(r, 0);
    r = Math.pow(r / R, power) * R;
    r = Math.max(r, tipR * (1 - t) + tipR * t);
    pts.push({ r: i === steps ? tipR : r, y: y0 + x });
  }
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

/** Hexagonal prism (pointy-top in local XY, extruded along +Z) used for instanced TPS tiles. */
export function hexPrism(circumradius, thickness, bevel = 0.15) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const x = circumradius * Math.cos(a), y = circumradius * Math.sin(a);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: thickness * bevel,
    bevelSize: circumradius * 0.06, bevelSegments: 1, steps: 1, curveSegments: 1,
  });
  g.translate(0, 0, -thickness * bevel);
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
 * Places instanced hex tiles on a surface of revolution between y0..y1 and an angular window
 * centred on `phiCenter` (radians) with half-width `phiHalf`. Returns the instance count.
 * `mesh` must be an InstancedMesh with enough capacity. Uses `THREE.Object3D` matrices.
 */
export function tileSurfaceOfRevolution(mesh, profile, opts) {
  const {
    y0, y1, phiCenter = 0, phiHalf = Math.PI / 2, circumradius, startIndex = 0,
    colorJitter = 0.06, base = new THREE.Color(0x1b1b1d), rowOffsetY = 0, maskFn = null,
    rng = Math.random, gap = 1.06,
  } = opts;
  const w = Math.sqrt(3) * circumradius * gap;       // flat-to-flat pitch
  const dy = 1.5 * circumradius * gap;                // row pitch
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  let i = startIndex;
  let row = 0;
  for (let y = y0 + rowOffsetY; y <= y1; y += dy, row++) {
    const p = profileAt(profile, y);
    if (!p || p.r < circumradius * 0.6) continue;
    const arc = 2 * phiHalf * p.r;
    const count = Math.max(1, Math.floor(arc / w));
    const dphi = w / p.r;
    const offset = (row % 2) * 0.5;
    for (let k = 0; k < count; k++) {
      const phi = phiCenter - phiHalf + dphi * (k + 0.5 + offset);
      if (phi > phiCenter + phiHalf - dphi * 0.4) continue;
      if (maskFn && !maskFn(y, phi)) continue;
      if (i >= mesh.count) return i;
      const sn = Math.sin(phi), cs = Math.cos(phi);
      // surface normal
      const nx = p.nr * sn, ny = p.ny, nz = p.nr * cs;
      dummy.position.set(p.r * sn, y, p.r * cs);
      _v.set(nx, ny, nz).normalize();
      // Align local +Z to normal, keep local +Y towards vehicle axis (up) where possible.
      const target = dummy.position.clone().add(_v);
      dummy.up.copy(Math.abs(_v.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : up);
      dummy.lookAt(target);
      // tiny manufacturing scatter
      dummy.rotateZ((rng() - 0.5) * 0.02);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const j = (rng() - 0.5) * colorJitter;
      color.copy(base).offsetHSL(0, 0, j);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  return i;
}

/**
 * Places hex tiles over a planar polygon (in the XY plane of `matrix`), with local +Z as the
 * tile normal. `polygon` is an array of [x, y].
 */
export function tilePolygon(mesh, polygon, matrix, opts) {
  const { circumradius, startIndex = 0, colorJitter = 0.06, base = new THREE.Color(0x1b1b1d), rng = Math.random, gap = 1.06 } = opts;
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
      if (!pointInPolygon(x, y, polygon)) continue;
      if (i >= mesh.count) return i;
      dummy.position.set(x, y, 0);
      dummy.rotation.set(0, 0, (rng() - 0.5) * 0.02);
      dummy.updateMatrix();
      local.multiplyMatrices(matrix, dummy.matrix);
      mesh.setMatrixAt(i, local);
      color.copy(base).offsetHSL(0, 0, (rng() - 0.5) * colorJitter);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  return i;
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
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
