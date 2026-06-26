const CACHE_NAME = 'borne-farms-v5';
const urlsToCache = [
  './',
  './dashboard.html',
  './index.css',
  './theme.css',
  './theme.js',
  './assets/day-farm.jpg',
  './assets/night-farm.jpg',
  './js/app.js',
  './js/data.js',
  './js/dashboard.js',
  './js/geospatial.js',
  './js/livestock.js',
  './js/movement.js',
  './js/health.js',
  './js/feed.js',
  './js/finance.js',
  'https://unpkg.com/lucide@latest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist/geotiff.min.js',
  'https://cdn.jsdelivr.net/npm/shpjs@4.0.4/dist/shp.min.js',
  'https://cdn.jsdelivr.net/npm/@tmcw/togeojson@5.8.0/dist/togeojson.umd.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
