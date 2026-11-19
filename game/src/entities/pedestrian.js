// pedestrian.js — the people of Bahía Coral: articulated low-poly human
// figures (head, torso, jointed arms and legs with walk / aim / panic /
// driving poses) and the Pedestrian walker AI that strolls the sidewalks,
// flees danger and panics when its car is stolen. The player character and
// every enemy guard are built from the same figure factory.

import * as THREE from 'three';
import { blobShadowTexture } from '../world/textures.js';

export const OUTFITS = [
  { shirt: '#e86a58', pants: '#2d3a4a', skin: '#c98a5e', hair: '#2a1c12' },
  { shirt: '#4aa3a2', pants: '#e4ddc8', skin: '#8a5a34', hair: '#101010' },
  { shirt: '#f4e4c1', pants: '#3a3a44', skin: '#e8b088', hair: '#5a3a1a' },
  { shirt: '#ffb800', pants: '#26436b', skin: '#6e4525', hair: '#1c1c22' },
  { shirt: '#ff3d7f', pants: '#22222c', skin: '#c98a5e', hair: '#3a2410' },
  { shirt: '#7ac74f', pants: '#4a3a28', skin: '#8a5a34', hair: '#101010' },
  { shirt: '#2d5da1', pants: '#191922', skin: '#e8b088', hair: '#777777' },
  { shirt: '#e2a83b', pants: '#5e2f1d', skin: '#a06a3a', hair: '#241408' },
];

// Build one articulated figure. userData holds the limb pivots and a pose
// state so animators can swing the limbs without touching the scene graph.
export function buildHumanFigure(outfit, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: outfit.skin, roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: outfit.shirt, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: outfit.pants, roughness: 0.95 });
  const hair = new THREE.MeshStandardMaterial({ color: outfit.hair, roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.25), shirt);
  torso.position.y = 1.24;
  g.add(torso);
  if (opts.jacket) {
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.3),
      new THREE.MeshStandardMaterial({ color: opts.jacket, roughness: 0.85 }));
    jacket.position.y = 1.24;
    g.add(jacket);
  }
  const head = new THREE.Group();
  head.position.y = 1.62;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), skin);
  skull.position.y = 0.13;
  head.add(skull);
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.28), hair);
  hairCap.position.y = 0.3;
  head.add(hairCap);
  if (opts.cap) {
    const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.28),
      new THREE.MeshStandardMaterial({ color: opts.cap, roughness: 0.8 }));
    capTop.position.y = 0.31;
    head.add(capTop);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.2),
      new THREE.MeshStandardMaterial({ color: opts.cap, roughness: 0.8 }));
    brim.position.set(0, 0.26, 0.22);
    head.add(brim);
  }
  if (opts.shades) {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.03),
      new THREE.MeshStandardMaterial({ color: '#0a0a12', roughness: 0.2, metalness: 0.6 }));
    shades.position.set(0, 0.15, 0.14);
    head.add(shades);
  }
  g.add(head);

  function limb(mat, w, len, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    mesh.position.y = -len / 2;
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  }
  const armL = limb(shirt, 0.11, 0.6, -0.29, 1.5);
  const armR = limb(shirt, 0.11, 0.6, 0.29, 1.5);
  const legL = limb(pants, 0.15, 0.92, -0.12, 0.94);
  const legR = limb(pants, 0.15, 0.92, 0.12, 0.94);
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1c1c22', roughness: 0.7 });
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.26), shoeMat);
    shoe.position.set(0, -0.9, 0.05);
    leg.add(shoe);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  g.add(shadow);

  g.userData = { armL, armR, legL, legR, head, torso, pose: 'stand', phase: Math.random() * 6 };
  return g;
}

// Pose the figure: walkPhase advances the swing; pose selects the attitude.
export function poseFigure(fig, pose, walkPhase, dt) {
  const u = fig.userData;
  u.pose = pose;
  const swing = Math.sin(walkPhase) * 0.62;
  const lerp = Math.min(1, dt * 11);
  function setLimb(limb, x, z = 0) {
    limb.rotation.x += (x - limb.rotation.x) * lerp;
    limb.rotation.z += (z - limb.rotation.z) * lerp;
  }
  if (pose === 'walk' || pose === 'run') {
    const amp = pose === 'run' ? 1.5 : 1;
    setLimb(u.legL, swing * amp);
    setLimb(u.legR, -swing * amp);
    setLimb(u.armL, -swing * 0.75 * amp);
    setLimb(u.armR, swing * 0.75 * amp);
  } else if (pose === 'aim') {
    setLimb(u.legL, 0.08);
    setLimb(u.legR, -0.12);
    setLimb(u.armR, -Math.PI / 2 + 0.06);
    setLimb(u.armL, -Math.PI / 2 + 0.35, -0.35);
  } else if (pose === 'panic') {
    setLimb(u.legL, 0.15);
    setLimb(u.legR, -0.15);
    setLimb(u.armL, Math.PI * 0.92, 0.5);
    setLimb(u.armR, Math.PI * 0.92, -0.5);
  } else if (pose === 'drive') {
    setLimb(u.legL, -1.25);
    setLimb(u.legR, -1.15);
    setLimb(u.armL, -0.95, 0.25);
    setLimb(u.armR, -0.95, -0.25);
  } else if (pose === 'dead') {
    setLimb(u.legL, 0.1);
    setLimb(u.legR, -0.06);
    setLimb(u.armL, 0.4, 0.7);
    setLimb(u.armR, -0.3, -0.8);
  } else {
    setLimb(u.legL, 0);
    setLimb(u.legR, 0);
    setLimb(u.armL, Math.sin(walkPhase * 0.4) * 0.05);
    setLimb(u.armR, -Math.sin(walkPhase * 0.4) * 0.05);
  }
}

