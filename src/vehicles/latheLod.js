/**
 * A level of detail by substitution for a body of revolution (a tyre): past `distance` metres the
 * full mesh gives way to a lathe of its own outline. The outline is measured on the mesh itself:
 * along the axis, in `bins` slices, the largest radius (the tread, the sidewall's bulge) and the
 * smallest (the bead), so the silhouette and the size are the mesh's; what goes is the tread
 * pattern and the sidewall's lettering, which at that distance are under a pixel or two.
 *
 * The Model Y's four tyres from Blender are 142 016 triangles each, 47 % of the car (audit of
 * 8-11-2026, §23); the lathe is a few thousand. The far copy's material is the near one's without
 * its maps: the lathe's UVs are not the sculpt's, and a normal or occlusion map read through them
 * would draw nonsense (and the scene's integrity check rejects constant UVs under a map).
 */
import * as THREE from 'three';

/** The lathe outline [r, a] pairs (a along the axis) of a geometry whose axis is `axis` ('x'|'y'|'z'). */
export function revolutionOutline(geometry, { axis = 'z', bins = 40 } = {}) {
  const p = geometry.attributes.position;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const c = new THREE.Vector3(); geometry.boundingBox.getCenter(c);
  const ai = { x: 0, y: 1, z: 2 }[axis], ri = [0, 1, 2].filter(i => i !== ai);
  const lo = geometry.boundingBox.min.getComponent(ai), hi = geometry.boundingBox.max.getComponent(ai);
  const rMax = new Float64Array(bins).fill(-Infinity), rMin = new Float64Array(bins).fill(Infinity);
  for (let i = 0; i < p.count; i++) {
    const v = [p.getX(i) - c.x, p.getY(i) - c.y, p.getZ(i) - c.z];
    const a = v[ai] + c.getComponent(ai), r = Math.hypot(v[ri[0]], v[ri[1]]);
    const b = Math.min(bins - 1, Math.max(0, Math.floor((a - lo) / (hi - lo) * bins)));
    if (r > rMax[b]) rMax[b] = r;
    if (r < rMin[b]) rMin[b] = r;
  }
  const at = (b) => lo + (b + 0.5) / bins * (hi - lo);
  const outer = [], inner = [];
  for (let b = 0; b < bins; b++) {
    if (!Number.isFinite(rMax[b])) continue;
    outer.push([rMax[b], at(b)]);
    inner.push([rMin[b], at(b)]);
  }
  // Closed: the bead on one side, out along the tread, back along the other bead.
  return { centre: c, axis, outline: [[inner[0][0], lo], [outer[0][0], lo], ...outer, [outer.at(-1)[0], hi], [inner.at(-1)[0], hi], ...inner.reverse()] };
}

// One far copy per near material, shared by every lathe made from it (four tyres, one material).
const FAR = new WeakMap();

/** Replaces `mesh` in its parent by a THREE.LOD: the mesh near, its lathe past `distance`. */
export function latheLod(mesh, { axis = 'z', bins = 40, segments = 72, distance = 25 } = {}) {
  const { centre, outline } = revolutionOutline(mesh.geometry, { axis, bins });
  // Consecutive equal points would make zero-area triangles (the scene check rejects them).
  const pts = outline.filter((q, i) => i === 0 || Math.hypot(q[0] - outline[i - 1][0], q[1] - outline[i - 1][1]) > 1e-5);
  const g = new THREE.LatheGeometry(pts.map(([r, a]) => new THREE.Vector2(r, a)), segments);
  // LatheGeometry turns about +y: bring its axis onto the mesh's, then onto its centre.
  if (axis === 'z') g.rotateX(Math.PI / 2);
  else if (axis === 'x') g.rotateZ(-Math.PI / 2);
  g.translate(axis === 'x' ? 0 : centre.x, axis === 'y' ? 0 : centre.y, axis === 'z' ? 0 : centre.z);
  g.computeVertexNormals();
  const strip = (m) => {
    if (FAR.has(m)) return FAR.get(m);
    const f = m.clone();
    FAR.set(m, f);
    f.map = null; f.normalMap = null; f.aoMap = null; f.roughnessMap = null; f.metalnessMap = null; f.bumpMap = null;
    f.name = `${m.name}-far`;
    // The closed outline turns both ways round the profile; both faces are drawn.
    f.side = THREE.DoubleSide;
    return f;
  };
  const far = new THREE.Mesh(g, Array.isArray(mesh.material) ? mesh.material.map(strip) : strip(mesh.material));
  far.name = `${mesh.name}-far`;
  far.castShadow = mesh.castShadow; far.receiveShadow = mesh.receiveShadow;
  const lod = new THREE.LOD();
  lod.name = `${mesh.name}-lod`;
  lod.position.copy(mesh.position); lod.quaternion.copy(mesh.quaternion); lod.scale.copy(mesh.scale);
  const parent = mesh.parent;
  parent.add(lod);
  mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1);
  lod.addLevel(mesh, 0);
  lod.addLevel(far, distance);
  lod.userData.triangles = { near: (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3, far: g.index.count / 3 };
  return lod;
}
