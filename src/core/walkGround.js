/**
 * Ground for the free cameras, moved out of main.js unchanged (8-11-2026, refactor §36).
 *
 * What a visitor stands on: the terrain function the ground mesh itself is built from, and
 * the pad's two concrete levels with the 1:3 earth embankment round them (pad.js). Analytic,
 * so it costs nothing per frame and cannot disagree with a raycast against a hidden mesh.
 *
 * Sets the rig's ground, obstacles and walls, and returns the walk's route planner (where a
 * double-click in walk mode takes the visitor, and by which way).
 */
import * as THREE from 'three';
import { LAYOUT, OCCLUDER } from './layout.js';
import { terrainHeight } from './terrain.js';
import { PAD, towerToPad } from '../vehicles/pad.js';

export function setupWalkGround({ rig, exhibits, scene, hud, camera, padGround }) {
  const P = exhibits.starship.lay;
  rig.groundAt = (x, z) => Math.max(terrainHeight(x, z), padGround(x, z), 0);
  // Where a walking visitor cannot go: the mounts and plinths, the launch mount and the tower
  // base. Circles round each footprint, a little generous.
  const obs = [];
  for (const [id, lay] of Object.entries(LAYOUT)) {
    if (lay.pad) {
      const [tx, , tz] = towerToPad([PAD.towerX - 3, 0, 0]);
      obs.push([lay.x, lay.z, 18], [lay.x + tx, lay.z + tz, 12]);
    } else if (lay.launchMount) {
      obs.push([lay.x, lay.z, Math.hypot(lay.launchMount.halfX, lay.launchMount.halfZ) + 0.6]);
    } else if (Array.isArray(OCCLUDER[id])) {
      const yaw = THREE.MathUtils.degToRad(lay.yaw ?? 0);
      for (const [ox, oz, r] of OCCLUDER[id]) obs.push([lay.x + ox * Math.cos(yaw) + oz * Math.sin(yaw), lay.z - ox * Math.sin(yaw) + oz * Math.cos(yaw), r + 0.5]);
    } else if (id === 'dragon') obs.push([lay.x, lay.z, 3.0]);
    else if (id === 'roadster') obs.push([lay.x, lay.z, 3.1]);
    else if (id === 'starlink') obs.push([lay.x, lay.z, 1.2]);
  }
  rig.obstacles = obs;
  // Walls a walker goes round: the site fence (open at the service-road gate and along the
  // road) and the flame trench's rim, a 4,2 m drop with nothing to climb out by.
  const fence = scene.getObjectByName('campus')?.userData.fence ?? [];
  const tx = PAD.trenchHalfW, tz = 46;
  rig.walls = [...fence,
    [P.x - tx, P.z - tz, P.x - tx, P.z + tz], [P.x + tx, P.z - tz, P.x + tx, P.z + tz],
    [P.x - tx, P.z - tz, P.x + tx, P.z - tz], [P.x - tx, P.z + tz, P.x + tx, P.z + tz]];
  rig.onWalkSpeed = (v) => hud.notice(`Walking pace · ${v < 10 ? v.toFixed(1) : Math.round(v)} m/s`);
  /**
   * Where a double-click in walk mode takes the visitor, and by which way. An exhibit is
   * walked up to — to the edge of its footprint plus a few metres, on the side the visitor is
   * coming from, facing the point clicked — and anything else is walked to directly. A trip
   * that would cross the site fence goes through the gate on the service road instead of
   * stopping at the wire, which is what the walk used to do.
   */
  return (hit) => {
    let id = null;
    for (let o = hit.object; o; o = o.parent) { const m = /^exhibit-(.+)$/.exec(o.name ?? ''); if (m) { id = m[1]; break; } }
    const c = camera.position;
    let dest = [hit.point.x, hit.point.z];
    if (id) {
      const lay = LAYOUT[id];
      const circ = obs.filter(([ox, oz, r]) => Math.hypot(hit.point.x - ox, hit.point.z - oz) <= r + 0.5)
        .sort((a, b) => a[2] - b[2])[0] ?? [lay.x, lay.z, 2];
      const [ox, oz, r] = circ;
      const dx = c.x - ox, dz = c.z - oz, d = Math.hypot(dx, dz) || 1;
      const stand = r + Math.min(12, 3 + r * 0.25);
      dest = [ox + dx / d * stand, oz + dz / d * stand];
    }
    // No destination on a wall: a point within a metre of one (ground clicked at the foot of
    // the fence or the trench rim) moves a metre clear of it, on the side it was clicked.
    for (const [x0, z0, x1, z1] of rig.walls) {
      const ex = x1 - x0, ez = z1 - z0, L2 = ex * ex + ez * ez || 1;
      const u = Math.max(0, Math.min(1, ((dest[0] - x0) * ex + (dest[1] - z0) * ez) / L2));
      const qx = x0 + ex * u, qz = z0 + ez * u;
      const d = Math.hypot(dest[0] - qx, dest[1] - qz);
      if (d >= 1) continue;
      // Away from the nearest point, or — exactly on the line — to the side the visitor is on.
      let nx = dest[0] - qx, nz = dest[1] - qz;
      if (d < 1e-3) { nx = -ez; nz = ex; if (nx * (c.x - x0) + nz * (c.z - z0) < 0) { nx = -nx; nz = -nz; } }
      const n = Math.hypot(nx, nz) || 1;
      dest = [qx + nx / n, qz + nz / n];
    }
    const route = [];
    const crosses = (w, x0, z0, x1, z1) => { const keep = rig.walls; rig.walls = [w]; const r = rig._crossesWall(x0, z0, x1, z1); rig.walls = keep; return r; };
    // The rear fence runs along z = −18 with its gate on the service road; the sides run
    // from it to the road at z = 20, open at their front ends. Crossing the rear line
    // anywhere but the gate goes through the gate; crossing a side goes round its end.
    if (fence.length >= 4) {
      const gate = [(fence[0][2] + fence[1][0]) / 2, fence[0][1]];
      const rear = crosses(fence[0], c.x, c.z, dest[0], dest[1]) || crosses(fence[1], c.x, c.z, dest[0], dest[1]);
      const side = fence.slice(2).find(w => crosses(w, c.x, c.z, dest[0], dest[1]));
      if (rear) {
        const inside = c.z > gate[1];
        route.push([gate[0], gate[1] + (inside ? 6 : -6)], [gate[0], gate[1] + (inside ? -6 : 6)]);
      } else if (side) {
        route.push([side[2] + Math.sign(c.x - side[2]) * 4, side[3] + 4], [side[2] - Math.sign(c.x - side[2]) * 4, side[3] + 4]);
      }
    }
    route.push(dest);
    return { route, look: hit.point };
  };
}
