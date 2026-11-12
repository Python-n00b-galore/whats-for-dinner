import { initStore, cloudEnabled } from "./store.js";
import { fillWeek, swapDay, mondayOf } from "./planner.js";

const $ = id => document.getElementById(id);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
let data = { recipes: [], plan: null };
let store;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const nameOf = id => (data.recipes.find(r => r.id === id) || {}).name;
const save = () => store.save(data);

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}
function jump() {
  const m = $("mascot"); m.classList.remove("jump"); void m.offsetWidth; m.classList.add("jump");
}

/* ---------- confetti ---------- */
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("confetti"), x = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const cols = ["#ffb59a", "#a8e6cf", "#ffe08a", "#ff9db1", "#b9c8ff"];
  const ps = Array.from({ length: 70 }, () => ({
    x: c.width / 2, y: c.height * 0.3, vx: (Math.random() - .5) * 12, vy: -Math.random() * 10 - 2,
    s: 5 + Math.random() * 6, col: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6
  }));
  let n = 0;
  (function frame() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.col; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++n < 110) requestAnimationFrame(frame); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* ---------- rendering ---------- */
function render() {
  const has = data.recipes.length > 0;
  $("sub").textContent = cloudEnabled ? "Synced ☁️" : "Local-only mode (no cloud set up yet)";
  $("signOutBtn").classList.toggle("hidden", !cloudEnabled);

  $("recipesEmpty").classList.toggle("hidden", has);
  $("recipes").innerHTML = "";
  [...data.recipes].sort((a, b) => a.name.localeCompare(b.name)).forEach(r => {
    const li = document.createElement("li");
    const s = document.createElement("span"); s.textContent = r.name;
    const ed = btn("✏️", "Rename", () => {
      const n = prompt("Rename recipe", r.name);
      if (n && n.trim()) { r.name = n.trim(); save(); render(); }
    });
    const del = btn("🗑️", "Delete", () => {
      if (!confirm(`Delete “${r.name}”?`)) return;
      data.recipes = data.recipes.filter(x => x.id !== r.id);
      if (data.plan) data.plan.days.forEach(d => { if (d.recipeId === r.id) { d.recipeId = null; d.locked = false; } });
      save(); render();
    });
    li.append(s, ed, del); $("recipes").append(li);
  });

  const plan = data.plan;
  $("planEmpty").classList.toggle("hidden", !!plan);
  $("regenBtn").classList.toggle("hidden", !plan);
  $("planBtn").textContent = plan ? "✨ New week" : "✨ Plan my week";
  $("days").innerHTML = "";
  $("weekLabel").textContent = "";
  if (!plan) return;
  const mon = new Date(plan.weekStart);
  $("weekLabel").textContent = "Week of " + mon.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  plan.days.forEach((d, i) => {
    const li = document.createElement("li");
    if (d.locked) li.classList.add("locked");
    const day = document.createElement("div"); day.className = "day"; day.textContent = DAYS[i];
    const meal = document.createElement("div"); meal.className = "meal"; meal.textContent = nameOf(d.recipeId) || "—";
    li.append(day, meal,
      btn(d.locked ? "🔒" : "🔓", "Lock day", () => { d.locked = !d.locked; save(); render(); }),
      btn("🎲", "Swap this day", () => {
        if (d.locked) return toast("Unlock this day first 🔓");
        plan.days = swapDay(data.recipes, plan.days, i); touch(plan.days); save(); render(); pulse(i);
      }));
    $("days").append(li);
  });
}
function pulse(i) { const li = $("days").children[i]; if (li) li.classList.add("pop"); }
function btn(txt, label, fn) {
  const b = document.createElement("button"); b.className = "icon"; b.textContent = txt; b.title = label;
  b.setAttribute("aria-label", label); b.onclick = fn; return b;
}
// remember when each planned recipe was last used
function touch(days) {
  const now = Date.now();
  days.forEach(d => { const r = data.recipes.find(x => x.id === d.recipeId); if (r) r.lastPlanned = now; });
}

/* ---------- plan generation ---------- */
function generate(keepLocks) {
  if (!data.recipes.length) return toast("Add some recipes first 📖");
  const old = data.plan && keepLocks ? data.plan.days : [];
  const base = DAYS.map((_, i) => ({ recipeId: old[i]?.locked ? old[i].recipeId : null, locked: !!old[i]?.locked }));
  const days = fillWeek(data.recipes, base);
  data.plan = { weekStart: (keepLocks && data.plan ? new Date(data.plan.weekStart) : mondayOf()).getTime(), days };
  touch(days); save();
  $("days").classList.add("shuffle");
  setTimeout(() => {
    $("days").classList.remove("shuffle"); render();
    [...$("days").children].forEach((li, i) => { li.style.animationDelay = i * 70 + "ms"; li.classList.add("pop"); });
    confetti(); jump();
  }, 600);
}

/* ---------- events ---------- */
$("planBtn").onclick = () => generate(false);
$("regenBtn").onclick = () => generate(true);
$("mascot").onclick = jump;
$("addForm").onsubmit = e => {
  e.preventDefault();
  const n = $("newRecipe").value.trim(); if (!n) return;
  if (data.recipes.some(r => r.name.toLowerCase() === n.toLowerCase())) return toast("Already in the list 🙂");
  data.recipes.push({ id: uid(), name: n, lastPlanned: 0 });
  $("newRecipe").value = ""; save(); render(); jump();
};
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
  $("tab-plan").classList.toggle("hidden", b.dataset.tab !== "plan");
  $("tab-recipes").classList.toggle("hidden", b.dataset.tab !== "recipes");
});
$("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `dinner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("signOutBtn").onclick = () => store.signOut();
$("loginForm").onsubmit = async e => {
  e.preventDefault(); $("loginErr").textContent = "";
  try { await store.signIn($("email").value, $("password").value); }
  catch { $("loginErr").textContent = "Couldn't sign in. Check email and password."; }
};

/* ---------- start ---------- */
store = await initStore({
  onData: d => { data = d; render(); },
  onAuth: signedIn => { $("login").classList.toggle("hidden", signedIn); $("main").classList.toggle("hidden", !signedIn); }
});
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
