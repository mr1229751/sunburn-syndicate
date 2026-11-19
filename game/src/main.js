// main.js — SUNBURN SYNDICATE boot and game loop: builds Bahía Coral,
// wires every system, runs the player controller (on foot, driving, boating),
// the third-person cameras, interactions, death and respawn, the start
// screen, and the deterministic ?shot= staging used for the screenshots.

import * as THREE from 'three';
import { createLighting, applyLightingPreset, updateLighting } from './world/lighting.js';
import { buildCity, groundHeightAt } from './world/cityBuilder.js';
import { PLACES } from './world/districts.js';
import { Vehicle } from './entities/vehicle.js';
import { Pedestrian, buildHumanFigure, poseFigure } from './entities/pedestrian.js';
import { PoliceManager } from './entities/police.js';
import { Helicopter } from './entities/helicopter.js';
import { Boat, buildYacht, updateYacht } from './entities/boat.js';
import { TrafficManager } from './systems/traffic.js';
import { WantedSystem } from './systems/wanted.js';
import { Effects, CombatSystem, WEAPONS } from './systems/combat.js';
import { AudioEngine } from './systems/audio.js';
import { collideCircle } from './systems/physics.js';
import { MissionManager } from './missions/missionManager.js';
import { MISSIONS } from './missions/missionData.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { DialogueBox } from './ui/dialog.js';
import { GarageMenu } from './ui/garageMenu.js';
import { PauseMenu } from './ui/pauseMenu.js';
import { hasAnySave, peekAllSaves, readSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') ?? 1) || 1;

// ---------------------------------------------------------------- state
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5200);
camera.position.set(620, 30, 120);

const G = {
  scene, camera, renderer,
  seed: SEED,
  time: 0,
  mode: SHOT ? 'playing' : 'start',
  cars: [], peds: [],
  money: 500, respect: 0,
  stats: {
    carsStolen: 0, distanceDriven: 0, highestWanted: 0, shotsFired: 0,
    enemiesDropped: 0, cratesDestroyed: 0, deaths: 0, missionsDone: 0,
    moneyEarned: 0, timePlayed: 0,
  },
  settings: { sens: 1, invertY: false },
  waypoint: null,
  shake: 0, recoil: 0,
  garageOpen: false,
  hudTimerOverride: null,
  displayCar: null,
  staged: SHOT,
  crimeCd: 0,
};
window.__sunburn = { G };

createLighting(G);
buildCity(G);
applyLightingPreset(G, 'golden');

G.fx = new Effects(G);
G.wanted = new WantedSystem(G);
G.police = new PoliceManager(G);
G.heli = new Helicopter(G);
G.traffic = new TrafficManager(G);
G.combat = new CombatSystem(G);
G.audio = new AudioEngine(G);
G.missions = new MissionManager(G);
G.dialogue = new DialogueBox(G);
G.hud = new Hud(G);
G.minimap = new Minimap(G);
G.garageMenu = new GarageMenu(G); // menu instance; city garage data stays on G.garage
G.pause = new PauseMenu(G);

// ---------------------------------------------------------------- player
const teoFigure = buildHumanFigure(
  { shirt: '#e8e4da', pants: '#2a2d38', skin: '#b97a4a', hair: '#1c1410' },
  { jacket: '#20303e' },
);
{
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.62),
    new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.4, metalness: 0.5 }));
  gun.position.set(0, -0.6, 0.26);
  teoFigure.userData.armR.add(gun);
}
teoFigure.position.set(PLACES.spawn.x, 0, PLACES.spawn.z);
scene.add(teoFigure);

G.player = {
  figure: teoFigure,
  heading: Math.PI,
  health: 100, armour: 0,
  vehicle: null, inBoat: false,
  weapon: 1, dead: false, diedThisJob: false,
  walkPhase: 0, lastShotAt: -10, respawnAt: 0,
  get pos() { return this.vehicle ? this.vehicle.pos : this.figure.position; },
};
G.boat = new Boat(G, PLACES.boatDock.x, PLACES.boatDock.z, Math.PI / 2, '#e86a58');
buildYacht(G);

// Ambient citizens.
for (let i = 0; i < 26; i++) {
  const seg = G.roadSegments[Math.floor(Math.random() * G.roadSegments.length)];
  const t = Math.random();
  const x = seg.x0 + (seg.x1 - seg.x0) * t + (Math.random() > 0.5 ? 8.6 : -8.6);
  const z = seg.z0 + (seg.z1 - seg.z0) * t + (Math.random() > 0.5 ? 8.6 : -8.6);
  new Pedestrian(G, THREE.MathUtils.clamp(x, -590, 450), THREE.MathUtils.clamp(z, -600, 600));
}

// ---------------------------------------------------------------- helpers
G.addMoney = (n) => {
  G.money += n;
  if (n > 0) G.stats.moneyEarned += n;
};
G.addRespect = (n) => { G.respect += n; };
G.hitmark = () => G.hud.hitmark();

