// portraits.js — pop-art vector portraits for the dialogue box, drawn on
// canvas per character: flat colour blocks, thick outlines, and the one or
// two features that make each face theirs (Cruz's cap, Salazar's shades,
// Dante's grey streak, Cami's grease smudge, Teo's gold chain).

const PORTRAIT_DEFS = {
  teo: {
    bg: '#e86a58', skin: '#b97a4a', hair: '#1c1410', top: '#20303e',
    hairStyle: 'slick', chain: true, stubble: true,
  },
  camila: {
    bg: '#0e5a6d', skin: '#d99e6a', hair: '#241016', top: '#0f7a7a',
    hairStyle: 'ponytail', smudge: true,
  },
  dante: {
    bg: '#3a2a5e', skin: '#a8763e', hair: '#8a8a92', top: '#5e2f6e',
    hairStyle: 'swept', moustache: true, pendant: true,
  },
  salazar: {
    bg: '#2a0a1e', skin: '#e3b48f', hair: '#d8d3c3', top: '#8a1e46',
    hairStyle: 'slick', shades: true,
  },
  cruz: {
    bg: '#16283e', skin: '#8a5a34', hair: '#14100c', top: '#1d3a5f',
    hairStyle: 'bun', cap: '#16283e', badge: true,
  },
};

const portraitCache = new Map();

// Draw (once, then cached) the 112×112 portrait canvas for a character key.
export function drawPortrait(who) {
  if (portraitCache.has(who)) return portraitCache.get(who);
  const def = PORTRAIT_DEFS[who] ?? PORTRAIT_DEFS.teo;
  const canvas = document.createElement('canvas');
  canvas.width = 112;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = def.bg;
  ctx.fillRect(0, 0, 112, 112);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(88, 16, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#14100a';

  // Shoulders and top.
  ctx.fillStyle = def.top;
  ctx.beginPath();
  ctx.moveTo(14, 112);
  ctx.quadraticCurveTo(56, 74, 98, 112);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  if (def.chain) {
    ctx.strokeStyle = '#ffb800';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(56, 86, 17, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.strokeStyle = '#14100a';
    ctx.lineWidth = 3;
  }
  if (def.badge) {
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc(80, 96, 5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  if (def.pendant) {
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.arc(56, 97, 6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#14100a';
    ctx.beginPath();
    ctx.moveTo(56, 93); ctx.lineTo(56, 97); ctx.moveTo(53, 95); ctx.lineTo(59, 95);
    ctx.stroke();
  }

  // Neck and face.
  ctx.fillStyle = def.skin;
  ctx.fillRect(48, 66, 16, 14);
  ctx.beginPath();
  ctx.ellipse(56, 46, 21, 25, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Hair by style.
  ctx.fillStyle = def.hair;
  if (def.hairStyle === 'slick') {
    ctx.beginPath();
    ctx.ellipse(56, 27, 21.5, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillRect(35, 24, 4, 14); ctx.fillRect(73, 24, 4, 14);
  } else if (def.hairStyle === 'ponytail') {
    ctx.beginPath();
    ctx.ellipse(56, 26, 21.5, 10.5, 0, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(80, 44, 6, 17, 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (def.hairStyle === 'swept') {
    ctx.beginPath();
    ctx.ellipse(54, 25, 22, 11, -0.12, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (def.hairStyle === 'bun') {
    ctx.beginPath();
    ctx.arc(56, 18, 8, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(56, 27, 21.5, 9, 0, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  if (def.cap) {
    ctx.fillStyle = def.cap;
    ctx.beginPath();
    ctx.ellipse(56, 24, 22.5, 9.5, 0, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillRect(33, 22, 46, 5);
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc(56, 17, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Face: brows, eyes (or shades), nose, mouth.
  ctx.strokeStyle = '#14100a';
  ctx.lineWidth = 2.4;
  if (def.shades) {
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.roundRect(36, 40, 40, 11, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(40, 42, 12, 3);
  } else {
    ctx.beginPath();
    ctx.moveTo(41, 41); ctx.lineTo(50, 41);
    ctx.moveTo(62, 41); ctx.lineTo(71, 41);
    ctx.stroke();
    ctx.fillStyle = '#14100a';
    ctx.beginPath();
    ctx.arc(45.5, 46, 2.2, 0, Math.PI * 2);
    ctx.arc(66.5, 46, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(56, 47); ctx.lineTo(53.5, 55); ctx.lineTo(56.5, 55);
  ctx.stroke();
  if (def.moustache) {
    ctx.fillStyle = def.hair;
    ctx.beginPath();
    ctx.ellipse(56, 60, 10, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  if (who === 'salazar') {
    ctx.moveTo(47, 64); ctx.lineTo(65, 64);
  } else if (who === 'cruz') {
    ctx.moveTo(48, 65); ctx.lineTo(64, 65);
  } else {
    ctx.arc(56, 60, 8, 0.35, Math.PI - 0.35);
  }
  ctx.stroke();
  if (def.stubble) {
    ctx.fillStyle = 'rgba(20,14,8,0.35)';
    ctx.beginPath();
    ctx.ellipse(56, 62, 13, 8, 0, 0, Math.PI);
    ctx.fill();
  }
  if (def.smudge) {
    ctx.fillStyle = 'rgba(30,26,22,0.5)';
    ctx.beginPath();
    ctx.ellipse(70, 54, 5, 3, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  portraitCache.set(who, canvas);
  return canvas;
}
