import { initStore, cloudEnabled } from "./store.js";
import { fillWeek, swapDay, mondayOf } from "./planner.js";

const $ = id => document.getElementById(id);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
let data = { recipes: [], weeks: [null, null, null] };
let store;
let cur = 0; // which of the 3 weeks is showing
const WEEKS = 3, WEEK_NAMES = ["This week", "Next week", "In 2 weeks"];

// Plans live in three fixed slots: data.weeks = [thisWeek, nextWeek, inTwoWeeks], each { days: [...] } or null.
// Nothing moves on its own: slots only shift when "New week" is pressed on the first page.
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function weekKey(i) { const m = mondayOf(); return keyOf(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * i)); }
const planAt = i => (data.weeks && data.weeks[i]) || null;
// convert data from earlier versions of the app (date-keyed plans / a single plan) into the three slots
function normalize(d) {
  const weeks = Array.isArray(d.weeks) ? d.weeks.slice(0, WEEKS) : [];
  while (weeks.length < WEEKS) weeks.push(null);
  if (d.plans) { weeks.forEach((w, i) => { if (!w && d.plans[weekKey(i)]) weeks[i] = d.plans[weekKey(i)]; }); }
  else if (d.plan) { const i = [...Array(WEEKS).keys()].find(i => weekKey(i) === keyOf(mondayOf(new Date(d.plan.weekStart)))); if (i !== undefined && !weeks[i]) weeks[i] = { days: d.plan.days }; }
  d.weeks = weeks.map(w => w || null);
  delete d.plans; delete d.plan;
  return d;
}
const otherWeeksRecipes = i => new Set([...Array(WEEKS).keys()].filter(j => j !== i)
  .flatMap(j => (planAt(j)?.days || []).map(d => d.recipeId).filter(Boolean)));

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
  $("recipeList").replaceChildren(...data.recipes.map(r => Object.assign(document.createElement("option"), { value: r.name })));
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
      data.weeks.forEach(p => p && p.days.forEach(d => { if (d.recipeId === r.id) { d.recipeId = null; d.locked = false; } }));
      save(); render();
    });
    li.append(s, ed, del); $("recipes").append(li);
  });

  renderWeeks();
}
function buildWeeks() {
  const box = $("weeks"), dots = $("dots");
  for (let w = 0; w < WEEKS; w++) {
    const sec = document.createElement("section"); sec.className = "week";
    sec.innerHTML = '<p class="weekname"></p><ul class="days"></ul><p class="muted center empty">Nothing planned yet. Add some recipes, then tap “New week”!</p>';
    sec.querySelector(".weekname").textContent = WEEK_NAMES[w];
    box.append(sec); dots.append(document.createElement("i"));
  }
  let t;
  box.addEventListener("scroll", () => {
    const i = Math.max(0, Math.min(WEEKS - 1, Math.round(box.scrollLeft / box.clientWidth)));
    if (i !== cur) { cur = i; updateNav(); }
    clearTimeout(t); t = setTimeout(() => { if (cur !== lastSettled) { lastSettled = cur; jump(); } }, 150);
  }, { passive: true });
}
let lastSettled = 0;
function updateNav() {
  [...$("dots").children].forEach((d, i) => d.classList.toggle("on", i === cur));
  const has = !!planAt(cur);
  $("regenBtn").classList.toggle("hidden", !has);
  
}
function renderWeeks() {
  [...$("weeks").children].forEach((sec, w) => {
    const plan = planAt(w), ul = sec.querySelector(".days");
    ul.innerHTML = "";
    sec.querySelector(".empty").classList.toggle("hidden", !!plan);
    if (!plan) return;
    plan.days.forEach((d, i) => {
      const li = document.createElement("li");
      if (d.locked) li.classList.add("locked");
      const day = document.createElement("div"); day.className = "day"; day.textContent = DAYS[i];
      const meal = document.createElement("div"); meal.className = "meal editable";
      meal.textContent = nameOf(d.recipeId) || d.custom || "—";
      meal.title = "Tap to edit"; meal.onclick = () => editDay(w, i, meal);
      li.append(day, meal,
        btn(d.locked ? "🔒" : "🔓", "Lock day", () => { d.locked = !d.locked; save(); render(); }),
        btn("🎲", "Swap this day", () => {
          if (d.locked) return toast("Unlock this day first 🔓");
          plan.days = swapDay(data.recipes, plan.days, i, Date.now(), otherWeeksRecipes(w));
          touch(plan.days); save(); render(); pulse(w, i);
        }));
      ul.append(li);
    });
  });
  updateNav();
}
// Tap a day to type what's for dinner. A known recipe name links to that recipe; anything else is kept as free text.
function editDay(w, i, el) {
  const d = planAt(w).days[i];
  const input = document.createElement("input");
  input.type = "text"; input.className = "dayinput"; input.maxLength = 80; input.setAttribute("list", "recipeList");
  input.value = nameOf(d.recipeId) || d.custom || ""; input.placeholder = "What's for dinner?";
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    const v = input.value.trim();
    if (ok && v !== (nameOf(d.recipeId) || d.custom || "")) {
      const r = data.recipes.find(x => x.name.toLowerCase() === v.toLowerCase());
      if (r) { d.recipeId = r.id; delete d.custom; r.lastPlanned = Date.now(); }
      else if (v) { d.recipeId = null; d.custom = v; }
      else { d.recipeId = null; delete d.custom; }
      d.locked = !!(d.recipeId || d.custom); // hand-picked days stay put when reshuffling
      save();
    }
    render();
  };
  input.onkeydown = e => { if (e.key === "Enter") finish(true); else if (e.key === "Escape") finish(false); };
  input.onblur = () => finish(true);
  el.replaceChildren(input); el.onclick = null; input.focus(); input.select();
}
function pulse(w, i) { const li = $("weeks").children[w].querySelector(".days").children[i]; if (li) li.classList.add("pop"); }
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
const emptyDays = () => DAYS.map(() => ({ recipeId: null, locked: false }));
function makePlan(w, base) { return { days: fillWeek(data.recipes, base, Date.now(), otherWeeksRecipes(w)) }; }
function generate(keepLocks) {
  if (!data.recipes.length) return toast("Add some recipes first 📖");
  const w = cur, existing = planAt(w);
  let animate = w;
  if (keepLocks) {
    // reshuffle: keep locked days, refill the rest of this week
    const old = existing ? existing.days : [];
    const base = DAYS.map((_, i) => ({ recipeId: old[i]?.locked ? old[i].recipeId : null, locked: !!old[i]?.locked, ...(old[i]?.locked && old[i].custom ? { custom: old[i].custom } : {}) }));
    data.weeks[w] = makePlan(w, base);
  } else if (!existing) {
    data.weeks[w] = makePlan(w, emptyDays());
  } else if (w === 0) {
    // "New week" on the first page: this week is done, everything moves one step forward, last page gets a fresh plan
    if (!confirm("Start a new week? The current plan will be removed, the other weeks move forward, and a new plan is made for the last page.")) return;
    data.weeks = [data.weeks[1] || null, data.weeks[2] || null, null];
    data.weeks[2] = makePlan(2, emptyDays());
    animate = 0;
  } else {
    if (!confirm(`Replace ${WEEK_NAMES[w].toLowerCase()}'s plan with a brand new one? The current plan will be lost.`)) return;
    data.weeks[w] = makePlan(w, emptyDays());
  }
  data.weeks.forEach(p => p && touch(p.days));
  save();
  const ul = $("weeks").children[animate].querySelector(".days");
  ul.classList.add("shuffle");
  setTimeout(() => {
    ul.classList.remove("shuffle"); render();
    const list = $("weeks").children[animate].querySelector(".days");
    [...list.children].forEach((li, i) => { li.style.animationDelay = i * 70 + "ms"; li.classList.add("pop"); });
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
buildWeeks();
store = await initStore({
  onData: d => { data = normalize(d); render(); },
  onAuth: signedIn => { $("login").classList.toggle("hidden", signedIn); $("main").classList.toggle("hidden", !signedIn); }
});
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// show unexpected errors on screen so they can be reported
addEventListener("error", e => toast("Oops: " + (e.message || "something went wrong")));
addEventListener("unhandledrejection", e => toast("Oops: " + ((e.reason && e.reason.message) || "something went wrong")));