let cruzLineCd = 0;
const CRUZ_LINES = {
  3: 'All units, suspect is priority three. I want a net around him, not a funeral.',
  4: 'Air unit is live. Reyes, there is nowhere in Bahía Coral I cannot see you.',
  5: 'Five stars. Every badge in this city, on him, NOW. Bring me Mateo Reyes.',
};
G.onWantedLevelUp = (level) => {
  G.stats.highestWanted = Math.max(G.stats.highestWanted, level);
  G.hud.showBanner(`WANTED LEVEL UP — ${'★'.repeat(level)}`, 'red');
  if (CRUZ_LINES[level] && G.time > cruzLineCd) {
    cruzLineCd = G.time + 30;
    G.dialogue.show('cruz', CRUZ_LINES[level], 4.6);
  }
};
G.onHeatCleared = () => G.hud.showBanner('HEAT CLEARED', 'green');
G.onCrateDestroyed = (crate) => {
  G.stats.cratesDestroyed++;
  G.missions.onCrate(crate);
};
G.onEnemyKilled = () => {
  G.stats.enemiesDropped++;
  G.wanted.commitCrime(70, G.player.pos.x, G.player.pos.z);
};
G.onVehicleRam = (a, b) => {
  if ((a === G.player.vehicle || b === G.player.vehicle) && G.time > G.crimeCd) {
    G.crimeCd = G.time + 2.5;
    G.wanted.commitCrime(18, G.player.pos.x, G.player.pos.z);
  }
};
G.onYachtDestroyed = () => {
  G.hud.showBanner('SALAZAR\'S YACHT IS GOING DOWN', 'green', 4);
  G.missions.onYacht();
};

G.damagePlayer = (amount) => {
  const P = G.player;
  if (P.dead || G.mode !== 'playing') return;
  let remaining = amount;
  if (P.armour > 0) {
    const absorbed = Math.min(P.armour, amount * 0.55);
    P.armour -= absorbed;
    remaining = amount - absorbed;
  }
  P.health -= remaining;
  G.shake = Math.min(0.4, (G.shake ?? 0) + 0.08);
  if (P.health <= 0) killPlayer();
};

function killPlayer() {
  const P = G.player;
  P.dead = true;
  P.diedThisJob = true;
  G.stats.deaths++;
  P.health = 0;
  P.respawnAt = G.time + 1.7;
  document.getElementById('fade-black').style.opacity = '1';
  G.hud.showBanner('WASTED', 'red', 2.4);
  if (G.audio) G.audio.explosionSfx();
}

function respawnPlayer() {
  const P = G.player;
  if (P.vehicle) exitVehicle(true);
  P.inBoat = false;
  P.figure.visible = true;
  P.figure.position.set(PLACES.plaza.x, 0, PLACES.plaza.z);
  P.heading = Math.PI;
  P.health = 100;
  P.dead = false;
  G.money = Math.max(0, G.money - 250);
  G.wanted.heat = Math.floor(G.wanted.heat / 2);
  document.getElementById('fade-black').style.opacity = '0';
  G.hud.showBanner('BAHÍA GENERAL — PATCHED UP', 'gold');
}

// ---------------------------------------------------------------- input
const keys = {};
let camYaw = Math.PI, camPitch = 0.3, camYawOffset = 0;
let mouseHeld = false, dragInfo = null;

window.addEventListener('keydown', (ev) => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
  keys[ev.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(ev.code)) ev.preventDefault();
  if (ev.repeat) return;
  if (ev.code === 'Escape') {
    if (G.garageOpen) { G.garageMenu.close(); }
    else if (G.pause.isOpen) G.pause.close();
    else if (G.mode === 'playing') G.pause.open();
    return;
  }
  if (G.mode !== 'playing') return;
  if (ev.code === 'KeyE') doInteract();
  if (ev.code === 'KeyM') {
    G.audio.ensure();
    G.audio.setMuted(!G.audio.muted);
    G.hud.showBanner(G.audio.muted ? 'SOUND OFF' : 'SOUND ON', 'gold', 1.4);
  }
  if (ev.code === 'KeyL') {
    const order = ['noon', 'golden', 'night'];
    const next = order[(order.indexOf(G.lighting.preset) + 1) % order.length];
    applyLightingPreset(G, next);
    G.hud.showBanner(`LIGHTING — ${next.toUpperCase()}`, 'gold', 1.4);
  }
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(ev.code)) {
    if (!G.player.vehicle && !G.player.inBoat) {
      G.player.weapon = Number(ev.code.slice(-1));
      if (G.audio) G.audio.blip(500 + G.player.weapon * 60);
    }
  }
  if (ev.code === 'KeyR') {
    if (G.combat.reload(G.player.weapon)) G.hud.showBanner('RELOADING', 'gold', 0.8);
  }
});
window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });

