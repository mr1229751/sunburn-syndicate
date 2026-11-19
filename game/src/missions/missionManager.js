// missionManager.js — runs the eight jobs: spawns each stage's actors,
// watches its completion, moves the gold beacon and the minimap target,
// pays the rewards and keeps the ratings. Stage types: steal, deliver,
// goto, collect, kill, destroy, disable, convoy, checkpoints (the race),
// upgrade, escape, boat and sink.

import * as THREE from 'three';
import { MISSIONS } from './missionData.js';
import { Vehicle } from '../entities/vehicle.js';
import { driveToward } from '../entities/police.js';
import { applyLightingPreset } from '../world/lighting.js';
import { PLACES } from '../world/districts.js';

const TRUCK_ROUTE = [
  { x: 0, z: -390 }, { x: 230, z: -260 }, { x: 230, z: 0 },
  { x: 0, z: 130 }, { x: -260, z: 130 }, { x: -260, z: -130 },
];

export class MissionManager {
  constructor(G) {
    this.G = G;
    this.completed = MISSIONS.map(() => false);
    this.ratings = MISSIONS.map(() => 0);
    this.active = null;
    this.missionVehicle = null;

    const beaconMat = new THREE.MeshBasicMaterial({
      color: '#ffb800', transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 30, 14, 1, true), beaconMat);
    this.beacon.position.y = 15;
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffb800', transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 28), ringMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    G.scene.add(this.beacon);
    G.scene.add(this.beaconRing);
  }

  nextJobIndex() {
    return this.completed.findIndex((c) => !c);
  }

  startAvailable() {
    return !this.active && this.nextJobIndex() >= 0;
  }

  startJob(index) {
    const G = this.G;
    const job = MISSIONS[index];
    if (!job || this.completed[index]) return;
    this.active = { jobIdx: index, job, stageIdx: 0, stage: null, state: {}, startedAt: G.time };
    G.player.diedThisJob = false;
    applyLightingPreset(G, job.preset);
    if (job.intro && G.dialogue) G.dialogue.showSequence(job.intro);
    if (G.hud) G.hud.showBanner(`JOB ${index + 1}/8 — ${job.title}`, 'gold');
    this.startStage(0);
  }

  startStage(idx) {
    const G = this.G;
    const a = this.active;
    a.stageIdx = idx;
    a.stage = a.job.stages[idx];
    a.state = {};
    const s = a.stage, st = a.state;
    if (s.say && G.dialogue) G.dialogue.show(s.say.who, s.say.text, 4.2);
    switch (s.type) {
      case 'steal': {
        st.car = new Vehicle(G, s.carType, s.carColor, s.x, s.z, Math.PI * 0.5);
        st.car.isMissionCar = true;
        break;
      }
      case 'collect': {
        st.idx = 0;
        st.timeLeft = s.time || 0;
        if (s.stars) G.wanted.setLevel(s.stars, G.player.pos.x, G.player.pos.z);
        break;
      }
      case 'kill': {
        st.guards = [];
        for (let i = 0; i < s.count; i++) {
          const ang = (i / s.count) * Math.PI * 2;
          const gx = s.x + Math.cos(ang) * (7 + (i % 3) * 4.5);
          const gz = s.z + Math.sin(ang) * (7 + (i % 3) * 4.5);
          st.guards.push(G.combat.spawnGuard(gx, gz, { health: s.guardHealth ?? 60 }));
        }
        st.total = s.count;
        break;
      }
      case 'destroy': {
        st.destroyed = 0;
        break;
      }
      case 'disable': {
        st.truck = new Vehicle(G, 'truck', '#7a4a2a', TRUCK_ROUTE[0].x, TRUCK_ROUTE[0].z, Math.PI / 2);
        st.routeIdx = 1;
        st.disabled = false;
        break;
      }
      case 'convoy': {
        const A = { x: 452, z: 522 }, B = { x: 836, z: 684 };
        const at = (t) => ({ x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t });
        const heading = Math.atan2(B.x - A.x, B.z - A.z);
        const leadP = at(0.6), e1 = at(0.5), e2 = at(0.7);
        st.lead = new Vehicle(G, 'suv', '#101216', leadP.x, leadP.z, heading);
        st.lead.pos.y = 6;
        a.leadVehicle = st.lead;
        st.escorts = [
          new Vehicle(G, 'suv', '#1c1e26', e1.x, e1.z, heading),
          new Vehicle(G, 'suv', '#1c1e26', e2.x, e2.z, heading),
        ];
        for (const e of st.escorts) e.pos.y = 6;
        st.dest = at(0.97);
        break;
      }
      case 'checkpoints': {
        st.gateIdx = 0;
        st.racers = [];
        const pp = G.player.pos;
        const colors = ['#7a1f8a', '#1f6a8a', '#c23a1e'];
        for (let i = 0; i < (s.racers ?? 3); i++) {
          const veh = new Vehicle(G, i === 1 ? 'coupe' : 'solara', colors[i],
            pp.x - 5 + i * 5, pp.z - 9, G.player.heading);
          st.racers.push({ veh, gateIdx: 0, finished: false, cruise: 29.5 + i * 1.6 });
        }
        break;
      }
      case 'goto': {
        if (s.stars) G.wanted.setLevel(s.stars, G.player.pos.x, G.player.pos.z);
        break;
      }
      case 'escape': {
        st.hadWanted = G.wanted.level > 0;
        break;
      }
      default:
        break;
    }
  }

