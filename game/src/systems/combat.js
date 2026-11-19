// combat.js — gunfire and fire: pooled tracers, muzzle flashes, sparks,
// smoke and layered explosion fireballs (the FX every other system calls),
// plus the hitscan weapon model, the four weapons, enemy guards who fight
// from cover, and the port's exploding ammo crates.

import * as THREE from 'three';
import { buildHumanFigure, poseFigure } from '../entities/pedestrian.js';
import { fireTexture, haloTexture } from '../world/textures.js';
import { segmentBlocked } from './physics.js';

export const WEAPONS = {
  1: { name: 'PISTOL', damage: 22, rate: 0.3, range: 65, mag: 12, reserve: Infinity, auto: false, spread: 0.012, pellets: 1 },
  2: { name: 'SMG', damage: 13, rate: 0.092, range: 55, mag: 30, reserve: 150, auto: true, spread: 0.03, pellets: 1 },
  3: { name: 'CARBINE', damage: 31, rate: 0.135, range: 95, mag: 30, reserve: 120, auto: true, spread: 0.008, pellets: 1 },
  4: { name: 'SHOTGUN', damage: 10, rate: 0.85, range: 34, mag: 6, reserve: 30, auto: false, spread: 0.075, pellets: 6 },
};

// Pooled visual effects: nothing here allocates per frame in steady state.
export class Effects {
  constructor(G) {
    this.G = G;
    this.tracers = [];
    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.LineBasicMaterial({
        color: '#ffd9a0', transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(tracerGeo.clone(), mat);
      line.visible = false;
      line.frustumCulled = false;
      G.scene.add(line);
      this.tracers.push({ line, ttl: 0 });
    }
    this.sprites = [];
    this.flashLight = new THREE.PointLight('#ffb066', 0, 34, 1.8);
    G.scene.add(this.flashLight);
  }

  spawnSprite(tex, color, x, y, z, scale, ttl, opts = {}) {
    let s = this.sprites.find((sp) => sp.ttl <= 0);
    if (!s) {
      if (this.sprites.length > 130) return null;
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.G.scene.add(sprite);
      s = { sprite, ttl: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0, fadePow: 1 };
      this.sprites.push(s);
    }
    const sp = s.sprite;
    sp.visible = true;
    sp.material.map = tex;
    sp.material.color.set(color);
    sp.material.opacity = opts.opacity ?? 0.95;
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale, 1);
    s.ttl = ttl; s.max = ttl;
    s.vx = opts.vx ?? 0; s.vy = opts.vy ?? 0; s.vz = opts.vz ?? 0;
    s.grow = opts.grow ?? 0;
    s.baseOpacity = opts.opacity ?? 0.95;
    return s;
  }

  tracer(from, to, color = '#ffd9a0') {
    const t = this.tracers.find((tr) => tr.ttl <= 0) ?? this.tracers[0];
    const attr = t.line.geometry.attributes.position;
    attr.setXYZ(0, from.x, from.y, from.z);
    attr.setXYZ(1, to.x, to.y, to.z);
    attr.needsUpdate = true;
    t.line.material.color.set(color);
    t.line.material.opacity = 0.9;
    t.line.visible = true;
    t.ttl = 0.16;
  }

  muzzle(x, y, z, scale = 1) {
    this.spawnSprite(haloTexture(), '#ffd9a0', x, y, z, 0.85 * scale, 0.055, { opacity: 1 });
  }

  sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3;
      this.spawnSprite(haloTexture(), '#ffc46b', x, y, z, 0.16 + Math.random() * 0.14, 0.32 + Math.random() * 0.15, {
        vx: Math.cos(a) * r, vz: Math.sin(a) * r, vy: 1 + Math.random() * 2.4, opacity: 1,
      });
    }
  }

  smoke(x, y, z, scale = 1) {
    this.spawnSprite(haloTexture(), '#4a4a55', x, y, z, 1.1 * scale, 1.5, {
      vy: 1.5, grow: 1.6, opacity: 0.34, additive: false,
    });
  }

  fire(x, y, z, scale = 1) {
    this.spawnSprite(fireTexture(), '#ffffff', x, y, z, 1.6 * scale, 0.5, {
      vy: 0.7, grow: 1.2, opacity: 0.95,
    });
    this.spawnSprite(haloTexture(), '#ff9d4d', x, y, z, 2.6 * scale, 0.4, { opacity: 0.5 });
  }

  explosion(x, y, z, scale = 1) {
    for (let i = 0; i < 5; i++) {
      this.spawnSprite(fireTexture(), '#ffffff',
        x + (Math.random() - 0.5) * 1.6 * scale, y + Math.random() * 0.8, z + (Math.random() - 0.5) * 1.6 * scale,
        (2 + Math.random() * 1.6) * scale, 0.5, { vy: 1.6, grow: 4.2 * scale, opacity: 1 });
    }
    for (let i = 0; i < 6; i++) this.smoke(x + (Math.random() - 0.5) * 2, y + 1.2, z + (Math.random() - 0.5) * 2, scale);
    this.sparks(x, y + 0.4, z, 14);
    this.flashLight.position.set(x, y + 1.5, z);
    this.flashLight.intensity = 320 * scale;
    this.G.shake = Math.min(0.55, (this.G.shake ?? 0) + 0.2 * scale);
    if (this.G.audio) this.G.audio.explosionSfx();
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.ttl > 0) {
        t.ttl -= dt;
        t.line.material.opacity = Math.max(0, t.ttl / 0.075) * 0.9;
        if (t.ttl <= 0) t.line.visible = false;
      }
    }
    for (const s of this.sprites) {
      if (s.ttl <= 0) continue;
      s.ttl -= dt;
      if (s.ttl <= 0) { s.sprite.visible = false; continue; }
      const sp = s.sprite;
      sp.position.x += s.vx * dt;
      sp.position.y += s.vy * dt;
      sp.position.z += s.vz * dt;
      if (s.grow) {
        const ns = sp.scale.x + s.grow * dt;
        sp.scale.set(ns, ns, 1);
      }
      sp.material.opacity = s.baseOpacity * Math.min(1, s.ttl / (s.max * 0.55));
    }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 1500);
  }
}

// An enemy gunman: fights from cover, peeking to fire bursts at the player.
export class Guard {
  constructor(G, x, z, opts = {}) {
    this.G = G;
    this.figure = buildHumanFigure(
      { shirt: '#26262e', pants: '#17171d', skin: '#b98a5e', hair: '#0e0e10' },
      { jacket: '#101016' },
    );
    this.figure.position.set(x, 0, z);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.78),
      new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.4, metalness: 0.5 }));
    gun.position.set(0, -0.62, 0.3);
    this.figure.userData.armR.add(gun);
    this.health = opts.health ?? 60;
    this.maxHealth = this.health;
    this.dead = false;
    this.heading = Math.random() * Math.PI * 2;
    this.phase = 'cover';
    this.phaseT = 1 + Math.random() * 1.6;
    this.burstLeft = 0;
    this.burstT = 0;
    this.walkPhase = 0;
    this.coverPoints = opts.coverPoints ?? null;
    this.cover = null;
    this.staged = opts.staged ?? false;
    G.scene.add(this.figure);
  }

  get pos() { return this.figure.position; }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      if (this.G.onEnemyKilled) this.G.onEnemyKilled(this);
    }
  }

  nearestCover() {
    const pts = this.coverPoints ?? this.G.coverPoints;
    let best = null, bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  update(dt) {
    const G = this.G;
    const fig = this.figure;
    if (this.dead) {
      fig.rotation.x += (-Math.PI / 2 - fig.rotation.x) * Math.min(1, dt * 6);
      fig.position.y = 0.16;
      poseFigure(fig, 'dead', 0, dt);
      return;
    }
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    const dist = Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z);
    const toPlayer = Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z);
    this.heading = toPlayer;
    fig.rotation.y = this.heading;

    if (dist > 88) {
      poseFigure(fig, 'stand', 0, dt);
      return;
    }
    if (!this.cover) this.cover = this.nearestCover();
    this.phaseT -= dt;

    if (this.phase === 'cover') {
      poseFigure(fig, 'stand', 0, dt);
      fig.scale.y = 0.84;
      if (this.cover) this.moveToward(this.cover.x, this.cover.z, 4.6, dt);
      if (this.phaseT <= 0) { this.phase = 'fire'; this.phaseT = 1.3; this.burstLeft = 4; this.burstT = 0; }
    } else {
      fig.scale.y = 1;
      poseFigure(fig, 'aim', 0, dt);
      this.burstT -= dt;
      if (this.burstLeft > 0 && this.burstT <= 0) {
        this.burstLeft--;
        this.burstT = 0.15;
        this.shootAtPlayer(dist);
      }
      if (this.phaseT <= 0) {
        this.phase = 'cover';
        this.phaseT = 1.1 + Math.random() * 1.4;
        if (Math.random() < 0.4) this.cover = this.nearestCover();
      }
    }
  }

  moveToward(tx, tz, speed, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.7) return;
    this.pos.x += (dx / d) * speed * dt;
    this.pos.z += (dz / d) * speed * dt;
    this.walkPhase += dt * 9;
    poseFigure(this.figure, 'run', this.walkPhase, dt);
  }

  shootAtPlayer(dist) {
    const G = this.G;
    if (G.player.dead) return;
    const from = new THREE.Vector3(
      this.pos.x + Math.sin(this.heading) * 0.45, 1.32, this.pos.z + Math.cos(this.heading) * 0.45,
    );
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    const spread = 0.5 + dist * 0.012;
    const to = new THREE.Vector3(
      pp.x + (Math.random() - 0.5) * spread, (G.player.vehicle ? 0.9 : 1.15), pp.z + (Math.random() - 0.5) * spread,
    );
    G.fx.tracer(from, to, '#ffb0a0');
    G.fx.muzzle(from.x, from.y, from.z, 0.8);
    if (G.audio) G.audio.gunshot(0.3);
    const hitChance = THREE.MathUtils.clamp(0.52 - dist * 0.006, 0.12, 0.5);
    if (Math.random() < hitChance) {
      if (G.player.vehicle) G.player.vehicle.damage(4);
      else G.damagePlayer(6);
    }
  }

  dispose(G) {
    G.scene.remove(this.figure);
  }
}