canvas.addEventListener('mousedown', (ev) => {
  mouseHeld = true;
  dragInfo = { x: ev.clientX, y: ev.clientY, at: performance.now(), moved: 0 };
});
window.addEventListener('mousemove', (ev) => {
  if (!dragInfo) return;
  const dx = ev.movementX ?? 0, dy = ev.movementY ?? 0;
  dragInfo.moved += Math.abs(dx) + Math.abs(dy);
  const s = 0.0042 * G.settings.sens;
  if (G.player.vehicle || G.player.inBoat) {
    camYawOffset -= dx * s;
  } else {
    camYaw -= dx * s;
  }
  camPitch = THREE.MathUtils.clamp(camPitch + (G.settings.invertY ? -dy : dy) * s * 0.7, -0.12, 1.05);
});
window.addEventListener('mouseup', (ev) => {
  if (dragInfo && performance.now() - dragInfo.at < 260 && dragInfo.moved < 7) {
    if (G.mode === 'playing' && !G.player.vehicle && !G.player.inBoat && !G.garageOpen) {
      shootOnce();
    }
  }
  mouseHeld = false;
  dragInfo = null;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function shootOnce() {
  const P = G.player;
  if (P.dead) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = new THREE.Vector3(P.pos.x, P.pos.y + 1.5, P.pos.z);
  if (G.combat.fireWeapon(P.weapon, from, dir)) {
    G.stats.shotsFired++;
    P.lastShotAt = G.time;
  }
}

// ---------------------------------------------------------------- vehicles
function nearestCar(maxDist) {
  const pp = G.player.pos;
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    const d = Math.hypot(car.pos.x - pp.x, car.pos.z - pp.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterVehicle(car) {
  const P = G.player;
  P.vehicle = car;
  car.driver = P;
  car.openDoor();
  P.figure.visible = false;
  if (!car.everDriven) {
    car.everDriven = true;
    if (!car.isPlayerSpawn) {
      G.stats.carsStolen++;
      G.wanted.commitCrime(45, car.pos.x, car.pos.z);
      G.hud.showBanner('VEHICLE STOLEN', 'red');
      for (const ped of G.peds) {
        if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 9) {
          ped.scare(car.pos.x, car.pos.z, Math.random() < 0.4);
        }
      }
    }
  }
  if (G.audio) {
    G.audio.ensure();
    G.audio.door();
    G.audio.engineStart();
    G.audio.startRadio();
  }
  camYaw = car.heading + Math.PI;
  camYawOffset = 0;
}

function exitVehicle(silent = false) {
  const P = G.player;
  const car = P.vehicle;
  if (!car) return;
  P.vehicle = null;
  car.driver = null;
  car.openDoor();
  const left = { x: -Math.cos(car.heading), z: Math.sin(car.heading) };
  P.figure.position.set(car.pos.x + left.x * 2.1, car.pos.y, car.pos.z + left.z * 2.1);
  collideCircle(G, P.figure.position, 0.45);
  P.figure.visible = true;
  P.heading = car.heading;
  if (G.audio && !silent) {
    G.audio.door();
    G.audio.engineStop();
    G.audio.stopRadio();
  } else if (G.audio) {
    G.audio.engineStop();
    G.audio.stopRadio();
  }
}

function doInteract() {
  const P = G.player;
  if (P.dead) return;
  if (P.inBoat) {
    const d = Math.hypot(G.boat.pos.x - PLACES.boatDock.x, G.boat.pos.z - PLACES.boatDock.z);
    if (d < 34) {
      P.inBoat = false;
      P.figure.visible = true;
      P.figure.position.set(PLACES.boatDock.x - 6, 0, PLACES.boatDock.z);
      if (G.audio) { G.audio.engineStop(); G.audio.stopRadio(); }
    }
    return;
  }
  if (P.vehicle) { exitVehicle(); return; }
  // Start a job at the gold beacon.
  if (G.missions.startAvailable()) {
    const idx = G.missions.nextJobIndex();
    const start = MISSIONS[idx].startAt;
    if (Math.hypot(start.x - P.pos.x, start.z - P.pos.z) < 5) {
      G.missions.startJob(idx);
      return;
    }
  }
  // Take the speedboat.
  if (Math.hypot(G.boat.pos.x - P.pos.x, G.boat.pos.z - P.pos.z) < 5) {
    P.inBoat = true;
    P.figure.visible = false;
    if (G.audio) { G.audio.ensure(); G.audio.engineStart(); G.audio.startRadio(); }
    G.hud.showBanner('CORAL RUNNER — SHE\'S YOURS', 'gold');
    return;
  }
  const car = nearestCar(3.8);
  if (car) enterVehicle(car);
}

// ---------------------------------------------------------------- start UI
const startScreen = document.getElementById('start-screen');
const hudRoot = document.getElementById('hud');

function startGame() {
  startScreen.classList.add('hidden');
  hudRoot.classList.remove('hidden');
  G.mode = 'playing';
  G.audio.ensure();
  if (!SHOT) G.hud.showBanner('BAHÍA CORAL — ONE WEEK, EIGHT JOBS', 'gold', 3.4);
}

function refreshStartButtons() {
  document.getElementById('btn-continue').disabled = !hasAnySave();
  const box = document.getElementById('load-slots');
  box.innerHTML = peekAllSaves().map((s) => {
    if (!s) return `<button class="slot" disabled>SLOT — EMPTY</button>`;
    return `<button class="slot" data-slot="${s.slot}">SLOT ${s.slot} — ${s.done}/8 JOBS · $${Math.round(s.money).toLocaleString('en-US')}</button>`;
  }).join('');
  for (const btn of box.querySelectorAll('[data-slot]')) {
    btn.addEventListener('click', () => {
      if (readSave(G, Number(btn.dataset.slot))) startGame();
    });
  }
}
document.getElementById('btn-continue').addEventListener('click', () => {
  const saves = peekAllSaves().filter(Boolean).sort((a, b) => b.when - a.when);
  if (saves.length && readSave(G, saves[0].slot)) startGame();
});
document.getElementById('btn-new').addEventListener('click', () => startGame());
document.getElementById('btn-load').addEventListener('click', () => {
  document.getElementById('load-slots').classList.toggle('hidden');
  refreshStartButtons();
});
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('settings-box').classList.toggle('hidden');
});
document.getElementById('opt-volume').addEventListener('input', (ev) => {
  G.audio.ensure();
  G.audio.setVolume(Number(ev.target.value) / 100);
});
document.getElementById('opt-sens').addEventListener('input', (ev) => {
  G.settings.sens = Number(ev.target.value) / 100;
});
document.getElementById('opt-invert').addEventListener('change', (ev) => {
  G.settings.invertY = ev.target.checked;
});
refreshStartButtons();
if (SHOT) {
  startScreen.classList.add('hidden');
  hudRoot.classList.remove('hidden');
}

// ---------------------------------------------------------------- player
function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function updatePlayer(dt) {
  const P = G.player;
  if (P.dead) {
    poseFigure(P.figure, 'dead', 0, dt);
    if (G.time >= P.respawnAt) respawnPlayer();
    return;
  }
  const fwdIn = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafeIn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);

  if (P.inBoat) {
    G.boat.update(dt, { throttle: fwdIn, steer: strafeIn });
    G.stats.distanceDriven += Math.abs(G.boat.speed) * dt;
    if (G.audio && G.audio.ctx) G.audio.engineUpdate(G.boat.speed / 25, fwdIn);
    return;
  }

  if (P.vehicle) {
    const car = P.vehicle;
    car.update(dt, {
      throttle: fwdIn,
      steer: strafeIn,
      handbrake: !!keys.Space,
    });
    P.figure.position.copy(car.pos);
    G.stats.distanceDriven += Math.abs(car.speed) * dt;
    if (car.dead) {
      G.damagePlayer(30);
      exitVehicle();
    }
    return;
  }

  // On foot.
  const baseHeading = camYaw + Math.PI;
  const fx = Math.sin(baseHeading), fz = Math.cos(baseHeading);
  const rx = Math.cos(baseHeading), rz = -Math.sin(baseHeading);
  let mx = fx * fwdIn + rx * strafeIn;
  let mz = fz * fwdIn + rz * strafeIn;
  const moving = Math.hypot(mx, mz) > 0.1;
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    const speed = sprint ? 6.6 : 3.3;
    P.figure.position.x += mx * speed * dt;
    P.figure.position.z += mz * speed * dt;
    P.walkPhase += dt * (sprint ? 11 : 7);
    if (G.time - P.lastShotAt > 1.1) P.heading = lerpAngle(P.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
  }
  const aiming = mouseHeld || G.time - P.lastShotAt < 1.1;
  if (aiming) {
    P.heading = lerpAngle(P.heading, baseHeading, Math.min(1, dt * 14));
  }
  collideCircle(G, P.figure.position, 0.45);
  P.figure.position.x = THREE.MathUtils.clamp(P.figure.position.x, -598, 470);
  P.figure.position.z = THREE.MathUtils.clamp(P.figure.position.z, -612, 618);
  P.figure.position.y = groundHeightAt(G, P.figure.position.x, P.figure.position.z);
  P.figure.rotation.y = P.heading;
  poseFigure(P.figure, aiming && (mouseHeld || G.time - P.lastShotAt < 0.4) ? 'aim' : (moving ? (sprint ? 'run' : 'walk') : 'stand'), P.walkPhase, dt);

  // Held fire for automatic weapons.
  if (mouseHeld && WEAPONS[P.weapon].auto && !G.garageOpen) shootOnce();

  // Context prompt.
  updatePrompt();
}

