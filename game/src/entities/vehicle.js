// vehicle.js — every car in Bahía Coral: a low, wide, semi-gloss 3D build
// (body, glass cabin, wheels, lit tail lights, blob shadow) plus the arcade
// driving model — throttle, steering, drift, collisions and damage — shared
// by the player, traffic, police, racers and the mission truck.

import * as THREE from 'three';
import { blobShadowTexture, signTexture } from '../world/textures.js';
import { groundHeightAt } from '../world/cityBuilder.js';

export const VEHICLE_TYPES = {
  solara: { name: 'SOLARA GT', topSpeed: 46, accel: 15, handling: 1.25, health: 130 },
  coupe: { name: 'PALMA COUPE', topSpeed: 40, accel: 13, handling: 1.2, health: 110 },
  taxi: { name: 'CORAL CAB', topSpeed: 36, accel: 11.5, handling: 1.1, health: 110 },
  hatch: { name: 'BRISA HATCH', topSpeed: 33, accel: 10.5, handling: 1.15, health: 95 },
  pickup: { name: 'CAIMÁN PICKUP', topSpeed: 35, accel: 11, handling: 1.0, health: 140 },
  truck: { name: 'CAIMÁN HAULER', topSpeed: 26, accel: 7.5, handling: 0.8, health: 260 },
  suv: { name: 'VIPER SUV', topSpeed: 39, accel: 12.5, handling: 1.05, health: 190 },
  police: { name: 'BCPD CRUISER', topSpeed: 44, accel: 14.5, handling: 1.2, health: 150 },
  interceptor: { name: 'BCPD INTERCEPTOR', topSpeed: 49, accel: 16, handling: 1.3, health: 150 },
};

// Build the visual mesh for one vehicle type. Forward is +Z; the returned
// group's userData carries the moving parts (wheels, doors, lightbar, paint).
export function buildVehicleMesh(type, color) {
  const g = new THREE.Group();
  const spec = VEHICLE_TYPES[type] ?? VEHICLE_TYPES.coupe;
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: '#141a26', roughness: 0.14, metalness: 0.65 });
  const trim = new THREE.MeshStandardMaterial({ color: '#191b21', roughness: 0.6, metalness: 0.3 });
  const isTruck = type === 'truck';
  const len = isTruck ? 7.6 : type === 'pickup' ? 5 : 4.4;
  const wid = isTruck ? 2.45 : 1.95;
  const wheelR = isTruck ? 0.48 : 0.34;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, isTruck ? 0.8 : 0.55, len), paint);
  body.position.y = wheelR + 0.28;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.94, 0.3, 0.7), paint);
  nose.position.set(0, wheelR + 0.22, len / 2 - 0.2);
  g.add(nose);

  if (isTruck) {
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.6, 4.9),
      new THREE.MeshStandardMaterial({ color: '#8a8f99', roughness: 0.55, metalness: 0.4 }),
    );
    cargo.position.set(0, wheelR + 1.75, -1.1);
    g.add(cargo);
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 0.9), glass);
    cabGlass.position.set(0, wheelR + 1.05, 2.9);
    g.add(cabGlass);
  } else if (type === 'pickup') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 1.7), paint);
    cab.position.set(0, wheelR + 0.85, 0.75);
    g.add(cab);
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.5), glass);
    cabGlass.position.set(0, wheelR + 0.92, 0.75);
    g.add(cabGlass);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.4, 2.2), trim);
    bed.position.set(0, wheelR + 0.62, -1.35);
    g.add(bed);
  } else {
    const cabinH = type === 'suv' ? 0.72 : 0.52;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, cabinH, type === 'suv' ? 2.9 : 2.15), glass);
    cabin.position.set(0, wheelR + 0.55 + cabinH / 2 - 0.06, type === 'suv' ? -0.1 : -0.25);
    g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.07, type === 'suv' ? 2.7 : 1.9), paint);
    roof.position.set(0, wheelR + 0.55 + cabinH + 0.02, cabin.position.z);
    g.add(roof);
  }

  // Driver's door on a hinge (the left door opens when Teo gets in or out).
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-wid / 2 - 0.02, wheelR + 0.45, 0.55);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.15), paint);
  door.position.set(0, 0.05, -0.5);
  doorPivot.add(door);
  g.add(doorPivot);

  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#101114', roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.45, wheelR * 0.45, 0.26, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: '#9aa0ab', roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  const wheelZ = isTruck ? [2.9, -2.6] : [len / 2 - 0.95, -(len / 2 - 0.95)];
  for (const sx of [-1, 1]) {
    for (let wi = 0; wi < 2; wi++) {
      const wGroup = new THREE.Group();
      const tyre = new THREE.Mesh(wheelGeo, wheelMat);
      tyre.rotation.z = Math.PI / 2;
      wGroup.add(tyre);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      wGroup.add(hub);
      wGroup.position.set(sx * (wid / 2 - 0.05), wheelR, wheelZ[wi]);
      g.add(wGroup);
      wheels.push({ group: wGroup, front: wi === 0, spin: 0 });
    }
  }

  const headMat = new THREE.MeshStandardMaterial({ color: '#333322', emissive: '#fff3c4', emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#330a10', emissive: '#ff2442', emissiveIntensity: 1.1 });
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), headMat);
    head.position.set(sx * wid * 0.62, wheelR + 0.42, len / 2 + 0.01);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.06), tailMat);
    tail.position.set(sx * wid * 0.62, wheelR + 0.48, -len / 2 - 0.01);
    g.add(tail);
  }

  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.2, 0.34),
      new THREE.MeshBasicMaterial({ map: signTexture('TAXI', '#ffb800', '#14100a') }),
    );
    sign.position.set(0, wheelR + 1.28, -0.25);
    g.add(sign);
  }

  let lightbar = null;
  if (type === 'police' || type === 'interceptor') {
    const doorWhite = new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.35, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 2.4), doorWhite);
      panel.position.set(sx * (wid / 2 + 0.005), wheelR + 0.3, 0);
      g.add(panel);
    }
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.42, 0.16), trim);
    pushBar.position.set(0, wheelR + 0.18, len / 2 + 0.12);
    g.add(pushBar);
    const redMat = new THREE.MeshStandardMaterial({ color: '#2a0208', emissive: '#ff1e38', emissiveIntensity: 2.5 });
    const blueMat = new THREE.MeshStandardMaterial({ color: '#020a2a', emissive: '#0088ff', emissiveIntensity: 2.5 });
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.13, 0.42), trim);
    barBase.position.set(0, wheelR + 1.24, -0.25);
    g.add(barBase);
    const redHalf = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.4), redMat);
    redHalf.position.set(-0.31, wheelR + 1.3, -0.25);
    g.add(redHalf);
    const blueHalf = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.4), blueMat);
    blueHalf.position.set(0.31, wheelR + 1.3, -0.25);
    g.add(blueHalf);
    lightbar = { redMat, blueMat };
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(wid + 1.1, len + 1.2),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  g.add(shadow);

  g.userData = { paint, wheels, doorPivot, lightbar, tailMat, headMat, len, wid, spec };
  return g;
}

