const CACHE_NAME = 'casino-owo-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/maubinh.css',
  '/css/poker.css',
  '/css/roulette.css',
  '/css/slots.css',
  '/css/xidach.css',
  '/js/account.js',
  '/js/card.js',
  '/js/firebase-config.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