function updatePrompt() {
  const P = G.player;
  if (P.vehicle || P.inBoat || P.dead) {
    if (P.inBoat) {
      const d = Math.hypot(G.boat.pos.x - PLACES.boatDock.x, G.boat.pos.z - PLACES.boatDock.z);
      G.hud.setPrompt(d < 34 ? '<b>E</b> — DOCK THE BOAT' : null);
    } else G.hud.setPrompt(null);
    return;
  }
  if (G.missions.startAvailable()) {
    const idx = G.missions.nextJobIndex();
    const start = MISSIONS[idx].startAt;
    if (Math.hypot(start.x - P.pos.x, start.z - P.pos.z) < 5) {
      G.hud.setPrompt(`<b>E</b> — START JOB ${idx + 1}: ${MISSIONS[idx].title}`);
      return;
    }
  }
  if (Math.hypot(G.boat.pos.x - P.pos.x, G.boat.pos.z - P.pos.z) < 5) {
    G.hud.setPrompt('<b>E</b> — TAKE THE SPEEDBOAT');
    return;
  }
  const car = nearestCar(3.8);
  G.hud.setPrompt(car ? `<b>E</b> — ${car.everDriven ? 'DRIVE' : 'STEAL'} THE ${car.name}` : null);
}

// ---------------------------------------------------------------- camera
const camTargetVec = new THREE.Vector3();
function updateCamera(dt) {
  const P = G.player;
  if (G.mode === 'start') {
    const t = G.time;
    camera.position.set(
      600 + Math.sin(t * 0.021) * 46,
      27 + Math.sin(t * 0.037) * 5,
      -40 + Math.cos(t * 0.013) * 190,
    );
    camera.lookAt(215, 14, -90);
    return;
  }
  if (G.staged && stagedCamera) { stagedCamera(); return; }
  if (G.garageOpen && G.garageMenu.car) { // fixed workshop camera while the panel is open
    camera.position.set(-305.5, 3.1, 183.5);
    camera.lookAt(-332, 1.2, 195);
    return;
  }
  let dist, height;
  if (P.vehicle) {
    const car = P.vehicle;
    camTargetVec.set(car.pos.x, car.pos.y + 1.3, car.pos.z);
    camYaw = lerpAngle(camYaw, car.heading + Math.PI + camYawOffset, 1 - Math.exp(-dt * 3.4));
    camYawOffset *= Math.exp(-dt * 0.9);
    camPitch += (0.25 - camPitch) * Math.min(1, dt * 3);
    dist = 8.4 + Math.abs(car.speed) * 0.055;
    height = 0;
  } else if (P.inBoat) {
    camTargetVec.set(G.boat.pos.x, 1.2, G.boat.pos.z);
    camYaw = lerpAngle(camYaw, G.boat.heading + Math.PI + camYawOffset, 1 - Math.exp(-dt * 3));
    camYawOffset *= Math.exp(-dt * 0.9);
    dist = 9.6;
    height = 0.4;
  } else {
    camTargetVec.set(P.figure.position.x, P.figure.position.y + 1.55, P.figure.position.z);
    dist = 5.3;
    height = 0;
  }
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const off = new THREE.Vector3(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp).multiplyScalar(dist);
  camera.position.copy(camTargetVec).add(off);
  camera.position.y += height;
  const groundY = groundHeightAt(G, camera.position.x, camera.position.z) + 0.5;
  if (camera.position.y < groundY) camera.position.y = groundY;
  camera.lookAt(camTargetVec.x, camTargetVec.y + 0.25, camTargetVec.z);
  if (G.recoil > 0.01) {
    camera.rotation.x += G.recoil * 0.028;
    G.recoil *= Math.exp(-dt * 9);
  }
  if (G.shake > 0.002) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.35;
    G.shake *= Math.exp(-dt * 5.5);
  }
}

