// police.js — the BCPD response: patrol and interceptor cars that pursue,
// ram, shoot and form roadblocks, scaled by the wanted level. Units spawn on
// roads near (but not on top of) the player, hunt the search zone when he
// breaks line of sight, and their live states feed the HUD response panel.

import * as THREE from 'three';
import { Vehicle } from './vehicle.js';

const DESIRED_UNITS = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 6 };
const STATUS_BY_STATE = {
  PURSUIT: 'PURSUIT', RAM: 'RAMMING', ROADBLOCK: 'ROADBLOCK',
  SEARCHING: 'SEARCHING', LEAVE: 'SEARCHING',
};

// Steer a vehicle toward a world point with a simple pursuit controller.
export function driveToward(veh, tx, tz, dt, aggression = 1) {
  const dx = tx - veh.pos.x, dz = tz - veh.pos.z;
  const dist = Math.hypot(dx, dz);
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - veh.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let throttle = dist > 10 ? 1 : 0.55;
  let steer = THREE.MathUtils.clamp(diff * 1.7, -1, 1);
  if (Math.abs(diff) > 2.3 && dist < 13) {
    throttle = -0.75;
    steer = THREE.MathUtils.clamp(-diff * 1.4, -1, 1);
  } else if (Math.abs(diff) > 1.25) {
    throttle = 0.45;
  }
  veh.update(dt, { throttle: throttle * aggression, steer, handbrake: false });
  return dist;
}