// A sidewalk citizen: strolls between points near the roads, flees danger.
export class Pedestrian {
  constructor(G, x, z, outfit) {
    this.G = G;
    this.figure = buildHumanFigure(outfit ?? OUTFITS[Math.floor(Math.random() * OUTFITS.length)]);
    this.figure.position.set(x, 0, z);
    this.heading = Math.random() * Math.PI * 2;
    this.state = 'walk';
    this.target = null;
    this.walkPhase = Math.random() * 6;
    this.fleeTimer = 0;
    this.fleeFrom = new THREE.Vector3();
    this.panicTimer = 0;
    this.speed = 1.3 + Math.random() * 0.5;
    G.scene.add(this.figure);
    G.peds.push(this);
  }

  get pos() { return this.figure.position; }

  pickSidewalkTarget() {
    const segs = this.G.roadSegments;
    if (!segs || segs.length === 0) return;
    for (let tries = 0; tries < 6; tries++) {
      const s = segs[Math.floor(Math.random() * segs.length)];
      const dx = this.pos.x - s.x0, dz = this.pos.z - s.z0;
      if (dx * dx + dz * dz > 130 * 130) continue;
      const t = Math.random();
      const along = { x: s.x0 + (s.x1 - s.x0) * t, z: s.z0 + (s.z1 - s.z0) * t };
      const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0) || 1;
      const px = (-(s.z1 - s.z0) / len) * 8.6, pz = ((s.x1 - s.x0) / len) * 8.6;
      const side = Math.random() > 0.5 ? 1 : -1;
      this.target = { x: along.x + px * side, z: along.z + pz * side };
      return;
    }
    this.target = { x: this.pos.x + (Math.random() - 0.5) * 40, z: this.pos.z + (Math.random() - 0.5) * 40 };
  }

  scare(fromX, fromZ, panic = false) {
    if (this.state === 'dead') return;
    this.fleeFrom.set(fromX, 0, fromZ);
    this.fleeTimer = 3.2 + Math.random() * 1.5;
    if (panic) this.panicTimer = 2.6;
    this.state = 'flee';
  }

  update(dt) {
    if (this.state === 'dead') return;
    const p = this.pos;
    let moveX = 0, moveZ = 0, pose = 'stand', speed = 0;
    if (this.panicTimer > 0) {
      this.panicTimer -= dt;
      pose = 'panic';
    } else if (this.state === 'flee' && this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      const dx = p.x - this.fleeFrom.x, dz = p.z - this.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      moveX = dx / d; moveZ = dz / d;
      speed = 4.4;
      pose = 'run';
      if (this.fleeTimer <= 0) this.state = 'walk';
    } else {
      if (!this.target) this.pickSidewalkTarget();
      if (this.target) {
        const dx = this.target.x - p.x, dz = this.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.6) { this.target = null; }
        else {
          moveX = dx / d; moveZ = dz / d;
          speed = this.speed;
          pose = 'walk';
        }
      }
    }
    if (speed > 0) {
      const targetHeading = Math.atan2(moveX, moveZ);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += THREE.MathUtils.clamp(diff, -dt * 7, dt * 7);
      p.x += Math.sin(this.heading) * speed * dt;
      p.z += Math.cos(this.heading) * speed * dt;
      p.x = THREE.MathUtils.clamp(p.x, -595, 460);
      p.z = THREE.MathUtils.clamp(p.z, -610, 615);
      this.walkPhase += dt * (pose === 'run' ? 11 : 6.4);
    }
    this.figure.rotation.y = this.heading;
    poseFigure(this.figure, pose, this.walkPhase, dt);
  }

  dispose(G) {
    G.scene.remove(this.figure);
    const i = G.peds.indexOf(this);
    if (i >= 0) G.peds.splice(i, 1);
  }
}