function updateTrafficLights() {
  for (const tl of G.trafficLights ?? []) {
    const phase = (G.time + tl.offset) % 13.5;
    tl.mats.g.emissiveIntensity = phase < 6 ? 2.4 : 0.18;
    tl.mats.y.emissiveIntensity = phase >= 6 && phase < 7.5 ? 2.4 : 0.18;
    tl.mats.r.emissiveIntensity = phase >= 7.5 ? 2.4 : 0.18;
  }
}

// ---------------------------------------------------------------- staging
let stagedCamera = null;
const stagedState = {};

function pinWanted(level, x, z) {
  G.wanted.heat = [0, 40, 130, 260, 430, 640][level];
  G.wanted.level = level;
  G.wanted.searchZone.x = x;
  G.wanted.searchZone.z = z;
  G.wanted.lastSeenAt = G.time;
}

function flashLightbars(vehicles) {
  const phase = Math.floor(G.time * 6.5) % 2;
  for (const veh of vehicles) {
    const lb = veh.mesh.userData.lightbar;
    if (!lb) continue;
    lb.redMat.emissiveIntensity = phase === 0 ? 3.4 : 0.2;
    lb.blueMat.emissiveIntensity = phase === 0 ? 0.2 : 3.4;
  }
}

function spinWheels(veh, dt, rate = 9) {
  for (const w of veh.mesh.userData.wheels) w.group.rotation.x += dt * rate;
}