  completeStage() {
    const G = this.G;
    if (G.audio) G.audio.blip(1180);
    const a = this.active;
    if (a.stageIdx + 1 >= a.job.stages.length) this.completeJob();
    else this.startStage(a.stageIdx + 1);
  }

  completeJob() {
    const G = this.G;
    const a = this.active;
    this.completed[a.jobIdx] = true;
    this.ratings[a.jobIdx] = G.player.diedThisJob ? 2 : 3;
    G.addMoney(a.job.cash);
    G.addRespect(a.job.respect);
    G.stats.missionsDone++;
    if (G.audio) G.audio.cash();
    if (G.showJobComplete) G.showJobComplete(a.job, this.ratings[a.jobIdx]);
    this.active = null;
    this.missionVehicle = null;
  }

  // Hooks wired from main: crates, upgrades and the yacht report back here.
  onCrate(crate) {
    const a = this.active;
    if (a && a.stage.type === 'destroy') {
      a.state.destroyed++;
      if (this.G.hud) this.G.hud.showBanner(`AMMO CRATE DESTROYED — ${a.state.destroyed}/${a.stage.count}`, 'green');
    }
    void crate;
  }

  notifyUpgrade() {
    const a = this.active;
    if (a && a.stage.type === 'upgrade') a.state.bought = true;
  }

  onYacht() {
    const a = this.active;
    if (a && a.stage.type === 'sink') this.completeStage();
  }

  targetPos() {
    const a = this.active;
    if (!a) {
      const n = this.nextJobIndex();
      if (n < 0) return null;
      return MISSIONS[n].startAt;
    }
    const s = a.stage, st = a.state;
    switch (s.type) {
      case 'steal': return st.car ? st.car.pos : { x: s.x, z: s.z };
      case 'collect': return s.points[Math.min(st.idx, s.points.length - 1)];
      case 'kill': return { x: s.x, z: s.z };
      case 'destroy': {
        const crate = this.G.crates.find((c) => !c.exploded);
        return crate ? { x: crate.x, z: crate.z } : { x: s.x ?? 190, z: s.z ?? 492 };
      }
      case 'disable': return st.truck ? st.truck.pos : null;
      case 'convoy': {
        const alive = st.escorts?.find((e) => !e.dead);
        return alive ? alive.pos : (st.lead ? st.lead.pos : null);
      }
      case 'checkpoints': return s.points[Math.min(st.gateIdx, s.points.length - 1)];
      case 'goto': {
        if (s.dynamic === 'leadSuv') {
          return a.leadVehicle ? a.leadVehicle.pos : { x: 690, z: 622 };
        }
        return { x: s.x, z: s.z };
      }
      case 'upgrade': return PLACES.garageFront;
      case 'boat': return this.G.boat ? this.G.boat.pos : PLACES.boatDock;
      case 'sink': return this.G.yacht ? this.G.yacht.pos : null;
      case 'escape': return null;
      default: return s.x !== undefined ? { x: s.x, z: s.z } : null;
    }
  }

