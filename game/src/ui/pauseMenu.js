// pauseMenu.js — the pause menu's three real tabs: a MAP of the whole
// city (district names, mission and job markers, the GPS route, click to
// set a waypoint), STATS (completion, career counters, mission ratings)
// and SAVE (three localStorage slots, save and load).

import { DISTRICTS, PLACES, shoreX } from '../world/districts.js';
import { MISSIONS } from '../missions/missionData.js';
import { peekSave, readSave, writeSave } from '../save.js';

const MAP_BOUNDS = { x0: -640, z0: -660, x1: 960, z1: 780 };

export class PauseMenu {
  constructor(G) {
    this.G = G;
    this.root = document.getElementById('pause-menu');
    this.mapCanvas = document.getElementById('big-map');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.statsEl = document.getElementById('tab-stats');
    this.saveEl = document.getElementById('tab-save');
    this.isOpen = false;
    this.transform = { scale: 1, ox: 0, oy: 0 };
    for (const btn of document.querySelectorAll('#pause-tabs .tab-btn[data-tab]')) {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    }
    document.getElementById('btn-resume').addEventListener('click', () => this.close());
    this.mapCanvas.addEventListener('click', (ev) => this.onMapClick(ev));
  }

  switchTab(name) {
    for (const btn of document.querySelectorAll('#pause-tabs .tab-btn[data-tab]')) {
      btn.classList.toggle('active', btn.dataset.tab === name);
    }
    for (const page of ['map', 'stats', 'save']) {
      document.getElementById(`tab-${page}`).classList.toggle('hidden', page !== name);
    }
    if (name === 'map') this.drawMap();
    if (name === 'stats') this.renderStats();
    if (name === 'save') this.renderSave();
  }

  open() {
    this.isOpen = true;
    this.G.mode = 'paused';
    this.root.classList.remove('hidden');
    this.switchTab('map');
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
    if (this.G.mode === 'paused') this.G.mode = 'playing';
  }

  mapPoint(x, z) {
    const { scale, ox, oy } = this.transform;
    return { x: ox + (x - MAP_BOUNDS.x0) * scale, y: oy + (z - MAP_BOUNDS.z0) * scale };
  }

