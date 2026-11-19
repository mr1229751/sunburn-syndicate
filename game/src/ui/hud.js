// hud.js — the dense GTA-style HUD: mission card, wanted stars, money and
// Respect, health and armour, the live BCPD response panel, the event
// banner, the radio + speedometer cluster and the weapon slots. Every
// panel is driven by real game state each frame.

import { WEAPONS } from '../systems/combat.js';
import { rankForRespect } from '../save.js';

const TAG_CLASSES = {
  SPOTLIGHT: 'red', RAMMING: 'red', FIRING: 'red',
  PURSUIT: 'orange', ROADBLOCK: 'yellow', SEARCHING: 'grey',
};

function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  constructor(G) {
    this.G = G;
    const el = (id) => document.getElementById(id);
    this.root = el('hud');
    this.missionTitle = el('mission-title');
    this.missionTimer = el('mission-timer');
    this.missionObjective = el('mission-objective');
    this.missionDistance = el('mission-distance');
    this.missionStage = el('mission-stage-label');
    this.missionFill = el('mission-bar-fill');
    this.stars = [...document.querySelectorAll('#wanted-stars span')];
    this.money = el('money');
    this.respectRank = el('respect-rank');
    this.respectFill = el('respect-fill');
    this.healthFill = el('health-fill');
    this.armourFill = el('armour-fill');
    this.bcpdPanel = el('bcpd-panel');
    this.bcpdHeader = el('bcpd-header');
    this.bcpdUnits = el('bcpd-units');
    this.banner = el('banner');
    this.bannerTimer = 0;
    this.driveCluster = el('drive-cluster');
    this.speedValue = el('speed-value');
    this.carName = el('car-name');
    this.chassisFill = el('chassis-fill');
    this.radioTrack = el('radio-track');
    this.eqBars = [...document.querySelectorAll('#radio-eq i')];
    this.weaponCluster = el('weapon-cluster');
    this.weaponSlots = [...document.querySelectorAll('.weapon-slot')];
    this.crosshair = el('crosshair');
    this.prompt = el('prompt');
    this.hitEl = el('hitmarker');
    this.hitTimer = 0;
    this.jobComplete = el('job-complete');
    this.jobTimer = 0;
    this.lastBcpdHtml = '';
    this.promptText = undefined;
  }

  showBanner(text, color = 'gold', duration = 2.8) {
    this.banner.textContent = text;
    this.banner.className = color === 'gold' ? '' : color;
    this.banner.classList.remove('hidden');
    this.bannerTimer = duration;
  }

  showJobComplete(job, rating) {
    document.getElementById('job-complete-name').textContent = job.title;
    document.getElementById('job-complete-reward').textContent =
      `+$${job.cash.toLocaleString('en-US')} · +${job.respect} RESPECT`;
    document.getElementById('job-complete-rank').textContent =
      '★'.repeat(rating) + '☆'.repeat(3 - rating) + ' — JOB RATING';
    this.jobComplete.classList.remove('hidden');
    this.jobTimer = 4.6;
  }

  hitmark() {
    this.hitEl.classList.remove('hidden');
    this.hitTimer = 0.09;
  }

  setPrompt(html) {
    if (html === this.promptText) return;
    this.promptText = html;
    if (html === null || html === undefined) {
      this.prompt.classList.add('hidden');
    } else {
      this.prompt.innerHTML = html;
      this.prompt.classList.remove('hidden');
    }
  }

  update(dt) {
    const G = this.G;
    const P = G.player;

    // Mission card.
    const data = G.missions.hudData();
    this.missionTitle.textContent = data.header;
    this.missionObjective.textContent = data.objective;
    this.missionDistance.textContent = data.distance;
    this.missionStage.textContent = data.stageLabel;
    this.missionFill.style.width = `${Math.round(data.frac * 100)}%`;
    const timerVal = G.hudTimerOverride !== null && G.hudTimerOverride !== undefined
      ? G.hudTimerOverride : data.timer;
    if (timerVal !== null && timerVal !== undefined) {
      this.missionTimer.textContent = formatTimer(timerVal);
      this.missionTimer.className = timerVal < 30 ? 'low' : '';
    } else {
      this.missionTimer.textContent = '';
    }

    // Wanted stars with the red/blue flash.
    const phase = Math.floor(G.time * 4) % 2;
    this.stars.forEach((span, i) => {
      if (i < G.wanted.level) {
        span.className = 'active ' + (phase === 0
          ? (i % 2 === 0 ? 'flash-red' : 'flash-blue')
          : (i % 2 === 0 ? 'flash-blue' : 'flash-red'));
      } else {
        span.className = '';
      }
    });

    this.money.textContent = formatMoney(G.money);
    const rank = rankForRespect(G.respect);
    this.respectRank.textContent = rank.name;
    this.respectFill.style.width = `${Math.round(rank.frac * 100)}%`;
    this.healthFill.style.width = `${Math.max(0, P.health)}%`;
    this.healthFill.style.background = P.health < 30 ? '#ef4444' : '#22c55e';
    this.armourFill.style.width = `${Math.max(0, P.armour)}%`;

    // BCPD response panel.
    if (G.wanted.level >= 1 && G.mode === 'playing') {
      this.bcpdPanel.classList.remove('hidden');
      this.bcpdHeader.className = phase === 0 ? '' : 'blue';
      this.bcpdHeader.id = 'bcpd-header';
      const rows = [];
      if (G.heli && G.heli.active) {
        const pp = P.vehicle ? P.vehicle.pos : P.pos;
        const d = Math.round(Math.hypot(G.heli.pos.x - pp.x, G.heli.pos.z - pp.z));
        rows.push({ status: 'SPOTLIGHT', dist: d });
      }
      rows.push(...G.police.nearestUnits(4 - rows.length));
      const html = rows.map((r, i) =>
        `<div class="bcpd-unit"><span>UNIT ${i + 1}</span><span class="dist">${r.dist} m</span>` +
        `<span class="tag ${TAG_CLASSES[r.status] ?? 'grey'}">${r.status}</span></div>`,
      ).join('');
      if (html !== this.lastBcpdHtml) {
        this.bcpdUnits.innerHTML = html;
        this.lastBcpdHtml = html;
      }
    } else {
      this.bcpdPanel.classList.add('hidden');
      this.lastBcpdHtml = '';
    }

    // Driving vs on-foot clusters.
    const driving = !!(P.vehicle || P.inBoat || G.displayCar);
    this.driveCluster.classList.toggle('hidden', !driving);
    this.weaponCluster.classList.toggle('hidden', driving);
    if (driving) {
      const craft = P.vehicle ?? (P.inBoat ? G.boat : G.displayCar);
      this.speedValue.textContent = String(Math.round(craft.displaySpeedKmh()));
      this.carName.textContent = craft.name ?? 'BOAT';
      this.chassisFill.style.width = craft && craft.condition !== undefined
        ? `${Math.round(craft.condition * 100)}%` : '100%';
      if (G.audio && G.audio.radioOn) {
        this.radioTrack.textContent = G.audio.currentTrack.title;
        this.eqBars.forEach((bar, i) => {
          bar.style.height = `${18 + Math.abs(Math.sin(G.time * 6.5 + i * 1.63)) * 78}%`;
        });
      } else {
        this.radioTrack.textContent = 'RADIO OFF — ENGINE ONLY';
        this.eqBars.forEach((bar) => { bar.style.height = '14%'; });
      }
    } else {
      this.weaponSlots.forEach((slotEl, i) => {
        const slot = i + 1;
        const w = WEAPONS[slot];
        const a = G.combat.ammo[slot];
        slotEl.classList.toggle('selected', P.weapon === slot);
        slotEl.querySelector('.wname').textContent = w.name;
        slotEl.querySelector('.wammo').textContent =
          `${a.mag} / ${a.reserve === Infinity ? '∞' : a.reserve}`;
      });
    }
    this.crosshair.classList.toggle('hidden', driving || G.mode !== 'playing' || G.garageOpen);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.add('hidden');
    }
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.hitEl.classList.add('hidden');
    }
    if (this.jobTimer > 0) {
      this.jobTimer -= dt;
      if (this.jobTimer <= 0) this.jobComplete.classList.add('hidden');
    }
  }
}
