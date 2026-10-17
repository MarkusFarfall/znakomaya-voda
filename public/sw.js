/* Only immutable game assets and navigation pages. Never player data. */
const CACHE = "zv-assets-v2";
const OFFLINE = "/offline";
const PRECACHE = [
  "/", OFFLINE, "/recover.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-icon.png",
  // Keep every hull available offline; processing into transparent sprite canvases remains on demand.
  "/boats/row.jpg", "/boats/kayak.jpg", "/boats/dinghy.jpg", "/boats/barkas.jpg", "/boats/cutter.jpg",
  "/boats/yacht.jpg", "/boats/seiner.jpg", "/boats/trawler.jpg", "/boats/research.jpg",
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("zv-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isStatic = url => url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
const validAsset = (url, res) => {
  if (!res || !res.ok) return false;
  const type = res.headers.get("content-type") || "";
  if (/\.js$/.test(url.pathname)) return /(?:javascript|ecmascript)/i.test(type);
  if (/\.css$/.test(url.pathname)) return /text\/css/i.test(type);
  return !/text\/html/i.test(type);
};
async function handle(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return fetch(request);
  const cache = await caches.open(CACHE);
  if (isStatic(url)) {
    const cached = await cache.match(request);
    if (validAsset(url, cached)) return cached;
    try {
      const res = await fetch(request);
      if (validAsset(url, res)) { await cache.put(request, res.clone()).catch(() => {}); return res; }
      // A 200 HTML fallback is not JavaScript. Never cache/return it as a chunk.
      return new Response("Game asset unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
    } catch {
      return new Response("Game asset unavailable offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  }
  // RSC/fetch requests are not documents; feeding them /offline HTML breaks Next.
  if (request.mode !== "navigate") return fetch(request);
  try {
    const res = await fetch(request);
    if (res.ok && /text\/html/i.test(res.headers.get("content-type") || "")) await cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch {
    return await cache.match(request) || await cache.match(OFFLINE) || new Response("Нет связи", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
self.addEventListener("fetch", event => event.respondWith(handle(event.request)));
