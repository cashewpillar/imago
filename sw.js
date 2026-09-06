const CACHE_NAME = 'imago-shell-v10';
const APP_SHELL = [
  './',
  // BEGIN GENERATED HTML PAGES
  './index.html',
  './archive.html',
  './seldom.html',
  './invest-asset-comparison.html',
  './invest-etf-comparison.html',
  './invest-risk-matrix.html',
  './invest-conviction-statement.html',
  './expenses.html',
  './food-v2.html',
  './invest.html',
  './journal.html',
  './notes.html',
  './performance.html',
  './savings.html',
  './scratchspace.html',
  './archive/architect.html',
  './archive/commonplace.html',
  './archive/day.html',
  './archive/filling-up.html',
  './archive/food.html',
  './archive/journal.html',
  './archive/mobile-database.html',
  './archive/pollination.html',
  './archive/story.html',
  './archive/storygraph.html',
  './archive/tablevault.html',
  './archive/thoughtgraph.html',
  './archive/thoughtweb.html',
  './seldom/4d-playground.html',
  './seldom/cebpac-flight-finder.html',
  './seldom/meralco-multi-account.html',
  './seldom/ulam-spiral.html',
  // END GENERATED HTML PAGES
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
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
