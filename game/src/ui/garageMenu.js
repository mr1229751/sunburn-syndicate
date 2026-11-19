// garageMenu.js — Taller Diablo's spray & tune: the panel that opens when
// Teo rolls onto the lift. Repairs, resprays (which clear unseen heat),
// engine tunes and chassis armour all really change the car, and the stat
// bars show the upgrade delta before you pay. Closing with ESC latches the
// auto-open shut until the car leaves, so it cannot instantly reopen.

const RESPRAY_COST = 200;
const REPAIR_COST = 450;
const ENGINE_COST = 3500;
const ARMOUR_COST = 4200;
const SWATCHES = [
  ['#e86a58', 'Coral'], ['#ffb800', 'Taxi Gold'], ['#4aa3a2', 'Teal'],
  ['#2d5da1', 'Cobalt'], ['#101216', 'Midnight'], ['#e8e4da', 'Pearl'],
  ['#7a1f8a', 'Viper Purple'], ['#3f9e4d', 'Palma Green'],
];

export class GarageMenu {
  constructor(G) {
    this.G = G;
    this.panel = document.getElementById('garage-panel');
    this.carNameEl = document.getElementById('garage-car');
    this.statsEl = document.getElementById('garage-stats');
    this.msgEl = document.getElementById('garage-msg');
    this.repairBtn = document.getElementById('garage-repair');
    this.engineBtn = document.getElementById('garage-engine');
    this.armourBtn = document.getElementById('garage-armour');
    this.open = false;
    this.closedLatch = false;
    this.car = null;

    const swatchBox = document.getElementById('garage-swatches');
    for (const [color, name] of SWATCHES) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color;
      b.title = `${name} — $${RESPRAY_COST}`;
      b.addEventListener('click', () => this.buyRespray(color, name));
      swatchBox.appendChild(b);
    }
    this.repairBtn.addEventListener('click', () => this.buyRepair());
    this.engineBtn.addEventListener('click', () => this.buyEngine());
    this.armourBtn.addEventListener('click', () => this.buyArmour());
    document.getElementById('garage-close').addEventListener('click', () => this.close());
  }

  statRows(car) {
    const rows = [
      { name: 'TOP SPEED', value: (car.topSpeed / 58) * 100, delta: car.engineLevel < 3 ? (car.spec.topSpeed * 0.16 / 58) * 100 : 0, text: `${Math.round(car.topSpeed * 3.6)} km/h` },
      { name: 'ACCELERATION', value: (car.accelRate / 19.5) * 100, delta: car.engineLevel < 3 ? (car.spec.accel * 0.2 / 19.5) * 100 : 0, text: car.engineLevel >= 3 ? 'MAX' : `LV ${car.engineLevel}` },
      { name: 'HANDLING', value: (car.spec.handling / 1.45) * 100, delta: 0, text: '' },
      { name: 'ARMOR', value: 22 + car.armourLevel * 26, delta: car.armourLevel < 3 ? 26 : 0, text: car.armourLevel >= 3 ? 'MAX' : `LV ${car.armourLevel}` },
    ];
    return rows.map((r) => {
      const v = Math.min(100, Math.round(r.value));
      const d = Math.round(r.delta);
      return `<div class="gstat"><span class="gname">${r.name}</span>` +
        `<div class="gbar"><div class="gfill" style="width:${v}%"></div>` +
        (d > 0 ? `<div class="gdelta" style="width:${d}%"></div>` : '') +
        `</div><span class="gval">${r.text}</span></div>`;
    }).join('');
  }

  render() {
    const car = this.car;
    if (!car) return;
    this.carNameEl.textContent = car.name;
    this.statsEl.innerHTML = this.statRows(car);
    this.repairBtn.querySelector('span').textContent = `$${REPAIR_COST}`;
    this.engineBtn.innerHTML = car.engineLevel >= 3
      ? 'ENGINE TUNE — MAXED' : `ENGINE TUNE LV${car.engineLevel + 1} <span>$${ENGINE_COST.toLocaleString('en-US')}</span>`;
    this.armourBtn.innerHTML = car.armourLevel >= 3
      ? 'CHASSIS ARMOUR — MAXED' : `CHASSIS ARMOUR LV${car.armourLevel + 1} <span>$${ARMOUR_COST.toLocaleString('en-US')}</span>`;
  }

  say(text, ok = true) {
    this.msgEl.textContent = text;
    this.msgEl.style.color = ok ? '#4ade80' : '#ff7a6b';
  }

  buyRepair() {
    const G = this.G, car = this.car;
    if (!car) return;
    if (car.condition > 0.995) { this.say('She is already mint, Teo.', false); return; }
    if (G.money < REPAIR_COST) { this.say('Not enough cash for a repair.', false); return; }
    G.money -= REPAIR_COST;
    car.repair();
    if (G.audio) G.audio.blip(520);
    this.say('Repaired — panels straight, engine honest.');
    this.render();
  }

  buyRespray(color, name) {
    const G = this.G, car = this.car;
    if (!car) return;
    if (G.money < RESPRAY_COST) { this.say('Not enough cash for paint.', false); return; }
    G.money -= RESPRAY_COST;
    car.setPaint(color);
    if (G.audio) G.audio.blip(660);
    if (G.wanted.level > 0 && !G.wanted.seenRecently(3)) {
      G.wanted.clearHeat();
      if (G.hud) G.hud.showBanner('HEAT CLEARED — NEW PAINT', 'green');
      this.say(`${name} laid down. The BCPD never saw this colour — heat cleared.`);
    } else if (G.wanted.level > 0) {
      this.say(`${name} laid down — but they SAW this car. Break line of sight first.`, false);
    } else {
      this.say(`${name} laid down. She looks fast standing still.`);
    }
    this.render();
  }

  buyEngine() {
    const G = this.G, car = this.car;
    if (!car || car.engineLevel >= 3) return;
    if (G.money < ENGINE_COST) { this.say('Not enough cash for the tune.', false); return; }
    G.money -= ENGINE_COST;
    car.engineLevel++;
    G.missions.notifyUpgrade();
    if (G.audio) G.audio.cash();
    this.say(`Engine tune LV${car.engineLevel} fitted — feel that top end.`);
    this.render();
  }

  buyArmour() {
    const G = this.G, car = this.car;
    if (!car || car.armourLevel >= 3) return;
    if (G.money < ARMOUR_COST) { this.say('Not enough cash for plating.', false); return; }
    G.money -= ARMOUR_COST;
    car.armourLevel++;
    G.missions.notifyUpgrade();
    if (G.audio) G.audio.cash();
    this.say(`Chassis armour LV${car.armourLevel} welded in. Ram responsibly.`);
    this.render();
  }

  openMenu(car) {
    this.car = car;
    this.open = true;
    this.G.garageOpen = true;
    this.panel.classList.remove('hidden');
    this.say('');
    this.render();
    if (this.G.audio) this.G.audio.door();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.closedLatch = true;
    this.G.garageOpen = false;
    this.panel.classList.add('hidden');
  }

  update(dt) {
    const G = this.G;
    const zone = G.garage.zone;
    const car = G.player.vehicle;
    const inZone = car &&
      car.pos.x > zone.x0 && car.pos.x < zone.x1 &&
      car.pos.z > zone.z0 && car.pos.z < zone.z1;
    if (this.closedLatch && !inZone) this.closedLatch = false;

    if (!this.open && !this.closedLatch && G.mode === 'playing' &&
        car && inZone && Math.abs(car.speed) < 1.2) {
      this.openMenu(car);
    }
    const platform = G.garage.platform;
    const targetY = this.open ? 1.45 : 0.45;
    platform.position.y += (targetY - platform.position.y) * Math.min(1, dt * 2.6);
    if (this.open && this.car) {
      const lift = G.garage.liftPos;
      const d = Math.hypot(this.car.pos.x - lift.x, this.car.pos.z - lift.z);
      if (d < 3.4) {
        this.car.pos.y += ((platform.position.y + 0.16) - this.car.pos.y) * Math.min(1, dt * 5);
        this.car.speed = 0;
      }
    }
  }
}
