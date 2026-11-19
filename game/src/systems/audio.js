// audio.js — every sound is synthesised with WebAudio: the 98.5 CORAL FM
// radio (a step-sequenced synth loop with rotating tracks), the engine,
// gunshots, explosions, crashes and UI blips. No audio files exist.

const TRACKS = [
  { title: 'Neon Palms — Costa Azul', prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bpm: 98 },
  { title: 'Marea Alta — Los Faro', prog: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]], bpm: 104 },
  { title: 'Medianoche — DJ Caimán', prog: [[45, 48, 52], [45, 48, 52], [41, 45, 48], [43, 47, 50]], bpm: 112 },
];

function midiFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioEngine {
  constructor(G) {
    this.G = G;
    this.ctx = null;
    this.muted = false;
    this.volume = 0.8;
    this.radioOn = false;
    this.trackIndex = 0;
    this.trackTimer = 0;
    this.step = 0;
    this.nextStepAt = 0;
    this.engineNodes = null;
  }

  get currentTrack() { return TRACKS[this.trackIndex]; }

  // The context can only start after a user gesture; main calls this from
  // the start-menu buttons.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master && !this.muted) this.master.gain.value = v;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  // ---------------- radio ----------------
  startRadio() {
    this.ensure();
    if (!this.ctx || this.radioOn) return;
    this.radioOn = true;
    this.step = 0;
    this.nextStepAt = this.ctx.currentTime + 0.06;
  }

  stopRadio() { this.radioOn = false; }

  scheduleStep(step, at) {
    const track = this.currentTrack;
    const bar = Math.floor(step / 8) % 4;
    const chord = track.prog[bar];
    const ctx = this.ctx;
    if (step % 8 === 0) {
      // Warm pad: root and fifth through a lowpass.
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0, at);
      padGain.gain.linearRampToValueAtTime(0.055, at + 0.3);
      padGain.gain.setValueAtTime(0.055, at + 1.7);
      padGain.gain.linearRampToValueAtTime(0, at + 2.3);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 850;
      padGain.connect(filter); filter.connect(this.master);
      for (const note of [chord[0], chord[2], chord[0] + 12]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiFreq(note);
        osc.connect(padGain);
        osc.start(at); osc.stop(at + 2.35);
      }
    }
    if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
      const bass = ctx.createOscillator();
      bass.type = 'sine';
      bass.frequency.value = midiFreq(chord[0] - 12);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.16, at);
      bg.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
      bass.connect(bg); bg.connect(this.master);
      bass.start(at); bass.stop(at + 0.3);
    }
    if (step % 2 === 0) {
      const arp = ctx.createOscillator();
      arp.type = 'square';
      arp.frequency.value = midiFreq(chord[(step / 2) % 3] + 12);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.028, at);
      ag.gain.exponentialRampToValueAtTime(0.001, at + 0.11);
      arp.connect(ag); ag.connect(this.master);
      arp.start(at); arp.stop(at + 0.12);
    }
  }

  // ---------------- engine ----------------
  engineStart() {
    this.ensure();
    if (!this.ctx || this.engineNodes) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 30;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter); sub.connect(filter); filter.connect(gain); gain.connect(this.master);
    osc.start(); sub.start();
    this.engineNodes = { osc, sub, filter, gain };
  }

  engineUpdate(speedRatio, throttle) {
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 52 + Math.abs(speedRatio) * 165 + Math.max(0, throttle) * 22;
    this.engineNodes.osc.frequency.setTargetAtTime(rpm, t, 0.06);
    this.engineNodes.sub.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
    this.engineNodes.filter.frequency.setTargetAtTime(300 + Math.abs(speedRatio) * 720, t, 0.08);
    this.engineNodes.gain.gain.setTargetAtTime(0.05 + Math.abs(speedRatio) * 0.05, t, 0.09);
  }

  engineStop() {
    if (!this.engineNodes || !this.ctx) return;
    const nodes = this.engineNodes;
    nodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    window.setTimeout(() => { try { nodes.osc.stop(); nodes.sub.stop(); } catch { /* already stopped */ } }, 220);
    this.engineNodes = null;
  }

  // ---------------- one-shots ----------------
  noiseBurst(duration, filterFrom, filterTo, gainValue) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrom, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + duration + 0.02);
  }

  tone(freqFrom, freqTo, duration, gainValue, type = 'sine') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  gunshot(vol = 1) {
    this.noiseBurst(0.13, 3200, 260, 0.4 * vol);
    this.tone(150, 55, 0.1, 0.25 * vol, 'triangle');
  }

  explosionSfx() {
    this.noiseBurst(0.85, 640, 55, 0.85);
    this.tone(95, 28, 0.8, 0.7, 'sine');
  }

  crash() {
    this.noiseBurst(0.22, 1100, 160, 0.4);
    this.tone(80, 40, 0.2, 0.3, 'triangle');
  }

  blip(freq = 880) { this.tone(freq, freq, 0.07, 0.1, 'square'); }
  cash() {
    this.tone(1318, 1318, 0.08, 0.12, 'square');
    window.setTimeout(() => this.tone(1760, 1760, 0.12, 0.12, 'square'), 70);
  }
  door() { this.noiseBurst(0.05, 900, 300, 0.15); }

  update(dt) {
    if (!this.ctx) return;
    if (this.radioOn && !this.muted) {
      const track = this.currentTrack;
      const stepDur = 60 / track.bpm / 2;
      while (this.nextStepAt < this.ctx.currentTime + 0.18) {
        this.scheduleStep(this.step, this.nextStepAt);
        this.step++;
        this.nextStepAt += stepDur;
      }
      this.trackTimer += dt;
      if (this.trackTimer > 26) {
        this.trackTimer = 0;
        this.trackIndex = (this.trackIndex + 1) % TRACKS.length;
      }
    }
    if (this.G.player.vehicle) {
      const v = this.G.player.vehicle;
      this.engineUpdate(v.speed / v.topSpeed, 0);
    }
  }
}
