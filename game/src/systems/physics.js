// physics.js — the small shared physics helpers: circle-vs-building
// collision for people, segment-vs-building line-of-sight tests for gunfire,
// and ground height (the bridge deck) re-exported for walkers.

import { groundHeightAt } from '../world/cityBuilder.js';

export { groundHeightAt };

// Push a circle (a person) out of every building collider; returns true if
// any collider was touched.
export function collideCircle(G, pos, radius) {
  let hit = false;
  for (const c of G.colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.000001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: leave by the nearest face.
        const left = pos.x - c.x0, right = c.x1 - pos.x;
        const top = pos.z - c.z0, bottom = c.z1 - pos.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = c.x0 - radius;
        else if (m === right) pos.x = c.x1 + radius;
        else if (m === top) pos.z = c.z0 - radius;
        else pos.z = c.z1 + radius;
      }
    }
  }
  return hit;
}

// Is the straight line from (x0,z0) to (x1,z1) blocked by any building?
// 2D slab test per collider — good enough for hitscan line of sight.
export function segmentBlocked(G, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  for (const c of G.colliders) {
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (x0 < c.x0 || x0 > c.x1) continue;
    } else {
      let t1 = (c.x0 - x0) / dx, t2 = (c.x1 - x0) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (z0 < c.z0 || z0 > c.z1) continue;
    } else {
      let t1 = (c.z0 - z0) / dz, t2 = (c.z1 - z0) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmax > 0.02 && tmin < 0.98) return true;
  }
  return false;
}

// Distance from a point to a segment, for ray-hit tests.
export function pointSegmentDistance(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const len2 = dx * dx + dz * dz || 0.0001;
  let t = ((px - x0) * dx + (pz - z0) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + dx * t, cz = z0 + dz * t;
  return Math.hypot(px - cx, pz - cz);
}
