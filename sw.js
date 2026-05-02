const CACHE_NAME = 'imago-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './story.html',
  './commonplace.html',
  './thoughtweb.html',
  './filling-up.html',
  './no-rituals.html',
  './thoughtgraph.html',
  './storygraph.html',
  './pollination.html',
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
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dexie/3.2.4/dexie.min.js',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.js',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@300;400&display=swap'
];
const RUNTIME_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(APP_SHELL);
      await Promise.all(
        EXTERNAL_ASSETS.map(async asset => {
          try {
            const request = new Request(asset, { mode: 'no-cors' });
            const response = await fetch(request);
            await cache.put(request, response);
          } catch (error) {
            console.warn('Could not precache external asset:', asset, error);
          }
        })
      );
    })
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

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.method !== 'GET') {
    return;
  }

  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match('./index.html');
        })
    );
    return;
  }

  if (!sameOrigin && !RUNTIME_HOSTS.has(url.hostname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached;
      }

      return fetch(request).then(response => {
        if (!response) {
          return response;
        }

        if (
          sameOrigin
            ? response.status === 200 && response.type === 'basic'
            : response.type === 'opaque' || response.status === 200
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }

        return response;
      }).catch(() => cached);
    })
  );
});