function stageCover() {
  applyLightingPreset(G, 'golden');
  G.money = 89400;
  G.respect = 3600;
  G.player.armour = 65;
  const car = new Vehicle(G, 'solara', '#e23a2e', 318.6, 96, Math.PI);
  car.everDriven = true;
  car.isPlayerSpawn = true;
  car.speed = 42.8;
  G.player.vehicle = car;
  car.driver = G.player;
  G.player.figure.visible = false;
  const rb1 = new Vehicle(G, 'police', '#1a1d24', 314.8, 55, Math.PI / 2 + 0.24);
  const rb2 = new Vehicle(G, 'police', '#1a1d24', 322.4, 55, Math.PI / 2 - 0.24);
  const ram = new Vehicle(G, 'interceptor', '#1a1d24', 325.5, 88, Math.PI + 0.45);
  const fir = new Vehicle(G, 'police', '#1a1d24', 308.5, 68, Math.PI * 0.92);
  const units = [
    { veh: rb1, status: 'ROADBLOCK' }, { veh: rb2, status: 'ROADBLOCK' },
    { veh: ram, status: 'RAMMING' }, { veh: fir, status: 'FIRING' },
  ];
  G.police.nearestUnits = () => units
    .map((u) => ({ dist: Math.round(Math.hypot(u.veh.pos.x - car.pos.x, u.veh.pos.z - car.pos.z)), status: u.status, state: u.status }))
    .sort((a, b) => a.dist - b.dist);
  G.police.cones.forEach((cone, i) => {
    cone.visible = true;
    cone.position.set(311 + i * 3.4, 0.4, 60.5);
  });
  const traffic = [
    { veh: new Vehicle(G, 'taxi', '#f2b21b', 342.5, -16, 0), speed: 11 },
    { veh: new Vehicle(G, 'hatch', '#7a4a8a', 342.5, -84, 0), speed: 12.5 },
    { veh: new Vehicle(G, 'coupe', '#2d5da1', 318.6, 6, Math.PI), speed: 8 },
  ];
  for (const t of traffic) t.veh.everDriven = true;
  const fleePeds = [], panicPeds = [];
  for (let i = 0; i < 6; i++) {
    const ped = new Pedestrian(G, i % 2 ? 316.5 : 343.5, 34 + i * 13);
    fleePeds.push(ped);
  }
  for (let i = 0; i < 3; i++) {
    panicPeds.push(new Pedestrian(G, 315.8, 52 + i * 17));
  }
  G.missions.active = {
    jobIdx: 7, job: MISSIONS[7], stageIdx: 0,
    stage: { type: 'goto', label: 'Reach Pier 4 — lose the manhunt before Salazar sails', x: 430, z: 545, r: 10 },
    state: {},
  };
  G.hudTimerOverride = 107;
  G.audio.radioOn = true;
  G.dialogue.show('cruz', 'All units — he is on the Paseo doing one-fifty. Do NOT let him reach that pier!', 9999);
  stagedState.cover = { car, units: units.map((u) => u.veh), ram, traffic, fleePeds, panicPeds, sparkT: 0, scareT: 0 };
  stagedCamera = () => {
    camera.position.set(314.8, 2.75, 105);
    camera.lookAt(319.2, 1.5, 74);
  };
}

function stageCarjack() {
  applyLightingPreset(G, 'noon');
  G.money = 1250;
  G.respect = 150;
  const coupe = new Vehicle(G, 'coupe', '#e8b13a', 136, 138, 0.6);
  G.displayCar = coupe;
  const P = G.player;
  P.figure.position.set(130.2, 0, 143.8);
  P.heading = Math.atan2(136 - 130.2, 138 - 143.8);
  P.figure.rotation.y = P.heading;
  camYaw = P.heading + Math.PI;
  const owner = new Pedestrian(G, 139.2, 141.6);
  const trafficDefs = [
    { type: 'taxi', color: '#f2b21b', x: 133.6, z: 97, h: 0, speed: 0 },
    { type: 'pickup', color: '#4a7a5e', x: 133.6, z: 104, h: 0, speed: 0 },
    { type: 'hatch', color: '#8a1f2a', x: 126.4, z: 196, h: Math.PI, speed: 8 },
    { type: 'coupe', color: '#c0c4cc', x: 126.4, z: 88, h: Math.PI, speed: 6.5 },
    { type: 'solara', color: '#2d5da1', x: 94, z: 133.6, h: Math.PI / 2, speed: 7.5 },
    { type: 'taxi', color: '#f2b21b', x: 170, z: 126.4, h: -Math.PI / 2, speed: 0 },
    { type: 'hatch', color: '#3f9e4d', x: 88, z: 126.4, h: -Math.PI / 2, speed: 6 },
    { type: 'pickup', color: '#e8e4da', x: 178, z: 133.6, h: Math.PI / 2, speed: 8.5 },
  ];
  const traffic = trafficDefs.map((d) => {
    const veh = new Vehicle(G, d.type, d.color, d.x, d.z, d.h);
    veh.everDriven = true;
    return { veh, ...d };
  });
  for (let i = 0; i < 11; i++) {
    const px = 130 + (i % 4 - 1.5) * 16 + (Math.random() - 0.5) * 5;
    const pz = 130 + (Math.floor(i / 4) - 1) * 17 + (Math.random() - 0.5) * 5;
    new Pedestrian(G, px + (px > 130 ? 9 : -9), pz + (pz > 130 ? 9 : -9));
  }
  G.missions.active = {
    jobIdx: 0, job: MISSIONS[0], stageIdx: 0,
    stage: { type: 'steal', label: 'Steal the Solara GT from the Hotel Coral car park', x: 272, z: -140 },
    state: {},
  };
  G.audio.radioOn = true;
  stagedState.carjack = { coupe, owner, traffic };
  stagedCamera = () => {
    camera.position.set(124.5, 2.1, 146);
    camera.lookAt(138.5, 1.0, 136.5);
  };
}

