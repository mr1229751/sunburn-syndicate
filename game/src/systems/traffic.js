// traffic.js — Bahía Coral's ambient traffic: cars that pick connected
// road segments at every junction, hold their lane, queue behind each other
// and keep the boulevard alive. Cars spawn on roads near the player and
// retire when he leaves them behind.

import * as THREE from 'three';
import { Vehicle } from '../entities/vehicle.js';

const TRAFFIC_TYPES = ['coupe', 'taxi', 'hatch', 'pickup', 'solara'];
const TRAFFIC_COLORS = ['#c0c4cc', '#8a1f2a', '#1f3a5f', '#c9a227', '#2a2d33', '#4a7a5e', '#e8e4da', '#7a4a8a', '#d4692e'];
const MAX_TRAFFIC = 13;

export class TrafficManager {
  constructor(G) {
    this.G = G;
    this.drivers = [];
    this.adjacency = new Map();
    for (const s of G.roadSegments) {
      const key = `${s.x0},${s.z0}`;
      if (!this.adjacency.has(key)) this.adjacency.set(key, []);
      this.adjacency.get(key).push(s);
    }
    this.spawnTimer = 0;
  }

  segmentPoint(s, t, laneSide) {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0;
    const len = Math.hypot(dx, dz) || 1;
    const rx = (dz / len) * 3.1 * laneSide, rz = (-dx / len) * 3.1 * laneSide;
    return { x: s.x0 + dx * t + rx, z: s.z0 + dz * t + rz, dx: dx / len, dz: dz / len };
  }

  spawnOne() {
    const G = this.G;
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    for (let tries = 0; tries < 8; tries++) {
      const s = G.roadSegments[Math.floor(Math.random() * G.roadSegments.length)];
      const mid = this.segmentPoint(s, 0.5, 1);
      const d = Math.hypot(mid.x - pp.x, mid.z - pp.z);
      if (d < 130 || d > 300) continue;
      const type = TRAFFIC_TYPES[Math.floor(Math.random() * TRAFFIC_TYPES.length)];
      const color = type === 'taxi' ? '#f2b21b' : TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
      const start = this.segmentPoint(s, Math.random() * 0.5, 1);
      const veh = new Vehicle(G, type, color, start.x, start.z, Math.atan2(start.dx, start.dz));
      veh.isTraffic = true;
      this.drivers.push({ veh, seg: s, cruise: 8.5 + Math.random() * 4.5 });
      return;
    }
  }

  nextSegment(driver) {
    const s = driver.seg;
    const key = `${s.x1},${s.z1}`;
    const options = (this.adjacency.get(key) ?? []).filter((o) => !(o.x1 === s.x0 && o.z1 === s.z0));
    if (options.length === 0) {
      // Dead end: turn around on the same segment, flipped.
      driver.seg = { x0: s.x1, z0: s.z1, x1: s.x0, z1: s.z0 };
      return;
    }
    driver.seg = options[Math.floor(Math.random() * options.length)];
  }

  update(dt) {
    const G = this.G;
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    this.spawnTimer -= dt;
    if (this.drivers.length < MAX_TRAFFIC && this.spawnTimer <= 0) {
      this.spawnTimer = 0.7;
      this.spawnOne();
    }
    for (const driver of [...this.drivers]) {
      const veh = driver.veh;
      const distToPlayer = Math.hypot(veh.pos.x - pp.x, veh.pos.z - pp.z);
      if (distToPlayer > 400 || veh.dead) {
        veh.dispose(G);
        this.drivers.splice(this.drivers.indexOf(driver), 1);
        continue;
      }
      const s = driver.seg;
      const look = this.segmentPoint(s, 1, 1);
      const distEnd = Math.hypot(look.x - veh.pos.x, look.z - veh.pos.z);
      if (distEnd < 7) this.nextSegment(driver);
      const ahead = this.segmentPoint(driver.seg, 1, 1);
      const midAhead = {
        x: veh.pos.x + Math.sin(veh.heading) * 10,
        z: veh.pos.z + Math.cos(veh.heading) * 10,
      };
      let blocked = false;
      for (const other of G.cars) {
        if (other === veh) continue;
        if (Math.hypot(other.pos.x - midAhead.x, other.pos.z - midAhead.z) < 4.6) { blocked = true; break; }
      }
      const targetHeading = Math.atan2(ahead.x - veh.pos.x, ahead.z - veh.pos.z);
      let diff = targetHeading - veh.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = THREE.MathUtils.clamp(diff * 1.8, -1, 1);
      let throttle = 0;
      if (!blocked) {
        const speedRatio = veh.speed / driver.cruise;
        throttle = speedRatio < 0.92 ? 0.75 : 0.1;
        if (Math.abs(diff) > 0.9) throttle = 0.3;
      } else if (veh.speed > 1) {
        throttle = -0.55;
      }
      veh.update(dt, { throttle, steer, handbrake: false });
    }
  }
}
