// Offline shell cache. Bump VERSION when you change files so phones pick up the update.
const VERSION = "v2";
const SHELL = ["./", "index.html", "style.css", "app.js", "store.js", "planner.js", "firebase-config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Firebase SDK modules: cache after first load. Firestore/Auth API calls: leave to the SDK.
  if (u.origin !== location.origin && u.hostname !== "www.gstatic.com") return;
  // Network first (so your updates show up), fall back to cache offline.
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
