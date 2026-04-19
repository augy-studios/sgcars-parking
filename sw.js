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
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Jua&family=Nunito:wght@400;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'
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

  // API calls — network only (live data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({
        error: 'Offline — no cached data available'
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 503,
      })
    ));
    return;
  }

  // OSM tiles — stale-while-revalidate
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('pnc-tiles').then(async cache => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then(resp => {
          cache.put(event.request, resp.clone());
          return resp;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});