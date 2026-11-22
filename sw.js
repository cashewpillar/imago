const CACHE_NAME = 'imago-shell-v12';
// Only the launcher shell is precached. Every other page is cached the
// first time it's opened online (see the fetch handler's runtime cache),
// so an install stays small no matter how many prototypes pile up here.
const APP_SHELL = [
  './',
  // BEGIN GENERATED HTML PAGES
  './index.html',
  './archive.html',
  './seldom.html',
  // END GENERATED HTML PAGES
  './offline.html',
  './scripts/dexie.min.js',
  './scripts/finance-charts.js',
  './imago-export.js',
  './pwa-register.js',
  './manifest.webmanifest',
  './icons/imago-icon.svg',
  './icons/imago-icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.method !== 'GET') {
    return;
  }

  if (!sameOrigin) {
    return;
  }

  // Network-first for every same-origin GET, not just navigations -- a
  // cache-first strategy here meant a script/data file, once cached, was
  // served stale forever regardless of how many times it changed on the
  // server (the only way back to fresh was bumping CACHE_NAME, easy to
  // forget). Falling back to cache only when the network is unavailable
  // keeps offline support while making freshness-when-online the default.
  const network = fetch(request).then(response => {
    if (response && response.status === 200 && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  });
  network.catch(() => {}); // a late failure after the cached copy was served is not an error

  // Page opens only: if the network hasn't answered in 2.5s and a cached copy
  // exists, serve that now (the fetch keeps running and refreshes the cache for
  // next time). A weak phone connection no longer stalls the app opening.
  const slowOpen = request.mode === 'navigate'
    ? new Promise(resolve => setTimeout(() => resolve(null), 2500))
    : null;

  event.respondWith((async () => {
    try {
      if (slowOpen) {
        const first = await Promise.race([network, slowOpen]);
        if (first) return first;
        const cached = await caches.match(request);
        if (cached) return cached;
      }
      return await network;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await caches.match('./offline.html')) || caches.match('./index.html');
      }
      return Response.error();
    }
  })());
});