export class PoliceManager {
  constructor(G) {
    this.G = G;
    this.units = [];
    this.roadblockTimer = 8;
    this.spawnTimer = 0;
    this.cones = [];
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.7 });
    for (let i = 0; i < 10; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.75, 8), coneMat);
      cone.visible = false;
      G.scene.add(cone);
      this.cones.push(cone);
    }
  }

  playerPos() {
    const G = this.G;
    return G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
  }

  randomRoadPointNear(x, z, minD, maxD) {
    const segs = this.G.roadSegments;
    for (let tries = 0; tries < 10; tries++) {
      const s = segs[Math.floor(Math.random() * segs.length)];
      const t = Math.random();
      const px = s.x0 + (s.x1 - s.x0) * t, pz = s.z0 + (s.z1 - s.z0) * t;
      const d = Math.hypot(px - x, pz - z);
      if (d >= minD && d <= maxD) return { x: px, z: pz, seg: s };
    }
    return null;
  }

  spawnUnit(kind) {
    const G = this.G;
    const pp = this.playerPos();
    const spot = this.randomRoadPointNear(pp.x, pp.z, 120, 200);
    if (!spot) return;
    const type = kind ?? (G.wanted.level >= 3 && Math.random() < 0.45 ? 'interceptor' : 'police');
    const heading = Math.atan2(spot.seg.x1 - spot.seg.x0, spot.seg.z1 - spot.seg.z0);
    const veh = new Vehicle(G, type, '#1a1d24', spot.x, spot.z, heading);
    const unit = {
      veh, state: 'PURSUIT', shootCd: 1 + Math.random(), flashOff: Math.random() * 2,
      searchTarget: null, leaveTimer: 0,
    };
    veh.driver = unit;
    this.units.push(unit);
    return unit;
  }

  placeRoadblock() {
    const G = this.G;
    const pp = this.playerPos();
    const pv = G.player.vehicle;
    const fwd = pv
      ? { x: Math.sin(pv.heading), z: Math.cos(pv.heading) }
      : { x: Math.sin(G.player.heading), z: Math.cos(G.player.heading) };
    const bx = pp.x + fwd.x * 92, bz = pp.z + fwd.z * 92;
    const perp = { x: fwd.z, z: -fwd.x };
    for (let i = 0; i < 2; i++) {
      const unit = this.spawnUnit('police');
      if (!unit) return;
      const off = (i === 0 ? -3.4 : 3.4);
      unit.veh.pos.x = bx + perp.x * off;
      unit.veh.pos.z = bz + perp.z * off;
      unit.veh.heading = Math.atan2(perp.x, perp.z) + (i === 0 ? 0.25 : -0.25);
      unit.veh.mesh.rotation.y = unit.veh.heading;
      unit.veh.speed = 0;
      unit.state = 'ROADBLOCK';
    }
    this.cones.forEach((cone, i) => {
      cone.visible = true;
      cone.position.set(bx + perp.x * (i - 4.5) * 1.9, 0.4, bz + perp.z * (i - 4.5) * 1.9);
    });
    if (G.hud) G.hud.showBanner('ROADBLOCK AHEAD', 'red');
  }

  clearRoadblockVisuals() {
    for (const cone of this.cones) cone.visible = false;
  }

  removeUnit(unit) {
    unit.veh.dispose(this.G);
    const i = this.units.indexOf(unit);
    if (i >= 0) this.units.splice(i, 1);
  }

  // The HUD panel reads the nearest units with live status tags.
  nearestUnits(count = 4) {
    const pp = this.playerPos();
    return this.units
      .map((u) => ({
        dist: Math.round(Math.hypot(u.veh.pos.x - pp.x, u.veh.pos.z - pp.z)),
        status: STATUS_BY_STATE[u.state] ?? 'PURSUIT',
        state: u.state,
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count);
  }

  update(dt) {
    const G = this.G;
    const level = G.wanted.level;
    const pp = this.playerPos();
    const seen = G.wanted.seenRecently(4.5);

    if (level === 0) {
      for (const u of [...this.units]) {
        u.state = 'LEAVE';
        u.leaveTimer += dt;
        driveToward(u.veh, u.veh.pos.x + Math.sin(u.veh.heading) * 60, u.veh.pos.z + Math.cos(u.veh.heading) * 60, dt, 0.7);
        const d = Math.hypot(u.veh.pos.x - pp.x, u.veh.pos.z - pp.z);
        if (d > 260 || u.leaveTimer > 9) this.removeUnit(u);
      }
      this.clearRoadblockVisuals();
      return;
    }

    const active = this.units.filter((u) => u.state !== 'LEAVE');
    this.spawnTimer -= dt;
    if (active.length < (DESIRED_UNITS[level] ?? 0) && this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      this.spawnUnit();
    }

    this.roadblockTimer -= dt;
    const hasBlock = this.units.some((u) => u.state === 'ROADBLOCK');
    if (level >= 3 && G.player.vehicle && !hasBlock && this.roadblockTimer <= 0) {
      this.roadblockTimer = 26;
      this.placeRoadblock();
    }
    if (!hasBlock) this.clearRoadblockVisuals();

    for (const u of [...this.units]) {
      const veh = u.veh;
      const dist = Math.hypot(veh.pos.x - pp.x, veh.pos.z - pp.z);
      if (dist > 360) { this.removeUnit(u); continue; }

      // Lightbar: alternate red/blue with a per-unit phase.
      const lb = veh.mesh.userData.lightbar;
      if (lb) {
        const phase = (G.time * 6.5 + u.flashOff) % 2;
        lb.redMat.emissiveIntensity = phase < 1 ? 3.4 : 0.2;
        lb.blueMat.emissiveIntensity = phase < 1 ? 0.2 : 3.4;
      }

      if (u.state === 'ROADBLOCK') {
        veh.update(dt, { throttle: 0, steer: 0, handbrake: true });
        if (dist < 30) {
          u.state = 'PURSUIT';
          if (G.hud) G.hud.showBanner('ROADBLOCK BREACHED', 'red');
        }
        continue;
      }

      if (!seen) {
        if (u.state !== 'SEARCHING') { u.state = 'SEARCHING'; u.searchTarget = null; }
        if (!u.searchTarget || Math.hypot(u.searchTarget.x - veh.pos.x, u.searchTarget.z - veh.pos.z) < 9) {
          const zone = G.wanted.searchZone;
          const a = Math.random() * Math.PI * 2, r = Math.random() * zone.r;
          u.searchTarget = { x: zone.x + Math.cos(a) * r, z: zone.z + Math.sin(a) * r };
        }
        driveToward(veh, u.searchTarget.x, u.searchTarget.z, dt, 0.55);
        continue;
      }

      if (u.state === 'SEARCHING') u.state = 'PURSUIT';
      const wantRam = (veh.type === 'interceptor' || level >= 2) && dist < 19;
      u.state = wantRam ? 'RAM' : 'PURSUIT';
      if (u.state === 'RAM') {
        driveToward(veh, pp.x, pp.z, dt, 1.12);
      } else {
        const pv = G.player.vehicle;
        const back = pv
          ? { x: pp.x - Math.sin(pv.heading) * 8, z: pp.z - Math.cos(pv.heading) * 8 }
          : { x: pp.x, z: pp.z };
        driveToward(veh, back.x, back.z, dt, 1);
      }

      // Officers shoot at an on-foot player who is close and hot enough.
      if (!G.player.vehicle && !G.player.inBoat && level >= 2 && dist < 27 && !G.player.dead) {
        u.shootCd -= dt;
        if (u.shootCd <= 0) {
          u.shootCd = 0.85 + Math.random() * 0.5;
          const from = new THREE.Vector3(veh.pos.x, veh.pos.y + 1.15, veh.pos.z);
          const to = new THREE.Vector3(pp.x, pp.y + 1.25, pp.z);
          if (G.fx) G.fx.tracer(from, to, '#ffc98a');
          if (G.audio) G.audio.gunshot(0.35);
          if (Math.random() < 0.34) G.damagePlayer(5);
        }
      }
    }
  }
}
