// wanted.js — Bahía Coral's heat: crimes add heat, heat sets the star
// level, and the BCPD search zone follows the last place the player was
// seen. Stay unseen and the heat bleeds away; a respray at Taller Diablo
// wipes what the police have not yet seen.

export const HEAT_THRESHOLDS = [0, 40, 130, 260, 430, 640];

export class WantedSystem {
  constructor(G) {
    this.G = G;
    this.heat = 0;
    this.level = 0;
    this.searchZone = { x: 0, z: 0, r: 95 };
    this.lastSeenAt = -100;
    this.everWanted = false;
  }

  levelForHeat(heat) {
    let level = 0;
    for (let i = 1; i < HEAT_THRESHOLDS.length; i++) {
      if (heat >= HEAT_THRESHOLDS[i]) level = i;
    }
    return level;
  }

  // Record a crime at a place: theft, gunfire, a ramming, a killing.
  commitCrime(points, x, z) {
    const before = this.level;
    this.heat = Math.min(1000, this.heat + points);
    this.searchZone.x = x;
    this.searchZone.z = z;
    this.lastSeenAt = this.G.time;
    this.level = this.levelForHeat(this.heat);
    if (this.level > 0) this.everWanted = true;
    if (this.level > before && this.G.onWantedLevelUp) {
      this.G.onWantedLevelUp(this.level);
    }
  }

  // Directly set a level (missions and staged scenes script the heat).
  setLevel(level, x, z) {
    this.heat = HEAT_THRESHOLDS[level] ?? 0;
    this.level = level;
    if (x !== undefined) {
      this.searchZone.x = x;
      this.searchZone.z = z;
      this.lastSeenAt = this.G.time;
    }
    if (level > 0) this.everWanted = true;
  }

  clearHeat() {
    this.heat = 0;
    this.level = 0;
  }

  seenRecently(seconds) {
    return this.G.time - this.lastSeenAt < seconds;
  }

  // The police "see" the player when a unit is close; the helicopter's
  // spotlight extends that reach at night-time star levels.
  computeSeen() {
    const G = this.G;
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    for (const u of G.police.units) {
      const d = Math.hypot(u.veh.pos.x - pp.x, u.veh.pos.z - pp.z);
      if (d < 62) return true;
    }
    if (G.heli && G.heli.active) {
      const d = Math.hypot(G.heli.pos.x - pp.x, G.heli.pos.z - pp.z);
      if (d < 85) return true;
    }
    return false;
  }

  update(dt) {
    const G = this.G;
    if (this.level === 0 && this.heat <= 0) return;
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    if (this.computeSeen()) {
      this.lastSeenAt = G.time;
      this.searchZone.x += (pp.x - this.searchZone.x) * Math.min(1, dt * 1.5);
      this.searchZone.z += (pp.z - this.searchZone.z) * Math.min(1, dt * 1.5);
      this.heat = Math.min(1000, this.heat + dt * 1.6);
    } else {
      const decay = this.level >= 4 ? 5.2 : 8.5;
      this.heat = Math.max(0, this.heat - decay * dt);
    }
    const next = this.levelForHeat(this.heat);
    if (next !== this.level) {
      this.level = next;
      if (next === 0 && this.everWanted && G.onHeatCleared) G.onHeatCleared();
    }
  }
}
