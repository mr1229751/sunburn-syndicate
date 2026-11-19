// save.js — Respect ranks and the three localStorage save slots: money,
// respect, jobs done, ratings and career stats, written from the pause
// menu's SAVE tab and read by the start screen's CONTINUE / LOAD.

export const RANKS = [
  { name: 'UNKNOWN', at: 0 },
  { name: 'RUNNER', at: 200 },
  { name: 'WHEELMAN', at: 600 },
  { name: 'FIXER', at: 1200 },
  { name: 'SHOT CALLER', at: 2200 },
  { name: 'KINGPIN', at: 3400 },
];

export function rankForRespect(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (respect >= RANKS[i].at) idx = i;
  }
  const current = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const frac = next
    ? (respect - current.at) / (next.at - current.at)
    : 1;
  return { ...current, index: idx, next, frac: Math.min(1, Math.max(0, frac)) };
}

const SLOT_KEY = (slot) => `sunburn-syndicate-save-${slot}`;

export function peekSave(slot) {
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const done = (data.completed ?? []).filter(Boolean).length;
    return { slot, done, money: data.money ?? 0, when: data.when ?? 0 };
  } catch {
    return null;
  }
}

export function peekAllSaves() {
  return [1, 2, 3].map((slot) => peekSave(slot));
}

export function hasAnySave() {
  return peekAllSaves().some((s) => s !== null);
}

export function writeSave(G, slot) {
  const data = {
    money: G.money,
    respect: G.respect,
    completed: [...G.missions.completed],
    ratings: [...G.missions.ratings],
    stats: { ...G.stats },
    when: Date.now(),
  };
  try {
    localStorage.setItem(SLOT_KEY(slot), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave(G, slot) {
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot));
    if (!raw) return false;
    const data = JSON.parse(raw);
    G.money = data.money ?? 0;
    G.respect = data.respect ?? 0;
    if (Array.isArray(data.completed)) {
      data.completed.forEach((c, i) => { G.missions.completed[i] = !!c; });
    }
    if (Array.isArray(data.ratings)) {
      data.ratings.forEach((r, i) => { G.missions.ratings[i] = r | 0; });
    }
    if (data.stats) Object.assign(G.stats, data.stats);
    return true;
  } catch {
    return false;
  }
}