// A drivable vehicle: arcade physics, damage, upgrades, door animation.
export class Vehicle {
  constructor(G, type, color, x, z, heading = 0) {
    this.G = G;
    this.type = type;
    this.spec = { ...(VEHICLE_TYPES[type] ?? VEHICLE_TYPES.coupe) };
    this.mesh = buildVehicleMesh(type, color);
    this.mesh.position.set(x, groundHeightAt(G, x, z), z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0;
    this.steerVis = 0;
    this.drift = 0;
    this.health = this.spec.health;
    this.maxHealth = this.spec.health;
    this.engineLevel = 0;
    this.armourLevel = 0;
    this.driver = null;
    this.doorTimer = 0;
    this.smokeTimer = 0;
    this.dead = false;
    G.scene.add(this.mesh);
    G.cars.push(this);
  }

  get pos() { return this.mesh.position; }
  get name() { return this.spec.name; }
  get topSpeed() { return this.spec.topSpeed * (1 + this.engineLevel * 0.16); }
  get accelRate() { return this.spec.accel * (1 + this.engineLevel * 0.2); }
  get condition() { return Math.max(0, this.health / this.maxHealth); }
  displaySpeedKmh() { return Math.abs(this.speed) * 3.6; }

  setPaint(color) {
    this.mesh.userData.paint.color.set(color);
  }

  openDoor() { this.doorTimer = 1.1; }

  damage(amount, cause = 'impact') {
    if (this.dead) return;
    const reduced = amount / (1 + this.armourLevel * 0.55);
    this.health -= reduced;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.mesh.userData.paint.color.multiplyScalar(0.35);
      if (this.G.fx) this.G.fx.explosion(this.pos.x, this.pos.y + 0.8, this.pos.z, 0.7);
    }
    void cause;
  }

  repair() {
    this.health = this.maxHealth;
    this.dead = false;
  }

