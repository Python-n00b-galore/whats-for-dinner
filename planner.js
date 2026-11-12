// Picks recipes, favouring those not planned for a long time.
const DAY = 86400000;

export function weightOf(r, now = Date.now()) {
  if (!r.lastPlanned) return 150 * 150;            // never planned: very likely
  const days = Math.max(0, (now - r.lastPlanned) / DAY);
  return Math.pow(Math.min(days, 150), 2) / 7 + 0.5; // recent: unlikely but possible
}

export function pickOne(pool, now) {
  const w = pool.map(r => weightOf(r, now));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// days: array of 7 {recipeId, locked}. Fills every unlocked slot.
export function fillWeek(recipes, days, now = Date.now()) {
  const out = days.map(d => ({ ...d }));
  const used = new Set(out.filter(d => d.locked && d.recipeId).map(d => d.recipeId));
  for (const d of out) {
    if (d.locked && d.recipeId) continue;
    let pool = recipes.filter(r => !used.has(r.id));
    if (!pool.length) pool = recipes;                // fewer recipes than days: allow repeats
    if (!pool.length) { d.recipeId = null; continue; }
    d.recipeId = pickOne(pool, now).id;
    used.add(d.recipeId);
  }
  return out;
}

export function swapDay(recipes, days, i, now = Date.now()) {
  const out = days.map(d => ({ ...d }));
  const used = new Set(out.map((d, j) => j !== i && d.recipeId).filter(Boolean));
  let pool = recipes.filter(r => !used.has(r.id) && r.id !== out[i].recipeId);
  if (!pool.length) pool = recipes.filter(r => r.id !== out[i].recipeId);
  if (pool.length) out[i].recipeId = pickOne(pool, now).id;
  return out;
}

export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