function stageShootout() {
  applyLightingPreset(G, 'golden');
  const P = G.player;
  P.figure.position.set(128, 0, 458);
  P.heading = Math.atan2(180 - 128, 488 - 458);
  P.figure.rotation.y = P.heading;
  P.weapon = 3;
  P.health = 78;
  P.armour = 40;
  G.money = 22150;
  G.respect = 1850;
  G.missions.active = {
    jobIdx: 4, job: MISSIONS[4], stageIdx: 1,
    stage: { type: 'destroy', count: 3, label: 'Destroy ammo crates' },
    state: { destroyed: 0 },
  };
  const spots = [[148, 468], [162, 466], [196, 484], [176, 472]];
  const guards = spots.map(([x, z]) => G.combat.spawnGuard(x, z, {
    health: 99999,
    coverPoints: [{ x, z }],
  }));
  const toBurn = G.crates.slice(0, 2);
  for (const crate of toBurn) G.combat.damageCrate(crate, 999);
  G.audio.radioOn = true;
  G.dialogue.show('camila', 'There — the marked crates. Chain them and the whole stack goes up!', 9999);
  stagedState.shootout = { guards, spots, fireT: 0, boomT: 0.4, shotT: 0.3 };
  stagedCamera = () => {
    camera.position.set(125.2, 2.0, 454.6);
    camera.lookAt(152, 1.35, 477);
  };
}

function stageGarage() {
  applyLightingPreset(G, 'night');
  G.money = 12840;
  G.respect = 2100;
  const car = new Vehicle(G, 'solara', '#e86a58', -332, 195, Math.PI / 2);
  car.engineLevel = 1;
  car.everDriven = true;
  car.isPlayerSpawn = true;
  const P = G.player;
  P.figure.position.set(-325.8, 0, 200.6);
  P.heading = -2.25;
  P.figure.rotation.y = P.heading;
  G.garageMenu.openMenu(car); // staged shot: panel opens on the lift car
  stagedState.garage = { car };
  stagedCamera = () => {
    camera.position.set(-306.5, 2.0, 186.5);
    camera.lookAt(-331, 1.4, 195.5);
  };
}

