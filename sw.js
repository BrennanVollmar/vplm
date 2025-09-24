// Simple cache-first service worker for static assets
const CACHE_NAME = 'tpm-field-static-v3';
const API_CACHE = 'tpm-field-api-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url)

  // Ensure browser reloads of deep links always resolve the SPA shell even if the
  // origin returns a 404 (GitHub Pages, static hosting, etc.).
  if (req.mode === 'navigate' && url.origin === location.origin) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(req);
        if (networkResponse.status === 404) {
          throw new Error('Navigation returned 404');
        }
        return networkResponse;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/') || await cache.match('/index.html');
        if (cachedIndex) {
          return cachedIndex;
        }
        return Response.redirect('/', 302);
      }
    })());
    return;
  }

  // NetworkFirst for Supabase REST GETs
  if (/supabase\.co\/rest\/v1\//.test(url.href)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        const copy = res.clone()
        const cache = await caches.open(API_CACHE)
        cache.put(req, copy)
        return res
      } catch {
        const cached = await caches.match(req)
        if (cached) return cached
        throw new Error('Network and cache missing')
      }
    })())
    return
  }

  // Cache map tiles (CacheFirst, limit by origin)
  if (/tile\.openstreetmap\.org\//.test(url.href) || /arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/.+\/tile\//.test(url.href)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(req)
        if (cached) return cached
        try {
          const res = await fetch(req)
          cache.put(req, res.clone())
          return res
        } catch (e) {
          if (cached) return cached
          throw e
        }
      })()
    )
    return
  }

  // CacheFirst for same-origin static
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});

// Background Sync: when triggered, ask all clients to run app-level sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'tpm-sync') {
    event.waitUntil(
      (async () => {
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientsList) {
          client.postMessage({ type: 'tpm-sync' })
        }
      })()
    )
  }
})

// Periodic Background Sync if available
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'tpm-periodic') {
    event.waitUntil(
      (async () => {
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientsList) {
          client.postMessage({ type: 'tpm-sync' })
        }
      })()
    )
  }
})
