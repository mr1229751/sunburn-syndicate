// dialog.js — the bottom-centre dialogue box: a character portrait in its
// colour frame, the speaker's name in their accent colour, and one or two
// lines of their voice. Lines can queue into short conversations.

import { CHARACTERS } from '../missions/missionData.js';
import { drawPortrait } from './portraits.js';

export class DialogueBox {
  constructor(G) {
    this.G = G;
    this.el = document.getElementById('dialogue');
    this.portrait = document.getElementById('dialogue-portrait');
    this.nameEl = document.getElementById('dialogue-name');
    this.textEl = document.getElementById('dialogue-text');
    this.queue = [];
    this.timer = 0;
    this.current = null;
  }

  show(who, text, duration = 4.4) {
    this.queue.push({ who, text, duration });
    if (!this.current) this.next();
  }

  showSequence(lines) {
    for (const line of lines) this.show(line.who, line.text, 4.6);
  }

  next() {
    const line = this.queue.shift();
    if (!line) {
      this.current = null;
      this.el.classList.add('hidden');
      return;
    }
    this.current = line;
    this.timer = line.duration;
    const def = CHARACTERS[line.who] ?? { name: line.who.toUpperCase(), color: '#ffb800' };
    this.nameEl.textContent = def.name;
    this.nameEl.style.color = def.color;
    this.textEl.textContent = line.text;
    this.portrait.style.borderColor = def.color;
    const ctx = this.portrait.getContext('2d');
    ctx.clearRect(0, 0, 112, 112);
    ctx.drawImage(drawPortrait(line.who), 0, 0);
    this.el.classList.remove('hidden');
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.el.classList.add('hidden');
  }

  update(dt) {
    if (!this.current) return;
    this.timer -= dt;
    if (this.timer <= 0) this.next();
  }
}
