const CACHE_NAME = 'casino-owo-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/betting.css',
  '/css/style.css',
  '/css/slots.css',
  '/css/xidach.css',
  '/css/poker.css',
  '/css/maubinh.css',
  '/css/roulette.css',
  '/css/bala.css',
  '/css/lobby.css',
  '/js/account.js',
  '/js/audio.js',
  '/js/app-shell.js',
  '/js/card.js',
  '/js/game.js',
  '/js/slots.js',
  '/js/xidach.js',
  '/js/poker.js',
  '/js/maubinh.js',
  '/js/roulette.js',
  '/js/bala.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
