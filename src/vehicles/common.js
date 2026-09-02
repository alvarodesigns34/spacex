/**
 * Shared props: display mounts, pedestals and 1.80 m human figures for scale.
 * Mounts are presentation furniture (not to scale with any SpaceX ground equipment).
 */
import * as THREE from 'three';
import { mesh, mergeAll, mat4 } from '../geometry/utils.js';

export function buildMount(M, { radius = 8, inner = 4.6, height = 8, legs = 6, clampRadius = 4.5, clamps = 4 } = {}) {
  const g = new THREE.Group();
  g.name = 'mount';
  const ring = new THREE.Shape();
  ring.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  ring.holes.push(hole);
  const deck = new THREE.ExtrudeGeometry(ring, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 64 });
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, height - 1.2, 0);
  g.add(mesh(deck, M.mount));
  // Legs
  const legParts = [];
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + Math.PI / legs;
    const r = (radius + inner) / 2;
    legParts.push({ geometry: new THREE.BoxGeometry(1.4, height - 1.2, 1.4), matrix: mat4([Math.sin(a) * r, (height - 1.2) / 2, Math.cos(a) * r], [0, a, 0]) });
    legParts.push({ geometry: new THREE.BoxGeometry(2.2, 0.3, 2.2), matrix: mat4([Math.sin(a) * r, 0.15, Math.cos(a) * r], [0, a, 0]) });
  }
  g.add(mesh(mergeAll(legParts), M.mount));
  // Hold-down clamps at the vehicle skirt
  const clampParts = [];
  for (let i = 0; i < clamps; i++) {
    const a = (i / clamps) * Math.PI * 2 + Math.PI / clamps;
    clampParts.push({ geometry: new THREE.BoxGeometry(0.66, 0.62, 0.46), matrix: mat4([Math.sin(a) * (clampRadius + 0.26), height + 0.31, Math.cos(a) * (clampRadius + 0.26)], [0, a, 0]) });
  }
  if (clampParts.length) g.add(mesh(mergeAll(clampParts), M.mountYellow));
  // Safety rail
  const rail = new THREE.TorusGeometry(radius - 0.3, 0.05, 6, 96);
  rail.rotateX(Math.PI / 2);
  rail.translate(0, height + 1.1, 0);
  g.add(mesh(rail, M.mount, { castShadow: false }));
  const posts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    posts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), matrix: mat4([Math.sin(a) * (radius - 0.3), height + 0.55, Math.cos(a) * (radius - 0.3)]) });
  }
  g.add(mesh(mergeAll(posts), M.mount, { castShadow: false }));
  return g;
}

export function buildPedestal(M, { radius = 1.2, height = 1.2, post = 0 } = {}) {
  const g = new THREE.Group();
  g.name = 'pedestal';
  const base = new THREE.CylinderGeometry(radius, radius * 1.15, height, 48);
  base.translate(0, height / 2, 0);
  g.add(mesh(base, M.mount));
  if (post > 0) {
    const p = new THREE.CylinderGeometry(0.18, 0.22, post, 24);
    p.translate(0, height + post / 2, 0);
    g.add(mesh(p, M.mount));
  }
  return g;
}

/** 1.80 m person: proportions from standard anthropometric figures. */
export function buildHuman(M, { suit = 'white' } = {}) {
  const g = new THREE.Group();
  g.name = 'human';
  const body = suit === 'white' ? M.human : M.humanDark;
  const parts = [];
  parts.push({ geometry: new THREE.SphereGeometry(0.105, 16, 12), matrix: mat4([0, 1.69, 0]) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), matrix: mat4([0, 1.55, 0]) });
  parts.push({ geometry: new THREE.CapsuleGeometry(0.17, 0.42, 4, 12), matrix: mat4([0, 1.22, 0]) });
  parts.push({ geometry: new THREE.CapsuleGeometry(0.055, 0.55, 4, 10), matrix: mat4([0.24, 1.15, 0], [0, 0, 0.08]) });
  parts.push({ geometry: new THREE.CapsuleGeometry(0.055, 0.55, 4, 10), matrix: mat4([-0.24, 1.15, 0], [0, 0, -0.08]) });
  const legs = [];
  legs.push({ geometry: new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), matrix: mat4([0.1, 0.46, 0]) });
  legs.push({ geometry: new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), matrix: mat4([-0.1, 0.46, 0]) });
  legs.push({ geometry: new THREE.BoxGeometry(0.11, 0.06, 0.26), matrix: mat4([0.1, 0.03, 0.04]) });
  legs.push({ geometry: new THREE.BoxGeometry(0.11, 0.06, 0.26), matrix: mat4([-0.1, 0.03, 0.04]) });
  g.add(mesh(mergeAll(parts), body));
  g.add(mesh(mergeAll(legs), M.humanDark));
  return g;
}