function stagedUpdate(dt) {
  const s = stagedState;
  if (SHOT === 'cover' && s.cover) {
    const c = s.cover;
    pinWanted(4, c.car.pos.x, c.car.pos.z);
    spinWheels(c.car, dt, 11);
    c.car.mesh.rotation.x = Math.sin(G.time * 28) * 0.0022;
    flashLightbars([...c.units]);
    c.sparkT -= dt;
    if (c.sparkT <= 0) {
      c.sparkT = 0.11;
      G.fx.sparks(322.8, 0.85, 91.5, 5);
    }
    for (const t of c.traffic) {
      t.veh.pos.z += Math.cos(t.veh.heading) * t.speed * dt;
      t.veh.pos.x += Math.sin(t.veh.heading) * t.speed * dt;
      spinWheels(t.veh, dt, 6);
      if (t.veh.pos.z > 240) t.veh.pos.z = -280;
      if (t.veh.pos.z < -300) t.veh.pos.z = 220;
    }
    c.scareT -= dt;
    if (c.scareT <= 0) {
      c.scareT = 0.6;
      for (const ped of c.fleePeds) ped.scare(c.car.pos.x, c.car.pos.z);
    }
    for (const ped of c.panicPeds) ped.panicTimer = 1.4;
    G.heli.update(dt);
    const hp = G.heli.group.position;
    hp.set(c.car.pos.x - 17, 15, c.car.pos.z - 36);
    const to = new THREE.Vector3(c.car.pos.x, 0, c.car.pos.z);
    const dir = to.clone().sub(hp);
    const dist = dir.length();
    dir.normalize();
    G.heli.cone.position.copy(hp);
    G.heli.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    G.heli.cone.scale.set(dist, dist, dist);
    G.heli.spot.position.copy(hp);
    G.heli.spot.target.position.copy(to);
    G.heli.group.rotation.y = Math.atan2(to.x - hp.x, to.z - hp.z);
  } else if (SHOT === 'carjack' && s.carjack) {
    const c = s.carjack;
    pinWanted(1, G.player.pos.x, G.player.pos.z);
    c.coupe.mesh.userData.doorPivot.rotation.y = -1.65;
    c.owner.panicTimer = 1.4;
    if (G.hud.bannerTimer < 0.5) G.hud.showBanner('VEHICLE STOLEN', 'red', 2.6);
    for (const t of c.traffic) {
      if (t.speed > 0) {
        t.veh.pos.x += Math.sin(t.h) * t.speed * dt;
        t.veh.pos.z += Math.cos(t.h) * t.speed * dt;
        spinWheels(t.veh, dt, 5);
        if (Math.abs(t.veh.pos.x - 130) > 150) t.veh.pos.x = 130 - Math.sign(t.veh.pos.x - 130) * 150;
        if (Math.abs(t.veh.pos.z - 130) > 150) t.veh.pos.z = 130 - Math.sign(t.veh.pos.z - 130) * 150;
      }
    }
    poseFigure(G.player.figure, 'stand', 0, dt);
  } else if (SHOT === 'shootout' && s.shootout) {
    const c = s.shootout;
    const P = G.player;
    pinWanted(2, P.pos.x, P.pos.z);
    P.health = 78;
    P.armour = 40;
    // Hold the guards on their staged cover marks so the fight stays framed.
    c.guards.forEach((g, i) => { g.pos.x = c.spots[i][0]; g.pos.z = c.spots[i][1]; });
    poseFigure(P.figure, 'aim', 0, dt);
    c.fireT -= dt;
    if (c.fireT <= 0) {
      c.fireT = 0.14;
      G.fx.fire(185 + (Math.random() - 0.5) * 1.6, 1.1, 492 + (Math.random() - 0.5) * 1.6, 1.5);
    }
    c.boomT -= dt;
    if (c.boomT <= 0) {
      c.boomT = 1.5;
      G.fx.explosion(185, 1.3, 492, 1.55);
    }
    c.shotT -= dt;
    if (c.shotT <= 0) {
      c.shotT = 0.19;
      const guard = c.guards[1];
      const from = new THREE.Vector3(P.pos.x, 1.5, P.pos.z);
      const dir = new THREE.Vector3(guard.pos.x - P.pos.x, -0.32, guard.pos.z - P.pos.z).normalize();
      if (G.combat.ammo[3].mag <= 0) G.combat.ammo[3].mag = 30;
      G.combat.fireWeapon(3, from, dir);
    }
  } else if (SHOT === 'garage' && s.garage) {
    // The garage menu and lift run through their normal systems.
  }
}

if (SHOT === 'cover') stageCover();
else if (SHOT === 'carjack') stageCarjack();
else if (SHOT === 'shootout') stageShootout();
else if (SHOT === 'garage') stageGarage();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.mode !== 'paused') G.time += dt;

  if (G.mode === 'start') {
    G.traffic.update(dt);
    for (const ped of G.peds) ped.update(dt);
    G.fx.update(dt);
  } else if (G.mode === 'playing') {
    if (G.staged) {
      stagedUpdate(dt);
      for (const ped of G.peds) ped.update(dt);
      G.combat.update(dt);
      G.garageMenu.update(dt); // keep the lift platform live while staged
      G.missions.update(dt);
    } else {
      G.stats.timePlayed += dt;
      updatePlayer(dt);
      G.traffic.update(dt);
      G.wanted.update(dt);
      G.police.update(dt);
      G.heli.update(dt);
      G.combat.update(dt);
      G.missions.update(dt);
      G.garageMenu.update(dt); // lift auto-open/close + platform animation
      if (G.player.dead) poseFigure(G.player.figure, 'dead', 0, dt);
    }
    updateYacht(G, dt);
    G.fx.update(dt);
    G.dialogue.update(dt);
    G.audio.update(dt);
    G.hud.update(dt);
    G.minimap.draw();
  }

  if (G.waterTex) {
    G.waterTex.offset.x = G.time * 0.006;
    G.waterTex.offset.y = Math.sin(G.time * 0.24) * 0.01;
  }
  updateTrafficLights();
  updateCamera(dt);
  updateLighting(G);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    window.__sunburn.ready = true;
  }
}
renderer.setAnimationLoop(tick);

// Test hooks for the headless playtest.
window.__sunburn.startGame = startGame;
window.__sunburn.teleport = (x, z) => {
  const P = G.player;
  if (P.vehicle) {
    P.vehicle.pos.x = x; P.vehicle.pos.z = z; P.vehicle.speed = 0;
    P.figure.position.set(x, 0, z);
  } else {
    P.figure.position.set(x, groundHeightAt(G, x, z), z);
  }
};
window.__sunburn.enterNearest = () => {
  const car = nearestCar(6);
  if (car) enterVehicle(car);
  return !!car;
};
window.__sunburn.exitVehicle = () => exitVehicle();
window.__sunburn.MISSIONS = MISSIONS;