// Weapons, ammunition, hitscan resolution and crate destruction.
export class CombatSystem {
  constructor(G) {
    this.G = G;
    this.guards = [];
    this.ammo = {};
    for (const [slot, w] of Object.entries(WEAPONS)) {
      this.ammo[slot] = { mag: w.mag, reserve: w.reserve };
    }
    this.nextShotAt = 0;
    this.pendingChains = [];
  }

  spawnGuard(x, z, opts) {
    const guard = new Guard(this.G, x, z, opts);
    this.guards.push(guard);
    return guard;
  }

  clearGuards() {
    for (const g of this.guards) g.dispose(this.G);
    this.guards = [];
  }

  aliveGuards() { return this.guards.filter((g) => !g.dead).length; }

  reload(slot) {
    const w = WEAPONS[slot];
    const a = this.ammo[slot];
    if (!w || a.mag >= w.mag || a.reserve <= 0) return false;
    const take = Math.min(w.mag - a.mag, a.reserve);
    a.mag += take;
    if (a.reserve !== Infinity) a.reserve -= take;
    if (this.G.audio) this.G.audio.blip(320);
    return true;
  }

  // Fire the player's current weapon along a direction. Returns true if a
  // shot actually left the barrel (ammo + rate permitting).
  fireWeapon(slot, from, dir) {
    const G = this.G;
    const w = WEAPONS[slot];
    const a = this.ammo[slot];
    if (!w || !a) return false;
    if (G.time < this.nextShotAt) return false;
    if (a.mag <= 0) {
      this.reload(slot);
      this.nextShotAt = G.time + 0.25;
      return false;
    }
    this.nextShotAt = G.time + w.rate;
    a.mag -= 1;
    if (G.audio) G.audio.gunshot(1);
    G.recoil = Math.min(1, (G.recoil ?? 0) + (slot === 4 ? 0.7 : 0.3));

    const gunTip = from.clone().addScaledVector(dir, 0.55);
    gunTip.y -= 0.06;
    G.fx.muzzle(gunTip.x, gunTip.y, gunTip.z, slot === 4 ? 1.3 : 1);

    for (let pellet = 0; pellet < w.pellets; pellet++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 1.4;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      this.resolveShot(slot, w, gunTip, d);
    }
    G.wanted.commitCrime(16, G.player.pos.x, G.player.pos.z);
    for (const ped of G.peds) {
      if (Math.hypot(ped.pos.x - G.player.pos.x, ped.pos.z - G.player.pos.z) < 20) {
        ped.scare(G.player.pos.x, G.player.pos.z);
      }
    }
    return true;
  }

