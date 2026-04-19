const CACHE = "sgcars-offline-v1";

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/theme.js',
  '/map.js',
  '/carparks.js',
  '/ev.js',
  '/app.js',
  '/manifest.json'
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
 
  // API calls: network only (live data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: 'Offline – no cached data available', value: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }
 
  // External CDN (Leaflet, fonts): stale-while-revalidate
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fresh = fetch(event.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          return res;
        });
        return cached || fresh;
      })
    );
    return;
  }
 
  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached ||
      fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      })
    )
  );
});