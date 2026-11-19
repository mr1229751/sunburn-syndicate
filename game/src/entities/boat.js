// boat.js — the watercraft: Teo's speedboat at Pier 4 (drivable, used by
// the finale) and Viktor Salazar's yacht anchored in the bay, which the
// last job sends him to destroy.

import * as THREE from 'three';
import { shoreX } from '../world/districts.js';

// A low centre-console speedboat with a wedge bow and an outboard motor.
export function buildBoatMesh(color = '#e86a58') {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.35 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.72, 4.6), hullMat);
  hull.position.y = 0.28;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.16, 2.1, 4), hullMat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.y = 1;
  bow.scale.x = 1;
  bow.position.set(0, 0.3, 3.2);
  bow.scale.set(1, 1, 0.62);
  g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 3.6),
    new THREE.MeshStandardMaterial({ color: '#f2ead8', roughness: 0.6 }));
  deck.position.set(0, 0.68, -0.2);
  g.add(deck);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.08),
    new THREE.MeshStandardMaterial({ color: '#16222e', roughness: 0.12, metalness: 0.5 }));
  shield.position.set(0, 1.05, 0.9);
  shield.rotation.x = -0.3;
  g.add(shield);
  for (const sx of [-0.5, 0.5]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55),
      new THREE.MeshStandardMaterial({ color: '#7a2030', roughness: 0.8 }));
    seat.position.set(sx, 0.85, -0.5);
    g.add(seat);
  }
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.4),
    new THREE.MeshStandardMaterial({ color: '#191b21', roughness: 0.45, metalness: 0.4 }));
  motor.position.set(0, 0.55, -2.5);
  g.add(motor);
  return g;
}

// Drivable boat: simple arcade handling on the water, bobbing on the swell.
export class Boat {
  constructor(G, x, z, heading = 0, color) {
    this.G = G;
    this.mesh = buildBoatMesh(color);
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.phase = Math.random() * 6;
    this.name = 'CORAL RUNNER';
    G.scene.add(this.mesh);
  }

  get pos() { return this.mesh.position; }
  displaySpeedKmh() { return Math.abs(this.speed) * 3.6; }

  update(dt, input) {
    const throttle = THREE.MathUtils.clamp(input.throttle ?? 0, -1, 1);
    const steer = THREE.MathUtils.clamp(input.steer ?? 0, -1, 1);
    this.speed += throttle * 9 * dt;
    this.speed -= this.speed * 0.24 * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, -6, 25);
    this.heading += steer * 0.85 * dt * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 6 + 0.25);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    // Stay on the water: never beach the boat on the shoreline.
    const minX = shoreX(this.pos.z) - 24;
    if (this.pos.x < minX) { this.pos.x = minX; this.speed *= 0.6; }
    this.pos.x = Math.min(this.pos.x, 1500);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -850, 950);
    this.pos.y = -0.12 + Math.sin(this.G.time * 1.6 + this.phase) * 0.07;
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -steer * 0.05 - Math.sin(this.G.time * 1.3 + this.phase) * 0.015;
    this.mesh.rotation.x = -this.speed * 0.006 + Math.sin(this.G.time * 1.9 + this.phase) * 0.012;
  }
}

// Salazar's yacht: a big white target anchored in the bay for the finale.
export function buildYacht(G) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.32, metalness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: '#14222e', roughness: 0.15, metalness: 0.6 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.2, 30), white);
  hull.position.y = 1.2;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(3.75, 8, 4), white);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.42);
  bow.position.set(0, 1.2, 18.6);
  g.add(bow);
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.2, 20), white);
  deck1.position.set(0, 3.8, -1);
  g.add(deck1);
  const band = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.8, 19), glass);
  band.position.set(0, 4.1, -1);
  g.add(band);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(5, 1.9, 12), white);
  deck2.position.set(0, 5.8, -2);
  g.add(deck2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6, 6), white);
  mast.position.set(0, 9.4, -2);
  g.add(mast);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.4), white);
  radar.position.set(0, 11.6, -2);
  g.add(radar);
  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.22, 29),
    new THREE.MeshStandardMaterial({ color: '#201408', emissive: '#ffb800', emissiveIntensity: 1.5 }));
  lightStrip.position.y = 2.6;
  g.add(lightStrip);
  g.position.set(715, 0, 300);
  g.rotation.y = -0.55;
  G.scene.add(g);
  const yacht = {
    mesh: g, health: 340, maxHealth: 340, dead: false, sinkT: 0,
    get pos() { return g.position; },
  };
  G.yacht = yacht;
  return yacht;
}

// Bob the yacht; once destroyed it burns, lists and sinks.
export function updateYacht(G, dt) {
  const y = G.yacht;
  if (!y) return;
  if (y.dead) {
    y.sinkT += dt;
    y.mesh.position.y = -y.sinkT * 0.35;
    y.mesh.rotation.z = Math.min(0.5, y.sinkT * 0.06);
    if (Math.random() < dt * 6 && G.fx) {
      G.fx.fire(y.mesh.position.x + (Math.random() - 0.5) * 8, 3.5, y.mesh.position.z + (Math.random() - 0.5) * 16, 1.4);
    }
    return;
  }
  y.mesh.position.y = Math.sin(G.time * 0.8) * 0.12;
  y.mesh.rotation.z = Math.sin(G.time * 0.6) * 0.008;
}
