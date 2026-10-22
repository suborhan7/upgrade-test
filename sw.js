// Lets the studio install as an app and open offline.
// Network first: online you always get the newest version; the saved copy is only used offline.
// Every card's files are saved the first time they load, so cards you have opened work offline too.
importScripts("version.js");
const CACHE = "efcb-studio-v" + self.STUDIO_VERSION.n;
const FILES = ["./", "index.html", "version.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith("http")) return;
  const same = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    // no-cache: always ask the server for the newest file, never a stale copy from the browser cache.
    fetch(same ? new Request(e.request.url, { cache: "no-cache" }) : e.request)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