  hudData() {
    const G = this.G;
    const a = this.active;
    if (!a) {
      const n = this.nextJobIndex();
      if (n < 0) return { header: 'ALL JOBS DONE', objective: 'Bahía Coral is yours, Teo. Free roam.', distance: '', frac: 1, timer: null, stageLabel: '' };
      const t = this.targetPos();
      const d = t ? Math.round(Math.hypot(t.x - G.player.pos.x, t.z - G.player.pos.z)) : 0;
      return {
        header: `NEXT — JOB ${n + 1}/8 · ${MISSIONS[n].title}`,
        objective: 'Reach the gold beacon to start the job, then press E.',
        distance: `${d} m`, frac: 0, timer: null, stageLabel: '',
      };
    }
    const s = a.stage, st = a.state;
    let objective = s.label ?? '';
    let frac = a.stageIdx / a.job.stages.length;
    const within = () => { frac = (a.stageIdx + 1) / a.job.stages.length; };
    switch (s.type) {
      case 'collect':
        objective = `${s.label} — ${st.idx}/${s.points.length}`;
        frac = (a.stageIdx + st.idx / s.points.length) / a.job.stages.length;
        break;
      case 'kill': {
        const dead = st.guards.filter((g) => g.dead).length;
        objective = `${s.label} — ${dead}/${st.total}`;
        frac = (a.stageIdx + dead / st.total) / a.job.stages.length;
        break;
      }
      case 'destroy':
        objective = `${s.label.toUpperCase()} ${st.destroyed}/${s.count}`;
        frac = (a.stageIdx + st.destroyed / s.count) / a.job.stages.length;
        break;
      case 'checkpoints':
        objective = `${s.label} — GATE ${Math.min(st.gateIdx + 1, s.points.length)}/${s.points.length}`;
        frac = (a.stageIdx + st.gateIdx / s.points.length) / a.job.stages.length;
        break;
      case 'convoy': {
        const down = st.escorts.filter((e) => e.dead).length;
        objective = `${s.label} — ESCORTS DOWN ${down}/${st.escorts.length}`;
        break;
      }
      case 'disable':
        objective = `${s.label} — HAULER ${Math.max(0, Math.round((st.truck?.condition ?? 1) * 100))}%`;
        break;
      default:
        within();
        break;
    }
    const t = this.targetPos();
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    const distance = t ? `${Math.round(Math.hypot(t.x - pp.x, t.z - pp.z))} m` : '';
    return {
      header: `JOB ${a.jobIdx + 1}/8 · ${a.job.title}`,
      objective,
      distance,
      frac,
      timer: s.type === 'collect' && s.time > 0 ? st.timeLeft : null,
      stageLabel: `STAGE ${a.stageIdx + 1}/${a.job.stages.length}`,
    };
  }