  drawMap() {
    const G = this.G;
    const ctx = this.mapCtx;
    const W = this.mapCanvas.width, H = this.mapCanvas.height;
    const scale = Math.min(W / (MAP_BOUNDS.x1 - MAP_BOUNDS.x0), H / (MAP_BOUNDS.z1 - MAP_BOUNDS.z0));
    this.transform = {
      scale,
      ox: (W - (MAP_BOUNDS.x1 - MAP_BOUNDS.x0) * scale) / 2,
      oy: (H - (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * scale) / 2,
    };
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, W, H);
    // Water.
    ctx.fillStyle = '#0e3a4d';
    ctx.beginPath();
    for (let z = MAP_BOUNDS.z0; z <= MAP_BOUNDS.z1; z += 24) {
      const p = this.mapPoint(shoreX(z), z);
      if (z === MAP_BOUNDS.z0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(W, H); ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
    // Roads.
    for (const s of G.roadSegments) {
      const a = this.mapPoint(s.x0, s.z0), b = this.mapPoint(s.x1, s.z1);
      ctx.strokeStyle = '#4d5568';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (G.bridge) {
      const a = this.mapPoint(G.bridge.ax, G.bridge.az), b = this.mapPoint(G.bridge.bx, G.bridge.bz);
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // District names.
    ctx.font = '900 12px Arial';
    ctx.fillStyle = 'rgba(255,217,122,0.85)';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const p = this.mapPoint((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2);
      ctx.fillText(d.name, p.x, p.y);
    }
    ctx.font = '700 10px Arial';
    ctx.fillStyle = 'rgba(125,249,255,0.9)';
    const gp = this.mapPoint(PLACES.garageFront.x, PLACES.garageFront.z);
    ctx.fillText('TALLER DIABLO', gp.x, gp.y - 8);
    const fp = this.mapPoint(PLACES.faroSol.x, PLACES.faroSol.z);
    ctx.fillStyle = 'rgba(255,184,0,0.95)';
    ctx.fillText('EL FARO SOL', fp.x, fp.y - 8);
    const pp2 = this.mapPoint(PLACES.pier4.x, PLACES.pier4.z);
    ctx.fillText('PIER 4', pp2.x, pp2.y - 8);
    ctx.textAlign = 'left';

    // Route and target.
    const target = G.missions.targetPos() ?? G.waypoint;
    const pc = G.player.vehicle ? G.player.vehicle.pos : G.player.pos;
    if (target) {
      const a = this.mapPoint(pc.x, pc.z);
      const corner = this.mapPoint(target.x, pc.z);
      const b = this.mapPoint(target.x, target.z);
      ctx.strokeStyle = '#ffb800';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(corner.x, corner.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#ffb800';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    if (G.waypoint) {
      const w = this.mapPoint(G.waypoint.x, G.waypoint.z);
      ctx.fillStyle = '#ff3d7f';
      ctx.beginPath(); ctx.arc(w.x, w.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const p = this.mapPoint(pc.x, pc.z);
    const heading = G.player.vehicle ? G.player.vehicle.heading : G.player.heading;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(Math.cos(heading), Math.sin(heading)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  onMapClick(ev) {
    const rect = this.mapCanvas.getBoundingClientRect();
    const cx = (ev.clientX - rect.left) * (this.mapCanvas.width / rect.width);
    const cy = (ev.clientY - rect.top) * (this.mapCanvas.height / rect.height);
    const { scale, ox, oy } = this.transform;
    const wx = MAP_BOUNDS.x0 + (cx - ox) / scale;
    const wz = MAP_BOUNDS.z0 + (cy - oy) / scale;
    this.G.waypoint = { x: wx, z: wz };
    if (this.G.audio) this.G.audio.blip(740);
    this.drawMap();
  }

  renderStats() {
    const G = this.G;
    const s = G.stats;
    const done = G.missions.completed.filter(Boolean).length;
    const completion = Math.round((done / MISSIONS.length) * 100);
    const mins = Math.floor(s.timePlayed / 60);
    const secs = Math.floor(s.timePlayed % 60);
    const ratings = MISSIONS.map((m, i) => {
      const r = G.missions.ratings[i];
      const stars = r > 0
        ? `<span class="stars">${'★'.repeat(r)}${'☆'.repeat(3 - r)}</span>`
        : '<span class="stars">—</span>';
      return `<div>${i + 1}. ${m.title} ${stars}</div>`;
    }).join('');
    this.statsEl.innerHTML =
      `<div class="stat-grid">` +
      `<div>STORY COMPLETION — <b>${completion}%</b> (${done}/8 jobs)</div>` +
      `<div>TIME IN BAHÍA CORAL — ${mins}:${String(secs).padStart(2, '0')}</div>` +
      `<div>CASH EARNED — $${Math.round(s.moneyEarned).toLocaleString('en-US')}</div>` +
      `<div>CARS STOLEN — ${s.carsStolen}</div>` +
      `<div>DISTANCE DRIVEN — ${(s.distanceDriven / 1000).toFixed(1)} km</div>` +
      `<div>HIGHEST WANTED — ${'★'.repeat(s.highestWanted)}</div>` +
      `<div>SHOTS FIRED — ${s.shotsFired}</div>` +
      `<div>ENEMIES DROPPED — ${s.enemiesDropped}</div>` +
      `<div>AMMO CRATES BURNED — ${s.cratesDestroyed}</div>` +
      `<div>TIMES FLATLINED — ${s.deaths}</div>` +
      `</div><div class="mission-ratings"><b>JOB RATINGS</b>${ratings}</div>`;
  }

  renderSave(msg = '') {
    const rows = [1, 2, 3].map((slot) => {
      const info = peekSave(slot);
      const label = info
        ? `SLOT ${slot} — ${info.done}/8 JOBS · $${Math.round(info.money).toLocaleString('en-US')} · ${new Date(info.when).toLocaleDateString('en-GB')}`
        : `SLOT ${slot} — EMPTY`;
      return `<div style="display:flex;gap:6px;align-items:center;margin:5px 0">` +
        `<button class="slot" data-save="${slot}" style="flex:1">SAVE → ${label}</button>` +
        `<button class="slot" data-load="${slot}" style="flex:0 0 92px" ${info ? '' : 'disabled'}>LOAD</button></div>`;
    }).join('');
    this.saveEl.innerHTML =
      `<div style="font-size:13px;color:#aab4c8;font-weight:700">Progress lives in this browser. ` +
      `Saving keeps cash, Respect, jobs and career stats.</div>${rows}` +
      (msg ? `<div style="color:#4ade80;font-weight:800;margin-top:6px">${msg}</div>` : '');
    for (const btn of this.saveEl.querySelectorAll('[data-save]')) {
      btn.addEventListener('click', () => {
        writeSave(this.G, Number(btn.dataset.save));
        if (this.G.audio) this.G.audio.cash();
        this.renderSave(`Saved to slot ${btn.dataset.save}.`);
      });
    }
    for (const btn of this.saveEl.querySelectorAll('[data-load]')) {
      btn.addEventListener('click', () => {
        if (readSave(this.G, Number(btn.dataset.load))) {
          this.renderSave(`Loaded slot ${btn.dataset.load}.`);
          if (this.G.hud) this.G.hud.showBanner('SAVE LOADED', 'green');
        }
      });
    }
  }
}
