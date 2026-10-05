/**
 * A small glTF-binary reader for the checks that run without a browser: the node tree with its
 * names and transforms, and every mesh's vertex positions in the scene's frame (enough to measure
 * an asset; materials and textures are not read).
 */
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';

/** The GLB's JSON and binary chunk. */
export async function readGlb(path) {
  const buf = await readFile(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a glTF binary`);
  let o = 12, json = null, bin = null;
  while (o < buf.length) {
    const len = buf.readUInt32LE(o), type = buf.readUInt32LE(o + 4), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    o += 8 + len;
  }
  return { json, bin, bytes: buf.length };
}

const nodeMatrix = (n) => (n.matrix ? new THREE.Matrix4().fromArray(n.matrix)
  : new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1]))));

/** Every node of the default scene with its world matrix and parent's name ({ name, matrix, mesh, parent }). */
export function nodes({ json }) {
  const out = [];
  const walk = (i, parentM, parent) => {
    const n = json.nodes[i], m = parentM.clone().multiply(nodeMatrix(n));
    out.push({ name: n.name ?? '', matrix: m, mesh: n.mesh, parent, index: i });
    for (const c of n.children ?? []) walk(c, m, n.name ?? '');
  };
  for (const i of json.scenes[json.scene ?? 0].nodes) walk(i, new THREE.Matrix4(), null);
  return out;
}

/** A float VEC3 accessor's values. */
function vec3s({ json, bin }, index) {
  const a = json.accessors[index], v = json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.type !== 'VEC3') throw new Error('positions: float VEC3 expected');
  const stride = v.byteStride ?? 12, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), out = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = bin.readFloatLE(base + i * stride + k * 4);
  return out;
}

/** The world-space bounding box of every mesh under the node named `rootName` (or the whole scene). */
export function worldBox(glb, rootName = null) {
  const box = new THREE.Box3(), p = new THREE.Vector3();
  const all = nodes(glb), under = new Set();
  if (rootName) {
    const mark = (i) => { under.add(i); for (const c of glb.json.nodes[i].children ?? []) mark(c); };
    const r = all.find(n => n.name === rootName); if (r) mark(r.index);
  }
  for (const n of all) {
    if (n.mesh === undefined || (rootName && !under.has(n.index))) continue;
    for (const prim of glb.json.meshes[n.mesh].primitives) {
      const pos = vec3s(glb, prim.attributes.POSITION);
      for (let i = 0; i < pos.length; i += 3) box.expandByPoint(p.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(n.matrix));
    }
  }
  return box;
}
