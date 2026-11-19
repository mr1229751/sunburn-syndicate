// textures.js — every texture in Bahía Coral is painted procedurally on a
// canvas at boot: building facades with lit-window emissive maps, asphalt,
// concrete, sand, shipping containers, signs, awnings, blob shadows and the
// additive halo used for lights and explosions. No external assets exist.

import * as THREE from 'three';

const textureCache = new Map();

function canvasTexture(key, size, painter, options = {}) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = options.w ?? size;
  canvas.height = options.h ?? size;
  const ctx = canvas.getContext('2d');
  painter(ctx, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (options.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  textureCache.set(key, tex);
  return tex;
}

// Shared window-grid painter: fills the colour canvas and, alongside it, an
// emissive canvas where roughly 30% of windows glow warm.
function paintFacade(ctx, w, h, spec) {
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);
  if (spec.bands) {
    ctx.fillStyle = spec.bands;
    for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 5);
  }
  if (spec.pilasters) {
    ctx.fillStyle = spec.pilasters;
    for (let x = 0; x < w; x += 86) ctx.fillRect(x, 0, 10, h);
  }
  const cols = spec.cols, rows = spec.rows;
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.22, y = r * ch + ch * 0.2;
      const ww = cw * 0.56, wh = ch * 0.58;
      const shade = 0.75 + ((r * 7 + c * 13) % 10) / 40;
      ctx.fillStyle = spec.windowDark(shade);
      ctx.fillRect(x, y, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(x, y, ww, 3);
      if (spec.balcony && r % 2 === 0) {
        ctx.strokeStyle = 'rgba(20,16,24,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 3, y + wh - 4, ww + 6, 7);
      }
    }
  }
}

function paintEmissive(ctx, w, h, spec) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  const cols = spec.cols, rows = spec.rows;
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = ((r * 31 + c * 17 + spec.seed) % 10) < 3;
      if (!lit) continue;
      const x = c * cw + cw * 0.22, y = r * ch + ch * 0.2;
      const warm = ['#ffb46b', '#ffd9a0', '#ff9d5c', '#ffe9c4'][(r + c) % 4];
      ctx.fillStyle = warm;
      ctx.fillRect(x, y, cw * 0.56, ch * 0.58);
    }
  }
}

const FACADE_SPECS = {
  deco: {
    cols: 6, rows: 10, seed: 3, balcony: false,
    windowDark: (s) => `rgb(${Math.round(38 * s)},${Math.round(52 * s)},${Math.round(74 * s)})`,
  },
  glass: {
    cols: 5, rows: 12, seed: 6, balcony: false,
    windowDark: (s) => `rgb(${Math.round(52 * s)},${Math.round(96 * s)},${Math.round(128 * s)})`,
  },
  colonial: {
    cols: 5, rows: 6, seed: 1, balcony: true,
    windowDark: (s) => `rgb(${Math.round(30 * s)},${Math.round(34 * s)},${Math.round(48 * s)})`,
  },
};

// facadeSet(style, baseColor) → { map, emissiveMap } for one building style.
export function facadeSet(style, baseColor) {
  const spec = { ...FACADE_SPECS[style], base: baseColor };
  if (style === 'deco') { spec.bands = 'rgba(255,255,255,0.16)'; spec.pilasters = 'rgba(0,0,0,0.10)'; }
  if (style === 'glass') { spec.bands = 'rgba(10,16,26,0.5)'; }
  if (style === 'colonial') { spec.bands = 'rgba(255,255,255,0.10)'; }
  const map = canvasTexture(`facade-${style}-${baseColor}`, 512, (ctx, w, h) => paintFacade(ctx, w, h, spec));
  const emissiveMap = canvasTexture(`facade-em-${style}-${baseColor}`, 512, (ctx, w, h) => paintEmissive(ctx, w, h, spec), {});
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

export function asphaltTexture() {
  return canvasTexture('asphalt', 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b2d38'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const g = 34 + ((i * 37) % 26);
      ctx.fillStyle = `rgb(${g},${g + 2},${g + 9})`;
      ctx.fillRect((i * 53) % w, (i * 91) % h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 71) % w, 0); ctx.lineTo((i * 71 + 30) % w, h); ctx.stroke();
    }
  }, { repeat: true });
}

export function sidewalkTexture() {
  return canvasTexture('sidewalk', 256, (ctx, w, h) => {
    ctx.fillStyle = '#8d8fa0'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const g = 128 + ((i * 29) % 30);
      ctx.fillStyle = `rgb(${g},${g},${g + 8})`;
      ctx.fillRect((i * 41) % w, (i * 67) % h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(40,42,54,0.6)'; ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  }, { repeat: true });
}

export function sandTexture() {
  return canvasTexture('sand', 256, (ctx, w, h) => {
    ctx.fillStyle = '#ecd9ac'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      const g = 200 + ((i * 31) % 40);
      ctx.fillStyle = `rgb(${g},${g - 22},${g - 70})`;
      ctx.fillRect((i * 47) % w, (i * 83) % h, 2, 1);
    }
  }, { repeat: true });
}

export function waterTexture() {
  return canvasTexture('water', 256, (ctx, w, h) => {
    ctx.fillStyle = '#0e5a6d'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(255,159,67,${0.05 + ((i * 13) % 10) / 90})`;
      ctx.lineWidth = 1.5;
      const y = (i * 37) % h;
      ctx.beginPath(); ctx.moveTo((i * 61) % w, y); ctx.lineTo((i * 61) % w + 26 + (i % 30), y); ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = 'rgba(247,233,215,0.10)';
      const y = (i * 53) % h;
      ctx.beginPath(); ctx.moveTo((i * 97) % w, y); ctx.lineTo((i * 97) % w + 16, y); ctx.stroke();
    }
  }, { repeat: true });
}

export function containerTexture(color, label) {
  return canvasTexture(`container-${color}-${label}`, 256, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    for (let x = 8; x < w; x += 18) {
      ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(x, 0, 5, h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x + 5, 0, 3, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, h - 14, w, 14);
    ctx.font = '900 30px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(label, 18, 44);
    ctx.font = '700 15px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('CAIMAN LINES · MAX 24 000 KG', 18, 68);
  }, { w: 256, h: 128 });
}

export function crateTexture() {
  return canvasTexture('crate', 128, (ctx, w, h) => {
    ctx.fillStyle = '#5a6136'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.font = '900 17px Arial'; ctx.fillStyle = '#e8e4c8';
    ctx.fillText('AMMO', 34, 52);
    ctx.font = '700 11px Arial'; ctx.fillText('7.62 · FRAGILE', 22, 74);
    ctx.fillStyle = '#ffb800'; ctx.fillRect(14, 88, 100, 8);
  });
}

export function awningTexture(color) {
  return canvasTexture(`awning-${color}`, 128, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? color : '#f4e4c1';
      ctx.fillRect(x, 0, 16, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, h - 8, w, 8);
  }, { w: 128, h: 64 });
}

export function signTexture(text, bg, fg) {
  return canvasTexture(`sign-${text}-${bg}`, 256, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.font = '900 34px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 12);
  }, { w: 256, h: 96 });
}

export function blobShadowTexture() {
  return canvasTexture('blob', 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.52)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  });
}

export function haloTexture() {
  return canvasTexture('halo', 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  });
}

export function fireTexture() {
  return canvasTexture('fire', 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,246,200,1)');
    grad.addColorStop(0.35, 'rgba(255,170,60,0.9)');
    grad.addColorStop(0.7, 'rgba(230,70,30,0.45)');
    grad.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  });
}
