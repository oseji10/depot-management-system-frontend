/* Depot service worker. Only salespeople register it. It lets the app open and run with no signal:
 *   - /_next/static files (the app's code, styles, fonts) are kept forever; they never change under the same name.
 *   - pages are fetched from the network first and kept; with no signal the last copy is shown.
 *   - API calls are never cached here. The app keeps its own copy of the day's data in IndexedDB.
 */
const STATIC = "depot-static-v1";
const PAGES = "depot-pages-v1";
const NETWORK_WAIT_MS = 5000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = [STATIC, PAGES];
    for (const k of await caches.keys()) if (k.startsWith("depot-") && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isPage = (req) => req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
const isRsc = (req) => req.headers.get("rsc") === "1" || new URL(req.url).searchParams.has("_rsc");
// Pages are stored by path (and kind), ignoring the changing ?_rsc=... part.
const pageKey = (req) => { const u = new URL(req.url); return new Request(u.origin + u.pathname + (isRsc(req) ? "?__rsc" : "")); };
const skipPath = (p) => p.startsWith("/api/") || p.startsWith("/login") || p.startsWith("/register") || p.startsWith("/forgot-password") || p.startsWith("/reset-password");

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (skipPath(url.pathname)) return;

  if (isPage(req) || isRsc(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGES);
      const key = pageKey(req);
      try {
        const res = await withTimeout(fetch(req), NETWORK_WAIT_MS);
        // Only keep real pages: not redirects (signed out) and not errors.
        if (res.ok && !res.redirected && !res.url.includes("/login")) { cache.put(key, res.clone()); return res; }
        // The server is up but cannot vouch for the sign-in (backend down, or it bounced us to /login): the saved page is
        // better than a dead end. A salesperson who really is signed out has the saved pages cleared at sign-out.
        if (res.status >= 500 || (res.redirected && res.url.includes("/login"))) {
          const saved = await cache.match(key);
          if (saved) return saved;
        }
        return res;
      } catch {
        const hit = await cache.match(key);
        if (hit) return hit;
        if (isPage(req) && !isRsc(req)) {
          const home = await cache.match(new Request(url.origin + "/"));
          if (home) return home;
        }
        return new Response("You are offline and this page has not been opened on this phone yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
  }
});

// The app asks us to open its main pages once while it has signal, so they work later with none.
self.addEventListener("message", (event) => {
  const msg = event.data || {};

  if (msg.type === "warm") {
    event.waitUntil((async () => {
      const pages = await caches.open(PAGES);
      const statics = await caches.open(STATIC);

      for (const path of msg.urls || []) {
        try {
          const res = await fetch(path, { headers: { Accept: "text/html" }, credentials: "same-origin" });
          if (!res.ok || res.redirected) continue;
          await pages.put(new Request(self.location.origin + path), res.clone());

          const html = await res.text();
          const files = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || []);
          for (const f of files) {
            if (await statics.match(f)) continue;
            try { const r = await fetch(f); if (r.ok) await statics.put(f, r); } catch { /* try again next time */ }
          }
        } catch { /* offline: nothing to warm */ }
      }
    })());
  }

  if (msg.type === "clear") {
    event.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("depot-pages")).map((k) => caches.delete(k)))));
  }
});