  // input: { throttle -1..1, steer -1..1, handbrake bool }
  update(dt, input) {
    const G = this.G;
    if (this.dead) input = { throttle: 0, steer: 0, handbrake: true };
    const throttle = THREE.MathUtils.clamp(input.throttle ?? 0, -1, 1);
    const steer = THREE.MathUtils.clamp(input.steer ?? 0, -1, 1);
    const maxReverse = 11;

    if (throttle > 0) this.speed += this.accelRate * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= 26 * dt;
      else this.speed += this.accelRate * 0.55 * throttle * dt;
    }
    const drag = 0.35 + (input.handbrake ? 1.4 : 0);
    this.speed -= this.speed * drag * dt * 0.32;
    if (!input.handbrake && Math.abs(throttle) < 0.05) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3.2 * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -maxReverse, this.topSpeed);

    const speedRatio = THREE.MathUtils.clamp(this.speed / 14, -1.4, 1.4);
    const targetDrift = input.handbrake && Math.abs(this.speed) > 9 ? steer * 0.5 : 0;
    this.drift += (targetDrift - this.drift) * Math.min(1, dt * 5);
    this.heading += steer * this.spec.handling * speedRatio * dt * (input.handbrake ? 1.5 : 1);
    this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 10);

    const moveDir = this.heading + this.drift;
    const vx = Math.sin(moveDir) * this.speed;
    const vz = Math.cos(moveDir) * this.speed;
    this.pos.x += vx * dt;
    this.pos.z += vz * dt;

    // Collisions: buildings push the car out and scrub speed; hard hits hurt.
    const radius = 1.55;
    for (const c of G.colliders) {
      const nx = THREE.MathUtils.clamp(this.pos.x, c.x0, c.x1);
      const nz = THREE.MathUtils.clamp(this.pos.z, c.z0, c.z1);
      const dx = this.pos.x - nx, dz = this.pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.001;
        const push = radius - d;
        if (d2 > 0.0001) {
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
        } else {
          this.pos.x = c.x1 + radius;
        }
        if (Math.abs(this.speed) > 13) {
          this.damage((Math.abs(this.speed) - 11) * 1.6);
          if (G.fx) G.fx.sparks(this.pos.x, 0.7, this.pos.z, 8);
          if (G.audio) G.audio.crash();
        }
        this.speed *= 0.42;
      }
    }
    for (const other of G.cars) {
      if (other === this || other.dead) continue;
      const dx = this.pos.x - other.pos.x, dz = this.pos.z - other.pos.z;
      const d2 = dx * dx + dz * dz;
      const minD = 3.1;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / 2;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
        other.pos.x -= (dx / d) * push;
        other.pos.z -= (dz / d) * push;
        const rel = Math.abs(this.speed - other.speed);
        if (rel > 7) {
          this.damage(rel * 0.55);
          other.damage(rel * 0.55);
          if (G.fx) G.fx.sparks(this.pos.x, 0.7, this.pos.z, 10);
          if (G.audio) G.audio.crash();
          if (G.onVehicleRam) G.onVehicleRam(this, other, rel);
        }
        this.speed *= 0.82;
        other.speed *= 0.9;
      }
    }

    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -600, 905);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -615, 720);
    this.pos.y = groundHeightAt(G, this.pos.x, this.pos.z);

    this.mesh.rotation.y = this.heading;
    const lean = -this.steerVis * Math.min(0.06, Math.abs(this.speed) * 0.0022);
    this.mesh.rotation.z = lean;
    this.mesh.rotation.x = THREE.MathUtils.clamp(-(throttle * 0.012), -0.02, 0.02);
    for (const w of this.mesh.userData.wheels) {
      w.spin += (this.speed / 0.34) * dt;
      w.group.rotation.x = w.spin;
      if (w.front) w.group.rotation.y = this.steerVis * 0.42;
    }
    if (this.doorTimer > 0) {
      this.doorTimer -= dt;
      const t = Math.max(0, this.doorTimer);
      const open = t > 0.75 ? (1.1 - t) / 0.35 : t / 0.75;
      this.mesh.userData.doorPivot.rotation.y = -1.9 * THREE.MathUtils.clamp(open, 0, 1);
    } else {
      this.mesh.userData.doorPivot.rotation.y *= Math.max(0, 1 - dt * 8);
    }
    this.mesh.userData.tailMat.emissiveIntensity = throttle < 0 || input.handbrake ? 2.6 : 1.1;

    if (this.health < this.maxHealth * 0.4 && !this.dead) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0 && G.fx) {
        this.smokeTimer = 0.14;
        G.fx.smoke(this.pos.x, this.pos.y + 1.1, this.pos.z, 1);
      }
    }
  }

  dispose(G) {
    G.scene.remove(this.mesh);
    const i = G.cars.indexOf(this);
    if (i >= 0) G.cars.splice(i, 1);
  }
}
