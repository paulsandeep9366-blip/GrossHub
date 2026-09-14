/**
 * GrossHub - Service Worker
 * Stale-while-revalidate offline caching strategy
 */

const CACHE_NAME = 'grosshub-v1.0.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './css/admin.css',
  './js/data.js',
  './js/store.js',
  './js/tracking.js',
  './js/rider.js',
  './js/admin.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
  './images/hero-basket.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