  resolveShot(slot, w, from, dir) {
    const G = this.G;
    const end = from.clone().addScaledVector(dir, w.range);
    let bestT = Infinity;
    let hitKind = null;
    let hitObj = null;
    const testSphere = (cx, cy, cz, r, kind, obj) => {
      const ox = cx - from.x, oy = cy - from.y, oz = cz - from.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0 || t > w.range) return;
      const px = from.x + dir.x * t, py = from.y + dir.y * t, pz = from.z + dir.z * t;
      const d = Math.hypot(cx - px, cy - py, cz - pz);
      if (d < r && t < bestT) { bestT = t; hitKind = kind; hitObj = obj; }
    };
    for (const guard of this.guards) {
      if (guard.dead) continue;
      if (segmentBlocked(G, from.x, from.z, guard.pos.x, guard.pos.z)) continue;
      testSphere(guard.pos.x, 1.05, guard.pos.z, 0.66, 'guard', guard);
    }
    for (const crate of G.crates) {
      if (crate.exploded) continue;
      testSphere(crate.x, 0.9, crate.z, 1.15, 'crate', crate);
    }
    for (const car of G.cars) {
      if (car === G.player.vehicle) continue;
      testSphere(car.pos.x, car.pos.y + 0.75, car.pos.z, 2.35, 'car', car);
    }
    if (G.yacht && !G.yacht.dead) {
      testSphere(G.yacht.pos.x, 3.4, G.yacht.pos.z, 15, 'yacht', G.yacht);
    }
    if (G.player.inBoat && G.boat) {
      // The boat's own hull is never a target.
    }
    const hitPoint = bestT === Infinity ? end : from.clone().addScaledVector(dir, bestT);
    G.fx.tracer(from, hitPoint, '#ffe9b0');
    if (hitKind === 'guard') {
      hitObj.damage(w.damage);
      G.hitmark();
    } else if (hitKind === 'crate') {
      this.damageCrate(hitObj, w.damage * 2.2);
      G.hitmark();
    } else if (hitKind === 'car') {
      hitObj.damage(w.damage * 0.8);
      G.fx.sparks(hitPoint.x, hitPoint.y, hitPoint.z, 4);
      G.hitmark();
    } else if (hitKind === 'yacht') {
      hitObj.health -= w.damage;
      G.fx.sparks(hitPoint.x, hitPoint.y, hitPoint.z, 5);
      G.hitmark();
      if (hitObj.health <= 0 && !hitObj.dead) {
        hitObj.dead = true;
        G.fx.explosion(hitObj.pos.x, 4, hitObj.pos.z, 2.6);
        if (G.onYachtDestroyed) G.onYachtDestroyed();
      }
    } else if (bestT === Infinity && segmentBlocked(G, from.x, from.z, end.x, end.z)) {
      G.fx.sparks(end.x, Math.max(0.4, end.y), end.z, 2);
    }
    void slot;
  }

  damageCrate(crate, amount) {
    if (crate.exploded) return;
    crate.health -= amount;
    if (crate.health > 0) return;
    crate.exploded = true;
    crate.mesh.visible = false;
    const G = this.G;
    G.fx.explosion(crate.x, 1, crate.z, 1.35);
    this.explosionDamage(crate.x, crate.z, 7.5, 55);
    for (const other of G.crates) {
      if (other !== crate && !other.exploded &&
          Math.hypot(other.x - crate.x, other.z - crate.z) < 6) {
        this.pendingChains.push({ crate: other, at: G.time + 0.22 });
      }
    }
    if (G.onCrateDestroyed) G.onCrateDestroyed(crate);
  }

  explosionDamage(x, z, radius, damage) {
    const G = this.G;
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    const dp = Math.hypot(pp.x - x, pp.z - z);
    if (dp < radius) {
      if (G.player.vehicle) G.player.vehicle.damage(damage * (1 - dp / radius));
      else G.damagePlayer(damage * (1 - dp / radius));
    }
    for (const guard of this.guards) {
      const d = Math.hypot(guard.pos.x - x, guard.pos.z - z);
      if (d < radius) guard.damage(damage * (1 - d / radius) * 1.6);
    }
    for (const car of G.cars) {
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < radius) car.damage(damage * (1 - d / radius) * 1.2);
    }
  }

  update(dt) {
    const G = this.G;
    for (const g of this.guards) g.update(dt);
    for (const chain of [...this.pendingChains]) {
      if (G.time >= chain.at) {
        this.pendingChains.splice(this.pendingChains.indexOf(chain), 1);
        this.damageCrate(chain.crate, 999);
      }
    }
  }
}