  update(dt) {
    const G = this.G;
    const a = this.active;
    // Beacon follows the current target (or the next job's start point).
    const target = this.targetPos();
    if (target && G.mode === 'playing') {
      this.beacon.visible = true;
      this.beaconRing.visible = true;
      this.beacon.position.set(target.x, 15, target.z);
      this.beaconRing.position.set(target.x, 0.35, target.z);
      const pulse = 1 + Math.sin(G.time * 3.2) * 0.12;
      this.beaconRing.scale.set(pulse, pulse, 1);
    } else {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
    }
    if (!a) return;
    const s = a.stage, st = a.state;
    const pp = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    const distTo = (x, z) => Math.hypot(x - pp.x, z - pp.z);

    switch (s.type) {
      case 'steal': {
        if (G.player.vehicle && G.player.vehicle === st.car) {
          this.missionVehicle = st.car;
          G.wanted.commitCrime(55, st.car.pos.x, st.car.pos.z);
          this.completeStage();
        }
        break;
      }
      case 'deliver': {
        const inRightCar = G.player.vehicle && (!this.missionVehicle || G.player.vehicle === this.missionVehicle);
        if (inRightCar && distTo(s.x, s.z) < (s.r ?? 11)) this.completeStage();
        break;
      }
      case 'goto': {
        const t = this.targetPos();
        const arrived = t && distTo(t.x, t.z) < (s.r ?? 6);
        if (arrived && (!s.onFoot || !G.player.vehicle)) this.completeStage();
        break;
      }
      case 'collect': {
        if (s.time > 0) {
          st.timeLeft -= dt;
          if (st.timeLeft <= 0) {
            st.idx = 0;
            st.timeLeft = s.time;
            if (G.dialogue) G.dialogue.show('teo', 'Too slow. Run the route again — cleaner this time.', 3.4);
            break;
          }
        }
        const p = s.points[st.idx];
        const radius = s.inCar ? 11 : 4.2;
        if (p && distTo(p.x, p.z) < radius && (!s.inCar || G.player.vehicle)) {
          st.idx++;
          if (G.audio) G.audio.blip(990);
          if (st.idx >= s.points.length) this.completeStage();
        }
        break;
      }
      case 'kill': {
        if (st.guards.every((g) => g.dead)) this.completeStage();
        break;
      }
      case 'destroy': {
        if (st.destroyed >= s.count) this.completeStage();
        break;
      }
      case 'disable': {
        const truck = st.truck;
        if (truck.health < 45) truck.health = 45;
        if (!st.disabled) {
          const wp = TRUCK_ROUTE[st.routeIdx % TRUCK_ROUTE.length];
          if (driveToward(truck, wp.x, wp.z, dt, 0.8) < 13) st.routeIdx++;
          if (truck.health <= 70) {
            st.disabled = true;
            this.missionVehicle = truck;
            this.completeStage();
          }
        }
        break;
      }
      case 'convoy': {
        for (const e of st.escorts) {
          if (!e.dead) driveToward(e, st.dest.x, st.dest.z, dt, 0.5);
        }
        if (!st.lead.dead) {
          if (st.lead.health < 25) st.lead.health = 25;
          driveToward(st.lead, st.dest.x, st.dest.z, dt, 0.45);
        }
        if (st.escorts.every((e) => e.dead)) this.completeStage();
        break;
      }
      case 'checkpoints': {
        for (const r of st.racers) {
          if (r.finished) continue;
          const gate = s.points[r.gateIdx];
          if (!gate) { r.finished = true; continue; }
          if (r.veh.speed > r.cruise) r.veh.speed = r.cruise;
          if (driveToward(r.veh, gate.x, gate.z, dt, 0.95) < 15) {
            r.gateIdx++;
            if (r.gateIdx >= s.points.length) r.finished = true;
          }
        }
        const gate = s.points[st.gateIdx];
        if (gate && G.player.vehicle && distTo(gate.x, gate.z) < 16) {
          st.gateIdx++;
          if (G.audio) G.audio.blip(1040);
          if (st.gateIdx >= s.points.length) {
            const placing = 1 + st.racers.filter((r) => r.finished).length;
            if (placing === 1) {
              this.completeStage();
            } else {
              if (G.dialogue) G.dialogue.show('camila', `P${placing} is a story, not a payday. Again — and this time, win.`, 4);
              for (const r of st.racers) { r.veh.dispose(G); }
              this.startStage(a.stageIdx);
            }
          }
        }
        break;
      }
      case 'upgrade': {
        if (st.bought) this.completeStage();
        break;
      }
      case 'escape': {
        if (G.wanted.level > 0) st.hadWanted = true;
        if (st.hadWanted && G.wanted.level === 0) this.completeStage();
        break;
      }
      case 'boat': {
        if (G.player.inBoat) this.completeStage();
        break;
      }
      default:
        break;
    }
  }
}
