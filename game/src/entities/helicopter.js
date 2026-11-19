// helicopter.js — the BCPD helicopter: at four stars and above it orbits
// the player with a real spotlight and a visible light cone on the road.
// Its SPOTLIGHT tag tops the HUD response panel.

import * as THREE from 'three';

export class Helicopter {
  constructor(G) {
    this.G = G;
    this.active = false;
    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#14161c', roughness: 0.35, metalness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#e8ecf2', roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), bodyMat);
    body.scale.set(1, 0.82, 1.9);
    this.group.add(body);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#1c2a3a', roughness: 0.12, metalness: 0.6 }));
    cockpit.position.set(0, 0.18, 1.55);
    this.group.add(cockpit);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.34, 2.2), whiteMat);
    stripe.position.y = -0.25;
    this.group.add(stripe);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 4.6, 8), bodyMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.25, -3.6);
    this.group.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 0.8), bodyMat);
    fin.position.set(0, 0.55, -5.8);
    this.group.add(fin);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.18), whiteMat);
    this.tailRotor.position.set(0.2, 0.55, -5.8);
    this.group.add(this.tailRotor);
    for (const sx of [-0.95, 0.95]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), bodyMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.25, 0.2);
      this.group.add(skid);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.8, 0.09), bodyMat);
      strut.position.set(sx, -0.85, 0.6);
      this.group.add(strut);
    }
    this.rotor = new THREE.Group();
    for (const rot of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.05, 0.42),
        new THREE.MeshStandardMaterial({ color: '#0c0d10', roughness: 0.5 }));
      blade.rotation.y = rot;
      this.rotor.add(blade);
    }
    this.rotor.position.y = 1.45;
    this.group.add(this.rotor);

    // The visible spotlight cone: a unit cone, apex at the helicopter,
    // stretched and aimed at the player every frame.
    const coneGeo = new THREE.ConeGeometry(0.34, 1, 20, 1, true);
    coneGeo.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color: '#ffeec2', transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.cone.visible = false;
    G.scene.add(this.cone);

    this.spot = new THREE.SpotLight('#fff2cf', 0, 240, 0.34, 0.55, 1.3);
    G.scene.add(this.spot);
    G.scene.add(this.spot.target);

    this.group.position.set(300, 60, 300);
    this.group.visible = false;
    G.scene.add(this.group);
    this.orbitPhase = Math.random() * 6;
  }

  get pos() { return this.group.position; }
  get status() { return 'SPOTLIGHT'; }

  update(dt) {
    const G = this.G;
    const shouldBeActive = G.wanted.level >= 4 && !G.player.dead;
    this.active = shouldBeActive;
    this.group.visible = shouldBeActive;
    this.cone.visible = shouldBeActive;
    if (!shouldBeActive) {
      this.spot.intensity = 0;
      return;
    }
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    this.orbitPhase += dt * 0.21;
    const tx = pp.x + Math.sin(this.orbitPhase) * 30;
    const tz = pp.z + Math.cos(this.orbitPhase * 0.83) * 30;
    const ty = 34 + Math.sin(G.time * 0.7) * 2;
    this.group.position.x += (tx - this.group.position.x) * Math.min(1, dt * 1.6);
    this.group.position.y += (ty - this.group.position.y) * Math.min(1, dt * 1.6);
    this.group.position.z += (tz - this.group.position.z) * Math.min(1, dt * 1.6);
    this.group.rotation.y = Math.atan2(pp.x - this.group.position.x, pp.z - this.group.position.z);
    this.rotor.rotation.y += dt * 23;
    this.tailRotor.rotation.x += dt * 31;

    const from = this.group.position;
    const to = new THREE.Vector3(pp.x, pp.y ?? 0, pp.z);
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    this.cone.position.copy(from);
    this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this.cone.scale.set(dist, dist, dist);
    this.spot.position.copy(from);
    this.spot.target.position.copy(to);
    this.spot.intensity = 550;
  }
}
