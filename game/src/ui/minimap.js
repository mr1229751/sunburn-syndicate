// minimap.js — the circular bottom-left minimap: Bahía Coral's real road
// network, the waterline, the gold GPS route to the mission target (or the
// player's waypoint), blinking police dots, enemy dots, the translucent
// red search-zone circle and the district name pill beneath.

import { BOULEVARD_X, PLACES, districtAt, shoreX } from '../world/districts.js';
import { pointSegmentDistance } from '../systems/physics.js';

const VIEW_RADIUS = 215;

export class Minimap {
  constructor(G) {
    this.G = G;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.pill = document.getElementById('district-pill');
    this.lastDistrict = '';
  }

  draw() {
    const G = this.G;
    const ctx = this.ctx;
    const P = G.player;
    const centre = P.vehicle ? P.vehicle.pos : P.pos;
    const scale = 84 / VIEW_RADIUS;
    const toMap = (x, z) => ({
      x: 84 + (x - centre.x) * scale,
      y: 84 + (z - centre.z) * scale,
    });

    ctx.save();
    ctx.beginPath();
    ctx.arc(84, 84, 82, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#131926';
    ctx.fillRect(0, 0, 168, 168);

    // Water east of the shoreline.
    ctx.fillStyle = '#0e3a4d';
    ctx.beginPath();
    let started = false;
    for (let mz = -VIEW_RADIUS; mz <= VIEW_RADIUS; mz += 14) {
      const wz = centre.z + mz;
      const p = toMap(shoreX(wz), wz);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(168, 168); ctx.lineTo(168, 0);
    ctx.closePath();
    ctx.fill();

    // Roads.
    for (const s of G.roadSegments) {
      if (pointSegmentDistance(centre.x, centre.z, s.x0, s.z0, s.x1, s.z1) > VIEW_RADIUS + 40) continue;
      const a = toMap(s.x0, s.z0), b = toMap(s.x1, s.z1);
      ctx.strokeStyle = s.x0 === BOULEVARD_X && s.x1 === BOULEVARD_X ? '#7a6428' : '#4d5568';
      ctx.lineWidth = s.x0 === BOULEVARD_X && s.x1 === BOULEVARD_X ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // The bridge.
    if (G.bridge) {
      const a = toMap(G.bridge.ax, G.bridge.az), b = toMap(G.bridge.bx, G.bridge.bz);
      ctx.strokeStyle = '#7a6428';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Search zone.
    if (G.wanted.level > 0) {
      const zone = G.wanted.searchZone;
      const p = toMap(zone.x, zone.z);
      ctx.fillStyle = 'rgba(255,36,66,0.13)';
      ctx.strokeStyle = 'rgba(255,36,66,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, zone.r * scale, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // GPS route: Manhattan legs along the grid to the target.
    const target = G.missions.targetPos() ?? G.waypoint;
    if (target) {
      const clampToView = (x, z) => {
        const dx = x - centre.x, dz = z - centre.z;
        const d = Math.hypot(dx, dz);
        if (d <= VIEW_RADIUS * 0.97) return { x, z };
        return { x: centre.x + (dx / d) * VIEW_RADIUS * 0.97, z: centre.z + (dz / d) * VIEW_RADIUS * 0.97 };
      };
      const corner = clampToView(target.x, centre.z);
      const end = clampToView(target.x, target.z);
      const start = { x: 84, y: 84 };
      const c1 = toMap(corner.x, corner.z);
      const c2 = toMap(end.x, end.z);
      ctx.strokeStyle = '#ffb800';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      const tp = toMap(target.x, target.z);
      if (Math.hypot(target.x - centre.x, target.z - centre.z) < VIEW_RADIUS) {
        ctx.strokeStyle = '#ffb800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffb800';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Garage marker.
    const gp = toMap(PLACES.garageFront.x, PLACES.garageFront.z);
    if (Math.abs(gp.x - 84) < 80 && Math.abs(gp.y - 84) < 80) {
      ctx.fillStyle = '#00f0ff';
      ctx.save();
      ctx.translate(gp.x, gp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }

    // Police dots, blinking red/blue.
    const phase = Math.floor(G.time * 3) % 2;
    for (const u of G.police.units) {
      const p = toMap(u.veh.pos.x, u.veh.pos.z);
      if (Math.abs(p.x - 84) > 82 || Math.abs(p.y - 84) > 82) continue;
      ctx.fillStyle = phase === 0 ? '#ff2442' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (G.heli && G.heli.active) {
      const p = toMap(G.heli.pos.x, G.heli.pos.z);
      if (Math.abs(p.x - 84) <= 82 && Math.abs(p.y - 84) <= 82) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Enemy dots.
    ctx.fillStyle = '#ff4030';
    for (const guard of G.combat.guards) {
      if (guard.dead) continue;
      const p = toMap(guard.pos.x, guard.pos.z);
      if (Math.abs(p.x - 84) > 82 || Math.abs(p.y - 84) > 82) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player arrow.
    const heading = P.vehicle ? P.vehicle.heading : (G.boat && P.inBoat ? G.boat.heading : P.heading);
    const ang = Math.atan2(Math.cos(heading), Math.sin(heading));
    ctx.save();
    ctx.translate(84, 84);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#14100a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-2.4, 0); ctx.lineTo(-5, 4.6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '900 10px Arial';
    ctx.fillText('N', 80, 12);
    ctx.restore();

    const name = districtAt(centre.x, centre.z);
    if (name !== this.lastDistrict) {
      this.lastDistrict = name;
      this.pill.textContent = name;
    }
  }
}
