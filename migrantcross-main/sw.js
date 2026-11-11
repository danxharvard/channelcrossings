/* Channel Crossings offline mode.
   Pages, figures and the site's own scripts and styles (studio.js, studio.css): fetched fresh from the
   network first, with the saved copy used when there is no connection or the network is very slow (the
   page then looks for newer figures by itself a minute later). Fetching them fresh keeps a new page from
   running with last week's script. Icons, fonts and vendor/ files: served from the saved copy straight
   away and refreshed in the background. Other sites (weather, map, Studio's worker) are never touched. */
const CACHE = "cc-v35";
const CORE = [
  "./", "index.html", "how-it-works.html", "privacy.html",
  "favicon.svg", "manifest.webmanifest", "icon-192.png", "apple-touch-icon.png",
  "vendor/leaflet/leaflet.js"
];

self.addEventListener("install", event => {
  // Straight from the server, not the browser's own cache, so a new worker never saves an old page.
  // One missing file must not stop the rest being saved.
  event.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(CORE.map(url => c.add(new Request(url, {cache: "reload"})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only whole, successful answers are worth keeping
const keep = response => response.status === 200 && response.type === "basic";
const save = (request, response) => caches.open(CACHE).then(c => c.put(request, response)).catch(() => {});

function networkFirst(event) {
  const request = event.request, nav = request.mode === "navigate";
  // a page is saved under its address without the query, so a Stripe return (?cs=) or an emailed sign-in link (?signin=)
  // is never kept on the device, and each new query doesn't add another copy of the page
  const key = nav ? request.url.split(/[?#]/)[0] : request;
  const saved = () => caches.match(key, {ignoreSearch: true}).then(hit => hit || (nav ? caches.match("index.html") : undefined));
  const got = fetch(request, {cache: "no-cache"}).then(response => ({response, copy: keep(response) ? response.clone() : null}));
  event.waitUntil(got.then(g => g.copy && save(key, g.copy)).catch(() => {}));   // saved even if the old copy was shown first
  const net = got.then(g => g.response);
  // a slow network: after a few seconds the saved copy is shown instead, if there is one
  const slow = new Promise(resolve => setTimeout(() => saved().then(hit => hit && resolve(hit)), nav ? 3500 : 4000));
  return Promise.race([net, slow]).catch(() => saved().then(hit => hit || Response.error()));
}

function staleWhileRevalidate(event) {
  const request = event.request;
  return caches.match(request).then(hit => {
    const fresh = fetch(request).then(response => {
      if (keep(response)) event.waitUntil(save(request, response.clone()));
      return response;
    });
    if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh.catch(() => Response.error());
  });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;           // weather, map tiles and other sites: not handled
  const path = url.pathname;
  const fresh = request.mode === "navigate" || path.endsWith("/") ||
    /\.(html|json|csv)$/.test(path) || (/\.(js|css)$/.test(path) && !path.includes("/vendor/"));
  event.respondWith(fresh ? networkFirst(event) : staleWhileRevalidate(event));
});
